/**
 * Phase 0 / Phase 1-expressing Code Question contract tests.
 * Drive real exports from code-question-contract.mjs and capability wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertInputPresentationSeparation,
  assertValidTransition,
  codeQuestionArtifactKinds,
  codeQuestionCapabilityFragment,
  codeQuestionFeatureFlag,
  codeQuestionTransitions,
  codeQuestionWorkflowStages,
  computeDependencyHash,
  deriveQuestionListLabel,
  deriveQuestionReadiness,
  formatQuestionDisplayID,
  isCodeQuestionWorkspaceEnabled,
  isValidTransition,
  normalizeCodeQuestionPayload,
  normalizeEvidenceSnapshotV2,
  normalizeIssuedDecisionRecordPayload,
  normalizeProfessionalConclusionPayload,
  normalizeQuestionAnalysisPayload,
  normalizeQuestionEvidenceSetPayload,
  normalizeQuestionInputPayload,
  normalizeWorkspaceStage,
  phase1StorageRequirements,
  questionPaneKey,
  reviewRequestTypeToLegacyKind
} from "../code-question-contract.mjs";
import {
  capabilityContract,
  capabilityIDs,
  syncContract
} from "../project-foundation-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "fixtures", "code-question-lifecycle-v1.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

// --- Feature flag defaults to disabled (no product path when off) ---

assert.equal(codeQuestionFeatureFlag.name, "permitext:codeQuestionWorkspace");
assert.equal(codeQuestionFeatureFlag.capabilityID, "code-question-workspace");
assert.equal(codeQuestionFeatureFlag.defaultEnabled, false);
assert.equal(isCodeQuestionWorkspaceEnabled({}), false);
assert.equal(isCodeQuestionWorkspaceEnabled({ codeQuestionWorkspaceEnabled: false }), false);
assert.equal(isCodeQuestionWorkspaceEnabled({ codeQuestionWorkspaceEnabled: true }), true);
assert.equal(
  isCodeQuestionWorkspaceEnabled({
    capabilities: { "code-question-workspace": { enabled: true } }
  }),
  true
);

const freeCaps = capabilityContract(null);
assert.equal(
  freeCaps.capabilities[capabilityIDs.codeQuestionWorkspace].enabled,
  false,
  "Code Question workspace must default disabled for free plans."
);
assert.equal(
  freeCaps.capabilities[capabilityIDs.codeQuestionWorkspace].featureFlag,
  "permitext:codeQuestionWorkspace"
);

const proEntitlement = { plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" };
const proCaps = capabilityContract(proEntitlement, Date.now(), {});
assert.equal(proCaps.capabilities.projects.enabled, true, "Pro entitlement fixture must unlock projects.");
assert.equal(
  proCaps.capabilities[capabilityIDs.codeQuestionWorkspace].enabled,
  false,
  "Even Pro must keep Code Question workspace disabled until explicitly enabled."
);

const enabledCaps = capabilityContract(proEntitlement, Date.now(), {
  codeQuestionWorkspaceEnabled: true
});
assert.equal(enabledCaps.capabilities[capabilityIDs.codeQuestionWorkspace].enabled, true);
assert.equal(enabledCaps.capabilities[capabilityIDs.codeQuestionWorkspace].release, "private-beta");

const defaultSync = syncContract({
  entitlement: proEntitlement,
  contentMapVersion: 1
});
assert.equal(
  defaultSync.capabilityContract.capabilities[capabilityIDs.codeQuestionWorkspace].enabled,
  false,
  "syncContract must not enable Code Question workspace by default."
);

const fragment = codeQuestionCapabilityFragment({});
assert.equal(fragment["code-question-workspace"].enabled, false);

// --- Lifecycle stages and artifact kinds ---

assert.deepEqual([...codeQuestionWorkflowStages], [
  "define", "evidence", "analyze", "review", "issue"
]);
for (const kind of [
  "codeQuestion",
  "questionInput",
  "evidenceSnapshotV2",
  "questionEvidenceSet",
  "questionAnalysis",
  "professionalConclusion",
  "issuedDecisionRecord"
]) {
  assert.ok(codeQuestionArtifactKinds.includes(kind), `Missing artifact kind ${kind}`);
}

// --- Transition table expresses Phase 1 requirements ---

assert.ok(codeQuestionTransitions.length >= 20, "Transition table must cover lifecycle gates.");
assert.ok(isValidTransition("codeQuestion", "nonexistent", "active"));
assert.ok(isValidTransition("evidenceProposal", "proposed", "approved"));
assert.ok(isValidTransition("codeMemo", "approved", "issuing"));
assert.ok(isValidTransition("codeMemo", "issuing", "issued"));
assert.ok(isValidTransition("issuedRecord", "issued", "superseded"));
assert.ok(isValidTransition("reviewRequest", "resolved", "open"), "Reopen is resolved→open, not stored status reopened");
assert.equal(isValidTransition("codeMemo", "draft", "issued"), false, "Cannot skip approval/issuance saga");
assert.throws(
  () => assertValidTransition("codeQuestion", "active", "issued"),
  /Invalid codeQuestion transition/
);

// --- Display ID formatting ---

assert.equal(formatQuestionDisplayID(1), "Q-001");
assert.equal(formatQuestionDisplayID(42), "Q-042");
assert.throws(() => formatQuestionDisplayID(0), /Invalid question number/);

// --- Normalize full synthetic lifecycle (shared question ID) ---

const defineStage = fixture.stages.define;
const evidenceStage = fixture.stages.evidence;
const analyzeStage = fixture.stages.analyze;
const reviewStage = fixture.stages.review;
const issueStage = fixture.stages.issue;
const sharedQuestionID = fixture.shared.questionID;

assert.equal(defineStage.questionID, sharedQuestionID);
assert.equal(evidenceStage.questionID, sharedQuestionID);
assert.equal(analyzeStage.questionID, sharedQuestionID);
assert.equal(reviewStage.questionID, sharedQuestionID);
assert.equal(issueStage.questionID, sharedQuestionID);
assert.ok(
  String(fixture.legalContentPolicy).includes("not enacted law"),
  "Fixtures must disclaim unverified legal authority."
);

const question = normalizeCodeQuestionPayload({
  ...defineStage.codeQuestion
});
assert.equal(question.kind, "codeQuestion");
assert.equal(question.displayID, "Q-001");
assert.equal(question.definitionRevision, 2);
assert.equal(question.projectID, fixture.shared.projectID);

assert.throws(
  () => normalizeCodeQuestionPayload({
    ...defineStage.codeQuestion,
    displayID: "Q-999"
  }),
  /display ID must match/
);

const inputs = defineStage.inputs.map((input) => normalizeQuestionInputPayload(input));
assert.equal(inputs.length, 3);
assert.equal(inputs[0].inputKind, "confirmedFact");
assert.equal(inputs[1].inputKind, "assumption");
assert.equal(inputs[2].inputKind, "unknown");
assert.equal(inputs[2].state, "resolved");
assertInputPresentationSeparation(inputs.map((item) => ({
  ...item,
  presentationKind: item.inputKind
})));

const snapshots = evidenceStage.snapshots.map((snap) => normalizeEvidenceSnapshotV2(snap));
assert.equal(snapshots.length, 2);
assert.ok(snapshots[0].quotedText.includes("SYNTHETIC TEST PASSAGE"));
assert.ok(snapshots[0].textHash.length >= 32);

const evidenceSet = normalizeQuestionEvidenceSetPayload(evidenceStage.evidenceSet);
assert.equal(evidenceSet.questionID, sharedQuestionID);
assert.equal(evidenceSet.version, 2);
assert.equal(evidenceSet.entries.length, 2);
assert.equal(evidenceSet.entries[0].role, "governing");
assert.ok(evidenceSet.contentHash);

// Fill analysis/conclusion with real dependency hashes from the contract
const dependencyHash = computeDependencyHash({
  questionText: question.questionText,
  scope: question.scope,
  jurisdiction: question.jurisdiction,
  asOfDate: question.asOfDate,
  inputs,
  evidenceSet
});

const analysis = normalizeQuestionAnalysisPayload({
  ...analyzeStage.analysis,
  definitionHash: dependencyHash,
  inputSetHash: dependencyHash,
  evidenceSetHash: evidenceSet.contentHash,
  dependencyHash
});
assert.equal(analysis.questionID, sharedQuestionID);
assert.equal(analysis.researchAnswerID, "research-answer-fixture-001");
assert.equal(analysis.evidenceSetVersion, 2);

const conclusion = normalizeProfessionalConclusionPayload({
  ...analyzeStage.conclusion,
  definitionHash: dependencyHash,
  inputSetHash: dependencyHash,
  evidenceSetHash: evidenceSet.contentHash,
  analysisDependencyHash: dependencyHash
});
assert.equal(conclusion.questionID, sharedQuestionID);
assert.ok(conclusion.citations.includes("esnap-v2-001"));
assert.notEqual(
  conclusion.kind,
  analysis.kind,
  "Professional conclusion and analysis must remain distinct artifact kinds."
);

const issued = normalizeIssuedDecisionRecordPayload(issueStage.issuedRecord);
assert.equal(issued.questionID, sharedQuestionID);
assert.equal(issued.issueVersion, 1);
assert.equal(issued.status, "issued");

// Staleness: dependency change marks analysis stale in readiness
const readinessOk = deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis,
  conclusion,
  blockingReviewOpen: false,
  currentDependencyHash: dependencyHash
});
assert.equal(readinessOk.canApprove, true, "Resolved unknowns + evidence + conclusion should be ready");
assert.equal(readinessOk.summary.analysisStale, false);

const readinessStale = deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis,
  conclusion,
  currentDependencyHash: "different-hash"
});
assert.equal(readinessStale.summary.analysisStale, true);
assert.ok(readinessStale.disclosedLimitations.some((item) => item.code === "stale-analysis"));

const readinessBlocked = deriveQuestionReadiness({
  question,
  inputs: inputs.map((item) =>
    item.inputKind === "unknown"
      ? { ...item, state: "proposed" }
      : item
  ),
  evidenceSet,
  analysis,
  conclusion,
  currentDependencyHash: dependencyHash
});
assert.equal(readinessBlocked.canIssue, false);
assert.ok(readinessBlocked.blockers.some((item) => item.code === "unresolved-unknown"));

// AI is optional: conclusion without analysis may still be ready
const readinessNoAI = deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis: null,
  conclusion: { ...conclusion, analysisRunID: null },
  currentDependencyHash: dependencyHash
});
assert.equal(readinessNoAI.canApprove, true, "AI analysis is not a prerequisite for approval readiness");

// Review request type mapping (legacy compatibility)
assert.equal(reviewRequestTypeToLegacyKind("fact-request"), "missing-project-fact");
assert.equal(reviewRequestTypeToLegacyKind("revision-request"), "revision-request");
assert.equal(reviewRequestTypeToLegacyKind("evidence-review"), "general-review");
assert.equal(reviewRequestTypeToLegacyKind("interpretation-review"), "general-review");
assert.throws(() => reviewRequestTypeToLegacyKind("unknown-type"), /Invalid review request type/);

// Workspace stage is per-user; must not be confused with shared issue state
assert.equal(normalizeWorkspaceStage("Evidence"), "evidence");
assert.throws(() => normalizeWorkspaceStage("ship-it"), /Invalid Code Question workspace stage/);

// Pane keys scoped to project + question
assert.equal(
  questionPaneKey({
    projectID: fixture.shared.projectID,
    questionID: sharedQuestionID,
    paneRole: "evidence-tray"
  }),
  `cq:${fixture.shared.projectID}:${sharedQuestionID}:evidence-tray`
);

assert.equal(
  deriveQuestionListLabel({ latestIssuedVersion: 1, revisionInProgress: true }),
  "Issued v1 · Revision in progress"
);
assert.equal(deriveQuestionListLabel({ question: { recordState: "active" } }), "Active");

// Invalid evidence role rejected
assert.throws(
  () => normalizeQuestionEvidenceSetPayload({
    ...evidenceStage.evidenceSet,
    entries: [{ ...evidenceStage.evidenceSet.entries[0], role: "maybe" }]
  }),
  /Invalid evidence role/
);

// Issued status only issued|superseded
assert.throws(
  () => normalizeIssuedDecisionRecordPayload({
    ...issueStage.issuedRecord,
    status: "final"
  }),
  /Invalid issued decision record status/
);

// Phase 1 storage requirements checklist remains explicit (not TBD)
assert.ok(phase1StorageRequirements.uniquenessScopes.includes("(projectID, questionNumber)"));
assert.ok(phase1StorageRequirements.uniquenessScopes.includes("(questionID, evidenceSetVersion)"));
assert.ok(phase1StorageRequirements.uniquenessScopes.includes("(questionID, issueVersion)"));
assert.equal(phase1StorageRequirements.concurrency, "atomic-expectedVersion-compare-and-swap");
assert.match(phase1StorageRequirements.offlineTransport, /outbox/);
assert.match(phase1StorageRequirements.issuance, /idempotent-saga/);
assert.ok(phase1StorageRequirements.adapters.includes("report-draft-v1-to-v2"));
assert.ok(phase1StorageRequirements.adapters.includes("report-manifest-v1-v2-to-v3"));
assert.equal(phase1StorageRequirements.unknownRecordPolicy, "preserve-and-ignore");

// Coherence: all stage objects in fixture reference shared question
for (const stageName of fixture.coherenceChecks.stagesMustShareQuestionID) {
  assert.equal(
    fixture.stages[stageName].questionID,
    fixture.coherenceChecks.singleQuestionID,
    `Stage ${stageName} must share the single Code Question ID`
  );
}

// Candidates are not evidence
assert.ok(evidenceStage.candidates.length >= 1);
assert.equal(
  evidenceStage.evidenceSet.entries.some((entry) => entry.snapshotID === "candidate-syn-001"),
  false,
  "Search candidates must not appear as approved Evidence Set entries"
);

console.log("code-question-contract: all assertions passed");
