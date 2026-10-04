import assert from 'node:assert/strict';
import { applyVerifiedProjectFollowups, researchResponseFollowupQuestions } from '../research-verification-followups.mjs';
const answer = { answerText: 'If Tier B applies, use the cited transparency standard.', citations: [{sectionID:'32-321'}], missingFacts: [], followUpQuestions: [] };
const question = 'Which ground-floor uses face the street?';
const reviewed = applyVerifiedProjectFollowups(answer, {pass:true,issues:[],projectFactQuestions:[question]});
assert.equal(reviewed.answerText, answer.answerText);
assert.deepEqual(reviewed.citations, answer.citations);
assert.deepEqual(reviewed.missingFacts,[question]);
assert.deepEqual(reviewed.followUpQuestions,[question]);
for (const type of ['unsupported_requirement','missed_material_conclusion','overstated_compliance','incorrect_citation']) {
 assert.equal(applyVerifiedProjectFollowups(answer,{pass:false,issues:[{type,detail:'Unresolved defect'}],projectFactQuestions:[question]}),answer);
}
assert.equal(applyVerifiedProjectFollowups(answer,{pass:true,issues:[{type:'unsupported_requirement'}],projectFactQuestions:[question]}),answer);
const existing = {...answer,missingFacts:[question],followUpQuestions:['Is this a new building?']};
assert.deepEqual(applyVerifiedProjectFollowups(existing,{pass:true,issues:[],projectFactQuestions:[question]}).followUpQuestions,existing.followUpQuestions);
assert.deepEqual(applyVerifiedProjectFollowups(existing,{pass:true,issues:[],projectFactQuestions:[question]}).missingFacts,[question]);

// An intentional empty final list is different from a legacy absent field.
// The internal evidence map cannot reopen intake after a completed response.
const analysis = { highValueFollowUpQuestions: ['What is the building occupancy?'] };
assert.deepEqual(researchResponseFollowupQuestions(answer, analysis), []);
assert.deepEqual(researchResponseFollowupQuestions({ answerText: 'Legacy scoped answer.' }, analysis), analysis.highValueFollowUpQuestions);
assert.deepEqual(researchResponseFollowupQuestions({ followUpQuestions: null }, analysis), [],
  'Malformed present answer metadata must not silently become an analysis question.');
assert.deepEqual(researchResponseFollowupQuestions(reviewed, analysis), [question],
  'A genuinely decisive question admitted by passing review remains visible even if the writer originally chose no question.');
assert.deepEqual(researchResponseFollowupQuestions(existing, analysis), existing.followUpQuestions);
assert.deepEqual(researchResponseFollowupQuestions(reviewed, analysis, { supportingGuidanceOnly: true }), []);
const before = structuredClone({ answer, reviewed, analysis });
const selected = researchResponseFollowupQuestions(reviewed, analysis);
selected.push('Unrelated mutation.');
const legacySelected = researchResponseFollowupQuestions({}, analysis);
legacySelected.length = 0;
assert.deepEqual({ answer, reviewed, analysis }, before, 'Delivery does not mutate stored answers, review questions or legacy analysis.');
assert.deepEqual(researchResponseFollowupQuestions({}, undefined), []);
console.log('Verified project follow-ups preserve decisive questions and supported answers; explicit empty lists prevent legacy intake injection and failed substantive reviews remain blocked.');
