import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedSourceIDs, focusRequest, selectFocusedEvidence, configureEvidenceFocus, focusResearchEvidence, operationTokenCost } from '../evals/typesafe-evidence-focus.mjs';
import { model } from '../evals/typesafe-intent.mjs';
const source=(id,extra={})=>({sourceID:id,text:'Exact enacted text',origin:'permitext_discovered',evidencePriority:{evidenceRole:'contextual'},...extra});
const sources=[source('optional'),source('pinned',{origin:'user_pinned'}),source('governing',{evidencePriority:{evidenceRole:'governing'}}),source('exception',{evidencePriority:{evidenceRole:'contextual',functions:['exception']}}),source('required')];
const claims=[{evidenceOptions:[{sourceIDs:['required']}]}];
const reply=()=>({model,answers:Object.fromEntries(sources.map((s,i)=>[`passage_${i}`,{type:'choice',choice:'unrelated',confidence:1,probabilities:{relevant:0,uncertain:0,unrelated:1}}])),usage:{input_tokens:500}});
test('failed turns retain provider cost even when completed-answer estimate is null',()=>{
 assert.equal(operationTokenCost({estimatedCostUSD:null,actualProviderCostUSD:.2}),.2);
 assert.equal(operationTokenCost({estimatedCostUSD:.1,actualProviderCostUSD:.2}),.2);
 assert.throws(()=>operationTokenCost({estimatedCostUSD:null,actualProviderCostUSD:null}));
});
test('never drops pinned, governing, exception or exact required-claim sources',()=>{
 assert.deepEqual([...protectedSourceIDs(sources,claims)],['required','pinned','governing','exception']);
 const selected=selectFocusedEvidence(sources,claims,reply());
 assert.deepEqual(selected.removedIDs,['optional']);
 assert.equal(selected.evidence.length,4);
 assert.ok(selected.evidence.every(s=>sources.includes(s)),'Exact original objects retained');
});
test('uncertainty and malformed distributions cannot remove sources',()=>{
 const b=reply(); b.answers.passage_0.confidence=.94;
 assert.equal(selectFocusedEvidence(sources,claims,b).evidence.length,5);
 b.answers.passage_0.probabilities.unrelated=.2;
 assert.throws(()=>selectFocusedEvidence(sources,claims,b));
});
test('candidate-pruning variant permits only ordinary unprotected search candidates',()=>{
 const candidate=source('optional',{evidencePriority:{evidenceRole:'supporting',primaryFunction:'candidate',functions:['candidate']}});
 const input=[candidate,...sources.slice(1)];
 assert.equal(selectFocusedEvidence(input,claims,reply()).evidence.length,5);
 assert.deepEqual(selectFocusedEvidence(input,claims,reply(),true).removedIDs,['optional']);
 const requiredCandidate=[{sourceIDs:['optional']}];
 assert.equal(selectFocusedEvidence(input,[...claims,...requiredCandidate],reply(),true).evidence.length,5);
});
test('provider failure falls back to exact original evidence and records failure',async()=>{
 let record;
 configureEvidenceFocus({mode:'jev',apiKey:'test',fetch:async()=>{throw new Error('secret');},record:r=>record=r});
 try {assert.equal(await focusResearchEvidence({question:'Question',evidence:sources,requiredClaims:claims}),sources); assert.equal(record.status,'fallback');assert.ok(!record.error.includes('secret'));}
 finally {configureEvidenceFocus(null);}
});
test('default and baseline make no calls; bounded requests contain no answer key',async()=>{
 assert.equal(await focusResearchEvidence({question:'Question',evidence:sources,requiredClaims:claims}),sources);
 configureEvidenceFocus({mode:'baseline',fetch:()=>assert.fail('unexpected fetch'),record:()=>{}});
 try {assert.equal(await focusResearchEvidence({question:'Question',evidence:sources,requiredClaims:claims}),sources);}
 finally {configureEvidenceFocus(null);}
 assert.deepEqual(Object.keys(focusRequest('Question',sources).state),['question','passages']);
 assert.throws(()=>focusRequest('Question',[source('large',{text:'a'.repeat(100000)})]));
});
