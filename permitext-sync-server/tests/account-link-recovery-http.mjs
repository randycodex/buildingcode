import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Fresh synthetic identities and local file storage only. No real sign-in,
// external provider, database, or account deletion is involved.
const temporary = await mkdtemp(join(tmpdir(), "permitext-account-link-http-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-link-grant",
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets") });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === "string" ? input : input.url).origin, base,
    "Synthetic account linking forbids external requests.");
  return originalFetch(input, options);
};
async function signIn(provider, providerUserID, linkFrom, extraCredential = {}) {
  const response = await fetch(`${base}/account/sign-in`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential: { provider, providerUserID, ...extraCredential }, linkFrom }) });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  return payload;
}
try {
  const A = (await signIn("web", "synthetic-link-a")).account;
  const grant = await fetch(`${base}/admin/lifetime-grants/grant`, { method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer synthetic-link-grant" },
    body: JSON.stringify({ userID: A.appUserID }) });
  assert.equal(grant.status, 200);
  const saved = await fetch(`${base}/sync/push`, { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${A.backendSessionToken}` },
    body: JSON.stringify({ auth: { accountUserID: A.appUserID }, batch: { user: { id: A.appUserID },
      mutations: [{ project: { id: `${A.appUserID}:project:link-project`, userID: A.appUserID,
        codeVersion: "nyc-2022", clientID: "link-project", name: "Retained linked Project",
        address: "100 Synthetic Link Street", colorHex: "#334455", sortOrder: 0,
        updatedAt: new Date().toISOString() } }] } }) });
  assert.equal(saved.status, 200);
  await signIn("apple", "synthetic-link-b", { accountUserID: A.appUserID, sessionToken: A.backendSessionToken });
  // Deliberately discard the successful merge response. A subsequent ordinary
  // sign-in, with no source session or merge receipt, must carry the ancestry.
  const recoveredB = await signIn("apple", "synthetic-link-b");
  assert.equal(recoveredB.mergedAccount, null);
  assert.deepEqual(recoveredB.account.mergedAccountIDs, [A.appUserID]);
  assert.deepEqual(recoveredB.confirmedLinkedAccountIDs, [A.appUserID]);
  const B = recoveredB.account;
  await signIn("apple", "synthetic-link-c", { accountUserID: B.appUserID, sessionToken: B.backendSessionToken });
  const recoveredC = await signIn("apple", "synthetic-link-c");
  assert.equal(recoveredC.mergedAccount, null);
  assert.deepEqual([...recoveredC.account.mergedAccountIDs].sort(), [A.appUserID, B.appUserID].sort(),
    "A → B → C must preserve confirmed A and B ancestry after the source records are removed.");
  assert.deepEqual([...recoveredC.confirmedLinkedAccountIDs].sort(), [A.appUserID, B.appUserID].sort());
  assert.equal(recoveredC.entitlement.grantedUserID, recoveredC.account.appUserID,
    "Successive links must preserve and retarget the existing entitlement.");
  const pulled = await fetch(`${base}/sync/pull`, { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${recoveredC.account.backendSessionToken}` },
    body: JSON.stringify({ auth: { accountUserID: recoveredC.account.appUserID } }) });
  assert.equal(pulled.status, 200);
  const linkedProject = (await pulled.json()).mutations.find((mutation) => mutation.project)?.project;
  assert.equal(linkedProject.name, "Retained linked Project");
  assert.equal(linkedProject.userID, recoveredC.account.appUserID);
  for (const source of [A, B]) {
    const obsolete = await fetch(`${base}/sync/pull`, { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${source.backendSessionToken}` },
      body: JSON.stringify({ auth: { accountUserID: source.appUserID } }) });
    assert.equal(obsolete.status, 401, "Merged source sessions must no longer authorize access.");
  }
  const unrelated = await signIn("web", "synthetic-link-unrelated", undefined,
    { mergedAccountIDs: [A.appUserID, B.appUserID] });
  assert.deepEqual(unrelated.account.mergedAccountIDs || [], [],
    "Client-supplied credential metadata cannot grant access to another account's retained work.");
  const forged = { mergedAccountIDs: [A.appUserID, B.appUserID],
    confirmedLinkedAccountIDs: [A.appUserID, B.appUserID], authProvider: "forged-provider",
    appleBillingAccountToken: "11111111-1111-4111-8111-111111111111" };
  for (const [path, body] of [
    ["/account/attach-local-data", { account: { ...unrelated.account, ...forged } }],
    ["/sync/push", { auth: { accountUserID: unrelated.account.appUserID },
      batch: { user: { id: unrelated.account.appUserID, ...forged }, mutations: [] } }]
  ]) {
    const response = await fetch(base + path, { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${unrelated.account.backendSessionToken}` },
      body: JSON.stringify(body) });
    assert.equal(response.status, 200, path);
  }
  const untainted = await signIn("web", "synthetic-link-unrelated");
  assert.deepEqual(untainted.confirmedLinkedAccountIDs, [], "Sync/attachment metadata cannot forge the server checkpoint.");
  assert.equal(untainted.account.authProvider, "web");
  assert.deepEqual(untainted.account.mergedAccountIDs || [], []);
  assert.notEqual(untainted.account.appleBillingAccountToken, forged.appleBillingAccountToken);
  console.log("Account link recovery HTTP passed (lost receipts, successive merges, untrusted ancestry rejected).");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
