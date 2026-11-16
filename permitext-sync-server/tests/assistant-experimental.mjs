import assert from 'node:assert/strict';
import {runExperimentalAssistant} from '../assistant-experimental.mjs';
const message=text=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]});
const invoke=(name,query)=>({status:'completed',output:[{type:'function_call',call_id:'call-'+name,name,arguments:JSON.stringify({query})}]});
let calls=[],step=0;
const result=await runExperimentalAssistant({question:'What about this?',attachedSources:[{id:'S1',text:'Attached exact passage'}],projectContext:{name:'Private project'},privateIdentifiers:['Private project']},{
 searchLibrary:async query=>({sources:[{id:'S2',text:'Retrieved rule'}]}),call:async(body,meta)=>{
  calls.push({body,meta});assert.equal(body.model,'gpt-6-luna');
  if(meta.phase==='experimental_web')return {status:'completed',output:[{type:'web_search_call',action:{type:'search'}},{type:'message',content:[{type:'output_text',text:'A verified web result.',annotations:[{type:'url_citation',url:'https://www.nyc.gov/example',title:'Official example'}]}]}]};
  step++;if(step===1){assert.match(body.input[0].content,/Attached exact passage/);return invoke('search_library','generic rule');}
  if(step===2)return invoke('search_web','generic rule official source');
  return message('The passage says this. [S1] Supporting context. [W1]');
 }});
assert.match(result.text,/\[W1\]\(https:\/\/www.nyc.gov\/example\)/);
assert.equal(result.webSources.length,1);assert.equal(result.trace.length,2);
assert(!calls.some(c=>c.meta.phase==='review'||c.body.text?.format),'No formal review or legal-claim schema');
assert(!calls.find(c=>c.meta.phase==='experimental_web').body.input.includes('Private project'),'Web helper never receives project snapshot');
let privateSearches=0,turn=0;
await runExperimentalAssistant({question:'Question',privateIdentifiers:['Private project']},{searchLibrary:()=>{},call:async(body,meta)=>{
 if(meta.phase==='experimental_web')privateSearches++;
 return ++turn===1?invoke('search_web','Private project rules'):message('I will use a generic query instead.');
}});
assert.equal(privateSearches,0);
const focused=await runExperimentalAssistant({question:'Explain the attached passage.',attachedSources:[{id:'S1',text:'Exact attached provision'}]},{searchLibrary:()=>assert.fail('No forced retrieval'),call:async body=>{
 assert.match(body.instructions,/focus primarily on those passages/);
 assert.match(body.input[0].content,/Exact attached provision/);
 return message('The attached provision says this. [S1] Unknown references: [S99] [W99]');
}});
assert.match(focused.text,/\[S1\]/);
assert(!focused.text.includes('[S99]')&&!focused.text.includes('[W99]'));
assert.equal(focused.trace.length,0);
const stopped=new AbortController();stopped.abort();await assert.rejects(runExperimentalAssistant({question:'Question'},{signal:stopped.signal,call:()=>assert.fail('No cancelled call')}),{name:'AbortError'});
console.log('Experimental Assistant: fresh prompt, attachments, autonomous tools, web citation links, private-query isolation, no reviewer, cancellation passed.');
// Intent is interpreted by the answering model in the same call, with the latest exchange intact.
let phases=[],receivedQuery;
const followup=await runExperimentalAssistant({question:'Does that change it?',history:[
 {role:'user',question:'Old subject'}, {role:'assistant',answer:{answerText:'Old answer'}},
 {role:'user',question:'Current subject'}, {role:'assistant',question:'Wrong fallback',answer:{answerText:'Current answer'}}
]}, {searchLibrary:async query=>{receivedQuery=query;return {sources:[]};},call:async(body,{phase})=>{
 phases.push(phase);assert.equal(phase,'experimental');assert(!body.text?.format);
 assert.deepEqual(body.input.slice(1,5).map(m=>m.role),['user','assistant','user','assistant']);
 assert.equal(body.input[4].content,'Current answer');assert.match(body.instructions,/immediately preceding/);
 return phases.length===1?invoke('search_library','Resolved current subject'):message('Current answer.');
}});
assert.equal(receivedQuery,'Resolved current subject');assert.equal(phases.length,2);assert.equal(followup.trace[0].tool,'search_library');
const clarification=await runExperimentalAssistant({question:'Can it be smaller?',history:[{role:'assistant',text:'There are two possible objects.'}]},{searchLibrary:()=>assert.fail('No forced search for ambiguous intent'),call:async()=>message('Which of the two do you mean?')});
assert.equal(clarification.text,'Which of the two do you mean?');
let recallIDs,recallStep=0;
const recall=await runExperimentalAssistant({question:'Does the exception change that?',history:[{role:'user',question:'Earlier subject'},{role:'assistant',answer:{answerText:'Earlier answer [S1]'}}],
 attachedSources:[{id:'S1',text:'Different currently attached source'}],priorEvidence:[{id:'R1',title:'Related exception'},{id:'R2',title:'Unrelated rule'}]}, {
 recallEvidence:async ids=>{recallIDs=ids;return {sources:[{id:'S2',text:'Rehydrated related provision',recalledFrom:'R1'}],unavailable:[]};},
 searchLibrary:()=>assert.fail('Recall can supply sufficient evidence without forced search'),call:async(body,{phase})=>{
 assert.equal(phase,'experimental');recallStep++;const ctx=JSON.parse(body.input[0].content);
 assert.equal(ctx.readEvidence[0].id,'S2');assert.equal(ctx.attachedPassages[0].id,'S1');return message('The exception changes it. [S2]');
 }});
