import assert from 'node:assert/strict';
import vm from 'node:vm';
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
let saves=0, layouts=0, indicators=0;
const readerPickers=[];
const track = {scrollLeft:0, querySelectorAll(){return [...panes.values()];}, querySelector(selector){return panes.get(selector.match(/data-pane-id="([^"]+)"/)?.[1]);}};
const context = vm.createContext({state, track, CSS:{escape:x=>x},isProAccount:()=>false,
  paneIsCollapsed:id=>collapsed.has(id), assistantHistoryOnlyPane:id=>historyOnly.has(id), defaultPaneWidthForID:()=>600, minimumPaneWidthForID:id=>id.startsWith('reader:')?400:600,
  applyPaneWeight:(pane,id)=>{pane.width=state.paneWeights[id];},
  notifyWorkspaceLayoutChange:()=>layouts++, saveWorkspaceState:()=>saves++,
  scheduleVisibleReaderScrollIndicatorUpdates:()=>indicators++,
  openReaderFromToolbar:(button,location)=>readerPickers.push({button,location}),
  document:{createElement(){return {dataset:{}, attrs:{}, handlers:{}, children:[], classList:{add(){},toggle(){}}, append(child){this.children.push(child);},
    setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];}, addEventListener(k,v){this.handlers[k]=v;}};}}
});
vm.runInContext(['syncReaderDividerButton','maximumPaneWidthForID','constrainPaneWidth','activePinnedPaneID','singleExpandedDividerEdge','updateAdjacentDividerValue','capturePaneResizeWidths','resizeAdjacentPanesBy','resizePaneEdgeBy','refreshPaneDividerValue','createDivider'].map(extract).join('\n'),context);
const divider=context.createDivider('left','right');
const add=divider.children[0];
assert.equal(add.textContent,'+');
assert.equal(add.attrs['aria-label'],'Add Reader here');
assert.equal(add.attrs['aria-haspopup'],'dialog');
for(const type of ['pointerdown','dblclick','keydown']) {
  let stopped=false;add.handlers[type]({stopPropagation(){stopped=true;}});
  assert.equal(stopped,true,`${type} on + must not resize/reset the divider`);
}
add.handlers.click({stopPropagation(){}});
assert.equal(readerPickers.length,1);
assert.equal(readerPickers[0].location.previousPaneID,'left');
assert.equal(readerPickers[0].location.nextPaneID,'right');

function press(handle,key,shiftKey=false){let prevented=false;handle.handlers.keydown({key,shiftKey,preventDefault(){prevented=true;}});return prevented;}
function widths(){return [...panes.values()].map(p=>p.width);}
panes.get('left').width=680;
assert.equal(press(divider,'ArrowLeft'),true);
assert.deepEqual(widths(),[656,624]);
assert.equal(divider.attrs['aria-valuenow'],'51');
assert.equal(divider.attrs['aria-valuetext'],'Left column 656 pixels; right column 624 pixels');
assert.equal(press(divider,'ArrowRight',true),true);
assert.deepEqual(widths(),[736,600]); // Independent minimums match pointer behavior; total can grow.
assert.equal(saves,2);assert.equal(layouts,2);assert.equal(indicators,2);
// Minimum-clamped left side compensates scrolling just as the pointer handler does.
panes.get('left').width=600;panes.get('right').width=600;track.scrollLeft=40;
press(divider,'ArrowLeft',true);assert.deepEqual(widths(),[600,680]);assert.equal(track.scrollLeft,120);
assert.equal(press(divider,'Escape'),false);assert.equal(saves,3);
// A collapsed neighbor delegates to the existing edge handler, in the right direction.
collapsed.add('left');divider.handlers.focus();assert.equal(divider.attrs['aria-valuemax'],undefined);press(divider,'ArrowLeft');assert.deepEqual(widths(),[600,704]);
assert.equal(divider.attrs['aria-valuetext'],'Column width 704 pixels');
collapsed.add('right');divider.handlers.focus();assert.equal(divider.tabIndex,-1);assert.equal(divider.attrs['aria-valuenow'],undefined);assert.equal(press(divider,'ArrowRight'),false);assert.equal(saves,4);
collapsed.clear();divider.handlers.focus();assert.equal(divider.tabIndex,0);assert.equal(divider.attrs['aria-valuemax'],'100');const leftEdge=context.createDivider('', 'left');
press(leftEdge,'ArrowLeft',true);assert.deepEqual(widths(),[680,704]);
press(leftEdge,'ArrowRight',true);assert.deepEqual(widths(),[600,704]);
assert.equal(leftEdge.children.length,0,'Outer resize handles retain their existing behavior');
const rightEdge=context.createDivider('right','');press(rightEdge,'ArrowRight');assert.deepEqual(widths(),[600,728]);
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

// Reader limits apply equally to keyboard pairs and outer edges.
for (const id of ['reader:left','reader:right']) panes.set(id,{dataset:{paneId:id},width:600,getBoundingClientRect(){return {width:this.width};}});
const readerDivider=context.createDivider('reader:left','reader:right');
context.resizeAdjacentPanesBy('reader:left','reader:right',1000,readerDivider);
assert.equal(panes.get('reader:left').width,900); assert.equal(panes.get('reader:right').width,400);
context.resizeAdjacentPanesBy('reader:left','reader:right',-2000,readerDivider);
assert.equal(panes.get('reader:left').width,400); assert.equal(panes.get('reader:right').width,900);
const readerEdge=context.createDivider('','reader:left'); readerEdge.handlers.focus();
assert.equal(readerEdge.attrs['aria-valuemin'],'400'); assert.equal(readerEdge.attrs['aria-valuemax'],'900');
context.resizePaneEdgeBy('reader:left',10000,readerEdge); assert.equal(panes.get('reader:left').width,900);
context.resizePaneEdgeBy('reader:left',-10000,readerEdge); assert.equal(panes.get('reader:left').width,400);
console.log('Reader keyboard limits passed: 400px minimum, 900px maximum, adjacent and outer edges, accessible bounds.');

state.readers=[{id:'one'},{id:'two'}];
context.syncReaderDividerButton(add);
assert.equal(add.disabled,true,'Divider insertion observes the existing two-Reader free limit');
assert.equal(add.title,'Two Reader limit reached');
state.readers=[];
context.syncReaderDividerButton(add);
assert.equal(add.disabled,false);
assert.equal(add.title,'Add Reader here');
