import assert from 'node:assert/strict';
import {createSettingsColumnResizers, normalizeSettingsColumnWidths, resizeSettingsColumnPair} from '../public/settings-columns.js';

for (const index of [0, 1]) for (const delta of [-10000, -100, 0, 100, 10000]) {
  const original = [640, 960, 640];
  const resized = resizeSettingsColumnPair(original, index, delta);
  assert(resized.every((width, i) => width >= [360, 480, 360][i]));
  assert.equal(resized.reduce((sum, width) => sum + width), 2240);
  assert.equal(resized[index === 0 ? 2 : 0], original[index === 0 ? 2 : 0]);
  assert.deepEqual(original, [640, 960, 640]);
}
assert.deepEqual(normalizeSettingsColumnWidths([360, 480, 360]), [360, 480, 360]);
for (const invalid of [null, [], [640, 479, 640], [640, Infinity, 640]]) assert.equal(normalizeSettingsColumnWidths(invalid), null);

const node = () => ({
  attributes: {}, handlers: {}, captured: new Set(), style: {},
  setAttribute(name, value) { this.attributes[name] = value; },
  addEventListener(name, callback) { this.handlers[name] = callback; },
  focus() { this.handlers.focus?.(); },
  setPointerCapture(id) { this.captured.add(id); },
  hasPointerCapture(id) { return this.captured.has(id); },
  releasePointerCapture(id) { this.captured.delete(id); }
});
let disconnected = 0;
globalThis.ResizeObserver = class { observe() {} disconnect() { disconnected++; } };
const properties = {};
const collapsed = new Set();
const keys = ['account', 'library', 'recovery'];
const widths = () => {
  const fixed = collapsed.size * 48;
  const weights = keys.map((key, i) => collapsed.has(i) ? 0 : Number(properties[`--settings-${key}-width`]?.match(/, ([\d.]+)fr/)[1] || [1, 1.5, 1][i]));
  const total = weights.reduce((sum, width) => sum + width);
  return weights.map((weight, i) => collapsed.has(i) ? 48 : (2240 - fixed) * weight / total);
};
const panels = keys.map((_, index) => ({
  classList: {contains: () => collapsed.has(index)},
  getBoundingClientRect() { const sizes = widths(); return {width: sizes[index], right: sizes.slice(0, index + 1).reduce((sum, width) => sum + width)}; }
}));
const classes = new Set();
const columns = {
  ownerDocument: {createElement: node}, children: [],
  style: {setProperty(name, value) { properties[name] = value; }},
  classList: {add: name => classes.add(name), remove: name => classes.delete(name)},
  append(child) { this.children.push(child); },
  getBoundingClientRect: () => ({left: 0})
};
const changes = [];
const controls = createSettingsColumnResizers(columns, panels, null, value => changes.push(value));
const [left, right] = columns.children;
const event = overrides => ({preventDefault() {}, button: 0, pointerId: 7, clientX: 640, ...overrides});
left.handlers.pointerdown(event());
left.handlers.pointermove(event({clientX: 740}));
assert.deepEqual(widths(), [740, 860, 640]);
assert.equal(changes.length, 0, 'Do not persist on every pointer movement');
left.handlers.pointerup(event());
assert.deepEqual(changes.at(-1), [740, 860, 640]);
assert.equal(left.hasPointerCapture(7), false);
assert.equal(classes.has('is-resizing'), false);
right.handlers.keydown(event({key: 'ArrowLeft', shiftKey: true}));
assert.deepEqual(widths(), [740, 780, 720]);
const preferred = [...widths()];
collapsed.add(1); controls.refresh();
assert.equal(widths()[1], 48);
assert.equal(left.attributes['aria-disabled'], 'true');
left.handlers.pointerdown(event());
left.handlers.keydown(event({key: 'ArrowLeft'}));
assert.equal(left.hasPointerCapture(7), false);
collapsed.delete(1); controls.refresh();
assert.deepEqual(widths(), preferred, 'Expanding restores the chosen proportions');
controls.dispose();
const restored = createSettingsColumnResizers(columns, panels, changes.at(-1));
assert.deepEqual(widths(), preferred, 'Stored preferences restore when Settings reopens');
columns.children.at(-1).handlers.dblclick();
assert.deepEqual(widths(), [640, 960, 640]);
columns.children.at(-2).handlers.pointerdown(event());
restored.dispose();
assert.equal(columns.children.at(-2).hasPointerCapture(7), false);
assert.equal(disconnected, 2);
delete globalThis.ResizeObserver;
console.log('Settings resizing passed: adjacent pairs, minimum widths, pointer/keyboard, collapse/restore, saved widths, reset and cleanup.');
