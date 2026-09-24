import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createPublicCodeRevisionController,isPublicCodePath} from '../public/public-code-revision.js';
import {cacheRetryablePromise} from '../public/client-reliability.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const a=source.search(new RegExp(`(?:async )?function ${name}\\(`));return source.slice(a,source.indexOf('\n}',a)+2);}
const A='a'.repeat(64),B='b'.repeat(64);let revision=A,offline=false,chapterRequests=0,revisionRequests=0;
const context=vm.createContext({AbortController,setTimeout,clearTimeout,createPublicCodeRevisionController,isPublicCodePath,cacheRetryablePromise,URLSearchParams,
 chapterCache:new Map(),chapterListCache:new Map(),sectionSummaryCache:new Map(),serverReachable:true,
 updateConnectionStatus(){},hasCapability:()=>true,shouldUseOfflineFallback:status=>status>=500,
 offlineAPI:async()=>({chapter:{id:'A',offline:true}}),
 fetch:async path=>{
   if(offline)throw Error('offline');
   if(path==='/code/revision'){revisionRequests++;return{ok:true,json:async()=>({corpusRevision:revision,cacheContract:1})};}
   chapterRequests++;const expected=new URL(path,'http://test').searchParams.get('expectedPublicCorpusRevision');
   if(expected&&expected!==revision)return{ok:false,status:409};
   return{ok:true,headers:{get:()=>revision},json:async()=>({chapter:{id:'A',revision}})};
 }
});
const start=source.indexOf('const publicCodeRevision = createPublicCodeRevisionController(');
const end=source.indexOf('\n});',start)+4;
vm.runInContext(source.slice(start,end)+'\n'+['api','fetchChapter'].map(actual).join('\n')+'\nglobalThis.revisions=publicCodeRevision;',context);
await context.revisions.probe();
assert.equal((await context.fetchChapter('A')).revision,A);assert.equal(chapterRequests,1);
await context.fetchChapter('A');assert.equal(chapterRequests,1,'settled chapter opens have no network barrier');
assert.equal(revisionRequests,1);
context.chapterListCache.set('catalog',{});context.sectionSummaryCache.set('section',{});
revision=B;await context.revisions.probe({force:true});
assert.equal(context.chapterCache.size,0);assert.equal(context.chapterListCache.size,0);assert.equal(context.sectionSummaryCache.size,0);
assert.equal((await context.fetchChapter('A')).revision,B);assert.equal(chapterRequests,2);
revision=A;await context.revisions.probe({force:true});assert.equal((await context.fetchChapter('A')).revision,A);
offline=true;await context.revisions.probe({force:true});assert.equal(context.revisions.revision,A);assert.equal(context.chapterCache.size,1,'failed background check preserves warm content');
assert.equal((await context.fetchChapter('offline-chapter')).offline,true);
offline=false;await context.revisions.probe({force:true,reconnect:true});assert.equal(context.chapterCache.size,0,'reconnect discards cached offline fallback even unchanged digest');
assert.equal((await context.fetchChapter('offline-chapter')).revision,A);
console.log('Public client invalidation passed: actual api/chapter cache wiring, warm no-network reopen, all dependent cache eviction, rollback, failed probe preservation and offline reconnect.');
