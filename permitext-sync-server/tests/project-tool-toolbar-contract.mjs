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
const tools = shell.match(/<nav class="workflow-toolbar"[\s\S]*?<\/nav>/)[0];
assert.match(tools,/data-workflow-tools="research"[\s\S]*id="toggle-notebook"[\s\S]*id="toggle-report"/);
assert.match(shell, /id="toggle-context"[^>]*data-pro-only[^>]*aria-label="Context"[^>]*data-workspace-icon="book-a"><\/button>\s*<button[^>]*id="toggle-settings"/,
  "The icon-only Context control sits immediately before Settings");
assert.match(shell,/data-workflow-tools="research"[\s\S]*id="add-reader"[\s\S]*id="toggle-search"[\s\S]*id="toggle-analysis"/);
assert.doesNotMatch(actual("renderSavedFolderContext"), /project-notebook-button|project-report-draft-button/);

function button() {
  return { attributes: {}, disabled: false, setAttribute(key, value) { this.attributes[key] = value; } };
}
let reportOpen = false, contextOpen = false;
let reducedMotion = false, pinnedColumn = null;
let project = { id: "a", name: "Alpha" };
let allowed = true, privateAllowed = true, discard = true, heldOpen = null, requiresProject = false;
const capabilities = new Set(["projects", "notebook", "professional-exports"]);
const calls = [];
const scrollRequests = [];
const reportColumn = {
  isConnected: true, hidden: false,
  getBoundingClientRect: () => ({left: 1500, right: 2500, width: 1000})
};
const track = {
  scrollLeft: 0, scrollWidth: 2500, clientWidth: 1400,
  querySelector: () => pinnedColumn,
  getBoundingClientRect: () => ({left: 0, right: 1400, width: 1400}),
  scrollTo: options => scrollRequests.push({...options})
};
const contextButton = button(), factsButton = button(), notebookButton = button(), reportButton = button();
const state = { notebooks: [], reportDrafts: [], paneOrder: [], paneWeights: {} };
const c = vm.createContext({
  state, toggleContextButton: contextButton, toggleFactsButton: factsButton, toggleNotebookButton: notebookButton, toggleReportButton: reportButton,
  toggleNotesListButton: button(),
  workspaceProject: () => project,
  workspacePrivatePresentationAllowed: () => privateAllowed,
  workspaceColumnsRequireProject: () => requiresProject,
  projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a.id === b.id,
  hasCapability: name => allowed && capabilities.has(name),
  openNotebooks: () => state.notebooks, openReportDrafts: () => state.reportDrafts,
  projectHasOpenNotebook: value => state.notebooks.some(item => item.id === value.id),
  projectHasOpenReportDraft: () => reportOpen,
  reportScreen: {element: reportColumn,get projectID(){return project?.id;},isOpen:()=>reportOpen,close(){reportOpen=false;}},
  projectDetailsScreen: {isOpen:()=>contextOpen},
  syncNotebookNoteTabs() {}, syncResearchNoteControls() {}, syncNotebookListControls() {},
  currentColumnWorkflowView: () => "research",
  paneIDForProjectNotebook: value => `notebook:${value.id}`,
  notebookPaneIDsForProject: value => [`notebook:${value.id}`], notebookColumnsForProject: () => [],
  selectedNotebookColumn: value => ({id: value.id}),
  notebookColumnPaneID: value => `notebook:${value.id}`,
  revealWorkspacePane: async id => { calls.push(["show", id]); return true; },
  paneIDForProjectReportDraft: value => `report:${value.id}`,
  confirmNotebookDiscard: async () => discard, confirmReportDraftDiscard: async () => discard,
  syncProjectToolButtonStates: () => c.syncTopbarProjectToolStates(),
  async openProjectNotebook(value) { calls.push(["notebook", value.id]); state.notebooks.push(value); if (heldOpen) await heldOpen; return true; },
  async openProjectReportDraft(value) { calls.push(["report", value.id]); state.reportDrafts.push(value); reportOpen=true; return true; },
  track, window: {matchMedia: query => ({matches: query.includes('reduced-motion') ? reducedMotion : true})},
  saveWorkspaceState() {}, transitionWorkspace: async () => {},
  presentWorkspaceIssue: message => calls.push(["error", message])
});
vm.runInContext("let projectToolTogglePending = false, workspaceColumnNavigationGeneration = 0, pendingWorkspacePaneRevealID = '';\n" +
  ["syncTopbarProjectToolStates", "openOrRevealProjectTool", "closeProjectNotebook", "closeProjectReportDraft",
    "revealReportColumn", "scrollWorkspaceColumnIntoView"].map(actual).join("\n"), c);

c.syncTopbarProjectToolStates();
assert.equal(contextButton.disabled, false);
assert.equal(contextButton.attributes["aria-expanded"], "false");
contextOpen = true;
c.syncTopbarProjectToolStates();
assert.equal(contextButton.attributes["aria-expanded"], "true");
assert.equal(contextButton.title, "Close Context · Alpha");
contextOpen = false;
c.syncTopbarProjectToolStates();
assert.equal(contextButton.attributes["aria-expanded"], "false");
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
await c.openOrRevealProjectTool("notebook");
await c.openOrRevealProjectTool("report");
assert.deepEqual(calls, [["notebook", "a"], ["report", "a"]]);
assert.equal(notebookButton.attributes["aria-pressed"], "true");
assert.equal(reportButton.attributes["aria-pressed"], "true");

