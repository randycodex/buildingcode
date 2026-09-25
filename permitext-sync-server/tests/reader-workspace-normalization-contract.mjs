import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createWorkspacePaneHydrator } from '../public/workspace-pane-hydration.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i=0; i<12; i++) await Promise.resolve(); };
assert.match(actual('workspacePaneDescriptors'), /identity: workspaceReaderContentIdentity\(reader\)/);
for (const initialChapter of ['', 'source-chapter']) {
  const held = deferred(); let starts = 0, token = 0;
  const ready = [], discarded = [];
  const sandbox = vm.createContext({
    WeakMap, JSON, clear() {},
    fetchChapterList: async () => [{ id: 'navigation-chapter', chapterNumber: '1' }],
    fetchChapter: () => held.promise,
    resolveReaderNavigationChapterID: reader => reader.chapterID === 'source-chapter' ? 'navigation-chapter' : reader.chapterID,
    readerNavigationSections: () => [], sectionDisplayTitle: () => '',
    document: { createElement: () => ({ dataset: {} }) },
    beginReaderNavigation: panel => panel.dataset.readerNavigationToken = String(++token),
    applyCodeTheme() {}, renderReaderTrust() {}, populateCodeSelect() {}, resetEnhancedSelects() {},
    renderSectionContent: async () => {}, setTitle() {}, preparePaneCollapse() {}, enhanceSelect() {},
  });
  vm.runInContext(`const readerResolvedWorkspaceIdentities=new WeakMap();\n${actual('workspaceReaderContentIdentity')}\n${actual('setResolvedReaderChapter')}\n${actual('populateReaderSelectors')}\n${actual('refreshReaderContent')}\nglobalThis.identity=workspaceReaderContentIdentity; globalThis.refresh=refreshReaderContent;`, sandbox);
  const reader = { id: 'reader', codePrefix: 'BC', codeVersion: '2022', chapterID: initialChapter, sectionID: '' };
  const makePanel = () => ({ dataset: {}, querySelector: () => ({ append() {} }), querySelectorAll: () => [] });
  const descriptor = () => ({ id: 'reader', identity: sandbox.identity(reader), load: async () => {
    starts++; const panel = makePanel(); await sandbox.refresh(panel, reader); return panel;
  } });
  const h = createWorkspacePaneHydrator({ isContextCurrent: () => true, onReady: (_, p) => ready.push(p), onDiscard: (_, p) => discarded.push(p) });
  const identity = sandbox.identity(reader);
  h.reconcile([descriptor()], { key: 'account:workspace' }); await tick();
  assert.equal(reader.chapterID, 'navigation-chapter');
  assert.equal(sandbox.identity(reader), identity, 'internal chapter resolution preserves requested identity');
  h.reconcile([descriptor()], { key: 'account:workspace' }); await tick();
  assert.equal(starts, 1, 'access-unlock reconciliation does not restart pending Reader');
  held.resolve({ sections: [] }); await h.settled();
  assert.equal(ready.length, 1); assert.equal(discarded.length, 0);
  assert.equal(ready[0].dataset.workspacePaneIdentity, sandbox.identity(reader));
  h.reconcile([descriptor()], { key: 'account:workspace' }); await h.settled();
  assert.equal(starts, 1, 'later reconciliation also preserves completed Reader');
  // Genuine user navigation changes the target, even on the same Reader object.
  reader.sectionID = 'section-2';
  assert.notEqual(sandbox.identity(reader), identity);
  h.reconcile([descriptor()], { key: 'account:workspace' }); await h.settled();
  assert.equal(starts, 2); assert.equal(ready.length, 2);
  reader.chapterID = 'other-chapter';
  h.reconcile([descriptor()], { key: 'account:workspace' }); await h.settled();
  assert.equal(starts, 3, 'explicit chapter navigation invalidates previous load');
  const otherObject = { ...reader, chapterID: 'navigation-chapter', sectionID: '' };
  assert.equal(sandbox.identity(otherObject), JSON.stringify([otherObject.id, otherObject.codePrefix, otherObject.codeVersion, otherObject.chapterID, otherObject.sectionID]), 'resolution aliases belong to the exact Reader object');
}
{
  const sandbox = vm.createContext({ WeakMap, JSON });
  vm.runInContext(`const readerResolvedWorkspaceIdentities=new WeakMap();\n${actual('workspaceReaderContentIdentity')}\n${actual('setResolvedReaderChapter')}\nglobalThis.identity=workspaceReaderContentIdentity; globalThis.resolve=setResolvedReaderChapter;`, sandbox);
  const reader = { id: 'pending', codePrefix: 'BC', codeVersion: '2022', chapterID: '', sectionID: '' };
  const old = deferred(), next = deferred(); let starts = 0; const ready = [], discarded = [];
  const h = createWorkspacePaneHydrator({ isContextCurrent: () => true, onReady: (_, p) => ready.push(p), onDiscard: (_, p) => discarded.push(p) });
  const descriptor = () => ({ id: reader.id, identity: sandbox.identity(reader), load: () => (++starts === 1 ? old.promise : next.promise) });
  h.reconcile([descriptor()], { key: 'same' }); await tick();
  sandbox.resolve(reader, 'resolved');
  reader.sectionID = 'explicit-new-target';
  h.reconcile([descriptor()], { key: 'same' }); await tick();
  assert.equal(starts, 2, 'explicit target change restarts even while normalized predecessor is pending');
  old.resolve('stale'); next.resolve('current'); await h.settled(); await tick();
  assert.deepEqual(ready, ['current']); assert.deepEqual(discarded, ['stale']);
}
console.log('Reader workspace normalization passed: real selector/refresh functions preserve pending and ready identity; explicit chapter and section navigation invalidate.');
