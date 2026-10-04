import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { researchGasEquipmentVocabulary } from '../research-search-vocabulary.mjs';
import { researchQuestionSubject } from '../research-question-subject.mjs';
import { researchEquipmentSearchIntent } from '../research-equipment-search-intent.mjs';
import { researchTechnicalTopicRoutes } from '../research-technical-topic-routes.mjs';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No network/providers permitted in gas-equipment vocabulary contracts.'); };
const hash = value => createHash('sha256').update(value).digest('hex');
const original = 'For a separate NYC installation using the 2022 codes, could a listed direct-vent gas heater go in a bathroom if it takes all combustion air from outside and is installed according to its instructions?';
const paraphrases = [original,
  'For a new gas furnace, could we install the listed direct-vent unit in a bathroom using outdoor combustion air and its instructions?',
  'Could a gas-fired boiler go inside a toilet room?',
  'What applies to placing a gas-burning range in a bathroom?',
  'Could a stove burning natural gas be placed in a bathroom?',
  'Could a gas water heater be installed in a bathroom?',
  'Could a gas waterheater go inside a bathroom?',
  'For a heater running on natural gas, what applies to putting it in a bathroom?'];
for (const question of paraphrases) {
  const vocabulary = researchGasEquipmentVocabulary(question);
  assert(vocabulary?.query && vocabulary.aspect === 'location', question);
  assert(vocabulary.query.length <= 100);
  assert(!/\d|shall|exempt|required|permitted|FGC/i.test(vocabulary.query));
  assert.equal(vocabulary.origin, 'current');
  assert(researchQuestionSubject(question).codePrefixes.includes('FGC'));
  assert.equal(researchEquipmentSearchIntent(question)?.subject, 'gas_appliance');
  assert(researchTechnicalTopicRoutes.filter(route => route.nominationVocabulary === 'gas_equipment')
    .some(route => route.pattern.test(vocabulary.routeQuery)), 'Existing source route, not a new legal-reference map.');
}
const negatives = [
  'This is not a gas heater. What applies to this room?',
  'We do not want to remove the gas furnace. What changes to the layout are possible?',
  'Unlike a gas-fired boiler, can an electric boiler go in a bathroom?',
  'There is no gas stove, only an electric range. Can it go in that room?',
  'The historical example said “gas heater in a bathroom”. What applies to this room?',
  "The 1968 example said 'gas furnace in a bedroom'. Is the new electric heater different?",
  'Under the Mechanical Code, can a gas heater go in a bathroom?',
  'Under the Plumbing Code, can a gas water heater go in a bathroom?',
  'We have a gas furnace. What backflow device is needed at the hose faucet?',
  'For the gas water heater, can its relief valve discharge pipe connect into a drain?',
  'Compare the gas furnace and the electric heater. What applies to both?',
  'The old question was about a gas heater. New topic: what ceiling applies in the bathroom?',
  'Could a gas piping connector go inside a bathroom?',
  'Could a heat pump go in a bathroom?',
  'There is combustion air from outdoors. What is allowed in this room?'
];
for (const question of negatives) assert.equal(researchGasEquipmentVocabulary(question), null, question);
for (const question of ['Not a gas heater, but a gas furnace: can it go in a bathroom?',
  'Could we place a gas heater in a shower room?',
  'Correction: it is not an electric stove; it is a gas range. Can we install it in a toilet room?']) assert(researchGasEquipmentVocabulary(question));
const oldHumanTopic = 'Could a gas heater be installed in a bedroom with a 7-foot enclosure under the 2022 codes?';
const continuation = researchGasEquipmentVocabulary('Where is the shutoff valve located?', {
  contextDependentFollowUp: true, humanTopics: [oldHumanTopic] });
assert.equal(continuation.origin, 'human_context');
assert.equal(continuation.aspect, 'shutoff');
assert.equal(researchGasEquipmentVocabulary("Can I put a gas boiler's shutoff valve in another room?").aspect, 'shutoff');
assert(!/bedroom|enclosure|7|2022/.test(continuation.routeQuery), 'Inherited equipment cannot revive the old location or numeric premises.');
assert(/gas appliance/.test(continuation.routeQuery));
assert.equal(researchGasEquipmentVocabulary('New topic: where is the shutoff valve located?', {
  contextDependentFollowUp: true, humanTopics: [oldHumanTopic] }), null);
