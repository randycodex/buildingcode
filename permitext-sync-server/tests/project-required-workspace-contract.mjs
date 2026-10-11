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
let layoutClears = 0, accountOpens = 0;
const retainedEvidence = { id: "saved", sectionID: 2416 };
const state = { ...emptyWorkspaceLayout(), localSavedItems: [retainedEvidence], localProjects: [] };
const sandbox = vm.createContext({
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
  supplementalResearchConversationIDs: [], emptyWorkspaceLayout,
  applyStoredWorkspaceLayout: (layout) => { Object.assign(state, layout); layoutClears++; },
  codeQuestionWorkspaceState: () => ({}), closeCodeDecisionContext: (s) => s, setCodeQuestionWorkspaceState() {},
  document: { querySelector: () => null },
  toggleAccountDialog: () => { accountOpens++; }
});
for (const name of ["workspaceColumnsRequireProject", "enforceProjectRequiredWorkspace", "defaultActivePaneIDs",
  "workspacePaneDescriptors", "toggleUtilityPane", "focusUtility", "openNewResearchColumn",
  "focusRecentUtilityColumn", "openDeepLinkedSectionInReader", "openSourceInReader", "workspaceCommandDefinitions"])
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
