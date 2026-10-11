import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
function actual(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = app.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return app.slice(start, end + 2);
}
const topNavigation = shell.match(/<nav class="topbar-actions"[\s\S]*?<\/nav>/)[0];
assert.match(topNavigation,/data-workflow-view="research"[\s\S]*data-workflow-view="notebook"[\s\S]*id="toggle-report"/);
assert.doesNotMatch(topNavigation,/id="toggle-(?:saved|search|analysis|notebook)"/);
assert.match(shell,/data-workflow-tools="research"[\s\S]*id="toggle-search"[\s\S]*id="add-reader"[\s\S]*id="toggle-analysis"/);
assert.doesNotMatch(actual("renderSavedFolderContext"), /project-notebook-button|project-report-draft-button/);

function button() {
  return { attributes: {}, disabled: false, setAttribute(key, value) { this.attributes[key] = value; } };
}
let reportOpen = false;
let project = { id: "a", name: "Alpha" };
let allowed = true, privateAllowed = true, discard = true, heldOpen = null, requiresProject = false;
const capabilities = new Set(["projects", "notebook", "professional-exports"]);
const calls = [];
const contextButton = button(), factsButton = button(), notebookButton = button(), reportButton = button();
const state = { notebooks: [], reportDrafts: [], paneOrder: [], paneWeights: {} };
const c = vm.createContext({
  state, toggleContextButton: contextButton, toggleFactsButton: factsButton, toggleNotebookButton: notebookButton, toggleReportButton: reportButton,
  workspaceProject: () => project,
  workspacePrivatePresentationAllowed: () => privateAllowed,
  workspaceColumnsRequireProject: () => requiresProject,
  projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a.id === b.id,
  hasCapability: name => allowed && capabilities.has(name),
  openNotebooks: () => state.notebooks, openReportDrafts: () => state.reportDrafts,
  projectHasOpenNotebook: value => state.notebooks.some(item => item.id === value.id),
  projectHasOpenReportDraft: () => reportOpen,
  reportScreen: {get projectID(){return project?.id;},close(){reportOpen=false;}},
  paneIDForProjectNotebook: value => `notebook:${value.id}`,
  paneIDForProjectReportDraft: value => `report:${value.id}`,
  confirmNotebookDiscard: async () => discard, confirmReportDraftDiscard: async () => discard,
  syncProjectToolButtonStates: () => c.syncTopbarProjectToolStates(),
  async openProjectNotebook(value) { calls.push(["notebook", value.id]); state.notebooks.push(value); if (heldOpen) await heldOpen; return true; },
  async openProjectReportDraft(value) { calls.push(["report", value.id]); state.reportDrafts.push(value); reportOpen=true; return true; },
  saveWorkspaceState() {}, transitionWorkspace: async () => {},
  presentWorkspaceIssue: message => calls.push(["error", message])
});
vm.runInContext("let projectToolTogglePending = false;\n" + ["syncTopbarProjectToolStates", "toggleProjectTool", "closeProjectNotebook", "closeProjectReportDraft"].map(actual).join("\n"), c);

c.syncTopbarProjectToolStates();
assert.equal(contextButton.disabled, false);
assert.equal(contextButton.attributes["aria-pressed"], "false");
state.projectContextOpen = true;
c.syncTopbarProjectToolStates();
assert.equal(contextButton.attributes["aria-pressed"], "true");
assert.equal(contextButton.title, "Close Context · Alpha");
state.projectContextOpen = false;
c.syncTopbarProjectToolStates();
assert.equal(factsButton.disabled, false);
assert.equal(factsButton.attributes["aria-pressed"], "false");
state.projectFactsOpen = true;
c.syncTopbarProjectToolStates();
assert.equal(factsButton.attributes["aria-pressed"], "true");
assert.equal(factsButton.title, "Close Facts · Alpha");
state.projectFactsOpen = false;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, false);
assert.equal(reportButton.disabled, false);
await c.toggleProjectTool("notebook");
await c.toggleProjectTool("report");
assert.deepEqual(calls, [["notebook", "a"], ["report", "a"]]);
assert.equal(notebookButton.attributes["aria-pressed"], "true");
assert.equal(reportButton.attributes["aria-pressed"], "true");

// Top-menu closure and the column's own close action preserve discard decisions.
discard = false;
assert.equal(await c.toggleProjectTool("notebook"), false);
assert.equal(await c.toggleProjectTool("report"), true,"Returning from Report retains its unsaved editor");
assert.equal(state.notebooks.length, 1);
assert.equal(state.reportDrafts.length, 1);
assert.equal(notebookButton.attributes["aria-pressed"], "true");
assert.equal(notebookButton.disabled, false);
discard = true;
await c.closeProjectNotebook(project);
await c.closeProjectReportDraft(project);
assert.equal(notebookButton.attributes["aria-pressed"], "false");
assert.equal(reportButton.attributes["aria-pressed"], "false");

