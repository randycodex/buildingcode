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
const menuIDs = ["toggle-saved", "add-reader", "toggle-search", "toggle-analysis", "toggle-notebook", "toggle-report"];
assert.deepEqual(menuIDs.map(id => shell.indexOf(`id="${id}"`)).slice().sort((a, b) => a - b), menuIDs.map(id => shell.indexOf(`id="${id}"`)));
assert.doesNotMatch(actual("renderSavedFolderContext"), /project-notebook-button|project-report-draft-button/);

function button() {
  return { attributes: {}, disabled: false, setAttribute(key, value) { this.attributes[key] = value; } };
}
let project = { id: "a", name: "Alpha" };
let allowed = true, privateAllowed = true, discard = true, heldOpen = null;
const capabilities = new Set(["notebook", "professional-exports"]);
const calls = [];
const notebookButton = button(), reportButton = button();
const state = { notebooks: [], reportDrafts: [], paneOrder: [], paneWeights: {} };
const c = vm.createContext({
  state, toggleNotebookButton: notebookButton, toggleReportButton: reportButton,
  workspaceProject: () => project,
  workspacePrivatePresentationAllowed: () => privateAllowed,
  projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a.id === b.id,
  hasCapability: name => allowed && capabilities.has(name),
  openNotebooks: () => state.notebooks, openReportDrafts: () => state.reportDrafts,
  projectHasOpenNotebook: value => state.notebooks.some(item => item.id === value.id),
  projectHasOpenReportDraft: value => state.reportDrafts.some(item => item.id === value.id),
  paneIDForProjectNotebook: value => `notebook:${value.id}`,
  paneIDForProjectReportDraft: value => `report:${value.id}`,
  confirmNotebookDiscard: async () => discard, confirmReportDraftDiscard: async () => discard,
  syncProjectToolButtonStates: () => c.syncTopbarProjectToolStates(),
  async openProjectNotebook(value) { calls.push(["notebook", value.id]); state.notebooks.push(value); if (heldOpen) await heldOpen; return true; },
  async openProjectReportDraft(value) { calls.push(["report", value.id]); state.reportDrafts.push(value); return true; },
  saveWorkspaceState() {}, transitionWorkspace: async () => {},
  presentWorkspaceIssue: message => calls.push(["error", message])
});
vm.runInContext("let projectToolTogglePending = false;\n" + ["syncTopbarProjectToolStates", "toggleProjectTool", "closeProjectNotebook", "closeProjectReportDraft"].map(actual).join("\n"), c);

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
assert.equal(await c.toggleProjectTool("report"), false);
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
assert.equal(notebookButton.title, "Close Notebook · Beta");
await c.closeProjectNotebook(project);
let release;
heldOpen = new Promise(resolve => { release = resolve; });
const opening = c.toggleProjectTool("notebook");
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(await c.toggleProjectTool("notebook"), false, "Repeated clicks cannot create duplicate columns.");
release(); await opening; heldOpen = null;
assert.equal(state.notebooks.length, 1);
assert.equal(notebookButton.disabled, false);

project = null; c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(notebookButton.attributes["aria-pressed"], "false");
const before = calls.length;
assert.equal(await c.toggleProjectTool("report"), false);
assert.equal(calls.length, before);
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
