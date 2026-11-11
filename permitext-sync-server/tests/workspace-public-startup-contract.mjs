import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createWorkspaceAccessGate } from "../public/workspace-access-gate.js";
import { createWorkspacePaneHydrator } from "../public/workspace-pane-hydration.js";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));const end=source.indexOf("\n}",start);assert.ok(start>=0&&end>start,name);return source.slice(start,end+2);}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const track={children:[],scrollLeft:80,querySelectorAll(){return this.children;}};
function pane(id,loading=false){const status={textContent:""},retry={hidden:true};return{dataset:{paneId:id,...loading?{workspacePaneLoading:"true"}:{}},isConnected:false,parentNode:null,classList:{contains:()=>false,toggle(){}},querySelectorAll:()=>[],setAttribute(){},querySelector:s=>s.includes("retry")?retry:status,replaceWith(next){const i=track.children.indexOf(this);assert.ok(i>=0);track.children[i]=next;next.isConnected=true;next.parentNode=track;this.isConnected=false;this.parentNode=null;}};}
const sync=deferred(),report=deferred();let account="A",pulls=0,privateLoads=0,removeNotebookOnVerify=false;
const notebook=pane("notebook"),reader=pane("reader"),search=pane("search");
let desired=[{id:"reader",publicContent:true,load:()=>reader},{id:"search",publicContent:true,load:()=>search},{id:"notebook",load:()=>{privateLoads++;return notebook;}},{id:"report",load:()=>{privateLoads++;return report.promise;}}];
let syncResult=null,forceResult=null,forcePulls=0,summaryReads=0;
let savedKeys=new Set(["before mutation"]);
const noop=()=>{};
const showColumnLoadingStatus=(status,label)=>{status.textContent=label;};
const sandbox=vm.createContext({createWorkspaceAccessGate,createWorkspacePaneHydrator,showColumnLoadingStatus,Map,Set,JSON,Promise,console,
 track,activeWorkspaceID:"workspace",accountRuntimeGeneration:1,workspaceRenderGeneration:0,syncedContent:null,syncLoadPromise:null,detachedProjectWindow:false,
 state:{utilityInstances:[],utilities:{},readers:[]},suppressReaderScrollRestore:false,
 captureAccountRequest:()=>({account}),isCurrentAccountRequest:id=>id.account===account,activeAccount:()=>({userID:account}),
 ensureSyncedContentForRender:async()=>{pulls++;if(!syncResult)await sync.promise;return syncResult;},
 loadSyncedContent:async()=>{forcePulls++;return forceResult;},
 workspaceSavedEvidenceKeys:()=>{summaryReads++;return new Set(savedKeys);},
 reconcileProjectWorkspaces:noop,enforceProjectRequiredWorkspace:noop,workspaceColumnsRequireProject:()=>false,scopeSavedInstanceToWorkspace:noop,enforceReaderPlanLimit:noop,
 closeDeletedProjectDetails:()=>{if(removeNotebookOnVerify)desired=desired.filter(d=>d.id!=="notebook");},
 restoreResearchWorkspaceState:noop,captureReaderScrollPositions:()=>new Map(),updateReaderPlanControls:noop,
 renderWorkspaceTabs:noop,renderCodeQuestionShellChrome:noop,normalizePaneWeights:noop,activePaneIDs:()=>desired.map(d=>d.id),setUtilityButtonStates:noop,refreshOpenSettingsWorkspace:noop,
 saveWorkspaceState:noop,scheduleWorkspaceStateSaveAfterPaint:noop,startProjectArtifactCheckpointLoop:noop,hasCapability:()=>true,isProAccount:()=>true,
 workspacePaneDescriptors:options=>desired.map(d=>({...d,label:d.id,identity:d.id,accessGate:options.accessGate,close:noop})),
 createWorkspacePaneLoadingShell:descriptor=>{const node=pane(descriptor.id,true);node.dataset.workspacePaneIdentity=descriptor.contentIdentity;node.dataset.workspacePaneAccessIdentity=descriptor.accessIdentity;node.__workspaceAccessGate=descriptor.accessGate;return node;},
 appendPaneSequence(panes){track.children.forEach(n=>{n.isConnected=false;n.parentNode=null;});track.children=panes;panes.forEach(n=>{n.isConnected=true;n.parentNode=track;});},
 applyPaneWeight:noop,ensureWorkspacePanelAccessibleName:noop,preparePaneCollapse:noop,bindPaneDragging:noop,refreshColumnGroupPresentation:noop,refreshPinnedPaneDivider:noop,
 updateCollapsedPaneDividers:noop,bindReaderScrollIndicator:noop,updateReaderScrollIndicator:noop,enhanceSelect:noop,restoreReaderScrollPositions:noop,
 notifyWorkspaceLayoutChange:noop,disposeUnpublishedWorkspacePane:noop,maskUnverifiedWorkspacePane:noop,renderProjectUpdateBadge:noop,
 workflowPaneIsVisible:()=>true,currentColumnWorkflowView:()=>"research",pendingWorkspacePaneRevealID:""
});
const names=["activePinnedPaneID","workspacePrivatePresentationAllowed","finishWorkspacePaneReady","whenWorkspacePaneReady","workspaceAccessGateForRender","workspacePaneRenderContext","workspacePaneContextIsCurrent","getWorkspacePaneHydrator","mountWorkspacePanesIndependently","renderWorkspace","renderUtilityWorkspace","restoreInitialProWorkspace"];
vm.runInContext(`let workspacePaneHydrator=null;let workspaceAccessState=null;const workspacePaneReadyWaiters=new Set();${names.map(actual).join("\n")}`,sandbox);
assert.equal(await sandbox.renderWorkspace(),true,"Startup resolves after shells, while sync remains held.");
await tick();assert.equal(pulls,1);assert.equal(privateLoads,0);assert.equal(track.children[0],reader);assert.equal(track.children[1],search);
assert.equal(await sandbox.whenWorkspacePaneReady("reader"),true);
let reportReady;const waiting=sandbox.whenWorkspacePaneReady("report").then(value=>{reportReady=value;});
await tick();assert.equal(reportReady,undefined,"Private target can wait without delaying public navigation or startup.");
const gate=sandbox.workspaceAccessGateForRender();assert.equal(gate.allowed,false);let upgrades=0;gate.subscribe(g=>{if(g.allowed)upgrades++;});
// Verification removes a persisted obsolete Project before its constructor runs.
removeNotebookOnVerify=true;
const superseding=deferred();superseding.promise.accountIdentity={account:"A"};sandbox.syncLoadPromise=superseding.promise;
syncResult={userID:"A",status:"connected"};sandbox.syncedContent=syncResult;sync.resolve();await tick();
assert.equal(privateLoads,0,"An early return from a superseded sync cannot release private constructors.");
assert.equal(gate.phase,"pending","Verification follows the latest same-account sync instead of declaring an intermediate snapshot unavailable.");
syncResult={userID:"A",workspacePresentationAccess:"verified"};sandbox.syncedContent=syncResult;sandbox.syncLoadPromise=null;superseding.resolve(syncResult);await tick();
assert.equal(privateLoads,1,"Only the surviving private descriptor starts after fresh reconciliation.");
assert.equal(track.children[0],reader);assert.equal(track.children[1],search);assert.equal(upgrades,1);assert.equal(gate.allowed,true);
assert.equal(reportReady,undefined,"Slow Report does not delay the gate or public panes.");
assert.equal(await sandbox.renderUtilityWorkspace(),true,"An unrelated utility transition remains shell-ready.");
assert.equal(sandbox.workspaceAccessGateForRender(),gate,"Full and utility renders share one scoped gate facade.");
assert.equal(pulls,1);
desired=desired.filter(d=>d.id!=="report");await sandbox.renderUtilityWorkspace();await waiting;assert.equal(reportReady,false,"Closing a pending target resolves its waiter safely.");
report.resolve(pane("report"));await tick();assert.equal(track.children.length,2);

