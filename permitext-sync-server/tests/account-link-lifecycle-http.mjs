import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-file-link-lifecycle-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-link-lifecycle-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "STRIPE_SECRET_KEY"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const adapter = createFileStoreAdapter();
const lifecycle = await adapter.accountLifecycle();
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, "File account-link acceptance forbids external requests.");
  return originalFetch(url, options);
};
const post = async (path, body, token = "") => {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
};
try {
  const accounts = [];
  for (const [provider, providerUserID] of [["web", "file-link-lifecycle-source"], ["apple", "file-link-lifecycle-target"]]) {
    const result = await post("/account/sign-in", { credential: { provider, providerUserID } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    accounts.push(result.body.account);
  }
  const [A, B] = accounts;
  assert.equal((await post("/admin/lifetime-grants/grant", { userID: A.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const link = (extra = {}) => post("/account/link-browser", { auth: { accountUserID: B.appUserID },
    browserCredentialID: A.appUserID.slice(4), ...extra }, B.backendSessionToken);
  for (const owner of accounts) {
    await lifecycle.begin(owner.appUserID, "synthetic-external-writer");
    const before = await adapter.read();
    const blocked = await link({ operationIDsByUserID: { [owner.appUserID]: "synthetic-external-writer" } });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.equal(blocked.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
    assert.deepEqual(await adapter.read(), before);
    await lifecycle.finish(owner.appUserID, "synthetic-external-writer");
    await lifecycle.claimDeletion(owner.appUserID, "synthetic-delete");
    const beforeDeletion = await adapter.read();
    const deleting = await link();
    assert.equal(deleting.status, 409);
    assert.equal(deleting.body.code, "ACCOUNT_LINK_OPERATION_IN_PROGRESS");
    assert.deepEqual(await adapter.read(), beforeDeletion);
    await lifecycle.releaseDeletion(owner.appUserID, "synthetic-delete");
  }
  const completed = await link();
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.mergedAccount.sourceUserID, A.appUserID);
  const after = await adapter.read();
  assert.equal(after.users[A.appUserID], undefined);
  assert.ok(after.users[B.appUserID]);
  console.log("File account-link lifecycle HTTP passed: both owners, retained deletion claims, forged guard exclusion rejected, unchanged blocked inventories, and normal retry.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
