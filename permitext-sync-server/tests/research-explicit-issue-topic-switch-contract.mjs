import assert from 'node:assert/strict';
import {
  decideResearchConversationTopic,
  researchQuestionExplicitlySwitchesTopic
} from '../research-conversation-topic.mjs';
import { researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
import { createResearchCorpusRegistry, routeResearchCorpora } from '../research-corpus-registry.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No providers in topic-boundary contracts.'); };
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const construction = registry.find(corpus => corpus.id === 'nyc-2022-construction-codes');
const fire = registry.find(corpus => corpus.id === 'nyc-2022-fire-code');
const root = 'For this retail building, how high does the guard beside the walking platform need to be?';
const current = 'Correction: a fixed bench is beside that guard. Where do we measure from?';
const history = [
  { role: 'user', question: root },
  { role: 'user', question: current },
  { role: 'assistant', answer: {
    verification: { pass: true },
    supportedPoints: [{ statement: 'Synthetic checked prior guard source.' }],
    citations: [{ codePrefix: 'BC', sectionNumber: '880.3', sectionID: 'fixture-guard',
      corpusID: construction.id, codeEdition: construction.codeEdition, codeVersion: construction.codeVersion,
      title: 'Guard height', supportingPassages: [{ selectedText: 'The complete fixture guard-height qualification.' }] }]
  } }
];
const topicContext = { originalTopic: root, rootTopic: root, currentTopic: current };
const projectFacts = ['Occupancy: Retail', 'Zoning Fact — Zoning District: R7-1'];
const originalHistory = structuredClone(history), originalFacts = structuredClone(projectFacts);
const queried = question => researchEvidenceRetrievalQuery({ question, previousMessages: history, topicContext, projectFacts });
const requested = (question, extra = {}) => routeResearchCorpora({ question, registry, ...extra }).selected
  .filter(corpus => corpus.retrievalRole !== 'recall_only').map(corpus => corpus.id);

for (const question of [
  'Different issue at the same shop: can we stack ordinary cardboard cartons outdoors eight feet from the property line if they are just in the open, with no protective container or special fire-protection arrangement?',
  'Separate issue at this building: does the restroom need ventilation?',
  'Different problem at the same building: what size does the sanitary drain need to be?',
  'Another concern at our shop: where may the gas line run?',
  'Unrelated matter at the same property: is a fire extinguisher needed?',
  'New subject: can a hose connect to this water faucet?',
  'Different question: are those earlier rules relevant to the outdoor storage issue?'
]) {
  assert(researchQuestionExplicitlySwitchesTopic(question), question);
  const query = queried(question);
  assert.equal(query.topicDecision.decision, 'topic_switch', question);
  assert.equal(query.topicDecision.signals.explicitSwitch, true, question);
  assert.equal(query.previousTopicApplied, false, question);
  assert.equal(query.contextDependentFollowUp, false, question);
  assert.equal(query.resolvedSubjectContext, '', question);
  assert.equal(query.dependentMeasurementSubject, null, question);
  assert.deepEqual(query.inheritedAuthorityReferences, [], question);
  assert.deepEqual(query.activeRulePacketReferences, [], question);
  assert.equal(query.sourceQuery, question, question);
  assert(!query.semanticQuery.includes('walking platform') && !query.semanticQuery.includes('fixture-guard'), question);
  assert.equal(query.conversationTopic, question, question);
  assert.equal(query.immediateContext, question, question);
  assert.equal(query.topicDecision.signals.relevanceComparison, false, question);
}
assert.deepEqual(history, originalHistory, 'Old answers and user history remain immutable.');
assert.deepEqual(projectFacts, originalFacts, 'Saved project facts are a separate immutable input.');

