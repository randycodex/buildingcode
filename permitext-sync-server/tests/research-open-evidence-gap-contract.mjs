import assert from 'node:assert/strict';
import {researchInterpretationSchemaForEvidence,validateResearchInterpretation} from '../app.mjs';
import {researchWriterInstructions} from '../research-writer-policy.mjs';
import {immutableResearchAnswer,ownerScope} from '../project-foundation-contract.mjs';
import {openInvestigationVersion} from '../research-open-investigation.mjs';

const evidence=[{sourceID:'referral',sectionID:'bc-referral',codePrefix:'BC',sectionNumber:'101.4.1',text:'Electrical work shall comply with the Electrical Code.'}];
const gap={answerText:'The supplied passages do not establish the GFCI branch-circuit rule.',supportedPoints:[],citations:[],
 assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:['The operative Electrical Code is missing.'],
 additionalEvidenceNeeded:['The applicable GFCI and branch-circuit provisions.'],supportingSourceUses:[]};
const options={allowEvidenceGapOnly:true};
assert.equal(researchInterpretationSchemaForEvidence(evidence,[],options).properties.citations.minItems,0);
assert.equal(researchInterpretationSchemaForEvidence(evidence).properties.citations.minItems,1);
assert.equal(validateResearchInterpretation(gap,evidence,[],options).citations.length,0);
assert.throws(()=>validateResearchInterpretation(gap,evidence),{code:'INVALID_RESEARCH_RESPONSE'});
for(const field of ['evidenceLimitations','additionalEvidenceNeeded']) {
 assert.throws(()=>validateResearchInterpretation({...gap,[field]:[]},evidence,[],options),{code:'INVALID_RESEARCH_RESPONSE'});
 assert.throws(()=>validateResearchInterpretation({...gap,[field]:[' ']},evidence,[],options),{code:'INVALID_RESEARCH_RESPONSE'});
}
const invented={...gap,citations:[{sectionID:'invented',sourceIDs:['not-supplied'],relevance:'Invented rule.'}],
 supportedPoints:[{heading:'Rule',explanation:'Unsupported',sectionID:'invented',sourceIDs:['not-supplied']}]};
assert.throws(()=>validateResearchInterpretation(invented,evidence,[],options),{code:'INVALID_RESEARCH_CITATION'});
assert.match(researchWriterInstructions({question:'GFCI?',options}),/directly supported main answer must still be given and cited/);
const answer={...validateResearchInterpretation(gap,evidence,[],options),mode:'openai',model:'gpt-6-luna',
 researchEngine:openInvestigationVersion,investigation:{version:openInvestigationVersion,trace:[{round:0,ready:true,queries:[],reason:'Required source unavailable.'}]},authorityStatus:'insufficient_evidence',
 verification:{scope:'investigated_evidence_gap',status:'passed',pass:true,history:[{pass:true,issues:[],model:'gpt-6-luna'}]}};
const persist=a=>immutableResearchAnswer({owner:ownerScope('user-1'),conversationID:'conversation-1',question:'GFCI?',
 answer:a,evidence:[{...evidence[0],id:'snapshot-1',evidenceSetVersion:1}],citations:[],model:'gpt-6-luna',researchSystemVersion:'offline-contract'});
assert.deepEqual(persist(answer).citations,[]);
for(const version of ['20261007-open-investigation-recovery-v2','20261007-open-investigation-recovery-v3'])
 assert.deepEqual(persist({...answer,researchEngine:version,
 investigation:{version,trace:answer.investigation.trace}}).citations,[],
 'Previously reviewed saved gaps remain valid after a policy revision');
for(const mutation of [{researchEngine:'bounded'},{investigation:{version:'invented',trace:[]}},
 {investigation:{version:openInvestigationVersion,trace:[]}},
 {authorityStatus:'supported_by_enacted_text'},{verification:{...answer.verification,pass:false}},
 {verification:{...answer.verification,scope:'passed'}},
 {verification:{...answer.verification,history:[{pass:true,issues:[{type:'unsupported_requirement'}],model:'gpt-6-luna'}]}},
 {verification:{...answer.verification,history:[{pass:true,issues:[],model:'invented'}]}},
 {evidenceLimitations:[]},{additionalEvidenceNeeded:[]},{supportedPoints:[{}]},{supportingSources:[{}]},
 {model:'invented'}])assert.throws(()=>persist({...answer,...mutation}),/Research answers require citations/);
console.log('Open evidence-gap contract passed: explicit gap dependencies, no forced unrelated citation, unchanged scoped paths, exact bindings.');
