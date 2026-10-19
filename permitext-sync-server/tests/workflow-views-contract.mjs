import {shouldOpenNotebookByDefault} from "../public/minimal-workflow.js";
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkflowView, normalizeColumnWorkflowView, paneBelongsToView, linkPaneToView, createWorkflowScrollStore, referenceColumnsWidth, reportColumnsLayout} from '../public/workflow-views.js';
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
  assert.equal(paneBelongsToView('reader:reference',view,layout.workflowMembership),view !== 'report');
  assert.equal(paneBelongsToView('reader:reference','research',layout.workflowMembership),view === 'report');
  assert.equal(layout.workflowScroll[view],320);
}
assert.equal(referenceColumnsWidth([],1920),0);
assert.equal(referenceColumnsWidth([600],1920),603);
assert.equal(referenceColumnsWidth([600,800],1920),1320);
assert.equal(referenceColumnsWidth([1200,1200],1920),1320,'Keep usable document space when Readers exceed available width');
assert.equal(referenceColumnsWidth([1200,1200],1920,700),1220,'Report reserves space for its toolbar and sources library');
// Expanded Sources must not take space reserved for a readable Report document.
for (const libraryWidth of [0,330,640,720]) {
  for (const readers of [[600],[600,600],[1200,1200]]) {
    const constraints=reportColumnsLayout(1920,libraryWidth);
    const dock=referenceColumnsWidth(readers,1920,constraints.minimumWidth);
    const reportWidth=Math.max(constraints.minimumWidth,1920-dock);
    const layout=reportColumnsLayout(reportWidth,libraryWidth);
    const outline=layout.compact?0:300;
    const document=reportWidth-libraryWidth-(libraryWidth?1:0)-outline;
    assert.ok(document>=600,`Report remains at least 600px with Sources ${libraryWidth} and Readers ${readers}`);
    assert.ok(dock>=602,'A Reader retains 600px plus its edge dividers');
  }
}
assert.deepEqual(reportColumnsLayout(1241,640),{minimumWidth:1241,compact:true});
assert.equal(reportColumnsLayout(1920,640,640).compact,false,'Both expanded sidebars fit beside a readable report');
assert.equal(reportColumnsLayout(1881,640,640).compact,true,'Hide the optional outline before reducing the 600px document');
assert.equal(reportColumnsLayout(1882,640,640).compact,false,'Allow both expanded sidebars at their exact fitting boundary');
assert.equal(reportColumnsLayout(1920,640,678).compact,false,'Dragging to the available maximum keeps the document readable');
assert.equal(reportColumnsLayout(901,0,300).compact,false,'The compact outline and its divider fit with a 600px document');
assert.equal(referenceColumnsWidth([600],1200,931),603,'Narrow desks overflow whole columns instead of shrinking Readers');
assert.equal(referenceColumnsWidth([48],1200,931),51,'Collapsed Readers keep a compact rail');
assert.equal(referenceColumnsWidth([972],1920,1241),679,'A restored larger Reader shrinks to fit before horizontal scrolling');
assert.equal(referenceColumnsWidth([900],1300),700,'Reference Readers shrink before creating early workspace overflow');
assert.equal(referenceColumnsWidth([600,600],1600),1204,'Horizontal overflow begins when the 600px columns no longer fit');
assert.equal(referenceColumnsWidth([1000],1400,600,[1000]),1003,'Assistant history retains its existing additional width');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);};
const pane=id=>({dataset:{paneId:id},scrollTop:0,scrollLeft:0,isConnected:true,querySelectorAll:()=>[],draft:'Unsaved text',hidden:false,classList:{contains(name){return name==='is-workflow-hidden' && panes.find(p=>p.classList===this).hidden;}}});
const reader=pane('reader:one'), notebook=pane('project:notebook:a'); reader.scrollTop=1700; notebook.scrollTop=400;
const panes=[reader,notebook], state={workflowVisitedViews:['research','notebook'],workflowView:'research',workflowMembership:{},workflowScroll:{notebook:70}};
const track={scrollLeft:110,querySelectorAll:()=>panes};
let constructions=0, needProject=false, dividerUpdates=0;
let reportOpen=false, detailsOpen=false;
const c=vm.createContext({columnExpansionController:()=>({refresh(){}}),reportScreen:{isOpen:()=>reportOpen,close(){reportOpen=false;}},projectDetailsScreen:{isOpen:()=>detailsOpen,close(){detailsOpen=false;}},toggleSettingsButton:null,state,track,shouldOpenNotebookByDefault,workspaceProject:()=>({id:"project"}),normalizeWorkflowView,normalizeColumnWorkflowView,paneBelongsToView,workflowScrollStore:createWorkflowScrollStore(),
  detachedProjectWindow:false,sectionDetailAnchorsBySearch:()=>({}),paneIDForSectionDetail:id=>id,
  document:{querySelector:()=>null,querySelectorAll:()=>[]},notifyProjectRequiredForColumn:()=>needProject,
  syncReaderToolbarButton(){},updateWorkspaceLayoutControls(){},syncResearchColumnLayout(){},schedulePaneDividerAddControls(){dividerUpdates++;},captureReaderScrollPositions:()=>new Map(),restoreReaderScrollPositions(){},saveWorkspaceState(){},
  defaultActivePaneIDs:()=>panes.map(p=>p.dataset.paneId),
  appendPaneSequence(actualPanes){actualPanes.forEach((p,i)=>assert.equal(p,panes[i]));for(const p of actualPanes){p.hidden=!c.workflowPaneIsVisible(p.dataset.paneId);p.scrollTop=0;}},
  projectHasOpenNotebook:()=>panes.includes(notebook),savedPaneIDs:()=>[],placeEvidenceBeforeNotebook(){},
  openProjectNotebook(){constructions++;if(!panes.includes(notebook))panes.push(notebook);},focusRecentUtilityColumn(){constructions++;}
});
vm.runInContext("let presentedColumnWorkflowView='research';\n"+['currentWorkflowView','currentColumnWorkflowView','syncReferenceReaderLayout','syncWorkflowColumnPresentation','workflowPaneAnchors','workflowPaneIsVisible','closeSharedWorkspaceViews','syncWorkflowNavigation','switchWorkflowView'].map(actual).join('\n'),c);
await c.switchWorkflowView('notebook'); assert.equal(track.scrollLeft,70);
assert.ok(dividerUpdates > 0, 'Workflow changes refresh divider control visibility even when the column layout stays intact');
notebook.scrollTop=450; track.scrollLeft=200;
await c.switchWorkflowView('research');
assert.equal(reader.scrollTop,1700); assert.equal(track.scrollLeft,110);
assert.equal(notebook.draft,'Unsaved text'); assert.equal(constructions,0);
await c.switchWorkflowView('notebook'); assert.equal(notebook.scrollTop,450); assert.equal(track.scrollLeft,200);
assert.equal(state.workflowNavigationGeneration,3,'Each actual view change invalidates pending navigation');
for (const view of ['project-details']) {
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

// Research stays empty; Notebook keeps Notes available on entry.
needProject=false;
c.workspacePaneDescriptors=()=>panes.map(p=>({id:p.dataset.paneId,close:async()=>{
  panes.splice(panes.indexOf(p),1);
}}));
for (const view of ['research','notebook']) {
  const other=view==='research'?'notebook':'research';
  state.workflowView=view;
  state.workflowVisitedViews=[];
  panes.splice(0,panes.length,reader,notebook);
  await c.closeAllColumns();
  assert.equal(panes.length,1,'Close all retains the other view column');
  assert.equal(panes[0],view==='research'?notebook:reader);
  assert.ok(state.workflowVisitedViews.includes(view),'Remember a deliberately empty view');
  // Exercise the same layout serialization used by reload and Project switches.
  const saved=captureWorkspaceLayout(state);
  applyWorkspaceLayout(state,saved);
  const before=constructions;
  await c.switchWorkflowView(other);
  const afterOther=constructions;
  await c.switchWorkflowView(view);
  await c.switchWorkflowView(view);
  assert.equal(afterOther,before,'Switching to a retained screen keeps its existing columns');
  assert.equal(constructions,afterOther+(view==='notebook'?1:0),'Only Notes reopens when returning to an empty screen');
  assert.equal(panes.length,view==='notebook'?2:1,'Research remains empty while Notebook restores Notes');
}
panes.length=0;
state.workflowVisitedViews=[];
const beforeFresh=constructions;
await c.switchWorkflowView('research');
assert.equal(constructions,beforeFresh+1,'First empty Research visit still opens Search');
console.log('Closed view regression passed: Research stays empty, Notes returns in Notebook, retained editors and saved layouts survive.');

const evidenceState={paneOrder:['reader:research','project:notebook:a','utility:saved:one','utility:saved:two']};
const evidenceContext=vm.createContext({state:evidenceState,workspaceProject:()=>({id:'a'}),
  projectHasOpenNotebook:()=>true,paneIDForProjectNotebook:()=> 'project:notebook:a',
  defaultActivePaneIDs:()=>['reader:research','project:notebook:a','utility:saved:one','utility:saved:two']});
vm.runInContext(actual('placePaneBefore')+'\n'+actual('placeEvidenceBeforeNotebook'),evidenceContext);
for (const id of ['utility:saved:one','utility:saved:two']) {
  assert.equal(evidenceContext.placeEvidenceBeforeNotebook(id),true);
  assert.equal(evidenceContext.placeEvidenceBeforeNotebook(id),false,'Already positioned Evidence keeps its position');
}
assert.deepEqual(evidenceState.paneOrder,['reader:research','utility:saved:one','utility:saved:two','project:notebook:a']);
console.log('Notebook order passed: Evidence opens to the left of Notes without moving retained Research columns.');

// Exercise the application wiring, including the Sources disclosure/resize path.
const referenceClasses=new Set(), referenceStyles=new Map();
const referenceShell={clientWidth:1920,classList:{toggle(name,on){on?referenceClasses.add(name):referenceClasses.delete(name);}},style:{setProperty:(name,value)=>referenceStyles.set(name,value)}};
const referencePanel={dataset:{libraryOpen:'true',libraryWidth:'640'}};
const referenceTrack={};let referenceIDs=['reader:reference'],accountOpen=false;
const referenceContext=vm.createContext({
  document:{querySelector:selector=>selector==='.workspace-shell'?referenceShell:selector==='.account-screen[open]'?accountOpen?{}:null:referencePanel},
  state:{paneWeights:{'reader:reference':972}},track:referenceTrack,
  currentColumnWorkflowView:()=> 'report',defaultActivePaneIDs:()=>referenceIDs,
  workflowPaneIsVisible:()=>true,paneIsCollapsed:()=>false,minimumPaneWidthForID:()=>600,defaultPaneWidthForID:()=>600,
  referenceColumnsWidth,reportColumnsLayout
});
vm.runInContext([actual('maximumPaneWidthForID'),actual('constrainPaneWidth'),actual('syncReferenceReaderLayout')].join('\n'),referenceContext);
referenceContext.syncReferenceReaderLayout();
assert.equal(referenceStyles.get('--reference-document-min-width'),'1241px');
assert.equal(referenceStyles.get('--reference-readers-width'),'0px');
assert.equal(referenceClasses.has('has-compact-reference-document'),false);
assert.equal(referenceTrack.inert,true);
referencePanel.dataset.libraryOpen='false';referenceContext.syncReferenceReaderLayout();
assert.equal(referenceStyles.get('--reference-document-min-width'),'600px');
assert.equal(referenceClasses.has('has-compact-reference-document'),false,'Closing Sources makes room for the outline again');
referenceIDs=[];referenceContext.syncReferenceReaderLayout();
assert.equal(referenceClasses.has('has-reference-readers'),false);
accountOpen=true;referenceIDs=['reader:reference'];referenceContext.syncReferenceReaderLayout();
assert.equal(referenceTrack.inert,true,'Account keeps reference columns inactive');
assert.equal(referenceClasses.has('has-reference-readers'),false);
console.log('Report constraints passed: 600px document minimum, expanded Sources, 300px optional outline, retained hidden Readers and Account isolation.');

// Layout follows the visible Report, never the retained Research/Notebook track.
let menuReportOpen = true, reportReady = true, reportResets = 0, savedLayouts = 0, workspaceTransitions = 0;
const fit = {}, closeColumns = {}, workspaceOnly = [{}, {}, {}];
const layoutTrack = {scrollLeft: 220, scrollWidth: 1000, clientWidth: 700, querySelectorAll: () => []};
const reportPanel = {querySelector: () => reportReady ? {} : null};
const layoutState = {paneWeights: {'reader:one': 900, 'project:notebook:a': 730}, columnGroups: []};
const layoutContext = vm.createContext({
  reportScreen: {isOpen: () => menuReportOpen}, fitColumnsButton: fit, collapseReadersButton: closeColumns,
  document: {querySelector: selector => selector.endsWith('.report-draft-panel') ? reportPanel : reportReady ? {} : null,
    querySelectorAll: () => workspaceOnly},
  defaultActivePaneIDs: () => [], activePaneIDs: () => ['reader:one', 'project:notebook:a'],
  workflowPaneIsVisible: id => id === 'reader:one', defaultPaneWidthForID: () => 600,
  resetReportColumnWidths: panel => {assert.equal(panel, reportPanel); reportResets++;},
  syncReferenceReaderLayout() {}, syncResearchColumnLayout() {}, workspaceColumnExpansion: null, state: layoutState, track: layoutTrack,
  saveWorkspaceState: () => savedLayouts++, transitionWorkspace: async () => workspaceTransitions++, requestAnimationFrame: callback => callback()
});
vm.runInContext([actual('updateWorkspaceLayoutControls'), actual('resetVisibleColumnWidths')].join('\n'), layoutContext);
layoutContext.updateWorkspaceLayoutControls();
assert.equal(fit.hidden, false, 'Report reset stays available even when no Research columns are open');
assert.equal(fit.disabled, false);
assert.equal(fit.title, 'Restore default Report column widths');
assert.ok(workspaceOnly.every(button => button.hidden), 'Report does not expose actions that operate on another view');
assert.equal(closeColumns.hidden, true);
await layoutContext.resetVisibleColumnWidths();
assert.equal(reportResets, 1);
assert.equal(layoutState.paneWeights['reader:one'], 900);
assert.equal(savedLayouts, 0);
assert.equal(workspaceTransitions, 0, 'Report reset does not rebuild or change the retained working views');
reportReady = false; layoutContext.updateWorkspaceLayoutControls();
assert.equal(fit.disabled, true, 'Wait for the Report columns to finish loading');
await layoutContext.resetVisibleColumnWidths();
assert.equal(reportResets, 1, 'A loading Report does not fall through to resetting another view');
menuReportOpen = false; layoutContext.updateWorkspaceLayoutControls();
assert.ok(workspaceOnly.every(button => !button.hidden), 'Research/Notebook restore their existing Layout actions');
await layoutContext.resetVisibleColumnWidths();
assert.equal(layoutState.paneWeights['reader:one'], 600);
assert.equal(layoutState.paneWeights['project:notebook:a'], 730, 'The other view retains its width');
assert.equal(savedLayouts, 1); assert.equal(workspaceTransitions, 1);
assert.equal(layoutTrack.scrollLeft, 220);
console.log('Layout reset passed: Report-aware controls and reset, loading guard, retained working views and existing Research/Notebook behavior.');

// Restoring a legacy automatic link must not reopen Notes in Research.
const notesID = 'project:notebook:legacy';
assert.equal(paneBelongsToView(notesID,'research',{[notesID]:['notebook','research']}),false);
assert.equal(paneBelongsToView(notesID,'notebook',{[notesID]:['notebook','research']}),true);
const explicitNotes = linkPaneToView({},notesID,'research');
const notesLayout = {};
applyWorkspaceLayout(notesLayout,captureWorkspaceLayout({workflowMembership:explicitNotes}));
assert.equal(paneBelongsToView(notesID,'research',notesLayout.workflowMembership),true);
assert.equal(paneBelongsToView(notesID,'notebook',notesLayout.workflowMembership),true);
