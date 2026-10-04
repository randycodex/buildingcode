import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { researchImmediateChildDetailGain } from '../research-rule-groups.mjs';

process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = '1';
let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('Child-detail contracts forbid providers.'); };
const authority = { codePrefix: 'FC', corpusID: 'unrelated-child-detail', codeVersion: 'fixture-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, sectionNumber, title, text, changed = {}) => ({ ...authority, id, sectionID: id,
  sectionNumber, title, text, canonicalText: text, body: { blocks: [{ id: id + '-body', plainText: text }] }, ...changed });
const parent = section('gate-parent', '915.2', 'Gate controls',
  'Remote shutdown alarms at gate controls shall retain their approved arrangement.');
const location = section('gate-location', '915.2.1', 'Locations',
  'Remote shutdown alarms at gate controls shall be located at the stated remote gate control location.');
const detail = section('gate-test', '915.2.7', 'Testing',
  'A test of the remote shutdown alarm at the gate control shall follow the approved procedure. Exception: The independently qualified alternate procedure retains every stated condition.');
const noise = Array.from({ length: 68 }, (_, i) => section('other-control-' + i, (920 + i) + '.1', 'Controls',
  'Test the remote shutdown alarm at the gate control. Retain the stated remote shutdown alarm test.'));
noise[50] = section('unrelated-check', '998.1', 'Check', 'Test the remote shutdown alarm at the gate control.');
const catalog = [parent, location, ...noise, detail];
const index = await buildResearchPassageIndex(catalog, async value => value.body);
const passage = value => ({ ...index.passages.find(item => item.sectionID === value.id), jurisdiction: value.jurisdiction });
const question = 'Is a test required for the remote shutdown alarm at a gate control?';
const discover = (changes = {}) => discoverRelevantEvidence({ question,
  retrievalContext: { currentQuestion: question, sourceQuery: 'remote shutdown alarms gate controls' },
  catalog, passageIndex: index, invertedIndex: new Map(), semanticSearch: null, readSectionBody: async value => value.body,
  availableCodePrefixes: ['FC'], limit: 3, ...changes });
assert.deepEqual(researchImmediateChildDetailGain(passage(parent), passage(detail), question), ['test']);
assert.equal(researchImmediateChildDetailGain(passage(parent), passage(location), question), null,
  'A broadly matching location child does not add the requested detail.');
const otherParent = section('meter-parent', '812.4', 'Flow meters', 'Flow meters shall follow the approved arrangement.', { codePrefix: 'PC' });
const otherChild = section('meter-child', '812.4.2', 'Records', 'The flow meter calibration record shall be retained.', { codePrefix: 'PC' });
const otherIndex = await buildResearchPassageIndex([otherParent, otherChild], async value => value.body);
const otherPassage = value => ({ ...otherIndex.passages.find(item => item.sectionID === value.id), jurisdiction: value.jurisdiction });
assert.deepEqual(researchImmediateChildDetailGain(otherPassage(otherParent), otherPassage(otherChild),
  'What flow meter calibration record must be retained?'), ['calibration', 'record', 'retained']);
for (const changed of [{ corpusID: 'foreign' }, { codeVersion: 'old' }, { codeEdition: '2014' }, { jurisdiction: 'Elsewhere' },
  { codePrefix: 'PC' }, { sectionNumber: '915.2.7.1', subsectionNumber: '915.2.7.1' },
  { sectionNumber: '915.3.7', subsectionNumber: '915.3.7' }, { scopeComplete: false },
  { sourceOffsets: { ...passage(detail).sourceOffsets, start: 1 } }])
  assert.equal(researchImmediateChildDetailGain(passage(parent), { ...passage(detail), ...changed }, question), null);
const discovery = await discover();
const recalled = discovery.candidates.find(value => value.sectionID === detail.id);
assert(recalled?.signals.currentDetailChildParent, 'A detail child outside the ordinary shortlist receives one existing source slot.');
assert.equal(recalled.signals.currentDetailChildParent.sectionID, parent.id);
assert.equal(discovery.candidates.filter(value => value.signals.currentDetailChildParent).length, 1);
assert.equal(discovery.candidates.length, 3);
assert(!discovery.candidates.find(value => value.sectionID === location.id)?.signals.currentDetailChildParent);
const restricted = await discover({ retrievalContext: { currentQuestion: question, sourceSelectionRestricted: true } });
assert(!restricted.candidates.some(value => value.signals.currentDetailChildParent), 'Selected evidence cannot nominate a fresh hierarchy child.');
assert(!restricted.candidates.some(value => value.sectionID === detail.id), 'The detail source was outside the original fixed shortlist.');
assert(!((await discover({ limit: 1 })).candidates.some(value => value.signals.currentDetailChildParent)),
  'Recall cannot add a second source to a one-slot shortlist.');
