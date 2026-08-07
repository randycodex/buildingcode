import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  computeDependencyHash,
  deriveQuestionReadiness,
  normalizeCodeQuestionPayload,
  normalizeEvidenceSnapshotV2,
  normalizeIssuedDecisionRecordPayload,
  normalizeProfessionalConclusionPayload,
  normalizeQuestionAnalysisPayload,
  normalizeQuestionEvidenceSetPayload,
  normalizeQuestionInputPayload
} from "../code-question-contract.mjs";
import {
  codeQuestionPilotThresholds,
  codeQuestionRolloutAccess,
  evaluateCodeQuestionRolloutReadiness,
  privacySafeCodeQuestionRolloutEvent,
  rehearseNonDestructiveCodeQuestionRollback
} from "../code-question-rollout.mjs";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/code-question-lifecycle-v1.json", import.meta.url),
  "utf8"
));
const researchCases = JSON.parse(await readFile(
  new URL("../evals/research-cases.json", import.meta.url),
  "utf8"
));

// Release access is server-owned. A remote client cannot self-enable the feature.
assert.deepEqual(codeQuestionRolloutAccess(), {
  enabled: false,
  channel: "disabled",
  reason: "feature-flag-disabled"
});
assert.equal(codeQuestionRolloutAccess({ requestOverride: true, isLoopback: false }).enabled, false);
assert.deepEqual(codeQuestionRolloutAccess({ requestOverride: true, isLoopback: true }), {
  enabled: true,
  channel: "local",
  reason: "loopback-debug-override"
});
const pilotEnvironment = {
  PERMITEXT_CODE_QUESTION_WORKSPACE: "1",
  PERMITEXT_CODE_QUESTION_PILOT_USER_IDS: "pilot-owner-1,pilot-reviewer-1"
};
assert.equal(codeQuestionRolloutAccess({ environment: pilotEnvironment, userID: "other-user" }).enabled, false);
assert.deepEqual(codeQuestionRolloutAccess({ environment: pilotEnvironment, userID: "pilot-owner-1" }), {
  enabled: true,
  channel: "pilot",
  reason: "selected-pilot-account"
});
assert.equal(codeQuestionRolloutAccess({
  environment: { PERMITEXT_CODE_QUESTION_WORKSPACE: "1" },
  userID: "broad-user"
}).channel, "broad");

// The synthetic lifecycle keeps one semantic identity from Define through Issue.
const { define, evidence, analyze, review, issue } = fixture.stages;
for (const stage of [define, evidence, analyze, review, issue]) {
  assert.equal(stage.questionID, fixture.shared.questionID);
}
const question = normalizeCodeQuestionPayload(define.codeQuestion);
const inputs = define.inputs.map(normalizeQuestionInputPayload);
const snapshots = evidence.snapshots.map(normalizeEvidenceSnapshotV2);
const evidenceSet = normalizeQuestionEvidenceSetPayload(evidence.evidenceSet);
const dependencyHash = computeDependencyHash({
  questionText: question.questionText,
  scope: question.scope,
  jurisdiction: question.jurisdiction,
  asOfDate: question.asOfDate,
  inputs,
  evidenceSet
});
const analysis = normalizeQuestionAnalysisPayload({
  ...analyze.analysis,
  definitionHash: dependencyHash,
  inputSetHash: dependencyHash,
  evidenceSetHash: evidenceSet.contentHash,
  dependencyHash
});
const conclusion = normalizeProfessionalConclusionPayload({
  ...analyze.conclusion,
  definitionHash: dependencyHash,
  inputSetHash: dependencyHash,
  evidenceSetHash: evidenceSet.contentHash,
  analysisDependencyHash: dependencyHash
});
const issued = normalizeIssuedDecisionRecordPayload(issue.issuedRecord);
assert.equal(issued.questionID, fixture.shared.questionID);
assert.equal(issued.status, "issued");
assert.ok(conclusion.citations.every((id) => snapshots.some((snapshot) => snapshot.id === id)));
assert.equal(review.reviewRequests.every((request) => request.status === "resolved"), true);
assert.equal(deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis,
  conclusion,
  currentDependencyHash: dependencyHash,
  blockingReviewOpen: false
}).canIssue, true);
assert.equal(deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis,
  conclusion,
  currentDependencyHash: "changed-after-analysis",
  blockingReviewOpen: false
}).summary.analysisStale, true, "A stale analysis must be detected before the issuance gate runs.");

// AI remains optional when the professional conclusion is directly bound to approved evidence.
assert.equal(deriveQuestionReadiness({
  question,
  inputs,
  evidenceSet,
  analysis: null,
  conclusion: { ...conclusion, analysisRunID: "", analysisDependencyHash: "" },
  currentDependencyHash: dependencyHash,
  blockingReviewOpen: false
}).canApprove, true);

