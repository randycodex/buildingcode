import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('    async function loadCard(cardID) {');
const end = source.indexOf('    mountState.focusCard = loadCard;', start);
assert.ok(start > 0 && end > start);
const implementation = source.slice(start, end);
const identityStart = source.indexOf('  const notebookCardIdentities = new WeakMap();');
const identityEnd = source.indexOf('  let cards = [];', identityStart);
assert.ok(identityStart > 0 && identityEnd > identityStart);
const identityImplementation = source.slice(identityStart, identityEnd);
const newStart = source.indexOf('    newButton.addEventListener("click", async () => {', end);
const newEnd = source.indexOf('\n\n    renderCardList();', newStart);
assert.ok(newStart > end && newEnd > newStart);
const newImplementation = source.slice(newStart, newEnd);
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness() {
  const gates = new Map(), counts = new Map(), calls = [], published = [], saved = [], scheduled = [], statuses = [];
  const drafts = new Map(), responses = [];
  const waitAt = async (stage, id, value) => {
    const base = `${stage}:${id}`, occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    const key = `${base}:${occurrence}`;
    calls.push(key);
    if (gates.has(key)) await gates.get(key).promise;
    return value;
  };
  const c = vm.createContext({
    notebookCardLoadGeneration: 0, activeWorkspaceID: 'workspace', disposed: false,
    notebookReadOnly: false,
    requestIdentity: 'owner', owner: 'owner', accountUserID: 'owner', projectID: 'project',
    activeCard: {id: 'original', title: 'Original', version: 1, document: {cardID: 'original', text: 'Original body'}},
    draftDocument: {cardID: 'original', text: 'Original body'}, dirty: false, saveConflict: false,
    notebookRevision: 0, persistedDraft: null, persistedCardID: 'original', persistedRevision: 0,
    cards: [], editorMount: {getEditingPosition: () => ({from: 1, to: 1})},
    notebookEditingPositions: new Map(), focus: {querySelector: () => ({scrollTop: 13})}, shell: {scrollTop: 21},
    captureNotebookReturnScroll() {},
    newButton: {addEventListener(name, listener) { assert.equal(name, 'click'); c.createNew = listener; }},
    emptyNotebookDocument: () => ({cardID: '', text: ''}),
    isCurrentAccountRequest: identity => identity === c.owner,
    requireCurrentAccountRequest: identity => { if (identity !== c.owner) throw new Error('Account changed'); },
    async notebookRequest(path, {cardID}) {
      assert.equal(path, '/notebook/cards/get');
      const occurrence = (counts.get(`network:${cardID}`) || 0) + 1;
      const card = {id: cardID, title: `Remote ${cardID} ${occurrence}`, version: occurrence,
        document: {cardID, text: `Body ${cardID} ${occurrence}`}, evidenceLinks: []};
      responses.push(card);
      return waitAt('network', cardID, {card});
    },
    saveNotebookCardSnapshot: (account, project, card) => waitAt('snapshot', card.id, undefined),
    loadNotebookDraft: (account, project, id) => waitAt('draft', id, drafts.get(id) || null),
    reconcileNotebookDocumentAssets: document => waitAt('assets', document.cardID, structuredClone(document)),
    notebookDocumentWithCurrentCardLabels: document => ({document, changed: false}),
    privateCacheFallbackAllowed: () => false,
    loadNotebookProjectSnapshot: async () => null,
    showNotebookRecoveryConflict: () => false,
    showDraftStatus(message) { statuses.push(message); },
    renderCardList() {},
    async renderFocusedCard() { published.push(plain({card: c.activeCard, document: c.draftDocument})); },
    scheduleNotebookAutosave() { scheduled.push(c.activeCard.id); },
    async flushNotebookAutosave() {
      const card = c.activeCard, revision = c.notebookRevision;
      const snapshot = plain({card: c.activeCard, document: c.draftDocument});
      await waitAt('flush', c.activeCard.id, undefined);
      saved.push(snapshot);
      if (c.activeCard === card && c.notebookRevision === revision) c.dirty = false;
      c.onFlush?.(card);
      return true;
    },
    confirmWebWarning: async () => true
  });
  vm.runInContext(identityImplementation + implementation + '\nglobalThis.load = loadCard;', c);
  vm.runInContext(newImplementation, c);
  return {c, calls, drafts, responses, published, saved, scheduled, statuses,
    hold(stage, id, occurrence = 1) {
      let release;
      const promise = new Promise(resolve => { release = resolve; });
      gates.set(`${stage}:${id}:${occurrence}`, {promise});
      return release;
    },
    async reached(stage, id, occurrence = 1) {
      for (let n = 0; n < 20; n++) {
        if (calls.includes(`${stage}:${id}:${occurrence}`)) return;
        await tick();
      }
      assert.fail(`Did not reach ${stage}:${id}:${occurrence}; observed ${calls.join(', ')}`);
    }
  };
}

