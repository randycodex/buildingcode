import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { readerTabs, initializeReaderTabs, activateReaderTab, addReaderTab, removeReaderTab, retainedReaderTab, canAddReaderTab, maximumReaderTabs } from '../public/reader-tabs.js';
import { sharedWorkspaceLayout, workspaceLayoutFingerprint, applySharedWorkspaceLayout } from '../public/workspace-layout-sync.js';
import { captureWorkspaceLayout, normalizeWorkspaceLayout } from '../public/workspace-state.js';

const column = { id: 'column-a', codePrefix: 'BC', codeVersion: '2022', chapterID: '10', sectionID: '1005',
  internalSearchQuery: 'stairs', internalSearchOpen: true, scrollPosition: { contentKey: 'bc', sectionID: '1005', anchorOffset: -120 } };
initializeReaderTabs(column);
const original = column.activeTabID;
assert.equal(readerTabs(column).length, 1, 'A legacy Reader becomes one tab without changing the column ID.');
addReaderTab(column, { codePrefix: 'PC', codeVersion: '2022', chapterID: '4', sectionID: '403' }, 'plumbing');
assert.equal(column.id, 'column-a');
assert.equal(column.internalSearchQuery, undefined, 'A different tab does not inherit another tab’s search.');
column.scrollPosition = { contentKey: 'pc', sectionID: '403', anchorOffset: -60 };
assert.equal(activateReaderTab(column, original), true);
assert.equal(column.sectionID, '1005'); assert.equal(column.internalSearchQuery, 'stairs');
assert.equal(column.internalSearchOpen, true); assert.equal(column.scrollPosition.anchorOffset, -120);
addReaderTab(column, { codePrefix: 'BC', codeVersion: '2022', chapterID: '10', sectionID: '1011' }, 'other-bc');
const restored = normalizeWorkspaceLayout(JSON.parse(JSON.stringify(captureWorkspaceLayout({ readers: [column] })))).readers[0];
activateReaderTab(restored, 'plumbing');
assert.equal(restored.sectionID, '403'); assert.equal(restored.scrollPosition.anchorOffset, -60);
assert.equal(restored.id, 'column-a');
assert.equal(removeReaderTab(restored, 'plumbing'), true);
assert.equal(restored.activeTabID, 'other-bc', 'Closing the active tab selects its next neighbour.');
assert.equal(removeReaderTab(restored, 'missing'), false);
assert.equal(activateReaderTab(restored, 'missing'), false);
assert.deepEqual(readerTabs(restored).map(tab => tab.id), [original, 'other-bc']);
const retained = retainedReaderTab({ ...column, id: 'copy', searchPreviewPaneID: 'search', pinnedDetailSourceID: 'detail', referenceSourceReaderID: 'source' });
assert.equal(retained.searchPreviewPaneID, undefined); assert.equal(retained.pinnedDetailSourceID, undefined);
assert.equal(retained.referenceSourceReaderID, undefined); assert.equal(retained.sectionID, '1011');

const shared = sharedWorkspaceLayout({ readers: [column] });
assert.equal(shared.readers[0].tabs.length, 3);
assert.equal(JSON.stringify(shared).includes('stairs'), false, 'Shared layout contains locators, never search text.');
assert.equal(JSON.stringify(shared).includes('anchorOffset'), false, 'Reading positions remain device-local.');
const fingerprint = workspaceLayoutFingerprint({ readers: [column] });
activateReaderTab(column, original); column.sectionID = 'locally-navigated';
assert.equal(workspaceLayoutFingerprint({ readers: [column] }), fingerprint, 'Reading and tab selection do not publish layout mutations.');
const remote = structuredClone(shared);
remote.readers[0].tabs.push({ id: 'remote-tab', codePrefix: 'AC', codeVersion: '2014', chapterID: '1', sectionID: '101' });
let merged = applySharedWorkspaceLayout({ readers: [column] }, {projectID: 'p', layout: remote}, {id: 'p'}).readers[0];
assert.equal(merged.activeTabID, original); assert.equal(merged.sectionID, 'locally-navigated');
assert.equal(merged.internalSearchQuery, 'stairs'); assert.equal(readerTabs(merged).length, 4);
activateReaderTab(merged, 'remote-tab'); assert.equal(merged.codeVersion, '2014');
remote.readers[0].tabs = remote.readers[0].tabs.filter(tab => tab.id !== original);
merged = applySharedWorkspaceLayout({ readers: [column] }, {projectID: 'p', layout: remote}, {id: 'p'}).readers[0];
assert.equal(readerTabs(merged).some(tab => tab.id === original), false, 'A remotely closed tab cannot be resurrected by local cursor state.');
assert.notEqual(merged.activeTabID, original);
const damaged = {id: 'damaged', codePrefix: 'wrong', tabs: [{id: 'valid', codePrefix: 'PC', codeVersion: '2014'}]};
initializeReaderTabs(damaged); assert.equal(damaged.codePrefix, 'PC');

