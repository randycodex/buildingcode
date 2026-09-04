import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import {
  activeResearchMessages, activeResearchTopicContext, resetResearchActiveContext,
  researchConversationRevision, researchContextRevision, researchConversationConflict
} from "../research-context-state.mjs";
import { commitPostgresNotebookCardMutation } from "../notebook-persistence.mjs";

const temporary = await mkdtemp(join(tmpdir(), "permitext-context-cas-"));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, "store.json");
process.env.NODE_ENV = "test";
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[key];
const { createFileStoreAdapter, researchProgressResponder } = await import("../app.mjs");
const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const userID = "synthetic-context-owner";
const now = "2026-09-04T12:00:00.000Z";
const oldMessage = { id: "old-question", role: "user", question: "The R-2 building is fully sprinklered. What travel distance applies?", createdAt: "2026-09-04T11:00:00.000Z" };
const oldAnswer = { id: "old-answer", role: "assistant", answer: { conclusion: "Historical conclusion", evidence: [{ id: "immutable-snapshot", codeVersion: "2014" }] }, createdAt: oldMessage.createdAt };
const original = { id: "conversation", title: "Saved Research", primaryProjectID: "project-a", sources: [{ kind: "selection", selectedText: "Pinned enacted passage" }], messages: [oldMessage, oldAnswer], topicContext: { rootTopic: oldMessage.question, factTopics: [{ establishedFacts: [{ statement: "Fully sprinklered" }] }] }, createdAt: oldMessage.createdAt, updatedAt: oldMessage.createdAt };
const link = { id: "link-a", projectID: "project-a", targetKind: "researchConversation", targetID: original.id, relationship: "reference", version: 1, metadata: {}, deletedAt: null, createdAt: now, updatedAt: now };
const adapter = createFileStoreAdapter();
const secondAdapter = createFileStoreAdapter();
function winner(results, code) {
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failure = results.find((result) => result.status === "rejected");
  assert.equal(failure.reason.code, code);
  assert.equal(failure.reason.statusCode, 409);
  return results.find((result) => result.status === "fulfilled").value;
}
try {
  const initial = await adapter.saveResearchConversation(userID, structuredClone(original));
  assert.equal(initial.revision, 1);
  await adapter.saveProjectLink(userID, link);
  const snapshot = structuredClone(initial);
  const moved = resetResearchActiveContext({ ...initial, primaryProjectID: "project-b", projectContext: { facts: [] }, movedAt: now }, now);
  const targetLink = { ...link, id: "link-b", projectID: "project-b" };
  const removedLink = { ...link, version: 2, deletedAt: now };
  const storedMove = await adapter.replaceResearchCodeDecisionLinks(userID, {
    conversation: moved, expectedConversationRevision: initial.revision,
    link: targetLink, clearedLinks: [removedLink], expectedClearedLinks: [link]
  });
  assert.equal(storedMove.conversation.revision, 2);
  assert.deepEqual(storedMove.conversation.messages, original.messages, "Historical questions, answers and snapshots remain byte-equivalent.");
  assert.deepEqual(storedMove.conversation.sources, original.sources, "Explicitly pinned prior evidence is retained.");
  assert.deepEqual(activeResearchMessages(storedMove.conversation), []);
  assert.equal(activeResearchTopicContext(storedMove.conversation), null);
  const saved = await adapter.read();
  assert.equal(saved.projectLinksByUserID[userID].find((item) => item.id === "link-a").deletedAt, now);
  assert.equal(saved.projectLinksByUserID[userID].find((item) => item.id === "link-b").deletedAt, null);

  // An already started old-context generation cannot consume a reservation,
  // create an answer, or restore project A after the move committed.
  await adapter.withMutation((store) => { store.researchUsageByUserID[userID] = [{ id: "reservation", mode: "reservation", fundingSource: "purchased" }]; });
  const beforeRejectedCompletion = await adapter.read();
  await assert.rejects(adapter.commitResearchConversationMessage(userID, {
    conversation: { ...snapshot, messages: [...snapshot.messages, { id: "late-answer" }] },
    answer: { id: "late-answer", conversationID: original.id, evidence: [] },
    reservationID: "reservation", usageEntry: { mode: "openai", createdAt: now }, events: [{ id: "late-event" }]
  }), { code: "RESEARCH_CONTEXT_CHANGED", statusCode: 409 });
  assert.deepEqual(await adapter.read(), beforeRejectedCompletion);

  // Both callers read revision 2. Only one unrelated edit can win; the other
  // receives a conflict rather than overwriting the winning edit.
  const edited = winner(await Promise.allSettled([
    adapter.saveResearchConversation(userID, { ...storedMove.conversation, title: "Edit one" }, 2),
    secondAdapter.saveResearchConversation(userID, { ...storedMove.conversation, title: "Edit two" }, 2)
  ]), "RESEARCH_CONVERSATION_CHANGED");
  assert.equal(edited.revision, 3);
  const freshMessage = { id: "new-question", role: "user", contextRevision: 1, question: "What about the travel distance?", createdAt: now };
  const freshAnswer = { id: "new-answer", conversationID: original.id, question: freshMessage.question, evidence: [] };
  const completed = await adapter.commitResearchConversationMessage(userID, {
    conversation: { ...edited, messages: [...edited.messages, freshMessage], topicContext: { contextRevision: 1, rootTopic: freshMessage.question } },
    answer: freshAnswer, reservationID: "reservation", usageEntry: { mode: "openai", createdAt: now }
  });
  assert.equal(completed.conversation.revision, 4);
  assert.deepEqual(activeResearchMessages(completed.conversation), [freshMessage]);
  assert.equal(activeResearchTopicContext(completed.conversation).rootTopic, freshMessage.question);
  const unassigned = await adapter.replaceResearchCodeDecisionLinks(userID, {
    conversation: resetResearchActiveContext({ ...completed.conversation, primaryProjectID: null, projectContext: null, movedAt: now }, now),
    expectedConversationRevision: 4, link: { ...targetLink, version: 2, deletedAt: now }, expectedLink: targetLink
  });
  assert.equal(unassigned.conversation.contextRevision, 2);
  assert.deepEqual(activeResearchMessages(unassigned.conversation), []);
  assert.deepEqual(unassigned.conversation.messages, completed.conversation.messages);
  const replay = await adapter.commitResearchConversationMessage(userID, { conversation: completed.conversation, answer: freshAnswer });
  assert.equal(replay.replayed, true);
  assert.equal(replay.conversation.primaryProjectID, null, "Idempotent historical replay must return the current conversation, never reassign it.");
  assert.equal((await adapter.read()).researchCreditsByUserID[userID].length, 1);

  const beforeLinkConflict = await adapter.read();
  await assert.rejects(adapter.replaceResearchCodeDecisionLinks(userID, {
    conversation: { ...unassigned.conversation, title: "Must roll back" }, expectedConversationRevision: 5,
    link: targetLink, expectedLink: targetLink
  }), { code: "RESEARCH_CONVERSATION_CHANGED" });
  assert.deepEqual(await adapter.read(), beforeLinkConflict, "Failed link CAS rolls back the conversation update too.");
  const legacyMoved = { ...original, movedAt: now, messages: [...original.messages, { ...freshMessage, createdAt: "2026-09-04T12:00:01.000Z" }] };
  assert.deepEqual(activeResearchMessages(legacyMoved), [legacyMoved.messages.at(-1)]);
  assert.equal(activeResearchTopicContext(legacyMoved), null, "Already moved legacy context is never silently reactivated.");

  // Notebook create, revision, archive and delete race through the actual file
  // adapter lock. The winner's card, links and activity must persist together.
  const card = { envelope: { id: "card", type: "notebookCard", version: 1, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null }, payload: { title: "Original", document: [] } };
  const cardLink = { ...link, id: "card-link", targetKind: "notebookCard", targetID: "card" };
  await adapter.commitNotebookCardMutation(userID, { artifact: card, expectedVersion: 0, links: [cardLink], events: [{ id: "created" }] });
  const notebookWinner = winner(await Promise.allSettled([
    adapter.commitNotebookCardMutation(userID, { artifact: { ...card, envelope: { ...card.envelope, version: 2 }, payload: { title: "Revised" } }, expectedVersion: 1, expectedLinks: [cardLink], events: [{ id: "revised" }] }),
    secondAdapter.commitNotebookCardMutation(userID, { artifact: { ...card, envelope: { ...card.envelope, version: 2, archivedAt: now } }, expectedVersion: 1, expectedLinks: [cardLink], events: [{ id: "archived" }] })
  ]), "NOTEBOOK_VERSION_CONFLICT");
  const notebookState = await adapter.read();
  assert.deepEqual(notebookState.foundationArtifactsByUserID[userID][0], notebookWinner);
  assert.equal(notebookState.activityEventsByUserID[userID].filter((event) => ["revised", "archived"].includes(event.id)).length, 1);
  const beforeNotebookLinkConflict = await adapter.read();
  await assert.rejects(adapter.commitNotebookCardMutation(userID, {
    artifact: { ...notebookWinner, envelope: { ...notebookWinner.envelope, version: 3, deletedAt: now } }, expectedVersion: 2,
    expectedLinks: [{ ...cardLink, version: 999 }], links: [{ ...cardLink, version: 2, deletedAt: now }], events: [{ id: "must-not-persist" }]
  }), { code: "NOTEBOOK_VERSION_CONFLICT" });
  assert.deepEqual(await adapter.read(), beforeNotebookLinkConflict);
  await adapter.commitNotebookCardMutation(userID, {
    artifact: { ...notebookWinner, envelope: { ...notebookWinner.envelope, version: 3, deletedAt: now } }, expectedVersion: 2,
    expectedLinks: [cardLink], links: [{ ...cardLink, version: 2, deletedAt: now }], events: [{ id: "deleted" }]
  });
  await assert.rejects(secondAdapter.commitNotebookCardMutation(userID, { artifact: notebookWinner, expectedVersion: 1 }), { code: "NOTEBOOK_VERSION_CONFLICT" });
  const deletedState = await adapter.read();
  assert.equal(deletedState.foundationArtifactsByUserID[userID][0].envelope.deletedAt, now);
  assert.equal(deletedState.projectLinksByUserID[userID].find((item) => item.id === cardLink.id).deletedAt, now);

  // Actual shared transport implementation emits the same allowlisted recovery
  // body for plain JSON and streaming errors, including failures after progress.
  class Response extends EventEmitter {
    headersSent = false; writableEnded = false; output = "";
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; }
    write(value) { this.output += value; }
    end(value = "") { this.output += value; this.writableEnded = true; }
  }
  const recovery = { error: "Review changed sources.", code: "RESEARCH_SOURCES_CHANGED", conversation: { id: "conversation", sources: [] }, sourceStatuses: [{ sectionID: "BC:1", status: "changed" }], charged: false, usage: { remaining: 3 }, boundary: { cannotConclude: "Missing governing text" }, requestID: "request", providerResponse: "private", apiKey: "private", estimatedCostUSD: 5 };
  const plain = new Response();
  researchProgressResponder(new EventEmitter(), plain, false).json(409, recovery);
  const streamed = new Response();
  const responder = researchProgressResponder(new EventEmitter(), streamed, true);
  responder.progress("preparing_question", "active");
  responder.json(409, recovery);
  const streamedError = streamed.output.trim().split("\n").map(JSON.parse).find((event) => event.type === "error").error;
  assert.deepEqual(streamedError, JSON.parse(plain.output));
  assert.equal(streamedError.status, 409);
  assert.deepEqual(streamedError.sourceStatuses, recovery.sourceStatuses);
  assert.deepEqual(streamedError.conversation, recovery.conversation);
  for (const key of ["providerResponse", "apiKey", "estimatedCostUSD"]) assert.equal(key in streamedError, false);

  // Capture the actual Postgres methods and verify their transaction boundaries,
  // predicates and error translation without connecting to a database.
  let transaction;
  let sqlFailure = null;
  const sql = (strings, ...values) => ({ text: strings.join("?"), values });
  sql.transaction = async (queries, options) => { transaction = { queries, options }; if (sqlFailure) throw sqlFailure; return queries.map(() => [{ id: "ok" }]); };
  await commitPostgresNotebookCardMutation(sql, userID, { artifact: notebookWinner, expectedVersion: 1, expectedLinks: [cardLink], events: [{ id: "updated", createdAt: now }] });
  assert.equal(transaction.options.isolationLevel, "Serializable");
  assert.match(transaction.queries[0].text, /UPDATE permitext_foundation_artifacts[\s\S]*user_id = \?[\s\S]*envelope->>'version'[\s\S]*notebook_version_guard/);
  assert.match(transaction.queries[1].text, /FOR UPDATE[\s\S]*notebook_link_guard/);
  assert.match(transaction.queries.at(-1).text, /INSERT INTO permitext_project_activity/);
  for (const code of ["22012", "23505", "40001"]) {
    sqlFailure = { code };
    await assert.rejects(commitPostgresNotebookCardMutation(sql, userID, { artifact: notebookWinner, expectedVersion: 1 }), { code: "NOTEBOOK_VERSION_CONFLICT", statusCode: 409 });
  }
  sqlFailure = null;
  const projectNote = structuredClone(notebookWinner);
  projectNote.envelope.type = "projectNote";
  projectNote.envelope.version = 1;
  await commitPostgresNotebookCardMutation(sql, userID, { artifact: projectNote, expectedVersion: 0, requireEmptyProjectNoteProjectID: "project-note-project" });
  assert.match(transaction.queries[0].text, /NOT EXISTS[\s\S]*target_kind = 'projectNote'[\s\S]*project_note_creation_guard/);
  assert.equal(transaction.options.isolationLevel, "Serializable");
  sqlFailure = { code: "40001" };
  await assert.rejects(commitPostgresNotebookCardMutation(sql, userID, { artifact: projectNote, expectedVersion: 0 }), { code: "PROJECT_NOTE_VERSION_CONFLICT", statusCode: 409 });
  sqlFailure = null;
  const postgres = source.slice(source.indexOf("async function createPostgresStoreAdapter"));
  const start = postgres.indexOf("    async commitResearchConversationMessage(");
  const end = postgres.indexOf("    async commitCodeQuestionAnalysisCompletion(", start);
  const method = postgres.slice(start, end).trim().replace(/,$/, "");
  const researchSQL = (strings, ...values) => /SELECT answers.answer/.test(strings.join("")) ? Promise.resolve([]) : sql(strings, ...values);
  researchSQL.transaction = sql.transaction;
  const postgresAdapter = runInNewContext(`({${method}})`, {
    sql: researchSQL, ensureSchema: async () => {}, researchConversationRevision, researchContextRevision,
    researchConversationConflict, safeJSON: (value) => value, canonicalJSONString: JSON.stringify,
    researchConversationDeletedError: () => Object.assign(new Error("deleted"), { code: "RESEARCH_CONVERSATION_DELETED" })
  });
  await postgresAdapter.commitResearchConversationMessage(userID, { conversation: snapshot, answer: { id: "answer", evidence: [] } });
  assert.match(transaction.queries[0].text, /FOR UPDATE[\s\S]*contextRevision[\s\S]*primaryProjectID[\s\S]*RESEARCH_CONTEXT_CHANGED[\s\S]*revision[\s\S]*RESEARCH_CONVERSATION_CHANGED/);
  assert.equal(transaction.options.isolationLevel, "Serializable");
  assert.match(transaction.queries.at(-1).text, /UPDATE permitext_research_conversations/);
  sqlFailure = { code: "22P02", message: "RESEARCH_CONTEXT_CHANGED:conversation" };
  await assert.rejects(postgresAdapter.commitResearchConversationMessage(userID, { conversation: snapshot, answer: { id: "answer", evidence: [] } }), { code: "RESEARCH_CONTEXT_CHANGED", statusCode: 409 });
  sqlFailure = { code: "40001", message: "serialization failure" };
  await assert.rejects(postgresAdapter.commitResearchConversationMessage(userID, { conversation: snapshot, answer: { id: "answer", evidence: [] } }), { code: "RESEARCH_CONVERSATION_CHANGED", statusCode: 409 });

  const handler = source.slice(source.indexOf("async function handleResearchConversationMessage("), source.indexOf("async function handleResearchConversationDelete("));
  assert.equal((handler.match(/messages: activeMessages/g) || []).length, 4, "Routing, retrieval and both model prompt consumers must use the active context.");
  assert.match(handler, /resolveResearchConversationFacts\(\{[\s\S]*?topicContext\n/);
  assert.doesNotMatch(handler, /messages: conversation.messages|topicContext: conversation.topicContext/);
  console.log("Research context, Notebook atomic persistence and recovery envelope contracts passed; file adapter races exercised; Postgres transaction protocol checked; provider/network calls: zero.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