// Resolve the active Project on each click; never reuse the previous Saved owner.
project = { id: "b", name: "Beta" };
await c.toggleProjectTool("notebook");
assert.deepEqual(calls.at(-1), ["notebook", "b"]);
assert.equal(notebookButton.title, "Focus Notes · Beta");
await c.closeProjectNotebook(project);
let release;
heldOpen = new Promise(resolve => { release = resolve; });
const opening = c.toggleProjectTool("notebook");
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(factsButton.disabled, true);
assert.equal(contextButton.disabled, true);
assert.equal(await c.toggleProjectTool("notebook"), false, "Repeated clicks cannot create duplicate columns.");
release(); await opening; heldOpen = null;
assert.equal(state.notebooks.length, 1);
assert.equal(notebookButton.disabled, false);

project = null; c.syncTopbarProjectToolStates();
assert.equal(contextButton.disabled, true);
assert.equal(contextButton.attributes["aria-pressed"], "false");
assert.equal(factsButton.disabled, true);
assert.equal(factsButton.attributes["aria-pressed"], "false");
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(notebookButton.attributes["aria-pressed"], "false");
const before = calls.length;
assert.equal(await c.toggleProjectTool("report"), false);
assert.equal(calls.length, before);
requiresProject = true; c.syncTopbarProjectToolStates();
for (const [control, label] of [[contextButton, "Context"], [factsButton, "Facts"], [notebookButton, "Notes"], [reportButton, "Report"]]) {
  assert.equal(control.disabled, false, `${label} remains clickable to explain the Project requirement`);
  assert.equal(control.attributes["aria-pressed"], "false");
  assert.equal(control.title, `Create a Project first to open ${label}`);
}
assert.equal(await c.toggleProjectTool("report"), false);
assert.equal(calls.length, before, "Enabling the control cannot bypass Project ownership");
requiresProject = false;
project = { id: "a", name: "Alpha" }; allowed = false;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, true);
assert.equal(await c.toggleProjectTool("notebook"), false);
allowed = true; privateAllowed = false;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, true);
assert.equal(await c.toggleProjectTool("notebook"), false);
privateAllowed = true; project.sharedOnly = true;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, false);
assert.equal(reportButton.disabled, true);
assert.equal(factsButton.disabled, false, "Shared Projects can open their read-only Facts.");
assert.equal(contextButton.disabled, false, "Shared Projects can open their read-only Context.");
assert.equal(await c.toggleProjectTool("report"), false);

// Closing the Saved host only removes that column in a Project workspace.
let activeProject = { id: "a" }, deactivations = 0, permitDiscard = true;
const saved = { key: "saved", id: "saved-a" };
const search = { key: "search", id: "search-a" };
const savedState = {
  utilityInstances: [saved, search], projectHostPaneID: "saved-a",
  notebooks: [{ id: "a" }], reportDrafts: [{ id: "a" }], projectDetails: [{ id: "a" }],
  researchConversationID: "conversation-a", paneOrder: ["saved-a", "search-a"], paneWeights: {}
};
const savedContext = vm.createContext({
  state: savedState, workspaceProject: () => activeProject,
  paneIDForUtilityInstance: instance => instance.id,
  savedItemOpeningAttempts: new Map(), openProjectDetails: () => savedState.projectDetails,
  async deactivateProjectStudio() { deactivations++; return permitDiscard; },
  closeLinkedReaderForSavedPane() {}, closeSavedItemDetailsForPane() {},
  saveWorkspaceState() {}, transitionWorkspace: async () => {}
});
vm.runInContext(actual("closeUtilityInstance"), savedContext);
assert.equal(await savedContext.closeUtilityInstance(saved), true);
assert.equal(deactivations, 0);
assert.deepEqual(savedState.utilityInstances, [search]);
assert.equal(savedState.notebooks[0].id, "a");
assert.equal(savedState.reportDrafts[0].id, "a");
assert.equal(savedState.projectDetails[0].id, "a");
assert.equal(savedState.researchConversationID, "conversation-a");
assert.equal(savedState.projectHostPaneID, "");

// Retain the existing discard guard for a legacy, non-Project workspace.
activeProject = null; permitDiscard = false;
savedState.utilityInstances = [saved]; savedState.projectHostPaneID = saved.id;
assert.equal(await savedContext.closeUtilityInstance(saved), false);
assert.equal(deactivations, 1);
assert.deepEqual(savedState.utilityInstances, [saved]);
console.log("Project tool toolbar passed: active Project ownership, independent Saved closure, toggle state, discard cancellation, repeated clicks, access boundaries and legacy protection.");
