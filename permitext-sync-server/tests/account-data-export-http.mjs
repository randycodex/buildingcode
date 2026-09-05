import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-account-export-"));
const dataPath = join(temporary, "sync.json");
const assetRoot = join(temporary, "assets");
const A = "web:account-export-a", B = "web:account-export-b";
const adminToken = "synthetic-export-admin";
const now = new Date().toISOString();
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32);
const assetPath = `project-assets/${hash("project-a")}/notebook/${hash("image-a")}.png`;
const userCollections = ["foundationArtifacts", "projectLinks", "researchAnswers", "activityEvents",
  "researchConversations", "researchUsage", "researchOperations", "researchCredits", "researchFeedback",
  "codeQuestionPendingIssuance", "codeQuestionOutbox"];
const store = {
  users: {
    [A]: { appUserID: A, authProvider: "web", displayName: "Synthetic A", backendSessionToken: "must-not-export-session-a", policyAcceptances: [{ policySetID: "synthetic-policy-set" }] },
    [B]: { appUserID: B, authProvider: "web", displayName: "DO-NOT-EXPORT-OTHER-ACCOUNT" }
  },
  sessions: { [A]: "must-not-export-session-a", [B]: "must-not-export-session-b" },
  entitlements: {},
  passkeyCredentials: { "synthetic-credential-a": A, "synthetic-credential-b": B },
  mutationsByUserID: {
    [A]: [{ savedItem: { id: "saved-a", userID: A } }, { annotation: { id: "note-a", userID: A, noteBody: "Synthetic note" } }],
    [B]: [{ annotation: { id: "note-b", userID: B, noteBody: "DO-NOT-EXPORT-OTHER-ACCOUNT" } }]
  },
  migrationCheckpointsByUserID: { [A]: { checkpoint: { schema: "synthetic" } } },
  artifactRevisionsByUserID: { [A]: { account: { revision: 4 } } },
  codeQuestionCountersByUserID: { [A]: { counter: 2 }, [B]: { counter: 1 } },
  organizations: { "org-a": { id: "org-a", ownerUserID: A }, "org-b": { id: "org-b", ownerUserID: B } },
  organizationMembershipsByOrganizationID: { "org-a": [{ userID: A }], "org-b": [{ userID: B }] },
  projectMembershipsByProjectID: { "project-a": [{ userID: A }], "project-b": [{ userID: B }] },
  projectOwnerships: { "project-a": { projectID: "project-a", storageOwnerUserID: A, owner: { kind: "user", id: A } } },
  organizationInvitationsByID: {
    "invite-a": { invitedUserID: A, token: "must-not-export-invite", tokenHash: "must-not-export-invite-hash" },
    "invite-b": { invitedUserID: B, label: "DO-NOT-EXPORT-OTHER-ACCOUNT" }
  },
  researchPurchaseClaimsByID: { "claim-a": { id: "claim-a", creditedUserID: A }, "claim-b": { id: "claim-b", creditedUserID: B } }
};
for (const name of userCollections) store[`${name}ByUserID`] = {
  [A]: [{ id: `${name}-a`, envelope: { id: `${name}-a`, type: "notebookCard" }, payload: { title: "Synthetic Notebook", pathname: assetPath } }],
  [B]: [{ id: `${name}-b`, title: "DO-NOT-EXPORT-OTHER-ACCOUNT" }]
};
store.foundationArtifactsByUserID[A].push({ envelope: { id: "image-a", type: "notebookImageAsset" },
  payload: { projectID: "project-a", storageKey: assetPath, storageProvider: "local-filesystem", contentType: "image/png" } });
