import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions, researchSemanticEmbeddingMaximumCharacters,
  researchSemanticEmbeddingReservation, researchSemanticEmbeddingCost,
  researchSemanticEmbeddingPricingVersion } from './research-semantic-passages.mjs';

// USD per million tokens, verified against official Standard pricing 2026-10-26.
// Reservations deliberately allow the highest cache-write price and Fast output
// pricing. Actual Standard usage is settled at the lower published rates.
export const lunaV2Pricing = Object.freeze({ input: .10, cached: .01, output: .50,
  reservationInput: .25, reservationOutput: 1, version: 'openai-luna-20261026',
  source: 'https://developers.openai.com/api/docs/pricing' });
export const researchV2BudgetLimitUSD = 7;
const error = (message, code) => Object.assign(new Error(message), { code });
const micros = usd => Math.ceil(usd * 1_000_000);

export function lunaUsageMicroUSD(payload) {
  const usage = payload?.usage;
  if (!Number.isSafeInteger(usage?.input_tokens) || !Number.isSafeInteger(usage?.output_tokens) ||
      usage.input_tokens < 0 || usage.output_tokens < 0) return null;
  for (const field of ['cached_tokens', 'cache_write_tokens']) {
    const value = usage.input_tokens_details?.[field];
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) return null;
  }
  const cached = Math.max(0, Math.min(usage.input_tokens, usage.input_tokens_details?.cached_tokens || 0));
  const writes = usage.input_tokens_details?.cache_write_tokens || 0;
  const multiplier = ['fast', 'priority'].includes(payload.service_tier) ? 2 : 1;
  return Math.ceil(((usage.input_tokens - cached) * lunaV2Pricing.input + cached * lunaV2Pricing.cached +
    usage.output_tokens * lunaV2Pricing.output + writes * .25) * multiplier);
}

export function assertLunaV2Request(requestBody,{maximumBytes=180_000}={}){
  const bytes = Buffer.byteLength(JSON.stringify(requestBody), 'utf8');
  if(bytes>maximumBytes)throw Object.assign(error('The Assistant could not fit this material into one model request. Your complete conversation and sources remain saved.','V2_REQUEST_LIMIT'),{requestLimitReason:'context_size'});
  if (!Number.isSafeInteger(requestBody.max_output_tokens) ||
          requestBody.max_output_tokens < 1 || requestBody.max_output_tokens > 8192 ||
          requestBody.model !== 'gpt-6-luna' || requestBody.service_tier !== 'default' ||
          requestBody.store !== false || requestBody.tools?.length || requestBody.background) {
    throw error('This request is outside the approved Luna request limits.', 'V2_REQUEST_LIMIT');
  }
  return bytes;
}

