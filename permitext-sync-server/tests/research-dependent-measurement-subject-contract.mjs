import assert from 'node:assert/strict';
import { researchEvidenceRetrievalQuery, assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { researchClarificationAnswer, researchPriorAnswerSources } from '../research-conversation-continuity.mjs';
import { activeResearchMessages, activeResearchTopicContext, resetResearchActiveContext } from '../research-context-state.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';

globalThis.fetch = () => { throw Error('No external/provider calls'); };
const root = 'Can you explain the handrail height requirements for this project?';
const question = 'Where should I measure the 2 feet from?';
const conversation = { contextRevision: 0, messages: [
  { role: 'user', contextRevision: 0, question: root },
  { role: 'assistant', contextRevision: 0, answer: researchClarificationAnswer(root, 'verification_incomplete') }
] };
const topicContext = activeResearchTopicContext(conversation);
const messages = activeResearchMessages(conversation);
const query = q => researchEvidenceRetrievalQuery({ question: q, topicContext, previousMessages: messages });
const plan = query(question);
assert.equal(plan.topicDecision.decision, 'continuation');
assert.deepEqual(plan.dependentMeasurementSubject.terms, ['handrail']);
assert.equal(plan.dependentMeasurementSubject.source, 'active_user_topic');
assert.match(plan.semanticQuery, /^handrail: Where should I measure the 2 feet from\?/);
assert.deepEqual(plan.inheritedAuthorityReferences, []);
assert.deepEqual(researchPriorAnswerSources(messages), []);
assert(!plan.dependentMeasurementSubject.text.includes('2'), 'Old measurements cannot supply the new search subject.');
const transparencyRoot = 'can you explain the transparency requirements for this project?';
const transparencyMessages = [{ role: 'user', question: transparencyRoot },
  { role: 'assistant', answer: { ...researchClarificationAnswer(transparencyRoot, 'verification_incomplete'), citations: [{ codePrefix: 'FGC', sectionNumber: '990.1', title: 'Invented rejected draft subject' }] } }];
const transparencyTopic = { rootTopic: transparencyRoot, currentTopic: transparencyRoot };
const t2 = researchEvidenceRetrievalQuery({ question, previousMessages: transparencyMessages, topicContext: transparencyTopic });
assert.deepEqual(t2.dependentMeasurementSubject.terms, ['transparency']);
assert.deepEqual(t2.inheritedAuthorityReferences, []);
const t3 = researchEvidenceRetrievalQuery({ question: 'The sidewalk slopes. My level window sill is 2 feet above the sidewalk at the high end and 2 feet 6 inches at the low end. Is that okay, and how should I calculate the glazing area?',
  previousMessages: [...transparencyMessages, { role: 'user', question }, { role: 'assistant', answer: { verification: { pass: true }, supportedPoints: [], citations: [] } }],
  topicContext: { ...transparencyTopic, currentTopic: question } });
assert.deepEqual(t3.dependentMeasurementSubject.terms, ['transparency']);
assert.match(t3.semanticQuery, /^transparency: The sidewalk slopes/);
assert.doesNotMatch(t3.semanticQuery, /Invented rejected draft subject|FGC 990/);
for (const q of [
  'New topic: for hazardous glazing, where should I measure the height from?',
  'Under the Building Code, where should I measure safety-glazing height from?',
  'I am asking about hazardous glazing, not transparency. Where should I measure the height from?'
]) assert.equal(researchEvidenceRetrievalQuery({ question: q, previousMessages: transparencyMessages,
  topicContext: transparencyTopic }).dependentMeasurementSubject, null, 'A named new safety topic or explicit exclusion cannot retain the old measurement subject.');
const unanswered = { ...conversation, messages: [{ role: 'user', question: root, failure: { code: 'INTERRUPTED' } }] };
assert.equal(activeResearchTopicContext(unanswered), null, 'An unanswered failed request is not a completed withheld user topic.');
assert.equal(researchEvidenceRetrievalQuery({ question, topicContext: activeResearchTopicContext(resetResearchActiveContext(conversation, new Date().toISOString())), previousMessages: activeResearchMessages(resetResearchActiveContext(conversation, new Date().toISOString())) }).dependentMeasurementSubject, null);
for (const q of [
  'New topic: where should I measure duct clearance?',
  'Under the Plumbing Code, where should I measure the 2 feet from?',
  'In the 2014 edition, where should I measure the 2 feet from?',
  'Under BC 990.8, where should I measure the 2 feet from?',
  'Can you explain the permit renewal process?'
]) assert.equal(query(q).dependentMeasurementSubject, null, q);
const long = query('Where should I measure from? ' + 'a'.repeat(1970));
assert(long.semanticQuery.length <= 2000);

const authority = { corpusID: 'synthetic-current', codeVersion: 'synthetic-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, prefix = 'BC') => ({ ...authority, id, sectionID: id, sectionNumber: number, title, codePrefix: prefix, body: { blocks: [{ id: `${id}-body`, plainText: text }] } });
const lead = section('measurement-lead', '991.1', 'Survey distance', '991.1 Survey distance. Measure the stated feet from the marked survey endpoint. The survey distance remains as specified.');
const other = section('measurement-other', '992.1', 'Survey height', '992.1 Survey height. Measure the height from the marked survey endpoint in feet.');
const target = section('subject-rule', '990.2', 'Handrail measurement', '990.2 Handrail measurement. The handrail height shall be measured vertically from the adjacent finished surface. Exception: The approved recessed assembly retains the specified qualified datum.');

async function discover({ semantic = true, complete = true, authorized = true, changedIdentity = false, limit = 3, q = plan, rule = target } = {}) {
  const indexedTarget = changedIdentity ? { ...rule, codeVersion: 'old', codeEdition: '2014' } : rule;
  const index = await buildResearchPassageIndex([lead, other, indexedTarget], async s => s.body);
  if (!complete) index.passages.filter(p => p.sectionID === target.id).forEach(p => { p.scopeComplete = false; });
  const hit = id => index.passages.find(p => p.sectionID === id);
  const catalog = [lead, other, ...(authorized ? [rule] : [])];
  return discoverRelevantEvidence({ question: q.retrievalQuery, retrievalContext: { ...q, currentQuestion: q.question },
    catalog, passageIndex: index, invertedIndex: new Map(), availableCodePrefixes: ['BC'], readSectionBody: async s => s.body, limit,
    semanticSearch: semantic ? { search: async () => ({ hits: [lead, other].map((s, i) => ({ ...hit(s.id), score: .99 - i * .01, passages: [hit(s.id)] })) }) } : null });
}
for (const semantic of [false, true]) {
  const result = await discover({ semantic });
  assert(result.candidates.some(c => c.sectionID === target.id), 'Complete user-subject source survives generic measuring words with lexical-only and semantic crowding.');
  assert(result.candidates.length <= 3);
  assert(result.candidates.filter(c => c.signals.currentQuestionLexicalReservation).length <= 1);
  const packet = await assembleResearchEvidence({ question, previousMessages: messages, topicContext, discover: async () => result,
    resolveSection: async request => { const s = [lead, other, target].find(s => s.id === request.sectionID); return s ? { ...s, text: s.body.blocks[0].plainText } : null; },
    limits: { maximumDiscovered: 2, maximumCharacters: 3000, maximumCharactersPerSource: 1000 } });
  const source = packet.sources.find(s => s.sectionID === target.id);
  assert(source, 'The protected slot reaches the smaller writer packet.');
  assert.equal(source.text, target.body.blocks[0].plainText);
  assert(source.canonicalContextComplete && source.indexedPassage.completeSection);
  assert.match(source.text, /Exception: The approved recessed assembly/);
  assert(packet.usage.characterCount <= 3000 && packet.sources.every(s => s.text.length <= 1000));
}
for (const options of [{ complete: false }, { authorized: false }, { changedIdentity: true }]) {
  const result = await discover(options);
  assert(!result.candidates.some(c => c.signals.currentQuestionLexicalReservation?.kind === 'dependent_measurement_user_subject'), 'A fragment or unauthorized source cannot earn the measurement slot.');
}
const explicit = query('Under BC 991.1 and BC 992.1, where should I measure the 2 feet from?');
assert.deepEqual((await discover({ q: explicit, limit: 2 })).candidates.map(c => c.sectionID), [lead.id, other.id]);
const pinned = await assembleResearchEvidence({ question, previousMessages: messages, topicContext,
  pinnedEvidence: [{ ...target, selectedText: 'The handrail height shall be measured vertically from the adjacent finished surface.' }],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' }, discover: async () => { throw Error('Strict selected-only must not discover'); },
  resolveSection: async () => ({ ...target, text: target.body.blocks[0].plainText }) });
assert.equal(pinned.sources.length, 1);
assert.equal(pinned.sources[0].text, 'The handrail height shall be measured vertically from the adjacent finished surface.');

const changedEquipment = researchEvidenceRetrievalQuery({ question: 'Where should I measure the 4 inches from?',
  previousMessages: [{ role: 'user', question: 'Explain the refrigerant conduit clearance requirements.' }, { role: 'assistant', answer: researchClarificationAnswer('', 'verification_incomplete') }] });
assert.deepEqual(changedEquipment.dependentMeasurementSubject.terms, ['refrigerant', 'conduit']);
const changedRule = section(target.id, target.sectionNumber, 'Conduit clearance',
  '990.2 Conduit clearance. The refrigerant conduit clearance shall be measured from the listed finished casing only while its jacket remains installed. Exception: Listed recessed casings use their specified qualified datum.', 'MC');
assert((await discover({ q: changedEquipment, rule: changedRule })).candidates.some(c => c.sectionID === changedRule.id),
  'The same generic mechanism retains a different equipment subject and book without a section route.');
const noDetail = section(target.id, target.sectionNumber, 'Handrail arrangement',
  '990.2 Handrail arrangement. The handrail retains its listed arrangement. Exception: Listed recessed assemblies retain their qualification.');
assert(!(await discover({ rule: noDetail })).candidates.some(c => c.signals.currentQuestionLexicalReservation?.kind === 'dependent_measurement_user_subject'),
  'Subject overlap without the current measurement detail does not earn the slot.');
const oversized = section(target.id, target.sectionNumber, 'Handrail measurement',
  ('The handrail height shall be measured from the adjacent finished surface only with its specified qualified arrangement. ').repeat(140));
assert(!(await discover({ rule: oversized })).candidates.some(c => c.signals.currentQuestionLexicalReservation?.kind === 'dependent_measurement_user_subject'),
  'The unchanged per-source allowance cannot be bypassed by a complete but oversized rule.');
assert.equal(researchEvidenceRetrievalQuery({ question, previousMessages: [{ role: 'user', question: 'What are the basic requirements for this project?' }] }).dependentMeasurementSubject, null,
  'A generic previous question cannot invent an equipment subject.');
console.log('Dependent measurement subject passed: completed withheld user topic, lexical/meaning recall, exact complete source delivery, bounded slot, resets/authority changes, and strict selections.');
