// Diagnostic benchmark. Fresh process required; never connects to a remote service.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
for (const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN']) delete process.env[key];
const directory=await fs.mkdtemp(join(tmpdir(),'permitext-public-content-benchmark-'));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json')});
const readOriginal=fs.readFile, reads=new Map();
fs.readFile=async function(path,...args){
 const name=String(path);if(name.includes('/CodeContent/'))reads.set(name,(reads.get(name)||0)+1);
 return readOriginal.call(this,path,...args);
};
syncBuiltinESMExports();
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const fetchOriginal=globalThis.fetch;
globalThis.fetch=(url,...args)=>{assert.equal(new URL(url).origin,base);return fetchOriginal(url,...args);};
const paths=process.argv.includes('--historical') ? Array.from({length:8},(_,i)=>'/code/search?q='+['concrete','fire','door','403.1','egress','ramp','wall','exit'][i]+'&code=BC&version=CodeContent%2Fauthored%2Fnew-york-city%2F2014-construction-codes%2Fbundle.json%231&match=exact&candidateOffset=0&limit=5') : ['/code/chapters?code=BC&view=startup','/code/chapters?code=PC&view=startup','/code/chapters?code=MC&view=startup','/code/chapters?code=AC&view=startup',...['concrete','fire','egress','ramp'].map(q=>'/code/search?q='+q+'&code=BC&match=exact&candidateOffset=0&limit=5')];
try {
 const start=performance.now();
 const values=await Promise.all(paths.map(async path=>{const t=performance.now(),r=await fetch(base+path);assert.equal(r.status,200);const text=await r.text();return {path,ms:Number((performance.now()-t).toFixed(1)),hash:createHash('sha256').update(text).digest('hex')};}));
 const total=performance.now()-start;
 const summary={totalMs:Number(total.toFixed(1)),reads: [...reads.values()].reduce((a,b)=>a+b,0),uniqueFiles:reads.size,chapterJSONReads: [...reads].filter(([p])=>p.includes('/chapters/')&&p.endsWith('.json')).reduce((n,[p,c])=>n+c,0),searchIndexReads:[...reads].filter(([p])=>p.endsWith('/searchIndex.json')).map(([path,count])=>({path:path.split('/new-york-city/')[1],count})),maxRepeatedFileReads:Math.max(...reads.values()),values};
 console.log(JSON.stringify(summary,null,2));
} finally {await new Promise(r=>server.close(r));globalThis.fetch=fetchOriginal;fs.readFile=readOriginal;syncBuiltinESMExports();await fs.rm(directory,{recursive:true,force:true});}
