import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProjectURLCatalog} from '../public/project-urls.js';
const temporary = await mkdtemp(join(tmpdir(), 'permitext-project-urls-'));
Object.assign(process.env, {NODE_ENV:'test', VERCEL:'', VERCEL_ENV:'', PERMITEXT_SYNC_DATA_PATH:join(temporary,'sync.json'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-url-grant'});
for (const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL']) delete process.env[key];
const {handleRequest,createFileStoreAdapter} = await import('../app.mjs');
const server = createServer(handleRequest);await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {assert.equal(new URL(url).origin,base);return originalFetch(url,options);};
async function post(path,body,token) {
  const response = await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
try {
  const signed = await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-url-owner'}});
  const userID = signed.body.account.appUserID, token = signed.body.account.backendSessionToken;
  assert.equal((await post('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status,200);
  const baseTime = Date.now()-10000;
  const project = (id,name,n) => ({id:`${userID}:${id}`,clientID:id,userID,name,createdAt:new Date(baseTime).toISOString(),updatedAt:new Date(baseTime+n*100).toISOString(),codeVersion:'nyc-2022'});
  const push = async record => {
    const result = await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[{project:record}]}},token);
    assert.equal(result.status,200);assert(result.body.acceptedMutationIDs.includes(record.id));
  };
  await push(project('p1','Original Name',0));
  await push(project('p2','Courtyard House',1));
  // Simulate native/older clients: no browser-specific URL fields in mutations.
  await push(project('p1','Courtyard House',2));
  await push({...project('p1','Courtyard House',3),description:'An unrelated edit must preserve the first name claim.'});
  const getURLs = () => post('/projects/urls',{auth:{accountUserID:userID}},token);
  let payload = await getURLs();assert.equal(payload.status,200);
  let catalog = createProjectURLCatalog(payload.body.projects,payload.body.names);
  assert.equal(catalog.slugFor('p2'),'courtyard-house',JSON.stringify(payload.body));
  const previousURL = catalog.slugFor('p1');assert.notEqual(previousURL,'courtyard-house');
  assert.equal(catalog.resolve('original-name').projectID,'p1');
  await push(project('p1','COURTYARD HOUSE',3.5));
  payload = await getURLs();
  assert.equal(createProjectURLCatalog(payload.body.projects,payload.body.names).slugFor('p2'),'courtyard-house','Capitalization changes cannot steal an existing URL.');
  await push(project('p1','100 Main Street',4));
  payload = await getURLs();catalog = createProjectURLCatalog(payload.body.projects,payload.body.names);
  assert.equal(catalog.slugFor('p1'),'100-main-street');
  assert.equal(catalog.resolve(previousURL).projectID,'p1');
  assert.equal(catalog.resolve('original-name').projectID,'p1');
  assert((await createFileStoreAdapter().read()).projectURLNamesByUserID[userID].length>=4,'Names must survive server reloads.');
  const foreign = await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-url-other'}});
  const foreignID = foreign.body.account.appUserID, foreignToken = foreign.body.account.backendSessionToken;
  const other = await post('/projects/urls',{auth:{accountUserID:foreignID},projectIDs:['p1']},foreignToken);
  assert.equal(other.status,200);assert.deepEqual(other.body.projects,[]);assert.deepEqual(other.body.names,[]);
  assert.equal((await post('/projects/urls',{auth:{accountUserID:userID}})).status,401);
  const page = await fetch(base+'/workspace/100-main-street');assert.equal(page.status,200);assert.match(await page.text(),/workspace-shell/);
  const stale = await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[{project:project('p1','Rejected Name',1)}]}},token);
  assert(stale.body.rejectedMutationIDs.length);
  assert(!(await getURLs()).body.names.some(entry=>entry.name==='Rejected Name'));
  const adapter = createFileStoreAdapter();
  await adapter.saveProjectOwnership({projectID:'p1',owner:{kind:'user',id:foreignID},storageOwnerUserID:userID,originalOwnerUserID:userID,updatedAt:new Date().toISOString()});
  const revoked = (await getURLs()).body;
  assert(!revoked.projects.some(project=>project.projectID==='p1'),'Stored records cannot bypass transferred Project ownership.');
  assert(!revoked.names.some(entry=>entry.projectID==='p1'),'Revoked Project name history remains private.');
  console.log('Project URL HTTP passed: durable rename history, native-client compatibility, duplicate ownership, stale-write rejection, private scope, and direct page loading.');
} finally {
  globalThis.fetch = originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}
