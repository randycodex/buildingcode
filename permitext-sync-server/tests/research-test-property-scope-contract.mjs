import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { researchTestMediumVocabulary, researchSearchVocabulary, researchSearchVocabularyMatches } from '../research-search-vocabulary.mjs';
import { researchEvidenceRetrievalQuery, assembleResearchEvidence, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { researchClaimScopeInstruction } from '../research-claim-scope.mjs';
import { buildResearchRequestEnvelopeBuilders } from './research-request-envelope-preflight.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('Test-property contracts forbid provider calls.'); };
const sha = text => createHash('sha256').update(text).digest('hex');
const gasQuestion = 'Different question: the gas installer proposes using oxygen to pressure-test the new gas piping. Is that an acceptable test gas?';
const gasFollowUp = 'He corrected that to nitrogen. Is nitrogen acceptable for that test, or does the code require air only?';
const plumbingQuestion = 'We are pressure-testing new plastic plumbing drain piping. Could we use air for the test?';
const plumbingFollowUp = 'Correction: it is copper instead of plastic. Can we still use air for that test?';
const medium = q => researchTestMediumVocabulary(q);
for (const question of [gasQuestion, plumbingQuestion,
  'Could we pressure-test the plumbing piping using air?',
  'May we use nitrogen to pressure-test refrigerant piping under the Mechanical Code?',
  'Which test medium is permitted for this gas piping?']) {
  assert.equal(medium(question)?.subject, 'test_medium', question);
  assert(!/\d|shall|prohibited|permitted|(?:FGC|PC|MC)\s*\d/.test(medium(question).terms.join(' ')));
}
const gasQuery = researchEvidenceRetrievalQuery({ question: gasFollowUp,
  previousMessages: [{ role: 'user', question: gasQuestion }], topicContext: { rootTopic: gasQuestion, currentTopic: gasQuestion } });
const continuation = researchSearchVocabulary(gasQuery.question, { contextDependentFollowUp: gasQuery.contextDependentFollowUp,
  humanTopics: [gasQuery.conversationTopic, gasQuery.immediateContext] });
assert.equal(continuation.concepts[0].origin, 'human_context');
assert.deepEqual(continuation.concepts[0].materials, ['nitrogen']);
assert(!continuation.query.includes('oxygen'), 'History identifies the system; it cannot supply an old proposed material.');
assert(!continuation.query.includes('pressure'), 'History cannot supply the old pressure property.');
assert.equal(medium(gasFollowUp), null, 'A subjectless question cannot invent its physical system.');
for (const question of [
  'The note says "use oxygen to pressure-test the gas piping". How long should the test run?',
  'Do not use oxygen to pressure-test gas piping. What gauge should we select?',
  'We are not pressure-testing gas piping; could we use oxygen for a laboratory sample?',
  'Can we use oxygen for blood testing?',
  'How high is the test pressure for gas piping?',
  'Could oxygen be used for the gas piping test, and how long must it last?',
  'Compare oxygen for testing gas piping with air for testing plumbing piping.',
  'Is oxygen acceptable for that test? Different issue: what is the required pipe support?',
  'Could we use oxygen to clean the gas piping?',
  'Could we use oxygen to test software?',
  'What gauge measures oxygen while testing the gas piping?',
  'Can we use a nitrogen tank to test the gas piping?'
]) assert.equal(medium(question), null, question);
for (const question of ['New topic: is nitrogen acceptable for that test?',
  'Under the 2014 codes, is nitrogen acceptable for that test?',
  'Under the Mechanical Code, is nitrogen acceptable for that test?',
  'The previous issue is settled. New topic: could we use air for the test?']) {
  assert.equal(researchTestMediumVocabulary(question, { contextDependentFollowUp: true, humanTopics: ['Using the 2022 codes: ' + gasQuestion] }), null, question);
}
const gasText = 'The test medium shall be air, nitrogen, carbon dioxide or an inert gas. Oxygen shall not be used.';
const plumbingText = 'Air tests shall be made by forcing air into the system. Plastic piping shall not be tested using air. The test retains its stated pressure and duration conditions.';
const pressureText = 'Pressure readings shall be recorded. Exception: Coated piping shall be filled with air or an inert gas. All test duration periods are measured after stabilization of the testing medium.';
assert(researchSearchVocabularyMatches(gasText, medium(gasQuestion)));
assert(researchSearchVocabularyMatches(plumbingText, medium(plumbingQuestion)));
assert(!researchSearchVocabularyMatches(pressureText, medium(plumbingQuestion)), 'A pressure-rule reference to stabilization is not a material rule.');
assert(!researchSearchVocabularyMatches('Test medium. A pressure gauge is calibrated.', medium(gasQuestion)), 'A heading alone cannot establish an operative property.');
assert(!researchSearchVocabularyMatches('The test medium shall be air. Pressure is recorded.', medium(gasQuestion)), 'The current proposed material must appear in this whole rule, including prohibitions.');
assert(researchSearchVocabularyMatches('Tests shall be performed with an inert-dried gas. Oxygen and air shall not be used.', medium(gasQuestion)), 'An alternate enacted grammatical form retains material scope.');

const authority = { corpusID: 'synthetic-current-2022', codeVersion: 'fixture-current-1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, prefix, number, title, text) => ({ ...authority, id, sectionID: id, codePrefix: prefix, sectionNumber: number, title,
  text, canonicalText: text, body: { blocks: [{ id: id + '-body', plainText: text }] } });
