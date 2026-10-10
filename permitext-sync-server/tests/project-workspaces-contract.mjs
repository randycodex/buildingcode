import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyWorkspaceLayout, normalizeWorkspaceRegistry, captureWorkspaceLayout } from '../public/workspace-state.js';
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const chooser = app.slice(app.indexOf('async function openWorkspaceContextMenu('), app.indexOf('function focusActiveWorkspaceTab('));
const mobileChooser = app.slice(app.indexOf('function openMobileMoreSheet('), app.indexOf('async function openWorkspaceContextMenu('));
for (const source of [chooser, mobileChooser]) {
  assert.doesNotMatch(source, /New workspace|Manage workspaces|Rename workspace|Duplicate workspace|Delete workspace|Workspaces share/);
  assert.match(source, /Unassigned saves/);
  assert.match(source, /New Project/);
  assert.match(source, /Manage Projects/);
}
assert.match(app, /function visibleWorkspaceRecords\(\)[\s\S]*?workspace\.projectID && availableProjectIDs\.has\(workspace\.projectID\)/);
assert.match(app, /const emptyLabel = "Unassigned saves"/);
const storage = new Map();
const projects = [{id:'a', name:'Alpha', folderType:'project'}, {id:'b', name:'Beta', folderType:'project'}];
const context = vm.createContext({
 workspaceRegistry: normalizeWorkspaceRegistry({workspaces:[{id:'main',name:'Main'}]}), activeWorkspaceID:'main',
 syncedContent:{status:"disconnected"}, applyStoredWorkspaceLayout(){},
 state:{utilityInstances:[], projectDetails:[]}, detachedProjectWindow:false,
 currentContentSummary:()=>({projects}), activeFolderRecords:x=>x.filter(project=>!project.deletedAt&&!project.archivedAt), mergeProjectsWithOrganizationAccess:x=>x,
 folderIsProject:x=>x.folderType==='project', projectRecordID:x=>x.id, projectIdentity:x=>({...x}),
 projectIsArchived:x=>Boolean(x?.archivedAt),
 projectDetailMatches:(a,b)=>a.id===b.id, emptyWorkspaceLayout, captureWorkspaceLayout,
 newUtilityInstance:(key, props)=>({key,id:'saved',...props}), paneIDForUtilityInstance:()=> 'utility:saved',
 workspaceSnapshotKey:id=>id, loadWorkspaceSnapshot:id=>storage.has(id)?JSON.parse(storage.get(id)):null,
 workspaceLayoutWithoutCodeQuestionData:x=>x,
 localStorage:{getItem:id=>storage.get(id),setItem:(id,v)=>storage.set(id,v)},
 persistWorkspaceRegistry(){}, Date,
});
vm.runInContext('function activeWorkspaceRecord(){return workspaceRegistry.workspaces.find(w=>w.id===activeWorkspaceID)}\n'+app.slice(app.indexOf('function workspaceProject('),app.indexOf('async function createNewWorkspace()')),context);
vm.runInContext('reconcileProjectWorkspaces(); reconcileProjectWorkspaces();',context);
assert.equal(context.workspaceRegistry.workspaces.length,3,'migration must be idempotent');
assert.equal(storage.size,2);
context.activeWorkspaceID='project:a';
assert.equal(vm.runInContext('scopeSavedInstanceToWorkspace({selectedFolderID:"b"}).selectedFolderID',context),'a');
const alpha=JSON.parse(storage.get('project:a'));
assert.equal(alpha.projectDetails[0].id,'a');
assert.equal(JSON.parse(storage.get('project:b')).projectDetails[0].id,'b');
projects[0].name='Renamed';
vm.runInContext('reconcileProjectWorkspaces()',context);
assert.equal(context.workspaceRegistry.workspaces[1].name,'Renamed');
assert.equal(normalizeWorkspaceRegistry(context.workspaceRegistry).workspaces[1].projectID,'a');
assert.equal(storage.get('project:a'),JSON.stringify(alpha),'reconcile must preserve existing layouts');
console.log('Project workspace migration, binding, isolation, rename, and layout preservation passed.');
context.syncedContent.status='connected';
context.workspaceRegistry.workspaces.push({id:'stale',name:'Missing project',projectID:'missing'});
context.activeWorkspaceID='stale';
vm.runInContext('reconcileProjectWorkspaces()',context);
assert.notEqual(context.activeWorkspaceID,'stale','unavailable project must not remain the active title');
assert.ok(context.workspaceRegistry.workspaces.some(w=>w.id==='stale'),'preserve stale workspace identity for recovery');
// All projects can be deleted on another device after the last general workspace was removed.
context.workspaceRegistry.workspaces = [{id:'project:a', name:'Deleted project', projectID:'a'}];
context.activeWorkspaceID = 'project:a';
projects.length = 0;
context.syncedContent.status = 'offline';
vm.runInContext('reconcileProjectWorkspaces()',context);
assert.equal(context.activeWorkspaceID, 'project:a', 'offline state must not imply project deletion');
projects.push({id:'a', name:'Deleted project', folderType:'project', deletedAt:'2026-09-21T00:00:00.000Z'});
vm.runInContext('reconcileProjectWorkspaces(); reconcileProjectWorkspaces()',context);
assert.equal(context.activeWorkspaceID, 'general', 'an explicit cached deletion must clear the stale project title while offline');
assert.equal(context.workspaceRegistry.workspaces.filter(w=>w.id==='general').length, 1);
projects.length = 0;
context.workspaceRegistry.workspaces = [{id:'project:a', name:'Deleted project', projectID:'a'}];
context.activeWorkspaceID = 'project:a';
context.syncedContent.status = 'connected';
vm.runInContext('reconcileProjectWorkspaces(); reconcileProjectWorkspaces()',context);
assert.equal(context.activeWorkspaceID, 'general', 'create General when no fallback workspace exists');
assert.equal(context.workspaceRegistry.workspaces.filter(w=>w.id==='general').length, 1);
assert.ok(context.workspaceRegistry.workspaces.some(w=>w.id==='project:a'), 'retain old layout identity for recovery');