const explicitQuestion = 'For FC 915.2 and FC 920.1, is a test required for the remote shutdown alarm at a gate control?';
const explicit = await discover({ question: explicitQuestion, retrievalContext: { currentQuestion: explicitQuestion }, limit: 2 });
assert.equal(explicit.candidates.filter(value => value.signals.exactReference).length, 2);
assert(!explicit.candidates.some(value => value.signals.currentDetailChildParent), 'A recall child cannot displace either current explicit reference.');
const source = async ({ result = discovery, mutate = value => value, limits = {}, pins = [], strategy = null, q = question } = {}) => {
  const reads = [];
  const packet = await assembleResearchEvidence({ question: q, pinnedEvidence: pins, strategy,
    discover: async () => result, resolveSection: async request => {
      reads.push(request);
      const value = catalog.find(value => request.sectionID ? value.id === request.sectionID :
        value.codePrefix === request.codePrefix && value.sectionNumber === request.sectionNumber);
      return value ? mutate(value) : null;
    }, limits: { maximumCandidates: 3, maximumDiscovered: 3, maximumCharacters: 1800,
      maximumCharactersPerSource: 600, maximumCrossReferences: 0, maximumTargetedDefinitions: 0, ...limits } });
  return { packet, reads };
};
const accepted = await source();
const childSource = accepted.packet.sources.find(value => value.sectionID === detail.id);
const parentSource = accepted.packet.sources.find(value => value.sectionID === parent.id);
assert.equal(childSource?.text, detail.text);
assert(childSource.canonicalContextComplete && !childSource.truncated);
assert.match(childSource.relationship, /hierarchy is advisory context, not established applicability/);
assert.equal(childSource.currentDetailChildParent.sourceID, parentSource.sourceID);
assert.equal(childSource.currentDetailChildParent.childPassageSourceTextHash, createHash('sha256').update(detail.text).digest('hex'));
assert(parentSource.applicabilityScopeAnchors.some(value => value.sourceID === childSource.sourceID && value.basis === 'indexed_immediate_child_detail_gain'));
assert.equal(accepted.reads.filter(value => value.sectionID === detail.id).length, 1);
assert.equal(accepted.reads.filter(value => value.sectionID === parent.id).length, 1);
assert.equal(accepted.packet.usage.crossReferenceCount, 0);
assert(accepted.packet.usage.characterCount <= 1800 && accepted.packet.sources.length <= 3);
for (const changed of [{ id: 'wrong', sectionID: 'wrong' }, { sectionNumber: '915.2.8' }, { corpusID: 'foreign' },
  { codeVersion: 'old' }, { codeEdition: '2014' }, { jurisdiction: 'Elsewhere' }, { jurisdiction: '' },
  { codePrefix: 'PC' }, { truncated: true }, { textComplete: false }, { canonicalContextComplete: false },
  { referenceOnly: true }, { researchClaimEligible: false }, { authorityClass: 'guidance' },
  { text: detail.text + ' Changed.', canonicalText: detail.text + ' Changed.',
    body: { blocks: [{ id: detail.id + '-body', plainText: detail.text + ' Changed.' }] } }]) {
  const rejected = await source({ mutate: value => value.id === detail.id ? { ...value, ...changed } : value });
  assert(!rejected.packet.sources.some(value => value.sectionID === detail.id),
    'A recalled child requires independently fresh complete canonical identity and exact source hash.');
}
for (const which of [parent.id, detail.id]) {
  assert(!(await source({ mutate: value => value.id === which ? null : value })).packet.sources.some(value =>
    value.sectionID === detail.id), 'Both parent and child must remain available.');
  assert(!(await source({ mutate: value => value.id === which ? { ...value, codeEdition: '2014' } : value })).packet.sources.some(value =>
    value.sectionID === detail.id), 'Neither source may transfer another edition.');
}
for (const changed of [{ corpusID: 'foreign' }, { jurisdiction: '' }, { referenceOnly: true }, { truncated: true },
  { text: parent.text + ' Changed.', canonicalText: parent.text + ' Changed.',
    body: { blocks: [{ id: parent.id + '-body', plainText: parent.text + ' Changed.' }] } }]) {
  assert(!(await source({ mutate: value => value.id === parent.id ? { ...value, ...changed } : value })).packet.sources.some(value =>
    value.sectionID === detail.id), 'The parent passage and fresh authority cannot be manufactured from request metadata.');
}
assert(!(await source({ q: 'What arrangement is required for the remote shutdown alarm at a gate control?' })).packet.sources.some(value =>
  value.sectionID === detail.id), 'A changed current question must still have detail gain; a stale nomination is insufficient.');
for (const change of [
  value => ({ ...value, indexedPassage: { ...value.indexedPassage, sourceTextHash: '0'.repeat(64) } }),
  value => ({ ...value, signals: { ...value.signals, currentDetailChildParent: {
    ...value.signals.currentDetailChildParent, sourceTextHash: '0'.repeat(64) } } }),
  value => ({ ...value, signals: { ...value.signals, useSelectedPassageOnly: true } })
]) {
  const result = { ...discovery, candidates: discovery.candidates.map(value => value.sectionID === detail.id ? change(value) : value) };
  assert(!(await source({ result })).packet.sources.some(value => value.sectionID === detail.id));
}
const small = await source({ limits: { maximumCharacters: 150, maximumCharactersPerSource: 100 } });
assert(!small.packet.sources.some(value => value.sectionID === detail.id));
assert(small.packet.usage.characterCount <= 150);
const strict = await source({ pins: [{ ...parent, selectedText: parent.text, userSelectedText: parent.text }],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } });
assert.equal(strict.packet.sources.length, 1);
assert.equal(strict.packet.sources[0].text, parent.text);
assert.equal(providerCalls, 0);
console.log('Immediate-child detail gain passed: unrelated current-detail recall, exact discovery-to-fresh-source binding, advisory hierarchy, atomic limits and selected/authority boundaries; no providers or semantic accuracy claim.');
