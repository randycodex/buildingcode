import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { orderedResearchTopicDependencies, researchTopicDependencyPlan } from '../research-topic-dependencies.mjs';
import { zoningResearchEvidenceLimits, planZoningResearchQuestion } from '../research-zoning-planner.mjs';

for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = '1';
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = '1';
globalThis.fetch = () => { throw new Error('Dependency budget contracts prohibit provider/network calls.'); };
const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection, researchProjectInformation } = await import('../app.mjs');
const fixture = JSON.parse(await readFile(new URL('./fixtures/research-transparency-project-facts.json', import.meta.url), 'utf8'));
const question = fixture.questions[0];
const projectFacts = researchProjectInformation('budget-contract', fixture).facts;
const corpusPlan = await researchCorpusPlanForTurn({ question, projectFacts });
const { catalog } = await researchCorpusResources(corpusPlan);
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const canonical = new Map();
const key = value => `${value.codePrefix}:${value.sectionNumber}`;
async function resolve(reference) {
  const found = catalog.find(section => reference.sectionID
    ? String(section.id) === reference.sectionID
    : section.codePrefix === reference.codePrefix && section.sectionNumber === reference.sectionNumber &&
      ['codeVersion', 'codeEdition', 'corpusID', 'jurisdiction'].every(field => !reference[field] || section[field] === reference[field]));
  if (!found) return null;
  if (!canonical.has(key(found))) {
    const body = await researchBodyForCatalogSection(found);
    const canonicalText = compact([found.sectionNumber, found.title,
      ...(body.blocks || []).map(block => block.plainText || '')].join(' '));
    canonical.set(key(found), { ...found, sectionID: String(found.id), body, canonicalText, text: canonicalText, crossReferences: [] });
  }
  return canonical.get(key(found));
}

// These six identities/order were observed in the v13 production accounting
// packet. This unpaid replay reconstructs canonical candidates, not its missing
// semantic hit list; the actual production character ceiling was 24,000.
const observed = [['ZR', '32-321'], ['ZR', '63-23'], ['ZR', '37-34'], ['ZR', '64-523'], ['AC', '28-103.27'], ['BC', '3301.9.1.1']];
const candidates = await Promise.all(observed.map(async ([codePrefix, sectionNumber], index) => {
  const value = await resolve({ codePrefix, sectionNumber });
  assert(value, `${codePrefix} ${sectionNumber}: canonical production identity available`);
  return { ...value, rank: index + 1, score: 100 - index, selectedText: value.text };
}));
const questionPlan = planZoningResearchQuestion({ question, projectFacts });
const limits = { ...zoningResearchEvidenceLimits(questionPlan), maximumDiscovered: 6 };
assert.equal(limits.maximumCharacters, 24_000);
const reads = new Map();
async function build({ replacement = value => value, orderedCandidates = candidates, overrides = {}, pinnedEvidence = [], strategy = null } = {}) {
  reads.clear();
  return assembleResearchEvidence({ question, projectFacts, questionPlan, pinnedEvidence, strategy,
    limits: { ...limits, ...overrides },
    discover: async () => ({ candidates: orderedCandidates, retrievalVersion: 'observed-order-unpaid-reconstruction' }),
    resolveSection: async reference => {
      reads.set(key(reference), (reads.get(key(reference)) || 0) + 1);
      return replacement(await resolve(reference), reference);
    } });
}
const framework = ['37-31', '37-311', '37-34', '32-30', '32-321', '32-301', '32-302', '32-31', '32-311', '32-322', '32-33', '32-34'];
function assertCompletePackage(packet) {
  const anchor = packet.sources.find(source => source.codePrefix === 'ZR' && source.sectionNumber === '32-321');
  assert(anchor?.canonicalContextComplete);
  for (const sectionNumber of framework) {
    const source = packet.sources.find(source => source.codePrefix === 'ZR' && source.sectionNumber === sectionNumber);
    const own = canonical.get(`ZR:${sectionNumber}`);
    assert(source?.canonicalContextComplete && !source.truncated, `${sectionNumber}: full operative text and closing qualifications`);
    assert.equal(source.text, own.canonicalText, `${sectionNumber}: exact canonical text, including header and every condition`);
    for (const field of ['sectionID', 'title', 'codePrefix', 'codeEdition', 'codeVersion', 'corpusID', 'jurisdiction'])
      assert.equal(source[field], own[field], `${sectionNumber}: canonical ${field}`);
  }
  const definitions = packet.sources.find(source => source.sectionNumber === '12-10' && source.codePrefix === 'ZR');
  assert(definitions?.targetedDefinition?.completeDefinitionEntries);
  assert.equal(definitions.canonicalContextComplete, false);
  assert.equal(definitions.truncated, false);
  assert.deepEqual(definitions.targetedDefinition.labels, ['community facility building', 'special streetscape area']);
  assert.match(definitions.text, /building used only for a community facility use/);
  assert.match(definitions.text, /APPENDIX I/);
  assert.match(definitions.text, /Governors Island/);
  assert.match(definitions.text, /Long Island City/);
  assert(compact(canonical.get('ZR:12-10').canonicalText).includes(compact(definitions.text)) === false,
    'Separate complete entries are not represented as one contiguous whole-section selection.');
  for (const entry of definitions.text.split(/\n\n/).filter(Boolean))
    assert(compact(canonical.get('ZR:12-10').canonicalText).includes(compact(entry)), 'Every entry remains canonical enacted text.');
  for (const field of ['sectionID', 'title', 'codeEdition', 'codeVersion', 'corpusID', 'jurisdiction'])
    assert.equal(definitions[field], canonical.get('ZR:12-10')[field]);
  assert(!packet.limitations.some(item => item.kind === 'topic-dependency-coverage-gap'));
  assert.equal(packet.usage.characterCount, packet.sources.reduce((sum, source) => sum + source.text.length, 0));
  assert(packet.usage.characterCount <= 24_000);
  assert(packet.sources.every(source => source.text.length <= limits.maximumCharactersPerSource));
  assert(packet.usage.discoveredCount <= 6 && packet.usage.topicDependencyCount <= packet.limits.maximumTopicDependencies);
  return definitions;
}
const packet = await build();
const definitions = assertCompletePackage(packet);
assert.equal(reads.get('ZR:12-10'), 1, 'A successful reserved dependency is resolved once.');
assert.equal(orderedResearchTopicDependencies(researchTopicDependencyPlan({ question, sources: packet.sources }))[0].sectionNumber, '12-10');
// Changing incidental-source order cannot consume the reserved framework.
assertCompletePackage(await build({ orderedCandidates: [candidates[0], ...candidates.slice(1).reverse()] }));

