import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {webSyncProtocol,webSyncProtocolHeader} from '../public/web-client-version.js';
const temporary=await mkdtemp(join(tmpdir(),'permitext-web-guard-http-'));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_TEST_RESEARCH_MOCK:'1',PERMITEXT_SYNC_DATA_PATH:join(temporary,'sync.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-update-grant'});
for(const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','BLOB_STORE_ID'])delete process.env[key];
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,originalFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'No production/provider transport');return originalFetch(url,options);};
let userID,token;
async function post(path,body={},options={}) {
 const bearer=options.token??token;
 const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`} : {}),
  ...(options.web?{origin:base,'sec-fetch-site':'same-origin'}:{'user-agent':'permitext/413 CFNetwork/3860.500.111.2.2 Darwin/25.0.0'}),
  ...(options.modern?{[webSyncProtocolHeader]:webSyncProtocol}:{}),...(options.cookie?{cookie:options.cookie}:{})},
  body:JSON.stringify({auth:{accountUserID:userID},...body})});
 return {response,status:response.status,body:await response.json()};
}
try {
 const signIn=await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-web-update'}});assert.equal(signIn.status,200);
 userID=signIn.body.account.appUserID;token=signIn.body.account.backendSessionToken;
 assert.equal((await post('/admin/lifetime-grants/grant',{userID},{token:process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN})).status,200);
 const projectID='web-guard-project',record={id:'web-guard-record',clientID:projectID,userID,codeVersion:'nyc-2022',name:'Update guard fixture',updatedAt:new Date().toISOString()};
 const push=mutations=>({batch:{user:{id:userID},mutations}});
 assert.equal((await post('/sync/push',push([{project:record}]),{web:true,modern:true})).status,200);
 const modern=await post('/sync/pull',{}, {web:true,modern:true});assert.equal(modern.status,200);assert(modern.body.mutations.some(m=>m.project?.clientID===projectID));
 const native=await post('/sync/pull');assert.equal(native.status,200,'Existing native request shape remains supported');
 assert.equal((await post('/sync/checkpoint')).status,200,'Native checkpoint still authenticates and reads');
 const legacy=await post('/sync/pull',{}, {web:true});assert.equal(legacy.status,426);assert(!('mutations' in legacy.body));
 const legacyWrite=await post('/sync/push',push([{project:{...record,description:'Legacy save retained',updatedAt:new Date(Date.now()+1).toISOString()}}]),{web:true});
 assert.equal(legacyWrite.status,200);assert(legacyWrite.body.acceptedMutationIDs.includes(record.id));
 const cookie=legacyWrite.response.headers.getSetCookie()[0].split(';')[0];assert(cookie);
 const readback=await post('/sync/pull',{}, {web:true,cookie});assert.equal(readback.status,200);assert(readback.body.mutations.some(m=>m.project?.description==='Legacy save retained'));
 assert.equal((await post('/sync/checkpoint',{}, {web:true,cookie})).status,426,'A save readback permit cannot restart automatic polling');
 const document={schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'paragraph',content:[{type:'text',text:'Saved without updating the old browser.',styles:{}}]}]};
 const note=await post('/notebook/cards/save',{projectID,expectedVersion:0,clientMutationID:'legacy-web-note-save',cardType:'finding',title:'Legacy saving works',document,evidenceLinks:[]},{web:true});
 assert.equal(note.status,201,JSON.stringify(note.body));
 for(const options of [{web:true,modern:true},{}]) {
  assert.equal((await post('/projects/artifacts/checkpoint',{projectIDs:[projectID]},options)).status,200,'Manual web and native artifact reads retain normal authorization');
 }
 assert.equal((await post('/sync/pull',{}, {web:true,modern:true,token:'invalid'})).status,401,'Protocol header does not grant account access');
 const wrongUser=await post('/projects/artifacts/checkpoint',{auth:{accountUserID:'another-owner'},projectIDs:[projectID]},{web:true,modern:true});assert.equal(wrongUser.status,401);
 console.log('Actual HTTP compatibility passed: legacy Project/Note saving and readback, modern manual reads, unchanged native pulls/checkpoints, and retained account authorization.');
} finally {globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
