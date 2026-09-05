import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFilesystemImageStorage } from "../image-storage.mjs";

const temporary = await mkdtemp(join(tmpdir(), "permitext-account-assets-"));
const dataPath = join(temporary, "sync.json"), assetRoot = join(temporary, "assets");
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: dataPath, PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: assetRoot,
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-private-assets-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "STRIPE_SECRET_KEY"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, "Private-file acceptance forbids external requests.");
  return originalFetch(url, options);
};
async function post(path, body, token) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function signIn(id) {
  const result = await post("/account/sign-in", { credential: { provider: "web", providerUserID: id, displayName: "Synthetic private-file test" } });
  assert.equal(result.status, 200);
  return result.body.account;
}
async function push(account, mutation) {
  const result = await post("/sync/push", { auth: { accountUserID: account.appUserID },
    batch: { user: { id: account.appUserID }, mutations: [mutation] }
  }, account.backendSessionToken);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32);
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k9sAAAAASUVORK5CYII=", "base64");
const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
try {
  const A = await signIn("private-assets-a"), B = await signIn("private-assets-b");
  const uploaded = [];
  for (const account of [A, B]) {
    const projectID = randomUUID(), assetID = randomUUID();
    assert.equal((await post("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
    await push(account, { project: { id: `${account.appUserID}:project:${projectID}`, clientID: projectID,
      userID: account.appUserID, codeVersion, name: "Synthetic private-file Project", updatedAt: new Date().toISOString() } });
    const response = await fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID, assetID }), {
      method: "POST", headers: { authorization: `Bearer ${account.backendSessionToken}`,
        "x-permitext-user-id": account.appUserID, "content-type": "image/png" }, body: image
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    const pathname = `project-assets/${hash(projectID)}/notebook/${hash(account.appUserID)}/${hash(assetID)}.png`;
    assert.deepEqual(await readFile(join(assetRoot, pathname)), image);
    uploaded.push({ projectID, assetID, pathname });
  }
  const [own, other] = uploaded;
  const orphanPath = own.pathname.replace(/[^/]+$/, `${hash("synthetic-unconfirmed-upload")}.png`);
  await writeFile(join(assetRoot, orphanPath), image);
  // Client-supplied Project identifiers are not globally unique ownership
  // credentials. Duplicating one must not expose an existing private image.
  await push(A, { project: { id: `${A.appUserID}:project:${other.projectID}`, clientID: other.projectID,
    userID: A.appUserID, codeVersion, name: "Synthetic colliding Project", updatedAt: new Date().toISOString() } });
  const foreignRead = await fetch(base + "/notebook/assets/read", { method: "POST", headers: {
    authorization: `Bearer ${A.backendSessionToken}`, "content-type": "application/json"
  }, body: JSON.stringify({ auth: { accountUserID: A.appUserID }, projectID: other.projectID, pathname: other.pathname }) });
  assert.equal(foreignRead.status, 403, "A repeated Project identifier must not authorize reading B's image.");
  const collidingUpload = await fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID: other.projectID, assetID: other.assetID }), {
    method: "POST", headers: { authorization: `Bearer ${A.backendSessionToken}`,
      "x-permitext-user-id": A.appUserID, "content-type": "image/png" }, body: image
  });
  assert.equal(collidingUpload.status, 409, "A colliding image identity must not report an unsaved upload as successful.");
  const rejectedPath = `project-assets/${hash(other.projectID)}/notebook/${hash(A.appUserID)}/${hash(other.assetID)}.png`;
  await assert.rejects(readFile(join(assetRoot, rejectedPath)), { code: "ENOENT" });
  assert.deepEqual(await readFile(join(assetRoot, other.pathname)), image);
  // Authenticated ordinary note text must never become deletion authority over
  // another account's file, even when its exact storage pathname is known.
  const noteID = `${A.appUserID}:annotation:external-file-reference`;
  const notePush = await push(A, { annotation: { id: noteID, userID: A.appUserID,
    codeVersion, sectionID: 101, blockID: "", noteBody: other.pathname,
    updatedAt: new Date().toISOString() } });
  assert.ok(notePush.acceptedMutationIDs.includes(noteID));
  let latePath;
  let pauseInventory;
  let inventoryEntered;
  let inventoryDeadline;
  const originalList = LocalFilesystemImageStorage.prototype.list;
  let deletion;
  if (process.env.PERMITEXT_SYNC_DATABASE_URL) {
    // Pause the real storage provider after authorization, before the write.
    // PostgreSQL allows the deletion request to run on another connection.
    const originalPut = LocalFilesystemImageStorage.prototype.put;
    const lateID = randomUUID();
    latePath = `project-assets/${hash(own.projectID)}/notebook/${hash(A.appUserID)}/${hash(lateID)}.png`;
    let resumeUpload, uploadEntered, deadline;
    const gate = new Promise(resolve => { resumeUpload = resolve; });
    const entered = new Promise(resolve => { uploadEntered = resolve; });
    LocalFilesystemImageStorage.prototype.put = async function(key, bytes, type) {
      if (key === latePath) { uploadEntered(); await gate; }
      return originalPut.call(this, key, bytes, type);
    };
    const upload = fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID: own.projectID, assetID: lateID }), {
      method: "POST", headers: { authorization: `Bearer ${A.backendSessionToken}`,
        "x-permitext-user-id": A.appUserID, "content-type": "image/png" }, body: image
    });
    try {
      await Promise.race([entered, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Upload boundary not reached")), 20000); })]);
      clearTimeout(deadline);
      const busy = await post("/account/delete", { auth: { accountUserID: A.appUserID }, confirmation: "DELETE" }, A.backendSessionToken);
      assert.equal(busy.status, 409, JSON.stringify(busy.body));
      assert.equal(busy.body.code, "ACCOUNT_OPERATION_IN_PROGRESS");
      assert.equal(busy.body.partial, false);
      assert.deepEqual(await readFile(join(assetRoot, own.pathname)), image, "Busy deletion must not begin removing files.");
    } finally {
      clearTimeout(deadline);
      resumeUpload();
      LocalFilesystemImageStorage.prototype.put = originalPut;
      const result = await upload;
      assert.equal(result.status, 200, await result.text());
    }
    assert.deepEqual(await readFile(join(assetRoot, latePath)), image);

    // Reverse order: hold deletion at its inventory boundary, while its durable
    // claim is active. A second request must stop before starting file storage.
    const inventoryGate = new Promise(resolve => { pauseInventory = resolve; });
    const reached = new Promise(resolve => { inventoryEntered = resolve; });
    LocalFilesystemImageStorage.prototype.list = async function(prefix) {
      if (prefix.includes(hash(A.appUserID))) { inventoryEntered(); await inventoryGate; }
      return originalList.call(this, prefix);
    };
    deletion = post("/account/delete", { auth: { accountUserID: A.appUserID }, confirmation: "DELETE" }, A.backendSessionToken);
    try {
      await Promise.race([reached,
        deletion.then(result => { throw new Error(`Deletion stopped before inventory: ${JSON.stringify(result)}`); }),
        new Promise((_, reject) => { inventoryDeadline = setTimeout(() => reject(new Error("Deletion boundary not reached")), 20000); })]);
      clearTimeout(inventoryDeadline);
      const rejected = await fetch(base + "/notebook/assets/upload?" + new URLSearchParams({ projectID: own.projectID, assetID: randomUUID() }), {
        method: "POST", headers: { authorization: `Bearer ${A.backendSessionToken}`,
          "x-permitext-user-id": A.appUserID, "content-type": "image/png" }, body: image
      });
      assert.equal(rejected.status, 409);
      assert.equal((await rejected.json()).code, "ACCOUNT_DELETION_IN_PROGRESS");
      const signin = await post("/account/sign-in", { credential: { provider: "web", providerUserID: "private-assets-a", displayName: "Synthetic private-file test" } });
      assert.equal(signin.status, 409, "An existing account must not sign in during deletion.");
      assert.equal(signin.body.code, "ACCOUNT_DELETION_IN_PROGRESS");
    } finally {
      clearTimeout(inventoryDeadline);
      pauseInventory();
      LocalFilesystemImageStorage.prototype.list = originalList;
      await deletion;
    }
  }
  const deleted = deletion ? await deletion : await post("/account/delete", { auth: { accountUserID: A.appUserID }, confirmation: "DELETE" }, A.backendSessionToken);
  if (latePath) await assert.rejects(readFile(join(assetRoot, latePath)), { code: "ENOENT" });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  await assert.rejects(readFile(join(assetRoot, own.pathname)), { code: "ENOENT" });
  await assert.rejects(readFile(join(assetRoot, orphanPath)), { code: "ENOENT" });
  assert.deepEqual(await readFile(join(assetRoot, other.pathname)), image,
    "Deleting A must not erase B's image named in A's note.");
  const readOther = await fetch(base + "/notebook/assets/read", { method: "POST", headers: {
    authorization: `Bearer ${B.backendSessionToken}`, "content-type": "application/json"
  }, body: JSON.stringify({ auth: { accountUserID: B.appUserID }, projectID: other.projectID, assetID: other.assetID }) });
  assert.equal(readOther.status, 200);
  assert.deepEqual(Buffer.from(await readOther.arrayBuffer()), image);
  const stale = await post("/sync/pull", { auth: { accountUserID: A.appUserID } }, A.backendSessionToken);
  assert.equal(stale.status, 401, "The deleted account's old session must remain unusable.");
  console.log("Private account deletion HTTP passed: server-uploaded own image removed, another account's referenced image preserved and readable.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
