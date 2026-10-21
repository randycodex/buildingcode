import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function appendPaneSequence(');
const actual = source.slice(start, source.indexOf('\n}', start) + 2);
const events = [];
const classes = () => ({toggle() {}, remove() {}});
const pane = {dataset: {paneId: 'reader:one'}, classList: classes()};
const track = {
  children: [], scrollLeft: 100, scrollWidth: 1200, clientWidth: 1000,
  querySelectorAll: () => [],
  insertBefore(node, current) {
    assert.equal(current, null);
    this.children.push(node); node.parentNode = this;
    events.push('insert');
  }
};
const c = vm.createContext({
  track, state: {}, localWelcomePreviewPending: false, firstUseWelcomeActive: false,
  detachedProjectWindow: false, closeActiveCustomSelect() {}, orderPanes: panes => panes,
  activePinnedPaneID: () => '', applyLinkedPanePlacements: ids => ids, pairSavedEvidenceDetails: ids => ids,
  ensureWorkspacePanelAccessibleName() {}, preparePaneCollapse() {events.push('prepare');},
  cleanupInactiveWorkboardMounts() {}, cleanupInactiveNotebookMounts() {}, cleanupInactiveReportDraftMounts() {},
  bindPaneDragging() {}, workflowPaneIsVisible: () => true, currentColumnWorkflowView: () => 'research',
  createDivider: (previousPaneId, nextPaneId) => ({dataset: {previousPaneId, nextPaneId}}),
  refreshColumnGroupPresentation(options = {}) {
    assert.equal(options.preparePanels, false, 'Already prepared panes must not reset their widths again');
    assert.equal(options.refreshDividers, false, 'Divider measurements wait for final widths');
    events.push('groups');
  },
  syncWorkflowNavigation() {
    assert.equal(track.children.length, 3, 'Navigation lays out the final pane/divider sequence');
    assert.equal(track.children[1], pane);
    events.push('navigation');
  },
  updateCollapsedPaneDividers() {events.push('measure');},
  refreshPinnedPaneDivider() {events.push('pin');},
  document: {querySelectorAll: () => []}, notifyWorkspaceLayoutChange() {events.push('notify');}
});
vm.runInContext(actual, c);
c.appendPaneSequence([pane]);
assert.deepEqual(events, ['prepare', 'insert', 'insert', 'insert', 'groups', 'navigation', 'measure', 'pin', 'notify']);
assert.equal(track.scrollLeft, 100);
console.log('Workspace layout passes: prepare once, mount/order all nodes, apply group visibility, size once, then measure dividers.');
