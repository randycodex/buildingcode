import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('async function chooseResearchNoteDestination('),
  source.indexOf('\nfunction renderResearchNotebookHandoff('));
const project = { id: 'project' };
const reference = { referenceKind: 'researchAnswer', referenceID: 'answer', label: 'Research: exact saved answer' };
const cards = [{ id: 'current', title: 'Corridor analysis' }, { id: 'other', title: 'Occupant load' },
  { id: 'archived', title: 'Archived', archivedAt: '2026-10-24' }];
let choice = 'note:other', valid = true, target = { id: 'current', title: 'Corridor analysis', identity: 'current-v1' };
let choiceOptions, onChoice = () => {}, readOnly = false, requests = [], snapshots = [], inserted = [];
const original = { id: 'other', title: 'Occupant load', version: 4, cardType: 'finding', evidenceLinks: [],
  document: { schema: 'permitext-notebook-card', format: 'blocknote-json', schemaVersion: 2,
    document: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original analysis.' }] }] } };
const mount = { insertionTarget: () => target, insertLinkedReference: async (...values) => inserted.push(values) };
const c = vm.createContext({ structuredClone, navigator: { onLine: true }, researchProjectID: p => p.id,
  readableProjectName: () => 'Project', notebookMounts: new Map([['project', mount]]), notebookColumnMounts: new Map(),
  captureAccountRequest: () => ({ userID: 'owner' }), requireCurrentAccountRequest: () => assert(valid),
  loadInitialNotebookCardList: async () => ({ cards, access: { readOnly } }),
  loadNotebookProjectSnapshot: async () => ({ cards }),
  openWebWarning: async options => { choiceOptions = options; onChoice(); return choice; },
  postResearch: async (path, payload) => {
    requests.push({ path, payload });
    if (path.endsWith('/get')) return { card: structuredClone(original) };
    assert.equal(payload.expectedVersion, 4);
    assert.equal(payload.clientMutationID, 'stable-insertion');
    assert.equal(payload.id, 'other');
    assert.equal(payload.cardID, 'other', 'The save route requires cardID to update instead of attempting a new card.');
    return { card: { ...payload, version: 5 } };
  }, saveNotebookCardSnapshot: async (...values) => snapshots.push(values) });
vm.runInContext(helpers, c);

const selected = await c.chooseResearchNoteDestination(project, {}, () => valid);
assert.equal(selected.kind, 'saved'); assert.equal(selected.card.id, 'other');
assert(choiceOptions.choices.some(item => item.value === 'current' && item.label.includes('Corridor analysis')));
assert(choiceOptions.choices.some(item => item.value === 'new'));
assert(!choiceOptions.choices.some(item => item.value === 'note:archived'));
assert.equal(requests.length, 0, 'Choosing a destination does not write anything.');
const updated = await c.appendResearchReferenceToNote(project, selected, reference, 'stable-insertion', {}, () => valid);
assert.equal(updated.title, 'Occupant load');
assert.equal(updated.document.document[0].content[0].text, 'Original analysis.');
assert.equal(updated.document.document.at(-1).content[0].props.referenceID, 'answer');
assert.equal(original.document.document.length, 1, 'The source document is not mutated in place.');
assert.equal(snapshots.length, 1);

requests = []; choice = null;
assert.equal(await c.chooseResearchNoteDestination(project, {}, () => valid), null);
assert.equal(requests.length, 0);
choice = 'current';
const open = await c.chooseResearchNoteDestination(project, {}, () => valid);
await c.appendResearchReferenceToNote(project, open, reference, 'stable-insertion', {}, () => valid);
assert.equal(inserted.length, 1); assert.equal(inserted[0][0], 'current'); assert.equal(requests.length, 0);
onChoice = () => { target = { ...target, identity: 'changed-note' }; };
await assert.rejects(c.chooseResearchNoteDestination(project, {}, () => valid), /destination Note changed/);
onChoice = () => {}; choice = 'new';
assert.equal((await c.chooseResearchNoteDestination(project, {}, () => valid)).kind, 'new');
readOnly = true;
await assert.rejects(c.chooseResearchNoteDestination(project, {}, () => valid), /read-only/);
readOnly = false; onChoice = () => { valid = false; };
assert.equal(await c.chooseResearchNoteDestination(project, {}, () => valid), null);
assert.equal(requests.length, 0, 'Cancelled or stale selection cannot mutate a Note.');

valid = true; onChoice = () => {}; choice = 'current'; c.navigator.onLine = false;
assert.equal((await c.chooseResearchNoteDestination(project, {}, () => valid)).kind, 'open',
  'Offline researchers can still choose the open Note using cached metadata.');
await assert.rejects(c.appendResearchReferenceToNote(project, selected, reference, 'stable-insertion', {}, () => valid), /Reconnect/);
console.log('Research Note destinations passed: named choices, current/new/other, cancellation, stale/readonly guards, CAS append, retained analysis and offline open Note.');
