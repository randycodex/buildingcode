import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { emptyWorkspaceLayout, captureWorkspaceLayout, applyWorkspaceLayout, canGroupColumn } from "../public/workspace-state.js";
import { showProjectFact } from "../public/minimal-workflow.js";

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
assert.match(shell, /id="open-project-details"/);
assert.doesNotMatch(actual("openWorkspaceContextMenu"), /label: "Project details"/,
  "Project Details stays in its dedicated top-level control rather than being repeated in the Project menu");

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

// Context and Facts now share a retained screen; the same editors and save guards remain.
let current = alpha, allowed = true, privateAllowed = true, accountCurrent = true, tickScreen;
const mounts = new Map(), issues = [], renderedInformation = [];
const state = { projectContextOpen: false, projectFactsOpen: false, paneWeights: {}, paneOrder: [] };
const body = element('body');
const workspaceShell = element('main'), workflowToolbar = element('nav'), track = element('section');
workspaceShell.className = 'workspace-shell'; workflowToolbar.className = 'workflow-toolbar';
body.append(workspaceShell); workspaceShell.append(workflowToolbar, track);
track.inert = false; workflowToolbar.inert = false;
const c = vm.createContext({ state, activeWorkspaceID: "alpha-workspace", projectInformationMounts: mounts,
  currentWorkflowView:()=>"research", track, closeSharedWorkspaceViews() {}, syncWorkflowNavigation() {}, syncWorkflowColumnPresentation() {},
  document: { createElement: element, body, querySelector: selector => selector === '.workspace-shell' ? workspaceShell : selector === '.workflow-toolbar' ? workflowToolbar : null },
  setInterval: fn => { tickScreen = fn; return 1; }, clearInterval() {},
  createReaderToolbarButton: () => { const button = element('button'); button.textContent = 'Reader'; return button; },
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => accountCurrent,
  workspaceProject: () => current, projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a?.id === b?.id,
  workspacePrivatePresentationAllowed: () => privateAllowed, hasCapability: () => allowed,
  notifyProjectRequiredForColumn: () => !current,
  presentWorkspaceIssue: value => issues.push(value),
  renderProjectInformation: async (identity, kind) => {
    const panel = element('article'); panel.draft = `Draft ${kind}`;
    const content = element('div'); content.className = 'project-information-content'; panel.append(content);
    if (kind === 'context') {
      const records = element('section'); records.className = 'project-records-checklist'; content.append(records);
    }
    renderedInformation.push({ identity, kind, panel });
    mounts.set(`project:${kind}:${identity.id}`, {panel, flush: async () => {}});
    return panel;
  }
});
vm.runInContext('let projectDetailsScreen=null, reportScreen=null;\n'+
  (await readFile(new URL('../public/report-screen.js',import.meta.url),'utf8')).replace('export function','function')+'\n'+
  ["circleXIconSVG", "projectInformationStateKey", "paneIDForProjectInformation", "flushProjectInformationPanes", "openProjectDetailsScreen", "toggleProjectInformation"].map(actual).join('\n'),c);
