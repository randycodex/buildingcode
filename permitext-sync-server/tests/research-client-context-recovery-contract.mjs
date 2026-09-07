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
  const requests = [], opens = [], writes = [], removed = [];
  const store = new Map([[a.id, a], [b.id, b]]);
  let refreshBarrier = null;
  const context = vm.createContext({
    Map, Date, AbortController, localStorage: {}, clearInterval() {},
    document: { getElementById: () => null },
    state: { researchConversationID: a.id }, activeWorkspaceID: "workspace-a",
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
    async refreshProjectSourceConsumers() { if (refreshBarrier) await refreshBarrier.promise; },
    async refreshResearchConversationList() {},
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
  return { context, a, b, progress, requests, opens, writes, removed,
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

// Ordinary current-context completion still refreshes and opens its saved answer.
{
  const t = harness(); const pending = t.start();
  t.context.researchQuestionDraft = "A separate unsent follow-up";
  t.requests[0].resolve({ conversation: { ...t.a, revision: 2 } }); await pending;
  assert.equal(t.progress.status, "completed"); assert.deepEqual(t.opens, [t.a.id]);
  assert.equal(t.removed.length, 1);
  assert.equal(t.context.researchQuestionDraft, "A separate unsent follow-up");
}
console.log("Research client context recovery passed: late success/failure, moved/A-B-A context, stale 409, navigation during refresh, closed supplemental pane and normal completion.");
