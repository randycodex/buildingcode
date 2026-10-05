// Evaluation only: GET Search, no Research calls or application changes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {searchRequest,rankResults} from '../evals/typesafe-search.mjs';
const root=new URL('../',import.meta.url),live=process.argv.includes('--live');
if(live)assert.equal(process.env.PERMITEXT_TYPESAFE_SEARCH_LIVE,'1');
const local=live?parseEnv(await readFile(new URL('.env.local',root),'utf8')):{};
if(live)assert(local.TYPESAFE_API_KEY);
for(const k of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(k))delete process.env[k];
process.env.PERMITEXT_SYNC_DATA_PATH=join(await mkdtemp(join(tmpdir(),'permitext-search-eval-')),'store.json');
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const cases=JSON.parse(await readFile(new URL('evals/typesafe-search-cases.json',root)));
const dir=new URL('.typesafe-local/',root);await mkdir(dir,{recursive:true,mode:0o700});
const out=new URL(`${Date.now()}-search-${live?'live':'offline'}.json`,dir);
const report={model:'jev-1.13.0',status:'running',live,appSHA256:createHash('sha256').update(await readFile(new URL('app.mjs',root))).digest('hex'),cases:[],limitations:['Draft target labels are navigation judgments, not complete legal coverage.','First 25 current Search results only; reranking cannot recover absent candidates.','Code-filtered construction Search only; no UI or Research calls.','Two repeats per query; not a representative traffic sample.']};
const save=()=>writeFile(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
try{for(const c of cases){
 const started=performance.now(),res=await fetch(`${base}/code/search?${new URLSearchParams({q:c.query,code:c.code,limit:'25'})}`);assert.equal(res.status,200);
 const body=await res.json(),row={...c,searchMs:performance.now()-started,totalResults:body.totalResults,results:body.results,attempts:[]};report.cases.push(row);await save();
 console.log(JSON.stringify({query:c.query,total:body.totalResults,results:body.results.map(s=>`${s.sectionNumber} ${s.title}`)}));
 if(!live||!body.results.length)continue;
 for(let repeat=1;repeat<=2;repeat++){
  const attempt={repeat,status:'running'};row.attempts.push(attempt);await save();const start=performance.now();
  try{const r=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${local.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(searchRequest(c.query,body.results))});
   attempt.httpStatus=r.status;if(!r.ok)throw new Error('Provider HTTP failure');
   const data=await r.json();attempt.response=data;assert.equal(data.model,report.model);assert(Number.isSafeInteger(data.usage?.input_tokens)&&data.usage.input_tokens>=0&&data.usage.input_tokens<=65536);
   attempt.costUSD=data.usage.input_tokens*.042/1e6;attempt.order=rankResults(c.query,body.results,data.answers).map(s=>s.id);attempt.status='completed';
  }catch{attempt.status='failed';throw new Error('Provider request or response validation failed; no retry');}
  finally{attempt.ms=performance.now()-start;await save();}
 }
}report.status='completed';}catch(e){report.status='stopped';report.error=e.message;process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(r=>server.close(r));await save();console.log(`Report: ${out.pathname}`);}
