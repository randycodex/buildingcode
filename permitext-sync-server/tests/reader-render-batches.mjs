import assert from 'node:assert/strict';
import {renderReaderBlockBatches} from '../public/reader-render-batches.js';
const blocks=Array.from({length:1322},(_,id)=>({id,text:`Complete passage ${id}`}));
let clock=0,rendered=[],batches=[],size=0;
await renderReaderBlockBatches(blocks,block=>{rendered.push(block);size++;clock+=3;},()=>true,{
  now:()=>clock,yieldTask:async()=>{batches.push(size);size=0;}
});
assert.deepEqual(rendered,blocks,'All text and passage identities retain their source order');
assert.ok(batches.every(n=>n<=3),'Rendering yields within the time budget');
let live=true;rendered=[];
await assert.rejects(renderReaderBlockBatches(blocks,block=>rendered.push(block),()=>live,{
  now:()=>0,yieldTask:async()=>{live=false;}
}),{name:'AbortError'});
assert.equal(rendered.length,24,'Closed or superseded Reader stops after its current batch');
rendered=[];await renderReaderBlockBatches(blocks.slice(0,2),block=>rendered.push(block),()=>true);
assert.equal(rendered.length,2,'Short passages remain immediate');
console.log('Large Reader construction yields, preserves all passages, and stops stale work.');
