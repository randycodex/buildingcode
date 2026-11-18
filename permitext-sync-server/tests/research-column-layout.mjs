import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { researchColumnsLayout } from '../public/workflow-views.js';
import { adjacentColumnWidths } from '../public/column-expansion.js';
import { reportWorkspaceMinimumWidth } from '../public/report-library.js';

assert.deepEqual(researchColumnsLayout([600], 2400, 0, 2), { fits: true, widths: [2398] });
assert.deepEqual(researchColumnsLayout([900, 600], 2403, 0, 3), { fits: true, widths: [1200, 1200] });
assert.deepEqual(researchColumnsLayout([900, 900, 600], 2404, 0, 4), { fits: true, widths: [800, 800, 800] });
assert.deepEqual(researchColumnsLayout([900, 900, 900, 600], 2405, 0, 5), { fits: true, widths: [600, 600, 600, 600] });
assert.deepEqual(researchColumnsLayout([400, 1400, 700, 600], 2404, 0, 5), { fits: false, widths: [600, 900, 700, 600] });
assert.deepEqual(researchColumnsLayout([900, 600], 2203, 1000, 3), { fits: true, widths: [600, 600] });
assert.deepEqual(researchColumnsLayout([1800, 1400], 1103, 0, 3, [Infinity, 900]), { fits: false, widths: [1800, 900] });
assert.deepEqual(researchColumnsLayout([920, 600], 2403, 0, 3, [Infinity, Infinity], [920, 600]), { fits: true, widths: [1200, 1200] });
assert.deepEqual(researchColumnsLayout([920, 600], 1843, 0, 3, [Infinity, Infinity], [920, 600]), { fits: true, widths: [920, 920] });
assert.deepEqual(researchColumnsLayout([920, 600], 1842, 0, 3, [Infinity, Infinity], [920, 600]), { fits: true, widths: [920, 919] });
assert.deepEqual(researchColumnsLayout([920, 600], 1523, 0, 3, [], [920, 600]), { fits: true, widths: [920, 600] });
assert.deepEqual(researchColumnsLayout([920, 600], 1522, 0, 3, [], [920, 600]), { fits: false, widths: [920, 600] });
const screenshot = researchColumnsLayout([630,920,600,630],3063,0,5,[],[630,920,600,630]);
assert.equal(screenshot.fits,true,'Different minimums fit even when an equal share would squeeze Assistant');
assert.deepEqual(screenshot.widths,[2138/3,920,2138/3,2138/3]);
assert(Math.abs(screenshot.widths.reduce((sum,width)=>sum+width,5)-3063)<1e-8,'Use all available width without a trailing gap');
for(const available of [2785,3063,3685,5000]){
 const minimums=[630,920,600,630],layout=researchColumnsLayout(minimums,available,0,5,[],minimums);
 assert.equal(layout.fits,true);assert(layout.widths.every((width,index)=>width>=minimums[index]));
 assert(Math.abs(layout.widths.reduce((sum,width)=>sum+width,5)-available)<1e-8);
}
assert.deepEqual(researchColumnsLayout([920,600],2024,500,4,[],[920,600]),{fits:true,widths:[920,600]},'Fixed panels and dividers keep their reserved width');

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
let workflow = 'research';
const makePane = id => {
  const classes = new Set();
  return { dataset: { paneId: id }, style: { setProperty(name, value) { this[name] = value; } },
    classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
    getBoundingClientRect() { return { width: classes.has('is-workflow-hidden') ? 0 : Number(this.style.flex?.split(' ').at(-1)?.replace('px', '')) || 600 }; } };
};
let panels = [makePane('utility:search:one'), makePane('reader:one')];
const state = { paneWeights: { 'utility:search:one': 1400, 'reader:one': 400 } };
const track = { dataset: {}, clientWidth: 2403, inert: false, querySelector: () => null,
  querySelectorAll: selector => selector.includes('.pane-divider') ? Array.from({length: panels.filter(p=>!p.classList.contains('is-workflow-hidden')).length+1},()=>({getBoundingClientRect:()=>({width:1})})) : panels };
const collapsed = new Set();
const assistantRailExpansion = 228;
const context = vm.createContext({notebookReferenceTransition:undefined, workspaceColumnExpansion: undefined, workspaceResumeReady:true, state, track, activeWorkspaceID: 'test', window: { innerWidth: 2403 }, researchColumnsLayout,
  currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400, assistantRailExpansion,
  activePaneIDs: () => panels.map(panel => panel.dataset.paneId),
  workflowPaneIsVisible: id => !panels.find(panel => panel.dataset.paneId === id)?.classList.contains('is-workflow-hidden'),
  assistantHistoryOnlyPane: id => id === 'utility:analysis:history', paneIsCollapsed: id => collapsed.has(id), defaultPaneWidthForID: id => id.startsWith('reader:') ? 630 : 600,
  applyPaneWeight(panel, id) { panel.style.flex = `1 0 ${state.paneWeights[id] || 600}px`; } });