await c.toggleProjectInformation('context');
const contextPanel = mounts.get('project:context:alpha').panel;
const factsPanel = mounts.get('project:facts:alpha').panel;
const screenElement = find(workspaceShell, node => node.className.includes('project-details-screen'));
assert.ok(screenElement, 'Project details mounts in the workspace screen wrapper');
assert.equal(find(screenElement, node => node.attributes.role === 'alert'), undefined, 'Screen hydration must finish without a hidden harness error');
assert.equal(screenElement.open, true); assert.equal(screenElement.hidden, false);
assert.equal(track.inert, true); assert.equal(workflowToolbar.inert, true);
assert.equal(workspaceShell.inert, undefined, 'Cover the underlying controls, not the active details screen');
assert.equal(contextPanel.hidden, false); assert.equal(factsPanel.hidden,true);
const overviewTab = find(screenElement, node => node.tag === 'button' && node.textContent === 'Overview');
const factsTab = find(screenElement, node => node.tag === 'button' && node.textContent === 'Facts');
const recordsTab = find(screenElement, node => node.tag === 'button' && node.textContent === 'Records');
assert.equal(overviewTab.attributes['aria-pressed'], 'true');
assert.equal(factsTab.attributes['aria-pressed'], 'false');
const recordsPanel = find(screenElement, node => node.className.includes('project-records-panel'));
assert.ok(find(recordsPanel, node => node.className === 'project-records-checklist'), 'Records retains the existing checklist in its dedicated section');
assert.equal(find(contextPanel, node => node.className === 'project-records-checklist'), undefined, 'The checklist is moved rather than duplicated');
recordsTab.handlers.click();
assert.equal(recordsPanel.hidden, false); assert.equal(contextPanel.hidden, true); assert.equal(factsPanel.hidden, true);
assert.equal(recordsTab.attributes['aria-pressed'], 'true');
overviewTab.handlers.click();
contextPanel.draft='Retained edit'; contextPanel.scrollTop=320;
vm.runInContext('projectDetailsScreen.close()',c);
assert.equal(screenElement.hidden, true); assert.equal(screenElement.open, false);
assert.equal(track.inert, false); assert.equal(workflowToolbar.inert, false);
assert.equal(mounts.size, 2, 'Closing retains both mounted editors and their drafts');
await c.toggleProjectInformation('facts');
assert.equal(mounts.get('project:context:alpha').panel,contextPanel);
assert.equal(contextPanel.draft,'Retained edit'); assert.equal(contextPanel.scrollTop,320);
assert.equal(contextPanel.hidden,true); assert.equal(factsPanel.hidden,false);
assert.equal(renderedInformation.length, 2, 'Switching sections must reuse both original editors');
assert.equal(factsTab.attributes['aria-pressed'], 'true');
vm.runInContext('projectDetailsScreen.close()',c);
await c.openProjectDetailsScreen();
assert.equal(factsPanel.hidden,false,'Reopening keeps the last section');
allowed=false; tickScreen(); assert.equal(mounts.size,0,'Revoked access releases retained editor mounts');
assert.equal(screenElement.isConnected, false, 'Revoking access removes the whole private screen');
assert.equal(contextPanel.isConnected, false); assert.equal(factsPanel.isConnected, false);
assert.equal(track.inert, false); assert.equal(workflowToolbar.inert, false);
assert.equal(await c.toggleProjectInformation('facts'),false);
allowed=true; privateAllowed=false; assert.equal(await c.toggleProjectInformation('facts'),false);
privateAllowed=true; current=null; assert.equal(await c.toggleProjectInformation('facts'),false);
current=alpha; accountCurrent=true;
const pendingPanel=deferred();
c.renderProjectInformation=async (identity,kind) => {
  const panel=await pendingPanel.promise;
  mounts.set(`project:${kind}:${identity.id}`,{panel,flush:async()=>{}}); return panel;
};
const opening=c.toggleProjectInformation('context');
accountCurrent=false; tickScreen(); pendingPanel.resolve(element('article')); await opening;
assert.equal(mounts.size,0,'Late loading cannot leak an old-account editor mount');

// Restoring narrow Project information widths respects the minimum with fewer than four columns.
const factsID = "project:facts:alpha", contextID = "project:context:alpha";
const widthContext = vm.createContext({
  state: { paneWeights: {}, readers: [], paneWidthDefaultsVersion: 5 },
  ids: [], activePaneIDs: () => widthContext.ids,
  isCodeQuestionPaneID: () => false, isProjectWorkboardPaneID: () => false,
  isProjectNotebookPaneID: () => false, isProjectReportDraftPaneID: () => false,
  isProjectCoordinationThreadPaneID: () => false, isProjectCoordinationPaneID: () => false,
  isProjectDetailPaneID: () => false, isFixedWidthPaneID: () => false,
  detachedProjectWindow: false
});
vm.runInContext([
  ...app.matchAll(/const (?:(?:legacy|default)\w*PaneWidth|assistantHistoryWidth) = [^;]+;/g)
].map(match => match[0]).join("\n") + "\n" + ["assistantHistoryOnlyPane", "defaultPaneWidthForID", "minimumPaneWidthForID", "maximumPaneWidthForID", "constrainPaneWidth", "migrateLegacyPaneWidth",
  "normalizePaneWeights", "isFlexibleReaderPaneID", "applyPaneWeight"].map(actual).join("\n"), widthContext);
