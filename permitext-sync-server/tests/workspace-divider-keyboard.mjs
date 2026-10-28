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
let restoreWidths=null;
const track = {scrollLeft:0, querySelectorAll(){return [...panes.values()];}, querySelector(selector){return panes.get(selector.match(/data-pane-id="([^"]+)"/)?.[1]);}};
const context = vm.createContext({state, track, adjacentColumnWidths, workspaceColumnExpansion:{restore(){expansionRestores++;restoreWidths?.();}}, CSS:{escape:x=>x},isProAccount:()=>false,
  paneIsCollapsed:id=>collapsed.has(id), assistantHistoryOnlyPane:id=>historyOnly.has(id), defaultPaneWidthForID:()=>600,
  currentColumnWorkflowView:()=> 'notebook', assistantHistoryWidth:400,
  applyPaneWeight:(pane,id)=>{pane.width=state.paneWeights[id];},
  notifyWorkspaceLayoutChange:()=>layouts++, saveWorkspaceState:()=>saves++,
  scheduleVisibleReaderScrollIndicatorUpdates:()=>indicators++,
  document:{createElement(){return {dataset:{}, attrs:{}, handlers:{}, children:[], classList:{add(){},toggle(){}}, append(child){this.children.push(child);},
    setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];}, addEventListener(k,v){this.handlers[k]=v;}};}}
});
vm.runInContext(['minimumPaneWidthForID','maximumPaneWidthForID','constrainPaneWidth','activePinnedPaneID','singleExpandedDividerEdge','updateAdjacentDividerValue','capturePaneResizeWidths','resizeAdjacentPanesBy','resizePaneEdgeBy','refreshPaneDividerValue','createDivider'].map(extract).join('\n'),context);
const divider=context.createDivider('left','right');
assert.equal(divider.children.length,0,'Column dividers only resize; Reader creation remains in the toolbar.');

function press(handle,key,shiftKey=false){let prevented=false;handle.handlers.keydown({key,shiftKey,preventDefault(){prevented=true;}});return prevented;}
function widths(){return [...panes.values()].map(p=>p.width);}
panes.get('left').width=680;
assert.equal(press(divider,'ArrowLeft'),true);
assert.deepEqual(widths(),[656,624]);
assert.equal(expansionRestores,1,'Resizing restores an expanded column before capturing visible widths.');
assert.equal(divider.attrs['aria-valuenow'],'51');
assert.equal(divider.attrs['aria-valuetext'],'Left column 656 pixels; right column 624 pixels');
assert.equal(press(divider,'ArrowRight',true),true);
assert.deepEqual(widths(),[680,600]); // Shared helper preserves the pair total when either minimum is reached.
assert.equal(saves,2);assert.equal(layouts,2);assert.equal(indicators,2);
// At a pair minimum, keyboard resizing preserves both the total and scroll position.
panes.get('left').width=600;panes.get('right').width=600;track.scrollLeft=40;
press(divider,'ArrowLeft',true);assert.deepEqual(widths(),[600,600]);assert.equal(track.scrollLeft,40);
assert.equal(press(divider,'Escape'),false);assert.equal(saves,3);
// A collapsed neighbor delegates to the existing edge handler, in the right direction.
collapsed.add('left');divider.handlers.focus();assert.equal(divider.attrs['aria-valuemax'],undefined);press(divider,'ArrowLeft');assert.deepEqual(widths(),[600,624]);
assert.equal(divider.attrs['aria-valuetext'],'Column width 624 pixels');
collapsed.add('right');divider.handlers.focus();assert.equal(divider.tabIndex,-1);assert.equal(divider.attrs['aria-valuenow'],undefined);assert.equal(press(divider,'ArrowRight'),false);assert.equal(saves,4);
collapsed.clear();divider.handlers.focus();assert.equal(divider.tabIndex,0);assert.equal(divider.attrs['aria-valuemax'],'100');const leftEdge=context.createDivider('', 'left');
press(leftEdge,'ArrowLeft',true);assert.deepEqual(widths(),[680,624]);
press(leftEdge,'ArrowRight',true);assert.deepEqual(widths(),[600,624]);
assert.equal(leftEdge.children.length,0,'Outer resize handles retain their existing behavior');
const rightEdge=context.createDivider('right','');press(rightEdge,'ArrowRight');assert.deepEqual(widths(),[600,648]);
// Missing DOM panes do not persist phantom widths.
panes.delete('right');press(divider,'ArrowRight');assert.equal(saves,7);
// A three-column layout has already shared spare viewport space. Resizing a
// pair must preserve the unrelated column's visible width, not its old basis.
panes.set('right',{dataset:{paneId:'right'},width:800,getBoundingClientRect(){return {width:this.width};}});
panes.set('other',{dataset:{paneId:'other'},width:800,getBoundingClientRect(){return {width:this.width};}});
panes.get('left').width=800;
state.paneWeights={left:600,right:600,other:600};
press(divider,'ArrowRight',true);
assert.deepEqual(widths(),[880,720,800]);
assert.deepEqual(state.paneWeights,{left:880,right:720,other:800},'Shared space is retained without redistributing it during a resize.');
panes.set('hidden',{dataset:{paneId:'hidden'},width:0,getBoundingClientRect(){return {width:0};}});
state.paneWeights.hidden=950;
press(divider,'ArrowLeft');
assert.equal(state.paneWeights.hidden,950,'A retained column in another working view keeps its saved width.');
historyOnly.add('right');
const historyWidth=panes.get('right').width;
const readerWidth=panes.get('left').width;
press(divider,'ArrowRight');
assert.equal(panes.get('right').width,historyWidth,'A compact Assistant history is fixed; the adjacent Reader resizes independently.');
assert.equal(panes.get('left').width,readerWidth+24);
const historyEdge=context.createDivider('right','');
historyEdge.handlers.focus();
assert.equal(historyEdge.tabIndex,-1,'A history-only Assistant has no resizable outer edge.');
press(historyEdge,'ArrowRight');
assert.equal(panes.get('right').width,historyWidth);
console.log('Workspace divider keyboard: expanded pairs, minimums, scroll compensation, Shift steps, collapsed neighbors and outer edges passed.');

