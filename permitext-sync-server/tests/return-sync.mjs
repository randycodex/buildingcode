import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {bindReturnSyncChecks, returnSyncIdleMs, observeReturnRevision, returnRevisionIsNewer,
  acknowledgeReturnRevision, hasNewReturnContent} from '../public/return-sync.js';
import {observeProjectUpdate, projectUpdateNotice} from '../public/project-update-notices.js';
import {normalizeAccountArtifactRevisionEnvelope, accountArtifactRevisionKey, reduceAccountArtifactRevision} from '../public/project-artifact-checkpoints.js';

const settle = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
const window = new EventTarget(), document = new EventTarget();
let now=0, focused=true, online=true, checks=0, account='u:p', fail=false;
document.visibilityState='visible'; document.hasFocus=()=>focused;
window.setTimeout=window.setInterval=()=>assert.fail('Return checks cannot schedule background work');
const dispose=bindReturnSyncChecks({window,document,now:()=>now,context:()=>account,eligible:()=>online,
  check:async()=>{ checks++; if(fail) throw Error('offline'); }});
assert.equal(checks,0,'Binding does not add a startup request');
now+=30*60_000;await settle();assert.equal(checks,0,'Thirty idle minutes make no requests');
document.dispatchEvent(new Event('pointerdown'));
window.dispatchEvent(new Event('focus'));
document.dispatchEvent(new Event('visibilitychange'));await settle();
assert.equal(checks,1,'First interaction after lunch checks once, coalescing lifecycle events');
for(let i=0;i<100;i++){now+=1000;document.dispatchEvent(new Event('pointermove'));}
await settle();assert.equal(checks,1,'Continuing to work does not poll');
focused=false;window.dispatchEvent(new Event('blur'));document.visibilityState='hidden';
document.dispatchEvent(new Event('visibilitychange'));now+=returnSyncIdleMs;
document.dispatchEvent(new Event('pointerdown'));await settle();assert.equal(checks,1);
focused=true;document.visibilityState='visible';window.dispatchEvent(new Event('focus'));
document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(checks,2);
now+=30_000;window.dispatchEvent(new Event('blur'));now+=10_000;window.dispatchEvent(new Event('focus'));
await settle();assert.equal(checks,2,'Short window switches do not check');
now+=returnSyncIdleMs;online=false;document.dispatchEvent(new Event('keydown'));await settle();assert.equal(checks,2);
online=true;window.dispatchEvent(new Event('online'));await settle();assert.equal(checks,3,'Offline return checks once after reconnect');
now+=returnSyncIdleMs;fail=true;document.dispatchEvent(new Event('wheel'));await settle();assert.equal(checks,4);
now+=30*60_000;await settle();assert.equal(checks,4,'Failed checks have no background retries');
account='other:p';document.dispatchEvent(new Event('keydown'));await settle();assert.equal(checks,4,'Account switches reset the idle window');
dispose();now+=returnSyncIdleMs;document.dispatchEvent(new Event('pointerdown'));await settle();assert.equal(checks,4);

