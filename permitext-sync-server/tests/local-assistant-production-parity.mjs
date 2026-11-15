import assert from 'node:assert/strict';
import {mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configureLocalAssistant, budgetLocalAssistantEmbeddings} from '../scripts/local-assistant-environment.mjs';
import {createResearchV2Budget} from '../research-v2-budget.mjs';
import {runResearchV2} from '../research-v2-engine.mjs';
import {researchV2Availability} from '../research-v2-runtime.mjs';

const scratch=await mkdtemp(join(tmpdir(),'local-assistant-parity-'));
try {
  const budgetPath=join(scratch,'existing-budget.json');
  const original={schema:1,limitMicroUSD:7000000,calls:[{id:'previous-test',phase:'draft',model:'gpt-6-luna',
    reservedMicroUSD:10000,chargedMicroUSD:1200,status:'settled'}]};
  await writeFile(budgetPath,JSON.stringify(original));
  const options={apiKey:'local-test-key',dataPath:join(scratch,'test-store.json'),assetsPath:join(scratch,'assets'),budgetPath};
  await assert.rejects(configureLocalAssistant({...options,environment:{NODE_ENV:'production'}}),/local testing only/);
  await assert.rejects(configureLocalAssistant({...options,budgetPath:join(scratch,'new-ledger.json'),environment:{}}),{code:'ENOENT'});
  const env={NODE_ENV:'test',DATABASE_URL:'postgresql://production.invalid/main',PERMITEXT_SYNC_DATABASE_URL:'postgresql://production.invalid/main',
    PERMITEXT_TEST_RESEARCH_MOCK:'1',OPENAI_API_KEY:'production-key',PERMITEXT_RESEARCH_PROMPT_VERSION:'stale-preview',
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION:'stale-price',PERMITEXT_PUBLIC_BASE_URL:'https://production.invalid'};
  const parity=await configureLocalAssistant({...options,environment:env});
  const snapshot=JSON.parse(await readFile(new URL('../config/local-assistant-production.json',import.meta.url),'utf8'));
  for(const [key,value] of Object.entries(snapshot.environment))assert.equal(env[key],value,key);
  assert.equal(env.OPENAI_API_KEY,'local-test-key');
  for(const key of ['DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','PERMITEXT_TEST_RESEARCH_MOCK','PERMITEXT_RESEARCH_PROMPT_VERSION',
    'PERMITEXT_RESEARCH_FAST_PRICING_VERSION','PERMITEXT_PUBLIC_BASE_URL'])assert.equal(env[key],undefined,key);
  assert.equal(env.PERMITEXT_SYNC_DATA_PATH,options.dataPath);
  assert.equal(env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH,options.assetsPath);
  assert.equal(env.PERMITEXT_RESEARCH_V2_BUDGET_PATH,await realpath(budgetPath));
  assert.equal(env.PERMITEXT_RESEARCH_MONTHLY_CAP_USD,'7');
  assert.equal(researchV2Availability(env,'local-test-account').defaultEngine,'v2');
  assert.deepEqual(JSON.parse(await readFile(budgetPath,'utf8')),original,'Setup preserves the original ledger and every previous charge');

  // Capture the actual shared engine's requests, including a repair, without paid calls.
  const requests=[];
  const draft={questionTitle:'Code name and abbreviations',answerText:'The passage calls this the New York City Building Code, NYCBC, or BC. [S1]',
    claims:[{text:'These are the names in the passage.',sourceIDs:['S1']}],missingSources:[],missingFacts:[]};
  const input={question:'What is this code called?',sources:[{id:'S1',sectionID:'1',edition:'2022',
    text:'This code shall be known and may be cited as the New York City Building Code, NYCBC or BC.'}]};
  const result=await runResearchV2(input,{call:async body=>{
    requests.push(body);
    const review=body.text.format.name==='permitext_v2_review';
    const value=review?{pass:requests.length>2,issues:requests.length===2?[{code:'wording',detail:'Retain the exact wording.'}]:[]}:draft;
    return {status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]};
  }});
  assert.equal(result.status,'reviewed');assert.equal(requests.length,4);
  assert.deepEqual(requests.map(r=>r.reasoning.effort),['low','medium','medium','medium']);
  assert.deepEqual(requests.map(r=>r.max_output_tokens),[6144,4096,6144,4096]);
  for(const body of requests){assert.equal(body.model,env.PERMITEXT_RESEARCH_MODEL);assert.equal(body.service_tier,'default');
    assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);}

  // Retrieval uses the same isolated durable cap as generation and cannot bypass it.
  const embedding={model:'text-embedding-3-small',dimensions:256,encoding_format:'float',input:['Test retrieval question']};
  let dispatches=0;
  const transport=budgetLocalAssistantEmbeddings(parity.budget,async()=>{dispatches++;return Response.json({usage:{total_tokens:100}})});
  await transport('https://api.openai.com/v1/embeddings',{body:JSON.stringify(embedding)});
  assert.equal(dispatches,1);
  let ledger=JSON.parse(await readFile(budgetPath,'utf8'));
  assert.equal(ledger.calls.length,2);assert.equal(ledger.calls[0].chargedMicroUSD,1200);
  assert.equal(ledger.calls[1].kind,'embedding');assert.equal(ledger.calls[1].chargedMicroUSD,2);
  const summary=await parity.budget.summary();
  assert.deepEqual(await createResearchV2Budget({path:budgetPath}).summary(),summary,'Restart retains retrieval spending');
  const interrupted=budgetLocalAssistantEmbeddings(parity.budget,async()=>{throw new Error('network interrupted')});
  await assert.rejects(interrupted('https://api.openai.com/v1/embeddings',{body:JSON.stringify(embedding)}),/interrupted/);
  ledger=JSON.parse(await readFile(budgetPath,'utf8'));
  assert.equal(ledger.calls.at(-1).status,'uncertain');
  assert.equal(ledger.calls.at(-1).chargedMicroUSD,ledger.calls.at(-1).reservedMicroUSD);
  await assert.rejects(transport('https://api.openai.com/v1/embeddings',{body:JSON.stringify({...embedding,model:'other'})}),{code:'V2_REQUEST_LIMIT'});
  const fullPath=join(scratch,'exhausted.json');await writeFile(fullPath,JSON.stringify({...original,limitMicroUSD:1200}));
  const exhausted=budgetLocalAssistantEmbeddings(createResearchV2Budget({path:fullPath}),async()=>{throw new Error('Must never dispatch')});
  await assert.rejects(exhausted('https://api.openai.com/v1/embeddings',{body:JSON.stringify(embedding)}),{code:'V2_BUDGET_EXHAUSTED'});
  console.log('Local Assistant parity: production settings and pinned prompts, reviewed request settings, isolated storage/key, existing $7 ledger, retrieval accounting and pre-dispatch budget rejection passed.');
} finally {await rm(scratch,{recursive:true,force:true})}
