import assert from 'node:assert/strict';
import {moveReportBlock, reportDropIndex, createReportOutline} from '../public/report-outline.js';
import {createReportAutosave} from '../public/report-autosave.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Test every source/target boundary, including adjacent no-op drops and both ends.
for (let from = 0; from < 5; from++) for (let to = 0; to < 5; to++) for (const after of [false, true]) {
  const blocks = Array.from({length: 5}, (_, id) => ({id, excludedCommentKeys: ['private'], text: `Item ${id}`}));
  const moved = blocks[from], originals = [...blocks];
  const boundary = to + Number(after);
  const expected = originals.filter(block => block !== moved);
  expected.splice(boundary > from ? boundary - 1 : boundary, 0, moved);
  moveReportBlock(blocks, from, reportDropIndex(from, to, after));
  assert.deepEqual(blocks, expected);
  assert.ok(blocks.every(block => originals.includes(block)), 'Keep comments and source identities on the live objects');
}
for (const indices of [[-1, 0], [0, -1], [0, 2], [0, 0], [0, 0.5]]) {
  const blocks = [{id: 'a'}, {id: 'b'}], before = [...blocks];
  assert.equal(moveReportBlock(blocks, ...indices), false);
  assert.deepEqual(blocks, before);
}

class Element {
  constructor() { this.children = []; this.attributes = {}; this.dataset = {}; this.events = {}; this.offsetHeight = 50; this.classList = {add() {}, remove() {}}; }
  append(...children) { for (const child of children) { if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1); child.parentElement = this; this.children.push(child); } }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(key, fn) { this.events[key] = fn; }
  removeEventListener(key) { delete this.events[key]; }
  getBoundingClientRect() { return this.rect || {top: 0, bottom: 600}; }
  focus() {}
  setPointerCapture() {}
  querySelector(selector) { return this.children.find(child => child.className?.split(' ').includes(selector.slice(1))) || this.children.map(child => child.querySelector(selector)).find(Boolean); }
  contains(element) { return this.children.includes(element); }
}
globalThis.document = {createElement: () => new Element()};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const blocks = [{id: 'a', kind: 'evidence'}, {id: 'b', kind: 'paragraph'}, {id: 'c', kind: 'heading'}];
const draft = {id: 'draft', version: 1, blocks}, writes = [];
const autosave = createReportAutosave({read: () => draft, isCurrent: () => true, retain: async () => ({}),
  acknowledge: async () => {}, write: async value => { writes.push(value); return {...value, version: value.version + 1}; },
  onSaved: saved => { draft.version = saved.version; }, setTimer: () => 1, clearTimer() {}});
const moves = [], navigations = [], body = new Element(), introduction = new Element(), targets = blocks.map(() => new Element());
const controller = createReportOutline({blocks, introduction, targets, documentBody: body,
  describe: block => ({title: block.id}), dragIcon: '', onNavigate: target => navigations.push(target),
  onMove: (block, index, area) => { moves.push({id: block.id, index, area}); if (moveReportBlock(blocks, blocks.indexOf(block), index)) { controller.reorder(); autosave.change(); } }});
const rows = controller.element.children[3].children;
rows[1].querySelector('.report-outline-drag').events.keydown({key: 'ArrowDown', preventDefault() {}});
assert.deepEqual(moves[0], {id: 'b', index: 2, area: 'outline'});
await autosave.flush();
assert.deepEqual(writes[0].blocks.map(block => block.id), ['a', 'c', 'b'], 'Outline movement reaches the saved report payload');
assert.deepEqual(rows.map(row => row.dataset.blockId), ['a', 'c', 'b']);
rows[2].querySelector('.report-outline-drag').events.keydown({key: 'ArrowUp', preventDefault() {}});
assert.deepEqual(blocks.map(block => block.id), ['a', 'b', 'c'], 'Repeated moves use current positions');
// Drop handler uses the dragged block identity, rather than the position captured before a move.
rows[1].events.dragstart({dataTransfer: {setData() {}}});
rows[0].events.drop({clientY: 0, preventDefault() {}});
assert.deepEqual(blocks.map(block => block.id), ['b', 'a', 'c']);
await autosave.flush();
assert.deepEqual(writes.at(-1).blocks.map(block => block.id), ['b', 'a', 'c']);
controller.element.children[1].children[0].events.click();
assert.equal(navigations[0], introduction);
controller.element.children[2].events.click();
assert.equal(controller.element.children[3].hidden, true);
controller.dispose();
assert.equal(body.events.scroll, undefined, 'Detach old scroll listeners when rebuilding or leaving the report');

