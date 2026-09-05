import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPostgresAccountRepository } from "../postgres-account-repository.mjs";
import { createPostgresAccountLifecycle } from "../account-lifecycle.mjs";
import { LocalFilesystemImageStorage } from "../image-storage.mjs";

// The caller first proves that its PostgreSQL database is empty, disposable,
// and loopback-only, and replaces Neon's transport with local connections.
export async function runPostgresAccountLinkLifecycleCases({ sql, setStatementHook }) {
  const { handleRequest } = await import("../app.mjs");
  const accounts = createPostgresAccountRepository(sql);
  const lifecycle = createPostgresAccountLifecycle(sql);
  const A = "web:pg-link-upload-source", B = "apple:pg-link-upload-target";
  const tokens = {};
  for (const userID of [A, B]) {
    const [provider, subject] = userID.split(":");
    const signedIn = await accounts.signIn({ appUserID: userID, authProvider: provider,
      authProviderUserID: subject, displayName: "Synthetic account-link race", signedInAt: new Date().toISOString() });
    tokens[userID] = signedIn.account.backendSessionToken;
  }
  await accounts.saveEntitlement(A, { plan: "pro", source: "synthetic-local-fixture" });
  const temporary = await mkdtemp(join(tmpdir(), "permitext-pg-link-assets-"));
  const previousAssetRoot = process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH;
  process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH = temporary;
  const server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(new URL(url).origin, base, "Account-link race acceptance forbids external requests.");
    return originalFetch(url, options);
  };
  const post = async (path, body, token) => {
    const response = await fetch(base + path, { method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const projectID = randomUUID(), assetID = randomUUID();
  const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  const hash = value => createHash("sha256").update(value).digest("hex").slice(0, 32);
  const pathname = `project-assets/${hash(projectID)}/notebook/${hash(A)}/${hash(assetID)}.png`;
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k9sAAAAASUVORK5CYII=", "base64");
  try {
    const pushed = await post("/sync/push", { auth: { accountUserID: A }, batch: { user: { id: A }, mutations: [
      { project: { id: `${A}:project:${projectID}`, clientID: projectID, userID: A, codeVersion,
        name: "Synthetic upload/link Project", updatedAt: new Date().toISOString() } }
    ] } }, tokens[A]);
    assert.equal(pushed.status, 200, JSON.stringify(pushed.body));
    const originalPut = LocalFilesystemImageStorage.prototype.put;
    let resume, reached, deadline;
    const gate = new Promise(resolve => { resume = resolve; });
    const entered = new Promise(resolve => { reached = resolve; });
    LocalFilesystemImageStorage.prototype.put = async function(key, bytes, type) {
      if (key === pathname) { reached(); await gate; }
      return originalPut.call(this, key, bytes, type);
    };
    const upload = fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID, assetID }), {
      method: "POST", headers: { authorization: `Bearer ${tokens[A]}`, "x-permitext-user-id": A,
        "content-type": "image/png" }, body: image
    }).then(async response => ({ status: response.status, body: await response.json() }));
    let link, uploaded;
    try {
      await Promise.race([entered,
        upload.then(result => { throw new Error(`Upload stopped before storage: ${JSON.stringify(result)}`); }),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Upload boundary not reached")), 20000); })]);
      clearTimeout(deadline);
      link = await post("/account/link-browser", { auth: { accountUserID: B }, browserCredentialID: A.slice(4) }, tokens[B]);
    } finally {
      clearTimeout(deadline); resume();
      LocalFilesystemImageStorage.prototype.put = originalPut;
      uploaded = await upload;
    }
    const sourcePresent = Boolean((await sql`SELECT id FROM permitext_users WHERE id = ${A}`).length);
    const lateSourceArtifacts = (await sql`SELECT count(*)::int AS count FROM permitext_foundation_artifacts WHERE user_id = ${A}`)[0].count;
    console.log(JSON.stringify({ scenario: "upload-before-account-link", linkStatus: link.status,
      uploadStatus: uploaded.status, sourcePresent, lateSourceArtifacts }));
    assert.equal(link.status, 409, JSON.stringify(link.body));
    assert.equal(link.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal(sourcePresent, true);
    assert.equal(lateSourceArtifacts, 1);
    assert.deepEqual(await readFile(join(temporary, pathname)), image);

    // Direct repository calls and sign-in linking must obey the same boundary.
    // In particular, a caller must not exclude a guard supplied in JSON.
    for (const owner of [A, B]) {
      await lifecycle.begin(owner, "synthetic-other-operation");
      try {
        await assert.rejects(accounts.mergeAccounts(A, B), { code: "ACCOUNT_LINK_OPERATION_IN_PROGRESS" });
        const forged = await post("/account/link-browser", { auth: { accountUserID: B }, browserCredentialID: A.slice(4),
          operationIDsByUserID: { [owner]: "synthetic-other-operation" } }, tokens[B]);
        assert.equal(forged.status, 409);
        assert.equal(forged.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
        const signIn = await post("/account/sign-in", { credential: { provider: "apple", providerUserID: B.slice(6) },
          linkFrom: { accountUserID: A, sessionToken: tokens[A] },
          operationIDsByUserID: { [owner]: "synthetic-other-operation" } }, "");
        assert.equal(signIn.status, 409, JSON.stringify(signIn.body));
        assert.equal(signIn.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
        assert.equal((await sql`SELECT id FROM permitext_users WHERE id IN (${A}, ${B})`).length, 2);
      } finally { await lifecycle.finish(owner, "synthetic-other-operation"); }
      await lifecycle.claimDeletion(owner, "synthetic-deletion");
      try {
        await assert.rejects(accounts.mergeAccounts(A, B), { code: "ACCOUNT_LINK_OPERATION_IN_PROGRESS" });
      } finally { await lifecycle.releaseDeletion(owner, "synthetic-deletion"); }
    }

    // Start the Serializable snapshot before a new operation registers, but
    // pause before the parent row lock. The lifecycle lock must reject the
    // now-stale snapshot rather than overlooking that newly committed writer.
    let resumeSnapshot, snapshotReached, snapshotTimer;
    const snapshotGate = new Promise(resolve => { resumeSnapshot = resolve; });
    const snapshotEntered = new Promise(resolve => { snapshotReached = resolve; });
    setStatementHook(async (query, client) => {
      if (!query.query.includes("identities_present") || !query.params.includes(A)) return;
      setStatementHook(null);
      await client.query("SELECT pg_current_snapshot()");
      snapshotReached(); await snapshotGate;
    });
    const staleMerge = accounts.mergeAccounts(A, B);
    // Attach rejection handling immediately while its snapshot is held.
    const staleResult = staleMerge.then(value => ({ value }), error => ({ error }));
    try {
      await Promise.race([snapshotEntered,
        staleResult.then(() => { throw new Error("Merge did not reach its snapshot boundary"); }),
        new Promise((_, reject) => { snapshotTimer = setTimeout(() => reject(new Error("Snapshot boundary not reached")), 20000); })]);
      clearTimeout(snapshotTimer);
      await lifecycle.begin(A, "synthetic-after-snapshot");
    } finally { clearTimeout(snapshotTimer); setStatementHook(null); resumeSnapshot(); }
    assert.equal((await staleResult).error?.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
    await lifecycle.finish(A, "synthetic-after-snapshot");
    assert.equal((await sql`SELECT id FROM permitext_users WHERE id = ${A}`).length, 1);

    // Reverse order: once the merge owns both parent locks, an old-session
    // upload waits and then fails authentication, before writing any bytes.
    let resumeMerge, mergeReached, mergeTimer;
    const mergeGate = new Promise(resolve => { resumeMerge = resolve; });
    const mergeEntered = new Promise(resolve => { mergeReached = resolve; });
    setStatementHook(async query => {
      if (!query.query.includes("accounts_idle") || !query.params.includes(A)) return;
      setStatementHook(null); mergeReached(); await mergeGate;
    });
    const finalLink = post("/account/link-browser", { auth: { accountUserID: B }, browserCredentialID: A.slice(4) }, tokens[B]);
    const rejectedAssetID = randomUUID();
    const rejectedPath = `project-assets/${hash(projectID)}/notebook/${hash(A)}/${hash(rejectedAssetID)}.png`;
    let lateUpload, operationReached;
    const operationEntered = new Promise(resolve => { operationReached = resolve; });
    try {
      await Promise.race([mergeEntered,
        finalLink.then(result => { throw new Error(`Link stopped before lifecycle lock: ${JSON.stringify(result)}`); }),
        new Promise((_, reject) => { mergeTimer = setTimeout(() => reject(new Error("Merge lock not reached")), 20000); })]);
      clearTimeout(mergeTimer);
      setStatementHook(async query => {
        if (query.query.includes("INSERT INTO permitext_account_lifecycle") && query.query.includes("FOR KEY SHARE") && query.params.includes(A)) {
          setStatementHook(null); operationReached();
        }
      });
      lateUpload = fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID, assetID: rejectedAssetID }), {
        method: "POST", headers: { authorization: `Bearer ${tokens[A]}`, "x-permitext-user-id": A, "content-type": "image/png" }, body: image
      }).then(async response => ({ status: response.status, body: await response.json() }));
      await Promise.race([operationEntered,
        lateUpload.then(result => { throw new Error(`Late upload stopped before lock: ${JSON.stringify(result)}`); }),
        new Promise((_, reject) => { mergeTimer = setTimeout(() => reject(new Error("Late operation lock not reached")), 20000); })]);
    } finally { clearTimeout(mergeTimer); setStatementHook(null); resumeMerge(); }
    const completed = await finalLink;
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal((await lateUpload).status, 401);
    assert.equal((await sql`SELECT id FROM permitext_users WHERE id = ${A}`).length, 0);
    assert.equal((await sql`SELECT id FROM permitext_foundation_artifacts WHERE user_id = ${A}`).length, 0);
    await assert.rejects(readFile(join(temporary, rejectedPath)), { code: "ENOENT" });
    // The upload accepted before linking is preserved and readable by its new owner.
    const read = await fetch(base + "/notebook/assets/read", { method: "POST", headers: {
      authorization: `Bearer ${tokens[B]}`, "content-type": "application/json" },
      body: JSON.stringify({ auth: { accountUserID: B }, projectID, assetID }) });
    assert.equal(read.status, 200);
    assert.deepEqual(Buffer.from(await read.arrayBuffer()), image);

    // A historical duplicate Apple identity also reaches mergeAccounts through
    // signIn's recursive canonicalization path, without an explicit linkFrom.
    const appleSource = "apple:pg-auto-link-source", appleTarget = "apple:pg-auto-link-target";
    for (const userID of [appleSource, appleTarget]) {
      await accounts.signIn({ appUserID: userID, authProvider: "apple", authProviderUserID: userID.slice(6),
        displayName: "Synthetic duplicate Apple identity", signedInAt: new Date().toISOString() });
    }
    await sql`UPDATE permitext_users SET account = account || jsonb_build_object('linkedAppleUserIDs', jsonb_build_array(${appleSource.slice(6)}::text)) WHERE id = ${appleTarget}`;
    await lifecycle.begin(appleTarget, "synthetic-auto-link-writer");
    const automaticSignIn = () => post("/account/sign-in", { credential: { provider: "apple", providerUserID: appleSource.slice(6) } }, "");
    try {
      const blockedAuto = await automaticSignIn();
      assert.equal(blockedAuto.status, 409, JSON.stringify(blockedAuto.body));
      assert.equal(blockedAuto.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
      assert.equal((await sql`SELECT id FROM permitext_users WHERE id IN (${appleSource}, ${appleTarget})`).length, 2);
    } finally { await lifecycle.finish(appleTarget, "synthetic-auto-link-writer"); }
    const recoveredAuto = await automaticSignIn();
    assert.equal(recoveredAuto.status, 200, JSON.stringify(recoveredAuto.body));
    assert.equal(recoveredAuto.body.account.appUserID, appleTarget);
    assert.equal((await sql`SELECT id FROM permitext_users WHERE id = ${appleSource}`).length, 0);
    console.log("PostgreSQL account-link lifecycle passed: in-flight upload, both owners, deletion claims, forged bypass rejected, stale Serializable snapshot, reverse race, retained image access, and automatic Apple-identity repair.");
  } finally {
    setStatementHook(null);
    globalThis.fetch = originalFetch;
    if (previousAssetRoot === undefined) delete process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH;
    else process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH = previousAssetRoot;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
}