for (const replacement of [
  value => value?.sectionNumber === '12-10' ? null : value,
  value => value?.sectionNumber === '12-10' ? { ...value, codeEdition: 'Other edition' } : value,
  value => value?.sectionNumber === '12-10' ? { ...value, jurisdiction: 'Other jurisdiction' } : value,
  value => value?.sectionNumber === '12-10' ? { ...value, sectionNumber: '12-11' } : value,
  value => value?.sectionNumber === '12-10' ? { ...value, body: { blocks: [] }, canonicalText: 'Definitions without the complete requested entries.', text: 'Definitions without the complete requested entries.' } : value
]) {
  const failed = await build({ replacement });
  assert(!failed.sources.some(source => source.codePrefix === 'ZR' && source.sectionNumber === '12-10'));
  assert(failed.limitations.some(item => item.kind === 'topic-dependency-coverage-gap' && item.text.includes('12-10')));
  assert.equal(reads.get('ZR:12-10'), 1, 'A failed/mismatched group is not retried in the same assembly.');
  assert(failed.usage.characterCount <= 24_000);
}
const tooSmall = await build({ overrides: { maximumCharacters: 400, maximumCharactersPerSource: 400 } });
assert(tooSmall.usage.characterCount <= 400);
assert(!tooSmall.sources.some(source => source.sectionNumber === '12-10'));

// A staged, incomplete or unidentified anchor cannot authorize the plan.
for (const changed of [
  { canonicalContextComplete: false }, { codeEdition: '' }, { codeVersion: '' }, { corpusID: '' }, { jurisdiction: '' }
]) assert.equal(researchTopicDependencyPlan({ question, sources: [{ ...packet.sources[0], ...changed }] }), null);
const exactSelection = candidates[0].text.slice(0, 200).trim();
const fragmentCandidates = [{ ...candidates[0], selectedText: exactSelection,
  signals: { useSelectedPassageOnly: true } }];
const fragment = await build({ orderedCandidates: fragmentCandidates });
assert(fragment.sources[0]?.discoveryPassageOnly);
assert(!fragment.sources.some(source => source.sectionNumber === '12-10'));

const pin = { ...candidates[0], selectedText: exactSelection };
const pinned = await build({ pinnedEvidence: [pin], orderedCandidates: [],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } });
assert(!pinned.sources.some(source => source.sectionNumber === '12-10'));
assert.equal(pinned.usage.topicDependencyCount, 0);
assert.equal(pinned.sources[0].text, pin.selectedText);
const capped = await build({ overrides: { maximumTopicDependencies: 1 } });
assert.equal(capped.usage.topicDependencyCount, 1);
assert(capped.limitations.some(item => item.kind === 'topic-dependency-coverage-gap'));
assert(capped.sources.some(source => source.sectionNumber === '12-10'));

console.log(JSON.stringify({ contract: 'complete-topic-dependency-budget', reconstruction: 'observed v13 six-source order; unpaid canonical resolver',
  characterCeiling: limits.maximumCharacters, characterCount: packet.usage.characterCount, sourceCount: packet.sources.length,
  completeFrameworkCount: framework.length, definitionCharacters: definitions.text.length,
  definitionSHA256: createHash('sha256').update(definitions.text).digest('hex'),
  sources: packet.sources.map(source => `${source.codePrefix} ${source.sectionNumber}`), providers: 0 }));