// A later denied authority must revoke a formerly allowed gate, without replacing public DOM.
syncResult={userID:"A",workspacePresentationAccess:"unavailable"};sandbox.syncedContent=syncResult;
assert.equal(gate.allowed,false,"Current denial revokes allowance before a render call.");
await sandbox.renderUtilityWorkspace();await tick();assert.equal(gate.allowed,false);assert.equal(track.children[0],reader);assert.equal(track.children[1],search);
forceResult={userID:"A",workspacePresentationAccess:"verified"};
sandbox.loadSyncedContent=async()=>{forcePulls++;syncResult=forceResult;sandbox.syncedContent=forceResult;return forceResult;};
assert.equal(gate.retry(),true);await tick();assert.equal(forcePulls,1);assert.equal(gate.allowed,true);assert.equal(upgrades,2,"Persistent subscriptions upgrade retained controls after recovery.");
assert.equal(track.children[0],reader);assert.equal(track.children[1],search);

// The production facade shares only the synchronous notification's current
// snapshot. It must never reuse construction state or retain it across retries.
assert.equal(summaryReads,0,"Access observers that do not request bookmarks do not build a private summary.");
let retainedNotification;
const notifications=[],peerNotifications=[],nestedNotifications=[];
const stopThrowing=gate.subscribe((_gate,notification)=>{if(notification)throw Error("Observer failed");});
const stopFirst=gate.subscribe((_gate,notification)=>{
 if(!notification)return;
 retainedNotification=notification;
 notifications.push([...notification.savedEvidenceKeys()]);
});
const stopSecond=gate.subscribe((_gate,notification)=>{
 if(!notification)return;
 peerNotifications.push([...notification.savedEvidenceKeys()]);
});
const stopReentrant=gate.subscribe((_gate,notification)=>{
 if(!notification)return;
 const stop=gate.subscribe((_innerGate,nested)=>nestedNotifications.push(nested));
 stop();
});
assert.equal(gate.retry(),true);await tick();
assert.equal(summaryReads,1,"A failing peer does not prevent two bookmark observers sharing one fresh summary.");
assert.equal(retainedNotification.savedEvidenceKeys(),null,"The accessor releases its snapshot before an async observer can resume.");
savedKeys=new Set(["after mutation"]);
assert.equal(gate.retry(),true);await tick();
assert.equal(summaryReads,2,"Every notification rebuilds after a mutation.");
assert.deepEqual(notifications,[["before mutation"],["after mutation"]]);
assert.deepEqual(peerNotifications,notifications,"Every peer receives the same current snapshot.");
assert.deepEqual(nestedNotifications,[undefined,undefined],"Reentrant eager subscriptions cannot capture the outer dispatch snapshot.");
stopThrowing();stopFirst();stopSecond();stopReentrant();
let stalePeerCalls=0;
let keysBeforeRevocation,keysAfterRevocation;
gate.subscribe((_gate,notification)=>{
 if(!notification)return;
 keysBeforeRevocation=[...notification.savedEvidenceKeys()];
 account="B";
 keysAfterRevocation=notification.savedEvidenceKeys();
});
gate.subscribe((_gate,notification)=>{if(notification)stalePeerCalls++;});
assert.equal(gate.retry(),true);await tick();
assert.deepEqual(keysBeforeRevocation,["after mutation"]);
assert.equal(keysAfterRevocation,null,"Revoking the account invalidates even an in-progress notification.");
assert.equal(stalePeerCalls,0,"An account change stops the remaining old-account observers.");

