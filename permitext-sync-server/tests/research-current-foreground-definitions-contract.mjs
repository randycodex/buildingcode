import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';
import { researchEmbeddedDefinitionCarrier, targetedDefinitionExcerpt } from '../research-definition-excerpts.mjs';

const authority = { corpusID: 'synthetic-current', codeVersion: 'current-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const fixture = (id, number, title, text, prefix = 'PC') => ({ ...authority, id, sectionID: id,
  codePrefix: prefix, sectionNumber: number, title, text, canonicalText: text,
  body: { blocks: [{ id: id + '-block', plainText: text }] } });
const question = 'What do we need to prevent scalding at the lavatory in the public restroom?';
const target = fixture('responsive', '990.7', 'Public hand washing',
  '990.7 Public hand washing. Conditioned water shall be delivered from lavatories in public toilet facilities. The approved device shall satisfy its complete stated eligibility requirements. Exception: Listed point of use equipment may use its stated alternative.');
const leading = fixture('literal-lead', '997.1', 'Public lavatory clearances',
  'Public lavatory clearances. Public lavatories in a public restroom require the stated room clearance.');
const distractors = Array.from({ length: 9 }, (_, i) => fixture('meaning-' + i, '98' + i + '.1', 'Fixture arrangement ' + i,
  'Fixture arrangement. Toilet fixtures, water closets, lavatories, plumbing fixture arrangements and drainage systems retain the specified fixture layout.'));
const foreign = fixture('foreign-topic', '975.1', 'Lavatory public restroom',
  'Public restroom lavatory public restroom. This is an unrelated mechanical arrangement.', 'MC');
const sections = [leading, ...distractors, target, foreign];
const index = await buildResearchPassageIndex(sections, async source => source.body);
const hit = id => index.passages.find(p => p.sectionID === id);
const discover = (q = question, limit = 12) => discoverRelevantEvidence({ question: q,
  retrievalContext: { currentQuestion: q, sourceQuery: q + '\nProject context: mechanical fixture layout arrangement water closet plumbing drainage.' },
  catalog: sections, passageIndex: index, invertedIndex: new Map(), readSectionBody: async source => source.body, limit,
  semanticSearch: { search: async () => ({ hits: [...distractors, leading].map((s, i) => ({ ...hit(s.id), score: 1 - i / 100,
    passages: [hit(s.id)] })), metadata: { enabled: true } }) } });
const result = await discover();
const foreground = result.candidates.find(c => c.sectionID === target.id);
assert(foreground?.signals.currentQuestionForeground, 'A complete current-family source is foregrounded before mixed-context nominees.');
assert(foreground.rank <= 5);
assert(!foreground.signals.currentQuestionLexicalReservation, 'The existing 70% reservation threshold is not relaxed.');
assert.equal(result.candidates.length, 12);
assert(!result.candidates.find(c => c.sectionID === foreign.id)?.signals.currentQuestionForeground);
assert(result.candidates.filter(c => c.signals.currentQuestionForeground).length <= 3);
const resolve = async request => sections.find(s => s.sectionID === request.sectionID) || null;
const packet = await assembleResearchEvidence({ question, discover: async () => result, resolveSection: resolve,
  limits: { maximumDiscovered: 10, maximumCharacters: 6000, maximumCharactersPerSource: 1000 } });
const delivered = packet.sources.find(s => s.sectionID === target.id);
assert(delivered?.canonicalContextComplete);
assert.equal(delivered.text, target.text, 'The entire operative rule and exception reach the smaller writer cutoff verbatim.');
assert(packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 6000);
const direct = await discover('Under PC 980.1 and PC 981.1, what applies to this public lavatory?', 2);
assert.deepEqual(direct.candidates.map(c => c.sectionNumber), ['980.1', '981.1']);
assert(direct.candidates.every(c => c.signals.exactReference));
const topicChange = await discover('Under the Mechanical Code, what duct arrangement applies?', 12);
assert(!topicChange.candidates.find(c => c.sectionID === target.id)?.signals.currentQuestionForeground,
  'An explicit current family/topic does not retain a stale plumbing foreground.');
