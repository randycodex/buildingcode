import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeResearchMessages, activeResearchTopicContext } from "../research-context-state.mjs";

const temporary = await mkdtemp(join(tmpdir(), "permitext-research-notebook-http-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-cas-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, base, "This synthetic HTTP contract forbids external/provider calls.");
  return originalFetch(input, options);
};
const userID = "apple:synthetic-cas-owner";
let token;
async function request(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  const text = await response.text();
  const json = response.headers.get("content-type")?.includes("ndjson")
    ? text.trim().split("\n").map(JSON.parse)
    : JSON.parse(text);
  return { status: response.status, json };
}
try {
  assert.equal((await request("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const signedIn = await request("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-cas-owner", email: "cas@example.test", displayName: "Synthetic test" } });
  assert.equal(signedIn.status, 200);
  token = signedIn.json.account.backendSessionToken;
  const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  for (const [index, projectID] of ["project-a", "project-b"].entries()) {
    const pushed = await request("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: {
      id: `${projectID}-record`, userID, codeVersion, clientID: projectID, name: projectID,
      address: index ? "200 New Project Street" : "100 Prior Project Street", colorHex: "#334455", sortOrder: index,
      updatedAt: "2026-09-04T12:00:00.000Z"
    } }] } });
    assert.equal(pushed.status, 200);
  }
  const created = await request("/research/conversations/create", { projectID: "project-a", requestID: "synthetic-create" });
  assert.equal(created.status, 201);
  const conversationID = created.json.conversation.id;
  const firstAnswer = await request("/research/conversations/message", { conversationID, question: "What is the project address?", requestID: "synthetic-first" });
  assert.equal(firstAnswer.status, 200);
  assert.match(firstAnswer.json.conversation.messages.at(-1).answer.conclusion, /100 Prior Project Street/);
  const adapter = createFileStoreAdapter();
  const beforeMove = (await adapter.listResearchConversations(userID)).find((item) => item.id === conversationID);
  await adapter.saveResearchConversation(userID, { ...beforeMove, projectContext: { facts: ["The prior building is fully sprinklered."] }, topicContext: { rootTopic: "Travel distance", factTopics: [{ establishedFacts: [{ statement: "Fully sprinklered" }] }] } }, beforeMove.revision);
  const move = await request("/research/conversations/assign-project", { conversationID, projectID: "project-b", confirmMove: true });
  assert.equal(move.status, 200);
  assert.equal(move.json.conversation.contextRevision, 1);
  assert.deepEqual(move.json.conversation.projectContext.facts, []);
  assert.deepEqual(move.json.conversation.messages, firstAnswer.json.conversation.messages);
  const current = (await adapter.listResearchConversations(userID)).find((item) => item.id === conversationID);
  assert.deepEqual(activeResearchMessages(current), []);
  assert.equal(activeResearchTopicContext(current), null);
  const secondAnswer = await request("/research/conversations/message", { conversationID, question: "What is the project address?", requestID: "synthetic-second", progressStream: "ndjson" });
  const secondPayload = secondAnswer.json.find((event) => event.type === "result")?.payload;
  assert.ok(secondPayload, JSON.stringify(secondAnswer));
  assert.match(secondPayload.conversation.messages.at(-1).answer.conclusion, /200 New Project Street/);
  assert.doesNotMatch(secondPayload.conversation.messages.at(-1).answer.conclusion, /Prior Project/);
  assert.equal(secondPayload.conversation.messages.at(-1).contextRevision, 1);
  const answers = await adapter.listResearchAnswers(userID);
  assert.equal(answers.find((item) => item.id === beforeMove.messages.at(-1).id).projectContextSnapshot.projectID, "project-a");
  assert.equal(answers.find((item) => item.id === secondPayload.conversation.messages.at(-1).id).projectContextSnapshot.projectID, "project-b");
  const unassigned = await request("/research/conversations/assign-project", { conversationID, projectID: null, confirmMove: true });
  assert.equal(unassigned.status, 200);
  assert.equal(unassigned.json.conversation.contextRevision, 2);
  assert.equal(unassigned.json.conversation.projectContext, null);
  assert.deepEqual(activeResearchMessages(unassigned.json.conversation), []);
  const replay = await request("/research/conversations/message", { conversationID, question: "What is the project address?", requestID: "synthetic-first" });
  assert.equal(replay.status, 200);
  assert.equal(replay.json.replayed, true);
  assert.equal(replay.json.conversation.primaryProjectID, null);
  assert.equal((await adapter.listResearchAnswers(userID)).length, 2);

  const document = { schema: "permitext-notebook-card", schemaVersion: 1, format: "tiptap-json", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Synthetic original." }] }] } };
  const createDraft = { projectID: "project-b", expectedVersion: 0, clientMutationID: "durable-create-revision", cardType: "finding", title: "One recoverable draft", document };
  // Treat the first successful response as lost, then submit exactly the same
  // persisted draft. Its identity, version, link and activity remain single.
  const lostCreateResponse = await request("/notebook/cards/save", createDraft);
  assert.equal(lostCreateResponse.status, 201);
  const retriedCreate = await request("/notebook/cards/save", createDraft);
  assert.equal(retriedCreate.status, 200);
  assert.equal(retriedCreate.json.replayed, true);
  assert.equal(retriedCreate.json.card.id, lostCreateResponse.json.card.id);
  assert.equal(retriedCreate.json.card.version, 1);
  assert.equal("_saveReceipt" in retriedCreate.json.card, false);
  const recoveredID = retriedCreate.json.card.id;
  let recoveredState = await adapter.read();
  assert.equal(recoveredState.foundationArtifactsByUserID[userID].filter((item) => item.envelope.id === recoveredID).length, 1);
  assert.equal(recoveredState.projectLinksByUserID[userID].filter((item) => item.targetID === recoveredID).length, 1);
  assert.equal(recoveredState.activityEventsByUserID[userID].filter((item) => item.objectID === recoveredID).length, 1);
  assert.equal((await request("/notebook/cards/save", { ...createDraft, title: "Changed content under old identity" })).status, 409);
  assert.equal((await request("/notebook/cards/save", { ...createDraft, cardID: recoveredID, expectedVersion: 1 })).status, 409, "Mutation identity cannot be reused for another version.");
  assert.equal((await request("/notebook/cards/save", { projectID: "project-b", cardID: recoveredID, title: "Missing expected version", cardType: "finding", document })).status, 409);
  const editDraft = { ...createDraft, cardID: recoveredID, expectedVersion: 1, clientMutationID: "durable-edit-revision", title: "Recovered edit" };
  const lostEditResponse = await request("/notebook/cards/save", editDraft);
  assert.equal(lostEditResponse.status, 200);
  const retriedEdit = await request("/notebook/cards/save", editDraft);
  assert.equal(retriedEdit.status, 200);
  assert.equal(retriedEdit.json.replayed, true);
  assert.equal(retriedEdit.json.card.version, 2);
  recoveredState = await adapter.read();
  assert.equal(recoveredState.activityEventsByUserID[userID].filter((item) => item.objectID === recoveredID).length, 2);
  const newerEdit = await request("/notebook/cards/save", { ...editDraft, expectedVersion: 2, clientMutationID: "newer-draft-revision", title: "Newer content wins" });
  assert.equal(newerEdit.status, 200);
  assert.equal((await request("/notebook/cards/save", createDraft)).status, 409, "An old creation retry must not resurrect its old result over a newer edit.");
  assert.equal((await request("/notebook/cards/save", editDraft)).status, 409);
  assert.equal((await request("/notebook/cards/get", { projectID: "project-b", cardID: recoveredID })).json.card.title, "Newer content wins");

  const card = await request("/notebook/cards/save", { projectID: "project-b", expectedVersion: 0, cardType: "finding", title: "Original", document });
  assert.equal(card.status, 201, JSON.stringify(card));
  const cardID = card.json.card.id;
  const races = await Promise.all([
    request("/notebook/cards/save", { projectID: "project-b", cardID, expectedVersion: 1, cardType: "finding", title: "Revision A", document }),
    request("/notebook/cards/archive", { projectID: "project-b", cardID, expectedVersion: 1, archived: true })
  ]);
  assert.deepEqual(races.map((item) => item.status).sort(), [200, 409]);
  assert.equal(races.find((item) => item.status === 409).json.code, "NOTEBOOK_VERSION_CONFLICT");
  const winner = races.find((item) => item.status === 200).json.card;
  const savedCard = await request("/notebook/cards/get", { projectID: "project-b", cardID });
  assert.equal(savedCard.json.card.version, 2);
  assert.equal(savedCard.json.card.title, winner.title);
  const deleted = await request("/notebook/cards/delete", { projectID: "project-b", cardID, expectedVersion: 2 });
  assert.equal(deleted.status, 200);
  const stored = await adapter.read();
  assert.equal(stored.foundationArtifactsByUserID[userID].find((item) => item.envelope.id === cardID).envelope.version, 3);
  assert.ok(stored.projectLinksByUserID[userID].filter((item) => item.targetID === cardID).every((item) => item.deletedAt));
  const projectDrafts = ["project-note-a", "project-note-b"].map((clientMutationID) => ({ projectID: "project-a", expectedVersion: 0, clientMutationID, title: "Project information", document }));
  const projectCreates = await Promise.all(projectDrafts.map((body) => request("/projects/collaboration/notes/save", body)));
  assert.deepEqual(projectCreates.map((item) => item.status).sort(), [201, 409], "Concurrent first Project information saves must create exactly one note.");
  const winnerIndex = projectCreates.findIndex((item) => item.status === 201);
  const createdNote = projectCreates[winnerIndex].json.note;
  const createReplay = await request("/projects/collaboration/notes/save", projectDrafts[winnerIndex]);
  assert.equal(createReplay.status, 200);
  assert.equal(createReplay.json.replayed, true);
  assert.equal(createReplay.json.note.id, createdNote.id);
  assert.equal("_saveReceipt" in createReplay.json.note, false);
  const projectEdits = ["note-edit-a", "note-edit-b"].map((clientMutationID) => ({ projectID: "project-a", noteID: createdNote.id, expectedVersion: 1, clientMutationID, title: clientMutationID, document }));
  const projectUpdates = await Promise.all(projectEdits.map((body) => request("/projects/collaboration/notes/save", body)));
  assert.deepEqual(projectUpdates.map((item) => item.status).sort(), [200, 409]);
  const editIndex = projectUpdates.findIndex((item) => item.status === 200);
  assert.equal((await request("/projects/collaboration/notes/save", projectEdits[editIndex])).json.replayed, true);
  assert.equal((await request("/projects/collaboration/notes/save", projectDrafts[winnerIndex])).status, 409, "A post-edit retry cannot restore the earlier Project note version.");
  assert.equal((await request("/projects/collaboration/notes/save", { projectID: "project-a", noteID: createdNote.id, title: "No base", document })).status, 409);
  const noteState = await adapter.read();
  assert.equal(noteState.foundationArtifactsByUserID[userID].filter((item) => item.envelope.type === "projectNote").length, 1);
  assert.equal(noteState.projectLinksByUserID[userID].filter((item) => item.targetID === createdNote.id).length, 1);
  assert.equal(noteState.activityEventsByUserID[userID].filter((item) => item.objectID === createdNote.id).length, 2);
  const withoutID = { projectID: "project-a", expectedVersion: 2, clientMutationID: "note-edit-without-remote-id", title: "Existing singleton", document };
  assert.equal((await request("/projects/collaboration/notes/save", withoutID)).status, 200);
  assert.equal((await request("/projects/collaboration/notes/save", withoutID)).json.replayed, true, "An older local checkpoint lacking remote noteID must still replay its exact singleton update.");
  console.log("Research move/unassign/history/replay, Notebook and Project information atomic/idempotent HTTP contracts passed on an isolated dynamic port; external/provider calls: zero.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
