import assert from 'node:assert/strict';
import {rankReaderSearchResults, searchReaderTextSections} from '../public/reader-search-match.js';

const section = (id, number, title, text) => ({id, sectionNumber:number, title,
  displayTitle:`${number} ${title}`, blocks:[{blockID:`${id}-body`, text}]});
const sections = [
  section('reference', '1004.1.1.2.3', 'Accessory spaces', 'The total width required by Section 1005.3.'),
  section('list', '5.4', 'Additional exit', 'The width required by Section 1005.3.'),
  section('target', '1005.3', 'Required capacity', 'Capacity in accordance with 1005.3.1 and 1005.3.2.'),
  section('child', '1005.3.1', 'Stairways', 'Stairway capacity is based on the occupant load.')
];
for (const query of ['1005.3', '§ 1005.3', 'Section 1005.3', '1005.3.']) {
  const result = searchReaderTextSections(sections, query);
  assert.equal(result[0].sectionID, 'target', query);
  assert.equal(result[0].blockID, '', 'An exact provision opens at its heading, not at a body cross-reference.');
}
const matches = searchReaderTextSections(sections, '1005.3');
assert.deepEqual(matches.map(item=>item.sectionID), ['target', 'reference', 'list', 'child']);
assert.equal(matches[1].blockID, 'reference-body', 'Citing paragraphs retain their precise match targets.');
assert.equal(searchReaderTextSections(sections, '1005.3.1')[0].sectionID, 'child');
assert.equal(searchReaderTextSections(sections, 'occupant load')[0].sectionID, 'child');
const zoning = [section('zoning-ref', '12-10', 'Definitions', 'See Section 23-22.'), section('zoning', '23-22', 'Floor area', 'Maximum floor area ratios.')];
assert.equal(searchReaderTextSections(zoning, '23-22')[0].sectionID, 'zoning');
const codeResults = [
  {...matches[1], chapterID:'current', corpusRevision:'a'.repeat(64)},
  {...matches[0], chapterID:'other', corpusRevision:'b'.repeat(64)},
  {...matches[2], chapterID:'current', corpusRevision:'a'.repeat(64)}
];
const before = structuredClone(codeResults);
assert.deepEqual(rankReaderSearchResults(codeResults, '1005.3').map(item=>item.sectionID), ['target', 'reference', 'list']);
assert.equal(rankReaderSearchResults(codeResults, '1005.3')[0].corpusRevision, 'b'.repeat(64));
assert.deepEqual(codeResults, before, 'Ranking cannot mutate source identity or the supplied result list.');
assert.equal(rankReaderSearchResults(codeResults, '0.3 inch'), codeResults, 'A measurement phrase keeps ordinary matching order.');
console.log('Reader exact-section ranking passed: own heading before citations, subprovisions, zoning, cross-chapter identity and ordinary text.');
