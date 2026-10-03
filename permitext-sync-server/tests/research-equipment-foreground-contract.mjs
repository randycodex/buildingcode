import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { researchEquipmentSearchIntent, researchEquipmentSubjectMatches } from '../research-equipment-search-intent.mjs';
import { researchQuestionSubject } from '../research-question-subject.mjs';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';

globalThis.fetch = () => { throw Error('Provider calls forbidden in equipment retrieval contracts.'); };
const hash = text => createHash('sha256').update(text).digest('hex');
const originalQuestion = "For a separate NYC plumbing example, we're adding an outdoor hose faucet connected to the drinking-water line for ordinary cleaning. Is a device needed to stop water flowing backward, or is removing the hose after each use enough?";
const paraphrases = [originalQuestion,
  'We are adding an outside tap with garden-hose threads. Can dirty water flow back into the potable water line?',
  'Does a hose bib on the drinking water supply need protection against water going backward?',
  'For a sillcock, what should prevent water flowing backward into the drinking-water supply?',
  'The spigots beside the delivery doors are for washing the outdoor mats, and we will attach garden hoses. Can water go backward into the drinking-water line?',
  'We will attach a garden hose for cleaning the loading area to the taps. How do we stop water flowing backward into the potable-water supply?'];
for (const question of paraphrases) {
  const intent = researchEquipmentSearchIntent(question);
  assert(intent);
  assert.equal(intent.kind, 'positive_equipment_subject');
  assert.equal(intent.codePrefix, 'PC');
  assert(intent.query.length <= 80);
  assert(!/\d|vacuum|breaker|shall|required|exempt|PC/i.test(intent.query), 'Search vocabulary must not contain a legal identity, device result or numeric answer.');
  assert(researchQuestionSubject(question).codePrefixes.includes('PC'));
}
const negativeQuestions = [
  'What water temperature is needed at a public lavatory faucet?',
  'What flow is allowed at a drinking-water fountain?',
  'What prevents water flowing backward at a lavatory?',
  'This is not a hose faucet. What flow is allowed at the drinking fountain?',
  'Rather than a hose faucet, we have a public lavatory. What is its flow limit?',
  'Unlike the hose faucet, what is the temperature limit at this shower?',
  'We already have a hose faucet outside. What temperature is allowed at the lavatory?',
  'Compare the hose faucet and the lavatory. What applies to both?',
  'Under the Mechanical Code, what ventilation applies near the outdoor hose faucet?',
  'The old question was about a hose faucet. New topic: what size duct do we need?',
  'There is no hose faucet, hose bibb or sillcock. How is water flowing backward prevented?',
  'We do not want to remove the hose faucet. How does this affect the existing layout?',
  'For a natural-gas outlet where we connect a hose, what protection is needed?',
  'How should a hose connection on a propane supply be installed?',
  'What applies to this compressed-air hose connection?',
  'What applies to a fire department hose connection on the water supply?',
  'What is needed at a hose outlet?',
  'We already have a hose faucet. What drain valve is needed on the water heater?',
  "The quoted words 'hose faucet' are merely an example. What fixture layout applies?",
  'The words “hose faucet” are an example. What drinking fountain flow applies?'
];
for (const question of negativeQuestions) assert.equal(researchEquipmentSearchIntent(question), null, question);
assert(researchEquipmentSearchIntent('Correction: this is not a lavatory; it is a hose faucet. Is backflow protection needed?'));
assert(researchEquipmentSearchIntent('It is not a shower faucet, but a hose bib. What protection is needed?'));
assert(researchEquipmentSearchIntent('It is not a hose connection, but we do have a sillcock. What applies to that?'));
assert(researchEquipmentSearchIntent('It is not a natural-gas hose connection; it is a hose faucet on the drinking-water supply. What protection is needed?'));
assert(researchEquipmentSearchIntent('New topic: what protection is needed at a hose bib?'));
assert.equal(researchEquipmentSubjectMatches('Water quality and backflow rules govern generic outlets.', researchEquipmentSearchIntent(originalQuestion)), false);
assert.equal(researchEquipmentSubjectMatches('This rule is not about hose connections.', researchEquipmentSearchIntent(originalQuestion)), false);