// Exercise one knowledgeable-human-approved real-content case without making a new legal claim.
const verifiedCase = researchCases.cases.find((item) => item.status === "approved" && item.reviewedAt);
assert.ok(verifiedCase, "At least one knowledgeable-human-approved content case is required.");
assert.ok(verifiedCase.selectedEvidence.length > 0);
assert.ok(verifiedCase.selectedEvidence.every((source) =>
  source.reference && source.exactPassages?.length && verifiedCase.requiredCitations.includes(source.reference)
));
const verifiedSnapshots = verifiedCase.selectedEvidence.flatMap((source, sourceIndex) =>
  source.exactPassages.map((quotedText, passageIndex) => normalizeEvidenceSnapshotV2({
    id: `verified-${verifiedCase.id}-${sourceIndex}-${passageIndex}`,
    sourceIdentity: `permitext-approved-research-case:${verifiedCase.id}:${source.sectionID}`,
    passageLocator: source.reference,
    quotedText,
    sourceVersion: verifiedCase.codeEdition,
    createdAt: verifiedCase.reviewedAt
  }))
);
assert.ok(verifiedSnapshots.every((snapshot) => snapshot.textHash.length >= 32));
assert.equal(verifiedCase.notes.includes("reviewed"), true);

// General product analytics cannot contain confidential professional content.
const metric = privacySafeCodeQuestionRolloutEvent({
  event: "issue.completed",
  accountID: "account-private-1",
  projectID: fixture.shared.projectID,
  questionID: fixture.shared.questionID,
  stage: "issue",
  outcome: "issued",
  durationMs: 1250,
  retryCount: 1,
  capabilityState: "pilot",
  at: "2026-08-06T20:00:00.000Z"
}, { salt: "phase-10-test-salt-2026" });
assert.equal(metric.event, "code_question.issue.completed");
assert.equal(metric.durationMs, 1250);
assert.notEqual(metric.account, "account-private-1");
assert.equal(JSON.stringify(metric).includes(fixture.shared.questionID), false);
assert.throws(() => privacySafeCodeQuestionRolloutEvent({
  event: "issue.completed",
  questionText: "confidential legal question"
}, { salt: "phase-10-test-salt-2026" }), /not permitted/i);
assert.throws(() => privacySafeCodeQuestionRolloutEvent({
  event: "analysis.completed",
  citations: ["BC 1007.1.1"]
}, { salt: "phase-10-test-salt-2026" }), /not permitted/i);

// Rollback disables the new navigation without deleting the new or legacy records.
const stored = {
  artifacts: [define.codeQuestion, evidence.evidenceSet, issue.issuedRecord],
  legacyItems: [{ id: "saved-legacy-1", kind: "savedItem" }]
};
const storedBefore = JSON.stringify(stored);
const rollback = rehearseNonDestructiveCodeQuestionRollback(stored);
assert.equal(rollback.capability.enabled, false);
assert.equal(rollback.navigation.legacyVisible, true);
assert.equal(JSON.stringify(stored), storedBefore);
assert.equal(rollback.artifacts.length, stored.artifacts.length);

const localGates = Object.fromEntries([
  "contracts", "existing-suites", "browser", "ios", "accessibility", "privacy",
  "source-rights", "retention-deletion", "security", "rollback", "legacy-discovery"
].map((name) => [name, true]));
const readiness = evaluateCodeQuestionRolloutReadiness({
  gates: localGates,
  metrics: {
    syntheticCases: codeQuestionPilotThresholds.minimumSyntheticCases,
    verifiedContentCases: codeQuestionPilotThresholds.minimumVerifiedContentCases,
    citationResolutionRate: 1,
    issuedRecordTraceabilityRate: 1,
    legacyDiscoverabilityRate: 1,
    dataLossEvents: 0
  }
});
assert.equal(readiness.status, "local-ready");
assert.equal(readiness.broadReady, false);
assert.equal(readiness.defaultEnabled, false);
assert.ok(readiness.pendingGates.includes("professional-pilot"));
assert.ok(readiness.pendingGates.includes("deployment"));

const broadReadiness = evaluateCodeQuestionRolloutReadiness({
  gates: Object.fromEntries(Object.keys(readiness.gates).map((name) => [name, true])),
  metrics: {
    syntheticCases: 2,
    verifiedContentCases: 1,
    citationResolutionRate: 1,
    issuedRecordTraceabilityRate: 1,
    legacyDiscoverabilityRate: 1,
    dataLossEvents: 0
  }
});
assert.equal(broadReadiness.status, "broad-ready");
assert.equal(broadReadiness.defaultEnabled, true);

const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
assert.match(serverSource, /isLoopbackCodeQuestionRequest/);
assert.match(serverSource, /codeQuestionRolloutAccess\(\{/);
assert.doesNotMatch(serverSource, /codeQuestionWorkspaceFeatureEnabled\(\) \|\|\s*body\.codeQuestionWorkspaceEnabled/);

const workspaceStyles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const workspaceHTML = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
assert.match(workspaceStyles, /body\.code-question-workspace-enabled \.workspace-shell \{\s*grid-template-rows: var\(--header-height\) auto minmax\(0, 1fr\)/);
assert.match(workspaceStyles, /grid-template-rows: minmax\(0, 1fr\) auto var\(--header-height\)/);
assert.match(workspaceHTML, /styles\.css\?v=20260806-code-question-rollout-v1/);
assert.match(serviceWorker, /permitext-pro-shell-v436/);
assert.match(serviceWorker, /styles\.css\?v=20260806-code-question-rollout-v1/);

console.log("code-question-rollout-contract: all assertions passed");
