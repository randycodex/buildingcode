import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start,source.indexOf('\n}',start)+2);
}
let reads = 0, account = 'a';
let currentProjectID = 'project-a';
let snapshot = {projects:[{id:'project-a',name:'Project A'}],projectSections:[],savedItems:[],annotations:[]};
const frames = [], hydration = [], mergeInputs = [];
const nodes = new Map();
const panel = {classList:{add(){}},querySelector:selector=>{
  if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);
}};
const c = vm.createContext({
  currentContentSummary:()=>{reads++;return account === 'a' ? snapshot : {projects:[{id:'project-b',name:'Project B'}],savedItems:[],projectSections:[],annotations:[]};},
  activeWorkspaceRecord:()=>({projectID:currentProjectID}),
  activeFolderRecords:projects=>projects,mergeProjectsWithOrganizationAccess:projects=>{mergeInputs.push(projects);return [...projects];},
  projectRecordID:project=>project.id,folderIsProject:()=>true,
  hasCapability:()=>true,normalizeSavedInstance:i=>i,paneIDForUtilityInstance:()=> 'saved',
  savedTemplate:{},renderTemplate:()=>panel,applyPaneWeight(){},clear(){},renderSavedPlanUsage(){},
  consolidatedSavedAnnotations:x=>x,requestAnimationFrame:fn=>frames.push(fn),
  hydrateSavedPanelWhenConnected:(...args)=>hydration.push(args),
});
vm.runInContext(['workspaceProject','scopeSavedInstanceToWorkspace','renderSavedProjects','renderSaved'].map(actual).join('\n'),c);
const instance = {};
await c.renderSaved(instance);
assert.equal(reads,1,'Selected Project Saved setup uses one summary instead of three');
assert.equal(instance.selectedFolderID,'project-a');
assert.equal(nodes.get('.saved-projects-section').hidden,true);
assert.ok(mergeInputs.every(projects=>projects===snapshot.projects),'Guards use raw snapshot projects, not already organization-merged values');
// A later render sees changed source state rather than any previous snapshot.
snapshot = {...snapshot,projects:[{id:'project-a',name:'Renamed Project'}]};
await c.renderSaved(instance);assert.equal(reads,2);
assert.equal(mergeInputs.at(-1),snapshot.projects);
account='b';currentProjectID='project-b';
await c.renderSaved(instance);assert.equal(reads,3);
assert.equal(instance.selectedFolderID,'project-b');
// Queued hydration remains its original independent path; no summary is handed across rAF.
frames[0]();
assert.deepEqual(Object.keys(hydration[0].at(-1)),['reuseVerifiedSync']);
assert.equal(hydration[0].at(-1).reuseVerifiedSync,true);
currentProjectID=null;
assert.equal(c.workspaceProject(),null);
assert.equal(reads,3,'General workspace default remains lazy');
currentProjectID='project-b';assert.equal(c.workspaceProject().id,'project-b');assert.equal(reads,4);

// Actual synchronous reconciliation also uses one fresh summary for both lookups.
let reconcileReads=0;
const project={id:'project',name:'Project'};
const r=vm.createContext({workspaceRegistry:{workspaces:[{id:'workspace',projectID:'project',name:'Project'}]},detachedProjectWindow:false,
  currentContentSummary:()=>{reconcileReads++;return {projects:[project]};},
  activeFolderRecords:x=>x,mergeProjectsWithOrganizationAccess:x=>x,folderIsProject:()=>true,projectRecordID:p=>p.id,
  activeWorkspaceRecord:()=>({projectID:'project'}),syncedContent:{status:'connected'},projectIsArchived:()=>false,
  persistWorkspaceRegistry:()=>assert.fail('Unchanged reconciliation must not persist'),
});
vm.runInContext(actual('reconcileProjectWorkspaces'),r);
r.reconcileProjectWorkspaces();assert.equal(reconcileReads,1);
r.reconcileProjectWorkspaces();assert.equal(reconcileReads,2,'Next reconciliation must read again');
console.log('Saved synchronous summary reuse passed: three reads become one, fresh render/account state, lazy general workspace, no hydration snapshot, reconciliation two reads become one.');

// Both real startup paths pass this helper directly to forEach. Numeric callback
// indices must never be interpreted as the optional project snapshot.
const restoredInstances = [{id:'saved-one'}, {id:'saved-two'}];
const beforeCallbacks = reads;
assert.doesNotThrow(() => restoredInstances.forEach(c.scopeSavedInstanceToWorkspace));
assert.deepEqual(restoredInstances.map(instance=>instance.selectedFolderID),['project-b','project-b']);
assert.equal(reads-beforeCallbacks,2);
assert.equal(restoredInstances.every(instance=>instance.organizeUnassigned===false),true);
assert.equal((source.match(/\.forEach\(scopeSavedInstanceToWorkspace\)/g)||[]).length,2,
  'Account gate and workspace renderer callback paths remain covered');
console.log('Saved startup callback compatibility passed for two restored panes and forEach indices zero/one.');
