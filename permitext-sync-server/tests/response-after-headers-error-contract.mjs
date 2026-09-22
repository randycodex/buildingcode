import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
const scratch=await mkdtemp(join(tmpdir(),'permitext-sent-response-'));
process.env.PERMITEXT_SYNC_DATA_PATH=join(scratch,'store.json');
process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH=join(scratch,'assets');
const {handleRequest}=await import('../app.mjs');
let inject=true, repeatedHeaders=0;
const server=createServer((request,response)=>{
 const writeHead=response.writeHead.bind(response);
 response.writeHead=(...args)=>{
  if(response.headersSent) repeatedHeaders++;
  const result=writeHead(...args);
  if(inject){inject=false;throw new Error('Synthetic failure after headers are sent');}
  return result;
 };
 void handleRequest(request,response);
});
try {
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/health`;
 assert.equal((await fetch(url)).status,200);
 assert.equal((await fetch(url)).status,200,'Server remains responsive after the first response has already completed.');
 assert.equal(repeatedHeaders,0,'Error handling must not write a second set of headers.');
 console.log('Post-response failure is contained; subsequent health request succeeds without duplicate headers.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
