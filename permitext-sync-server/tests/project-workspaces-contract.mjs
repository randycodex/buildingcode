import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyWorkspaceLayout, normalizeWorkspaceRegistry, captureWorkspaceLayout } from '../public/workspace-state.js';
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const storage = new Map();
const projects = [{id:'a', name:'Alpha', folderType:'project'}, {id:'b', name:'Beta', folderType:'project'}];
const context = vm.createContext({
 workspaceRegistry: normalizeWorkspaceRegistry({workspaces:[{id:'main',name:'Main'}]}), activeWorkspaceID:'main',
 state:{utilityInstances:[], projectDetails:[]}, detachedProjectWindow:false,
 currentContentSummary:()=>({projects}), activeFolderRecords:x=>x, mergeProjectsWithOrganizationAccess:x=>x,
 folderIsProject:x=>x.folderType==='project', projectRecordID:x=>x.id, projectIdentity:x=>({...x}),
 projectDetailMatches:(a,b)=>a.id===b.id, emptyWorkspaceLayout, captureWorkspaceLayout,
 newUtilityInstance:(key, props)=>({key,id:'saved',...props}), paneIDForUtilityInstance:()=> 'utility:saved',
 workspaceSnapshotKey:id=>id, loadWorkspaceSnapshot:id=>storage.has(id)?JSON.parse(storage.get(id)):null,
 workspaceLayoutWithoutCodeQuestionData:x=>x,
 localStorage:{getItem:id=>storage.get(id),setItem:(id,v)=>storage.set(id,v)},
 persistWorkspaceRegistry(){}, Date,
});
vm.runInContext('function activeWorkspaceRecord(){return workspaceRegistry.workspaces.find(w=>w.id===activeWorkspaceID)}\n'+app.slice(app.indexOf('function workspaceProject()'),app.indexOf('async function createNewWorkspace()')),context);
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