// Repeated toolbar clicks reveal the retained columns. Explicit close honors discard decisions.
discard = false;
assert.equal(await c.openOrRevealProjectTool("notebook"), true);
assert.deepEqual(calls.at(-1), ["show", "notebook:a"]);
assert.equal(await c.openOrRevealProjectTool("report"), true);
assert.deepEqual(scrollRequests.at(-1), {left: 1100, behavior: "smooth"});
assert.equal(reportOpen, true);
assert.equal(state.notebooks.length, 1);
assert.equal(state.reportDrafts.length, 1);
assert.equal(notebookButton.attributes["aria-pressed"], "true");
assert.equal(notebookButton.disabled, false);
assert.equal(notebookButton.title, "Show Notes · Alpha");
assert.equal(reportButton.title, "Show Report · Alpha");
reducedMotion = true;
await c.openOrRevealProjectTool("report");
assert.deepEqual(scrollRequests.at(-1), {left: 1100, behavior: "instant"});
reducedMotion = false;
pinnedColumn = {getBoundingClientRect: () => ({width: 400})};
track.scrollLeft = 500;
c.scrollWorkspaceColumnIntoView({getBoundingClientRect: () => ({left: 100, right: 700, width: 600})});
assert.deepEqual(scrollRequests.at(-1), {left: 200, behavior: "smooth"}, "A left-hand destination clears the pinned column");
track.scrollWidth = 3100;
c.scrollWorkspaceColumnIntoView({getBoundingClientRect: () => ({left: 550, right: 2200, width: 1650})});
assert.deepEqual(scrollRequests.at(-1), {left: 650, behavior: "smooth"}, "For a wide column, show its leading edge");
pinnedColumn = null;
assert.equal(await c.closeProjectNotebook(project), false);
discard = true;
await c.closeProjectNotebook(project);
await c.closeProjectReportDraft(project);
assert.equal(notebookButton.attributes["aria-pressed"], "false");
assert.equal(reportButton.attributes["aria-pressed"], "false");

// Resolve the active Project on each click; never reuse the previous Saved owner.
project = { id: "b", name: "Beta" };
await c.openOrRevealProjectTool("notebook");
assert.deepEqual(calls.at(-1), ["notebook", "b"]);
assert.equal(notebookButton.title, "Show Notes · Beta");
await c.closeProjectNotebook(project);
let release;
heldOpen = new Promise(resolve => { release = resolve; });
const opening = c.openOrRevealProjectTool("notebook");
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(factsButton.disabled, true);
assert.equal(contextButton.disabled, true);
assert.equal(await c.openOrRevealProjectTool("notebook"), false, "Repeated clicks cannot create duplicate columns.");
release(); await opening; heldOpen = null;
assert.equal(state.notebooks.length, 1);
assert.equal(notebookButton.disabled, false);

project = null; c.syncTopbarProjectToolStates();
assert.equal(contextButton.disabled, true);
assert.equal(contextButton.attributes["aria-expanded"], "false");
assert.equal(factsButton.disabled, true);
assert.equal(factsButton.attributes["aria-pressed"], "false");
assert.equal(notebookButton.disabled, true);
assert.equal(reportButton.disabled, true);
assert.equal(notebookButton.attributes["aria-pressed"], "false");
const before = calls.length;
assert.equal(await c.openOrRevealProjectTool("report"), false);
assert.equal(calls.length, before);
requiresProject = true; c.syncTopbarProjectToolStates();
assert.equal(contextButton.disabled, true, "Context requires a selected workspace");
for (const [control, label] of [[factsButton, "Facts"], [notebookButton, "Notes"], [reportButton, "Report"]]) {
  assert.equal(control.disabled, false, `${label} remains clickable to explain the Project requirement`);
  assert.equal(control.attributes["aria-pressed"], "false");
  assert.equal(control.title, `Choose a workspace first to open ${label}`);
}
assert.equal(await c.openOrRevealProjectTool("report"), false);
assert.equal(calls.length, before, "Enabling the control cannot bypass Project ownership");
requiresProject = false;
project = { id: "a", name: "Alpha" }; allowed = false;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, true);
assert.equal(await c.openOrRevealProjectTool("notebook"), false);
allowed = true; privateAllowed = false;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, true);
assert.equal(await c.openOrRevealProjectTool("notebook"), false);
privateAllowed = true; project.sharedOnly = true;
c.syncTopbarProjectToolStates();
assert.equal(notebookButton.disabled, false);
assert.equal(reportButton.disabled, true);
assert.equal(factsButton.disabled, false, "Shared Projects can open their read-only Facts.");
assert.equal(contextButton.disabled, false, "Shared Projects can open their read-only Context.");
assert.equal(await c.openOrRevealProjectTool("report"), false);

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
  currentColumnWorkflowView: () => 'research',
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
