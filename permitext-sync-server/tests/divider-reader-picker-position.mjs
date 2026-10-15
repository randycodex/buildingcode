import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('let paneDividerAddPointer = null;');
const end = source.indexOf('\nfunction createDivider(', start);
assert.ok(start >= 0 && end > start);
let reads = 0;
const toolbar = { visibility: 'visible', getBoundingClientRect: () => ({ top: 42, height: 42 }) };
const frames = [];
function makeDivider(x, pinned = false) {
  const classes = new Set();
  const button = { style: {}, hidden: false, expanded: 'false', getAttribute: name => name === 'aria-expanded' ? button.expanded : null,
    classList: { toggle(name, value) { value ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) } };
  return { x, height: 900, button, classList: { contains: name => name === 'is-pinned-divider' && pinned },
    getBoundingClientRect() { reads++; return { left: this.x - 0.5, width: 1, height: this.height }; },
    querySelector: () => button };
}
const dividers = [makeDivider(900), makeDivider(1500), makeDivider(2400)];
let pinnedRight = null;
let workflow = 'research';
const track = { inert: false, getBoundingClientRect: () => ({ left: 0, right: 2390 }),
  querySelector: () => pinnedRight === null ? null : { getBoundingClientRect: () => ({ right: pinnedRight }) },
  querySelectorAll: selector => selector === '.pane-divider-add' ? dividers.map(d => d.button) : dividers };
let pickerCloses = 0;
const picker = { _close() { pickerCloses++; dividers[0].button.expanded = 'false'; } };
const context = vm.createContext({ track, currentColumnWorkflowView: () => workflow,
  document: { querySelector: selector => selector === '.reader-open-code-menu' ? picker : toolbar }, window: { innerWidth: 2390 },
  getComputedStyle: el => ({ visibility: el.visibility }), requestAnimationFrame: callback => frames.push(callback) });
vm.runInContext(source.slice(start, end), context);
const run = code => vm.runInContext(code, context);
const flush = () => { const pending = frames.splice(0); pending.forEach(callback => callback()); };

run('schedulePaneDividerAddControls()');
run('schedulePaneDividerAddControls()');
assert.equal(frames.length, 1, 'Layout changes share one animation frame');
flush();
assert.equal(dividers[0].button.style.left, '900px');
assert.equal(dividers[0].button.style.top, '63px', 'The icon follows the actual toolbar center');
assert.equal(dividers[2].button.hidden, true, 'Offscreen dividers cannot leak toolbar controls');
assert.equal(dividers[0].button.classList.contains('is-near-pointer'), false);

const readsBeforePointer = reads;
run('paneDividerAddPointer = {x: 940, y: 63}; schedulePaneDividerAddControls(false)');
flush();
assert.equal(dividers[0].button.classList.contains('is-near-pointer'), true, '40px boundary reveals the control');
run('paneDividerAddPointer = {x: 929, y: 92}; schedulePaneDividerAddControls(false)');
flush();
assert.equal(dividers[0].button.classList.contains('is-near-pointer'), false, 'The proximity area is a radius, not an 80px square');
assert.equal(reads, readsBeforePointer, 'Pointer movement reuses geometry instead of reading layout');
run('paneDividerAddPointer = null; schedulePaneDividerAddControls(false)');
flush();
assert.equal(dividers[0].button.classList.contains('is-near-pointer'), false);

dividers[0].x = 1000;
run('schedulePaneDividerAddControls(false); schedulePaneDividerAddControls()');
flush();
assert.equal(dividers[0].button.style.left, '1000px', 'A pending pointer frame still honors a later resize');
dividers[0].button.expanded = 'true';
track.inert = true;
context.positionPaneDividerAddControls();
assert.ok(dividers.every(d => d.button.hidden), 'Overlay workflows hide all divider controls');
assert.equal(pickerCloses, 1, 'Hiding the insertion target also closes its open menu');
track.inert = false;
toolbar.visibility = 'hidden';
context.positionPaneDividerAddControls();
assert.ok(dividers.every(d => d.button.hidden));
toolbar.visibility = 'visible';
pinnedRight = 1100;
context.positionPaneDividerAddControls();
assert.equal(dividers[0].button.hidden, true, 'A scrolled divider under the pinned Reader stays hidden');
assert.equal(dividers[1].button.hidden, false);
dividers[0].classList.contains = name => name === 'is-pinned-divider';
context.positionPaneDividerAddControls();
assert.equal(dividers[0].button.hidden, false, 'The pinned Reader boundary remains available');
for (workflow of ['notebook', 'report', 'project-details']) {
  context.positionPaneDividerAddControls();
  assert.ok(dividers.every(d => d.button.hidden), `${workflow} does not show Research divider controls`);
}
workflow = 'research';
dividers[0].height = 0;
context.positionPaneDividerAddControls();
assert.equal(dividers[0].button.hidden, true, 'Responsive layouts without dividers do not show controls');
console.log('Divider picker: toolbar alignment, 40px radius, batched pointer work, viewport and pinned/overlay visibility passed.');
