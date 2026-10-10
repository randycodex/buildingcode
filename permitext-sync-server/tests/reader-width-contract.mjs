import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
const context = vm.createContext({
  state: { paneWeights: {}, readers: [] },
  paneIDs: [],
  activePaneIDs() { return context.paneIDs; },
  defaultPaneWidthForID: () => 600,
  migrateLegacyPaneWidth: (_id, width) => width,
  isFixedWidthPaneID: id => id.startsWith('utility:'),
  detachedProjectWindow: false,
  isProjectWorkboardPaneID: () => false,
  isProAccount() { throw new Error('Reader layout must not depend on subscription'); }
});
vm.runInContext(extract('isFlexibleReaderPaneID', 'linkedReaderPaneIDForSearch') + extract('applyPaneWeight', 'setUtilityButtonStates'), context);
function layout(id, ids, storedWidth = 600, linked = false, collapsed = false) {
  context.paneIDs = ids;
  context.state.paneWeights = { [id]: storedWidth };
  context.state.readers = [{id:id.replace('reader:', ''), savedSourcePaneID:linked ? 'saved:fixture' : ''}];
  const style = { setProperty(key, value) { this[key] = value; } };
  context.applyPaneWeight({
    dataset: {},
    classList: { contains: (name) => name === 'is-collapsed' && collapsed },
    style
  }, id);
  return style;
}
for (const storedWidth of [600, 1000]) {
  for (const linked of [false, true]) {
    assert.equal(layout('reader:a', ['reader:a'], storedWidth, linked).flex, '1 1 600px', 'A sole Reader must fill the viewport, including restored/source-linked Readers');
  }
}
for (const ids of [['reader:a','reader:b'], ['reader:a','reader:b','reader:c'], ['reader:a','utility:search']]) {
  const style = layout('reader:a', ids);
  assert.equal(style.flex, '1 1 600px');
  assert.equal(style['--pane-default-min-width'], '600px', 'Readers stop shrinking at 600px even with fewer than four columns');
}
assert.equal(layout('reader:a', ['reader:a','reader:b'], 900).flex, '0 0 900px', 'Multi-column manual divider widths remain respected');
assert.equal(layout('utility:search', ['utility:search','reader:a']).flex, '0 0 600px', 'Utility sizing stays unchanged');
assert.equal(layout('reader:a', ['reader:a','reader:b'], 900, false, true).flex, '0 0 48px', 'Collapsed columns retain their compact width');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
assert.match(css, /\.reader-content > \*\s*\{[^}]*max-width: 800px;[^}]*margin-right: auto;[^}]*margin-left: auto;/, 'Panel expansion must retain the existing centered text measure');
console.log('Reader width contract passed: sole/restored/linked Readers, sharing, minimums, manual resizing, and text measure.');

function scrollElement(width = 400, scrollWidth = 900) {
  return {
    dataset: {}, attributes: {}, listeners: [], clientWidth: width, scrollWidth, scrollLeft: 0,
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, callback, options) { this.listeners.push({ type, callback, options }); }
  };
}
const tableContext = vm.createContext({
  document: { createElement: () => scrollElement() },
  rewriteCodeHTML: value => value, decorateCodeHTML() {}
});
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
vm.runInContext(['bindHorizontalWheelScroll', 'renderCodeBlock'].map(actual).join('\n'), tableContext);
const html = '<table><tr><td rowspan="2">Roof slope</td><td>Attachment</td></tr></table>';
const table = tableContext.renderCodeBlock({ kind: 'table', html });
assert.equal(table.innerHTML, html, 'Scrolling preserves authored table cells, spans and text.');
assert.equal(table.tabIndex, 0, 'The table can receive keyboard scrolling.');
assert.equal(table.attributes['aria-label'], 'Code table');
assert.equal(table.listeners[0].options.passive, false);
tableContext.bindHorizontalWheelScroll(table);
assert.equal(table.listeners.length, 1, 'Rebinding does not duplicate the wheel handler.');
const workspace = scrollElement(1000, 3000);
tableContext.bindHorizontalWheelScroll(workspace);
function wheel(values = {}) {
  const event = { deltaX: 0, deltaY: 0, deltaMode: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...values };
  table.listeners[0].callback(event);
  workspace.listeners[0].callback(event);
  return event;
}
assert.equal(wheel({ shiftKey: true, deltaY: 80 }).defaultPrevented, true);
assert.equal(table.scrollLeft, 80, 'Shift + mouse wheel scrolls the table.');
assert.equal(workspace.scrollLeft, 0, 'The outer workspace respects the handled gesture.');
wheel({ deltaX: 120, deltaY: 2 });
assert.equal(table.scrollLeft, 200, 'Horizontal trackpad gestures scroll the table.');
assert.equal(workspace.scrollLeft, 0);
assert.equal(wheel({ deltaY: 120 }).defaultPrevented, false, 'Ordinary vertical scrolling stays available.');
assert.equal(table.scrollLeft, 200);
table.scrollLeft = 500;
assert.equal(wheel({ deltaX: 120 }).defaultPrevented, true, 'The right table edge contains sideways gestures.');
assert.equal(table.scrollLeft, 500);
table.scrollLeft = 0;
assert.equal(wheel({ deltaX: -120 }).defaultPrevented, true, 'The left table edge also contains gestures.');
assert.equal(workspace.scrollLeft, 0, 'Reaching a table edge cannot move other columns.');
wheel({ shiftKey: true, deltaY: 2, deltaMode: 1 });
assert.equal(table.scrollLeft, 32, 'Line-based mouse wheels use pixel distances.');
wheel({ shiftKey: true, deltaY: 1, deltaMode: 2 });
assert.equal(table.scrollLeft, 432, 'Page-based mouse wheels use the table viewport.');
for (const modifier of ['ctrlKey', 'metaKey']) {
  assert.equal(wheel({ [modifier]: true, deltaX: 40 }).defaultPrevented, false, 'Zoom gestures remain native.');
}
table.scrollWidth = table.clientWidth;
wheel({ deltaX: 60 });
assert.equal(workspace.scrollLeft, 60, 'A table that fits does not trap workspace scrolling.');
console.log('Table scrolling passed: authored content, Shift wheel, trackpad, both edges, keyboard focus, wheel units, vertical scrolling and zoom.');
