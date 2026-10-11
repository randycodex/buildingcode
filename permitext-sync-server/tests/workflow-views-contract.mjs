import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkflowView, normalizeColumnWorkflowView, paneBelongsToView, linkPaneToView, createWorkflowScrollStore, referenceColumnsWidth} from '../public/workflow-views.js';
import {captureWorkspaceLayout, applyWorkspaceLayout} from '../public/workspace-state.js';
const membership=linkPaneToView({},'reader:linked','notebook');
assert.equal(paneBelongsToView('reader:linked','research',membership),false,'A new linked Reader belongs to its originating view');
assert.equal(paneBelongsToView('project:notebook:a','notebook',linkPaneToView({},'project:notebook:a','research')),true);
assert.equal(paneBelongsToView('reader:linked','notebook',membership),true);
assert.equal(paneBelongsToView('reader:other','notebook',membership),false);
assert.equal(paneBelongsToView('section:detail:one','notebook',{}, {'section:detail:one':'utility:saved:a'}),true);
const restored={};
applyWorkspaceLayout(restored,captureWorkspaceLayout({workflowView:'notebook',workflowMembership:membership,workflowScroll:{research:120,notebook:400}}));
assert.equal(restored.workflowView,'notebook');
assert.deepEqual(restored.workflowMembership,membership);
assert.deepEqual(restored.workflowScroll,{research:120,notebook:400,report:0,'project-details':0});
for (const view of ['report','project-details']) {
  const linked=linkPaneToView({},'reader:reference',view);
  const layout={};
  applyWorkspaceLayout(layout,captureWorkspaceLayout({workflowMembership:linked,workflowScroll:{[view]:320}}));
  assert.equal(paneBelongsToView('reader:reference',view,layout.workflowMembership),true);
  assert.equal(paneBelongsToView('reader:reference','research',layout.workflowMembership),false);
  assert.equal(layout.workflowScroll[view],320);
}
assert.equal(referenceColumnsWidth([],1920),0);
assert.equal(referenceColumnsWidth([600],1920),602);
assert.equal(referenceColumnsWidth([600,800],1920),1403);
assert.equal(referenceColumnsWidth([1200,1200],1920),1500,'Keep usable document space when Readers exceed available width');
assert.equal(referenceColumnsWidth([1200,1200],1920,700),1220,'Report reserves space for its toolbar and sources library');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);};
const pane=id=>({dataset:{paneId:id},scrollTop:0,scrollLeft:0,isConnected:true,querySelectorAll:()=>[],draft:'Unsaved text',hidden:false,classList:{contains(name){return name==='is-workflow-hidden' && panes.find(p=>p.classList===this).hidden;}}});
const reader=pane('reader:one'), notebook=pane('project:notebook:a'); reader.scrollTop=1700; notebook.scrollTop=400;
const panes=[reader,notebook], state={workflowView:'research',workflowMembership:{},workflowScroll:{notebook:70}};
const track={scrollLeft:110,querySelectorAll:()=>panes};
let constructions=0, needProject=false;
let reportOpen=false, detailsOpen=false;
const c=vm.createContext({reportScreen:{isOpen:()=>reportOpen,close(){reportOpen=false;}},projectDetailsScreen:{isOpen:()=>detailsOpen,close(){detailsOpen=false;}},toggleSettingsButton:null,state,track,normalizeWorkflowView,normalizeColumnWorkflowView,paneBelongsToView,workflowScrollStore:createWorkflowScrollStore(),
  detachedProjectWindow:false,sectionDetailAnchorsBySearch:()=>({}),paneIDForSectionDetail:id=>id,
  document:{querySelector:()=>null,querySelectorAll:()=>[]},notifyProjectRequiredForColumn:()=>needProject,
  syncReaderToolbarButton(){},captureReaderScrollPositions:()=>new Map(),restoreReaderScrollPositions(){},saveWorkspaceState(){},
  defaultActivePaneIDs:()=>panes.map(p=>p.dataset.paneId),
  appendPaneSequence(actualPanes){actualPanes.forEach((p,i)=>assert.equal(p,panes[i]));for(const p of actualPanes){p.hidden=!c.workflowPaneIsVisible(p.dataset.paneId);p.scrollTop=0;}},
  openProjectNotebook(){constructions++;},focusRecentUtilityColumn(){constructions++;}
});
vm.runInContext("let presentedColumnWorkflowView='research';\n"+['currentWorkflowView','currentColumnWorkflowView','syncReferenceReaderLayout','syncWorkflowColumnPresentation','workflowPaneAnchors','workflowPaneIsVisible','closeSharedWorkspaceViews','syncWorkflowNavigation','switchWorkflowView'].map(actual).join('\n'),c);
await c.switchWorkflowView('notebook'); assert.equal(track.scrollLeft,70);
notebook.scrollTop=450; track.scrollLeft=200;
await c.switchWorkflowView('research');
assert.equal(reader.scrollTop,1700); assert.equal(track.scrollLeft,110);
assert.equal(notebook.draft,'Unsaved text'); assert.equal(constructions,0);
await c.switchWorkflowView('notebook'); assert.equal(notebook.scrollTop,450); assert.equal(track.scrollLeft,200);
assert.equal(state.workflowNavigationGeneration,3,'Each actual view change invalidates pending navigation');
for (const view of ['report','project-details']) {
  const reference=pane(`reader:${view}`);panes.push(reference);
  state.workflowMembership=linkPaneToView(state.workflowMembership,reference.dataset.paneId,view);
  reportOpen=view==='report';detailsOpen=view==='project-details';
  c.syncWorkflowColumnPresentation();
  assert.equal(c.workflowPaneIsVisible(reference.dataset.paneId),true);
  assert.equal(c.workflowPaneIsVisible(notebook.dataset.paneId),false);
  reference.scrollTop=870;track.scrollLeft=250;
  await c.switchWorkflowView('notebook');
  assert.equal(notebook.scrollTop,450);assert.equal(track.scrollLeft,200);
  reportOpen=view==='report';detailsOpen=view==='project-details';c.syncWorkflowColumnPresentation();
  assert.equal(reference.scrollTop,870);assert.equal(track.scrollLeft,250);
  assert.equal(reference.draft,'Unsaved text');
  await c.switchWorkflowView('notebook');
}
needProject=true; assert.equal(await c.switchWorkflowView('research'),false); assert.equal(state.workflowView,'notebook');
console.log('Workflow views passed: independent visibility, linked destinations, layout persistence, retained editors, nested scroll and project guard.');

const closed=[];
c.activeWorkspaceID='a'; c.captureAccountRequest=()=>({}); c.isCurrentAccountRequest=()=>true;
c.workspacePaneDescriptors=()=>panes.map(p=>({id:p.dataset.paneId,close:async()=>{closed.push(p.dataset.paneId);}}));
vm.runInContext(actual('closeAllColumns'),c);
await c.closeAllColumns();
assert.deepEqual(closed,['project:notebook:a'],'Close all only closes this view');
