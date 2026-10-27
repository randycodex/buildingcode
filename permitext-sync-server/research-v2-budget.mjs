import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

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
  const cached = Math.max(0, Math.min(usage.input_tokens, usage.input_tokens_details?.cached_tokens || 0));
  const writes = usage.input_tokens_details?.cache_write_tokens || 0;
  const multiplier = ['fast', 'priority'].includes(payload.service_tier) ? 2 : 1;
  return Math.ceil(((usage.input_tokens - cached) * lunaV2Pricing.input + cached * lunaV2Pricing.cached +
    usage.output_tokens * lunaV2Pricing.output + writes * .25) * multiplier);
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
          ledger.limitMicroUSD > micros(researchV2BudgetLimitUSD)) throw error('Invalid evaluation budget ledger.', 'V2_BUDGET_INVALID');
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
  return {
    async reserve(requestBody, phase) {
      const bytes = Buffer.byteLength(JSON.stringify(requestBody), 'utf8');
      if (bytes > 180_000 || !Number.isSafeInteger(requestBody.max_output_tokens) ||
          requestBody.max_output_tokens < 1 || requestBody.max_output_tokens > 8192 ||
          requestBody.model !== 'gpt-6-luna' || requestBody.service_tier !== 'default' ||
          requestBody.store !== false || requestBody.tools?.length || requestBody.background) {
        throw error('This request is outside the approved Luna evaluation limits.', 'V2_REQUEST_LIMIT');
      }
      const reservedMicroUSD = Math.ceil((bytes + 8192) * lunaV2Pricing.reservationInput +
        requestBody.max_output_tokens * lunaV2Pricing.reservationOutput);
      return transaction(ledger => {
        if (ledger.overrun || used(ledger) + reservedMicroUSD > ledger.limitMicroUSD)
          throw error('The $7 Research evaluation budget has insufficient unreserved funds.', 'V2_BUDGET_EXHAUSTED');
        const call = { id: randomUUID(), phase, model: requestBody.model, createdAt: new Date().toISOString(),
          reservedMicroUSD, status: 'reserved', pricingVersion: lunaV2Pricing.version };
        ledger.calls.push(call);
        return call.id;
      });
    },
    async settle(id, payload) {
      return transaction(ledger => {
        const call = ledger.calls.find(item => item.id === id);
        if (!call || call.status !== 'reserved') throw error('Unknown or completed budget reservation.', 'V2_BUDGET_RESERVATION');
        const actual = lunaUsageMicroUSD(payload);
        call.chargedMicroUSD = actual ?? call.reservedMicroUSD;
        call.status = actual === null ? 'uncertain' : 'settled';
        call.completedAt = new Date().toISOString();
        if (actual !== null) { call.inputTokens = payload.usage.input_tokens; call.outputTokens = payload.usage.output_tokens; }
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
