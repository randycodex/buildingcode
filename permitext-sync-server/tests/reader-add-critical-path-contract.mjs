import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import * as syncIdentity from '../public/sync-identity.js';
import {linkPaneToView} from '../public/workflow-views.js';
import {orderColumnGroups} from '../public/workspace-state.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name) {
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}
function fixture({pro=true,view='notebook',paneIDs=[],groups=[],hidden=[]}={}) {
  let finishRender;
  const rendering=new Promise(resolve=>{finishRender=resolve;});
  const pickers=[], scrolled=[];
  const c=vm.createContext({
    ...syncIdentity,crypto:{randomUUID},state:{readers:[],paneOrder:[...paneIDs],columnGroups:groups,workflowNavigationGeneration:0},
    pendingLinkedPanePlacements:new Map(),
    activeWorkspaceID:'project-a',view,accountCurrent:true,needsProject:false,
    isProAccount:()=>pro,
    notifyProjectRequiredForColumn:()=>c.needsProject,
    workspaceColumnsRequireProject:()=>c.needsProject,
    captureAccountRequest:()=>1,isCurrentAccountRequest:()=>c.accountCurrent,
    currentColumnWorkflowView:()=>c.view,
    openReaderCodePicker:(button,pick)=>pickers.push(pick),
    codeOptionVersion:code=>code.version,paneIDForReader:reader=>`reader:${reader.id}`,
    linkPaneToView,saveWorkspaceState(){},enforceReaderPlanLimit(){},
    defaultActivePaneIDs:()=>[...paneIDs,...c.state.readers.map(reader=>`reader:${reader.id}`)],
    activePaneIDs:()=>orderColumnGroups([...c.state.paneOrder,...c.state.readers.map(reader=>`reader:${reader.id}`).filter(id=>!c.state.paneOrder.includes(id))],c.state.columnGroups),
    workflowPaneIsVisible:id=>!hidden.includes(id),
    columnGroupForPane:id=>c.state.columnGroups.find(group=>group.paneIDs.includes(id)),
    readerShortcuts:{activePaneID:()=>c.activeColumn || ''},
    transitionWorkspace:()=>rendering,scrollPaneIntoView:id=>scrolled.push(id)
  });
  vm.runInContext(['newReaderState','requestLinkedPanePlacement','placePaneAfter','applyLinkedPanePlacements','openReaderFromToolbar'].map(actual).join('\n'),c);
  return {c,pickers,scrolled,finishRender};
}
const code={prefix:'PC',version:'2022'};
for (const view of ['research','notebook','report','project-details']) {
  const f=fixture({view});
  await f.c.openReaderFromToolbar({});
  assert.equal(f.c.state.readers.length,0,'Wait for an explicit code selection');
  const pending=f.pickers[0](code);
  const reader=f.c.state.readers[0];
  assert.equal(reader.codePrefix,'PC');assert.equal(reader.codeVersion,'2022');
  assert.equal(reader.chapterID,'','Navigation resolves the first chapter asynchronously');
  assert.deepEqual(Array.from(f.c.state.workflowMembership[`reader:${reader.id}`]),[view]);
  f.finishRender();await pending;
  assert.deepEqual(f.scrolled,[`reader:${reader.id}`]);
}
// A menu opened before a context change must not insert a Reader into the new view.
for (const change of [c=>{c.view='report';},c=>{c.activeWorkspaceID='project-b';},c=>{c.accountCurrent=false;},c=>{c.needsProject=true;},c=>{c.state.workflowNavigationGeneration+=2;}]) {
  const f=fixture();await f.c.openReaderFromToolbar({});change(f.c);
  await f.pickers[0](code);assert.equal(f.c.state.readers.length,0);
}
// Reserve slots synchronously so overlapping menu selections respect plan limits.
for (const pro of [false,true]) {
  const f=fixture({pro});
  await Promise.all([f.c.openReaderFromToolbar({}),f.c.openReaderFromToolbar({}),f.c.openReaderFromToolbar({})]);
  const pending=f.pickers.map(pick=>pick(code));
  assert.equal(f.c.state.readers.length,pro?3:1);
  assert.equal(new Set(f.c.state.readers.map(r=>r.id)).size,f.c.state.readers.length);
  f.c.view='research';f.finishRender();await Promise.all(pending);
  assert.equal(f.scrolled.length,0,'Late rendering must not reveal a pane over another selected view');
}
const guarded=fixture();guarded.c.needsProject=true;
assert.equal(await guarded.c.openReaderFromToolbar({}),false);assert.equal(guarded.pickers.length,0);
const free=fixture({pro:false,view:'research'});
await free.c.openReaderFromToolbar({});
free.finishRender();await free.pickers[0](code);
const readerID=free.c.state.readers[0].id;
await free.c.openReaderFromToolbar({});
await free.pickers[1]({prefix:'MC',version:'2022'});
assert.equal(free.c.state.readers.length,1,'Switching codes reuses the single Free column');
assert.equal(free.c.state.readers[0].id,readerID);
assert.equal(free.c.state.readers[0].codePrefix,'MC');

// Anchor to the selected column when the picker opens, even if hydration is delayed.
const adjacent=fixture({view:'research',paneIDs:['reader:left','utility:search:one','reader:right']});
adjacent.c.activeColumn='utility:search:one';
await adjacent.c.openReaderFromToolbar({});
adjacent.c.activeColumn='reader:right';
const placed=adjacent.pickers[0](code), addedID=`reader:${adjacent.c.state.readers[0].id}`;
assert.deepEqual(Array.from(adjacent.c.state.paneOrder),['reader:left','utility:search:one',addedID,'reader:right']);
adjacent.finishRender();await placed;
assert.deepEqual(adjacent.scrolled,[addedID]);
const grouped=fixture({view:'research',paneIDs:['utility:search:one','utility:analysis:one','reader:right'],groups:[{id:'g',paneIDs:['utility:search:one','utility:analysis:one']}]});
grouped.c.activeColumn='utility:search:one';
await grouped.c.openReaderFromToolbar({});const groupedPending=grouped.pickers[0](code);
assert.equal(grouped.c.state.paneOrder[2],`reader:${grouped.c.state.readers[0].id}`,'New Readers sit beside the active group without splitting it.');
grouped.finishRender();await groupedPending;
console.log('Readers passed: explicit source selection, four working views, project/account/navigation guards, concurrent plan limits and late-render fencing.');