// Reader minimums apply to both paths; neither path imposes a maximum.
for (const id of ['reader:left','reader:right']) panes.set(id,{dataset:{paneId:id},width:600,getBoundingClientRect(){return {width:this.width};}});
const readerDivider=context.createDivider('reader:left','reader:right');
context.resizeAdjacentPanesBy('reader:left','reader:right',1000,readerDivider);
assert.equal(panes.get('reader:left').width,1600); assert.equal(panes.get('reader:right').width,400);
context.resizeAdjacentPanesBy('reader:left','reader:right',-2000,readerDivider);
assert.equal(panes.get('reader:left').width,400); assert.equal(panes.get('reader:right').width,2400);
const readerEdge=context.createDivider('','reader:left'); readerEdge.handlers.focus();
assert.equal(readerEdge.attrs['aria-valuemin'],'400'); assert.equal(readerEdge.attrs['aria-valuemax'],undefined);
context.resizePaneEdgeBy('reader:left',10000,readerEdge); assert.equal(panes.get('reader:left').width,10400);
context.resizePaneEdgeBy('reader:left',-10000,readerEdge); assert.equal(panes.get('reader:left').width,400);
panes.get('reader:left').width=1600; panes.get('reader:right').width=1600;
context.resizeAdjacentPanesBy('reader:left','reader:right',1000,readerDivider);
assert.equal(panes.get('reader:left').width,2600); assert.equal(panes.get('reader:right').width,600);
panes.get('reader:right').width=400;
press(readerDivider,'ArrowRight');
assert.equal(panes.get('reader:left').width,2624,'Arrow keys keep widening a Reader after its neighbor reaches the minimum');
assert.equal(panes.get('reader:right').width,400);
console.log('Reader keyboard resizing passed: unlimited growth, minimum widths, adjacent and outer edges, accessible bounds.');

// Expanded and strip presentation sizes cannot become the resize bases.
const restoredLeft=panes.get('left'), restoredRight=panes.get('right');
historyOnly.clear();
restoredLeft.width=1200;restoredRight.width=48;
restoreWidths=()=>{restoredLeft.width=680;restoredRight.width=640;restoreWidths=null;};
context.resizeAdjacentPanesBy('left','right',24,divider);
assert.deepEqual([restoredLeft.width,restoredRight.width],[704,616]);
console.log('Expanded-column keyboard resizing measures restored widths before applying the delta.');

const evidenceID='utility:saved:one';
panes.set(evidenceID,{dataset:{paneId:evidenceID},width:450,getBoundingClientRect(){return {width:this.width};}});
const evidenceEdge=context.createDivider(evidenceID,'');
context.resizePaneEdgeBy(evidenceID,-1000,evidenceEdge);
assert.equal(panes.get(evidenceID).width,300);
assert.equal(evidenceEdge.attrs['aria-valuemin'],'300');
assert.equal(evidenceEdge.attrs['aria-valuemax'],'600');
context.resizePaneEdgeBy(evidenceID,1000,evidenceEdge);
assert.equal(panes.get(evidenceID).width,600);
press(evidenceEdge,'ArrowRight',true);
assert.equal(panes.get(evidenceID).width,600);
press(evidenceEdge,'ArrowLeft');
assert.equal(panes.get(evidenceID).width,576);
console.log('Evidence keyboard resizing and accessible bounds stay within 300–600 pixels.');
