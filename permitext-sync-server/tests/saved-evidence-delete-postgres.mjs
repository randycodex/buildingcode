// Execute the real repository SQL against an ephemeral PostgreSQL engine.
// PERMITEXT_TEST_PGLITE_PATH points to a disposable @electric-sql/pglite installation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPostgresSyncRepository} from '../postgres-sync-repository.mjs';
const {PGlite} = await import(process.env.PERMITEXT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const tables=['entitlements','content_trash','user_content_records','saved_items','annotations','projects','project_items','sync_events'];
for(const name of tables){
 const ddl=source.match(new RegExp('CREATE TABLE IF NOT EXISTS permitext_'+name+' \\([\\s\\S]*?\\n      \\)'))?.[0];
 assert(ddl,name); await db.exec(ddl);
}
await db.exec('CREATE UNIQUE INDEX sync_event_identity ON permitext_sync_events(record_id,mutation_updated_at)');
function sql(parts,...values){
 let text='',params=[];
 for(let i=0;i<parts.length;i++){
  text+=parts[i]; if(i>=values.length)continue;
  const v=values[i];
  if(v?.query){text+=v.query.replace(/\$(\d+)/g,(_,n)=>'$'+(Number(n)+params.length));params.push(...v.params);}
  else {params.push(v);text+='$'+params.length;}
 }
 return {query:text,params,then(resolve,reject){return db.query(text,params).then(r=>r.rows).then(resolve,reject);}};
}
let failTrashInsert=false;
sql.transaction=async (queries)=>db.transaction(async tx=>{
 const result=[];
 for(const query of queries){
  if(failTrashInsert && query.query.includes('INSERT INTO permitext_content_trash'))throw new Error('synthetic recovery storage failure');
  result.push((await tx.query(query.query,query.params)).rows);
 }
 return result;
});
const repo=createPostgresSyncRepository(sql), user='batch-owner', codeVersion='nyc-2022';
const old=new Date(Date.now()-10000).toISOString();
const wrap=(kind,record)=>({[kind]:{...record,userID:user,codeVersion,updatedAt:old}});
await db.query("INSERT INTO permitext_entitlements(user_id,plan,source,entitlement) VALUES($1,'pro','lifetimeGrant','{\"plan\":\"pro\"}')",[user]);
const items=Array.from({length:101},(_,i)=>({sectionID:1000+i,codeVersion}));
const records=[wrap('project',{id:'p',clientID:'p',name:'Project'}),wrap('project',{id:'q',clientID:'q',name:'Other'}),
 ...items.flatMap(item=>[wrap('savedItem',{id:'s'+item.sectionID,sectionID:item.sectionID}),wrap('projectSection',{id:'l'+item.sectionID,sectionID:item.sectionID,folderClientID:'p'})]),
 wrap('projectSection',{id:'shared',sectionID:1000,folderClientID:'q'}),wrap('annotation',{id:'note',sectionID:1000,noteBody:'Keep note'})];
assert.equal((await repo.push(user,records)).rejectedMutationIDs.length,0);
failTrashInsert=true;
await assert.rejects(repo.deleteSavedEvidence(user,{projectID:'p',items}),/synthetic/);
assert.equal((await db.query('SELECT count(*)::int AS n FROM permitext_project_items WHERE deleted_at IS NULL')).rows[0].n,102);
failTrashInsert=false;
const result=await repo.deleteSavedEvidence(user,{projectID:'p',items});
assert.equal(result.deletedCount,101);assert.equal(result.mutations.length,201);
assert.equal((await db.query('SELECT count(*)::int AS n FROM permitext_project_items WHERE deleted_at IS NULL')).rows[0].n,1);
assert.equal((await db.query('SELECT count(*)::int AS n FROM permitext_saved_items WHERE deleted_at IS NULL')).rows[0].n,1);
assert.equal((await db.query('SELECT note_body FROM permitext_annotations WHERE record_id=$1',['note'])).rows[0].note_body,'Keep note');
assert.equal((await repo.deleteSavedEvidence(user,{projectID:'p',items})).deletedCount,0);
const entries=(await repo.trashAction(user,'list')).entries;
assert.equal(entries.length,1);assert.equal(entries[0].count,201);
assert.equal((await repo.trashAction(user,'restore',entries[0].id)).restoredCount,201);
assert.equal((await db.query('SELECT count(*)::int AS n FROM permitext_project_items WHERE deleted_at IS NULL')).rows[0].n,102);
const originalTransaction=sql.transaction;
let injectCompetingLink=true, guards=0;
sql.transaction=async queries=>{
  if(queries.some(q=>q.query.includes('AS recovery_guard'))) {
    guards++;
    if(injectCompetingLink) {
      injectCompetingLink=false;
      await repo.push(user,[wrap('projectSection',{id:'concurrent-link',sectionID:1001,folderClientID:'q'})]);
    }
  }
  return originalTransaction(queries);
};
const concurrent=await repo.deleteSavedEvidence(user,{projectID:'p',items});
assert.equal(concurrent.deletedCount,101);assert(guards>=2,'Competing sync must retry with a fresh snapshot');
assert.equal((await db.query('SELECT count(*)::int AS n FROM permitext_saved_items WHERE deleted_at IS NULL')).rows[0].n,2,'New competing destination keeps its bookmark');
await db.close();
console.log('Batch delete PostgreSQL passed: actual SQL 101 items, atomic recovery failure rollback, shared destination preservation, notes, idempotency, typed tables and Trash restore.');
