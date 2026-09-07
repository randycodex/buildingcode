import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const marker = source.includes(`async function ${name}(`) ? `async function ${name}(` : `function ${name}(`;
  const start = source.indexOf(marker), end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const conversation = (id, project, revision = 1, contextRevision = 0) => ({
  id, primaryProjectID: project, revision, contextRevision, messages: [], sources: []
});
function harness() {
  const a = conversation("conversation-a", "project-a");
  const b = conversation("conversation-b", "project-b");
  const requests = [], opens = [], writes = [], removed = [], refreshes = [], consumerRefreshes = [];
  const input = { disabled: true, value: "" }, sendButton = { disabled: true };
  const controls = { ".research-question-input": input, ".research-send-button": sendButton,
    ".research-composer-status": { textContent: "" } };
  const store = new Map([[a.id, a], [b.id, b]]);
  let refreshBarrier = null;
  const context = vm.createContext({
    Map, Date, AbortController, localStorage: {}, clearInterval() {},
    document: { getElementById: () => ({ parentElement: { querySelector: selector => controls[selector] } }) },
    state: { researchConversationID: a.id }, activeWorkspaceID: "workspace-a",
    researchConversationPaneOpened: true,
    researchConversationPaneIsOpen: () => context.researchConversationPaneOpened,
    paneIDForResearchConversation: id => `research:conversation:${id}`,
    activeProjectIDForCodeQuestions: () => context.projectID,
    projectID: "project-a", activeResearchConversation: a,
    researchConversationList: [a, b], supplementalResearchConversations: new Map(),
    supplementalResearchConversationIDs: [], researchOpenGeneration: 1,
    researchQuestionDraft: "", researchUsage: null,
    captureAccountRequest: () => 1, isCurrentAccountRequest: () => true,
    requireCurrentAccountRequest() {},
    researchProgressStages: [{ id: "preparing_question", label: "Preparing the question" }],
    activeResearchProgress: new Map(),
    persistResearchProgressSession(progress) { writes.push({ question: progress.question, status: progress.status, code: progress.errorCode }); },
    refreshResearchProgressCard() {}, startResearchProgressTimer() {}, updateResearchProgressSession() {},
    researchRequestRecoveryScope: (id, requestID) => ({ id, requestID }),
    removeResearchRequestRecovery: (_, value) => removed.push(value),
    researchFailureMessage: error => error.message,
    postResearchWithProgress(body) { const request = { body, ...deferred() }; requests.push(request); return request.promise; },
    async refreshProjectSourceConsumers(ids, options) {
      consumerRefreshes.push({ ids: Array.from(ids), refreshNotebookFoundation: options.refreshNotebookFoundation });
      if (refreshBarrier) await refreshBarrier.promise;
    },
    async refreshResearchConversationList() {},
    async transitionWorkspace(mode, options) { refreshes.push({ mode, ids: Array.from(options.refreshPaneIDs) }); },
    async openResearchConversation(id) {
      opens.push(id); context.state.researchConversationID = id;
      context.activeResearchConversation = store.get(id); return store.get(id);
    },
    async openSupplementalResearchConversation(id) {
      opens.push(id); context.supplementalResearchConversations.set(id, store.get(id)); return store.get(id);
    }
  });
  const helpers = ["currentResearchProgressConversation", "captureResearchProgressView", "researchProgressViewIsCurrent", "researchProgressConversationConflict"];
  vm.runInContext(helpers.filter(name => source.includes(`function ${name}(`)).map(extract).join("\n") + "\n" +
    ["runResearchProgressSession", "recoveredResearchProgressCallbacks", "researchProgressStatusLabel"].map(extract).join("\n"), context);
  const progress = { id: "request-a", conversationID: a.id, question: "Synthetic saved Project summary", status: "active",
    stages: new Map([["preparing_question", "active"]]), controller: new AbortController() };
  context.activeResearchProgress.set(a.id, progress);
  return { context, a, b, progress, requests, opens, writes, removed, refreshes, consumerRefreshes, input, sendButton,
    start: (supplemental = false) => context.runResearchProgressSession(progress, context.recoveredResearchProgressCallbacks(a.id, { supplemental })),
    select(value, { workspace = "workspace-a" } = {}) {
      context.activeWorkspaceID = workspace; context.projectID = value.primaryProjectID;
      context.state.researchConversationID = value.id; context.activeResearchConversation = value;
      context.researchQuestionDraft = "Unsent current Project question";
      store.set(value.id, value);
      context.researchConversationList = context.researchConversationList.map(c => c.id === value.id ? value : c);
    },
    delayRefresh() { refreshBarrier = deferred(); return refreshBarrier; }
  };
}

