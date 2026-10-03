import assert from 'node:assert/strict';
import { researchFailedHumanMeasurementTopicContext } from '../research-measurement-subject.mjs';
import { activeResearchMessages, activeResearchTopicContext, resetResearchActiveContext } from '../research-context-state.mjs';
import { researchEvidenceRetrievalQuery, assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';

globalThis.fetch = () => { throw Error('No provider/network calls'); };
const root = 'can you explain the transparency requirements for this project?';
const current = 'Where should I measure the 2 feet from?';
const failed = { role: 'user', question: root, contextRevision: 0, failure: { code: 'RESEARCH_SPEND_CAP' } };
const conversation = { contextRevision: 0, messages: [failed,
  { role: 'assistant', failure: { code: 'RESEARCH_SPEND_CAP' }, answer: { answerText: 'Rejected draft claims 12 feet.', citations: [{ codePrefix: 'FGC', sectionNumber: '990.1' }] } }
] };
assert.deepEqual(activeResearchMessages(conversation), []);
assert.equal(activeResearchTopicContext(conversation), null, 'Failed history remains inactive; no fact or answer history is reactivated.');
function plan(q = current, c = conversation) {
  const topicContext = researchFailedHumanMeasurementTopicContext({ conversation: c, question: q, topicContext: activeResearchTopicContext(c) });
  return { topicContext, query: researchEvidenceRetrievalQuery({ question: q, topicContext, previousMessages: activeResearchMessages(c) }) };
}
const recovered = plan();
assert.deepEqual(recovered.topicContext.failedHumanSubjectRecovery.terms, ['transparency']);
assert.equal(recovered.topicContext.rootTopic, 'transparency');
assert.deepEqual(recovered.topicContext.factTopics, []);
assert.deepEqual(recovered.query.dependentMeasurementSubject.terms, ['transparency']);
assert.match(recovered.query.semanticQuery, /^transparency: Where should I measure the 2 feet from\?/);
assert.doesNotMatch(recovered.query.semanticQuery, /Rejected|12 feet|FGC/);
assert.deepEqual(recovered.query.inheritedAuthorityReferences, []);

// Real server fallthrough after the failed initial turn can save a sparse
// measurement root, plus an unrelated checked assistant citation. Recover the
// human subject without treating that assistant selection as authority.
const afterT2 = { ...conversation, topicContext: { contextRevision: 0, rootTopic: current, currentTopic: current,
  factTopics: [{ facts: ['Rejected prior scenario value 88 feet.'] }] }, messages: [...conversation.messages,
  { role: 'user', contextRevision: 0, question: current },
  { role: 'assistant', contextRevision: 0, answer: { verification: { pass: true }, answerText: 'An unrelated vent rule.',
    citations: [{ codePrefix: 'FGC', sectionNumber: '990.1', title: 'Unrelated gas vent height', sectionID: 'unrelated-vent', sourceID: 'unrelated-vent-source' }] } }
] };
const third = 'The sidewalk slopes. My level window sill is 2 feet above the sidewalk at the high end and 2 feet 6 inches at the low end. Is that okay, and how should I calculate the glazing area?';
const thirdPlan = plan(third, afterT2);
assert.equal(thirdPlan.topicContext.rootTopic, 'transparency');
assert.deepEqual(thirdPlan.topicContext.factTopics, []);
assert.deepEqual(thirdPlan.query.inheritedAuthorityReferences, []);
assert.match(thirdPlan.query.semanticQuery, /^transparency: The sidewalk slopes/);
assert.doesNotMatch(thirdPlan.query.semanticQuery, /vent|FGC|88 feet|12 feet/i);

const premiseRoot = 'The conduit is five feet long and serves an entirely commercial building. Can you explain the refrigerant conduit clearance requirements? It is eighteen inches high.';
const premiseConversation = { contextRevision: 3, messages: [{ ...failed, contextRevision: 3, question: premiseRoot, failure: { code: 'RESEARCH_INTERRUPTED' } }] };
const premise = plan('Where should I measure the 4 inches from?', premiseConversation);
assert.deepEqual(premise.topicContext.failedHumanSubjectRecovery.terms, ['refrigerant', 'conduit']);
assert.doesNotMatch(JSON.stringify(premise.topicContext), /five|eighteen|commercial|long|high|18|5/);

for (const q of [
  'What is the conduit material requirement?',
  'New topic: where should I measure duct clearance?',
  'Under the Plumbing Code, where should I measure the 2 feet from?',
  'Under FGC 990.1, where should I measure the 2 feet from?',
  'In the 2014 edition, where should I measure the 2 feet from?',
  'I am asking about hazardous glazing, not transparency. Where should I measure the height from?'
]) assert.equal(plan(q).topicContext, null, q);
for (const c of [
  resetResearchActiveContext(conversation, '2026-10-03T12:00:00.000Z'),
  { ...conversation, contextRevision: 1 },
  { ...conversation, contextRevision: undefined, movedAt: '2026-10-03T12:00:00.000Z', messages: [{ ...failed, createdAt: '2026-10-03T11:00:00.000Z' }] },
  { ...conversation, messages: [{ ...failed, failure: { status: 'cancelled' } }] },
  { ...conversation, messages: [{ ...failed, question: 'Under the 2014 Building Code, what handrail height applies?' }] },
  { ...conversation, messages: [failed, { role: 'user', contextRevision: 0, question: 'New topic: explain the duct dimensions.' }] },
  { ...conversation, messages: [failed, { role: 'user', contextRevision: 0, question: 'Under the Mechanical Code, what clearance applies?' }] }
]) assert(!plan(current, c).topicContext?.failedHumanSubjectRecovery, 'Reset/old/cancelled/new-authority/new-topic human history cannot recover stale subject.');

const authority = { codePrefix: 'BC', corpusID: 'synthetic-current', codeVersion: 'synthetic-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const source = (id, n, title, text) => ({ ...authority, id, sectionID: id, sectionNumber: n, title, body: { blocks: [{ id: id+'-body', plainText: text }] } });
const lead = source('lead', '991.1', 'Vent measurement', '991.1 Vent measurement. Measure the stated feet from the outlet.');
const other = source('other', '992.1', 'Survey height', '992.1 Survey height. Measure the height from the survey endpoint in feet.');
const target = source('target', '990.2', 'Transparency measurement', '990.2 Transparency measurement. Transparency shall be measured from the adjacent surface. Exception: The qualified recessed assembly uses its listed datum.');
const catalog = [lead, other, target];
const index = await buildResearchPassageIndex(catalog, async s => s.body);
const hits = [lead, other].map((s,i) => ({ ...index.passages.find(p => p.sectionID === s.id), score: .99-i*.01 }));
const result = await discoverRelevantEvidence({ question: recovered.query.retrievalQuery,
  retrievalContext: { ...recovered.query, currentQuestion: current }, catalog, passageIndex: index,
  invertedIndex: new Map(), availableCodePrefixes: ['BC'], readSectionBody: async s => s.body,
  semanticSearch: { search: async () => ({ hits }) }, limit: 3 });
assert(result.candidates.some(c => c.sectionID === target.id && c.signals.currentQuestionLexicalReservation?.kind === 'dependent_measurement_user_subject'));
const resolveSection = async r => { const s = catalog.find(s => s.id === r.sectionID); return s ? { ...s, text: s.body.blocks[0].plainText } : null; };
const packet = await assembleResearchEvidence({ question: current, previousMessages: activeResearchMessages(conversation), topicContext: recovered.topicContext,
  discover: async () => result, resolveSection, limits: { maximumDiscovered: 2, maximumCharacters: 3000, maximumCharactersPerSource: 1000 } });
const delivered = packet.sources.find(s => s.sectionID === target.id);
assert.equal(delivered.text, target.body.blocks[0].plainText);
assert(delivered.canonicalContextComplete && delivered.indexedPassage.completeSection);
assert(packet.usage.characterCount <= 3000 && packet.sources.length <= 2);
const selectedText = 'Transparency shall be measured from the adjacent surface.';
const pinned = await assembleResearchEvidence({ question: current, topicContext: recovered.topicContext, pinnedEvidence: [{ ...target, selectedText }],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' },
  discover: async () => { throw Error('Strict pin cannot expand'); }, resolveSection });
assert.equal(pinned.sources.length, 1); assert.equal(pinned.sources[0].text, selectedText);
console.log('Failed human measurement subject passed: exact active-revision human topic only; failed facts/assistant authority excluded; resets/new topics/editions preserved; exact bounded source and strict pin unchanged. Providers0.');
