// Real HTTP, retrieval, verification/revision and persistence. Provider doubles
// exercise recovery and configured roles; they do not grade legal correctness.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {researchRevisionTargets} from '../research-targeted-revision.mjs';
const temporary=await mkdtemp(join(tmpdir(),'permitext-fast-conversation-'));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env,{
 NODE_ENV:'',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(temporary,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',
 PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_ROUTING_MODE:'single',
 PERMITEXT_RESEARCH_REASONING_EFFORT:'low',PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT:'medium',PERMITEXT_RESEARCH_SERVICE_TIER:'priority',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-standard-rates',
 PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5'
});
const nativeFetch=globalThis.fetch;
let turn=0,phases=[],proposed,doubleError;
globalThis.fetch=async(url,options)=>{
 try {
  assert.equal(String(url),'https://api.openai.com/v1/responses');
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
   proposed={answerText:primary+' '+otherRule+' '+extra,supportedPoints:[...points,{heading:'Unnecessary comparison',explanation:extra,sectionID:source.sectionID,sourceIDs:[source.sourceID]}],citations:points.map(({sectionID,sourceIDs,heading})=>({sectionID,sourceIDs,relevance:heading})),assumptions:[],missingFacts:['What is the applicable frontage classification?'],followUpQuestions:[],evidenceLimitations:['The frontage classification remains unresolved.'],additionalEvidenceNeeded:[],supportingSourceUses:[]};
   output=proposed;
  } else if (phase==='permitext_research_targeted_revision') {
   output=turn===0?{edits:[],bindingAdditions:[],pointRemovals:[],citationRemovals:[]}:{edits:[{targetID:researchRevisionTargets(proposed).find(item=>item.path==='answerText'&&item.text.includes('comparison')).id,remove:true,after:''}],bindingAdditions:[],pointRemovals:[2],citationRemovals:[]};
  } else {
   assert.equal(phase,'permitext_research_verification');
   const pass=turn===1&&phases.length===4;
   if(pass){const answer=JSON.parse(input.split('PROPOSED ANSWER JSON\n')[1]);assert(!answer.answerText.includes('comparison'));assert.equal(answer.supportedPoints.length,2);}
   output={pass,issues:pass?[]:[{type:'irrelevant_citation',detail:'Remove the unnecessary comparison sentence and supported point.'}],unnecessaryMissingFactIndices:[]};
  }
  return Response.json({model:body.model,service_tier:'fast',status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
 } catch(error){doubleError=error;throw error;}
};
let server;
try {
 const {handleRequest}=await import('../app.mjs');
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
 for(const question of fixture.questions){
  phases=[];
  const response=await request('/research/conversations/message',{auth,conversationID,question,requestID:randomUUID()},token);
  if(doubleError)throw doubleError;
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(response.body.conversation.primaryProjectID,projectID);
  assert.deepEqual(phases,['permitext_code_interpretation','permitext_research_verification','permitext_research_targeted_revision','permitext_research_verification']);
  assert.equal(response.body.conversation.messages.at(-1).answer.mode,turn===0?'clarification':'openai');
  const store=JSON.parse(await readFile(join(temporary,'store.json')));
  const saved=store.researchConversationsByUserID[account.appUserID].find(item=>item.id===conversationID);
  assert.equal(saved.topicContext.rootTopic,fixture.questions[0]);
  if(turn===1)assert.match(JSON.stringify(saved.topicContext.factTopics),/retail|community facility/);
  turn++;
 }
 console.log('Fast conversation HTTP contract passed: exact configured roles, project facts, topic persisted after rejection, bounded removal and mandatory recheck.');
} finally {
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 globalThis.fetch=nativeFetch;await rm(temporary,{recursive:true,force:true});
}
