import assert from 'node:assert/strict';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence } from '../research-evidence-assembly.mjs';

const authority = { corpusID: 'fixture-current', codeVersion: 'fixture-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const source = (id, number, title, text, codePrefix = 'PC') => ({ ...authority, id, sectionID: id,
  codePrefix, sectionNumber: number, title, text, canonicalText: text,
  body: { blocks: [{ id: id + '-body', plainText: text }] } });
const question = 'What do we need to prevent scalding at the lavatory in the public restroom?';
const leading = source('family-leading', '971.1', 'Scalding prevention at public lavatory',
  '971.1 Scalding prevention at public lavatory. Prevent scalding at the lavatory in a public restroom by reviewing the specified fixture arrangement.');
const target = source('family-target', '975.6', 'Conditioned water for public hand washing',
  '975.6 Conditioned water for public hand washing. Conditioned water shall be delivered from lavatories in public toilet facilities through the approved device. Exception: Listed point of use equipment may use its stated alternative only after approval.');
const crowd = Array.from({ length: 120 }, (_, i) => source('cross-crowd-' + i, '98' + i + '.1',
  'Prevent scalding at the public restroom lavatory',
  'Prevent scalding at the public restroom lavatory. Toilet fixtures, water closets, lavatories, plumbing fixture arrangements and drainage systems retain the specified fixture layout in this unrelated mechanical equipment provision.', 'MC'));
const catalog = [...crowd, leading, target];
const index = await buildResearchPassageIndex(catalog, async section => section.body);
const weights = new Map(['prevent', 'scalding', 'lavatory', 'public', 'restroom'].map(term => [term, 1]));
const all = searchResearchPassages(index, question, { queryWeights: weights, limit: 200 });
const global = searchResearchPassages(index, question, { queryWeights: weights, limit: 100 });
assert(!global.some(hit => hit.sectionID === target.id), 'The ordinary global hundred genuinely loses the target.');
const family = searchResearchPassages(index, question, { queryWeights: weights, limit: 5, codePrefixes: new Set(['PC']) });
assert(family.some(hit => hit.sectionID === target.id), 'Family filtering happens before the cap.');
assert(family.every(hit => hit.codePrefix === 'PC'));
for (const hit of family) {
  assert.equal(hit.score, all.find(item => item.sectionID === hit.sectionID).score,
    'The family probe preserves global BM25 statistics instead of changing source scores.');
}
assert.deepEqual(searchResearchPassages(index, question, { codePrefixes: [] }), []);
assert.deepEqual(searchResearchPassages(index, question, { codePrefixes: ['UNKNOWN'] }), []);
const before = JSON.stringify(index.passages);
const hit = id => index.passages.find(passage => passage.sectionID === id);
const semantic = crowd.slice(0, 100).map((section, rank) => ({ ...hit(section.id),
  score: 1 - rank / 1000, passages: [hit(section.id)] }));
const discover = async (q = question, limit = 12) => discoverRelevantEvidence({ question: q,
  retrievalContext: { currentQuestion: q, sourceQuery: q }, catalog, passageIndex: index, invertedIndex: new Map(),
  readSectionBody: async section => section.body, limit,
  semanticSearch: { search: async () => ({ hits: semantic, metadata: { enabled: true } }) } });
const discovery = await discover();
const recalled = discovery.candidates.find(candidate => candidate.sectionID === target.id);
assert(recalled?.signals.currentQuestionForeground, 'A complete family scope outside the mixed shortlist is actually nominated.');
assert(recalled.rank <= 5);
assert(!recalled.signals.currentQuestionLexicalReservation, 'The original strong-reservation threshold remains distinct.');
assert.equal(discovery.candidates.length, 12);
assert(discovery.candidates[0].sectionID.startsWith('cross-crowd-'), 'Cross-code semantic lead remains available.');
assert(discovery.candidates.filter(candidate => candidate.signals.currentQuestionForeground).length <= 3);
const packet = await assembleResearchEvidence({ question, discover: async () => discovery,
  resolveSection: async request => catalog.find(section => section.id === request.sectionID) || null,
  limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 } });
const delivered = packet.sources.find(item => item.sectionID === target.id);
assert(delivered?.canonicalContextComplete);
assert.equal(delivered.text, target.text, 'Full operative scope and exception reach the writer under the existing cap.');
assert(packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 6000);
assert.equal(JSON.stringify(index.passages), before, 'Recall cannot alter index/source authority.');
const direct = await discover('Under MC 980.1 and MC 981.1, what applies to the lavatory?', 2);
assert.deepEqual(direct.candidates.map(candidate => candidate.sectionNumber), ['980.1', '981.1']);
assert(!direct.candidates.some(candidate => candidate.signals.currentQuestionForeground));
const switched = await discover('Under the Mechanical Code, how do we prevent scalding at the public restroom lavatory?');
assert(!switched.candidates.find(candidate => candidate.sectionID === target.id)?.signals.currentQuestionForeground);
console.log('Current family recall passed: pre-cap family eligibility, global score integrity, true mixed-corpus crowding, full writer text, fixed limits and direct/topic/authority guards.');
