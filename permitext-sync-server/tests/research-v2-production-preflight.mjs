import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const clean={...process.env};
for(const key of Object.keys(clean))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key))delete clean[key];
const enabled={PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_ROLLOUT:'allowlist',PERMITEXT_RESEARCH_V2_USERS:'private-owner-id',PERMITEXT_RESEARCH_V2_DEFAULT:'v2',
  PERMITEXT_SYNC_DATABASE_URL:'postgresql://private-db-secret@127.0.0.1/postgres',OPENAI_API_KEY:'private-provider-secret',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD:'.25',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'1',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'10',PERMITEXT_RESEARCH_DAILY_CAP_USD:'10',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'100',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-double'};
function run(env,args=[]){
  const child=spawnSync(process.execPath,['scripts/verify-research-v2-production.mjs',...args],{env:{...clean,...env},encoding:'utf8'});
  assert.equal(child.stderr,'');assert(!/private-(owner|db|provider)/.test(child.stdout),'Preflight cannot disclose credentials or the allowlist');
  return {status:child.status,body:JSON.parse(child.stdout)};
}
assert.equal(run({}).status,0);assert.equal(run({},['--require-enabled']).status,1);
assert.equal(run(enabled,['--require-enabled']).status,0);
for(const change of [{OPENAI_API_KEY:''},{PERMITEXT_SYNC_DATABASE_URL:''},{PERMITEXT_RESEARCH_MAX_REQUEST_USD:'0'},{PERMITEXT_RESEARCH_V2_USERS:''},
  {PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.01'},{PERMITEXT_RESEARCH_V2_BUDGET_PATH:'/local/budget.json'}]){
  const result=run({...enabled,...change},['--require-enabled']);assert.equal(result.status,1);assert(result.body.problems.length);
}
console.log('Production preflight passed: disabled default, explicit activation, function duration, configuration rejection and secret-free diagnostics. No network calls.');

for(const [env,status] of [[enabled,0],[{...enabled,PERMITEXT_RESEARCH_V2_USERS:''},1]]){
  const child=spawnSync(process.execPath,['scripts/verify-production-deploy.mjs'],{env:{...clean,...env,VERCEL_ENV:'preview'},encoding:'utf8'});
  assert.equal(child.status,status);assert(!/private-(owner|db|provider)/.test(child.stdout+child.stderr),'Build diagnostics cannot expose secrets');
}
console.log('Existing deployment build gate accepts valid preview configuration and rejects invalid v2 activation.');