vm.runInContext(['minimumPaneWidthForID', 'maximumPaneWidthForID', 'constrainPaneWidth', 'syncNotebookColumnLayout', 'syncResearchColumnLayout', 'capturePaneResizeWidths'].map(actual).join('\n'), context);
const sizes = () => panels.map(p=>p.getBoundingClientRect().width);
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1200, 1200], 'Existing unequal widths share the available screen');
assert.equal(panels[0].style.maxWidth, 'none', 'A fitting layout may exceed the overflow limit');
panels.push(makePane('reader:two'));
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [2399/3, 2399/3, 2399/3]);
panels.push(makePane('reader:three'));
track.clientWidth = 2005;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,630,630,630], 'Automatic layout reaches each minimum before scrolling');
assert.equal(track.dataset.researchColumnSizing, 'overflow');
assert.equal(panels[0].style.maxWidth, 'none');
assert.equal(panels[1].style.maxWidth, 'none', 'Overflow Readers have no CSS maximum');
state.paneWeights['reader:one'] = 1800;
delete track._researchColumnLayout;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,630,630,630], 'Stored automatic widths come down to minimums in overflow');
state.paneWeights['reader:one'] = 1800;
state.researchColumnWidthsManual = true;
delete track._researchColumnLayout;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,1800,630,630], 'Explicit manual widths remain uncapped when restored');
context.capturePaneResizeWidths();
state.paneWeights['utility:search:one'] = 850;
state.paneWeights['reader:one'] = 1800;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [850,1800,630,630], 'Manual Reader widths beyond 900px survive layout notifications');
track.clientWidth = 3605;
context.syncResearchColumnLayout({reset:true});
assert.deepEqual(sizes(), [900,900,900,900], 'A viewport change restores equal sharing');
collapsed.add('reader:three');
context.syncResearchColumnLayout();
assert.equal(panels[3].style.flex, '0 0 48px');
assert.equal(panels[3].style.maxWidth, '');
assert.deepEqual(sizes().slice(0,3), [3552/3,3552/3,3552/3], 'A collapsed rail does not consume a full share');
const hidden = makePane('reader:hidden'); hidden.classList.add('is-workflow-hidden'); panels.push(hidden);
state.paneWeights['reader:hidden'] = 720;
context.syncResearchColumnLayout();
assert.equal(state.paneWeights['reader:hidden'], 720, 'Retained Notebook columns keep their saved width');
track.inert = true;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, undefined);
assert.ok(panels.every(p=>!p.dataset.researchSized), 'Settings restores the normal sizing rules');
track.inert = false;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, 'fit');
context.window.innerWidth = 760;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, undefined, 'Phone paging keeps its viewport width');
assert.equal(context.minimumPaneWidthForID('reader:one'), 630);
assert.equal(context.minimumPaneWidthForID('utility:search:one'), 600);
assert.equal(context.maximumPaneWidthForID('utility:search:one'), Infinity);
assert.equal(context.constrainPaneWidth('utility:search:one',200),600);
assert.equal(context.constrainPaneWidth('utility:search:one',1400),1400);
assert.equal(context.maximumPaneWidthForID('reader:one'), Infinity);
workflow = 'project-details';
assert.equal(context.minimumPaneWidthForID('reader:one'), 630, 'Project reference Readers share the 630px minimum');
console.log('Research columns passed: minimum-aware full fit, adjustable Search, manual persistence, collapse and phone isolation.');

// Chapter/code refreshes prepare the live header again. That reapplies the
// stored width, so the Research layout must be restored before publishing.
Object.assign(context, {
  resolvedReaderSourceNavigations: new WeakMap(),
  workspaceReaderContentIdentity: () => 'reader-navigation',
  beginReaderNavigation: panel => panel.dataset.readerNavigationToken = 'current',
  applyCodeTheme() {}, renderReaderTrust() {}, populateCodeSelect() {}, resetEnhancedSelects() {},
  populateReaderSelectors: async () => true, renderSectionContent: async () => {},
  setTitle() {}, enhanceSelect() {},
  preparePaneCollapse: panel => context.applyPaneWeight(panel, panel.dataset.paneId)
});
vm.runInContext(actual('refreshReaderContent'), context);
workflow = 'research';
context.window.innerWidth = track.clientWidth = 2403;
collapsed.clear();
for (const count of [1, 2]) {
  panels = ['reader:one', ...(count === 2 ? ['utility:search:one'] : [])].map(makePane);
  state.paneWeights = Object.fromEntries(panels.map(panel => [panel.dataset.paneId, 600]));
  delete track._researchColumnLayout;
  const readerPanel = panels[0];
  Object.assign(readerPanel, { isConnected: true, querySelector: () => null, querySelectorAll: () => [] });
  context.syncResearchColumnLayout();
  const before = sizes();
  await context.refreshReaderContent(readerPanel, {chapterID: 'any-chapter'});
  assert.deepEqual(sizes(), before, `Changing chapters keeps the fitted width with ${count} columns`);
  context.capturePaneResizeWidths();
  state.paneWeights['reader:one'] = 1800;
  context.syncResearchColumnLayout();
  const resized = sizes();
  await context.refreshReaderContent(readerPanel, {chapterID: 'another-code-chapter'});
  assert.deepEqual(sizes(), resized, 'Changing chapters also preserves manual widths');
}
console.log('Reader navigation preserves fitted and manually resized widths for one and multiple columns.');

