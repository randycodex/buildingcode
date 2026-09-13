import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeColumnGroups, orderColumnGroups, normalizeWorkspaceLayout } from '../public/workspace-state.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const classes = new Set();
const draft = { value: 'Unsubmitted question', scrollTop: 460, scrollLeft: 0 };
const title = { setAttribute() {}, focus() {}, animate() {} };
const rail = { ...title, hidden: true };
const animations = [];
const panel = {
  dataset: { paneId: 'utility:search:1' }, style: {}, children: [],
  classList: { contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
  querySelector: selector => selector.includes('pane-collapsed-tab') ? rail : title,
  querySelectorAll: () => [draft],
  getBoundingClientRect: () => ({ width: classes.has('is-collapsed') ? 48 : 720 }),
  animate(frames, options) {
    let finish;
    const animation = { frames, options, finished: new Promise(resolve => { finish = resolve; }), cancel() {}, finish: () => finish() };
    animations.push(animation);
    return animation;
  }
};
const state = { collapsedPaneIDs: [], paneWeights: { 'utility:search:1': 720 }, paneOrder: ['utility:search:1'] };
let reducedMotion = false;
let saves = 0;
const context = vm.createContext({
  state, Set, Map, Array, Object,
  columnGroupForPane: id => state.columnGroups?.find(group => group.paneIDs.includes(id)),
  track: { querySelectorAll: () => [] },
  window: { matchMedia: () => ({ matches: reducedMotion }) },
  getComputedStyle: () => ({ paddingInline: '24px' }),
  captureReaderScrollPositions: () => new Map(), restoreReaderScrollPositions() {},
  applyPaneWeight() {}, closeActiveCustomSelect() {}, notifyWorkspaceLayoutChange() {},
  saveWorkspaceState: () => saves++
});
vm.runInContext(['paneIsCollapsed', 'applyPaneCollapsedState', 'updateCollapsedPaneDividers', 'setPaneCollapsed'].map(actual).join('\n'), context);
context.setPaneCollapsed(panel, true);
assert.equal(context.paneIsCollapsed(panel.dataset.paneId), true);
assert.equal(rail.hidden, false);
assert.equal(animations[0].frames[0].minWidth, '720px');
assert.equal(animations[0].frames[1].minWidth, '48px');
assert.equal(animations[0].options.duration, 240);
animations[0].finish();
await Promise.resolve();
// Simulate the browser resetting the hidden scroll container, then restore it.
draft.scrollTop = 0;
context.setPaneCollapsed(panel, false);
assert.equal(draft.scrollTop, 460);
assert.equal(draft.value, 'Unsubmitted question');
assert.equal(rail.hidden, true);
assert.deepEqual(state.paneWeights, { 'utility:search:1': 720 });
assert.deepEqual(state.paneOrder, ['utility:search:1']);
assert.equal(animations[1].frames[1].minWidth, '720px');
animations[1].finish();
await Promise.resolve();
reducedMotion = true;
context.setPaneCollapsed(panel, true);
assert.equal(animations.length, 2, 'Reduced motion skips both transitions');
context.setPaneCollapsed(panel, false);
assert.equal(animations.length, 2);
assert.equal(saves, 4);
console.log('Column collapse preserves live drafts, scroll, widths and order; animation and reduced motion passed.');

// Expanded handles and collapsed title tabs share the same reorder behavior.
function eventNode() {
  const listeners = {};
  return { dataset: {}, listeners, addEventListener(type, callback) {
    (listeners[type] ||= []).push(callback);
  }, emit(type, event = {}) { for (const callback of listeners[type] || []) callback(event); } };
}
const grip = eventNode(), collapsedTab = eventNode(), dragPane = eventNode();
dragPane.dataset.paneId = 'reader:drag';
dragPane.classList = { add() {}, remove() {} };
dragPane.querySelector = () => grip;
grip.classList = { add() {} };
dragPane.querySelectorAll = () => [grip, collapsedTab];
const dragState = { collapsedPaneIDs: ['reader:drag'], paneOrder: ['reader:drag', 'reader:target'] };
const dragContext = vm.createContext({
  state: dragState, Date, draggedPaneID: '', dragPreviewOrder: [],
  track: { querySelectorAll: () => [] }, saveWorkspaceState() {},
  transitionWorkspace() {},
  clearDragPreviewOrder() { dragContext.dragPreviewOrder = []; }
});
vm.runInContext(actual('bindPaneDragging'), dragContext);
dragContext.bindPaneDragging([dragPane]);
dragContext.bindPaneDragging([dragPane]);
for (const handle of [grip, collapsedTab]) {
  assert.equal(handle.draggable, true);
  assert.equal(handle.listeners.dragstart.length, 1, 'Reusing a pane cannot duplicate drag listeners');
}
assert.equal(dragPane.listeners.drop.length, 1);
let transfer;
collapsedTab.emit('dragstart', { dataTransfer: { setData: (type, id) => { transfer = [type, id]; } } });
assert.deepEqual(transfer, ['text/plain', 'reader:drag']);
dragContext.dragPreviewOrder = ['reader:target', 'reader:drag'];
collapsedTab.emit('dragend');
assert.deepEqual(dragState.paneOrder, ['reader:target', 'reader:drag']);
assert.deepEqual(dragState.collapsedPaneIDs, ['reader:drag'], 'Dragging must not expand the column');
assert.ok(collapsedTab._suppressExpandUntil > Date.now(), 'Drop-generated clicks cannot immediately expand the tab');
console.log('Collapsed and expanded drag handles share reorder logic without duplicate listeners or expanding on drop.');

// Header controls must remain clickable and cannot initiate a column drag.
let preventedHeaderDrag = false;
grip.emit('pointerdown', { target: { closest: () => ({ tagName: 'BUTTON' }) } });
grip.emit('dragstart', { preventDefault: () => { preventedHeaderDrag = true; } });
assert.equal(preventedHeaderDrag, true);
grip.emit('pointerdown', { target: { closest: () => null } });
grip.emit('dragstart', { dataTransfer: { setData: (_type, id) => { transfer = id; } } });
assert.equal(transfer, 'reader:drag', 'Empty header space initiates the same column drag');
console.log('Header dragging excludes title buttons and other interactive controls.');

// Project columns move as a unit without changing individual collapsed state.
const savedID = 'utility:saved:one', notebookID = 'project:notebook:p', reportID = 'project:report-draft:p';
const orderState = { utilities: {}, utilityInstances: [], paneOrder: ['reader:one', notebookID, savedID, reportID], collapsedPaneIDs: [notebookID] };
const orderContext = vm.createContext({
  state: orderState, Set, normalizeColumnGroups, orderColumnGroups,
  defaultActivePaneIDs: () => [savedID, notebookID, reportID, 'reader:one'],
  savedPaneIDs: () => [savedID], primarySavedPaneID: () => savedID,
  openProjectDetails: () => [{ id: 'p' }],
  paneIDForProjectNotebook: () => notebookID, paneIDForProjectReportDraft: () => reportID,
  isCodeQuestionPaneID: () => false, openResearchConversationPaneIDs: () => [], openCodeQuestionPaneIDs: () => [],
  isProjectDetailPaneID: () => false, isProjectToolPaneID: () => false,
  searchIDForLinkedReaderPane: () => ''
});
vm.runInContext(['savedProjectColumnGroup', 'groupSavedProjectColumns', 'pinCriticalWorkflowPanesToLeft', 'activePaneIDs', 'columnGroupForPane', 'reconcileColumnGroups', 'basePaneGroupForMove', 'paneGroupForMove', 'orderWithPaneMoved'].map(actual).join('\n'), orderContext);
assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:one', savedID, notebookID, reportID]);
for (const member of [savedID, notebookID, reportID]) {
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:one', 'before');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), [savedID, notebookID, reportID, 'reader:one']);
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:one', 'after');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:one', savedID, notebookID, reportID]);
}
assert.equal(orderContext.orderWithPaneMoved(notebookID, reportID, 'after'), null);
orderState.paneOrder = orderContext.orderWithPaneMoved('reader:one', notebookID, 'after');
assert.deepEqual(Array.from(orderContext.activePaneIDs()), [savedID, notebookID, reportID, 'reader:one']);
assert.deepEqual(orderState.collapsedPaneIDs, [notebookID]);
assert.deepEqual(Array.from(orderContext.savedProjectColumnGroup([savedID, reportID])), [savedID, reportID]);
console.log('Saved, Notebook and Report move together from any member; internal order and individual collapse state are preserved.');

