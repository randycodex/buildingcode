import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {researchDiscoveryQuery} from '../public/research-v2.js';
const scratch=await mkdtemp(join(tmpdir(),'research-v2-discovery-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json')});
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,nativeFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'Discovery cannot call an external provider');return nativeFetch(url,options);};
const cases=[
  ['What affects corridor fire ratings?',['1020.1.1','1020.1.2']],
  ['What is the accessible ramp slope?',['1012.2']],
  ['Explain 1012.2',['1012.2']],
  ['What is the occupant load factor?',['1004.1.3']],
  ['What is the door clear width?',['1010.1.1.1']],
  ['Explain stair riser height',['1011.5.2']],
  ['What is the handrail height?',['1014.2']],
  ['What is ramp cross slope?',['1012.3']]
];
try{
  for(const [question,expected] of cases){
    const query=researchDiscoveryQuery(question);
    const response=await fetch(base+'/code/search?'+new URLSearchParams({q:query,match:'words',limit:'12'}));
    assert.equal(response.status,200);const data=await response.json();
    const actual=data.results.filter(s=>s.codePrefix==='BC'&&s.codeVersion.includes('/2022-')).map(s=>s.sectionNumber);
    for(const number of expected)assert(actual.includes(number),`${question}: missing ${number} in first 12 results`);
    console.log(JSON.stringify({question,query,expected,passed:true}));
  }
  console.log('Discovery: 8 developer-authored known-target checks passed. This does not measure complete regulatory coverage. No paid calls.');
}finally{globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
