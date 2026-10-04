import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { researchLeadingTopicSwitch, researchSearchVocabulary, researchSearchVocabularyMatches, researchGasEquipmentVocabulary } from '../research-search-vocabulary.mjs';
import { decideResearchConversationTopic, researchQuestionExplicitlySwitchesTopic } from '../research-conversation-topic.mjs';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No providers in ordinary-action contracts.'); };
const hash = value => createHash('sha256').update(value).digest('hex');
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const cooling = 'Another NYC example using the 2022 codes: could an air conditioner drip its condensate onto a public walkway if the amount is small, even though it would keep the walking surface wet?';
const coolingDetail = 'We will send it to an approved disposal point instead. Can the gravity drain pipe run perfectly level to get there?';
const egress = 'Different safety issue at that building: can delivery cartons temporarily block the required exit path overnight if staff will move them in the morning?';
const activeContext = { rootTopic: egress, currentTopic: egress, originalTopic: cooling };
const history = [cooling, egress].map(question => ({ role: 'user', question }));
const vocabularyForQuery = query => researchSearchVocabulary(query.question, {
  contextDependentFollowUp: query.contextDependentFollowUp,
  humanTopics: [query.conversationTopic, query.immediateContext]
});
const query = (question, previousMessages = [], topicContext = null) => researchEvidenceRetrievalQuery({ question, previousMessages, topicContext });

for (const marker of ['Different safety issue', 'Separate technical question', 'Another construction concern',
  'New practical problem', 'Unrelated fire matter', 'Separate NYC example', 'Separately', 'Moving on', 'Switching topics']) {
  const question = marker + ': can cartons block the required exit path?';
  assert(researchLeadingTopicSwitch(question), marker);
  assert(researchQuestionExplicitlySwitchesTopic(question), marker);
  const decided = decideResearchConversationTopic({ question, previousMessages: [{ role: 'user', question: cooling }] });
  assert.equal(decided.decision, 'topic_switch', marker);
  assert.equal(query(question, [{ role: 'user', question: cooling }]).previousTopicApplied, false, marker);
}
for (const question of ['The drawing says “Different safety issue”; can that drain stay level?',
  'I am not changing to a different safety issue: can that drain stay level?',
  'Does that create a different safety issue at the disposal point?']) {
  assert.equal(researchLeadingTopicSwitch(question), false, question);
  assert.equal(researchQuestionExplicitlySwitchesTopic(question), false, question);
}
assert.equal(researchSearchVocabulary('An air conditioner drips condensate. Different safety issue: can cartons block the exit path?')
  .concepts[0]?.subject, 'egress_obstruction');
assert(!researchSearchVocabulary('An air conditioner drips condensate. Different safety issue: can cartons block the exit path?')
  .concepts.some(c => c.subject === 'cooling_condensate'));
const settledSwitch = 'The previous issue is settled. New topic: where is the shutoff valve?';
const gasHistory = [{ role: 'user', question: 'Could a gas heater go in a bedroom?' }];
assert.equal(researchGasEquipmentVocabulary(settledSwitch, { contextDependentFollowUp: true,
  humanTopics: gasHistory.map(m => m.question) }), null);
const gasReset = query(settledSwitch, gasHistory);
assert.equal(gasReset.topicDecision.decision, 'topic_switch');
assert.equal(gasReset.previousTopicApplied, false);
assert(!gasReset.semanticQuery.includes(gasHistory[0].question));

