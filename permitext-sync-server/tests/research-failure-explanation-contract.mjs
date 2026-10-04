import assert from 'node:assert/strict';
import {researchVerificationFailureExplanation as explain} from '../research-failure-explanation.mjs';
import {researchFailureRecovery,researchFailureReason} from '../public/research-failure-recovery.js';
const verdict=(type,detail='')=>({pass:false,issues:[{type,detail}]});
assert.match(explain([verdict('misstated_provision','Omitted exception')]),/source checks/);
assert.doesNotMatch(explain([verdict('misstated_provision','Omitted exception')]),/exception/i, 'A prose keyword does not establish a typed exception finding.');
assert.match(explain([verdict('incorrect_citation')]),/source references/);
assert.match(explain([verdict('fact_evidence_confusion')]),/project details/);
assert.match(explain([verdict('unsupported_requirement')]),/source references/);
assert.match(explain([verdict('incorrect_citation'),verdict('fact_evidence_confusion')]),/project details/);
assert.doesNotMatch(explain([verdict('unsupported_requirement','SECRET_RAW_DIAGNOSTIC')]),/SECRET_RAW_DIAGNOSTIC/);
for(const attempts of [null,[],[{}],[verdict('unknown')]]) assert.match(explain(attempts),/source checks/);
assert.doesNotMatch(explain([]),/retry|without rewriting/i);
console.log('Specific failure explanations use final verdict and fixed copy without diagnostic leakage.');

const { readFile } = await import('node:fs/promises');
const web = await readFile(new URL('../public/app.js', import.meta.url),'utf8');

const failureMessage = new Function('researchFailureRecovery',web.slice(web.indexOf('function researchFailureMessage('), web.indexOf('function renderNewResearchComposer(')) + '; return researchFailureMessage;')(researchFailureRecovery);
for (const type of ['incorrect_citation','fact_evidence_confusion','misstated_provision','missed_material_conclusion','unsupported_requirement','unknown']) {
 const message = explain([{issues:[{type}]}]);
 const recoveryReason=researchFailureReason({code:'RESEARCH_VERIFICATION_FAILED',verificationAttempts:[{issues:[{type}]}]});
 assert.equal(failureMessage({code:'RESEARCH_VERIFICATION_FAILED',message,recoveryReason}),message);
 assert.equal(failureMessage({payload:{code:'RESEARCH_VERIFICATION_FAILED',error:message,recoveryReason}}),message);
}
assert(!failureMessage({code:'RESEARCH_VERIFICATION_FAILED',message:'RAW PRIVATE DIAGNOSTIC'}).includes('RAW PRIVATE'));
