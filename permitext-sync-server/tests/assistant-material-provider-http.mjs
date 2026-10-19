import { syntheticMaterialScopeReview } from "./research-applicability-response-double.mjs";
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
const calls=[];
const comment='The selected comment says the proposed lobby is on the first floor. This is an observation, not an approved project fact.';
const question='Summarize the comment I added.';
let responseText={answerText:'Your comment describes a proposed first-floor lobby. This is your observation and does not establish an approved project fact or code compliance.',supportedPoints:[],citations:[],supportingSourceUses:[],assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:['Only the attached user comment was reviewed.'],additionalEvidenceNeeded:[]};
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.openai.com/v1/responses','No retrieval or property HTTP request is allowed.');
 const body=JSON.parse(options.body); const phase=body.text.format.name;calls.push({phase,body});
 assert.match(body.instructions,/CONVERSATION-ONLY SCOPE/);
 assert.ok(!body.instructions.includes(comment),"Untrusted attachment content belongs in input data, not provider instructions.");
 assert.match(JSON.stringify(body),/proposed lobby is on the first floor/);
 assert.doesNotMatch(JSON.stringify(body),/SECRET_UNSELECTED/);
 assert.equal(body.tools,undefined);
 const value=phase==='permitext_code_interpretation'?responseText:{pass:true,issues:[],missingFactsOnly:false,unnecessaryMissingFactIndices:[],materialScopeReview:syntheticMaterialScopeReview(body)};
 return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100,total_tokens:200},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
};
let server;
try {
 const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
 const {immutableResearchAnswer}=await import('../project-foundation-contract.mjs');
 server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=async(path,body,token)=>{const res=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return{status:res.status,body:await res.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline scoped material test'}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 let conversation=(await request('/research/conversations/create',{auth,analysisMode:'conversation_only'},token)).body.conversation;
 const loaded=await request('/research/conversations/material',{auth,conversationID:conversation.id,action:'update',expectedRevision:conversation.revision,
   includeProjectContext:false,factIDs:[],noteIDs:[],comment},token);
 assert.equal(loaded.status,200,JSON.stringify(loaded.body));conversation=loaded.body.conversation;assert.equal(calls.length,0);
 const result=await request('/research/conversations/message',{auth,conversationID:conversation.id,question,requestID:randomUUID()},token);
 assert.equal(result.status,200,JSON.stringify(result.body));
 const answer=result.body.conversation.messages.at(-1).answer;
 assert.equal(answer.answerText,responseText.answerText);assert.deepEqual(answer.citations,[]);assert.equal(answer.verification.pass,true);
 assert.equal(calls.filter(item=>item.phase==='permitext_code_interpretation').length,1);
 assert.equal(calls.filter(item=>item.phase==='permitext_research_verification').length,1);
 const stored=await createFileStoreAdapter().read();const record=stored.researchAnswersByUserID[account.appUserID][0];
 assert.equal(record.evidence.length,0);assert.equal(record.assistantScopeSnapshot.materials[0].text,comment);
 assert.throws(()=>immutableResearchAnswer({...record,assistantScopeSnapshot:{...record.assistantScopeSnapshot,materials:[]}}),/evidence|citations/);
 const sourceAdded=await request('/research/conversations/evidence',{auth,conversationID:conversation.id,sectionID:'41009495',
   selectedText:'The slope of other pedestrian ramps shall not be steeper than one unit vertical in eight units horizontal (12.5-percent slope).'},token);
 assert.equal(sourceAdded.status,200,JSON.stringify(sourceAdded.body));
 responseText={...responseText,answerText:'The lender rider is not included in this conversation. The selected code passage and comment do not establish what that rider requires. Add its exact wording to review it.',
   evidenceLimitations:['The requested lender rider is absent from the included material.'],additionalEvidenceNeeded:['Add the lender rider text.']};
 const gap=await request('/research/conversations/message',{auth,conversationID:conversation.id,question:'What does our unprovided lender rider require? Use only the conversation material.',requestID:randomUUID()},token);
 assert.equal(gap.status,200,JSON.stringify(gap.body));const gapAnswer=gap.body.conversation.messages.at(-1).answer;
 assert.equal(gapAnswer.verification.pass,true);assert.equal(gapAnswer.verification.scope,'conversation_evidence_gap');
 assert.equal(gapAnswer.authorityStatus,'insufficient_evidence');assert.deepEqual(gapAnswer.citations,[]);
 console.log('Assistant provider-double HTTP checks passed: exact supplied material, independent verification, no search, immutable notes and bounded missing-evidence answers.');
}finally{globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});}
