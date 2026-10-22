import assert from 'node:assert/strict';
import { evidenceComments, serializeEvidenceComments, evidenceCommentBlocks } from '../public/evidence-comments.js';
import { notebookReferenceBlocks } from '../public/notebook-passage-blocks.js';
for (const values of [['Existing comment'], ['First', 'Second'], ['Text\n\n', '### Comment 2\nLiteral heading\n\\text', ''], ['## Passage comments\n\n### Comment 1\nLiteral']]) {
  assert.deepEqual(evidenceComments(serializeEvidenceComments(values)), values);
}
assert.deepEqual(evidenceComments('Legacy\nmultiline comment'), ['Legacy\nmultiline comment']);
assert.deepEqual(evidenceComments(''), []);
assert.equal(serializeEvidenceComments(['', '  ']), '');
const reference = { referenceKind: 'selectedPassage', referenceID: 'exact-edition' };
const passages = [{ exact: 'Authoritative code text' }];
const without = notebookReferenceBlocks(reference, passages);
const withComments = notebookReferenceBlocks(reference, passages, ['My interpretation', 'Verify scope']);
assert.equal(without.length, 2);
assert.equal(withComments.length, 4);
assert.deepEqual(withComments.slice(0, 2), without, 'comments never become quoted legal source text');
assert.equal(withComments[2].content[0].text, 'Comment 1: My interpretation');
assert.equal(evidenceCommentBlocks(['', 'Present'])[0].content[0].text, 'Comment 1: Present');
console.log('Evidence comment round trips and optional Note transfer passed');

// A chapter's comment indicators share a single index, not a summary read for
// every rendered passage. A later batch observes fresh edits.
const { readFile } = await import('node:fs/promises');
const { default: vm } = await import('node:vm');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => { const start = app.indexOf(`function ${name}(`); return app.slice(start, app.indexOf('\n}', start) + 2); };
let reads = 0, scheduled;
const record = {sectionID:'section',codeVersion:'2022',blockID:'paragraph',noteBody:serializeEvidenceComments(['One','Two'])};
const runtime = vm.createContext({ evidenceComments,
  currentContentSummary: () => { reads++; return {annotations:[record]}; },
  consolidatedSavedAnnotations: records => records,
  visibleSyncedTargetKey: target => [target.codeVersion,target.sectionID,target.blockID].join(':'),
  queueMicrotask: callback => { scheduled=callback; }
});
vm.runInContext('let readerCommentIndex=null;\n'+actual('readerCommentCount'),runtime);
for(let i=0;i<500;i++) assert.equal(runtime.readerCommentCount(record),2);
assert.equal(reads,1);
assert.equal(runtime.readerCommentCount({...record,codeVersion:'2014'}),0);
record.noteBody=''; scheduled();
assert.equal(runtime.readerCommentCount(record),0);
assert.equal(reads,2);
console.log('Reader comment index: one read per batch, exact edition and fresh subsequent edits passed');
