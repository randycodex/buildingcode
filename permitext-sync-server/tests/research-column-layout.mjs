import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { researchColumnsLayout } from '../public/workflow-views.js';
import { adjacentColumnWidths } from '../public/column-expansion.js';

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
for(const available of [2485,2705,3063,3685,5000]){
 const minimums=[630,920,300,630],layout=researchColumnsLayout(minimums,available,0,5,[],minimums);
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
const track = { dataset: {}, clientWidth: 2403, inert: false,
  querySelectorAll: selector => selector.includes('.pane-divider') ? Array.from({length: panels.filter(p=>!p.classList.contains('is-workflow-hidden')).length+1},()=>({getBoundingClientRect:()=>({width:1})})) : panels };
const collapsed = new Set();
const context = vm.createContext({notebookReferenceTransition:undefined, workspaceColumnExpansion: undefined, state, track, activeWorkspaceID: 'test', window: { innerWidth: 2403 }, researchColumnsLayout,
  currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400,
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
assert.deepEqual(sizes(), [300,630,630,630], 'Automatic layout reaches each minimum before scrolling');
assert.equal(track.dataset.researchColumnSizing, 'overflow');
assert.equal(panels[0].style.maxWidth, 'none');
assert.equal(panels[1].style.maxWidth, 'none', 'Overflow Readers have no CSS maximum');
state.paneWeights['reader:one'] = 1800;
delete track._researchColumnLayout;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [300,1800,630,630], 'Stored Reader widths remain uncapped in overflow');
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
assert.equal(context.minimumPaneWidthForID('utility:search:one'), 300);
assert.equal(context.maximumPaneWidthForID('utility:search:one'), Infinity);
assert.equal(context.constrainPaneWidth('utility:search:one',200),300);
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
vm.runInContext(actual('resetVisibleColumnWidths'), context);
Object.assign(context, {
  reportScreen: null,
  activePaneIDs: () => panels.map(panel => panel.dataset.paneId),
  workflowPaneIsVisible: id => id !== 'reader:hidden',
  saveWorkspaceState() {},
  async transitionWorkspace() {
    panels.filter(panel => panel.dataset.paneId !== 'reader:hidden').forEach(panel => context.applyPaneWeight(panel, panel.dataset.paneId));
    context.syncResearchColumnLayout();
  }
});
const resetFrames = [];
context.requestAnimationFrame = callback => resetFrames.push(callback);
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
  resetFrames.splice(0).forEach(callback => callback());
  const readerWidth = available === 2428 ? 759 : 630;
  assert.deepEqual(sizes().slice(0,6), [readerWidth,48,48,48,readerWidth,readerWidth]);
  assert.equal(track.dataset.researchColumnSizing, available === 2428 ? 'fit' : 'overflow');
  assert.equal(state.paneWeights['reader:hidden'], 1800);
  assert.equal(state.columnGroups[0].columns['reader:hidden'].width,1800);
  assert.equal(state.columnGroups[0].columns['reader:one'].width,630);
  assert.equal(track.scrollLeft, available === 2428 ? 0 : 300);
  context.syncResearchColumnLayout();
  assert.equal(track.dataset.researchColumnSizing, available === 2428 ? 'fit' : 'overflow', 'Later hydration keeps the reset layout');
}
console.log('Reset layout passed: clears manual widths, fills available space, retains collapsed rails and hidden views, and preserves minimums in overflow.');

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
collapsed.add('utility:analysis:one');
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1476,48,1476], 'A collapsed Assistant reserves only its rail');
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
assert.deepEqual(sizes(),[920,300,630],'Search narrows to 300px without squeezing the adjacent Reader');
context.resizeAdjacentPanesBy('utility:search:resize','reader:one',800,searchDivider);
assert.deepEqual(sizes(),[920,1100,630],'Search grows beyond 900px while Assistant retains its minimum');
assert.match(dividerValues['aria-valuetext'],/Column width 1100/i);
context.syncResearchColumnLayout();
assert.deepEqual(sizes(),[920,1100,630],'Chosen Search width survives subsequent automatic layout notifications');
console.log('Search divider resizing passed: 300px minimum, expansion from either side and persistent manual widths.');

