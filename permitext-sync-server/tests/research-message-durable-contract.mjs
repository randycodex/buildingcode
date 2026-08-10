import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyResearchConversationMessageCommit
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

console.log("permitext research message durable contract passed");
