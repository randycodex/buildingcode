import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "permitext-free-access-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-free-access-admin" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "STRIPE_SECRET_KEY"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, "This test must never contact an external service.");
  return originalFetch(url, options);
};
async function post(path, body, token) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
try {
  const signIn = await post("/account/sign-in", { credential: { provider: "web", providerUserID: "minimal-free-test" } });
  assert.equal(signIn.status, 200);
  const account = signIn.body.account, userID = account.appUserID;
  const codeVersion = "nyc-2022";
  const records = [
    { savedItem: { id: "free-save", sectionID: 545 } },
    { annotation: { id: "free-note", sectionID: 545, noteBody: "Retained note" } },
    { project: { id: "free-project", clientID: "free-project", name: "Retained Project" } },
    { project: { id: "free-reference", clientID: "free-reference", name: "Retained collection", folderType: "reference" } },
    { projectSection: { id: "free-link", folderClientID: "free-reference", sectionID: 545, folderType: "reference" } }
  ].map(item => { const [kind, record] = Object.entries(item)[0]; return { [kind]: { ...record, userID, codeVersion, updatedAt: new Date().toISOString() } }; });
  const push = async mutations => {
    const result = await post("/sync/push", { auth: { accountUserID: userID }, batch: { user: { id: userID }, mutations } }, account.backendSessionToken);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const free = await push(records);
  assert.equal(free.acceptedMutationIDs.length, 0);
  for (const item of records) assert(free.rejectedMutationIDs.includes(Object.values(item)[0].id));
  assert.equal((await post("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const pro = await push(records);
  assert.equal(pro.rejectedMutationIDs.length, 0, JSON.stringify(pro));
  assert.equal((await post("/admin/lifetime-grants/revoke", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const edits = records.map(item => { const [kind, record] = Object.entries(item)[0]; return { [kind]: { ...record, updatedAt: new Date(Date.now() + 1000).toISOString() } }; });
  const deniedEdits = await push(edits);
  for (const item of edits) assert(deniedEdits.rejectedMutationIDs.includes(Object.values(item)[0].id));
  const retained = await post("/sync/pull", { auth: { accountUserID: userID } }, account.backendSessionToken);
  assert.equal(retained.status, 200);
  for (const item of records) {
    const [kind, record] = Object.entries(item)[0];
    assert(retained.body.mutations.some(candidate => candidate[kind] && !candidate[kind].deletedAt && (record.name ? candidate[kind].name === record.name : candidate[kind].sectionID === record.sectionID)), `Downgrade lost ${kind}`);
  }
  const deletion = { savedItem: { ...records[0].savedItem, deletedAt: new Date(Date.now()+2000).toISOString(), updatedAt: new Date(Date.now()+2000).toISOString() } };
  assert.equal((await push([deletion])).rejectedMutationIDs.length, 0, "Free retains cleanup rights.");
  assert.equal(retained.body.capabilityContract.capabilities["saved-work"].enabled, false);
  assert.equal(retained.body.capabilityContract.capabilities.notes.enabled, false);
  console.log("Minimal Free HTTP access passed: denied creation/editing, Pro writes, preserved downgrade records, allowed cleanup.");
} finally {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
