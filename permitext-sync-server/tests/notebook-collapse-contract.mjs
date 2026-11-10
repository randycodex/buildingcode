import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name) {
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const ids=['reader:one','utility:saved:one','project:notebook:project','project:notes-index:project','utility:search:one'];
const state={collapsedPaneIDs:[]};
const panels=ids.map(id=>{
  const classes=new Set();
  return {dataset:{paneId:id},querySelector:()=>null,
    classList:{contains:name=>classes.has(name),toggle(name,on){on?classes.add(name):classes.delete(name);}},
    getBoundingClientRect:()=>({width:classes.has('is-collapsed')?48:300})};
});
let view='notebook',pro=true,saves=0;
const hidden=new Set();
const context=vm.createContext({state,isProAccount:()=>pro,currentColumnWorkflowView:()=>view,
  activePinnedPaneID:()=>'',columnGroupForPane:()=>null,workspaceColumnExpansion:null,
  workflowPaneIsVisible:id=>!hidden.has(id),
  track:{querySelectorAll:()=>panels.filter(panel=>!hidden.has(panel.dataset.paneId))},
  capturePaneScrollPositions:()=>[],captureReaderScrollPositions:()=>new Map(),restoreReaderScrollPositions(){},
  applyPaneWeight(){},closeActiveCustomSelect(){},updateCollapsedPaneDividers(){},
  getComputedStyle:()=>({paddingInline:'0px'}),window:{matchMedia:()=>({matches:true})},
  saveWorkspaceState(){saves++;},notifyWorkspaceLayoutChange(){}});
vm.runInContext(['paneCanCollapse','columnGroupCanCollapse','columnGroupIsCollapsed','paneIsCollapsed',
  'applyPaneCollapsedState','setPaneCollapsed','setAllColumnsCollapsed'].map(actual).join('\n'),context);
assert.equal(context.paneCanCollapse(ids[3]),true);
const editor=panels[2],index=panels[3];
context.setPaneCollapsed(index,true);
assert.equal(context.paneIsCollapsed(ids[3]),true);
assert.equal(index.classList.contains('is-collapsed'),true);
assert.equal(context.paneIsCollapsed(editor.dataset.paneId),false,'Collapsing the list leaves its editor open.');
assert.equal(saves,1);
context.setPaneCollapsed(index,false);
assert.equal(context.paneIsCollapsed(ids[3]),false);
assert.equal(context.paneCanCollapse(ids[4]),false);
context.setPaneCollapsed(panels[4],true);
assert.equal(context.paneIsCollapsed(ids[4]),false);
context.setAllColumnsCollapsed(true);
assert.ok(ids.slice(0,4).every(id=>context.paneIsCollapsed(id)));
context.setAllColumnsCollapsed(false);
assert.deepEqual(Array.from(state.collapsedPaneIDs),[]);
const mixed={paneIDs:[ids[3],ids[4]],collapsed:true};
assert.equal(context.columnGroupCanCollapse(mixed),false);
hidden.add(ids[4]);
assert.equal(context.columnGroupCanCollapse(mixed),true);
view='research';
assert.equal(context.paneCanCollapse(ids[4]),true);
pro=false;
assert.equal(context.paneCanCollapse(ids[0]),false);
console.log('Notebook collapse passed: list/editor independence, restore, saved state, supported tools, bulk controls and cross-view guards.');
