import assert from 'node:assert/strict';
import {researchVerificationFailureExplanation as explain} from '../research-failure-explanation.mjs';
const verdict=(type,detail='')=>({pass:false,issues:[{type,detail}]});
assert.match(explain([verdict('misstated_provision','Omitted exception')]),/exception/);
assert.match(explain([verdict('incorrect_citation')]),/citations/);
assert.match(explain([verdict('fact_evidence_confusion')]),/assumptions/);
assert.match(explain([verdict('unsupported_requirement')]),/requirement/);
assert.match(explain([verdict('incorrect_citation'),verdict('fact_evidence_confusion')]),/assumptions/);
assert.doesNotMatch(explain([verdict('unsupported_requirement','SECRET_RAW_DIAGNOSTIC')]),/SECRET_RAW_DIAGNOSTIC/);
for(const attempts of [null,[],[{}],[verdict('unknown')]]) assert.match(explain(attempts),/did not pass the evidence checks/);
assert.match(explain([]),/without rewriting/);
console.log('Specific failure explanations use final verdict and fixed copy without diagnostic leakage.');

const { readFile } = await import('node:fs/promises');
const web = await readFile(new URL('../public/app.js', import.meta.url),'utf8');

const failureMessage = new Function(web.slice(web.indexOf('function researchFailureMessage('), web.indexOf('function renderNewResearchComposer(')) + '; return researchFailureMessage;')();
for (const type of ['incorrect_citation','fact_evidence_confusion','misstated_provision','missed_material_conclusion','unsupported_requirement','unknown']) {
 const message = explain([{issues:[{type}]}]);
 assert.equal(failureMessage({code:'RESEARCH_VERIFICATION_FAILED',message}),message);
 assert.equal(failureMessage({payload:{code:'RESEARCH_VERIFICATION_FAILED',error:message}}),message);
}
assert(!failureMessage({code:'RESEARCH_VERIFICATION_FAILED',message:'RAW PRIVATE DIAGNOSTIC'}).includes('RAW PRIVATE'));