const singleton = await discover(question, 1);
assert.equal(singleton.candidates.length, 1);
assert(!singleton.candidates[0].signals.currentQuestionForeground);

// A canonical registered record can physically carry a later definition
// chapter. Its identity and exact structural heading must remain distinguishable.
const entries = [
  ['UNRELATED MATERIAL', 'An incidental material. ' + 'unrelated filler '.repeat(1500)],
  ['CONDITIONED WATER', 'Water subject to the complete stated condition. Exception: The listed alternative applies only after approval.\n1. Retain the first eligibility condition.\n2. Retain the closing qualification.'],
  ['SERVICE OUTLET', 'An outlet used for the stated service. It includes both listed arrangements, but excludes the prohibited arrangement.'],
  ['FOREIGN TERM', 'A term from a different authority.'],
  ['INCIDENTAL PRODUCT', 'An unrelated product mentioned in a collateral provision.']
];
const heading = 'Section PC 992: General Definitions';
const intro = 'When an undefined term occurs, use its ordinarily accepted meaning.';
const definitionText = intro + '\n' + heading + '\n' + entries.map(([label, text]) => label + '. ' + text).join('\n');
const carrier = fixture('registered-carrier', '989.4', 'Undefined terms', definitionText);
carrier.body.blocks[0].html = '<p>' + intro + '</p><h6>' + heading + '</h6>' + entries.map(([label, text]) =>
  '<div class="Normal-Level">' + label + '. ' + text.replaceAll('\n', '<br>') + '</div>').join('');
const parsed = researchEmbeddedDefinitionCarrier(carrier);
assert(parsed);
assert.equal(parsed.sectionNumber, '992');
assert.equal(parsed.carrierSectionID, carrier.sectionID);
assert.equal(parsed.carrierSectionNumber, '989.4');
assert.equal(parsed.heading, heading);
const excerpt = targetedDefinitionExcerpt(carrier, 'CONDITIONED WATER SERVICE OUTLET', { maximumCharacters: 1000 });
assert(excerpt);
assert.deepEqual(excerpt.labels, ['CONDITIONED WATER', 'SERVICE OUTLET']);
assert.equal(excerpt.sectionID, carrier.sectionID);
assert.equal(excerpt.sectionNumber, '989.4', 'An embedded heading must not fabricate a registered chapter identity.');
assert.equal(excerpt.text, heading + '\n\n' + entries.slice(1, 3).map(([label, text]) => label + '. ' + text).join('\n\n'));
assert.match(excerpt.text, /closing qualification/);
for (const binding of [parsed, ...excerpt.canonicalEntryBindings]) {
  const block = carrier.body.blocks[binding.sourceOffsets.blockIndex];
  assert.equal(createHash('sha256').update(block.plainText).digest('hex'), binding.sourceTextHash);
  const actual = block.plainText.slice(binding.sourceOffsets.start, binding.sourceOffsets.end);
  assert.equal(actual.replace(/\s+/g, ' '), (binding.label ? excerpt.passages[excerpt.labels.indexOf(binding.label)] : heading).replace(/\s+/g, ' '));
}
assert.equal(researchEmbeddedDefinitionCarrier({ ...carrier, truncated: true }), null);
assert.equal(researchEmbeddedDefinitionCarrier({ ...carrier, codePrefix: 'MC' }), null);
assert.equal(researchEmbeddedDefinitionCarrier({ ...carrier, body: { blocks: [{ plainText: heading, html: '<h6>' + heading + '</h6>' }] } }), null,
  'A chapter title with no complete definitions is not a definition carrier.');
assert.equal(researchEmbeddedDefinitionCarrier({ ...carrier, body: { blocks: [{ plainText: '', html: carrier.body.blocks[0].html }] } }), null);
assert.equal(targetedDefinitionExcerpt(carrier, 'CONDITIONED WATER', { maximumCharacters: 80 }), null,
  'A complete definition and its heading are omitted atomically when their qualifications cannot fit.');
const followingHeading = 'Section MC 993: General Definitions';
const boundedCarrier = { ...carrier, body: { blocks: [{ ...carrier.body.blocks[0],
  plainText: definitionText + '\n' + followingHeading + '\nFOREIGN ENTRY. An entry outside this definition chapter.',
  html: carrier.body.blocks[0].html + '<h6>' + followingHeading + '</h6><div class="Normal-Level">FOREIGN ENTRY. An entry outside this definition chapter.</div>' }] } };