// Identity changes immediately invalidate the old public-control facade.
account="B";assert.equal(gate.allowed,false);
const newGate=sandbox.workspaceAccessGateForRender();assert.notEqual(newGate,gate);await tick();assert.equal(newGate.allowed,false,"An A snapshot cannot authorize B.");
assert.equal(await sandbox.whenWorkspacePaneReady("missing"),false);
const descriptors=actual("workspacePaneDescriptors");assert.match(descriptors,/renderUtilityInstance\(instance, \{ accessGate: options\.accessGate,/);assert.match(descriptors,/renderReader\(reader, \{ scrollPosition: options\.readerScrollPositions\?\.get\(id\), accessGate: options\.accessGate, signal \}\)/);
console.log("Workspace public startup passed: held sync/public publication, shared gate, fresh private reconciliation, shell/target readiness, close cancellation, denial/retry and account isolation.");
console.log("Workspace notification snapshots passed: lazy summary work, throw isolation, one read per dispatch, fresh mutations, immediate release and mid-dispatch account revocation.");

// A Pro reload must resolve the selected workspace before publishing cached
// public columns. Verification can replace the workspace, requiring a new gate.
for (const result of ["empty", "saved", "offline"]) {
  account=`refresh-${result}`;
  sandbox.activeWorkspaceID=`cached-${result}`;
  for (const node of track.children) { node.isConnected=false; node.parentNode=null; }
  track.children=[];
  const refresh=deferred();
  let retiredLoads=0,selectedLoads=0,workspaceSaves=0;
  const retired=pane("retired-reader"),selected=pane("selected-reader");
  const selectedDescriptors=result==="empty"?[]:[{id:"selected-reader",publicContent:true,load:()=>{selectedLoads++;return selected;}}];
  desired=[{id:"retired-reader",publicContent:true,load:()=>{retiredLoads++;return retired;}}];
  sandbox.syncedContent=null;
  sandbox.syncLoadPromise=null;
  sandbox.ensureSyncedContentForRender=async()=>{pulls++;await refresh.promise;return sandbox.syncedContent;};
  sandbox.reconcileProjectWorkspaces=()=>{
    if (result!=="offline") sandbox.activeWorkspaceID=`selected-${result}`;
    desired=selectedDescriptors;
  };
  sandbox.saveWorkspaceState=()=>{workspaceSaves++;};
  const restoring=sandbox.restoreInitialProWorkspace();
  await tick();
  assert.equal(await sandbox.renderWorkspace(),false,"A concurrent full render cannot publish the retired layout during Pro restoration.");
  assert.equal(await sandbox.renderUtilityWorkspace(),false,"A utility refresh cannot publish it either.");
  assert.equal(track.children.length,0);
  assert.equal(retiredLoads,0,"Retired Readers must not even start their content loads.");
  assert.equal(workspaceSaves,0,"Restoration must not save the speculative arrangement.");
  sandbox.syncedContent={userID:account,status:result==="offline"?"offline":"connected",workspacePresentationAccess:result==="offline"?"permitted-offline":"verified"};
  refresh.resolve();
  await restoring;await tick();
  assert.equal(track.children.length,0,"Gate completion must not race startup by publishing columns itself.");
  assert.equal(await sandbox.renderWorkspace(),true);
  await tick();
  assert.deepEqual(track.children.map(node=>node.dataset.paneId),result==="empty"?[]:["selected-reader"]);
  assert.equal(retiredLoads,0);
  assert.equal(selectedLoads,result==="empty"?0:1);
}
const pullsBeforeBypass=pulls;
sandbox.isProAccount=()=>false;
await sandbox.restoreInitialProWorkspace();
sandbox.isProAccount=()=>true;
await sandbox.restoreInitialProWorkspace({publicSection:true});
sandbox.detachedProjectWindow=true;
await sandbox.restoreInitialProWorkspace();
assert.equal(pulls,pullsBeforeBypass,"Free, public section links and detached windows retain independent startup.");
console.log("Pro startup presentation passed: no retired shells or requests, stable replacement selection, empty/saved/offline restoration and public startup bypasses.");

// Sync can select a newly discovered Project while the presentation gate still
// belongs to General. The chooser checks the new ID, but reselecting that row
// must complete its gate/render rather than treating the screen as already open.
vm.runInContext(actual("switchWorkspace"),sandbox);
account="picker-owner";
sandbox.detachedProjectWindow=false;
sandbox.activeWorkspaceID="general";
sandbox.workspaceRegistry={workspaces:[{id:"general"},{id:"project:picker",projectID:"picker",name:"Picker project"}]};
sandbox.syncedContent={userID:account,workspacePresentationAccess:"verified"};
sandbox.ensureSyncedContentForRender=async()=>sandbox.syncedContent;
sandbox.reconcileProjectWorkspaces=noop;
await sandbox.workspaceAccessGateForRender().ready;
assert.equal(sandbox.workspacePrivatePresentationAllowed(),true);
sandbox.activeWorkspaceID="project:picker";
assert.equal(sandbox.workspacePrivatePresentationAllowed(),false,"A General gate cannot authorize the newly selected Project");
for(const node of track.children){node.isConnected=false;node.parentNode=null;}
track.children=[];
const pickerReady=deferred();
let pickerLoads=0,pickerSelections=0;
const pickerPane=pane("picker-evidence");
desired=[{id:"picker-evidence",load:()=>{pickerLoads++;return pickerPane;}}];
sandbox.ensureSyncedContentForRender=async()=>{await pickerReady.promise;return sandbox.syncedContent;};
sandbox.saveWorkspaceState=()=>assert.fail("Reselecting cannot overwrite the current layout");
sandbox.loadWorkspaceSnapshot=()=>assert.fail("Reselecting cannot reload a saved layout over current drafts");
sandbox.confirmWorkspaceTransition=()=>assert.fail("Reselecting does not leave the workspace");
const selecting=sandbox.switchWorkspace("project:picker",{focus:false,onSelected:()=>{
  assert.equal(sandbox.workspacePrivatePresentationAllowed(),true);
  pickerSelections++;
}});
await tick();
assert.equal(pickerLoads,0,"Private constructors remain blocked during reverification");
assert.equal(pickerSelections,0,"The requested tool waits for the selected workspace's own gate");
pickerReady.resolve();
assert.equal(await selecting,true);
await tick();
assert.equal(sandbox.workspacePrivatePresentationAllowed(),true,"Reselecting must repair the obsolete gate");
assert.equal(pickerLoads,1,"The selected workspace's pane must mount");
assert.equal(pickerSelections,1,"Reselecting must complete the requested tool handoff");
assert.deepEqual(track.children.map(node=>node.dataset.paneId),["picker-evidence"]);

// A delayed selection must not open a private tool after identity/navigation
// changes, and a denied authority must never be promoted by a chooser click.
for(const change of ["account","workspace","navigation","denied"]){
  account=`picker-${change}`;
  sandbox.activeWorkspaceID="project:picker";
  sandbox.state.workflowNavigationGeneration=0;
  sandbox.syncedContent={userID:account,workspacePresentationAccess:change==="denied"?"unavailable":"verified"};
  const held=deferred();
  const owner=account;
  sandbox.ensureSyncedContentForRender=async()=>{await held.promise;return {userID:owner,workspacePresentationAccess:change==="denied"?"unavailable":"verified"};};
  let handedOff=0;
  const pending=sandbox.switchWorkspace("project:picker",{focus:false,onSelected:()=>{handedOff++;}});
  await tick();
  if(change==="account")account="another-owner";
  if(change==="workspace")sandbox.activeWorkspaceID="general";
  if(change==="navigation")sandbox.state.workflowNavigationGeneration++;
  held.resolve();
  assert.equal(await pending,false,`${change} must cancel the pending selection`);
  await tick();
  assert.equal(handedOff,0,`${change} cannot open the requested private tool`);
}
console.log("Active-workspace selection passed: stale gate repair, verified pane publication, current drafts retained, requested handoff and account/workspace/navigation/denial fences.");