for (const [family, question, followUp, text] of [['FGC', gasQuestion, gasFollowUp, gasText], ['PC', plumbingQuestion, plumbingFollowUp, plumbingText]]) {
  const target = section('property-' + family, family, '981.3', 'Testing materials', text);
  const pressure = section('pressure-' + family, family, '981.5', 'Pressure measurement', pressureText);
  const distractors = Array.from({ length: 12 }, (_, i) => section('background-' + family + '-' + i, family, '98' + (i + 2) + '.7', 'Pressure and piping arrangements',
    'The installer proposes using oxygen and air for pressure testing new gas and plumbing drain piping. The pressure, piping and gas test readings are recorded with a calibrated gauge.'));
  const catalog = [...distractors, target, pressure];
  const index = await buildResearchPassageIndex(catalog, async s => s.body);
  const semanticSearch = { search: async () => ({ hits: distractors.map((s, i) => {
    const passage = index.passages.find(p => p.sectionID === s.id);
    return { ...passage, score: 1 - i / 100, passages: [passage] };
  }), metadata: { enabled: true, mockProvider: true } }) };
  const citation = { ...pressure, evidenceRole: 'supporting', supportingPassages: [{ selectedText: pressure.text }] };
  const checkedHistory = [{ role: 'user', question }, { role: 'assistant', answer: { mode: 'openai',
    authorityStatus: 'supported_by_enacted_text', verification: { pass: true }, supportedPoints: [{ text: 'Prior answer discussed pressure testing.' }], citations: [citation] } }];
  const discover = async ({ q = question, messages = [], topicContext = null, changedBody = null, changedIndex = null,
    changedCatalog = null, extra = {}, limit = 12 } = {}) => {
    const query = researchEvidenceRetrievalQuery({ question: q, previousMessages: messages, topicContext });
    const found = await discoverRelevantEvidence({ question: query.retrievalQuery, retrievalContext: { ...query, currentQuestion: q, ...extra },
      catalog: changedCatalog || catalog, invertedIndex: new Map(), passageIndex: changedIndex || index,
      readSectionBody: async s => changedBody && s.id === target.id ? changedBody : s.body, semanticSearch, limit });
    return { query, found };
  };
  const { found } = await discover();
  const nominee = found.candidates.find(c => c.sectionID === target.id);
  assert(nominee && nominee.rank <= 10, family + ': current material property survives same-family pressure competition.');
  assert(!nominee.signals.exactReference && !nominee.signals.exactTopicRouteTarget);
  assert(found.candidates.length <= 12 && found.candidates.filter(c => c.signals.currentQuestionForeground).length <= 3);
  const packet = await assembleResearchEvidence({ question, discover: async request => {
    assert.equal(request.retrievalContext.currentQuestion, question); return found;
  }, resolveSection: async r => catalog.find(s => r.sectionID ? s.sectionID === r.sectionID : s.codePrefix === r.codePrefix && s.sectionNumber === r.sectionNumber),
  limits: { maximumDiscovered: 10, maximumCharacters: 12000, maximumCharactersPerSource: 2000 } });
  const delivered = packet.sources.find(s => s.sectionID === target.id);
  assert.equal(delivered?.text, target.text);
  assert(delivered.canonicalContextComplete && !delivered.truncated);
  assert.equal(delivered.indexedPassage.sourceTextHash, sha(target.text));
  assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: target.id + '-body', start: 0, end: target.text.length });
  assert(packet.usage.discoveredCount <= 10 && packet.usage.crossReferenceCount <= 6 && packet.usage.characterCount <= 12000);
  const related = await discover({ q: followUp, messages: checkedHistory, topicContext: { rootTopic: question, currentTopic: question } });
  assert(related.found.candidates.find(c => c.sectionID === target.id)?.rank <= 10, family + ': correction uses only current medium and human subject despite checked pressure hint.');
  for (const change of [{ corpusID: 'foreign-current' }, { codeVersion: 'stale-current' }, { codeEdition: '2014' }, { jurisdiction: '' },
    { referenceOnly: true }, { researchClaimEligible: false }, { textComplete: false }, { authorityClass: 'guidance' }]) {
    const bad = await discover({ changedCatalog: catalog.map(s => s.id === target.id ? { ...s, ...change } : s) });
    assert(!bad.found.candidates.find(c => c.sectionID === target.id)?.signals.currentQuestionForeground, 'Unbound source identity cannot acquire property reservation.');
  }
  for (const changedBody of [{ ...target.body, researchClaimEligible: false }, { ...target.body, truncated: true },
    { blocks: [{ ...target.body.blocks[0], researchClaimEligible: false }] },
    { blocks: [{ ...target.body.blocks[0], truncated: true }] },
    { blocks: [{ ...target.body.blocks[0], plainText: pressureText }] }]) {
    const bad = await discover({ changedBody });
    assert(!bad.found.candidates.find(c => c.sectionID === target.id)?.signals.currentQuestionForeground, 'Fresh operative bytes, eligibility and completeness retain authority.');
  }
  for (const key of ['hash', 'offset', 'scope']) {
    const changedIndex = structuredClone(index);
    for (const p of changedIndex.passages.filter(p => p.sectionID === target.id)) {
      if (key === 'hash') p.sourceTextHash = '0'.repeat(64);
      if (key === 'offset') p.sourceOffsets = { ...p.sourceOffsets, start: 1 };
      if (key === 'scope') { p.scopeComplete = false; p.completeSubsectionText = null; }
    }
    const bad = await discover({ changedIndex });
    assert(!bad.found.candidates.find(c => c.sectionID === target.id)?.signals.currentQuestionForeground, 'Hash/window/complete-subtree forgery cannot acquire property reservation.');
  }
  for (const extra of [{ relevanceComparison: true }, { sourceSelectionRestricted: true }]) {
    const bad = await discover({ extra });
    assert(!bad.found.candidates.find(c => c.sectionID === target.id)?.signals.currentQuestionForeground);
  }
  assert((await discover({ limit: 1 })).found.candidates.length <= 1);
  const pin = { ...pressure, selectedText: pressure.text, selectionMode: 'passage' };
  const restrictedQuestion = 'Based only on the selected passage, ' + question;
  let expanded = 0;
  const restricted = await assembleResearchEvidence({ question: restrictedQuestion, pinnedEvidence: [pin],
    strategy: researchEvidenceStrategyForTurn({ question: restrictedQuestion, pinnedEvidence: [pin] }),
    discover: async () => { expanded++; return found; }, resolveSection: async r => catalog.find(s => s.sectionID === r.sectionID) });
  assert.equal(expanded, 0); assert.equal(restricted.sources.length, 1); assert.equal(restricted.sources[0].text, pin.selectedText);
}

