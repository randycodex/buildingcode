import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { accountRecordExportFromStore } from "../account-data-export.mjs";
import { accountNotebookUploadPrefixes, binaryAssetPathnames, privateAssetsFromAccountRecords } from "../account-private-assets.mjs";

const A = "web:asset-contract-a", former = "web:confirmed-former-account", projectID = "synthetic-project";
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32);
const prefix = `project-assets/${hash(projectID)}/`;
const image = `${prefix}notebook/${hash("image")}.png`;
const report = `${prefix}reports/${hash("manifest")}/report.pdf`;
const preview = `${prefix}workboard-previews/${hash("preview")}.png`;
const historical = `workboards/${hash(A)}/${hash(projectID)}/image.png`;
const beforeMerge = `workboards/${hash(former)}/${hash(projectID)}/image.png`;
const projectOnly = `${prefix}workboards/legacy.png`;
const legacyNotebook = `${prefix}notebook/${hash("legacy")}.png`;
const other = `project-assets/${hash("other-project")}/notebook/${hash("other-image")}.png`;
const artifact = (type, id, payload) => ({ envelope: { type, id }, payload });
const store = {
  users: { [A]: { appUserID: A } },
  foundationArtifactsByUserID: { [A]: [
    artifact("notebookImageAsset", "image", { projectID, storageKey: image, contentType: "image/png", storageProvider: "local-filesystem" }),
    artifact("workboardPreview", "preview", { projectID, pathname: preview }),
    artifact("reportManifest", "manifest", { project: { id: projectID }, title: other }),
    artifact("generatedReport", "report", { manifestID: "manifest", file: { pathname: report }, title: other }),
    artifact("notebookCard", "card", { title: other, plainText: other, imageAssets: [encodeURIComponent(image)] }),
    artifact("codeQuestion", "question", { projectID })
  ] },
  mutationsByUserID: { [A]: [
    { annotation: { noteBody: other } },
    { project: { clientID: projectID, description: other } },
    { workboard: { projectID, assets: { own: { pathname: historical }, merged: { pathname: beforeMerge } } } }
  ] },
  codeQuestionPendingIssuanceByUserID: { [A]: [{ questionID: "question", manifestID: "pending-manifest" }] },
  migrationCheckpointsByUserID: { [A]: { "confirmed-account-link-recovery-v1": { sourceUserIDs: [former] } } }
};
const snapshot = accountRecordExportFromStore(store, A);
const actual = privateAssetsFromAccountRecords(snapshot);
assert.deepEqual(new Set(actual.map((asset) => asset.pathname)), new Set([image, report, preview, historical, beforeMerge,
  ...["pdf", "html", "json"].map((extension) => `${prefix}reports/${hash("pending-manifest")}/code-memo.${extension}`)]));
assert.equal(actual.find((asset) => asset.pathname === image).storageProvider, "local-filesystem");
assert.equal(binaryAssetPathnames(snapshot.records.foundationArtifacts, snapshot.mutations).includes(other), false);
assert.deepEqual(new Set(accountNotebookUploadPrefixes(snapshot)), new Set([
  `${prefix}notebook/${hash(A)}/`, `${prefix}notebook/${hash(former)}/`
]));

// Registered legacy Project ownership authorizes old Project-only asset keys.
// A bare client-authored Project or card reference cannot supply that authority.
const legacy = structuredClone(snapshot);
legacy.mutations.push({ workboard: { projectID, assets: { image: { pathname: projectOnly } } } });
legacy.records.foundationArtifacts.push(artifact("notebookCard", "legacy-card", { imageAssets: [encodeURIComponent(legacyNotebook)] }));
legacy.records.projectLinks.push({ projectID, targetKind: "notebookCard", targetID: "legacy-card" });
assert.throws(() => privateAssetsFromAccountRecords(legacy), { code: "PRIVATE_ASSET_OWNERSHIP_UNRESOLVED" });
legacy.records.projectOwnerships.push({ projectID, storageOwnerUserID: A });
assert.ok(privateAssetsFromAccountRecords(legacy).some((asset) => asset.pathname === projectOnly));
assert.ok(privateAssetsFromAccountRecords(legacy).some((asset) => asset.pathname === legacyNotebook));
const mismatchedOwner = structuredClone(legacy);
mismatchedOwner.records.projectOwnerships[0].storageOwnerUserID = "web:other-account";
assert.throws(() => privateAssetsFromAccountRecords(mismatchedOwner), { code: "PRIVATE_ASSET_OWNERSHIP_UNRESOLVED" });

for (const pathname of [other, `${prefix}notebook/../outside.png`, ` ${image}`, `${prefix}notebook/${hash("wrong-identity")}.png`]) {
  const invalid = structuredClone(snapshot);
  invalid.records.foundationArtifacts[0].payload.storageKey = pathname;
  assert.throws(() => privateAssetsFromAccountRecords(invalid), { code: "PRIVATE_ASSET_OWNERSHIP_UNRESOLVED" });
}
const scoped = structuredClone(snapshot);
scoped.records.foundationArtifacts[0].payload.storageKey = `${prefix}notebook/${hash(former)}/${hash("image")}.png`;
scoped.records.foundationArtifacts[4].payload.imageAssets = ["image"];
assert.ok(privateAssetsFromAccountRecords(scoped).some((asset) => asset.pathname.includes(`/notebook/${hash(former)}/`)), "Retain metadata authority over an account-scoped upload after a confirmed account merge.");
console.log("Private-file inventory passed: typed binary records, report and pending outputs, historical Workboards, confirmed merges, unproven legacy rejection, and path boundaries.");
