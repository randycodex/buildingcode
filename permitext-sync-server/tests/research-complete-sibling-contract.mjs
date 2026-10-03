import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence } from '../research-evidence-assembly.mjs';

process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = '1';
const authority = { codePrefix: 'FC', corpusID: 'synthetic-current', codeVersion: 'synthetic-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = { ...authority, id: 'gate-chapter', sectionID: 'gate-chapter', sectionNumber: '991', title: 'Gate access' };
const text = [
  '991.1 General.\nThese requirements apply only to occupied facilities. Exception: Approved alternatives are allowed.',
  '991.2 Access.\nMaintain access to the gate opening.',
  '991.2.1 Gate path.\nA clear access path must lead to the gate opening. Exception: The approved alternate path is allowed.',
  '991.2.2 Gate perimeter.\nA clear area must surround the gate opening, measured from its hinge. Exception: The qualified sheltered condition has its stated reduced perimeter.',
  '991.2.3 Other gates.\nOther access gate conditions apply to the specified location.',
  '991.2.4 Unrelated.\nOther access provisions have their stated limitations.',
  '991.3 Other subject.\n' + 'The unrelated remaining chapter has unrelated conditions. '.repeat(400)
].join('\n\n');
const body = { blocks: [{ id: 'gate-block', plainText: text }] };
const index = await buildResearchPassageIndex([section], async () => body);
const byNumber = number => index.passages.find(p => p.subsectionNumber === number);
const semantic = { search: async () => ({ hits: [{ ...byNumber('991.2.1'), score: 1,
  passages: ['991.2.1', '991.2.3', '991.2.4'].map(number => byNumber(number)) }], metadata: {} }) };
const question = 'What clear area must surround the gate opening, measured from the hinge?';
const discover = () => discoverRelevantEvidence({ question: `${question}\nPrevious topic: The access path to the gate opening.`,
  retrievalContext: { currentQuestion: question }, catalog: [section], invertedIndex: new Map(), passageIndex: index,
  semanticSearch: semantic, readSectionBody: async () => body, availableCodePrefixes: ['FC'], limit: 3 });
const discovery = await discover();
const candidate = discovery.candidates[0];
assert.equal(candidate.indexedPassage.subsectionNumber, '991.2.1');
assert.equal(candidate.indexedPassage.companion.subsectionNumber, '991.2.2', 'Current detail should preserve the lexical sibling lost by semantic replacement.');
assert.equal(new Set(candidate.indexedPassage.alternatives.map(p => p.id)).size, candidate.indexedPassage.alternatives.length);
assert(candidate.indexedPassage.alternatives.some(p => p.subsectionNumber === '991.2.2'));
const assemble = (value = candidate, allowance = 1200) => assembleResearchEvidence({ question, pinnedEvidence: [],
  discover: async () => ({ candidates: [value] }), resolveSection: async () => ({ ...section, body, text }),
  limits: { maximumCharacters: 2400, maximumCharactersPerSource: allowance, maximumDiscovered: 1 } });
const packet = await assemble();
const source = packet.sources[0];
assert.match(source.text, /clear access path/);
assert.match(source.text, /measured from its hinge/);
assert.match(source.text, /qualified sheltered condition/);
assert.match(source.text, /only to occupied facilities/);
assert.match(source.text, /Approved alternatives/);
assert.equal(source.indexedPassage.companions.length, 1);
assert.equal(source.truncated, false);
assert.equal(source.canonicalContextComplete, false);
assert(source.text.length <= 1200 && packet.usage.characterCount <= 2400);
const locator = source.indexedPassage.companions[0];
assert.equal(createHash('sha256').update(text).digest('hex'), locator.sourceTextHash);
assert.equal(text.slice(locator.sourceOffsets.start, locator.sourceOffsets.end), candidate.indexedPassage.companion.text);
const primaryOnly = await assemble({ ...candidate, indexedPassage: { ...candidate.indexedPassage, companion: null } });
const tooSmall = await assemble(candidate, primaryOnly.sources[0].text.length + 10);
assert.equal(tooSmall.sources[0].text, primaryOnly.sources[0].text, 'An oversized companion must be omitted whole; keep the complete primary.');
assert(!tooSmall.sources[0].indexedPassage.companions);
for (const mutate of [
  p => ({ ...p, sourceTextHash: '0'.repeat(64) }),
  p => ({ ...p, text: p.text.replace('hinge', 'threshold') }),
  p => ({ ...p, sourceOffsets: { ...p.sourceOffsets, start: p.sourceOffsets.start + 1 } }),
  p => ({ ...p, contextTexts: ['The exception is waived without conditions.'] }),
  p => ({ ...p, codeVersion: 'stale-v0' }),
  p => ({ ...p, codeEdition: '2014' }),
  p => ({ ...p, jurisdiction: 'Another City' }),
  p => ({ ...p, corpusID: 'unauthorized-library' }),
  p => ({ ...p, sectionID: 'another-canonical-section' }),
  p => ({ ...p, scopeComplete: false, completeSubsectionText: null }),
  p => ({ ...p, subsectionNumber: '991.3.2' })
]) {
  const rejected = await assemble({ ...candidate, indexedPassage: { ...candidate.indexedPassage,
    companion: mutate(candidate.indexedPassage.companion) } });
  assert.equal(rejected.sources[0].text, primaryOnly.sources[0].text, 'Stale, forged, incomplete or non-sibling companions cannot expand canonical scope.');
}
const selectedOnly = await assemble({ ...candidate, signals: { useSelectedPassageOnly: true }, selectedText: byNumber('991.2.1').text });
assert.equal(selectedOnly.sources[0].text, byNumber('991.2.1').text.trim());
assert.doesNotMatch(selectedOnly.sources[0].text, /qualified sheltered condition/);

// Split catalog: the neighbor remains a distinct canonical source. A distant
// meaning hit or another edition cannot take its bounded companion reservation.
const splitAuthority = { ...authority, codePrefix: 'FGC' };
const splitCatalog = [
  { id: 'concealment', sectionNumber: '992.7.1', title: 'Prohibited locations', text: 'Shutoff valves cannot be concealed.' },
  { id: 'unrelated-one', sectionNumber: '993.1.1', title: 'Movable equipment', text: 'Movable equipment has other conditions.' },
  { id: 'unrelated-two', sectionNumber: '993.1.2', title: 'Strike exposure', text: 'Equipment strike exposure has other conditions.' },
  { id: 'damage', sectionNumber: '992.7.2', title: 'Access to shutoff valves', text: 'Shutoff valves must be accessible for operation and protected from damage. Exception: The qualified shielded installation is permitted.' },
  { id: 'material', sectionNumber: '992.7.3', title: 'Equipment approval', text: 'Valve equipment materials must have the stated approval.' },
  { id: 'old-damage', sectionNumber: '992.7.4', title: 'Older valve damage', text: 'Shutoff valves have a prior-edition damage provision.', codeVersion: 'old-v0', corpusID: 'historical-library', codeEdition: '2014' }
].map((s, index) => ({ ...splitAuthority, ...s, key: s.id, id: 700 + index, sectionID: 700 + index }));
const bodies = new Map(splitCatalog.map(s => [s.id, { blocks: [{ id: s.id + '-block', plainText: `${s.sectionNumber} ${s.title}\n${s.text}` }] }]));
const splitIndex = await buildResearchPassageIndex(splitCatalog, async s => bodies.get(s.id));
const hit = key => splitIndex.passages.find(p => p.sectionID === String(splitCatalog.find(s => s.key === key).id));
const splitSemantic = { search: async () => ({ hits: ['concealment', 'unrelated-one', 'unrelated-two', 'old-damage', 'damage', 'material']
  .map((id, rank) => ({ ...hit(id), score: 1 - rank * .02, passages: [hit(id)] })), metadata: {} }) };
const splitQuestion = 'For FGC 992.7.1, what if moving equipment can strike a shutoff valve?';
const splitDiscovery = await discoverRelevantEvidence({ question: splitQuestion, catalog: splitCatalog, invertedIndex: new Map(),
  passageIndex: splitIndex, semanticSearch: splitSemantic, readSectionBody: async s => bodies.get(s.id),
  availableCodePrefixes: ['FGC'], limit: 2 });
assert.deepEqual(splitDiscovery.candidates.slice(0, 2).map(c => c.sectionID), ['700', '703']);
assert.equal(splitDiscovery.candidates[1].signals.completeSiblingCompanionOf, '700');
const splitPacket = await assembleResearchEvidence({ question: splitQuestion, pinnedEvidence: [],
  discover: async () => splitDiscovery, resolveSection: async request => {
    const s = splitCatalog.find(s => String(s.id) === String(request.sectionID));return { ...s, body: bodies.get(s.id), text: bodies.get(s.id).blocks[0].plainText };
  }, limits: { maximumDiscovered: 2, maximumCharacters: 2000, maximumCharactersPerSource: 500 } });
const damage = splitPacket.sources.find(s => s.sectionID === '703');
assert(damage, 'Sibling must survive assembly prioritization and the discovered-source limit.');
assert.match(damage.text, /protected from damage/);
assert.match(damage.text, /qualified shielded installation/);
assert.equal(damage.canonicalContextComplete, true);
assert(splitPacket.usage.characterCount <= 2000);
const oversizedSplitPacket = await assembleResearchEvidence({ question: splitQuestion, pinnedEvidence: [],
  discover: async () => splitDiscovery, resolveSection: async request => {
    const s = splitCatalog.find(s => String(s.id) === String(request.sectionID));
    const supplied = s.key === 'damage' ? { blocks: [{ id: s.id + '-block', plainText:
      s.text + ' Additional shield limitations apply. '.repeat(80) + ' Closing exception: The entire stated shield condition must be satisfied.' }] } : bodies.get(s.id);
    return { ...s, body: supplied, text: supplied.blocks[0].plainText };
  }, limits: { maximumDiscovered: 2, maximumCharacters: 2000, maximumCharactersPerSource: 500 } });
assert(!oversizedSplitPacket.sources.some(s => s.sectionID === '703'),
  'A separately cataloged companion whose whole canonical scope cannot fit must not be emitted as a clipped fragment.');
const referencesQuestion = splitQuestion + ' Also explain FGC 993.1.2.';
const referencesDiscovery = await discoverRelevantEvidence({ question: referencesQuestion, catalog: splitCatalog,
  invertedIndex: new Map(), passageIndex: splitIndex, semanticSearch: splitSemantic,
  readSectionBody: async s => bodies.get(s.id), availableCodePrefixes: ['FGC'], limit: 2 });
assert.deepEqual(new Set(referencesDiscovery.candidates.slice(0, 2).map(c => c.sectionID)), new Set(['700', '702']),
  'A companion reservation cannot displace explicitly requested current references.');
const oneReferenceSlot = await discoverRelevantEvidence({ question: referencesQuestion, catalog: splitCatalog,
  invertedIndex: new Map(), passageIndex: splitIndex, semanticSearch: splitSemantic,
  readSectionBody: async s => bodies.get(s.id), availableCodePrefixes: ['FGC'], limit: 1 });
assert(['700', '702'].includes(oneReferenceSlot.candidates[0].sectionID));
assert.equal(oneReferenceSlot.candidates[0].signals.exactReference, true,
  'With only one source slot, a current explicit reference still wins over the sibling reservation.');
const wrongJurisdictionSemantic = { search: async () => ({ hits: [
  { ...hit('concealment'), score: 1 },
  { ...hit('damage'), score: .99, jurisdiction: 'Another City' }
], metadata: {} }) };
const wrongJurisdiction = await discoverRelevantEvidence({ question: 'For FGC 992.7.1, can it be left where objects hit it?',
  catalog: splitCatalog, invertedIndex: new Map(), passageIndex: splitIndex,
  semanticSearch: wrongJurisdictionSemantic, readSectionBody: async s => bodies.get(s.id), availableCodePrefixes: ['FGC'], limit: 2 });
assert(!wrongJurisdiction.candidates.some(c => c.sectionID === '703' && c.signals.completeSiblingCompanionOf),
  'A provider hit from another jurisdiction cannot acquire the authorized sibling reservation.');
console.log('Complete sibling contracts passed: fused child recall, one atomic companion, split canonical reservation, current detail, strict selection, source/edition/hash/offset boundaries and unchanged budgets.');
