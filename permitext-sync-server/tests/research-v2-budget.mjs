import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResearchV2Budget,createLunaV2Client,lunaUsageMicroUSD} from '../research-v2-budget.mjs';
const scratch=await mkdtemp(join(tmpdir(),'research-v2-budget-'));
const body={model:'gpt-6-luna',service_tier:'default',store:false,max_output_tokens:6144,input:'test'};
try{
  assert.throws(()=>createResearchV2Budget({path:join(scratch,'x'),limitUSD:7.01}),/exceed/);
  const path=join(scratch,'budget.json'),budget=createResearchV2Budget({path,limitUSD:.02});
  const attempts=await Promise.allSettled(Array.from({length:4},()=>budget.reserve(body,'draft')));
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2,'Concurrent reservations cannot oversubscribe the ledger');
  const ids=attempts.filter(r=>r.status==='fulfilled').map(r=>r.value);
  await budget.settle(ids[0],{usage:{input_tokens:1000,output_tokens:1000,input_tokens_details:{cached_tokens:500}}});
  await budget.settle(ids[1],null);
  const summary=await budget.summary();assert.equal(summary.uncertainOrReservedCalls,1);
  assert.equal(lunaUsageMicroUSD({usage:{input_tokens:1000,output_tokens:1000,input_tokens_details:{cached_tokens:500}}}),555);
  assert.deepEqual(await createResearchV2Budget({path,limitUSD:.02}).summary(),summary,'Restart cannot reset spending');
  const uncertain=createResearchV2Budget({path:join(scratch,'uncertain.json'),limitUSD:.02});
  const call=createLunaV2Client({apiKey:'offline',budget:uncertain,transport:async()=>{throw new Error('network interrupted');}});
  await assert.rejects(call(body,{phase:'draft'}),/interrupted/);
  assert((await uncertain.summary()).accountedUSD>0,'Ambiguous failure retains its full reservation');
  await assert.rejects(uncertain.reserve({...body,model:'gpt-6-sol'},'draft'),/approved Luna/);
  await assert.rejects(uncertain.reserve({...body,tools:[{type:'web_search'}]},'draft'),/approved Luna/);
  console.log('Research v2 budget: $7 ceiling, atomic concurrent reservations, restart durability, token settlement, ambiguous failure accounting and Luna-only request limits passed.');
}finally{await rm(scratch,{recursive:true,force:true});}
