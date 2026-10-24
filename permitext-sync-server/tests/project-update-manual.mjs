import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {automaticContentUpdatesEnabled} from '../public/project-update-policy.js';
import {observeProjectUpdate,projectUpdateNotice,acknowledgeProjectUpdates,requireProjectUpdateReview} from '../public/project-update-notices.js';
import {normalizeProjectArtifactRevisionEnvelope,normalizeAccountArtifactRevisionEnvelope,accountArtifactRevisionKey,reduceProjectArtifactRevisions,projectArtifactRevisionKey} from '../public/project-artifact-checkpoints.js';
import {foregroundSyncSchedule,syncCheckpointRequiresFullPull} from '../public/sync-state.js';

assert.equal(automaticContentUpdatesEnabled,false);
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const event=n=>({projectID:'p',domain:'artifacts',version:n,updatedAt:`2026-10-24T04:00:0${n}Z`,details:['notebook'],manual:true});

// Busy feedback follows the actual in-flight operation and clears afterward.
for(const [syncing,online] of [[false,true],[true,true],[false,false]]) {
 const attributes={},classes=new Set();
 const button={setAttribute:(key,value)=>attributes[key]=value,querySelector:()=>null,classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
 const c=vm.createContext({automaticContentUpdatesEnabled,document:{querySelector:()=>button},navigator:{onLine:online},
  activeWorkspaceRecord:()=>({projectID:'p',name:'Test project'}),hasCapability:()=>false,activeAccount:()=>({userID:'u'}),detachedProjectWindow:false,
  projectUpdateRuntimeKey:()=> 'u:p',projectUpdatesApplying:new Set(syncing?['u:p']:[])});
 vm.runInContext(actual('renderProjectUpdateBadge'),c);c.renderProjectUpdateBadge();
 assert.equal(button.hidden,false);assert.equal(button.disabled,syncing||!online);
 assert.equal(classes.has('is-syncing'),syncing);assert.equal(attributes['aria-busy'],String(syncing));
 assert.equal(button.title,!online?'Connect to the internet to sync':`${syncing?'Syncing':'Sync project changes'} · Test project`);
}

// Even an old open tab must use the cheap checkpoint before downloading a full
// sync snapshot. Unchanged data needs no full pull; changed data still does.
for(const changed of [false,true]) {
 const calls=[];
 const content={status:'ready',latestEventID:7,contentMapVersion:9,entitlementFingerprint:'pro'};
 const c=vm.createContext({canRunForegroundSync:()=>true,foregroundSyncPromise:null,
  captureAccountRequest:()=>1,requireCurrentAccountRequest(){},isCurrentAccountRequest:()=>true,activeAccount:()=>({userID:'u',sessionToken:'token'}),
  syncedContent:content,syncLoadPromise:null,foregroundSyncLastFullPullAt:0,foregroundSyncSchedule,syncCheckpointRequiresFullPull,
  flushPendingNotebookImages:async()=>{},flushPendingNotebookDrafts:async()=>{},flushSyncOutbox:async()=>({}),syncResultChangesWorkspace:()=>false,
  postJSON:async route=>{assert.equal(route,'/sync/checkpoint');calls.push('checkpoint');return {...content,changed};},
  loadSyncedContent:async()=>{calls.push('full');return {...content,latestEventID:8};},
  migrateLegacyArchivedProjects:async()=>false,refreshSyncedWorkspaceInPlace:async()=>calls.push('render'),updateConnectionStatus(){}});
 vm.runInContext(actual('performForegroundSync'),c);await c.performForegroundSync({manual:true,shouldApply:()=>true});
 assert.deepEqual(calls,changed?['checkpoint','full','render']:['checkpoint']);
}

// A local edit can share a Project revision with an unseen remote Note edit.
// Its receipt must not suppress the next manual check of mounted consumers.
{
 const scope={accountUserID:'u',workspaceID:'w',visibleProjectIDs:new Set(['p'])};
 const envelope=revision=>normalizeProjectArtifactRevisionEnvelope({projectID:'p',storageOwnerUserID:'u',revision,domains:['notebook'],updatedAt:`2026-10-24T04:00:0${revision}Z`},scope);
 let stored=observeProjectUpdate({}, {...event(1),local:true}, 'here');
 const revisions=new Map([[projectArtifactRevisionKey(envelope(1)),envelope(1)]]);
 const c=vm.createContext({automaticContentUpdatesEnabled,projectArtifactRevisions:revisions,accountArtifactRevisions:new Map(),
  currentProjectArtifactScope:()=>scope,normalizeProjectArtifactRevisionEnvelope,normalizeAccountArtifactRevisionEnvelope,accountArtifactRevisionKey,reduceProjectArtifactRevisions,
  broadcastForegroundSyncSignal(){},pendingProjectUpdate:()=>projectUpdateNotice(stored,'p'),
  rememberProjectUpdate:change=>stored=observeProjectUpdate(stored,change,'here'),
  enqueueProjectArtifactConsumerRefresh:()=>assert.fail('Manual revision checks must defer consumer reads to explicit application')});
 vm.runInContext(actual('observeLocalProjectArtifactRevisions')+'\n'+actual('applyProjectArtifactRevisionEnvelopes'),c);
 c.observeLocalProjectArtifactRevisions({projects:[envelope(3)]});
 assert.equal(revisions.get(projectArtifactRevisionKey(envelope(1))).revision,1);
 const result=await c.applyProjectArtifactRevisionEnvelopes([envelope(3)],{manual:true});
 assert.equal(result.refreshes.length,1);assert.equal(projectUpdateNotice(stored,'p').domains.artifacts.version,3);
}

// Repeated lifecycle/mount notifications and cross-tab announcements must never
// schedule a timer or query remote content. Reconnect can still upload our edits.
{
 let writes=0,stops=0;
 const c=vm.createContext({automaticContentUpdatesEnabled,
  stopForegroundSyncLoop:()=>stops++,stopProjectArtifactCheckpointLoop:()=>stops++,
  canRunForegroundSync:()=>true,flushPendingContentWrites:async()=>writes++,
  setTimeout:()=>assert.fail('Manual mode scheduled polling'),
  performForegroundSync:()=>assert.fail('Manual mode fetched remote content'),
  checkVisibleProjectArtifactRevisions:()=>assert.fail('Manual mode checked revisions')});
 vm.runInContext(['startForegroundSyncLoop','startProjectArtifactCheckpointLoop','scheduleProjectUpdateAutoApply','handleForegroundSyncSignal'].map(actual).join('\n'),c);
 c.startForegroundSyncLoop({immediate:true});c.startProjectArtifactCheckpointLoop({immediate:true});c.scheduleProjectUpdateAutoApply();
 for(const type of ['sync-invalidated','sync-complete','project-artifact-revisions','leader-released']) await c.handleForegroundSyncSignal({type});
 assert.equal(stops,2);assert.equal(writes,1);
}
{
 const calls=[];
 const c=vm.createContext({captureAccountRequest:()=>1,requireCurrentAccountRequest:()=>{},
  flushPendingNotebookImages:async()=>calls.push('images'),flushPendingNotebookDrafts:async()=>calls.push('drafts'),
  flushSyncOutbox:async options=>{assert.equal(options.refresh,false);calls.push('writes');}});
 vm.runInContext(actual('flushPendingContentWrites'),c);await c.flushPendingContentWrites();
 assert.deepEqual(calls,['images','drafts','writes']);
}

function harness(scenario='changed') {
 let stored={},current=true;const calls=[];
 const c=vm.createContext({automaticContentUpdatesEnabled,
  projectUpdatesApplying:new Set(),projectUpdateAutoGuards:new Map(),projectUpdateReviewRequired:new Set(),projectUpdateEditingGeneration:0,
  activeWorkspaceID:'w',activeWorkspaceRecord:()=>({projectID:'p'}),canonicalUpdateProjectID:x=>x,projectUpdateRuntimeKey:()=> 'u:p',
  captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>current,canRunForegroundSync:()=>scenario!=='offline',
  pendingProjectUpdate:()=>projectUpdateNotice(stored,'p'),projectUpdateRecords:()=>stored,writeProjectUpdateRecords:next=>stored=next,
  acknowledgeProjectUpdates,renderProjectUpdateBadge(){},workspaceProject:()=>({id:'p'}),projectDetailKey:p=>p.id,projectDetailsScreen:null,
  requirePendingProjectUpdateReview(){stored=requireProjectUpdateReview(stored,'p');},
  confirmWorkspaceTransition:async()=>{calls.push('confirm');return scenario!=='cancel';},
  performForegroundSync:async options=>{calls.push('sync-check');assert(options.shouldApply());
   if(scenario==='editing')c.projectUpdateEditingGeneration++;
   if(scenario==='account')current=false;
   if(scenario==='workspace')c.activeWorkspaceID='other';
   if(scenario==='check-failure')throw Error('offline');
   return {status:'ready'};
  },
  checkVisibleProjectArtifactRevisions:async options=>{calls.push('artifact-check');assert(options.manual);assert(options.shouldApply());
   if(scenario!=='unchanged')stored=observeProjectUpdate(stored,event(2),'here');
   assert.equal(await c.applyProjectUpdatesFromBadge(),false,'Double click cannot duplicate requests');
  },
  refreshSyncedWorkspaceInPlace:()=>assert.fail('A Note update cannot download/render the whole project'),
  refreshProjectArtifactConsumers:async(id,domains,options)=>{calls.push('artifact-read');assert.equal(id,'p');assert.deepEqual(Array.from(domains),['notebook']);assert(options.shouldApply());
   if(scenario==='read-failure')throw Error('offline');
   if(scenario==='newer')stored=observeProjectUpdate(stored,event(3),'here');
   if(scenario==='editing-during-read')c.projectUpdateEditingGeneration++;
   if(options.shouldApply())calls.push('render');
  },saveWorkspaceState:()=>calls.push('save'),showWebNotice:async()=>calls.push('error')});
 vm.runInContext(actual('applyPendingProjectUpdates')+'\n'+actual('applyProjectUpdatesFromBadge'),c);
 return {c,calls,notice:()=>projectUpdateNotice(stored,'p')};
}
for(const scenario of ['changed','unchanged','offline','cancel','editing','editing-during-read','account','workspace','check-failure','read-failure','newer']) {
 const h=harness(scenario);const applied=await h.c.applyProjectUpdatesFromBadge();
 if(scenario==='changed') {assert.equal(applied,true);assert.equal(h.notice(),null);assert(h.calls.includes('render'));}
 if(scenario==='unchanged') {assert.equal(applied,true);assert.deepEqual(h.calls,['confirm','sync-check','artifact-check']);}
 if(scenario==='offline')assert.deepEqual(h.calls,[]);
 if(scenario==='cancel')assert.deepEqual(h.calls,['confirm']);
 if(['editing','editing-during-read','account','workspace'].includes(scenario))assert(!h.calls.includes('render'));
 if(scenario==='read-failure') {assert(h.notice());assert(h.calls.includes('error'));}
 if(scenario==='check-failure')assert(h.calls.includes('error'));
 if(scenario==='newer')assert.equal(h.notice().domains.artifacts.version,3);
 if(scenario==='editing-during-read')assert(h.notice(),'Interrupted reads remain available for the next UPDATE');
}
const disabled=harness();assert.equal(await disabled.c.applyPendingProjectUpdates({automatic:true}),false);assert.deepEqual(disabled.calls,[]);
console.log('Manual content updates: no periodic or cross-tab downloads, durable local uploads, one explicit version check, first-use refresh, unchanged fast path, double-click coalescing, cancellation, errors, newer revisions and account/workspace/editor races passed.');
