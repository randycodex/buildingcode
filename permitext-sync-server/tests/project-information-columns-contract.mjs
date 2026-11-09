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
assert.doesNotMatch(shell, /id="open-project-details"/);
assert.doesNotMatch(actual("openWorkspaceContextMenu"), /label: "Project details"/,
  "The Project tab replaces the redundant Project details menu action");

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

// Floating Context retains each dedicated tab editor and its existing save guards.
let current = alpha, allowed = true, privateAllowed = true, accountCurrent = true, tickScreen, inlineOptions;
const mounts = new Map(), issues = [], renderedInformation = [];
const flushedEditors = [];
let identityEditorCount = 0, closedIdentityEditors = 0, identityEditorController;
const mountEditor = (container, kind, className) => {
  const section = element('section'); section.className = className; container.append(section);
  return {flush:async()=>{flushedEditors.push(kind);}};
};
const state = { projectContextOpen: false, projectFactsOpen: false, paneWeights: {}, paneOrder: [] };
let detailsWidths = [640,640], disposedResizers = 0;
const body = element('body');
const workspaceShell = element('main'), workflowToolbar = element('nav'), track = element('section');
workspaceShell.className = 'workspace-shell'; workflowToolbar.className = 'workflow-toolbar';
body.append(workspaceShell); workspaceShell.append(workflowToolbar, track);
track.inert = false; workflowToolbar.inert = false;
const c = vm.createContext({ state, createColumnExpansion: () => ({dispose(){}}),
  appendProjectOpenQuestions: container => mountEditor(container, 'questions', 'project-open-questions'),
  appendProjectRecordsChecklist: container => mountEditor(container, 'checklist', 'project-records-checklist'),
  appendSavedProjectFactEditor: (container, _project, _identity, {section}) => mountEditor(container, section, section === 'context' ? 'project-overview-context' : 'saved-project-structured-facts'),
  createProjectToolDragHandle: () => element('button'),
  applyPaneWeight: panel => renderedInformation.push(panel),
  renderProjectSavedWork: async () => {}, activeWorkspaceID: "alpha-workspace", projectInformationMounts: mounts,
  currentWorkflowView:()=>"research", track, closeSharedWorkspaceViews() {}, syncWorkflowNavigation() {}, syncWorkflowColumnPresentation() {},
  createProjectDetailsColumnResizers: () => ({getWidths:()=>[...detailsWidths],setWidths:value=>{detailsWidths=[...value];},cancel(){},dispose(){disposedResizers++;}}),
  workspaceActionsButton: element('button'), toggleContextButton: element('button'),
  workspaceFloatingPanelReference: () => ({bottom:70}),
  bindFloatingWorkspacePanel: () => ({position(){},dispose(){disposedResizers++;}}),
  prependWorkspaceButtonIcon: button => button,
  createFloatingWorkspaceTabs({entries,selected,onSelect}) {
    const nav = element('nav'); nav.className = 'floating-workspace-tabs';
    const select = key => { entries.forEach(entry => { entry.panel.hidden = entry.id !== key; entry.panel.inert = entry.id !== key; }); onSelect(key); };
    select(selected);
    return {element:nav,select,dispose(){}};
  },
  saveWorkspaceResumeForRefresh() {},
  safeAnnotationIDPart: value => value,
  showProjectCreateSheet: (host, _project, options) => {
    identityEditorCount++; inlineOptions = options;
    const form = element('form'); host.append(form);
    identityEditorController = {flush:async()=>{flushedEditors.push('identity');},close:()=>{form.remove();closedIdentityEditors++;options.onClose();}};
    return identityEditorController;
  },
  document: { createElement: element, body, querySelector: selector => selector === '.workspace-shell' ? workspaceShell : selector === '.workflow-toolbar' ? workflowToolbar : null },
  setInterval: fn => { tickScreen = fn; return 1; }, clearInterval() {},
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => accountCurrent,
  workspaceProject: () => current, projectIdentity: value => ({ ...value }), projectDetailKey: value => value.id,
  projectDetailMatches: (a, b) => a?.id === b?.id,
  workspacePrivatePresentationAllowed: () => privateAllowed, hasCapability: () => allowed,
  notifyProjectRequiredForColumn: () => !current,
  presentWorkspaceIssue: value => issues.push(value)
});
vm.runInContext('let projectDetailsScreen=null, reportScreen=null;\n'+
  (await readFile(new URL('../public/report-screen.js',import.meta.url),'utf8')).replace('export function','function')+'\n'+
  ["circleXIconSVG", "pencilIconSVG", "projectInformationStateKey", "paneIDForProjectInformation", "flushProjectInformationPanes", "renderProjectInformation", "openProjectDetailsScreen", "toggleProjectInformation"].map(actual).join('\n'),c);
