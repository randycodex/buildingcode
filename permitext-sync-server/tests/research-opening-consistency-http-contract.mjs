// Removing a contradictory acknowledgement cannot approve the remaining answer.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const scratch=await mkdtemp(join(tmpdir(),'permitext-opening-consistency-'));
for(const key of Object.keys(process.env)) if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'2',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'2',PERMITEXT_RESEARCH_DAILY_CAP_USD:'2',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'2'});
Object.assign(process.env,{PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-fixture'});
const nativeFetch=globalThis.fetch;
const question='Under 2022 NYC Mechanical Code MC 401.4, would a ventilation intake 8 feet from the side lot line on a 40-foot-wide Group B lot meet the lot-line separation requirement? It faces a private side yard.';
const explanation='An intake 8 feet from the side lot line does not meet the 10-foot minimum for the stated 40-foot-wide lot (MC § 401.4).';
let accepted=false,calls=0,providerError;
globalThis.fetch=async(url,options)=>{
 try {
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body);calls++;
  let value;
  if(body.text.format.name==='permitext_code_interpretation'){
   const source=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: MC\nSECTION: 401\.4\n/g)][0];
   assert(source,'The rule must be present in the real assembled evidence');
   const [,sourceID,sectionID]=source;
   value={answerText:'**Yes.** '+explanation,supportedPoints:[{heading:'Lot-line minimum',explanation:'MC § 401.4 requires at least 10 feet from lot lines. The under-20-foot-lot rule does not apply to this 40-foot lot.',sectionID,sourceIDs:[sourceID]}],citations:[{sectionID,sourceIDs:[sourceID],relevance:'Applicable lot-line minimum.'}],assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[]};
  }else{
   assert.equal(body.text.format.name,'permitext_research_verification');
   const answer=JSON.parse(body.input.split('PROPOSED ANSWER JSON\n')[1]);
   assert.equal(answer.answerText,explanation,'The final verifier must receive the explanation after removing only Yes');
   assert.equal(answer.conclusion,explanation,'The legacy conclusion alias must agree with the reviewed narrative');
   assert.equal(answer.supportedPoints.length,1);assert.equal(answer.citations.length,1);
   value=accepted?{pass:true,issues:[]}:{pass:false,issues:[{type:'unsupported_requirement',detail:'Synthetic rejection: stripping an acknowledgement does not verify legal support.'}]};
  }
  return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }catch(error){providerError=error;throw error;}
};
let server;
try{
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const post=async(path,body,token)=>{
  const response=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
 };
 const signed=await post('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline opening test'}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await post('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 for(accepted of [false,true]){
  calls=0;providerError=null;
  const created=await post('/research/conversations/create',{auth},token);
  const conversationID=created.body.conversation.id;
  const response=await post('/research/conversations/message',{auth,conversationID,question,requestID:randomUUID()},token);
  if(providerError)throw providerError;
  assert.equal(response.status,200);
  const answer=response.body.conversation.messages.at(-1).answer;
  assert.equal(calls,accepted?2:4);
  if(accepted){assert.equal(answer.mode,'openai');assert.equal(answer.answerText,explanation);assert.equal(answer.verification.pass,true);}
  else{assert.equal(answer.mode,'clarification');assert.equal(answer.charged,false);}
 }
 console.log('Opening consistency HTTP passed: real retrieval, preserved substantive text, mandatory acceptance and rejection gates; no paid calls.');
}finally{globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});}