// A fresh page has no track._researchColumnLayout. Restore the saved sizing
// mode rather than replacing manually chosen widths with equal shares.
for (const widths of [[1800, 630], [730, 630]]) {
  panels = ['reader:one', 'reader:two'].map(makePane);
  state.paneWeights = Object.fromEntries(panels.map((panel, index) => [panel.dataset.paneId, widths[index]]));
  state.researchColumnWidthsManual = true;
  delete track._researchColumnLayout;
  context.syncResearchColumnLayout();
  assert.deepEqual(sizes(), widths, 'Reloading restores selected Reader widths even when equal columns could fit');
  assert.equal(track.dataset.researchColumnSizing, 'manual');
}
context.syncResearchColumnLayout({reset:true});
assert.equal(state.researchColumnWidthsManual, false, 'An explicit layout reset returns to automatic sizing');

// Reset layout must leave manual sizing and fill the desk again. Retain the
// collapsed rails and widths saved in other views, including grouped columns.
vm.runInContext(['isProjectReportDraftPaneID','workspaceColumnRank','orderedWorkspaceColumnIDs','resetVisibleColumnWidths'].map(actual).join('\n'), context);
Object.assign(context, {
  reportScreen: null,
  defaultActivePaneIDs: () => panels.map(panel => panel.dataset.paneId),
  activePaneIDs: () => panels.map(panel => panel.dataset.paneId),
  workflowPaneIsVisible: id => id !== 'reader:hidden',
  saveWorkspaceState() {},
  captureWorkspaceColumnMotion:()=>null, animateWorkspaceColumnMotion() {},
  appendPaneSequence() {
    panels.filter(panel => panel.dataset.paneId !== 'reader:hidden').forEach(panel => context.applyPaneWeight(panel, panel.dataset.paneId));
    context.syncResearchColumnLayout();
  }
});
Object.defineProperty(track, 'scrollWidth', {get: () => Math.max(track.clientWidth,
  panels.filter(panel => panel.dataset.paneId !== 'reader:hidden')
    .reduce((total, panel) => total + panel.getBoundingClientRect().width + 1, 1))});
for (const available of [2428,1600]) {
  panels = ['reader:one','utility:analysis','utility:search:one','utility:calculator','reader:two','reader:three','reader:hidden'].map(makePane);
  panels.at(-1).classList.add('is-workflow-hidden');
  collapsed.clear();
  ['utility:analysis','utility:search:one','utility:calculator'].forEach(id => collapsed.add(id));
  state.paneWeights = Object.fromEntries(panels.map(panel => [panel.dataset.paneId, 1800]));
  state.columnGroups = [{columns: {'reader:one': {width:1800}, 'reader:hidden': {width:1800}}}];
  workflow = 'research';
  context.window.innerWidth = track.clientWidth = available;
  delete track._researchColumnLayout;
  context.syncResearchColumnLayout();
  context.capturePaneResizeWidths();
  state.paneWeights['reader:one'] = 1800;
  context.syncResearchColumnLayout();
  track.scrollLeft = 300;
  await context.resetVisibleColumnWidths();
  const readerWidth = available === 2428 ? 759 : 630;
  assert.deepEqual(sizes().slice(0,6), [readerWidth,48,48,48,readerWidth,readerWidth]);
  assert.equal(track.dataset.researchColumnSizing, available === 2428 ? 'fit' : 'overflow');
  assert.equal(state.paneWeights['reader:hidden'], 1800);
  assert.equal(state.columnGroups[0].columns['reader:hidden'].width,1800);
  assert.equal(state.columnGroups[0].columns['reader:one'].width,630);
  assert.equal(track.scrollLeft, 300, "Reset keeps the workspace scroll offset.");
  assert.deepEqual(Array.from(state.paneOrder), ['reader:one','reader:two','reader:three','reader:hidden','utility:search:one','utility:analysis','utility:calculator']);
  context.syncResearchColumnLayout();
  assert.equal(track.dataset.researchColumnSizing, available === 2428 ? 'fit' : 'overflow', 'Later hydration keeps the reset layout');
}
console.log('Reset layout passed: clears manual widths, fills available space, retains collapsed rails and hidden views, and preserves minimums in overflow.');
{
  const defaults = ['reader:a','utility:search:a','utility:saved:a','utility:analysis:a','utility:calculator','project:notebook:a','project:report-draft:a'];
  const active = [...defaults].reverse();
  const workspace = {paneOrder:[...active], workflowVisitedViews:[]};
  const closeContext = vm.createContext({state:workspace,activeWorkspaceID:'project',captureAccountRequest:()=>({}),isCurrentAccountRequest:()=>true,
    currentColumnWorkflowView:()=> 'research',workflowPaneIsVisible:()=>true,reportScreen:{close(){active.splice(active.indexOf(defaults.at(-1)),1);}},
    defaultActivePaneIDs:()=>[...active],saveWorkspaceState(){},
    workspacePaneDescriptors:()=>active.filter(id=>id!==defaults.at(-1)).map(id=>({id,close(){active.splice(active.indexOf(id),1);}}))});
  vm.runInContext(['isProjectReportDraftPaneID','workspaceColumnRank','orderedWorkspaceColumnIDs','closeAllColumns','appendPaneIfMissing'].map(actual).join('\n'),closeContext);
  assert.equal(await closeContext.closeAllColumns(),true);
  assert.deepEqual(Array.from(workspace.paneOrder),[]);
  for (const id of [...defaults].reverse()) {active.push(id);closeContext.appendPaneIfMissing(id);}
  assert.deepEqual(Array.from(workspace.paneOrder),defaults,'Reopening after Close All restores the default slots regardless of opening order.');
}

