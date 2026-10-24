import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as reportEvidence from "../report-evidence.mjs";

// --baseline FILE measures the identical scenarios against an earlier app.mjs.
// Only synthetic in-memory records are used; there are no network requests.
const baseline = process.argv.includes("--baseline");
const source = await readFile(baseline ? process.argv[process.argv.indexOf("--baseline") + 1]
  : new URL("../app.mjs", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2)
    .replace('await import("./report-evidence.mjs")', "reportEvidence");
}
const owner = "synthetic-owner", other = "foreign-owner", projectID = "synthetic-project";
const artifact = (id, type, payload = {}, extra = {}) => ({
  envelope: { id, type, updatedAt: "2026-10-12T12:00:00Z", ...extra }, payload
});
const artifacts = Array.from({ length: 5000 }, (_, index) => artifact(`unrelated-${index}`, "notebookCard", {
  document: "Synthetic retained body ".repeat(100), imageAssets: []
}));
const references = Array.from({ length: 50 }, (_, index) => ({ referenceKind: "notebookCard", referenceID: `card-${index}`, label: `Note ${index}` }));
artifacts.push(...references.map(reference => artifact(reference.referenceID, "notebookCard")),
  artifact("image", "notebookImageAsset", { projectID: "source-project" }),
  artifact("shared-card", "notebookCard", { imageAssets: ["image"] }),
  artifact("draft", "reportDraft"), artifact("manifest", "reportManifest"),
  artifact("deleted", "notebookCard", {}, { deletedAt: "2026-10-12" }));
const mutations = Array.from({ length: 5000 }, (_, index) => ({ savedItem: { id: `saved-${index}`, updatedAt: "2026-10-12T12:00:00Z" } }));
mutations.push({ project: { id: projectID, name: "Synthetic project", updatedAt: "2026-10-12T12:00:00Z" } });
const links = Array.from({ length: 5000 }, (_, index) => ({
  id: `unrelated-link-${index}`, projectID: "unrelated-project", targetKind: "notebookCard", targetID: `unrelated-${index}`
}));
links.push({ id: "shared", projectID, targetKind: "notebookCard", targetID: "shared-card" },
  { id: "draft-link", projectID, targetKind: "reportDraft", targetID: "draft" });
let counters;
const record = (kind, values) => { counters[kind] ||= { calls: 0, returnedRecords: 0 }; counters[kind].calls++; counters[kind].returnedRecords += values.length; return values; };
const allMutations = async userID => record("mutations", userID === owner ? mutations : []);
const listArtifacts = async (userID, options = {}) => record("artifacts", (userID === owner ? artifacts : [])
  .filter(item => !options.ids || options.ids.includes(item.envelope.id)));
const listLinks = async (userID, options = {}) => record("links", (userID === owner ? links : [])
  .filter(item => (!options.projectID || item.projectID === options.projectID) &&
    (!options.targetKind || item.targetKind === options.targetKind) &&
    (!options.targetIDs || options.targetIDs.includes(item.targetID))));
