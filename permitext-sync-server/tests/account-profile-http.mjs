import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'permitext-profile-'));
const path = join(dir, 'store.json');
await writeFile(path, JSON.stringify({users:{a:{appUserID:'a',authProvider:'apple',displayName:'Apple account',email:'person@example.com'},b:{appUserID:'b',authProvider:'apple',displayName:'Other',publicUsername:'taken'}},sessions:{a:'test-a',b:'test-b'},entitlements:{}}));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_SYNC_DATA_PATH:path,
 PERMITEXT_PUBLIC_BASE_URL:'http://localhost:3000',PERMITEXT_TERMS_VERSION:'terms-test',
 PERMITEXT_PRIVACY_VERSION:'privacy-test',PERMITEXT_SUBSCRIPTION_POLICY_VERSION:'refunds-test'});
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
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',professionalRole:'mayor'})).status,400);
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',professionalRole:'other'})).status,400);
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'person'})).status,200);
 assert.equal((await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'person',completeOnboarding:true})).status,400);
 const onboarding=await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'person',
  professionalRole:'architect_designer',productEmailOptIn:true,completeOnboarding:true,acceptPolicies:true,
  policyVersions:{terms:'terms-test',privacy:'privacy-test'}});
 assert.equal(onboarding.status,200);
 const saved=await post('/account/profile/read',{auth:{accountUserID:'a'}});
 assert.equal(saved.body.account.displayName,'Person');assert.equal(saved.body.account.publicUsername,'person');assert.equal(saved.body.account.email,'person@example.com');
 assert.equal(saved.body.account.professionalRole,'architect_designer');assert.equal(saved.body.account.productEmailOptIn,true);
 assert.equal(saved.body.account.onboardingCompleted,true);assert.equal(saved.body.account.policiesAccepted,true);
 const customRole=await post('/account/profile',{auth:{accountUserID:'a'},displayName:'Person',publicUsername:'person',
  professionalRole:'other',professionalRoleOther:'Permit consultant',productEmailOptIn:true});
 assert.equal(customRole.status,200);
 const customSaved=await post('/account/profile/read',{auth:{accountUserID:'a'}});
 assert.equal(customSaved.body.account.professionalRole,'other');assert.equal(customSaved.body.account.professionalRoleOther,'Permit consultant');
 console.log('Account profile HTTP passed: authentication, isolation, safe read, username conflict, persistence, email preservation.');
} finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