assert.equal(targetedDefinitionExcerpt(boundedCarrier, 'FOREIGN ENTRY', { maximumCharacters: 1000 }), null,
  'A subsequent canonical chapter cannot be recast as this carrier’s definition chapter.');
const incompleteBody = { ...carrier, body: { blocks: [{ ...carrier.body.blocks[0],
  plainText: definitionText.replace('2. Retain the closing qualification.', '') }] } };
assert.equal(targetedDefinitionExcerpt(incompleteBody, 'CONDITIONED WATER', { maximumCharacters: 1000 }), null,
  'An HTML entry whose closing qualification is not present in the exact canonical body cannot be supplied.');

const operative = fixture('operative', '996.2', 'Public lavatory temperature',
  'Public lavatory temperature. Lavatories in public facilities shall deliver CONDITIONED WATER through a SERVICE OUTLET under the complete approved conditions.');
const incidental = fixture('incidental', '997.2', 'Other occupancies and areas',
  'Public lavatories occur in retail areas. INCIDENTAL PRODUCT and UNRELATED MATERIAL shall remain available for the collateral arrangement.');
const wrongEdition = { ...fixture('old-rule', '999.2', 'Public lavatory temperature',
  'Public lavatory temperature. Lavatories in public facilities use FOREIGN TERM.'), codeEdition: '2014', codeVersion: 'old-v1' };
const definitionsCandidate = { ...carrier, signals: { canonicalEmbeddedDefinitions: parsed } };
async function definitionPacket(q = question, opts = {}) {
  const sources = [operative, incidental, wrongEdition, carrier];
  return assembleResearchEvidence({ question: q, discover: async () => ({ candidates: [operative, incidental, wrongEdition],
    supplementalDefinitionCandidates: [definitionsCandidate] }),
    resolveSection: async request => sources.find(s => s.sectionID === request.sectionID) || null, ...opts });
}
const definitionsPacket = await definitionPacket();
const boundDefinitions = definitionsPacket.sources.find(s => s.targetedDefinition);
assert(boundDefinitions);
assert.deepEqual(boundDefinitions.targetedDefinition.labels, ['CONDITIONED WATER', 'SERVICE OUTLET'],
  'Only responsive same-authority operative terminology nominates definitions; collateral and historical prefixes cannot pollute them.');
assert.equal(boundDefinitions.text, excerpt.text);
assert.equal(boundDefinitions.sectionNumber, '989.4');
assert.equal(boundDefinitions.title, 'Undefined terms');
assert(definitionsPacket.usage.targetedDefinitionCount <= 2);
const foreignResolver = await definitionPacket(question, { resolveSection: async request => {
  const source = [operative, incidental, wrongEdition, carrier].find(s => s.sectionID === request.sectionID);
  return source?.sectionID === carrier.sectionID ? { ...source, jurisdiction: 'Another jurisdiction' } : source;
} });
assert(!foreignResolver.sources.some(s => s.targetedDefinition), 'Fresh canonical definition identity includes jurisdiction, not only code/version.');
const pin = { ...operative, selectionMode: 'passage', selectedText: 'Public lavatory temperature.' };
const pinnedQuestion = 'Based only on the selected passage, explain this public lavatory requirement.';
const pinned = await definitionPacket(pinnedQuestion, { pinnedEvidence: [pin],
  strategy: researchEvidenceStrategyForTurn({ question: pinnedQuestion, pinnedEvidence: [pin] }) });
assert(!pinned.sources.some(s => s.sectionID === carrier.sectionID), 'Strict selected evidence cannot grow an embedded dictionary.');
assert.equal(pinned.sources.find(s => s.origin === 'user_pinned').text, pin.selectedText);
console.log('Current foreground/operative definitions contract passed: fixed shortlist, full rule/exception, direct/family/count boundaries, precise embedded heading/entry hashes and offsets, full qualifications, incidental/foreign/truncated/empty/size/pin negatives.');