for (const question of [cooling, 'Could cooling-coil condensate drain water onto the walkway?',
  'Can heat-pump condensate drip water where people walk?', 'Could an evaporator drain its condensate outside?']) {
  const vocab = researchSearchVocabulary(question);
  assert.equal(vocab.concepts[0]?.subject, 'cooling_condensate', question);
  assert.equal(vocab.concepts[0]?.origin, 'current');
  assert(!/\d|shall|permitted|exempt|\b(?:MC|PC|FC|FGC|BC)\b/.test(vocab.query));
}
for (const question of [egress, 'Can furniture obstruct the means of egress?',
  'Must we keep the emergency exit clear?', 'May objects impede the required exit route?',
  'Can we leave metal stock in a required exit walkway if people can step around it?',
  'Can we store cartons along the required path to the exit?']) {
  assert.equal(researchSearchVocabulary(question).concepts[0]?.subject, 'egress_obstruction', question);
}
const negativeQuestions = [
  'The note says “air conditioner condensate”. What drain applies at the kitchen sink?',
  'No air conditioner condensate is involved; what applies to the roof drain?',
  'Can the gas-fired boiler drip flue condensate onto a walkway?',
  'Can fuel-burning equipment drain its condensate outdoors?',
  'Can steam from a sterilizer discharge at a walkway?',
  'Where may rainwater from the roof drain go?',
  'Compare the air-conditioner condensate and fuel-burning boiler condensate: what applies to both?',
  'Under the Fuel Gas Code, can an air conditioner drip condensate onto a walkway?',
  'The warning says “block the required exit path”. What is the doorway height?',
  'Do not block the exit path. What is the drain slope?',
  'Can water exiting the appliance drain into that pipe?',
  'Can software block the exit path in a program?',
  'Under the Plumbing Code, may objects block the required exit path?',
  'How wide must the required exit walkway be?', 'How much material is needed for the exit walkway floor?',
  'May we keep cartons in the stock room?'
];
for (const question of negativeQuestions) assert.equal(researchSearchVocabulary(question).concepts.length, 0, question);

const related = query(coolingDetail, [{ role: 'user', question: cooling }], { rootTopic: cooling, currentTopic: cooling });
assert.equal(related.contextDependentFollowUp, true);
assert.equal(vocabularyForQuery(related).concepts[0]?.origin, 'human_context');
assert(vocabularyForQuery(related).query.includes('slope'));
assert(!/public|walkway|small|wet|2022/.test(vocabularyForQuery(related).query), 'A human subject does not import the old property or premises.');
for (const question of ['How wide must that corridor be?', 'What floor slope can that exit path have?',
  'What height is needed above that path?']) {
  const scoped = query(question, history, activeContext);
  assert.equal(scoped.conversationTopic, egress, 'Current active topic wins over the original cooling topic.');
  assert.equal(vocabularyForQuery(scoped).query, '', question);
}
const newObject = query('What drain slope applies at the kitchen sink?', history, activeContext);
assert.equal(newObject.topicDecision.decision, 'topic_switch', 'A new named fixture can establish its own topic.');
assert.equal(vocabularyForQuery(newObject).query, '', 'A new fixture does not inherit either earlier action.');
const corrected = query('Correction: the objects are metal pieces, not cardboard cartons.', history, activeContext);
assert.equal(corrected.topicDecision.decision, 'correction');
assert.deepEqual(vocabularyForQuery(corrected).concepts.map(c => c.subject), ['egress_obstruction']);
assert.equal(vocabularyForQuery(corrected).concepts[0].origin, 'human_context');
const storageTopic = 'Can we store cartons along the required path to the exit?';
const storageCorrection = query('Correction: the objects are metal pieces, not cardboard cartons.',
  [{ role: 'user', question: storageTopic }], { rootTopic: storageTopic, currentTopic: storageTopic });
assert.deepEqual(vocabularyForQuery(storageCorrection).concepts.map(c => c.subject), ['egress_obstruction']);
for (const question of ['What floor slope can that walkway have?', 'Can the roof drain run level?',
  'How much fall does the sink drain need?', 'Under the 2014 codes, can that drain stay level?',
  'Under the Fuel Gas Code, can that drain stay level?', 'Under PC 990.1, can that drain stay level?',
  'Different design issue: can that drain stay level?']) {
  const scoped = query(question, [{ role: 'user', question: cooling }], { rootTopic: cooling, currentTopic: cooling });
  assert(!vocabularyForQuery(scoped).concepts.some(c => c.subject === 'cooling_condensate'), question);
}
const assistantOnly = query(coolingDetail, [{ role: 'user', question: 'What applies to the door?' },
  { role: 'assistant', answer: { answerText: cooling, citations: [], verification: { pass: true } } }]);
