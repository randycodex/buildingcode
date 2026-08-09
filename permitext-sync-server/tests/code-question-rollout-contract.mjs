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
const workspaceScript = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert.match(serverSource, /isLoopbackCodeQuestionRequest/);
assert.match(serverSource, /codeQuestionRolloutAccess\(\{/);
assert.doesNotMatch(serverSource, /codeQuestionWorkspaceFeatureEnabled\(\) \|\|\s*body\.codeQuestionWorkspaceEnabled/);
assert.match(workspaceScript, /function renderCodeDecisionResearchBody/);
assert.match(workspaceScript, /function renderCodeDecisionRecordBody/);
assert.match(workspaceScript, /Object\.values\(evidence\.snapshots \|\| \{\}\)/);
assert.match(workspaceScript, /openCodeDecisionWorkspace/);
assert.match(workspaceScript, /state\.utilities\.analysis = true/);
assert.match(workspaceScript, /linkedResearchConversationIDForQuestion/);
assert.match(workspaceScript, /conversation\?\.linkedCodeDecisionID/);
assert.match(workspaceScript, /researchConversationID: conversation\.id/);
assert.match(workspaceScript, /\/projects\/code-questions\/research\/start/);
assert.match(workspaceScript, /\/projects\/code-questions\/research\/link/);
assert.match(workspaceScript, /function clearResearchAccountRuntime\(\)/);
assert.match(workspaceScript, /if \(conversation\?\.primaryProjectID && conversation\.primaryProjectID !== projectID\) return/);
assert.match(workspaceScript, /if \(previousUserID !== account\.appUserID\) clearResearchAccountRuntime\(\)/);
assert.match(workspaceScript, /if \(previousUserID !== \(state\.account\?\.userID \|\| ""\)\) clearResearchAccountRuntime\(\)/);
assert.match(workspaceScript, /async function fetchAuthoritativeResearchConversation\(conversationID\)/);
assert.match(workspaceScript, /let researchOpenGeneration = 0/);
assert.match(workspaceScript, /function researchOpenContextIsCurrent\(context, options = \{\}\)/);
assert.match(workspaceScript, /generation: \+\+researchOpenGeneration/);
assert.match(workspaceScript, /if \(!researchOpenContextIsCurrent\(renderingContext, \{ requireConversationID: true \}\)\) return panel/);
assert.match(workspaceScript, /if \(!researchOpenContextIsCurrent\(discoveryContext\)\) return/);
assert.match(workspaceScript, /if \(!researchOpenContextIsCurrent\(prepareContext\)\) return/);
assert.match(workspaceScript, /conversation = await fetchAuthoritativeResearchConversation\(normalizedConversationID\)/);
assert.doesNotMatch(workspaceScript, /options\.linkedQuestionID/);
assert.match(workspaceScript, /linkedQuestion\?\.researchConversationID === normalizedConversationID/);
assert.match(workspaceScript, /const exactLinkedDecision = Boolean/);
assert.match(workspaceScript, /switchCodeQuestionProject\(codeQuestionWorkspaceState\(\), activeCodeQuestionProjectID\)/);
assert.match(workspaceScript, /dismissedLinkedResearchDecisionKeys\.add/);
assert.match(workspaceScript, /activeEvidenceDiscovery\.projectID === projectID/);
assert.match(workspaceScript, /refreshPaneIDs: \["utility:analysis"\]/);
assert.match(workspaceScript, /\.workspace-panel\[data-pane-id="utility:analysis"\]/);
assert.match(workspaceScript, /void renderWorkspace\(\{ persist: false \}\)/);
assert.match(workspaceScript, /state\.researchConversationID === models\.question\.researchConversationID/);
assert.match(workspaceScript, /startLinkedResearchForCodeDecision\(activeDecisionID, \{ open: false \}\)/);
assert.match(workspaceScript, /\{ conversationID: targetConversationID, selections: selectedPassages \}/);
assert.doesNotMatch(workspaceScript, /const existingPassages = new Set/);
assert.match(workspaceScript, /confirmReplaceDecisionConversation: targetReplacementRequired/);
assert.match(workspaceScript, /expectedTargetConversationID: activeLinkedConversationID \|\| null/);
assert.match(workspaceScript, /Selected for Research/);
assert.match(workspaceScript, /Use in Research/);
assert.match(workspaceScript, /Add Selected Evidence/);
assert.doesNotMatch(workspaceScript, /Prepare Approved Evidence/);
assert.doesNotMatch(workspaceScript, /Find and approve at least one enacted-code passage/);
assert.doesNotMatch(workspaceScript, /Start fresh from this approved evidence/);
assert.match(workspaceScript, /panelTitle\.tabIndex = -1/);
assert.match(workspaceScript, /\.research-question-input:not\(:disabled\), \.panel-title/);
assert.match(workspaceScript, /focusTarget\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(workspaceScript, /Capture in Code Decision/);
assert.match(workspaceScript, /Confirm fact/);
assert.match(workspaceScript, /Keep as assumption/);
assert.match(workspaceScript, /Track missing/);
assert.match(workspaceScript, /researchSource:/);
assert.match(workspaceScript, /\/projects\/code-questions\/inputs\/save/);
assert.doesNotMatch(workspaceScript, /Never imply one by carrying a previously active conversation/);
assert.doesNotMatch(workspaceScript, /Persisted Research conversations do not yet carry a governed Code/);
assert.match(workspaceScript, /grouped\.confirmedFacts\.filter\(\(item\) => item\.state === "confirmed"\)/);
assert.match(workspaceScript, /input\.inputKind === "confirmedFact" && input\.state !== "confirmed"/);
assert.match(workspaceScript, /codeDecisionPresentation\(question\.id, \{ preferSummary: true \}\)/);
assert.match(workspaceScript, /const localDependenciesStale = hasDefinitionDetail && Boolean/);
assert.match(workspaceScript, /Create Code Memo/);
assert.doesNotMatch(workspaceScript, /function renderCodeQuestionStageControl/);
assert.match(workspaceScript, /const codeDecisionResearchNoticesByQuestion = new Map\(\)/);
assert.match(workspaceScript, /code-decision-research-status/);
assert.match(workspaceScript, /clearCodeDecisionResearchNotice\(projectID, qid\)/);
const createResearchSource = workspaceScript.slice(
  workspaceScript.indexOf("async function createLocalCodeQuestionDraft"),
  workspaceScript.indexOf("function renderCodeQuestionDefinitionBody")
);
assert.match(createResearchSource, /setCodeDecisionResearchNotice/);
assert.doesNotMatch(createResearchSource, /showWebNotice\(\s*"Code Decision created"/);
const codeDecisionIndexSource = workspaceScript.slice(
  workspaceScript.indexOf("function renderCodeQuestionIndexBody"),
  workspaceScript.indexOf("function renderCodeQuestionIndexList")
);
assert.doesNotMatch(codeDecisionIndexSource, /Legacy \/ Unassigned|Review legacy work|code-question-legacy-path/);
assert.doesNotMatch(codeDecisionIndexSource, /code-question-index-meta|No Code Decisions yet/);
assert.match(codeDecisionIndexSource, /Ask a professional code question, then press Enter/);
assert.match(codeDecisionIndexSource, /createLocalCodeQuestionDraft\(project, \{ questionText \}\)/);
assert.doesNotMatch(codeDecisionIndexSource, /Search decisions|Search Code Decisions|code-question-create-button/);
assert.match(workspaceScript, /close\.className = "icon-button utility-close code-question-pane-close"/);
assert.match(workspaceScript, /close\.innerHTML = circleXIconSVG\(\)/);
const ensureShellSource = workspaceScript.slice(
  workspaceScript.indexOf("function ensureCodeQuestionShellForProject"),
  workspaceScript.indexOf("const webFreePlanLimits")
);
assert.doesNotMatch(ensureShellSource, /!currentProjectPanes\.some\(\(pane\) => pane\.paneRole === "decision-record"\)/);
assert.doesNotMatch(workspaceScript, /Question ready from Code Decision/);
assert.doesNotMatch(workspaceScript, /Question ready from Notebook|notebook-research-draft/);
assert.doesNotMatch(workspaceScript, /decisionHeading\.textContent/);

const workspaceStyles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const workspaceHTML = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
const offlineStorage = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const clientState = await readFile(new URL("../public/code-question-client-state.js", import.meta.url), "utf8");
assert.match(workspaceStyles, /body\.code-question-workspace-enabled \.workspace-shell \{\s*grid-template-rows: var\(--header-height\) auto minmax\(0, 1fr\)/);
assert.match(workspaceStyles, /grid-template-rows: minmax\(0, 1fr\) auto var\(--header-height\)/);
assert.doesNotMatch(workspaceStyles, /\.code-question-panel \{[^}]*border-left:/);
assert.match(workspaceStyles, /\.code-decision-context-bar/);
assert.doesNotMatch(workspaceStyles, /\.code-question-stage-button/);
assert.match(workspaceStyles, /\.code-question-panel-body \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/);
assert.match(workspaceHTML, /styles\.css\?v=20260809-project-research-width-v1/);
assert.match(serviceWorker, /permitext-pro-shell-v506/);
assert.match(serviceWorker, /styles\.css\?v=20260809-project-research-width-v1/);
assert.match(workspaceStyles, /\.code-question-panel\[data-cq-role="question-index"\] \{\s*min-width: 600px;\s*\}/);
assert.match(workspaceStyles, /\.evidence-discovery \{\s*display: grid;\s*gap: var\(--space-3\);\s*margin-top: var\(--space-4\);\s*\}/);
assert.match(workspaceScript, /const researchSurfaceIDs = \[[\s\S]*?"utility:analysis"[\s\S]*?paneIDForResearchConversation[\s\S]*?paired\.splice/);
assert.match(workspaceStyles, /\.utility-panel \.research-conversation-list,[\s\S]*?\.utility-panel \.research-conversation-empty \{\s*display: none;/);
for (const source of [workspaceScript, serviceWorker, offlineStorage]) {
  assert.match(source, /code-question-client-state\.js\?v=20260809-session-stability-v3/);
}
assert.match(clientState, /code-question-workspace\.js\?v=20260809-code-decision-v5/);

console.log("code-question-rollout-contract: all assertions passed");
