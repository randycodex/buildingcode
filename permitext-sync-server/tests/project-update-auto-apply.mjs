import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {projectUpdateApplyBlocker} from '../public/project-update-policy.js';
import {observeProjectUpdate,projectUpdateNotice,acknowledgeProjectUpdates,requireProjectUpdateReview} from '../public/project-update-notices.js';
const idle={ready:true,visible:true,online:true,focusedEditor:false,dirtyEditor:false,pendingWrites:false,conflict:false,dialogOpen:false,interacting:false};
assert.equal(projectUpdateApplyBlocker(idle),'');
for(const key of ['ready','visible','online'])assert.equal(projectUpdateApplyBlocker({...idle,[key]:false}),'unavailable');
for(const key of ['dirtyEditor','pendingWrites','conflict'])assert.equal(projectUpdateApplyBlocker({...idle,[key]:true}),'review');
for(const key of ['dialogOpen','interacting'])assert.equal(projectUpdateApplyBlocker({...idle,[key]:true}),'busy');
assert.equal(projectUpdateApplyBlocker({...idle,focusedEditor:true}),'editing');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const event=(n,extra={})=>({projectID:'p',domain:'artifacts',version:n,updatedAt:`2026-10-23T20:00:0${n}Z`,details:['notebook'],...extra});
const baseline=observeProjectUpdate({},event(1,{local:true}),'here');
function harness(scenario='idle') {
 let stored=observeProjectUpdate(baseline,event(2),'here'),current=true,blocker='';const calls=[];
 const c=vm.createContext({projectUpdatesApplying:new Set(),projectUpdateAutoGuards:new Map(),projectUpdateReviewRequired:new Set(),projectUpdateEditingGeneration:0,
  activeWorkspaceID:'w',activeWorkspaceRecord:()=>({projectID:'p'}),canonicalUpdateProjectID:x=>x,projectUpdateRuntimeKey:()=> 'u:p',
  captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>current,projectUpdateAutoApplyBlocker:()=>blocker,
  pendingProjectUpdate:()=>projectUpdateNotice(stored,'p'),projectUpdateRecords:()=>stored,writeProjectUpdateRecords:next=>stored=next,
  acknowledgeProjectUpdates,renderProjectUpdateBadge(){},workspaceProject:()=>({id:'p'}),projectDetailKey:p=>p.id,projectDetailsScreen:null,
  requirePendingProjectUpdateReview(){c.projectUpdateReviewRequired.add('u:p');stored=requireProjectUpdateReview(stored,'p');},
  confirmWorkspaceTransition:async()=>{calls.push('confirm');return scenario!=='cancel';},
  refreshSyncedWorkspaceInPlace:()=>assert.fail('Note-only updates must not refresh the whole Project'),
  refreshProjectArtifactConsumers:async(id,domains,options)=>{
   calls.push('artifact-read');assert.equal(id,'p');assert.deepEqual(Array.from(domains),['notebook']);
   assert.equal(options.shouldApply(),true);
   if(scenario==='focus-race') {c.projectUpdateEditingGeneration++;blocker='editing';}
   if(scenario==='account')current=false;
   if(scenario==='workspace')c.activeWorkspaceID='other';
   if(scenario==='failure')throw Error('Offline');
   if(scenario==='newer')stored=observeProjectUpdate(stored,event(3),'here');
   if(options.shouldApply())calls.push('render');
  },saveWorkspaceState:()=>calls.push('save'),showWebNotice:async()=>calls.push('dialog')});
 vm.runInContext(actual('applyPendingProjectUpdates'),c);
 return {c,calls,notice:()=>projectUpdateNotice(stored,'p'),stored:()=>stored,setBlocker:value=>blocker=value};
}
for(const scenario of ['idle','focus-race','account','workspace','failure','newer']) {
 const h=harness(scenario);await h.c.applyPendingProjectUpdates({automatic:true});
 assert(!h.calls.includes('confirm')&&!h.calls.includes('dialog'),'Automatic application never saves/discards edits or opens a dialog');
 if(scenario==='idle')assert.equal(h.notice(),null);else assert(h.notice(),scenario);
 if(['focus-race','account','workspace'].includes(scenario))assert(!h.calls.includes('render'),'A late response cannot replace content after editing or navigation starts');
 if(scenario==='newer')assert.equal(h.notice().domains.artifacts.version,3);
 if(scenario==='failure'){
  assert.equal(h.notice().reviewRequired,true,'A failed automatic refresh keeps its review requirement across reload');
  const count=h.calls.length;await h.c.applyPendingProjectUpdates({automatic:true});assert.equal(h.calls.length,count,'Failure cannot start a request loop');
 }
}
for(const blocker of ['editing','review','busy','unavailable']) {
 const h=harness();h.setBlocker(blocker);await h.c.applyPendingProjectUpdates({automatic:true});assert.deepEqual(h.calls,[]);assert(h.notice());
}
const manual=harness();manual.c.projectUpdateReviewRequired.add('u:p');await manual.c.applyPendingProjectUpdates();assert(manual.calls.includes('confirm'));assert.equal(manual.notice(),null);
const cancelled=harness('cancel');await cancelled.c.applyPendingProjectUpdates();assert(cancelled.notice().reviewRequired);assert.deepEqual(cancelled.calls,['confirm']);
// One local debounce coalesces notices. Acknowledged notices and blocked editors
// create no timer and therefore no repeated consumer requests or extra polling.
{
 const timers=new Map();let sequence=0,applied=0,pending=true,blocked='';
 const c=vm.createContext({projectUpdateAutoApplyReady:true,projectUpdateAutoApplyTimer:null,projectUpdateReviewRequired:new Set(),projectUpdatesApplying:new Set(),activeWorkspaceID:'w',
  pendingProjectUpdate:()=>pending?{domains:{artifacts:{}}}:null,projectUpdateRuntimeKey:()=> 'u:p',projectUpdateAutoApplyBlocker:()=>blocked,
  captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id),
  applyPendingProjectUpdates:async()=>{applied++;pending=false;}});
 vm.runInContext(actual('scheduleProjectUpdateAutoApply'),c);
 for(let i=0;i<10;i++)c.scheduleProjectUpdateAutoApply();assert.equal(timers.size,1);
 await [...timers.values()][0]();timers.clear();assert.equal(applied,1);
 c.scheduleProjectUpdateAutoApply();assert.equal(timers.size,0);
 pending=true;blocked='editing';c.scheduleProjectUpdateAutoApply();assert.equal(timers.size,0);
}
let review=requireProjectUpdateReview(observeProjectUpdate(baseline,event(2),'here'),'p');
review=JSON.parse(JSON.stringify(review));assert.equal(projectUpdateNotice(review,'p').reviewRequired,true);
review=acknowledgeProjectUpdates(review,'p',projectUpdateNotice(review,'p').domains);assert.equal(projectUpdateNotice(review,'p'),null);
review=observeProjectUpdate(review,event(3),'here');assert.equal(projectUpdateNotice(review,'p').reviewRequired,false,'New idle changes do not inherit an old review requirement');
console.log('Automatic Project updates passed: idle targeted refresh, focused/dirty editors, pending writes/conflicts/dialogs, race/account/workspace fences, newer revisions, durable review, failures, manual apply, and no polling/request loops.');

