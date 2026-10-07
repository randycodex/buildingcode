// Synthetic provider outputs exercise actual HTTP, validation, spend accounting
// and persistence. No legal acceptance or real provider quality is asserted.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const scratch=await mkdtemp(join(tmpdir(),'permitext-open-recovery-'));
for(const key of Object.keys(process.env)) if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env,JSON.parse(await readFile(new URL('../config/research-open-investigation.json',import.meta.url))),{
 NODE_ENV:'',OPENAI_API_KEY:'offline-provider-double',PERMITEXT_RESEARCH_SEMANTIC_SEARCH:'0',PERMITEXT_RESEARCH_WEB_SUPPORT:'0',
 PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',
 PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',
 PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5'});
const nativeFetch=globalThis.fetch;
let scenario,calls,counts,doubleError;
const finding='Synthetic finding: correct the identification wording and preserve its exception.';
globalThis.fetch=async(url,options)=>{
 try {
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body),phase=body.text.format.name;
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);
  calls.push(phase);const count=counts[phase]=(counts[phase]||0)+1;
  let value,status='completed';
  if(phase==='permitext_research_investigation'){
   assert.equal(body.service_tier,'default');
   value=scenario==='investigation-format'&&count===1 ? {ready:true} : {ready:true,queries:[],retainSourceIDs:[],reason:'Synthetic rule present.'};
  }else if(phase==='permitext_code_interpretation'){
   const match=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: MC\nSECTION: ([^\n]+)/g)].find(m=>m[3]==='304.12');
   assert(match);
   const text='The identification must identify the area served, subject to the stated room-only exception.';
   value={answerText:text,supportedPoints:[{heading:'Identification',explanation:text,sectionID:match[2],sourceIDs:[match[1]]}],
    citations:[{sectionID:match[2],sourceIDs:[match[1]],relevance:'Identification rule.'}],
    assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[]};
   if(count>1){
    assert.equal(body.service_tier,'default');assert.equal(body.reasoning.effort,'high');
    assert(body.input.includes(finding),'The complete reviewer finding reaches the repair');
    if(scenario==='repair-format'&&count===2)value.supportedPoints[0].sourceIDs=['invented-passage'];
    if(scenario==='repair-format'&&count===3){assert(body.input.includes('structuredResponseFailure'));assert(body.input.includes('INVALID_RESEARCH_CITATION'));assert(body.input.includes('invented-passage'));}
   }
   if(['gap','rejected-gap'].includes(scenario))value={...value,
    answerText:scenario==='gap'?'The supplied text does not establish the requested rule.':'Synthetic unsupported permission.',
    supportedPoints:[],citations:[],evidenceLimitations:['The controlling source is missing.'],additionalEvidenceNeeded:['The specific operative rule.']};
  }else{
   assert.equal(phase,'permitext_research_open_review');assert.equal(body.service_tier,'default');
   assert.equal(JSON.parse(body.input).evidenceGapOnly,['gap','rejected-gap'].includes(scenario));
   const fail=scenario==='rejected-gap'||scenario==='repair-format'&&count===1;
   value={pass:!fail,issues:fail?[{type:'unsupported_requirement',message:finding}]:[]};
   if(scenario==='review-format'&&count===1||scenario==='terminal-review')value={pass:false,issues:[]};
   if(scenario==='truncated-review'&&count===1)status='incomplete';
   if(scenario==='truncated-review'&&count===2)assert.equal(body.max_output_tokens,12000);
  }
  assert(calls.length<=8);
  return Response.json({model:body.model,status,
   ...(status==='incomplete'?{incomplete_details:{reason:'max_output_tokens'}}:{}),
   usage:{input_tokens:100,output_tokens:100},
   output:status==='incomplete'?[]:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }catch(e){doubleError=e;throw e;}
};
let server;
try {
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=async(path,body,token)=>{const r=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{
  method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID()}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 for(scenario of ['investigation-format','review-format','truncated-review','repair-format','gap','rejected-gap','terminal-review']){
  calls=[];counts={};doubleError=undefined;
  const created=await request('/research/conversations/create',{auth},token),conversationID=created.body.conversation.id;
  const result=await request('/research/conversations/message',{auth,conversationID,requestID:randomUUID(),
   question:'For our NYC project, what identification rule does MC 304.12 provide for installed equipment?'},token);
  if(doubleError)throw doubleError;
  assert.equal(result.status,200,JSON.stringify(result.body));
  const answer=result.body.conversation.messages.at(-1).answer;
  const rejected=['rejected-gap','terminal-review'].includes(scenario);
  assert.equal(answer.mode,rejected?'clarification':'openai',scenario);
  if(rejected||scenario==='gap')assert.deepEqual(answer.citations,[]);
  if(scenario==='repair-format')assert.equal(counts.permitext_code_interpretation,3);
  if(scenario==='investigation-format')assert.equal(counts.permitext_research_investigation,2);
  if(['review-format','truncated-review','terminal-review'].includes(scenario))assert.equal(counts.permitext_research_open_review,2);
  if(scenario==='terminal-review')assert.equal(counts.permitext_code_interpretation,1,'Malformed reviewer is never a substantive repair finding');
  const reopened=await request('/research/conversations/get',{auth,conversationID},token);
  assert.deepEqual(reopened.body.conversation.messages.at(-1).answer,answer,'Only the reviewed final answer or clarification persists');
 }
 const store=JSON.parse(await readFile(join(scratch,'store.json'),'utf8'));
 const operations=Object.values(store.researchOperationsByUserID).flatMap(items=>Array.isArray(items)?items:Object.values(items));
 assert.equal(operations.length,7);
 assert.deepEqual(operations.map(operation=>operation.providerRequestCount).sort(),[3,4,4,4,4,5,6]);
 for(const operation of operations){
  assert.equal(operation.pendingProviderRequestCount,0);
  assert(operation.actualProviderCostUSD>0,'Rejected outputs still incur provider expense');
 }
 console.log('Open recovery HTTP passed: malformed investigation/review, truncation allowance, exact citation repair, reviewed gaps, rejection, settled accounting and persistence; zero live provider calls.');
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});}
