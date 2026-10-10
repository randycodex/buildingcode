import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { emptyWorkspaceLayout, captureWorkspaceLayout, applyWorkspaceLayout, canGroupColumn } from "../public/workspace-state.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shell = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
function actual(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = app.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return app.slice(start, end + 2);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const copy = value => JSON.parse(JSON.stringify(value));
const alpha = { id: "alpha", name: "Alpha", description: "Original context", address: "Original address", structuredFacts: [] };
assert.match(shell, /id="toggle-saved"[^>]*aria-label="Evidence"/);
assert.doesNotMatch(actual("renderSavedFolderContext"), /appendSavedProjectFactEditor|saved-project-summary/);
assert.match(actual("openWorkspaceContextMenu"), /for \(const kind of \["context", "facts"\]\)/);

// Visibility is scoped to each Project layout; legacy layouts start closed.
assert.equal(emptyWorkspaceLayout().projectContextOpen, false);
assert.equal(emptyWorkspaceLayout().projectFactsOpen, false);
const layout = captureWorkspaceLayout({ ...emptyWorkspaceLayout(), projectDetails: [alpha],
  projectContextOpen: true, projectFactsOpen: true,
  paneOrder: ["project:context:alpha", "project:facts:alpha"],
  paneWeights: { "project:context:alpha": 670 }, collapsedPaneIDs: ["project:facts:alpha"] });
const restored = {};
applyWorkspaceLayout(restored, emptyWorkspaceLayout());
assert.equal(restored.projectContextOpen, false);
applyWorkspaceLayout(restored, layout);
assert.equal(restored.projectContextOpen, true);
assert.equal(restored.projectFactsOpen, true);
assert.equal(restored.paneWeights["project:context:alpha"], 670);
assert.ok(restored.collapsedPaneIDs.includes("project:facts:alpha"));
for (const kind of ["context", "facts"]) assert.equal(canGroupColumn(`project:${kind}:alpha`), false);

let current = alpha, allowed = true, privateAllowed = true, accountCurrent = true, activation = null;
let openDetails = [alpha];
const issues = [], mounts = new Map();
const state = { projectContextOpen: false, projectFactsOpen: false, paneWeights: {}, paneOrder: [] };
const c = vm.createContext({ state, activeWorkspaceID: "alpha-workspace", projectInformationMounts: mounts,
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => accountCurrent,
  workspaceProject: () => current, projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a?.id === b?.id,
  workspacePrivatePresentationAllowed: () => privateAllowed, hasCapability: () => allowed,
  openProjectDetails: () => openDetails,
  activateProjectStudio: async value => { if (activation) await activation.promise; openDetails = [value]; return true; },
  syncTopbarProjectToolStates() {}, saveWorkspaceState() {}, transitionWorkspace: async () => {},
  scrollPaneIntoView() {}, defaultNonReaderPaneWidth: 600,
  placeProjectToolPaneLast: (_project, id) => { state.paneOrder = [...state.paneOrder.filter(value => value !== id), id]; },
  presentWorkspaceIssue: value => issues.push(value)
});
vm.runInContext("let projectToolTogglePending = false;\n" + ["projectInformationStateKey", "paneIDForProjectInformation",
  "flushProjectInformationPanes", "closeProjectInformation", "toggleProjectInformation"].map(actual).join("\n"), c);
await c.toggleProjectInformation("context");
await c.toggleProjectInformation("facts");
assert.equal(state.projectContextOpen, true);
assert.equal(state.projectFactsOpen, true);
state.paneWeights["project:context:alpha"] = 670;
mounts.set("project:context:alpha", { panel: { isConnected: true }, flush: async () => { throw Error("Save failed"); } });
assert.equal(await c.closeProjectInformation(alpha, "context"), false);
assert.equal(state.projectContextOpen, true, "Failed save must keep the editor open.");
const held = deferred();
mounts.set("project:context:alpha", { panel: { isConnected: true }, flush: () => held.promise });
const close = c.closeProjectInformation(alpha, "context");
c.activeWorkspaceID = "beta-workspace";
held.resolve();
assert.equal(await close, false, "Late save must not hide another Project's column.");
c.activeWorkspaceID = "alpha-workspace";
assert.equal(await c.closeProjectInformation(alpha, "context"), true);
assert.equal(state.projectFactsOpen, true, "Closing Context preserves Facts.");
await c.toggleProjectInformation("context");
assert.equal(state.paneWeights["project:context:alpha"], 670, "Reopening preserves the user's width.");
allowed = false;
assert.equal(await c.toggleProjectInformation("facts"), false);
allowed = true; privateAllowed = false;
assert.equal(await c.toggleProjectInformation("facts"), false);
privateAllowed = true; current = null;
assert.equal(await c.toggleProjectInformation("facts"), false);
current = alpha; state.projectContextOpen = false; openDetails = []; activation = deferred();
const opening = c.toggleProjectInformation("context");
assert.equal(await c.toggleProjectInformation("context"), false, "Repeated clicks cannot start a second activation.");
accountCurrent = false; activation.resolve();
assert.equal(await opening, false);
assert.equal(state.projectContextOpen, false, "Stale activation must not open private content.");

// Execute the actual split editors: Context patches only description; Facts patches only fact fields.
function element(tag) {
  const e = { tag, children: [], attributes: {}, handlers: {}, value: "", isConnected: true,
    className: "", classList: { add() {}, remove() {} },
    append(...values) { values.forEach(value => { value.parent = this; this.children.push(value); }); },
    prepend(value) { value.parent = this; this.children.unshift(value); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(value => value !== this); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.handlers[type] = callback; },
    querySelector(selector) { return this.children.find(value => selector === `.${value.className}`) || null; }
  };
  return e;
}
function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) { const match = find(child, predicate); if (match) return match; }
}
let editorCurrent = true, failWrite = false;
const patches = [];
const e = vm.createContext({ activeWorkspaceID: "alpha-workspace", document: { createElement: element },
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => editorCurrent,
  projectStructuredFacts: project => copy(project.structuredFacts || []), migratedProjectStructuredFacts: project => copy(project.structuredFacts),
  normalizeProjectStructuredFact: value => value.value ? value : null,
  projectRecordID: project => project.id, safeAnnotationIDPart: value => value,
  researchChevronIconsSVG: () => "", projectSectionExpanded: (_p, _key, fallback) => fallback,
  wireProjectSectionMotion() {}, persistProjectSectionExpansion() {}, clear: node => { node.children = []; },
  window: { clearTimeout() {} }, showWebNotice() {},
  projectStructuredFactGroups: [{ key: "building", label: "Building & code", fields: [{ key: "occupancy", label: "Occupancy" }] }],
  async updateProjectFolder(_project, patch) { if (failWrite) throw Error("Write failed"); patches.push(copy(patch)); return true; }
});
vm.runInContext(actual("appendSavedProjectFactEditor"), e);
const contextRoot = element("section"), factsRoot = element("section"), actions = element("div");
const contextEditor = e.appendSavedProjectFactEditor(contextRoot, alpha, alpha, { section: "context" });
const factsEditor = e.appendSavedProjectFactEditor(factsRoot, alpha, alpha, { section: "facts", headerActions: actions });
const narrative = find(contextRoot, node => node.tag === "textarea");
const occupancy = find(factsRoot, node => node.attributes["aria-label"] === "Occupancy");
narrative.value = "Changed context";
await contextEditor.flush();
occupancy.value = "R-2"; occupancy.handlers.input();
await factsEditor.flush();
assert.deepEqual(patches[0], { description: "Changed context" });
assert.deepEqual(Object.keys(patches[1]).sort(), ["address", "structuredFacts"]);
assert.equal(patches[1].structuredFacts[0].value, "R-2");
assert.equal(actions.children[0].attributes["aria-label"], "Refresh ZoLa data");
failWrite = true; narrative.value = "Retry context";
await assert.rejects(contextEditor.flush(), /Write failed/);
failWrite = false; await contextEditor.flush();
assert.equal(patches.at(-1).description, "Retry context");
// Returning to the previous value while a save is pending is still a new edit.
const pendingEdits = [];
e.updateProjectFolder = async (_project, patch) => {
  patches.push(copy(patch));
  const hold = deferred(); pendingEdits.push(hold); await hold.promise; return true;
};
narrative.value = "Temporary context";
const temporary = contextEditor.flush();
narrative.value = "Retry context";
const reverted = contextEditor.flush();
assert.equal(pendingEdits.length, 2);
assert.equal(patches.at(-1).description, "Retry context");
pendingEdits[0].resolve(); pendingEdits[1].resolve();
await temporary; await reverted;
editorCurrent = false; narrative.value = "Wrong account";
await contextEditor.flush();
assert.equal(patches.at(-1).description, "Retry context");

