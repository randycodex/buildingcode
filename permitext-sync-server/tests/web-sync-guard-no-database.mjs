import assert from 'node:assert/strict';
import {createServer} from 'node:http';
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:'postgresql://synthetic:synthetic@invalid.example/synthetic',PERMITEXT_TEST_RESEARCH_MOCK:'1'});
for(const key of ['PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','OPENAI_API_KEY','BLOB_READ_WRITE_TOKEN','VERCEL'])delete process.env[key];
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,originalFetch=globalThis.fetch;let outside=0;
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input.url);if(url.origin!==base){outside++;throw Error('Database/provider transport forbidden');}return originalFetch(input,options);};
try {
 for(let i=0;i<3;i++)for(const route of ['/sync/pull','/sync/checkpoint','/projects/artifacts/checkpoint']) {
  const response=await fetch(base+route,{method:'POST',headers:{origin:base,'content-type':'application/json',authorization:'Bearer synthetic'},body:JSON.stringify({auth:{accountUserID:'synthetic'}})});
  assert.equal(response.status,426);assert.equal((await response.json()).code,'WEB_APP_UPDATE_REQUIRED');
 }
 assert.equal(outside,0,'Repeated legacy polls must never attempt a database/provider request');
 console.log('Actual HTTP legacy requests: 9 rejected before database/provider transport (zero outbound calls), with a configured database URL.');
} finally {globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
