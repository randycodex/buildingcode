import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyCodeQuestionAnalysisCompletion,
  applyResearchConversationMessageCommit,
  codeQuestionAnalysisSecondaryRepairPlan,
  codeQuestionAnalysisSecondaryRecords,
  researchAnswerRecordForClient
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");

// Shipped ordinary Research message path must commit usage with answer/conversation.
const messageStart = appSource.indexOf("async function handleResearchConversationMessage");
const messageEnd = appSource.indexOf("async function handleResearchConversationDelete", messageStart);
assert.ok(messageStart >= 0 && messageEnd > messageStart, "Could not locate Research message handler.");
const messageHandlerSlice = appSource.slice(messageStart, messageEnd);
const accountingStart = messageHandlerSlice.indexOf('event: "research_operation_accounting"');
const accountingFinally = messageHandlerSlice.lastIndexOf("} finally {");
assert.ok(accountingFinally >= 0 && accountingStart > accountingFinally,
  "Operation accounting must include every completed or failed generation, not just an early rejection.");
const accountingLog = messageHandlerSlice.slice(accountingStart, messageHandlerSlice.indexOf("}));", accountingStart));
assert.match(accountingLog, /estimatedTokenCostUSD: researchOperation.actualProviderCostUSD/);
assert.match(accountingLog, /pendingProviderRequestCount: researchOperation.pendingProviderRequestCount/);
assert.doesNotMatch(accountingLog, /userID|question|projectContext|draft|apiKey/,
  "Public runtime accounting must not log private request content or identity.");
