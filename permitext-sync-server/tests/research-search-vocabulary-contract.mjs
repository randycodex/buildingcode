import assert from 'node:assert/strict';
import { researchSearchVocabulary, researchSearchVocabularyMatches } from '../research-search-vocabulary.mjs';
import { researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
import { researchQuestionSubject } from '../research-question-subject.mjs';

const subject = question => researchSearchVocabulary(question).concepts.map(value => value.subject);
for (const question of [
  'Can the hot-water tank safety relief pipe go directly into the drain?',
  'Does the relief discharge piping from a water heater need an air gap?',
  'Does a domestic hot water cylinder pressure safety device discharge through this pipe?'
]) assert.deepEqual(subject(question), ['relief_discharge']);
for (const question of [
  'May I operate a home-based business in my apartment?',
  'What restrictions apply to a business run from my dwelling?',
  'What is a home occupation?'
]) assert.deepEqual(subject(question), ['home_occupation']);
for (const question of [
  'Can cardboard cartons be stacked outdoors by the property line?',
  'How can we store packing materials outside?',
  'Could a pile of combustible packaging be placed in the open air?'
]) assert.deepEqual(subject(question), ['combustible_storage']);

for (const question of [
  'What safety relief pipe does this steam boiler need?',
  'Under the Mechanical Code, explain the hot-water tank safety pipe.',
  'We do not have a home business. What is the stair width?',
  'Can we store propane cylinders outdoors?',
  'The cardboard cartons will not be stored outdoors.',
  'An example said "cardboard cartons stacked outdoors". What is the office ceiling height?',
  'We have a hot-water tank safety pipe. What shower dimensions are required?',
  'The previous question was "different issue: home business". What guard height is required?'
]) assert.deepEqual(subject(question), [], question);

const original = 'For current NYC zoning, may I run a home business in my apartment?';
const correction = 'Correction: the business area will be smaller. Could I employ somebody who lives elsewhere?';
const follow = researchSearchVocabulary(correction, { contextDependentFollowUp: true, humanTopics: [original] });
assert.equal(follow.currentQuery, '');
assert.equal(follow.query, 'home occupation');
assert.equal(follow.concepts[0].origin, 'human_context');
assert(!researchSearchVocabulary(correction).query);
assert(!researchSearchVocabulary('Different issue: can customers use the stair?', {
  contextDependentFollowUp: true, humanTopics: [original] }).query);
assert(!researchSearchVocabulary('There is no home business. Can a customer use the stair?', {
  contextDependentFollowUp: true, humanTopics: [original] }).query);
assert(!researchSearchVocabulary('Under the Plumbing Code, can customers use this lavatory?', {
  contextDependentFollowUp: true, humanTopics: [original] }).query);

const query = researchEvidenceRetrievalQuery({ question: correction, previousTopic: original,
  previousMessages: [{role:'user', content:original}], topicContext:{rootTopic:original,currentTopic:original},
  projectFacts:['Additional Project facts (user-provided): The unrelated home business had 765432 square feet.'] });
assert.equal(query.question, correction, 'The writer receives the original human question.');
assert.match(query.semanticQuery, /Search vocabulary \(nomination only\): home occupation/);
assert.doesNotMatch(query.definitionQuery, /765432|Previous topic|checked answer/);
assert.match(query.definitionQuery, /home occupation/);
assert(query.semanticQuery.length <= 2000 && query.definitionQuery.length <= 2000);
assert(researchQuestionSubject('Can cardboard cartons be stored outdoors?').codePrefixes.includes('FC'));
assert(researchQuestionSubject('What rules limit a home-based business?').codePrefixes.includes('ZR'));
assert(researchSearchVocabularyMatches('Discharge piping serving a relief valve retains the full enacted requirements.', {subject:'relief_discharge'}));
assert(!researchSearchVocabularyMatches('Gas connector locations retain their full requirements.', {subject:'relief_discharge'}));
console.log('Ordinary vocabulary nomination, negative controls, and human-only continuity passed.');
