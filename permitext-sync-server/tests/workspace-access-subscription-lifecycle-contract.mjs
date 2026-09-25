import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
function actual(name){const start=source.search(new RegExp(`function ${name}\\(`));const end=source.indexOf("\n}",start);assert.ok(start>=0&&end>start,name);return source.slice(start,end+2);}
let observerCallback,observers=0,updates=0;
class Observer{constructor(callback){observerCallback=callback;observers++;}observe(){}}
const listeners=new Set();
const gate={allowed:false,subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},notify(){for(const listener of [...listeners])listener();}};
const context=vm.createContext({WeakRef,WeakMap,Map,Set,FinalizationRegistry:undefined,MutationObserver:Observer,document:{documentElement:{}},Boolean});
vm.runInContext(`const workspaceNodeAccessRecords=new Set();const workspaceNodeAccessCallbacks=new WeakMap();let workspaceNodeAccessObserver=null;const workspaceNodeAccessFinalizer=null;${["releaseWorkspaceNodeAccess","sweepWorkspaceNodeAccess","disposeWorkspaceNodeAccess","workspaceNodeAccessListener","subscribeWorkspaceNodeAccess"].map(actual).join("\n")}globalThis.count=()=>workspaceNodeAccessRecords.size;`,context);
const root={isConnected:false,contains:()=>false},bookmark={isConnected:false};
// Root and extracted marker begin detached. A sweep must not lose the upgrade.
context.subscribeWorkspaceNodeAccess(bookmark,gate,()=>{updates++;},root);
observerCallback();assert.equal(listeners.size,1);assert.equal(context.count(),1);
gate.allowed=true;gate.notify();assert.equal(updates,1);
// Whole-section bookmark is moved out of its discarded inline wrapper. Its
// lifecycle is owned by the bookmark and panel, so it remains subscribed.
root.isConnected=true;bookmark.isConnected=true;observerCallback();gate.notify();assert.equal(updates,2);
bookmark.isConnected=false;observerCallback();assert.equal(listeners.size,0);assert.equal(context.count(),0);
gate.notify();assert.equal(updates,2,"Removed markers no longer receive gate events.");

// Repeated Reader chapter / Search result replacement stays bounded at live controls.
for(let round=0;round<100;round++){
 const nodes=Array.from({length:40},()=>({isConnected:false}));
 for(const node of nodes)context.subscribeWorkspaceNodeAccess(node,gate,()=>{updates++;},root);
 nodes.forEach(node=>{node.isConnected=true;});observerCallback();
 assert.equal(listeners.size,40);gate.notify();
 nodes.forEach(node=>{node.isConnected=false;});observerCallback();
 assert.equal(listeners.size,0);assert.equal(context.count(),0);
}
assert.equal(observers,1,"One workspace observer serves every Reader block/Search result.");

// Never-mounted construction is cleaned deterministically by the renderer's
// discard path, even with FinalizationRegistry disabled.
const abandonedRoot={isConnected:false,contains:()=>false},abandonedControl={isConnected:false};
context.subscribeWorkspaceNodeAccess(abandonedControl,gate,()=>{throw Error("Discarded construction called");},abandonedRoot);
assert.equal(listeners.size,1);context.disposeWorkspaceNodeAccess(abandonedRoot);
assert.equal(listeners.size,0);assert.equal(context.count(),0);gate.notify();

// The panel-level history observer also stops when a whole pane closes.
const searchPanel={isConnected:true,contains:()=>false};
context.subscribeWorkspaceNodeAccess(searchPanel,gate,()=>{updates++;});observerCallback();
searchPanel.isConnected=false;observerCallback();assert.equal(listeners.size,0);

// The gate callback gets a dedicated factory scope, not a closure over node or
// update callback arguments. Callback storage is weakly keyed by the owner.
assert.match(actual("subscribeWorkspaceNodeAccess"),/gate\.subscribe\(workspaceNodeAccessListener\(record\)\)/);
assert.doesNotMatch(actual("workspaceNodeAccessListener"),/\bcallback\b|\broot\b/);
assert.match(actual("renderInlineCommentBox"),/subscribeWorkspaceNodeAccess\(bookmarkButton, gate, updatePrivateControls, options\.panel \|\| wrapper\)/);
assert.match(actual("createSearchResultSaveButton"),/subscribeWorkspaceNodeAccess\(saveButton, panel\.__workspaceAccessGate, initialize, panel\)/);
console.log("Workspace access subscription lifecycle passed: detached construction, extracted bookmark, 4000 removed controls, single observer, explicit unpublished disposal and panel closure; no finalizer required.");
