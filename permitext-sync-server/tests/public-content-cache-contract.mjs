import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createPublicContentCache, estimatePublicContentBytes} from '../public/public-content-cache.js';
import {cacheRetryablePromise} from '../public/client-reliability.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
const small = {blocks:[{plainText:'An enacted passage.',text:'An enacted passage.'}]};
const bytes = estimatePublicContentBytes(small);
const cache = createPublicContentCache({maxBytes:bytes*2,maxEntries:2});
let reads=0;
const read = key => cacheRetryablePromise(cache,key,async()=>{reads++;return small;});
await read('a'); await read('b'); await read('a'); await read('c');
assert.equal(reads,3);
assert.equal(cache.has('a'),true,'Reading a recent chapter keeps it resident.');
assert.equal(cache.has('b'),false,'The least recently read chapter is evicted.');
assert.equal(cache.retainedCount,2); assert.ok(cache.retainedBytes<=bytes*2);
await read('b'); assert.equal(reads,4,'An evicted chapter can be loaded again.');
for(let index=0;index<300;index++) await read(`chapter-${index}`);
assert.equal(cache.retainedCount,2,'Browsing many chapters cannot grow retained cache entries.');
assert.ok(cache.retainedBytes<=bytes*2);
const hotKeys = [...cache.keys()];
const oversized = {blocks:[{plainText:'Complete source text. '.repeat(1000)}]};
assert.equal(await cacheRetryablePromise(cache,'large',async()=>oversized),oversized);
assert.equal(cache.has('large'),false,'Oversized text remains usable without being retained.');
assert.deepEqual([...cache.keys()],hotKeys,'A too-large chapter does not flush unrelated recent chapters.');

// Keep concurrent consumers joined; cancellation is owned by the actual request helper.
{
  const bounded=createPublicContentCache({maxEntries:1,maxBytes:10000}), flight=deferred();
  let calls=0, signal;
  const loader=s=>{calls++;signal=s;return flight.promise;};
  const one=new AbortController(),two=new AbortController();
  const first=cacheRetryablePromise(bounded,'shared',loader,{signal:one.signal});
  const second=cacheRetryablePromise(bounded,'shared',loader,{signal:two.signal});
  await tick(); assert.equal(calls,1); assert.equal(bounded.pendingCount,1);
  const aborted=assert.rejects(first,{name:'AbortError'});one.abort();await aborted;
  assert.equal(signal.aborted,false,'One cancelled Reader cannot abort another Reader.');
  flight.resolve(small);assert.equal(await second,small);await tick();
  assert.equal(bounded.pendingCount,0);assert.equal(bounded.retainedCount,1);
  const pending=deferred(),controller=new AbortController();
  const last=cacheRetryablePromise(bounded,'cancelled',s=>{signal=s;return pending.promise;},{signal:controller.signal});
  await tick();const cancelled=assert.rejects(last,{name:'AbortError'});controller.abort();await cancelled;
  assert.equal(signal.aborted,true);assert.equal(bounded.has('cancelled'),false);
  pending.resolve(small);await tick();assert.equal(bounded.has('cancelled'),false);
}

// Revision invalidation and rejected obsolete requests cannot replace/delete a new value.
{
  const bounded=createPublicContentCache(),old=deferred();
  const obsolete=cacheRetryablePromise(bounded,'same-key',()=>old.promise);await tick();
  bounded.clear();
  const current={blocks:[{plainText:'Current edition text.'}]};
  assert.equal(await cacheRetryablePromise(bounded,'same-key',async()=>current),current);
  old.resolve(small);assert.equal(await obsolete,small);await tick();
  assert.equal(await bounded.get('same-key'),current);
  const failed=deferred();const stale=cacheRetryablePromise(bounded,'rejected',()=>failed.promise);await tick();
  bounded.delete('rejected');await cacheRetryablePromise(bounded,'rejected',async()=>current);
  const rejected=assert.rejects(stale,/synthetic/);failed.reject(Error('synthetic'));await rejected;
  assert.equal(await bounded.get('rejected'),current);
  await assert.rejects(cacheRetryablePromise(bounded,'retry',async()=>{throw Error('offline');}),/offline/);
  assert.equal(await cacheRetryablePromise(bounded,'retry',async()=>current),current);
  bounded.clear();assert.equal(bounded.size,0);assert.equal(bounded.retainedBytes,0);
}

// Exercise shipped chapter loaders: eviction preserves exact bodies, revision and edition checks.
{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const actual=name=>{const begin=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(begin>=0);return source.slice(begin,source.indexOf('\n}',begin)+2);};
  const chapter={id:'ch',codeVersion:'2022',codePrefix:'BC',bodyContract:2,corpusRevision:'a'.repeat(64),sections:[{id:'one'},{id:'two'}]};
  const body={...chapter,sections:[{id:'one',blocks:[{plainText:'Every original word, punctuation mark and citation.'}]}],bodyRange:{start:0,end:1,total:2,complete:false}};
  const bounded=createPublicContentCache({maxEntries:1,maxBytes:10000});let calls=0;
  const c=vm.createContext({chapterCache:bounded,cacheRetryablePromise,URLSearchParams,DOMException,readerProgressiveSectionBatchSize:5,
    api:async(path)=>{calls++;return {chapter:path.includes('bodyStart')?body:chapter};}});
  vm.runInContext(['fetchChapter','validateChapterBodyWindow','fetchChapterBodyWindow'].map(actual).join('\n'),c);
  const manifest=await c.fetchChapter('ch');
  const first=await c.fetchChapterBodyWindow('ch',0,1,manifest);
  assert.equal(first,body);assert.equal(await c.fetchChapterBodyWindow('ch',0,1,manifest),body);assert.equal(calls,2);
  await c.fetchChapter('another');
  assert.equal(await c.fetchChapterBodyWindow('ch',0,1,manifest),body);assert.equal(calls,4);
  assert.equal(first.sections[0].blocks[0].plainText,body.sections[0].blocks[0].plainText);
  await assert.rejects(c.fetchChapterBodyWindow('ch',0,1,{...manifest,corpusRevision:'b'.repeat(64)}),{code:'CHAPTER_WINDOW_MISMATCH'});
  assert.equal(bounded.size,0,'A revision mismatch clears the rejected chapter representation.');
}
console.log('Public content cache passed: bounded retained text/entries, recent reuse, oversized sources, shared cancellation, retries, revision races and exact chapter-body parity.');