for (const question of [
  '"Different issue at the same shop" is a quoted example. Where do we measure that guard?',
  '“Different issue” is a note on the drawing. Where do we measure the guard?',
  '`Different issue` is a label. Explain the guard measurement.',
  'Not a different issue: where do we measure the same guard?',
  'We do not want another subject. Explain that guard measurement.',
  'Is this a different issue, or the same guard requirement?',
  'The note says: Different issue. What does that guard rule mean?',
  'Correction: the same bench will be higher.',
  'What about the same guard beside an accessible ramp?',
  'Where should we measure the guard height from now?'
]) assert.equal(researchQuestionExplicitlySwitchesTopic(question), false, question);
assert.equal(queried('Correction: the same bench will be higher.').topicDecision.decision, 'correction');
assert.equal(queried('Where should we measure the guard height from now?').topicDecision.decision, 'continuation');
assert.equal(queried('What about the same guard beside an accessible ramp?').topicDecision.decision, 'continuation');
assert(queried('Where should we measure the guard height from now?').inheritedAuthorityReferences.length);
assert.equal(queried('Back to the original guard question, where do we measure?').topicDecision.signals.returnToOriginal, true);
assert.equal(decideResearchConversationTopic({
  question: 'How is BC 880.4 relevant to the original question under BC 880.3?',
  previousMessages: [{ role: 'user', question: 'Explain BC 880.3.' }]
}).decision, 'relevance_comparison');

const fireHistory = [{ role: 'user', question: 'Under the Fire Code, how should the outside cylinder cage be protected?' },
  { role: 'assistant', answer: { verification: { pass: true }, citations: [{
    codePrefix: 'FC', sectionNumber: '880.4', codeEdition: fire.codeEdition, codeVersion: fire.codeVersion, corpusID: fire.id
  }] } }];
assert.deepEqual(requested('Different issue at the same building: does the restroom need mechanical ventilation?',
  { previousMessages: fireHistory }), [construction.id]);
assert.deepEqual(requested('Different issue at the same shop: what paperwork is needed for the revised arrangement?',
  { previousMessages: fireHistory }), [construction.id],
  'No current family cue must not silently reintroduce the entire old Fire Code question.');
assert.deepEqual(requested('Different issue: consult both the Fire Code and the Plumbing Code for this design.',
  { previousMessages: fireHistory }), [construction.id, fire.id], 'Current mixed-authority requests remain independent.');

const priorEdition = [{ role: 'user', question: 'Under the 2014 Plumbing Code, compare the water fittings and the Fire Code cage requirements.' }];
assert.deepEqual(requested('Different issue at the same building: how much mechanical ventilation is needed?',
  { previousMessages: priorEdition }), ['nyc-2014-construction-codes'],
  'Keep the explicit prior edition preference, not the old incidental Fire Code subject.');
assert.deepEqual(requested('Different issue: under the 2022 Mechanical Code, how much ventilation is needed?',
  { previousMessages: priorEdition }), [construction.id], 'Current explicit edition has precedence.');
assert.deepEqual(requested('Different issue: under the Fire Code, how should the cylinder cage be protected?',
  { previousMessages: priorEdition }), [fire.id], 'An independently named current family changes authority.');
assert.deepEqual(requested('Different issue: explain this ramp.', {
  previousMessages: [{ role: 'user', question: 'Under the 1968 Building Code, explain the old stair and the Zoning Resolution floor-area rule.' }]
}), ['nyc-1968-building-code'], 'Preserve historical edition, not unrelated prior Zoning authority.');
assert.deepEqual(requested('Different issue: explain this ramp.', {
  previousMessages: [{ role: 'user', question: 'What does the future Existing Building Code say about stair alterations and Zoning Resolution bulk?' }]
}), ['nyc-existing-building-code-2027']);
const unavailable = routeResearchCorpora({ question: 'Different issue: explain this drain.', registry,
  previousMessages: [{ role: 'user', question: 'Under the 2008 Plumbing Code, explain this water fitting.' }] });
assert(unavailable.unavailable.some(corpus => corpus.id === 'nyc-2008-construction-codes'));
assert.deepEqual(unavailable.selected, [], 'Unavailable edition must not be replaced with a current book.');
assert.deepEqual(requested('Different issue: based only on the selected Building Code passages, explain this guard.',
  { previousMessages: fireHistory }), [construction.id]);
assert.deepEqual(requested('Different issue: based only on the 2014 Plumbing Code, explain this drain.',
  { previousMessages: fireHistory }), ['nyc-2014-construction-codes']);
assert.equal(providerCalls, 0);
console.log('Explicit issue topic switches passed: current user boundaries, no old rule/authority/measurement hints, immutable project/history inputs, genuine continuations, compact retained editions, mixed and selected-only scope. No providers.');