assert.equal(vocabularyForQuery(assistantOnly).query, '');
assert.deepEqual(history, [cooling, egress].map(question => ({ role: 'user', question })));

const authority = { corpusID: 'synthetic-current', codeVersion: 'current-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, codePrefix) => ({ ...authority, id, sectionID: id,
  codePrefix, sectionNumber: number, title, text, canonicalText: text,
  body: { blocks: [{ id: id + '-block', plainText: text }] } });
const targets = [section('route-maintenance', '990.4', 'Route maintenance',
  'Required means of egress shall remain unimpeded. No exit path may be obstructed by furnishings. Exception: A separately authorized arrangement retains every stated qualification and its complete remaining exit condition.', 'FC'),
section('cooling-drain', '991.7', 'Disposal of condensate',
  'Condensate from cooling coils and evaporators shall be conveyed to the complete stated place of disposal. The condensate drain shall preserve the stated slope in its direction of discharge. Condensate shall not discharge so as to cause a nuisance. Exception: A separately qualified installation retains all stated conditions.', 'MC')];
const sourceProof = [];
for (const [i, target] of targets.entries()) {
  const question = i ? cooling : egress;
  const distractors = Array.from({ length: 11 }, (_, n) => section('background-' + i + '-' + n, '98' + n + '.1',
    i ? 'Walkway equipment' : 'Delivery arrangements',
    i ? 'Air conditioner drip water and public walkway walking surfaces have a stated equipment arrangement.' :
      'Delivery cartons and exit paths have a stated building arrangement for morning and overnight deliveries.', target.codePrefix));
  const catalog = [...distractors, target];
  const passageIndex = await buildResearchPassageIndex(catalog, async s => s.body);
  const hit = id => passageIndex.passages.find(p => p.sectionID === id);
  const semanticSearch = { search: async () => ({ hits: distractors.map((s, n) => ({ ...hit(s.id), score: 1 - n / 100,
    passages: [hit(s.id)] })), metadata: { enabled: true, mockProvider: true } }) };
  const discover = (q = question, extra = {}) => discoverRelevantEvidence({ question: q, catalog, passageIndex,
    invertedIndex: new Map(), semanticSearch, readSectionBody: async s => s.body, limit: 12,
    retrievalContext: { ...query(q), currentQuestion: q }, ...extra });
  const found = await discover();
  const nominee = found.candidates.find(c => c.sectionID === target.id);
  assert(nominee && nominee.rank <= 10, 'Complete enacted action survives distracting mock meaning hits.');
  assert(!nominee.signals.exactReference && !nominee.signals.exactTopicRouteTarget);
  assert(found.candidates.filter(c => c.signals.currentQuestionForeground).length <= 3);
  const projectFacts = [{ id: 'original', text: 'Existing inventory is distinct from the current example.' }];
  const unchanged = JSON.stringify(projectFacts);
  const assemble = (extra = {}) => assembleResearchEvidence({ question, projectFacts, discover: async request => {
    assert.equal(request.retrievalContext.currentQuestion, question); return found;
  }, resolveSection: async request => catalog.find(s => s.sectionID === request.sectionID),
  limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 }, ...extra });
  const packet = await assemble();
  assert.equal(JSON.stringify(projectFacts), unchanged);
  const delivered = packet.sources.find(s => s.sectionID === target.id);
  assert.equal(delivered?.text, target.text, 'Complete canonical condition and exception remain byte exact.');
  assert(delivered.canonicalContextComplete && !delivered.truncated);
  assert.equal(delivered.indexedPassage.sourceTextHash, hash(target.text));
  assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: target.id + '-block', start: 0, end: target.text.length });
  assert(found.candidates.length <= 12 && packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 6000);
  const concept = researchSearchVocabulary(question).concepts[0];
  assert(researchSearchVocabularyMatches(target.text, concept));
  if (i) assert.equal(researchSearchVocabularyMatches('Condensate systems serving cooling coils and evaporators retain the stated scope. Exception: A noncondensing system has a distinct qualification.', concept), false,
    'Equipment-only parent is not the requested disposal foreground.');
  assert.equal(researchSearchVocabularyMatches(i ? 'Fuel-burning appliance condensate requires disposal.' :
    'This exit has a width and capacity condition.', concept), false);
  for (const change of [{ codeEdition: '2014' }, { codeVersion: 'old' }, { corpusID: 'foreign' }]) {
    const bad = await assemble({ resolveSection: async request => {
      const source = catalog.find(s => s.sectionID === request.sectionID);
      return source?.id === target.id ? { ...source, ...change } : source;
    } });
    assert(!bad.sources.some(s => s.sectionID === target.id), 'Fresh canonical identity controls the nominee.');
  }
  const stale = structuredClone(found);
  const staleTarget = stale.candidates.find(c => c.sectionID === target.id);
  if (staleTarget.indexedPassage) staleTarget.indexedPassage.sourceTextHash = '0'.repeat(64);
  const recovered = await assemble({ discover: async () => stale });
  const staleDelivered = recovered.sources.find(s => s.sectionID === target.id);
  if (staleDelivered) assert.equal(staleDelivered.text, target.text, 'Stale supplied passage metadata cannot replace fresh canonical bytes.');
  const pin = { ...distractors[0], selectedText: distractors[0].text, selectionMode: 'passage' };
  const strictQuestion = 'Based only on the selected passage, ' + question;
  let broadReads = 0;
  const strict = await assembleResearchEvidence({ question: strictQuestion, pinnedEvidence: [pin],
    strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [pin] }),
    discover: async () => { broadReads++; return found; }, resolveSection: async r => catalog.find(s => s.sectionID === r.sectionID) });
  assert.equal(broadReads, 0); assert.equal(strict.sources.length, 1); assert.equal(strict.sources[0].text, pin.selectedText);
  const small = await assemble({ limits: { maximumCharacters: 40, maximumCharactersPerSource: 40 } });
  assert(small.usage.characterCount <= 40 && !small.sources.some(s => s.sectionID === target.id && s.canonicalContextComplete));
  sourceProof.push({ question, sectionID: target.id, candidateRank: nominee.rank, bodySHA256: hash(target.text), usage: packet.usage });
}

