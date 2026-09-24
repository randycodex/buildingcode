import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runPublicCodeTiming,timePublicCodePhase,countPublicCodeEvent} from '../public-code-timing.mjs';
class Response extends EventEmitter {constructor(){super();this.headers={};this.statusCode=200;}setHeader(k,v){this.headers[k]=v;}writeHead(...args){this.args=args;this.statusCode=args[0];return this;}finish(){this.emit('finish');}}
const prior=process.env.PERMITEXT_PUBLIC_PERFORMANCE;const log=console.log;const logs=[],traces=[];console.log=value=>{const parsed=JSON.parse(value);(parsed.event==='permitext.public-code-phase'?traces:logs).push(parsed);};
try{
 delete process.env.PERMITEXT_PUBLIC_PERFORMANCE;
 const disabled=new Response();assert.equal(runPublicCodeTiming({method:'GET',url:'/code/search?q=secret'},disabled,()=>23),23);disabled.writeHead(200).finish();assert.deepEqual(disabled.headers,{});assert.equal(logs.length,0);
 process.env.PERMITEXT_PUBLIC_PERFORMANCE='1';
 for(const [method,url] of [['POST','/code/search'],['GET','/account'],['GET','/projects/foundation/state'],['GET','/code/assets/private.png'],['GET','/code/search/extra']]){const r=new Response();runPublicCodeTiming({method,url},r,()=>r.writeHead(403).finish());assert.deepEqual(r.headers,{});}assert.equal(logs.length,0);
 let release;const barrier=new Promise(r=>release=r);const a=new Response(),b=new Response();
 const first=runPublicCodeTiming({method:'GET',url:'/code/search?q=SECRET_QUERY&account=PRIVATE'},a,async()=>{await timePublicCodePhase('candidate_match',()=>barrier);countPublicCodeEvent('cache_miss');a.writeHead(200,{'custom':'a'}).finish();});
 runPublicCodeTiming({method:'GET',url:'/code/chapters/123?token=PRIVATE'},b,()=>{assert.equal(timePublicCodePhase('catalog_load',()=>42),42);countPublicCodeEvent('cache_hit',9e9);countPublicCodeEvent('SECRET_QUERY');countPublicCodeEvent('cache_miss',-1);timePublicCodePhase('SECRET_QUERY',()=>true);b.writeHead(304,'Not Modified',{'custom':'b'}).finish();});
 release();await first;assert.notEqual(a.headers['x-permitext-code-request-id'],b.headers['x-permitext-code-request-id']);assert.match(a.headers['Server-Timing'],/candidate_match;dur=/);assert.doesNotMatch(a.headers['Server-Timing'],/catalog_load/);assert.match(b.headers['Server-Timing'],/catalog_load;dur=/);assert.doesNotMatch(b.headers['Server-Timing'],/candidate_match/);assert.equal(b.args[0],304);assert.equal(b.args[1],'Not Modified');assert.equal(b.args[2].custom,'b');assert.match(b.args[2]['Server-Timing'],/catalog_load/);assert.equal(logs[0].counters.cache_hit,1_000_000);assert.equal(logs[1].counters.cache_miss,1);assert.equal(logs[0].route,'chapters_detail');assert.doesNotMatch(JSON.stringify(logs),/SECRET_QUERY|PRIVATE|123|token=/);
 const error=new Error('PRIVATE ERROR');const c=new Response();await runPublicCodeTiming({method:'GET',url:'/code/sections/1'},c,async()=>{assert.throws(()=>timePublicCodePhase('content_read',()=>{throw error;}),e=>e===error);await assert.rejects(timePublicCodePhase('index_load',async()=>{throw error;}),e=>e===error);c.writeHead(500).finish();});assert.equal(logs[2].errorStatus,true);assert.ok('content_read'in logs[2].phases&&'index_load'in logs[2].phases);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE ERROR/);
 const traceCount=traces.length;const bounded=new Response();
 runPublicCodeTiming({method:'GET',url:'/code/chapters/33?secret=hidden'},bounded,()=>{
  timePublicCodePhase('chapter_assembly',()=>{assert.equal(traces.at(-1).stage,'start');assert.equal(traces.at(-1).phase,'chapter_assembly');for(let index=0;index<1029;index++)timePublicCodePhase('content_read',()=>index);});
  bounded.writeHead(200).finish();
 });
 assert.equal(traces.length-traceCount,64);assert.equal(logs.at(-1).traceEventsDropped,1996);
 assert.ok(traces.slice(traceCount).every(event=>event.requestID===bounded.headers['x-permitext-code-request-id']&&event.route==='chapters_detail'));
 assert.doesNotMatch(JSON.stringify(traces),/hidden|SECRET_QUERY|PRIVATE ERROR|token=/);
 assert.ok(traces.some(event=>event.stage==='complete'&&typeof event.duration==='number'));
 const headers=new Response();const supplied={'Server-Timing':'prior;dur=1','Content-Type':'application/json'};
 runPublicCodeTiming({method:'GET',url:'/code/revision'},headers,()=>headers.writeHead(200,supplied).finish());
 assert.match(headers.args[1]['Server-Timing'],/^prior;dur=1, total;dur=/);assert.equal(supplied['Server-Timing'],'prior;dur=1');assert.equal(headers.args[1]['Content-Type'],'application/json');
 const raw=new Response();runPublicCodeTiming({method:'GET',url:'/code/libraries'},raw,()=>raw.writeHead(200,['Server-Timing','existing;dur=2','Custom','keep']).finish());assert.deepEqual(raw.args[1].slice(0,2),['Custom','keep']);assert.match(raw.args[1][3],/^existing;dur=2, total;dur=/);
 assert.equal(timePublicCodePhase('ranking',()=>7),7);
}finally{console.log=log;if(prior===undefined)delete process.env.PERMITEXT_PUBLIC_PERFORMANCE;else process.env.PERMITEXT_PUBLIC_PERFORMANCE=prior;}
console.log('Public timing passed: opt-in allowlist, concurrency isolation, sync/async error preservation, bounded labels/counters and redacted logs.');
