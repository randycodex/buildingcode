import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createWorkspacePaneHydrator } from "../public/workspace-pane-hydration.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
const track = { children: [], scrollLeft: 127, querySelectorAll() { return this.children; } };
function pane(id, loading=false) {
  const status = { textContent: "Loading" }, retry = { hidden: true };
  return {
    dataset: { paneId: id, ...(loading ? { workspacePaneLoading: "true" } : {}) },
    isConnected: false, parentNode: null, scrollTop: 0, draft: "unchanged unsaved text", selection: [4, 12],
    classList: { contains: () => false }, setAttribute() {}, querySelectorAll: () => [],
    querySelector: (selector) => selector.includes("retry") ? retry : status,
    replaceWith(next) {
      const index = track.children.indexOf(this); assert.ok(index >= 0);
      track.children[index] = next; next.isConnected = true; next.parentNode = track;
      this.isConnected = false; this.parentNode = null;
    }
  };
}
function element() {
  const node = pane("");
  node.children = [];
  node.listeners = new Map();
  node.append = (...children) => node.children.push(...children);
  node.addEventListener = (type, listener) => node.listeners.set(type, listener);
  node.click = () => node.listeners.get("click")?.();
  node.querySelector = (selector) => {
    const className = selector.includes("retry") ? "workspace-pane-retry" : selector.replace(/^\./, "");
    for (const child of node.children) {
      if ((child.className || "").split(" ").includes(className)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  };
  return node;
}
let descriptors = [], generation = 1, accountCurrent = true, appendCalls = 0, capability = true;
const discarded = [];
const sandbox = vm.createContext({
  createWorkspacePaneHydrator, Map, Set, JSON, Promise, track,
  get workspaceRenderGeneration() { return generation; },
  activeWorkspaceID: "workspace", captureAccountRequest: () => ({}), isCurrentAccountRequest: () => accountCurrent,
  workspacePaneDescriptors: () => descriptors.map(item => ({...item})), hasCapability: () => capability,
  document: { createElement: element }, circleXIconSVG: () => "",
  appendPaneSequence(panes) {
    appendCalls++;
    track.children.forEach(p => { p.isConnected=false; p.parentNode=null; });
    track.children=panes;
    panes.forEach(p => { p.isConnected=true; p.parentNode=track; });
  },
  disposeUnpublishedWorkspacePane: (p) => discarded.push(p),
  applyPaneWeight() {}, ensureWorkspacePanelAccessibleName() {}, preparePaneCollapse() {}, bindPaneDragging() {},
  refreshColumnGroupPresentation() {}, updateCollapsedPaneDividers() {}, bindReaderScrollIndicator() {},
  updateReaderScrollIndicator() {}, enhanceSelect() {}, restoreReaderScrollPositions() {}, notifyWorkspaceLayoutChange() {}
});
vm.runInContext(`let workspacePaneHydrator=null; const workspacePaneReadyWaiters=new Set(); ${actual("finishWorkspacePaneReady")}\n${actual("whenWorkspacePaneReady")}\n${actual("workspacePaneContextIsCurrent")}\n${actual("createWorkspacePaneLoadingShell")}\n${actual("getWorkspacePaneHydrator")}\n${actual("mountWorkspacePanesIndependently")}\n globalThis.mount=(context, options={})=>mountWorkspacePanesIndependently(context,{...options,shellReady:true}); globalThis.whenReady=whenWorkspacePaneReady; globalThis.hydrator=()=>workspacePaneHydrator;`,sandbox);
const context = () => ({ key:"account:workspace",workspaceID:"workspace",identity:{},generation });
const mountAndSettle = async (context, options) => { await sandbox.mount(context, options); await sandbox.hydrator().settled(); };
const descriptor = (id, load) => ({id,label:id,identity:id,load,close(){}});

const editor=pane("notebook"); editor.dataset.workspacePaneIdentity="notebook";
track.children=[editor]; editor.isConnected=true; editor.parentNode=track;
const slow=deferred(), search=pane("search");
descriptors=[descriptor("notebook",()=>{throw Error("Healthy editor must not reconstruct");}),descriptor("report",()=>slow.promise),descriptor("search",()=>search)];
let settled=false;
const first=sandbox.mount(context()).then(value=>{settled=true;return value;});
assert.deepEqual(track.children.map(p=>p.dataset.paneId),["notebook","report","search"],"All sized shell slots publish synchronously in requested order.");
const searchReady=sandbox.whenReady("search");
let reportReady=false; const reportTarget=sandbox.whenReady("report").then(value=>{reportReady=value;return value;});
await tick();
assert.equal(await searchReady,true);
assert.equal(reportReady,false,"Target readiness does not wait for unrelated panes.");
assert.equal(track.children[2],search,"Search publishes while Report is held.");
assert.equal(settled,true,"Shell-ready caller resolves while unrelated Report remains pending.");
assert.equal(track.children[0],editor); assert.equal(editor.draft,"unchanged unsaved text"); assert.deepEqual(editor.selection,[4,12]);
assert.equal(appendCalls,1,"Completion must not republish the whole pane sequence.");
assert.equal(track.scrollLeft,127);
const report=pane("report"); slow.resolve(report); await first; await sandbox.hydrator().settled(); assert.equal(await reportTarget,true);
assert.equal(track.children[1],report); assert.equal(appendCalls,1);

// Explicit refresh creates a fresh attempt even when persistent content identity matches.
const refreshed=pane("search"); descriptors=[descriptor("notebook",()=>editor),descriptor("report",()=>report),descriptor("search",()=>refreshed)];
generation++;
await mountAndSettle(context(),{refreshPaneIDs:["search"]});
assert.equal(track.children[2],refreshed); assert.equal(track.children[0],editor);

// Settings refresh restores its previous internal scroll without moving neighbors.
const settings=pane("utility:settings"); settings.scrollTop=340;
descriptors=[descriptor("notebook",()=>editor),descriptor("utility:settings",()=>settings)]; generation++;
await mountAndSettle(context());
const settingsReplacement=pane("utility:settings");
descriptors=[descriptor("notebook",()=>editor),descriptor("utility:settings",()=>settingsReplacement)]; generation++;
await mountAndSettle(context(),{refreshPaneIDs:["utility:settings"]});
assert.equal(settingsReplacement.scrollTop,340); assert.equal(track.children[0],editor);

// Close/reopen the same ID: the first network result must never replace the new shell.
const old=deferred(), replacement=deferred();
descriptors=[descriptor("notebook",()=>editor),descriptor("late",()=>old.promise)]; generation++;
await sandbox.mount(context()); const oldBatch=sandbox.hydrator().settled(); const closedTarget=sandbox.whenReady("late"); await tick();
descriptors=[descriptor("notebook",()=>editor)]; generation++; await mountAndSettle(context()); assert.equal(await closedTarget,false);
descriptors=[descriptor("notebook",()=>editor),descriptor("late",()=>replacement.promise)]; generation++;
await sandbox.mount(context()); const newBatch=sandbox.hydrator().settled(); const newTarget=sandbox.whenReady("late"); await tick();
const stale=pane("late"), current=pane("late"); old.resolve(stale); await oldBatch;
assert.ok(discarded.includes(stale)); assert.notEqual(track.children[1],stale);
replacement.resolve(current); await newBatch; assert.equal(await newTarget,true); assert.equal(track.children[1],current);

// Rejection and retry are confined to one slot.
let attempts=0; const recovered=pane("failure");
descriptors=[descriptor("notebook",()=>editor),descriptor("failure",()=>{ if (++attempts===1) throw Error("synthetic failure"); return recovered; })]; generation++;
const failureMount=sandbox.mount(context()); const failedTarget=sandbox.whenReady("failure"); await failureMount; await sandbox.hydrator().settled(); assert.equal(await failedTarget,false); const failureShell=track.children[1];
assert.equal(failureShell.querySelector("retry").hidden,false);
assert.equal(await sandbox.whenReady("failure"),false,"A late readiness subscriber sees terminal failure immediately.");
failureShell.querySelector("retry").click(); assert.equal(failureShell.dataset.workspacePaneUnavailable,"false"); const retryTarget=sandbox.whenReady("failure"); await sandbox.hydrator().settled(); assert.equal(await retryTarget,true);
assert.equal(track.children[1],recovered); assert.equal(track.children[0],editor);

// Workspace transition placeholders are not healthy rendered panes.
const transition=pane("transition"); transition.classList.contains=(name)=>name==="workspace-switch-placeholder";
track.children=[transition]; transition.isConnected=true; transition.parentNode=track;
const opened=pane("transition"); descriptors=[descriptor("transition",()=>opened)]; generation++;
await mountAndSettle(context()); assert.equal(track.children[0],opened);

// Capability changes refresh locked surfaces, while unchanged capabilities reuse them.
let accessLoads=0;
descriptors=[descriptor("access",()=>{accessLoads++; return pane("access");})]; generation++;
await mountAndSettle(context()); const enabled=track.children[0];
generation++; await mountAndSettle(context()); assert.equal(track.children[0],enabled);
capability=false; generation++; await mountAndSettle(context()); assert.notEqual(track.children[0],enabled);
assert.equal(accessLoads,2);

// Use the actual descriptor builder to exercise pane-specific editor access.
const editorCapabilities = new Map([['projects',true],['notebook',true],['professional-exports',true],['research',true],['saved-work',true],['code-question-workspace',true]]);
sandbox.hasCapability = key => editorCapabilities.get(key) ?? false;
const editorBuilds = new Map();
const buildEditor = (id, required) => {
  editorBuilds.set(id,(editorBuilds.get(id)||0)+1);
  const result=pane(id); result.privateContent=editorCapabilities.get(required) ? `Private ${id}` : null;
  return result;
};
const noop=()=>{};
const descriptorContext=vm.createContext({
  state:{utilities:{},utilityInstances:[],readers:[]},detachedProjectWindow:false,
  genericWorkboardIsOpen:()=>true,genericWorkboardIdentity:{id:'board'},
  paneIDForProjectWorkboard:()=> 'workboard',workboardProjectID:p=>p.id,renderProjectWorkboard:()=>buildEditor('workboard','projects'),closeGenericWorkboard:noop,
  openProjectDetails:()=>[{id:'project'}],projectDetailKey:p=>p.id,
  projectHasOpenNotebook:()=>true,paneIDForProjectNotebook:()=> 'notebook',renderProjectNotebook:()=>buildEditor('notebook','notebook'),closeProjectNotebook:noop,
  projectHasOpenReportDraft:()=>true,paneIDForProjectReportDraft:()=> 'report',renderProjectReportDraft:()=>buildEditor('report','professional-exports'),closeProjectReportDraft:noop,
  releaseSurfaceVisibility:{coordination:false},openCodeQuestionPaneIDs:()=>[],researchConversationPaneIsOpen:()=>false,supplementalResearchConversationIDs:[]
});
vm.runInContext(actual('workspacePaneDescriptors'),descriptorContext);
descriptors=descriptorContext.workspacePaneDescriptors();generation++;await mountAndSettle(context());
const liveEditors=new Map(track.children.map(node=>[node.dataset.paneId,node]));
for(const [id,node] of liveEditors) node.draft=`Unsaved ${id} text`;
for(const unrelated of ['research','saved-work','code-question-workspace']) {
 editorCapabilities.set(unrelated,false);generation++;await mountAndSettle(context());
 for(const [id,node] of liveEditors) {
  assert.equal(track.children.find(item=>item.dataset.paneId===id),node,`${unrelated} cannot replace ${id}`);
  assert.equal(node.draft,`Unsaved ${id} text`);
  assert.equal(editorBuilds.get(id),1,`${unrelated} cannot reconstruct the dirty ${id} controller`);
 }
}
for(const [id,required] of [['notebook','notebook'],['report','professional-exports'],['workboard','projects']]) {
 const prior=track.children.find(node=>node.dataset.paneId===id);
 editorCapabilities.set(required,false);generation++;
 await sandbox.mount(context());
 assert.equal(prior.isConnected,false,`Revoked ${required} removes the previously private pane before replacement loads`);
 await sandbox.hydrator().settled();
 const locked=track.children.find(node=>node.dataset.paneId===id);
 assert.notEqual(locked,prior);assert.equal(locked.privateContent,null);assert.equal(editorBuilds.get(id),2);
}

// Account invalidation blocks stale publication.
const privateLoad=deferred(); descriptors=[descriptor("private",()=>privateLoad.promise)]; generation++;
await sandbox.mount(context()); const privateBatch=sandbox.hydrator().settled(); await tick(); accountCurrent=false;
const privatePane=pane("private"); privateLoad.resolve(privatePane); await privateBatch;
assert.ok(discarded.includes(privatePane)); assert.notEqual(track.children[0],privatePane);
console.log("Workspace pane orchestration contract passed: actual mounting/publication helpers, independent completion, editor identity, refresh, close/reopen, retry, transition and account guards.");