vm.runInContext(actual('singleExpandedDividerEdge'), context);
state.collapsedPaneIDs = ['collapsed'];
assert.equal(context.singleExpandedDividerEdge('reader', 'collapsed').side, 'right');
assert.equal(context.singleExpandedDividerEdge('collapsed', 'reader').side, 'left');
assert.equal(context.singleExpandedDividerEdge('reader', 'other-reader'), null);
assert.equal(context.singleExpandedDividerEdge('collapsed', ''), null);
assert.equal(context.singleExpandedDividerEdge('', 'reader').side, 'left');
console.log('Expanded columns resize beside collapsed neighbors on either edge.');

// Mixed custom groups preserve the built-in project unit and survive layout persistence.
orderState.columnGroups = [{ id: 'mixed', name: 'Research pack', paneIDs: ['reader:one', notebookID], collapsed: true }];
orderContext.activePaneIDs();
assert.deepEqual(Array.from(orderState.columnGroups[0].paneIDs), ['reader:one', savedID, notebookID, reportID]);
assert.equal(orderContext.orderWithPaneMoved('reader:one', reportID, 'after'), null);
assert.deepEqual(orderState.collapsedPaneIDs, [notebookID]);
orderContext.defaultActivePaneIDs = () => [savedID, notebookID, reportID, 'reader:one', 'reader:outside'];
for (const member of ['reader:one', savedID, notebookID, reportID]) {
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:outside', 'after');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:outside', 'reader:one', savedID, notebookID, reportID]);
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:outside', 'before');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:one', savedID, notebookID, reportID, 'reader:outside']);
}
const persisted = normalizeWorkspaceLayout(orderState);
assert.deepEqual(persisted.columnGroups, JSON.parse(JSON.stringify(orderState.columnGroups)));
orderContext.reconcileColumnGroups(['reader:one']);
assert.deepEqual(Array.from(orderState.columnGroups[0].paneIDs), ['reader:one']);
orderContext.reconcileColumnGroups([]);
assert.equal(orderState.columnGroups.length, 0);
assert.deepEqual(normalizeColumnGroups([{ id:'a', paneIDs:['x','x'], name:' A ' }, { id:'b', paneIDs:['x','y'] }]).map(g => g.paneIDs), [['x'],['y']]);
assert.deepEqual(orderColumnGroups(['a','b','c','d'], [{paneIDs:['a','c']}]), ['a','c','b','d']);
state.columnGroups = [{ id:'a', paneIDs:['reader'], collapsed:true }];
assert.equal(context.paneIsCollapsed('reader'), true);
state.columnGroups[0].collapsed = false;
assert.equal(context.paneIsCollapsed('reader'), false);
assert.deepEqual(state.collapsedPaneIDs, ['collapsed']);
console.log('Mixed groups reconcile project membership, persist layout, clean up closed panes, and preserve individual collapse.');

// Reset updates the future expanded widths without changing visibility or group membership.
const resetState = { paneWeights: { a: 950, b: 820 }, collapsedPaneIDs: ['a'], columnGroups: [{ id: 'g', paneIDs: ['b'], collapsed: true }] };
const resetContext = vm.createContext({
  state: resetState, track: { scrollLeft: 0, scrollWidth: 1200, clientWidth: 1000, querySelectorAll: () => [] },
  activePaneIDs: () => ['a', 'b'], defaultPaneWidthForID: () => 600,
  saveWorkspaceState() {}, async transitionWorkspace() {}, requestAnimationFrame: fn => fn()
});
vm.runInContext('async ' + actual('resetVisibleColumnWidths'), resetContext);
await resetContext.resetVisibleColumnWidths();
assert.deepEqual(JSON.parse(JSON.stringify(resetState.paneWeights)), { a: 600, b: 600 });
assert.deepEqual(resetState.collapsedPaneIDs, ['a']);
assert.equal(resetState.columnGroups[0].collapsed, true);
console.log('Reset restores default widths while preserving collapsed columns and groups.');
