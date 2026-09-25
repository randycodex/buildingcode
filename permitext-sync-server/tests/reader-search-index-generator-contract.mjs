import assert from 'node:assert/strict';
import { projectChapter } from '../scripts/generate-reader-search-index.mjs';
import { createReaderSearchProjection } from '../scripts/reader-search-projection.mjs';
import { searchReaderTextSections } from '../public/reader-search-match.js';
const identity = { id: 'fixture', codeVersion: 'edition#1', codePrefix: 'BC', corpusRevision: 'a'.repeat(64), bodyContract: 2 };
const sections = Array.from({ length: 53 }, (_, id) => ({ id, sectionNumber: String(id), title: `Title ${id}` }));
const projector = { projectionRevision: 'b'.repeat(64), displayTitle: section => `${section.sectionNumber} ${section.title}`,
  projectSection: section => [{ blockID: section.blocks[0].id, text: section.blocks[0].plainText }] };
function fixture(mutate = () => {}) {
  const requests = [];
  return { requests, get: async path => {
    requests.push(path);
    const params = new URL(path, 'http://fixture').searchParams;
    if (!params.has('include')) return { chapter: { ...identity, sections } };
    assert.equal(params.get('bodyLimit'), '50');
    const start = Number(params.get('bodyStart'));
    const end = Math.min(start + 50, sections.length);
    const chapter = { ...identity, bodyRange: { start, end, total: sections.length, complete: false },
      sections: sections.slice(start, end).map(section => ({ id: section.id, blocks: [{ id: `p${section.id}`, plainText: `Body ${section.id}` }] })) };
    mutate(chapter);
    return { chapter };
  } };
}
const valid = fixture();
const result = await projectChapter('fixture', valid.get, projector);
assert.equal(valid.requests.length, 3);
assert.equal(result.sections.length, 53);
assert.deepEqual(result.sections[52], { id: 52, sectionNumber: '52', title: 'Title 52', displayTitle: '52 Title 52', blocks: [{ blockID: 'p52', text: 'Body 52' }] });
for (const mutate of [value => { value.corpusRevision = 'c'.repeat(64); }, value => { value.sections.reverse(); },
  value => { value.sections.pop(); }, value => { value.codeVersion = 'wrong'; }, value => { value.bodyRange.total++; }]) {
  await assert.rejects(projectChapter('fixture', fixture(mutate).get, projector));
}
// Legacy chapter search receives raw section objects. A chapter-level ECC prefix
// must not be injected into a section: that splits its provisions and removes
// phrases spanning their boundary, while also changing annotation targets.
const specialtyMetadata = { id: 7, sectionNumber: '101', title: 'Scope' };
const specialtyIdentity = { ...identity, codePrefix: 'ECC' };
const specialtyBlock = { kind: 'html', id: 'source', html: '<p>Original source</p>',
  plainText: '101.1 General. First requirement.\n101.2 Scope. Second requirement.' };
const actualProjector = await createReaderSearchProjection();
const specialty = await projectChapter('fixture', async path => ({ chapter: path.includes('include=body')
  ? { ...specialtyIdentity, bodyRange: { start: 0, end: 1, total: 1, complete: true }, sections: [{ id: 7, blocks: [specialtyBlock] }] }
  : { ...specialtyIdentity, sections: [specialtyMetadata] }
}), actualProjector);
assert.deepEqual(specialty.sections[0].blocks, [{ blockID: 'source', text: '101.1 General. First requirement. 101.2 Scope. Second requirement.' }]);
const boundaryMatches = searchReaderTextSections(specialty.sections, 'requirement. 101.2');
assert.equal(boundaryMatches.length, 1);
assert.equal(boundaryMatches[0].blockID, 'source');
console.log('Reader search generator validates complete bounded windows, metadata, identity, revision, order, counts and raw specialty section semantics.');
