import assert from 'node:assert/strict';
import {createPublicCodeRevisionController,isPublicCodePath} from '../public/public-code-revision.js';
const A='a'.repeat(64),B='b'.repeat(64);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const header=value=>({headers:{get:()=>value}});
let latest=A,probes=0,time=0;const invalidations=[];
const c=createPublicCodeRevisionController({fetchRevision:async()=>{probes++;return{corpusRevision:latest,cacheContract:1};},onInvalidate:v=>invalidations.push(v),now:()=>time});
await c.probe();assert.equal(c.revision,A);assert.equal(probes,1);
await c.probe();assert.equal(probes,1);
let requests=0;assert.deepEqual(await c.read('/code/chapters/A',{},async(path,accept)=>{requests++;assert.ok(path.includes(`expectedPublicCorpusRevision=${A}`));accept(header(A));return{chapter:'A'};}),{chapter:'A'});
assert.equal(probes,1,'warm reads do not await revision network');
latest=B;time=60001;await c.probe();assert.equal(c.revision,B);latest=A;await c.probe({force:true});assert.equal(c.revision,A,'rollback changes generation');assert.equal(invalidations.length,3);
{
 const old=deferred();let count=0;
 const request=c.read('/code/search?q=concrete',{},async(path,accept)=>{if(++count===1){await old.promise;accept(header(A));return'old';}accept(header(B));return'new';});
 latest=B;await c.probe({force:true});old.resolve();assert.equal(await request,'new');assert.equal(c.revision,B);assert.equal(count,2);
}
{
 let count=0;latest=A;
 const result=await c.read('/code/search?q=test',{},async(path,accept)=>{if(++count===1){const e=Error('changed');e.status=409;throw e;}assert.ok(path.includes(A));accept(header(A));return'current';});
 assert.equal(result,'current');assert.equal(count,2);
 let windowRequests=0;latest=B;
 await assert.rejects(c.read('/code/chapters/A?include=body&bodyStart=20&bodyLimit=5',{},async()=>{windowRequests++;const e=Error('changed');e.status=409;throw e;}),{code:'CHAPTER_WINDOW_MISMATCH'});
 assert.equal(windowRequests,1,'never retry old ordinal window against new manifest');assert.equal(c.revision,B);
}
{
 let count=0;await assert.rejects(c.read('/code/search',{},async()=>{count++;const e=Error('changed');e.status=409;throw e;}),{code:'PUBLIC_CORPUS_CHANGED'});assert.equal(count,2);
 const controller=new AbortController();controller.abort();await assert.rejects(c.read('/code/search',{signal:controller.signal},()=>{throw Error('must not start');}),{name:'AbortError'});
}
{
 const held=deferred();let count=0,invalidated=0;const f=createPublicCodeRevisionController({fetchRevision:()=>{count++;return held.promise;},onInvalidate:()=>invalidated++});
 const one=f.probe(),two=f.probe();assert.equal(one,two);await Promise.resolve();assert.equal(count,1);held.reject(Error('offline'));await one;assert.equal(invalidated,0);assert.equal(f.revision,'');
 const before=c.generation;await c.probe({force:true,reconnect:true});assert.ok(c.generation>before,'reconnect invalidates offline-backed memory even unchanged corpus');
}
for(const path of ['/code/search?q=x','/code/chapters/A?bodyStart=0','/code/sections/47','/code/libraries'])assert.equal(isPublicCodePath(path),true);
for(const path of ['/sync','/projects','/code/assets/a.png','/code/revision'])assert.equal(isPublicCodePath(path),false);
console.log('Public revision controller passed: background throttle/singleflight, warm requests, update/rollback, stale response suppression, bounded retry, window restart boundary, cancellation and reconnect.');

{
 const held=deferred();const gate=createPublicCodeRevisionController({fetchRevision:()=>held.promise,onInvalidate(){}});
 const controller=new AbortController();
 const pending=gate.read('/code/search',{signal:controller.signal},async()=>{const e=Error('changed');e.status=409;throw e;});
 for(let i=0;i<5;i++)await Promise.resolve();
 controller.abort();await assert.rejects(pending,{name:'AbortError'});
 held.resolve({corpusRevision:A,cacheContract:1});await gate.probe();
 assert.equal(gate.revision,A,'cancelled consumer does not cancel shared background verification');
}

// Initial unpinned response can join the first verified epoch without a repeat.
for (const change of ['same-startup','real-change','reconnect','offline-no-header']) {
 const pendingResponse=deferred();let latest=A,count=0;
 const gate=createPublicCodeRevisionController({fetchRevision:async()=>({corpusRevision:latest,cacheContract:1}),onInvalidate(){}});
 const pending=gate.read('/code/chapters',{},async(_path,accept)=>{
   count++;
   if(count===1){await pendingResponse.promise;if(change!=='offline-no-header')accept(header(A));return 'first';}
   accept(header(latest));return 'fresh';
 });
 await gate.probe();
 if(change==='real-change'){latest=B;await gate.probe({force:true});}
 if(change==='reconnect'||change==='offline-no-header')await gate.probe({force:true,reconnect:true});
 pendingResponse.resolve();
 assert.equal(await pending,change==='same-startup'?'first':'fresh',change);
 assert.equal(count,change==='same-startup'?1:2,change);
}
console.log('Startup revision adoption passed: same-digest first response is reused; real changes, reconnect and unverified offline completions remain rejected.');
