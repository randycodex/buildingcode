/**
 * Phase 1 Code Question contracts: storage semantics, transitions, adapters,
 * permissions, migration idempotence, and preserve-and-ignore fixtures.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  activityActions,
  artifactTypes,
  capabilityContract,
  capabilityIDs,
  conflictPolicies,
  projectMembershipRules,
  projectTargetKinds
} from "../project-foundation-contract.mjs";
import {
  organizationPermissions,
  roleAllows
} from "../organization-contract.mjs";
import {
  legacyKindToRequestType,
  normalizeReviewThreadPayload,
  projectReviewRequestTypes,
  projectReviewTargetKinds,
  reviewRequestTypeToKind,
  reviewThreadForClient
} from "../collaboration-contract.mjs";
import {
  adaptReportDraftV1ToV2View,
  codeDecisionMemoRecordType,
  immutableReportManifest,
  immutableReportManifestV3,
  normalizeReportDraftPayload,
  normalizeReportDraftPayloadV2,
  reportDraftSchemaVersion,
  reportDraftSchemaVersionV2,
  reportDraftV1CompatibleView,
  reportManifestForClient,
  reportManifestSchemaVersion,
  reportManifestSchemaVersionV3
} from "../report-contract.mjs";
import {
  assertValidTransition,
  codeQuestionArtifactKinds,
  codeQuestionFeatureFlag,
  codeQuestionTransitions,
  isCodeQuestionWorkspaceEnabled,
  isValidTransition
} from "../code-question-contract.mjs";
import {
  allocateQuestionNumber,
  allocateScopedVersion,
  archiveCodeQuestionArtifact,
  assertCodeQuestionPermission,
  assertCodeQuestionWorkspaceEnabled,
  CodeQuestionCommandError,
  codeQuestionWorkspaceFeatureEnabled,
  compareAndSwapFoundationArtifact,
  createCodeQuestionArtifact,
  createConclusionArtifact,
  createEvidenceSetArtifact,
  createEvidenceSnapshotArtifact,
  createIssuedRecordArtifact,
  createPendingIssuanceRecord,
  createQuestionInputArtifact,
  createQuestionOutboxEntry,
  advanceIssuanceSaga,
  permissionForCommand,
  restoreCodeQuestionArtifact,
  runCodeQuestionBootstrapMigration
} from "../code-question-commands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const createdAt = "2026-08-03T18:00:00.000Z";

// --- Foundation registry extensions ---
for (const kind of codeQuestionArtifactKinds) {
  assert.ok(artifactTypes.includes(kind), `artifactTypes missing ${kind}`);
  assert.ok(projectTargetKinds.includes(kind), `projectTargetKinds missing ${kind}`);
  assert.ok(projectMembershipRules[kind], `membership rule missing ${kind}`);
  assert.ok(conflictPolicies[kind], `conflict policy missing ${kind}`);
}
assert.equal(conflictPolicies.evidenceSnapshotV2, "immutable");
assert.equal(conflictPolicies.questionEvidenceSet, "immutable");
assert.equal(conflictPolicies.issuedDecisionRecord, "immutable");
assert.equal(conflictPolicies.codeQuestion, "explicit-revision");
assert.ok(activityActions.includes("code-question.created"));
assert.ok(activityActions.includes("code-question.record.issued"));

// --- Feature flag remains default-disabled ---
assert.equal(codeQuestionWorkspaceFeatureEnabled({}), false);
assert.equal(codeQuestionWorkspaceFeatureEnabled({ PERMITEXT_CODE_QUESTION_WORKSPACE: "0" }), false);
assert.equal(codeQuestionWorkspaceFeatureEnabled({ PERMITEXT_CODE_QUESTION_WORKSPACE: "1" }), true);
assert.equal(isCodeQuestionWorkspaceEnabled({}), false);
assert.throws(
  () => assertCodeQuestionWorkspaceEnabled({ environment: {} }),
  (error) => error instanceof CodeQuestionCommandError && error.code === "CODE_QUESTION_WORKSPACE_DISABLED"
);
assert.equal(
  capabilityContract({ plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" })
    .capabilities[capabilityIDs.codeQuestionWorkspace].enabled,
  false
);
assert.equal(codeQuestionFeatureFlag.defaultEnabled, false);

// --- Permissions map onto existing roles ---
assert.equal(roleAllows("owner", organizationPermissions.codeQuestionIssue), true);
assert.equal(roleAllows("owner", organizationPermissions.codeQuestionSupersede), true);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionEdit), true);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionEvidencePropose), true);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionEvidenceApprove), false);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionIssue), false);
assert.equal(roleAllows("reviewer", organizationPermissions.codeQuestionEvidenceApprove), true);
assert.equal(roleAllows("reviewer", organizationPermissions.codeQuestionConclusionApprove), true);
assert.equal(roleAllows("reviewer", organizationPermissions.codeQuestionEdit), false);
assert.equal(roleAllows("viewer", organizationPermissions.codeQuestionEdit), false);
assert.throws(
  () => assertCodeQuestionPermission("editor", organizationPermissions.codeQuestionIssue),
  /Permission denied/
);
assert.equal(
  permissionForCommand("codeQuestion.issue.start"),
  organizationPermissions.codeQuestionIssue
);

// --- Every transition table row is valid; invalid transitions reject ---
for (const row of codeQuestionTransitions) {
  assert.ok(
    isValidTransition(row.record, row.from, row.to),
    `Expected valid transition ${row.record} ${row.from}→${row.to}`
  );
  assert.deepEqual(assertValidTransition(row.record, row.from, row.to), row);
}
assert.equal(isValidTransition("codeMemo", "draft", "issued"), false);
assert.equal(isValidTransition("codeQuestion", "active", "issued"), false);
assert.throws(() => assertValidTransition("issuedRecord", "superseded", "issued"));

// --- Counters / uniqueness scopes ---
let counters = {};
let alloc = allocateQuestionNumber(counters, "project-a");
assert.equal(alloc.questionNumber, 1);
counters = alloc.counters;
alloc = allocateQuestionNumber(counters, "project-a");
assert.equal(alloc.questionNumber, 2);
alloc = allocateQuestionNumber(alloc.counters, "project-b");
assert.equal(alloc.questionNumber, 1, "Question numbers are Project-scoped");
let scopes = {};
let ver = allocateScopedVersion(scopes, "question-1");
assert.equal(ver.version, 1);
ver = allocateScopedVersion(ver.scopes, "question-1");
assert.equal(ver.version, 2);
ver = allocateScopedVersion(ver.scopes, "question-2");
assert.equal(ver.version, 1);

// --- Atomic expectedVersion CAS ---
const question = createCodeQuestionArtifact({
  userID: "user-1",
  projectID: "project-1",
  title: "Egress width",
  questionText: "What clear width applies?",
  questionNumber: 1,
  createdAt
});
assert.equal(question.payload.displayID, "Q-001");
const accepted = compareAndSwapFoundationArtifact(null, question, 0);
assert.equal(accepted.envelope.version, 1);
assert.throws(
  () => compareAndSwapFoundationArtifact(question, {
    ...question,
    envelope: { ...question.envelope, version: 2 },
    payload: { ...question.payload, title: "Changed" }
  }, 0),
  (error) => error.code === "CODE_QUESTION_VERSION_CONFLICT"
);
const bumped = {
  ...question,
  envelope: { ...question.envelope, version: 2 },
  payload: { ...question.payload, title: "Egress width revised", expectedVersion: 2 }
};
assert.equal(
  compareAndSwapFoundationArtifact(question, bumped, 1).payload.title,
  "Egress width revised"
);

// Immutable evidence set cannot change in place
const snapshot = createEvidenceSnapshotArtifact({
  userID: "user-1",
  sourceIdentity: "synthetic:fixture",
  passageLocator: "SYN §1",
  quotedText: "[SYNTHETIC] passage",
  createdAt
});
const evidenceSet = createEvidenceSetArtifact({
  userID: "user-1",
  questionID: question.envelope.id,
  version: 1,
  entries: [{
    snapshotID: snapshot.envelope.id,
    role: "governing",
    analysisEligible: true,
    approvalActor: "reviewer-1",
    approvalAt: createdAt,
    sourceVerificationState: "synthetic-fixture"
  }],
  createdAt
});
assert.throws(
  () => compareAndSwapFoundationArtifact(evidenceSet, {
    ...evidenceSet,
    payload: { ...evidenceSet.payload, version: 99 }
  }, 1),
  (error) => error.code === "CODE_QUESTION_IMMUTABLE"
);
// Idempotent identical retry is allowed
assert.equal(
  compareAndSwapFoundationArtifact(evidenceSet, evidenceSet, 1),
  evidenceSet
);

// Archive / restore transitions
const archived = archiveCodeQuestionArtifact(question, {
  userID: "user-1",
  expectedVersion: 1,
  updatedAt: "2026-08-03T19:00:00.000Z"
});
assert.equal(archived.payload.recordState, "archived");
assert.equal(archived.envelope.version, 2);
const restored = restoreCodeQuestionArtifact(archived, {
  userID: "user-1",
  expectedVersion: 2,
  updatedAt: "2026-08-03T20:00:00.000Z"
});
assert.equal(restored.payload.recordState, "active");
assert.equal(restored.envelope.version, 3);

// Inputs / conclusion / issued record construction
const input = createQuestionInputArtifact({
  userID: "user-1",
  questionID: question.envelope.id,
  kind: "confirmedFact",
  statement: "Occupancy B",
  state: "confirmed",
  createdAt
});
assert.equal(input.envelope.type, "questionInput");
const conclusion = createConclusionArtifact({
  userID: "user-1",
  questionID: question.envelope.id,
  revision: 1,
  definitionRevision: 1,
  definitionHash: "def",
  inputSetHash: "in",
  evidenceSetID: evidenceSet.envelope.id,
  evidenceSetVersion: 1,
  evidenceSetHash: evidenceSet.payload.contentHash,
  conclusionText: "Use 44 inches for this synthetic fixture.",
  citations: [snapshot.envelope.id],
  createdAt
});
assert.equal(conclusion.envelope.type, "professionalConclusion");
const issued = createIssuedRecordArtifact({
  userID: "owner-1",
  questionID: question.envelope.id,
  issueVersion: 1,
  reportManifestID: "manifest-1",
  issuedAt: createdAt
});
assert.equal(issued.payload.status, "issued");

// --- Issuance saga ---
let pending = createPendingIssuanceRecord({
  questionID: question.envelope.id,
  issueVersion: 1,
  idempotencyKey: "idem-1",
  actorUserID: "owner-1",
  stagedObjectKey: "staged/q/1/idem-1"
});
assert.equal(pending.status, "reserved");
pending = advanceIssuanceSaga(pending, "staged");
pending = advanceIssuanceSaga(pending, "committing");
pending = advanceIssuanceSaga(pending, "issued");
assert.equal(pending.status, "issued");
assert.throws(() => advanceIssuanceSaga(pending, "reserved"));
let failed = createPendingIssuanceRecord({
  questionID: question.envelope.id,
  issueVersion: 2,
  idempotencyKey: "idem-2",
  actorUserID: "owner-1"
});
failed = advanceIssuanceSaga(failed, "failed", { error: "upload failed" });
assert.equal(failed.status, "failed");
failed = advanceIssuanceSaga(failed, "reserved"); // retry path
assert.equal(failed.status, "reserved");

// --- Outbox transport scaffolding ---
const outbox = createQuestionOutboxEntry({
  commandKind: "codeQuestion.create",
  payload: { projectID: "project-1" },
  idempotencyKey: "outbox-1"
});
assert.equal(outbox.status, "queued");
assert.throws(() => createQuestionOutboxEntry({ commandKind: "not.a.command", payload: {} }));

// --- Migration idempotence (no user-content promotion) ---
const firstMigration = runCodeQuestionBootstrapMigration({ now: createdAt });
assert.equal(firstMigration.status, "completed");
assert.equal(firstMigration.migratedCount, 0);
assert.match(firstMigration.note, /no legacy/i);
const secondMigration = runCodeQuestionBootstrapMigration({
  previousCheckpoint: firstMigration,
  now: "2026-08-03T21:00:00.000Z"
});
assert.equal(secondMigration.status, "completed");
assert.equal(secondMigration.alreadyCurrentCount, 1);
assert.equal(secondMigration.migratedCount, 0);

// --- Collaboration requestType adapters ---
assert.deepEqual([...projectReviewRequestTypes], [
  "fact-request", "evidence-review", "interpretation-review", "revision-request"
]);
assert.ok(projectReviewTargetKinds.includes("codeQuestion"));
assert.ok(projectReviewTargetKinds.includes("professionalConclusion"));
assert.equal(reviewRequestTypeToKind("fact-request"), "missing-project-fact");
assert.equal(legacyKindToRequestType("missing-project-fact"), "fact-request");
const thread = normalizeReviewThreadPayload({
  projectID: "project-1",
  requestType: "interpretation-review",
  targetKind: "professionalConclusion",
  targetID: conclusion.envelope.id,
  questionID: question.envelope.id,
  title: "Interpret corridor width",
  body: "Please confirm exception applicability.",
  createdByUserID: "reviewer-1"
});
assert.equal(thread.kind, "general-review");
assert.equal(thread.requestType, "interpretation-review");
assert.equal(thread.questionID, question.envelope.id);
// Legacy thread without requestType still normalizes
const legacyThread = normalizeReviewThreadPayload({
  projectID: "project-1",
  kind: "missing-project-fact",
  title: "Need fact",
  body: "Occupant load?",
  createdByUserID: "reviewer-1"
});
assert.equal(legacyThread.requestType, "fact-request");
const clientView = reviewThreadForClient({ kind: "revision-request", status: "open" });
assert.equal(clientView.requestType, "revision-request");
assert.throws(
  () => normalizeReviewThreadPayload({
    projectID: "project-1",
    status: "reopened",
    title: "x",
    createdByUserID: "u"
  }),
  /use open after a reopen/
);

// --- Report Draft v2 / Manifest v3 without mutating v1 ---
const v1Draft = normalizeReportDraftPayload({
  title: "Legacy Report",
  reportDate: createdAt,
  introduction: "Legacy intro",
  blocks: [{ id: "h1", kind: "heading", text: "Findings" }],
  createdBy: "user-1",
  updatedBy: "user-1"
});
assert.equal(v1Draft.schemaVersion, reportDraftSchemaVersion);
const v1Frozen = JSON.stringify(v1Draft);
const v2View = adaptReportDraftV1ToV2View(v1Draft, { projectID: "project-1" });
assert.equal(v2View.schemaVersion, reportDraftSchemaVersionV2);
assert.equal(JSON.stringify(v1Draft), v1Frozen, "v1 payload must not be rewritten by adapter");
const v1RoundTrip = reportDraftV1CompatibleView(v2View);
assert.equal(v1RoundTrip.schemaVersion, reportDraftSchemaVersion);
assert.equal(v1RoundTrip.questionID, undefined);
const memoDraft = normalizeReportDraftPayloadV2({
  title: "Code Memo",
  reportDate: createdAt,
  blocks: [{ id: "h1", kind: "heading", text: "Conclusion" }],
  createdBy: "user-1",
  updatedBy: "user-1",
  recordType: codeDecisionMemoRecordType,
  questionID: question.envelope.id,
  projectID: "project-1",
  draftRevision: 1,
  codeMemo: { conclusionRevision: 1, evidenceSetVersion: 1, definitionRevision: 1 }
});
assert.equal(memoDraft.schemaVersion, reportDraftSchemaVersionV2);
assert.equal(memoDraft.questionID, question.envelope.id);
assert.throws(
  () => normalizeReportDraftPayloadV2({
    title: "Bad",
    reportDate: createdAt,
    blocks: [{ id: "h1", kind: "heading", text: "x" }],
    createdBy: "u",
    updatedBy: "u",
    recordType: codeDecisionMemoRecordType
  }),
  /questionID/
);

const manifestV2 = immutableReportManifest({
  project: { id: "project-1", name: "Test", address: "", description: "" },
  draftID: "draft-1",
  title: "Legacy",
  reportDate: createdAt,
  author: { userID: "user-1", displayName: "User" },
  codeEdition: "synthetic",
  items: [{ id: "i1", kind: "heading", text: "Section" }],
  disclaimers: ["Not legal advice."],
  reportVersion: 1,
  createdAt
});
assert.equal(manifestV2.schemaVersion, reportManifestSchemaVersion);
const v2Frozen = JSON.stringify(manifestV2);
const manifestV3 = immutableReportManifestV3({
  project: { id: "project-1", name: "Test", address: "", description: "" },
  draftID: "draft-memo-1",
  title: "Code Memo v1",
  reportDate: createdAt,
  author: { userID: "owner-1", displayName: "Owner" },
  codeEdition: "synthetic",
  items: [{ id: "i1", kind: "heading", text: "Conclusion" }],
  disclaimers: ["Internally issued professional record; not agency approval."],
  reportVersion: 1,
  createdAt,
  questionSnapshot: {
    questionID: question.envelope.id,
    displayID: "Q-001",
    title: "Egress width",
    questionText: "What clear width applies?",
    definitionRevision: 1,
    definitionHash: "def"
  },
  evidenceSetIdentity: {
    evidenceSetID: evidenceSet.envelope.id,
    version: 1,
    contentHash: evidenceSet.payload.contentHash
  },
  conclusionRevision: 1,
  approval: { actorUserID: "reviewer-1", approvedAt: createdAt, basis: "Approved" },
  issueLineage: { issueVersion: 1, predecessorID: null, successorID: null },
  evidenceRoles: [{
    snapshotID: snapshot.envelope.id,
    role: "governing",
    analysisEligible: true
  }]
});
assert.equal(manifestV3.schemaVersion, reportManifestSchemaVersionV3);
assert.equal(JSON.stringify(manifestV2), v2Frozen, "Manifest v2 must not be mutated when creating v3");
assert.equal(reportManifestForClient(manifestV3).isCodeQuestionManifest, true);
assert.equal(reportManifestForClient(manifestV2).isCodeQuestionManifest, false);

// --- Frozen lifecycle fixture still coherent ---
const fixture = JSON.parse(readFileSync(
  join(__dirname, "fixtures", "code-question-lifecycle-v1.json"),
  "utf8"
));
assert.equal(fixture.shared.questionID, "cq-fixture-001");
for (const stage of ["define", "evidence", "analyze", "review", "issue"]) {
  assert.equal(fixture.stages[stage].questionID, "cq-fixture-001");
}
assert.match(fixture.legalContentPolicy, /not enacted law/i);

// --- Old-client preserve-and-ignore fixture: unknown artifact type fields ---
const unknownArtifact = {
  envelope: {
    id: "cq-new-1",
    type: "codeQuestion",
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    version: 1
  },
  payload: {
    schemaVersion: 1,
    projectID: "project-1",
    displayID: "Q-001",
    questionNumber: 1,
    title: "Future field carrier",
    questionText: "Q?",
    // Future field unknown to old clients — must not be coerced away by new normalizers when reading raw
    futureExperimentalField: { nested: true }
  }
};
assert.equal(unknownArtifact.payload.futureExperimentalField.nested, true);
assert.ok(artifactTypes.includes(unknownArtifact.envelope.type));

console.log("code-question-phase1-contract: all assertions passed");