// Exercise the actual app integration: reorder mounted rows without recreating previews/editors.
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const reorderStart = app.indexOf('  function reorderDraftBlock(');
const activeDraft = {blocks: [{id: 'x'}, {id: 'y'}, {id: 'z'}]};
const documentBody = new Element(), documentRows = activeDraft.blocks.map(block => Object.assign(new Element(), {_reportBlock: block}));
const blockBody = new Element(); blockBody.append(...documentRows);
documentBody.scrollTop = 1706;
documentBody.querySelectorAll = () => [...blockBody.children];
const calls = [];
const context = vm.createContext({activeDraft, shell: {querySelector: () => documentBody}, moveReportBlock,
  outlineController: {reorder: () => calls.push('outline'), announce() {}}, reportBlockTitle: b => b.id,
  renderIncludedReportComments: () => calls.push('comments'), panel: {}, setDirty: () => calls.push('dirty')});
vm.runInContext(app.slice(reorderStart, app.indexOf('  function renderWorkspaceContent()', reorderStart)), context);
context.reorderDraftBlock(activeDraft.blocks[2], 0);
assert.deepEqual(blockBody.children, [documentRows[2], documentRows[0], documentRows[1]], 'Move the mounted editors and source previews');
assert.equal(documentBody.scrollTop, 1706, 'Reordering keeps the document scroll position');
assert.deepEqual(calls, ['outline', 'comments', 'dirty']);

// Initial sync may clean up workspace columns while the screen's editor is still loading.
const cleanups = [], mounts = new Map([['report', {dispose: () => cleanups.push('report')}], ['other', {dispose: () => cleanups.push('other') }]]);
let current = true;
const cleanupContext = vm.createContext({reportDraftMounts: mounts, reportScreen: {projectID: 'report', isCurrent: () => current}});
const cleanupStart = app.indexOf('function cleanupInactiveReportDraftMounts(');
vm.runInContext(app.slice(cleanupStart, app.indexOf('\nfunction disposeProjectWorkboardMount(', cleanupStart)), cleanupContext);
cleanupContext.cleanupInactiveReportDraftMounts([]);
assert.deepEqual(cleanups, ['other'], 'A loading report stays owned by its current screen before DOM attachment');
current = false;
cleanupContext.cleanupInactiveReportDraftMounts([]);
assert.deepEqual(cleanups, ['other', 'report'], 'Changed account/workspace screens still release stale editors');

const pointerMoves = [], pointerBlocks = [{id: '1'}, {id: '2'}, {id: '3'}];
const pointer = createReportOutline({blocks: pointerBlocks, introduction, targets, documentBody: body,
  describe: block => ({title: block.id}), dragIcon: '', onNavigate() {},
  onMove: (block, index) => pointerMoves.push([block.id, index])});
const pointerRows = pointer.element.children[3].children;
pointerRows.forEach((row, index) => { row.rect = {top: 100 + index * 50, bottom: 150 + index * 50}; });
const pointerHandle = pointerRows[2].querySelector('.report-outline-drag');
pointerHandle.events.pointerdown({button: 0, pointerId: 1, clientY: 225, preventDefault() {}});
pointerHandle.events.pointermove({clientY: 105});
pointerHandle.events.pointerup();
assert.deepEqual(pointerMoves, [['3', 0]], 'Captured pointer dragging works across row buttons');
pointerHandle.events.pointerdown({button: 0, pointerId: 1, clientY: 225, preventDefault() {}});
pointerHandle.events.pointermove({clientY: 105});
pointerHandle.events.pointercancel();
assert.equal(pointerMoves.length, 1, 'Cancelled dragging must not alter the draft');
pointer.dispose();
autosave.dispose();
console.log('Report outline passed: all insertion boundaries, live object identity, keyboard and drag handlers, autosaved order, navigation and cleanup.');
