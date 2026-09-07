import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; }
function element() { return { dataset: {}, children: [], style: { setProperty() {} }, callbacks: {}, setAttribute() {}, append(...items) { this.children.push(...items); }, addEventListener(event, action) { this.callbacks[event] = action; } }; }
function all(root) { return [root, ...root.children.flatMap(all)]; }
function harness() {
  const requests = [], writes = [], paints = [], successes = [], failures = [], opens = [];
  let generation = 1, returnConversation = true;
  const identity = { userID: "synthetic-a", generation: 1 };
  const progress = { id: "stable-request", conversationID: "conversation", question: "Preserve this synthetic question", status: "active", stages: new Map([["preparing_question", "active"]]), controller: new AbortController() };
  const context = vm.createContext({
    Map, Date, AbortController, clearInterval() {}, localStorage: {}, progress,
    state: { researchConversationID: "conversation" }, activeWorkspaceID: "workspace",
    researchConversationPaneIsOpen: () => true,
    activeProjectIDForCodeQuestions: () => "project",
    activeResearchConversation: { id: "conversation", primaryProjectID: "project", contextRevision: 0 },
    researchConversationList: [], supplementalResearchConversationIDs: [],
    document: { createElement: element },
    researchProgressStages: [{ id: "preparing_question", label: "Preparing the question" }],
    captureAccountRequest: () => identity,
    isCurrentAccountRequest: (request) => request.generation === generation,
    requireCurrentAccountRequest(request) { if (request.generation !== generation) throw new Error("Account changed"); },
    persistResearchProgressSession: () => writes.push(generation),
    refreshResearchProgressCard: () => paints.push(generation),
    startResearchProgressTimer() {},
    postResearchWithProgress(body, options) { const request = { body, options, ...deferred() }; requests.push(request); return request.promise; },
    updateResearchProgressSession: () => { writes.push(generation); paints.push(generation); },
    activeResearchProgress: new Map([[progress.conversationID, progress]]),
    researchRequestRecoveryScope: () => ({}), removeResearchRequestRecovery: () => writes.push(generation),
    researchFailureMessage: (error) => error.message, researchUsage: null,
    researchProgressStatusLabel: () => "Research interrupted", researchProgressElapsed: () => "00:01", renderResearchPixelGrid: element,
    hasAvailableWebResearchTurnPack: () => false, supplementalResearchConversations: new Map(),
    async openResearchConversation(id) { opens.push(id); return returnConversation ? { id } : null; },
    async openSupplementalResearchConversation(id) { opens.push(id); return returnConversation ? { id } : null; }
  });
  const helpers = ["currentResearchProgressConversation", "captureResearchProgressView", "researchProgressViewIsCurrent", "researchProgressConversationConflict"].map(name => extract(name)).join("\n");
  vm.runInContext(`${helpers}\n${extract("runResearchProgressSession", true)}\n${extract("renderResearchProgressCard")}\nglobalThis.run = runResearchProgressSession; globalThis.render = renderResearchProgressCard;`, context);
  return { context, progress, requests, writes, paints, opens, successes, failures,
    run: () => context.run(progress, { onSuccess: (payload) => successes.push(payload), onFailure: (error) => failures.push(error) }),
    switchAccount: () => { generation += 1; }, unavailable: () => { returnConversation = false; } };
}

for (const code of ["RESEARCH_CONTEXT_CHANGED", "RESEARCH_CONVERSATION_CHANGED", "RESEARCH_SOURCE_CHANGED"]) {
  const test = harness();
  const envelope = { code, status: 409, conversation: { id: "conversation", contextRevision: 2 }, sourceStatuses: [{ id: "source", status: "changed" }], usage: { remaining: 9 }, charged: false, boundary: { cannotConclude: ["Refresh current context"] } };
  const failure = Object.assign(new Error("Review the changed context before continuing."), { payload: envelope });
  const pending = test.run(); test.requests[0].reject(failure); await pending;
  assert.equal(test.failures[0].payload, envelope, "The complete safe server envelope reaches recovery consumers unchanged.");
  assert.equal(test.context.researchUsage, envelope.usage);
  assert.equal(test.progress.id, "stable-request");
  assert.equal(test.progress.question, "Preserve this synthetic question");
  let rendered = test.context.render(test.progress);
  const review = all(rendered).find((node) => node.className === "ghost-button research-progress-review");
  assert.equal(review.textContent, code === "RESEARCH_SOURCE_CHANGED" ? "Review sources" : "Review current Research");
  assert.ok(!all(rendered).some((node) => node.textContent === "Retry"), "A changed context requires a visible current-state review before retry.");
  await review.callbacks.click();
  assert.deepEqual(test.opens, ["conversation"]);
  rendered = test.context.render(test.progress);
  assert.ok(all(rendered).some((node) => node.textContent === "Retry"));
  const retry = test.context.run(test.progress, {}, { retrying: true });
  assert.equal(test.requests[1].body.requestID, test.requests[0].body.requestID);
  assert.equal(test.requests[1].body.question, test.requests[0].body.question);
  test.requests[1].resolve({ conversation: envelope.conversation }); await retry;
}

// A failed reload does not authorize a blind retry against a context never shown.
{
  const test = harness(); test.progress.status = "failed"; test.progress.errorCode = "RESEARCH_CONTEXT_CHANGED"; test.unavailable();
  const review = all(test.context.render(test.progress)).find((node) => node.className === "ghost-button research-progress-review");
  await review.callbacks.click();
  assert.ok(!test.progress.recoveryReviewed);
  assert.match(test.progress.error, /question is preserved/);
}

// Account transitions must suppress late stream stages, success, failure, and retries.
for (const outcome of ["success", "failure"]) {
  const test = harness(); const pending = test.run();
  const writesBefore = test.writes.length, paintsBefore = test.paints.length;
  test.switchAccount();
  test.requests[0].options.onProgress({ stage: "preparing_question", label: "Preparing the question", state: "active" });
  if (outcome === "success") test.requests[0].resolve({ conversation: { id: "conversation" } });
  else test.requests[0].reject(Object.assign(new Error("Old account error"), { payload: { code: "RESEARCH_CONTEXT_CHANGED", usage: { private: true } } }));
  await pending;
  await test.context.run(test.progress, {}, { retrying: true });
  assert.equal(test.writes.length, writesBefore);
  assert.equal(test.paints.length, paintsBefore);
  assert.equal(test.successes.length + test.failures.length, 0);
  assert.equal(test.requests.length, 1);
  assert.equal(test.context.researchUsage, null);
}
console.log("Web Research recovery contract passed: complete 409 envelopes, current-state review, stable retries, and account transition suppression.");
