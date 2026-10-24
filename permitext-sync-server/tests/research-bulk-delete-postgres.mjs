// Optional local PostgreSQL execution check. Uses an empty private cluster,
// Unix sockets only, temporary tables, and rolls back every test record.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {researchBulkDeleteQuery, researchDeleteTargetsQuery, researchDeleteScope} from '../research-bulk-delete.mjs';
const folder=await mkdtemp(join(tmpdir(),'permitext-delete-postgres-'));
let started=false;
const run=(program,args,options={})=>execFileSync(program,args,{encoding:'utf8',maxBuffer:4*1024*1024,...options});
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const owner='owner',foreign='foreign',organization='org';
const targets=['a','b'].map(id=>({id,revision:1,updatedAt:'date',projectID:'project'}));
const bulk=researchBulkDeleteQuery(owner,targets,[owner,organization]);
const metadata=researchDeleteTargetsQuery(owner,researchDeleteScope({scope:'selected',conversationIDs:['a','b']}));
const execute=rows=>`EXECUTE remove_research(${literal(owner)},${literal(JSON.stringify(rows))}::jsonb,ARRAY[${literal(owner)},${literal(organization)}]::text[]);`;
try {
  run('initdb',['-D',join(folder,'data'),'-A','trust','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',join(folder,'data'),'-l',join(folder,'server.log'),'-o',`-F -h '' -k ${folder} -p 55487`,'-w','start']);started=true;
  const output=run('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h',folder,'-p','55487','-d','postgres'],{input:`
    BEGIN ISOLATION LEVEL SERIALIZABLE;
    CREATE TEMP TABLE permitext_research_conversations(id text PRIMARY KEY,user_id text,conversation jsonb);
    CREATE TEMP TABLE permitext_research_answers(id text PRIMARY KEY,user_id text,conversation_id text);
    CREATE TEMP TABLE permitext_evidence_snapshots(id text PRIMARY KEY,user_id text,answer_id text);
    CREATE TEMP TABLE permitext_research_feedback(id text PRIMARY KEY,user_id text,conversation_id text,answer_id text);
    CREATE TEMP TABLE permitext_project_links(user_id text,project_id text,target_kind text,target_id text);
    CREATE TEMP TABLE permitext_project_activity(user_id text,project_id text,object_kind text,object_id text,event jsonb);
    CREATE TEMP TABLE permitext_foundation_artifacts(id text,payload jsonb);
    CREATE TEMP TABLE permitext_saved_items(id text);
    CREATE TEMP TABLE permitext_research_usage(id text);
    INSERT INTO permitext_research_conversations VALUES
      ('a','owner','{"revision":1,"updatedAt":"date","primaryProjectID":"project","sources":[{"id":"passage-a"}]}'),
      ('b','owner','{"revision":1,"updatedAt":"date","primaryProjectID":"project","historyHiddenAt":"date"}'),
      ('keep','owner','{"revision":1,"updatedAt":"date","primaryProjectID":"other"}'),
      ('foreign','foreign','{"revision":1,"updatedAt":"date","primaryProjectID":"project"}');
    INSERT INTO permitext_research_answers VALUES ('answer-a','owner','a'),('answer-keep','owner','keep'),('foreign-answer','foreign','a');
    INSERT INTO permitext_evidence_snapshots VALUES ('snapshot-a','owner','answer-a'),('foreign-snapshot','foreign','foreign-answer');
    INSERT INTO permitext_research_feedback VALUES ('feedback-a','owner','a','answer-a'),('foreign-feedback','foreign','a','foreign-answer');
    INSERT INTO permitext_project_links VALUES ('owner','project','researchConversation','a'),('owner','project','researchAnswer','answer-a'),
      ('owner','project','approvedEvidence','snapshot-a'),('owner','project','selectedPassage','passage-a'),('foreign','project','researchConversation','a');
    INSERT INTO permitext_project_activity VALUES ('owner','project','researchConversation','a','{}'),('org','project','codeQuestion','question','{"metadata":{"researchConversationID":"a"}}'),('foreign','project','researchConversation','a','{}');
    INSERT INTO permitext_foundation_artifacts VALUES ('note','{"text":"Kept Note"}'),('report','{"text":"Kept Report"}');
    INSERT INTO permitext_saved_items VALUES ('saved');INSERT INTO permitext_research_usage VALUES ('usage');
    CREATE FUNCTION pg_temp.check_test(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT ok THEN RAISE EXCEPTION '%',label; END IF; END $$;
    PREPARE metadata(text,text[]) AS ${metadata.text};
    EXECUTE metadata('owner',ARRAY['a','b']);
    PREPARE remove_research(text,jsonb,text[]) AS ${bulk.text};
    ${execute([{...targets[0],revision:2},targets[1]])}
    SELECT pg_temp.check_test((SELECT count(*)=4 FROM permitext_research_conversations),'Stale target changed data');
    ${execute([targets[0],{...targets[1],id:'foreign'}])}
    SELECT pg_temp.check_test((SELECT count(*)=4 FROM permitext_research_conversations),'Foreign target partially deleted data');
    ${execute(targets)}
    SELECT pg_temp.check_test((SELECT count(*)=2 FROM permitext_research_conversations),'Conversation count');
    SELECT pg_temp.check_test(NOT EXISTS(SELECT 1 FROM permitext_research_conversations WHERE id IN ('a','b')),'Targets still exist');
    SELECT pg_temp.check_test((SELECT count(*)=2 FROM permitext_research_answers),'Answer isolation');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_evidence_snapshots),'Snapshot isolation');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_research_feedback),'Feedback isolation');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_project_links),'Link isolation');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_project_activity),'Shared activity cleanup');
    SELECT pg_temp.check_test((SELECT count(*)=2 FROM permitext_foundation_artifacts),'Notes and Reports');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_saved_items),'Saved evidence');
    SELECT pg_temp.check_test((SELECT count(*)=1 FROM permitext_research_usage),'Usage history');
    SELECT 'POSTGRES_BULK_DELETE_PASSED'; ROLLBACK;
  `});
  assert.match(output,/POSTGRES_BULK_DELETE_PASSED/);
  console.log('Actual local PostgreSQL execution passed: stale/foreign sets delete nothing, confirmed bulk cascade, hidden history, shared activity cleanup, ownership isolation and retained Notes/Reports/Saved/usage. Empty private Unix-socket cluster; no production database.');
} finally {
  if(started)run('pg_ctl',['-D',join(folder,'data'),'-m','fast','-w','stop']);
  await rm(folder,{recursive:true,force:true});
}