// These exercise the actual writer/reviewer request builders, not a substitute
// semantic grader. No instruction can itself prove a generated legal answer.
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const source = { sourceID: 'whole-material-rule', sectionID: 'bound-material-rule', codePrefix: 'PC', sectionNumber: '983.2',
  title: 'Test materials and explicit alternatives', codeEdition: '2022', corpusID: authority.corpusID, codeVersion: authority.codeVersion,
  text: 'The test medium shall be water. Exception: For the described metallic system, dry air may replace water when every stated condition is met.' };
const otherProperty = { ...source, sourceID: 'whole-pressure-rule', sectionID: 'bound-pressure-rule', sectionNumber: '983.6',
  title: 'Test pressure', text: 'The pressure shall satisfy the stated test procedure. Exception: A designated authority determines the procedure for the described system. This does not identify a different test medium.' };
const answer = { answerText: 'A direct answer retains the actual express medium alternative and its conditions.',
  supportedPoints: [{ sectionID: source.sectionID, sourceIDs: [source.sourceID], heading: 'Explicit medium alternative', explanation: 'The bounded conditional rule remains unchanged.' }],
  citations: [{ sectionID: source.sectionID, sourceIDs: [source.sourceID] }], missingFacts: ['Whether this is the described metallic system.'], followUpQuestions: [] };
