import {readerTabs,initializeReaderTabs,addReaderTab,canAddReaderTab} from '../public/reader-tabs.js';
import {shouldOpenNotebookByDefault} from "../public/minimal-workflow.js";
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkflowView, normalizeColumnWorkflowView, paneBelongsToView, linkPaneToView, createWorkflowScrollStore, referenceColumnsWidth, reportColumnsLayout} from '../public/workflow-views.js';
import {captureWorkspaceLayout, applyWorkspaceLayout} from '../public/workspace-state.js';
import {reportOutlineRailWidth} from '../public/report-comparison.js';
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
const project = {id:'project'};
let noteOpen = true, reportsOpen = true, notesOpened = 0, needsProject = false;
const noteID = 'project:notebook:project:primary', indexID = 'project:notes-index:project';
const state = {workflowMembership:{'reader:legacy':['notebook']}, notebookReaderHidden:true};
const c = vm.createContext({
  state, isProAccount:()=>true, detachedProjectWindow:false, workspaceProject:()=>project,
  projectHasOpenNotebook:()=>noteOpen, notebookIndexPaneID:()=>indexID, selectedNotebookColumn:()=>noteOpen ? {id:'primary'} : null,
  isProjectNotebookPaneID:id=>id.startsWith('project:notebook:'), notebookColumnPaneID:()=>noteID,
  paneBelongsToView, workflowPaneAnchors:()=>({}),
  reportScreen:{close(){reportsOpen=false;}}, projectDetailsScreen:null,
  document:{querySelector:()=>null}, workspaceColumnsRequireProject:()=>false, notifyProjectRequiredForColumn:()=>needsProject,
  openProjectNotebook:async()=>{notesOpened++;noteOpen=true;return true;}, syncWorkflowColumnPresentation(){},
});
vm.runInContext(['currentWorkflowView','currentColumnWorkflowView','sharedNotesOpen','workflowPaneIsVisible',
  'closeSharedWorkspaceViews','switchWorkflowView'].map(actual).join('\n'),c);

assert.equal(c.currentColumnWorkflowView(),'research');
assert.equal(c.workflowPaneIsVisible('reader:open'),true);
assert.equal(c.workflowPaneIsVisible('reader:legacy'),false,'Do not reopen the old hidden Notebook Reader.');
assert.equal(c.workflowPaneIsVisible('utility:saved:legacy'),false,'Do not open the old Notebook Evidence panel.');
state.workflowMembership=linkPaneToView(state.workflowMembership,'utility:saved:legacy','research');
assert.equal(c.workflowPaneIsVisible('utility:saved:legacy'),true,'Saved passages can open on request.');
assert.equal(c.workflowPaneIsVisible(indexID),true);
assert.equal(c.workflowPaneIsVisible(noteID),true);
assert.equal(c.workflowPaneIsVisible('project:notebook:project:other'),false);
assert.equal(await c.switchWorkflowView('research'),true);
assert.equal(await c.switchWorkflowView('notebook'),true);
assert.equal(notesOpened,0);
assert.equal(c.workflowPaneIsVisible('reader:open'),true);
assert.equal(reportsOpen,true,'Opening Notes keeps the existing Report visible.');
noteOpen=false;
assert.equal(c.workflowPaneIsVisible(indexID),false);
assert.equal(c.workflowPaneIsVisible(noteID),false);
assert.equal(await c.switchWorkflowView('notebook',{initialize:false}),true);
assert.equal(notesOpened,0,'A link can open a particular Note without creating a second editor.');
assert.equal(await c.switchWorkflowView('notebook'),true);
assert.equal(notesOpened,1);
assert.equal(c.workflowPaneIsVisible(indexID),true);
needsProject=true;
assert.equal(await c.switchWorkflowView('research'),false);
needsProject=false;
c.openProjectDetailsScreen=async()=>true;
assert.equal(await c.switchWorkflowView('project'),true);
c.closeSharedWorkspaceViews();
assert.equal(reportsOpen,false,'Account and Project changes may close the current Report.');

