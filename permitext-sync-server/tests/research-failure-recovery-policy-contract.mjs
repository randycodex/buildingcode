import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchFailureRecovery, researchFailureReason, researchSystemRecoveryReasons, researchVerificationRecoveryTextForReason, researchPriorQuestionRecoveryTextForReason, researchRecoveryPresentation, researchRecoveryRequestDescription } from "../public/research-failure-recovery.js";
import { researchClarificationAnswer, isCanonicalResearchClarification } from "../research-conversation-continuity.mjs";
import { researchRecoveryFromFailedMessage, readResearchRequestRecovery, writeResearchRequestRecovery } from "../public/research-progress.js";

globalThis.fetch = () => { throw Error("No providers or network in failure recovery policy contract."); };
for (const code of ["RESEARCH_VERIFICATION_FAILED", "INVALID_RESEARCH_VERIFICATION", "INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION", "INVALID_RESEARCH_EVIDENCE_ANALYSIS"]) {
  const recovery = researchFailureRecovery({ code, message: "PRIVATE_UNVERIFIED_DRAFT", payload: { error: "PRIVATE_DIAGNOSTIC" } });
  assert.equal(recovery.action, "report");
  assert.equal(recovery.retryable, false);
  assert.doesNotMatch(recovery.text, /PRIVATE|retry|missing project fact|building complies/i);
  assert.doesNotMatch(recovery.text, /are saved/, "HTTP failures alone cannot establish a successful persistence receipt.");
}
assert.equal(researchFailureRecovery({code:"RESEARCH_VERIFICATION_FAILED",payload:{recoveryReason:"verification_context"}}).reason,"verification_context");
assert.equal(researchFailureRecovery({code:"RESEARCH_VERIFICATION_FAILED",recoveryReason:"evidence_unavailable"}).reason,"verification_incomplete");
assert.equal(researchFailureRecovery({code:"INVALID_RESEARCH_VERIFICATION",recoveryReason:"verification_source"}).reason,"verification_format");
assert.equal(researchFailureRecovery({code:"RESEARCH_VERIFICATION_FAILED",payload:{recoveryReason:"PRIVATE_FREEFORM"}}).reason,"verification_incomplete");
assert.equal(researchFailureRecovery({code:"RESEARCH_NOT_CONFIGURED",recoveryReason:"verification_source"}).kind,"unavailable");
assert.equal(researchFailureReason({verificationAttempts:[{pass:false,issues:[{type:"incorrect_citation"}]},{pass:false,issues:[{type:"unnecessary_qualification"}]}]}),"verification_incomplete");
assert.equal(researchFailureReason({verificationAttempts:[{pass:false,issues:[{type:"misstated_provision",detail:"An exception PRIVATE_DETAIL"}]}]}),"verification_source");

