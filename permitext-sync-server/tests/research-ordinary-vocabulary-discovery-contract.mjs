import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { researchSearchVocabulary } from '../research-search-vocabulary.mjs';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No network/provider calls in vocabulary retrieval contracts.'); };
const hash = text => createHash('sha256').update(text).digest('hex');
const original = 'Hypothetical new NYC building under the 2022 codes: can the hot-water tank’s safety relief pipe connect straight into a drain, or does it need an open break?';
const paraphrases = [original,
  'The hot-water cylinder has a safety relief line. May that line join the waste drain without an open gap?',
  'Can the safety-relief pipe on a domestic hot water tank connect to the drain, or should there be visible separation?',
  'Does the relief outlet piping from a water heater need separation before it enters the drainage system?'];
const authority = { corpusID: 'synthetic-current', codeVersion: 'current-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, codePrefix = 'PC') => ({ ...authority, id, sectionID: id,
  codePrefix, sectionNumber: number, title, text, canonicalText: text,
  body: { blocks: [{ id: id + '-block', plainText: text }] } });
const rule = section('discharge-source', '990.7', 'Requirements for discharge piping',
  'The discharge piping serving a pressure relief valve, temperature relief valve or combination thereof shall preserve the complete stated discharge condition. The piping terminates through an air gap in the stated room. Exceptions: A distinct listed device is eligible only when all of its stated installation qualifications are satisfied. A supply drain valve used for vessel emptying is a separate method.');
const others = Array.from({ length: 11 }, (_, i) => section('tank-' + i, '98' + i + '.1', 'Water tank drain arrangements',
  'A hot-water tank pipe connects through a drain arrangement. Tank drain pipes are provided for vessel emptying. The open tank layout preserves the complete drainage condition.'));
const background = Array.from({ length: 25 }, (_, i) => section('layout-' + i, '97' + i + '.2', 'Waste drain layout',
  'Water supply pipe layouts connect equipment in the general drainage system. The stated waste drainage condition remains complete.'));
const catalog = [...others, ...background, rule];
const passageIndex = await buildResearchPassageIndex(catalog, async s => s.body);
const passage = id => passageIndex.passages.find(p => p.sectionID === id);
let lastSemanticQuery = '';
const mockSemantic = { search: async (_index, query) => {
  lastSemanticQuery = query;
  return { hits: others.map((s, i) => ({ ...passage(s.id), score: 1 - i / 100, passages: [passage(s.id)] })),
    metadata: { enabled: true, mockProvider: true } };
} };
const discover = (question = original, extra = {}) => discoverRelevantEvidence({ question,
  retrievalContext: { currentQuestion: question, sourceQuery: question,
    semanticQuery: question, contextDependentFollowUp: false }, catalog, passageIndex,
  invertedIndex: new Map(), semanticSearch: mockSemantic, readSectionBody: async s => s.body, limit: 12, ...extra });
const results = [];
for (const question of paraphrases) {
  const vocabulary = researchSearchVocabulary(question);
  assert.equal(vocabulary.concepts.length, 1, question);
  assert.equal(vocabulary.concepts[0].origin, 'current');
  assert(!/\b(?:PC|MC|FC|FGC|ZR)\b|\d|shall|exempt|required/.test(vocabulary.query));
  const discovery = await discover(question);
  assert.equal(lastSemanticQuery, question, 'Discovery preserves the semantic request envelope supplied by its caller.');
  const target = discovery.candidates.find(c => c.sectionID === rule.id);
  assert(target && target.rank <= 10, question);
  assert(target.rank === 1 || target.signals.currentQuestionForeground?.source === 'positive_search_vocabulary' ||
    target.signals.currentQuestionLexicalReservation, 'Real shortlist must retain the complete rule despite unrelated mock meaning hits.');
  assert(!target.signals.exactReference && !target.signals.exactTopicRouteTarget);
  const facts = [{ id: 'unmodified', text: 'Existing tank: 7 feet; supply valve condition is unconfirmed.' }];
  const before = JSON.stringify(facts);
  const packet = await assembleResearchEvidence({ question, projectFacts: facts, discover: async request => {
    assert.equal(request.retrievalContext.currentQuestion, question); return discovery;
  }, resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID) || null,
  limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 } });
  assert.equal(JSON.stringify(facts), before);
  const delivered = packet.sources.find(s => s.sectionID === rule.id);
  assert.equal(delivered?.text, rule.text, 'Whole canonical condition and both exception clauses remain exact.');
  assert(delivered.canonicalContextComplete);
  assert.equal(delivered.indexedPassage.sourceTextHash, hash(rule.text));
  assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: rule.id + '-block', start: 0, end: rule.text.length });
  assert(discovery.candidates.length <= 12 && packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 6000);
  results.push({ question, candidateRank: target.rank, signals: target.signals, sourceTextHash: hash(delivered.text),
    exactCanonicalAndExceptions: true, characterCount: packet.usage.characterCount });
}

