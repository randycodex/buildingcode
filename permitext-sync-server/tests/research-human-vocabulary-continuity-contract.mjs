import assert from 'node:assert/strict';
import { decideResearchConversationTopic } from '../research-conversation-topic.mjs';
import { researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
import { createResearchCorpusRegistry, routeResearchCorpora } from '../research-corpus-registry.mjs';

let networkAttempts = 0;
globalThis.fetch = () => { networkAttempts++; throw Error('No providers in human-subject contracts.'); };
const root = 'Under current NYC zoning, may I run a home business in my apartment?';
const history = [{ role: 'user', question: root }];
const followUp = 'Could I employ one person who lives elsewhere? I have not specified the kind of business.';
const decide = (question, extra = {}) => decideResearchConversationTopic({ question, previousMessages: history, ...extra });
const retrieve = (question, extra = {}) => researchEvidenceRetrievalQuery({ question, previousMessages: history, ...extra });

const related = decide(followUp);
assert.equal(related.decision, 'continuation');
assert.equal(related.signals.humanVocabularySubjectContinuation, true);
assert.equal(related.signals.selfContained, false);
assert.equal(related.nextRootTopic.text, root);
const query = retrieve(followUp);
assert.equal(query.contextDependentFollowUp, true);
assert.equal(query.conversationTopic, root);
assert(query.sourceQuery.includes(root), 'The actual retrieval path retains the active human subject.');
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const routed = routeResearchCorpora({ question: followUp, previousMessages: history, registry });
assert(routed.selected.some(corpus => corpus.id === 'nyc-zoning-resolution' && corpus.retrievalRole !== 'recall_only'),
  'Related employment details retain the requested zoning book through ordinary corpus routing.');

for (const question of [
  'Could I store the business supplies in a closet?',
  'Would an employee who lives elsewhere count?',
  'If I reduce the business area to a smaller part of the apartment, does that change the result?'
]) {
  assert.equal(decide(question).signals.humanVocabularySubjectContinuation, true, question);
  assert.equal(decide(question).decision, 'continuation', question);
}

for (const question of [
  `Different issue: ${followUp}`,
  `Separate issue at the same apartment: ${followUp}`,
  `Another concern: ${followUp}`
]) {
  const result = decide(question);
  assert.equal(result.decision, 'topic_switch', question);
  assert.equal(result.signals.humanVocabularySubjectContinuation, false, question);
  assert.equal(retrieve(question).previousTopicApplied, false, question);
}

for (const question of [
  'Under the Plumbing Code, how much floor area is needed beside a lavatory?',
  'Under the Building Code, what floor area is needed at the stair landing?',
  'Under the Mechanical Code, how much floor area is needed for ventilation equipment?',
  'Under the Fire Code, may an employee operate a portable extinguisher?',
  'Under PC 880.1, how much area is needed for a plumbing installation?',
  'Under BC 880.2, how much area is needed for a stair installation?',
  'What exhaust airflow is required for an employee toilet room?',
  'What size sanitary drain is needed for the employees?',
  'How much area should be kept clear beside a boiler?',
  'What guardrail height is needed around the work area?',
  'Can a gas line run through the employee work area?'
]) {
  const result = decide(question);
  assert.equal(result.signals.humanVocabularySubjectContinuation, false, question);
  assert.equal(result.decision, 'topic_switch', question);
}
assert.equal(decide('Under the Fire Code, may an employee operate this extinguisher?')
  .signals.humanVocabularySubjectContinuation, false,
  'Existing pronoun-continuation behavior must not gain an unrelated human-vocabulary signal.');

const disjoint = decide('Under ZR 88-22, how much area is required?', {
  previousMessages: [{ role: 'user', question: `${root} See ZR 88-11.` }]
});
assert.equal(disjoint.signals.disjointExplicitReference, true);
assert.equal(disjoint.signals.humanVocabularySubjectContinuation, false);
assert.equal(disjoint.decision, 'topic_switch');

for (const question of [
  '"Could I employ one person?" is an example label. Explain a completely unrelated drainage installation.',
  '“business area” is a quoted example. Explain an unrelated stair landing.',
  'I am not asking about employees or business area. Explain the new gas piping arrangement.'
]) assert.equal(decide(question).signals.humanVocabularySubjectContinuation, false, question);
assert.equal(decide(followUp, { previousMessages: [] }).signals.humanVocabularySubjectContinuation, false,
  'No human topic means there is no omitted subject to inherit.');
assert.equal(decide(followUp, { previousMessages: [{ role: 'assistant', content: root }] })
  .signals.humanVocabularySubjectContinuation, false, 'Assistant prose cannot create a human subject.');
assert.equal(decide(followUp, { previousMessages: [
  { role: 'user', question: 'Explain the installation of a gas appliance.' },
  { role: 'assistant', answer: { citations: [{ title: root, codePrefix: 'ZR', sectionNumber: '88-11' }] } }
] }).signals.humanVocabularySubjectContinuation, false, 'Citation titles cannot create a human subject.');
assert.equal(decide('May I run a home business in my apartment?', {
  previousMessages: [{ role: 'user', question: 'How should a gas appliance be connected?' }]
}).signals.humanVocabularySubjectContinuation, false, 'A new explicit subject is not an inherited vocabulary signal.');
assert.equal(decide(followUp, {
  rootTopic: 'Under the Plumbing Code, how should a water heater relief valve discharge?',
  currentTopic: 'The discharge pipe runs to a receptor.',
  previousMessages: history
}).signals.humanVocabularySubjectContinuation, false, 'Active replacement topics take precedence over stale raw history.');
assert.deepEqual(history, [{ role: 'user', question: root }]);
assert.equal(networkAttempts, 0);
console.log('Human vocabulary continuity passed: positive active user subjects, related implicit details, explicit topic switches, competing books/devices, disjoint references and assistant/quotation/negation boundaries. No providers.');
