import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const serve=process.argv.includes('--serve');
const postgres=process.argv.includes('--postgres')?await (await import('./research-v2-local-postgres.mjs')).startResearchV2Postgres():null;
const scratch=await mkdtemp(join(tmpdir(),'permitext-v2-http-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(scratch,'budget.json'),
  PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-v2-test'});
if(postgres)process.env.PERMITEXT_SYNC_DATABASE_URL=postgres.connectionString;
const nativeFetch=globalThis.fetch;let gate=null,dropResponse=false,lastHandled=Promise.resolve();let calls=0,broken=false,gap=false,server,userID,token,account;
const passage='This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".';
const draft={answerText:'The selected text calls this the New York City Building Code, NYCBC, or BC. [S1]',claims:[{text:'The selected text supplies these names.',sourceIDs:['S1']}],missingSources:[],missingFacts:[]};
globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://api.openai.com/v1/responses','Research v2 cannot perform external retrieval');
  const body=JSON.parse(options.body);calls++;
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.service_tier,'default');assert.equal(body.store,false);assert(!body.tools);
  assert(!body.input.includes('SECRET_UNSELECTED'));assert(!body.input.includes('SECRET_PROJECT_SENTINEL'),'Project assignment cannot attach facts');
  if(body.stream){const text=draft.answerText;const payload={model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text}]}]};return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:text})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:payload})+'\n\n',{headers:{'content-type':'text/event-stream'}});}
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
  const adapter=postgres||createFileStoreAdapter(),before=await adapter.read();
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
  const afterFailure=(await post('/research/conversations/get',{conversationID:recovered.body.conversation.id})).body.conversation;
  const retryFailure=await post('/research/conversations/message',{...context(afterFailure),question:'Explain once more.',requestID:'provider-failure'});assert.equal(retryFailure.status,200,JSON.stringify(retryFailure));
  assert.equal(retryFailure.body.conversation.messages.filter(m=>m.requestID==='provider-failure'&&m.role==='user').length,1,'Retrying a failed request preserves one question');
  // Generate through v2, then use the real assignment, Notebook, Report and
  // sync routes. The saved original evidence must remain identical throughout.
  for(const clientID of ['v2-project-a','v2-project-b']){
    const synced=await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:clientID+'-record',clientID,userID,codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1',name:clientID,address:'SECRET_PROJECT_SENTINEL',colorHex:'#334455',sortOrder:0,updatedAt:new Date().toISOString()}}]}});
    assert.equal(synced.status,200,JSON.stringify(synced));
  }
  let linked=await fresh();
  const generated=await post('/research/conversations/message',{...context(linked),question:'What is this code called?',requestID:'v2-product-connections'});
  assert.equal(generated.status,200,JSON.stringify(generated));linked=generated.body.conversation;
  const answerID=linked.messages.at(-1).id;
  const immutable=(await post('/research/answers/get',{answerID})).body.answer;
  const assigned=await post('/research/conversations/assign-project',{conversationID:linked.id,projectID:'v2-project-a',confirmMove:true});
  assert.equal(assigned.status,200,JSON.stringify(assigned));linked=assigned.body.conversation;
  assert.equal(linked.primaryProjectID,'v2-project-a');
  const beforeCheckpoint=(await post('/projects/artifacts/checkpoint',{projectIDs:['v2-project-a'],includeAccountResearch:true})).body;
  const follow=await post('/research/conversations/message',{...context(linked),question:'Explain these names again.',requestID:'v2-linked-followup'});
  assert.equal(follow.status,200,JSON.stringify(follow));
  const afterCheckpoint=(await post('/projects/artifacts/checkpoint',{projectIDs:['v2-project-a'],includeAccountResearch:true})).body;
  assert(afterCheckpoint.projects[0].revision>beforeCheckpoint.projects[0].revision,'V2 completion is discoverable by another client through sync metadata');
  const reportLink=await post('/projects/foundation/link',{projectID:'v2-project-a',targetKind:'researchAnswer',targetID:answerID,relationship:'primary'});assert.equal(reportLink.status,201,JSON.stringify(reportLink));
  const reportSources=await post('/reports/sources/list',{projectID:'v2-project-a'});assert.equal(reportSources.status,200);
  assert(reportSources.body.sources.some(source=>source.kind==='researchAnswer'&&source.id===answerID),'Explicitly linked pre-assignment answers are valid Report sources');
  const directDraft=await post('/reports/drafts/save',{projectID:'v2-project-a',expectedVersion:0,title:'V2 direct answer',reportDate:'2026-10-27',blocks:[{id:'direct-answer',kind:'researchAnswer',sourceID:answerID,label:'V2 saved answer'}]});assert.equal(directDraft.status,201,JSON.stringify(directDraft));
  const directReport=await post('/reports/generate',{projectID:'v2-project-a',draftID:directDraft.body.draft.id,expectedVersion:directDraft.body.draft.version});assert.equal(directReport.status,201,JSON.stringify(directReport));
  assert.equal(directReport.body.manifest.items.find(item=>item.kind==='researchAnswer').answerID,answerID);
  const document={schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'paragraph',content:[{type:'permitextReference',props:{referenceKind:'researchAnswer',referenceID:answerID,label:'Research answer'}}]}]};
  const note=await post('/notebook/cards/save',{projectID:'v2-project-b',clientMutationID:'v2-note',expectedVersion:0,cardType:'finding',title:'V2 saved answer',document,evidenceLinks:[]});
  assert.equal(note.status,201,JSON.stringify(note));assert.equal(note.body.card.references[0].referenceID,answerID);
  const draftReport=await post('/reports/drafts/save',{projectID:'v2-project-b',expectedVersion:0,title:'V2 handoff',reportDate:'2026-10-27',blocks:[{id:'v2-note',kind:'notebookCard',sourceID:note.body.card.id,label:'V2 saved answer'}]});
  assert.equal(draftReport.status,201,JSON.stringify(draftReport));
  const report=await post('/reports/generate',{projectID:'v2-project-b',draftID:draftReport.body.draft.id,expectedVersion:draftReport.body.draft.version});
  assert.equal(report.status,201,JSON.stringify(report));
  assert.equal(report.body.manifest.items.find(item=>item.kind==='notebookCard').references[0].referenceID,answerID);
  assert.deepEqual((await post('/research/answers/get',{answerID})).body.answer,immutable,'Product handoffs cannot change original evidence or answer');
  const signedOut=await post('/research/answers/get',{answerID},'invalid');assert.equal(signedOut.status,401);
  const page=await post('/research/conversations/list',{limit:1,projectID:'v2-project-a'});assert.equal(page.status,200);assert.equal(page.body.conversations[0].id,linked.id);
  const other=(await post('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Other local owner'}})).body.account;
  await post('/admin/lifetime-grants/grant',{userID:other.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const foreignRead=await post('/research/answers/get',{auth:{accountUserID:other.appUserID},answerID},other.backendSessionToken);
  assert.equal(foreignRead.status,404,'A valid different account cannot read the answer');
  const foreignWrite=await post('/research/conversations/message',{...context(linked),auth:{accountUserID:other.appUserID},question:'Read another owner.',requestID:'foreign-owner'},other.backendSessionToken);
  assert.equal(foreignWrite.status,404);
  const availability=await post('/research/v2/config');assert.equal(availability.body.available,true);assert.equal(availability.body.defaultEngine,'legacy');
  process.env.PERMITEXT_RESEARCH_V2_USERS='other';assert.equal((await post('/research/v2/config')).body.available,false);
  const callsBeforeRollback=calls;
  assert.equal((await post('/research/conversations/message',{...context(follow.body.conversation),question:'Blocked by local rollout.',requestID:'rollback'})).status,404);
  assert.equal(calls,callsBeforeRollback,'Switching off v2 prevents provider dispatch');delete process.env.PERMITEXT_RESEARCH_V2_USERS;
  assert.deepEqual((await post('/research/answers/get',{answerID})).body.answer,immutable,'Rollback preserves existing v2 answers');
  const oldFast=await fresh(),budgetPath=process.env.PERMITEXT_RESEARCH_V2_BUDGET_PATH;
  const budgetCount=JSON.parse(await readFile(budgetPath)).calls.length;
  const fastReply=await post('/research/conversations/message',{...context(oldFast),researchEngine:'legacy',answerMode:'fast',question:'What is this code called?',requestID:'legacy-shared-budget'});
  assert.equal(fastReply.status,200,JSON.stringify(fastReply));assert.equal(JSON.parse(await readFile(budgetPath)).calls.length,budgetCount+1,'Original Fast uses exactly one reservation in the same local ledger');
  const beforeVerified=calls;const verified=await post('/research/conversations/message',{...context(fastReply.body.conversation),researchEngine:'legacy',answerMode:'verified',question:'Explain.',requestID:'blocked-verified'});
  assert.equal(verified.status,403);assert.equal(calls,beforeVerified);
  const tinyPath=join(scratch,'exhausted-budget.json');await (await import('../research-v2-budget.mjs')).createResearchV2Budget({path:tinyPath,limitUSD:.000001}).summary();
  process.env.PERMITEXT_RESEARCH_V2_BUDGET_PATH=tinyPath;const beforeExhausted=calls;
  const exhausted=await post('/research/conversations/message',{...context(fastReply.body.conversation),researchEngine:'legacy',answerMode:'fast',question:'Explain once more.',requestID:'exhausted-fast'});
  assert.equal(exhausted.status,429,JSON.stringify(exhausted));assert.equal(exhausted.body.code,'V2_BUDGET_EXHAUSTED');assert.equal(calls,beforeExhausted);process.env.PERMITEXT_RESEARCH_V2_BUDGET_PATH=budgetPath;
  const legacy=await fresh();legacy.messages=[{id:'legacy-q',role:'user',question:'Legacy question.'},{id:'legacy-a',role:'assistant',answer:{conclusion:'Legacy conclusion.',explanation:'Legacy qualification.',verification:{status:'unreviewed',pass:false}}}];
  const legacyFixtures=Array.from({length:65},(_,i)=>({...legacy,id:'v2-legacy-'+String(i).padStart(2,'0'),title:'Legacy question '+i,createdAt:new Date(Date.now()-86400000-i*1000).toISOString()}));
  if(postgres){for(const c of legacyFixtures)await postgres.sql`INSERT INTO permitext_research_conversations(id,user_id,title,conversation,created_at) VALUES(${c.id},${userID},${c.title},${JSON.stringify(c)}::jsonb,${c.createdAt}::timestamptz)`;}
  else await adapter.withMutation(store=>{store.researchConversationsByUserID[userID].push(...legacyFixtures);});
  const legacyRead=(await post('/research/conversations/get',{conversationID:legacyFixtures[0].id})).body.conversation;
  assert.deepEqual(legacyRead.messages,legacy.messages,'Reopening retained legacy answers cannot regenerate or convert them');
  let cursor=null,seen=new Set(),pages=0;
  do{const p=await post('/research/conversations/list',{limit:30,projectID:'',...(cursor?{cursor}:{})});assert.equal(p.status,200);for(const c of p.body.conversations){assert(!seen.has(c.id));seen.add(c.id);}cursor=p.body.nextCursor;pages++;}while(cursor);
  assert(pages>=3);assert(legacyFixtures.every(c=>seen.has(c.id)),'All older histories remain reachable through pages');
  if(postgres){const usage=await postgres.sql`SELECT count(*)::int AS n, sum(input_tokens)::int AS input, sum(output_tokens)::int AS output FROM permitext_research_usage WHERE user_id=${userID} AND mode='openai'`;assert(Number(usage[0].n)>0&&Number(usage[0].input)>0&&Number(usage[0].output)>0,'Application usage survives independently of the evaluation ledger');}
  console.log('V2 product connections passed: Project assignment, passage-only follow-up, cross-Project Note, Report reference, owner auth and paged history.');
  process.env.PERMITEXT_RESEARCH_V2='0';
  const disabled=await post('/research/conversations/message',{...context(removed.body.conversation),question:'Explain.',requestID:'disabled'});assert.equal(disabled.status,404);
  process.env.PERMITEXT_RESEARCH_V2='1';
  console.log('Research v2 HTTP passed: real canonical selection, Luna draft/review, durable exact evidence, no rebilling on replay, stale revision/auth rejection, withheld failed draft, immutable history, local-only gate, two-tab exclusion, mid-turn evidence mutation, lost-response replay cancellation and provider failure recovery. No paid calls.');
  if(serve){console.log(JSON.stringify({preview:base+`/preview/${capability}`,offline:true,store:scratch}));await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});}
}finally{globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});await postgres?.close();}
