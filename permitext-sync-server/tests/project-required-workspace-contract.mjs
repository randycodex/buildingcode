import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { emptyWorkspaceLayout } from "../public/workspace-state.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const actual = (name) => {
  const source = app.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`, "m"))?.[0];
  assert.ok(source, `Missing ${name}`);
  return source;
};
let account = { userID: "owner" }, capability = true, projects = [], overlays = [], shared = [];
let layoutClears = 0, accountOpens = 0, projectCreates = 0, columnAttempts = 0;
let inlineMessage;
let timerID = 0;
const timers = new Map();
const retainedEvidence = { id: "saved", sectionID: 2416 };
const state = { ...emptyWorkspaceLayout(), localSavedItems: [retainedEvidence], localProjects: [] };
const sandbox = vm.createContext({
  setTimeout: (callback, delay) => { timers.set(++timerID, { callback, delay }); return timerID; },
  clearTimeout: (id) => timers.delete(id),
  state, syncedContent: { userID: "owner", workspacePresentationAccess: "verified", get summary() { return { projects }; } },
  activeAccount: () => account, hasCapability: () => capability,
  currentContentSummary: () => ({ projects }),
  mergeProjectsWithOrganizationAccess: (records) => [...records, ...shared],
  activeFolderRecords: (records) => {
    const merged = new Map(records.map((p) => [p.id, p]));
    overlays.forEach((p) => merged.set(p.id, p));
    return [...merged.values()].filter((p) => !p.deletedAt && !p.archivedAt);
  },
  folderIsProject: (p) => p.folderType === "project",
  openProjectDetails: () => state.projectDetails, openCodeQuestionPaneIDs: () => [],
  restoreAssistantConversationOwners() {},
  supplementalResearchConversationIDs: [], emptyWorkspaceLayout,
  applyStoredWorkspaceLayout: (layout) => { Object.assign(state, layout); layoutClears++; },
  codeQuestionWorkspaceState: () => ({}), closeCodeDecisionContext: (s) => s, setCodeQuestionWorkspaceState() {},
  document: { querySelector: () => null, createElement: () => ({ ...toolbarButton(), children: [],
    append(...nodes) { this.children.push(...nodes); } }) },
  toggleAccountDialog: () => { accountOpens++; },
  createNewWorkspace: () => { projectCreates++; },
  presentWorkspaceIssue: () => assert.fail("Project guidance belongs below the central button, not in a banner")
});
vm.runInContext("let projectRequiredColumnNoticeVisible = false; let projectRequiredColumnNoticeTimer = null;", sandbox);
for (const name of ["workspaceColumnsRequireProject", "notifyProjectRequiredForColumn", "enforceProjectRequiredWorkspace", "defaultActivePaneIDs",
  "workspacePaneDescriptors", "toggleUtilityPane", "focusUtility", "openNewResearchColumn",
  "focusRecentUtilityColumn", "openDeepLinkedSectionInReader", "openSourceInReader", "workspaceCommandDefinitions", "renderProjectRequiredWorkspace"])
  vm.runInContext(actual(name), sandbox);

const requiresProject = () => sandbox.workspaceColumnsRequireProject();
assert.equal(requiresProject(), true, "Verified empty Pro workspace requires a Project");
projects = [{ id: "reference", folderType: "reference" }];
assert.equal(requiresProject(), true, "Reference collections do not unlock a project workspace");
projects = [{ id: "project", folderType: "project" }];
assert.equal(requiresProject(), false);
overlays = [{ ...projects[0], deletedAt: "2026-10-10" }];
assert.equal(requiresProject(), true, "Pending local deletion of the last Project applies immediately");
overlays = [{ ...projects[0], archivedAt: "2026-10-10" }];
assert.equal(requiresProject(), true, "Archived Projects cannot unlock columns");
projects = []; overlays = [];
shared = [{ id: "team", folderType: "project" }];
assert.equal(requiresProject(), false, "Accessible shared Projects count");
shared = [];
for (const authority of ["unavailable", "pending", undefined]) {
  sandbox.syncedContent.workspacePresentationAccess = authority;
  assert.equal(requiresProject(), false, "An unverified snapshot must not clear layouts");
}
sandbox.syncedContent.workspacePresentationAccess = "permitted-offline";
assert.equal(requiresProject(), true, "An authorized offline snapshot also enforces the requirement");
sandbox.syncedContent.userID = "other";
assert.equal(requiresProject(), false, "Another account's cached data cannot clear this workspace");
sandbox.syncedContent.userID = "owner";
account = null;
assert.equal(requiresProject(), false, "Anonymous public browsing stays available");
account = { userID: "owner" }; capability = false;
assert.equal(requiresProject(), false, "Free readers are not trapped behind Pro project creation");
capability = true;

// Exercise the actual top-menu listeners, including Reader, rather than just
// calling the lower-level layout guards. Every blocked click must explain why.
function toolbarButton() {
  const listeners = new Map();
  const span = { textContent: "" };
  return { dataset: {}, disabled: true, hidden: false, attributes: {},
    classList: { toggle() {} }, querySelector: () => span,
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    click: () => listeners.get("click")() };
}
const buttons = Object.fromEntries(["toggleContextButton", "toggleFactsButton", "toggleNotebookButton", "toggleReportButton",
  "toggleSearchButton", "toggleAnalysisButton", "toggleSavedButton", "addReaderButton"].map(name => [name, toolbarButton()]));
Object.assign(sandbox, buttons, {
  track: { dataset: { utilityFocusBound: "true" }, querySelector: () => inlineMessage }, releaseSurfaceVisibility: { workboard: false },
  toggleArchiveButton: null, toggleWorkboardButton: null, toggleSettingsButton: toolbarButton(), collapseReadersButton: toolbarButton(),
  genericWorkboardIsOpen: () => false, syncTopbarProjectToolStates() {}, isProAccount: () => true,
  updateWorkspaceLayoutControls() {},
  toggleProjectInformation: () => { columnAttempts++; }, toggleProjectTool: () => { columnAttempts++; },
  toggleProjectsColumns: () => { columnAttempts++; }, openReaderCodePicker: () => { columnAttempts++; }
});
sandbox.document.querySelectorAll = (selector) => selector === "[data-open-reader]" ? [buttons.addReaderButton] : [];
vm.runInContext(["bindImmediateUtilityControls", "setUtilityButtonStates", "updateReaderPlanControls",
  "syncReaderToolbarButton", "bindReaderToolbarButton", "openReaderFromToolbar"].map(actual).join("\n"), sandbox);
assert.match(app, /document\.querySelectorAll\('\[data-open-reader\]'\)\.forEach\(bindReaderToolbarButton\)/,
  "Startup binds every Reader toolbar through the shared opening guard");
sandbox.bindReaderToolbarButton(buttons.addReaderButton);
sandbox.bindImmediateUtilityControls();
sandbox.setUtilityButtonStates(); sandbox.updateReaderPlanControls();
const guidance = sandbox.renderProjectRequiredWorkspace();
const content = guidance.children[0];
const actions = content.children[0];
inlineMessage = content.children[1];
assert.equal(actions.children.length, 1, "Keep only the original Create Project button");
assert.equal(actions.children[0].textContent, "Create Project");
assert.equal(inlineMessage.hidden, true, "The message appears only after a blocked column click");
assert.equal(inlineMessage.attributes.role, "alert");
const emptyLayout = JSON.stringify(state);
for (const [name, control] of Object.entries(buttons)) {
  if (["toggleSearchButton", "toggleAnalysisButton", "toggleSavedButton", "addReaderButton"].includes(name))
    assert.equal(control.disabled, false, `${name} can receive a click`);
  inlineMessage.hidden = true;
  await control.click();
  assert.equal(inlineMessage.hidden, false, `${name} reveals the message below Create Project`);
  assert.match(inlineMessage.textContent, /Create a Project first/);
}
assert.equal(columnAttempts, 0);
assert.equal(projectCreates, 0, "A column click must not create a Project automatically");
assert.equal(JSON.stringify(state), emptyLayout, "No column opens while showing the message");
assert.equal(sandbox.renderProjectRequiredWorkspace().children[0].children[1].hidden, false, "A background render preserves the visible message");
assert.equal(timers.size, 1, "Repeated clicks restart the message timeout");
const [noticeTimerID, noticeTimer] = [...timers][0];
assert.equal(noticeTimer.delay, 4000);
// A background render can replace the message before its timeout expires.
inlineMessage = sandbox.renderProjectRequiredWorkspace().children[0].children[1];
timers.delete(noticeTimerID); noticeTimer.callback();
assert.equal(inlineMessage.hidden, true, "The message disappears after four seconds, even after a render");
assert.equal(sandbox.renderProjectRequiredWorkspace().children[0].children[1].hidden, true, "Expired guidance stays hidden after rendering");
await buttons.toggleFactsButton.click();
assert.equal(inlineMessage.hidden, false, "A later column click shows the message again");
await actions.children[0].click();
assert.equal(projectCreates, 1, "The original button uses the existing Project creation flow");
for (const publicAccount of [null, { userID: "owner" }]) {
  account = publicAccount; capability = false;
  inlineMessage.hidden = true;
  assert.equal(sandbox.notifyProjectRequiredForColumn(), false);
  assert.equal(inlineMessage.hidden, true, "Public browsing does not receive a Pro Project requirement");
}
account = { userID: "owner" }; capability = true;

state.readers = [{ id: "reader" }];
state.utilityInstances = [{ key: "saved", id: "evidence" }, { key: "search", id: "search" }];
state.utilities.analysis = true;
state.projectDetails = [{ id: "deleted-project" }];
assert.equal(sandbox.enforceProjectRequiredWorkspace(), true);
assert.equal(layoutClears, 1);
assert.equal(state.readers.length, 0);
assert.equal(state.utilityInstances.length, 0);
assert.equal(state.projectDetails.length, 0);
assert.equal(state.localSavedItems[0], retainedEvidence, "Closing the layout preserves recoverable account data");
sandbox.enforceProjectRequiredWorkspace();
assert.equal(layoutClears, 1, "Already empty layouts are not cleared repeatedly");

// Restored layouts and commands must not bypass the render or opening boundary.
state.readers = [{ id: "restored-reader" }];
const before = JSON.stringify(state);
assert.equal(sandbox.defaultActivePaneIDs().length, 0);
assert.equal(sandbox.workspacePaneDescriptors().length, 0);
for (const key of ["saved", "search", "analysis", "archive", "workboard"]) {
  await sandbox.toggleUtilityPane(key);
  await sandbox.focusUtility(key);
  await sandbox.focusRecentUtilityColumn(key);
}
await sandbox.openNewResearchColumn();
await sandbox.openDeepLinkedSectionInReader({ sectionID: 2416 });
assert.equal(await sandbox.openSourceInReader({ sectionID: 2416 }), null);
assert.equal(JSON.stringify(state), before, "Blocked opening paths cannot mutate the layout");
assert.deepEqual(Array.from(sandbox.workspaceCommandDefinitions(), (command) => command.label), ["Create Project", "Open Account"]);
await sandbox.toggleUtilityPane("settings");
await sandbox.focusUtility("settings");
assert.equal(accountOpens, 2, "Account remains accessible for Trash recovery");
projects = [{ id: "new-project", folderType: "project" }];
assert.equal(requiresProject(), false, "Creating or restoring a Project unlocks columns");
assert.equal(sandbox.enforceProjectRequiredWorkspace(), false);
assert.equal(timers.size, 0, "Opening a Project cancels pending guidance dismissal");
assert.equal(sandbox.renderProjectRequiredWorkspace().children[0].children[1].hidden, true, "Creating or restoring a Project resets the obsolete notice");

// Exercise the real deletion-to-render transition with a stale open layout.
state.readers = [{ id: "open-reader" }];
state.utilityInstances = [{ key: "search", id: "open-search" }];
Object.assign(sandbox, {
  detachedProjectWindow: false, workspaceRenderGeneration: 0,
  restoreResearchWorkspaceState() {}, workspaceAccessGateForRender: () => ({ allowed: true }),
  reconcileProjectWorkspaces() {}, workspacePaneRenderContext: () => ({}), enforceReaderPlanLimit() {},
  closeDeletedProjectDetails() {}, renderCodeQuestionShellChrome() {}, updateReaderPlanControls() {},
  renderWorkspaceTabs() {}, normalizePaneWeights() {}, activePaneIDs: () => sandbox.defaultActivePaneIDs(),
  setUtilityButtonStates() {}, saveWorkspaceState() {}, startProjectArtifactCheckpointLoop() {},
  document: { body: {}, querySelector: () => null }, track: { scrollLeft: 0 },
  captureAccountRequest: () => ({}), requireCurrentAccountRequest() {},
  projectRecordID: (p) => p.id, folderRecordCountLabel: () => "1 Project",
  confirmWebWarning: async () => true, prepareRecoverableDeletion: async () => {},
  deleteArchivedProjectData: async () => { projects = []; }, archivedProjectIDSet: () => new Set(),
  projectOverviewRefreshPaneIDs: () => [], showWebNotice: async () => assert.fail("Deletion must complete"),
  transitionWorkspace: async () => sandbox.renderUtilityWorkspace(),
  mountWorkspacePanesIndependently: async () => {
    assert.equal(sandbox.workspacePaneDescriptors().length, 0, "Deletion immediately removes every column descriptor");
    return true;
  }
});
vm.runInContext(actual("renderUtilityWorkspace") + actual("deleteArchivedProjects"), sandbox);
assert.equal(await sandbox.deleteArchivedProjects(projects), true);
assert.equal(state.readers.length, 0);
assert.equal(state.utilityInstances.length, 0);
assert.equal(requiresProject(), true);
assert.equal(state.localSavedItems[0], retainedEvidence);

for (const renderName of ["renderWorkspace", "renderUtilityWorkspace"]) {
  const render = actual(renderName);
  assert.ok(render.indexOf("reconcileProjectWorkspaces();") < render.indexOf("enforceProjectRequiredWorkspace();"));
  assert.ok(render.indexOf("enforceProjectRequiredWorkspace();") < render.indexOf("mountWorkspacePanesIndependently("));
}
console.log("Project-required workspace: deletion, offline authority, restoration, rendering, commands and recovery passed.");
