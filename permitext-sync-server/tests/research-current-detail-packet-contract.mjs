import assert from 'node:assert/strict';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';

globalThis.fetch = () => { throw new Error('Provider calls forbidden in packet contracts'); };
const authority = { corpusID: 'synthetic-current', codeVersion: 'synthetic-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, codePrefix = 'PC', refs = []) => ({ ...authority, id, sectionID: id,
  sectionNumber: number, title, codePrefix, text, canonicalText: text, crossReferences: refs,
  body: { blocks: [{ id: id + '-body', plainText: text }] } });
const question = 'Does the booster need protection against suction vacuum, and what prevents the pump from running at low pressure?';
const dependency = section('cutoff', '991.4', 'Booster protection',
  '991.4 Booster protection. Stop the booster pump when the suction pressure reaches the stated cutoff to prevent a vacuum. Exception: A separately approved isolated circuit retains its stated alternative protection.');
const anchor = section('anchor', '991.1', 'Pressure supplementation',
  '991.1 Pressure supplementation. Install the booster pump in accordance with Section 991.4.', 'PC',
  [{ codePrefix: 'PC', sectionNumber: '991.4', sectionID: dependency.id }]);
const incidental = section('incidental', '994.1', 'General outlet design',
  '994.1 General outlet design. Retain the listed outlet arrangement. See Section 994.2.', 'PC',
  [{ codePrefix: 'PC', sectionNumber: '994.2', sectionID: 'incidental-reference' }]);
const incidentalReference = section('incidental-reference', '994.2', 'Outlet detail', '994.2 Outlet detail. Retain the outlet detail.');
const filler = section('filler', '995.1', 'Room layout', '995.1 Room layout. ' + 'The room layout retains its listed unrelated dimension. '.repeat(18));
const candidates = [incidental, anchor, filler].map((value, index) => ({ ...value, rank: index + 1, selectedText: value.text }));
const sections = [incidental, anchor, filler, dependency, incidentalReference];
async function assemble({ mutate = value => value, limits = {}, pins = [], strategy = null, supplied = candidates } = {}) {
  const reads = new Map();
  const result = await assembleResearchEvidence({ question, pinnedEvidence: pins, strategy,
    discover: async () => ({ candidates: supplied }),
    resolveSection: async request => {
      const value = sections.find(value => request.sectionID ? value.id === request.sectionID :
        value.codePrefix === request.codePrefix && value.sectionNumber === request.sectionNumber);
      if (value) reads.set(value.id, (reads.get(value.id) || 0) + 1);
      return value ? mutate(value) : null;
    }, limits: { maximumCharacters: 1500, maximumCharactersPerSource: 1200,
      maximumDiscovered: 3, maximumCrossReferences: 1, maximumTargetedDefinitions: 0, ...limits } });
  return { result, reads };
}
const delivered = await assemble();
const own = delivered.result.sources.find(source => source.sectionID === dependency.id);
assert(own, 'A complete current-detail dependency precedes unrelated reference expansion.');
assert.equal(own.text, dependency.text);
assert(own.canonicalContextComplete && !own.truncated);
assert.match(own.text, /separately approved isolated circuit/);
assert.equal(delivered.reads.get(dependency.id), 1, 'Reservation and expansion share one canonical read.');
assert.equal(delivered.result.usage.crossReferenceCount, 1);
assert(delivered.result.usage.characterCount <= 1500);
assert.equal(delivered.result.usage.characterCount, delivered.result.sources.reduce((sum, source) => sum + source.text.length, 0));
assert(delivered.result.sources.every(source => source.text.length <= 1200));
assert(!delivered.result.sources.some(source => source.sectionID === incidentalReference.id));

for (const field of ['corpusID', 'codeVersion', 'codeEdition', 'jurisdiction', 'codePrefix']) {
  const rejected = await assemble({ mutate: value => value.id === dependency.id ? { ...value, [field]: 'different-authority' } : value });
  assert(!rejected.result.sources.some(source => source.sectionID === dependency.id), field + ': incompatible dependency is not supplied');
  assert.equal(rejected.reads.get(dependency.id), 1, 'A rejected canonical identity is not retried in broad expansion.');
}
const small = await assemble({ limits: { maximumCharacters: 200, maximumCharactersPerSource: 150 } });
assert(small.result.usage.characterCount <= 200);
assert(!small.result.sources.some(source => source.sectionID === dependency.id), 'Insufficient room never supplies a dependency prefix.');
const selectedOnly = await assemble({ supplied: candidates.map(value => value.id === anchor.id ?
  { ...value, selectedText: 'Install the booster pump.', signals: { useSelectedPassageOnly: true } } : value) });