const migrationCheckpoint = { schemaVersion: 1, migratedProjectSections: 0, migratedWorkboards: 0, migratedResearchAnswers: 0, unmigratedResearchAnswers: 0 };
const sandbox = vm.createContext({
  Map, Set, Object, Array, JSON, Promise, Date, Number, String,
  reportEvidence,
  userContentMutations: allMutations,
  listStoredFoundationArtifacts: listArtifacts, listStoredProjectLinks: listLinks,
  mutationKindAndRecord: mutation => ({ kind: Object.keys(mutation)[0], record: Object.values(mutation)[0] }),
  normalizedMutationRecordID: mutation => Object.values(mutation)[0]?.id,
  listStoredResearchConversations: async userID => record("conversations", userID === owner ? [{ sources: [{ id: "passage" }] }] : []),
  listStoredResearchAnswers: async () => [],
  storedResearchConversation: async () => null,
  researchEvidenceForSectionIDs: async ids => ids[0] === "section" ? [{ id: "section" }] : [],
  storeAdapter: async () => ({
    hasResearchSelection: async (userID, sourceID) =>
      record("selectionExists", userID === owner && sourceID === "passage" ? [true] : []).length > 0,
    listFoundationMigrationMutations: async userID => record("migrationMutations", (userID === owner ? mutations : []).filter(item => item.project || item.projectSection || item.workboard)),
    listOwnedProjectMutations: async userID => record("projects", (userID === owner ? mutations : []).filter(item => item.project))
  }),
  projectFoundationSchemaVersion: 1, storedMigrationCheckpoint: async () => migrationCheckpoint,
  pendingLegacyResearchConversations: async function* () {},
  saveStoredMigrationCheckpoint: () => { throw new Error("Steady-state must not write a checkpoint"); },
  projectIdentityForRecord: record => record.id,
  listStoredActivityEvents: async () => [], projectWorkboardPreviews: async () => [],
  workboardPreviewSummary: () => null, coordinationAssigneesForProject: async () => [],
  projectAccessForUser: async () => ({ project: {} }), projectFactProjection: () => ({}),
  canonicalCodeVersion: value => value, recordSurvivesBulkClear: () => true,
  syncProjectIdentity: value => value, researchConversationSummary: value => value
});
const constantStart = source.indexOf("const projectArtifactTargetTypes =");
if (constantStart >= 0) vm.runInContext(source.slice(constantStart, source.indexOf("\n\n", constantStart)), sandbox);
vm.runInContext([
  "ownedNotebookImageAsset", "notebookArtifactWithIdentity", "notebookImageAccessibleFromProject",
  "linkedProjectArtifact", "reportManifestArtifact", "ownedProjectTargetExists", "validateNotebookReferences",
  "migrateLegacyProjectFoundation", "projectFoundationStateForStorageOwner",
  "latestContentMutationsByID", "currentProjectSectionRecords", "reportSourcesForProject"
].map(actual).join("\n"), sandbox);

const measurements = {};
async function measure(name, run) {
  counters = {};
  await run();
  measurements[name] = structuredClone(counters);
}
await measure("openOneImage", async () => {
  assert.equal((await sandbox.ownedNotebookImageAsset(owner, "image")).envelope.id, "image");
});
await measure("openOneDraft", async () => {
  assert.equal((await sandbox.linkedProjectArtifact(owner, projectID, "reportDraft", "reportDraft", "draft")).envelope.id, "draft");
});
await measure("openOneManifest", async () => {
  assert.equal((await sandbox.reportManifestArtifact(owner, "manifest")).envelope.id, "manifest");
});
await measure("sharedImageAuthorization", async () => {
  assert.equal(await sandbox.notebookImageAccessibleFromProject(owner, projectID, "image"), true);
});
await measure("validate50ArtifactReferences", async () => {
  await sandbox.validateNotebookReferences(owner, references);
});
await measure("validate100SavedReferences", async () => {
  await sandbox.validateNotebookReferences(owner, Array.from({ length: 100 }, (_, index) => ({
    referenceKind: "savedItem", referenceID: `saved-${index}`, label: "Saved"
  })));
});
await measure("projectFoundation", async () => {
  const result = await sandbox.projectFoundationStateForStorageOwner(owner, projectID, { includeAllProjects: false });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].id, projectID);
  assert.equal(result.migrationCheckpoint, migrationCheckpoint);
});
await measure("reportSources", async () => {
  const result = await sandbox.reportSourcesForProject(owner, "empty-project");
  assert.equal(result.sources.length, 0);
  assert.equal(result.warnings.length, 0);
});

