import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyResearchUsageReservation,
  applyResearchConversationMessageCommit,
  researchDuplicateReservationDisposition,
  researchRequestMessageIdentity,
  researchRequestQuestionFingerprint,
  researchRequestReservationID
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");
const handlerStart = appSource.indexOf("async function handleResearchConversationMessage");
const handlerEnd = appSource.indexOf("async function handleResearchConversationDelete", handlerStart);
const handler = appSource.slice(handlerStart, handlerEnd);

const identity = researchRequestMessageIdentity("user-1", "conversation-1", "request-1");
assert.equal(identity, researchRequestMessageIdentity("user-1", "conversation-1", "request-1"));
assert.notEqual(identity, researchRequestMessageIdentity("user-1", "conversation-1", "request-2"));
assert.equal(researchRequestReservationID("user-1", "conversation-1", "request-1"), `${identity}:usage`);

const question = "When is a fire alarm required?";
const requestFingerprint = researchRequestQuestionFingerprint(question);
assert.equal(requestFingerprint, researchRequestQuestionFingerprint(question));
assert.notEqual(requestFingerprint, researchRequestQuestionFingerprint("When is a sprinkler required?"));

assert.deepEqual(
  researchDuplicateReservationDisposition({
    conversation: { messages: [] },
    question,
    requestID: "request-1",
    reservationRequestFingerprint: requestFingerprint
  }),
  { outcome: "in_progress" },
  "A concurrent identical request must be identified as in progress while its first provider workflow runs."
);
assert.deepEqual(
  researchDuplicateReservationDisposition({
    conversation: { messages: [] },
    question: "When is a sprinkler required?",
    requestID: "request-1",
    reservationRequestFingerprint: requestFingerprint
  }),
  { outcome: "conflict" },
  "A concurrent different question must conflict with the durable reservation fingerprint."
);
assert.deepEqual(
  researchDuplicateReservationDisposition({
    conversation: {
      messages: [{
        id: "question-1",
        role: "user",
        question,
        researchRequestID: "request-1"
      }]
    },
    question: "When is a sprinkler required?",
    requestID: "request-1",
    reservationRequestFingerprint: null
  }),
  { outcome: "conflict" },
  "A completed legacy reservation must still detect a different-question conflict from its stored user message."
);
const completedAnswer = {
  id: "answer-1",
  role: "assistant",
  researchRequestID: "request-1",
  answer: { answerText: "The cited section controls." }
};
const replayDisposition = researchDuplicateReservationDisposition({
  conversation: {
    messages: [
      { id: "question-1", role: "user", question, researchRequestID: "request-1" },
      completedAnswer
    ]
  },
  question,
  requestID: "request-1",
  reservationRequestFingerprint: requestFingerprint
});
assert.equal(replayDisposition.outcome, "replay");
assert.equal(replayDisposition.answer, completedAnswer);

