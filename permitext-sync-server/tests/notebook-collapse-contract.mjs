import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name) {
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const reportID='project:report-draft:project';
const ids=['reader:one','utility:saved:one','project:notebook:project','project:notes-index:project','utility:search:one',reportID];
const notesListID='project:notes-index:project';
const state={collapsedPaneIDs:[],columnGroups:[],notebookListHidden:false};
const panels=ids.map(id=>{
  const classes=new Set(id===reportID?['shared-report-column']:['workspace-panel']);
  return {dataset:{paneId:id},querySelector:()=>null,
    classList:{contains:name=>classes.has(name),remove:name=>classes.delete(name),toggle(name,on){on?classes.add(name):classes.delete(name);}},
    getBoundingClientRect:()=>({width:classes.has('is-collapsed')?48:300})};
});
let view='notebook',pro=true,saves=0,pinnedPaneID='';
const hidden=new Set();
const context=vm.createContext({state,columnGroupingEnabled:true,isProAccount:()=>pro,currentColumnWorkflowView:()=>view,
  activePinnedPaneID:()=>pinnedPaneID,workspaceColumnExpansion:null,
  workflowPaneIsVisible:id=>!hidden.has(id),
  track:{querySelectorAll:selector=>selector.includes('.pane-divider') ? [] : panels.filter(panel=>
    !hidden.has(panel.dataset.paneId) && (panel.dataset.paneId!==reportID || selector.includes('.shared-report-column')))},
  preparePaneCollapse:panel=>context.applyPaneCollapsedState(panel),
  capturePaneScrollPositions:()=>[],captureReaderScrollPositions:()=>new Map(),restoreReaderScrollPositions(){},
  applyPaneWeight(){},closeActiveCustomSelect(){},updateCollapsedPaneDividers(){},
  getComputedStyle:()=>({paddingInline:'0px'}),window:{matchMedia:()=>({matches:true})},
  saveWorkspaceState(){saves++;},notifyWorkspaceLayoutChange(){}});
vm.runInContext(['paneCanCollapse','columnGroupForPane','columnGroupCanCollapse','columnGroupIsCollapsed','paneIsCollapsed',
  'applyPaneCollapsedState','setPaneCollapsed','refreshColumnGroupPresentation','setColumnGroupCollapsed',
  'setAllColumnsCollapsed'].map(actual).join('\n'),context);
for (const panel of panels) {
  assert.equal(context.paneCanCollapse(panel.dataset.paneId),false);
  context.setPaneCollapsed(panel,true);
  assert.equal(context.paneIsCollapsed(panel.dataset.paneId),false);
}
context.setAllColumnsCollapsed(true);
assert.equal(saves,0,'Notebook collapse actions do not change persisted layout.');
assert.deepEqual(Array.from(state.collapsedPaneIDs),[]);
state.collapsedPaneIDs=[...ids];
for (const panel of panels) {
  panel.classList.toggle('is-collapsed',true);
  context.applyPaneCollapsedState(panel);
  assert.equal(panel.classList.contains('is-collapsed'),false,'Remembered collapsed columns expand in Notebook.');
}
context.setAllColumnsCollapsed(false);
assert.deepEqual(Array.from(state.collapsedPaneIDs),ids,'Notebook preserves collapse choices for other views.');
const mixed={paneIDs:[ids[3],ids[4]],collapsed:true};
assert.equal(context.columnGroupCanCollapse(mixed),false);
hidden.add(ids[4]);
assert.equal(context.columnGroupCanCollapse(mixed),false);
view='research';
assert.equal(context.columnGroupCanCollapse(mixed),true);
assert.ok(ids.filter(id=>id!==notesListID).every(id=>context.paneIsCollapsed(id)),
  'Research restores its remembered column collapse state.');
assert.equal(context.paneIsCollapsed(notesListID),false,
  'A saved column collapse entry does not collapse the Notes list.');
state.notebookListHidden=true;
assert.equal(context.paneIsCollapsed(notesListID),true,'The Notes list follows its own saved preference.');
context.setAllColumnsCollapsed(false);
assert.ok(ids.filter(id=>id!==notesListID&&!hidden.has(id)).every(id=>!context.paneIsCollapsed(id)));
assert.equal(context.paneIsCollapsed(notesListID),true,'Expand all leaves the Notes list preference in place.');
assert.equal(context.paneIsCollapsed(ids[4]),true,'Expand all leaves hidden columns parked.');
state.collapsedPaneIDs=state.collapsedPaneIDs.filter(id=>id!==notesListID);
context.setAllColumnsCollapsed(true);
assert.equal(context.paneIsCollapsed(ids[2]),true,'Collapse all parks the full Notes tool.');
assert.equal(context.paneIsCollapsed(reportID),true,'Collapse all includes the shared Report column.');
assert.equal(state.collapsedPaneIDs.includes(notesListID),false,'The whole Notes tool uses the editor identity.');
context.setAllColumnsCollapsed(false);
context.setPaneCollapsed(panels[0],true);
assert.equal(context.paneIsCollapsed(ids[0]),true);
hidden.delete(ids[4]);
state.collapsedPaneIDs=[];
const group={id:'lookup',paneIDs:[ids[0],ids[4]],collapsed:false};
state.columnGroups=[group];
context.setAllColumnsCollapsed(true);
assert.equal(group.collapsed,true);
assert.equal(panels[0].classList.contains('is-collapsed'),true);
assert.equal(panels[4].classList.contains('is-group-hidden'),true);
assert.ok(group.paneIDs.every(id=>!state.collapsedPaneIDs.includes(id)),'Collapse All uses one group rail.');
assert.equal(context.paneIsCollapsed(reportID),true,'Ungrouped columns still collapse separately.');
context.setColumnGroupCollapsed(group,false);
assert.ok(group.paneIDs.every(id=>!context.paneIsCollapsed(id)),'Opening the group restores all its members together.');

pinnedPaneID=ids[0];
context.setAllColumnsCollapsed(true);
assert.equal(group.collapsed,true);
assert.equal(context.paneIsCollapsed(pinnedPaneID),false,'A pinned member stays expanded, as with the group menu.');
assert.equal(panels[4].classList.contains('is-collapsed'),true);
assert.equal(panels[4].classList.contains('is-group-hidden'),false);
state.collapsedPaneIDs=[...state.collapsedPaneIDs,ids[4]]; // An older individual collapse choice.
context.setAllColumnsCollapsed(false);
assert.equal(group.collapsed,false);
assert.equal(panels[4].classList.contains('is-collapsed'),false);
assert.equal(context.paneIsCollapsed(reportID),false);
pinnedPaneID='';
context.setAllColumnsCollapsed(true);
state.collapsedPaneIDs=[];
const savedGroup=JSON.stringify(group);
context.columnGroupingEnabled=false;
context.refreshColumnGroupPresentation();
assert.equal(panels[0].classList.contains('is-collapsed'),false,'A paused group leaves its first column expanded.');
assert.equal(panels[4].classList.contains('is-group-hidden'),false,'A paused group reveals its other open columns.');
context.setAllColumnsCollapsed(true);
assert.ok(group.paneIDs.every(id=>state.collapsedPaneIDs.includes(id)),'Each column gets its own collapsed rail.');
context.setPaneCollapsed(panels[4],false);
assert.equal(context.paneIsCollapsed(ids[4]),false,'Search opens on its own.');
assert.equal(context.paneIsCollapsed(ids[0]),true,'Reader stays individually collapsed.');
assert.equal(JSON.stringify(group),savedGroup,'Pausing leaves the stored group definition intact.');
state.columnGroups=[];
pro=false;
assert.equal(context.paneCanCollapse(ids[0]),false);
// Notebook's code heading is plain text; + owns its code picker. Research keeps collapse.
let readerTitle;
const titleNode = tag => ({tagName:tag.toUpperCase(),attrs:{},dataset:{},listeners:{},
  setAttribute(name,value){this.attrs[name]=value;},addEventListener(name,listener){this.listeners[name]=listener;},
  replaceWith(node){readerTitle=node;}});
readerTitle=titleNode('button');
Object.assign(context,{document:{createElement:titleNode},
  readerCodeOptionLabel:()=> '2022 BC',codeOptionFor:()=> ({}),
  sectionDisplayTitle:()=> 'Reader'});
vm.runInContext(actual('updateReaderLocationTitle'),context);
const readerPanel={dataset:{paneId:ids[0]},querySelector:()=>readerTitle};
pro=true;view='notebook';
context.updateReaderLocationTitle(readerPanel,{});
assert.equal(readerTitle.tagName,'SPAN');
assert.doesNotMatch(readerTitle.attrs['aria-label'],/Collapse/);
assert.equal(readerTitle.attrs['aria-haspopup'],undefined);
assert.equal(readerTitle.listeners.click,undefined);
view='research';
context.updateReaderLocationTitle(readerPanel,{});
assert.equal(readerTitle.tagName,'BUTTON');
assert.match(readerTitle.attrs['aria-label'],/^Collapse /);
console.log('Notebook stays expanded: individual/bulk actions, saved collapse recovery, groups and retained Research collapse behavior passed.');
