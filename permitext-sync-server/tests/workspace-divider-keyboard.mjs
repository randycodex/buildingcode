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
const panes = new Map(['left', 'right'].map(id => [id, {dataset:{paneId:id}, width:600, getBoundingClientRect(){return {width:this.width};}}]));
const state = {paneWeights:{}};
let saves=0, layouts=0, indicators=0;
const track = {scrollLeft:0, querySelector(selector){return panes.get(selector.match(/data-pane-id="([^"]+)"/)?.[1]);}};
const context = vm.createContext({state, track, CSS:{escape:x=>x},
  paneIsCollapsed:id=>collapsed.has(id), defaultPaneWidthForID:()=>600,
  applyPaneWeight:(pane,id)=>{pane.width=state.paneWeights[id];},
  notifyWorkspaceLayoutChange:()=>layouts++, saveWorkspaceState:()=>saves++,
  scheduleVisibleReaderScrollIndicatorUpdates:()=>indicators++,
  document:{createElement(){return {dataset:{}, attrs:{}, handlers:{}, classList:{add(){}},
    setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];}, addEventListener(k,v){this.handlers[k]=v;}};}}
});
vm.runInContext(['singleExpandedDividerEdge','updateAdjacentDividerValue','resizeAdjacentPanesBy','resizePaneEdgeBy','refreshPaneDividerValue','createDivider'].map(extract).join('\n'),context);
const divider=context.createDivider('left','right');
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
const rightEdge=context.createDivider('right','');press(rightEdge,'ArrowRight');assert.deepEqual(widths(),[600,728]);
// Missing DOM panes do not persist phantom widths.
panes.delete('right');press(divider,'ArrowRight');assert.equal(saves,7);
console.log('Workspace divider keyboard: expanded pairs, minimums, scroll compensation, Shift steps, collapsed neighbors and outer edges passed.');
