import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { operationTokenCost } from '../evals/typesafe-evidence-focus.mjs';
import { configureTaskPlanning } from '../evals/typesafe-task-planning.mjs';
const serverRoot = new URL('../', import.meta.url);
const key = JSON.parse(await readFile(new URL('evals/research-reconciled-answer-key.json',serverRoot)));
const cases = ['CC-01','CC-03','CC-04'].map(id=>{
 const c=key.cases.find(c=>c.id===id); assert(c);
 return {id,question:[c.scenario,c.question].filter(Boolean).join('\n\n'),expectedAnswer:c.expectedAnswer,requiredConcepts:c.requiredConcepts,forbiddenClaims:c.forbiddenClaims};
});
const plan=[];
const arms=['baseline','rules','jev-plan'];
for(let repetition=1;repetition<=2;repetition++) for(const [i,c] of cases.entries()) {
 const shift=(i+repetition-1)%3;
 const order=[...arms.slice(shift),...arms.slice(0,shift)];
 for(const mode of order) plan.push({caseID:c.id,repetition,mode,question:c.question});
}
const original=await readFile(new URL('app.mjs',serverRoot),'utf8');
const needle='    const assembledEvidence = boundedCitationLookup\n      ? boundedCitationEvidence\n      : evidencePackage.sources || [];';
assert.equal(original.split(needle).length,2,'Expected exactly one evidence preparation boundary');
const replacement=`    const originalAssembledEvidence = boundedCitationLookup
      ? boundedCitationEvidence
      : evidencePackage.sources || [];
    const assembledEvidence = await prepareTaskPlan({ question, evidence: originalAssembledEvidence, facts: validUserFacts,
      requiredClaims: requiredResearchClaimsFromEvidence(originalAssembledEvidence), disabled: boundedCitationLookup || zoningTurn });`;
const draftNeedle='input: researchInputForEvidence(question, passageEvidence, options),';
assert.equal(original.split(draftNeedle).length,2,'Exactly one draft input boundary expected');
const variant='import { prepareTaskPlan, appendTaskPlan } from "./evals/typesafe-task-planning.mjs";\n'+original.replace(needle,replacement).replace(draftNeedle,'input: appendTaskPlan(researchInputForEvidence(question, passageEvidence, options)),');
const focusModuleBytes=await readFile(new URL('evals/typesafe-task-planning.mjs',serverRoot));
const profile={schemaVersion:1,focusModuleSHA256:createHash('sha256').update(focusModuleBytes).digest('hex'),experiment:'full local HTTP Research flow: baseline, code-only task plan, Jev-assisted task plan',
 sourceSHA256:createHash('sha256').update(original).digest('hex'),variantSHA256:createHash('sha256').update(variant).digest('hex'),
 plan,cases,configuration:'Terra single-model, medium answer reasoning, existing verification/repairs; identical for all three arms',
 limitations:['Three construction-code scenarios, two repetitions; not a production workload sample.','No UI/network-to-production timing; measured from local HTTP request through completed verified answer.','All source text, IDs and order are unchanged; only drafting receives the advisory plan. Verification input and policy are unchanged.','Baseline preparation is deterministic; no artificial baseline model-analysis call.']};
if(!process.argv.includes('--live')) {console.log(JSON.stringify({status:'offline-preflight',...profile},null,2)); process.exit(0);}
assert.equal(process.env.PERMITEXT_TYPESAFE_PLAN_LIVE,'1','Explicit live authorization required');
const local=parseEnv(await readFile(new URL('.env.local',serverRoot),'utf8'));
assert(local.OPENAI_API_KEY && local.TYPESAFE_API_KEY,'Both provider keys required');
const scratch=await mkdtemp(join(tmpdir(),'permitext-typesafe-flow-'));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  OPENAI_API_KEY: local.OPENAI_API_KEY,
  NODE_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "sync-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "private-assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: "50",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "2",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "50",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "50",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "50",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "50",
  PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "50",
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_OFFICIAL_DOMAINS: "nyc.gov,ny.gov,rules.cityofnewyork.us,ada.gov",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260907-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260907-luna"
});

