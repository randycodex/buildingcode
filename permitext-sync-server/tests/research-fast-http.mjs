import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const serve = process.argv.includes('--serve');
const scratch = await mkdtemp(join(tmpdir(),'permitext-fast-http-'));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key)) delete process.env[key];
Object.assign(process.env,{OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD:'2',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-test'});
const nativeFetch = globalThis.fetch;
let providerCalls=0, broken=false, token, userID, account, conversation, server;
const answerText='The code is called the New York City Building Code, NYCBC, or BC. Section numbers are preceded by BC. [S1]';
globalThis.fetch=async(input,options)=>{
  assert.equal(String(input),'https://api.openai.com/v1/responses','No unexpected external request');
  const body=JSON.parse(options.body);providerCalls++;
  assert.equal(body.stream,true);assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);
  assert.match(body.input,/New York City Building Code/);assert.equal(body.tools,undefined);
  assert.doesNotMatch(body.input,/PRIVATE_UNSELECTED/);
  const encoder=new TextEncoder();
  const event=value=>encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  return new Response(new ReadableStream({async start(controller){
    controller.enqueue(event({type:'response.output_text.delta',delta:answerText.slice(0,55)}));
    await new Promise(resolve=>setTimeout(resolve,serve?450:10));
    controller.enqueue(event({type:'response.output_text.delta',delta:answerText.slice(55)}));
    if(!broken)controller.enqueue(event({type:'response.completed',response:{status:'completed',model:body.model,
      usage:{input_tokens:100,output_tokens:30,total_tokens:130},output:[{type:'message',content:[{type:'output_text',text:answerText}]}]}}));
    controller.close();
  }}),{headers:{'content-type':'text/event-stream'}});
};
try {
  const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
  const capability=randomUUID();
  server=createServer((req,res)=>{
    if(serve && req.url===`/preview/${capability}`){
      const stored={userID,sessionToken:token,authProvider:'web',displayName:'Offline fast Research test',entitlement:account.entitlement};
      res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
      res.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});location.replace('/workspace')</script>`);return;
    }
    return handleRequest(req,res);
  });
  await new Promise(resolve=>server.listen(serve?8793:0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,body={},bearer=token)=>{
    const res=await nativeFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});
    return {status:res.status,body:await res.json()};
  };
  account=(await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline fast Research test'}})).body.account;
  token=account.backendSessionToken;userID=account.appUserID;
  await request('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  conversation=(await request('/research/conversations/create',{analysisMode:'conversation_only'})).body.conversation;
  conversation=(await request('/research/conversations/evidence',{conversationID:conversation.id,sectionID:'1',selectedText:'This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".'})).body.conversation;
  assert.ok(conversation?.id);
  const input={conversationID:conversation.id,question:'What is this code called?',requestID:'fast-request'};
  const response=await nativeFetch(base+'/research/conversations/message',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({auth:{accountUserID:userID},...input,progressStream:'ndjson'})});
  const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.ok(events.some(event=>event.type==='delta'));
  assert.ok(events.findIndex(event=>event.type==='delta')<events.findIndex(event=>event.type==='result'));
  const result=events.find(event=>event.type==='result')?.payload;
  assert.ok(result,JSON.stringify(events));
  const answer=result.conversation.messages.at(-1).answer;
  assert.equal(providerCalls,1);assert.equal(answer.answerText,answerText);
  assert.equal(answer.verification.status,'unreviewed');assert.equal(answer.verification.pass,false);
  assert.equal(answer.citations[0].sectionID,'1');assert.equal(answer.retrieval.webSupportRequested,false);
  const replay=await request('/research/conversations/message',input);
  assert.equal(replay.body.replayed,true);assert.equal(providerCalls,1,'Replay does not bill or generate twice');
  const reopened=await request('/research/conversations/get',{conversationID:conversation.id});
  assert.equal(reopened.body.conversation.messages.at(-1).answer.verification.status,'unreviewed');
  const adapter=createFileStoreAdapter();
  const before=await adapter.read();
  const saved=before.researchAnswersByUserID[userID].at(-1);
  assert.equal(saved.answer.answerText,answerText);assert.equal(saved.evidence[0].sectionID,'1');
  assert.equal((await request('/research/conversations/message',{...input,requestID:'invalid-mode',answerMode:'wrong'})).status,400);
  assert.equal((await request('/research/conversations/message',{...input,requestID:'unauthorized'},'invalid-token')).status,401);
  broken=true;
  const failed=await request('/research/conversations/message',{...input,requestID:'incomplete'});
  assert.ok(failed.status>=400,JSON.stringify(failed));
  const after=await adapter.read();
  assert.equal(after.researchAnswersByUserID[userID].length,before.researchAnswersByUserID[userID].length,'Incomplete text is never saved as an answer');
  broken=false;
  console.log('PASS fast HTTP: one streamed call, source identity, unreviewed persistence, replay, auth, mode validation, incomplete output rejection.');
  if(serve){
    console.log(JSON.stringify({preview:base+`/preview/${capability}`,conversationID:conversation.id,offline:true}));
    await new Promise(()=>{});
  }
} finally {
  globalThis.fetch=nativeFetch;
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await rm(scratch,{recursive:true,force:true});
}