// Production regression: switching from a fitted Project to a restored manual
// layout must not treat the previous Project's column signature as a reset.
for (const available of [1280, 1680]) {
  collapsed.clear();
  context.window.innerWidth = track.clientWidth = available;
  context.activeWorkspaceID = 'project:other';
  panels = ['reader:other'].map(makePane);
  state.paneWeights = {'reader:other':600};
  state.researchColumnWidthsManual = false;
  context.syncResearchColumnLayout();
  context.activeWorkspaceID = 'project:restored';
  panels = ['utility:calculator','utility:search:restored'].map(makePane);
  state.paneWeights = {'utility:calculator':672,'utility:search:restored':621};
  state.researchColumnWidthsManual = true;
  context.syncResearchColumnLayout();
  assert.deepEqual(sizes(), [672,621], 'Switching Projects restores preferred widths on different desktop sizes');
  assert.equal(state.researchColumnWidthsManual, true);
  assert.equal(track.dataset.researchColumnSizing, 'manual');
  context.activeWorkspaceID = 'project:auto';
  state.researchColumnWidthsManual = false;
  context.syncResearchColumnLayout();
  assert.equal(track.dataset.researchColumnSizing, 'fit', 'Manual sizing does not leak into a different Project');
}
console.log('Project switching preserves restored manual widths and isolates automatic/manual sizing between Projects.');

// A reorder or staged mount changes the DOM signature inside the same Project.
// It must not clear the preference before it can be synchronized elsewhere.
context.activeWorkspaceID = 'project:manual';
context.window.innerWidth = track.clientWidth = 1680;
collapsed.clear();
panels = ['utility:search:manual','utility:calculator'].map(makePane);
state.paneWeights = {'utility:calculator':648,'utility:search:manual':629};
state.researchColumnWidthsManual = true;
const stagedMembership = [...panels.map(panel=>panel.dataset.paneId),'reader:staged'];
context.activePaneIDs = () => stagedMembership;
context.syncResearchColumnLayout();
panels.reverse();
context.syncResearchColumnLayout();
assert.deepEqual(sizes(),[648,629], 'Reordering preserves the manually selected widths');
assert.equal(state.researchColumnWidthsManual,true,'Reordering does not upload an automatic sizing mode');
panels.push(makePane('reader:staged'));
state.paneWeights['reader:staged']=710;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(),[648,629,710], 'Staged hydration keeps saved widths rather than resetting every pane');
console.log('Reordering and staged hydration preserve the manual preference for subsequent cross-browser sync.');
context.activePaneIDs = () => panels.map(panel=>panel.dataset.paneId);