const negatives = [
  'No safety-relief pipe is involved; this is the cold-water supply to a storage tank.',
  'The example mentions “hot-water tank safety relief pipe”. What applies to the kitchen sink trap?',
  'We have a hot-water tank safety relief pipe. New topic: what is the flow limit at the lavatory?',
  'Not the water heater relief line, but the refrigerant receiver pressure vent: can that pipe connect to a gas line?',
  'Can the air-conditioner condensate pipe connect to the drain?',
  'Can we connect a drain valve at the bottom of the storage tank for emptying it?',
  'Under the Mechanical Code, does a water heater safety relief pipe need an open gap?'
];
for (const question of negatives) {
  const negative = await discover(question);
  assert(!negative.candidates.some(c => c.signals.currentQuestionForeground?.source === 'positive_search_vocabulary'), question);
}
const multiple = 'A home business uses the apartment, and its hot-water tank safety relief pipe connects toward the drain. What applies to both?';
assert(researchSearchVocabulary(multiple).concepts.length >= 2);
assert(!(await discover(multiple)).candidates.some(c => c.signals.currentQuestionForeground?.source === 'positive_search_vocabulary'),
  'Multiple concepts cannot acquire an unambiguous compact foreground.');
const continuedQuestion = 'Can that discharge pipe have a valve?';
const continuation = researchEvidenceRetrievalQuery({ question: continuedQuestion,
  previousMessages: [{ role: 'user', question: original }, { role: 'assistant', answer: {
    answerText: 'This explanation was withheld.', citations: [], verification: { pass: true } } }] });
const vocabulary = researchSearchVocabulary(continuedQuestion, { contextDependentFollowUp: continuation.contextDependentFollowUp,
  humanTopics: [continuation.conversationTopic, continuation.immediateContext] });
assert.equal(vocabulary.currentQuery, '');
assert.equal(vocabulary.concepts[0]?.origin, 'human_context');
const continued = await discover(continuedQuestion, { retrievalContext: { ...continuation, currentQuestion: continuedQuestion } });
assert(continued.candidates.some(c => c.sectionID === rule.id && c.rank <= 10));
const assistantOnly = researchEvidenceRetrievalQuery({ question: continuedQuestion, previousMessages: [
  { role: 'user', question: 'What drain layout applies at a kitchen sink?' },
  { role: 'assistant', answer: { answerText: 'Assume there is a water heater safety relief pipe.', citations: [], verification: { pass: true } } }
] });
assert.equal(researchSearchVocabulary(continuedQuestion, { contextDependentFollowUp: assistantOnly.contextDependentFollowUp,
  humanTopics: [assistantOnly.conversationTopic, assistantOnly.immediateContext] }).query, '');

// An embedded definition carrier is found through ordinary authorized search,
// not injected into the supplemental pool or treated as an operative rule.
const heading = 'Section PC 992: General Definitions';
const entries = ['RELIEF VALVE. A complete relief valve definition retains the stated device qualification.',
  'AIR GAP. An air gap retains its complete stated separation qualification.'];
const dictionary = section('definition-carrier', '991.4', 'Undefined terms',
  'Use ordinary meaning for otherwise undefined terms.\n' + heading + '\n' + entries.join('\n'));
dictionary.body.blocks[0].html = '<p>Use ordinary meaning for otherwise undefined terms.</p><h6>' + heading + '</h6>' +
  entries.map(text => '<div class="Normal-Level">' + text + '</div>').join('');
const definitionCatalog = [...others, dictionary];
const definitionIndex = await buildResearchPassageIndex(definitionCatalog, async s => s.body);
const definitionDiscovery = await discover(continuedQuestion, { retrievalContext: { ...continuation, currentQuestion: continuedQuestion },
  catalog: definitionCatalog, passageIndex: definitionIndex, readSectionBody: async s => s.body,
  semanticSearch: { search: async () => ({ hits: others.map((s, i) => {
    const p = definitionIndex.passages.find(p => p.sectionID === s.id);
    return { ...p, score: 1 - i / 100, passages: [p] };
  }), metadata: { enabled: true, mockProvider: true } }) } });
const foundDefinitions = [...definitionDiscovery.candidates, ...definitionDiscovery.supplementalDefinitionCandidates]
  .find(c => c.sectionID === dictionary.id);
