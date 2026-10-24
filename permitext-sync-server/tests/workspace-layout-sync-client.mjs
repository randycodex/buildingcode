import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as layout from '../public/workspace-layout-sync.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const functions=['workspaceLayoutCatalog','writeWorkspaceLayoutCatalog','workspaceLayoutRuntimeKey','scheduleWorkspaceLayoutSync','recordWorkspaceLayoutChange','queueWorkspaceLayoutSync','acknowledgeWorkspaceLayoutSync','reconcileWorkspaceLayouts','applyPendingWorkspaceLayout','enqueueSyncMutation','flushSyncOutbox','syncResultChangesWorkspace'];
const copy=value=>JSON.parse(JSON.stringify(value));
function harness() {
  const storage=new Map(),timers=new Map(),requests=[],broadcasts=[],project={id:'p',clientID:'p',name:'Project'};
  let sequence=0;
  const c=vm.createContext({...layout,Date,Set,Map,Promise,console, projectUpdateBrowserID:()=>"browser-a", rememberProjectUpdate() {}, pendingProjectUpdate:()=>null,
    account:{userID:'u',sessionToken:'token'},generation:1,workspaceRegistryKey:'private:u:registry',activeWorkspaceID:'project:p',
    workspaceLayoutSyncAccount:'u',workspaceLayoutSyncTimer:null,workspaceLayoutBaselines:new Map(),workspaceLayoutApplied:new Map(),
    detachedProjectWindow:false,workspaceRestoreError:null,defaultSyncCodeVersion:'v',permitextSyncSchemaVersion:2,permitextClientCapabilities:[],
    state:{account:{userID:'u'},projectDetails:[project],readers:[],utilityInstances:[],utilities:{},paneWeights:{},paneOrder:[],syncOutbox:[],syncConflicts:[],researchViewState:{drafts:{local:'Keep draft'}}},
    syncedContent:{summary:{latestContinuity:null}},syncFlushPromise:null,syncRetryTimer:null,notebookPendingDraftCount:0,reportDraftMounts:new Map(),
    focused:false,document:{activeElement:{matches:()=>c.focused}},track:{classList:{contains:()=>false},querySelector:()=>null,contains:()=>c.focused},
    navigator:{onLine:true},activeAccount:()=>c.account,activeWorkspaceRecord:()=>({id:c.activeWorkspaceID,projectID:c.activeWorkspaceID.slice(8)}),
    captureAccountRequest:()=>({userID:c.account.userID,generation:c.generation}),isCurrentAccountRequest:id=>id.userID===c.account.userID && id.generation===c.generation,
    requireCurrentAccountRequest:id=>{if(!c.isCurrentAccountRequest(id))throw Error('ACCOUNT_CONTEXT_CHANGED');},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    setTimeout:callback=>{const id=++sequence;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
    requirePrivateWorkspaceWritable(){},mutationKindAndRecord:mutation=>({kind:Object.keys(mutation)[0],record:Object.values(mutation)[0]}),
    syncMutationRecordID:mutation=>mutation.continuity?'u:continuity:v':mutation.project?.id,
    normalizeUtilityInstances:s=>s.utilityInstances,restoreResearchWorkspaceState(){},persistCodeQuestionAccountState(){},
    saveWorkspaceState:()=>c.recordWorkspaceLayoutChange(),markForegroundSyncActivity(){},updateConnectionStatus(){},
    retryRejectedDeletionConflictsOnce(){},prepareSyncOutboxForFlush(){},absorbBulkClearConflicts(){},storeAccountEntitlement(){},
    scheduleSyncOutboxRetry:()=>{},loadSyncedContent:()=>{requests.push({path:'/sync/pull'});},
    postJSON:async(path,body)=>{requests.push({path,body:copy(body)});return {acceptedMutationIDs:body.batch.mutations.map(c.syncMutationRecordID),rejectedMutationIDs:[],latestEventID:10};},
    broadcastForegroundSyncSignal:(type,details)=>broadcasts.push({type,details}),
    window:{setTimeout:callback=>{const id=++sequence;timers.set(id,callback);return id;}}
  });
  vm.runInContext(functions.map(actual).join('\n'),c);
  return {c,storage,timers,requests,broadcasts,fire:()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(callback=>callback());}};
}
{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();
  for(let i=0;i<8;i++){c.state.readers=[{id:'r',chapterID:'1'}];c.state.paneWeights={'reader:r':600+i*10};c.recordWorkspaceLayoutChange();}
  assert.equal(h.timers.size,1,'Rapid layout changes coalesce');
  h.fire();await c.flushSyncOutbox({refresh:true});
  assert.deepEqual(h.requests.map(r=>r.path),['/sync/push'],'Even refresh:true cannot pull after metadata-only saves');
  assert.equal(h.broadcasts[0].type,'workspace-layouts');
  assert.equal(c.state.syncOutbox.length,0);
  assert(!JSON.stringify(h.requests).includes('Keep draft'));
  assert.equal(c.queueWorkspaceLayoutSync(),undefined,'An acknowledged layout is not resent');
  for(let i=0;i<5;i++)c.recordWorkspaceLayoutChange();
  assert.equal(h.timers.size,0,'Unchanged saves do not schedule traffic');
  c.state.readers[0].chapterID='2';c.recordWorkspaceLayoutChange();
  assert.equal(h.timers.size,0,'Reader navigation does not upload a layout');
}
{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();
  c.state.syncOutbox=[{id:'u:u:continuity:v',accountUserID:'u',recordID:'u:continuity:v',mutation:{continuity:{userID:'u',codeVersion:'v',updatedAt:new Date().toISOString(),values:{selectedCodeSectionID:'17'}}},queuedAt:'earlier'}];
  c.queueWorkspaceLayoutSync();
  assert.equal(c.state.syncOutbox.length,1);
  assert.equal(c.state.syncOutbox[0].mutation.continuity.values.selectedCodeSectionID,'17');
  assert(c.state.syncOutbox[0].mutation.continuity.values.workspaceLayoutsJSON);
  await c.flushSyncOutbox({refresh:true});
  assert.deepEqual(h.requests.map(r=>r.path),['/sync/push','/sync/pull'],'Mixed content retains its normal refresh');
}
{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();c.generation++;c.account={userID:'other',sessionToken:'other'};h.fire();
  assert.equal(h.requests.length,0,'Old-account timer cannot send into new account');
  c.queueWorkspaceLayoutSync();assert.equal(c.state.syncOutbox.length,0);
}
{
  const h=harness(),{c}=h;c.navigator.onLine=false;c.recordWorkspaceLayoutChange();h.fire();
  assert.equal(h.requests.length,0);assert.equal(c.state.syncOutbox.length,1,'Offline change is durably queued');
  c.navigator.onLine=true;await c.flushSyncOutbox({refresh:true});
  assert.deepEqual(h.requests.map(r=>r.path),['/sync/push']);
}
{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();
  const old=c.workspaceLayoutCatalog()[0];
  const remote={...copy(old),updatedAt:new Date(Date.parse(old.updatedAt)+1000).toISOString(),layout:{...copy(old.layout),utilities:{calculator:true}}};
  c.syncedContent.summary.latestContinuity={values:{workspaceLayoutsJSON:JSON.stringify([remote])}};
  c.reconcileWorkspaceLayouts();c.track._researchColumnLayout={manual:false,signature:'previous-column-set'};c.focused=true;assert.equal(c.applyPendingWorkspaceLayout(),false);
  c.focused=false;assert.equal(c.applyPendingWorkspaceLayout(),true,'Deferred layout applies when editor is safe');
  assert.equal(c.track._researchColumnLayout,undefined,'Incoming layout invalidates old same-Project geometry');
  assert.equal(c.state.utilities.calculator,true);assert.equal(c.state.researchViewState.drafts.local,'Keep draft');
  assert.equal(c.applyPendingWorkspaceLayout(),false,'Remote layout is applied once');
}
{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();
  const old=c.workspaceLayoutCatalog()[0];
  c.syncedContent.summary.latestContinuity={values:{workspaceLayoutsJSON:JSON.stringify([{...copy(old),updatedAt:new Date(Date.parse(old.updatedAt)+1000).toISOString(),layout:{...copy(old.layout),utilities:{calculator:true}}}])}};
  c.reconcileWorkspaceLayouts();c.state.paneWeights={'reader:r':810};
  assert.equal(c.applyPendingWorkspaceLayout(),false,'A new local action cannot be overwritten by deferred remote state');
  assert.equal(c.workspaceLayoutCatalog()[0].layout.paneWeights['reader:r'],810);
}
// Metadata pulls use a dedicated mount reconciliation, without a project or library refresh.
{
  const calls=[];const c=vm.createContext({activeAccount:()=>({userID:'u'}),syncedContent:{layoutOnly:true},hasCapability:()=>true,pendingProjectUpdate:()=>null,applyPendingWorkspaceLayout:()=>true,
    renderUtilityWorkspace:async options=>calls.push(options),renderWorkspace:()=>{throw Error('Full workspace render forbidden');},currentContentSummary:()=>{throw Error('Project refresh forbidden');}});
  vm.runInContext(actual('refreshSyncedWorkspaceInPlace'),c);
  await c.refreshSyncedWorkspaceInPlace({accountUserID:'u'});
  assert.equal(calls.length,1);assert.equal(calls[0].persist,false);
}
console.log('Workspace layout client passed: batching, deduplication/acknowledgement, mixed content, account fencing, offline retry, deferred edits and metadata-only refresh.');

{
  const h=harness(),{c}=h;c.recordWorkspaceLayoutChange();
  const original=JSON.stringify(c.workspaceLayoutCatalog());
  c.pendingProjectUpdate=()=>({domains:{layout:{version:2}}});
  c.state.utilities.calculator=true;
  c.recordWorkspaceLayoutChange();
  assert.equal(JSON.stringify(c.workspaceLayoutCatalog()),original,'Retained local layout cannot overwrite a pending remote layout during render');
  assert.equal(c.applyPendingWorkspaceLayout({force:true}),false,'Project switches cannot bypass explicit apply');
}
