import assert from 'node:assert/strict';
import vm from 'node:vm';
import { adjacentColumnWidths } from '../public/column-expansion.js';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const collapsed = new Set();
const historyOnly = new Set();
const panes = new Map(['left', 'right'].map(id => [id, {dataset:{paneId:id}, width:600, getBoundingClientRect(){return {width:this.width};}}]));
const state = {paneWeights:{}};
let saves=0, layouts=0, indicators=0, expansionRestores=0;
let restoreWidths=null, workflow='research';
const track = {scrollLeft:0, querySelectorAll(){return [...panes.values()];}, querySelector(selector){return panes.get(selector.match(/data-pane-id="([^"]+)"/)?.[1]);}};
const context = vm.createContext({state, track, adjacentColumnWidths, workspaceColumnExpansion:{restore(){expansionRestores++;restoreWidths?.();}}, CSS:{escape:x=>x},isProAccount:()=>false,
  paneIsCollapsed:id=>collapsed.has(id), assistantHistoryOnlyPane:id=>historyOnly.has(id), defaultPaneWidthForID:()=>600,
  currentColumnWorkflowView:()=> workflow, assistantHistoryWidth:400,
  applyPaneWeight:(pane,id)=>{pane.width=state.paneWeights[id];},
  notifyWorkspaceLayoutChange:()=>layouts++, saveWorkspaceState:()=>saves++,
  scheduleVisibleReaderScrollIndicatorUpdates:()=>indicators++,
  document:{createElement(){return {dataset:{}, attrs:{}, handlers:{}, children:[], classList:{add(){},toggle(){}}, append(child){this.children.push(child);},
    setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];}, addEventListener(k,v){this.handlers[k]=v;}};}}
});
vm.runInContext(['minimumPaneWidthForID','maximumPaneWidthForID','constrainPaneWidth','activePinnedPaneID','singleExpandedDividerEdge','updateAdjacentDividerValue','capturePaneResizeWidths','notebookReferenceResize','resizeAdjacentPanesBy','resizePaneEdgeBy','refreshPaneDividerValue','createDivider'].map(extract).join('\n'),context);

const divider=context.createDivider('left','right');
function press(handle,key,shiftKey=false){let prevented=false;handle.handlers.keydown({key,shiftKey,preventDefault(){prevented=true;}});return prevented;}
function widths(){return [...panes.values()].map(p=>p.width);}
panes.get('left').width=680;
press(divider,'ArrowRight',true);assert.deepEqual(widths(),[760,600]);
press(divider,'ArrowLeft');assert.deepEqual(widths(),[736,600]);
assert.equal(divider.attrs['aria-valuenow'],'736');
assert.equal(divider.attrs['aria-valuetext'],'Column width 736 pixels');
assert.equal(divider.attrs['aria-valuemax'],undefined);
assert.equal(expansionRestores,2);assert.equal(saves,2);assert.equal(layouts,2);
track.scrollLeft=40;press(divider,'ArrowLeft',true);press(divider,'ArrowLeft',true);
assert.deepEqual(widths(),[600,600]);assert.equal(track.scrollLeft,40);
assert.equal(press(divider,'Escape'),false);
collapsed.add('right');press(divider,'ArrowRight');assert.deepEqual(widths(),[624,600]);
collapsed.add('left');divider.handlers.focus();assert.equal(divider.tabIndex,-1);
assert.equal(press(divider,'ArrowRight'),false);
collapsed.clear();
// Absolute widths survive a layout with spare space and hidden retained panes.
panes.set('other',{dataset:{paneId:'other'},width:800,getBoundingClientRect(){return {width:this.width};}});
panes.get('left').width=800;panes.get('right').width=800;
state.paneWeights={left:600,right:600,other:600};press(divider,'ArrowRight',true);
assert.deepEqual(widths(),[880,800,800]);
assert.deepEqual(state.paneWeights,{left:880,right:800,other:800});
panes.set('hidden',{dataset:{paneId:'hidden'},width:0,getBoundingClientRect(){return {width:0};}});
state.paneWeights.hidden=950;press(divider,'ArrowLeft');assert.equal(state.paneWeights.hidden,950);
for(const id of ['reader:one','utility:analysis:one','utility:search:one','utility:saved:one','project:notebook:one','utility:calculator']) {
 const minimum=context.minimumPaneWidthForID(id);
 panes.set(id,{dataset:{paneId:id},width:minimum+500,getBoundingClientRect(){return {width:this.width};}});
 const before=[...panes].filter(([key])=>key!==id).map(([key,p])=>[key,p.width]);
 const handle=context.createDivider(id,'right');press(handle,'ArrowRight',true);
 assert.equal(panes.get(id).width,minimum+580,`${id} grows without a maximum`);
 press(handle,'ArrowLeft',true);context.resizeAdjacentPanesBy(id,'right',-10000,handle);
 assert.equal(panes.get(id).width,minimum);
 assert.deepEqual([...panes].filter(([key])=>key!==id).map(([key,p])=>[key,p.width]),before,`${id} never resizes any neighbor`);
 assert.equal(state.paneWeights[id],minimum,'The selected pixel width is persisted');
}
// Expansion must restore actual widths before the next resize.
restoreWidths=()=>{panes.get('left').width=680;panes.get('right').width=640;restoreWidths=null;};
context.resizeAdjacentPanesBy('left','right',24,divider);
assert.deepEqual([panes.get('left').width,panes.get('right').width],[704,640]);
console.log('Single-column keyboard resizing passed: all pane types, no neighbor changes, minimums, stored widths, collapsed columns and restored expansion.');

workflow='notebook';panes.clear();state.paneWeights={};
for(const [id,width] of [['reader:one',810],['utility:saved:one',450],['project:notes-index:one',300],['project:notebook:one',1500]])
 panes.set(id,{dataset:{paneId:id},width,getBoundingClientRect(){return {width:this.width};}});
track._notebookColumnLayout={resizeMinimums:{'project:notebook:one':800}};
const evidenceNotes=context.createDivider('utility:saved:one','project:notes-index:one');
press(evidenceNotes,'ArrowRight',true);assert.deepEqual(widths(),[810,530,300,1420], 'Notebook keeps its prior notepad-donor rule');
assert.equal(context.maximumPaneWidthForID('utility:saved:one'),600);
const notesEditor=context.createDivider('project:notes-index:one','project:notebook:one');
press(notesEditor,'ArrowRight',true);assert.deepEqual(widths(),[810,530,300,1420], 'Notes remains fixed at 300px');
workflow='report';panes.clear();
for(const id of ['left','right'])panes.set(id,{dataset:{paneId:id},width:800,getBoundingClientRect(){return {width:this.width};}});
press(divider,'ArrowRight',true);assert.deepEqual(widths(),[880,720], 'Non-Research views retain pair resizing');
console.log('Scope isolation passed: Notebook and Report keep their previous resizing rules.');