{
  const h = harness(), releaseA = h.hold('network', 'A'), releaseB = h.hold('network', 'B');
  const a = h.c.load('A'); await h.reached('network', 'A');
  const b = h.c.load('B'); await h.reached('network', 'B');
  releaseB(); await b; releaseA(); await a;
  assert.equal(h.c.activeCard.id, 'B', 'A late A response cannot replace the later B selection');
  assert.deepEqual(h.published.map(item => item.card.id), ['B']);
}
{
  const h = harness(), releaseA1 = h.hold('network', 'A'), releaseB = h.hold('network', 'B'), releaseA2 = h.hold('network', 'A', 2);
  const a1 = h.c.load('A'); await h.reached('network', 'A');
  const b = h.c.load('B'); await h.reached('network', 'B');
  const a2 = h.c.load('A'); await h.reached('network', 'A', 2);
  releaseA2(); await a2; releaseB(); await b; releaseA1(); await a1;
  assert.equal(h.c.activeCard.title, 'Remote A 2', 'A-B-A retains the newest A request, not the older matching ID');
  assert.equal(h.published.length, 1);
}
for (const stage of ['snapshot', 'draft', 'assets']) {
  const h = harness(), release = h.hold(stage, 'A');
  h.drafts.set('A', {cardID: 'A', baseVersion: 8, title: 'Private draft A',
    document: {cardID: 'A', text: 'Private body A'}, evidenceLinks: [{id: 'evidence-A'}]});
  const a = h.c.load('A'); await h.reached(stage, 'A');
  assert.equal(h.c.activeCard.id, 'original', `A staged at ${stage} cannot replace the visible note before it is ready`);
  await h.c.load('B'); release(); await a;
  assert.equal(h.c.activeCard.id, 'B');
  assert.equal(h.c.activeCard.title, 'Remote B 1', `A draft suspended at ${stage} cannot edit B's title`);
  assert.equal(h.c.draftDocument.text, 'Body B 1');
  assert.equal(h.c.persistedCardID, 'B');
  assert.deepEqual(plain(h.c.activeCard.evidenceLinks), []);
  assert.deepEqual(h.published.map(item => item.card.id), ['B']);
  assert.equal(h.responses[0].title, 'Remote A 1', 'Local draft reconciliation must not mutate the fetched response object');
}
for (const stage of ['network', 'snapshot', 'draft', 'assets']) {
  for (const invalidation of ['account', 'workspace', 'dispose']) {
    const h = harness(), release = h.hold(stage, 'A');
    const pending = h.c.load('A'); await h.reached(stage, 'A');
    if (invalidation === 'account') h.c.owner = 'other';
    if (invalidation === 'workspace') h.c.activeWorkspaceID = 'other';
    if (invalidation === 'dispose') h.c.disposed = true;
    release(); await pending;
    assert.equal(h.c.activeCard.id, 'original', `${invalidation} during ${stage} prevents publication`);
    assert.equal(h.c.draftDocument.text, 'Original body');
    assert.equal(h.published.length, 0);
    assert.equal(h.scheduled.length, 0);
  }
}
{
  const h = harness(), release = h.hold('assets', 'A');
  const pending = h.c.load('A'); await h.reached('assets', 'A');
  h.c.activeCard.title = 'Typed while waiting';
  h.c.draftDocument.text = 'New body while waiting';
  h.c.dirty = true; h.c.notebookRevision++;
  release(); await pending;
  assert.equal(h.saved.length, 1, 'New edits made while the incoming note loads are retained before navigation');
  assert.equal(h.saved[0].card.id, 'original');
  assert.equal(h.saved[0].document.text, 'New body while waiting');
  assert.equal(h.c.activeCard.id, 'A');
}
{
  const h = harness(), release = h.hold('flush', 'original');
  h.c.dirty = true;
  const a = h.c.load('A'); await h.reached('flush', 'original');
  const b = h.c.load('B'); await b;
  release(); await a;
  assert.equal(h.c.activeCard.id, 'B', 'A navigation waiting on dirty-save completion cannot overtake B');
  assert.ok(!h.calls.includes('network:A:1'), 'An abandoned navigation does not fetch after its dirty save finishes');
}
{
  const h = harness(), releaseAssets = h.hold('assets', 'A'), releaseSave = h.hold('flush', 'original');
  const pending = h.c.load('A'); await h.reached('assets', 'A');
  h.c.draftDocument.text = 'First edit during loading'; h.c.dirty = true; h.c.notebookRevision++;
  releaseAssets(); await h.reached('flush', 'original');
  h.c.draftDocument.text = 'Newer edit during final save'; h.c.notebookRevision++;
  releaseSave(); await pending;
  assert.deepEqual(h.saved.map(item => item.document.text), ['First edit during loading', 'Newer edit during final save'],
    'Edits arriving during the final preservation await must also be retained before switching');
  assert.equal(h.c.activeCard.id, 'A');
}
{
  const h = harness(), releaseAssets = h.hold('assets', 'A'), releaseSave = h.hold('flush', 'original');
  const pending = h.c.load('A'); await h.reached('assets', 'A');
  h.c.draftDocument.text = 'Outgoing edited'; h.c.dirty = true; h.c.notebookRevision++;
  releaseAssets(); await h.reached('flush', 'original');
  h.c.activeCard = {id: '', title: 'New note', version: 0, document: {cardID: '', text: 'New note body'}};
  h.c.draftDocument = h.c.activeCard.document; h.c.dirty = true; h.c.notebookRevision++;
  releaseSave(); await pending;
  assert.equal(h.c.activeCard.title, 'New note', 'A different draft opened during final preservation cannot be adopted and replaced by an older load');
  assert.equal(h.c.draftDocument.text, 'New note body');
  assert.equal(h.published.length, 0);
}
console.log('Notebook selection passed: A-B and A-B-A latest-request ownership; snapshot/draft/assets staging; account/workspace/disposal fences; draft identity isolation; and edits retained during loading.');