assert.equal(widthContext.defaultPaneWidthForID(factsID), 600);
assert.equal(widthContext.defaultPaneWidthForID(contextID), 600);
for (const ids of [[factsID], [factsID, contextID], [factsID, contextID, "utility:search"]]) {
  widthContext.ids = ids;
  widthContext.state.paneWeights = { [factsID]: 400, [contextID]: 400 };
  widthContext.normalizePaneWeights(ids);
  assert.equal(widthContext.state.paneWeights[factsID], 600);
  const style = { setProperty(key, value) { this[key] = value; } };
  widthContext.applyPaneWeight({ dataset: {}, classList: { contains: () => false }, style }, factsID);
  assert.equal(style["--pane-resized-min-width"], "600px");
  assert.equal(style.flex, "1 0 600px");
}
widthContext.state.paneWeights[factsID] = 850;
widthContext.normalizePaneWeights([factsID, contextID]);
assert.equal(widthContext.state.paneWeights[factsID], 850, "Keep wider saved sizes.");
assert.equal(widthContext.state.paneWeights[contextID], 600, "Context shares the 600px minimum.");
assert.equal(widthContext.defaultPaneWidthForID("utility:other"), 400, "Other columns keep their defaults.");
const collapsedStyle = { setProperty(key, value) { this[key] = value; } };
widthContext.applyPaneWeight({ dataset: {}, classList: { contains: () => true }, style: collapsedStyle }, factsID);
assert.equal(collapsedStyle.flex, "0 0 48px", "Facts can still collapse.");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
assert.match(styles, /\.project-facts-panel\s*\{\s*--pane-min-width: 600px;/);

// Execute the actual split editors: Context patches only description; Facts patches only fact fields.
function element(tag) {
  const e = { tag, children: [], attributes: {}, handlers: {}, dataset: {}, value: "", isConnected: true,
    className: "", classList: { add() {}, remove() {} },
    append(...values) { values.forEach(value => { if (value.parent) value.parent.children = value.parent.children.filter(child => child !== value); value.parent = this; this.children.push(value); }); },
    prepend(value) { value.parent = this; this.children.unshift(value); },
    replaceChildren(...values) { this.children=[]; this.append(...values); },
    querySelectorAll() { return []; },
    showModal() { this.open=true; },
    close() { if (!this.open) return; this.open=false; this.handlers.close?.(); },
    remove() { const disconnect = node => { node.isConnected=false; node.children.forEach(disconnect); }; disconnect(this); if (this.parent) this.parent.children = this.parent.children.filter(value => value !== this); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.handlers[type] = callback; },
    closest(selector) { for (let current = this; current; current = current.parent) { if (selector.startsWith('.') && current.className.split(/\s+/).includes(selector.slice(1))) return current; } return null; },
    querySelector(selector) { for (const child of this.children) { const match = find(child, value => selector.startsWith('.') && value.className.split(/\s+/).includes(selector.slice(1))); if (match) return match; } return null; }
  };
  return e;
}
function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) { const match = find(child, predicate); if (match) return match; }
}
let editorCurrent = true, failWrite = false;
const factMotionCalls = [];
const patches = [];
const e = vm.createContext({ activeWorkspaceID: "alpha-workspace", document: { createElement: element }, showProjectFact,
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => editorCurrent,
  projectStructuredFacts: project => copy(project.structuredFacts || []), migratedProjectStructuredFacts: project => copy(project.structuredFacts),
  normalizeProjectStructuredFact: value => value.value ? value : null,
  projectRecordID: project => project.id, safeAnnotationIDPart: value => value,
  researchChevronIconsSVG: () => "", projectSectionExpanded: () => false,
  wireProjectSectionMotion(...args) { factMotionCalls.push(args); }, persistProjectSectionExpansion() {}, clear: node => { node.children = []; },
  window: { clearTimeout() {} }, showWebNotice() {},
  projectStructuredFactGroups: [
    { key: "buildingCode", label: "Building & code", fields: [{ key: "occupancy", label: "Occupancy" }] },
    { key: "zoning", label: "Zoning", fields: [{ key: "address", label: "Address", projectAddress: true }, { key: "zoning-districts", label: "Zoning Districts" }] }
  ],
  nycMappedFactFields: [],
  async updateProjectFolder(_project, patch) { if (failWrite) throw Error("Write failed"); patches.push(copy(patch)); return true; }
});
vm.runInContext(actual("projectFactPresentationGroups") + '\n' + actual("appendSavedProjectFactEditor"), e);
const contextRoot = element("section"), factsRoot = element("section");
const contextEditor = e.appendSavedProjectFactEditor(contextRoot, alpha, alpha, { section: "context" });
const factsEditor = e.appendSavedProjectFactEditor(factsRoot, alpha, alpha, { section: "facts" });
assert.equal(factMotionCalls.length, 0, "Standalone Facts ignores stored collapsed state and has no accordions.");
for (const label of ["Property", "Building", "Work & code basis", "Zoning", "Special designations"]) {
  assert.ok(find(factsRoot, node => node.tag === "h3" && node.textContent === label));
}
const narrative = find(contextRoot, node => node.tag === "textarea");
const occupancy = find(factsRoot, node => node.attributes["aria-label"] === "Occupancy");
const zoningRow = find(factsRoot, node => node.dataset.factKey === "zoning-districts");
const allFacts = find(factsRoot, node => node.className === "ghost-button project-facts-filter");
assert.equal(zoningRow.hidden, true, 'Unrecorded optional facts start hidden');
allFacts.handlers.click();
assert.equal(zoningRow.hidden, false); assert.equal(allFacts.attributes['aria-pressed'], 'true');
narrative.value = "Changed context";
await contextEditor.flush();
occupancy.value = "R-2"; occupancy.handlers.input();
allFacts.handlers.click();
assert.equal(occupancy.value, 'R-2', 'Changing the fact presentation cannot rebuild away typed values');
assert.equal(zoningRow.hidden, true);
await factsEditor.flush();
assert.deepEqual(patches[0], { description: "Changed context" });
assert.deepEqual(Object.keys(patches[1]).sort(), ["address", "structuredFacts"]);
assert.equal(patches[1].structuredFacts[0].value, "R-2");
assert.equal(typeof factsEditor.refreshZoLa, "function");
assert.equal(factsEditor.isRefreshing(), false);
assert.equal(find(factsRoot, node => node.className === "saved-project-refresh-facts"), undefined);
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
console.log("Project details passed: retained sections, access revocation, stale loads, split editor patches and concurrent Project updates.");
