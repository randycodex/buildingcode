import assert from 'node:assert/strict';
import { researchCorpusPlanForTurn, assembledResearchEvidenceForTurn } from '../app.mjs';
import { planZoningResearchQuestion } from '../research-zoning-planner.mjs';
import { earlierResearchUserContext, researchClarificationAnswer, isCanonicalResearchClarification } from '../research-conversation-continuity.mjs';
import { researchPropertyAddress, researchPropertyContext } from '../research-property-context.mjs';
import { immutableResearchAnswer } from '../project-foundation-contract.mjs';

// Ordinary runtime: no unapproved-diagnostic override, no provider calls.
delete process.env.PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS;
globalThis.fetch = async () => { throw new Error('External calls forbidden'); };
const messages = [];
let topicContext = null;
for (const [question, expectedSection, narrative] of [
  ['Can you explain the transparency requirements for this project? The project is in schematic design phase, at 1070 Southern Blvd, Bronx', '37-34', 'ZR 37-34 sets transparency requirements; ZR 37-31 governs applicability.'],
  ["where should I measure the 2 feet from?", '37-34', 'ZR 37-34 measures from the adjoining sidewalk.'],
  ["yes, the sidewalk slopes. If I use the highest point to measure the 2 feet and at the lowest it is not higher than 2 feet 6 inches, should it be fine?", '37-34', 'ZR 37-34 distinguishes the measurement zone from the glazing start.'],
  ['what is the governing zr number?', '37-34', 'ZR 37-34 is the rule discussed; applicability is unresolved.'],
  ['then explain the 141-32', '141-32', 'ZR 141-32 is Special Open Space Provisions in the supplied edition.']
]) {
  const corpusPlan = await researchCorpusPlanForTurn({ question, messages });
  assert(corpusPlan.selected.some(corpus => corpus.id === 'nyc-zoning-resolution'));
  const evidence = await assembledResearchEvidenceForTurn({ question, messages, topicContext, corpusPlan,
    zoningPlan: planZoningResearchQuestion({ question }) });
  assert(evidence.sources.some(source => source.sectionNumber === expectedSection && source.canonicalContextComplete), `${question}: ${evidence.sources.map(source => source.sectionNumber)}`);
  if (!messages.length) assert(evidence.sources.some(source => source.sectionNumber === '37-31'));
  else {
    assert.equal(evidence.topicDecision.decision, 'continuation');
    if (question.startsWith('where should')) assert(evidence.sources.filter(source => source.codePrefix === 'ZR').every(source => !source.evidencePriority?.claimCoverageRequired), 'Remembered citations must not require repeating the prior answer.');
  }
  topicContext = { rootTopic: evidence.topicDecision.nextRootTopic.text, currentTopic: evidence.topicDecision.nextCurrentTopic.text };
  messages.push({ role: 'user', question }, { role: 'assistant', answer: { answerText: narrative } });
}
const longHistory = Array.from({ length: 230 }, (_, i) => ({ role: 'user', question: `Statement ${i}` }));
assert(earlierResearchUserContext(longHistory).includes('Statement 200'));
assert(earlierResearchUserContext(longHistory, 100).length <= 100);
const question = messages[0].question;
const clarification = researchClarificationAnswer(question);
assert(isCanonicalResearchClarification(question, clarification));
assert(!isCanonicalResearchClarification(question, { ...clarification, answerText: 'The building complies.' }));
assert(!isCanonicalResearchClarification(question, { ...clarification, supportedPoints: [{ explanation: 'Invented rule' }] }));
const record = immutableResearchAnswer({ id: 'answer', owner: { kind: 'user', id: 'test' }, conversationID: 'conversation',
  question, answer: clarification, evidence: [], citations: [], model: clarification.model,
  researchSystemVersion: 'test', createdAt: new Date().toISOString() });
assert(record);
assert.equal(researchPropertyAddress(question), '1070 Southern Blvd, Bronx');
assert.equal(researchPropertyAddress('Explain ZR 37-34.'), null);
assert.equal((await researchPropertyContext({ question, lookup: async () => { throw Error('Offline'); } })).status, 'unavailable');
console.log('Transparency continuity passed: five turns retrieve complete requested ZR text, ordinary Zoning enabled, history bounded, canonical clarification rejects tampering, property failure preserves the conversation.');