const authority = { corpusID: 'synthetic-current', codeVersion: 'current-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const fixture = (id, number, title, text, extra = {}) => ({ ...authority, id, sectionID: id,
  codePrefix: 'PC', sectionNumber: number, title, text, canonicalText: text,
  body: { blocks: [{ id: id + '-block', plainText: text }] }, ...extra });
const target = fixture('equipment-source', '990.7', 'Hose connections',
  'Sillcocks, hose bibbs and openings with a hose connection shall meet the complete stated protective condition. Exceptions: A drain valve intended only for vessel draining is exempt. A listed supply valve has its complete stated eligibility condition.');
const distractors = Array.from({ length: 11 }, (_, i) => fixture('meaning-' + i, '98' + i + '.1', 'Drinking faucet fixture arrangements',
  'Plumbing drinking-water faucet fixtures have ordinary outdoor cleaning device arrangements. Toilet fixtures and lavatories retain their complete layout condition.'));
const background = Array.from({ length: 30 }, (_, i) => fixture('background-' + i, '97' + i + '.2', 'Supply hose layouts',
  'Hose layouts on water piping must meet the stated tubing arrangement. The complete tubing condition applies.'));
const sections = [...distractors, ...background, target];
const index = await buildResearchPassageIndex(sections, async section => section.body);
const hit = id => index.passages.find(passage => passage.sectionID === id);
const semantic = { search: async () => ({ hits: distractors.map((section, i) => ({ ...hit(section.id), score: 1 - i / 100,
  passages: [hit(section.id)] })), metadata: { enabled: true, mockProvider: true } }) };
const discover = (question = originalQuestion, extra = {}) => discoverRelevantEvidence({ question,
  retrievalContext: { currentQuestion: question, sourceQuery: question + '\nPrior unrelated question: hose faucet, roof, stair and ventilation arrangement.' },
  catalog: sections, passageIndex: index, invertedIndex: new Map(), semanticSearch: semantic,
  readSectionBody: async section => section.body, limit: 12, ...extra });
const result = await discover();
const selected = result.candidates.find(candidate => candidate.sectionID === target.id);
assert(selected?.signals.currentQuestionForeground, 'The equipment source must enter the actual fixed shortlist despite all semantic hits pointing elsewhere.');
assert.equal(selected.signals.currentQuestionForeground.source, 'positive_equipment_subject');
assert(selected.rank <= 10);
assert(result.candidates.length <= 12);
assert(result.candidates.filter(candidate => candidate.signals.currentQuestionForeground).length <= 3);
assert(!selected.signals.exactReference && !selected.signals.exactTopicRouteTarget);
const facts = [{ id: 'unchanged-fact', text: 'Existing roof path: 5 feet. A drinking fountain and a public lavatory also exist.' }];
const factsBefore = JSON.stringify(facts);
const packet = await assembleResearchEvidence({ question: originalQuestion, projectFacts: facts,
  discover: async request => { assert.equal(request.retrievalContext.currentQuestion, originalQuestion); return result; },
  resolveSection: async request => sections.find(section => section.sectionID === request.sectionID) || null,
  limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 } });
assert.equal(JSON.stringify(facts), factsBefore, 'The compact search query must not rewrite facts.');
const supplied = packet.sources.find(source => source.sectionID === target.id);
assert.equal(supplied?.text, target.text);
assert(supplied.canonicalContextComplete);
assert.equal(supplied.indexedPassage.sourceTextHash, hash(target.text));
assert.deepEqual(supplied.indexedPassage.sourceOffsets, { blockID: target.id + '-block', start: 0, end: target.text.length });
assert(packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 6000);

