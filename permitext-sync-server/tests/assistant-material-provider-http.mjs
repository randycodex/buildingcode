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
const passage='The slope of other pedestrian ramps shall not be steeper than one unit vertical in eight units horizontal (12.5-percent slope).';
const question='What does our unprovided lender rider require? Use only the selected passage.';
const responseText={answerText:'The lender rider is not included in this conversation. The selected code passage does not establish what that rider requires.',
  supportedPoints:[],citations:[],supportingSourceUses:[],assumptions:[],missingFacts:[],followUpQuestions:[],
  evidenceLimitations:['The requested lender rider is absent from the selected passage.'],additionalEvidenceNeeded:['Select the relevant source passage in Reader.']};
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.openai.com/v1/responses','No retrieval or property HTTP request is allowed.');
 const body=JSON.parse(options.body); const phase=body.text.format.name;calls.push({phase,body});
 assert.match(body.instructions,/CONVERSATION-ONLY SCOPE/);
 assert.ok(!body.instructions.includes(passage),"Passages belong in input data, not provider instructions.");
 assert.ok(JSON.stringify(body).includes(passage));
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
 const retired=await request('/research/conversations/material',{auth,conversationID:conversation.id,action:'update',
   includeProjectContext:true,factIDs:['old-fact'],noteIDs:['old-note'],comment:'SECRET_UNSELECTED_COMMENT'},token);
 assert.equal(retired.status,410);assert.equal(calls.length,0);
 const adapter=createFileStoreAdapter();
 const raw=(await adapter.read()).researchConversationsByUserID[account.appUserID].find(item=>item.id===conversation.id);
 raw.assistantScope={...raw.assistantScope,includeProjectContext:true,projectContext:{address:'SECRET_UNSELECTED_ADDRESS'},
   facts:[{id:'old-fact',text:'SECRET_UNSELECTED_FACT'}],materials:[{id:'old-note',kind:'note',text:'SECRET_UNSELECTED_NOTE'}]};
 await adapter.saveResearchConversation(account.appUserID,raw,raw.revision);
 const sourceAdded=await request('/research/conversations/evidence',{auth,conversationID:conversation.id,sectionID:'41009495',selectedText:passage},token);
 assert.equal(sourceAdded.status,200,JSON.stringify(sourceAdded.body));assert.equal(calls.length,0);
 const result=await request('/research/conversations/message',{auth,conversationID:conversation.id,question,answerMode:"verified",requestID:randomUUID()},token);
 assert.equal(result.status,200,JSON.stringify(result.body));
 const answer=result.body.conversation.messages.at(-1).answer;
 assert.equal(answer.answerText,responseText.answerText);assert.deepEqual(answer.citations,[]);assert.equal(answer.verification.pass,true);
 assert.equal(calls.filter(item=>item.phase==='permitext_code_interpretation').length,1);
 assert.equal(calls.filter(item=>item.phase==='permitext_research_verification').length,1);
 const stored=await createFileStoreAdapter().read();const record=stored.researchAnswersByUserID[account.appUserID][0];
 assert.equal(record.evidence.length,1);assert.equal(record.evidence[0].passageText,passage);
 assert.equal(record.assistantScopeSnapshot.inputMode,'reader_passages');
 assert.deepEqual(record.assistantScopeSnapshot.materials,[]);assert.deepEqual(record.assistantScopeSnapshot.facts,[]);
 assert.equal(record.assistantScopeSnapshot.projectContext,null);
 assert.doesNotThrow(()=>immutableResearchAnswer(record));
 assert.equal(answer.verification.scope,'conversation_evidence_gap');assert.equal(answer.authorityStatus,'insufficient_evidence');
 assert.deepEqual(stored.researchConversationsByUserID[account.appUserID].find(item=>item.id===conversation.id).assistantScope,raw.assistantScope);
 console.log('Reader-only provider-double checks passed: exact passage delivery, legacy material excluded, independent verification and immutable provenance retained.');
}finally{globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});}