// Ownership/type/deletion/link constraints and request boundaries remain intact.
counters = {};
assert.equal(await sandbox.ownedNotebookImageAsset(other, "image"), null);
assert.equal(await sandbox.ownedNotebookImageAsset(owner, "draft"), null);
assert.equal(await sandbox.notebookArtifactWithIdentity(other, "draft"), null);
assert.equal(await sandbox.reportManifestArtifact(other, "manifest"), null);
assert.equal(await sandbox.linkedProjectArtifact(owner, "unlinked-project", "reportDraft", "reportDraft", "draft"), null);
assert.equal(await sandbox.linkedProjectArtifact(other, projectID, "reportDraft", "reportDraft", "draft"), null);
assert.equal(await sandbox.notebookImageAccessibleFromProject(other, projectID, "image"), false);
assert.equal(await sandbox.notebookImageAccessibleFromProject(owner, "unlinked-project", "image"), false);
await assert.rejects(sandbox.validateNotebookReferences(other, references), /unavailable/);
await assert.rejects(sandbox.validateNotebookReferences(owner, [{ referenceKind: "notebookCard", referenceID: "deleted", label: "deleted" }]), /unavailable/);
await assert.rejects(sandbox.validateNotebookReferences(owner, [{ referenceKind: "notebookCard", referenceID: "draft", label: "wrong type" }]), /unavailable/);
await assert.rejects(sandbox.validateNotebookReferences(owner, Array(101).fill(references[0])), /100/);
await sandbox.validateNotebookReferences(owner, [{ referenceKind: "selectedPassage", referenceID: "embedded", label: "Embedded" }], [{ id: "embedded" }]);
await sandbox.validateNotebookReferences(owner, [{ referenceKind: "canonicalSection", referenceID: "section", label: "Enacted" }]);
const fresh = { referenceKind: "notebookCard", referenceID: "card-0", label: "Fresh" };
await sandbox.validateNotebookReferences(owner, [fresh]);
const changed = artifacts.find(item => item.envelope.id === "card-0");
changed.envelope.deletedAt = "2026-10-12";
await assert.rejects(sandbox.validateNotebookReferences(owner, [fresh]), /unavailable/,
  "One request's successful validation must not survive into a later request");
delete changed.envelope.deletedAt;
const sharedValidationReads = new Map();
sharedValidationReads.artifactIDs = [fresh.referenceID];
assert.equal(await sandbox.ownedProjectTargetExists(owner, fresh.referenceKind, fresh.referenceID, sharedValidationReads), true);
assert.equal(await sandbox.ownedProjectTargetExists(other, fresh.referenceKind, fresh.referenceID, sharedValidationReads), false,
  "Even a reused validation scope must not share artifact reads across owners");
assert.equal(await sandbox.ownedProjectTargetExists(owner, "selectedPassage", "passage", sharedValidationReads), true);
assert.equal(await sandbox.ownedProjectTargetExists(other, "selectedPassage", "passage", sharedValidationReads), false,
  "Conversation reference reads must remain owner scoped");
const normalArtifactRead = sandbox.listStoredFoundationArtifacts;
sandbox.listStoredFoundationArtifacts = async () => { throw new Error("Transient artifact read failure"); };
await assert.rejects(sandbox.validateNotebookReferences(owner, [fresh]), /Transient artifact read failure/);
sandbox.listStoredFoundationArtifacts = normalArtifactRead;
await sandbox.validateNotebookReferences(owner, [fresh]);
const sharedLink = links.find(item => item.id === "shared");
sharedLink.deletedAt = "2026-10-12";
assert.equal(await sandbox.notebookImageAccessibleFromProject(owner, projectID, "image"), false);
delete sharedLink.deletedAt;
if (!baseline) {
  for (const name of ["openOneImage", "openOneDraft", "openOneManifest"]) assert.equal(measurements[name].artifacts.returnedRecords, 1);
  assert.equal(measurements.openOneDraft.links.returnedRecords, 1);
  assert.equal(measurements.sharedImageAuthorization.artifacts.returnedRecords, 2);
  assert.equal(measurements.validate50ArtifactReferences.artifacts.calls, 1);
  assert.equal(measurements.validate50ArtifactReferences.artifacts.returnedRecords, 50);
  assert.equal(measurements.validate50ArtifactReferences.mutations, undefined);
  assert.equal(measurements.validate100SavedReferences.mutations.calls, 1);
  assert.equal(measurements.projectFoundation.mutations, undefined);
  assert.equal(measurements.projectFoundation.migrationMutations.returnedRecords, 1);
  assert.equal(measurements.projectFoundation.projects.returnedRecords, 1);
  assert.equal(measurements.reportSources.mutations.calls, 1);
}
console.log(JSON.stringify({ baseline, fixture: { artifacts: artifacts.length, mutations: mutations.length, links: links.length }, measurements }, null, 2));
console.log("Authenticated read scaling passed: exact target reads, batched reference validation, owner/type/deletion/link isolation, and no cross-request cache.");
