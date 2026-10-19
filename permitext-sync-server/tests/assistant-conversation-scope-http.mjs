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
  assert.match(empty.conversation.messages.at(-1).answer.answerText,/Add passages, notes, comments/);
  conversation=empty.conversation;
  let loaded=await request('/research/conversations/material',{conversationID:conversation.id});
  assert.equal(loaded.choices.facts.length,2);assert.equal(loaded.conversation.messages.length,2);
  const update=async (change,status=200)=>request('/research/conversations/material',{conversationID:conversation.id,action:'update',expectedRevision:conversation.revision,
    includeProjectContext:false,factIDs:[],noteIDs:[],...change},status);
  await update({factIDs:['other-project-fact']},400);
  let selected=await update({factIDs:['scope-fact-two'],comment:'My comment: compare these supplied passages only.'});
  conversation=selected.conversation;
  assert.equal(conversation.messages.length,2,'Adding material must not add assistant or user messages.');
  assert.equal(conversation.assistantScope.materials.length,1);
  const info=assistantProjectInformation(conversation.assistantScope);
  assert.equal(info.address,'');assert.equal(info.description,'');assert.equal(info.structuredFacts.length,1);
  assert.match(JSON.stringify(info),/Only the cellar/);assert.doesNotMatch(JSON.stringify(info),/private address|private description|Stories Above Grade|SECRET_UNSELECTED/);
  const notesOnly=await request('/research/conversations/message',{conversationID:conversation.id,question:'Summarize the comment I included.',requestID:'scope-comment'});
  conversation=notesOnly.conversation;
  assert.equal(conversation.messages.at(-1).answer.verification.pass,true);
  const contextOn=await update({includeProjectContext:true,factIDs:['scope-fact-one','scope-fact-two']});
  conversation=contextOn.conversation;
  assert.equal(conversation.assistantScope.facts.length,2);
  assert.equal(assistantProjectInformation(conversation.assistantScope).address,'Unselected private address');
  conversation=(await update({includeProjectContext:false,factIDs:['scope-fact-two']})).conversation;
  assert.equal(assistantProjectInformation(conversation.assistantScope).address,'');
  const firstContextRevision=conversation.contextRevision;
  const staleRevision=conversation.revision;
  const note=(await request('/notebook/cards/save',{projectID,clientMutationID:'scope-note-create',expectedVersion:0,cardType:'finding',title:'Scope note',
    document:{schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'paragraph',content:[{type:'text',text:'The note contains an observation, not a legal requirement.',styles:{}}]}]},evidenceLinks:[]},201)).card;
  selected=await update({factIDs:['scope-fact-two'],noteIDs:[note.id]});conversation=selected.conversation;
  assert.equal(conversation.messages.length,4);assert.equal(conversation.contextRevision,firstContextRevision);
  assert.match(conversation.assistantScope.materials.find(item=>item.kind==='note').text,/an observation/);
  await update({expectedRevision:staleRevision},409);
  await update({noteIDs:['foreign-project-note']},400);
  const passage='Ramps used as part of a means of egress or part of an accessible route shall have a running slope not steeper than one unit vertical in 12 units horizontal (8-percent slope). The slope of other pedestrian ramps shall not be steeper than one unit vertical in eight units horizontal (12.5-percent slope).';
  conversation=(await request('/research/conversations/evidence',{conversationID:conversation.id,sectionID:'41009495',selectedText:passage})).conversation;
  assert.equal(conversation.messages.length,4);
  const result=await request('/research/conversations/message',{conversationID:conversation.id,question:'Explain the selected ramp passage and its stated conditions. Search for any other applicable law too.',requestID:'scope-passage'});
  conversation=result.conversation;const answer=conversation.messages.at(-1).answer;
  assert.equal(answer.retrieval.webSupportRequested,false);assert.equal(answer.retrieval.webSupportSearched,false);
  assert.equal(answer.sourceSummary.permitextDiscoveredCount,0);assert.equal(answer.sourceSummary.crossReferenceCount,0);
  assert.deepEqual(answer.evidenceSectionIDs,['41009495']);assert.equal(answer.sourceSummary.userPinnedCount,1);
  assert.doesNotMatch(JSON.stringify(answer.factUsage),/private address|private description|Stories Above Grade|SECRET_UNSELECTED/);
  const stored=await createFileStoreAdapter().read();const record=stored.researchAnswersByUserID[userID].find(item=>item.id===conversation.messages.at(-1).id);
  assert.equal(record.evidence.length,1);assert.equal(record.evidence[0].passageText,passage);
  assert.equal(record.assistantScopeSnapshot.materials.length,2);
  const sourceID=conversation.sources.find(source=>source.kind==='selection').id;
  conversation=(await update({removeSourceIDs:[sourceID],factIDs:[],noteIDs:[],removeMaterialID:conversation.assistantScope.materials.find(item=>item.kind==='comment').id})).conversation;
  assert.equal(conversation.sources.filter(source=>source.kind==='selection').length,0);assert.deepEqual(conversation.assistantScope.materials,[]);
  const cleared=await request('/research/conversations/message',{conversationID:conversation.id,question:'What is the ramp rule now?',requestID:'scope-after-clear'});
  assert.match(cleared.conversation.messages.at(-1).answer.answerText,/Add passages/);
  await request('/research/conversations/message',{conversationID:conversation.id,question:'Explain the selected ramp passage and its stated conditions. Search for any other applicable law too.',requestID:'scope-passage'},409);
  const reopened=(await request('/research/conversations/get',{conversationID:conversation.id,analysisMode:'conversation_only'})).conversation;
  assert.deepEqual(reopened.assistantScope.facts,[]);assert.deepEqual(reopened.assistantScope.materials,[]);
  // Canonical neighboring text must not enter either evidence or prompt.
  const pkg=assistantEvidencePackage({question:'Explain',pinnedEvidence:[{sectionID:'x',sourceID:'pin',text:'Selected words.',canonicalText:'SECRET NEIGHBOR',body:{text:'SECRET BODY'},richSources:[{text:'SECRET TABLE'}]}]});
  assert.doesNotMatch(JSON.stringify(pkg),/SECRET/);assert.equal(pkg.discovery.searchedSectionCount,0);
  assert.match(assistantScopePrompt(conversation.assistantScope),/No external search/);
  assert.equal(externalRequests,0);
  console.log('Assistant conversation-only HTTP checks passed: explicit inputs, no calls on add, no retrieval, exact selections, persisted choices, removal isolation.');
} finally {globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
