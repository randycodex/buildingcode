import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { researchColumnsLayout } from '../public/workflow-views.js';

assert.deepEqual(researchColumnsLayout([600], 2400, 0, 2), { fits: true, widths: [2398] });
assert.deepEqual(researchColumnsLayout([900, 600], 2403, 0, 3), { fits: true, widths: [1200, 1200] });
assert.deepEqual(researchColumnsLayout([900, 900, 600], 2404, 0, 4), { fits: true, widths: [800, 800, 800] });
assert.deepEqual(researchColumnsLayout([900, 900, 900, 600], 2405, 0, 5), { fits: true, widths: [600, 600, 600, 600] });
assert.deepEqual(researchColumnsLayout([400, 1400, 700, 600], 2404, 0, 5), { fits: false, widths: [600, 900, 700, 600] });
assert.deepEqual(researchColumnsLayout([900, 600], 2203, 1000, 3), { fits: true, widths: [600, 600] });
assert.deepEqual(researchColumnsLayout([1800, 1400], 1103, 0, 3, [Infinity, 900]), { fits: false, widths: [1800, 900] });
assert.deepEqual(researchColumnsLayout([920, 600], 2403, 0, 3, [Infinity, Infinity], [920, 600]), { fits: true, widths: [1200, 1200] });
assert.deepEqual(researchColumnsLayout([920, 600], 1843, 0, 3, [Infinity, Infinity], [920, 600]), { fits: true, widths: [920, 920] });
assert.deepEqual(researchColumnsLayout([920, 600], 1842, 0, 3, [Infinity, Infinity], [920, 600]), { fits: false, widths: [920, 600] });

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
const context = vm.createContext({ workspaceColumnExpansion: undefined, state, track, activeWorkspaceID: 'test', window: { innerWidth: 2403 }, researchColumnsLayout,
  currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400,
  assistantHistoryOnlyPane: id => id === 'utility:analysis:history', paneIsCollapsed: id => collapsed.has(id), defaultPaneWidthForID: () => 600,
  applyPaneWeight(panel, id) { panel.style.flex = `1 0 ${state.paneWeights[id] || 600}px`; } });
vm.runInContext(['minimumPaneWidthForID', 'maximumPaneWidthForID', 'constrainPaneWidth', 'syncResearchColumnLayout', 'capturePaneResizeWidths'].map(actual).join('\n'), context);
const sizes = () => panels.map(p=>p.getBoundingClientRect().width);
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1200, 1200], 'Existing unequal widths share the available screen');
assert.equal(panels[0].style.maxWidth, 'none', 'A fitting layout may exceed the overflow limit');
panels.push(makePane('reader:two'));
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [2399/3, 2399/3, 2399/3]);
panels.push(makePane('reader:three'));
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,600,600,600], 'Adding a fourth column crosses into horizontal scrolling at the minimum');
assert.equal(track.dataset.researchColumnSizing, 'overflow');
assert.equal(panels[0].style.maxWidth, '900px');
assert.equal(panels[1].style.maxWidth, 'none', 'Overflow Readers have no CSS maximum');
state.paneWeights['reader:one'] = 1800;
delete track._researchColumnLayout;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,1800,600,600], 'Stored Reader widths remain uncapped in overflow');
context.capturePaneResizeWidths();
state.paneWeights['utility:search:one'] = 850;
state.paneWeights['reader:one'] = 1800;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [850,1800,600,600], 'Manual Reader widths beyond 900px survive layout notifications');
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
assert.equal(context.minimumPaneWidthForID('reader:one'), 600);
assert.equal(context.maximumPaneWidthForID('utility:search:one'), 900);
assert.equal(context.maximumPaneWidthForID('reader:one'), Infinity);
workflow = 'project-details';
assert.equal(context.minimumPaneWidthForID('reader:one'), 400, 'Project reference Reader bounds stay intact');
console.log('Research columns passed: equal fit, minimum widths, unlimited Readers, bounded Search, manual persistence, collapse and phone isolation.');

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
for (const widths of [[1800, 600], [730, 600]]) {
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
  const readerWidth = available === 2428 ? 759 : 600;
  assert.deepEqual(sizes().slice(0,6), [readerWidth,48,48,48,readerWidth,readerWidth]);
  assert.equal(track.dataset.researchColumnSizing, available === 2428 ? 'fit' : 'overflow');
  assert.equal(state.paneWeights['reader:hidden'], 1800);
  assert.equal(state.columnGroups[0].columns['reader:hidden'].width,1800);
  assert.equal(state.columnGroups[0].columns['reader:one'].width,600);
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
    assert.deepEqual(sizes(), available >= 1843 ? [(available-3)/2, (available-3)/2] : [920,600], 'Cold Assistant shares space only when its full minimum fits');
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
  assert.deepEqual(sizes(), [600,920], 'Shrinking the viewport preserves Assistant history and composer minimum');
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
