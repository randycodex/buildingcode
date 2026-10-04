import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";
// Real HTTP with synthetic embeddings and Responses providers. This exercises
// durable cost/turn ownership and persistence; it does not grade legal accuracy.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {researchRevisionTargets} from '../research-targeted-revision.mjs';
import {researchPassageEmbeddingText,researchSemanticInputHash,researchSemanticEmbeddingTextVersion} from '../research-semantic-passages.mjs';
const temporary=await mkdtemp(join(tmpdir(),'permitext-semantic-http-'));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env,{
 PERMITEXT_RESEARCH_PASSAGE_SEARCH:'1',PERMITEXT_RESEARCH_SEMANTIC_SEARCH:'1',PERMITEXT_RESEARCH_SEMANTIC_VECTOR_PATH:join(temporary,'vectors.json'),
 NODE_ENV:'',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(temporary,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',
 PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_ROUTING_MODE:'single',
 PERMITEXT_RESEARCH_REASONING_EFFORT:'low',PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT:'medium',PERMITEXT_RESEARCH_SERVICE_TIER:'priority',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-standard-rates',
 PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5'
});
const nativeFetch=globalThis.fetch;
const nativeInfo=console.info,accountingLogs=[];
console.info=(...args)=>{
 try { const event=JSON.parse(args[0]);if(event.event==='research_operation_accounting')accountingLogs.push(event); } catch {}
 nativeInfo(...args);
};
let turn=0,phases=[],proposed,doubleError,embeddingCalls=0,queryVector=Array.from({length:256},(_,index)=>index===0?1:0);
globalThis.fetch=async(url,options)=>{
 try {
  if (String(url)==='https://api.openai.com/v1/embeddings') {
   embeddingCalls++;
   const store=JSON.parse(await readFile(join(temporary,'store.json')));
   const reservations=Object.values(store.researchUsageByUserID||{}).flat().filter(entry=>entry.mode==='reservation');
   assert.equal(reservations.length,1,'The durable turn must exist before embedding dispatch.');
   const body=JSON.parse(options.body);
   assert.equal(body.model,'text-embedding-3-small');
   assert.equal(body.dimensions,256);
   return Response.json({model:body.model,...(turn===2?{}:{usage:{prompt_tokens:1000,total_tokens:1000}}),data:[{index:0,embedding:queryVector}]});
  }
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  if(turn===2)return Response.json({error:{message:'synthetic provider rejection'}},{status:503});
  const body=JSON.parse(options.body),phase=body.text.format.name;
  phases.push(phase);
  const writer=phase!=='permitext_research_verification';
  assert.equal(body.model,'gpt-6-luna');
  assert.equal(body.service_tier,'priority');
  assert.equal(body.reasoning.effort,writer?'low':'medium');
  assert.equal(body.max_output_tokens,writer?24000:8000);
  const input=typeof body.input==='string'?body.input:body.input.flatMap(item=>item.content.map(part=>part.text||'')).join('\n');
  if (turn===1) {
   assert.match(input,/transparency requirements/i);
   assert.match(input,/new building with ground-floor retail and community facility space/i);
   assert.match(input,/188\.5/,'Existing structured project facts remain supplied.');
   assert.match(input,/50 percent|50%/,'Transparency provisions remain in the recovered evidence.');
  }
  let output;
  if (phase==='permitext_code_interpretation') {
   const evidence=Array.from(input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g),([,sourceID,sectionID,sectionNumber])=>({sourceID,sectionID,sectionNumber}));
   const source=evidence.find(item=>item.sectionNumber==='32-321');
   assert(source);
   const primary='If Tier B governs this frontage, ZR § 32-321 requires at least 50 percent transparent glazing in the applicable ground-floor street-wall area.';
   const extra='This comparison is unnecessary.';
   const other=evidence.find(item=>item.sectionNumber==='37-34');
   assert(other);
   const otherRule='If ZR § 37-34 governs the primary frontage, it likewise requires at least 50 percent transparent glazing in its specified ground-floor wall area.';
   const points=[{heading:'Tier B',explanation:primary,sectionID:source.sectionID,sourceIDs:[source.sourceID]}, {heading:'Primary frontage',explanation:otherRule,sectionID:other.sectionID,sourceIDs:[other.sourceID]}];
   proposed={answerText:primary+' '+otherRule+' '+extra,supportedPoints:[...points,{heading:'Unnecessary comparison',explanation:extra,sectionID:source.sectionID,sourceIDs:[source.sourceID]}],citations:points.map(({sectionID,sourceIDs,heading})=>({sectionID,sourceIDs,relevance:heading==='Tier B'?'Tier B and an unsupplied definition.':heading})),assumptions:[],missingFacts:['What is the applicable frontage classification?'],followUpQuestions:[],evidenceLimitations:['The frontage classification remains unresolved.'],additionalEvidenceNeeded:[],supportingSourceUses:[]};
   output=proposed;
  } else if (phase==='permitext_research_targeted_revision') {
   output=turn===0?{edits:[],bindingAdditions:[],pointRemovals:[],citationRemovals:[]}:{edits:[{targetID:researchRevisionTargets(proposed).find(item=>item.path==='answerText'&&item.text.includes('comparison')).id,remove:true,after:''},{targetID:researchRevisionTargets(proposed).find(item=>item.path==='supportedPoints/2/explanation').id,remove:true,after:''},{targetID:researchRevisionTargets(proposed).find(item=>item.path==='citations/0/relevance').id,remove:false,after:'Tier B transparency rule.'}],bindingAdditions:[],pointRemovals:[2],citationRemovals:[]};
  } else {
   assert.equal(phase,'permitext_research_verification');
   const pass=turn===1&&phases.length===4;
   if(pass){const answer=JSON.parse(input.split('PROPOSED ANSWER JSON\n')[1]);assert(!answer.answerText.includes('comparison'));assert.equal(answer.supportedPoints.length,2);assert.equal(answer.citations[0].relevance,'Tier B transparency rule.');assert(!JSON.stringify(answer).includes('unsupplied definition'));}
   output={pass,issues:pass?[]:[{type:'irrelevant_citation',detail:'Remove the unnecessary comparison sentence and supported point; correct the unsupported definition attribution in the retained citation relevance.'}],unnecessaryMissingFactIndices:[]};
  }
  return Response.json(withSyntheticMaterialScopeProviderResponse(body, {model:body.model,service_tier:'fast',status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));
 } catch(error){doubleError=error;throw error;}
};
let server;
try {
 const {handleRequest,researchCorpusPlanForTurn,researchCorpusResources}=await import('../app.mjs');
 server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=async(path,body,token)=>{const response=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline fast conversation'}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 const projectID=randomUUID(),fixture=JSON.parse(await readFile(new URL('./fixtures/research-transparency-project-facts.json',import.meta.url)));
 const pushed=await request('/sync/push',{batch:{user:{id:account.appUserID},mutations:[{project:{id:projectID,clientID:projectID,userID:account.appUserID,name:'Recovery contract',address:fixture.address,structuredFacts:fixture.structuredFacts,updatedAt:new Date().toISOString()}}]}},token);
 assert.equal(pushed.status,200);
 const created=await request('/research/conversations/create',{auth,projectID},token);
 assert.equal(created.status,201);
 const conversationID=created.body.conversation.id;
 const plan=await researchCorpusPlanForTurn({question:fixture.questions[0]});
 const {passageIndex}=await researchCorpusResources(plan);
 const vectorPassage=passageIndex.passages.find(item=>item.sectionNumber==='32-321');
 assert(vectorPassage);
 await writeFile(join(temporary,'vectors.json'),JSON.stringify({schemaVersion:1,model:'text-embedding-3-small',dimensions:256,embeddingTextVersion:researchSemanticEmbeddingTextVersion,entries:[{inputHash:researchSemanticInputHash(researchPassageEmbeddingText(vectorPassage)),embedding:Array.from({length:256},(_,index)=>index===0?1:0)}]}));
 let replayID;
 for(const question of fixture.questions){
  phases=[];
  replayID=randomUUID();
  const response=await request('/research/conversations/message',{auth,conversationID,question,requestID:replayID},token);
  if(doubleError)throw doubleError;
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(response.body.conversation.primaryProjectID,projectID);
  assert.deepEqual(phases,['permitext_code_interpretation','permitext_research_verification','permitext_research_targeted_revision','permitext_research_verification']);
  assert.equal(response.body.conversation.messages.at(-1).answer.mode,turn===0?'clarification':'openai');
  const store=JSON.parse(await readFile(join(temporary,'store.json')));
  const saved=store.researchConversationsByUserID[account.appUserID].find(item=>item.id===conversationID);
  assert.equal(saved.topicContext.rootTopic,fixture.questions[0]);
  if(turn===1)assert.match(JSON.stringify(saved.topicContext.factTopics),/retail|community facility/);
  const operation=store.researchOperationsByUserID[account.appUserID].at(-1);
  assert.equal(operation.embeddingUsage.inputTokens,1000);
  assert.equal(operation.embeddingUsage.providerRequestCount,1);
  assert.equal(operation.embeddingUsage.modelUsage[0].requestKind,'embedding');
  assert.equal(operation.semanticSearch.status,'complete');
  assert(operation.semanticSearch.hitCount>0);
  assert(operation.semanticSearch.coveredPassages>0);
  assert(operation.semanticSearch.totalPassages>=operation.semanticSearch.coveredPassages);
  const accountingLog=accountingLogs.find(event=>event.operationID===operation.id);
  assert(accountingLog);assert.equal(accountingLog.embeddingProviderRequestCount,1);
  assert.equal(accountingLog.embeddingInputTokens,1000);
  assert.equal(accountingLog.semanticSearch.status,'complete');
  assert.deepEqual(Object.keys(accountingLog.semanticSearch).sort(),['status','enabled','fallbackReason','queryCached','hitCount','coveredPassages','totalPassages'].sort(),'Semantic logs contain bounded counters/status only.');
  assert(operation.actualProviderCostUSD>=.00002);
  assert.equal(operation.charged,turn===1,'Verification recovery stays free despite a paid query embedding.');
  assert(!(store.researchUsageByUserID[account.appUserID]||[]).some(entry=>entry.mode==='reservation'),'Free clarification must release its lazy turn reservation.');
  if(turn===1){
   const entry=store.researchUsageByUserID[account.appUserID].at(-1);
   assert(entry.modelUsage.some(item=>item.requestKind==='embedding'));
   assert.equal(entry.totalTokens,1800);
   assert.match(entry.pricingVersion,/openai-text-embedding-3-small/);
  }
  turn++;
 }
 const beforeReplay=embeddingCalls,phasesBeforeReplay=phases.length;
 const replay=await request('/research/conversations/message',{auth,conversationID,question:fixture.questions[1],requestID:replayID},token);
 assert.equal(replay.status,200);assert(replay.body.replayed);
 assert.equal(embeddingCalls,beforeReplay);assert.equal(phases.length,phasesBeforeReplay);
 const failed=await request('/research/conversations/message',{auth,conversationID,question:'For this project, explain the retail frontage glazing requirements.',requestID:randomUUID()},token);
 if(doubleError)throw doubleError;
 assert.equal(failed.status,502,JSON.stringify(failed.body));
 const finalStore=JSON.parse(await readFile(join(temporary,'store.json')));
 const failedOperation=finalStore.researchOperationsByUserID[account.appUserID].at(-1);
 assert.equal(failedOperation.status,'failed');assert.equal(failedOperation.charged,false);
 assert.equal(failedOperation.embeddingUsage.pendingProviderRequestCount,1);
 assert.equal(failedOperation.semanticSearch.fallbackReason,'SEMANTIC_RESPONSE_INVALID');
 const failedLog=accountingLogs.find(event=>event.operationID===failedOperation.id);
 assert.equal(failedLog.embeddingProviderRequestCount,1);assert.equal(failedLog.embeddingPendingProviderRequestCount,1);
 assert.equal(failedLog.semanticSearch.fallbackReason,'SEMANTIC_RESPONSE_INVALID');
 assert(failedOperation.embeddingUsage.unreconciledProviderCostUSD>0);
 assert(failedOperation.conservativeProviderCostUSD>=failedOperation.embeddingUsage.unreconciledProviderCostUSD);
 assert(!(finalStore.researchUsageByUserID[account.appUserID]||[]).some(entry=>entry.mode==='reservation'));
 process.env.PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT='1';
 process.env.PERMITEXT_RESEARCH_PAID_TURNS_ENABLED='1';
 const callsBeforeRejected=embeddingCalls,phasesBeforeRejected=phases.length;
 const exhausted=await request('/research/conversations/message',{auth,conversationID,question:'How do glazing width and wall length affect the current storefront transparency calculation?',requestID:randomUUID()},token);
 assert.equal(exhausted.status,402,JSON.stringify(exhausted.body));
 assert.equal(exhausted.body.code,'RESEARCH_TURNS_REQUIRED');
 const conflict=await request('/research/conversations/message',{auth,conversationID,question:'Different storefront question with the completed request ID',requestID:replayID},token);
 assert.equal(conflict.status,409);assert.equal(conflict.body.code,'RESEARCH_REQUEST_ID_CONFLICT');
 const unauthenticated=await request('/research/conversations/message',{auth,conversationID,question:'Unauthenticated storefront question',requestID:randomUUID()});
 assert.equal(unauthenticated.status,401);
 assert.equal(embeddingCalls,callsBeforeRejected);assert.equal(phases.length,phasesBeforeRejected);
 console.log('Semantic HTTP accounting passed: durable reserve before query dispatch, free and failed expense persistence, completed embedding billing, replay/credit/auth rejection without provider calls.');
} finally {
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 globalThis.fetch=nativeFetch;await rm(temporary,{recursive:true,force:true});
 console.info=nativeInfo;
}