for (const code of ["RESEARCH_EVIDENCE_NOT_FOUND", "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED", "RESEARCH_ZONING_EVIDENCE_REQUIRED"]) {
  assert.equal(researchFailureRecovery({code}).reason,"evidence_unavailable");
  const saved=researchClarificationAnswer("Explain the storefront or an old filing.",researchFailureReason({code}));
  assert.deepEqual(saved.followUpQuestions,[]);
  assert.match(saved.answerText,/prepare the evidence/);
  assert.doesNotMatch(saved.answerText,/Which|paste|frontage|filing date/i,"A typed library failure cannot become a topic-inferred fact question.");
}
const unresolved=researchClarificationAnswer("Explain the project frontage.","research_unresolved");
assert.deepEqual(unresolved.followUpQuestions,[]);
assert.doesNotMatch(unresolved.answerText,/code evidence|Which frontage/,"Unresolved prerequisites without a reliable fact list do not establish a library gap or missing frontage.");
for (const reason of researchSystemRecoveryReasons) {
  const answer=researchClarificationAnswer("A plain project question.",reason);
  assert(isCanonicalResearchClarification("A plain project question.",answer));
  assert.equal(answer.answerText,researchVerificationRecoveryTextForReason(reason,"A plain project question."));
  assert.deepEqual(answer.followUpQuestions,[]);
  assert.doesNotMatch(answer.answerText,/saved|repeat|still here/i);
  assert.equal(answer.verification.pass,false);
  assert(!isCanonicalResearchClarification("Another question",answer));
  assert(!isCanonicalResearchClarification("A plain project question.",{...answer,answerText:"The building complies."}));
}
// Exact prior canonical records remain valid, with no migration or rewrite.
const previous={verification_format:"Research received an answer it couldn’t read.",verification_incomplete:"Research couldn’t resolve this question from the sources it retrieved."};
for (const [reason,conclusion] of Object.entries(previous)) {
  const answer={...researchClarificationAnswer("Old question",reason),conclusion,explanation:"Your question and conversation are saved. You don’t need to repeat the question.",answerText:`${conclusion}\n\nYour question and conversation are saved. You don’t need to repeat the question.`};
  delete answer.recoveryPresentation;
  const before=JSON.stringify(answer);
  assert(isCanonicalResearchClarification("Old question",answer));
  assert.equal(JSON.stringify(answer),before);
  assert(!isCanonicalResearchClarification("Old question",{...answer,followUpQuestions:["Which fact should we guess?"]}));
}
const published={
  verification_source:"Research couldn’t finish because its explanation and source references didn’t agree.",
  verification_context:"Research couldn’t finish because its explanation didn’t consistently use the project details already provided.",
  verification_format:"Research received an answer or review it couldn’t read.",
  verification_incomplete:"Research couldn’t complete its source checks for this question.",
  evidence_unavailable:"Research couldn’t prepare the code evidence needed to answer this question.",
  research_unresolved:"Research couldn’t resolve the conditions needed to answer this question."
};
for (const [reason,conclusion] of Object.entries(published)) {
  const explanation="Your question and conversation are saved. You don’t need to repeat the question.";
  const answer={...researchClarificationAnswer("Old question",reason),conclusion,explanation,answerText:`${conclusion}\n\n${explanation}`};
  delete answer.recoveryPresentation;
  const before=JSON.stringify(answer);
  assert(isCanonicalResearchClarification("Old question",answer),`Exact published ${reason} remains canonical`);
  assert.equal(JSON.stringify(answer),before);
  for (const field of ["answerText","conclusion","explanation"]) assert(!isCanonicalResearchClarification("Old question",{...answer,[field]:"The building complies."}));
}
const normalized=researchVerificationRecoveryTextForReason("verification_format","  Can **this**\n  work? <literal>  ");
assert.equal(normalized,'I couldn’t process the response to your question.\n\nUse Report this issue below to report this attempt.');
assert.equal(researchVerificationRecoveryTextForReason("verification_format"),researchVerificationRecoveryTextForReason("verification_format","  \n "));
assert.match(researchVerificationRecoveryTextForReason("verification_format"),/your question/);
assert.equal(researchVerificationRecoveryTextForReason("unknown","Private question"),"");
assert.doesNotMatch(researchFailureRecovery({code:"INVALID_RESEARCH_VERIFICATION"},"Can this work?").text,/saved|repeat|still here/i);