// Live regression: Saved can select B while conversation A remains visible.
// Refresh A's existing pane without invoking an open/navigation operation.
for (const outcome of ["success", "failure"]) {
  const t = harness(); const pending = t.start();
  t.context.projectID = "project-b";
  if (outcome === "success") t.requests[0].resolve({ conversation: {
    ...t.a, revision: 2, messages: [{ role: "assistant", answer: "Saved summary for A" }]
  } });
  else t.requests[0].reject(new Error("Synthetic interrupted response"));
  await pending;
  assert.deepEqual(t.refreshes, [{ mode: "utility", ids: [`research:conversation:${t.a.id}`] }],
    `${outcome}: the still-open conversation must refresh after selecting another Saved Project`);
  assert.deepEqual(t.opens, [], "Completion refresh must not navigate or fetch by reopening A");
  assert.equal(t.context.projectID, "project-b");
  assert.equal(t.context.state.researchConversationID, t.a.id);
  if (outcome === "success") {
    assert.equal(t.context.activeResearchConversation.messages[0].answer, "Saved summary for A");
    assert.deepEqual(t.consumerRefreshes, [{ ids: ["project-a"], refreshNotebookFoundation: true }],
      "Completion must update the answer's Notebook/Report Project even while Saved selects B");
  }
  else assert.equal(t.removed.length, 0, "Failure keeps the recoverable question");
}

// A completed request belongs to its conversation; it must not steal selection
// or erase the composer's draft after a same-account navigation.
for (const outcome of ["success", "failure"]) {
  const t = harness(); const pending = t.start(); t.select(t.b);
  if (outcome === "success") t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } });
  else t.requests[0].reject(Object.assign(new Error("Synthetic old-context failure"), {
    payload: { code: "RESEARCH_CONTEXT_CHANGED", conversation: { ...t.a, revision: 2 } }
  }));
  await pending;
  assert.equal(t.context.activeResearchConversation.id, t.b.id, `${outcome}: a late response must retain the current conversation`);
  assert.equal(t.context.state.researchConversationID, t.b.id);
  assert.equal(t.context.researchQuestionDraft, "Unsent current Project question");
  assert.deepEqual(t.opens, [], "Background completion cannot navigate the current workspace");
  assert.deepEqual(t.refreshes, [], "A different conversation must not be repainted by the old response");
  if (outcome === "success") assert.equal(t.context.researchProgressStatusLabel(t.progress), "Research complete");
}

// Even the same conversation ID can have a newer Project context, including an
// A -> B -> A move. Never replace it with a response committed before the move.
for (const project of ["project-b", "project-a"]) {
  const t = harness(); const pending = t.start();
  const current = conversation(t.a.id, project, 5, 2); t.select(current);
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.equal(t.context.activeResearchConversation, current);
  assert.equal(t.progress.status, "failed");
  assert.equal(t.progress.errorCode, "RESEARCH_CONTEXT_CHANGED");
  assert.equal(t.progress.question, "Synthetic saved Project summary");
  assert.equal(t.removed.length, 0, "Keep the question's recovery record until current-state review");
}

// Switching workspaces must preserve a draft even if Project/conversation IDs
// happen to match in the destination workspace.
{
  const t = harness(); const pending = t.start(); t.select(t.a, { workspace: "workspace-b" });
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.deepEqual(t.opens, []);
  assert.equal(t.context.researchQuestionDraft, "Unsent current Project question");
}

