import assert from 'node:assert/strict';
import { cacheRetryablePromise } from '../public/client-reliability.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
{
 const cache=new Map(),held=deferred(),a=new AbortController(),b=new AbortController();let starts=0,network;
 const load=signal=>{starts++;network=signal;return held.promise;};
 const first=cacheRetryablePromise(cache,'A',load,{signal:a.signal});
 const second=cacheRetryablePromise(cache,'A',load,{signal:b.signal});await tick();
 a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(network.aborted,false);assert.equal(starts,1);
 held.resolve('body');assert.equal(await second,'body');b.abort();assert.equal(network.aborted,false);
 assert.equal(await cacheRetryablePromise(cache,'A',()=>{throw Error('cached');}),'body');
}
{
 const cache=new Map(),held=deferred(),a=new AbortController();let network;
 const first=cacheRetryablePromise(cache,'A',signal=>{network=signal;return held.promise;},{signal:a.signal});
 const pinned=cacheRetryablePromise(cache,'A',()=>{throw Error('duplicate');});await tick();a.abort();
 await assert.rejects(first,{name:'AbortError'});assert.equal(network.aborted,false);held.resolve('pinned');assert.equal(await pinned,'pinned');
}
{
 const cache=new Map(),held=deferred(),a=new AbortController(),b=new AbortController();let network;
 const first=cacheRetryablePromise(cache,'A',signal=>{network=signal;return held.promise;},{signal:a.signal});
 const second=cacheRetryablePromise(cache,'A',()=>{throw Error('duplicate');},{signal:b.signal});await tick();
 a.abort();b.abort();await Promise.all([assert.rejects(first,{name:'AbortError'}),assert.rejects(second,{name:'AbortError'})]);
 assert.equal(network.aborted,true);assert.equal(cache.has('A'),false);
 const replacement=cacheRetryablePromise(cache,'A',()=> 'fresh');assert.equal(await replacement,'fresh');
 held.reject(Error('late aborted failure'));await tick();assert.equal(await cache.get('A'),'fresh');
}
{
 const cache=new Map(),a=new AbortController();let starts=0;
 const request=cacheRetryablePromise(cache,'A',()=>{starts++;return 'late';},{signal:a.signal});a.abort();
 await assert.rejects(request,{name:'AbortError'});await tick();assert.equal(starts,0);assert.equal(cache.has('A'),false);
 await assert.rejects(cacheRetryablePromise(cache,'A',()=>{starts++;},{signal:a.signal}),{name:'AbortError'});assert.equal(starts,0);
}
{
 const cache=new Map();await assert.rejects(cacheRetryablePromise(cache,'A',()=>{throw Error('network');}),/network/);
 assert.equal(cache.has('A'),false);assert.equal(await cacheRetryablePromise(cache,'A',()=> 'retry'),'retry');
 const aborted=new AbortController();aborted.abort();await assert.rejects(cacheRetryablePromise(cache,'A',()=>{}, {signal:aborted.signal}),{name:'AbortError'});
 assert.equal(await cache.get('A'),'retry');
}
console.log('Shared chapter cancellation passed: one flight, independent leases, unsignaled pin, last-consumer abort, cached reuse, abort-before-start and exact replacement eviction.');
