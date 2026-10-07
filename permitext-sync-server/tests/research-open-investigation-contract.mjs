import assert from 'node:assert/strict';
import { investigateResearchEvidence, mergeInvestigationEvidence, openInvestigationEnabled, validateOpenInvestigationValue, openReviewRevisionFeedback, openCitationOnlyRepairAllowed, assertOpenCitationOnlyRepair } from '../research-open-investigation.mjs';
const a={sourceID:'a',text:'A scope paragraph'}, b={sourceID:'b',text:'A governing requirement'};
const searches=[]; const observations=[];
const result=await investigateResearchEvidence({question:'Original question',facts:['Known user fact'],messages:[],evidencePackage:{sources:[a]},
 decide:async input=>{observations.push(structuredClone(input));return input.sources.some(s=>s.sourceID==='b')?{ready:true,queries:[],reason:'Found rule'}:{ready:false,queries:['BC governing requirement'],reason:'Missing rule'};},
 search:async query=>{searches.push(query);return {sources:[b]};}});
assert.deepEqual(searches,['BC governing requirement']);
assert.deepEqual(result.sources,[b,a]);
assert.equal(observations.length,2);
assert(observations.every(i=>i.question==='Original question'&&i.facts[0]==='Known user fact'));
assert.equal(result.investigation.trace[0].addedSources,1);
let calls=0;
await investigateResearchEvidence({evidencePackage:{sources:[]},decide:async()=>({ready:false,queries:['same'],reason:'Missing'}),search:async()=>{calls++;return {sources:[]}}});
assert.equal(calls,1,'Repeated unsuccessful query must not loop');
assert.deepEqual(mergeInvestigationEvidence([a],[b],{maximumCharacters:24}),[b],'New requested source survives a full initial budget');
assert.deepEqual(mergeInvestigationEvidence([a],[b],{maximumSources:1,retainedSourceIDs:['a']}),[a],'Investigator-selected evidence survives later broad search results');
const env={PERMITEXT_RESEARCH_ENGINE:'open'};
assert(openInvestigationEnabled({environment:env}));
assert(!openInvestigationEnabled({environment:env,pinnedEvidence:[a]}));
assert(!openInvestigationEnabled({environment:env,decisionLink:{}}));
assert(!openInvestigationEnabled({environment:env,suppliedText:'quote'}));
assert(!openInvestigationEnabled({environment:{}}));
const controller=new AbortController();controller.abort();
await assert.rejects(investigateResearchEvidence({signal:controller.signal,evidencePackage:{sources:[]}}),{name:'AbortError'});
const review={pass:false,issues:[{type:'incorrect_citation',message:'Keep this complete finding.'}]};
assert.equal(validateOpenInvestigationValue(review,'permitext_research_open_review'),review);
assert.deepEqual(openReviewRevisionFeedback(review.issues),[{type:'incorrect_citation',detail:'Keep this complete finding.'}]);
assert(openCitationOnlyRepairAllowed(2, review.issues));
assert(!openCitationOnlyRepairAllowed(0, review.issues));
assert(!openCitationOnlyRepairAllowed(1, review.issues));
assert(!openCitationOnlyRepairAllowed(3, review.issues));
assert(!openCitationOnlyRepairAllowed(2, [{type:'wrong_attribution',message:'Scope must change.'}]));
assert(!openCitationOnlyRepairAllowed(2, []));
const draft = {answerText:'Conditional finding.',supportedPoints:[{heading:'Rule',explanation:'Only in this scope.',sectionID:'a',sourceIDs:['old']}],
  assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[],citations:[]};
const rebound = structuredClone(draft); rebound.supportedPoints[0].sourceIDs=['correct']; rebound.citations=[{sectionID:'a',sourceIDs:['correct']}];
assert.doesNotThrow(()=>assertOpenCitationOnlyRepair(draft,rebound));
for (const change of [answer=>answer.answerText='Changed conclusion.',answer=>answer.supportedPoints[0].explanation='Changed condition.',answer=>answer.evidenceLimitations=['New gap.']]) {
  const changed=structuredClone(rebound);change(changed);
  assert.throws(()=>assertOpenCitationOnlyRepair(draft,changed),{code:'INVALID_RESEARCH_RESPONSE'});
}
for(const value of [{pass:false,issues:[]},{pass:true,issues:review.issues},{pass:false,issues:[{type:'invented',message:'Bad'}]}])
  assert.throws(()=>validateOpenInvestigationValue(value,'permitext_research_open_review'),{code:'INVALID_RESEARCH_VERIFICATION'});
assert.throws(()=>validateOpenInvestigationValue({ready:true,queries:[],reason:'Missing retained IDs'},'permitext_research_investigation'),{code:'INVALID_RESEARCH_RESPONSE'});
console.log('Open investigation discovery, scope, cancellation, and budget contracts passed.');
