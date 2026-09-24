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
function pane(id,loading=false){const status={textContent:""},retry={hidden:true};return{dataset:{paneId:id,...loading?{workspacePaneLoading:"true"}:{}},isConnected:false,parentNode:null,classList:{contains:()=>false},querySelectorAll:()=>[],setAttribute(){},querySelector:s=>s.includes("retry")?retry:status,replaceWith(next){const i=track.children.indexOf(this);assert.ok(i>=0);track.children[i]=next;next.isConnected=true;next.parentNode=track;this.isConnected=false;this.parentNode=null;}};}
const sync=deferred(),report=deferred();let account="A",pulls=0,privateLoads=0,removeNotebookOnVerify=false;
const notebook=pane("notebook"),reader=pane("reader"),search=pane("search");
let desired=[{id:"reader",publicContent:true,load:()=>reader},{id:"search",publicContent:true,load:()=>search},{id:"notebook",load:()=>{privateLoads++;return notebook;}},{id:"report",load:()=>{privateLoads++;return report.promise;}}];
let syncResult=null,forceResult=null,forcePulls=0;
const noop=()=>{};
const sandbox=vm.createContext({createWorkspaceAccessGate,createWorkspacePaneHydrator,Map,Set,JSON,Promise,console,
 track,activeWorkspaceID:"workspace",accountRuntimeGeneration:1,workspaceRenderGeneration:0,syncedContent:null,syncLoadPromise:null,
 state:{utilityInstances:[],utilities:{},readers:[]},suppressReaderScrollRestore:false,
 captureAccountRequest:()=>({account}),isCurrentAccountRequest:id=>id.account===account,activeAccount:()=>({userID:account}),
 ensureSyncedContentForRender:async()=>{pulls++;if(!syncResult)await sync.promise;return syncResult;},
 loadSyncedContent:async()=>{forcePulls++;return forceResult;},
 reconcileProjectWorkspaces:noop,scopeSavedInstanceToWorkspace:noop,enforceReaderPlanLimit:noop,
 closeDeletedProjectDetails:()=>{if(removeNotebookOnVerify)desired=desired.filter(d=>d.id!=="notebook");},
 restoreResearchWorkspaceState:noop,captureReaderScrollPositions:()=>new Map(),updateReaderPlanControls:noop,
 renderWorkspaceTabs:noop,renderCodeQuestionShellChrome:noop,normalizePaneWeights:noop,activePaneIDs:()=>desired.map(d=>d.id),setUtilityButtonStates:noop,
 saveWorkspaceState:noop,scheduleWorkspaceStateSaveAfterPaint:noop,startProjectArtifactCheckpointLoop:noop,hasCapability:()=>true,
 workspacePaneDescriptors:options=>desired.map(d=>({...d,label:d.id,identity:d.id,accessGate:options.accessGate,close:noop})),
 createWorkspacePaneLoadingShell:descriptor=>{const node=pane(descriptor.id,true);node.dataset.workspacePaneIdentity=descriptor.contentIdentity;node.dataset.workspacePaneAccessIdentity=descriptor.accessIdentity;node.__workspaceAccessGate=descriptor.accessGate;return node;},
 appendPaneSequence(panes){track.children.forEach(n=>{n.isConnected=false;n.parentNode=null;});track.children=panes;panes.forEach(n=>{n.isConnected=true;n.parentNode=track;});},
 applyPaneWeight:noop,ensureWorkspacePanelAccessibleName:noop,preparePaneCollapse:noop,bindPaneDragging:noop,refreshColumnGroupPresentation:noop,
 updateCollapsedPaneDividers:noop,bindReaderScrollIndicator:noop,updateReaderScrollIndicator:noop,enhanceSelect:noop,restoreReaderScrollPositions:noop,
 notifyWorkspaceLayoutChange:noop,disposeUnpublishedWorkspacePane:noop,maskUnverifiedWorkspacePane:noop
});
const names=["workspacePrivatePresentationAllowed","finishWorkspacePaneReady","whenWorkspacePaneReady","workspaceAccessGateForRender","workspacePaneRenderContext","workspacePaneContextIsCurrent","getWorkspacePaneHydrator","mountWorkspacePanesIndependently","renderWorkspace","renderUtilityWorkspace"];
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

// Identity changes immediately invalidate the old public-control facade.
account="B";assert.equal(gate.allowed,false);
const newGate=sandbox.workspaceAccessGateForRender();assert.notEqual(newGate,gate);await tick();assert.equal(newGate.allowed,false,"An A snapshot cannot authorize B.");
assert.equal(await sandbox.whenWorkspacePaneReady("missing"),false);
const descriptors=actual("workspacePaneDescriptors");assert.match(descriptors,/renderUtilityInstance\(instance, \{ accessGate: options\.accessGate,/);assert.match(descriptors,/renderReader\(reader, \{ scrollPosition: options\.readerScrollPositions\?\.get\(id\), accessGate: options\.accessGate, signal \}\)/);
console.log("Workspace public startup passed: held sync/public publication, shared gate, fresh private reconciliation, shell/target readiness, close cancellation, denial/retry and account isolation.");
