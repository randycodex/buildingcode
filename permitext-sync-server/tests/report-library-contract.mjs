import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

class Element {
  constructor() { this.events = {}; this.attributes = {}; this.children = []; this.capture = null; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus(options) { this.focusOptions = options; this.events.focus?.(); }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() { this.capture = null; }
}
const frames = new Map();
let nextFrame = 0;
const flushFrame = () => {
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach(callback => callback());
};
const c = vm.createContext({ document: { createElement: () => new Element() },
  requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame(id) { frames.delete(id); }
});
vm.runInContext((await readFile(new URL('../public/report-library.js', import.meta.url), 'utf8')).replaceAll('export function', 'function'), c);
let widthProperty;
const panel = { dataset: {}, style: { setProperty: (key, value) => { widthProperty = value; } } };
const classes = new Set();
const shell = { clientWidth: 1920, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
const pointer = (id, x, button = 0) => ({ pointerId: id, clientX: x, button, preventDefault() {} });
panel.dataset.libraryOpen = 'false';
const outline = { getBoundingClientRect: () => ({ width: Number(panel.dataset.outlineWidth) || 300 }) };
let outlineControls = c.createReportOutlineControls({panel, shell, outline,
  reservedWidth: () => panel.dataset.libraryOpen === 'true' ? Number(panel.dataset.libraryWidth) + 1 : 0});
assert.equal(outlineControls.header.children[0].textContent, 'Outline');
assert.equal(outlineControls.divider.attributes['aria-valuenow'], '300');
assert.equal(outlineControls.divider.attributes['aria-label'], 'Resize Outline');
assert.equal(outlineControls.header.children.length, 1, 'Outline header has only its title');
outlineControls.divider.events.pointerdown(pointer(6, 300));
outlineControls.divider.events.pointermove(pointer(6, 640));
outlineControls.divider.events.pointerup(pointer(6, 640));
assert.equal(panel.dataset.outlineWidth, '640', 'Outline matches Sources expansion');
outlineControls = c.createReportOutlineControls({panel, shell, outline,
  reservedWidth: () => panel.dataset.libraryOpen === 'true' ? Number(panel.dataset.libraryWidth) + 1 : 0});
assert.equal(outlineControls.divider.attributes['aria-valuenow'], '640', 'Rebuilding retains Outline width');
const outlineKey = key => outlineControls.divider.events.keydown({key, preventDefault() {}});
outlineKey('End');
assert.equal(panel.dataset.outlineWidth, '720', 'Outline matches Sources maximum width');
panel.dataset.libraryOpen = 'true';
panel.dataset.libraryWidth = '640';
outlineKey('End');
assert.equal(panel.dataset.outlineWidth, '678', 'Both sidebars leave 600px and both dividers for the report');
assert.equal(panel.dataset.libraryWidth, '640', 'Outline resizing preserves the Sources preference');
outlineControls.divider.events.dblclick();
assert.equal(panel.dataset.outlineWidth, '300', 'Double-click restores the requested 300px outline');
outlineControls.divider.events.pointerdown(pointer(3, 300));
outlineControls.divider.events.pointermove(pointer(3, 520));
flushFrame();
assert.equal(panel.dataset.outlineWidth, '520');
assert.ok(classes.has('is-outline-resizing'));
outlineControls.divider.events.pointercancel(pointer(3, 520));
outlineControls.divider.events.pointermove(pointer(3, 700));
assert.equal(panel.dataset.outlineWidth, '520');
assert.equal(classes.size, 0);
outlineKey('Home');
assert.equal(panel.dataset.outlineWidth, '300');
console.log('Outline width passed: title-only header, matching maximum, retained independent widths, readable report reservation, drag, keyboard, reset and cancellation.');

const versions = {getBoundingClientRect: () => ({width: Number(panel.dataset.versionsWidth) || 300})};
const versionControls = c.createReportVersionsControls({panel, shell, versions, availableWidth: () => 0});
assert.equal(versionControls.header.children.length, 1, 'Versions has no Compact/Expand width button');
versionControls.divider.events.pointerdown(pointer(4, 1400));
assert.equal(versionControls.divider.focusOptions.preventScroll, true, 'Starting a Versions drag does not scroll its edge away from the pointer');
versionControls.divider.events.pointermove(pointer(4, 1300));
flushFrame();
assert.equal(panel.dataset.versionsWidth, '400', 'The right-hand Versions column expands to the left while dragging its left divider');
versionControls.divider.events.pointercancel(pointer(4, 1300));
versionControls.divider.events.pointermove(pointer(4, 1200));
assert.equal(panel.dataset.versionsWidth, '400');
versionControls.divider.events.keydown({key: 'ArrowLeft', preventDefault() {}});
assert.equal(panel.dataset.versionsWidth, '424', 'Keyboard left moves the right-hand column boundary left');
console.log('Versions width passed: left-edge drag direction and cancellation.');

let reportWidth = 1320;
let commits = 0;
let sidebars = {libraryOpen: 'false', outlineHidden: 'true', reportsHidden: 'true'};
const minimumWidth = () => c.reportWorkspaceMinimumWidth(sidebars);
const {divider} = c.createReportResizeDivider({
  shell, element: {getBoundingClientRect: () => ({width: reportWidth})}, kind: 'workspace', label: 'Report column',
  defaultWidth: () => 1320, minimumWidth, maximumWidth: () => 2400,
  currentWidth: () => reportWidth, resizeDirection: -1,
  onResize: width => { reportWidth = width; },
  onCommit: () => { commits++; }
});
divider.events.pointerdown(pointer(9, 1320));
divider.events.pointermove(pointer(9, 1100));
divider.events.pointermove(pointer(9, 900));
assert.equal(frames.size, 1, "Only the latest pointer position is painted per frame.");
flushFrame();
assert.equal(reportWidth, 1740, 'Dragging the Report divider left widens the column.');
assert.equal(commits, 0, 'Persist the width after the drag ends.');
divider.events.pointerup(pointer(9, 900));
assert.equal(commits, 1);
divider.events.keydown({key: 'Home', preventDefault() {}});
assert.equal(reportWidth, 1160);
divider.events.keydown({key: 'End', preventDefault() {}});
assert.equal(reportWidth, 2400);
divider.events.dblclick();
assert.equal(reportWidth, 1320);

let atRightEdge = true;
sidebars = {libraryOpen: 'true', outlineHidden: 'false', reportsHidden: 'false'};
const right = c.createReportResizeDivider({
  shell, element: {getBoundingClientRect: () => ({width: reportWidth})}, kind: 'workspace', label: 'Report column from the right',
  defaultWidth: () => 1320, minimumWidth, maximumWidth: () => 2400,
  currentWidth: () => reportWidth, resizeDirection: () => atRightEdge ? -1 : 1,
  onResize: width => { reportWidth = width; }
}).divider;
right.events.keydown({key: 'Home', preventDefault() {}});
assert.equal(reportWidth, 1790);
right.events.pointerdown(pointer(12, 1900));
atRightEdge = false;
right.events.pointermove(pointer(12, 1800));
flushFrame();
assert.equal(reportWidth, 1890, 'An inward drag at the screen edge widens Report without reversing mid-drag');
right.events.pointerup(pointer(12, 1800));
right.events.pointerdown(pointer(13, 1800));
right.events.pointermove(pointer(13, 1830));
flushFrame();
assert.equal(reportWidth, 1920, 'Away from the screen edge, dragging the right handle right widens Report');
right.events.pointerup(pointer(13, 1830));