assert(!selectedOnly.result.sources.some(source => source.sectionID === dependency.id));
const strict = await assemble({ pins: [{ ...anchor, selectedText: 'Install the booster pump.', userSelectedText: 'Install the booster pump.' }],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } });
assert.equal(strict.result.sources.length, 1);
assert.equal(strict.result.sources[0].text, 'Install the booster pump.');

// A semantic lead from another branch cannot erase a literal sibling of a
// separately cataloged, current-relevant selected rule farther down the list.
const meaning = section('meaning', '996.1', 'Circulation', '996.1 Circulation. Retain the stated circulation arrangement.', 'MC');
const siblingAnchor = section('sleeve', '997.2.1', 'Sleeve cover', '997.2.1 Sleeve cover. Retain the duct sleeve cover at the concealed chamber.', 'MC');
const sibling = section('connection', '997.2.2', 'Chamber connections', '997.2.2 Chamber connections. Seal the duct sleeve connection into the concealed chamber. Exception: The listed isolated connection retains its specified seal.', 'MC');
const siblingSections = [meaning, siblingAnchor, sibling];
const siblingIndex = await buildResearchPassageIndex(siblingSections, async value => value.body);
const indexed = id => siblingIndex.passages.find(value => value.sectionID === id);
const siblingQuestion = 'How should the duct sleeve connection to the concealed chamber be sealed?';
const siblingDiscovery = await discoverRelevantEvidence({ question: siblingQuestion,
  retrievalContext: { sourceQuery: siblingQuestion, currentQuestion: siblingQuestion }, catalog: siblingSections,
  passageIndex: siblingIndex, invertedIndex: new Map(), readSectionBody: async value => value.body, limit: 3,
  semanticSearch: { search: async () => ({ hits: [meaning, siblingAnchor].map((value, rank) => ({
    ...indexed(value.id), score: 1 - rank * .01, passages: [indexed(value.id)] })), metadata: {} }) } });
assert.equal(siblingDiscovery.candidates.find(value => value.sectionID === sibling.id)?.signals.completeSiblingCompanionOf, siblingAnchor.id);
assert.equal(siblingDiscovery.candidates.filter(value => value.signals.completeSiblingCompanionOf).length, 1);

// Checked identities may survive a nonanswer within the same user subject.
// They never supply old facts, conclusions, numeric premises or rejected refs.
const rootQuestion = 'How much spacing is needed between these separated building wings?';
const followUp = 'The wings are revised again: where is the height measured above the podium roof, and what spacing applies?';
const active = section('spacing', '99-211', 'Spacing of wings', '99-211 Spacing of wings. Measure the height above the podium roof for the stated wing spacing. Exception: The separately specified election has its own complete conditions.', 'ZR');
const checked = { role: 'assistant', answer: { mode: 'openai', verification: { pass: true }, supportedPoints: [{}],
  citations: [{ ...active, supportingPassages: [{ selectedText: 'Old conclusion and invented 999-foot answer must never become query premises.' }] }] } };
const previousMessages = [{ role: 'user', question: rootQuestion }, checked,
  { role: 'user', question: 'Correction: the wings are connected by a podium roof. Is that spacing still correct?' },
  { role: 'assistant', answer: { mode: 'clarification', verification: { pass: false }, supportedPoints: [], citations: [{ ...incidental }] } }];
const query = researchEvidenceRetrievalQuery({ question: followUp, previousMessages });
assert.equal(query.activeRulePacketReferences[0]?.sectionID, active.id);
assert(!JSON.stringify(query.activeRulePacketReferences).includes('999-foot'));
assert(!JSON.stringify(query.activeRulePacketReferences).includes('selectedText'));
const activeIndex = await buildResearchPassageIndex([meaning, active], async value => value.body);
const activeDiscovery = await discoverRelevantEvidence({ question: query.retrievalQuery, retrievalContext: { ...query, currentQuestion: followUp },
  catalog: [meaning, active], passageIndex: activeIndex, invertedIndex: new Map(), readSectionBody: async value => value.body, limit: 2,
  semanticSearch: { search: async () => ({ hits: [{ ...activeIndex.passages.find(value => value.sectionID === meaning.id), score: 1 }], metadata: {} }) } });
