import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';

const directory = await mkdtemp(join(tmpdir(), 'permitext-research-scale-'));
for (const key of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|STORAGE_URL$|BLOB_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {NODE_ENV:'test', PERMITEXT_TEST_RESEARCH_MOCK:'1',
  PERMITEXT_SYNC_DATA_PATH:join(directory,'store.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'local-scale-test', PERMITEXT_CODE_QUESTION_WORKSPACE:'1'});
const {handleRequest, createFileStoreAdapter} = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, 'No provider or production requests');
  return originalFetch(url,options);
};
const request = async (path, body, token, status=200) => {
  const response = await fetch(base+path, {method:'POST', headers:{'content-type':'application/json',
    ...(token ? {authorization:`Bearer ${token}`} : {})}, body:JSON.stringify(body)});
  const result = await response.json();
  assert.equal(response.status,status,`${path}: ${JSON.stringify(result)}`);
  return result;
};
const projectID='scale-project', otherProjectID='other-project';
const now='2026-10-24T12:00:00.000Z';
const codeVersion='CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1';
try {
  const accounts=[];
  for (const id of ['scale-owner','scale-foreign']) {
    const signed=await request('/account/sign-in',{credential:{provider:'apple',providerUserID:id,displayName:id}});
    accounts.push(signed.account);
    await request('/admin/lifetime-grants/grant',{userID:signed.account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  }
  const [owner,foreign]=accounts;
  const post=(path,body={},status=200,account=owner)=>request(path,{auth:{accountUserID:account.appUserID},...body},account.backendSessionToken,status);
  const adapter=createFileStoreAdapter();
  const original = Array.from({length:300},(_,index)=>({id:`historic-${String(index).padStart(3,'0')}`,
    title:`Historic ${index}`, titleSource:'manual', codeVersion, evidenceSetVersion:1,
    primaryProjectID:index%2?projectID:otherProjectID, createdAt:new Date(Date.parse(now)-index*1000).toISOString(),
    updatedAt:now, ...(index%4===0?{historyHiddenAt:now}:{}), sources:[],
    messages:[{id:`old-question-${index}`,role:'user',question:`Original question ${index}`},
      {id:`old-answer-${index}`,role:'assistant',answer:{answerText:`Retained answer ${index} `+'private evidence '.repeat(500)}}]}));
  await adapter.withMutation(store=>{
    store.researchConversationsByUserID={[owner.appUserID]:structuredClone(original),[foreign.appUserID]:[{...original[0],id:'foreign-only'}]};
    store.researchAnswersByUserID={[owner.appUserID]:[{id:'historical-answer',conversationID:original[0].id,projectID,
      question:'Prior question',createdAt:now,reviewStatus:'unreviewed',answer:{conclusion:'Retained conclusion'},
      evidence:[{id:'historical-snapshot',sectionID:'8881',passageText:'Owners of such buildings shall notify the department in writing at least 72 hours prior to the commencement of any work pursuant to such permits.'}]}]};
  });
  const originalAnswer=structuredClone((await adapter.read()).researchAnswersByUserID[owner.appUserID][0]);
  for (const id of [projectID,otherProjectID]) await post('/sync/push',{batch:{user:{id:owner.appUserID},mutations:[{project:{id,clientID:id,userID:owner.appUserID,name:id,codeVersion,updatedAt:now}}]}});

  const created=await post('/research/conversations/create',{projectID,requestID:'scale-request'},201);
  const concurrent=await Promise.all(Array.from({length:3},()=>post('/research/conversations/create',{projectID,requestID:'scale-request'})));
  assert(concurrent.every(result=>result.replayed && result.conversation.id===created.conversation.id));
  const conflict=await post('/research/conversations/create',{projectID,requestID:'scale-request',originSurface:'changed'},409);
  assert.equal(conflict.code,'RESEARCH_CREATE_REQUEST_CONFLICT');
  await post('/research/conversations/create',{},201);
  // Older saved request IDs remain replayable even with a non-deterministic ID.
  await adapter.withMutation(store=>{store.researchConversationsByUserID[owner.appUserID].find(row=>row.id===created.conversation.id).id='legacy-request-id';});
  const legacy=await post('/research/conversations/create',{projectID,requestID:'scale-request'});
  assert.equal(legacy.conversation.id,'legacy-request-id'); assert.equal(legacy.replayed,true);
  const foreignCreated=await post('/research/conversations/create',{requestID:'scale-request'},201,foreign);
  assert.notEqual(foreignCreated.conversation.id,legacy.conversation.id,'Creation request IDs cannot expose another owner conversation');

  const reused=await post('/research/conversations/reuse-evidence',{projectID,answerID:'historical-answer'},201);
  assert.equal(reused.conversation.origin.answerID,'historical-answer');
  assert.equal(reused.conversation.messages.length,0);
  await post('/research/conversations/reuse-evidence',{projectID,answerID:'foreign-answer'},404);
  const question=await post('/projects/code-questions/create',{projectID,id:'scale-decision',title:'Historic decision',questionText:'What width applies?',jurisdiction:'New York City'},201);
  const started=await post('/projects/code-questions/research/start',{projectID,questionID:question.question.id},201);
  const replay=await post('/projects/code-questions/research/start',{projectID,questionID:question.question.id});
  assert.equal(replay.conversation.id,started.conversation.id); assert.equal(replay.replayed,true);
  const questions=await post('/projects/code-questions/list',{projectID});
  assert.equal(questions.questions.find(row=>row.id===question.question.id).researchConversationID,started.conversation.id);

  const visibleIDs=new Set(); let cursor=null;
  do {
    const page=await post('/research/conversations/list',{limit:30,...(cursor?{cursor}:{})});
    assert(page.conversations.length<=30);
    assert(!JSON.stringify(page).includes('private evidence'), 'History pages never contain complete answers');
    for (const row of page.conversations) {assert(!visibleIDs.has(row.id));visibleIDs.add(row.id);}
    cursor=page.nextCursor;
  } while(cursor);
  assert(visibleIDs.has('historic-299'),'Old research is still reachable through pagination');
  const oldest=await post('/research/conversations/get',{conversationID:'historic-299'});
  assert.deepEqual(oldest.conversation.messages,original[299].messages);
  await post('/research/conversations/get',{conversationID:'historic-299'},404,foreign);
  const legacyList=await post('/research/conversations/list');
  assert.equal(legacyList.conversations.length,visibleIDs.size,'Native/legacy summaries remain compatible');
  const store=await adapter.read();
  for (const prior of original) assert.deepEqual(store.researchConversationsByUserID[owner.appUserID].find(row=>row.id===prior.id),prior,'Existing research must not be rewritten or pruned');
  assert.deepEqual(store.researchAnswersByUserID[owner.appUserID].find(answer=>answer.id==='historical-answer'),originalAnswer);
  assert.equal(store.researchConversationsByUserID[foreign.appUserID].length,2);
  const cleared=await post('/research/conversations/clear-history',{conversationIDs:['historic-299']});
  assert.equal(cleared.totalCount,1); assert.equal(cleared.hiddenProjectConversationCount,1);
  const after=await adapter.read();
  assert.equal(after.researchConversationsByUserID[owner.appUserID].length,304,'Hiding selected history preserves the research');
  assert.deepEqual(after.researchConversationsByUserID[owner.appUserID].find(row=>row.id==='historic-298'),original[298]);
  assert.deepEqual(after.researchConversationsByUserID[owner.appUserID].find(row=>row.id==='historic-299').messages,original[299].messages);

  // Inspect real adapter query construction without contacting a database.
  const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
  const method=name=>{const start=source.indexOf(`    async ${name}(`,source.indexOf('async function createPostgresStoreAdapter()'));assert(start>=0,name);return source.slice(start,source.indexOf('\n    },',start)+6);};
  const queries=[];
  const sql=async(strings,...values)=>{queries.push({text:strings.join('?'),values});return [];};
  const context=vm.createContext({sql,ensureSchema:async()=>{},safeJSON:value=>value,JSON});
  const pg=vm.runInContext(`({${['researchConversationForCreationRequest','hasResearchSelection','listResearchConversations'].map(method).join(',')}})`,context);
  await pg.researchConversationForCreationRequest(owner.appUserID,'deterministic-id',"request' OR TRUE --");
  assert.match(queries.at(-1).text,/WHERE user_id = \?[\s\S]*creationRequestID[\s\S]*LIMIT 1/);
  assert(!queries.at(-1).text.includes("request'"));
  await pg.hasResearchSelection(owner.appUserID,'passage-id');
  assert.match(queries.at(-1).text,/SELECT EXISTS[\s\S]*WHERE user_id = \?[\s\S]*@>/);
  await pg.listResearchConversations(owner.appUserID,{ids:['historic-299'],referencesOnly:true});
  assert.match(queries.at(-1).text,/jsonb_build_object[\s\S]*WHERE user_id = \? AND id = ANY/);
  assert.deepEqual(queries.at(-1).values.find(Array.isArray),['historic-299']);
  const count=queries.length;
  assert.equal((await pg.listResearchConversations(owner.appUserID,{ids:[]})).length,0);
  assert.equal(queries.length,count,'An empty ID selection must not fetch all history');
  assert.match(source,/CREATE INDEX IF NOT EXISTS permitext_research_conversations_creation_request_idx/);
  const client=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(client,/const readResearchConversationList = createResearchRefresh\(\s*\(\) => postResearch\("\/research\/conversations\/list", \{limit:30\}\)/);
  console.log('Research history scale passed: 300 retained conversations, all three creation routes, retry/conflict/legacy replay, owner isolation, 30-row pages, complete old-content preservation, selected hide, and bounded PostgreSQL query construction. Zero external requests.');
} finally {
  globalThis.fetch=originalFetch;
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  await rm(directory,{recursive:true,force:true});
}
