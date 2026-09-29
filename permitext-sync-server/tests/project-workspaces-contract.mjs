import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyWorkspaceLayout, normalizeWorkspaceRegistry, captureWorkspaceLayout } from '../public/workspace-state.js';
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
assert.match(app, /const orderedWorkspaces = \[\s*\.\.\.workspaces\.filter\(\(candidate\) => candidate\.projectID\),\s*\.\.\.workspaces\.filter\(\(candidate\) => !candidate\.projectID\)\s*\];[\s\S]*?\["Projects", "Workspaces"\]\.forEach/, 'workspace menu must present Projects before general workspaces');
assert.match(app, /function isTechnicalFallbackWorkspace\(workspace\)[\s\S]*?workspace\.id === "general" \|\| workspace\.name === "General"/, 'General must be treated as an invisible technical fallback');
assert.match(app, /function visibleWorkspaceRecords\(\)[\s\S]*?!isTechnicalFallbackWorkspace\(workspace\)/, 'visible workspace choices must exclude the technical fallback');
assert.match(app, /const emptyLabel = visibleWorkspaces\.length \? "Choose workspace or project" : "Create workspace or project"/, 'the top control must prompt creation when no named destination exists');
assert.match(app, /if \(!workspaces\.length\) \{[\s\S]*?label: "New Project"[\s\S]*?label: "New workspace"/, 'the empty workspace menu must lead with Project and workspace creation');
assert.doesNotMatch(app, /explanation\.textContent = "General workspaces/, 'General must not be presented as a user-facing workspace category');
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
const unassignedSource = app.slice(app.indexOf('async function openUnassignedSaves('), app.indexOf('\nasync function createGeneralWorkspace('));
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
    track: { removeAttribute() {}, scrollWidth: 1000, clientWidth: 500 },
    transitionWorkspace: async () => ctx.saveWorkspaceState(),
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
  const projectBefore = JSON.stringify(layouts.get('project:a'));
  const evidenceBefore = JSON.stringify(ctx.evidence);
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.activeWorkspaceID, extras[0]?.id || 'general');
  assert.equal(ctx.confirmations, 1, 'Project departure must confirm exactly once');
  assert.equal(JSON.stringify(layouts.get('project:a')), projectBefore, 'Project layout must be preserved');
  assert.equal(JSON.stringify(ctx.evidence), evidenceBefore, 'navigation must preserve saved identities');
  assert.equal(ctx.state.utilityInstances[0].organizeUnassigned, true);
  assert.equal(ctx.state.utilityInstances[0].selectedFolderID, '');
  assert.equal(ctx.state.utilityInstances[0].folderQuery || '', '');
  assert.equal(ctx.state.utilityInstances[0].codeFilters?.length || 0, 0);
  if (extras.length) assert.equal(ctx.state.utilityInstances[0].id, `${extras[0].id}:saved`, 'reuse Saved pane identity');
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.workspaceRegistry.workspaces.length, 2, 'repeat action must not create duplicate workspaces');
  assert.equal(ctx.state.utilityInstances.length, 1, 'repeat action must not duplicate Saved panes');
  assert.equal(ctx.confirmations, 1, 'current non-Project workspace needs no departure confirmation');
}
{
  const {ctx} = unassignedHarness([{id:'project:a',name:'Alpha',projectID:'a'}]);
  ctx.confirmation = false;
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.activeWorkspaceID, 'project:a');
  assert.equal(ctx.workspaceRegistry.workspaces.length, 1, 'cancel must not create even the technical fallback');
  assert.equal(ctx.focused, 0);
  ctx.confirmWorkspaceTransition = async () => { ctx.currentIdentity++; return true; };
  await vm.runInContext('openUnassignedSaves()', ctx);
  assert.equal(ctx.activeWorkspaceID, 'project:a', 'account change during confirmation must abort');
  assert.equal(ctx.workspaceRegistry.workspaces.length, 1);
}
console.log('Direct Unassigned saves: Project-only, General, ordinary workspace, repeat, cancellation, and account fencing passed.');
