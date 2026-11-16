import {AsyncLocalStorage} from 'node:async_hooks';
import {profilePhase,profileCallCost,summarizeTurnProfile,compactResearchTrace} from './assistant-profile-metrics.mjs';
// Opt-in, synthetic, end-to-end local evaluation. Never resets the cumulative budget.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {configureLocalAssistant,budgetLocalAssistantEmbeddings} from './local-assistant-environment.mjs';
import {naturalFollowupCases as defaultCases} from '../tests/assistant-natural-followup-cases.mjs';
const {OPENAI_API_KEY,PERMITEXT_RESEARCH_V2_BUDGET_PATH,PERMITEXT_EVAL_CASES,PERMITEXT_EVAL_CASE_MODULE,PERMITEXT_EVAL_PROFILE}=process.env;
if(!OPENAI_API_KEY||!PERMITEXT_RESEARCH_V2_BUDGET_PATH)throw new Error('Set the API key and existing cumulative evaluation-budget path.');
const {naturalFollowupCases}=PERMITEXT_EVAL_CASE_MODULE?await import(new URL(PERMITEXT_EVAL_CASE_MODULE,`file://${process.cwd()}/`)):{naturalFollowupCases:defaultCases};
const out=resolve(process.argv[2]||'assistant-followup-results');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'permitext-natural-followups-'));
const {budget}=await configureLocalAssistant({apiKey:OPENAI_API_KEY,budgetPath:PERMITEXT_RESEARCH_V2_BUDGET_PATH,dataPath:join(directory,'store.json'),assetsPath:join(directory,'assets'),allowLocalSourceChanges:true});
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_ASSISTANT_EXPERIMENTAL:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-followups-grant'});
const nativeFetch=globalThis.fetch,providerCalls=[],apiCalls=[],profileContext=new AsyncLocalStorage(),progressByTurn=new Map();
const profiling=PERMITEXT_EVAL_PROFILE==='1';
globalThis.fetch=budgetLocalAssistantEmbeddings(budget,async(url,options)=>{
 const started=performance.now();const response=await nativeFetch(url,options),headersMilliseconds=performance.now()-started;
 const endpoint=String(url)==='https://api.openai.com/v1/responses'?'responses':String(url)==='https://api.openai.com/v1/embeddings'?'embeddings':null;
 if(endpoint){
  const request=JSON.parse(options.body),payload=await response.clone().json(),ended=performance.now();delete request.safety_identifier;
  const turnID=profileContext.getStore()?.turnID||null;
  apiCalls.push({turnID,started,ended,headersMilliseconds,endpoint,phase:profilePhase(request,payload,endpoint),requestBytes:Buffer.byteLength(JSON.stringify(request)),
   usage:payload.usage||null,estimatedUSD:profileCallCost(payload,endpoint),status:response.status,webActions:(payload.output||[]).filter(o=>o.type==='web_search_call').length});
  if(endpoint==='responses')providerCalls.push({turnID,started,milliseconds:ended-started,request,response:payload});
  if(!profiling)await writeFile(join(out,'provider-traces.json'),JSON.stringify(providerCalls,null,2));
 }return response;
});
let server;const results=[];
try{
 const {handleRequest}=await import('../app.mjs');server=createServer((request,response)=>profileContext.run({turnID:request.headers['x-eval-turn-id']||null},()=>{
  if(profiling&&request.headers['x-eval-turn-id']){
   const started=performance.now(),events=[];progressByTurn.set(request.headers['x-eval-turn-id'],events);
   const write=response.write;response.write=function(chunk,...args){try{for(const line of String(chunk).trim().split('\n')){const event=JSON.parse(line);if(event.type==='progress')events.push({milliseconds:performance.now()-started,...event.progress});}}catch{}return write.call(this,chunk,...args);};
  }
  return handleRequest(request,response);
 }));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const selected=naturalFollowupCases.filter(c=>!PERMITEXT_EVAL_CASES||PERMITEXT_EVAL_CASES.split(',').includes(c.id));
 // Profile serially to avoid cross-conversation CPU/network contention.
 // Independent synthetic accounts can otherwise run concurrently.
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
   const [question,expectedTopic]=test.turns[turn],started=performance.now(),turnID=crypto.randomUUID(),cpuStarted=process.cpuUsage();
   const response=await nativeFetch(base+'/research/conversations/message',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'x-eval-turn-id':turnID},body:JSON.stringify({auth:{accountUserID:userID},...(profiling?{progressStream:'ndjson'}:{}),conversationID:conversation.id,question,requestID:crypto.randomUUID(),researchEngine:'v2',assistantMode:'experimental',analysisMode:'conversation_only',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1})});
   const streamed=response.headers.get('content-type')?.includes('ndjson');
   let result;
   if(streamed){const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));const last=events.at(-1);result=last.type==='result'?last.payload:last.error;}else result=await response.json();
   const milliseconds=performance.now()-started,cpu=process.cpuUsage(cpuStarted),effectiveStatus=result.error?(result.status||response.status):response.status;
   let record=null,answer=null;if(result.conversation){conversation=result.conversation;const message=conversation.messages.filter(m=>m.role==='assistant').at(-1);answer=message?.answer;if(message)record=(await post('/research/answers/get',{answerID:message.id})).answer;}
   const trace=record?.experimentalResearchTrace||[],intent=trace.find(t=>['resolve_conversation','plan_research'].includes(t.tool))?.result;
   const calls=providerCalls.filter(c=>c.turnID===turnID);
   // Attribution by question in the last user message; web helpers are reported as totals separately.
   const intentCall=calls.find(c=>c.request.text?.format?.name==='assistant_conversational_intent'&&JSON.parse(c.request.input).currentQuestion===question);
   const metrics=profiling?summarizeTurnProfile(apiCalls.filter(c=>c.turnID===turnID),{milliseconds,cpuMilliseconds:(cpu.user+cpu.system)/1000,progress:progressByTurn.get(turnID)||[]},trace):null;
   const row={...(metrics?{profile:metrics}:{}),error:result.error||null,topic:test.id,turn,question,status:effectiveStatus,milliseconds,intentMilliseconds:intentCall?.milliseconds||0,intent,answer:answer?.answerText,record,
    checks:{topic:(!intent||expectedTopic.test([intent.question,...(intent.issues||[]).map(i=>i.question)].join(' ')))&&expectedTopic.test(answer?.answerText||''),citations:(answer?.citations||[]).every(c=>(record?.evidence||[]).some(e=>e.sectionID===c.sectionID)),hasUnverifiedMarker:/\[source not verified\]/.test(answer?.answerText||'')},
    tools:compactResearchTrace(trace)};
   results.push(row);await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));
   console.log(JSON.stringify({topic:test.id,turn,question,status:effectiveStatus,seconds:+(milliseconds/1000).toFixed(1),intentSeconds:+((intentCall?.milliseconds||0)/1000).toFixed(1),checks:row.checks,tools:row.tools.map(t=>t.tool),budget:await budget.summary()}));
   if(profiling){await writeFile(join(out,'provider-traces.json'),JSON.stringify(providerCalls,null,2));await writeFile(join(out,'api-calls.json'),JSON.stringify(apiCalls,null,2));}
   if(effectiveStatus!==200)break;
  }
 }};
 if(profiling)await run();else await Promise.all([run(),run()]);
 await writeFile(join(out,'budget.json'),JSON.stringify(await budget.summary(),null,2));
}catch(error){
 await writeFile(join(out,'runner-error.json'),JSON.stringify({name:error.name,message:error.message,stack:error.stack},null,2));
 throw error;
}finally{
 if(profiling){await writeFile(join(out,'provider-traces.json'),JSON.stringify(providerCalls,null,2));await writeFile(join(out,'api-calls.json'),JSON.stringify(apiCalls,null,2));await writeFile(join(out,'progress.json'),JSON.stringify(Object.fromEntries(progressByTurn),null,2));await writeFile(join(out,'budget.json'),JSON.stringify(await budget.summary(),null,2));}
 globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});
}
