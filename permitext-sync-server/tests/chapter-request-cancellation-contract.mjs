import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cacheRetryablePromise } from '../public/client-reliability.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2);}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const calls=[];
const context=vm.createContext({URLSearchParams,AbortController,DOMException,cacheRetryablePromise,chapterCache:new Map(),chapterListCache:new Map(),readerProgressiveSectionBatchSize:5,
 syncCodeVersion:v=>v,syncCodeVersionForPrefix:()=> '2022',
 api(path,{signal}){return new Promise((resolve,reject)=>{const call={path,signal,resolve};calls.push(call);signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});},
 crypto:{randomUUID:()=>Math.random().toString()},cancelReaderInternalSearch(){},stopReaderProgressiveHydration(){},clear(){},emptyReader(){},
});
vm.runInContext(['fetchChapterList','fetchChapter','validateChapterBodyWindow','fetchChapterBodyWindow','beginReaderNavigation'].map(actual).join('\n'),context);
for(const [name,request,payload] of [
 ['catalog',signal=>context.fetchChapterList('BC','2022',{signal}),{chapters:[{id:'A'}]}],
 ['summary',signal=>context.fetchChapter('A',{signal}),{chapter:{id:'A'}}],
 ['window',signal=>context.fetchChapterBodyWindow('B',0,5,null,{signal}),{chapter:{id:'B',sections:[]}}],
]){
 const before=calls.length,a=new AbortController(),b=new AbortController();
 const first=request(a.signal),peer=request(b.signal);await tick();assert.equal(calls.length,before+1,`${name}: shared request`);
 const network=calls.at(-1);a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(network.signal.aborted,false);
 network.resolve(payload);await peer;const count=calls.length;await request(new AbortController().signal);assert.equal(calls.length,count,`${name}: completed cache reused`);
}
// Navigating away releases only this Reader's lease; another pane remains attached.
const panel={dataset:{},querySelector:()=>({classList:{remove(){}}})};
context.beginReaderNavigation(panel);const oldSignal=panel._readerNavigationAbort.signal;
const first=context.fetchChapter('navigation',{signal:oldSignal});const peer=context.fetchChapter('navigation');await tick();
const request=calls.at(-1);context.beginReaderNavigation(panel);await assert.rejects(first,{name:'AbortError'});
assert.equal(request.signal.aborted,false);assert.notEqual(panel._readerNavigationAbort.signal,oldSignal);
request.resolve({chapter:{id:'navigation'}});await peer;
const lone=context.fetchChapter('lone',{signal:panel._readerNavigationAbort.signal});await tick();const loneRequest=calls.at(-1);
context.beginReaderNavigation(panel);await assert.rejects(lone,{name:'AbortError'});assert.equal(loneRequest.signal.aborted,true);
// Full-body compatibility shortcut must join the existing shared lease too.
const fullController=new AbortController();const full=context.fetchChapter('full',{includeBody:true,signal:fullController.signal});await tick();
const summary=context.fetchChapter('full');const fullRequest=calls.at(-1);fullController.abort();await assert.rejects(full,{name:'AbortError'});
assert.equal(fullRequest.signal.aborted,false);fullRequest.resolve({chapter:{id:'full',blocks:[]}});await summary;
assert.match(actual('populateReaderSelectors'),/fetchChapterList\(reader.codePrefix, reader.codeVersion, \{ signal: panel\._readerNavigationAbort\?\.signal \}\)/);
assert.match(actual('renderSectionContent'),/fetchChapterBodyWindow\([\s\S]*signal: panel\._readerNavigationAbort\?\.signal/);
assert.match(actual('progressivelyRenderReaderChapter'),/requestController\.abort\(\)/);
assert.match(actual('renderReader'),/finally\s*\{\s*options\.signal\?\.removeEventListener\("abort", cancelConstruction\)/);
assert.match(actual('workspacePaneDescriptors'),/\(signal\) => renderReader\(reader,[^\n]*signal/);
console.log('Chapter request cancellation passed: actual catalog/summary/window leases, navigation abort, shared unsignaled ownership, full-body shortcut and completed-cache reuse.');
