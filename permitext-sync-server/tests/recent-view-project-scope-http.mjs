import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultSyncCodeVersion} from '../public/sync-identity.js';
const directory=await mkdtemp(join(tmpdir(),'permitext-project-recents-'));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets')});
for(const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','BLOB_STORE_ID','STRIPE_SECRET_KEY'])delete process.env[key];
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'Synthetic test cannot contact external services.');return originalFetch(url,options);};
const post=async(path,body,token)=>{
 const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
};
try {
 const {account}=await post('/account/sign-in',{credential:{provider:'web',providerUserID:'synthetic-project-recent-views'}});
 const userID=account.appUserID,token=account.backendSessionToken;
 const now=Date.now(),viewedAt=now/1000-978307200;
 const record=(projectID,age)=>({continuity:{userID,codeVersion:defaultSyncCodeVersion,updatedAt:new Date(now+age).toISOString(),values:{
  recentlyViewedSectionsJSON:JSON.stringify([{projectID,sectionID:2738,codeVersion:defaultSyncCodeVersion,title:projectID,viewedAt:viewedAt+age/1000}]),
  recentSearchesJSON:'[]',recentSearchHistoryJSON:JSON.stringify([{projectID,query:'stairs',searchedAt:now+age}])}}});
 for(const mutation of [record('project-a',0),record('project-b',1)]){
  const pushed=await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[mutation]}},token);
  assert.equal(pushed.rejectedMutationIDs.length,0,JSON.stringify(pushed));
 }
 const pulled=await post('/sync/pull',{auth:{accountUserID:userID}},token);
 const continuity=pulled.mutations.find(item=>item.continuity)?.continuity;
 assert.ok(continuity,'Persisted continuity must be returned by the real sync handler.');
 const views=JSON.parse(continuity.values.recentlyViewedSectionsJSON);
 assert.deepEqual(views.map(entry=>entry.projectID).sort(),['project-a','project-b'],'The sync API persists separate visits to the same section for both Projects.');
 assert.ok(views.every(entry=>entry.sectionID===2738));
 assert.deepEqual(JSON.parse(continuity.values.recentSearchHistoryJSON).map(entry=>entry.projectID).sort(),['project-a','project-b'],'Identical queries in two Projects remain independent through the real sync API.');
 // Replay an older device snapshot: neither Project history is dropped or reassigned.
 await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[record('project-a',0)]}},token);
 const replay=await post('/sync/pull',{auth:{accountUserID:userID}},token);
 const replayed=JSON.parse(replay.mutations.find(item=>item.continuity).continuity.values.recentlyViewedSectionsJSON);
 assert.deepEqual(replayed.map(entry=>entry.projectID).sort(),['project-a','project-b']);
 const removed=record('project-a',10);
 removed.continuity.values.recentSearchHistoryJSON=JSON.stringify([{projectID:'project-a',query:'stairs',searchedAt:now+10,deleted:true}]);
 await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[removed]}},token);
 await post('/sync/push',{auth:{accountUserID:userID},batch:{user:{id:userID},mutations:[record('project-a',0)]}},token);
 const afterRemove=await post('/sync/pull',{auth:{accountUserID:userID}},token);
 const queries=JSON.parse(afterRemove.mutations.find(item=>item.continuity).continuity.values.recentSearchHistoryJSON);
 assert.deepEqual(queries.filter(entry=>!entry.deleted).map(entry=>entry.projectID),['project-b'],'A scoped query removal survives stale replay and preserves the other Project.');
 console.log('Project recent activity HTTP passed: real push/pull, independent viewed sections and queries, scoped removal and stale-device replay.');
} finally {
 globalThis.fetch=originalFetch;
 await new Promise(resolve=>server.close(resolve));
 await rm(directory,{recursive:true,force:true});
}