// Cold Assistant restoration uses the same equal-share layout as Reader/Search,
// while its history + composer minimum remains intact on narrower desktops.
context.assistantHistoryWidth = 320;
collapsed.clear();
for (const assistantID of ['utility:analysis', 'utility:analysis:one', 'research:conversation:one']) {
  for (const available of [2403, 1843, 1842, 1280]) {
    panels = [assistantID, 'reader:one'].map(makePane);
    state.paneWeights = {[assistantID]:920, 'reader:one':600};
    state.researchColumnWidthsManual = false;
    context.window.innerWidth = track.clientWidth = available;
    delete track._researchColumnLayout;
    context.syncResearchColumnLayout();
    assert.deepEqual(sizes(), available >= 1843 ? [(available-3)/2, (available-3)/2] : available >= 1553 ? [920,available-3-920] : [920,630], 'Cold Assistant retains its minimum while Reader fills the remaining space');
    assert.equal(panels[0].style['--pane-default-min-width'], '920px');
    assert.equal(panels[0].style.maxWidth, 'none', 'Assistant has no Search-style maximum');
  }
  context.window.innerWidth = track.clientWidth = 2403;
  state.paneWeights = {[assistantID]:1400, 'reader:one':1000};
  state.researchColumnWidthsManual = true;
  delete track._researchColumnLayout;
  context.syncResearchColumnLayout();
  assert.deepEqual(sizes(), [1400,1000], 'Cold restoration retains manually resized Assistant and Reader widths');
  panels.reverse();
  context.syncResearchColumnLayout();
  assert.deepEqual(sizes(), [1000,1400], 'Reordering keeps resized Assistant widths');
  context.syncResearchColumnLayout({reset:true});
  assert.deepEqual(sizes(), [1200,1200], 'Reset restores equal Assistant shares');
  context.window.innerWidth = track.clientWidth = 1280;
  context.syncResearchColumnLayout();
  assert.deepEqual(sizes(), [630,920], 'Shrinking the viewport preserves Assistant history and composer minimum');
}
panels = ['utility:search:one', 'utility:analysis:one', 'reader:one'].map(makePane);
state.paneWeights = {'utility:search:one':600, 'utility:analysis:one':920, 'reader:one':600};
state.researchColumnWidthsManual = false;
context.window.innerWidth = track.clientWidth = 3004;
delete track._researchColumnLayout;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1000,1000,1000], 'Search, Assistant and Reader share three equal columns');
panels[1].dataset.assistantHistoryWidth = '228';
panels[1].dataset.assistantSourcesWidth = '228';
collapsed.add('utility:analysis:one');
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1476,48,1476], 'A collapsed Assistant gives up its saved Chats and Sources space');
console.log('Assistant layout passed: cold equal sharing, 920px minimum, manual restoration, reset, reorder and collapsed rails.');

// Exercise the real keyboard-divider path used by Search on either side.
collapsed.clear();
panels=['utility:analysis','utility:search:resize','reader:one'].map(makePane);
state.paneWeights={'utility:analysis':920,'utility:search:resize':600,'reader:one':630};
panels.forEach(p=>context.applyPaneWeight(p,p.dataset.paneId));
track.querySelector=selector=>panels.find(p=>selector.includes(`"${p.dataset.paneId}"`));
Object.assign(context,{CSS:{escape:id=>id},adjacentColumnWidths,notebookReferenceResize:()=>null,scheduleVisibleReaderScrollIndicatorUpdates(){},notifyWorkspaceLayoutChange(){}});
vm.runInContext(actual('updateAdjacentDividerValue')+'\n'+actual('resizePaneEdgeBy')+'\n'+actual('resizeAdjacentPanesBy'),context);
const dividerValues={};const searchDivider={setAttribute:(key,value)=>dividerValues[key]=value};
context.resizeAdjacentPanesBy('utility:search:resize','reader:one',-300,searchDivider);
assert.deepEqual(sizes(),[920,600,630],'Search stops at 600px without squeezing the adjacent Reader');
context.resizeAdjacentPanesBy('utility:search:resize','reader:one',500,searchDivider);
assert.deepEqual(sizes(),[920,1100,630],'Search grows beyond 900px while Assistant retains its minimum');
assert.match(dividerValues['aria-valuetext'],/Column width 1100/i);
context.syncResearchColumnLayout();
assert.deepEqual(sizes(),[920,1100,630],'Chosen Search width survives subsequent automatic layout notifications');
console.log('Search divider resizing passed: 600px minimum, expansion from either side and persistent manual widths.');