const dir=new URL('.typesafe-local/',serverRoot); await mkdir(dir,{recursive:true,mode:0o700});
const resultURL=new URL(`${Date.now()}-task-plan.json`,dir);
const result={...profile,startedAt:new Date().toISOString(),status:'running',turns:[],providerCalls:[]};
let persistChain=Promise.resolve();
const persist=()=>{const json=JSON.stringify(result,null,2)+'\n'; persistChain=persistChain.then(()=>writeFile(resultURL,json,{mode:0o600})); return persistChain;};
await writeFile(new URL(`${Date.now()}-task-planning-source.mjs`,dir),focusModuleBytes,{mode:0o600});
await persist();
const nativeFetch=globalThis.fetch;
let active=null;
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://api.openai.com/v1/responses') return nativeFetch(url,options);
 const body=JSON.parse(options.body);
 const call={turn:active?.id,model:body.model,phase:body.tools?.length?'web_support':body.text?.format?.name,requestBytes:Buffer.byteLength(options.body),startedAt:new Date().toISOString()};
 result.providerCalls.push(call); await persist(); const start=performance.now();
 try {const response=await nativeFetch(url,options); const payload=await response.clone().json();
 Object.assign(call,{httpStatus:response.status,durationMs:Math.round(performance.now()-start),usage:payload.usage,serviceTier:payload.service_tier,status:payload.status,errorCode:payload.error?.code}); return response;
 } catch {call.errorCode='transport_failure'; throw new Error('Research provider transport failure');} finally {await persist();}
};
const config=await import('../research-config.mjs'); config.validatePaidResearchEvaluationEnvironment(); assert(config.researchSpendGuardrails().ready);
const tempApp=new URL(`.typesafe-flow-${process.pid}.mjs`,serverRoot);
await writeFile(tempApp,variant,{mode:0o600,flag:'wx'});
let server;
try {
 const {handleRequest}=await import(tempApp.href);
 server=createServer(handleRequest); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(path,body,token){const response=await nativeFetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}); return {status:response.status,body:await response.json()};}
 const sign=await request('/account/sign-in',{credential:{provider:'web',providerUserID:`typesafe-${randomUUID()}`,displayName:'Isolated TypeSafe Research evaluation'}});
 assert.equal(sign.status,200); const {account}=sign.body; const auth={accountUserID:account.appUserID}; const token=account.backendSessionToken;
 const grant=await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN); assert.equal(grant.status,200);
 const seen=new Set();
 for(const [i,turn] of plan.entries()){
  active={...turn,id:`${turn.caseID}-${turn.repetition}-${turn.mode}`,status:'running'}; result.turns.push(active); await persist();
  configureTaskPlanning({mode:turn.mode,apiKey:local.TYPESAFE_API_KEY,fetch:nativeFetch,record:r=>{active.preparation=r;}});
  const created=await request('/research/conversations/create',{auth},token); assert.equal(created.status,201);
  const start=performance.now();
  console.log(`Starting ${i+1}/${plan.length}: ${active.id}`);
  const response=await request('/research/conversations/message',{auth,conversationID:created.body.conversation.id,question:turn.question,requestID:randomUUID()},token);
  active.durationMs=Math.round(performance.now()-start); active.httpStatus=response.status;
  active.answer=[...(response.body.conversation?.messages||[])].reverse().find(m=>m.role==='assistant')?.answer;
  active.status=active.answer?'completed':'failed';
  if(!active.answer) active.error={code:response.body.code,message:response.body.error,verificationAttempts:response.body.verificationAttempts};
  const telemetry=await request('/internal/evaluations/data',{auth},token);
  active.operations=(telemetry.body.researchSpend?.operationMetrics||[]).filter(o=>!seen.has(o.id)); active.operations.forEach(o=>seen.add(o.id));
  active.researchCostUSD=active.operations.reduce((n,o)=>n+operationTokenCost(o),0);
  result.spend=config.researchEvaluationSpendStatus(); await persist();
  console.log(`${active.id}: ${active.status}, ${active.durationMs} ms, sources ${active.preparation?.sourceIDs?.length} -> ${active.preparation?.sourceIDs?.length}`);
  assert(active.operations.length,'Missing telemetry');
  assert(active.operations.every(o=>o.pendingProviderRequestCount===0),'Unsettled provider usage');
  if(result.providerCalls.some(c=>c.httpStatus===401||c.errorCode==='insufficient_quota')) throw new Error('Provider account failure');
  if(active.preparation?.status==='fallback-to-rules') throw new Error('Jev planning failed; current turn used code-only plan; stop experiment');
 }
 result.status='completed';
} catch(error){result.status='stopped';result.stopReason=error.message;}
finally{
 configureTaskPlanning(null); globalThis.fetch=nativeFetch;
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await unlink(tempApp);result.finishedAt=new Date().toISOString();result.spend=config.researchEvaluationSpendStatus();await persist();
}
console.log(JSON.stringify({status:result.status,turns:result.turns.length,providerCalls:result.providerCalls.length,spend:result.spend,report:fileURLToPath(resultURL)},null,2));
if(result.status!=='completed')process.exitCode=1;
