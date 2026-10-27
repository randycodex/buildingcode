// Production HTTP handlers and Neon SQL encoder against a disposable loopback
// PostgreSQL cluster. The only replacement is Neon's remote HTTP transport.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {neon,neonConfig} from '@neondatabase/serverless';

export async function startResearchV2Postgres(){
  const driver=resolve('data/research-v2-pg-runtime/node_modules/pg/lib/index.js');
  const {default:pg}=await import(pathToFileURL(driver));
  const folder=await mkdtemp(join(tmpdir(),'permitext-v2-postgres-'));
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  let started=false,sqlRequests=0;
  try{
    run('initdb',['-D',join(folder,'cluster'),'-A','trust','-U','permitext_v2','--no-locale','--encoding=UTF8']);
    run('pg_ctl',['-D',join(folder,'cluster'),'-l',join(folder,'postgres.log'),'-o',`-F -h 127.0.0.1 -k ${folder} -p ${port}`,'-w','start']);started=true;
    const connectionString=`postgresql://permitext_v2@127.0.0.1:${port}/postgres`;
    neonConfig.fetchEndpoint='http://127.0.0.1/permitext-v2-postgres-transport';
    neonConfig.fetchFunction=async(url,options)=>{
      assert.equal(url,neonConfig.fetchEndpoint);assert.equal(options.headers['Neon-Connection-String'],connectionString);
      const body=JSON.parse(options.body),queries=body.queries||[body];
      const client=new pg.Client({connectionString,statement_timeout:15000,types:{getTypeParser:()=>value=>value}});
      try{
        await client.connect();sqlRequests++;
        if(body.queries){const level={Serializable:'SERIALIZABLE',RepeatableRead:'REPEATABLE READ',ReadCommitted:'READ COMMITTED'}[options.headers['Neon-Batch-Isolation-Level']||'ReadCommitted'];assert(level);
          await client.query(`BEGIN ISOLATION LEVEL ${level}${options.headers['Neon-Batch-Read-Only']==='true'?' READ ONLY':''}`);}
        const results=[];
        for(const query of queries){const r=await client.query({text:query.query,values:query.params,rowMode:'array'});results.push({fields:r.fields.map(f=>({name:f.name,dataTypeID:f.dataTypeID})),rows:r.rows,command:r.command,rowCount:r.rowCount});}
        if(body.queries)await client.query('COMMIT');
        return Response.json(body.queries?{results}:results[0]);
      }catch(error){await client.query('ROLLBACK').catch(()=>{});return Response.json({message:error.message,code:error.code,detail:error.detail},{status:400});}
      finally{await client.end();}
    };
    const sql=neon(connectionString);
    return {connectionString,sql,
      async read(){
        const researchAnswersByUserID={};for(const row of await sql`SELECT user_id,answer FROM permitext_research_answers ORDER BY created_at,id`)(researchAnswersByUserID[row.user_id]||=[]).push(row.answer);
        return {researchAnswersByUserID};
      },
      async close(){console.log(JSON.stringify({postgres:'disposable loopback cluster',sqlRequests,externalDatabaseRequests:0}));neonConfig.fetchFunction=undefined;run('pg_ctl',['-D',join(folder,'cluster'),'-m','fast','-w','stop']);started=false;await rm(folder,{recursive:true,force:true});}
    };
  }catch(error){if(started)run('pg_ctl',['-D',join(folder,'cluster'),'-m','fast','-w','stop']);await rm(folder,{recursive:true,force:true});throw error;}
}