// Two editors retain one canonical Project; older acknowledgments cannot erase a newer local edit.
const mutations = [], pending = [];
let canonical = copy(alpha), identities = [copy(alpha)];
const localState = { localProjects: [] };
const u = vm.createContext({ state: localState,
  hasCapability: () => true, requirePrivateWorkspaceWritable() {}, captureAccountRequest: () => ({}), requireCurrentAccountRequest() {},
  projectRecordID: project => project.id, projectDetailMatches: (a, b) => a.id === b.id,
  currentContentSummary: () => ({ projects: [canonical] }),
  visibleProjectRecords: records => localState.localProjects.length ? localState.localProjects : records,
  folderType: () => "project", syncCodeVersion: () => "2022", projectColor: () => "orange",
  projectStructuredFacts: project => copy(project.structuredFacts || []), activeAccount: () => ({ userID: "test" }),
  openProjectDetails: () => identities, setOpenProjectDetails: value => { identities = value; },
  projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  saveWorkspaceState() {}, refreshOpenProjectPaneTheme() {}, visibleProjectArtifactIDs: () => [],
  projectMutationForRecord: value => copy(value),
  pushMutation: mutation => { mutations.push(mutation); const hold = deferred(); pending.push(hold); return hold.promise; },
  isSessionAuthenticationError: () => false
});
vm.runInContext(actual("updateProjectFolder"), u);
const first = u.updateProjectFolder(alpha, { description: "New narrative" });
const second = u.updateProjectFolder(alpha, { address: "New address", structuredFacts: [{ key: "occupancy", value: "R-2" }] });
assert.equal(mutations[1].description, "New narrative", "Facts must merge the latest description, not its mount snapshot.");
canonical = mutations[0]; pending[0].resolve(); await first;
assert.equal(localState.localProjects[0].address, "New address", "Older acknowledgment must preserve the newer local overlay.");
canonical = mutations[1]; pending[1].resolve(); await second;
assert.equal(localState.localProjects.length, 0);
assert.equal(canonical.description, "New narrative");
assert.equal(canonical.structuredFacts[0].value, "R-2");
console.log("Project information columns passed: Project layouts, independent toggles, stale/failed saves, split editor patches and concurrent Project updates.");