// Sources reserves an attached internal rail without changing the base panes.
panels=[makePane('reader:sources-test'),makePane('utility:analysis'),makePane('utility:search:sources-test')];
panels.forEach(panel=>{panel.isConnected=true;panel.classList.toggle=(name,on)=>on?panel.classList.add(name):panel.classList.remove(name);});
track.clientWidth=2804;context.window.innerWidth=2804;workflow='research';
state.paneWeights={};state.researchColumnWidthsManual=false;delete track._researchColumnLayout;
context.syncResearchColumnLayout();const beforeSources=sizes();
context.saveWorkspaceState=()=>{};context.requestAnimationFrame=callback=>callback();
vm.runInContext(actual('setAssistantSourcesRail'),context);
track.scrollLeft=400;
context.setAssistantSourcesRail(panels[1],true);
assert.deepEqual(sizes(),beforeSources,'Opening sources never narrows the Assistant or neighboring panes');
assert.equal(panels[1].dataset.assistantSourcesWidth,String(assistantRailExpansion));assert.equal(track.scrollLeft,400,'Opening answer sources leaves workspace scroll alone.');
assert.equal(state.paneWeights['utility:analysis'],beforeSources[1],'Saved pane weights exclude the temporary source rail');
context.setAssistantSourcesRail(panels[1],true);
assert.deepEqual(sizes(),beforeSources,'Updating the answer in an open rail never adds width again');
context.setAssistantSourcesRail(panels[1],false);
assert.deepEqual(sizes(),beforeSources,'Closing the source rail keeps the original base dimensions');
context.setAssistantSourcesRail(panels[1],true);
context.syncResearchColumnLayout({reset:true});
assert(Math.abs(sizes().reduce((sum,width)=>sum+width,assistantRailExpansion+4)-track.clientWidth)<1e-8,'Auto-fit reserves only the added Sources width');
const resized=sizes();context.setAssistantSourcesRail(panels[1],false);
assert(sizes().every((width,index)=>width>=resized[index]),'Closing after an explicit reset preserves the fitted base widths');
assert.equal(panels[1].dataset.assistantSourcesWidth,'0');
console.log('Assistant source geometry passed: reserved width, unchanged chat/neighbors, repeat selection, reset and close.');

// Each rail reserves only the difference between its collapsed and expanded widths.
vm.runInContext(actual('setAssistantHistoryRail'),context);
state.researchColumnWidthsManual=false;
panels[1].dataset.assistantSourcesWidth='0';
context.setAssistantHistoryRail(panels[1],true,{initial:true});
assert.equal(panels[1].dataset.assistantHistoryWidth,String(assistantRailExpansion));
assert.equal(state.researchColumnWidthsManual,false,'Initial list restoration retains automatic-fit mode');
const historyBases=sizes();
context.setAssistantHistoryRail(panels[1],false);
assert.deepEqual(sizes(),historyBases,'Closing history preserves every visible base pane');
assert.equal(state.researchColumnWidthsManual,false,'A list toggle never persists manual sizing');
assert.equal(track.dataset.researchColumnSizing,'reserved','A list toggle temporarily holds geometry');
context.setAssistantHistoryRail(panels[1],true);
assert.deepEqual(sizes(),historyBases,'Opening history adds workspace space without taking column width');
assert.equal(state.paneWeights['utility:analysis'],historyBases[1]);
context.setAssistantSourcesRail(panels[1],true);
assert.deepEqual(sizes(),historyBases,'History and Sources can both open beside the same base conversation');
assert.equal(Number(panels[1].dataset.assistantHistoryWidth)+Number(panels[1].dataset.assistantSourcesWidth),2*assistantRailExpansion);
context.setAssistantHistoryRail(panels[1],false);
assert.equal(panels[1].dataset.assistantSourcesWidth,String(assistantRailExpansion),'Closing history never closes Sources');
context.setAssistantHistoryRail(panels[1],true);
context.syncResearchColumnLayout({reset:true});
assert(Math.abs(sizes().reduce((sum,width)=>sum+width,2*assistantRailExpansion+4)-track.clientWidth)<1e-8,'Explicit auto-fit reserves both side rails');
console.log('Conversation history geometry passed: independent reserved width, stable base panes on open/close, compatible Sources, initial restore and explicit auto-fit.');

// Restore must use defaults, not drag minimums, when the open columns cannot
// fit. Saved Search widths below 600px migrate to the minimum.
for (const available of [1600, 3063, 4200]) {
  panels = ['reader:one','reader:two','utility:analysis','utility:search:restore','utility:calculator'].map(makePane);
  panels[2].dataset.assistantSourcesWidth = String(assistantRailExpansion);
  collapsed.clear();
  state.paneWeights = {'reader:one':800,'reader:two':800,'utility:analysis':1100,'utility:search:restore':300,'utility:calculator':600};
  state.researchColumnWidthsManual = true;
  context.activeWorkspaceID = 'project:restore-search';
  context.window.innerWidth = track.clientWidth = available;
  delete track._researchColumnLayout;
  context.syncResearchColumnLayout();
  assert.equal(sizes()[3],600,'An older narrow Search is clamped to 600px before Restore');
  await context.resetVisibleColumnWidths();
  if (available < 3380 + assistantRailExpansion + 6) {
    assert.deepEqual(sizes(),[630,630,920,600,600],'Restore uses a 600px Search and scrolls instead of squeezing it');
    assert.equal(track.dataset.researchColumnSizing,'overflow');
    assert.equal(state.paneWeights['utility:search:restore'],600);
    context.syncResearchColumnLayout();
    assert.equal(sizes()[3],600,'Later layout updates retain the restored Search default');
  } else {
    assert.equal(track.dataset.researchColumnSizing,'fit');
    assert(Math.abs(sizes().reduce((sum,width)=>sum+width,assistantRailExpansion+6)-available)<1e-8,'A wide desk still distributes all remaining space');
  }
}
console.log('Restore Search regression passed: 600px default in overflow with Sources, 600px manual minimum, stable subsequent updates and full fit on a wide desk.');

