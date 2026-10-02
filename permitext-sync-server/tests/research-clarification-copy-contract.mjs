import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {researchClarificationAnswer,isCanonicalResearchClarification,researchVerificationFailureReason} from '../research-conversation-continuity.mjs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const narrative=new Function(`${source.slice(source.indexOf('function researchDisplayText('),source.indexOf('function researchApplicabilityStatusLabel('))}; return researchAnswerNarrativeText;`)();
const failure=new Function(`${source.slice(source.indexOf('function researchFailureMessage('),source.indexOf('function renderNewResearchComposer('))}; return researchFailureMessage;`)();
for(const reason of ['verification','evidence']) {
 const question='Explain transparency';
 const answer=researchClarificationAnswer(question,reason);
 assert.equal(answer.answerText,answer.followUpQuestions[0]);
 assert.equal(answer.verification.pass,false);
 assert(isCanonicalResearchClarification(question,answer));
 const lead=reason==='verification'?'I couldn’t verify the explanation well enough to give you a reliable answer yet.':'I need more source information to explain this accurately.';
 const old={...answer,answerText:`${lead} We can continue in this conversation.\n\n${answer.answerText}`,conclusion:lead,explanation:answer.answerText};
 const original=JSON.stringify(old);
 assert(isCanonicalResearchClarification(question,old));
 assert.equal(narrative(old),answer.answerText);
 assert.equal(JSON.stringify(old),original);
 assert(!isCanonicalResearchClarification(question,{...old,answerText:'The building complies.'}));
}
const message=failure({code:'INVALID_RESEARCH_VERIFICATION'});
for (const [error,expected] of [
 [{code:'INVALID_RESEARCH_RESPONSE'}, /formatted/],
 [{code:'INVALID_RESEARCH_CITATION'}, /cited code passages/],
 [{verificationAttempts:[{issues:[{type:'missed_premise_contradiction'}]}]}, /project facts or scenario/],
 [{verificationAttempts:[{pass:false,issues:[{type:'missed_premise_contradiction'}]},
   {pass:false,issues:[{type:'unnecessary_qualification'}]}]}, /checking the draft/],
 [{code:'RESEARCH_VERIFICATION_FAILED'}, /checking the draft/]
]) {
 const answer=researchClarificationAnswer('The new building has retail space.',researchVerificationFailureReason(error));
 assert.match(answer.answerText,expected);
 assert.match(answer.answerText,/retry this question/i);
 assert.deepEqual(answer.followUpQuestions,[], 'An internal failure must not pretend the user owes a missing project fact');
 assert(isCanonicalResearchClarification('The new building has retail space.',answer));
 assert(!isCanonicalResearchClarification('The new building has retail space.',{...answer,answerText:'The building complies.'}));
}
assert.match(message,/processing error/);
assert.match(message,/Retry/);
assert.doesNotMatch(message,/could not complete its evidence check/);
assert.equal(narrative({answerText:'A substantive answer.'}),'A substantive answer.');
console.log('Clarification copy: question first, historical integrity preserved, processing failures explained with recovery.');

assert(source.includes('["RESEARCH_VERIFICATION_FAILED", "INVALID_RESEARCH_VERIFICATION"].includes(progress.errorCode)'), "Saved progress cards must translate historical verification errors too.");