assert.equal(researchGasEquipmentVocabulary('Under the 2014 codes, where is the shutoff valve located?', {
  contextDependentFollowUp: true, humanTopics: [oldHumanTopic] }), null);
assert.equal(researchGasEquipmentVocabulary('This is not a gas heater. Where is the shutoff valve?', {
  contextDependentFollowUp: true, humanTopics: [oldHumanTopic] }), null);
assert.equal(researchGasEquipmentVocabulary('Where is the shutoff valve?', {
  contextDependentFollowUp: false, humanTopics: [oldHumanTopic] }), null);
const assistantOnly = researchEvidenceRetrievalQuery({ question: 'Where is the shutoff valve located?', previousMessages: [
  { role: 'user', question: 'What ceiling height applies to an office?' },
  { role: 'assistant', answer: { answerText: 'Assume there is a gas heater in a bedroom.', citations: [], verification: { pass: true } } }
] });
assert.equal(researchGasEquipmentVocabulary(assistantOnly.currentQuestion || 'Where is the shutoff valve located?', {
  contextDependentFollowUp: assistantOnly.contextDependentFollowUp,
  humanTopics: [assistantOnly.conversationTopic, assistantOnly.immediateContext] }), null);

const authority = { corpusID: 'synthetic-current', codeVersion: 'current-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, extra = {}) => ({ ...authority, id, sectionID: id, codePrefix: 'FGC',
  sectionNumber: number, title, text, canonicalText: text, body: { blocks: [{ id: id + '-block', plainText: text }] }, ...extra });
const target = section('location-source', '990.3', 'Equipment locations',
  'Gas appliances shall not be located in bathrooms. Exceptions: A sealed appliance retains its complete certification and enclosure qualification. A separate appliance arrangement retains its complete stated eligibility condition.');
const others = Array.from({ length: 12 }, (_, i) => section('meaning-' + i, '98' + i + '.1', 'Venting equipment',
  'Gas appliances and listed heaters use direct-vent installation instructions and outdoor combustion air. Bathroom installations have the complete venting qualification. This is the equipment exhaust and vent termination rule. The entire exhaust condition remains in force.'));
const catalog = [...others, target];
const index = await buildResearchPassageIndex(catalog, async s => s.body);
const hit = id => index.passages.find(p => p.sectionID === id);
const semantic = { search: async () => ({ hits: others.map((s, i) => ({ ...hit(s.id), score: 1 - i / 100, passages: [hit(s.id)] })),
  metadata: { enabled: true, mockProvider: true } }) };
const discover = (question = original, extra = {}) => discoverRelevantEvidence({ question, catalog, passageIndex: index,
  invertedIndex: new Map(), semanticSearch: semantic, readSectionBody: async s => s.body,
  retrievalContext: { currentQuestion: question, sourceQuery: question }, limit: 12, ...extra });
const discovered = await discover();
const selected = discovered.candidates.find(c => c.sectionID === target.id);
assert(selected && (selected.signals.currentQuestionForeground?.source === 'positive_equipment_subject' ||
  selected.signals.currentQuestionLexicalReservation || selected.rank === 1));
