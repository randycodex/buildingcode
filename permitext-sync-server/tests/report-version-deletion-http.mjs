import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultSyncCodeVersion } from "../public/sync-identity.js";
import { organizationRecord, organizationMembershipRecord, projectMembershipRecord, projectOwnershipRecord } from "../organization-contract.mjs";
import { organizationOwnerScope, artifactEnvelope, projectLinkRecord } from "../project-foundation-contract.mjs";

const directory = await mkdtemp(join(tmpdir(), "permitext-version-deletion-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-version-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const originalFetch = globalThis.fetch;
let base, server;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, "Deletion tests use only their isolated local server.");
  return originalFetch(input, options);
};
try {
  const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const owner = { userID: "apple:synthetic-version-owner" }, projectID = "synthetic-version-project";
  async function post(path, body, expected = 200, account = owner) {
    const response = await fetch(`${base}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(account.token ? { authorization: `Bearer ${account.token}` } : {}) },
      body: JSON.stringify({ auth: { accountUserID: account.userID }, ...body }) });
    const json = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }
  async function login(account, providerUserID) {
    account.token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID,
      email: `${providerUserID}@example.test`, displayName: "Synthetic test account" } }, 200, account)).account.backendSessionToken;
    return account;
  }
  const admin = { userID: owner.userID, token: process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN };
  await post("/admin/lifetime-grants/grant", { userID: owner.userID }, 200, admin);
  await login(owner, "synthetic-version-owner");
  const outsider = await login({ userID: "apple:synthetic-version-outsider" }, "synthetic-version-outsider");
  const updatedAt = new Date().toISOString();
  await post("/sync/push", { batch: { user: { id: owner.userID }, mutations:
    [projectID, "synthetic-other-project"].map((id, index) => ({ project: { id: `record-${index}`, userID: owner.userID,
      clientID: id, name: "Version deletion fixture", codeVersion: defaultSyncCodeVersion,
      colorHex: "#334455", sortOrder: index, updatedAt } })) } });
  const { draft } = await post("/reports/drafts/save", { projectID, expectedVersion: 0, title: "Frozen version test",
    reportDate: "2026-10-12", introduction: "Keep this editable draft.",
    blocks: [{ id: "p", kind: "paragraph", text: "Saved content remains unchanged." }] }, 201);
  const generate = () => post("/reports/generate", { projectID, draftID: draft.id, expectedVersion: draft.version }, 201);
  const history = () => post("/reports/history/list", { projectID });
  const first = await generate(), second = await generate();
  const adapter = createFileStoreAdapter();
  const webFile = (await adapter.listFoundationArtifacts(owner.userID)).find(a => a.payload.manifestID === second.manifest.id);
  const iosFile = { ...webFile, envelope: artifactEnvelope({ ...webFile.envelope, id: "synthetic-ios-file" }),
    payload: { ...webFile.payload, file: { ...webFile.payload.file, format: "ios-pdf" } } };
  await adapter.saveFoundationArtifact(owner.userID, iosFile);
  const webLink = (await adapter.listProjectLinks(owner.userID)).find(link => link.targetID === webFile.envelope.id);
  await adapter.saveProjectLink(owner.userID, projectLinkRecord({ ...webLink, id: "synthetic-ios-link", targetID: iosFile.envelope.id }));
  assert.equal((await history()).reports.find(report => report.id === second.manifest.id).files.length, 2);
  const beforeArtifacts = await adapter.listFoundationArtifacts(owner.userID);
  const originalDraft = beforeArtifacts.find(a => a.envelope.id === draft.id);
  const remove = (manifestID, expected = 200, account = owner, selectedProject = projectID) =>
    post("/reports/history/delete", { projectID: selectedProject, manifestID }, expected, account);
  await remove(second.manifest.id, 401, { ...owner, token: "invalid-session" });
  await remove(second.manifest.id, 404, outsider);
  await remove(second.manifest.id, 404, owner, "synthetic-other-project");
  await post("/reports/history/delete", { projectID }, 400);
  assert.equal((await history()).reports.length, 2);
  const deleted = await remove(second.manifest.id);
  assert(deleted.deletedAt);
  assert.equal((await remove(second.manifest.id)).deletedAt, deleted.deletedAt, "Lost deletion responses can be retried.");
  assert.deepEqual((await history()).reports.map(report => report.reportVersion), [1]);
  await post("/reports/manifests/get", { projectID, manifestID: second.manifest.id }, 404);
  await post("/reports/files/read", { projectID, generatedReportID: second.generatedReport.file.generatedReportID }, 404);
  await post("/reports/files/read", { projectID, generatedReportID: iosFile.envelope.id }, 404);
  assert.deepEqual((await post("/reports/manifests/get", { projectID, manifestID: first.manifest.id })).manifest, first.manifest);
  const download = await fetch(`${base}/reports/files/read`, { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ auth: { accountUserID: owner.userID }, projectID, generatedReportID: first.generatedReport.file.generatedReportID }) });
  assert.equal(download.status, 200);
  assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  let artifacts = await adapter.listFoundationArtifacts(owner.userID);
  assert.deepEqual(artifacts.find(a => a.envelope.id === draft.id), originalDraft);
  for (const artifact of artifacts.filter(a => a.envelope.id === second.manifest.id || a.payload.manifestID === second.manifest.id)) {
    assert.equal(artifact.envelope.deletedAt, deleted.deletedAt);
    assert.deepEqual(artifact.payload, beforeArtifacts.find(a => a.envelope.id === artifact.envelope.id).payload, "Deletion preserves immutable payloads.");
  }
  assert((await adapter.listProjectLinks(owner.userID)).filter(link => link.targetID === second.manifest.id ||
    [second.generatedReport.file.generatedReportID, iosFile.envelope.id].includes(link.targetID)).every(link => link.deletedAt));
  const third = await generate();
  assert.equal(third.manifest.reportVersion, 3, "Deleting the latest version never reuses its number.");
  await Promise.all([remove(third.manifest.id), remove(third.manifest.id)]);
  await remove(first.manifest.id);
  assert.deepEqual((await history()).reports, []);
  const fourth = await generate();
  assert.equal(fourth.manifest.reportVersion, 4, "Deleting all versions retains the numbering high-water mark.");

  // Reproduce a late upload/partial descriptor cleanup: the tombstoned manifest
  // must still prevent reads even when an active file descriptor exists.
  const staleFile = beforeArtifacts.find(a => a.envelope.id === second.generatedReport.file.generatedReportID);
  await adapter.saveFoundationArtifact(owner.userID, staleFile);
  const staleLink = (await adapter.listProjectLinks(owner.userID)).find(link => link.targetID === staleFile.envelope.id);
  await adapter.saveProjectLink(owner.userID, { ...staleLink, deletedAt: null });
  await post("/reports/files/read", { projectID, generatedReportID: staleFile.envelope.id }, 404);
  await remove(second.manifest.id);
  assert((await adapter.listFoundationArtifacts(owner.userID)).find(a => a.envelope.id === staleFile.envelope.id).envelope.deletedAt);

  await post("/admin/lifetime-grants/revoke", { userID: owner.userID }, 200, admin);
  await remove(fourth.manifest.id);
  assert.deepEqual((await history()).reports, [], "Downgraded owners can manage their existing exports.");

  const protectedID = "synthetic-issued-manifest";
  const protectedArtifact = { ...beforeArtifacts.find(a => a.envelope.id === first.manifest.id),
    envelope: artifactEnvelope({ ...beforeArtifacts.find(a => a.envelope.id === first.manifest.id).envelope, id: protectedID }),
    payload: { ...first.manifest, id: protectedID, reportVersion: 5, questionSnapshot: { id: "synthetic-question" } } };
  await adapter.saveFoundationArtifact(owner.userID, protectedArtifact);
  const originalLink = (await adapter.listProjectLinks(owner.userID)).find(link => link.targetID === first.manifest.id);
  await adapter.saveProjectLink(owner.userID, projectLinkRecord({ ...originalLink, id: "synthetic-issued-link", targetID: protectedID, deletedAt: null }));
  assert.equal((await history()).reports[0].deletable, false);
  assert.equal((await remove(protectedID, 409)).code, "REPORT_ISSUED_RECORD_DELETE_UNAVAILABLE");
  assert.deepEqual((await adapter.listFoundationArtifacts(owner.userID)).find(a => a.envelope.id === protectedID), protectedArtifact);

  // Shared access must enforce project.edit, even when a viewer can download.
  const organizationID = "synthetic-version-organization";
  await adapter.saveOrganization(organizationRecord({ id: organizationID, name: "Synthetic team", ownerUserID: owner.userID }));
  for (const [account, role] of [[owner, "owner"], [outsider, "viewer"]]) {
    await adapter.saveOrganizationMembership(organizationMembershipRecord({ organizationID, userID: account.userID, role }));
    await adapter.saveProjectMembership(projectMembershipRecord({ organizationID, projectID, userID: account.userID, role }));
  }
  await adapter.saveProjectOwnership(projectOwnershipRecord({ projectID, owner: organizationOwnerScope(organizationID),
    storageOwnerUserID: owner.userID, originalOwnerUserID: owner.userID }));
  assert.equal((await post("/reports/history/list", { projectID }, 200, outsider)).reports.length, 1);
  await remove(protectedID, 403, outsider);
  console.log("Report version deletion HTTP passed: auth/project/role fences, idempotent cleanup, frozen payloads, draft preservation, revoked PDF access, numbering, downgrade and issued-record protection.");
} finally {
  globalThis.fetch = originalFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
