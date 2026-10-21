import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const node = () => {
  const classes = new Set(), attributes = new Map();
  return {dataset: {}, classList: {contains: key => classes.has(key), toggle(key, on) {if (on) classes.add(key); else classes.delete(key);}},
    setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key)};
};
let reads = 0, paints = 0, permitted = true, usageRefreshes = 0;
const project = {id: 'project', clientID: 'project', name: 'Active Project'};
let links = [
  {sectionID: 'section', codeVersion: '2022', blockID: 'block-7', folderClientID: 'project'},
  {sectionID: 'section', codeVersion: '2022', blockID: '', folderClientID: 'project'},
  {sectionID: 'section', codeVersion: '2014', blockID: 'block-8', folderClientID: 'project'},
  {sectionID: 'section', codeVersion: '2022', blockID: 'block-9', folderClientID: 'other'}
];
const panel = {__workspaceAccessGate: {get allowed() {return permitted;}}};
const wrappers = Array.from({length: 500}, (_, index) => {
  const wrapper = node(), button = node();
  wrapper.dataset = {commentSectionId: 'section', commentCodeVersion: '2022', commentBlockId: `block-${index}`};
  wrapper.closest = () => panel;
  wrapper.querySelector = () => button;
  Object.defineProperty(button, 'innerHTML', {set() {paints++;}});
  return wrapper;
});
const marker = node();
const section = {dataset: {sectionId: 'section', codeVersion: '2022'}, closest: () => panel, querySelector: () => marker};
const draft = {value: 'Unsaved note text'};
const c = vm.createContext({
  track: {querySelectorAll: selector => selector.includes('.inline-comment') ? wrappers : selector.includes('.chapter-section') ? [section] : []},
  document: {activeElement: draft}, CSS: {escape: value => value},
  currentContentSummary() {reads++; return {projects: [project], projectSections: links};},
  workspaceProject: projects => (projects || c.currentContentSummary().projects)[0],
  projectSectionBelongsToProject: (link, selected) => link.folderClientID === selected?.id,
  syncCodeVersion: value => value || '2022', defaultSyncCodeVersion: '2022',
  bookmarkIconSVG: saved => saved ? 'saved' : 'unsaved',
  openProjectDetails: () => [], refreshOpenAnnotationProjectEditors() {},
  refreshVisiblePlanUsage() {usageRefreshes++;}, updateConnectionStatus() {},
  noteValueForTarget() {throw new Error('Bookmark refresh must not reread unused passage notes');},
});
vm.runInContext(['normalizeAnnotationBlockID','sectionNoteKey','savedEvidenceKey','workspaceSavedEvidenceKeys','isSectionSaved',
  'readerPrivateContentAllowed','bookmarkActionLabel','syncImmediateBookmarkButton','syncReaderNoteBookmarkButtons',
  'visibleSyncedTargetKey','refreshVisibleSyncedDerivedState'].map(actual).join('\n'), c);
c.refreshVisibleSyncedDerivedState();
assert.equal(reads, 1, '500 passage controls and the section marker use one fresh summary');
assert.equal(paints, 500, 'Each passage is updated once, not once per passage target');
assert.equal(wrappers[7].querySelector().classList.contains('is-saved'), true);
assert.equal(wrappers[8].querySelector().classList.contains('is-saved'), false, 'Edition remains exact');
assert.equal(wrappers[9].querySelector().classList.contains('is-saved'), false, 'Project remains exact');
assert.equal(marker.classList.contains('is-saved'), true);
assert.equal(wrappers[7].querySelector().getAttribute('aria-label'), 'Remove from project: Active Project');
assert.equal(draft.value, 'Unsaved note text');
assert.equal(usageRefreshes, 1);
links = []; reads = 0; paints = 0;
c.refreshVisibleSyncedDerivedState();
assert.equal(reads, 1, 'Later syncs use fresh state');
assert.equal(wrappers[7].querySelector().classList.contains('is-saved'), false);
assert.equal(marker.classList.contains('is-saved'), false);
permitted = false; reads = 0; paints = 0;
c.refreshVisibleSyncedDerivedState();
assert.equal(reads, 0, 'Revoked Reader access never reads private bookmark state');
assert.equal(paints, 0);
permitted = true; reads = 0;
c.syncReaderNoteBookmarkButtons('section', false, '2022');
assert.equal(reads, 1, 'A direct exact-section refresh also builds one snapshot');

// A search bookmark save updates only the relevant controls, usage and sync UI.
{
  const events = [], button = node();
  button.addEventListener = (name, fn) => {button[name] = fn;};
  button.isConnected = true;
  const search = vm.createContext({document: {createElement: () => button}, savedEvidenceKey: () => 'target',
    syncImmediateBookmarkButton() {}, isSectionSaved: () => false,
    persistSectionBookmark: async () => {events.push('persist'); return true;},
    refreshOpenSavedPanes: async () => events.push('saved'),
    syncReaderNoteBookmarkButtons: () => events.push('reader'),
    syncSearchResultBookmarkButtons: () => events.push('search'),
    syncSectionDetailBookmarkState: () => events.push('detail'),
    showReaderSaveConfirmation: () => events.push('confirmation'),
    refreshVisiblePlanUsage: () => events.push('usage'), updateConnectionStatus: () => events.push('connection'),
    refreshVisibleSyncedDerivedState() {throw new Error('Unrelated Readers and editors must not refresh after one bookmark');},
    showWebNotice: async () => assert.fail('Bookmark click should succeed')});
  button.classList.remove = () => {};
  vm.runInContext(actual('createSearchResultSaveButton'), search);
  search.createSearchResultSaveButton({}, {sectionID: 'section', codeVersion: '2022'});
  await button.click();
  assert.deepEqual(events, ['persist','saved','reader','search','detail','confirmation','usage','connection']);
  assert.equal(button.disabled, false);
}
{
  const target = {sectionID: 'section', codeVersion: '2022', blockID: 'block-7'};
  const notifications = [], assignments = [];
  const makePanel = (payload, allowed = true) => ({__sectionPayload: payload, __annotationTarget: payload,
    __workspaceAccessGate: {allowed}, querySelector(selector) {
      if (selector === '.section-detail-notes') return {dispatchEvent: event => notifications.push(event.detail)};
      if (selector === '.section-detail-projects') return payload;
      throw new Error('A bookmark change must not touch the comment editor');
    }});
  const panels = [makePanel(target), makePanel({...target, blockID: ''}), makePanel({...target, codeVersion: '2014'}), makePanel(target, false)];
  c.track = {querySelectorAll: () => panels};
  c.CustomEvent = class {constructor(type, options) {this.type = type; this.detail = options.detail;}};
  c.renderAnnotationProjectEditor = container => assignments.push(container);
  vm.runInContext(actual('syncSectionDetailBookmarkState'), c);
  c.syncSectionDetailBookmarkState(target, true);
  assert.deepEqual(JSON.parse(JSON.stringify(notifications)), [{saved: true}]);
  assert.deepEqual(assignments, [target]);
}
console.log('Bookmark refresh: 500 passage controls share one snapshot and one update each; exact identities, fresh writes, private access, draft retention and scoped search saves passed.');
