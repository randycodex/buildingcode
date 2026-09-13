import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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
