import assert from 'node:assert/strict';
import { researchModelConfiguration, researchAnswerConfigurationForEvidence } from '../research-config.mjs';
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from './research-request-envelope-preflight.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls += 1; throw new Error('Structural-effort contracts prohibit provider/network calls.'); };
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_MODEL: 'gpt-6-luna',
  PERMITEXT_RESEARCH_REASONING_EFFORT: 'low', PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: 'medium' };
const configuration = Object.freeze(researchModelConfiguration(environment));
const authority = { codePrefix: 'BC', corpusID: 'synthetic-current-code', codeVersion: 'synthetic-version',
  codeEdition: 'Synthetic enacted edition', jurisdiction: 'Synthetic jurisdiction' };
const definitions = { ...authority, sectionID: 'synthetic-dictionary', sectionNumber: '900', sourceID: 'dictionary-exact-entries',
  title: 'Synthetic complete scope definitions', text: 'Workshop building means a building used exclusively for fabrication. Mixed-purpose buildings contain more than one use.',
  canonicalContextComplete: false, truncated: false, targetedDefinition: { completeDefinitionEntries: true, labels: ['Workshop building', 'Mixed-purpose building'] } };
const frameworks = ['901', '902'].map(sectionNumber => ({ ...authority, sectionNumber, sectionID: `framework-${sectionNumber}`,
  sourceID: `framework-passage-${sectionNumber}`, title: 'Synthetic alternative framework',
  text: `${sectionNumber} The framework applies only when its stated location criteria are satisfied. Exception: workshop buildings are excluded; workshop rooms in mixed-purpose buildings are not excluded by this whole-building exception.`,
  canonicalContextComplete: true, truncated: false, evidencePriority: { applicabilityCandidate: true, claimCoverageRequired: false } }));
const evidence = [definitions, ...frameworks];
assert.deepEqual(researchAnswerConfigurationForEvidence(configuration, evidence), { ...configuration, reasoningEffort: 'medium' });
assert.equal(configuration.reasoningEffort, 'low', 'Configured effort is immutable.');
for (const narrow of [[], [definitions], frameworks, [definitions, frameworks[0]], [definitions, frameworks[0], frameworks[0]],
  [definitions, { ...frameworks[0], canonicalContextComplete: false }, frameworks[1]],
  [definitions, { ...frameworks[0], evidencePriority: {} }, frameworks[1]],
  [{ ...definitions, targetedDefinition: { completeDefinitionEntries: false } }, ...frameworks],
  [{ ...definitions, truncated: true }, ...frameworks],
  [{ ...definitions, text: '' }, ...frameworks]])
  assert.strictEqual(researchAnswerConfigurationForEvidence(configuration, narrow), configuration, 'Dictionary/one-framework/incomplete sources do not trigger.');
for (const field of Object.keys(authority)) for (const change of ['', 'different-authority']) {
  assert.strictEqual(researchAnswerConfigurationForEvidence(configuration, [{ ...definitions, [field]: change }, ...frameworks]), configuration);
  assert.strictEqual(researchAnswerConfigurationForEvidence(configuration, [definitions, frameworks[0], { ...frameworks[1], [field]: change }]), configuration);
}
for (const effort of ['medium', 'high', 'max']) {
  const preset = Object.freeze({ ...configuration, reasoningEffort: effort });
  assert.strictEqual(researchAnswerConfigurationForEvidence(preset, evidence), preset);
}
for (const model of ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-6-sol', 'gpt-6.1-sol']) {
  const preset = Object.freeze({ ...configuration, model });
  assert.strictEqual(researchAnswerConfigurationForEvidence(preset, evidence), preset);
}
assert.equal(researchAnswerConfigurationForEvidence({ ...configuration, model: 'gpt-6-luna-2026-09-30' }, evidence).reasoningEffort, 'medium');

const question = 'Explain which alternative framework applies to our mixed-purpose building, using the supplied complete definitions.';
const prior = { answerText: 'Synthetic prior answer.', supportedPoints: [{ explanation: 'Synthetic prior answer.', sectionID: frameworks[0].sectionID, sourceIDs: [frameworks[0].sourceID] }] };
const feedback = [{ type: 'missing_material_condition', detail: 'Retain the stated location qualification.' }];
let envelopeCount = 0;
for (const effort of ['low', 'medium', 'high']) {
  const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders({ ...environment, PERMITEXT_RESEARCH_REASONING_EFFORT: effort });
  for (const options of [{ responseStyle: 'conversational' }, { responseStyle: 'conversational', zoningPlan: { questionSignals: { streetscapeExplanation: true } } }]) {
    const draft = buildAnswerRequest(question, evidence, 'offline-structural-effort', options);
    const revision = buildAnswerRequest(question, evidence, 'offline-structural-effort', { ...options, revisionFeedback: feedback, previousInterpretation: prior });
    const narrow = buildAnswerRequest('What does workshop building mean?', [definitions], 'offline-structural-effort', options);
    const review = buildVerifierRequest(question, evidence, prior, 'offline-structural-effort', options);
    assert.equal(draft.reasoning.effort, effort === 'low' ? 'medium' : effort);
    assert.equal(revision.reasoning.effort, draft.reasoning.effort, 'Existing medium repair is preserved.');
    assert.equal(narrow.reasoning.effort, effort, 'A dictionary lookup retains configured effort.');
    assert.equal(review.reasoning.effort, 'medium', 'Reviewer configuration is unchanged.');
    assert.equal(draft.max_output_tokens, narrow.max_output_tokens);
    assert.equal(revision.max_output_tokens, draft.max_output_tokens);
    assert.equal(draft.service_tier, narrow.service_tier);
    assert.equal(draft.model, narrow.model);
    for (const request of [draft, revision, review]) {
      for (const source of evidence) {
        assert(request.input.includes(source.text));
        assert(request.input.includes(source.sourceID));
        assert(request.input.includes(source.sectionID));
      }
      assert.equal(request.text.format.strict, true);
      assert.equal(request.store, false);
    }
    assert.deepEqual(draft.text.format, revision.text.format, 'Exact source binding/schema is unchanged.');
    envelopeCount += 4;
  }
}
const { buildAnswerRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const otherModel = buildAnswerRequest(question, evidence, 'offline-structural-effort', { model: 'gpt-5.6-terra', responseStyle: 'conversational' });
assert.equal(otherModel.model, 'gpt-5.6-terra');
assert.equal(otherModel.reasoning.effort, 'low');
assert.equal(providerCalls, 0);
console.log(`Initial structural effort passed: ${envelopeCount} actual request envelopes; Luna low→medium only for complete same-authority definitions plus multiple complete applicability frameworks. Narrow/stronger/non-Luna/reviewer settings and exact-source caps preserved; no provider calls.`);
