// Offline provider doubles exercise delivery, durable provenance and rejection.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const scratch = await mkdtemp(join(tmpdir(), "permitext-decision-fact-http-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1.50", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;


const question='Here is a fictional clause: “The cabinet may be omitted.” What does this clause mean?';
const guidance={answerText:'The supplied clause makes the cabinet optional. This reading does not establish code compliance.',supportedPoints:[],citations:[],supportingSourceUses:[],assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:['Only unverified supplied text is interpreted.'],additionalEvidenceNeeded:[]};
let accept=true, calls=[];
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.openai.com/v1/responses');
 const body=JSON.parse(options.body); const phase=body.text.format.name; calls.push(phase);
 assert(body.instructions.includes('USER-SUPPLIED TEXT ONLY'));
 const value=phase==='permitext_code_interpretation'?guidance:{pass:accept,issues:accept?[]:[{type:'unsupported_requirement',detail:'Synthetic external claim rejection.'}],missingFactsOnly:false,unnecessaryMissingFactIndices:[]};
 return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100,total_tokens:200},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
};
let server;
try {
 const {handleRequest}=await import('../app.mjs');
 server=createServer(handleRequest); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const request=async(path,body,token)=>{const response=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline practical guidance'}}); const account=signed.body.account; const token=account.backendSessionToken; const auth={accountUserID:account.appUserID};
  await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);

 const missing=await request('/research/conversations/create',{auth},token);
 calls=[];
 const missingResponse=await request('/research/conversations/message',{auth,conversationID:missing.body.conversation.id,
  question:'Our lender has an accessibility rider that I have not provided. Does that rider require a vanity cabinet? I need the rider requirement, not Building Code minimums.',requestID:randomUUID()},token);
 assert.equal(missingResponse.status,200,JSON.stringify(missingResponse.body));
 assert.deepEqual(calls,[], 'Missing document clarification must not dispatch a provider request.');
 assert.match(missingResponse.body.conversation.messages.at(-1).answer.answerText,/without its text/);
 const missingReopen=await request('/research/conversations/get',{auth,conversationID:missing.body.conversation.id},token);
 assert.equal(missingReopen.body.conversation.messages.length,2);
 for(const accepted of [true,false]) {
  accept=accepted;calls=[];
  const created=await request('/research/conversations/create',{auth},token);const conversationID=created.body.conversation.id;
  const result=await request('/research/conversations/message',{auth,conversationID,question,requestID:randomUUID()},token);
  assert.equal(result.status,accepted?200:502,JSON.stringify(result.body));
  if(!accepted) assert.match(result.body.error,/stated a requirement that the available evidence did not support/);
  const reopened=await request('/research/conversations/get',{auth,conversationID},token);
  const answers=reopened.body.conversation.messages.filter(m=>m.role==='assistant');
  assert.equal(answers.length,accepted?1:0);
  assert.equal(calls.filter(c=>c==='permitext_research_verification').length,accepted?1:2);
  if(accepted){assert.equal(answers[0].answer.verification.scope,'user_supplied_text');assert.equal(answers[0].answer.suppliedText.text,'The cabinet may be omitted.');assert.deepEqual(answers[0].answer.citations,[]);
   const follow=await request('/research/conversations/message',{auth,conversationID,question:'What does that clause require?',requestID:randomUUID()},token);
   assert.equal(follow.status,200,JSON.stringify(follow.body));
   assert.equal(follow.body.conversation.messages.at(-1).answer.suppliedText.text,'The cabinet may be omitted.');
  }
 }
} finally {globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await rm(scratch,{recursive:true,force:true});}
console.log('Supplied-text HTTP delivery/reopen and verifier rejection passed; no paid calls.');