const full = {id: 'full', codePrefix: 'BC', codeVersion: '2022'};
initializeReaderTabs(full);
for (let i = 1; i < maximumReaderTabs; i++) addReaderTab(full, {codePrefix: `CODE${i}`, codeVersion: '2022'}, `tab-${i}`);
assert.equal(readerTabs(full).length, 6); assert.equal(canAddReaderTab(full), false);
const fullSnapshot = JSON.stringify(full);
assert.equal(addReaderTab(full, {codePrefix: 'SEVENTH'}, 'overflow'), null);
assert.equal(JSON.stringify(full), fullSnapshot, 'A seventh tab cannot change any existing tab or the active session.');
removeReaderTab(full, 'tab-1');
assert.equal(canAddReaderTab(full), true);
addReaderTab(full, {codePrefix: 'REPLACEMENT'}, 'replacement');
assert.equal(readerTabs(full).length, 6, 'Closing a tab makes one slot available again.');

// Exercise the actual column transfer functions, including independent copies
// and moving the last tab out of a column without leaving an empty pane.
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => { const start = source.search(new RegExp(`(?:async )?function ${name}\\(`)); assert(start >= 0, name); return source.slice(start, source.indexOf('\n}', start) + 2); };
const layoutContext = vm.createContext({ Event, syncReferenceReaderLayout() {}, track: {dispatchEvent(event) {
  assert.equal(event.type, 'permitext:workspace-layout-change');
  assert.equal(event.bubbles, true, 'Column expansion must notify document-level Reader suspension listeners.');
}}});
vm.runInContext(actual('notifyWorkspaceLayoutChange'), layoutContext); layoutContext.notifyWorkspaceLayoutChange();
const a = { id: 'a', codePrefix: 'BC', codeVersion: '2022', sectionID: '1005' };
initializeReaderTabs(a); addReaderTab(a, {codePrefix: 'PC', codeVersion: '2022', sectionID: '403'}, 'pc');
const state = {readers: [a], workflowMembership: {}}; let serial = 0, renders = 0;
const context = vm.createContext({state, readerTabs, initializeReaderTabs, activateReaderTab, addReaderTab, removeReaderTab, retainedReaderTab, canAddReaderTab, maximumReaderTabs,
  isProAccount: () => true, rememberReaderTabPosition() {}, retainReaderColumn() {},
  newReaderState: fields => ({id: `column-${++serial}`, ...fields}),
  linkPaneToView: value => value, currentColumnWorkflowView: () => 'research', paneIDForReader: reader => `reader:${reader.id}`,
  placePaneAfter() {}, saveWorkspaceState() {}, transitionWorkspace: async () => {renders++;}, scrollPaneIntoView() {}});
vm.runInContext(actual('transferReaderTab'), context);
await context.transferReaderTab(a, 'pc', {duplicate: true});
const b = state.readers[1]; assert.equal(state.readers.length, 2); assert.equal(readerTabs(a).length, 2);
assert.equal(b.sectionID, '403'); assert.notEqual(b.id, a.id);
b.sectionID = '404'; assert.equal(a.sectionID, '403', 'Duplicated columns navigate independently.');
await context.transferReaderTab(a, 'pc');
assert.equal(state.readers.length, 3); assert.equal(readerTabs(a).length, 1); assert.equal(a.sectionID, '1005');
const c = state.readers[2];
await context.transferReaderTab(c, c.activeTabID, {destination: a});
assert.equal(state.readers.length, 2); assert.equal(readerTabs(a).length, 2); assert.equal(a.sectionID, '403');
assert.equal(renders, 3);

