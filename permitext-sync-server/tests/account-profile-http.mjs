import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'permitext-profile-'));
const path = join(dir, 'store.json');
await writeFile(path, JSON.stringify({users:{a:{appUserID:'a',authProvider:'apple',displayName:'Apple account',email:'person@example.com'},b:{appUserID:'b',authProvider:'apple',displayName:'Other',publicUsername:'taken'}},sessions:{a:'test-a',b:'test-b'},entitlements:{}}));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_SYNC_DATA_PATH:path});
for(const key of ['DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL']) delete process.env[key];
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
async function post(route,body,token='test-a'){
 const r=await fetch(`http://127.0.0.1:${server.address().port}${route}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
try {
 assert.equal((await post('/account/profile/read',{})).status,400);
 assert.equal((await post('/account/profile/read',{auth:{accountUserID:'a'}},'invalid')).status,401);
 assert.notEqual((await post('/account/profile/read',{auth:{accountUserID:'b'}})).status,200);
 const initial=await post('/account/profile/read',{auth:{accountUserID:'a'}});
 assert.equal(initial.status,200);assert.equal(initial.body.account.email,'person@example.com');
 assert.equal(JSON.stringify(initial.body).includes('test-a'),false);
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'taken'})).status,409);
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'person'})).status,200);
 const saved=await post('/account/profile/read',{auth:{accountUserID:'a'}});
 assert.equal(saved.body.account.displayName,'Person');assert.equal(saved.body.account.publicUsername,'person');assert.equal(saved.body.account.email,'person@example.com');
 console.log('Account profile HTTP passed: authentication, isolation, safe read, username conflict, persistence, email preservation.');
} finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