const pristine = structuredClone({ source, otherProperty, answer });
for (const request of [buildAnswerRequest(plumbingQuestion, [source, otherProperty], 'offline-v36', { responseStyle: 'conversational' }),
  buildVerifierRequest(plumbingQuestion, [source, otherProperty], answer, 'offline-v36', { responseStyle: 'conversational' })]) {
  assert(request.instructions.includes(researchClaimScopeInstruction));
  assert(request.instructions.includes('exact regulated property'));
  assert(request.instructions.includes('Preserve genuine express alternatives and waivers'));
  assert(request.instructions.includes('earlier assistant'));
  assert(request.input.includes('TITLE: ' + source.title));
  assert(request.input.includes('TITLE: ' + otherProperty.title));
  assert(request.input.includes(source.text) && request.input.includes(otherProperty.text));
  assert(request.input.includes(source.sourceID) && request.input.includes(source.sectionID));
  assert.equal(request.text.format.strict, true);
}
assert.deepEqual({ source, otherProperty, answer }, pristine, 'A true property waiver and unresolved eligibility remain immutable in both stages.');

// Optional full authorized-corpus check uses the actual canonical resolver and
// assembly path. Mock pressure results do not stand in for hosted ranks.
let realProof = null;
if (process.argv.includes('--real-corpus')) {
  Object.assign(process.env, { NODE_ENV: 'test', PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0', PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1',
    PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING: '1', PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES: '1',
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: '1' });
  const app = await import('../app.mjs');
  const resources = await app.researchCorpusResources(await app.researchCorpusPlanForTurn({ question: plumbingQuestion,
    messages: [], projectFacts: [], pinnedEvidence: [] }));
  const resolveSection = async descriptor => {
    const s = resources.catalog.find(s => descriptor.sectionID ? String(s.id) === String(descriptor.sectionID)
      : s.codePrefix === descriptor.codePrefix && s.sectionNumber === descriptor.sectionNumber);
    if (!s) return null;
    const body = await app.researchBodyForCatalogSection(s);
    const resolved = { ...s, sectionID: String(s.id), body,
      text: body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n') };
    return { ...resolved, crossReferences: app.researchAssemblyCrossReferences(resolved, resources.catalog) };
  };
  const canonical = await resolveSection({ codePrefix: 'PC', sectionNumber: '312.3' });
  assert(canonical && canonical.text.startsWith('Plastic piping shall not be tested using air.'));
  assert(canonical.text.includes('15 minutes') && canonical.text.includes('ambient temperatures'));
  const pressure = await resolveSection({ codePrefix: 'PC', sectionNumber: '312.5' });
  const history = [{ role: 'user', question: plumbingQuestion }, { role: 'assistant', answer: { mode: 'openai',
    authorityStatus: 'supported_by_enacted_text', verification: { pass: true },
    supportedPoints: [{ text: 'The earlier checked source discusses a different test property.' }],
    citations: [{ ...pressure, text: undefined, body: undefined, evidenceRole: 'supporting',
      supportingPassages: [{ selectedText: pressure.text }] }] } }];
  const pressureNumbers = ['312.5', '312.1.1', '312.1.2', '312.2', '312.4', '312.9', '312.9.1', '312.9.2', '312.9.3', '312.6', '312.7', '312.10'];
  const mockHits = pressureNumbers.flatMap(number => resources.passageIndex.passages
    .filter(p => p.codePrefix === 'PC' && p.sectionNumber === number).slice(0, 1));
  realProof = { catalogCount: resources.catalog.length, passageCount: resources.passageIndex.passages.length,
    canonical: { reference: 'PC ' + canonical.sectionNumber, sectionID: canonical.sectionID, codeEdition: canonical.codeEdition,
      codeVersion: canonical.codeVersion, corpusID: canonical.corpusID, title: canonical.title, text: canonical.text, sha256: sha(canonical.text) },
    limitations: ['Empty project facts, constructed checked history, and mocked pressure competitors; not a reconstruction of hosted semantic ranking or writer packets. No generated answers or provider calls.'], turns: [] };
  for (const [name, question, previousMessages] of [['PC-initial-air', plumbingQuestion, []], ['PC-corrected-material-air', plumbingFollowUp, history]]) {
    for (const mode of ['lexical', 'mock_pressure_competition']) {
      let found = null;
      const packet = await assembleResearchEvidence({ question, previousMessages, projectFacts: [], pinnedEvidence: [],
        topicContext: previousMessages.length ? { rootTopic: plumbingQuestion, currentTopic: plumbingQuestion } : null,
        resolveSection, discover: async request => {
          assert.equal(request.retrievalContext.currentQuestion, question);
          found = await discoverRelevantEvidence({ question: request.question, retrievalContext: request.retrievalContext,
            ...resources, limit: request.limit, readSectionBody: app.researchBodyForCatalogSection,
            ...(mode === 'lexical' ? {} : { semanticSearch: { search: async () => ({ hits: mockHits.map((p, i) =>
              ({ ...p, score: 1 - i / 100, passages: [p] })), metadata: { enabled: true, mockProvider: true } }) } }) });
          return found;
        } });
      const supplied = packet.sources.find(s => s.sectionID === canonical.sectionID);
      assert(supplied && !supplied.truncated && supplied.canonicalContextComplete && supplied.text.includes(canonical.text), name + '/' + mode);
      assert(supplied.text.includes('Plastic piping shall not be tested using air.') && supplied.text.includes('15 minutes'));
      assert(supplied.codePrefix === canonical.codePrefix && supplied.codeVersion === canonical.codeVersion && supplied.corpusID === canonical.corpusID);
      assert(found.candidates.length <= 12 && packet.usage.discoveredCount <= 10 && packet.usage.crossReferenceCount <= 6 && packet.usage.characterCount <= 48000);
      realProof.turns.push({ name, mode, question, inheritedPressureHint: previousMessages.length > 0,
        rank: found.candidates.find(c => c.sectionID === canonical.sectionID)?.rank,
        signals: found.candidates.find(c => c.sectionID === canonical.sectionID)?.signals,
        suppliedText: supplied.text, suppliedTextSHA256: sha(supplied.text), indexedPassage: supplied.indexedPassage,
        sources: packet.sources.map(s => ({ reference: s.codePrefix + ' ' + s.sectionNumber, textSHA256: sha(s.text), length: s.text.length })), usage: packet.usage });
    }
  }
  for (const question of ['How high is the pressure for the plastic plumbing drain piping test?',
    'How long should the air test of the plastic plumbing drain piping run?']) {
    assert.equal(researchTestMediumVocabulary(question), null);
    realProof.turns.push({ name: 'PC-other-requested-property', question, testMaterialNomination: false });
  }
  const output = process.argv.find(value => value.startsWith('--output='))?.slice('--output='.length);
  if (output) fs.writeFileSync(output, JSON.stringify({ schema: 'permitext-test-property-real-corpus-proof-v1', realProof, providerCalls }, null, 2) + '\n');
}
assert.equal(providerCalls, 0);
console.log('Generic current test-property nomination: two families, checked-history corrections, fresh binding/scope/pin/cap negatives, and actual writer/reviewer property-waiver and identical-title envelopes pass.' +
  (realProof ? ' Actual PC full-index/assembly: four complete air-test packets plus two other-property negatives pass.' : '') + ' No semantic/provider acceptance claimed.');
