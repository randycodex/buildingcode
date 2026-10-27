import assert from 'node:assert/strict';
import {researchV2Availability,researchV2Configuration,createResearchV2ApplicationCall} from '../research-v2-runtime.mjs';
const local={PERMITEXT_RESEARCH_V2:'1',NODE_ENV:'test',PERMITEXT_RESEARCH_V2_BUDGET_PATH:'/local/budget.json'};
assert.equal(researchV2Availability(local,'owner').available,true);
assert.equal(researchV2Availability({...local,PERMITEXT_RESEARCH_V2_USERS:'owner'},'other').available,false);
assert.equal(researchV2Availability({...local,PERMITEXT_RESEARCH_V2_USERS:'owner'},'owner').available,true);
assert.equal(researchV2Availability({...local,PERMITEXT_RESEARCH_V2_BUDGET_PATH:''},'owner').available,false,'Local calls cannot escape the original cap');
assert.equal(researchV2Availability({...local,PERMITEXT_RESEARCH_V2:'0'},'owner').available,false);
assert.equal(researchV2Availability(local,'owner').defaultEngine,'legacy');
export const production={NODE_ENV:'production',VERCEL:'1',PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_ROLLOUT:'allowlist',PERMITEXT_RESEARCH_V2_USERS:'owner',PERMITEXT_RESEARCH_V2_DEFAULT:'v2',
  PERMITEXT_SYNC_DATABASE_URL:'postgresql://test@127.0.0.1:55490/postgres',OPENAI_API_KEY:'offline-double',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD:'.25',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'1',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'10',PERMITEXT_RESEARCH_DAILY_CAP_USD:'10',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'100',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'luna-standard-20261027'};
assert.equal(researchV2Configuration(production).ready,true);
const fastPrices={PERMITEXT_RESEARCH_FAST_MODEL:' gpt-6-luna ',PERMITEXT_RESEARCH_FAST_PRICING_VERSION:'luna-standard',PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:'.5'};
assert.equal(researchV2Configuration({...production,...fastPrices}).ready,true);
assert.equal(researchV2Configuration({...production,...fastPrices,PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:'.01'}).ready,false,'Readiness uses the same trimmed model-specific pricing as accounting');
assert.equal(researchV2Configuration({...production,...fastPrices,PERMITEXT_RESEARCH_FAST_PRICING_VERSION:' ',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.01'}).ready,false,'Incomplete Fast pricing falls back to the actual base rates');

assert.deepEqual(researchV2Availability(production,'owner'),{available:true,defaultEngine:'v2',spending:'application',localOnly:false});
assert.equal(researchV2Configuration(production).evaluationBudgetPath,null);
assert.equal(researchV2Availability(production,'other').available,false);
assert.equal(researchV2Availability({...production,PERMITEXT_RESEARCH_V2_ROLLOUT:'all',PERMITEXT_RESEARCH_V2_USERS:''},'other').available,true);
for(const change of [{PERMITEXT_RESEARCH_V2:'0'},{PERMITEXT_RESEARCH_V2_USERS:''},{PERMITEXT_RESEARCH_V2_ROLLOUT:'typo'},{PERMITEXT_RESEARCH_V2_DEFAULT:'typo'},
  {PERMITEXT_RESEARCH_V2_BUDGET_PATH:'/tmp/budget.json'},{PERMITEXT_RESEARCH_EVAL_MAX_USD:'7'},{PERMITEXT_TEST_RESEARCH_MOCK:'1'},
  {OPENAI_API_KEY:''},{PERMITEXT_SYNC_DATABASE_URL:''},{PERMITEXT_SYNC_DATABASE_URL:'https://database.invalid'},
  {PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.01'},{PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:''},{PERMITEXT_RESEARCH_KILL_SWITCH:'1'}]){
  const result=researchV2Availability({...production,...change},'owner');assert.equal(result.available,false,JSON.stringify(change));assert.equal(result.defaultEngine,'legacy');
}
assert.equal(researchV2Configuration({}).enabled,false);
assert(!JSON.stringify(researchV2Availability(production,'owner')).includes('owner'));
let calls=0;
const call=createResearchV2ApplicationCall({provider:async()=>{calls++;return {status:'completed'};}});
const body={model:'gpt-6-luna',service_tier:'default',store:false,input:'test',max_output_tokens:100};
assert.equal((await call(body)).status,'completed');assert.equal(calls,1);
for(const change of [{model:'gpt-6-sol'},{service_tier:'priority'},{max_output_tokens:100000},{tools:[{type:'web_search'}]},{background:true}])await assert.rejects(call({...body,...change}));
assert.equal(calls,1);
const abort=new AbortController();abort.abort();await assert.rejects(call(body,{signal:abort.signal}),{name:'AbortError'});assert.equal(calls,1);
console.log('V2 production policy: default-off, allowlist/all rollout, per-account default, readiness rejection, application spending, mandatory local ledger, request bounds and cancellation passed.');