// Sources reserves an attached internal rail without changing the base panes.
panels=[makePane('reader:sources-test'),makePane('utility:analysis'),makePane('utility:search:sources-test')];
panels.forEach(panel=>{panel.isConnected=true;panel.classList.toggle=(name,on)=>on?panel.classList.add(name):panel.classList.remove(name);});
track.clientWidth=2804;context.window.innerWidth=2804;workflow='research';
state.paneWeights={};state.researchColumnWidthsManual=false;delete track._researchColumnLayout;
context.syncResearchColumnLayout();const beforeSources=sizes();
context.saveWorkspaceState=()=>{};context.requestAnimationFrame=callback=>callback();
vm.runInContext(actual('setAssistantSourcesRail'),context);
let reveals=0;const sourcesRail={isConnected:true,scrollIntoView(){reveals++;}};
context.setAssistantSourcesRail(panels[1],true,sourcesRail);
assert.deepEqual(sizes(),beforeSources,'Opening sources never narrows the Assistant or neighboring panes');
assert.equal(panels[1].dataset.assistantSourcesWidth,'300');assert.equal(reveals,1);
assert.equal(state.paneWeights['utility:analysis'],beforeSources[1],'Saved pane weights exclude the temporary source rail');
context.setAssistantSourcesRail(panels[1],true,sourcesRail,{reveal:false});
assert.deepEqual(sizes(),beforeSources,'Updating the answer in an open rail never adds width again');
context.setAssistantSourcesRail(panels[1],false,sourcesRail);
assert.deepEqual(sizes(),beforeSources,'Closing the source rail keeps the original base dimensions');
context.setAssistantSourcesRail(panels[1],true,sourcesRail,{reveal:false});
context.syncResearchColumnLayout({reset:true});
assert(Math.abs(sizes().reduce((sum,width)=>sum+width,304)-track.clientWidth)<1e-8,'Explicit auto-fit reserves the attached 300px rail');
const resized=sizes();context.setAssistantSourcesRail(panels[1],false,sourcesRail);
assert(sizes().every((width,index)=>width>=resized[index]),'Closing after an explicit reset may fill available space but never narrows a pane');
assert.equal(panels[1].dataset.assistantSourcesWidth,'0');
console.log('Assistant source geometry passed: reserved width, unchanged chat/neighbors, repeat selection, reset and close.');

let finishMotion;
sourcesRail.getAnimations=()=>[{finished:new Promise(resolve=>{finishMotion=resolve;})}];
const beforeReveal=reveals;
context.setAssistantSourcesRail(panels[1],true,sourcesRail);
assert.equal(reveals,beforeReveal,'Workspace scrolling waits for the source rail to finish expanding');
finishMotion();await new Promise(resolve=>setImmediate(resolve));
assert.equal(reveals,beforeReveal+1);
context.setAssistantSourcesRail(panels[1],false,sourcesRail);
context.setAssistantSourcesRail(panels[1],true,sourcesRail);
context.setAssistantSourcesRail(panels[1],false,sourcesRail);
finishMotion();await new Promise(resolve=>setImmediate(resolve));
assert.equal(reveals,beforeReveal+1,'Closing during the motion cannot cause a late workspace scroll');
console.log('Source rail motion passed: reveal after expansion and no late scroll when closing.');

