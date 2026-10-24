// Actual repository SQL in a disposable embedded PostgreSQL engine; no cloud calls.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPostgresSyncRepository} from '../postgres-sync-repository.mjs';
import {sharedWorkspaceLayout, workspaceLayoutsKey} from '../public/workspace-layout-sync.js';
const {PGlite}=await import(process.env.PERMITEXT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db=new PGlite();
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
for(const name of ['entitlements','content_trash','user_content_records','saved_items','annotations','projects','project_items','sync_events']) {
  const ddl=source.match(new RegExp('CREATE TABLE IF NOT EXISTS permitext_'+name+' \\([\\s\\S]*?\\n      \\)'))?.[0];
  assert(ddl,name);await db.exec(ddl);
}
await db.exec('CREATE UNIQUE INDEX sync_event_identity ON permitext_sync_events(record_id,mutation_updated_at)');
const reads=[];
function sql(parts,...values) {
  let query='',params=[];
  for(let i=0;i<parts.length;i++) {query+=parts[i];if(i<values.length){const value=values[i];if(value?.query){query+=value.query.replace(/\$(\d+)/g,(_,n)=>'$'+(Number(n)+params.length));params.push(...value.params);}else{params.push(value);query+='$'+params.length;}}}
  return {query,params,then(resolve,reject){return db.query(query,params).then(r=>r.rows).then(resolve,reject);}};
}
sql.transaction=async queries=>db.transaction(async tx=>{
  const results=[];
  for(const query of queries){const rows=(await tx.query(query.query,query.params)).rows;results.push(rows);if(query.query.includes('SELECT records.mutation'))reads.push({query:query.query,rows});}
  return results;
});
try {
  const repo=createPostgresSyncRepository(sql),user='layout-owner',codeVersion='nyc-2022';
  let time=Date.now()-100000;
  const wrap=(kind,record)=>({[kind]:{...record,userID:user,codeVersion,updatedAt:new Date(time+=100).toISOString()}});
  await db.query("INSERT INTO permitext_entitlements(user_id,plan,source,entitlement) VALUES($1,'pro','lifetimeGrant','{\"plan\":\"pro\"}')",[user]);
  const projects=Array.from({length:40},(_,i)=>wrap('project',{id:'p'+i,clientID:'p'+i,localFolderID:i,name:'Project '+i,description:'Full project payload '.repeat(500)}));
  await repo.push(user,projects);
  await repo.push(user,[wrap('continuity',{values:{selectedCodeSectionID:'17'}})]);
  const baseline=await repo.pull(user,{});
  assert.equal(baseline.mutations.filter(m=>m.project).length,40);
  const layout=sharedWorkspaceLayout({readers:[{id:'r',chapterID:'1'}],paneOrder:['reader:r'],paneWeights:{'reader:r':780}});
  const record={id:'project:p0',projectID:'p0',updatedAt:new Date(time+=100).toISOString(),layout};
  const layoutPush=wrap('continuity',{values:{[workspaceLayoutsKey]:JSON.stringify([record])}});
  const pushResult=await repo.push(user,[layoutPush]);
  assert.equal(pushResult.rejectedMutationIDs.length,0);
  reads.length=0;
  const delta=await repo.pull(user,{sinceEventID:baseline.latestEventID});
  assert.equal(delta.mutations.length,1);
  assert(delta.mutations[0].continuity);
  assert.equal(delta.mutations[0].continuity.values.selectedCodeSectionID,'17');
  assert.equal(delta.allMutations.filter(m=>m.project).length,0,'Layout pull must not read full project dependencies');
  assert(reads.every(read=>read.rows.every(row=>!row.mutation?.project)),'Actual SQL returned no Project payloads');
  const dependencyRead=reads.find(read=>read.query.includes('AS sections'));
  assert(dependencyRead);assert.equal(dependencyRead.rows.length,0);
  const bytes=Buffer.byteLength(JSON.stringify(delta.mutations));
  assert(bytes<5000,`Metadata pull unexpectedly large: ${bytes}`);
  const unchanged=await repo.pull(user,{sinceEventID:delta.latestEventID});
  assert.equal(unchanged.mutations.length,0);assert.equal(unchanged.allMutations.length,0);
  const section=wrap('projectSection',{id:'link',sectionID:11909,folderClientID:'p0'});
  await repo.push(user,[section]);
  const linkDelta=await repo.pull(user,{sinceEventID:delta.latestEventID});
  assert.equal(linkDelta.mutations.filter(m=>m.projectSection).length,1);
  assert.deepEqual(linkDelta.allMutations.filter(m=>m.project).map(m=>m.project.id),['p0'],'Changed sections retain only their actual parent');
  const byTime=await repo.pull(user,{since:Date.parse(record.updatedAt)});
  assert.deepEqual(byTime.allMutations.filter(m=>m.project).map(m=>m.project.id),['p0'],'Timestamp clients retain dependencies');
  const full=await repo.pull(user,{});
  assert.equal(full.mutations.filter(m=>m.project).length,40,'Initial full sync is unchanged');
  console.log(`PostgreSQL layout sync passed: ${bytes}-byte delta, zero Project dependency rows for layout-only changes; 40 Projects excluded; section-parent and initial-sync compatibility passed.`);
} finally {await db.close();}
