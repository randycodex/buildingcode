import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyWorkspaceLayout, normalizeWorkspaceRegistry, captureWorkspaceLayout } from '../public/workspace-state.js';
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const chooser = app.slice(app.indexOf('async function openWorkspaceContextMenu('), app.indexOf('function focusActiveWorkspaceTab('));
const mobileChooser = app.slice(app.indexOf('function openMobileMoreSheet('), app.indexOf('async function openWorkspaceContextMenu('));
for (const source of [chooser, mobileChooser]) {
  assert.doesNotMatch(source, /New workspace|Manage workspaces|Rename workspace|Duplicate workspace|Delete workspace|Workspaces share/);
  assert.match(source, /New Project/);
  assert.match(source, /Manage Projects/);
}
assert.match(app, /function visibleWorkspaceRecords\(\)[\s\S]*?workspace\.projectID && availableProjectIDs\.has\(workspace\.projectID\)/);
assert.doesNotMatch(chooser, /Unassigned saves/);
assert.doesNotMatch(mobileChooser, /Unassigned saves/);
assert.doesNotMatch(mobileChooser, /projectList\.append\(mobileMoreAction\("Unassigned saves"/);
assert.match(app, /const emptyLabel = "Projects"/);
const storage = new Map();
const projects = [{id:'a', name:'Alpha', folderType:'project'}, {id:'b', name:'Beta', folderType:'project'}];
const context = vm.createContext({
 workspaceRegistry: normalizeWorkspaceRegistry({workspaces:[{id:'main',name:'Main'}]}), activeWorkspaceID:'main',
 syncedContent:{status:"disconnected"}, applyStoredWorkspaceLayout(){},
 state:{utilityInstances:[], projectDetails:[]}, detachedProjectWindow:false,
 visibleProjectRecords:x=>x, currentContentSummary:()=>({projects}), activeFolderRecords:x=>x.filter(project=>!project.deletedAt&&!project.archivedAt), mergeProjectsWithOrganizationAccess:x=>x,
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

// A retained legacy inbox can no longer override the selected Project.
context.activeWorkspaceID = 'project:a';
projects.push({id:'a',name:'Alpha',folderType:'project'});
assert.equal(vm.runInContext('scopeSavedInstanceToWorkspace({unassignedInbox:true,selectedFolderID:"b"}).selectedFolderID',context),'a');
assert.equal(vm.runInContext('scopeSavedInstanceToWorkspace({unassignedInbox:true}).organizeUnassigned',context),false);
console.log('Project-only navigation and retired inbox preference normalization passed.');
