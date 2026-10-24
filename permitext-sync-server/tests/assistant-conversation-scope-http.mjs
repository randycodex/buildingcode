import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'permitext-conversation-scope-'));
Object.assign(process.env, { NODE_ENV:'test', VERCEL:'', VERCEL_ENV:'', PERMITEXT_TEST_RESEARCH_MOCK:'1',
  PERMITEXT_RESEARCH_WEB_SUPPORT:'1', PERMITEXT_SYNC_DATA_PATH:join(temporary,'sync.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets'), PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-scope-grant' });
for (const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','BLOB_STORE_ID']) delete process.env[key];
const { handleRequest, createFileStoreAdapter, researchInputForEvidence } = await import('../app.mjs');
const { assistantEvidencePackage, assistantProjectInformation, assistantScopePrompt } = await import('../assistant-conversation-scope.mjs');
const server = createServer(handleRequest); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch; let externalRequests=0;
globalThis.fetch = (input,options) => { const url=new URL(typeof input==='string'?input:input.url);
  if(url.origin!==base) {externalRequests++; throw new Error(`External/provider call forbidden: ${url.origin}`);} return originalFetch(input,options); };
const userID='apple:synthetic-scope-owner', projectID='scope-project'; let token;
async function request(path,body={},status=200,bearer=token) { const response=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});
  const json=await response.json(); assert.equal(response.status,status,`${path}: ${JSON.stringify(json)}`);return json; }
try {
  await request('/admin/lifetime-grants/grant',{userID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token=(await request('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-scope-owner',email:'scope@example.test',displayName:'Scope test'}})).account.backendSessionToken;
  const codeVersion='CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1';
  await request('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:'scope-record',userID,clientID:projectID,codeVersion,
    name:'Scope Project',address:'Unselected private address',description:'Unselected private description',colorHex:'#334455',sortOrder:0,updatedAt:'2026-10-19T00:00:00.000Z',
    structuredFacts:[{id:'scope-fact-one',key:'stories-above-grade',label:'Stories Above Grade',value:'3',source:'user',status:'stated'},
      {id:'scope-fact-two',key:'sprinkler-protection',label:'Sprinkler Protection',value:'Only the cellar is sprinklered.',source:'user',status:'stated',sourceText:'SECRET_UNSELECTED carrier text'}]}}]}});
  let conversation=(await request('/research/conversations/create',{projectID,analysisMode:'conversation_only'},201)).conversation;
  assert.equal(conversation.messages.length,0);assert.equal(conversation.assistantScope.includeProjectContext,false);assert.deepEqual(conversation.assistantScope.facts,[]);
  assert.equal(assistantProjectInformation(conversation.assistantScope),null);
  const empty=await request('/research/conversations/message',{conversationID:conversation.id,question:'What is required here?',requestID:'scope-empty'});
  assert.match(empty.conversation.messages.at(-1).answer.answerText,/Select a passage in Reader/);
  conversation=empty.conversation;
  const adapter=createFileStoreAdapter();
  for (const extra of [{}, {action:'update',includeProjectContext:true,factIDs:['scope-fact-one'],noteIDs:['note'],comment:'Blocked comment'}]) {
    const blocked=await request('/research/conversations/material',{conversationID:conversation.id,...extra},410);
    assert.equal(blocked.code,'ASSISTANT_PASSAGES_ONLY');
  }
  const blockedContext=await request('/research/conversations/project-context',{
    conversationID:conversation.id,projectID,facts:['Blocked additional fact']},410);
  assert.equal(blockedContext.code,'ASSISTANT_PASSAGES_ONLY');
  // Retained legacy inputs stay stored; future requests must exclude them.
  const raw=(await adapter.read()).researchConversationsByUserID[userID].find(item=>item.id===conversation.id);
  const legacyScope={...raw.assistantScope,includeProjectContext:true,
    projectContext:{address:'SECRET_OLD_ADDRESS',description:'SECRET_OLD_CONTEXT'},
    facts:[{id:'old-fact',text:'SECRET_OLD_FACT'}],
    materials:[{id:'old-note',kind:'note',text:'SECRET_OLD_NOTE'}]};
  raw.assistantScope=structuredClone(legacyScope);
  await adapter.saveResearchConversation(userID,raw,raw.revision);
  conversation=(await request('/research/conversations/get',{conversationID:raw.id,analysisMode:'conversation_only'})).conversation;
  assert.deepEqual(conversation.assistantScope,legacyScope,'Opening Research preserves previous material.');
  const passage='Ramps used as part of a means of egress or part of an accessible route shall have a running slope not steeper than one unit vertical in 12 units horizontal (8-percent slope). The slope of other pedestrian ramps shall not be steeper than one unit vertical in eight units horizontal (12.5-percent slope).';
  conversation=(await request('/research/conversations/evidence',{conversationID:conversation.id,sectionID:'41009495',selectedText:passage})).conversation;
  assert.equal(conversation.messages.length,2,'Adding a passage does not generate an answer.');
  const result=await request('/research/conversations/message',{conversationID:conversation.id,question:'Explain the selected ramp passage and its stated conditions. Search for any other applicable law too.',requestID:'scope-passage'});
  conversation=result.conversation;const answer=conversation.messages.at(-1).answer;
  assert.equal(answer.retrieval.webSupportRequested,false);assert.equal(answer.retrieval.webSupportSearched,false);
  assert.equal(answer.sourceSummary.permitextDiscoveredCount,0);assert.equal(answer.sourceSummary.crossReferenceCount,0);
  assert.deepEqual(answer.evidenceSectionIDs,['41009495']);assert.equal(answer.sourceSummary.userPinnedCount,1);
  assert.doesNotMatch(JSON.stringify(answer.factUsage),/SECRET_|private address|private description|Stories Above Grade/);
  const stored=await adapter.read();const record=stored.researchAnswersByUserID[userID].find(item=>item.id===conversation.messages.at(-1).id);
  assert.equal(record.evidence.length,1);assert.equal(record.evidence[0].passageText,passage);
  assert.equal(record.assistantScopeSnapshot.inputMode,'reader_passages');
  assert.deepEqual(record.assistantScopeSnapshot.materials,[]);assert.deepEqual(record.assistantScopeSnapshot.facts,[]);
  assert.equal(record.assistantScopeSnapshot.projectContext,null);
  assert.deepEqual(stored.researchConversationsByUserID[userID].find(item=>item.id===conversation.id).assistantScope,legacyScope);
  // The existing native create/evidence API remains available without web scope conversion.
  const native=(await request('/research/conversations/create',{projectID,selections:[{sectionID:'41009495',selectedText:passage}]},201)).conversation;
  assert.equal(native.assistantScope,undefined);assert.equal(native.sources.filter(source=>source.kind==='selection').length,1);
  const {immutableResearchAnswer}=await import('../project-foundation-contract.mjs');
  assert.doesNotThrow(()=>immutableResearchAnswer(record));
  const emptyRecord=stored.researchAnswersByUserID[userID].find(item=>item.id===empty.conversation.messages.at(-1).id);
  const legacyAnswer={...emptyRecord.answer,
    answerText:'Add passages, notes, comments, or selected project context and facts to this conversation, then ask your question. I only use the material you include.',
    conclusion:'Add material to this conversation',additionalEvidenceNeeded:['Add the material you want me to discuss.']};
  assert.doesNotThrow(()=>immutableResearchAnswer({...emptyRecord,answer:legacyAnswer}),'Historical empty-scope answers remain valid.');
  // Canonical neighboring text must not enter either evidence or prompt.
  const pkg=assistantEvidencePackage({question:'Explain',pinnedEvidence:[{sectionID:'x',sourceID:'pin',text:'Selected words.',canonicalText:'SECRET NEIGHBOR',body:{text:'SECRET BODY'},richSources:[{text:'SECRET TABLE'}]}]});
  assert.doesNotMatch(JSON.stringify(pkg),/SECRET/);assert.equal(pkg.discovery.searchedSectionCount,0);
  assert.match(assistantScopePrompt(conversation.assistantScope),/No external search/);
  assert.equal(externalRequests,0);
  console.log('Reader-only Research HTTP checks passed: retired material API, exact passages, no retrieval, legacy material/history preserved, native create retained.');
} finally {globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