// A separate synthetic hierarchy proves qualified parent recovery through the
// existing cross-reference queue, including an interior child of an enacted
// range. The parent is not supplied as a discovered candidate.
const child = section('qualified-child', '992.4.3', 'Condensate disposal', targets[1].text, 'MC');
const parent = section('qualified-parent', '992.4', 'System qualifications',
  'Systems shall be in accordance with Sections 992.4.1 through 992.4.6. Exception: A separately qualified noncondensing system is outside this requirement.', 'MC');
const childIndex = await buildResearchPassageIndex([child], async s => s.body);
const childPassage = childIndex.passages.find(p => p.sectionID === child.id);
const parentCandidate = { ...child, rank: 1, score: 1, indexedPassage: childPassage, signals: {} };
const parentReads = [];
const parentPacket = async (extra = {}) => {
  const { parentChange = {}, childChange = {}, candidateChange = {}, question = cooling, ...options } = extra;
  return assembleResearchEvidence({ question, discover: async () => ({ candidates: [{ ...parentCandidate, ...candidateChange }] }),
    resolveSection: async request => {
      parentReads.push(request);
      if (request.sectionID === child.id) return { ...child, ...childChange };
      if (request.sectionNumber === parent.sectionNumber) return { ...parent, ...parentChange };
      return null;
    }, ...options });
};
const qualified = await parentPacket();
const fullParent = qualified.sources.find(s => s.sectionID === parent.id);
assert.equal(fullParent?.text, parent.text);
assert(fullParent.canonicalContextComplete && !fullParent.truncated);
assert.equal(fullParent.origin, 'permitext_cross_reference');
assert.equal(fullParent.qualifyingParentBodySHA256, hash(parent.text));
assert.equal(fullParent.evidencePriority.claimCoverageRequired, false, 'Enclosing text is supporting context, not a mandatory governing claim.');
assert(qualified.usage.crossReferenceCount <= 6);
for (const parentChange of [{ corpusID: 'foreign' }, { codeVersion: 'old' }, { codeEdition: '2014' },
  { jurisdiction: 'Elsewhere' }, { codeEdition: '' }, { sectionNumber: '992.5' }, { id: '', sectionID: '' },
  { referenceOnly: true }, { selectionMode: 'section_reference' }, { textComplete: false },
  { canonicalContextComplete: false }, { authorityClass: 'guidance' }, { authorityStatus: 'unverified' },
  { body: { ...parent.body, truncated: true } }, { body: { ...parent.body, researchClaimEligible: false } },
  { body: { blocks: [{ ...parent.body.blocks[0], researchClaimEligible: false }] } },
  { text: 'Exception: Other systems have a separate qualification.', canonicalText: 'Exception: Other systems have a separate qualification.',
    body: { blocks: [{ id: parent.id + '-block', plainText: 'Exception: Other systems have a separate qualification.' }] } },
  { text: 'Systems shall be in accordance with Sections 992.5.1 through 992.5.6. Exception: Another rule applies.',
    canonicalText: 'Systems shall be in accordance with Sections 992.5.1 through 992.5.6. Exception: Another rule applies.',
    body: { blocks: [{ id: parent.id + '-block', plainText: 'Systems shall be in accordance with Sections 992.5.1 through 992.5.6. Exception: Another rule applies.' }] } }
]) {
  assert(!(await parentPacket({ parentChange })).sources.some(s => s.sectionID === parent.id), 'Fresh eligible same-authority enacted delegation is required.');
}
for (const childChange of [{ id: '', sectionID: '' }, { id: 'other-child', sectionID: 'other-child' },
  { sectionNumber: '' }, { sectionNumber: '992.4.2' }, { corpusID: '' }, { jurisdiction: '' },
  { codeEdition: '' }, { referenceOnly: true }, { textComplete: false }, { canonicalContextComplete: false },
  { authorityClass: 'guidance' }, { body: { ...child.body, researchClaimEligible: false } }]) {
  assert(!(await parentPacket({ childChange })).sources.some(s => s.sectionID === parent.id), 'Candidate request fields cannot attest missing or ineligible fresh child authority.');
}
for (const candidateChange of [{ indexedPassage: { ...childPassage, sourceTextHash: '0'.repeat(64) } },
  { indexedPassage: { ...childPassage, scopeComplete: false } },
  { signals: { currentQuestionForeground: { source: 'positive_search_vocabulary' }, contextualReference: true } },
  { signals: { currentQuestionForeground: { source: 'positive_search_vocabulary' }, historicalReference: true } }
]) assert(!(await parentPacket({ candidateChange })).sources.some(s => s.sectionID === parent.id), 'Nomination metadata cannot bypass child binding or source scope.');
for (const question of ['Under the 2014 codes, can an air conditioner drip condensate onto a walkway?',
  'Under the Fuel Gas Code, can an air conditioner drip condensate onto a walkway?',
  'Compare gas boiler condensate and cooling-coil condensate disposal.']) {
  assert(!(await parentPacket({ question })).sources.some(s => s.sectionID === parent.id), 'Foreign edition/book and ambiguous subjects do not reserve this parent.');
}
const oneSlot = await parentPacket({ limits: { maximumCrossReferences: 1 } });
assert.equal(oneSlot.usage.crossReferenceCount, 1);
assert(oneSlot.sources.some(s => s.sectionID === parent.id));
const otherChild = section('other-qualified-child', '993.4.3', child.title, child.text, 'MC');
const otherParent = section('other-qualified-parent', '993.4', parent.title, parent.text.replaceAll('992.4', '993.4'), 'MC');
const otherIndex = await buildResearchPassageIndex([otherChild], async s => s.body);
const competitionReads = [];
const competition = await assembleResearchEvidence({ question: cooling, limits: { maximumCrossReferences: 1 },
  discover: async () => ({ candidates: [parentCandidate, { ...otherChild, rank: 2, score: 0.9, signals: {},
    indexedPassage: otherIndex.passages.find(p => p.sectionID === otherChild.id) }] }),
  resolveSection: async request => {
    competitionReads.push(request.sectionNumber);
    return [child, parent, otherChild, otherParent].find(s => request.sectionID ? s.sectionID === request.sectionID : s.sectionNumber === request.sectionNumber) || null;
  } });