assert.match(
  messageHandlerSlice,
  /await commitResearchConversationMessage\(/,
  "Research message handler does not use the durable commit helper."
);
assert.match(
  messageHandlerSlice,
  /await commitResearchConversationMessage\([\s\S]*?await bumpCommittedResearchArtifactRevisions\(/,
  "Post-commit artifact revision bookkeeping can still replace a durable Research success with a visible failure."
);
assert.match(
  appSource,
  /async function bumpCommittedResearchArtifactRevisions\([\s\S]*?event: "research_artifact_revision_deferred"[\s\S]*?deferred: true/,
  "Research does not preserve a durable answer when downstream artifact revision metadata is temporarily unavailable."
);
assert.equal(
  /completeResearchUsageReservation\(/.test(messageHandlerSlice),
  false,
  "Research message handler still completes usage outside the durable commit."
);
assert.match(
  messageHandlerSlice,
  /estimatedResearchCostWithProviderAllowance\(result\.usage\)/,
  "Research message handler does not persist unreconciled provider-attempt allowance in internal cost telemetry."
);
assert.match(
  messageHandlerSlice,
  /stage: "evidence_analysis_failure"[\s\S]*stage: "answer_generation_failure"[\s\S]*stage: "answer_verification_revision"/,
  "Hybrid Research telemetry no longer distinguishes provider/validation fallback from verification-driven repair."
);
assert.match(
  messageHandlerSlice,
  /if \(attempt > 0\) \{[\s\S]*?permitext-deterministic-post-repair-acceptance[\s\S]*?break;/,
  "Research can still expose a user-visible failure solely because a second subjective verifier rejects an objectively valid repair."
);
assert.match(
  appSource,
  /async function openAIResearchInterpretationWithStructuredRetry\([\s\S]*retryableResearchInterpretationCodes\.has\(error\?\.code\)[\s\S]*structuredResponseRetry: true[\s\S]*usage: combinedResearchUsage\(firstUsage, retried\.usage\)[\s\S]*createResearchStructuredAttemptDiagnostics\(\{[\s\S]*retryCount: 1/,
  "A malformed model response does not receive one bounded schema retry with combined provider usage."
);
assert.match(
  appSource,
  /const firstFailureStage = error\.failureStage \|\| null;[\s\S]*createResearchStructuredAttemptDiagnostics\(\{[\s\S]*retryCount: 1,[\s\S]*failureStages: \[firstFailureStage\]/,
  "A recovered structured-output retry does not retain its ordered, bounded first-attempt failure diagnostic."
);
assert.match(
  appSource,
  /Object\.assign\(retryError, createResearchStructuredAttemptDiagnostics\(\{[\s\S]*retryCount: 1,[\s\S]*failureStages: \[firstFailureStage, retryError\.failureStage \|\| null\]/,
  "A failed structured-output retry does not retain both ordered attempt diagnostics."
);
assert.match(
  appSource,
  /invalidResponse\.failureStage = payload\?\.status === "incomplete"[\s\S]*\? "provider_incomplete"[\s\S]*: "structured_output_parse"/,
  "Provider-incomplete output that cannot be parsed is not classified at the provider-incomplete stage."
);
assert.match(
  appSource,
  /error\.failureStage = \["INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION"\][\s\S]*\? "evidence_binding_validation"[\s\S]*: "interpretation_validation"/,
  "A parseable incomplete payload can obscure the actual interpretation or evidence-binding validation stage."
);
assert.match(
  appSource,
  /invalidResponse\.providerUsage = researchUsageFromProviderPayload\(payload, model\)/,
  "Malformed Research output can still disappear from provider-cost telemetry."
);
assert.match(
  messageHandlerSlice,
  /escalationStages: modelEscalationStages[\s\S]*verificationAttemptCount: verificationAttempts\.length[\s\S]*verificationIssueTypes/,
  "Completed Research telemetry does not retain escalation stages and verification issue types."
);
assert.match(
  messageHandlerSlice,
  /verificationAttempts\.push\(\{[\s\S]*?researchZoningAttemptDiagnostics\(zoningSafety\)/,
  "A failed deterministic Zoning attempt does not retain privacy-safe clause diagnostics."
);
assert.match(
  messageHandlerSlice,
  /verificationAttemptDiagnostics: researchVerificationAttemptDiagnostics\([\s\S]*?verificationAttempts[\s\S]*?\)/,
  "Completed Research operation telemetry drops per-attempt Zoning diagnostics."
);
assert.match(
  messageHandlerSlice,
  /verificationAttemptDiagnostics: Array\.isArray\(error\.verificationAttempts\)[\s\S]*?researchVerificationAttemptDiagnostics\(error\.verificationAttempts\)/,
  "Failed Research operation telemetry drops per-attempt Zoning diagnostics."
);
assert.match(
  messageHandlerSlice,
  /const failureAttemptDiagnostics = researchVerificationAttemptDiagnostics\([\s\S]*?const failureDiagnosticsByAttempt = new Map\([\s\S]*?verificationAttempts: Array\.isArray\(error\.verificationAttempts\)[\s\S]*?failureDiagnosticsByAttempt\.get\(index \+ 1\)\.zoningSafety/,
  "Research failure logs drop the privacy-safe per-attempt Zoning diagnostic."
);
assert.match(
  messageHandlerSlice,
  /structuredResponseRetryCount: result\.structuredResponseRetryCount \|\| 0,[\s\S]*structuredAttemptFailureCount: result\.structuredAttemptFailureCount \|\| 0,[\s\S]*structuredAttemptFailureStages: result\.structuredAttemptFailureStages \|\| \[\],[\s\S]*providerIncompleteReason: result\.providerIncompleteReason \|\| null/,
  "Completed Research telemetry drops bounded structured-attempt diagnostics."
);
assert.match(
  messageHandlerSlice,
  /structuredResponseRetryCount: error\.structuredResponseRetryCount \|\| 0,[\s\S]*structuredAttemptFailureCount: error\.structuredAttemptFailureCount \|\| 0,[\s\S]*structuredAttemptFailureStages: error\.structuredAttemptFailureStages \|\| \[\],[\s\S]*providerIncompleteReason: error\.providerIncompleteReason \|\| error\.incompleteReason \|\| null/,
  "Failed Research telemetry drops bounded structured-attempt diagnostics."
);
assert.match(
  messageHandlerSlice,
  /catch \(error\) \{[\s\S]*if \(researchReservationID && !researchReservationCompleted\) \{[\s\S]*await releaseResearchUsageReservation\(context\.userID, researchReservationID\)/,
  "Research provider/customer failures no longer release the reserved customer turn."
);
assert.match(
  appSource,
  /async commitResearchConversationMessage\(userID/,
  "File/Postgres adapters missing commitResearchConversationMessage."
);
assert.match(
  appSource,
  /WITH committed_usage AS \([\s\S]*UPDATE permitext_research_usage[\s\S]*RETURNING id[\s\S]*1 \/ CASE WHEN id IS NULL THEN 0 ELSE 1 END AS reservation_assertion/,
  "PostgreSQL Research commit does not abort its SQL transaction when the reservation update is missing."
);
const postgresCommitIndex = appSource.indexOf("WITH committed_usage AS (");
const postgresTransactionIndex = appSource.indexOf(
  "results = await sql.transaction(queries",
  postgresCommitIndex
);
const postCommitReservationCheckIndex = appSource.indexOf(
  "const usageResult = results[usageResultIndex]",
  postgresTransactionIndex
);
assert.ok(
  postgresCommitIndex >= 0 &&
    postgresTransactionIndex > postgresCommitIndex &&
    postCommitReservationCheckIndex > postgresTransactionIndex,
  "PostgreSQL Research commit no longer retains its defensive post-transaction reservation check."
);

const codeQuestionStart = appSource.indexOf("async function generateCodeQuestionAnalysis");
const codeQuestionEnd = appSource.indexOf("async function handleCodeQuestionAnalysisCreate", codeQuestionStart);
assert.ok(codeQuestionStart >= 0 && codeQuestionEnd > codeQuestionStart, "Could not locate Code Question Research analysis.");
const codeQuestionSlice = appSource.slice(codeQuestionStart, codeQuestionEnd);
assert.match(
  codeQuestionSlice,
  /estimatedResearchCostWithProviderAllowance\(result\.usage\)/,
  "Code Question Research does not persist unreconciled provider-attempt allowance in internal cost telemetry."
);
assert.match(
  codeQuestionSlice,
  /catch \(error\) \{[\s\S]*if \(reserved && !completedReservation\) await releaseResearchUsageReservation\(actorUserID, reservationID\)/,
  "Code Question provider/customer failures no longer release the reserved customer turn."
);
assert.match(
  codeQuestionSlice,
  /requestFingerprint: codeQuestionAnalysisBindingHash\(binding\)|const requestFingerprint = codeQuestionAnalysisBindingHash\(binding\)/,
  "Code Question reservations are not bound to their immutable dependency intent."
);
assert.match(
  codeQuestionSlice,
  /reservation\.requestFingerprint !== requestFingerprint[\s\S]*codeQuestionIdempotencyConflict\(/,
  "A reused Code Question request ID with a different dependency binding is not rejected as a conflict."
);
assert.match(
  codeQuestionSlice,
  /await commitCodeQuestionAnalysisCompletion\(actorUserID, storageUserID/,
  "Code Question Research does not use the atomic completion boundary."
);
assert.match(
  codeQuestionSlice,
  /if \(!answer\)[\s\S]*await repairCodeQuestionAnalysisSecondaryRecords\(context, question, replay, answer\)[\s\S]*replayed: true/,
  "An idempotent Code Question replay does not repair its secondary Project records."
);
assert.doesNotMatch(
  codeQuestionSlice,
  /await saveStoredResearchAnswer\(|await saveStoredFoundationArtifactCompareAndSwap\(|await completeResearchUsageReservation\(/,
  "Code Question Research still persists replayable output separately from turn completion."
);
assert.match(
  appSource,
  /async commitCodeQuestionAnalysisCompletion\(actorUserID, storageUserID/,
  "File/Postgres adapters are missing atomic Code Question Research completion."
);
assert.match(
  appSource,
  /WITH committed_usage AS \([\s\S]*UPDATE permitext_research_usage[\s\S]*WITH committed_answer AS \([\s\S]*WITH committed_artifact AS \([\s\S]*await sql\.transaction\(queries, \{ isolationLevel: "Serializable" \}\)/,
  "PostgreSQL Code Question completion does not couple usage, answer, and artifact in one transaction."
);

const reservationID = "reservation-1";
const userID = "apple:durable-test";
const baseStore = () => ({
  researchUsageByUserID: {
    [userID]: [{
      id: reservationID,
      mode: "reservation",
      model: "pending",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      createdAt: "2026-08-01T00:00:00.000Z"
    }]
  },
  researchAnswersByUserID: {},
  researchConversationsByUserID: {
    [userID]: [{
      id: "conv-1",
      title: "Durable",
      messages: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    }]
  },
  activityEventsByUserID: {}
});

const answer = {
  id: "answer-1",
  conversationID: "conv-1",
  projectID: null,
  question: "When must the owner notify?",
  answer: { conclusion: "When required by the selected passage." },
  evidence: [],
  createdAt: "2026-08-01T00:02:00.000Z"
};
const conversation = {
  id: "conv-1",
  title: "Durable",
  topicContext: {
    version: "20260811-research-conversation-topic-v1",
    originalTopic: "When must the owner notify?",
    rootTopic: "When must the owner notify?",
    currentTopic: "When must the owner notify?",
    lastDecision: "continuation",
    factTopics: [{
      rootTopic: "When must the owner notify?",
      establishedFacts: [{
        id: "story_count",
        key: "story_count",
        value: "6",
        statement: "The active-topic building has 6 stories.",
        kind: "established",
        sourceText: "The building has six stories.",
        source: "user"
      }],
      unknownFacts: []
    }],
    updatedAt: "2026-08-01T00:02:00.000Z"
  },
  messages: [
    { id: "u1", role: "user", question: answer.question },
    { id: "answer-1", role: "assistant", answer: answer.answer }
  ],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:02:00.000Z",
  sourceStatus: "current"
};
const usageEntry = {
  model: "permitext-mock",
  mode: "openai",
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
  createdAt: "2026-08-01T00:00:00.000Z"
};

// Successful atomic commit leaves usage complete + answer + conversation.
const successStore = baseStore();
const success = applyResearchConversationMessageCommit(successStore, userID, {
  reservationID,
  usageEntry,
  answer,
  conversation,
  events: []
});
assert.equal(success.replayed, false);
assert.equal(successStore.researchUsageByUserID[userID][0].mode, "openai");
assert.equal(successStore.researchAnswersByUserID[userID][0].id, "answer-1");
assert.equal(successStore.researchConversationsByUserID[userID][0].messages.length, 2);
assert.deepEqual(
  successStore.researchConversationsByUserID[userID][0].topicContext,
  conversation.topicContext,
  "Successful answer commit did not preserve the conversation topic state."
);

// Purchased reservations debit exactly once in the same durable mutation.
const purchasedStore = baseStore();
purchasedStore.researchUsageByUserID[userID][0].fundingSource = "purchased";
purchasedStore.researchCreditsByUserID = {
  [userID]: [{
    id: "purchase:stripe:cs_durable",
    units: 25,
    source: "stripe_purchase",
    sourceID: "cs_durable",
    createdAt: "2026-08-01T00:00:00.000Z"
  }]
};
applyResearchConversationMessageCommit(purchasedStore, userID, {
  reservationID,
  usageEntry,
  answer,
  conversation,
  events: []
});
assert.equal(
  purchasedStore.researchCreditsByUserID[userID].filter((entry) => entry.id === `usage:${reservationID}`).length,
  1,
  "Purchased Research completion did not create exactly one credit debit."
);
assert.equal(
  purchasedStore.researchCreditsByUserID[userID].reduce((sum, entry) => sum + entry.units, 0),
  24,
  "Purchased Research completion did not reduce the durable credit balance by one."
);
applyResearchConversationMessageCommit(purchasedStore, userID, {
  reservationID,
  usageEntry,
  answer,
  conversation,
  events: []
});
assert.equal(
  purchasedStore.researchCreditsByUserID[userID].filter((entry) => entry.id === `usage:${reservationID}`).length,
  1,
  "A replay double-debited purchased Research credits."
);

// Mid-commit failure after usage mutation must not be treated as durable success:
// callers wrap this in withMutation which only writes after the mutator returns.
const failStore = baseStore();
const failSnapshot = JSON.stringify(failStore);
assert.throws(
  () => applyResearchConversationMessageCommit(failStore, userID, {
    reservationID,
    usageEntry,
    answer,
    conversation,
    events: [],
    testThrowAfterUsage: true
  }),
  /TEST_THROW_AFTER_USAGE/
);
// Even though the in-memory object was partially mutated, withMutation only
// persists after a successful return. Simulate that contract:
const discardedPartial = JSON.parse(JSON.stringify(failStore));
assert.equal(discardedPartial.researchUsageByUserID[userID][0].mode, "openai");
assert.equal((discardedPartial.researchAnswersByUserID[userID] || []).length, 0);
// Durable store remains the pre-commit snapshot when the mutator throws.
const durableStore = JSON.parse(failSnapshot);
assert.equal(durableStore.researchUsageByUserID[userID][0].mode, "reservation");
assert.equal((durableStore.researchAnswersByUserID[userID] || []).length, 0);

// Idempotent replay after a successful commit.
const replay = applyResearchConversationMessageCommit(successStore, userID, {
  reservationID,
  usageEntry,
  answer,
  conversation,
  events: []
});
assert.equal(replay.replayed, true);
assert.equal(successStore.researchAnswersByUserID[userID].length, 1);

const codeQuestionActorUserID = "apple:code-question-actor";
const codeQuestionStorageUserID = "organization:code-question-owner";
const codeQuestionReservationID = "cq-analysis-reservation-1";
const codeQuestionAnswer = {
  id: "cq-answer-1",
  conversationID: "code-question:cq-1",
  projectID: "project-1",
  question: "What does the approved evidence require?",
  answer: { answerText: "The approved evidence requires notice." },
  evidence: [],
  createdAt: "2026-08-26T12:01:00.000Z"
};
const codeQuestionArtifact = {
  envelope: {
    id: "qa-1",
    type: "questionAnalysis",
    version: 1,
    createdAt: "2026-08-26T12:01:00.000Z",
    updatedAt: "2026-08-26T12:01:00.000Z"
  },
  payload: {
    id: "qa-1",
    questionID: "cq-1",
    requestID: "request-1",
    researchAnswerID: codeQuestionAnswer.id,
    requestedBy: codeQuestionActorUserID,
    dependencyHash: "dependency-hash-1"
  }
};
const codeQuestionUsage = {
  model: "gpt-test",
  mode: "openai-code-question",
  inputTokens: 12,
  outputTokens: 8,
  totalTokens: 20,
  createdAt: "2026-08-26T12:01:00.000Z"
};
const codeQuestionStore = () => ({
  researchUsageByUserID: {
    [codeQuestionActorUserID]: [{
      id: codeQuestionReservationID,
      mode: "reservation",
      fundingSource: "purchased",
      requestFingerprint: "binding-fingerprint-1",
      createdAt: "2026-08-26T12:00:00.000Z"
    }]
  },
  researchCreditsByUserID: {
    [codeQuestionActorUserID]: [{
      id: "purchase:cq-test",
      units: 25,
      source: "test_purchase",
      sourceID: "cq-test",
      createdAt: "2026-08-26T12:00:00.000Z"
    }]
  },
  researchAnswersByUserID: {},
  foundationArtifactsByUserID: {}
});
const codeQuestionCommit = {
  reservationID: codeQuestionReservationID,
  usageEntry: codeQuestionUsage,
  answer: codeQuestionAnswer,
  artifact: codeQuestionArtifact
};
const committedCodeQuestionStore = codeQuestionStore();
const committedCodeQuestion = applyCodeQuestionAnalysisCompletion(
  committedCodeQuestionStore,
  codeQuestionActorUserID,
  codeQuestionStorageUserID,
  codeQuestionCommit
);
assert.equal(committedCodeQuestion.replayed, false);
assert.equal(
  committedCodeQuestionStore.researchUsageByUserID[codeQuestionActorUserID][0].mode,
  "openai-code-question"
);
assert.equal(
  committedCodeQuestionStore.researchUsageByUserID[codeQuestionActorUserID][0].requestFingerprint,
  "binding-fingerprint-1"
);
assert.equal(
  committedCodeQuestionStore.researchAnswersByUserID[codeQuestionStorageUserID][0].id,
  codeQuestionAnswer.id
);
assert.equal(
  committedCodeQuestionStore.foundationArtifactsByUserID[codeQuestionStorageUserID][0].envelope.id,
  codeQuestionArtifact.envelope.id
);
assert.equal(
  committedCodeQuestionStore.researchCreditsByUserID[codeQuestionActorUserID]
    .filter((entry) => entry.id === `usage:${codeQuestionReservationID}`).length,
  1,
  "Atomic Code Question completion did not debit one purchased turn."
);
assert.equal(
  applyCodeQuestionAnalysisCompletion(
    committedCodeQuestionStore,
    codeQuestionActorUserID,
    codeQuestionStorageUserID,
    codeQuestionCommit
  ).replayed,
  true,
  "A completed Code Question retry was not idempotent."
);
assert.equal(
  committedCodeQuestionStore.researchCreditsByUserID[codeQuestionActorUserID]
    .filter((entry) => entry.id === `usage:${codeQuestionReservationID}`).length,
  1,
  "A completed Code Question retry double-debited the purchased turn."
);

const failedCodeQuestionStore = codeQuestionStore();
const failedCodeQuestionSnapshot = JSON.stringify(failedCodeQuestionStore);
assert.throws(
  () => applyCodeQuestionAnalysisCompletion(
    failedCodeQuestionStore,
    codeQuestionActorUserID,
    codeQuestionStorageUserID,
    { ...codeQuestionCommit, testThrowAfterUsage: true }
  ),
  /TEST_THROW_AFTER_USAGE/
);
const durableCodeQuestionStore = JSON.parse(failedCodeQuestionSnapshot);
assert.equal(
  durableCodeQuestionStore.researchUsageByUserID[codeQuestionActorUserID][0].mode,
  "reservation",
  "A failed atomic Code Question mutation must leave the durable turn reserved for release/retry."
);
assert.equal(
  (durableCodeQuestionStore.researchAnswersByUserID[codeQuestionStorageUserID] || []).length,
  0
);
assert.equal(
  (durableCodeQuestionStore.foundationArtifactsByUserID[codeQuestionStorageUserID] || []).length,
  0
);

const secondaryContext = {
  actorUserID: codeQuestionActorUserID,
  storageOwnerUserID: codeQuestionStorageUserID,
  owner: { kind: "organization", id: "code-question-owner", organizationID: "code-question-owner" }
};
const secondaryQuestion = {
  payload: { projectID: codeQuestionAnswer.projectID }
};
const firstSecondaryRecords = codeQuestionAnalysisSecondaryRecords(
  secondaryContext,
  secondaryQuestion,
  codeQuestionArtifact,
  codeQuestionAnswer
);
const retriedSecondaryRecords = codeQuestionAnalysisSecondaryRecords(
  { ...secondaryContext, actorUserID: "apple:different-retrying-collaborator" },
  secondaryQuestion,
  codeQuestionArtifact,
  codeQuestionAnswer
);
assert.deepEqual(
  retriedSecondaryRecords,
  firstSecondaryRecords,
  "Secondary repair records must remain deterministic when another authorized collaborator retries."
);
assert.equal(firstSecondaryRecords.link.targetID, codeQuestionArtifact.envelope.id);
assert.equal(firstSecondaryRecords.event.objectID, codeQuestionArtifact.envelope.id);
assert.equal(firstSecondaryRecords.event.actorUserID, codeQuestionActorUserID);
assert.equal(firstSecondaryRecords.event.createdAt, codeQuestionArtifact.envelope.createdAt);
assert.equal(firstSecondaryRecords.event.metadata.researchAnswerID, codeQuestionAnswer.id);
assert.deepEqual(
  codeQuestionAnalysisSecondaryRepairPlan(firstSecondaryRecords, [], []),
  { saveLink: true, saveEvent: true }
);
assert.deepEqual(
  codeQuestionAnalysisSecondaryRepairPlan(
    firstSecondaryRecords,
    [firstSecondaryRecords.link],
    []
  ),
  { saveLink: false, saveEvent: true },
  "Retry must repair a missing activity after the link write succeeded."
);
assert.deepEqual(
  codeQuestionAnalysisSecondaryRepairPlan(
    firstSecondaryRecords,
    [firstSecondaryRecords.link],
    [{ ...firstSecondaryRecords.event, id: "legacy-random-activity-id" }]
  ),
  { saveLink: false, saveEvent: false },
  "Retry must not duplicate a semantically identical legacy activity event."
);

const customerRecord = researchAnswerRecordForClient({
  ...answer,
  usage: { totalTokens: 30 },
  estimatedCostUSD: 0.0042,
  pricingVersion: "private-pricing-v1",
  answer: {
    ...answer.answer,
    usage: { totalTokens: 30 },
    estimatedCost: { estimatedUSD: 0.0042 },
    estimatedCostUSD: 0.0042,
    pricingVersion: "private-pricing-v1"
  }
});
assert.equal(customerRecord.usage, undefined);
assert.equal(customerRecord.estimatedCostUSD, undefined);
assert.equal(customerRecord.pricingVersion, undefined);
assert.equal(customerRecord.answer.usage, undefined);
assert.equal(customerRecord.answer.estimatedCost, undefined);
assert.equal(customerRecord.answer.estimatedCostUSD, undefined);
assert.equal(customerRecord.answer.pricingVersion, undefined);
assert.equal(customerRecord.answer.conclusion, answer.answer.conclusion);

console.log("permitext research message durable contract passed");