for (const stage of ['draft', 'assets']) {
  const h = harness(), release = h.hold(stage, '');
  h.drafts.set('', {cardID: '', title: 'Recovered unsaved note', baseVersion: 0, document: {cardID: '', text: 'Recovered body'}});
  const pending = h.c.createNew(); await h.reached(stage, '');
  await h.c.load('B'); release(); await pending;
  assert.equal(h.c.activeCard.id, 'B', `A delayed New Note ${stage} cannot replace a later explicit selection`);
  assert.deepEqual(h.published.map(item => item.card.id), ['B']);
}
{
  const h = harness(), first = h.hold('draft', ''), second = h.hold('draft', '', 2);
  h.drafts.set('', {cardID: '', title: 'Older recovery', document: {cardID: '', text: 'Older'}});
  const a = h.c.createNew(); await h.reached('draft', '');
  h.drafts.set('', {cardID: '', title: 'Latest recovery', document: {cardID: '', text: 'Latest'}});
  const b = h.c.createNew(); await h.reached('draft', '', 2);
  second(); await b; first(); await a;
  assert.equal(h.c.activeCard.title, 'Latest recovery', 'Repeated New Note uses the latest request even though both have an empty ID');
  assert.equal(h.c.draftDocument.text, 'Latest');
  assert.equal(h.published.length, 1);
}
{
  const h = harness(), release = h.hold('network', 'A');
  const pending = h.c.load('A'); await h.reached('network', 'A');
  await h.c.createNew(); release(); await pending;
  assert.equal(h.c.activeCard.id, '', 'New Note invalidates an older existing-note load');
  assert.equal(h.c.activeCard.title, '');
}
for (const invalidation of ['account', 'workspace', 'dispose']) {
  const h = harness(), release = h.hold('draft', '');
  const pending = h.c.createNew(); await h.reached('draft', '');
  if (invalidation === 'account') h.c.owner = 'other';
  if (invalidation === 'workspace') h.c.activeWorkspaceID = 'other';
  if (invalidation === 'dispose') h.c.disposed = true;
  release(); await pending;
  assert.equal(h.c.activeCard.id, 'original', `${invalidation} also fences New Note preparation`);
  assert.equal(h.published.length, 0);
}
{
  const h = harness(), release = h.hold('draft', '');
  const pending = h.c.createNew(); await h.reached('draft', '');
  h.c.draftDocument.text = 'Typing while New Note loads'; h.c.dirty = true; h.c.notebookRevision++;
  release(); await pending;
  assert.equal(h.saved.at(-1)?.document.text, 'Typing while New Note loads', 'New Note preserves edits made during its own preparation');
  assert.equal(h.c.activeCard.id, '');
}
console.log('New Note races passed: New-to-existing, repeated New, existing-to-New, account/workspace/disposal fences and intervening edit preservation.');