let revision=observeReturnRevision(null,10);
revision=observeReturnRevision(revision,11,{write:true});
assert.equal(returnRevisionIsNewer(revision,11),false,'Own saves do not show SYNC');
revision=observeReturnRevision(revision,13,{write:true});
assert.equal(returnRevisionIsNewer(revision,13),true,'A remote save at 12 survives a later own receipt at 13');
revision=acknowledgeReturnRevision(revision,13);
assert.equal(returnRevisionIsNewer(revision,13),false);
assert.equal(returnRevisionIsNewer(revision,14),true);
const stamp='2026-10-24T12:00:00Z';
assert.equal(hasNewReturnContent({records:[{recordID:'own',updatedAt:stamp}]},new Map([['own','2026-10-24T12:00:00.000Z']])),false);
assert.equal(hasNewReturnContent({records:[{recordID:'remote',updatedAt:stamp}]},new Map([['own',stamp]])),true);

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
for(const scenario of ['unchanged','cached','own','remote','artifact','research','failure','account','workspace','hidden']) {
  let current=true,visible=true,stored={},resolve;
  const calls=[];
  const baseline={storageOwnerUserID:'u',projectID:'p',revision:2,domains:['notebook'],updatedAt:stamp};
  const c=vm.createContext({Map,Set,Date,returnSyncCheckPromise:null,syncFlushPromise:null,syncLoadPromise:null,
    canRunForegroundSync:()=>visible,captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>current,
    activeWorkspaceID:'w',activeWorkspaceRecord:()=>({projectID:'p'}),canonicalUpdateProjectID:x=>x,
    syncedContent:{status:scenario==='cached'?'offline':'connected',latestEventID:3,mutations:[]},
    currentProjectArtifactScope:()=>({visibleProjectIDs:new Set(['p']),researchVisible:true}),
    returnSyncContentReceipts:new Map(scenario==='own'?[['own',{updatedAt:stamp,eventID:4}]]:[]),
    returnSyncArtifactRevisions:new Map([['p',observeReturnRevision(null,2)],['account',observeReturnRevision(null,1)]]),
    returnSyncRevisionKey:e=>e.projectID||'account',returnRevisionIsNewer,hasNewReturnContent,
    hasNewReturnArtifact:e=>returnRevisionIsNewer(c.returnSyncArtifactRevisions.get(e.projectID||'account'),e.revision),
    syncMutationRecordID:()=>assert.fail('No content body is needed for an empty baseline'),
    postResearch:async(path,body)=>{
      calls.push(path);assert.equal(body.includeContentChanges,true);assert.equal(body.sinceEventID,3);
      assert.deepEqual(Array.from(body.projectIDs),['p']);
      await new Promise(r=>resolve=r);
      if(scenario==='failure')throw Error('offline');
      if(scenario==='account')current=false;
      if(scenario==='workspace')c.activeWorkspaceID='other';
      if(scenario==='hidden')visible=false;
      return {checkedAt:stamp,contentChanges:{latestEventID:4,records:['own','remote'].includes(scenario)?[{recordID:scenario,updatedAt:stamp}]:[]},
        projects:[{...baseline,revision:scenario==='artifact'?3:2}],
        account:{storageOwnerUserID:'u',revision:scenario==='research'?2:1,updatedAt:stamp}};
    },
    rememberProjectUpdate:event=>stored=observeProjectUpdate(stored,event,'here')});
  vm.runInContext(actual('checkUpdatesOnReturn'),c);
  const first=c.checkUpdatesOnReturn(),second=c.checkUpdatesOnReturn();
  await settle();assert.equal(calls.length,1,'Only one compact request, including during overlapping returns');
  resolve();await first;await second;
  const notice=projectUpdateNotice(stored,'p');
  assert.equal(Boolean(notice),['remote','artifact','research'].includes(scenario),scenario);
  assert.deepEqual(calls,['/projects/artifacts/checkpoint'],'Detection never pulls content or downloads documents');
}
// Opening an existing Note is not itself a new edit from another computer.
{
 const revisions=new Map();
 const c=vm.createContext({Date,returnSyncArtifactRevisions:revisions,
   syncedContent:{pulledAt:'2026-10-24T12:00:00Z'},returnSyncRevisionKey:e=>e.projectID,
   rememberReturnSyncRevision:e=>revisions.set(e.projectID,observeReturnRevision(null,e.revision)),returnRevisionIsNewer});
 vm.runInContext(actual('hasNewReturnArtifact'),c);
 assert.equal(c.hasNewReturnArtifact({projectID:'p',revision:4,updatedAt:'2026-10-24T11:59:00Z'}),false);
 assert.equal(c.hasNewReturnArtifact({projectID:'p',revision:5,updatedAt:'2026-10-24T12:01:00Z'}),true);
}
// A manual account-revision check queues Research for the explicit application
// phase; it must not fetch history once here and a second time during SYNC.
{
 let stored={};
 const scope={accountUserID:'u',workspaceID:'w',researchVisible:true};
 const c=vm.createContext({currentProjectArtifactScope:()=>scope,
   normalizeAccountArtifactRevisionEnvelope,accountArtifactRevisionKey,reduceAccountArtifactRevision,
   accountArtifactRevisions:new Map(),activeWorkspaceRecord:()=>({projectID:'p'}),
   rememberProjectUpdate:event=>stored=observeProjectUpdate(stored,event,'here'),
   enqueueProjectArtifactConsumerRefresh:()=>assert.fail('Metadata check cannot read Research history')});
 vm.runInContext(actual('applyAccountArtifactRevisionEnvelope'),c);
 await c.applyAccountArtifactRevisionEnvelope({storageOwnerUserID:'u',revision:2,domains:['research'],updatedAt:stamp},{manual:true});
 assert.equal(projectUpdateNotice(stored,'p').domains.research.version,2);
}
console.log('Return sync passed: idle/no polling, first interaction and tab return, cooldown/coalescing, offline/failure/account resets, own receipts, concurrent remote saves, metadata-only detection, and account/workspace/visibility fences.');
