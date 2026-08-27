import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyResearchConversationDeletion,
  applyResearchConversationMessageCommit
} from "../app.mjs";

const ownerUserID = "apple:research-delete-owner";
const organizationStorageUserID = "organization:research-delete-project";
const intruderUserID = "apple:research-delete-intruder";
const conversationID = "research-delete-conversation";
const otherConversationID = "research-keep-conversation";

function fixtureStore() {
  return {
    researchConversationsByUserID: {
      [ownerUserID]: [{
        id: conversationID,
        primaryProjectID: "project-delete",
        sources: [{ id: "selected-passage-delete" }]
      }, {
        id: otherConversationID,
        primaryProjectID: "project-keep",
        sources: [{ id: "selected-passage-keep" }]
      }],
      [intruderUserID]: [{ id: "intruder-owned-conversation", sources: [] }]
    },
    researchAnswersByUserID: {
      [ownerUserID]: [{
        id: "answer-delete-1",
        conversationID,
        evidence: [{ id: "snapshot-delete-1" }]
      }, {
        id: "answer-delete-2",
        conversationID,
        evidence: [{ id: "snapshot-delete-2" }]
      }, {
        id: "answer-keep",
        conversationID: otherConversationID,
        evidence: [{ id: "snapshot-keep" }]
      }],
      // Deliberately hostile dangling references must not be enough to authorize
      // deletion when this user does not own the target conversation.
      [intruderUserID]: [{
        id: "intruder-answer",
        conversationID,
        evidence: [{ id: "intruder-snapshot" }]
      }]
    },
    researchFeedbackByUserID: {
      [ownerUserID]: [{
        id: "feedback-delete-by-conversation",
        conversationID,
        answerID: "answer-delete-1"
      }, {
        id: "feedback-delete-by-answer",
        conversationID: "legacy-wrong-conversation-id",
        answerID: "answer-delete-2"
      }, {
        id: "feedback-keep",
        conversationID: otherConversationID,
        answerID: "answer-keep"
      }],
      [intruderUserID]: [{
        id: "intruder-feedback",
        conversationID,
        answerID: "intruder-answer"
      }]
    },
    projectLinksByUserID: {
      [ownerUserID]: [{
        id: "link-delete-conversation",
        projectID: "project-delete",
        targetKind: "researchConversation",
        targetID: conversationID
      }, {
        id: "link-delete-answer",
        projectID: "project-delete",
        targetKind: "researchAnswer",
        targetID: "answer-delete-1"
      }, {
        id: "link-delete-snapshot",
        projectID: "project-delete",
        targetKind: "approvedEvidence",
        targetID: "snapshot-delete-2"
      }, {
        id: "link-delete-passage",
        projectID: "project-delete",
        targetKind: "selectedPassage",
        targetID: "selected-passage-delete"
      }, {
        id: "link-keep",
        projectID: "project-keep",
        targetKind: "researchConversation",
        targetID: otherConversationID
      }],
      [intruderUserID]: [{
        id: "intruder-link",
        projectID: "intruder-project",
        targetKind: "researchConversation",
        targetID: conversationID
      }]
    },
    activityEventsByUserID: {
      [ownerUserID]: [{
        id: "activity-delete-conversation",
        projectID: "project-delete",
        objectKind: "researchConversation",
        objectID: conversationID
      }, {
        id: "activity-delete-answer",
        projectID: "project-delete",
        objectKind: "researchAnswer",
        objectID: "answer-delete-1"
      }, {
        id: "activity-delete-metadata",
        projectID: "project-delete",
        objectKind: "reportDraft",
        objectID: "report-delete-reference",
        metadata: { conversationID }
      }, {
        id: "activity-keep",
        projectID: "project-keep",
        objectKind: "researchConversation",
        objectID: otherConversationID
      }],
      [organizationStorageUserID]: [{
        id: "organization-activity-delete",
        projectID: "project-delete",
        objectKind: "codeQuestion",
        objectID: "code-question-1",
        metadata: { researchConversationID: conversationID }
      }, {
        id: "organization-activity-keep",
        projectID: "project-keep",
        objectKind: "codeQuestion",
        objectID: "code-question-keep"
      }],
      [intruderUserID]: [{
        id: "intruder-activity",
        projectID: "intruder-project",
        objectKind: "researchConversation",
        objectID: conversationID
      }]
    },
    researchUsageByUserID: {
      [ownerUserID]: [{ id: "usage-kept-for-billing-history", mode: "openai" }]
    }
  };
}