for (const navigation of ['existing', 'new']) {
  const h = harness(), target = navigation === 'existing' ? 'A' : '', release = h.hold('draft', target);
  h.c.activeCard = {id: '', title: 'Unsaved original', version: 0, document: {cardID: '', text: 'Unsaved body'}};
  h.c.draftDocument = h.c.activeCard.document;
  h.c.onFlush = card => {
    if (h.c.activeCard === card) h.c.activeCard = h.c.retainNotebookCardIdentity(card, {...card, id: 'acknowledged-original', version: 1});
  };
  const pending = navigation === 'existing' ? h.c.load('A') : h.c.createNew();
  await h.reached('draft', target);
  h.c.draftDocument.text = 'New edit before first server save'; h.c.dirty = true; h.c.notebookRevision++;
  release(); await pending;
  assert.equal(h.saved.at(-1)?.document.text, 'New edit before first server save');
  assert.equal(h.c.activeCard.id, target, `${navigation} navigation survives acknowledgement assigning the outgoing draft its first server ID`);
}
console.log('New Note acknowledgement passed: first server ID assignment preserves outgoing edits and completes the requested navigation.');

{
  const h = harness(), release = h.hold('assets', 'original');
  const pending = h.c.load('original'); await h.reached('assets', 'original');
  h.c.activeCard.title = 'Latest visible title';
  h.c.draftDocument.text = 'Latest visible body'; h.c.dirty = true; h.c.notebookRevision++;
  release(); await pending;
  assert.equal(h.saved.at(-1)?.document.text, 'Latest visible body', 'Same-note refresh retains edits made while preparing the older response');
  assert.equal(h.c.activeCard.title, 'Latest visible title', 'Same-note refresh cannot revert the visible title after retaining it');
  assert.equal(h.c.draftDocument.text, 'Latest visible body', 'Same-note refresh cannot replace the visible editor with its older staged response');
  assert.equal(h.published.length, 0);
}
{
  const h = harness(), release = h.hold('assets', 'original');
  const pending = h.c.load('original'); await h.reached('assets', 'original');
  h.c.activeCard = h.c.retainNotebookCardIdentity(h.c.activeCard,
    {...h.c.activeCard, version: 3, title: 'Acknowledged title', document: {cardID: 'original', text: 'Acknowledged body'}});
  h.c.draftDocument = h.c.activeCard.document;
  release(); await pending;
  assert.equal(h.c.notebookRevision, 0, 'Server acknowledgement does not require a new editor revision');
  assert.equal(h.c.activeCard.version, 3, 'Same-note refresh cannot replace a newer acknowledged version');
  assert.equal(h.c.draftDocument.text, 'Acknowledged body');
  assert.equal(h.published.length, 0);
}
console.log('Same-note refresh passed: intervening edits remain visible and retained, and clean acknowledgement version advances cannot be rolled back.');

{
  const h = harness(), originalCard = h.c.activeCard, originalDocument = h.c.draftDocument;
  h.c.loadNotebookDraft = async () => { throw Error('IndexedDB unavailable'); };
  await h.c.createNew();
  assert.equal(h.c.activeCard, originalCard, 'Failed storage read preserves the current Note');
  assert.equal(h.c.draftDocument, originalDocument);
  assert.equal(h.published.length, 0); assert.equal(h.scheduled.length, 0);
  assert.ok(h.statuses.some(message => /could not|unavailable|retry/i.test(message)), 'Current storage failure is visible with recovery guidance');
}
for (const invalidation of ['account', 'workspace', 'dispose', 'selection']) {
  const h = harness(), originalLoad = h.c.loadNotebookDraft;
  let rejectDraft;
  h.c.loadNotebookDraft = (...args) => args[2] === '' ? new Promise((_resolve, reject) => { rejectDraft = reject; }) : originalLoad(...args);
  const pending = h.c.createNew();
  for (let n = 0; n < 20 && !rejectDraft; n++) await tick();
  assert.ok(rejectDraft);
  if (invalidation === 'account') h.c.owner = 'other';
  if (invalidation === 'workspace') h.c.activeWorkspaceID = 'other';
  if (invalidation === 'dispose') h.c.disposed = true;
  if (invalidation === 'selection') await h.c.load('B');
  const before = h.statuses.length;
  rejectDraft(Error('IndexedDB unavailable')); await pending;
  assert.equal(h.statuses.length, before, `${invalidation} makes a late storage error silent`);
  assert.equal(h.c.activeCard.id, invalidation === 'selection' ? 'B' : 'original');
}
console.log('New Note storage recovery passed: current failures preserve the editor and show recovery guidance; stale failures stay silent.');
