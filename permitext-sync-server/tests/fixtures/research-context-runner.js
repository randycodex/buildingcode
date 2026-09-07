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
const activeProjectIDForCodeQuestions = () => saved.selectedProject || saved.current.primaryProjectID;
const researchConversationPaneIsOpen = () => true;
const paneIDForResearchConversation = id => `research:conversation:${id}`;
const hasCapability = () => true;
const researchChatPlaceholder = "Ask a follow-up question";
const researchProjectContextPreview = conversationProject => {
  const node = document.createElement("p"); node.textContent = `Conversation facts: ${conversationProject}`; return node;
};
const researchComposerDisclosure = () => document.createElement("p");
const bindResearchSendShortcut = () => {};
const ensureResearchDisclosureAcknowledged = async () => true;
const hasAvailableWebResearchTurnPack = () => false;
const researchFailureMessage = error => error.message;
let pending = null;
let progress = restoreResearchProgressSession(saved.authoritative);
function persistFixture() { localStorage.setItem(fixtureKey, JSON.stringify(saved)); }
function renderCurrent() {
  document.querySelector("#current-heading").textContent = activeResearchConversation.primaryProjectID;
  document.querySelector("#current").textContent = JSON.stringify({
    selectedProject: activeProjectIDForCodeQuestions(), selectedConversation: state.researchConversationID, displayedProject: activeResearchConversation.primaryProjectID,
    displayedContextRevision: activeResearchConversation.contextRevision, authoritativeProject: saved.authoritative.primaryProjectID,
    authoritativeContextRevision: saved.authoritative.contextRevision, draft: researchQuestionDraft
  }, null, 2);
  document.querySelector("#question").textContent = progress ? `Preserved question: ${progress.question}` : "No pending question";
  document.querySelector("#receipt").textContent = JSON.stringify({
    syntheticTransportCalls: saved.requests.length, requestIDs: saved.requests.map(value => value.requestID),
    questionUnchanged: saved.requests.every(value => value.question === "Summarize the saved Project structured facts and address."),
    recoveryStored: Boolean(readResearchRequestRecovery(localStorage, {accountUserID:accountID,workspaceID:activeWorkspaceID,conversationID:"conversation-a"})),
    progressStatus: progress?.status || "none", errorCode: progress?.errorCode || "", externalProviderCalls: 0
  }, null, 2);
}
function renderConversationPane() {
  const thread = document.createElement("section");
  thread.id = `research-dialogue-${activeResearchConversation.id}`;
  for (const message of activeResearchConversation.messages) {
    const node = document.createElement("p"); node.textContent = message.answer || message.question; thread.append(node);
  }
  const composer = renderFixtureComposer(activeResearchConversation, activeResearchProgress.get(activeResearchConversation.id), thread);
  composer.querySelector("textarea").setAttribute("aria-label", "Current draft");
  composer.addEventListener("input", () => { saved.draft = researchQuestionDraft; persistFixture(); renderCurrent(); });
  document.querySelector("#composer").replaceChildren(thread, composer);
}
async function transitionWorkspace(mode, { refreshPaneIDs }) {
  if (mode !== "utility" || !refreshPaneIDs.includes(paneIDForResearchConversation(state.researchConversationID))) {
    throw new Error("Unexpected fixture pane transition");
  }
  saved.current = activeResearchConversation; persistFixture(); renderConversationPane(); renderCurrent();
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
  saved.current = saved.authoritative; persistFixture(); renderConversationPane(); renderCurrent(); return saved.authoritative;
}
const openSupplementalResearchConversation = openResearchConversation;
function postResearchWithProgress(body) {
  saved.requests.push(body); persistFixture(); renderCurrent();
  if (saved.requests.length > 1) {
    saved.authoritative = { ...saved.authoritative, revision: saved.authoritative.revision + 1,
      messages: [{ role: "assistant", answer: "Saved summary for the reviewed Project" }] };
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
  renderConversationPane();
  renderProgress();
  void runResearchProgressSession(progress, recoveredResearchProgressCallbacks(a.id)).finally(renderProgress);
});
function changeProject(move) {
  saved.current = makeConversation(move ? a.id : "conversation-b", "Project B", 5, move ? 2 : 0);
  saved.authoritative = saved.current; saved.draft = "Unsent current Project question";
  state.researchConversationID = saved.current.id; activeResearchConversation = saved.current;
  researchConversationList = [saved.current]; researchQuestionDraft = saved.draft;
  persistFixture(); renderConversationPane(); renderCurrent();
}
document.querySelector("#switch").addEventListener("click", () => changeProject(false));
document.querySelector("#project").addEventListener("click", () => {
  saved.selectedProject = "Project B"; persistFixture(); renderCurrent();
});
document.querySelector("#move").addEventListener("click", () => changeProject(true));
document.querySelector("#success").addEventListener("click", () => {
  const result = { ...a, revision: 2, messages: [{ role: "assistant", answer: "Saved summary for Project A" }] };
  if (saved.authoritative.id === a.id && saved.authoritative.contextRevision === a.contextRevision) saved.authoritative = result;
  pending?.resolve({ conversation: result });
});
document.querySelector("#failure").addEventListener("click", () => pending?.reject(Object.assign(new Error("Review the changed Project context."), {
  payload: { code: "RESEARCH_CONTEXT_CHANGED", status: 409, conversation: { ...a, revision: 2 } }
})));
document.querySelector("#reload").addEventListener("click", () => location.reload());
document.querySelector("#cleanup").addEventListener("click", () => {
  clearInterval(progress?.timer); clearResearchRequestRecoveries(localStorage, { accountUserID: accountID });
  localStorage.removeItem(fixtureKey); document.querySelector("#receipt").textContent = "Synthetic fixture storage cleaned.";
});
wireRetry(); renderConversationPane(); renderProgress();
