import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function appendUniqueReportSources(');
const end = app.indexOf('\nfunction reportSourceClassificationLabel(', start);
const note = { id: 'note-a', title: 'Note', plainText: 'Analysis', references: [] };
const source = { id: 'note-a', kind: 'notebookCard', label: 'Note', sourceClassification: 'user-authored' };
const evidence = { id: 'passage-a', kind: 'evidence', sectionID: 'section-a', sourceLibraryVersion: '2022', selectionBlockID: 'paragraph-a', label: 'Passage' };
const project = { id: 'project-a', name: 'Project A' };
const draft = { id: 'report-a', title: 'Report A', version: 2, introduction: 'Keep this', blocks: [{ id: 'text-a', kind: 'paragraph', text: 'Existing text' }] };
function fixture({ drafts = [draft], choice = '0', mount, gate } = {}) {
  let generation = 1;
  const calls = [], dialogs = [], saved = [];
  const c = vm.createContext({ structuredClone, crypto: { randomUUID }, Date,
    activeWorkspaceID: 'workspace-a', hasCapability: () => true,
    captureAccountRequest: () => generation,
    requireCurrentAccountRequest: value => { if (value !== generation) throw new Error('Account changed'); },
    accountContextChangedError: () => new Error('Workspace changed'),
    projectIdentity: value => value, projectDetailKey: value => value.id,
    syncCodeVersion: value => value,
    reportDraftMounts: new Map(mount ? [['project-a', mount]] : []), notebookMounts: new Map(),
    emptyProjectReportDraft: () => ({ id: '', title: 'New Report', version: 0, blocks: [] }),
    openWebWarning: async options => { dialogs.push(options); return choice; },
    postResearch: async (path, body) => {
      calls.push(path);
      if (path.endsWith('drafts/list')) { if (gate) await gate; return { drafts: structuredClone(drafts) }; }
      if (path.endsWith('sources/list')) return { sources: [source, evidence, { ...evidence, id: 'historical', sourceLibraryVersion: '2014' }] };
      if (path.endsWith('drafts/save')) { saved.push(structuredClone(body)); return { draft: { ...body, id: body.draftID || 'new-id', version: body.expectedVersion + 1 } }; }
      throw new Error(path);
    }
  });
  vm.runInContext(app.slice(start, end), c);
  return { c, calls, dialogs, saved, switchAccount: () => generation++, run: () => c.promoteNotebookCardToReport(project, note) };
}
const single = fixture();
assert.equal((await single.run()).title, 'Report A');
assert.equal(single.dialogs.length, 0);
assert.equal(single.saved[0].blocks[0].text, 'Existing text');
assert.equal(single.saved[0].blocks[1].sourceID, note.id);
assert.equal(single.saved[0].introduction, 'Keep this');
assert.equal(single.saved[0].expectedVersion, 2);
const multiple = fixture({ drafts: [draft, { ...draft, id: 'report-b', title: 'Report B', version: 5 }], choice: '1' });
await multiple.run();
assert.equal(multiple.dialogs.length, 1);
assert.equal(multiple.saved[0].draftID, 'report-b');
assert.equal(multiple.saved[0].expectedVersion, 5);
const cancelled = fixture({ drafts: [draft, { ...draft, id: 'report-b' }], choice: false });
assert.equal(await cancelled.run(), null);
assert.equal(cancelled.saved.length, 0);
const first = fixture({ drafts: [] });
assert.equal((await first.run()).id, 'new-id');
assert.equal(first.saved[0].expectedVersion, 0);
const duplicate = fixture({ drafts: [{ ...draft, blocks: [{ id: 'existing', kind: 'notebookCard', sourceID: note.id }] }] });
await duplicate.run();
assert.equal(duplicate.saved[0].blocks.length, 1);
const legacy = fixture({ drafts: [{ ...draft, blocks: [{ id: 'existing', derivedFrom: { kind: 'notebookCard', id: note.id } }] }] });
await legacy.run();
assert.equal(legacy.saved[0].blocks.length, 1);
assert.equal(legacy.saved[0].blocks[0].id, "existing");
assert.equal(legacy.saved[0].blocks[0].kind, "notebookCard");
assert.equal(legacy.saved[0].blocks[0].sourceID, note.id);
let mountedAdds = 0;
const mounted = fixture({ mount: { getDraftSnapshot: () => draft, hasUnsavedChanges: () => true,
  async addSources(id, sources) { assert.equal(id, draft.id); assert.equal(sources[0].id, note.id); mountedAdds++; return draft; } } });
await mounted.run();
assert.equal(mountedAdds, 1, 'Open drafts append through their editor to retain unsaved changes.');
assert.equal(mounted.saved.length, 0, 'Never overwrite a mounted draft with an older server snapshot.');
const batch = fixture();
await batch.c.addSavedEvidenceToReport(project, [
  { sectionID: 'section-a', codeVersion: '2022', blockID: 'paragraph-a' },
  { sectionID: 'section-a', codeVersion: '2014', blockID: 'paragraph-a' }
]);
assert.deepEqual(batch.saved[0].blocks.slice(1).map(block => block.sourceID), ['passage-a', 'historical']);
const unavailable = fixture();
await assert.rejects(unavailable.c.addSavedEvidenceToReport(project, [{ sectionID: 'section-a', codeVersion: '2022', blockID: 'different' }]), /not available/);
assert.equal(unavailable.saved.length, 0, 'Never expand an unavailable paragraph into its full section.');
let resolve;
const changed = fixture({ gate: new Promise(r => resolve = r) });
const pending = changed.run(); changed.switchAccount(); resolve();
await assert.rejects(pending, /Account changed/);
assert.equal(changed.saved.length, 0);
const palette = app.slice(app.indexOf('  function renderSourcePalette('), app.indexOf('  function renderHistory('));
assert(!palette.includes('appendSourceGroup("Saved evidence"'));
assert(!palette.includes('appendSourceGroup("Notebook notes"'));
assert(!app.slice(start, end).includes('openProjectReportDraft('), 'Adding must leave the source column in place.');
console.log('Report source handoff passed: destinations, cancellation, first draft, deduplication, mounted edits, exact passages and editions, account fence, no column navigation.');
