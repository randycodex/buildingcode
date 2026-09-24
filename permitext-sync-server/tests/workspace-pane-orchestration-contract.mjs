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
let descriptors = [], generation = 1, accountCurrent = true, appendCalls = 0, capability = true;
const discarded = [];
const sandbox = vm.createContext({
  createWorkspacePaneHydrator, Map, Set, JSON, Promise, track,
  get workspaceRenderGeneration() { return generation; },
  activeWorkspaceID: "workspace", isCurrentAccountRequest: () => accountCurrent,
  workspacePaneDescriptors: () => descriptors.map(item => ({...item})), hasCapability: () => capability,
  createWorkspacePaneLoadingShell: (descriptor) => { const result=pane(descriptor.id,true); result.dataset.workspacePaneIdentity=descriptor.contentIdentity; result.dataset.workspacePaneAccessIdentity=descriptor.accessIdentity; return result; },
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
vm.runInContext(`let workspacePaneHydrator=null; ${actual("workspacePaneContextIsCurrent")}\n${actual("getWorkspacePaneHydrator")}\n${actual("mountWorkspacePanesIndependently")}\n globalThis.mount=mountWorkspacePanesIndependently; globalThis.hydrator=()=>workspacePaneHydrator;`,sandbox);
const context = () => ({ key:"account:workspace",workspaceID:"workspace",identity:{},generation });
const descriptor = (id, load) => ({id,label:id,identity:id,load,close(){}});

const editor=pane("notebook"); editor.dataset.workspacePaneIdentity="notebook";
track.children=[editor]; editor.isConnected=true; editor.parentNode=track;
const slow=deferred(), search=pane("search");
descriptors=[descriptor("notebook",()=>{throw Error("Healthy editor must not reconstruct");}),descriptor("report",()=>slow.promise),descriptor("search",()=>search)];
let settled=false;
const first=sandbox.mount(context()).then(value=>{settled=true;return value;});
assert.deepEqual(track.children.map(p=>p.dataset.paneId),["notebook","report","search"],"All sized shell slots publish synchronously in requested order.");
await tick();
assert.equal(track.children[2],search,"Search publishes while Report is held.");
assert.equal(settled,false,"Awaited caller still waits for hydration batch.");
assert.equal(track.children[0],editor); assert.equal(editor.draft,"unchanged unsaved text"); assert.deepEqual(editor.selection,[4,12]);
assert.equal(appendCalls,1,"Completion must not republish the whole pane sequence.");
assert.equal(track.scrollLeft,127);
const report=pane("report"); slow.resolve(report); await first;
assert.equal(track.children[1],report); assert.equal(appendCalls,1);

// Explicit refresh creates a fresh attempt even when persistent content identity matches.
const refreshed=pane("search"); descriptors=[descriptor("notebook",()=>editor),descriptor("report",()=>report),descriptor("search",()=>refreshed)];
generation++;
await sandbox.mount(context(),{refreshPaneIDs:["search"]});
assert.equal(track.children[2],refreshed); assert.equal(track.children[0],editor);

// Settings refresh restores its previous internal scroll without moving neighbors.
const settings=pane("utility:settings"); settings.scrollTop=340;
descriptors=[descriptor("notebook",()=>editor),descriptor("utility:settings",()=>settings)]; generation++;
await sandbox.mount(context());
const settingsReplacement=pane("utility:settings");
descriptors=[descriptor("notebook",()=>editor),descriptor("utility:settings",()=>settingsReplacement)]; generation++;
await sandbox.mount(context(),{refreshPaneIDs:["utility:settings"]});
assert.equal(settingsReplacement.scrollTop,340); assert.equal(track.children[0],editor);

// Close/reopen the same ID: the first network result must never replace the new shell.
const old=deferred(), replacement=deferred();
descriptors=[descriptor("notebook",()=>editor),descriptor("late",()=>old.promise)]; generation++;
const oldBatch=sandbox.mount(context()); await tick();
descriptors=[descriptor("notebook",()=>editor)]; generation++; await sandbox.mount(context());
descriptors=[descriptor("notebook",()=>editor),descriptor("late",()=>replacement.promise)]; generation++;
const newBatch=sandbox.mount(context()); await tick();
const stale=pane("late"), current=pane("late"); old.resolve(stale); await oldBatch;
assert.ok(discarded.includes(stale)); assert.notEqual(track.children[1],stale);
replacement.resolve(current); await newBatch; assert.equal(track.children[1],current);

// Rejection and retry are confined to one slot.
let attempts=0; const recovered=pane("failure");
descriptors=[descriptor("notebook",()=>editor),descriptor("failure",()=>{ if (++attempts===1) throw Error("synthetic failure"); return recovered; })]; generation++;
await sandbox.mount(context()); const failureShell=track.children[1];
assert.equal(failureShell.querySelector("retry").hidden,false);
assert.equal(sandbox.hydrator().retry("failure"),true); await sandbox.hydrator().settled();
assert.equal(track.children[1],recovered); assert.equal(track.children[0],editor);

// Workspace transition placeholders are not healthy rendered panes.
const transition=pane("transition"); transition.classList.contains=(name)=>name==="workspace-switch-placeholder";
track.children=[transition]; transition.isConnected=true; transition.parentNode=track;
const opened=pane("transition"); descriptors=[descriptor("transition",()=>opened)]; generation++;
await sandbox.mount(context()); assert.equal(track.children[0],opened);

// Capability changes refresh locked surfaces, while unchanged capabilities reuse them.
let accessLoads=0;
descriptors=[descriptor("access",()=>{accessLoads++; return pane("access");})]; generation++;
await sandbox.mount(context()); const enabled=track.children[0];
generation++; await sandbox.mount(context()); assert.equal(track.children[0],enabled);
capability=false; generation++; await sandbox.mount(context()); assert.notEqual(track.children[0],enabled);
assert.equal(accessLoads,2);

// Account invalidation blocks stale publication.
const privateLoad=deferred(); descriptors=[descriptor("private",()=>privateLoad.promise)]; generation++;
const privateBatch=sandbox.mount(context()); await tick(); accountCurrent=false;
const privatePane=pane("private"); privateLoad.resolve(privatePane); await privateBatch;
assert.ok(discarded.includes(privatePane)); assert.notEqual(track.children[0],privatePane);
console.log("Workspace pane orchestration contract passed: actual mounting/publication helpers, independent completion, editor identity, refresh, close/reopen, retry, transition and account guards.");
