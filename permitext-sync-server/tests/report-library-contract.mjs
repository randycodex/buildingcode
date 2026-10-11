import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

class Element {
  constructor() { this.events = {}; this.attributes = {}; this.children = []; this.capture = null; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() { this.events.focus?.(); }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() { this.capture = null; }
}
const c = vm.createContext({ document: { createElement: () => new Element() } });
vm.runInContext((await readFile(new URL('../public/report-library.js', import.meta.url), 'utf8')).replace('export function', 'function'), c);
let widthProperty;
const panel = { dataset: {}, style: { setProperty: (key, value) => { widthProperty = value; } } };
const classes = new Set();
const shell = { clientWidth: 1920, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
const library = { getBoundingClientRect: () => ({ width: Number(panel.dataset.libraryWidth) || 330 }) };
let controls = c.createReportLibraryControls({ panel, shell, library });
const button = () => controls.header.children[1];
button().events.click();
assert.equal(widthProperty, '640px');
assert.equal(button().attributes['aria-pressed'], 'true');
controls = c.createReportLibraryControls({ panel, shell, library });
assert.equal(controls.divider.attributes['aria-valuenow'], '640', 'Rendering the Report again retains the selected width');
button().events.click();
assert.equal(widthProperty, '330px');
const key = (name, shiftKey = false) => {
  let prevented = false;
  controls.divider.events.keydown({ key: name, shiftKey, preventDefault() { prevented = true; } });
  return prevented;
};
assert.equal(key('ArrowRight'), true);
assert.equal(widthProperty, '354px');
key('ArrowLeft', true);
assert.equal(widthProperty, '280px', 'Keyboard resizing respects the readable minimum');
key('End');
assert.equal(widthProperty, '720px');
shell.clientWidth = 1024;
key('End');
assert.equal(widthProperty, '423px', 'Narrow layouts reserve 600px plus the divider for the document');
shell.clientWidth = 1920;
controls.divider.events.dblclick();
const pointer = (id, x, button = 0) => ({ pointerId: id, clientX: x, button, preventDefault() {} });
controls.divider.events.pointerdown(pointer(1, 330));
controls.divider.events.pointermove(pointer(1, 520));
assert.equal(widthProperty, '520px');
assert.ok(classes.has('is-library-resizing'));
controls.divider.events.pointercancel(pointer(1, 520));
controls.divider.events.pointermove(pointer(1, 700));
assert.equal(widthProperty, '520px', 'A cancelled drag cannot continue resizing');
assert.equal(controls.divider.capture, null);
assert.equal(classes.size, 0);
assert.equal(key('Tab'), false, 'Other keys preserve normal focus navigation');
controls.divider.events.pointerdown(pointer(2, 520, 2));
assert.equal(classes.size, 0, 'Secondary clicks do not start resizing');
let resized=0;
shell.clientWidth=931;
controls=c.createReportLibraryControls({panel,shell,library,availableWidth:()=>1920,onResize:()=>{resized++;}});
panel.dataset.libraryWidth='330';
button().events.click();
assert.equal(widthProperty,'640px','Sources can expand by yielding Reader space in the full workspace');
assert.equal(resized,1,'Resizing asks the workspace to recalculate its column constraints');
console.log('Report library passed: expansion, width retention, keyboard and pointer bounds, narrow document space, and cancellation.');
