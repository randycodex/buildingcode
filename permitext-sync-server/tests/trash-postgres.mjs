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
const repo=createPostgresSyncRepository(sql), user='pg-owner', codeVersion='nyc-2022';
const old=new Date(Date.now()-10000).toISOString();
const saved={savedItem:{id:'pg-save',userID:user,codeVersion,sectionID:545,updatedAt:old}};
const note={annotation:{id:'pg-note',userID:user,codeVersion,sectionID:545,noteBody:'Keep this',tags:['tag'],updatedAt:old}};
const project={project:{id:'pg-project',userID:user,codeVersion,clientID:'pg-project',folderType:'reference',name:'Collection',updatedAt:old}};
await db.query("INSERT INTO permitext_entitlements(user_id,plan,source,entitlement) VALUES($1,'pro','lifetimeGrant','{\"plan\":\"pro\"}')",[user]);
assert.equal((await repo.push(user,[saved,note,project])).acceptedMutationIDs.length,3);
const remove={savedItem:{...saved.savedItem,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};
failTrashInsert=true;
await assert.rejects(repo.push(user,[remove]),/synthetic/);
assert.equal((await db.query('SELECT deleted_at FROM permitext_saved_items WHERE record_id=$1',['pg-save'])).rows[0].deleted_at,null,'Recovery storage failure must roll back deletion');
failTrashInsert=false;
assert.equal((await repo.push(user,[remove])).acceptedMutationIDs.length,1);
let entries=(await repo.trashAction(user,'list')).entries;
assert.equal(entries.length,1); assert.equal(entries[0].count,1);
assert.equal((await repo.trashAction('different-owner','list')).entries.length,0);
await assert.rejects(repo.trashAction('different-owner','restore',entries[0].id),/unavailable/);
await repo.push(user,[remove]);
assert.equal((await repo.trashAction(user,'list')).entries.length,1);
await db.query("UPDATE permitext_entitlements SET plan='free' WHERE user_id=$1",[user]);
assert.equal((await repo.trashAction(user,'restore',entries[0].id)).restoredCount,1);
assert.equal((await db.query('SELECT deleted_at FROM permitext_saved_items WHERE record_id=$1',['pg-save'])).rows[0].deleted_at,null);
// Denied note editing cannot manufacture a Trash entry.
await repo.push(user,[{annotation:{...note.annotation,noteBody:'',updatedAt:new Date().toISOString()}}]);
assert.equal((await repo.trashAction(user,'list')).entries.length,0);
const clear={codeVersionClear:{userID:user,codeVersion,values:{scope:'notes'},updatedAt:new Date().toISOString()}};
await repo.push(user,[clear]);
entries=(await repo.trashAction(user,'list')).entries;
assert.equal(entries.length,1);
assert.equal((await repo.trashAction(user,'restore',entries[0].id)).restoredCount,1);
const deleteProject={project:{...project.project,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};
await repo.push(user,[deleteProject]); entries=(await repo.trashAction(user,'list')).entries;
assert.equal(entries.length,1);
assert.equal((await repo.trashAction(user,'restore',entries[0].id)).restoredCount,1);
assert.equal((await db.query('SELECT folder_type FROM permitext_projects WHERE record_id=$1',['pg-project'])).rows[0].folder_type,'reference');
await repo.push(user,[{project:{...deleteProject.project,updatedAt:new Date(Date.now()+100).toISOString()}}]);
entries=(await repo.trashAction(user,'list')).entries;
await repo.trashAction(user,'purge',entries[0].id);
assert.equal((await repo.trashAction(user,'list')).entries.length,0);
const mergeBatch={id:'merge-copy',userID:user,records:[{kind:'project',mode:'record',record:{...project.project,id:user+':project'}}]};
await db.query("INSERT INTO permitext_content_trash(id,user_id,batch,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",['merge-copy',user,JSON.stringify(mergeBatch)]);
const mergeSQL=source.match(/sql`(UPDATE permitext_content_trash SET user_id = [\s\S]*?WHERE user_id = \$\{sourceUserID\})`/)[1];
await new Function('sql','sourceUserID','targetUserID','return sql`'+mergeSQL+'`')(sql,user,'linked-owner');
const merged=(await db.query('SELECT batch FROM permitext_content_trash WHERE user_id=$1',['linked-owner'])).rows[0].batch;
assert.equal(merged.userID,'linked-owner');
assert.equal(merged.records[0].record.userID,'linked-owner');
assert.equal(merged.records[0].record.id,'linked-owner:project');
await db.close();
console.log('PostgreSQL Trash: actual SQL delete/restore, typed-table updates, rollback on snapshot failure, ownership, Free restore, rejected writes, bulk notes, collection type and purge passed.');
