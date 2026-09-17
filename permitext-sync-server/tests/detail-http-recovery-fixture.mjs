// Temporary loopback-only actual-app acceptance fixture. Never uses owner data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const selfCheck=process.argv.includes('--conflict-self-check');
const conflictMode=selfCheck||process.argv.includes('--conflict');
const port=selfCheck?0:conflictMode?18882:18881;
let seededConflict=false;const replies=[];
const directory=await mkdtemp(join(tmpdir(),'permitext-detail-http-'));
for(const key of Object.keys(process.env)) if (/DATABASE_URL|POSTGRES_URL|STORAGE_URL|OPENAI|CLERK|BLOB_|VERCEL_|RESEND|STRIPE|APPLE_.*(SECRET|KEY)/.test(key)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_TEST_RESEARCH_MOCK:'1',PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID()});
const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
const capability=randomUUID(),userID=conflictMode?'apple:synthetic-detail-conflict':'apple:synthetic-detail-recovery';
const marker='Isolated Detail recovery';
let session,account,held=!conflictMode,dropped=0;
const attempts=[];
function json(response,status,value){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value));}
async function evidence(){
 const store=await createFileStoreAdapter().read();
 const annotations=(store.mutationsByUserID[userID]||[]).map(m=>m.annotation).filter(a=>a?.noteBody?.startsWith(marker));
 const ids=[...new Set(attempts.flatMap(a=>a.annotations.map(n=>n.id)))];
 return {conflictMode,seededConflict,replies,held,dropped,attempts,annotationCount:annotations.length,uniqueIDs:ids,annotations};
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/fixture/')){
   if(url.searchParams.get('key')!==capability && req.headers['x-fixture-key']!==capability)return json(res,403,{error:'Fixture capability required'});
   if(url.pathname==='/fixture/resume'&&req.method==='POST'){held=false;return json(res,200,{held});}
   if(url.pathname==='/fixture/evidence')return json(res,200,await evidence());
   if(url.pathname==='/fixture/verify'){
    const result=await evidence();if(conflictMode){assert.ok(result.seededConflict);assert.ok(result.replies.some(r=>r.rejectedMutationIDs?.length));await writeFile('/tmp/permitext-detail-conflict-evidence.json',JSON.stringify(result,null,2));return json(res,200,{passed:true,...result});}assert.ok(result.dropped>=1);assert.equal(result.held,false);assert.ok(result.attempts.length>=2);assert.equal(result.annotationCount,1);assert.equal(result.uniqueIDs.length,1);assert.ok(result.attempts.every(a=>a.annotations.every(n=>n.id===result.uniqueIDs[0])));
    await writeFile('/tmp/permitext-detail-http-evidence.json',JSON.stringify(result,null,2));console.log('DETAIL_HTTP_VERIFIED',JSON.stringify({dropped:result.dropped,attempts:result.attempts.length,annotationCount:1,uniqueIDs:result.uniqueIDs}));return json(res,200,{passed:true,...result});
   }
   if(url.pathname==='/fixture/start'){
    if(!account)return json(res,503,{error:'Not ready'});
    const stored={userID,sessionToken:session,authProvider:'apple',displayName:'Synthetic Detail verification',entitlement:account.entitlement};
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
    return res.end(`<!doctype html><title>Isolated Detail HTTP verification</title><h1>Isolated Detail HTTP verification</h1><p>Actual local app, temporary synthetic account. Type a Detail annotation beginning <b>${marker}</b>. ${conflictMode?"The first matching note triggers a newer server copy through the actual sync handler; your older edit must enter conflict review. Choose Use server after verifying reopen retention.":"Matching sync responses remain interrupted until released here."}</p><button id="start">Open isolated Permitext</button><button id="resume">Allow responses for Retry</button><a href="/fixture/evidence?key=${capability}" target="_blank">Read evidence</a><a href="/fixture/verify?key=${capability}" target="_blank">Verify recovery</a><p id="status"></p><script>document.querySelector('#start').onclick=()=>{localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});location.href='/';};document.querySelector('#resume').onclick=async()=>{const r=await fetch('/fixture/resume',{method:'POST',headers:{'x-fixture-key':${JSON.stringify(capability)}}});document.querySelector('#status').textContent=await r.text();};</script>`);
   }
   return json(res,404,{error:'Unknown fixture control'});
  }
  if(url.pathname.startsWith('/research/')&&/messages|submit|send|questions/.test(url.pathname))return json(res,403,{error:'Research submission disabled in fixture'});
  if(req.method==='POST'&&url.pathname==='/sync/push'){
   let matching=[];
   if(conflictMode){
    // Consume before invoking the real handler. Delaying `end` alone does not
    // serialize Node's async-iterator readBody against a concurrent seed write.
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const raw=Buffer.concat(chunks);const body=JSON.parse(raw.toString());
    matching=(body.batch?.mutations||[]).map(m=>m.annotation).filter(a=>a?.noteBody?.startsWith(marker));
    if(matching.length){assert.equal(body.auth?.accountUserID,userID);attempts.push({annotations:matching,body});}
    if(matching.length&&!seededConflict){
     seededConflict=true;const newer={...matching[0],noteBody:'Server version for explicit conflict review',updatedAt:new Date(Date.now()+3600000).toISOString()};
     await post('/sync/push',{auth:{accountUserID:userID,sessionToken:session},batch:{user:{id:userID},mutations:[{annotation:newer}]}},session);
    }
    // Replay the exact received bytes into the actual handler's readBody path.
    req[Symbol.asyncIterator]=async function*(){yield raw;};
   }else{
    const chunks=[];const emit=req.emit;
    req.emit=function(event,...args){if(event==='data')chunks.push(args[0]);if(event==='end'){
     const body=JSON.parse(Buffer.concat(chunks).toString());matching=(body.batch?.mutations||[]).map(m=>m.annotation).filter(a=>a?.noteBody?.startsWith(marker));
     if(matching.length){assert.equal(body.auth?.accountUserID,userID);attempts.push({annotations:matching,body});}
    }return emit.call(this,event,...args);};
   }
   const end=res.end;
   res.end=function(...args){if(conflictMode&&matching.length){try{replies.push(JSON.parse(String(args[0])));}catch{}}if(matching.length&&held&&res.statusCode>=200&&res.statusCode<300){dropped++;console.log('DETAIL_ACK_DROPPED',dropped);res.destroy();return res;}return end.apply(this,args);};
  }
  return await handleRequest(req,res);
 }catch(error){console.error(error);if(!res.headersSent)json(res,500,{error:error.message});else res.destroy();}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;const realFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert.equal(url.origin,base,'Fixture forbids external/provider requests');return realFetch(input,options);};
