// Test-only provider boundary. No production imports or configuration changes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Agent } from 'undici';
const dispatcher = new Agent({ headersTimeout: 1200000, bodyTimeout: 1200000 });
const directory = process.env.PERMITEXT_COMPARISON_DIRECTORY;
if (!directory) throw Error('A private comparison directory is required.');
if (existsSync(join(directory, 'pause-new-cases'))) throw Error('Comparison paused before new paid cases; inspect pilot results.');
const ledgerFile = join(directory, 'ledger.json');
const nativeFetch = globalThis.fetch;
const rates = { 'gpt-5.6-terra': [2, .2, 12], 'gpt-6-luna': [.1, .01, .5], 'gpt-6-sol': [2, .2, 10], 'gpt-6.1-sol': [2, .1, 10], 'gpt-5.6-luna': [.2, .02, 1.2] };
const combination=process.env.PERMITEXT_COMPARISON_COMBINATION;
const approvedCombinations=['baseline','luna-low-review','luna-low-writer','luna-none-writer','terra','sol-low','sol-review','luna-priority','luna-low-priority'];
if(combination && !approvedCombinations.includes(combination))throw Error('Unapproved comparison combination.');
const priorityCombination=['luna-priority','luna-low-priority'].includes(combination);
const requestedCombinationTier=priorityCombination?'priority':'default';
if(combination && process.env.PERMITEXT_COMPARISON_SERVICE_TIER!==requestedCombinationTier)throw Error('Combination service tier does not match its approval.');
const persist = ledger => writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(typeof url === 'string' ? url : url.url || url);
  if (['127.0.0.1', 'localhost'].includes(target.hostname)) {
    const response = await nativeFetch(url, { ...init, dispatcher });
    if (target.pathname === '/research/conversations/message') {
      const value = await response.clone().json();
      writeFileSync(join(directory, `${process.env.PERMITEXT_COMPARISON_RUN_ID || "pilot"}-${process.env.PERMITEXT_COMPARISON_CASE}-${process.env.PERMITEXT_COMPARISON_WRITER}-${process.env.PERMITEXT_COMPARISON_EFFORT || "default"}-http.json`), JSON.stringify({status:response.status, value}, null, 2));
    }
    return response;
  }
  if (target.hostname !== 'api.openai.com' || target.pathname !== '/v1/responses') throw Error(`Comparison blocked external request: ${target.hostname}${target.pathname}`);
  const body = JSON.parse(init.body);
  const stage = body.text?.format?.name;
  const originalBody=JSON.stringify(body);
  if (['permitext_code_interpretation','permitext_research_targeted_revision'].includes(stage)) {
    body.model = process.env.PERMITEXT_COMPARISON_WRITER;
    body.reasoning = { ...body.reasoning, effort: combination ? process.env.PERMITEXT_COMPARISON_EFFORT : body.model === 'gpt-6-luna' ? (process.env.PERMITEXT_COMPARISON_EFFORT || 'max') : 'medium' };
    body.max_output_tokens = Number(process.env.PERMITEXT_COMPARISON_OUTPUT_LIMIT || 24000);
    if (!(combination ? [24000] : [24000, 64000]).includes(body.max_output_tokens)) throw Error("Unapproved comparison output limit.");
  } else if (stage === 'permitext_research_verification') {
    body.model = process.env.PERMITEXT_COMPARISON_VERIFIER || 'gpt-5.6-terra'; // Identical verifier within each cohort.
    if (![...['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-6-luna'], ...(combination==='sol-review'?['gpt-6.1-sol']:[])].includes(body.model)) throw Error('Unapproved verifier model.');
    if(combination) {
      body.reasoning={...body.reasoning,effort:process.env.PERMITEXT_COMPARISON_VERIFIER_EFFORT};
      body.max_output_tokens=8000;
    }
  } else if (stage === 'permitext_research_evaluation') {
    body.model = 'gpt-6-sol'; // Separate fixed rubric judge, neither candidate.
  } else throw Error(`Unapproved comparison stage: ${stage}`);
  if(combination) {
    const allowedEfforts=combination==='luna-none-writer' && ['permitext_code_interpretation','permitext_research_targeted_revision'].includes(stage) ? ['none'] : ['low','medium'];
    if(!allowedEfforts.includes(body.reasoning?.effort))throw Error('Unapproved combination effort.');
    body.service_tier=stage==='permitext_research_evaluation'?'default':requestedCombinationTier;
  }
  if(process.env.PERMITEXT_COMPARISON_VERIFY_RUNTIME==='1' && originalBody!==JSON.stringify(body)) throw Error('Configured runtime does not match the evaluated model, effort, tier or token allowance.');
  if (body.tools?.length || body.previous_response_id || body.conversation || body.service_tier && body.service_tier !== 'default' && !(priorityCombination && body.service_tier==='priority')) throw Error('Unbounded comparison request.');
  const serialized = JSON.stringify(body);
  if (/"type":"(?:input_image|input_file|input_audio)"/.test(serialized)) throw Error('This comparison budget supports text only.');
  const [inputRate, cachedRate, outputRate] = rates[body.model] || [];
  if (!inputRate || !Number.isSafeInteger(body.max_output_tokens)) throw Error('Unknown pricing or output limit.');
  // One token per UTF-8 byte plus protocol overhead; include the maximum
  // long-context and cache-write premiums, even for short uncached requests.
  const requestedServiceTier=body.service_tier || 'default';
  const requestedTierMultiplier=requestedServiceTier==='priority'?2:1;
  const reservedUSD = requestedTierMultiplier * ((Buffer.byteLength(serialized) + 8192) * inputRate * 2.5 + body.max_output_tokens * outputRate * 1.5) / 1e6;
  let ledger = JSON.parse(readFileSync(ledgerFile));
  if (ledger.requests.some(r => ['pending', 'unknown'].includes(r.status))) throw Error('Unsettled request: stop for reconciliation before spending more.');
  const spent = ledger.requests.reduce((s, r) => s + (r.costUSD ?? r.reservedUSD), 0);
  if (spent + reservedUSD > ledger.capUSD) throw Object.assign(Error('Cumulative comparison spending cap reached before dispatch.'), { code: 'RESEARCH_EVAL_SPEND_CAP' });
  const id = randomUUID();
  const request = { id, combination, trial:process.env.PERMITEXT_COMPARISON_TRIAL, codeSHA:process.env.PERMITEXT_COMPARISON_CODE_SHA, requestedServiceTier, runID: process.env.PERMITEXT_COMPARISON_RUN_ID, caseID: process.env.PERMITEXT_COMPARISON_CASE, arm: process.env.PERMITEXT_COMPARISON_WRITER, writerEffort: process.env.PERMITEXT_COMPARISON_EFFORT || (process.env.PERMITEXT_COMPARISON_WRITER === 'gpt-6-luna' ? 'max' : 'medium'), stage, model: body.model, effort: body.reasoning?.effort, maximumOutputTokens: body.max_output_tokens, reservedUSD, status: 'pending', timeoutSeconds: Number(process.env.PERMITEXT_COMPARISON_TIMEOUT_SECONDS || 180), startedAt: new Date().toISOString(), inputSHA256: createHash('sha256').update(JSON.stringify({input:body.input,instructions:body.instructions})).digest('hex') };
  ledger.requests.push(request); persist(ledger);
  mkdirSync(join(directory, 'provider'), { recursive: true });
  writeFileSync(join(directory, 'provider', `${id}-request.json`), serialized);
  const started = Date.now();
  let response;
  try { response = await nativeFetch(url, { ...init, dispatcher, body: serialized, signal: AbortSignal.any([init.signal, AbortSignal.timeout(Number(process.env.PERMITEXT_COMPARISON_TIMEOUT_SECONDS || 180) * 1000)].filter(Boolean)) }); }
  catch (error) { throw error; } // Keep full reservation on unknown provider outcome.
  const payload = await response.clone().json();
  writeFileSync(join(directory, 'provider', `${id}-response.json`), JSON.stringify(payload, null, 2));
  const u = payload.usage;
  ledger = JSON.parse(readFileSync(ledgerFile));
  const row = ledger.requests.find(r => r.id === id);
  Object.assign(row, { status: u ? 'settled' : 'unknown', httpStatus: response.status, seconds: (Date.now()-started)/1000, providerResponseID: payload.id, completionStatus: payload.status, returnedServiceTier:payload.service_tier, incompleteDetails: payload.incomplete_details, usage: u, error: payload.error });
  if (u && Number.isFinite(u.input_tokens) && Number.isFinite(u.output_tokens)) {
    const cached = u.input_tokens_details?.cached_tokens || 0;
    // Conservatively charge all non-read input at cache-write rate. This also
    // protects the cap if a provider omits write-token telemetry.
    const long = u.input_tokens > 272000;
    const returnedTierMultiplier=payload.service_tier==='priority' || payload.service_tier==='fast' ? 2 : payload.service_tier==='default' ? 1 : requestedTierMultiplier;
    row.costServiceTier=payload.service_tier || requestedServiceTier;
    row.costUSD = returnedTierMultiplier * ( ((u.input_tokens-cached)*inputRate*1.25 + cached*cachedRate)*(long?2:1)/1e6 + u.output_tokens*outputRate*(long?1.5:1)/1e6);
    row.actualTokenCostUSD = returnedTierMultiplier * ( ((u.input_tokens-cached-(u.input_tokens_details?.cache_write_tokens||0))*inputRate + (u.input_tokens_details?.cache_write_tokens||0)*inputRate*1.25 + cached*cachedRate)*(long?2:1)/1e6 + u.output_tokens*outputRate*(long?1.5:1)/1e6);
    row.standardTokenCostUSD = ((u.input_tokens-cached)*inputRate + cached*cachedRate)*(long?2:1)/1e6 + u.output_tokens*outputRate*(long?1.5:1)/1e6;
  }
  persist(ledger);
  if (!u) throw Error('Provider usage unavailable; reservation retained and comparison stopped.');
  console.log('COMPARISON_REQUEST '+JSON.stringify({caseID:row.caseID,arm:row.arm,combination,trial:row.trial,stage,model:body.model,effort:body.reasoning?.effort,requestedServiceTier,returnedServiceTier:payload.service_tier,seconds:row.seconds,costUpperUSD:row.costUSD,status:payload.status}));
  return response;
};
