import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {researchClarificationAnswer,isCanonicalResearchClarification,researchVerificationFailureReason} from '../research-conversation-continuity.mjs';
import {researchFailureRecovery,researchSystemRecoveryReasons,researchVerificationRecoveryTextForReason} from '../public/research-failure-recovery.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const narrative=new Function('researchSystemRecoveryReasons','researchVerificationRecoveryTextForReason',`${source.slice(source.indexOf('function researchDisplayText('),source.indexOf('function researchApplicabilityStatusLabel('))}; return researchAnswerNarrativeText;`)(researchSystemRecoveryReasons,researchVerificationRecoveryTextForReason);
const failure=new Function('researchFailureRecovery',`${source.slice(source.indexOf('function researchFailureMessage('),source.indexOf('function renderNewResearchComposer('))}; return researchFailureMessage;`)(researchFailureRecovery);
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
 [{code:'INVALID_RESEARCH_RESPONSE'}, /couldn’t process the response/],
 [{code:'INVALID_RESEARCH_CITATION'}, /explanation didn’t match the cited text/],
 [{verificationAttempts:[{issues:[{type:'missed_premise_contradiction'}]}]}, /details you provided/],
 [{verificationAttempts:[{pass:false,issues:[{type:'missed_premise_contradiction'}]},
   {pass:false,issues:[{type:'unnecessary_qualification'}]}]}, /source check for your question/],
 [{code:'RESEARCH_VERIFICATION_FAILED'}, /source check for your question/]
]) {
 const answer=researchClarificationAnswer('The new building has retail space.',researchVerificationFailureReason(error));
 assert.match(answer.answerText,expected);
 assert.match(answer.answerText,/Use Report this issue below/);
 assert.doesNotMatch(answer.answerText,/saved|repeat|still here/i);
 assert.doesNotMatch(answer.answerText,/you can retry|try again|retry this question/i);
 assert.equal(narrative(answer,'The new building has retail space.'),answer.answerText, 'New server and web recovery wording must agree');
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
 delete historical.recoveryPresentation;
 const original=JSON.stringify(historical);
 assert(isCanonicalResearchClarification(question,historical), 'Canonical stored failures must remain readable');
 assert.equal(narrative(historical,question),current.answerText, 'Historical failures display current copy');
 assert.equal(JSON.stringify(historical),original, 'Displaying current copy cannot change the stored answer');
 for(const field of ['answerText','conclusion','explanation','evidenceLimitations','followUpQuestions','verification']) {
  const forged={...historical,[field]:typeof historical[field]==='string'?'The building complies.':['The building complies.']};
  assert(!isCanonicalResearchClarification(question,forged),`Historical compatibility must remain strict for ${field}`);
 }
}
assert.match(message,/couldn’t process the response/);
assert.doesNotMatch(message,/Retry/i);
assert.doesNotMatch(message,/could not complete its evidence check/);
assert.equal(narrative({answerText:'A substantive answer.'}),'A substantive answer.');
console.log('Clarification copy: question first, historical integrity preserved, answer-check failures do not ask users to repeat unchanged questions.');

assert(source.includes('researchProgressFailureRecovery(progress).text'), "Saved progress cards must translate historical machine-coded failures too.");
