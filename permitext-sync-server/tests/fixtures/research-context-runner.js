import { researchProgressStages, researchProgressStage, writeResearchRequestRecovery, readResearchRequestRecovery,
  removeResearchRequestRecovery, clearResearchRequestRecoveries } from "/web/research-progress.js";

const fixtureKey = "synthetic-context-fixture";
const accountID = "synthetic-context-owner";
const makeConversation = (id, project, revision = 1, contextRevision = 0) => ({
  id, primaryProjectID: project, revision, contextRevision, sources: [], messages: []
});
const a = makeConversation("conversation-a", "Project A");
let saved = JSON.parse(localStorage.getItem(fixtureKey) || "null") || { current: a, authoritative: a, draft: "", requests: [] };
const state = { researchConversationID: saved.current.id };
let activeWorkspaceID = "synthetic-workspace";
let activeResearchConversation = saved.current;
let researchConversationList = [saved.authoritative];
let researchQuestionDraft = saved.draft;
let researchUsage = null;
const supplementalResearchConversations = new Map();
const supplementalResearchConversationIDs = [];
const activeResearchProgress = new Map();
const captureAccountRequest = () => 1;
const isCurrentAccountRequest = identity => identity === 1;
const requireCurrentAccountRequest = identity => { if (identity !== 1) throw new Error("Synthetic account changed"); };
const activeAccount = () => ({ userID: accountID });
const activeProjectIDForCodeQuestions = () => saved.current.primaryProjectID;
const hasAvailableWebResearchTurnPack = () => false;
const researchFailureMessage = error => error.message;
let pending = null;
let progress = restoreResearchProgressSession(saved.authoritative);
function persistFixture() { localStorage.setItem(fixtureKey, JSON.stringify(saved)); }
function renderCurrent() {
  document.querySelector("#current-heading").textContent = activeResearchConversation.primaryProjectID;
  document.querySelector("#current").textContent = JSON.stringify({
    selectedConversation: state.researchConversationID, displayedProject: activeResearchConversation.primaryProjectID,
    displayedContextRevision: activeResearchConversation.contextRevision, authoritativeProject: saved.authoritative.primaryProjectID,
    authoritativeContextRevision: saved.authoritative.contextRevision, draft: researchQuestionDraft
  }, null, 2);
  document.querySelector(".research-question-input").value = researchQuestionDraft;
  document.querySelector("#question").textContent = progress ? `Preserved question: ${progress.question}` : "No pending question";
  document.querySelector("#receipt").textContent = JSON.stringify({
    syntheticTransportCalls: saved.requests.length, requestIDs: saved.requests.map(value => value.requestID),
    questionUnchanged: saved.requests.every(value => value.question === "Summarize the saved Project structured facts and address."),
    recoveryStored: Boolean(readResearchRequestRecovery(localStorage, {accountUserID:accountID,workspaceID:activeWorkspaceID,conversationID:"conversation-a"})),
    progressStatus: progress?.status || "none", errorCode: progress?.errorCode || "", externalProviderCalls: 0
  }, null, 2);
}
function renderProgress() {
  const host = document.querySelector("#progress"); host.replaceChildren();
  if (progress) host.append(renderResearchProgressCard(progress));
  renderCurrent();
}
async function refreshProjectSourceConsumers() { renderCurrent(); }
async function refreshResearchConversationList() { researchConversationList = [saved.authoritative]; }
async function openResearchConversation(id) {
  if (document.querySelector("#fail-review").checked) throw new Error("Synthetic current-state reload failure");
  if (id !== saved.authoritative.id) throw new Error("Synthetic conversation is no longer current");
  state.researchConversationID = id; activeResearchConversation = saved.authoritative;
  saved.current = saved.authoritative; persistFixture(); renderCurrent(); return saved.authoritative;
}
const openSupplementalResearchConversation = openResearchConversation;
function postResearchWithProgress(body) {
  saved.requests.push(body); persistFixture(); renderCurrent();
  if (saved.requests.length > 1) {
    saved.authoritative = { ...saved.authoritative, revision: saved.authoritative.revision + 1 };
    saved.current = saved.authoritative; persistFixture();
    return Promise.resolve({ conversation: saved.authoritative });
  }
  return new Promise((resolve, reject) => { pending = { resolve, reject }; });
}
function wireRetry() {
  if (progress) progress.retry = () => void runResearchProgressSession(progress,
    recoveredResearchProgressCallbacks(progress.conversationID), { retrying: true }).finally(renderProgress);
}
document.querySelector("#start").addEventListener("click", () => {
  clearInterval(progress?.timer);
  clearResearchRequestRecoveries(localStorage, { accountUserID: accountID });
  saved = { current: a, authoritative: a, draft: "", requests: [] };
  state.researchConversationID = a.id; activeResearchConversation = a;
  researchConversationList = [a]; researchQuestionDraft = "";
  activeResearchProgress.clear(); persistFixture();
  progress = createResearchProgressSession(a.id, "Summarize the saved Project structured facts and address.");
  renderProgress();
  void runResearchProgressSession(progress, recoveredResearchProgressCallbacks(a.id)).finally(renderProgress);
});
function changeProject(move) {
  saved.current = makeConversation(move ? a.id : "conversation-b", "Project B", 5, move ? 2 : 0);
  saved.authoritative = saved.current; saved.draft = "Unsent current Project question";
  state.researchConversationID = saved.current.id; activeResearchConversation = saved.current;
  researchConversationList = [saved.current]; researchQuestionDraft = saved.draft;
  persistFixture(); renderCurrent();
}
document.querySelector("#switch").addEventListener("click", () => changeProject(false));
document.querySelector("#move").addEventListener("click", () => changeProject(true));
document.querySelector("#success").addEventListener("click", () => pending?.resolve({ conversation: { ...a, revision: 2 } }));
document.querySelector("#failure").addEventListener("click", () => pending?.reject(Object.assign(new Error("Review the changed Project context."), {
  payload: { code: "RESEARCH_CONTEXT_CHANGED", status: 409, conversation: { ...a, revision: 2 } }
})));
document.querySelector("#reload").addEventListener("click", () => location.reload());
document.querySelector("#cleanup").addEventListener("click", () => {
  clearInterval(progress?.timer); clearResearchRequestRecoveries(localStorage, { accountUserID: accountID });
  localStorage.removeItem(fixtureKey); document.querySelector("#receipt").textContent = "Synthetic fixture storage cleaned.";
});
document.querySelector(".research-question-input").addEventListener("input", event => {
  researchQuestionDraft = event.target.value; saved.draft = researchQuestionDraft; persistFixture(); renderCurrent();
});
wireRetry(); renderProgress();
