import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const directory=await mkdtemp(join(tmpdir(),'research-comparison-budget-'));
const native=globalThis.fetch;let calls=0,received;
try {
 process.env.PERMITEXT_COMPARISON_DIRECTORY=directory;process.env.PERMITEXT_COMPARISON_WRITER='gpt-6-luna';
 await writeFile(join(directory,'ledger.json'),JSON.stringify({capUSD:1,requests:[]}));
 globalThis.fetch=async(url,init)=>{calls++;received=JSON.parse(init.body);return new Response(JSON.stringify({id:'test',status:'completed',usage:{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:100}}}),{headers:{'content-type':'application/json'}})};
 await import('../scripts/research-model-comparison-preload.mjs');
 const request=()=>fetch('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify({model:'gpt-5.6-terra',text:{format:{name:'permitext_code_interpretation'}},input:'Evidence',max_output_tokens:3000,reasoning:{effort:'low'}})});
 await request();assert.equal(received.model,'gpt-6-luna');assert.equal(received.reasoning.effort,'max');assert.equal(received.max_output_tokens,24000);
 let ledger=JSON.parse(await readFile(join(directory,'ledger.json')));assert.equal(ledger.requests[0].status,'settled');assert(ledger.requests[0].costUSD>ledger.requests[0].standardTokenCostUSD);
 ledger.capUSD=ledger.requests[0].costUSD+.000001;await writeFile(join(directory,'ledger.json'),JSON.stringify(ledger));
 await assert.rejects(request(),/spending cap/);assert.equal(calls,1,'Cap rejects before provider dispatch.');
 await assert.rejects(fetch('https://example.com'),/blocked external/);assert.equal(calls,1);
 ledger.capUSD=1;ledger.requests[0].status='pending';await writeFile(join(directory,'ledger.json'),JSON.stringify(ledger));
 await assert.rejects(request(),/Unsettled/);assert.equal(calls,1);
 await writeFile(join(directory,'ledger.json'),JSON.stringify({capUSD:1,requests:[]}));
 process.env.PERMITEXT_COMPARISON_VERIFIER='gpt-5.6-luna';
 await fetch('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify({model:'gpt-5.6-terra',text:{format:{name:'permitext_research_verification'}},input:'Evidence',max_output_tokens:1000,reasoning:{effort:'low'}})});
 assert.equal(received.model,'gpt-5.6-luna');
 ledger=JSON.parse(await readFile(join(directory,'ledger.json')));
 assert(Math.abs(ledger.requests[0].actualTokenCostUSD-.000302)<1e-9,'Existing Luna verifier uses its own token rates.');
 console.log('Comparison budget passed: model/effort override, durable accounting, cap before dispatch, unknown-outcome stop, external network allowlist; no paid calls.');
}finally{globalThis.fetch=native;await rm(directory,{recursive:true,force:true});}
