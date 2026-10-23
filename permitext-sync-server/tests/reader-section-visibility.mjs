import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReaderSectionVisibility } from '../public/reader-section-visibility.js';

const frames = new Map(), timers = new Map(), listeners = new Map();
let nextID = 0, intersection, resize, offscreen = false, hidden = false, focused = false, selected = false;
let capture = {sectionID: 's1', blockID: 'passage-1', anchorOffset: -12}, restored, releases = 0, mounts = 0;
let comments = 'Original comment', allowed = true;
const view = {
  innerWidth: 1200,
  requestAnimationFrame(fn) { const id = ++nextID; frames.set(id, fn); return id; },
  cancelAnimationFrame(id) { frames.delete(id); },
  setTimeout(fn) { const id = ++nextID; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); }
};
const doc = { defaultView: view, activeElement: null,
  getSelection: () => ({isCollapsed: !selected, anchorNode: selected ? 'inside' : null}),
  addEventListener(name, fn) { listeners.set(name, fn); },
  removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); }
};
const panel = {ownerDocument: doc, isConnected: true,
  classList: {contains: () => hidden},
  getBoundingClientRect: () => ({width: 600, left: offscreen ? 1800 : 0, right: offscreen ? 2400 : 600})
};
const roots = [];
const content = {dataset: {}, contains: node => node === 'inside' || focused && node === doc.activeElement || roots.includes(node), querySelector: () => null};
globalThis.IntersectionObserver = class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} };
globalThis.ResizeObserver = class { constructor(fn) { resize = fn; } observe() {} unobserve() {} disconnect() {} };
const classes = () => { const names = new Set(); return {add: n => names.add(n), remove: n => names.delete(n), contains: n => names.has(n)}; };
for (let i = 0; i < 25; i++) {
  const marker = {dataset: {blockId: `passage-${i}`}, classList: classes()}; marker.classList.add('is-source-target');
  roots.push({isConnected: true, style: {height: ''}, classList: classes(),
    children: [{text: `Exact enacted text ${i}`, comments}],
    querySelectorAll: () => [marker], replaceChildren() { this.children = []; }
  });
}
const flush = () => {const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn());};
const expire = () => {const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn());};
const controller = createReaderSectionVisibility({panel, content,
  capturePosition: () => capture,
  restorePosition: value => {restored = value;},
  release(root) { assert.ok(root.children.length); releases++; },
  render(root, data, position, markers) {
    mounts++; assert.equal(position, capture);
    assert.deepEqual(markers, [{id: `passage-${data.index}`, classes: ['is-source-target']}]);
    root.children = [{text: data.text, comments: allowed ? comments : ''}];
  }
});
roots.forEach((root, index) => controller.add(root, {index, text: `Exact enacted text ${index}`}));
resize(roots.map(target => ({target, borderBoxSize: [{blockSize: 1234}]}))); flush();
assert.equal(releases, 0);
offscreen = true; intersection(); flush(); assert.equal(timers.size, 1);
offscreen = false; intersection(); flush(); expire();
assert.equal(releases, 0, 'Brief column transitions do not discard the reading surface');
offscreen = true; intersection(); flush(); expire();
assert.equal(releases, 25); assert.equal(roots.reduce((n, root) => n + root.children.length, 0), 0);
assert.equal(controller.suspendedPosition, capture);
assert.ok(roots.every(root => root.style.height === '1234px'), 'Section roots retain the measured scroll extent');
// An already-requested chapter window can finish after its column goes away.
const lateRoot = {...roots[0], children: [{text: 'Late nearby section'}], style: {height: ''}, classList: classes()};
roots.push(lateRoot); controller.add(lateRoot, {index: 0, text: 'Exact enacted text 0'});
flush(); expire(); assert.equal(lateRoot.children.length, 0, 'Late hydration also releases its passage DOM');
roots.pop(); lateRoot.isConnected = false;
comments = 'Edited while Reader was offscreen'; allowed = false;
offscreen = false; intersection(); flush();
assert.equal(mounts, 25); assert.equal(restored, capture);
assert.ok(roots.every((root, i) => root.children[0].text === `Exact enacted text ${i}`));
assert.ok(roots.every(root => root.children[0].comments === ''), 'Resume uses current access, not cached private controls');
assert.ok(roots.every(root => root.style.height === ''));
assert.equal(controller.suspendedPosition, null);
assert.equal(content.dataset.readerSuspended, undefined);
focused = true; offscreen = true; intersection(); flush(); expire();
assert.equal(releases, 26, 'Focused content is never discarded');
focused = false; selected = true; listeners.get('selectionchange')(); flush(); expire();
assert.equal(releases, 26, 'A user text selection is retained');
selected = false; listeners.get('selectionchange')(); flush(); expire();
assert.equal(releases, 51);
allowed = true; hidden = true; offscreen = false; intersection(); flush();
assert.equal(mounts, 25, 'Hidden workflows stay suspended even when their layout rectangle intersects');
hidden = false; intersection(); flush();
assert.equal(mounts, 50);
assert.ok(roots.every(root => root.children[0].comments === comments), 'Edited comments are rebuilt fresh on return');
offscreen = true; intersection(); flush(); controller.dispose(); expire(); flush();
assert.equal(releases, 51, 'Closing or navigating cancels pending eviction');
assert.equal(listeners.size, 0); assert.equal(controller.suspendedPosition, null);
globalThis.document = doc;
const templateController = createReaderSectionVisibility({panel: {...panel, ownerDocument: {defaultView: null}}, content,
  capturePosition() {}, restorePosition() {}, release() {}, render() {}});
templateController.dispose();
assert.equal(listeners.size, 0, 'Template construction uses the live document and leaves no subscriptions after disposal');

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
assert.match(app, /root\._readerBlockWindow\?\.dispose\(\)/);
assert.match(app, /delete root\._readerBlockWindow/);
assert.match(app, /disposeWorkspaceNodeAccess\(root\)/);
assert.match(app, /content\?\._readerSectionVisibility\?\.dispose\(\)/);
assert.match(app, /startReaderSectionVisibility\(panel, reader, content\)/);
assert.match(app, /suspendedPosition\) \{ positions\.set/);
console.log('Reader suspension: real child DOM eviction, stable roots/heights/anchors/markers, fresh access and comments, transition grace, selection protection and disposal passed.');
