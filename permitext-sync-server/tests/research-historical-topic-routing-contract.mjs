import assert from 'node:assert/strict';
import { routeResearchCorpora, createResearchCorpusRegistry } from '../research-corpus-registry.mjs';
import { assembledResearchEvidenceForTurn } from '../app.mjs';
const registry = createResearchCorpusRegistry();
const current = 'nyc-2022-construction-codes';
const historical = 'nyc-1968-building-code';
const prior = 'nyc-2014-construction-codes';
const future = 'nyc-existing-building-code-2027';
const previousMessages = [
  { role: 'user', question: 'What are the ramp requirements in the 2022 Building Code?' },
  { role: 'assistant', answer: { answerText: 'The 2022 ramp provisions are in BC 1012.' } }
];
const question = 'Is there anything related to ramp in the 1968 code?';
for (const projectCodeVersion of [null, registry.find(item => item.id === current).codeVersion]) {
  const plan = routeResearchCorpora({ question, previousMessages, projectCodeVersion });
  assert.deepEqual(plan.selected.map(item => item.id), [historical]);
  assert.equal(plan.selected[0].applicabilityStatus, 'historical');
  assert.equal(plan.selected[0].automaticResearchEligible, false);
  const assembled = await assembledResearchEvidenceForTurn({ question, messages: previousMessages, pinnedEvidence: [], projectFacts: [], corpusPlan: plan });
  assert(assembled.sources.length > 0);
  assert(assembled.sources.every(item => item.codePrefix === 'BC68'));
  assert(assembled.sources.some(item => /ramps?/i.test(item.text)), 'Actual historical ramp text must be retrieved');
  console.log('Historical ramp evidence', assembled.sources.map(item => `${item.codePrefix} ${item.sectionNumber}`).join(', '));
}
const history = [...previousMessages];
for (const [turn, expected] of [
  ['what about 1968?', historical],
  ['What is the minimum ramp width?', historical],
  ['what about 2014?', prior],
  ['What is the minimum ramp width?', prior],
  ['what about 2022?', current],
  ['What is the minimum ramp width?', current],
  ['What does the Existing Building Code say about ramps?', future]
]) {
  const plan = routeResearchCorpora({ question: turn, previousMessages: history, projectCodeVersion: registry.find(item => item.id === current).codeVersion });
  assert.deepEqual(plan.selected.map(item => item.id), [expected], turn);
  history.push({ role: 'user', question: turn });
}
assert.deepEqual(routeResearchCorpora({ question: 'Compare ramp requirements in the 1968 and 2022 Building Codes', previousMessages }).selected.map(item => item.id), [current, historical]);
for (const edition of [2014, 2022]) for (const family of ['Building', 'Plumbing', 'Mechanical', 'Fuel Gas', 'Construction']) {
  assert.deepEqual(routeResearchCorpora({ question: `What does the ${edition} ${family} Code require?`, previousMessages }).selected.map(item => item.id), [edition === 2014 ? prior : current]);
}
for (const text of ['Can I apply the 1968 code to my project?', 'What did the 1968 Building Code require?', 'Find ramp provisions in BC68']) {
  assert.deepEqual(routeResearchCorpora({ question: text }).selected.map(item => item.id), [historical]);
}
assert.equal(routeResearchCorpora({ question: 'Does EBC apply to this project now?' }).selected[0].applicabilityStatus, 'future-effective');
assert(!routeResearchCorpora({ question: 'What are ramp requirements?' }).selected.some(item => [historical, future].includes(item.id)), 'Ordinary defaults do not silently opt into historical/future codes');
assert(!routeResearchCorpora({ question: 'The building was built in 1968. What are the ramp requirements?' }).selected.some(item => item.id === historical), 'Construction year alone is not an edition request');
console.log('Historical topical routing passed: exact screenshot question, actual BC68 ramp text, edition transitions, families, comparisons and applicability disclosure boundaries. No model calls.');

for (const turn of ['Is there anything related to ramp in the 1968 code?', 'What about handrails?']) {
  const messages = turn.startsWith('What') ? [...previousMessages, { role: 'user', question }] : previousMessages;
  assert.deepEqual(routeResearchCorpora({ question: turn, previousMessages: messages }).selected.map(item => item.id), [historical]);
}
const comparison = 'Compare ramp requirements in the 1968 and 2022 Building Codes';
assert.deepEqual(routeResearchCorpora({ question: 'What about handrails?', previousMessages: [...previousMessages, {role:'user',question:comparison}] }).selected.map(item => item.id), [current,historical]);
for (const turn of ['What does BC2014 say about ramps?', 'What does the 2014 code say about ramps?', 'What does BC2022 say about ramps?', 'What does the 2022 code say about ramps?']) {
  assert.deepEqual(routeResearchCorpora({question:turn, projectCodeVersion: registry.find(item=>item.id===prior).codeVersion}).selected.map(item=>item.id), [turn.includes('2014')?prior:current]);
}
for (const turn of ['What are ramp requirements in the 2008 Building Code?', 'What does BC2008 say about ramps?', 'What about 2008?']) {
  const plan = routeResearchCorpora({question:turn, previousMessages});
  assert.equal(plan.selected.length, 0, turn);
  assert.deepEqual(plan.unavailable.map(item=>item.id), ['nyc-2008-construction-codes']);
}
const ebcQuestion = 'What does the Existing Building Code say about ramps?';
const ebc = await assembledResearchEvidenceForTurn({question:ebcQuestion,messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:routeResearchCorpora({question:ebcQuestion})});
assert(ebc.sources.length > 0, 'Explicit EBC selection must load actual resources');
assert(ebc.sources.every(item=>item.codePrefix==='EBC'));
assert(ebc.sources.some(item=>/ramp/i.test(item.text)));
console.log('EBC actual evidence',ebc.sources.map(item=>`${item.codePrefix} ${item.sectionNumber}`).join(', '));

for (const [basis, turn, expected] of [
  ['What does the 2014 Building Code require for ramps?', 'What does BC 1010.2 say?', prior],
  ['What does the 2014 code require for ramps?', 'What does the Building Code require for handrails?', prior],
  [question, 'What does the Building Code require for handrails?', historical],
  ['What does the 2022 Building Code require for ramps?', 'The building was built in 1968. What are the ramp requirements?', current]
]) assert.deepEqual(routeResearchCorpora({question:turn,previousMessages:[{role:'user',question:basis}]}).selected.map(item=>item.id),[expected],turn);
const historicalHistory = [{ role: 'user', question }];
assert.deepEqual(routeResearchCorpora({ question: 'What does section 27-377 say?', previousMessages: historicalHistory }).selected.map(item => item.id), [historical]);
const explicitZoning = routeResearchCorpora({ question: 'What does ZR 27-377 say?', previousMessages: historicalHistory });
assert.deepEqual(explicitZoning.requestedCorpusIDs, ['nyc-zoning-resolution']);
assert(!explicitZoning.selected.some(item => item.id === historical));