// Conversation history reserves its own 265px beyond the collapsed 35px
// control. Neither rail becomes a saved base width or resizes another pane.
vm.runInContext(actual('setAssistantHistoryRail'),context);
state.researchColumnWidthsManual=false;
panels[1].dataset.assistantSourcesWidth='0';
context.setAssistantHistoryRail(panels[1],true,{initial:true});
assert.equal(panels[1].dataset.assistantHistoryWidth,'265');
assert.equal(state.researchColumnWidthsManual,false,'Initial list restoration retains automatic-fit mode');
const historyBases=sizes();
context.setAssistantHistoryRail(panels[1],false);
assert.deepEqual(sizes(),historyBases,'Closing history preserves every visible base pane');
assert.equal(state.researchColumnWidthsManual,false,'A list toggle never persists manual sizing');
assert.equal(track.dataset.researchColumnSizing,'reserved','A list toggle temporarily holds geometry');
context.setAssistantHistoryRail(panels[1],true);
assert.deepEqual(sizes(),historyBases,'Opening history adds workspace space without taking column width');
assert.equal(state.paneWeights['utility:analysis'],historyBases[1]);
context.setAssistantSourcesRail(panels[1],true,sourcesRail,{reveal:false});
assert.deepEqual(sizes(),historyBases,'History and Sources can both open beside the same base conversation');
assert.equal(Number(panels[1].dataset.assistantHistoryWidth)+Number(panels[1].dataset.assistantSourcesWidth),565);
context.setAssistantHistoryRail(panels[1],false);
assert.equal(panels[1].dataset.assistantSourcesWidth,'300','Closing history never closes Sources');
context.setAssistantHistoryRail(panels[1],true);
context.syncResearchColumnLayout({reset:true});
assert(Math.abs(sizes().reduce((sum,width)=>sum+width,569)-track.clientWidth)<1e-8,'Explicit auto-fit reserves both side rails');
console.log('Conversation history geometry passed: independent reserved width, stable base panes on open/close, compatible Sources, initial restore and explicit auto-fit.');

// Restore must use defaults, not drag minimums, when the open columns cannot
// fit. The 300px Search minimum remains available for an intentional resize.
for (const available of [1600, 3063, 4200]) {
  panels = ['reader:one','reader:two','utility:analysis','utility:search:restore','utility:calculator'].map(makePane);
  panels[2].dataset.assistantSourcesWidth = '300';
  collapsed.clear();
  state.paneWeights = {'reader:one':800,'reader:two':800,'utility:analysis':1100,'utility:search:restore':300,'utility:calculator':600};
  state.researchColumnWidthsManual = true;
  context.activeWorkspaceID = 'project:restore-search';
  context.window.innerWidth = track.clientWidth = available;
  delete track._researchColumnLayout;
  context.syncResearchColumnLayout();
  assert.equal(sizes()[3],300,'A deliberately narrow Search remains 300px before Restore');
  await context.resetVisibleColumnWidths();
  if (available < 3686) {
    assert.deepEqual(sizes(),[630,630,920,600,600],'Restore uses a 600px Search and scrolls instead of squeezing it');
    assert.equal(track.dataset.researchColumnSizing,'overflow');
    assert.equal(state.paneWeights['utility:search:restore'],600);
    context.syncResearchColumnLayout();
    assert.equal(sizes()[3],600,'Later layout updates retain the restored Search default');
  } else {
    assert.equal(track.dataset.researchColumnSizing,'fit');
    assert(Math.abs(sizes().reduce((sum,width)=>sum+width,306)-available)<1e-8,'A wide desk still distributes all remaining space');
  }
}
console.log('Restore Search regression passed: 600px default in overflow with Sources, 300px manual minimum, stable subsequent updates and full fit on a wide desk.');

// Regression: rail toggles used to save manual=true for default-width panes.
// Reopening that two-column workspace left over 1,000px unused on the right.
workflow='research';context.activeWorkspaceID='project:automatic-recovery';
context.window.innerWidth=track.clientWidth=3063;
collapsed.clear();
panels=['reader:gap','utility:analysis:gap'].map(makePane);
panels.forEach(panel=>{panel.isConnected=true;panel.classList.toggle=(name,on)=>on?panel.classList.add(name):panel.classList.remove(name);});
panels[1].dataset.assistantHistoryWidth='265';
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
assert.deepEqual(sizes(),[630,920,300,600,630],'Only after all automatic columns reach minimums does the desk scroll');
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
