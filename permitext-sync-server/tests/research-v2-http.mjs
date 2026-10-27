import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const serve=process.argv.includes('--serve');
const scratch=await mkdtemp(join(tmpdir(),'permitext-v2-http-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(scratch,'budget.json'),
  PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-v2-test'});
const nativeFetch=globalThis.fetch;let gate=null,dropResponse=false,lastHandled=Promise.resolve();let calls=0,broken=false,gap=false,server,userID,token,account;
const passage='This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".';
const draft={answerText:'The selected text calls this the New York City Building Code, NYCBC, or BC. [S1]',claims:[{text:'The selected text supplies these names.',sourceIDs:['S1']}],missingSources:[],missingFacts:[]};
globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://api.openai.com/v1/responses','Research v2 cannot perform external retrieval');
  const body=JSON.parse(options.body);calls++;
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.service_tier,'default');assert.equal(body.store,false);assert(!body.tools);
  assert(!body.input.includes('SECRET_UNSELECTED'));
  const phase=body.text.format.name;
  if(gate){const pending=gate;gate=null;pending.started();await pending.wait;}
  const output=phase==='permitext_v2_review'?{pass:!broken,issues:broken?[{code:'unsupported_claim',detail:'This proposed answer failed review.'}]:[]}:gap?{answerText:'The selected passage does not establish what the absent lender rider requires.',claims:[],missingSources:['The lender rider.'],missingFacts:[]}:draft;
  return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
};
try{
  const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
  const capability=randomUUID();
  server=createServer((request,response)=>{
    if(serve&&request.url===`/preview/${capability}`){
      const stored={userID,sessionToken:token,authProvider:'web',displayName:'Research v2 local test',entitlement:account.entitlement};
      response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
      response.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});location.replace('/workspace?research=v2')</script>`);return;
    }
    if(dropResponse&&request.url==='/research/conversations/message'){dropResponse=false;response.end=()=>{response.destroy();return response;};}
    lastHandled=handleRequest(request,response);return lastHandled;
  });
  await new Promise(resolve=>server.listen(serve?8806:0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=async(path,values={},bearer=token,signal)=>{const response=await nativeFetch(base+path,{method:'POST',signal,headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...values})});return{status:response.status,body:await response.json()};};
  const providerID=randomUUID();
  account=(await post('/account/sign-in',{credential:{provider:'web',providerUserID:providerID,displayName:'Research v2 local test'}})).body.account;
  userID=account.appUserID;token=account.backendSessionToken;
  await post('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  account=(await post('/account/sign-in',{credential:{provider:'web',providerUserID:providerID,displayName:'Research v2 local test'}})).body.account||account;
  token=account.backendSessionToken;userID=account.appUserID;
  let conversation=(await post('/research/conversations/create',{analysisMode:'conversation_only',selections:[{sectionID:'1',selectedText:passage}]})).body.conversation;
  assert(conversation?.id);
  const context=c=>({conversationID:c.id,expectedRevision:Number(c.revision||0),expectedEvidenceSetVersion:Number(c.evidenceSetVersion||1),researchEngine:'v2',analysisMode:'conversation_only'});
  let input={...context(conversation),question:'What is this code called?',requestID:'v2-original'};
  const completed=await post('/research/conversations/message',input);
  assert.equal(completed.status,200,JSON.stringify(completed.body));conversation=completed.body.conversation;
  assert.equal(calls,2);assert.equal(conversation.messages.at(-1).answer.verification.pass,true);
  assert.match(conversation.messages.at(-1).answer.researchEngine,/research-v2/);
  const adapter=createFileStoreAdapter(),before=await adapter.read();
  const record=before.researchAnswersByUserID[userID][0];assert.equal(record.evidence[0].passageText,passage);
  const replay=await post('/research/conversations/message',input);
  assert.equal(replay.body.replayed,true);assert.equal(calls,2,'Replay makes no extra paid calls');
  const stale=await post('/research/conversations/message',{...input,requestID:'stale'});assert.equal(stale.status,409);assert.equal(calls,2);
  const noAccess=await post('/research/conversations/message',{...input,...context(conversation),requestID:'forbidden'},'invalid-token');assert.equal(noAccess.status,401);
  const reopened=await post('/research/conversations/get',{conversationID:conversation.id});assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText,draft.answerText);
  gap=true;
  const gapAnswer=await post('/research/conversations/message',{...context(conversation),question:'What does the unprovided lender rider require?',requestID:'v2-evidence-gap'});
  assert.equal(gapAnswer.status,200,JSON.stringify(gapAnswer.body));
  assert.equal(gapAnswer.body.conversation.messages.at(-1).answer.authorityStatus,'insufficient_evidence');
  conversation=gapAnswer.body.conversation;gap=false;
  broken=true;
  const rejected=await post('/research/conversations/message',{...context(conversation),question:'Explain this passage again.',requestID:'v2-failed-review'});
  assert.equal(rejected.status,422,JSON.stringify(rejected));assert.equal(rejected.body.code,'V2_REVIEW_FAILED');
  assert.equal((await adapter.read()).researchAnswersByUserID[userID].length,2,'A failed draft is not saved as a supported answer');broken=false;
  const current=(await post('/research/conversations/get',{conversationID:conversation.id})).body.conversation;
  const removed=await post('/research/conversations/evidence',{conversationID:current.id,action:'remove',sourceID:current.sources.find(s=>s.kind==='selection').id,expectedRevision:current.revision,expectedEvidenceSetVersion:current.evidenceSetVersion});
  assert.equal(removed.status,200,JSON.stringify(removed.body));
  assert.deepEqual((await adapter.read()).researchAnswersByUserID[userID][0],record,'Removing evidence cannot alter saved answers');
  // Two tabs cannot execute the same paid turn twice, nor commit against
  // evidence changed while a provider response was in flight.
  const fresh=async()=> (await post('/research/conversations/create',{analysisMode:'conversation_only',selections:[{sectionID:'1',selectedText:passage}]})).body.conversation;
  let race=await fresh(),release,started;
  const begun=new Promise(resolve=>{started=resolve;});
  gate={started,wait:new Promise(resolve=>{release=resolve;})};
  const raceInput={...context(race),question:'What is this code called?',requestID:'two-tabs'};
  const inFlight=post('/research/conversations/message',raceInput);
  await begun;const callsAtGate=calls;
  const duplicate=await post('/research/conversations/message',raceInput);
  assert.equal(duplicate.status,409,JSON.stringify(duplicate));assert.equal(calls,callsAtGate,'Concurrent duplicate cannot call Luna');
  const mutation=await post('/research/conversations/evidence',{conversationID:race.id,action:'remove',sourceID:race.sources.find(s=>s.kind==='selection').id,expectedRevision:race.revision,expectedEvidenceSetVersion:race.evidenceSetVersion});
  assert.equal(mutation.status,200,JSON.stringify(mutation));release();
  const staleCompletion=await inFlight;assert.equal(staleCompletion.status,409,JSON.stringify(staleCompletion));
  assert(!(await adapter.read()).researchAnswersByUserID[userID].some(a=>a.conversationID===race.id),'Late completion cannot save an answer against changed evidence');
  race=await fresh();const lostInput={...context(race),question:'What is this code called?',requestID:'lost-response'};
  dropResponse=true;await assert.rejects(post('/research/conversations/message',lostInput));
  const callsAfterLoss=calls;
  const recovered=await post('/research/conversations/message',lostInput);
  assert.equal(recovered.status,200,JSON.stringify(recovered));assert.equal(recovered.body.replayed,true);assert.equal(calls,callsAfterLoss,'Lost response recovery cannot rebill');
  assert.equal((await adapter.read()).researchAnswersByUserID[userID].filter(a=>a.conversationID===race.id).length,1);
  const cancelConversation=await fresh(),abort=new AbortController();
  const cancelBegan=new Promise(resolve=>{started=resolve;});
  gate={started,wait:new Promise(resolve=>{release=resolve;})};
  const cancelRequest=post('/research/conversations/message',{...context(cancelConversation),question:'Explain this passage.',requestID:'cancelled-turn'},token,abort.signal);
  await cancelBegan;const handling=lastHandled;abort.abort();await assert.rejects(cancelRequest,{name:'AbortError'});release();await handling;
  assert(!(await adapter.read()).researchAnswersByUserID[userID].some(a=>a.conversationID===cancelConversation.id),'Cancelled turn cannot persist an answer');
  // Unknown provider failures leave existing answers and user drafts recoverable.
  const beforeFailure=structuredClone((await adapter.read()).researchAnswersByUserID[userID]);
  const usualFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline provider failure');};
  const failed=await post('/research/conversations/message',{...context(recovered.body.conversation),question:'Explain once more.',requestID:'provider-failure'});
  assert(failed.status>=400);globalThis.fetch=usualFetch;
  assert.deepEqual((await adapter.read()).researchAnswersByUserID[userID],beforeFailure);
  process.env.PERMITEXT_RESEARCH_V2='0';
  const disabled=await post('/research/conversations/message',{...context(removed.body.conversation),question:'Explain.',requestID:'disabled'});assert.equal(disabled.status,404);
  process.env.PERMITEXT_RESEARCH_V2='1';
  console.log('Research v2 HTTP passed: real canonical selection, Luna draft/review, durable exact evidence, no rebilling on replay, stale revision/auth rejection, withheld failed draft, immutable history, local-only gate, two-tab exclusion, mid-turn evidence mutation, lost-response replay cancellation and provider failure recovery. No paid calls.');
  if(serve){console.log(JSON.stringify({preview:base+`/preview/${capability}`,offline:true,store:scratch}));await new Promise(()=>{});}
}finally{globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});}