assert(selected.rank <= 10 && discovered.candidates.length <= 12);
assert(discovered.candidates.filter(c => c.signals.currentQuestionForeground).length <= 3);
assert(!selected.signals.exactTopicRouteTarget, 'Synthetic source is found by vocabulary, not a known numeric route.');
const facts = [{ id: 'unmodified', text: 'An existing electric heater and a plumbing fixture are separate project facts.' }];
const before = JSON.stringify(facts);
const packet = await assembleResearchEvidence({ question: original, projectFacts: facts, discover: async request => {
  assert.equal(request.retrievalContext.currentQuestion, original); return discovered;
}, resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID),
limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 } });
assert.equal(JSON.stringify(facts), before);
const supplied = packet.sources.find(s => s.sectionID === target.id);
assert.equal(supplied?.text, target.text);
assert(supplied.canonicalContextComplete);
assert.equal(supplied.indexedPassage.sourceTextHash, hash(target.text));
assert.deepEqual(supplied.indexedPassage.sourceOffsets, { blockID: target.id + '-block', start: 0, end: target.text.length });
for (const question of negatives) {
  const result = await discover(question);
  assert(!result.candidates.some(c => c.signals.currentQuestionForeground?.source === 'positive_equipment_subject' &&
    c.codePrefix === 'FGC'), question);
  assert(!result.candidates.some(c => c.signals.topicRoutes.some(label => /fuel-gas appliance.*restrictions/.test(label))), question);
}
for (const change of [{ codeEdition: '2014' }, { codeVersion: 'old' }, { corpusID: 'foreign' }, { jurisdiction: 'Elsewhere' }]) {
  const wrong = await buildResearchPassageIndex([...others, { ...target, ...change }], async s => s.body);
  if (change.jurisdiction) for (const p of wrong.passages) if (p.sectionID === target.id) p.jurisdiction = change.jurisdiction;
  assert(!(await discover(original, { passageIndex: wrong, semanticSearch: null })).candidates.some(c =>
    c.sectionID === target.id && c.signals.currentQuestionForeground?.source === 'positive_equipment_subject'));
}
const incomplete = await buildResearchPassageIndex(catalog, async s => s.body);
for (const p of incomplete.passages) if (p.sectionID === target.id) { p.scopeComplete = false; p.completeSubsectionText = ''; p.completeSection = false; }
assert(!(await discover(original, { passageIndex: incomplete, semanticSearch: null })).candidates.some(c =>
  c.sectionID === target.id && c.signals.currentQuestionForeground?.source === 'positive_equipment_subject'));
const pin = { ...others[0], selectedText: 'Gas appliances retain this selected condition.', selectionMode: 'passage' };
const strictQuestion = 'Based only on the selected passage, could a gas heater go in a bathroom?';
let strictCalls = 0;
const strict = await assembleResearchEvidence({ question: strictQuestion, pinnedEvidence: [pin],
  strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [pin] }),
  discover: async () => { strictCalls++; return discovered; }, resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID) });
assert.equal(strictCalls, 0); assert.equal(strict.sources.length, 1); assert.equal(strict.sources[0].text, pin.selectedText);
const small = await assembleResearchEvidence({ question: original, discover: async () => discovered,
  resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID), limits: { maximumCharacters: 40, maximumCharactersPerSource: 40 } });
assert(small.usage.characterCount <= 40 && !small.sources.some(s => s.sectionID === target.id && s.canonicalContextComplete));
const direct = await discover('Under FGC 980.1 and FGC 981.1, could a gas heater go in a bathroom?', { limit: 2 });
assert.deepEqual(direct.candidates.map(c => c.sectionNumber), ['980.1', '981.1']);
assert(direct.candidates.every(c => c.signals.exactReference));

