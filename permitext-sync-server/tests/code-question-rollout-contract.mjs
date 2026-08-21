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

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return start === -1 ? "" : source.slice(start, end === -1 ? source.length : end);
}

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
assert.match(workspaceScript, /function clearProjectSpecificResearch[\s\S]*?state\.researchConversationID = ""/);
assert.doesNotMatch(functionSource(workspaceScript, "clearProjectSpecificResearch"), /state\.utilities\.analysis = false|delete state\.paneWeights\["utility:analysis"\]|id !== "utility:analysis"/, "Changing Projects still closes the Research list column.");
assert.match(workspaceScript, /if \(previousUserID !== account\.appUserID\) clearResearchAccountRuntime\(\)/);
assert.match(workspaceScript, /if \(previousUserID !== \(state\.account\?\.userID \|\| ""\)\) clearResearchAccountRuntime\(\)/);
assert.match(workspaceScript, /async function fetchAuthoritativeResearchConversation\(conversationID\)/);
assert.match(workspaceScript, /let researchOpenGeneration = 0/);
assert.match(workspaceScript, /function researchOpenContextIsCurrent\(context, options = \{\}\)/);
assert.match(workspaceScript, /generation: \+\+researchOpenGeneration/);
assert.match(workspaceScript, /if \(!supplemental && !researchOpenContextIsCurrent\(renderingContext, \{ requireConversationID: true \}\)\) return panel/);
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
assert.match(workspaceScript, /Capture for analysis/);
assert.match(workspaceScript, /if \(existing\) return null;/);
assert.doesNotMatch(workspaceScript, /Captured as an assumption\./);
assert.match(workspaceScript, /Confirm fact/);
assert.match(workspaceScript, /Keep as assumption/);
assert.match(workspaceScript, /Track missing/);
assert.match(workspaceScript, /researchSource:/);
assert.match(workspaceScript, /\/projects\/code-questions\/inputs\/save/);
assert.doesNotMatch(workspaceScript, /Never imply one by carrying a previously active conversation/);
assert.doesNotMatch(workspaceScript, /Persisted Research conversations do not yet carry a governed Code/);
assert.match(workspaceScript, /grouped\.confirmedFacts\.filter\(\(item\) => item\.state === "confirmed"\)/);
assert.match(workspaceScript, /input\.inputKind === "confirmedFact" && input\.state !== "confirmed"/);
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
assert.match(codeDecisionIndexSource, /Ask a professional code question…/);
assert.match(codeDecisionIndexSource, /createLocalCodeQuestionDraft\(project, \{ questionText \}\)/);
assert.match(codeDecisionIndexSource, /wrap\.appendChild\(renderCodeQuestionIndexList\(project\)\);[\s\S]*?wrap\.appendChild\(toolbar\);/);
assert.doesNotMatch(codeDecisionIndexSource, /Search decisions|Search Code Decisions|code-question-create-button/);
const codeDecisionIndexListSource = workspaceScript.slice(
  workspaceScript.indexOf("function renderCodeQuestionIndexList"),
  workspaceScript.indexOf("async function createLocalCodeQuestionDraft")
);
assert.doesNotMatch(codeDecisionIndexListSource, /code-question-index-meta-row|code-question-index-meta-separator|responsibleDisplayName/);
assert.match(codeDecisionIndexListSource, /codeQuestionIndexArchiveModeProjectIDs\.has\(projectID\)/);
assert.match(codeDecisionIndexListSource, /if \(managing\)[\s\S]*?code-question-index-archive[\s\S]*?archiveIconSVG\(\)/);
assert.match(workspaceScript, /let state = "In Progress"/);
assert.doesNotMatch(workspaceScript, /let state = "Working"/);
assert.match(workspaceScript, /const migrateQuestionIndexWidth = Number\(state\.paneWidthDefaultsVersion \|\| 0\) < 3/);
assert.match(workspaceScript, /migrateQuestionIndexWidth && isQuestionIndex/);
assert.match(workspaceScript, /const defaultSettingsPaneWidth = 600/);
assert.match(workspaceScript, /const migrateSettingsWidth = Number\(state\.paneWidthDefaultsVersion \|\| 0\) < 4/);
assert.match(workspaceScript, /close\.className = "icon-button utility-close code-question-pane-close"/);
assert.match(workspaceScript, /close\.innerHTML = circleXIconSVG\(\)/);
assert.match(workspaceScript, /manage\.className = "icon-button code-question-index-select"[\s\S]*?panelActions\.appendChild\(manage\)[\s\S]*?panelActions\.appendChild\(close\)/);
assert.match(workspaceScript, /const usesActiveDecisionQuestion = Boolean\(activeDecisionQuestion\.trim\(\)\)/);
assert.match(workspaceScript, /if \(!usesActiveDecisionQuestion\) form\.append\(questionLabel\)/);
const ensureShellSource = workspaceScript.slice(
  workspaceScript.indexOf("function ensureCodeQuestionShellForProject"),
  workspaceScript.indexOf("const webFreePlanLimits")
);
assert.doesNotMatch(ensureShellSource, /!currentProjectPanes\.some\(\(pane\) => pane\.paneRole === "decision-record"\)/);
assert.doesNotMatch(workspaceScript, /Question ready from Code Decision/);
assert.doesNotMatch(workspaceScript, /Question ready from Notebook|notebook-research-draft/);
assert.doesNotMatch(workspaceScript, /decisionHeading\.textContent/);
const researchInterpretationSource = workspaceScript.slice(
  workspaceScript.indexOf("function renderResearchInterpretation"),
  workspaceScript.indexOf("async function renderUtilityInstance")
);
assert.match(researchInterpretationSource, /appendResearchAnswerNarrative\(card, result\)/);
assert.match(researchInterpretationSource, /Sources, assumptions, and limits/);
assert.match(researchInterpretationSource, /appendResearchSupportedPoints\(detailsBody/);
assert.match(researchInterpretationSource, /appendResearchList\(detailsBody, "Assumptions used"/);
assert.match(researchInterpretationSource, /appendResearchUnresolved\(detailsBody/);
assert.match(researchInterpretationSource, /appendResearchList\(detailsBody, "Related evidence to add"/);
assert.match(researchInterpretationSource, /Based on.*enacted/);
assert.match(researchInterpretationSource, /evidenceReviewed\.open = Boolean\(options\.detailsOpen\)[\s\S]*?evidenceReviewedBody\.append\(details\);[\s\S]*?card\.append\(evidenceReviewed\);[\s\S]*?container\.append\(card\)/);
assert.match(workspaceScript, /renderResearchInterpretation\(bubble, message\.answer, \{ message, conversationID \}\)/);
assert.doesNotMatch(researchInterpretationSource, /research-disclaimer|result\.disclaimer/);
assert.doesNotMatch(researchInterpretationSource, /answerHeading|Practical application/);
assert.match(workspaceScript, /renderResearchInterpretation\(exactAnswer, answerRecord\.answer, \{ detailsOpen: true \}\)/);

const workspaceStyles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const workspaceHTML = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
const offlineStorage = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const clientState = await readFile(new URL("../public/code-question-client-state.js", import.meta.url), "utf8");
assert.match(workspaceStyles, /grid-template-rows: minmax\(0, 1fr\) var\(--header-height\)/);
assert.doesNotMatch(workspaceStyles, /\.code-question-panel \{[^}]*border-left:/);
assert.doesNotMatch(workspaceStyles, /\.code-decision-context-bar/);
assert.match(workspaceStyles, /\.code-question-index-open \{[\s\S]*?grid-template-areas: "id title";/);
assert.match(workspaceStyles, /\.code-question-index-list \{[\s\S]*?gap: 0;/);
assert.match(workspaceStyles, /\.code-question-index-item \{[\s\S]*?border: 0;[\s\S]*?border-bottom: 1px solid[\s\S]*?border-radius: 0;/);
assert.match(workspaceStyles, /\.code-question-index-actions \{[\s\S]*?position: absolute;[\s\S]*?right: 0;/);
assert.match(workspaceStyles, /\.code-question-index-list\.is-managing \.code-question-index-open \{[\s\S]*?padding-right: 40px;/);
assert.doesNotMatch(workspaceStyles, /body\.code-question-workspace-enabled \.workspace-shell/);
assert.doesNotMatch(workspaceScript, /function renderCodeDecisionContextBar/);
assert.match(workspaceScript, /function renderCodeQuestionShellChrome[\s\S]*?ensureCodeQuestionShellForProject\(project\)/);
assert.doesNotMatch(workspaceStyles, /\.code-question-stage-button/);
assert.match(workspaceStyles, /\.code-question-panel-body \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/);
assert.match(workspaceHTML, /styles\.css\?v=20260820-two-font-system-v1/);
assert.match(serviceWorker, /permitext-pro-shell-v714/);
assert.match(workspaceScript, /paneID\?\.startsWith\("research:conversation:"\)/);
assert.match(serviceWorker, /styles\.css\?v=20260820-two-font-system-v1/);
assert.match(workspaceScript, /research-feedback-compact/);
assert.match(workspaceScript, /research-feedback-details/);
assert.match(workspaceScript, /void saveFeedback\("helpful"/);
assert.match(workspaceStyles, /\.research-feedback-icon \{/);
assert.match(workspaceStyles, /\.research-feedback-details\[hidden\]/);
assert.match(workspaceStyles, /\.research-message\.is-user \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);[\s\S]*?color: #fff;/);
assert.match(workspaceStyles, /\.research-answer-review-row \{[\s\S]*?align-items: flex-start;/);
assert.match(workspaceScript, /evidenceReviewedSummary\.textContent = "Evidence reviewed"/);
assert.match(workspaceScript, /reviewRow\.append\(evidenceReviewed, compact\)/);
assert.match(workspaceScript, /\(evidenceReviewedBody \|\| bubble\)\.append\(answerSources\)/);
assert.match(workspaceStyles, /\.research-answer-review-row \.research-evidence-reviewed \{[\s\S]*?flex: 1;/);
assert.match(workspaceStyles, /workspace-panel:not\(\.reader-panel\) \.research-evidence-reviewed > summary \{[\s\S]*?font-size: 14px !important;/);
assert.match(workspaceStyles, /\.research-answer-paragraph:first-child \{[\s\S]*?font-weight: 400;/);
assert.match(workspaceStyles, /\.research-evidence-reviewed > summary::after \{[\s\S]*?content: "›";/);
assert.doesNotMatch(workspaceScript, /Was this answer useful\?/);
assert.doesNotMatch(workspaceScript, /explanation\.textContent = researchDisplayText\(point\.explanation\)/);
assert.match(workspaceStyles, /\.code-question-index-id \{[\s\S]*?font-weight: 400;/);
assert.match(workspaceStyles, /\.code-question-index-title \{[\s\S]*?font-weight: 400;/);
assert.match(workspaceScript, /const displayNumber = Number\(question\.questionNumber\)/);
assert.match(workspaceScript, /<span class="code-question-index-id">\$\{escapeHTML\(String\(displayNumber\)\)\}<\/span>/);
assert.match(workspaceStyles, /\.search-panel \{[\s\S]*?min-width: 600px;/);
assert.match(workspaceStyles, /\.code-question-panel\[data-cq-role="question-index"\] \{\s*min-width: 300px;\s*\}/);
assert.match(workspaceStyles, /\.evidence-candidate-tray \{\s*display: grid;\s*gap: 0;\s*\}/);
assert.match(workspaceStyles, /\.evidence-candidate-card \{[\s\S]*?border-bottom: 1px solid var\(--border\);[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/);
assert.match(workspaceStyles, /\.evidence-candidate-card blockquote \{[\s\S]*?padding: 0;[\s\S]*?background: transparent;[\s\S]*?color: var\(--text-secondary\);/);
assert.match(workspaceStyles, /\.evidence-candidate-card\.is-active-review blockquote \{\s*max-height: none;\s*overflow: visible;/);
assert.match(workspaceStyles, /\.evidence-candidate-navigator-item \{[\s\S]*?border-bottom: 1px solid var\(--border\);/);
assert.match(workspaceStyles, /\.evidence-candidate-navigation \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\) auto;/);
assert.match(workspaceStyles, /\.evidence-candidate-controls \{[\s\S]*?position: sticky;[\s\S]*?top: 0;[\s\S]*?z-index: 4;[\s\S]*?background: var\(--research-conversation-background\);/);
assert.match(workspaceStyles, /\.research-message\.is-assistant \.research-result-card \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
assert.match(workspaceStyles, /\.research-answer-details > summary:focus-visible/);
assert.match(workspaceStyles, /\.research-answer-details > summary \{[\s\S]*?font-size: calc\(var\(--chrome-font-size\) \* 0\.72\)[\s\S]*?font-weight: 400;/);
assert.match(workspaceScript, /visibleCandidateCount: Math\.min\(3, rankedCandidates\.length\)/);
assert.match(workspaceScript, /const candidate = visibleCandidates\[candidateIndex\]/);
assert.match(workspaceScript, /Candidate \$\{candidateIndex \+ 1\} of \$\{visibleCandidates\.length\}/);
assert.match(workspaceScript, /Find \$\{nextCandidateBatchSize\} more/);
assert.match(workspaceScript, /Review dismissed \(\$\{rejectedCount\}\)/);
assert.match(workspaceScript, /reviewState === "rejected" \? "Restore" : "Dismiss"/);
assert.match(workspaceScript, /research\/conversations\/candidate-disposition/);
assert.match(workspaceScript, /advanceAfterDisposition\(\)/);
assert.match(workspaceScript, /Next skips this candidate without dismissing it/);
assert.match(workspaceScript, /candidateNavigatorOpen/);
assert.doesNotMatch(workspaceScript, /Select at least one passage to add to Research\./);
assert.match(workspaceScript, /reviewControls\.append\(actions, navigation\)[\s\S]*?card\.append\(cardHeader, reviewControls, quote\)/);
assert.match(workspaceStyles, /\.evidence-discovery \{\s*display: grid;\s*gap: var\(--space-3\);\s*margin-top: var\(--space-4\);\s*\}/);
assert.match(workspaceScript, /const researchSurfaceIDs = \[[\s\S]*?state\.utilities\.analysis \? "utility:analysis" : "",[\s\S]*?\.\.\.openResearchConversationPaneIDs\(\)[\s\S]*?\]\.filter\(Boolean\)/);
assert.match(functionSource(workspaceScript, "defaultActivePaneIDs"), /openResearchConversationPaneIDs/);
assert.doesNotMatch(workspaceScript, /renderResearchConversation\(state\.researchConversationID, \{ embedded: true \}\)/);
assert.match(workspaceScript, /panes\.push\(await renderResearchConversation\(state\.researchConversationID\)\)/);
assert.match(workspaceScript, /scrollPaneIntoView\(conversationPaneID\)/);
assert.match(workspaceScript, /const resizeComposerInput = \(\) => \{[\s\S]*?input\.style\.height = "auto";[\s\S]*?input\.style\.height = `\$\{input\.scrollHeight\}px`;/);
assert.match(workspaceStyles, /\.analysis-panel\.has-research-composer \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/);
assert.match(workspaceStyles, /\.research-composer \.research-question-input \{[\s\S]*?overflow-y: hidden;/);
assert.match(workspaceStyles, /\.code-question-index \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) auto;[\s\S]*?height: 100%;/);
assert.match(workspaceStyles, /\.code-question-index-list \{[\s\S]*?overflow-y: auto;/);
assert.match(workspaceScript, /questionEntry = document\.createElement\("textarea"\)[\s\S]*?composerBox\.className = "research-composer-box code-question-entry-box"/);
assert.match(workspaceScript, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing[\s\S]*?toolbar\.requestSubmit\(\)/);
assert.match(workspaceScript, /const resizeQuestionEntry = \(\) => \{[\s\S]*?questionEntry\.style\.height = "auto";[\s\S]*?questionEntry\.scrollHeight/);
assert.doesNotMatch(codeDecisionIndexSource, /requestAnimationFrame\(resizeQuestionEntry\)/);
assert.match(workspaceStyles, /\.code-question-index-search \{[\s\S]*?min-height: 78px;[\s\S]*?resize: none;[\s\S]*?overflow-y: hidden;/);
assert.match(workspaceStyles, /\.code-question-entry-box:has\(\.code-question-index-search:focus-visible\)/);
assert.doesNotMatch(workspaceScript, /Selected evidence \(\$\{displayedSources\.length\}\)/);
assert.doesNotMatch(workspaceScript, /Selected for exploratory Research/);
assert.doesNotMatch(workspaceScript, /Find and select at least one enacted-code passage before bounded Research analysis\./);
assert.match(workspaceScript, /research-answer-source-text/);
assert.match(workspaceScript, /\(embeddedEvidenceNoticeRegion \|\| evidenceScroll\)\.append\(warning\)/);
assert.match(workspaceScript, /research-selected-evidence-notices/);
assert.match(workspaceScript, /A pinned enacted source changed\. Refresh it above before continuing this chat\./);
assert.match(workspaceScript, /researchOpenContextIsCurrent\(dispositionContext, \{ requireConversationID: true \}\)/);
assert.match(workspaceScript, /if \(key === "analysis" && state\.utilities\.analysis\) \{\s*await closeResearchWorkspace\(\);/);
const postgresDispositionStart = serverSource.lastIndexOf("async updateResearchCandidateDisposition");
const postgresDispositionEnd = serverSource.indexOf("async deleteResearchConversation", postgresDispositionStart);
const postgresDispositionSource = serverSource.slice(postgresDispositionStart, postgresDispositionEnd);
assert.match(postgresDispositionSource, /UPDATE permitext_research_conversations AS stored[\s\S]*?stored\.conversation->'candidateDispositions'/);
assert.doesNotMatch(postgresDispositionSource, /WITH retained AS/);
assert.match(workspaceScript, /async function selectCodeDecisionFromIndex\(question\)/);
assert.match(workspaceScript, /selectCodeDecisionFromIndex[\s\S]*?activeEvidenceDiscovery = null;/);
assert.doesNotMatch(workspaceScript, /pendingResearchSelection/);
assert.match(workspaceScript, /hydrateCodeQuestionState\(projectID, questionID, \{ force: true, render: false \}\)/);
assert.match(workspaceScript, /preserveOpenRoles: true/);
assert.match(workspaceScript, /replacementPaneIDs[\s\S]*?state\.paneOrder = nextOrder[\s\S]*?state\.paneWeights\[nextPaneID\] = priorWeight/);
assert.match(workspaceScript, /transitionWorkspace\("utility", \{ refreshPaneIDs: currentRefreshPaneIDs\(\) \}\)/);
assert.match(workspaceScript, /button\.addEventListener\("click", async \(\) => \{\s*await selectCodeDecisionFromIndex\(question\);\s*\}\)/);
assert.match(workspaceScript, /function closeCodeQuestionDownstreamPanes[\s\S]*?pane\.paneRole === "question-index"[\s\S]*?activeQuestionID: ""/);
assert.match(workspaceScript, /parsed\.paneRole === "question-index"[\s\S]*?closeProjectCodeDecisions\(project \|\| \{ id: parsed\.projectID \}\)/);
assert.match(workspaceScript, /async function closeProjectCodeDecisions[\s\S]*?if \(state\.utilities\.analysis\) \{[\s\S]*?await closeResearchWorkspace\(\);[\s\S]*?return true/);
assert.match(workspaceScript, /function renderEvidenceCandidateExcerpt[\s\S]*?candidateExcerptTextMap\(source\)[\s\S]*?range\.cloneContents\(\)/);
assert.match(workspaceStyles, /\.evidence-candidate-card blockquote \.section-block \{[\s\S]*?white-space: normal;/);
assert.doesNotMatch(workspaceStyles, /\.utility-panel \.research-conversation-list,[\s\S]*?\.utility-panel \.research-conversation-empty \{\s*display: none;/);
for (const source of [workspaceScript, serviceWorker, offlineStorage]) {
  assert.match(source, /code-question-client-state\.js\?v=20260809-session-stability-v3/);
}
assert.match(clientState, /code-question-workspace\.js\?v=20260809-code-decision-v5/);

console.log("code-question-rollout-contract: all assertions passed");