export function createResearchV2Budget({ path, limitUSD = researchV2BudgetLimitUSD } = {}) {
  if (!path) throw error('Research v2 needs a durable evaluation budget ledger.', 'V2_BUDGET_REQUIRED');
  if (!(limitUSD > 0 && limitUSD <= researchV2BudgetLimitUSD)) throw error('The Research v2 budget cannot exceed $7.', 'V2_BUDGET_LIMIT');
  async function transaction(update) {
    await mkdir(dirname(path), { recursive: true });
    let lock;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { lock = await open(path + '.lock', 'wx', 0o600); break; }
      catch (cause) { if (cause.code !== 'EEXIST') throw cause; await new Promise(resolve => setTimeout(resolve, 40)); }
    }
    if (!lock) throw error('The evaluation budget ledger is busy.', 'V2_BUDGET_BUSY');
    try {
      let ledger;
      try { ledger = JSON.parse(await readFile(path, 'utf8')); }
      catch (cause) { if (cause.code !== 'ENOENT') throw cause; ledger = { schema: 1, limitMicroUSD: micros(limitUSD), calls: [] }; }
      if (ledger.schema !== 1 || !Array.isArray(ledger.calls) || !Number.isSafeInteger(ledger.limitMicroUSD) ||
          ledger.limitMicroUSD <= 0 || ledger.limitMicroUSD > micros(researchV2BudgetLimitUSD) ||
          ledger.calls.some(call => !['reserved','settled','uncertain'].includes(call.status) ||
            !Number.isSafeInteger(call.reservedMicroUSD) || call.reservedMicroUSD < 0 ||
            (call.status !== 'reserved' && call.chargedMicroUSD == null) ||
            (call.chargedMicroUSD != null && (!Number.isSafeInteger(call.chargedMicroUSD) || call.chargedMicroUSD < 0))))
        throw error('Invalid evaluation budget ledger.', 'V2_BUDGET_INVALID');
      // An existing ledger's limit may be reduced but never enlarged by a runner.
      ledger.limitMicroUSD = Math.min(ledger.limitMicroUSD, micros(limitUSD));
      const result = update(ledger);
      const temporary = path + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, JSON.stringify(ledger, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, path);
      return result;
    } finally { await lock.close(); await unlink(path + '.lock'); }
  }
  const used = ledger => ledger.calls.reduce((sum, call) => sum + (call.chargedMicroUSD ?? call.reservedMicroUSD), 0);
  const reserve = (details, reservedMicroUSD) => transaction(ledger => {
    if (ledger.overrun || used(ledger) + reservedMicroUSD > ledger.limitMicroUSD)
      throw error('The $7 Research evaluation budget has insufficient unreserved funds.', 'V2_BUDGET_EXHAUSTED');
    const call = { id: randomUUID(), ...details, createdAt: new Date().toISOString(), reservedMicroUSD, status: 'reserved' };
    ledger.calls.push(call);
    return call.id;
  });
  return {
    async reserve(requestBody, phase) {
      const bytes = assertLunaV2Request(requestBody);
      const reservedMicroUSD = Math.ceil((bytes + 8192) * lunaV2Pricing.reservationInput +
        requestBody.max_output_tokens * lunaV2Pricing.reservationOutput);
      return reserve({phase, model: requestBody.model, pricingVersion: lunaV2Pricing.version}, reservedMicroUSD);
    },
    async reserveExperimental(body,phase) {
      const bytes=assertLunaV2Request({...body,tools:[]},{maximumBytes:Infinity});
      if((body.tools||[]).some(t=>!['function','web_search'].includes(t.type)) ||
         (body.tools||[]).some(t=>t.type==='function'&&!['search_library','read_library','search_web','search_conversation','read_conversation'].includes(t.name)) ||
         (body.tools||[]).some(t=>t.type==='web_search') && body.max_tool_calls!==4)
        throw error('Invalid experimental research tools.','V2_REQUEST_LIMIT');
      const web=(body.tools||[]).some(t=>t.type==='web_search');
      return reserve({kind:'experimental',phase,model:body.model,pricingVersion:lunaV2Pricing.version},
        Math.ceil((bytes+8192+(web?128000*5:0))*lunaV2Pricing.reservationInput+body.max_output_tokens*lunaV2Pricing.reservationOutput+(web?40000:0)));
    },
    // Isolated same-evidence evaluations only; application calls remain Luna-only.
    async reserveComparison(body) {
      if(body.model!=='gpt-6.1-sol'||body.service_tier!=='default'||body.store!==false||body.tools?.length||body.background||
        !Number.isSafeInteger(body.max_output_tokens)||body.max_output_tokens<1||body.max_output_tokens>8192||Buffer.byteLength(JSON.stringify(body))>180000)
        throw error('Comparison request exceeds local evaluation limits.','V2_REQUEST_LIMIT');
      return reserve({kind:'comparison',phase:'same-evidence-comparison',model:body.model,pricingVersion:'openai-standard-20261115',
        pricingSource:'https://developers.openai.com/api/docs/changelog'},
        Math.ceil((Buffer.byteLength(JSON.stringify(body))+8192)*5+body.max_output_tokens*10));
    },
    async reserveEmbedding(body) {
      if (body?.model !== researchSemanticEmbeddingModel || body?.dimensions !== researchSemanticEmbeddingDimensions ||
          body?.encoding_format !== 'float' || !Array.isArray(body.input) || !body.input.length || body.input.length > 128 ||
          Object.keys(body).some(key => !['model','dimensions','input','encoding_format'].includes(key)) ||
          body.input.some(input => typeof input !== 'string' || !input.trim() || input.length > researchSemanticEmbeddingMaximumCharacters || Buffer.byteLength(input) > 8192))
        throw error('This embedding is outside the approved local retrieval limits.', 'V2_REQUEST_LIMIT');
      return reserve({kind:'embedding', phase:'retrieval', model:body.model, pricingVersion:researchSemanticEmbeddingPricingVersion},
        micros(researchSemanticEmbeddingReservation(body.input)));
    },
    async settle(id, payload) {
      return transaction(ledger => {
        const call = ledger.calls.find(item => item.id === id);
        if (!call || call.status !== 'reserved') throw error('Unknown or completed budget reservation.', 'V2_BUDGET_RESERVATION');
        const embeddingCost = call.kind === 'embedding' ? researchSemanticEmbeddingCost(payload?.usage) : null;
        let actual = call.kind === 'embedding' ? (embeddingCost === null ? null : micros(embeddingCost)) : lunaUsageMicroUSD(payload);
        if(call.kind==='comparison') {
          const u=payload?.usage,cached=u?.input_tokens_details?.cached_tokens||0,writes=u?.input_tokens_details?.cache_write_tokens||0;
          actual=u&&[u.input_tokens,u.output_tokens,cached,writes].every(n=>Number.isSafeInteger(n)&&n>=0)&&cached<=u.input_tokens
            ? Math.ceil((u.input_tokens-cached)*2+cached*.1+u.output_tokens*10+writes*2.5):null;
        }
        if(call.kind==='experimental'&&actual!==null)actual+=(payload.output||[]).filter(item=>item.type==='web_search_call').length*10000;
        call.chargedMicroUSD = actual ?? call.reservedMicroUSD;
        call.status = actual === null ? 'uncertain' : 'settled';
        call.completedAt = new Date().toISOString();
        if (actual !== null) { call.inputTokens = call.kind === 'embedding' ? payload.usage.total_tokens : payload.usage.input_tokens;
          call.outputTokens = call.kind === 'embedding' ? 0 : payload.usage.output_tokens; }
        if (actual > call.reservedMicroUSD) ledger.overrun = true;
        return { ...call };
      });
    },
    async summary() { return transaction(ledger => ({ limitUSD: ledger.limitMicroUSD / 1e6,
      accountedUSD: used(ledger) / 1e6, settledUSD: ledger.calls.filter(c => c.status === 'settled').reduce((s,c) => s+c.chargedMicroUSD,0)/1e6,
      uncertainOrReservedCalls: ledger.calls.filter(c => c.status !== 'settled').length, callCount: ledger.calls.length })); }
  };
}

export function createLunaV2Client({ apiKey, budget, transport } = {}) {
  if (!apiKey || !budget) throw error('Luna and an evaluation budget must be configured.', 'V2_NOT_CONFIGURED');
  return async (requestBody, { phase, signal } = {}) => {
    signal?.throwIfAborted();
    const id = await budget.reserve(requestBody, phase);
    let payload;
    try {
      if (transport) payload = await transport(requestBody, signal);
      else {
        const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) });
        payload = await response.json();
        if (!response.ok) throw error(`Luna request failed (${response.status}).`, 'V2_PROVIDER_ERROR');
      }
      return payload;
    } finally {
      // A timeout or ambiguous failure consumes the full reservation. No retry,
      // process restart, or missing usage record can silently replenish the cap.
      await budget.settle(id, payload);
    }
  };
}
