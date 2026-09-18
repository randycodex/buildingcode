import test from 'node:test';
import assert from 'node:assert/strict';
import { model } from '../evals/typesafe-intent.mjs';
import { tasks, ruleTasks, taskPlanningRequest, buildTaskPlan, configureTaskPlanning, prepareTaskPlan, appendTaskPlan } from '../evals/typesafe-task-planning.mjs';
const evidence=[{sourceID:'a',codePrefix:'BC',sectionNumber:'1007.1.1',title:'Source',text:'Exact original text',evidencePriority:{evidenceRole:'governing'}}];
const requirements=[{sourceIDs:['a']}];
function response(){return {model,usage:{input_tokens:500},answers:{...Object.fromEntries(Object.keys(tasks).map(id=>[id,{type:'choice',choice:'not_requested',confidence:1,probabilities:{requested:0,not_requested:1,uncertain:0}}])),source_0:{type:'choice',choice:'priority',confidence:1,probabilities:{priority:1,background:0,uncertain:0}}}};}
test('code-only plan distinguishes the requested decision from stipulated context',()=>{
 const r=ruleTasks('If the room is classified as Group B, can its plumbing fixtures be calculated using Group B requirements?');
 assert.equal(r.fixture_basis,true);assert.equal(r.occupancy_classification,false);assert.equal(r.fixture_quantity,false);
 const s=ruleTasks('Can the scissor stairs be counted as two separate exits?');
 assert.equal(s.separate_exit_count,true);assert.equal(s.required_exit_count,false);
});
test('plan preserves exact facts and required IDs; uncertain model signals cannot exclude topics',()=>{
 const b=response();b.answers.fixture_basis={type:'choice',choice:'not_requested',confidence:.3,probabilities:{requested:.2,not_requested:.5,uncertain:.3}};
 const plan=buildTaskPlan({question:'Question',evidence,requiredClaims:requirements,facts:['Occupancy unknown'],response:b});
 assert.deepEqual(plan.suppliedFacts,['Occupancy unknown']);assert.deepEqual(plan.requiredSourceIDs,['a']);
 assert.ok(plan.uncertainScope.includes(tasks.fixture_basis));assert.ok(!plan.adjacentTopics.includes(tasks.fixture_basis));
 assert.throws(()=>buildTaskPlan({question:'Question',evidence,requiredClaims:[{sourceIDs:['unknown']}]}));
});
test('malformed or wrong-model planning outputs are rejected',()=>{
 for(const mutate of [b=>b.model='wrong',b=>delete b.answers.fixture_basis,b=>b.answers.source_0.probabilities.priority=.1]){
  const b=response();mutate(b);assert.throws(()=>buildTaskPlan({question:'Question',evidence,response:b}));
 }
});
test('baseline is byte-identical and rules need no provider',async()=>{
 configureTaskPlanning({mode:'baseline',record:()=>{},fetch:()=>assert.fail('network')});
 try {assert.equal(await prepareTaskPlan({question:'Question',evidence,requiredClaims:requirements}),evidence);assert.equal(appendTaskPlan('Original'),'Original');}
 finally{configureTaskPlanning(null);}
 configureTaskPlanning({mode:'rules',record:()=>{},fetch:()=>assert.fail('network')});
 try {assert.equal(await prepareTaskPlan({question:'Question',evidence,requiredClaims:requirements}),evidence);assert.ok(appendTaskPlan('Original').startsWith('Original\n\nADVISORY'));}
 finally{configureTaskPlanning(null);}
});
test('Jev adds advisory planning without mutating or filtering source evidence',async()=>{
 let record;const before=JSON.stringify(evidence);
 configureTaskPlanning({mode:'jev-plan',apiKey:'test',record:r=>record=r,fetch:async(url,options)=>{
  assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body.state),['question','passages']);
  return {ok:true,json:async()=>response()};
 }});
 try{assert.equal(await prepareTaskPlan({question:'Question',evidence,requiredClaims:requirements}),evidence);assert.equal(JSON.stringify(evidence),before);assert.equal(record.status,'jev-plan');assert.ok(record.estimatedCostUSD>0);}
 finally{configureTaskPlanning(null);}
});
test('Jev failure falls back to code plan without retrying or leaking errors',async()=>{
 let record,calls=0;configureTaskPlanning({mode:'jev-plan',apiKey:'secret',record:r=>record=r,fetch:async()=>{calls++;throw new Error('secret');}});
 try{assert.equal(await prepareTaskPlan({question:'Question',evidence,requiredClaims:requirements}),evidence);assert.equal(record.status,'fallback-to-rules');assert.equal(calls,1);assert.equal(record.errorCode,'transport_or_json_failure');}
 finally{configureTaskPlanning(null);}
 assert.throws(()=>taskPlanningRequest('Question',[{...evidence[0],text:'x'.repeat(100000)}]));
});

test('rounded distributions are accepted within half a percentage point per option',()=>{
 const b=response();b.answers.source_0.probabilities={priority:.93,background:.04,uncertain:.02};
 assert.doesNotThrow(()=>buildTaskPlan({question:'Question',evidence,response:b}));
 b.answers.source_0.probabilities.priority=.9;
 assert.throws(()=>buildTaskPlan({question:'Question',evidence,response:b}));
});
