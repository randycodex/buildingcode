import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`); assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function node() {
  const attributes = new Map(), listeners = {}, names = new Set();
  const el = { dataset: {}, hidden: true, textContent: '', attributes, listeners,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name),
    addEventListener: (name, callback) => (listeners[name] ||= []).push(callback),
    emit: name => (listeners[name] || []).forEach(callback => callback({ preventDefault() {}, stopPropagation() {} })),
    closest: () => null, querySelector: () => null, focus() {},
    classList: { contains: name => names.has(name), add: name => names.add(name), remove: name => names.delete(name),
      toggle(name, on) { if (on) names.add(name); else names.delete(name); } } };
  for (const name of ['title','tabIndex']) Object.defineProperty(el, name, {
    get: () => attributes.get(name === 'tabIndex' ? 'tabindex' : name),
    set: value => attributes.set(name === 'tabIndex' ? 'tabindex' : name, String(value)) });
  return el;
}
const ids = ['reader:one','reader:two','utility:saved:one','project:notebook:project','utility:search:one'];
const panels = ids.map(id => {
  const panel = node(), header = node(), title = node(), rail = node(), span = node();
  panel.dataset.paneId = id; title.textContent = id;
  header.querySelector = selector => selector.includes('.panel-kind') ? title : null;
  header.querySelectorAll = () => [title]; rail.querySelector = () => span;
  panel.querySelector = selector => selector.includes(':scope > header') ? header : selector.includes('pane-collapsed-tab') ? rail : null;
  panel.querySelectorAll = () => [];
  panel.getBoundingClientRect = () => ({ width: panel.classList.contains('is-collapsed') ? 48 : 600 });
  return Object.assign(panel, { header, titleNode: title, rail });
});
let view = 'research'; const hidden = new Set(), state = { collapsedPaneIDs: [ids[2],ids[3]], columnGroups: [] };
const c = vm.createContext({ state, detachedProjectWindow: false,
  currentColumnWorkflowView: () => view, workflowPaneIsVisible: id => !hidden.has(id),
  track: { querySelectorAll: selector => selector.includes('pane-divider') ? [] : panels.filter(p => !hidden.has(p.dataset.paneId)) },
  columnGroupForPane: id => state.columnGroups.find(group => group.paneIDs.includes(id)), activePinnedPaneID: () => '',
  captureReaderScrollPositions: () => new Map(), restoreReaderScrollPositions() {}, applyPaneWeight() {},
  prepareColumnGroupControls() {}, workspacePrivatePresentationAllowed: () => true, closeActiveCustomSelect() {},
  getComputedStyle: () => ({ paddingInline: '24px' }), window: { matchMedia: () => ({ matches: true }) },
  saveWorkspaceState() {}, notifyWorkspaceLayoutChange() {} });
vm.runInContext(['paneCanCollapse','columnGroupCanCollapse','columnGroupIsCollapsed','paneIsCollapsed','applyPaneCollapsedState',
  'setPaneCollapsed','setAllColumnsCollapsed','preparePaneCollapse','updateCollapsedPaneDividers',
  'refreshColumnGroupPresentation','setColumnGroupCollapsed'].map(actual).join('\n'), c);
panels.forEach(c.preparePaneCollapse);
assert.equal(panels[3].titleNode.getAttribute('role'), 'button');
assert.equal(c.paneIsCollapsed(ids[3]), true);
let cancelled = 0, restored = 0;
panels[3]._collapseAnimation = { cancel() { cancelled += 1; } };
panels[3]._restoreCollapseChildWidths = () => { restored += 1; delete panels[3]._restoreCollapseChildWidths; };
view = 'notebook'; panels.forEach(c.preparePaneCollapse);
assert.equal(cancelled, 1); assert.equal(restored, 1, 'Entering Notebook cancels a tool-column collapse already in flight.');
for (const panel of panels.slice(2)) {
  assert.equal(c.paneIsCollapsed(panel.dataset.paneId), false, 'Non-Reader Notebook columns stay expanded.');
  assert.equal(panel.classList.contains('is-collapsed'), false);
  assert.equal(panel.titleNode.getAttribute('role'), null, 'Notebook tool titles are headings, not collapse buttons.');
  assert.equal(panel.titleNode.getAttribute('aria-expanded'), null);
  panel.titleNode.emit('click'); c.setPaneCollapsed(panel, true);
}
assert.deepEqual(state.collapsedPaneIDs, [ids[2],ids[3]], 'Saved collapse preferences from other views are preserved.');
assert.equal(panels[0].titleNode.getAttribute('role'), 'button'); panels[0].titleNode.emit('click');
assert.equal(c.paneIsCollapsed(ids[0]), true); c.setAllColumnsCollapsed(true);
assert.equal(c.paneIsCollapsed(ids[1]), true); assert.equal(c.paneIsCollapsed(ids[3]), false);
c.setAllColumnsCollapsed(false); assert.equal(c.paneIsCollapsed(ids[0]), false);
assert.deepEqual(Array.from(state.collapsedPaneIDs), [ids[2],ids[3]]);
const mixed = { paneIDs: [ids[0],ids[4]], collapsed: true }; state.columnGroups = [mixed];
assert.equal(c.columnGroupCanCollapse(mixed), false); assert.equal(c.paneIsCollapsed(ids[0]), false);
c.setColumnGroupCollapsed(mixed, false); assert.equal(mixed.collapsed, true);
c.refreshColumnGroupPresentation(); assert(panels.every(panel => !panel.classList.contains('is-group-hidden')));
hidden.add(ids[4]); mixed.paneIDs.push(ids[1]);
assert.equal(c.columnGroupCanCollapse(mixed), true, 'A hidden tool from another view does not block a Reader-only Notebook group.');
c.refreshColumnGroupPresentation(); assert.equal(panels[0].classList.contains('is-group-hidden'), false);
assert.equal(panels[1].classList.contains('is-group-hidden'), true);
assert.equal(panels[3].classList.contains('is-group-hidden'), false);
hidden.clear(); view = 'research'; panels.forEach(c.preparePaneCollapse);
assert.equal(c.paneIsCollapsed(ids[3]), true); assert.equal(panels[3].titleNode.getAttribute('role'), 'button');
assert.equal(panels[3].titleNode.listeners.click.length, 1, 'Returning to Research restores controls without duplicate listeners.');
console.log('Notebook collapse: only Readers; headings, stale handlers, bulk actions, saved preferences, mixed groups and view transitions passed.');