assert.match(handler, /RESEARCH_REQUEST_ID_REQUIRED/);
assert.match(handler, /RESEARCH_REQUEST_ID_CONFLICT/);
assert.match(handler, /reservation\.reason === "duplicate"/);
assert.match(handler, /RESEARCH_REQUEST_IN_PROGRESS/);
assert.match(handler, /requestFingerprint: researchRequestQuestionFingerprint\(question\)/);
assert.match(handler, /reservationRequestFingerprint: reservation\.requestFingerprint/);
assert.match(handler, /researchRequestReservationID\(/);
assert.match(handler, /await releaseResearchUsageReservation\(context\.userID, researchReservationID\)/);
assert.match(handler, /researchReservationCompleted = !mockMode && Boolean\(researchReservationID\)/);
assert.match(handler, /allowOfficialGuidanceOnly && webSupport\.sources\.length === 0/);
assert.match(handler, /RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE/);

const reservationIndex = handler.indexOf("const reservation = await reserveResearchUsage");
const providerWorkflowIndex = handler.indexOf("const evidenceAnalysisPromise = mockMode");
const officialGuidanceFailureIndex = handler.indexOf(
  "allowOfficialGuidanceOnly && webSupport.sources.length === 0"
);
const durableCommitIndex = handler.indexOf("await commitResearchConversationMessage");
const duplicateIndex = handler.indexOf('reservation.reason === "duplicate"', reservationIndex);
const paymentRequiredIndex = handler.indexOf("progressResponse.json(402", duplicateIndex);
assert.ok(
  reservationIndex >= 0 && providerWorkflowIndex > reservationIndex,
  "The paid provider workflow must not start before the request-specific usage reservation succeeds."
);
assert.ok(
  officialGuidanceFailureIndex > providerWorkflowIndex &&
    durableCommitIndex > officialGuidanceFailureIndex,
  "An explicit official-guidance turn without attributable official sources must fail before the durable answer/usage commit."
);
assert.ok(
  duplicateIndex >= 0 && paymentRequiredIndex > duplicateIndex,
  "Duplicate reservations must be resolved before the payment-required response."
);
const duplicateBranch = handler.slice(duplicateIndex, paymentRequiredIndex);
assert.match(duplicateBranch, /duplicateDisposition\.outcome === "conflict"/);
assert.match(duplicateBranch, /duplicateDisposition\.outcome === "replay"/);
assert.match(duplicateBranch, /RESEARCH_REQUEST_IN_PROGRESS/);
assert.doesNotMatch(
  duplicateBranch,
  /RESEARCH_TURNS_REQUIRED|progressResponse\.json\(402/,
  "A duplicate adapter result must never be translated into 402 payment required."
);

assert.match(appSource, /request_fingerprint TEXT/);
assert.match(appSource, /requestFingerprint: duplicate\.requestFingerprint \|\| null/);
assert.match(appSource, /SELECT id, mode, request_fingerprint FROM permitext_research_usage/);
assert.match(
  appSource,
  /ON CONFLICT \(id\) DO UPDATE SET[\s\S]*permitext_research_usage\.mode = 'reservation'[\s\S]*created_at <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'[\s\S]*request_fingerprint = EXCLUDED\.request_fingerprint/,
  "PostgreSQL reservations do not atomically reclaim only expired, same-fingerprint reservations."
);

const reclaimNow = Date.parse("2026-08-26T12:00:00.000Z");
const reclaimUserID = "apple:reservation-reclaim";
const reservationInput = {
  id: "reservation-reclaim-1",
  since: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-09-01T00:00:00.000Z",
  limit: 100,
  paidContinuationEnabled: true,
  maximumRequestUSD: 0.5,
  pricingVersion: "test-pricing-v1",
  requestFingerprint: "fingerprint-a",
  createdAt: "2026-08-26T12:00:00.000Z"
};
const reservationStore = (entry) => ({
  researchUsageByUserID: { [reclaimUserID]: [entry] },
  researchCreditsByUserID: {}
});
const expiredReservation = {
  id: reservationInput.id,
  mode: "reservation",
  fundingSource: "included",
  requestFingerprint: reservationInput.requestFingerprint,
  createdAt: "2026-08-26T11:44:59.000Z"
};
const expiredStore = reservationStore(expiredReservation);
const reclaimed = applyResearchUsageReservation(
  expiredStore,
  reclaimUserID,
  reservationInput,
  reclaimNow
);
assert.equal(reclaimed.reserved, true);
assert.equal(reclaimed.reclaimed, true);
assert.equal(expiredStore.researchUsageByUserID[reclaimUserID].length, 1);
assert.equal(
  expiredStore.researchUsageByUserID[reclaimUserID][0].createdAt,
  reservationInput.createdAt,
  "An expired same-fingerprint reservation was not replaced by the Retry reservation."
);

const activeStore = reservationStore({
  ...expiredReservation,
  createdAt: "2026-08-26T11:45:01.000Z"
});
assert.deepEqual(
  applyResearchUsageReservation(activeStore, reclaimUserID, reservationInput, reclaimNow),
  {
    reserved: false,
    reason: "duplicate",
    mode: "reservation",
    requestFingerprint: reservationInput.requestFingerprint
  },
  "An active same-fingerprint reservation must remain protected as in progress."
);

for (const protectedEntry of [
  { ...expiredReservation, requestFingerprint: "fingerprint-b" },
  { ...expiredReservation, requestFingerprint: null },
  { ...expiredReservation, mode: "openai" }
]) {
  const protectedStore = reservationStore(protectedEntry);
  const result = applyResearchUsageReservation(
    protectedStore,
    reclaimUserID,
    reservationInput,
    reclaimNow
  );
  assert.equal(result.reserved, false);
  assert.equal(result.reason, "duplicate");
  assert.deepEqual(
    protectedStore.researchUsageByUserID[reclaimUserID],
    [protectedEntry],
    "Conflicting, legacy, or completed usage must never be reclaimed."
  );
}

const paidUserID = "apple:paid-idempotency";
const paidReservationID = researchRequestReservationID(
  paidUserID,
  "conversation-paid",
  "request-paid"
);
const paidQuestion = "When is the inspection required?";
const paidAnswer = {
  id: `${researchRequestMessageIdentity(paidUserID, "conversation-paid", "request-paid")}:answer`,
  conversationID: "conversation-paid",
  projectID: null,
  question: paidQuestion,
  answer: { answerText: "The selected provision controls." },
  evidence: [],
  createdAt: "2026-08-25T00:01:00.000Z"
};
const paidConversation = {
  id: "conversation-paid",
  title: "Paid idempotency",
  messages: [
    {
      id: `${researchRequestMessageIdentity(paidUserID, "conversation-paid", "request-paid")}:question`,
      role: "user",
      question: paidQuestion,
      researchRequestID: "request-paid"
    },
    {
      id: paidAnswer.id,
      role: "assistant",
      researchRequestID: "request-paid",
      answer: paidAnswer.answer
    }
  ],
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:01:00.000Z"
};
const paidStore = {
  researchUsageByUserID: {
    [paidUserID]: [{
      id: paidReservationID,
      mode: "reservation",
      fundingSource: "purchased",
      requestFingerprint: researchRequestQuestionFingerprint(paidQuestion),
      createdAt: "2026-08-25T00:00:00.000Z"
    }]
  },
  researchCreditsByUserID: {
    [paidUserID]: [{
      id: "purchase:test",
      units: 25,
      source: "test_purchase",
      sourceID: "test",
      createdAt: "2026-08-25T00:00:00.000Z"
    }]
  },
  researchAnswersByUserID: {},
  researchConversationsByUserID: { [paidUserID]: [] },
  activityEventsByUserID: {}
};
const paidCommit = {
  reservationID: paidReservationID,
  usageEntry: {
    model: "test-provider",
    mode: "openai",
    inputTokens: 10,
    outputTokens: 10,
    totalTokens: 20,
    createdAt: "2026-08-25T00:01:00.000Z"
  },
  answer: paidAnswer,
  conversation: paidConversation,
  events: []
};
assert.equal(
  applyResearchConversationMessageCommit(paidStore, paidUserID, paidCommit).replayed,
  false
);
assert.equal(
  applyResearchConversationMessageCommit(paidStore, paidUserID, paidCommit).replayed,
  true
);
assert.equal(
  paidStore.researchCreditsByUserID[paidUserID]
    .filter((entry) => entry.id === `usage:${paidReservationID}`).length,
  1,
  "A paid Research request replay must preserve exactly one purchased-turn debit."
);
assert.equal(
  paidStore.researchUsageByUserID[paidUserID][0].requestFingerprint,
  researchRequestQuestionFingerprint(paidQuestion),
  "Usage completion must preserve the request fingerprint for later replay/conflict decisions."
);

console.log("Permitext Research one-completed-turn idempotency contract passed; paid model calls: no.");