// A delayed 409 may itself describe an older state than the now-current one.
{
  const t = harness(); const pending = t.start();
  const current = conversation(t.a.id, "project-a", 7, 3); t.select(current);
  t.requests[0].reject(Object.assign(new Error("Review current Research"), {
    payload: { code: "RESEARCH_CONTEXT_CHANGED", conversation: conversation(t.a.id, "project-b", 5, 2) }
  }));
  await pending;
  assert.equal(t.context.activeResearchConversation, current, "A stale failure envelope cannot roll back current Project state");
  assert.equal(t.progress.errorCode, "RESEARCH_CONTEXT_CHANGED");
}

// Selection can change while a successful callback awaits consumer refreshes.
{
  const t = harness(); const barrier = t.delayRefresh(); const pending = t.start();
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } });
  await new Promise(resolve => setImmediate(resolve));
  t.select(t.b); barrier.resolve(); await pending;
  assert.deepEqual(t.opens, [], "A late refresh must not reopen the prior conversation");
  assert.equal(t.context.activeResearchConversation.id, t.b.id);
  assert.equal(t.context.researchQuestionDraft, "Unsent current Project question");
}

// Closing a supplemental pane does not authorize its pending request to reopen it.
{
  const t = harness(); t.context.supplementalResearchConversationIDs = [t.a.id];
  t.context.supplementalResearchConversations.set(t.a.id, t.a);
  const pending = t.start(true);
  t.context.supplementalResearchConversationIDs = [];
  t.context.supplementalResearchConversations.delete(t.a.id); t.select(t.b);
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.deepEqual(t.opens, []);
  assert.equal(t.context.supplementalResearchConversations.has(t.a.id), false);
}

// An open supplemental conversation also owns its completion independently of Saved.
{
  const t = harness(); t.context.supplementalResearchConversationIDs = [t.a.id];
  t.context.supplementalResearchConversations.set(t.a.id, t.a);
  const pending = t.start(true); t.select(t.b);
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.equal(t.context.supplementalResearchConversations.get(t.a.id).revision, 2);
  assert.equal(t.context.activeResearchConversation.id, t.b.id);
  assert.deepEqual(t.opens, []);
  assert.deepEqual(t.refreshes, [{ mode: "utility", ids: [`research:conversation:${t.a.id}`] }]);
}

// Selecting a Saved Project during consumer refresh must not strand the composer.
{
  const t = harness(); const barrier = t.delayRefresh(); const pending = t.start();
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } });
  await new Promise(resolve => setImmediate(resolve));
  t.context.projectID = "project-b"; barrier.resolve(); await pending;
  assert.equal(t.context.projectID, "project-b");
  assert.deepEqual(t.opens, []);
  assert.deepEqual(t.refreshes, [{ mode: "utility", ids: [`research:conversation:${t.a.id}`] }]);
}

// An account switch during consumer refresh cannot paint the previous identity.
{
  const t = harness(); const barrier = t.delayRefresh(); const pending = t.start();
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } });
  await new Promise(resolve => setImmediate(resolve));
  t.context.isCurrentAccountRequest = () => false;
  t.select(t.b); barrier.resolve(); await pending;
  assert.deepEqual(t.opens, []);
  assert.equal(t.context.activeResearchConversation.id, t.b.id);
}

// A closed primary pane retains its selected ID but must not reopen on completion.
{
  const t = harness(); const pending = t.start(); t.context.researchConversationPaneOpened = false;
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.deepEqual(t.opens, []); assert.deepEqual(t.refreshes, []);
}

// Ordinary current-context completion refreshes its existing saved-answer pane.
{
  const t = harness(); const pending = t.start();
  t.context.researchQuestionDraft = "A separate unsent follow-up";
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.equal(t.progress.status, "completed"); assert.deepEqual(t.opens, []);
  assert.deepEqual(t.refreshes, [{ mode: "utility", ids: [`research:conversation:${t.a.id}`] }]);
  assert.equal(t.removed.length, 1);
  assert.equal(t.context.researchQuestionDraft, "A separate unsent follow-up");
}
console.log("Research client context recovery passed: late success/failure, moved/A-B-A context, stale 409, navigation during refresh, closed supplemental pane and normal completion.");
