// Actual Research HTTP, entitlement, binding and persistence; synthetic
// provider verdicts test mechanics only, never legal/source acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";


const scratch = await mkdtemp(join(tmpdir(), "permitext-open-investigation-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "", OPENAI_API_KEY: "offline-provider-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_SERVICE_TIER: "priority", PERMITEXT_RESEARCH_REVISION_REASONING_EFFORT: "high",
  PERMITEXT_RESEARCH_REVISION_SERVICE_TIER: "default", PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01", PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-contract", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5" });
Object.assign(process.env,{PERMITEXT_RESEARCH_ENGINE:'open',PERMITEXT_RESEARCH_LUNA_ONLY:'1',PERMITEXT_RESEARCH_VERIFICATION_SERVICE_TIER:'default'});
const nativeFetch=globalThis.fetch;
let calls=[], draft, doubleError, scenario;
globalThis.fetch=async(url,options)=>{
 try {
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body),phase=body.text.format.name;calls.push(phase);
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);
  let value;
  if(phase==='permitext_research_investigation') {
   assert.equal(body.service_tier,'default');
   value={ready:calls.length>1,queries:calls.length===1?['MC 304.12 identification of equipment']:[],reason:'Find the actual requirement'};
  } else if(phase==='permitext_code_interpretation') {
   const isRepair=Boolean(draft);assert.equal(body.service_tier,isRepair?'default':'priority');
   const match=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: MC\nSECTION: ([^\n]+)/g)].find(m=>m[3]==='304.12');assert(match);
   const text=isRepair?'The identification must identify the area served.':'The identification rule concerns the area served.';
   draft={answerText:text,supportedPoints:[{heading:'Identification',explanation:text,sectionID:match[2],sourceIDs:[match[1]]}],citations:[{sectionID:match[2],sourceIDs:[match[1]],relevance:text}],assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[]};value=draft;
  } else {
   assert.equal(phase,'permitext_research_open_review');assert.equal(body.service_tier,'default');
   const reviews=calls.filter(x=>x===phase).length;
   const answer=JSON.parse(body.input).answer;
   if(reviews===2)assert.equal(answer.answerText,'The identification must identify the area served.');
   const fail=reviews===1||scenario==='rejected';
   value={pass:!fail,issues:fail?[{type:'unsupported_requirement',message:'Correct the identification wording.'}]:[]};
  }
  assert(calls.length<=6);
  return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }catch(error){doubleError=error;throw error;}
};
let server;
try {
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=async(path,body,token)=>{const response=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID()}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 for(scenario of ['accepted','rejected']) {
  calls=[];draft=doubleError=undefined;
  const created=await request('/research/conversations/create',{auth},token),conversationID=created.body.conversation.id;
  const response=await request('/research/conversations/message',{auth,conversationID,requestID:randomUUID(),question:'For our project under the 2022 NYC codes, what identification rule does MC 304.12 provide for installed equipment?'},token);
  if(doubleError)throw doubleError;
  assert.equal(response.status,200,JSON.stringify(response.body));
  assert.deepEqual(calls,['permitext_research_investigation','permitext_research_investigation','permitext_code_interpretation','permitext_research_open_review','permitext_code_interpretation','permitext_research_open_review']);
  const answer=response.body.conversation.messages.at(-1).answer;
  assert.equal(answer.mode,scenario==='accepted'?'openai':'clarification');
  if(scenario==='accepted'){assert.equal(answer.researchEngine,'20261006-open-investigation-v1');assert.equal(answer.investigation.trace[0].queries.length,1);assert(answer.citations.length);}
  else assert.deepEqual(answer.citations,[]);
  const reopened=await request('/research/conversations/get',{auth,conversationID},token);
  assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText,answer.answerText);
 }
 console.log('Open investigation HTTP passed: discovery, draft, one repair, fresh review, Luna tiers, persistence, rejected answer exclusion.');
} finally {if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});}