assert.equal(competition.usage.crossReferenceCount, 1);
assert.equal(competition.sources.filter(s => s.qualifyingParentBodySHA256).length, 1);
assert(competition.sources.some(s => s.sectionID === parent.id));
assert(!competitionReads.includes(otherParent.sectionNumber), 'A second optional qualifying parent cannot expand the fixed reservation or read lane.');
const oversizedText = parent.text + ' Enclosing qualification remains complete.'.repeat(100);
const noRoom = await parentPacket({ parentChange: { text: oversizedText, canonicalText: oversizedText,
  body: { blocks: [{ id: parent.id + '-block', plainText: oversizedText }] } }, limits: { maximumCharacters: 1200, maximumCharactersPerSource: 1000 } });
assert(!noRoom.sources.some(s => s.sectionID === parent.id));
assert(noRoom.limitations.some(l => l.kind === 'current-action-parent-context-budget'));
assert(noRoom.usage.characterCount <= 1200);

let realProof = null;
if (process.argv.includes('--real-corpus')) {
  Object.assign(process.env, { NODE_ENV: 'test', PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0', PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1',
    PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING: '1', PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES: '1',
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: '1' });
  const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection, assembledResearchEvidenceForTurn,
    researchAssemblyCrossReferences } = await import('../app.mjs');
  const inputs = [
    { id: 'cooling-root', question: cooling, messages: [], topicContext: null, expected: [['MC', '307.2.1'], ['MC', '307.2']] },
    { id: 'cooling-detail', question: coolingDetail, messages: [{ role: 'user', question: cooling }],
      topicContext: { rootTopic: cooling, currentTopic: cooling }, expected: [['PC', '314.2.1'], ['PC', '314.2']] },
    { id: 'egress-reset', question: egress, messages: [cooling, coolingDetail].map(question => ({ role: 'user', question })),
      topicContext: { rootTopic: cooling, currentTopic: coolingDetail }, expected: [['FC', '1027'], ['BC', '1003.6']] },
    { id: 'egress-material-correction', question: 'Correction: these are metal pieces, not cardboard cartons. Could they block that path overnight?',
      messages: history, topicContext: activeContext, expected: [['FC', '1027']] }
  ];
  realProof = { mode: 'Provider-free full authorized index, empty project facts, no semantic provider; actual hosted ranks/history unavailable.', turns: [] };
  for (const input of inputs) {
    const { expected, ...request } = input;
    const corpusPlan = await researchCorpusPlanForTurn({ ...request, pinnedEvidence: [], projectFacts: [] });
    const resources = await researchCorpusResources(corpusPlan);
    const modes = input.id === 'cooling-root' || input.id === 'egress-reset' ? ['actual_app_lexical', 'mock_walkway_semantics'] : ['actual_app_lexical'];
    for (const mode of modes) {
    let discovery = null;
    const resolver = async descriptor => {
      const section = resources.catalog.find(s => String(s.id) === String(descriptor.sectionID) || !descriptor.sectionID &&
        s.codePrefix === descriptor.codePrefix && s.sectionNumber === descriptor.sectionNumber);
      if (!section) return null;
      const body = await researchBodyForCatalogSection(section);
      const source = { ...section, sectionID: String(section.id), body,
        text: body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n') };
      return { ...source, crossReferences: researchAssemblyCrossReferences(source, resources.catalog) };
    };
    const distractors = mode === 'mock_walkway_semantics' ? searchResearchPassages(resources.passageIndex,
      'public walkway walking surface bathroom height passageway maintenance', { limit: 20, passagesPerSection: 8 })
      .filter(hit => !(/condensate/i.test(hit.text) && /cooling coils|evaporators/i.test(hit.text)) &&
        !/means of egress[^.]{0,150}(?:obstruct|free|unimpeded)/i.test(hit.text)).slice(0, 12) : [];
    const packet = mode === 'actual_app_lexical'
      ? await assembledResearchEvidenceForTurn({ ...request, corpusPlan, pinnedEvidence: [], projectFacts: [] })
      : await assembleResearchEvidence({ question: request.question, previousMessages: request.messages, topicContext: request.topicContext,
          projectFacts: [], pinnedEvidence: [], resolveSection: resolver, discover: async asked => {
            assert.equal(asked.retrievalContext.currentQuestion, request.question);
            return discovery = await discoverRelevantEvidence({ question: asked.question, retrievalContext: asked.retrievalContext,
              ...resources, limit: asked.limit, readSectionBody: researchBodyForCatalogSection,
              semanticSearch: { search: async () => ({ hits: distractors.map((hit, i) => ({ ...hit, score: 1 - i / 100, passages: [hit] })),
                metadata: { enabled: true, mockProvider: true } }) } });
          } });
    const proof = [];
    const decisive = mode === 'mock_walkway_semantics' && input.id === 'egress-reset'
      ? expected.filter(([prefix]) => prefix === 'FC') : expected;
    for (const [prefix, number] of decisive) {
      const source = packet.sources.find(s => s.codePrefix === prefix && s.sectionNumber === number);
      const section = resources.catalog.find(s => s.codePrefix === prefix && s.sectionNumber === number);
      assert(section && source, input.id + ' ' + mode + ': complete requested source ' + prefix + ' ' + number);
      const body = await researchBodyForCatalogSection(section);
      const canonical = body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n');
      assert(compact(source.text).includes(compact(canonical)), input.id + ': full operative source and all scope/exception text');
      assert(source.canonicalContextComplete && !source.truncated);
      if (source.indexedPassage) {
        const offsets = source.indexedPassage.sourceOffsets;
        const block = body.blocks.find(block => block.id === offsets?.blockID);
        assert(block && source.indexedPassage.sourceTextHash === hash(block.plainText), 'Indexed evidence binds the fresh full block.');
        assert(Number.isSafeInteger(offsets.start) && Number.isSafeInteger(offsets.end) && offsets.start >= 0 &&
          offsets.end > offsets.start && offsets.end <= block.plainText.length, 'Indexed offsets remain inside that canonical body.');
      }
      proof.push({ sectionID: source.sectionID, codePrefix: prefix, sectionNumber: number,
        corpusID: source.corpusID, codeEdition: source.codeEdition, codeVersion: source.codeVersion,
        canonicalBodySHA256: hash(canonical), deliveredSHA256: hash(source.text), fullCanonicalBodyPresent: true });
    }
    assert(packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= packet.limits.maximumCharacters);
    realProof.turns.push({ id: input.id, mode, question: input.question, sources: proof, usage: packet.usage,
      mockSourceReferences: distractors.map(s => s.codePrefix + ' ' + s.sectionNumber),
      optionalParallelReferencesAbsent: expected.filter(([prefix, number]) => !decisive.some(([p, n]) => p === prefix && n === number) &&
        !packet.sources.some(s => s.codePrefix === prefix && s.sectionNumber === number)),
      candidates: discovery?.candidates.map(s => ({ reference: s.codePrefix + ' ' + s.sectionNumber, rank: s.rank, signals: s.signals })),
      limits: packet.limits, catalogCount: resources.catalog.length, passageCount: resources.passageIndex.passages.length });
    }
  }
}
assert.equal(providerCalls, 0);
const report = { contract: 'research-ordinary-action-continuity', providerCalls, sourceProof, realProof,
  runtimeHashes: Object.fromEntries(['research-search-vocabulary.mjs', 'research-conversation-topic.mjs', 'evidence-discovery.mjs',
    'research-evidence-assembly.mjs'].map(file =>
    [file, hash(fs.readFileSync(new URL('../' + file, import.meta.url)))])) };
if (process.env.PERMITEXT_ORDINARY_ACTION_VALIDATION_PATH) fs.writeFileSync(process.env.PERMITEXT_ORDINARY_ACTION_VALIDATION_PATH,
  JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ contract: report.contract, providerCalls, negativeQuestions: negativeQuestions.length,
  syntheticCanonicalRules: sourceProof.length, realTurns: realProof?.turns.length || 0 }));
