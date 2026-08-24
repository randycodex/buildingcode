import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyResearchConversationMessageCommit,
  researchAnswerRecordForClient
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");

// Shipped ordinary Research message path must commit usage with answer/conversation.
const messageStart = appSource.indexOf("async function handleResearchConversationMessage");
const messageEnd = appSource.indexOf("async function handleResearchConversationDelete", messageStart);
assert.ok(messageStart >= 0 && messageEnd > messageStart, "Could not locate Research message handler.");
const messageHandlerSlice = appSource.slice(messageStart, messageEnd);
assert.match(
  messageHandlerSlice,
  /await commitResearchConversationMessage\(/,
  "Research message handler does not use the durable commit helper."
);
assert.equal(
  /completeResearchUsageReservation\(/.test(messageHandlerSlice),
  false,
  "Research message handler still completes usage outside the durable commit."
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
  "const results = await sql.transaction(queries",
  postgresCommitIndex
);
const postCommitReservationCheckIndex = appSource.indexOf(
  "const usageResult = results[0]",
  postgresTransactionIndex
);
assert.ok(
  postgresCommitIndex >= 0 &&
    postgresTransactionIndex > postgresCommitIndex &&
    postCommitReservationCheckIndex > postgresTransactionIndex,
  "PostgreSQL Research commit no longer retains its defensive post-transaction reservation check."
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
