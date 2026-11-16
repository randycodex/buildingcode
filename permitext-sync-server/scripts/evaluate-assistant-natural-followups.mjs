// Opt-in, synthetic, end-to-end local evaluation. Never resets the cumulative budget.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {configureLocalAssistant,budgetLocalAssistantEmbeddings} from './local-assistant-environment.mjs';
import {naturalFollowupCases as defaultCases} from '../tests/assistant-natural-followup-cases.mjs';
const {OPENAI_API_KEY,PERMITEXT_RESEARCH_V2_BUDGET_PATH,PERMITEXT_EVAL_CASES,PERMITEXT_EVAL_CASE_MODULE}=process.env;
if(!OPENAI_API_KEY||!PERMITEXT_RESEARCH_V2_BUDGET_PATH)throw new Error('Set the API key and existing cumulative evaluation-budget path.');
const {naturalFollowupCases}=PERMITEXT_EVAL_CASE_MODULE?await import(new URL(PERMITEXT_EVAL_CASE_MODULE,`file://${process.cwd()}/`)):{naturalFollowupCases:defaultCases};
const out=resolve(process.argv[2]||'assistant-followup-results');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'permitext-natural-followups-'));
const {budget}=await configureLocalAssistant({apiKey:OPENAI_API_KEY,budgetPath:PERMITEXT_RESEARCH_V2_BUDGET_PATH,dataPath:join(directory,'store.json'),assetsPath:join(directory,'assets'),allowLocalSourceChanges:true});
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_ASSISTANT_EXPERIMENTAL:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-followups-grant'});
const nativeFetch=globalThis.fetch,providerCalls=[];
globalThis.fetch=budgetLocalAssistantEmbeddings(budget,async(url,options)=>{
 const started=performance.now();const response=await nativeFetch(url,options);
 if(String(url)==='https://api.openai.com/v1/responses'){
  const request=JSON.parse(options.body);delete request.safety_identifier;
  providerCalls.push({started,milliseconds:performance.now()-started,request,response:await response.clone().json()});
  await writeFile(join(out,'provider-traces.json'),JSON.stringify(providerCalls,null,2));
 }return response;
});
let server;const results=[];
try{
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const selected=naturalFollowupCases.filter(c=>!PERMITEXT_EVAL_CASES||PERMITEXT_EVAL_CASES.split(',').includes(c.id));
 // Independent synthetic accounts can run concurrently; turns in each chat stay sequential.
 let cursor=0;const run=async()=>{while(cursor<selected.length){const test=selected[cursor++];
  const userID=`apple:synthetic-followups-${test.id}`,projectID=`followups-${test.id}`;let token;
  const post=async(path,body={},expected=200,bearer=token)=>{
   const response=await nativeFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});
   const data=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(data).slice(0,1000)}`);return data;
  };
  await post('/admin/lifetime-grants/grant',{userID},200,'synthetic-followups-grant');
  token=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:`synthetic-followups-${test.id}`,email:`${test.id}@example.test`,displayName:'Synthetic follow-up test'}})).account.backendSessionToken;
  await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:`record-${projectID}`,clientID:projectID,userID,name:`Synthetic ${test.id}`,address:'Synthetic test address',description:test.description,codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1',colorHex:'#334455',sortOrder:0,updatedAt:new Date().toISOString()}}]}});
  let conversation=(await post('/research/conversations/create',{projectID,analysisMode:'conversation_only',requestID:crypto.randomUUID()},201)).conversation;
  for(let turn=0;turn<test.turns.length;turn++){
   const [question,expectedTopic]=test.turns[turn],started=performance.now();
   const response=await nativeFetch(base+'/research/conversations/message',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({auth:{accountUserID:userID},conversationID:conversation.id,question,requestID:crypto.randomUUID(),researchEngine:'v2',assistantMode:'experimental',analysisMode:'conversation_only',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1})});
   const result=await response.json(),milliseconds=performance.now()-started;
   let record=null,answer=null;if(result.conversation){conversation=result.conversation;const message=conversation.messages.filter(m=>m.role==='assistant').at(-1);answer=message?.answer;if(message)record=(await post('/research/answers/get',{answerID:message.id})).answer;}
   const trace=record?.experimentalResearchTrace||[],intent=trace.find(t=>['resolve_conversation','plan_research'].includes(t.tool))?.result;
   const calls=providerCalls.filter(c=>c.started>=started&&c.started<started+milliseconds);
   // Attribution by question in the last user message; web helpers are reported as totals separately.
   const intentCall=calls.find(c=>c.request.text?.format?.name==='assistant_conversational_intent'&&JSON.parse(c.request.input).currentQuestion===question);
   const row={error:result.error||null,topic:test.id,turn,question,status:response.status,milliseconds,intentMilliseconds:intentCall?.milliseconds||0,intent,answer:answer?.answerText,record,
    checks:{topic:(!intent||expectedTopic.test([intent.question,...(intent.issues||[]).map(i=>i.question)].join(' ')))&&expectedTopic.test(answer?.answerText||''),citations:(answer?.citations||[]).every(c=>(record?.evidence||[]).some(e=>e.sectionID===c.sectionID)),hasUnverifiedMarker:/\[source not verified\]/.test(answer?.answerText||'')},
    tools:trace.map(t=>({tool:t.tool,query:t.query,sources:t.result?.sources?.map(s=>({id:s.id,sectionID:s.sectionID,title:s.title,recalledFrom:s.recalledFrom})),unavailable:t.result?.unavailable}))};
   results.push(row);await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));
   console.log(JSON.stringify({topic:test.id,turn,question,status:response.status,seconds:+(milliseconds/1000).toFixed(1),intentSeconds:+((intentCall?.milliseconds||0)/1000).toFixed(1),checks:row.checks,tools:row.tools.map(t=>t.tool),budget:await budget.summary()}));
   if(response.status!==200)break;
  }
 }};
 await Promise.all([run(),run()]);
 await writeFile(join(out,'budget.json'),JSON.stringify(await budget.summary(),null,2));
}finally{globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
