import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {researchDeleteScope, researchDeleteTargetsQuery, researchBulkDeleteQuery, researchDeleteTargetsForStore} from '../research-bulk-delete.mjs';

const folder = await mkdtemp(join(tmpdir(),'permitext-bulk-research-delete-'));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|STORAGE_URL$|BLOB_)/.test(key)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_TEST_RESEARCH_MOCK:'1',PERMITEXT_SYNC_DATA_PATH:join(folder,'store.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(folder,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'local-delete-test'});
const {handleRequest, createFileStoreAdapter} = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'No production/provider requests');return originalFetch(url,options);};
const post=async(path,body,token,status=200)=>{
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(result)}`);return result;
};
try {
  const accounts=[];
  for(const id of ['delete-owner','delete-foreign']) accounts.push((await post('/account/sign-in',{credential:{provider:'apple',providerUserID:id,displayName:id}})).account);
  const [owner,foreign]=accounts;
  const request=(path,body={},status=200,account=owner)=>post(path,{auth:{accountUserID:account.appUserID},...body},account.backendSessionToken,status);
  const adapter=createFileStoreAdapter(), date='2026-10-24T12:00:00.000Z';
  const row=(id,projectID,extra={})=>({id,primaryProjectID:projectID,revision:1,title:id,createdAt:date,updatedAt:date,messages:[],sources:[],...extra});
  await adapter.withMutation(store=>{
    store.researchConversationsByUserID={
      [owner.appUserID]:[row('a','project-a',{sources:[{id:'selected-a'}]}),row('hidden-a','project-a',{historyHiddenAt:date}),
        row('b','project-b'),row('hidden-b','project-b',{historyHiddenAt:date}),row('unassigned',null)],
      [foreign.appUserID]:[row('foreign','project-a')]};
    store.researchAnswersByUserID={
      [owner.appUserID]:[{id:'answer-a',conversationID:'a',evidence:[{id:'snapshot-a'}]},{id:'answer-b',conversationID:'b',evidence:[{id:'snapshot-b'}]}],
      [foreign.appUserID]:[{id:'foreign-answer',conversationID:'a',evidence:[{id:'foreign-snapshot'}]}]};
    store.researchFeedbackByUserID={[owner.appUserID]:[{id:'feedback-a',answerID:'answer-a'}],[foreign.appUserID]:[{id:'foreign-feedback',conversationID:'a'}]};
    store.projectLinksByUserID={[owner.appUserID]:[
      {id:'link-a',projectID:'project-a',targetKind:'researchConversation',targetID:'a'},
      {id:'answer-link',projectID:'project-a',targetKind:'researchAnswer',targetID:'answer-a'},
      {id:'snapshot-link',projectID:'project-a',targetKind:'approvedEvidence',targetID:'snapshot-a'},
      {id:'passage-link',projectID:'project-a',targetKind:'selectedPassage',targetID:'selected-a'}],
      [foreign.appUserID]:[{id:'foreign-link',projectID:'project-a',targetKind:'researchConversation',targetID:'a'}]};
    store.activityEventsByUserID={[owner.appUserID]:[{id:'activity-a',projectID:'project-a',objectKind:'researchConversation',objectID:'a'}]};
    store.foundationArtifactsByUserID={[owner.appUserID]:[{envelope:{id:'note',type:'notebookCard'},payload:{document:'Kept Note',references:[{referenceKind:'researchAnswer',referenceID:'answer-a'}]}},
      {envelope:{id:'report',type:'reportDraft'},payload:{blocks:[{text:'Kept Report snapshot'}]}}]};
    store.mutationsByUserID={[owner.appUserID]:[{savedItem:{id:'saved-a',userID:owner.appUserID,text:'Kept saved passage'}}]};
    store.researchUsageByUserID={[owner.appUserID]:[{id:'usage-a',conversationID:'a',charged:true}]};
  });
  const preview=(input,status=200,account=owner)=>request('/research/conversations/delete-preview',input,status,account);
  const commit=(input,plan,status=200,account=owner)=>request('/research/conversations/delete-many',{...input,confirmationToken:plan.confirmationToken,confirmPermanentDeletion:true},status,account);
  const before=await adapter.read();
  const selection={scope:'selected',conversationIDs:['a','hidden-a']};
  const plan=await preview(selection);
  assert.equal(plan.count,2,'Hidden history is included in the exact count');
  assert.deepEqual((await adapter.read()).researchConversationsByUserID,before.researchConversationsByUserID,'Preview never deletes');
  await request('/research/conversations/delete-many',selection,400);
  await preview({scope:'selected',conversationIDs:['a','foreign']},409);
  await request('/research/conversations/delete-preview',{...selection,auth:{accountUserID:foreign.appUserID}},401);
  await commit(selection,plan,409,foreign);
  for(const input of [{scope:'invalid'},{scope:'project'},{scope:'selected',conversationIDs:[]},{scope:'selected',conversationIDs:['x'.repeat(513)]}]) await preview(input,400);

  await adapter.withMutation(store=>{store.researchConversationsByUserID[owner.appUserID][0].revision++;});
  await commit(selection,plan,409);
  assert.equal((await adapter.read()).researchConversationsByUserID[owner.appUserID].length,5,'A stale confirmation deletes nothing');
  // Simulate a change between the handler recheck and the atomic adapter write.
  const expected=await adapter.researchDeletionTargets(owner.appUserID,researchDeleteScope(selection));
  await adapter.withMutation(store=>{store.researchConversationsByUserID[owner.appUserID][1].revision++;});
  await assert.rejects(adapter.deleteResearchConversations(owner.appUserID,expected),{code:'RESEARCH_DELETE_CHANGED'});
  assert.equal((await adapter.read()).researchConversationsByUserID[owner.appUserID].length,5,'Atomic guard rejects the entire changed set');
  const removed=await commit(selection,await preview(selection));
  assert.equal(removed.deletedCount,2);assert.equal(removed.deletedAnswerCount,1);assert.equal(removed.deletedEvidenceSnapshotCount,1);
  assert.equal(removed.deletedFeedbackCount,1);
  let current=await adapter.read();
  assert.deepEqual(current.researchConversationsByUserID[owner.appUserID].map(item=>item.id),['b','hidden-b','unassigned']);
  assert(!current.projectLinksByUserID[owner.appUserID].length);
  assert(!current.activityEventsByUserID[owner.appUserID].length);
  for(const key of ['foundationArtifactsByUserID','mutationsByUserID','researchUsageByUserID']) assert.deepEqual(current[key],before[key],`${key} must be preserved`);
  for(const key of ['researchConversationsByUserID','researchAnswersByUserID','researchFeedbackByUserID','projectLinksByUserID']) assert.deepEqual(current[key][foreign.appUserID],before[key][foreign.appUserID]);

  const project={scope:'project',projectID:'project-b'};
  assert.equal((await preview(project)).count,2);
  assert.equal((await commit(project,await preview(project))).deletedCount,2);
  const all={scope:'all'}, oldAll=await preview(all);
  assert.equal(oldAll.count,1,'All projects includes unassigned conversations');
  await adapter.withMutation(store=>store.researchConversationsByUserID[owner.appUserID].push(row('new-after-preview','project-a')));
  await commit(all,oldAll,409);
  assert.equal((await adapter.read()).researchConversationsByUserID[owner.appUserID].length,2);
  assert.equal((await commit(all,await preview(all))).deletedCount,2);
  assert.equal((await preview(all)).count,0);
  current=await adapter.read();
  assert.equal(current.researchConversationsByUserID[owner.appUserID].length,0);
  assert.equal(current.researchConversationsByUserID[foreign.appUserID].length,1);

  const targets=researchDeleteTargetsForStore(before,owner.appUserID,researchDeleteScope(selection));
  const query=researchBulkDeleteQuery(owner.appUserID,targets,[owner.appUserID]);
  assert.match(query.text,/FOR UPDATE OF stored/);assert.match(query.text,/NOT EXISTS[\s\S]*expected\.revision/);
  assert.match(query.text,/targets AS MATERIALIZED \(SELECT \* FROM locked WHERE \(SELECT ok FROM permitted\)\)/);
  for(const table of ['permitext_research_feedback','permitext_project_links','permitext_research_answers','permitext_evidence_snapshots','permitext_research_conversations']) {
    assert.match(query.text,new RegExp(`DELETE FROM ${table} WHERE user_id = \\$1`));
  }
  assert.doesNotMatch(query.text,/DELETE FROM (permitext_foundation_artifacts|permitext_saved_items|permitext_research_usage|permitext_projects)/);
  for(const scope of [selection,project,all]) {
    const metadata=researchDeleteTargetsQuery(owner.appUserID,researchDeleteScope(scope));
    assert.match(metadata.text,/WHERE user_id = \$1/);assert.doesNotMatch(metadata.text,/SELECT conversation\b|messages|sources/);
  }
  const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
  const name='deleteResearchConversations';
  const start=source.indexOf(`    async ${name}(`,source.indexOf('async function createPostgresStoreAdapter()'));
  const code=source.slice(start,source.indexOf('\n    },',start)+6);
  const calls=[];
  const sql={query:(text,values)=>({text,values}),transaction:async(queries,options)=>{calls.push({queries,options});return [[{confirmed:true,deletedCount:2,projectIDs:['project-a']}]];}};
  const pg=vm.runInContext(`({${code}})`,vm.createContext({ensureSchema:async()=>{},sql,researchBulkDeleteQuery,researchDeleteConflict:()=>Error('changed')}));
  assert.equal((await pg.deleteResearchConversations(owner.appUserID,targets)).deletedCount,2);
  assert.equal(calls.length,1);assert.equal(calls[0].queries.length,1);assert.equal(calls[0].options.isolationLevel,'Serializable');
  assert.equal(calls[0].queries[0].values[0],owner.appUserID);
  console.log('Bulk Research deletion passed: selected/project/all, hidden history, exact preview, confirmation requirement, stale and atomic-race rejection, owner isolation, cascade cleanup, retained Notes/Reports/Saved/usage, and one scoped serializable PostgreSQL command.');
} finally {
  globalThis.fetch=originalFetch; server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});
}