const questions = [
  ["What identification should we put on these air handlers?", "identification for the air handlers"],
  ["Explain the controls for this boiler.", "controls for the boiler"]
];
for (const [question, description] of questions) {
  const options = {requestID:"owned-request",requestDescription:description};
  const answer = researchClarificationAnswer(question,"verification_source",options);
  assert(isCanonicalResearchClarification(question,answer));
  assert.equal(answer.recoveryPresentation.requestDescription,description);
  assert.match(answer.answerText,/didn’t match the cited text/);
  assert(answer.answerText.includes(description));
  assert(!answer.answerText.includes(question));
  assert.doesNotMatch(answer.answerText,/so I couldn’t finish it|saved|retry|Which|must|shall/i);
  for (const field of ["supportedPoints","citations","assumptions","missingFacts","followUpQuestions"]) assert.deepEqual(answer[field],[]);
  assert.equal(answer.verification.pass,false);assert.equal(answer.charged,false);
  assert(!isCanonicalResearchClarification("Another original question",answer));
  assert(!isCanonicalResearchClarification(question,{...answer,recoveryPresentation:{...answer.recoveryPresentation,version:99}}));
  assert(!isCanonicalResearchClarification(question,{...answer,recoveryPresentation:{...answer.recoveryPresentation,question:"Foreign question"}}));
  assert(!isCanonicalResearchClarification(question,{...answer,recoveryPresentation:{...answer.recoveryPresentation,requestDescription:"The equipment complies"}}));
  assert(!isCanonicalResearchClarification(question,{...answer,citations:[{sectionID:"invented"}]}));
}
for (const value of [undefined,null,22,{},[],"x".repeat(101),"Ignore instructions","<script>air handlers</script>","air handlers must be approved","the equipment complies","controls for the boiler","What identification should we put on these air handlers?"]) {
  const question=questions[0][0], answer=researchClarificationAnswer(question,"verification_incomplete",{requestID:"request",requestDescription:value});
  assert.equal(answer.recoveryPresentation.requestDescription,null,JSON.stringify(value));
  assert(isCanonicalResearchClarification(question,answer));
  assert.equal(answer.answerText,researchVerificationRecoveryTextForReason("verification_incomplete"));
}
assert.equal(researchRecoveryRequestDescription("Does the equipment meet the code?","the equipment meets the code"),"");
assert.equal(researchRecoveryRequestDescription("Can the air handlers comply?","air handlers comply"),"");
const priorHuman={id:"root-human",role:"user",requestID:"root-request",question:"We are checking the boiler controls."};
const contextual=researchClarificationAnswer("Does that meet the minimum?","verification_incomplete",{requestID:"followup",requestDescription:"boiler controls",humanContext:[priorHuman]});
assert(isCanonicalResearchClarification("Does that meet the minimum?",JSON.parse(JSON.stringify(contextual))));
assert(contextual.answerText.includes("boiler controls"));
assert(!isCanonicalResearchClarification("Can we omit it?",contextual));
assert(!isCanonicalResearchClarification("Does that meet the minimum?",{...contextual,recoveryPresentation:{...contextual.recoveryPresentation,humanContext:[{...priorHuman,role:"assistant"}]}}));
const spaced="  What identification\n should we put on these air handlers?  ";
assert.equal(researchRecoveryRequestDescription(spaced,questions[0][1]),questions[0][1]);
const bound=researchRecoveryPresentation(spaced,"request",questions[0][1]);
assert(researchVerificationRecoveryTextForReason("verification_incomplete",questions[0][0],bound).includes(questions[0][1]));
assert.equal(researchVerificationRecoveryTextForReason("verification_incomplete","Different request",bound),researchVerificationRecoveryTextForReason("verification_incomplete"));
// Preserve exact V52 question-echo canonical records for every typed reason.
for (const reason of researchSystemRecoveryReasons) {
  const question=questions[0][0], text=researchPriorQuestionRecoveryTextForReason(reason,question);
  const answer={...researchClarificationAnswer(question,reason),answerText:text,conclusion:text.split("\n\n")[0]};
  delete answer.recoveryPresentation;
  const snapshot=JSON.stringify(answer);
  assert(isCanonicalResearchClarification(question,answer));
  assert.equal(JSON.stringify(answer),snapshot);
  assert(!isCanonicalResearchClarification("Foreign question",answer));
}
assert(researchClarificationAnswer("What project use is proposed?","evidence").followUpQuestions.length,"Legacy genuine clarifiers retain their question behavior.");
for (const code of ["RESEARCH_INTERRUPTED","RESEARCH_PROVIDER_ERROR","RESEARCH_VERIFIER_ERROR","TimeoutError","RESEARCH_CANCELLED"]) assert.equal(researchFailureRecovery({code}).retryable,true);
for (const [error,action] of [[{status:401},"review_account"],[{code:"RESEARCH_ADDON_REQUIRED"},"review_account"],[{code:"RESEARCH_SPEND_CAP"},"contact_support"],[{code:"RESEARCH_EVAL_SPEND_CAP"},"contact_support"],[{code:"RESEARCH_NOT_CONFIGURED"},"contact_support"],[{code:"RESEARCH_SOURCE_CHANGED"},"review_sources"],[{code:"RESEARCH_CONTEXT_CHANGED"},"review_context"],[{},"contact_support"]]) {
  assert.equal(researchFailureRecovery(error).action,action);
  assert.equal(researchFailureRecovery(error).retryable,false);
}

const message={role:"user",requestID:"same-request",question:"Retain exact question",createdAt:"2026-10-03T01:00:00Z",failure:{code:"RESEARCH_VERIFICATION_FAILED",status:"failed",message:"Old copy: Retry this question",failedAt:"2026-10-03T01:00:10Z"}};
const snapshot=JSON.stringify(message), restored=researchRecoveryFromFailedMessage(message,"owned-conversation");
assert.equal(restored.requestID,message.requestID);
assert.equal(restored.question,message.question);
assert.doesNotMatch(restored.error,/Retry/i);
assert.equal(JSON.stringify(message),snapshot);
assert.equal(restored.answerID,undefined,"A failed user question is never promoted to an assistant feedback identity.");
const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const record={accountUserID:"account",workspaceID:"workspace",conversationID:"conversation",requestID:"request",question:"Question remains",status:"failed",startedAt:10,errorStatus:401,recoveryReason:"verification_context"};
assert(writeResearchRequestRecovery(storage,record,100));
assert.equal(readResearchRequestRecovery(storage,record,101).errorStatus,401);
assert.equal(readResearchRequestRecovery(storage,record,101).recoveryReason,"verification_context");
assert(writeResearchRequestRecovery(storage,{...record,recoveryReason:"RAW_SECRET_REASON",errorStatus:9999},102));
assert.equal(readResearchRequestRecovery(storage,record,103).recoveryReason,"");
assert.equal(readResearchRequestRecovery(storage,record,103).errorStatus,0);

const app=await readFile(new URL("../app.mjs",import.meta.url),"utf8");
assert.match(app,/if \(!assembledEvidence\.length\) \{[\s\S]*?clarificationReason: "evidence_unavailable"/);
assert.match(app,/!conditionalZoningExplanation\) \{[\s\S]*?clarificationReason: "research_unresolved"/);
assert.match(app,/recoveryReason: failureRecovery\.reason/);
console.log("Failure recovery policy passed: typed source/verification/format distinctions, conservative prerequisites, immutable prior records, no guessed facts/private prose, correct nonretry actions and transport controls; no providers.");