assert(activeDiscovery.candidates.some(value => value.sectionID === active.id &&
  value.signals.currentQuestionLexicalReservation?.kind === 'active_checked_rule_current_detail'));
const overBudget = await assembleResearchEvidence({ question: followUp, previousMessages, pinnedEvidence: [],
  discover: async () => activeDiscovery, resolveSection: async request => [meaning, active].find(value => value.id === request.sectionID),
  limits: { maximumCharacters: 200, maximumCharactersPerSource: 100, maximumDiscovered: 2, maximumCrossReferences: 0 } });
assert(!overBudget.sources.some(value => value.sectionID === active.id), 'A recalled active rule is whole or omitted, never clipped to the source cap.');
assert(overBudget.usage.characterCount <= 200);
const completeBeyondShare = await assembleResearchEvidence({ question: followUp, previousMessages, pinnedEvidence: [],
  discover: async () => activeDiscovery, resolveSection: async request => [meaning, active].find(value => value.id === request.sectionID),
  limits: { maximumCharacters: 1000, maximumCharactersPerSource: 100, maximumDiscovered: 2, maximumCrossReferences: 0 } });
const wholeActive = completeBeyondShare.sources.find(value => value.sectionID === active.id);
assert(wholeActive?.canonicalContextComplete && wholeActive.text === active.text);
assert(wholeActive.text.length > completeBeyondShare.limits.maximumCharactersPerSource);
assert.equal(wholeActive.completeSourceReservation.kind, 'active_checked_rule_current_detail');
assert(completeBeyondShare.usage.characterCount <= 1000, 'Only one exact checked rule may use the remaining total beyond ordinary fair share.');
const forgedActive = await assembleResearchEvidence({ question: followUp, previousMessages, pinnedEvidence: [],
  discover: async () => ({ ...activeDiscovery, candidates: activeDiscovery.candidates.map(value => value.sectionID === active.id ?
    { ...value, indexedPassage: { ...value.indexedPassage, sourceTextHash: '0'.repeat(64) } } : value) }),
  resolveSection: async request => [meaning, active].find(value => value.id === request.sectionID),
  limits: { maximumCharacters: 1000, maximumCharactersPerSource: 100, maximumDiscovered: 2, maximumCrossReferences: 0 } });
assert(!forgedActive.sources.some(value => value.sectionID === active.id), 'A whole active reservation still requires fresh exact passage hash/offset binding.');
const failedAuthority = researchEvidenceRetrievalQuery({ question: followUp, previousMessages: [
  { role: 'user', question: rootQuestion }, { role: 'assistant', answer: {
    mode: 'clarification', verification: { pass: false }, supportedPoints: [{}], citations: [{ ...active }] } }] });
assert.equal(failedAuthority.activeRulePacketReferences.length, 0, 'Rejected assistant citations supply no active packet authority.');
for (const changedQuestion of ['New topic: what plumbing pressure is required?', 'Under the 2014 Building Code, what height applies?', 'What spacing applies under MC 994.1?']) {
  const changed = researchEvidenceRetrievalQuery({ question: changedQuestion, previousMessages });
  assert.equal(changed.activeRulePacketReferences.length, 0, 'Explicit topic/family/edition switches reject the old authority.');
}
const unrelatedIntervening = researchEvidenceRetrievalQuery({ question: 'Where is its height measured?', previousMessages: [
  { role: 'user', question: rootQuestion }, checked, { role: 'user', question: 'New topic: what gas vent termination is required?' },
  { role: 'assistant', answer: { mode: 'clarification', verification: { pass: false }, supportedPoints: [], citations: [] } }] });
assert.equal(unrelatedIntervening.activeRulePacketReferences.length, 0);
console.log('Current-detail packets passed: bounded complete dependencies, authority/pin/budget guards, nonlead sibling and checked-identity continuity after nonanswers.');