const closed=[];
c.activeWorkspaceID='workspace'; c.captureAccountRequest=()=>({}); c.isCurrentAccountRequest=()=>true;
c.saveWorkspaceState=()=>{};
c.workspacePaneDescriptors=()=>[noteID,'reader:open','reader:legacy'].map(id=>({id,close:async()=>{closed.push(id);}}));
reportsOpen=true;
vm.runInContext(actual('closeAllColumns'),c);
await c.closeAllColumns();
assert.deepEqual(closed,['reader:open',noteID],'Close all respects visible tools and leaves hidden legacy slots alone.');
assert.equal(reportsOpen,false);
console.log('Shared workspace passed: independent tools, one Notes editor, retained legacy data, and account/project guards.');

const evidenceState={paneOrder:['reader:research','project:notebook:a','utility:saved:one','utility:saved:two']};
const evidenceContext=vm.createContext({isProAccount:()=>true,state:evidenceState,workspaceProject:()=>({id:'a'}),
  projectHasOpenNotebook:()=>true,notebookPaneIDsForProject:()=> ['project:notebook:a'],paneIDForProjectNotebook:()=> 'project:notebook:a',
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
const referenceContext=vm.createContext({isProAccount:()=>true,
  document:{querySelector:selector=>selector==='.workspace-shell'?referenceShell:selector==='.account-screen[open]'?accountOpen?{}:null:referencePanel},
  state:{paneWeights:{'reader:reference':972}},track:referenceTrack,
  currentColumnWorkflowView:()=> 'report',defaultActivePaneIDs:()=>referenceIDs,
  workflowPaneIsVisible:()=>true,paneIsCollapsed:()=>false,minimumPaneWidthForID:()=>600,defaultPaneWidthForID:()=>600,
  referenceColumnsWidth,reportColumnsLayout,reportOutlineRailWidth
});
vm.runInContext([actual('maximumPaneWidthForID'),actual('constrainPaneWidth'),actual('syncReferenceReaderLayout')].join('\n'),referenceContext);
referenceContext.syncReferenceReaderLayout();
assert.equal(referenceStyles.get('--reference-document-min-width'),'1541px','The expanded Reports list retains its 300px reservation');
assert.equal(referenceStyles.get('--reference-readers-width'),'0px');
assert.equal(referenceClasses.has('has-compact-reference-document'),false);
assert.equal(referenceTrack.inert,true);
referencePanel.dataset.libraryOpen='false';referenceContext.syncReferenceReaderLayout();
assert.equal(referenceStyles.get('--reference-document-min-width'),'900px');
assert.equal(referenceClasses.has('has-compact-reference-document'),false,'Closing Sources makes room for the outline again');
referenceIDs=[];referenceContext.syncReferenceReaderLayout();
assert.equal(referenceClasses.has('has-reference-readers'),false);
accountOpen=true;referenceIDs=['reader:reference'];referenceContext.syncReferenceReaderLayout();
assert.equal(referenceTrack.inert,true,'Account keeps reference columns inactive');
assert.equal(referenceClasses.has('has-reference-readers'),false);
console.log('Report constraints passed: 600px document minimum, expanded Sources, 300px optional outline, retained hidden Readers and Account isolation.');

// Restore shared workspace and Report widths in the same action.
let reportReady=true, reportResets=0, saves=0;
const fit = {}, actions = [{},{}];
const reportPanel = {querySelector: () => reportReady ? {} : null};
const layoutTrack = {scrollLeft:220,scrollWidth:1000,clientWidth:700,querySelector:()=>reportReady ? reportPanel : null,querySelectorAll:()=>[]};
const layoutState = {paneWeights:{'reader:one':900},columnGroups:[]};
const layoutContext=vm.createContext({
  isProAccount:()=>true,currentColumnWorkflowView:()=> 'research',fitColumnsButton:fit,
  document:{querySelector:()=>reportReady?reportPanel:null,querySelectorAll:()=>actions},
  defaultActivePaneIDs:()=>['reader:one'],activePaneIDs:()=>['reader:one'],workflowPaneIsVisible:()=>true,defaultPaneWidthForID:()=>630,
  resetReportColumnWidths:panel=>{assert.equal(panel,reportPanel);reportResets++;},
  syncReferenceReaderLayout(){},syncResearchColumnLayout(){},workspaceColumnExpansion:null,state:layoutState,track:layoutTrack,
  saveWorkspaceState:()=>saves++,transitionWorkspace:async()=>{},requestAnimationFrame:fn=>fn(),
});
vm.runInContext([actual('updateWorkspaceLayoutControls'),actual('resetVisibleColumnWidths')].join('\n'),layoutContext);
layoutContext.updateWorkspaceLayoutControls();
assert.equal(fit.disabled,false);
assert.ok(actions.every(button=>!button.disabled && !button.hidden));
await layoutContext.resetVisibleColumnWidths();
assert.equal(reportResets,1);assert.equal(layoutState.paneWeights['reader:one'],630);assert.equal(saves,1);assert.equal(layoutTrack.scrollLeft,220);
reportReady=false;layoutContext.updateWorkspaceLayoutControls();assert.equal(fit.disabled,false,'A loading Report does not disable the Reader layout controls.');
console.log('Reset shared layout passed: Reader and Report widths, retained scroll and available toolbar controls.');

// Restoring a legacy automatic link must not reopen Notes in Research.
const notesID = 'project:notebook:legacy';
assert.equal(paneBelongsToView(notesID,'research',{[notesID]:['notebook','research']}),false);
assert.equal(paneBelongsToView(notesID,'notebook',{[notesID]:['notebook','research']}),true);
const explicitNotes = linkPaneToView({},notesID,'research');
const notesLayout = {};
applyWorkspaceLayout(notesLayout,captureWorkspaceLayout({workflowMembership:explicitNotes}));
assert.equal(paneBelongsToView(notesID,'research',notesLayout.workflowMembership),true);
assert.equal(paneBelongsToView(notesID,'notebook',notesLayout.workflowMembership),true);

// The shared Reader keeps all of its tabs and reading position in saved layouts.
const session={id:'shared',codePrefix:'BC',codeVersion:'2022',sectionID:'101',scrollPosition:{sectionID:'101',anchorOffset:-42}};
initializeReaderTabs(session);
for(const [index,prefix] of ['AC','PC','MC','FGC','ECC'].entries())addReaderTab(session,{codePrefix:prefix,codeVersion:'2022',sectionID:`${index+2}01`},`tab-${index}`);
assert.equal(canAddReaderTab(session),false);assert.equal(addReaderTab(session,{codePrefix:'EC'},'seventh'),null);
const restoredReaders={};applyWorkspaceLayout(restoredReaders,captureWorkspaceLayout({readers:[session]}));
assert.deepEqual(readerTabs(restoredReaders.readers[0]),readerTabs(session));
assert.deepEqual(restoredReaders.readers[0].scrollPosition,session.scrollPosition);

// Execute report-independent Notes ordering from the real workspace renderer.
const orderingStart=source.indexOf('  const project = workspaceProject();',source.indexOf('function appendPaneSequence('));
const orderingEnd=source.indexOf('  state.paneOrder =',orderingStart);
const orderContext=vm.createContext({workspaceProject:()=>project,sharedNotesOpen:()=>true,notebookIndexPaneID:()=>indexID,
  selectedNotebookColumn:()=>({id:'primary'}),notebookColumnPaneID:()=>noteID});
vm.runInContext(`function notebookOrder(orderedPanes){const panesByID=new Map(orderedPanes.map(pane=>[pane.dataset.paneId,pane]));${source.slice(orderingStart,orderingEnd)}
  return orderedPanes.map(pane=>pane.dataset.paneId);}`,orderContext);
const ids=['reader:one',noteID,'utility:search:one',indexID,'reader:two'];
const ordered=orderContext.notebookOrder(ids.map(id=>({dataset:{paneId:id}})));
assert.deepEqual(Array.from(ordered),['reader:one',indexID,noteID,'utility:search:one','reader:two']);
console.log('Shared Reader and Notes passed: six-tab cap, reload and adjacent list ordering.');