await c.toggleProjectInformation('context');
const contextPanel = mounts.get('project:context:alpha').panel;
const factsPanel = mounts.get('project:facts:alpha').panel;
const questionsPanel = mounts.get('project:questions:alpha').panel;
const checklistPanel = mounts.get('project:checklist:alpha').panel;
const screenElement = find(workspaceShell, node => node.className.includes('project-details-screen'));
assert.ok(screenElement, 'Project details mounts in the workspace screen wrapper');
const screenError = find(screenElement, node => node.attributes.role === 'alert');
assert.equal(Boolean(screenError), false, `Screen hydration must finish without a hidden harness error: ${screenError?.textContent}`);
assert.equal(screenElement.open, true); assert.equal(screenElement.hidden, false);
assert.equal(track.inert, false); assert.equal(workflowToolbar.inert, false);
assert.equal(workspaceShell.inert, undefined, 'The floating panel leaves the current workspace interactive');
assert.equal(contextPanel.hidden, false); assert.equal(factsPanel.hidden, true);
const columns = find(screenElement, node => node.className === 'project-details-columns');
assert.equal(columns.children.length, 4, 'All four tab editors remain mounted');
for (const label of ['Context', 'Facts', 'Questions', 'Checklist']) {
  assert.ok(find(columns, node => node.tag === 'h2' && node.textContent === label));
}
assert.equal(find(screenElement, node => node.className === 'project-details-tabs'), undefined);
for (const className of ['project-records-checklist', 'project-open-questions']) {
  assert.equal(find(contextPanel, node => node.className === className), undefined, 'Context does not duplicate the dedicated sections');
}
assert.ok(find(questionsPanel, node => node.className === 'project-open-questions'));
assert.ok(find(checklistPanel, node => node.className === 'project-records-checklist'));
await c.openProjectDetailsScreen('questions');
assert.equal(questionsPanel.hidden, false); assert.equal(checklistPanel.hidden, true);
questionsPanel.draft = 'Unsaved question';
await c.openProjectDetailsScreen('checklist');
assert.equal(questionsPanel.hidden, true); assert.equal(checklistPanel.hidden, false);
checklistPanel.draft = 'Unsaved record';
assert.equal(await c.flushProjectInformationPanes(), true);
assert.deepEqual(flushedEditors, ['identity', 'context', 'facts', 'questions', 'checklist'], 'Each mounted editor participates in guarded saves');
await c.openProjectDetailsScreen('context');
const contextBody = contextPanel.querySelector('.project-details-column-body');
const factsBody = factsPanel.querySelector('.project-details-column-body');
const editButton = find(contextPanel, node => node.className === 'project-overview-edit');
assert.equal(editButton, undefined, 'Context fields do not require the pencil button.');
assert.equal(identityEditorCount,1,'The complete identity form mounts as soon as Context opens.');
assert.equal(inlineOptions.inline,true);
assert.equal(inlineOptions.alwaysVisible,true,'Fields remain part of the Context view.');
assert.equal(inlineOptions.autoSave,true,'Context fields save without Save and Cancel actions.');
assert.equal(inlineOptions.readOnly,false);
assert.ok(find(contextPanel.querySelector('.project-overview-editor'),node=>node.tag==='form'));
const overviewInput = contextPanel.querySelector('.project-overview-context');
const originalInert = overviewInput.inert;
inlineOptions.onSubmitting(true);
assert.equal(overviewInput.inert, true, 'Freeze context while the identity editor flushes and saves.');
const factsContent=factsPanel.querySelector('.project-information-content');
assert.equal(factsContent.inert, true);
await c.openProjectDetailsScreen('facts');
assert.equal(factsPanel.inert,false,'Tabs remain navigable during an automatic save.');
inlineOptions.onSubmitting(false);
assert.equal(overviewInput.inert, originalInert, 'Restore context editing after identity submission.');
assert.equal(factsPanel.inert,false,'Finishing a save keeps the selected tab interactive.');
assert.equal(factsContent.inert,undefined);
await c.openProjectDetailsScreen('context');
vm.runInContext('projectDetailsScreen.close()',c);
assert.equal(closedIdentityEditors,0,'Closing Context keeps pending automatic saves mounted.');
await c.openProjectDetailsScreen('context');
assert.equal(identityEditorCount,1,'Reopening Context retains the same fields and any failed save draft.');
contextPanel.draft='Retained edit'; contextBody.scrollTop=320;
factsBody.scrollTop=210; columns.scrollLeft=80;
const presentation = vm.runInContext('projectDetailsScreen.getPresentationState()',c);
assert.deepEqual(copy(presentation.columnScrolls), {context:320,facts:210,questions:0,checklist:0});
contextBody.scrollTop=0; factsBody.scrollTop=0; columns.scrollLeft=0;
c.presentation=presentation; vm.runInContext('projectDetailsScreen.restorePresentation(presentation)',c);
assert.equal(contextBody.scrollTop,320); assert.equal(factsBody.scrollTop,210);
vm.runInContext('projectDetailsScreen.close()',c);
assert.equal(screenElement.hidden, true); assert.equal(screenElement.open, false);
assert.equal(track.inert, false); assert.equal(workflowToolbar.inert, false);
assert.equal(mounts.size, 4, 'Closing retains all mounted editors and their drafts');
await c.toggleProjectInformation('facts');
assert.equal(mounts.get('project:context:alpha').panel,contextPanel);
assert.equal(contextPanel.draft,'Retained edit'); assert.equal(contextBody.scrollTop,320);
assert.equal(contextPanel.hidden,true); assert.equal(factsPanel.hidden,false);
assert.equal(renderedInformation.length, 4, 'Switching sections must reuse the original editors');
assert.equal(questionsPanel.draft, 'Unsaved question'); assert.equal(checklistPanel.draft, 'Unsaved record');
assert.equal(vm.runInContext('projectDetailsScreen.getPresentationState().section',c),'facts');
vm.runInContext('projectDetailsScreen.close()',c);
await c.openProjectDetailsScreen();
assert.equal(factsPanel.hidden,false,'Reopening retains the selected tab');
vm.runInContext('projectDetailsScreen.restorePresentation({section:"facts",contentScroll:90})',c);
assert.equal(factsBody.scrollTop,90,'A previous tab-based snapshot restores into its matching column');
allowed=false; tickScreen(); assert.equal(mounts.size,0,'Revoked access releases retained editor mounts');
assert.equal(disposedResizers,1,'Removing the screen disposes its floating event handlers');
assert.equal(screenElement.isConnected, false, 'Revoking access removes the whole private screen');
assert.equal(contextPanel.isConnected, false); assert.equal(factsPanel.isConnected, false);
assert.equal(questionsPanel.isConnected, false); assert.equal(checklistPanel.isConnected, false);
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
    className: "", classList: { add() {}, remove() {}, contains: name => e.className.split(/\s+/).includes(name) },
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
const e = vm.createContext({ activeWorkspaceID: "alpha-workspace", document: { createElement: element },
  captureAccountRequest: () => ({}), isCurrentAccountRequest: () => editorCurrent,
  projectStructuredFacts: project => copy(project.structuredFacts || []), migratedProjectStructuredFacts: project => copy(project.structuredFacts),
  normalizeProjectStructuredFact: value => value.value ? value : null,
  projectRecordID: project => project.id, safeAnnotationIDPart: value => value,
  projectDetailMatches: (a,b) => a?.id === b?.id,
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
await contextEditor.flush(); assert.equal(patches.length,0);
assert.equal(find(factsRoot,node=>node.attributes['aria-label']==='Address').readOnly,true,'Address edits belong to the Overview editor.');
assert.equal(factMotionCalls.length, 0, "Standalone Facts ignores stored collapsed state and has no accordions.");
assert.equal(find(factsRoot,node=>node.tag==='details'||node.tag==='summary'),undefined,'Facts groups have no native collapse controls.');
for (const label of ["Property", "Building", "Work & code basis", "Zoning", "Special designations"]) {
  assert.ok(find(factsRoot, node => node.tag === "h3" && node.textContent === label));
}
const narrative = find(contextRoot, node => node.tag === "textarea");
assert.equal(narrative.attributes['aria-label'], 'Project context');
assert.equal(narrative.value, 'Original context', 'Existing descriptions remain available as editable Project context.');
assert.equal(narrative.disabled, false);
const sharedRoot = element('section');
e.appendSavedProjectFactEditor(sharedRoot, alpha, {...alpha, sharedOnly:true}, {section:'context'});
assert.equal(find(sharedRoot,node=>node.tag==='textarea').disabled, true, 'Shared read-only access is preserved.');
const occupancy = find(factsRoot, node => node.attributes["aria-label"] === "Occupancy");
const zoningRow = find(factsRoot, node => node.dataset.factKey === "zoning-districts");
const allFacts = find(factsRoot, node => node.className === "ghost-button project-facts-filter");
assert.equal(allFacts, undefined, 'Facts has no visibility toggle.');
assert.notEqual(zoningRow.hidden, true, 'Unrecorded optional facts are always visible.');
narrative.value = "Changed context";
narrative.handlers.blur();
await contextEditor.flush();
occupancy.value = "R-2"; occupancy.handlers.input();
assert.notEqual(zoningRow.hidden, true, 'Editing a fact does not hide other fields.');
await factsEditor.flush();
assert.deepEqual(patches[0], { description: "Changed context" });
assert.deepEqual(Object.keys(patches[1]).sort(), ["address", "structuredFacts"]);
assert.equal(patches[1].structuredFacts[0].value, "R-2");
assert.equal(typeof factsEditor.refreshZoLa, "function");
assert.equal(factsEditor.isRefreshing(), false);
assert.equal(factsEditor.refresh({...alpha,address:'Updated address',structuredFacts:[]}),true,'Identity address changes refresh Facts in place.');
assert.equal(find(factsRoot,node=>node.attributes['aria-label']==='Address').value,'Updated address');
const refreshedOccupancy = find(factsRoot,node=>node.attributes['aria-label']==='Occupancy');
refreshedOccupancy.value='R-3'; refreshedOccupancy.handlers.input();
assert.equal(factsEditor.refresh({...alpha,address:'Do not overwrite'}),false,'A refresh preserves pending fact edits.');
await factsEditor.flush();
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
const mutations = [], pending = [], settingsNames = [];
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
  refreshOpenSettingsWorkspace() { settingsNames.push((localState.localProjects[0] || canonical).name); },
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
const renamed = u.updateProjectFolder(alpha, { name: "Renamed workspace" });
assert.equal(settingsNames.at(-1), "Renamed workspace", "Open Settings must show the rename before the server responds.");
canonical = { ...mutations[2], name: "Canonical rename", title: "Canonical rename" };
pending[2].resolve(); await renamed;
assert.equal(settingsNames.at(-1), "Canonical rename", "Settings must also refresh after the rename is acknowledged.");
console.log("Project details passed: retained sections, access revocation, stale loads, split editor patches and concurrent Project updates.");
