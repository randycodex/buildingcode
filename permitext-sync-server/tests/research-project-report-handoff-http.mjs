import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeResearchMessages, activeResearchTopicContext } from "../research-context-state.mjs";

// Exercise the shipped HTTP workflow with deterministic saved-Project summaries.
// This tests context and immutable handoff, not provider-generated code advice.
const temporary = await mkdtemp(join(tmpdir(), "permitext-project-report-handoff-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-handoff-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL",
  "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN",
  "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "PERMITEXT_TEST_RESEARCH_MOCK"]) delete process.env[key];
const originalFetch = globalThis.fetch;
let base;
let externalAttempts = 0;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== base) externalAttempts++;
  assert.equal(url.origin, base, "The handoff acceptance forbids external/provider requests.");
  return originalFetch(input, options);
};
let server;
try {
  const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const userID = "apple:synthetic-project-report-owner";
  let token;
  async function request(path, body, expectedStatus = 200, bearer = token) {
    const response = await fetch(`${base}${path}`, {
      method: "POST", headers: { "content-type": "application/json",
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
    });
    const json = await response.json();
    assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(json)}`);
    return json;
  }
  await request("/admin/lifetime-grants/grant", { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await request("/account/sign-in", { credential: { provider: "apple",
    providerUserID: "synthetic-project-report-owner", email: "handoff@example.test",
    displayName: "Synthetic reviewer" } })).account.backendSessionToken;
  const adapter = createFileStoreAdapter();
  const project = (id, edition, address, coverage, assumption) => ({
    id: `${id}-record`, userID, clientID: id, name: id, address,
    codeVersion: `CodeContent/authored/new-york-city/${edition}-construction-codes/bundle.json#1`,
    colorHex: "#334455", sortOrder: 0, updatedAt: "2026-09-06T12:00:00.000Z",
    structuredFacts: [
      { id: `${id}-address`, key: "address", label: "Address", value: address, status: "confirmed" },
      { id: `${id}-sprinklers`, key: "sprinkler-status", label: "Sprinklers", value: "Fully sprinklered", sourceText: coverage, status: "stated" },
      { id: `${id}-assumption`, key: "construction-type", label: "Construction", value: assumption, status: "stated" }
    ]
  });
  const projectA = project("handoff-a", 2014, "100 Prior Project Street",
    "Only the cellar is sprinklered.", "Assume Type IIB construction");
  const projectB = project("handoff-b", 2022, "200 Current Project Street",
    "Only the ground floor is sprinklered.", "Assume Type IIIA construction");
  async function pushProject(record) {
    await request("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: record }] } });
  }
  await pushProject(projectA);
  await pushProject(projectB);
  const created = await request("/research/conversations/create",
    { projectID: "handoff-a", requestID: "handoff-create" }, 201);
  const conversationID = created.conversation.id;
  const question = "Summarize the saved Project structured facts and address.";
  const first = await request("/research/conversations/message",
    { conversationID, question, requestID: "handoff-a-summary" });
  const firstMessage = first.conversation.messages.at(-1);
  assert.equal(firstMessage.answer.mode, "project_context");
  assert.equal(firstMessage.answer.retrieval.modelRequested, false);
  const answerA = (await adapter.listResearchAnswers(userID)).find((answer) => answer.id === firstMessage.id);
  assert.equal(answerA.projectContextSnapshot.projectID, "handoff-a");
  assert.match(answerA.projectContextSnapshot.combinedFacts.join("\n"), /Only the cellar is sprinklered/);

  async function generateReport(projectID, answerID, cardID) {
    const sources = await request("/reports/sources/list", { projectID });
    assert.ok(sources.sources.some((source) => source.kind === "researchAnswer" && source.id === answerID));
    const blocks = [
      { id: `${projectID}-facts`, kind: "projectFacts", sourceID: projectID, label: "Project facts" },
      { id: `${projectID}-answer`, kind: "researchAnswer", sourceID: answerID, label: "Saved Project summary" },
      ...(cardID ? [{ id: `${projectID}-note`, kind: "notebookCard", sourceID: cardID, label: "Reviewed Note" }] : [])
    ];
    const { draft } = await request("/reports/drafts/save", { projectID, expectedVersion: 0,
      title: `Synthetic ${projectID} report`, reportDate: "2026-09-06", blocks }, 201);
    return request("/reports/generate", { projectID, draftID: draft.id, expectedVersion: draft.version }, 201);
  }
  const reportA = await generateReport("handoff-a", answerA.id);
  const priorManifest = structuredClone(reportA.manifest);
  const storedConversation = (await adapter.listResearchConversations(userID))[0];
  await adapter.saveResearchConversation(userID, { ...storedConversation,
    projectContext: { ...storedConversation.projectContext, facts: ["Prior manual assumption"] },
    topicContext: { rootTopic: "Prior context", factTopics: [{ establishedFacts: [{ statement: "Prior manual assumption" }] }] }
  }, storedConversation.revision);

  const moved = await request("/research/conversations/assign-project",
    { conversationID, projectID: "handoff-b", confirmMove: true });
  assert.equal(moved.conversation.contextRevision, 1);
  assert.deepEqual(moved.conversation.messages, first.conversation.messages);
  assert.deepEqual(moved.conversation.projectContext.facts, []);
  assert.deepEqual(activeResearchMessages(moved.conversation), []);
  assert.equal(activeResearchTopicContext(moved.conversation), null);
  const second = await request("/research/conversations/message",
    { conversationID, question, requestID: "handoff-b-summary" });
  const secondMessage = second.conversation.messages.at(-1);
  assert.equal(secondMessage.contextRevision, 1);
  assert.equal(secondMessage.answer.mode, "project_context");
  assert.equal(secondMessage.answer.retrieval.modelRequested, false);
  assert.match(secondMessage.answer.conclusion, /200 Current Project Street/);
  assert.doesNotMatch(secondMessage.answer.conclusion, /100 Prior Project Street|Prior manual assumption/);
  const answersAfterMove = await adapter.listResearchAnswers(userID);
  assert.deepEqual(answersAfterMove.find((answer) => answer.id === answerA.id), answerA);
  const answerB = answersAfterMove.find((answer) => answer.id === secondMessage.id);
  assert.equal(answerB.projectContextSnapshot.projectID, "handoff-b");
  const currentFacts = answerB.projectContextSnapshot.combinedFacts.join("\n");
  assert.match(currentFacts, /Only the ground floor is sprinklered/);
  assert.match(currentFacts, /Assume Type IIIA construction/);
  assert.match(currentFacts, /hypothetical assumption; not an established condition/);
  assert.doesNotMatch(currentFacts, /Only the cellar|Type IIB|Fully sprinklered|Prior manual assumption/);

  const noteText = "Synthetic reviewed note. Only the ground floor is sprinklered. Assume Type IIIA construction; verify before relying on it.";
  const { card } = await request("/notebook/cards/save", { projectID: "handoff-b",
    expectedVersion: 0, cardType: "finding", title: "Reviewed current Project facts",
    document: { schema: "permitext-notebook-card", schemaVersion: 1, format: "tiptap-json",
      document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: noteText }] }] } }
  }, 201);
  const reportB = await generateReport("handoff-b", answerB.id, card.id);
  const factsItem = reportB.manifest.items.find((item) => item.kind === "projectFacts");
  assert.match(factsItem.facts, /Only the ground floor is sprinklered/);
  assert.match(factsItem.facts, /hypothetical assumption; not an established condition/);
  assert.doesNotMatch(factsItem.facts, /Only the cellar|Type IIB|Fully sprinklered/);
  assert.equal(reportB.manifest.items.find((item) => item.kind === "notebookCard").plainText, noteText);
  assert.equal(reportB.manifest.items.find((item) => item.kind === "researchAnswer").answerID, answerB.id);
  assert.ok(!reportB.manifest.items.some((item) => item.answerID === answerA.id));
  const sourcesB = await request("/reports/sources/list", { projectID: "handoff-b" });
  assert.ok(!sourcesB.sources.some((source) => source.id === answerA.id), "Moving history must not relabel the prior answer as new-Project evidence.");

  const currentManifest = structuredClone(reportB.manifest);
  await pushProject({ ...projectB, address: "300 Later Revision Street",
    structuredFacts: [], updatedAt: "2026-09-06T12:10:00.000Z" });
  const unassigned = await request("/research/conversations/assign-project",
    { conversationID, projectID: null, confirmMove: true });
  assert.equal(unassigned.conversation.contextRevision, 2);
  assert.deepEqual(activeResearchMessages(unassigned.conversation), []);
  assert.deepEqual(unassigned.conversation.messages, second.conversation.messages);
  assert.deepEqual(await adapter.listResearchAnswers(userID), answersAfterMove);
  for (const [projectID, manifest] of [["handoff-a", priorManifest], ["handoff-b", currentManifest]]) {
    const reopened = await request("/reports/manifests/get", { projectID, manifestID: manifest.id });
    assert.deepEqual(reopened.manifest, manifest, "Later Project edits and reassignment must not rewrite an issued Report.");
  }
  const finalStore = await adapter.read();
  assert.deepEqual(finalStore.researchUsageByUserID?.[userID] || [], [], "Saved-Project summaries must not consume Research turns.");
  assert.equal(externalAttempts, 0);
  console.log("Project A → Project B → qualified Note/Report → unassign HTTP acceptance passed: current facts only, immutable historical answers/manifests, deterministic summaries, zero external/provider attempts.");
} finally {
  globalThis.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