async function post(path,body,token){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;}
await post('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
account=await post('/account/sign-in',{credential:{provider:'apple',providerUserID:conflictMode?'synthetic-detail-conflict':'synthetic-detail-recovery',email:'detail@example.test',displayName:'Synthetic Detail verification'}});session=account.account.backendSessionToken;
console.log(`DETAIL_HTTP_READY ${base}/fixture/start?key=${capability}`);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});process.exit(process.exitCode||0);}
process.once('SIGINT',stop);process.once('SIGTERM',stop);setTimeout(stop,30*60*1000).unref();

if(selfCheck){
 try{
  const result=await post('/sync/push',{auth:{accountUserID:userID,sessionToken:session},batch:{user:{id:userID},mutations:[{annotation:{id:'isolated-conflict-self-check',userID,codeVersion:'CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1',sectionID:31001371,blockID:null,noteBody:marker+' deterministic seed',updatedAt:new Date().toISOString(),deletedAt:null}}]}},session);
  assert.equal(result.acceptedMutationIDs.length,0);assert.ok(result.rejectedMutationIDs.includes('isolated-conflict-self-check'));
  assert.equal(attempts.length,1);console.log('DETAIL_CONFLICT_ORDERING_PASS');
 }catch(error){console.error(error);process.exitCode=1;}
 await stop();
}