const nonOwnerStore = fixtureStore();
const nonOwnerSnapshot = structuredClone(nonOwnerStore);
assert.deepEqual(
  applyResearchConversationDeletion(nonOwnerStore, intruderUserID, conversationID),
  {
    deleted: false,
    deletedAnswerCount: 0,
    deletedEvidenceSnapshotCount: 0,
    deletedFeedbackCount: 0,
    deletedProjectLinkCount: 0,
    deletedActivityCount: 0,
    projectIDs: []
  },
  "A user without the target conversation should receive an idempotent no-op."
);
assert.deepEqual(
  nonOwnerStore,
  nonOwnerSnapshot,
  "A non-owner deletion attempt changed stored Research data."
);

const store = fixtureStore();
const deletion = applyResearchConversationDeletion(store, ownerUserID, conversationID, {
  activityStorageUserIDs: [organizationStorageUserID]
});
assert.deepEqual(deletion, {
  deleted: true,
  deletedAnswerCount: 2,
  deletedEvidenceSnapshotCount: 2,
  deletedFeedbackCount: 2,
  deletedProjectLinkCount: 4,
  deletedActivityCount: 4,
  projectIDs: ["project-delete"]
});
assert.deepEqual(store.researchConversationsByUserID[ownerUserID].map((item) => item.id), [otherConversationID]);
assert.deepEqual(store.researchAnswersByUserID[ownerUserID].map((item) => item.id), ["answer-keep"]);
assert.deepEqual(store.researchFeedbackByUserID[ownerUserID].map((item) => item.id), ["feedback-keep"]);
assert.deepEqual(store.projectLinksByUserID[ownerUserID].map((item) => item.id), ["link-keep"]);
assert.deepEqual(store.activityEventsByUserID[ownerUserID].map((item) => item.id), ["activity-keep"]);
assert.deepEqual(
  store.activityEventsByUserID[organizationStorageUserID].map((item) => item.id),
  ["organization-activity-keep"]
);
assert.equal(store.researchUsageByUserID[ownerUserID].length, 1, "Conversation deletion erased billing history.");
assert.deepEqual(
  store.researchConversationsByUserID[intruderUserID],
  fixtureStore().researchConversationsByUserID[intruderUserID],
  "Deleting the owner's conversation changed another user's conversation."
);

const idempotentSnapshot = structuredClone(store);
assert.equal(
  applyResearchConversationDeletion(store, ownerUserID, conversationID).deleted,
  false,
  "Repeating a completed conversation deletion should be a no-op."
);
assert.deepEqual(store, idempotentSnapshot, "An idempotent deletion replay changed storage.");

// A result finishing after its conversation was deleted must not restore that
// conversation or convert its pending reservation into a charged turn.
const inFlightStore = fixtureStore();
const inFlightConversation = structuredClone(
  inFlightStore.researchConversationsByUserID[ownerUserID]
    .find((item) => item.id === conversationID)
);
inFlightStore.researchUsageByUserID[ownerUserID] = [{
  id: "reservation-after-delete",
  mode: "reservation",
  fundingSource: "purchased",
  createdAt: "2026-08-27T12:00:00.000Z"
}];
inFlightStore.researchCreditsByUserID = {
  [ownerUserID]: [{
    id: "purchase:race-fixture",
    units: 25,
    source: "test_purchase",
    sourceID: "race-fixture",
    createdAt: "2026-08-27T11:59:00.000Z"
  }]
};
applyResearchConversationDeletion(inFlightStore, ownerUserID, conversationID, {
  activityStorageUserIDs: [organizationStorageUserID]
});
const afterInFlightDelete = structuredClone(inFlightStore);
assert.throws(
  () => applyResearchConversationMessageCommit(inFlightStore, ownerUserID, {
    reservationID: "reservation-after-delete",
    usageEntry: {
      model: "test-provider",
      mode: "openai",
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      createdAt: "2026-08-27T12:01:00.000Z"
    },
    answer: {
      id: "answer-after-delete",
      conversationID,
      projectID: "project-delete",
      question: "May this deleted conversation return?",
      answer: { answerText: "No." },
      evidence: [],
      createdAt: "2026-08-27T12:01:00.000Z"
    },
    conversation: {
      ...inFlightConversation,
      messages: [{ id: "answer-after-delete", role: "assistant" }],
      updatedAt: "2026-08-27T12:01:00.000Z"
    },
    events: []
  }),
  (error) =>
    error?.code === "RESEARCH_CONVERSATION_DELETED" &&
    error?.statusCode === 409,
  "An in-flight result did not fail with the stable deleted-conversation error."
);
assert.deepEqual(
  inFlightStore,
  afterInFlightDelete,
  "An in-flight result mutated billing or Research records after conversation deletion."
);
assert.equal(
  inFlightStore.researchUsageByUserID[ownerUserID][0].mode,
  "reservation",
  "An in-flight deleted-conversation result consumed the reserved turn."
);
assert.equal(
  inFlightStore.researchCreditsByUserID[ownerUserID].length,
  1,
  "An in-flight deleted-conversation result debited purchased credits."
);