let realProof = null;
if (process.argv.includes('--real-corpus')) {
  const sourceFiles = ['research-search-vocabulary.mjs', 'research-question-subject.mjs', 'research-equipment-search-intent.mjs',
    'research-technical-topic-routes.mjs', 'evidence-discovery.mjs', 'research-evidence-assembly.mjs', 'app.mjs', 'research-passage-index.mjs'];
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(new URL('../' + file, import.meta.url)))]));
  Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1', PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0' });
  const { researchCorpusResources, researchBodyForCatalogSection, researchAssemblyCrossReferences, researchCorpusPlanForTurn } = await import('../app.mjs');
  const resources = await researchCorpusResources(await researchCorpusPlanForTurn({ question: original, messages: [], topicContext: null, projectFacts: [] }));
  const operative = resources.catalog.find(s => s.codePrefix === 'FGC' && s.sectionNumber === '303.3');
  const body = await researchBodyForCatalogSection(operative);
  const canonical = body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n');
  const otherRefs = [['MC', '707.1'], ['MC', '303.3'], ['MC', '914.2'], ['MC', '802.6'], ['MC', '921.1'],
    ['MC', '905.1'], ['FGC', '503.2.3'], ['FGC', '605.1'], ['MC', '901.1'], ['BC', '2111.14.2'], ['BC', '2111.14.1']];
  const otherHits = otherRefs.map(([prefix, number]) => resources.catalog.find(s => s.codePrefix === prefix && s.sectionNumber === number))
    .map(s => resources.passageIndex.passages.find(p => p.sectionID === String(s.id)));
  assert(otherHits.every(p => p && p.sectionID !== String(operative.id)), 'No governing candidate injected into mock semantics.');
  const resolver = async request => {
    const s = resources.catalog.find(s => String(s.id) === String(request.sectionID) || !request.sectionID &&
      s.codePrefix === request.codePrefix && s.sectionNumber === request.sectionNumber);
    if (!s) return null;
    const body = await researchBodyForCatalogSection(s);
    return { ...s, sectionID: String(s.id), body, text: body.blocks.map(b => b.plainText || '').join('\n\n') };
  };
  realProof = { mode: 'Authorized full index with deliberately distracting recorded reference semantics; not live vector replay',
    sourceHashes,
    catalogCount: resources.catalog.length, passageCount: resources.passageIndex.passages.length,
    indexFingerprint: resources.passageIndex.fingerprint, canonicalSourceID: String(operative.id), canonicalHash: hash(canonical), turns: [] };
  for (const question of paraphrases) {
    const intent = researchEquipmentSearchIntent(question);
    const probe = searchResearchPassages(resources.passageIndex, intent.query, { queryWeights: new Map(intent.terms.map(t => [t, 1])),
      codePrefixes: intent.codePrefixes, explicitReferenceQuery: question, limit: 5, passagesPerSection: 8 });
    const probeTarget = probe.find(p => p.sectionID === String(operative.id));
    assert(probeTarget && probeTarget.score / probe[0].score >= 0.7, JSON.stringify({ question, query: intent.query,
      foreground: probe.map(p => ({ reference: p.codePrefix + ' ' + p.sectionNumber, score: p.score })) }));
    const query = researchEvidenceRetrievalQuery({ question, previousMessages: [], topicContext: null, projectFacts: [] });
    const found = await discoverRelevantEvidence({ question: query.retrievalQuery, retrievalContext: { ...query, currentQuestion: question }, ...resources,
      readSectionBody: researchBodyForCatalogSection, limit: 12,
      semanticSearch: { search: async () => ({ hits: otherHits.map((p, i) => ({ ...p, score: 1 - i / 100, passages: [p] })),
        metadata: { enabled: true, mockProvider: true } }) } });
    const candidate = found.candidates.find(c => c.sectionID === String(operative.id));
    assert(candidate && candidate.rank <= 10 && candidate.signals.currentQuestionForeground?.source === 'positive_equipment_subject', question);
    const assembled = await assembleResearchEvidence({ question, discover: async () => found, resolveSection: resolver,
      crossReferences: researchAssemblyCrossReferences });
    const delivered = assembled.sources.find(s => s.sectionID === String(operative.id));
    assert(delivered?.text.includes(canonical), question);
    assert(delivered.canonicalContextComplete && !delivered.truncated, question);
    assert.equal(delivered.indexedPassage.sourceTextHash, hash(canonical));
    assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: body.blocks[0].id, start: 0, end: canonical.length });
    assert(assembled.usage.discoveredCount <= 10 && assembled.usage.candidateCount <= 12 &&
      assembled.usage.characterCount <= assembled.limits.maximumCharacters);
    realProof.turns.push({ question, compactQuery: intent.query, foregroundProbe: probe.map((p, i) => ({ rank: i + 1, sectionID: p.sectionID,
      sectionNumber: p.sectionNumber, score: p.score })), candidateRank: candidate.rank, signals: candidate.signals,
      canonicalHash: hash(canonical), sourceOffsets: delivered.indexedPassage.sourceOffsets, completeCanonicalAndAllExceptions: true,
      characterCount: assembled.usage.characterCount, limits: assembled.limits, usage: assembled.usage });
  }
  for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(new URL('../' + file, import.meta.url))), expected,
    'Source changed during full-index proof: ' + file);
  const proofIndex = process.argv.indexOf('--proof-path');
  if (proofIndex >= 0) { assert(process.argv[proofIndex + 1]); fs.writeFileSync(process.argv[proofIndex + 1], JSON.stringify(realProof, null, 2) + '\n'); }
}
assert.equal(providerCalls, 0);
console.log(JSON.stringify({ contract: 'positive-gas-equipment-vocabulary', synthetic: true, positiveParaphrases: paraphrases.length,
  negativeQuestions: negatives.length, authorityVariants: 4, strictPins: true, providers: providerCalls,
  realCorpusTurns: realProof?.turns.length || 0 }));
