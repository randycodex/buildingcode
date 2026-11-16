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
