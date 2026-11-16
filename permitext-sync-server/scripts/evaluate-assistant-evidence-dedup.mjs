// Replay synthetic, fixed-evidence requests. No retrieval, account data or
// production writes. Real calls are opt-in and share the original $7 ledger.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {assistantRequestInput} from '../assistant-engine.mjs';
import {createResearchV2Budget} from '../research-v2-budget.mjs';
import {profileCallCost} from './assistant-profile-metrics.mjs';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const root=resolve(option('--trace-root','/tmp/assistant-simplified-regression-verified-20261116'));
const out=resolve(option('--out','/tmp/assistant-evidence-dedup-20261116'));
const traces=JSON.parse(await readFile(join(root,'provider-traces.json'),'utf8'));
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bytes=v=>Buffer.byteLength(JSON.stringify(v));
const cases=[];
for(const trace of traces){
 const before=trace.request;if(!Array.isArray(before.input))continue;
 const context=JSON.parse(before.input[0].content);if(!context.readEvidence?.length)continue;
 const after={...before,input:assistantRequestInput(before.input,new Map(context.readEvidence.map(s=>[s.id,s])))};
 const packed=JSON.parse(after.input[0].content);
 const expanded={...packed,attachedPassages:packed.attachedPassages.map(source=>{
  const original=packed.readEvidence.find(s=>s.id===source.id);
  const result={...source};for(const key of ['text','tables'])if(!Object.hasOwn(result,key)&&Object.hasOwn(original||{},key))result[key]=original[key];
  return result;
 })};
 assert.deepEqual(expanded,context,'Exact source content, identities, project context and source candidates must be recoverable');
 assert.deepEqual(after.input.slice(1),before.input.slice(1),'Conversation and tool history must stay byte-for-byte identical');
 assert.deepEqual({...after,input:undefined},{...before,input:undefined},'Model, instructions, tools and settings must stay identical');
 if(bytes(after)>=bytes(before))continue;
 cases.push({question:context.question,before,after,beforeBytes:bytes(before),afterBytes:bytes(after),contextHash:digest(context),historyHash:digest(before.input.slice(1))});
}
assert(cases.length,'No duplicated-evidence requests in the supplied synthetic trace');
const replay={requests:cases.length,beforeBytes:cases.reduce((n,c)=>n+c.beforeBytes,0),afterBytes:cases.reduce((n,c)=>n+c.afterBytes,0),
 checks:'Every original source body/table and metadata record can be reconstructed exactly. History, project context, prompts, tools and settings unchanged.'};
const unique=[...new Map(cases.map(c=>[c.question,c])).values()];
const selected=unique.filter(c=>['What if we\'re sprinklered throughout?',"No, it's more than halfway above curb level.",'Where can I see the table you used?',"But this is a residential building. Doesn't that make a difference?"].includes(c.question));
assert.equal(selected.length,4);
await mkdir(out,{recursive:true});
const answerOnly=args.includes('--answer-only');
if(answerOnly)for(const test of selected)for(const variant of ['before','after'])test[variant]={...test[variant],tools:[]};
const report={scope:answerOnly?'Controlled same-evidence answer-generation comparison with tools disabled identically for both variants; not end-to-end latency or a legal-accuracy revalidation.':'Same-evidence model-turn comparison; excludes retrieval and application persistence. Synthetic historical requests, not a legal-accuracy revalidation.',
 model:selected[0].before.model,replay,cases:selected.map(({question,beforeBytes,afterBytes,contextHash,historyHash})=>({question,beforeBytes,afterBytes,contextHash,historyHash})),runs:[]};
await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({replay,cases:report.cases}));
if(!args.includes('--real'))process.exit(0);
const ledgerPath=await realpath(option('--ledger','/tmp/per-codes-natural-assistant-budget-20261115.json'));
const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));assert.equal(ledger.limitMicroUSD,7000000,'Use the existing $7 ledger');
assert(ledger.calls.length>0,'Never create or reset the test ledger');
assert(process.env.OPENAI_API_KEY,'Load the existing local test API key without writing it to the report');
const budget=createResearchV2Budget({path:ledgerPath});report.budgetBefore=await budget.summary();
const repeats=Number(option('--repeats','2'));assert(Number.isSafeInteger(repeats)&&repeats>=1&&repeats<=2);
try{
 for(let repeat=0;repeat<repeats;repeat++)for(const test of selected){
  // Reverse order on repeat to reduce ordering/cache bias; no parallel calls.
  for(const variant of repeat%2?['after','before']:['before','after']){
   const body=test[variant],reservation=await budget.reserveExperimental(body,'evidence-dedup-comparison');
   let payload;const start=performance.now();
   try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
    payload=await response.json();if(!response.ok)throw new Error(`Provider returned ${response.status}: ${payload.error?.code||'request_failed'}`);
    const text=(payload.output||[]).flatMap(i=>i.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');
    const context=JSON.parse(body.input[0].content),ids=new Set([...context.attachedPassages,...context.readEvidence].map(s=>s.id));
    const markers=[...text.matchAll(/\[([SW]\d+)\]/g)].map(m=>m[1]);
    const toolCalls=(payload.output||[]).filter(i=>i.type==='function_call').map(i=>i.name);
    const row={question:test.question,repeat,variant,milliseconds:performance.now()-start,requestBytes:bytes(body),usage:payload.usage,
     estimatedUSD:profileCallCost(payload),status:payload.status,toolCalls,text,
     checks:{completeAnswer:payload.status==='completed'&&Boolean(text)&&!toolCalls.length,citationIDs:markers.length>0&&markers.every(id=>ids.has(id))}};
    report.runs.push(row);console.log(JSON.stringify({...row,text:undefined,usage:undefined}));
   }catch(error){report.runs.push({question:test.question,repeat,variant,milliseconds:performance.now()-start,error:error.message});throw error;}
   finally{await budget.settle(reservation,payload);await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));}
  }
 }
}finally{
 report.budgetAfter=await budget.summary();
 const median=values=>{const sorted=values.sort((a,b)=>a-b);return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;};
 report.summary=Object.fromEntries(['before','after'].map(variant=>{const rows=report.runs.filter(r=>r.variant===variant&&!r.error);return [variant,{calls:rows.length,
  medianMilliseconds:median(rows.map(r=>r.milliseconds)),totalMilliseconds:rows.reduce((n,r)=>n+r.milliseconds,0),
  inputTokens:rows.reduce((n,r)=>n+(r.usage?.input_tokens||0),0),outputTokens:rows.reduce((n,r)=>n+(r.usage?.output_tokens||0),0),
  cachedTokens:rows.reduce((n,r)=>n+(r.usage?.input_tokens_details?.cached_tokens||0),0),cacheWriteTokens:rows.reduce((n,r)=>n+(r.usage?.input_tokens_details?.cache_write_tokens||0),0),
  estimatedUSD:rows.reduce((n,r)=>n+(r.estimatedUSD||0),0),checksPassed:rows.every(r=>r.checks.completeAnswer&&r.checks.citationIDs)}];}));
 await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({summary:report.summary,budget:report.budgetAfter}));
}
