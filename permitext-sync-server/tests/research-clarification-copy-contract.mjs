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
 [{code:'INVALID_RESEARCH_RESPONSE'}, /answer it couldn’t read/],
 [{code:'INVALID_RESEARCH_CITATION'}, /explanation and source references didn’t agree/],
 [{verificationAttempts:[{issues:[{type:'missed_premise_contradiction'}]}]}, /project details already provided/],
 [{verificationAttempts:[{pass:false,issues:[{type:'missed_premise_contradiction'}]},
   {pass:false,issues:[{type:'unnecessary_qualification'}]}]}, /sources it retrieved/],
 [{code:'RESEARCH_VERIFICATION_FAILED'}, /sources it retrieved/]
]) {
 const answer=researchClarificationAnswer('The new building has retail space.',researchVerificationFailureReason(error));
 assert.match(answer.answerText,expected);
 assert.match(answer.answerText,/You don’t need to repeat the question/);
 assert.doesNotMatch(answer.answerText,/you can retry|try again|retry this question/i);
 assert.equal(narrative(answer),answer.answerText, 'New server and web recovery wording must agree');
 assert.deepEqual(answer.followUpQuestions,[], 'An internal failure must not pretend the user owes a missing project fact');
 assert(isCanonicalResearchClarification('The new building has retail space.',answer));
 assert(!isCanonicalResearchClarification('The new building has retail space.',{...answer,answerText:'The building complies.'}));
}
const historicalFailureCopy={
 verification_source:'Research found a mismatch between the draft and its cited code passages. It could not finish a source-supported answer on this attempt.',
 verification_context:'Research detected a conflict between the draft and the project facts or scenario discussed in this conversation. It could not resolve that conflict on this attempt.',
 verification_format:'Research received an incomplete or incorrectly formatted answer from the model. It could not finish processing that answer.',
 verification_incomplete:'Research could not finish checking the draft against the retrieved code text. This attempt does not establish a code or project conclusion.'
};
for(const [reason,conclusion] of Object.entries(historicalFailureCopy)) {
 const question='The new building has retail space.';
 const current=researchClarificationAnswer(question,reason);
 const explanation='Your question and earlier messages are saved. You can retry this question here without starting a new conversation.';
 const historical={...current,answerText:`${conclusion}\n\n${explanation}`,conclusion,explanation};
 const original=JSON.stringify(historical);
 assert(isCanonicalResearchClarification(question,historical), 'Canonical stored failures must remain readable');
 assert.equal(narrative(historical),current.answerText, 'Historical failures display current copy');
 assert.equal(JSON.stringify(historical),original, 'Displaying current copy cannot change the stored answer');
 for(const field of ['answerText','conclusion','explanation','evidenceLimitations','followUpQuestions','verification']) {
  const forged={...historical,[field]:typeof historical[field]==='string'?'The building complies.':['The building complies.']};
  assert(!isCanonicalResearchClarification(question,forged),`Historical compatibility must remain strict for ${field}`);
 }
}
assert.match(message,/processing error/);
assert.match(message,/Retry/);
assert.doesNotMatch(message,/could not complete its evidence check/);
assert.equal(narrative({answerText:'A substantive answer.'}),'A substantive answer.');
console.log('Clarification copy: question first, historical integrity preserved, answer-check failures do not ask users to repeat unchanged questions.');

assert(source.includes('["RESEARCH_VERIFICATION_FAILED", "INVALID_RESEARCH_VERIFICATION"].includes(progress.errorCode)'), "Saved progress cards must translate historical verification errors too.");
