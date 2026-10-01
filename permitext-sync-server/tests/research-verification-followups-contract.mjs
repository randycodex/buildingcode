import assert from 'node:assert/strict';
import { applyVerifiedProjectFollowups } from '../research-verification-followups.mjs';
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
console.log('Verified project follow-ups preserve supported answers; failed substantive reviews remain blocked.');
