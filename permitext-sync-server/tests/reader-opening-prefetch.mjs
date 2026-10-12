import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function prefetchReaderSourceWindow('),end=source.indexOf('\n}',start);
for(const version of ['edition','different-edition']){
 const calls=[];
 const chapter={id:'2',codePrefix:'BC',codeVersion:version,sections:Array.from({length:19},(_,id)=>({id}))};
 const c=vm.createContext({readerInitialSectionWindowSize:5,fetchChapter:async()=>chapter,
  readerTargetSectionIndex:sections=>sections.findIndex(x=>x.id===6),
  fetchChapterBodyWindow:async(...args)=>calls.push(args)
 });vm.runInContext(source.slice(start,end+2),c);
 await c.prefetchReaderSourceWindow({chapterID:'2',codePrefix:'BC',codeVersion:'edition',sectionID:6});
 if(version==='edition'){assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(0,3),['2',4,5]);}
 else assert.equal(calls.length,0,'Speculative text must match the exact code edition');
}
console.log('Reader prefetch uses validated source identity and bounded manifest offsets without publishing text.');
