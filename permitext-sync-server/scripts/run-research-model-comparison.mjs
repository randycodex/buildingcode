import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, '.model-comparison-local/20260930');
await mkdir(directory, {recursive:true});
const live = process.argv.includes('--live');
const full = process.argv.includes('--full');
const wide = process.argv.includes('--wide');
const luna6Verifier = process.argv.includes('--luna6-verifier');
const productionVerifier = process.argv.includes('--production-verifier');
const high = process.argv.includes('--high');
const medium = process.argv.includes('--medium');
const optionValue = name => {
 const index=process.argv.indexOf(name);
 if(index<0)return null;
 const value=process.argv[index+1];
 if(!value || value.startsWith('--'))throw Error(`Missing value for ${name}.`);
 return value;
};
const combinations = {
 baseline: {writer:'gpt-6-luna',writerEffort:'medium',verifier:'gpt-6-luna',verifierEffort:'medium'},
 'luna-low-review': {writer:'gpt-6-luna',writerEffort:'medium',verifier:'gpt-6-luna',verifierEffort:'low'},
 'luna-low-writer': {writer:'gpt-6-luna',writerEffort:'low',verifier:'gpt-6-luna',verifierEffort:'medium'},
 'luna-none-writer': {writer:'gpt-6-luna',writerEffort:'none',verifier:'gpt-6-luna',verifierEffort:'medium'},
 terra: {writer:'gpt-5.6-terra',writerEffort:'medium',verifier:'gpt-6-luna',verifierEffort:'medium'},
 'sol-low': {writer:'gpt-6.1-sol',writerEffort:'low',verifier:'gpt-6-luna',verifierEffort:'medium'},
 'sol-review': {writer:'gpt-6-luna',writerEffort:'medium',verifier:'gpt-6.1-sol',verifierEffort:'low'},
 'luna-priority': {writer:'gpt-6-luna',writerEffort:'medium',verifier:'gpt-6-luna',verifierEffort:'medium',serviceTier:'priority'},
 'luna-low-priority': {writer:'gpt-6-luna',writerEffort:'low',verifier:'gpt-6-luna',verifierEffort:'medium',serviceTier:'priority'},
};
const combination=optionValue('--combination');
if(combination && !Object.hasOwn(combinations,combination))throw Error('Unknown comparison combination.');
const combinationConfig=combination ? {...combinations[combination],serviceTier:combinations[combination].serviceTier || 'default'} : null;
if(combination && ['--arm','--high','--medium','--wide','--luna6-verifier','--production-verifier'].some(flag=>process.argv.includes(flag)))throw Error('Named combinations cannot be mixed with legacy model, effort, or wide-budget flags.');
const trial=optionValue('--trial');
if(trial && !/^[a-zA-Z0-9_-]{1,64}$/.test(trial))throw Error('Trial ID must use 1-64 letters, digits, underscores, or hyphens.');
const initialOnly=process.argv.includes('--initial-only');
const extendedFollowups=process.argv.includes('--extended-followups');
const investigation=process.argv.includes('--investigation');
const codeSHA=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const priceRates={'gpt-5.6-terra':[2,.2,12],'gpt-6-luna':[.1,.01,.5],'gpt-6.1-sol':[2,.1,10]};
if (high && medium) throw Error('Choose one Luna effort.');
const onlyArm = process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm')+1] : null;
if (onlyArm && !['terra','luna'].includes(onlyArm)) throw Error('Unknown comparison arm.');
if (process.argv.includes('transparency-conversation') && !live) throw Error('Conversation comparison requires --live.');
const local = parseEnv(await readFile(join(root,'.env.local'),'utf8'));
const datasetText = await readFile(join(root,'evals/research-cases.json'),'utf8');
const dataset = JSON.parse(datasetText);
const pilot = ['scissor-stair-two-exits','accessory-assembly-plumbing-fixtures','nyc-bc-1019-3-exception-attribution'];
const ids = process.argv.includes('--case') ? [process.argv[process.argv.indexOf('--case')+1]] : full ? dataset.cases.map(c=>c.id) : pilot;
let ledger;
try { ledger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8')); }
catch(e) { if(e.code!=='ENOENT')throw e; ledger={capUSD:16.28,requests:[],datasetSHA256:createHash('sha256').update(datasetText).digest('hex'), createdAt:new Date().toISOString()};await writeFile(join(directory,'ledger.json'),JSON.stringify(ledger,null,2)); }
if(ledger.datasetSHA256!==createHash('sha256').update(datasetText).digest('hex'))throw Error('Frozen dataset changed.');
for(const id of ids) for(const arm of (combinationConfig ? [combinationConfig.writer] : (ids.indexOf(id)%2 ? ['gpt-6-luna','gpt-5.6-terra'] : ['gpt-5.6-terra','gpt-6-luna']).filter(a=>!onlyArm || a.endsWith(onlyArm)))) {
 const legacyTag=`${id}-${arm}-${wide?'64000-600s':'180s'}${arm==='gpt-6-luna'?(high?'-high':medium?'-medium':''):''}${luna6Verifier?'-luna6-verifier':productionVerifier?'-production-verifier':''}${process.argv.includes('--review-followups')?'-review-followups':''}${process.argv.includes('--review-consistency')?'-review-consistency':''}${process.argv.includes('--project-fact-revision')?'-project-fact-revision':''}${live?'':'-dry'}`;
 const tag=`${combination ? `${id}-combination-${combination}${process.argv.includes('--review-followups')?'-review-followups':''}${process.argv.includes('--review-consistency')?'-review-consistency':''}${process.argv.includes('--project-fact-revision')?'-project-fact-revision':''}` : legacyTag}${initialOnly?'-initial-only':''}${extendedFollowups?'-extended-followups':''}${trial?`-trial-${trial}`:''}${combination && !live?'-dry':''}`;
 try { const prior=JSON.parse(await readFile(join(directory,`${tag}.receipt.json`))); if(prior.artifacts.length || prior.code===0) continue; } catch(e){if(e.code!=='ENOENT')throw e;}
 const current=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
 if(current.requests.some(r=>['pending','unknown'].includes(r.status)))throw Error('Unsettled provider call; inspect ledger before continuing.');
 if(current.requests.reduce((s,r)=>s+(r.costUSD??r.reservedUSD),0)>current.capUSD-0.88){console.log('Stopping with reserve before starting another case.');break;}
 const runID=randomUUID();
 const env={...process.env};
 for(const k of Object.keys(env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(k))delete env[k];
 Object.assign(env,{OPENAI_API_KEY:local.OPENAI_API_KEY,PERMITEXT_COMPARISON_DIRECTORY:directory,PERMITEXT_COMPARISON_RUN_ID:runID,PERMITEXT_COMPARISON_WRITER:arm,PERMITEXT_COMPARISON_CASE:id,PERMITEXT_COMPARISON_EFFORT:arm==='gpt-6-luna'?(high?'high':medium?'medium':'max'):'medium',PERMITEXT_COMPARISON_OUTPUT_LIMIT:wide?'64000':'24000',PERMITEXT_COMPARISON_TIMEOUT_SECONDS:wide?'600':'180',
 PERMITEXT_RUN_PAID_RESEARCH_EVALS:'1',PERMITEXT_RUN_UNAPPROVED_RESEARCH_DIAGNOSTICS:'1',PERMITEXT_RESEARCH_EVAL_MAX_USD:String(current.capUSD),
 PERMITEXT_RESEARCH_MODEL:'gpt-5.6-terra',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_ROUTING_MODE:'single',PERMITEXT_RESEARCH_REASONING_EFFORT:'medium',
 PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL:'gpt-6-sol',PERMITEXT_RESEARCH_EVAL_JUDGE_REASONING_EFFORT:'medium',PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS:'0',PERMITEXT_RESEARCH_WEB_SUPPORT:'0',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'2',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.2',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'12',PERMITEXT_RESEARCH_PRICING_VERSION:'comparison-conservative-terra-20260930',
 PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_FAST_PRICING_VERSION:'comparison-luna-20260930',
 PERMITEXT_RESEARCH_MAX_REQUEST_USD:'2',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:String(current.capUSD),PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:String(current.capUSD),PERMITEXT_RESEARCH_DAILY_CAP_USD:String(current.capUSD),PERMITEXT_RESEARCH_MONTHLY_CAP_USD:String(current.capUSD)});
 if (productionVerifier) Object.assign(env, {PERMITEXT_COMPARISON_VERIFIER:'gpt-5.6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-5.6-luna',PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS:'.2',PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.02',PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:'1.2',PERMITEXT_RESEARCH_FAST_PRICING_VERSION:'comparison-existing-luna-20260930'});
 if (luna6Verifier) Object.assign(env, {PERMITEXT_COMPARISON_VERIFIER:'gpt-6-luna',PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_REASONING_EFFORT:medium?'medium':'high',PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5'});
 if (combinationConfig) {
  const writerRates=priceRates[combinationConfig.writer], verifierRates=priceRates[combinationConfig.verifier];
  const tierMultiplier=1;
  Object.assign(env,{
   PERMITEXT_COMPARISON_COMBINATION:combination,PERMITEXT_COMPARISON_EFFORT:combinationConfig.writerEffort,
   PERMITEXT_COMPARISON_VERIFIER:combinationConfig.verifier,PERMITEXT_COMPARISON_VERIFIER_EFFORT:combinationConfig.verifierEffort,
   PERMITEXT_COMPARISON_SERVICE_TIER:combinationConfig.serviceTier,PERMITEXT_COMPARISON_TRIAL:trial || '',PERMITEXT_COMPARISON_CODE_SHA:codeSHA,
   PERMITEXT_COMPARISON_OUTPUT_LIMIT:'24000',PERMITEXT_COMPARISON_TIMEOUT_SECONDS:'180',
   PERMITEXT_RESEARCH_MODEL:combinationConfig.writer,PERMITEXT_RESEARCH_FAST_MODEL:combinationConfig.verifier,PERMITEXT_RESEARCH_REASONING_EFFORT:combinationConfig.writerEffort,
   PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT:combinationConfig.verifierEffort,PERMITEXT_RESEARCH_SERVICE_TIER:combinationConfig.serviceTier,
   PERMITEXT_COMPARISON_VERIFY_RUNTIME:process.argv.includes('--verify-runtime')?'1':'0',
   PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:String(writerRates[0]*tierMultiplier),PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:String(writerRates[1]*tierMultiplier),PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:String(writerRates[2]*tierMultiplier),PERMITEXT_RESEARCH_PRICING_VERSION:`comparison-${combination}-20260930`,
   PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS:String(verifierRates[0]*tierMultiplier),PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS:String(verifierRates[1]*tierMultiplier),PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:String(verifierRates[2]*tierMultiplier),PERMITEXT_RESEARCH_FAST_PRICING_VERSION:`comparison-${combination}-verifier-20260930`,
  });
 }
 if (initialOnly) env.PERMITEXT_COMPARISON_INITIAL_ONLY='1';
 if (process.argv.includes('--repeat-initial')) env.PERMITEXT_COMPARISON_REPEAT_INITIAL='1';
 if (extendedFollowups) env.PERMITEXT_COMPARISON_EXTENDED_FOLLOWUPS='1';
 if (process.argv.includes("--review-consistency")) env.PERMITEXT_COMPARISON_EXACT_FOLLOWUP="1";
 if (process.argv.includes("--project-fact-revision")) Object.assign(env,{PERMITEXT_COMPARISON_EXACT_FOLLOWUP:"1",PERMITEXT_COMPARISON_PROJECT_FACTS:"1"});
 const args=id==='transparency-conversation' ? ['--import',join(root,'scripts/research-model-comparison-preload.mjs'),join(root,investigation?'scripts/research-project-investigation-conversation.mjs':'scripts/research-model-comparison-conversation.mjs')] : ['--import',join(root,'scripts/research-model-comparison-preload.mjs'),join(root,'tests/research-evals.mjs'),live?'--run-live':'--dry-run','--include-drafts','--reconciled-development','--case',id,'--continue-after-verified-research-failure',...(live?['--run-id',runID]:[])];
 console.log(`START ${tag}`);
 let output='';
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env});child.stdout.on('data',b=>{output+=b;process.stdout.write(b)});child.stderr.on('data',b=>{output+=b;process.stderr.write(b)});child.on('error',reject);child.on('exit',resolve)});
 await writeFile(join(directory,`${tag}.log`),output);
 const artifacts=[];
 for(const name of await readdir(join(root,'evals/results')))if(name.includes(runID)){await rename(join(root,'evals/results',name),join(directory,name));artifacts.push(name);}
 const settledRunLedger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
 const returnedServiceTiers=[...new Set(settledRunLedger.requests.filter(request=>request.runID===runID).map(request=>request.returnedServiceTier || 'unreported'))];
 await writeFile(join(directory,`${tag}.receipt.json`),JSON.stringify({id,arm,runID,code,artifacts,live,codeSHA,combination,combinationConfig,trial,initialOnly,extendedFollowups,requestedServiceTier:combinationConfig?.serviceTier || 'default',returnedServiceTiers,comparisonLimits:combination?{writerOutputTokens:24000,verifierOutputTokens:8000,providerCeilingSeconds:180,preservesNativeAppTimeout:true}:undefined,createdAt:new Date().toISOString()},null,2));
 console.log(`END ${tag} exit=${code}`);
 if(code!==0)throw Error(`Comparison case ${tag} failed (${code===null?'child terminated without an exit code':`child exit ${code}`}); receipt and log were saved. Stopping before another case.`);
 if(/Cumulative comparison spending cap|usage unavailable|Unsettled request|insufficient_quota/.test(output))throw Error('Comparison stopped: budget or provider accounting boundary.');
}