for (const question of negativeQuestions) {
  const negative = await discover(question);
  assert(!negative.candidates.some(candidate => candidate.signals.currentQuestionForeground?.source === 'positive_equipment_subject'), question);
}
const strictPin = { ...distractors[0], selectedText: 'Plumbing drinking-water faucet fixtures.', selectionMode: 'passage' };
const strictQuestion = 'Based only on the selected passage, what applies to this hose faucet?';
let strictDiscoveryCalls = 0;
const strictPacket = await assembleResearchEvidence({ question: strictQuestion, pinnedEvidence: [strictPin],
  strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [strictPin] }),
  discover: async () => { strictDiscoveryCalls++; return result; }, resolveSection: async request => sections.find(section => section.sectionID === request.sectionID) || null });
assert.equal(strictDiscoveryCalls, 0);
assert.equal(strictPacket.sources.length, 1);
assert.equal(strictPacket.sources[0].text, strictPin.selectedText);

const unavailableIndex = await buildResearchPassageIndex([...distractors, { ...target, codeEdition: '2014', codeVersion: 'old-v1' }], async section => section.body);
const wrongEdition = await discover(originalQuestion, { passageIndex: unavailableIndex, semanticSearch: null });
assert(!wrongEdition.candidates.some(candidate => candidate.sectionID === target.id && candidate.signals.currentQuestionForeground?.source === 'positive_equipment_subject'),
  'An old-edition index record cannot acquire an authorized current equipment foreground.');
for (const change of [{ corpusID: 'foreign-corpus' }, { jurisdiction: 'Another jurisdiction' }]) {
  const foreignIndex = await buildResearchPassageIndex([...distractors, { ...target, ...change }], async section => section.body);
  const foreign = await discover(originalQuestion, { passageIndex: foreignIndex, semanticSearch: null });
  assert(!foreign.candidates.some(candidate => candidate.sectionID === target.id && candidate.signals.currentQuestionForeground?.source === 'positive_equipment_subject'));
}
const tooSmall = await assembleResearchEvidence({ question: originalQuestion, discover: async () => result,
  resolveSection: async request => sections.find(section => section.sectionID === request.sectionID) || null,
  limits: { maximumDiscovered: 10, maximumCharacters: 50, maximumCharactersPerSource: 50 } });
assert(!tooSmall.sources.some(source => source.sectionID === target.id && source.canonicalContextComplete));
assert(tooSmall.usage.characterCount <= 50);
const direct = await discover('Under PC 980.1 and PC 981.1, what applies to this hose faucet?', { limit: 2 });
assert.deepEqual(direct.candidates.map(candidate => candidate.sectionNumber), ['980.1', '981.1']);
assert(direct.candidates.every(candidate => candidate.signals.exactReference));

