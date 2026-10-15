import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const context = vm.createContext({
  state: { paneWeights: {}, readers: [], utilityInstances: [{id:'instance',key:'analysis',conversationID:'selected'}], paneWidthDefaultsVersion: 5 },
  researchDraftPaneIDs: new Set(), researchConversationPaneIsOpen: () => true,
  paneIDForUtilityInstance: item => `utility:${item.key}:${item.id}`,
  paneIDs: [],
  activePaneIDs() { return context.paneIDs; },
  detachedProjectWindow: false,
  isProjectWorkboardPaneID: id => id.startsWith('project:workboard:'),
  isCodeQuestionPaneID: () => false,
  isProjectCoordinationThreadPaneID: id => id.startsWith('project:coordination-thread:'),
  isProjectCoordinationPaneID: id => id.startsWith('project:coordination:'),
  isProjectDetailPaneID: id => id.startsWith('project:detail:'),
  isProAccount() { throw new Error('Reader layout must not depend on subscription'); }
});
vm.runInContext([
  ...source.matchAll(/const (?:(?:legacy|default)\w*PaneWidth|assistantHistoryWidth) = [^;]+;/g)
].map(match => match[0]).join('\n') + '\n' + [
  'isProjectNotebookPaneID', 'isProjectReportDraftPaneID', 'assistantHistoryOnlyPane', 'defaultPaneWidthForID',
  'minimumPaneWidthForID', 'migrateLegacyPaneWidth', 'normalizePaneWeights',
  'isFixedWidthPaneID', 'isFlexibleReaderPaneID', 'applyPaneWeight'
].map(actual).join('\n'), context);
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
    assert.equal(layout('reader:a', ['reader:a'], storedWidth, linked).flex, `1 0 ${Math.max(600, storedWidth)}px`, 'A sole Reader must fill the viewport, including restored/source-linked Readers');
  }
}
for (const ids of [['reader:a','reader:b'], ['reader:a','reader:b','reader:c'], ['reader:a','utility:search']]) {
  const style = layout('reader:a', ids);
  assert.equal(style.flex, '1 0 600px');
  assert.equal(style['--pane-default-min-width'], '600px', 'Readers stop shrinking at 600px even with fewer than four columns');
}
assert.equal(layout('reader:a', ['reader:a','reader:b'], 900).flex, '1 0 900px', 'Small layouts fill available space while retaining the saved width as their basis');
assert.equal(layout('reader:a', ['reader:a','reader:b','utility:search','utility:saved'], 900).flex, '1 0 900px', 'Saved divider widths remain visible when the workspace overflows');
assert.equal(layout('utility:search', ['utility:search','reader:a']).flex, '1 0 600px', 'Search shares available space in small layouts');
assert.equal(layout('utility:search', ['utility:search','reader:a','utility:saved','utility:analysis']).flex, '1 0 600px', 'Utilities keep sharing available space beyond three columns');
assert.equal(layout('reader:a', ['reader:a','reader:b'], 900, false, true).flex, '0 0 48px', 'Collapsed columns retain their compact width');
const mainPaneIDs = [
  'utility:saved', 'utility:saved:instance', 'reader:a', 'utility:search', 'utility:search:instance',
  'utility:analysis', 'utility:analysis:instance', 'research:conversation:conversation',
  'project:context:alpha', 'project:facts:alpha', 'project:notebook:alpha', 'project:report-draft:alpha',
  'utility:archive', 'utility:settings', 'project:coordination:alpha', 'project:coordination-thread:alpha',
  'project:workboard:alpha', 'project:detail:alpha', 'section:detail:one'
];
for (const id of mainPaneIDs) {
  const minimum = /^(?:utility:analysis(?:$|:)|research:conversation:)/.test(id) ? 1000 : 600;
  for (const count of [1, 2, 3, 4, 8]) {
    const ids = [id, ...Array.from({ length: count - 1 }, (_, index) => `reader:other-${index}`)];
    for (const restoredWidth of [400, 550, 600, 850]) {
      context.paneIDs = ids;
      context.state.paneWeights = { [id]: restoredWidth };
      context.normalizePaneWeights(ids);
      assert.equal(context.state.paneWeights[id], Math.max(minimum, restoredWidth), `${id} restores its minimum with ${count} columns`);
      const style = layout(id, ids, restoredWidth);
      assert.equal(style['--pane-default-min-width'], `${minimum}px`, `${id} enforces its rendered minimum`);
      assert.equal(context.state.paneWeights[id], Math.max(minimum, restoredWidth), `${id} also clamps widths when mounted directly`);
      const basis = Math.max(minimum, restoredWidth);
      assert.equal(style.flex, `1 0 ${basis}px`, `${id} fills available space with ${count} columns`);
    }
  }
  assert.equal(layout(id, [id], 600, false, true).flex, '0 0 48px', `${id} keeps its collapsed width`);
}
context.paneIDs = ['utility:archive'];
context.state.paneWeights = { 'utility:archive': 350 };
context.normalizePaneWeights(context.paneIDs);
assert.equal(context.state.paneWeights['utility:archive'], 600, 'Other main columns also enforce the 600px minimum');
context.researchConversationPaneIsOpen = () => false;
context.state.utilityInstances = [{id:'instance',key:'analysis',conversationID:''}];
for (const id of ['utility:analysis', 'utility:analysis:instance']) {
  assert.equal(context.minimumPaneWidthForID(id),400);
  assert.equal(context.defaultPaneWidthForID(id),400);
  assert.equal(layout(id,[id,'reader:a'],1200).flex,'0 0 400px','Unselected Assistant stays compact even with a saved chat width.');
  context.researchDraftPaneIDs.add(id);
  assert.equal(context.minimumPaneWidthForID(id),1000,'New chat reserves the message column.');
  assert.equal(layout(id,[id,'reader:a'],400).flex,'1 0 1000px');
  context.researchDraftPaneIDs.delete(id);
}
context.state.utilityInstances[0].conversationID='selected';
assert.equal(context.minimumPaneWidthForID('utility:analysis:instance'),1000,'Selected chat retains a 600px message column beside its history.');
console.log('Main column minimums passed: all main kinds, repeated utilities, saved narrow/wider widths, one through eight columns, and collapse.');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
assert.match(css, /grid-template-columns: 400px minmax\(600px, 1fr\);/, 'Only the Assistant chat expands; its conversation history stays fixed at 400px');
assert.match(css, /--workspace-content-max-width: 800px;/, 'Workspace reading content retains the 800px measure');
assert.match(css, /\.reader-content > \*[^{}]*\{[^}]*max-width: var\(--workspace-content-max-width\);[^}]*margin-right: auto;[^}]*margin-left: auto;/, 'Panel expansion must retain the shared centered text measure');
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
assert.equal(table.innerHTML, html, 'Column resizing preserves authored table cells, spans and text.');
assert.equal(table.tabIndex, undefined, 'Tables do not add a keyboard scrolling stop.');
assert.equal(table.attributes['aria-label'], 'Code table');
assert.equal(table.listeners.length, 0, 'Tables do not intercept wheel gestures.');
for (const selector of [
  '.code-table', '.research-answer-table-scroll',
  '.report-full-preview .report-preview-table'
]) {
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .find(match => /overflow-x:/.test(match[2]) &&
      match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').some(value => value.trim() === selector));
  assert.ok(rule, `Missing table overflow rule: ${selector}`);
  assert.match(rule[2], /overflow-x:\s*clip;/, `${selector} must not create a horizontal scroll container`);
  assert.match(rule[2], /overflow-y:\s*visible;/, `${selector} must not turn horizontal clipping into scrollable overflow`);
}
assert.match(css, /\.code-table table\s*\{[^}]*width: max-content;/, 'Wide source tables retain their authored measure until the column expands.');
const workspace = scrollElement(1000, 3000);
tableContext.bindHorizontalWheelScroll(workspace);
tableContext.bindHorizontalWheelScroll(workspace);
assert.equal(workspace.listeners.length, 1, 'Rebinding the workspace does not duplicate its wheel handler.');
function wheel(values = {}) {
  const event = { deltaX: 0, deltaY: 0, deltaMode: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...values };
  table.listeners.forEach(listener => listener.callback(event));
  workspace.listeners[0].callback(event);
  return event;
}
assert.equal(wheel({ shiftKey: true, deltaY: 80 }).defaultPrevented, false, 'Tables leave native Shift wheel gestures available.');
assert.equal(table.scrollLeft, 0);
wheel({ deltaX: 120, deltaY: 2 });
assert.equal(table.scrollLeft, 0, 'Horizontal trackpad gestures never scroll the table.');
assert.equal(workspace.scrollLeft, 120, 'Horizontal gestures over a table can move the workspace.');
assert.equal(wheel({ deltaY: 120 }).defaultPrevented, false, 'Ordinary vertical scrolling stays available.');
assert.equal(workspace.scrollLeft, 120);
wheel({ deltaX: -120 });
assert.equal(workspace.scrollLeft, 0, 'Tables do not trap gestures at their left edge.');
wheel({ deltaX: 2, deltaMode: 1 });
assert.equal(workspace.scrollLeft, 32, 'Line-based wheels retain workspace pixel conversion.');
wheel({ deltaX: 1, deltaMode: 2 });
assert.equal(workspace.scrollLeft, 1032, 'Page-based wheels use the workspace viewport.');
for (const modifier of ['ctrlKey', 'metaKey']) {
  assert.equal(wheel({ [modifier]: true, deltaX: 40 }).defaultPrevented, false, 'Zoom gestures remain native.');
}
assert.equal(table.scrollLeft, 0);
console.log('Column table contract passed: intact content, no inner scroll/focus handlers, clipped web wrappers, preserved workspace gestures, vertical scrolling and zoom.');
