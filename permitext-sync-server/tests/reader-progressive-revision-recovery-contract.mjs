import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function progressivelyRenderReaderChapter('),end=source.indexOf('\n}',start)+2;
const actual=source.slice(start,end);
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
for(const mode of ['current','new-navigation','closed']){
 let fail,recoveries=0,errors=0;const recovery=new Promise((_,reject)=>{fail=reject;});
 const panel={isConnected:true,dataset:{readerRenderToken:'initial',paneId:'reader'}};
 const content={clientHeight:500,scrollHeight:500,scrollTop:0,append(){},addEventListener(){},removeEventListener(){}};
 const status={dataset:{},setAttribute(){},remove(){},isConnected:true};
 const context=vm.createContext({AbortController,Map,performance:{now:()=>1000},document:{createElement:()=>status},
 window:{setTimeout,clearTimeout},requestAnimationFrame:()=>1,cancelAnimationFrame(){},console:{warn(){}},
 readerProgressiveSectionBatchSize:5,fetchChapterBodyWindow:async()=>{const error=Error('changed');error.code='CHAPTER_WINDOW_MISMATCH';throw error;},
 captureReaderScrollPositions:()=>new Map([['reader',{sectionID:'s5',offset:20}]]),
 renderSectionContent(p,_r,options){recoveries++;assert.equal(options.corpusRecoveryAttempt,true);assert.equal(options.scrollPosition.sectionID,'s5');p.dataset.readerRenderToken='recovery';return recovery;},
 emptyReader(){errors++;},
 });
 vm.runInContext(actual,context);
 await context.progressivelyRenderReaderChapter(panel,{},content,Array.from({length:10},(_,id)=>({id})),{},0,5,'initial',{});
 await tick();assert.equal(recoveries,1);
 if(mode==='new-navigation')panel.dataset.readerRenderToken='newer';
 if(mode==='closed')panel.isConnected=false;
 fail(Error('refresh failed'));await tick();assert.equal(errors,mode==='current'?1:0);
}
console.log('Progressive revision recovery passed: restores captured anchor once and suppresses recovery errors after newer navigation or closure.');
