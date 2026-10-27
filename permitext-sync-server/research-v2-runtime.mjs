import {createLunaV2Client} from './research-v2-budget.mjs';

// Deployment remains disabled in this branch. The allowlist and switch can be
// exercised locally without changing old conversations or default routing.
export function researchV2Availability(env,userID){
  const users=String(env.PERMITEXT_RESEARCH_V2_USERS||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {available:env.PERMITEXT_RESEARCH_V2==='1'&&!env.VERCEL&&env.NODE_ENV!=='production'&&(!users.length||users.includes(userID)),
    defaultEngine:'legacy',spending:'evaluation',localOnly:true};
}

// The application provider owns auth, entitlements, turn reservation, global
// spend caps and accounting. The optional evaluation wrapper adds this task's
// durable $7 cap. Application billing has no dependency on a local ledger.
export function createResearchV2ApplicationCall({provider,apiKey,evaluationBudget}={}){
  if(typeof provider!=='function')throw new Error('Research v2 requires an accounted application provider.');
  if(evaluationBudget)return createLunaV2Client({apiKey,budget:evaluationBudget,transport:provider});
  return async(body,{signal}={})=>{
    signal?.throwIfAborted();
    if(body.model!=='gpt-6-luna'||body.service_tier!=='default'||body.store!==false||body.tools?.length)
      throw new Error('Research v2 requires the approved Luna configuration.');
    return provider(body,signal);
  };
}
