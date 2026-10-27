import {createLunaV2Client,assertLunaV2Request} from './research-v2-budget.mjs';
import {researchSpendGuardrails,researchPricing} from './research-config.mjs';

export function researchV2Configuration(env=process.env){
  const hosted=env.NODE_ENV==='production'||env.VERCEL==='1'||Boolean(env.VERCEL_ENV);
  const enabled=env.PERMITEXT_RESEARCH_V2==='1';
  const users=String(env.PERMITEXT_RESEARCH_V2_USERS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const rollout=env.PERMITEXT_RESEARCH_V2_ROLLOUT||(hosted||users.length?'allowlist':'all');
  const defaultEngine=env.PERMITEXT_RESEARCH_V2_DEFAULT||'legacy';
  const problems=[];
  const require=(condition,message)=>{if(!condition)problems.push(message);};
  if(enabled){
    require(['allowlist','all'].includes(rollout),'Choose PERMITEXT_RESEARCH_V2_ROLLOUT=allowlist or all.');
    require(['legacy','v2'].includes(defaultEngine),'Choose PERMITEXT_RESEARCH_V2_DEFAULT=legacy or v2.');
    if(rollout==='allowlist')require(users.length>0,'Configure PERMITEXT_RESEARCH_V2_USERS for the allowlist rollout.');
    require(env.PERMITEXT_RESEARCH_KILL_SWITCH!=='1','The Research kill switch is active.');
    if(hosted){
      const database=env.PERMITEXT_SYNC_DATABASE_URL||env.DATABASE_URL||env.STORAGE_URL||env.POSTGRES_URL||env.NEON_DATABASE_URL;
      let validDatabase=false;try{validDatabase=['postgres:','postgresql:'].includes(new URL(database).protocol);}catch{}
      require(validDatabase,'Production Research v2 requires a PostgreSQL database URL.');
      require(Boolean(env.OPENAI_API_KEY),'Configure the server-side OPENAI_API_KEY.');
      require(!env.PERMITEXT_RESEARCH_V2_BUDGET_PATH&&!env.PERMITEXT_RESEARCH_EVAL_MAX_USD,'Remove local evaluation-budget settings from the deployed environment.');
      require(env.PERMITEXT_TEST_RESEARCH_MOCK!=='1','Mock Research must be disabled in the deployed environment.');
      const spending=researchSpendGuardrails(env);problems.push(...spending.problems);
      // Use exactly the rates selected by application accounting. Conservative
      // prices are allowed, but a cheaper model's rates must not undercount Luna.
      const pricing=researchPricing(env,'gpt-6-luna');
      for(const [key,floor] of [['inputRate',.10],['cachedInputRate',.01],['outputRate',.50]]){
        require(pricing[key]!==null&&pricing[key]>=floor,`Research ${key} for Luna must cover Standard pricing (at least ${floor} USD per million tokens).`);
      }
    }else require(Boolean(env.PERMITEXT_RESEARCH_V2_BUDGET_PATH),'Local Research v2 requires the original durable evaluation budget path.');
  }else if(env.PERMITEXT_RESEARCH_V2&&env.PERMITEXT_RESEARCH_V2!=='0')problems.push('PERMITEXT_RESEARCH_V2 must be 0 or 1.');
  return {enabled,ready:problems.length===0,hosted,spending:hosted?'application':'evaluation',
    rollout,defaultEngine,users,problems,evaluationBudgetPath:hosted?null:env.PERMITEXT_RESEARCH_V2_BUDGET_PATH||null};
}

export function researchV2Availability(env,userID){
  const config=researchV2Configuration(env);
  const eligible=config.rollout==='all'||config.users.includes(userID);
  const available=config.enabled&&config.ready&&eligible;
  // Public response never exposes account allowlists, credentials or filesystem paths.
  return {available,defaultEngine:available?config.defaultEngine:'legacy',spending:config.spending,localOnly:!config.hosted};
}

// The supplied provider owns durable application reservations, entitlements,
// cumulative per-turn caps and accounting. Only local testing adds the $7 ledger.
export function createResearchV2ApplicationCall({provider,apiKey,evaluationBudget}={}){
  if(typeof provider!=='function')throw new Error('Research v2 requires an accounted application provider.');
  if(evaluationBudget)return createLunaV2Client({apiKey,budget:evaluationBudget,transport:provider});
  return async(body,{signal}={})=>{signal?.throwIfAborted();assertLunaV2Request(body);return provider(body,signal);};
}