// Execute the actual menu destination and workspace switch against persisted layouts.
// A Project-only account must reach its existing unassigned evidence without creating
// a Project, changing saved identities, or overwriting the Project's pane arrangement.
assert.match(app, /appendMenuAction\(savedSection, \{ label: "Unassigned saves", run: \(\) => void openUnassignedSaves\(\) \}\)/);
const switchSource = app.slice(app.indexOf('async function switchWorkspace('), app.indexOf('\nfunction workspaceProject('));
const unassignedSource = app.slice(app.indexOf('function defaultReadingWorkspace('), app.indexOf('\nasync function createGeneralWorkspace('));
function unassignedHarness(workspaces, activeID = 'project:a') {
  const layouts = new Map(workspaces.map(workspace => [workspace.id, {
    utilityInstances: [{ key: 'saved', id: `${workspace.id}:saved`, selectedFolderID: workspace.projectID || 'collection', folderQuery: 'hidden', codeFilters: ['BC'], organizeUnassigned: false }],
    readers: [{ id: `${workspace.id}:reader` }], paneOrder: ['reader', 'saved'], paneWeights: { reader: 450 },
    projectDetails: workspace.projectID ? [{id: workspace.projectID}] : [],
    notebooks: [], reportDrafts: [], coordinations: [], coordinationThreads: []
  }]));
  const ctx = vm.createContext({
    workspaceRegistry: { workspaces: structuredClone(workspaces), activeWorkspaceID: activeID },
    activeWorkspaceID: activeID, state: structuredClone(layouts.get(activeID)),
    workspaceRegistryKey: 'account:A', preferenceStorage: new Map(),
    localStorage: { getItem: key => ctx.preferenceStorage.get(key), setItem: (key, value) => ctx.preferenceStorage.set(key, value) },
    evidence: [{ id: 'existing-phone-save', sectionID: '41000003', projectID: null }],
    allowed: true, currentIdentity: 1, confirmation: true, confirmations: 0, focused: 0,
    workspacePrivatePresentationAllowed: () => true, hasCapability: () => true,
    captureAccountRequest: () => ctx.currentIdentity, isCurrentAccountRequest: identity => identity === ctx.currentIdentity,
    activeWorkspaceRecord: () => ctx.workspaceRegistry.workspaces.find(workspace => workspace.id === ctx.activeWorkspaceID),
    confirmWorkspaceTransition: async () => { ctx.confirmations++; return ctx.confirmation; },
    loadWorkspaceSnapshot: id => structuredClone(layouts.get(id) || emptyWorkspaceLayout()),
    saveWorkspaceState: () => layouts.set(ctx.activeWorkspaceID, structuredClone(ctx.state)),
    applyStoredWorkspaceLayout: layout => { ctx.state = structuredClone(layout); },
    setOpenProjectDetails: details => { ctx.state.projectDetails = details; },
    persistWorkspaceRegistry() {}, renderWorkspaceTabs() {}, focusActiveWorkspaceTab() {},
    renderWorkspaceTransitionState() {}, waitForWorkspaceTransitionPaint: async () => {},
    renderWorkspace: async () => {}, suppressReaderScrollRestore: false,
    track: { removeAttribute() {}, querySelector() { return null; }, scrollWidth: 1000, clientWidth: 500 },
    transitions: [],
    transitionWorkspace: async (reason, options = {}) => { ctx.transitions.push({reason, options}); ctx.saveWorkspaceState(); ctx.duringTransition?.(); },
    newUtilityInstance: (key, properties) => ({key, id: 'new-inbox', selectedFolderID: '', codeFilters: [], folderQuery: '', ...properties}),
    defaultPaneWidthForID: () => 600,
    appendPaneIfMissing: id => { if (!ctx.state.paneOrder.includes(id)) ctx.state.paneOrder.push(id); },
    scrollPaneIntoView: () => { ctx.focused++; },
    whenWorkspacePaneReady: async () => true,
    paneIsCollapsed: () => false,
    CSS: { escape: value => value },
    paneIDForUtilityInstance: saved => saved.id,
    focusUtility: async key => {
      ctx.focused++;
      if (!ctx.state.utilityInstances.some(item => item.key === key)) {
        ctx.state.utilityInstances.push({ key, id: 'new-saved-pane', organizeUnassigned: true, selectedFolderID: '' });
      }
      ctx.saveWorkspaceState();
    },
    presentPlanLimitNotice: async () => { throw Error('Unexpected plan denial'); },
    presentWorkspaceIssue: () => { throw Error('Unexpected invalid layout'); }, Date
  });
  vm.runInContext(switchSource + '\n' + unassignedSource, ctx);
  return {ctx, layouts};
}
for (const extras of [[], [{id:'general', name:'General'}], [{id:'ordinary',name:'Desk'}]]) {
  const {ctx, layouts} = unassignedHarness([{id:'project:a',name:'Alpha',projectID:'a'}, ...extras]);
  const originalSaved = JSON.stringify(ctx.state.utilityInstances[0]);
  const readersBefore = JSON.stringify(ctx.state.readers);
  const detailsBefore = JSON.stringify(ctx.state.projectDetails);
  const evidenceBefore = JSON.stringify(ctx.evidence);
  const workspaceCount = ctx.workspaceRegistry.workspaces.length;
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.activeWorkspaceID, 'project:a', 'Opening an inbox must preserve the active Project');
  assert.equal(ctx.confirmations, 0, 'There is no Project departure');
  assert.equal(JSON.stringify(ctx.state.utilityInstances[0]), originalSaved, 'Project Saved pane remains scoped to its Project');
  assert.equal(JSON.stringify(ctx.state.readers), readersBefore);
  assert.equal(JSON.stringify(ctx.state.projectDetails), detailsBefore);
  assert.equal(JSON.stringify(ctx.evidence), evidenceBefore);
  const inbox = ctx.state.utilityInstances[1];
  assert.equal(inbox.unassignedInbox, true);
  assert.equal(inbox.organizeUnassigned, true);
  assert.equal(inbox.selectedFolderID, '');
  inbox.folderQuery = 'retained search';
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.state.utilityInstances.length, 2, 'Repeat action must focus the existing inbox');
  assert.equal(inbox.folderQuery, 'retained search');
  assert.equal(ctx.workspaceRegistry.workspaces.length, workspaceCount);
  assert.equal(ctx.preferenceStorage.size, 0, 'Inbox navigation must not alter destination preferences');
}
assert.equal(vm.runInContext('scopeSavedInstanceToWorkspace({unassignedInbox:true,selectedFolderID:"b"}).selectedFolderID', context), '');
{
  const {ctx} = unassignedHarness([{id:'general',name:'General'}], 'general');
  const existing = ctx.state.utilityInstances[0];
  existing.selectedFolderID = '';
  existing.organizeUnassigned = true;
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.state.utilityInstances.length, 1, 'Reuse an existing Unassigned pane');
  assert.equal(existing.unassignedInbox, true);
  assert.deepEqual(Array.from(ctx.transitions[0].options.refreshPaneIDs), [existing.id], 'Refresh the promoted pane, including its Free locked title');
}
{
  const {ctx} = unassignedHarness([{id:'project:a',name:'Alpha',projectID:'a'}]);
  ctx.duringTransition = () => { ctx.currentIdentity++; };
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.focused, 0, 'An account change must fence delayed focus');
}
console.log('Independent Unassigned inbox: Project and Reader preservation, reuse, search retention, preferences and account fencing passed.');