let realProof = null;
if (process.argv.includes('--real-corpus')) {
  process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = '1';
  const { researchCorpusResources, researchBodyForCatalogSection } = await import('../app.mjs');
  const { createResearchCorpusRegistry } = await import('../research-corpus-registry.mjs');
  const selectedCorpora = createResearchCorpusRegistry({ zoningResearchEligibility: true }).filter(corpus =>
    ['nyc-2022-construction-codes', 'nyc-2022-fire-code', 'nyc-zoning-resolution'].includes(corpus.id));
  const resources = await researchCorpusResources({ selected: selectedCorpora });
  const operative = resources.catalog.find(section => section.codePrefix === 'PC' && section.sectionNumber === '608.15.4.2');
  const body = await researchBodyForCatalogSection(operative);
  const canonicalText = body.blocks.map(block => block.plainText || '').join('\n\n');
  // These deliberately distracting nominees come from the recorded initial
  // answer. The target is not injected into semantics, candidates or alternatives.
  const recordedOtherNumbers = ['608.16.8', '608.16.5', '410.3', '608.1', '604.4', '405.1', '608.2', '301.4', '1301.3.1', '410.1', '401.1', '601.1'];
  const otherHits = recordedOtherNumbers.map(number => resources.catalog.find(section => section.codePrefix === 'PC' && section.sectionNumber === number))
    .map(section => resources.passageIndex.passages.find(passage => passage.sectionID === String(section.id)));
  assert(otherHits.every(value => value && value.sectionID !== String(operative.id)));
  const resolver = async request => {
    const section = resources.catalog.find(section => String(section.id) === String(request.sectionID) ||
      section.codePrefix === request.codePrefix && section.sectionNumber === request.sectionNumber);
    if (!section) return null;
    const resolvedBody = await researchBodyForCatalogSection(section);
    return { ...section, sectionID: String(section.id), body: resolvedBody,
      text: resolvedBody.blocks.map(block => block.plainText || '').join('\n\n') };
  };
  realProof = { providerCalls: 0, authorizedCorpora: selectedCorpora.map(corpus => corpus.id),
    passageCount: resources.passageIndex.passages.length, canonicalTextHash: hash(canonicalText), turns: [] };
  for (const question of paraphrases) {
    const compactIntent = researchEquipmentSearchIntent(question);
    const foregroundProbe = searchResearchPassages(resources.passageIndex, compactIntent.query,
      { queryWeights: new Map(compactIntent.terms.map(term => [term, 1])), codePrefixes: ['PC'],
        explicitReferenceQuery: question, limit: 5, passagesPerSection: 8 });
    const probeTarget = foregroundProbe.find(passage => passage.sectionID === String(operative.id));
    assert(probeTarget && probeTarget.score / foregroundProbe[0].score >= 0.7);
    const discovered = await discoverRelevantEvidence({ question, retrievalContext: { currentQuestion: question, sourceQuery: question },
      ...resources, readSectionBody: researchBodyForCatalogSection, limit: 12,
      semanticSearch: { search: async () => ({ hits: otherHits.map((passage, i) => ({ ...passage, score: 1 - i / 100, passages: [passage] })),
        metadata: { enabled: true, mockProvider: true } }) } });
    const candidate = discovered.candidates.find(candidate => candidate.sectionID === String(operative.id));
    assert(candidate?.signals.currentQuestionForeground?.source === 'positive_equipment_subject', question);
    assert(candidate.rank <= 10, question);
    const assembled = await assembleResearchEvidence({ question, discover: async () => discovered, resolveSection: resolver,
      limits: { maximumDiscovered: 10, maximumCharacters: 24000, maximumCharactersPerSource: 12000 } });
    const delivered = assembled.sources.find(source => source.sectionID === String(operative.id));
    assert.equal(delivered?.text, canonicalText, question);
    assert(delivered.canonicalContextComplete);
    assert.equal(delivered.indexedPassage.sourceTextHash, hash(canonicalText));
    assert(delivered.indexedPassage.completeSection && delivered.indexedPassage.completeSubsection);
    assert(assembled.usage.discoveredCount <= 10 && assembled.usage.characterCount <= 24000);
    realProof.turns.push({ question, compactSearchQuery: compactIntent.query,
      foregroundProbe: foregroundProbe.map((passage, i) => ({ rank: i + 1, sectionID: passage.sectionID, sectionNumber: passage.sectionNumber,
        score: passage.score, scopeComplete: passage.scopeComplete })), relativeStrength: probeTarget.score / foregroundProbe[0].score,
      candidateRank: candidate.rank, foreground: candidate.signals.currentQuestionForeground,
      sectionID: delivered.sectionID, sectionNumber: delivered.sectionNumber, codePrefix: delivered.codePrefix,
      corpusID: delivered.corpusID, codeVersion: delivered.codeVersion, codeEdition: delivered.codeEdition, jurisdiction: delivered.jurisdiction,
      canonicalContextComplete: delivered.canonicalContextComplete, textCharacters: delivered.text.length,
      sourceTextHash: delivered.indexedPassage.sourceTextHash, sourceOffsets: delivered.indexedPassage.sourceOffsets,
      allExceptionsExact: delivered.text === canonicalText, characterCount: assembled.usage.characterCount,
      candidateCount: discovered.candidates.length, discoveredCount: assembled.usage.discoveredCount });
  }
}
if (process.env.PERMITEXT_EQUIPMENT_VALIDATION_PATH) fs.writeFileSync(process.env.PERMITEXT_EQUIPMENT_VALIDATION_PATH,
  JSON.stringify({ test: 'research-equipment-foreground-contract', providerCalls: 0, syntheticPassed: true, realProof }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ test: 'research-equipment-foreground-contract', syntheticPassed: true, realProof }, null, 2));