// Actual consumers must check eligibility again after their API requests finish.
for (const marker of ['  refreshReportArtifacts = async (options', '  refreshReportSources = async (options', '    refreshNotebookCards = async (options']) {
 const start=source.indexOf(marker),indent=marker.startsWith('    ')?'    ':'  ';
 assert(start>=0,marker);const end=source.indexOf('\n'+indent+'};',start)+indent.length+4;
 let allowed=true;const resolvers=[];
 const c=vm.createContext({disposed:false,deletingReport:false,deletingVersionID:null,historyMutationGeneration:0,reportSourcesRefreshGeneration:0,
  isCurrentAccountRequest:()=>true,requestIdentity:1,projectID:'p',drafts:['retained'],sources:['retained'],cards:['retained'],
  reportRequest:()=>new Promise(resolve=>resolvers.push(resolve)),notebookRequest:()=>new Promise(resolve=>resolvers.push(resolve))});
 vm.runInContext(source.slice(start,end),c);
 const name=marker.trim().split(' ')[0];const pending=c[name]({shouldApply:()=>allowed});
 allowed=false;resolvers.forEach(resolve=>resolve({drafts:[],sources:[],reports:[],cards:[]}));await pending;
 assert.deepEqual(Array.from(c.drafts),['retained']);assert.deepEqual(Array.from(c.sources),['retained']);assert.deepEqual(Array.from(c.cards),['retained']);
}
console.log('Actual Note/Report consumers preserve their mounted content when editing starts during a request.');

let concurrent=observeProjectUpdate(baseline,event(2),'here');
concurrent=requireProjectUpdateReview(concurrent,'p');
concurrent=observeProjectUpdate(concurrent,event(3,{local:true,details:undefined}),'here');
assert(projectUpdateNotice(concurrent,'p'),'A local save cannot acknowledge an unapplied remote update');
assert.deepEqual(projectUpdateNotice(concurrent,'p').domains.artifacts.details,['notebook'],'Preserve the consumer refresh plan across local receipts');
assert.equal(projectUpdateNotice(concurrent,'p').reviewRequired,true);

const durable=harness();durable.c.writeProjectUpdateRecords(requireProjectUpdateReview(durable.stored(),'p'));
await durable.c.applyPendingProjectUpdates({automatic:true});assert.deepEqual(durable.calls,[],'A durable review flag blocks automatic application even before its UI is rendered');
