import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
assert.doesNotMatch(html, /id="open-unassigned"/);
for (const name of ['renderReaderChapterSection','renderInlineCommentBox','syncReaderNoteBookmarkButtons']) {
  assert.doesNotMatch(actual(name), /savedSectionRecord\(/, 'Reader bookmark controls use current Project membership');
  assert.match(actual(name), /isSectionSaved\(/);
}

// Exercise the real save entry point, including its pre-mutation Project gate.
const payload = { sectionID: '261', codeVersion: 'AC2014', blockID: 'paragraph' };
const project = { id: 'p1', folderType: 'project' };
const key = item => [item.codeVersion, item.sectionID, item.blockID || ''].join('|');
let chosen = null, active = null, requests = 0, accountID = 'A', chooseEffect;
let events = [];
const context = vm.createContext({
  state: { localSavedItems: [], localProjectSections: [], localAnnotations: [] },
  activeWorkspaceID: 'general', defaultSyncCodeVersion: 'BC2022',
  document: { activeElement: null },
  requirePrivateWorkspaceWritable() {},
  captureAccountRequest: () => accountID,
  requireCurrentAccountRequest: identity => { if (identity !== accountID) throw Error('Account changed'); },
  isCurrentAccountRequest: identity => identity === accountID,
  activeAccount: () => ({ userID: accountID }), workspaceProject: () => active,
  currentContentSummary: () => ({ projects: [project], projectSections: context.state.localProjectSections }),
  projectRecordID: item => item.id,
  projectSectionBelongsToProject: (item, destination) => item.folderID === destination.id,
  savedItemForSection: () => null, primarySavedPaneID: () => '',
  hasCapability: () => true,
  chooseProjectForSaving: async () => { requests++; chooseEffect?.(); active = chosen; return chosen; },
  syncCodeVersion: value => value,
  setLocalSectionSaved() { events.push('local'); },
  savedEvidenceKey: key,
  savedRecordForSection: item => ({ ...item, id: key(item) }),
  savedMutationForSection: item => ({ savedItem: { ...item } }),
  persistSectionInProject: async (destination, item) => {
    context.state.localProjectSections.push({ ...item, folderID: destination.id }); events.push('membership'); return true;
  },
  refreshOpenSavedPanes: async () => {}, saveWorkspaceState() {},
  pushMutation: async mutation => { events.push(mutation); },
  isSessionAuthenticationError: () => false,
  noteValueForTarget: () => '', tagsForTarget: () => [],
  projectLinkForAnnotationTarget: (destination, item) => context.state.localProjectSections.find(link => key(link) === key(item) && link.folderID === destination.id),
  projectSectionRecordForSection: (destination, item) => ({ ...item, id: key(item), folderID: destination.id }),
  projectSectionMutationForSection: (destination, item) => ({ projectSection: { ...item, folderID: destination.id } }),
  enqueueSyncMutation: mutation => events.push(mutation),
  annotationRecordForTarget: (item, values) => ({ ...item, ...values }),
  upsertLocalAnnotation: item => { context.state.localAnnotations.push(item); events.push('annotation'); },
  scheduleAnnotationPush() {}, refreshVisiblePlanUsage() {},
});
vm.runInContext([actual('persistSectionBookmark'), actual('setAnnotationNoteValue'), actual('isSectionSaved')].join('\n'), context);
const save = options => context.persistSectionBookmark(payload, true, options);
assert.equal(await save({ attachToWorkspaceProject: false }), false);
assert.equal(context.state.localSavedItems.length, 0);
assert.deepEqual(events, []);
chosen = project;
assert.equal(await save(), true);
assert.equal(context.state.localProjectSections[0].folderID, 'p1');
assert.equal(key(context.state.localProjectSections[0]), key(payload));
assert.equal(key(events.find(item => item.savedItem)?.savedItem), key(payload));
assert.equal(requests, 2);
await save();
assert.equal(requests, 2, 'An existing selected Project saves directly');
active = null; events = []; context.state.localProjectSections = [];
assert.equal(context.isSectionSaved(payload), false, 'No selected Project cannot remove another Project save');
chooseEffect = () => { accountID = 'B'; };
await assert.rejects(save(), /Account changed/);
assert.deepEqual(events, [], 'A late account change must not create any save');
chooseEffect = null; active = null; chosen = null;
assert.equal(context.setAnnotationNoteValue(payload, 'pending note'), false);
await Promise.resolve(); await Promise.resolve();
assert.equal(context.state.localAnnotations.length, 0, 'Cancelling Project choice leaves no note');
chosen = project;
assert.equal(context.setAnnotationNoteValue(payload, 'same edition and block'), false);
await Promise.resolve(); await Promise.resolve();
assert.equal(context.state.localAnnotations[0].noteBody, 'same edition and block');
assert.equal(key(context.state.localAnnotations[0]), key(payload));
assert.equal(events[0].projectSection.folderID, 'p1');
assert.equal(events[1], 'annotation', 'Project membership is queued before the note');

// Restored inbox columns retire with their descendants, leaving unrelated
// Readers, Project panes, notes, and account outbox records intact.
vm.runInContext(actual('retireUnassignedLayout'), context);
const layout = {
  readers: [{ id: 'independent', scrollTop: 357 }, { id: 'derived', savedSourcePaneID: 'utility:saved:inbox' }, { id: 'detailReader' }],
  utilityInstances: [{ key: 'saved', id: 'inbox', unassignedInbox: true }, { key: 'saved', id: 'project' }, { key: 'sdc', id: 'detail' }],
  sectionDetails: { detail: payload }, sectionDetailAnchors: { detail: 'utility:saved:inbox' }, searchLinkedReaders: { detail: 'detailReader' },
  paneOrder: ['reader:independent', 'utility:saved:inbox', 'utility:sdc:detail', 'reader:derived', 'reader:detailReader', 'utility:saved:project'],
  paneWeights: { 'reader:independent': 800, 'utility:saved:inbox': 600 },
  utilities: { saved: true }, localAnnotations: [{ noteBody: 'untouched' }], syncOutbox: [{ id: 'untouched' }],
};
const original = structuredClone(layout), retired = context.retireUnassignedLayout(layout);
assert.deepEqual(layout, original, 'Migration does not mutate its source snapshot');
assert.equal(retired.readers.length, 1); assert.equal(retired.readers[0].scrollTop, 357);
assert.equal(retired.utilityInstances.length, 1); assert.equal(retired.utilityInstances[0].id, 'project');
assert.equal(retired.localAnnotations, layout.localAnnotations); assert.equal(retired.syncOutbox, layout.syncOutbox);
assert.equal(retired.paneOrder.length, 2);
assert.equal(context.retireUnassignedLayout(retired), retired, 'Migration is idempotent');
const onlyInbox = context.retireUnassignedLayout({ ...layout, utilityInstances: [layout.utilityInstances[0]] });
assert.equal(onlyInbox.utilities.saved, false, 'Retired inbox does not recreate a blank Saved pane');

// The real choice dialog prevents duplicate creation and fences late callbacks.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.value = ''; }
  append(...items) { this.children.push(...items); }
  setAttribute() {} addEventListener(name, callback) { this.events[name] = callback; }
  focus() {} remove() { this.removed = true; }
  querySelectorAll(selector) { return this.children.flatMap(item => [item, ...item.querySelectorAll(selector)]).filter(item => selector.split(', ').includes(item.tag)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
let createCalls = 0, resolveCreate, identity = 'A';
const body = new Element('body');
const chooser = vm.createContext({ document: { createElement: tag => new Element(tag), body },
  workspaceProject: () => chooser.active || null, hasCapability: () => true,
  captureAccountRequest: () => identity, requireCurrentAccountRequest: captured => { if (identity !== captured) throw Error('Account changed'); },
  isCurrentAccountRequest: captured => captured === identity,
  activeFolderRecords: items => items, folderIsProject: item => item.folderType === 'project',
  currentContentSummary: () => ({ projects: [project] }), reconcileProjectWorkspaces() {},
  projectDetailMatches: (a, b) => a.id === b.id, projectRecordID: item => item.id,
  workspaceRegistry: { workspaces: [{ id: 'project:p1', projectID: 'p1' }] },
  switchWorkspace: async () => { chooser.active = project; return true; }, trapWebModalFocus() {},
  createProjectFolder: () => { createCalls++; return new Promise(resolve => { resolveCreate = resolve; }); },
});
vm.runInContext('let pendingProjectChoice=null, cancelPendingProjectChoice=null;\n' + actual('chooseProjectForSaving'), chooser);
let pending = chooser.chooseProjectForSaving();
const dialog = body.children[0].children[0];
const form = dialog.children.find(item => item.tag === 'form');
form.children[0].value = 'New test Project';
const creating = form.events.submit({ preventDefault() {} });
await form.events.submit({ preventDefault() {} });
dialog.children.find(item => item.textContent === 'Cancel').events.click();
assert.equal(createCalls, 1); assert.equal(dialog.removed, undefined);
resolveCreate(project); await creating;
assert.equal(await pending, project);
chooser.active = null;
pending = chooser.chooseProjectForSaving();
const nextDialog = body.children.at(-1).children[0];
nextDialog.children.find(item => item.textContent === 'Cancel').events.click();
assert.equal(await pending, null);
pending = chooser.chooseProjectForSaving();
const staleDialog = body.children.at(-1).children[0];
const staleForm = staleDialog.children.find(item => item.tag === 'form'); staleForm.children[0].value = 'Stale Project';
const staleCreating = staleForm.events.submit({ preventDefault() {} });
identity = 'B'; vm.runInContext('cancelPendingProjectChoice()', chooser);
resolveCreate(project); await staleCreating;
assert.equal(await pending, null); assert.equal(chooser.active, null);
console.log('Project-save policy passed: cancellation, direct saves, account fencing, note membership, legacy layout retirement, duplicate creation and late callbacks.');