const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const postgresDeletionStart = serverSource.indexOf(
  "async deleteResearchConversation(userID, conversationID, options = {})",
  serverSource.indexOf("async function createPostgresStoreAdapter")
);
const postgresDeletionEnd = serverSource.indexOf("async listFoundationArtifacts", postgresDeletionStart);
const postgresDeletionSource = serverSource.slice(postgresDeletionStart, postgresDeletionEnd);
assert.match(postgresDeletionSource, /sql\.transaction\(/, "Postgres deletion is not transactional.");
for (const table of [
  "permitext_research_feedback",
  "permitext_project_links",
  "permitext_project_activity",
  "permitext_evidence_snapshots",
  "permitext_research_answers",
  "permitext_research_conversations"
]) {
  assert.match(
    postgresDeletionSource,
    new RegExp(`DELETE FROM ${table}`),
    `Postgres conversation deletion does not remove ${table}.`
  );
}
assert.match(
  postgresDeletionSource,
  /WHERE id = \$\{conversationID\} AND user_id = \$\{userID\}/,
  "Postgres deletion does not gate the cascade on an owned conversation."
);

const postgresCommitStart = serverSource.indexOf(
  "async commitResearchConversationMessage(userID,",
  serverSource.indexOf("async function createPostgresStoreAdapter")
);
const postgresCommitEnd = serverSource.indexOf(
  "async commitCodeQuestionAnalysisCompletion",
  postgresCommitStart
);
const postgresCommitSource = serverSource.slice(postgresCommitStart, postgresCommitEnd);
assert.match(
  postgresCommitSource,
  /target_conversation[\s\S]*?FOR UPDATE[\s\S]*?RESEARCH_CONVERSATION_DELETED/,
  "Postgres completion does not lock and reject a deleted conversation inside its transaction."
);
assert.match(
  postgresCommitSource,
  /UPDATE permitext_research_conversations[\s\S]*?WHERE id = \$\{conversation\.id\} AND user_id = \$\{userID\}/,
  "Postgres completion can still insert or upsert a deleted Research conversation."
);
assert.doesNotMatch(
  postgresCommitSource,
  /INSERT INTO permitext_research_conversations/,
  "Postgres completion can recreate a conversation deleted during generation."
);
assert.match(
  postgresCommitSource,
  /sql\.transaction\(queries[\s\S]*?researchConversationDeletedError\(\)/,
  "Postgres completion does not translate its transactional deletion assertion into the stable error."
);

const researchMessageStart = serverSource.indexOf("async function handleResearchConversationMessage");
const researchMessageEnd = serverSource.indexOf("async function handleResearchConversationDelete", researchMessageStart);
const researchMessageSource = serverSource.slice(researchMessageStart, researchMessageEnd);
assert.match(
  researchMessageSource,
  /releaseResearchUsageReservation\(context\.userID, researchReservationID\)[\s\S]*?error\.code === "RESEARCH_CONVERSATION_DELETED"[\s\S]*?code: "RESEARCH_CONVERSATION_DELETED"/,
  "The message route does not release the turn and surface the stable deletion error."
);

const privacyPolicy = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
assert.match(
  privacyPolicy,
  /Research conversations and answers[\s\S]*?Until you remove the conversation or delete the account[\s\S]*?Removed from active Permitext storage with the selected conversation or account/,
  "The published selected-conversation deletion promise changed without a matching contract update."
);

console.log("Permitext Research conversation deletion contract passed.");