assert.deepEqual(recallIDs,['R1']);assert.equal(recallStep,1);assert.match(recall.text,/\[S2\]/);assert(recall.trace.some(t=>t.tool==='recall_evidence'));assert(recall.trace.some(t=>t.tool==='conversation_context'&&t.result.sources===2));
console.log('Conversation: no mandatory planner, latest exchange, ambiguity, relevant evidence reuse and separate current citation identities passed.');
const {experimentalConversation}=await import('../assistant-experimental.mjs');
const historical=experimentalConversation([{role:'assistant',answer:{answerText:'A previous rule [S8]. A web result [W2].'}}]);
assert(!historical[0].content.includes('[S8]'));assert.match(historical[0].content,/earlier citation/);assert(!historical[0].content.includes('S8'));
assert(!historical[0].content.includes('[W2]'));
console.log('Conversation citations: historical identities cannot masquerade as current-turn source markers.');
const overlapping=await runExperimentalAssistant({question:'Does the residential exception change that?',history:[
 {role:'user',question:'Can the stairs be adjacent?'},{role:'assistant',answer:{answerText:'The stair separation rule requires checking the occupancy exception. [S1]'}}
],priorEvidence:[{id:'R1',sectionID:'general-rule',title:'General stair separation',summary:'Stair separation and occupancy exceptions.'},{id:'R2',sectionID:'special-rule',title:'Special building stair remoteness',summary:'Stair separation and residential exceptions.'}]},{
 recallEvidence:async ids=>{assert.deepEqual(new Set(ids),new Set(['R1','R2']));return {sources:[{id:'S2',sectionID:'general-rule',text:'General current provision.'},{id:'S3',sectionID:'special-rule',text:'Earlier uncited overlapping exception.'}]};},
 searchLibrary:()=>assert.fail('Earlier overlapping sources are already available'),
 call:async body=>{assert.equal(JSON.parse(body.input[0].content).readEvidence.length,2);return message('Consider the overlapping exception as well. [S2] [S3]');}
});
assert.match(overlapping.text,/\[S3\]/);
console.log('Relevant earlier overlapping provisions are supplied even if the previous answer did not cite them.');