await mkdir(dirname(join(assetRoot, assetPath)), { recursive: true });
await writeFile(join(assetRoot, assetPath), "synthetic private asset");
await writeFile(dataPath, JSON.stringify(store));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: dataPath, PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: assetRoot, PERMITEXT_RESEARCH_KILL_SWITCH: "1" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "STRIPE_SECRET_KEY"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, "This exercise forbids external requests.");
  return originalFetch(url, options);
};
async function post(path, body, token = adminToken) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", authorization: `Bearer ${token}`
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
try {
  const beforeBytes = await readFile(dataPath, "utf8");
  for (const path of ["/admin/accounts/export", "/admin/accounts/restore-checklist"]) {
    assert.equal((await post(path, { userID: A }, "")).status, 401);
    assert.equal((await post(path, { userID: A }, store.sessions[A])).status, 401);
    assert.equal((await post(path, { userID: {} })).status, 400);
  }
  const exported = await post("/admin/accounts/export", { userID: A });
  assert.equal(exported.status, 200);
  assert.equal(exported.body.schema, "permitext-account-record-export-v2");
  assert.equal(exported.body.account.policyAcceptances[0].policySetID, "synthetic-policy-set");
  assert.equal(exported.body.hasSession, true);
  assert.deepEqual(exported.body.passkeyCredentialIDs, ["synthetic-credential-a"]);
  assert.equal(exported.body.mutations.length, 2);
  for (const name of userCollections) assert.equal(exported.body.records[name].length, name === "foundationArtifacts" ? 2 : 1, name);
  for (const name of ["migrationCheckpoints", "artifactRevisions", "codeQuestionCounters", "organizations", "organizationMemberships", "projectMemberships", "projectOwnerships", "organizationInvitations", "researchPurchaseClaims"]) assert.equal(exported.body.records[name].length, 1, name);
  const serialized = JSON.stringify(exported.body);
  assert.equal(serialized.includes("DO-NOT-EXPORT-OTHER-ACCOUNT"), false);
  assert.equal(serialized.includes(B), false);
  assert.equal(serialized.includes("must-not-export"), false);
  assert.equal(exported.body.scope.privateAssetBytesIncluded, false);
  const checklist = await post("/admin/accounts/restore-checklist", { userID: A });
  assert.equal(checklist.body.researchConversationCount, 1);
  assert.equal(checklist.body.researchAnswerCount, 1);
  assert.deepEqual(checklist.body.artifactCounts, { notebookCard: 1, notebookImageAsset: 1 });
  assert.equal(checklist.body.recordCounts.codeQuestionOutbox, 1);
  assert.equal(checklist.body.recordCounts.organizations, 1);
  assert.equal(await readFile(dataPath, "utf8"), beforeBytes, "Export/checklist must not mutate storage.");

  const fileAdapter = createFileStoreAdapter();
  const staleBeforeGuard = await fileAdapter.read();
  const lifecycle = await fileAdapter.accountLifecycle();
  await lifecycle.begin(A, "synthetic-late-file-write", { sessionToken: store.sessions[A] });
  await fileAdapter.write(staleBeforeGuard);
  const whileBusy = await fileAdapter.exportAccountRecords(A);
  assert.equal(whileBusy.records.accountLifecycle.length, 1, "A stale file write cannot discard an active guard.");
  const staleDuringGuard = await fileAdapter.read();
  await lifecycle.finish(A, "synthetic-late-file-write");
  await fileAdapter.write(staleDuringGuard);
  assert.deepEqual((await fileAdapter.exportAccountRecords(A)).records.accountLifecycle, [], "A stale file write cannot resurrect a finished guard.");
  const deleted = await post("/account/delete", { auth: { accountUserID: A }, confirmation: "DELETE" }, store.sessions[A]);
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.equal(deleted.body.deleted, true);
  const after = (await post("/admin/accounts/export", { userID: A })).body;
  assert.equal(after.account, null);
  assert.equal(after.entitlement, null);
  assert.equal(after.hasSession, false);
  assert.deepEqual(after.passkeyCredentialIDs, []);
  assert.deepEqual(after.mutations, []);
  for (const [name, records] of Object.entries(after.records)) assert.deepEqual(records, [], `Deleted account retains ${name}`);
  await assert.rejects(readFile(join(assetRoot, assetPath)), { code: "ENOENT" });
  const persisted = JSON.parse(await readFile(dataPath, "utf8"));
  assert.deepEqual(persisted.users[B], store.users[B]);
  assert.deepEqual(persisted.mutationsByUserID[B], store.mutationsByUserID[B]);
  assert.equal(persisted.researchPurchaseClaimsByID["claim-a"].creditedUserID, null);
  assert.ok(persisted.researchPurchaseClaimsByID["claim-a"].deletedAt, "Purchase replay protection retains its minimal tombstone.");
  console.log("Account record export HTTP passed: complete record families, operator authorization, isolation, no credential export, and post-deletion inventory.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