// Regression: rail toggles used to save manual=true for default-width panes.
// Reopening that two-column workspace left over 1,000px unused on the right.
workflow='research';context.activeWorkspaceID='project:automatic-recovery';
context.window.innerWidth=track.clientWidth=3063;
collapsed.clear();
panels=['reader:gap','utility:analysis:gap'].map(makePane);
panels.forEach(panel=>{panel.isConnected=true;panel.classList.toggle=(name,on)=>on?panel.classList.add(name):panel.classList.remove(name);});
panels[1].dataset.assistantHistoryWidth=String(assistantRailExpansion);
state.paneWeights={'reader:gap':630,'utility:analysis:gap':920};
state.researchColumnWidthsManual=true;delete track._researchColumnLayout;
context.syncResearchColumnLayout();
const occupied=()=>sizes().reduce((sum,width,index)=>sum+width+(Number(panels[index].dataset.assistantHistoryWidth)||0)+(Number(panels[index].dataset.assistantSourcesWidth)||0),panels.length+1);
const fillsDesk=()=>assert(Math.abs(occupied()-track.clientWidth)<1e-8,'Fitting columns use the full desk with no trailing gap');
fillsDesk();assert.equal(track.dataset.researchColumnSizing,'fit');
assert.equal(state.researchColumnWidthsManual,false,'Legacy default widths recover automatic mode');
const beforeToggle=sizes();
context.setAssistantHistoryRail(panels[1],false);
assert.deepEqual(sizes(),beforeToggle,'The chat stays stable while its conversation list closes');
assert.equal(state.researchColumnWidthsManual,false);
context.syncResearchColumnLayout();assert.deepEqual(sizes(),beforeToggle,'Same-column refresh preserves the temporary hold');
context.setAssistantHistoryRail(panels[1],true);fillsDesk();

// A newly opened column ends the temporary hold, then a closed column fills
// the newly available width. Reordering and hydration were tested above.
panels.push(makePane('utility:search:gap'));state.paneWeights['utility:search:gap']=600;
context.syncResearchColumnLayout();fillsDesk();
assert.equal(track.dataset.researchColumnSizing,'fit');
panels.push(makePane('utility:calculator'));state.paneWeights['utility:calculator']=600;
context.syncResearchColumnLayout();fillsDesk();
assert(sizes().every((width,index)=>width>=context.minimumPaneWidthForID(panels[index].dataset.paneId)));
panels.push(makePane('reader:overflow'));state.paneWeights['reader:overflow']=630;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing,'overflow');
assert.deepEqual(sizes(),[630,920,600,600,630],'Only after all automatic columns reach minimums does the desk scroll');
panels.pop();context.syncResearchColumnLayout();fillsDesk();
panels.pop();context.syncResearchColumnLayout();fillsDesk();

// A real divider still resizes only its column and persists through refresh.
context.resizePaneEdgeBy('utility:search:gap',100,searchDivider);
const manuallyResized=sizes();context.syncResearchColumnLayout();
assert.deepEqual(sizes(),manuallyResized);assert.equal(state.researchColumnWidthsManual,true);
panels.pop();context.syncResearchColumnLayout();fillsDesk();
assert.equal(state.researchColumnWidthsManual,false,'Closing a column starts a fresh automatic fit');
const beforeSourcesToggle=sizes();
context.setAssistantSourcesRail(panels[1],true,{isConnected:true},{reveal:false});
assert.deepEqual(sizes(),beforeSourcesToggle);assert.equal(state.researchColumnWidthsManual,false);

context.setAssistantSourcesRail(panels[1],false,{isConnected:true},{reveal:false});
assert.deepEqual(sizes(),beforeSourcesToggle);
context.window.innerWidth=track.clientWidth=3400;context.syncResearchColumnLayout();fillsDesk();
console.log('Automatic-fit recovery passed: legacy gap, stable rail toggles, column open/close, minimum-only overflow, actual divider persistence and wider viewport recovery.');