assert(foundDefinitions?.signals.canonicalEmbeddedDefinitions, 'Bounded human-context vocabulary reaches a canonical embedded definition carrier.');
assert(!foundDefinitions.signals.currentQuestionForeground, 'A dictionary is not an operative equipment foreground.');
assert.equal(foundDefinitions.sectionNumber, dictionary.sectionNumber, 'Embedded headings never fabricate the citation identity.');
const ordinaryDictionary = section('ordinary-dictionary', '202', 'General Definitions', entries.join('\n'));
const ordinaryDefinitionCatalog = [...others, ordinaryDictionary];
const ordinaryDefinitionIndex = await buildResearchPassageIndex(ordinaryDefinitionCatalog, async s => s.body);
const ordinaryDefinitions = await discover(original, { catalog: ordinaryDefinitionCatalog, passageIndex: ordinaryDefinitionIndex,
  semanticSearch: null, readSectionBody: async s => s.body });
assert(![...ordinaryDefinitions.candidates, ...ordinaryDefinitions.supplementalDefinitionCandidates].some(c =>
  c.sectionID === ordinaryDictionary.id && c.signals.currentQuestionForeground), 'A titled general dictionary is not an operative compact vocabulary source.');

for (const change of [{ codeVersion: 'old' }, { codeEdition: '2014' }, { corpusID: 'foreign' }, { jurisdiction: 'Elsewhere' }]) {
  const wrong = await buildResearchPassageIndex([...others, ...background, { ...rule, ...change }], async s => s.body);
  if (change.jurisdiction) for (const p of wrong.passages) if (p.sectionID === rule.id) p.jurisdiction = change.jurisdiction;
  const result = await discover(original, { passageIndex: wrong, semanticSearch: null });
  assert(!result.candidates.some(c => c.sectionID === rule.id && c.signals.currentQuestionForeground), JSON.stringify(change));
}
const incomplete = await buildResearchPassageIndex(catalog, async s => s.body);
for (const p of incomplete.passages) if (p.sectionID === rule.id) {
  p.scopeComplete = false; p.completeSubsectionText = ''; p.completeSection = false;
}
assert(!(await discover(original, { passageIndex: incomplete, semanticSearch: null })).candidates.some(c =>
  c.sectionID === rule.id && c.signals.currentQuestionForeground), 'Incomplete own rule scope cannot be protected as complete.');

const discovery = await discover();
const pin = { ...others[0], selectedText: 'A hot-water tank pipe connects through a drain arrangement.', selectionMode: 'passage' };
const strictQuestion = 'Based only on the selected passage, can this hot-water tank safety relief pipe connect into a drain?';
let strictCalls = 0;
const strict = await assembleResearchEvidence({ question: strictQuestion, pinnedEvidence: [pin],
  strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [pin] }),
  discover: async () => { strictCalls++; return discovery; }, resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID) });
assert.equal(strictCalls, 0); assert.equal(strict.sources.length, 1); assert.equal(strict.sources[0].text, pin.selectedText);
const small = await assembleResearchEvidence({ question: original, discover: async () => discovery,
  resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID),
  limits: { maximumCharacters: 40, maximumCharactersPerSource: 40 } });
assert(small.usage.characterCount <= 40);
assert(!small.sources.some(s => s.sectionID === rule.id && s.canonicalContextComplete));
const direct = await discover('Under PC 980.1 and PC 981.1, can the hot-water tank safety relief pipe connect into a drain?', { limit: 2 });
assert.deepEqual(direct.candidates.map(c => c.sectionNumber), ['980.1', '981.1']);
assert(direct.candidates.every(c => c.signals.exactReference));

