import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceComments, serializeEvidenceComments } from '../public/evidence-comments.js';
import { notebookReferenceBlocks, restoreNotebookPassageText } from '../public/notebook-passage-blocks.js';
import { defaultSyncCodeVersion as codeVersion } from '../public/sync-identity.js';

const directory = await mkdtemp(join(tmpdir(), 'permitext-note-comment-snapshot-'));
for (const key of Object.keys(process.env)) {
  if (/DATABASE_URL|POSTGRES_URL|STORAGE_URL|OPENAI|CLERK|BLOB_|VERCEL_|RESEND|STRIPE|APPLE_.*(SECRET|KEY)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '',
  PERMITEXT_SYNC_DATA_PATH: join(directory, 'sync.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, 'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: 'synthetic-comment-snapshot-grant'
});
const originalFetch = globalThis.fetch;
let server, base;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, 'Snapshot verification must never contact external services.');
  return originalFetch(input, options);
};
try {
  const { handleRequest, allSectionCatalogByID } = await import('../app.mjs');
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const userID = 'apple:synthetic-comment-snapshot', projectID = 'comment-snapshot-project';
  let token;
  async function post(path, body, expected = 200, bearer = token) {
    const response = await fetch(`${base}${path}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify({ auth: { accountUserID: userID }, ...body }) });
    const json = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }
  const push = mutations => post('/sync/push', { batch: { user: { id: userID }, mutations } });
  await post('/admin/lifetime-grants/grant', { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post('/account/sign-in', { credential: { provider: 'apple', providerUserID: 'synthetic-comment-snapshot',
    email: 'snapshot@example.test', displayName: 'Synthetic snapshot test' } })).account.backendSessionToken;
  const section = [...(await allSectionCatalogByID()).values()].find(item => item.codePrefix === 'BC' &&
    (item.codeVersion || codeVersion) === codeVersion && String(item.sectionNumber) === '101.2');
  assert.ok(section);
  const target = { userID, codeVersion, sectionID: String(section.id), blockID: '' };
  let revision = 0;
  const timestamp = () => new Date(Date.UTC(2026, 9, 21, 12, 0, revision++)).toISOString();
  await push([
    { project: { id: 'project-record', userID, codeVersion, clientID: projectID, name: 'Comment snapshots',
      colorHex: '#334455', sortOrder: 0, updatedAt: timestamp() } },
    { projectSection: { ...target, id: 'saved-passage', folderClientID: projectID, scope: 'section', updatedAt: timestamp() } }
  ]);
  let annotation = { ...target, id: 'source-comments' };
  async function changeSource(comments) {
    const noteBody = serializeEvidenceComments(comments);
    await push([{ annotation: { ...annotation, noteBody, updatedAt: timestamp(), deletedAt: noteBody ? null : timestamp() } }]);
    const synced = await post('/sync/pull', {});
    annotation = synced.mutations.map(mutation => mutation.annotation).find(item => item &&
      item.codeVersion === codeVersion && String(item.sectionID) === target.sectionID && !item.blockID);
    assert.ok(annotation, 'Source changes must actually reach durable sync state.');
    assert.deepEqual(evidenceComments(annotation.deletedAt ? '' : annotation.noteBody), comments);
    const palette = await post('/reports/sources/list', { projectID });
    const evidence = palette.sources.find(item => item.kind === 'evidence' && item.sectionID === target.sectionID);
    assert.ok(evidence);
    assert.deepEqual(evidence.notes.flatMap(note => evidenceComments(note.body)), comments,
      'Live Report evidence comments must change while copied Note comments remain fixed.');
  }
  const original = ['Original copied comment A.', 'Original copied comment B.'];
  await changeSource(original);
  const reference = { referenceKind: 'selectedPassage', referenceID: 'captured-passage', label: 'BC 2022 101.2' };
  const link = { id: reference.referenceID, label: reference.label, relationshipRole: 'context', projectID, noteTextVersion: 1,
    source: { codeVersion, codeEdition: '2022', sectionID: target.sectionID, sectionNumber: '101.2',
      sectionTitle: section.title, codePrefix: 'BC' }, passages: [{ exact: 'Captured passage text.' }], createdAt: timestamp() };
  const document = { schema: 'permitext-notebook-card', schemaVersion: 2, format: 'blocknote-json',
    document: notebookReferenceBlocks(reference, link.passages, evidenceComments(annotation.noteBody)) };
  const { card: copied } = await post('/notebook/cards/save', { projectID, expectedVersion: 0, cardType: 'finding',
    title: 'Independent copied comments', document, evidenceLinks: [link] }, 201);
  let expectedCard = copied;
  async function assertNoteUnchanged(stage) {
    const { card } = await post('/notebook/cards/get', { projectID, cardID: copied.id });
    assert.deepEqual(card.document, expectedCard.document, `${stage}: persisted Note prose stays unchanged.`);
    assert.deepEqual(card.evidenceLinks, expectedCard.evidenceLinks, `${stage}: captured links stay unchanged.`);
    assert.equal(card.version, expectedCard.version, `${stage}: source changes must not save a Note revision.`);
    assert.equal(restoreNotebookPassageText(card.document, card.evidenceLinks).changed, false,
      `${stage}: reopening the Note must not regenerate copied comments.`);
    const preview = await post('/reports/sources/preview', { projectID, kind: 'notebookCard', sourceID: copied.id });
    assert.match(JSON.stringify(preview.preview), /Original copied comment A/);
    assert.doesNotMatch(JSON.stringify(preview.preview), /Edited evidence comment A/);
  }
  const edited = ['Edited evidence comment A.', original[1]];
  for (const [stage, comments] of [['edit', edited], ['delete first', [original[1]]], ['delete last', []],
    ['undo last', [original[1]]], ['undo first', edited]]) {
    await changeSource(comments);
    await assertNoteUnchanged(stage);
  }
  // A Note author owns the copied text, including subsequent edits and removals.
  const authored = structuredClone(expectedCard.document);
  authored.document.at(-2).content[0].text = 'Comment 1: Original copied comment A. Edited in the Note.';
  authored.document.pop();
  expectedCard = (await post('/notebook/cards/save', { projectID, cardID: copied.id, expectedVersion: copied.version,
    cardType: copied.cardType, title: copied.title, document: authored, evidenceLinks: copied.evidenceLinks })).card;
  await changeSource([]);
  await assertNoteUnchanged('Note author edits followed by source deletion');
  await changeSource(edited);
  await assertNoteUnchanged('Note author edits followed by source Undo');
  console.log('Note comment snapshots HTTP passed: source edit, first/final delete, repeated Undo, durable reload, independent Note edits and live Report evidence changes.');
} finally {
  globalThis.fetch = originalFetch;
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