// Expanded Report sidebars count at initial fit and on whole-layout changes.
// A direct toggle holds the fitted editor and pushes only to the right.
context.activeWorkspaceID='project:report-fit';
panels=Array.from({length:7},(_,index)=>makePane(`reader:parked:${index}`));
collapsed.clear();
panels.forEach(panel=>collapsed.add(panel.dataset.paneId));
const report=makePane('project:report-draft:fit');
const draft={dataset:{libraryOpen:'true',outlineHidden:'false',reportsHidden:'false'}};
report.querySelector=()=>draft;
report.style.getPropertyValue=key=>report.style[key];
track.querySelector=selector=>selector.includes('.shared-report-column')?report:null;
context.activePaneIDs=()=>[...panels.map(panel=>panel.dataset.paneId),report.dataset.paneId];
context.reportWorkspaceMinimumWidth=reportWorkspaceMinimumWidth;
state.paneWeights={};
state.researchColumnWidthsManual=false;
const reportBase=()=>parseFloat(report.style['--workspace-report-width']);
const resizeWorkspace=width=>{
  context.window.innerWidth=track.clientWidth=width;
  context.syncResearchColumnLayout();
};
for(const available of [1920,2133,2134,3403]) {
  resizeWorkspace(available);
  assert.equal(reportBase(),Math.max(1160,available-344-630));
  assert.equal(track.dataset.researchColumnSizing,available>=2134?'fit':'overflow');
  assert.deepEqual(sizes(),Array(7).fill(48));
}
context.capturePaneResizeWidths({manual:false});
const readingWidth=reportBase();
draft.dataset.libraryOpen='false';
context.syncResearchColumnLayout();
assert.equal(reportBase(),readingWidth,'Closing a Report sidebar keeps its editing width');
context.syncResearchColumnLayout({reset:true});
assert.equal(reportBase(),readingWidth+210,'Auto-fit uses the space freed by the sidebar');
context.capturePaneResizeWidths({manual:false});
draft.dataset.libraryOpen='true';
context.syncResearchColumnLayout();
assert.equal(reportBase(),readingWidth+210,'Opening a sidebar preserves the fitted Report base width');
resizeWorkspace(3200);
assert.equal(reportBase(),3200-344-630,'Viewport resizing ends the temporary hold');
collapsed.delete(panels[0].dataset.paneId);
resizeWorkspace(2715);
assert.equal(sizes()[0],630);
assert.equal(reportBase(),1160);
assert.equal(track.dataset.researchColumnSizing,'overflow','Reader and Report both reach their minimums first');
resizeWorkspace(2716);
assert.equal(track.dataset.researchColumnSizing,'fit','Reader and Report fit at their combined minimums');
state.researchColumnWidthsManual=true;
state.paneWeights[report.dataset.paneId]=1600;
context.workspaceResumeReady=false;
delete track._researchColumnLayout;
const withReport=track.querySelector;
track.querySelector=()=>null;
context.activePaneIDs=()=>panels.map(panel=>panel.dataset.paneId);
context.syncResearchColumnLayout();
track.querySelector=withReport;
context.activePaneIDs=()=>[...panels.map(panel=>panel.dataset.paneId),report.dataset.paneId];
context.syncResearchColumnLayout();
assert.equal(reportBase(),1600,'Refreshing a manually resized Report preserves its width through delayed mounting');
context.workspaceResumeReady=true;
resizeWorkspace(2800);
assert.equal(track.dataset.researchColumnSizing,'fit','A subsequent viewport change applies automatic fit');
const evidenceID='utility:saved:fit';
panels.push(makePane(evidenceID));
state.paneWeights[evidenceID]=300;
resizeWorkspace(3316);
assert.equal(sizes().at(-1),600,'Evidence keeps a 600px minimum in automatic overflow.');
assert.equal(track.dataset.researchColumnSizing,'overflow');
resizeWorkspace(3317);
assert.equal(sizes().at(-1),600,'Evidence fits at its minimum with the other tools.');
assert.equal(track.dataset.researchColumnSizing,'fit');
console.log('Report auto-fit passed: exact thresholds, companion Reader, all sidebar space counted and anchored sidebar expansion.');

context.activeWorkspaceID='project:all-columns-fit';
track.querySelector=()=>null;
context.activePaneIDs=()=>panels.map(panel=>panel.dataset.paneId);
for(const id of [evidenceID,'reader:fit','utility:analysis:fit','utility:calculator','project:notebook:fit',
  'utility:settings','utility:archive','project:context:fit','project:facts:fit','section:detail:fit']) {
  panels=['utility:search:fit',id].map(makePane);
  state.paneWeights={'utility:search:fit':1200,[id]:600};
  state.researchColumnWidthsManual=false;
  for(const available of [3063,1920]) {
    resizeWorkspace(available);
    const share=(available-3)/2;
    assert.deepEqual(sizes(),[share,share],`${id} shares the available space with Search after dividers.`);
  }
}
console.log('All expanded desktop columns participate in automatic width sharing.');
