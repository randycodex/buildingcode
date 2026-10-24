import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {observeProjectUpdate,projectUpdateNotice,acknowledgeProjectUpdates,readProjectUpdateNotices} from '../public/project-update-notices.js';
const time=n=>`2026-10-23T20:00:0${n}.000Z`;
const event=(n,extra={})=>({projectID:'p',domain:'project',previousProject:{name:'Old'},version:n,updatedAt:time(n),sourceClientID:'other',...extra});
let records=observeProjectUpdate({},event(1),'here');
assert.equal(projectUpdateNotice(records,'p').updatedAt,time(1));
assert.equal(projectUpdateNotice(records,'other-project'),null);
const captured=projectUpdateNotice(records,'p');
records=observeProjectUpdate(records,event(2),'here');
records=acknowledgeProjectUpdates(records,'p',captured.domains);
assert.equal(projectUpdateNotice(records,'p').updatedAt,time(2),'Newer changes arriving during apply remain pending');
records=acknowledgeProjectUpdates(records,'p',projectUpdateNotice(records,'p').domains);
assert.equal(projectUpdateNotice(records,'p'),null,'Successful apply hides the icon');
records=observeProjectUpdate(records,event(2),'here');assert.equal(projectUpdateNotice(records,'p'),null,'Repeat pulls cannot resurrect the icon');
records=observeProjectUpdate(records,event(3,{local:true}),'here');assert.equal(projectUpdateNotice(records,'p'),null);
records=observeProjectUpdate(records,event(4,{sourceClientID:'here'}),'here');assert.equal(projectUpdateNotice(records,'p'),null,'Own browser and same-browser tabs do not alert');
let legacy=observeProjectUpdate({},event(1,{sourceClientID:undefined}),'here');assert.equal(projectUpdateNotice(legacy,'p'),null,'Unknown old records establish a baseline');
legacy=observeProjectUpdate(legacy,event(2,{sourceClientID:undefined}),'here');assert(projectUpdateNotice(legacy,'p'));
let artifacts=observeProjectUpdate({},event(1,{domain:'artifacts',sourceClientID:undefined,local:true}),'here');
artifacts=observeProjectUpdate(artifacts,event(1,{domain:'artifacts',sourceClientID:undefined}),'here');assert.equal(projectUpdateNotice(artifacts,'p'),null,'Local API receipts suppress own artifact revisions');
artifacts=observeProjectUpdate(artifacts,event(2,{domain:'artifacts',sourceClientID:undefined,details:['notebook']}),'here');assert.deepEqual(projectUpdateNotice(artifacts,'p').domains.artifacts.details,['notebook']);
let projects=observeProjectUpdate({},event(1,{domain:'project',local:true,project:{name:'Old',sharedRole:'owner'}}),'here');
projects=observeProjectUpdate(projects,event(2,{domain:'project',project:{name:'New',sharedRole:'viewer'}}),'here');
assert.equal(projects.p.project.name,'Old');assert.equal(projects.p.pendingProject.name,'New');
projects=acknowledgeProjectUpdates(projects,'p',projectUpdateNotice(projects,'p').domains);assert.equal(projects.p.project.name,'New');
assert.deepEqual(readProjectUpdateNotices({getItem:()=>'{bad'},'key'),{});
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
for(const scenario of ['success','cancel','failure','newer','account']) {
  let stored=observeProjectUpdate({},event(2),'here');const calls=[];let current=true;
  const c=vm.createContext({canRunForegroundSync:()=>true,performForegroundSync:async()=>({status:"ready"}),checkVisibleProjectArtifactRevisions:async()=>{},projectUpdatesApplying:new Set(),projectUpdateAutoGuards:new Map(),projectUpdateReviewRequired:new Set(),projectUpdateEditingGeneration:0,projectUpdateRuntimeKey:()=>"u:p",requirePendingProjectUpdateReview(){},activeWorkspaceID:'project:p',activeWorkspaceRecord:()=>({projectID:'p'}),canonicalUpdateProjectID:x=>x,
    activeAccount:()=>({userID:'u'}),captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>current,
    requireCurrentAccountRequest:()=>{if(!current)throw Error('Account changed');},
    projectUpdateIsApplying:()=>false,pendingProjectUpdate:()=>projectUpdateNotice(stored,'p'),projectUpdateRecords:()=>stored,
    renderProjectUpdateBadge(){},confirmWorkspaceTransition:async()=>scenario!=='cancel',
    refreshSyncedWorkspaceInPlace:async()=>{calls.push('render');if(scenario==='failure')throw Error('Offline');if(scenario==='account')current=false;if(scenario==='newer')stored=observeProjectUpdate(stored,event(3),'here');},
    workspaceProject:()=>({id:'p'}),projectDetailsScreen:null,writeProjectUpdateRecords:value=>stored=value,acknowledgeProjectUpdates,
    saveWorkspaceState:()=>calls.push('save'),showWebNotice:async()=>calls.push('error')});
  vm.runInContext(actual('applyPendingProjectUpdates')+'\n'+actual('applyProjectUpdatesFromBadge'),c);await c.applyProjectUpdatesFromBadge();
  if(scenario==='success')assert.equal(projectUpdateNotice(stored,'p'),null);
  else assert(projectUpdateNotice(stored,'p'),scenario);
  if(scenario==='cancel')assert.deepEqual(calls,[]);
}
// Switching projects can temporarily replace the content access gate. The local
// pending indicator must still follow the selected account/project metadata.
{
  const button={hidden:true,setAttribute(){},querySelector:()=>null,classList:{toggle(){}}};
  let selected='p',capable=true,signedIn=true;
  const pending=observeProjectUpdate({},event(2),'here');
  const c=vm.createContext({automaticContentUpdatesEnabled:false,activeAccount:()=>signedIn?{}:null,detachedProjectWindow:false,navigator:{onLine:true},document:{querySelector:()=>button},
    activeWorkspaceRecord:()=>({projectID:selected,name:'Project'}),
    hasCapability:()=>capable,pendingProjectUpdate:id=>projectUpdateNotice(pending,id),
    projectUpdateIsApplying:()=>false,projectUpdateRuntimeKey:()=>selected,projectUpdateAutoApplyBlocker:()=>"editing",projectUpdateReviewRequired:new Set(),projectUpdatesApplying:new Set(),workspacePrivatePresentationAllowed:()=>false});
  vm.runInContext(actual('renderProjectUpdateBadge'),c);
  c.renderProjectUpdateBadge();assert.equal(button.hidden,false);
  assert.match(button.title,/changes awaiting review/);
  selected='other';c.renderProjectUpdateBadge();assert.equal(button.hidden,false,'Manual UPDATE stays available without a pending notice');
  selected='p';c.renderProjectUpdateBadge();assert.equal(button.hidden,false);
  capable=false;c.renderProjectUpdateBadge();assert.equal(button.hidden,false);signedIn=false;c.renderProjectUpdateBadge();assert.equal(button.hidden,true);
}
console.log('Project update notices passed: per-project pending state, timestamps, own-write receipts, legacy baselines, explicit apply, failures, cancellation, account fences, and newer-during-apply preservation.');

const oldLayoutNotice={p:{domains:{layout:{pending:true,version:9,updatedAt:time(9)}}}};
assert.equal(projectUpdateNotice(oldLayoutNotice,'p'),null,'Retired layout notices cannot show the red refresh icon');
assert.equal(observeProjectUpdate(oldLayoutNotice,event(10,{domain:'layout'}),'here'),oldLayoutNotice,'Ignore old-browser layout events');