// Actual source-opening path: normal links share a column, existing code tabs
// are reused, and only the explicit new-column action adds another Reader.
state.paneWeights = {};
Object.assign(context, {
  activeWorkspaceID: 'workspace', readerShortcuts: {activePaneID: () => 'reader:a'},
  captureAccountRequest: () => 1, isCurrentAccountRequest: () => true,
  workspaceColumnsRequireProject: () => false, workflowPaneIsVisible: () => true,
  resolveReaderSource: async value => value, searchResultDetail: value => value,
  readerFieldsForSectionDetail: (value, overrides) => ({...value, ...overrides}),
  normalizeAnnotationBlockID: value => value || '',
  readerMatchesSource: (reader, detail) => reader.sectionID === detail.sectionID,
  readerIsClearlyAvailable: () => false, resolvedReaderSourceNavigations: new WeakMap(),
  track: {querySelector: () => null}, CSS: {escape: value => value},
  defaultPaneWidthForID: () => 600, appendPaneIfMissing() {}, updateBrowserSectionURL() {}, scheduleContinuitySync() {},
  whenWorkspacePaneReady: async () => true, paneIsCollapsed: () => false,
  columnExpansionController: () => ({reveal() {}}), revealReaderSourceTarget() {}
});
vm.runInContext(actual('prepareReaderSourceTab') + '\n' + source.slice(source.indexOf('function reusableSearchReader('), source.indexOf('\nfunction removeSectionDetail(', source.indexOf('function reusableSearchReader('))), context);
const firstCount = state.readers.length;
let opened = await context.openSourceInReader({codePrefix: 'AC', codeVersion: '2014', chapterID: '1', sectionID: '101'}, 'search', {sourceSurface: 'search'});
assert.equal(opened.id, 'a'); assert.equal(state.readers.length, firstCount);
const sourceTabID = opened.activeTabID, tabCount = readerTabs(opened).length;
opened = await context.openSourceInReader({codePrefix: 'AC', codeVersion: '2014', chapterID: '2', sectionID: '201'}, 'search', {sourceSurface: 'search'});
assert.equal(opened.activeTabID, sourceTabID); assert.equal(readerTabs(opened).length, tabCount, 'Another section in an existing code navigates its tab.');
const explicit = await context.openSourceInReader({codePrefix: 'BC', codeVersion: '2022', chapterID: '10', sectionID: '1011'}, 'search', {sourceSurface: 'search', forceNewReader: true});
assert.notEqual(explicit.id, 'a'); assert.equal(state.readers.length, firstCount + 1);
assert.equal(readerTabs(a).find(tab => tab.id === sourceTabID).sectionID, '201');

state.readers.push(full);
const transferSnapshot = JSON.stringify(state.readers);
const fullBeforeNavigation = JSON.stringify(full);
await context.transferReaderTab(a, sourceTabID, {destination: full});
assert.equal(JSON.stringify(state.readers), transferSnapshot, 'Moving into a full column leaves both columns untouched.');
context.readerShortcuts.activePaneID = () => 'reader:full';
const oldCount = state.readers.length;
const overflowReader = await context.openSourceInReader({codePrefix: 'NEW', codeVersion: '2022', chapterID: '1', sectionID: 'new-101'}, 'another-source', {sourceSurface: 'research'});
assert.notEqual(overflowReader.id, full.id); assert.equal(state.readers.length, oldCount + 1);
assert.equal(readerTabs(overflowReader).length, 1); assert.equal(overflowReader.sectionID, 'new-101');
assert.equal(JSON.stringify(full), fullBeforeNavigation, 'Overflow navigation preserves all six sessions and the selected tab.');
assert.equal(readerTabs(full).length, 6);
const existingID = readerTabs(full)[0].id;
const existingCode = readerTabs(full)[0];
const reopened = context.prepareReaderSourceTab(full, {...existingCode, sectionID: 'another-section'});
assert.equal(reopened, full); assert.equal(full.activeTabID, existingID);
assert.equal(state.readers.length, oldCount + 1, 'A full column can still navigate any code already in its tabs.');

// Direct Search/Saved navigation never creates a seventh-code overflow column.
const beforeDirectCount = state.readers.length;
const inactiveTabs = readerTabs(full).filter(tab => tab.id !== full.activeTabID);
const direct = await context.openSourceInReader({codePrefix:'DIRECT',codeVersion:'2022',chapterID:'1',sectionID:'direct'},'saved',{sourceSurface:'saved'});
assert.equal(direct.id,full.id);assert.equal(state.readers.length,beforeDirectCount);
assert.equal(readerTabs(full).length,6);assert.equal(full.sectionID,'direct');
for (const tab of inactiveTabs) assert.deepEqual(readerTabs(full).find(candidate=>candidate.id===tab.id),tab,'Other code tabs remain intact');

// A picker opened before a column fills must recheck capacity on selection.
let pickCode, pickerOpens = 0;
Object.assign(context, {openReaderCodePicker(_anchor, callback) {pickerOpens++; pickCode = callback;}, codeOptionVersion: () => '2022'});
vm.runInContext(actual('openReaderTabPicker'), context);
context.openReaderTabPicker(full, {}); assert.equal(pickerOpens, 0);
removeReaderTab(full, 'replacement');
context.openReaderTabPicker(full, {}); assert.equal(pickerOpens, 1);
addReaderTab(full, {codePrefix: 'FILLED'}, 'filled');
const beforeStalePicker = JSON.stringify(full);
await pickCode({prefix: 'SEVENTH'});
assert.equal(JSON.stringify(full), beforeStalePicker, 'A stale picker cannot add a seventh tab.');
console.log('Reader tabs passed: independent code/edition sessions, search and scroll restoration, saved-layout round trip, structural sync, local cursors, duplicate/move/new columns, empty-column removal, six-tab limits, stale pickers and overflow navigation.');
