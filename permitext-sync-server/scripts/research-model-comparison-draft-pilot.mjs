// Test-only replay of a frozen writer request. No application or production calls.
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=join(root,'.model-comparison-local/20260930');
const option=name=>{const i=process.argv.indexOf(name);if(i<0)return null;const v=process.argv[i+1];if(!v||v.startsWith('--'))throw Error(`Missing ${name} value.`);return v;};
const turns=process.argv.filter(arg=>['--turn1','--turn2'].includes(arg));
if(turns.length!==1)throw Error('Choose exactly one of --turn1 or --turn2.');
const turn=turns[0]==='--turn1'?1:2;
const combinations={
 baseline:{model:'gpt-6-luna',effort:'medium',tier:'default'},
 'luna-low-writer':{model:'gpt-6-luna',effort:'low',tier:'default'},
 'luna-none-writer':{model:'gpt-6-luna',effort:'none',tier:'default'},
 'luna-priority':{model:'gpt-6-luna',effort:'medium',tier:'priority'},
 'luna-low-priority':{model:'gpt-6-luna',effort:'low',tier:'priority'},
 terra:{model:'gpt-5.6-terra',effort:'medium',tier:'default'},
 'sol-low':{model:'gpt-6.1-sol',effort:'low',tier:'default'},
};
const combination=option('--combination');
if(!combination||!Object.hasOwn(combinations,combination))throw Error('An approved --combination is required.');
const config=combinations[combination],trial=option('--trial')||'draftpilot1';
if(!/^[a-zA-Z0-9_-]{1,64}$/.test(trial))throw Error('Invalid trial ID.');
const ledger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
if(ledger.requests.some(row=>['pending','unknown'].includes(row.status)))throw Error('Unsettled provider call; inspect ledger before continuing.');
const baselineRows=ledger.requests.filter(row=>row.combination==='baseline'&&row.trial==='pilot1'&&row.stage==='permitext_code_interpretation');
const baselineRunID=baselineRows.at(-1)?.runID;
if(!baselineRunID)throw Error('No baseline pilot1 writer requests are available.');
const question=turn===1?'can you explain the transparency requirements for this project?':'It’s a new building with ground-floor retail and community facility space';
let templateRow,body;
for(const row of baselineRows.filter(row=>row.runID===baselineRunID)){
 const candidate=JSON.parse(await readFile(join(directory,'provider',`${row.id}-request.json`),'utf8'));
 if(typeof candidate.input==='string'&&candidate.input.startsWith(`QUESTION\n${question}\n\n`)){templateRow=row;body=candidate;break;}
}
if(!templateRow)throw Error(`No first-draft template found for turn ${turn}.`);
const tag=`transparency-draft-${turn}-combination-${combination}-trial-${trial}`;
const receiptPath=join(directory,`${tag}.receipt.json`);
try{await access(receiptPath);console.log(`Already recorded ${tag}; use a new --trial for a repetition.`);process.exit(0);}catch(error){if(error.code!=='ENOENT')throw error;}
const codeSHA=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const templateSHA256=createHash('sha256').update(JSON.stringify({input:body.input,instructions:body.instructions,text:body.text})).digest('hex');
const metadata={turn,combination,trial,config,codeSHA,templateRequestID:templateRow.id,templateRunID:baselineRunID,templateSHA256,caseID:`transparency-draft-${turn}`,comparisonTimeoutSeconds:180,nativeAppWriterTimeoutSeconds:config.model==='gpt-6-luna'?180:45,maximumOutputTokens:24000,postGenerationVerification:false,baselineReused:combination==='baseline'};
if(!process.argv.includes('--live')){console.log(JSON.stringify({...metadata,dryRun:true},null,2));process.exit(0);}
let payload,row,runID;
if(combination==='baseline'){
 payload=JSON.parse(await readFile(join(directory,'provider',`${templateRow.id}-response.json`),'utf8'));row=templateRow;runID=`baseline-${turn}-${randomUUID()}`;
}else{
 const local=parseEnv(await readFile(join(root,'.env.local'),'utf8'));
 if(!local.OPENAI_API_KEY)throw Error('Local API key is unavailable.');
 for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key))delete process.env[key];
 runID=randomUUID();
 Object.assign(process.env,{OPENAI_API_KEY:local.OPENAI_API_KEY,PERMITEXT_COMPARISON_DIRECTORY:directory,PERMITEXT_COMPARISON_RUN_ID:runID,PERMITEXT_COMPARISON_CASE:metadata.caseID,PERMITEXT_COMPARISON_WRITER:config.model,PERMITEXT_COMPARISON_EFFORT:config.effort,PERMITEXT_COMPARISON_VERIFIER:'gpt-6-luna',PERMITEXT_COMPARISON_VERIFIER_EFFORT:'medium',PERMITEXT_COMPARISON_COMBINATION:combination,PERMITEXT_COMPARISON_TRIAL:trial,PERMITEXT_COMPARISON_CODE_SHA:codeSHA,PERMITEXT_COMPARISON_SERVICE_TIER:config.tier,PERMITEXT_COMPARISON_OUTPUT_LIMIT:'24000',PERMITEXT_COMPARISON_TIMEOUT_SECONDS:'180'});
 await import('./research-model-comparison-preload.mjs');
 body.max_output_tokens=24000;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${local.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
 payload=await response.json();
 const updated=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
 row=updated.requests.find(request=>request.runID===runID);
}
const outputText=(payload.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('');
let answer=null,parseError=null;try{answer=JSON.parse(outputText);}catch(error){parseError=error.message;}
const result={...metadata,runID,requestID:row?.id,seconds:row?.seconds,model:row?.model,effort:row?.effort,requestedServiceTier:row?.requestedServiceTier,returnedServiceTier:row?.returnedServiceTier,usage:row?.usage,costUpperUSD:row?.costUSD,actualTokenCostUSD:row?.actualTokenCostUSD,completionStatus:payload.status,providerError:payload.error,answer,outputText,parseError};
const artifact=`${runID}-draft.json`;
await writeFile(join(directory,artifact),JSON.stringify(result,null,2));
await writeFile(receiptPath,JSON.stringify({...metadata,runID,requestID:row?.id,artifact,seconds:row?.seconds,requestedServiceTier:row?.requestedServiceTier,returnedServiceTier:row?.returnedServiceTier,completionStatus:payload.status,parsed:!!answer,createdAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({tag,artifact,seconds:row?.seconds,costUpperUSD:row?.costUSD,completionStatus:payload.status,parsed:!!answer,baselineReused:metadata.baselineReused}));
if(payload.status!=='completed'||!answer)process.exitCode=1;