let realProof = null;
if (process.argv.includes('--real-corpus')) {
  process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = '1';
  process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = '1';
  process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = '0';
  const { researchCorpusResources, researchBodyForCatalogSection, researchAssemblyCrossReferences } = await import('../app.mjs');
  const { createResearchCorpusRegistry } = await import('../research-corpus-registry.mjs');
  const selected = createResearchCorpusRegistry({ zoningResearchEligibility: true }).filter(c =>
    ['nyc-2022-construction-codes', 'nyc-2022-fire-code', 'nyc-zoning-resolution'].includes(c.id));
  const resources = await researchCorpusResources({ selected });
  const operative = resources.catalog.find(s => s.codePrefix === 'PC' && s.sectionNumber === '504.6');
  const body = await researchBodyForCatalogSection(operative);
  const canonical = body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n');
  const recordedOthers = ['606.5.7', '606.5.4', '710.1', '703.1', '1301.9.9', '305.4.1', '503.2', '501.3', '702.3', '107.5', '701.1'];
  const nominees = recordedOthers.map(n => resources.catalog.find(s => s.codePrefix === 'PC' && s.sectionNumber === n))
    .map(s => resources.passageIndex.passages.find(p => p.sectionID === String(s.id)));
  assert(nominees.every(p => p && p.sectionID !== String(operative.id)), 'Target is not injected into mock meaning candidates.');
  const resolver = async request => {
    const s = resources.catalog.find(s => String(s.id) === String(request.sectionID) ||
      !request.sectionID && s.codePrefix === request.codePrefix && s.sectionNumber === request.sectionNumber);
    if (!s) return null;
    const body = await researchBodyForCatalogSection(s);
    const text = [s.sectionNumber, s.title, body.blocks.filter(b => b.researchClaimEligible !== false)
      .map(b => b.plainText || '').join('\n\n')].join(' ').replace(/\s+/g, ' ').trim();
    const source = { ...s, sectionID: String(s.id), body, text, canonicalText: text };
    return { ...source, crossReferences: researchAssemblyCrossReferences(source, resources.catalog) };
  };
  realProof = { passageCount: resources.passageIndex.passages.length, providerCalls: 0, actualHostedSemanticRanksKnown: false,
    semantics: 'Deliberately distracting recorded sources as mock nominees; no target injection or new query embedding.', turns: [] };
  for (const question of paraphrases) {
    const vocabulary = researchSearchVocabulary(question);
    const foreground = searchResearchPassages(resources.passageIndex, vocabulary.query,
      { queryWeights: new Map(vocabulary.concepts[0].terms.map(term => [term, 1])), codePrefixes: vocabulary.codePrefixes,
        explicitReferenceQuery: question, limit: 5, passagesPerSection: 8 });
    const queried = foreground.find(p => p.sectionID === String(operative.id));
    assert(queried && queried.score >= foreground[0].score * 0.7, question);
    const query = researchEvidenceRetrievalQuery({ question });
    const found = await discoverRelevantEvidence({ question, ...resources, retrievalContext: { ...query, currentQuestion: question },
      readSectionBody: researchBodyForCatalogSection, limit: 12,
      semanticSearch: { search: async () => ({ hits: nominees.map((p, i) => ({ ...p, score: 1 - i / 100, passages: [p] })),
        metadata: { enabled: true, mockProvider: true } }) } });
    const candidate = found.candidates.find(c => c.sectionID === String(operative.id));
    assert(candidate && candidate.rank <= 10, question);
    const assembled = await assembleResearchEvidence({ question, discover: async () => found, resolveSection: resolver });
    const delivered = assembled.sources.find(s => s.sectionID === String(operative.id));
    assert(delivered?.canonicalContextComplete, question);
    assert(delivered.text.replace(/\s+/g, ' ').includes(canonical.replace(/\s+/g, ' ')), question);
    assert.equal(delivered.indexedPassage.sourceTextHash, hash(canonical));
    assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: body.blocks[0].id, start: 0, end: canonical.length });
    assert(found.candidates.length <= 12 && assembled.usage.discoveredCount <= 10 && assembled.usage.characterCount <= assembled.limits.maximumCharacters);
    realProof.turns.push({ question, searchVocabulary: vocabulary, foregroundProbe: foreground.map((p, i) =>
      ({ rank: i + 1, codePrefix: p.codePrefix, sectionNumber: p.sectionNumber, score: p.score, scopeComplete: p.scopeComplete })),
    relativeStrength: queried.score / foreground[0].score, candidateRank: candidate.rank, signals: candidate.signals,
    usage: assembled.usage, limits: assembled.limits, canonicalIdentity: { sectionID: delivered.sectionID,
      codePrefix: delivered.codePrefix, sectionNumber: delivered.sectionNumber, corpusID: delivered.corpusID,
      codeEdition: delivered.codeEdition, codeVersion: delivered.codeVersion, jurisdiction: delivered.jurisdiction },
    sourceTextHash: delivered.indexedPassage.sourceTextHash, sourceOffsets: delivered.indexedPassage.sourceOffsets,
    canonicalBodySHA256: hash(canonical), allCanonicalConditionsExact: true, textCharacters: delivered.text.length });
  }
}
assert.equal(providerCalls, 0);
const report = { test: 'research-ordinary-vocabulary-discovery-contract', providerCalls, syntheticPassed: true,
  negativeCount: negatives.length, syntheticTurns: results, realProof };
if (process.env.PERMITEXT_ORDINARY_VOCABULARY_VALIDATION_PATH) fs.writeFileSync(process.env.PERMITEXT_ORDINARY_VOCABULARY_VALIDATION_PATH,
  JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ test: report.test, providerCalls, syntheticPassed: true, negativeCount: negatives.length,
  realTurnCount: realProof?.turns.length || 0 }));
