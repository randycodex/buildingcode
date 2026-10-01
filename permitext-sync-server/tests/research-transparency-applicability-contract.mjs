import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { researchProjectInformation, researchCorpusPlanForTurn, assembledResearchEvidenceForTurn } from '../app.mjs';
import { planZoningResearchQuestion, zoningResearchEvidenceLimits, zoningResearchPromptContext } from '../research-zoning-planner.mjs';
import { targetedDefinitionExcerpt } from '../research-definition-excerpts.mjs';
import { zoningSection, zoningSectionSummary } from '../zoning-content.mjs';
import { activeResearchTopicContext } from '../research-context-state.mjs';
import { requiredResearchClaimsFromEvidence } from '../research-required-claim-coverage.mjs';

// Real authored-corpus retrieval, with no provider or property lookup calls.
globalThis.fetch = async () => { throw new Error('External calls forbidden'); };
const fixture = JSON.parse(await readFile(new URL('./fixtures/research-transparency-project-facts.json', import.meta.url), 'utf8'));
const projectFacts = researchProjectInformation('project', fixture).facts;
assert(projectFacts.some(fact => fact.includes('Within a mapped Appendix I transit zone')));
assert(projectFacts.some(fact => fact.includes('Special Purpose District: None mapped')));
assert(projectFacts.some(fact => fact.includes('Year Built: 1966') && fact.includes('existing-property record')));

async function assemble(question, { messages = [], topicContext = null, facts = projectFacts } = {}) {
  const corpusPlan = await researchCorpusPlanForTurn({ question, messages, projectFacts: facts });
  const zoningPlan = planZoningResearchQuestion({ question, projectFacts: facts, topicContext });
  assert.deepEqual(zoningPlan.evidenceLimits, zoningResearchEvidenceLimits(zoningPlan));
  return assembledResearchEvidenceForTurn({ question, messages, topicContext, projectFacts: facts, corpusPlan, zoningPlan });
}

function assertApplicabilityPacket(evidence) {
  for (const number of ['37-31', '37-311', '37-34', '32-30', '32-321', '32-301', '32-302', '32-31', '32-311', '32-322', '32-33', '32-34']) {
    const source = evidence.sources.find(source => source.sectionNumber === number);
    assert(source?.canonicalContextComplete, `${number} must include its complete rule and qualifications.`);
    assert.equal(source.truncated, false);
  }
  const definitions = evidence.sources.find(source => source.sectionNumber === '12-10');
  assert(definitions?.targetedDefinition?.completeDefinitionEntries);
  assert.equal(definitions.canonicalContextComplete, false, 'Two complete definitions are not the whole 12-10 section.');
  assert.equal(definitions.truncated, false);
  assert.deepEqual(definitions.targetedDefinition.labels, ['community facility building', 'special streetscape area']);
  assert.match(definitions.text, /building used only for a community facility use/);
  assert.match(definitions.text, /boundaries shown in APPENDIX I/);
  assert.match(definitions.text, /Governors Island/);
  assert.match(definitions.text, /Long Island City/);
  assert(definitions.text.length < 1_000, 'Retrieve complete relevant entries, not the 268K-character definition section.');
  assert.equal(evidence.usage.targetedDefinitionCount, 1);
  assert(!evidence.sources.some(source => ['APPENDIX J', '42-19', '66-11'].includes(source.sectionNumber)));
  assert(!evidence.limitations.some(item => item.kind === 'topic-dependency-coverage-gap'));
  assert(!evidence.sources.some(source => source.truncated));
  assert(evidence.usage.finalCharacterCount < 20_000);
}

const initial = await assemble(fixture.questions[0]);
assertApplicabilityPacket(initial);
assert.equal(requiredResearchClaimsFromEvidence(initial.sources).length, 0, 'Alternative frameworks are review sources, not mandatory prose.');
for (const number of ['32-321', '37-34']) assert.equal(initial.sources.find(source => source.sectionNumber === number).evidencePriority.evidenceRole, 'supporting');
const explicit = await assemble('Explain the transparency requirements in ZR 37-34.');
assert.equal(explicit.sources.find(source => source.sectionNumber === '37-34')?.evidencePriority?.claimCoverageRequired, true, 'An explicitly requested rule retains mandatory source coverage.');
assert.equal(explicit.sources.find(source => source.sectionNumber === '32-321')?.evidencePriority?.claimCoverageRequired, false);
// "None mapped" for a Special Purpose District is not evidence that the lot
// is outside the separately defined special streetscape area.
const withoutTransitFact = projectFacts.filter(fact => !fact.includes('Transit Zone:'));
assertApplicabilityPacket(await assemble(fixture.questions[0], { facts: withoutTransitFact }));

// A failed initial answer must not lose the question when the user supplies
// proposed work. Existing PLUTO facts do not replace that user statement.
const failedConversation = { messages: [
  { role: 'user', question: fixture.questions[0] },
  { role: 'assistant', answer: { mode: 'clarification', answerText: 'Which part should we discuss?' } }
] };
const topicContext = activeResearchTopicContext(failedConversation);
assertApplicabilityPacket(await assemble(fixture.questions[1], { messages: failedConversation.messages, topicContext }));
const prompt = zoningResearchPromptContext(planZoningResearchQuestion({ question: fixture.questions[1], projectFacts, topicContext }));
assert.match(prompt, /Existing property inventory is not the proposed building/);
assert.match(prompt, /Use mapped project facts that match the enacted definition as premises/);

// Narrow measurement follow-ups retain complete operative rules without the
// full classification investigation or unrelated opportunistic references.
const measurement = await assemble('Where should I measure the 2 feet from?', { messages: failedConversation.messages, topicContext });
for (const number of ['32-321', '37-34']) assert(measurement.sources.find(source => source.sectionNumber === number)?.canonicalContextComplete);
assert(!measurement.sources.some(source => source.sectionNumber === '12-10'));
assert(measurement.usage.finalCharacterCount < initial.usage.finalCharacterCount);

// Complete-definition dependencies fail explicitly when a label or sufficient
// room is missing; an incidental mention is never substituted for a definition.
const section = { ...await zoningSectionSummary('20018523'), body: await zoningSection('20018523') };
const options = { completeDefinitionLabels: ['special streetscape area', 'community facility building'] };
const exact = targetedDefinitionExcerpt(section, options.completeDefinitionLabels.join(' '), options);
assert(exact?.completeDefinitionEntries);
assert.equal(targetedDefinitionExcerpt(section, 'special streetscape area', { ...options, maximumCharacters: 100 }), null);
assert.equal(targetedDefinitionExcerpt(section, 'special streetscape area', { completeDefinitionLabels: ['missing definition'] }), null);
console.log('Transparency applicability passed: complete tier definitions, exceptions, alternate routes and scoped definitions; project facts remain premises; failed-answer continuity and narrow follow-ups stay bounded.');
