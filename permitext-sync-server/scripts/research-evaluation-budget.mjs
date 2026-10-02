// Experiment-only shared ledger. Never used by production billing.
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from "node:fs";
import assert from "node:assert/strict";

export const evaluationPricing = Object.freeze({
  model: "gpt-6-luna", input: 0.10, cached: 0.01, write: 0.125, output: 0.50,
  source: "https://developers.openai.com/api/docs/models/gpt-6-luna",
  verified: "2026-10-01 America/New_York"
});

export function evaluationReservation(body) {
  assert.equal(body.model, evaluationPricing.model);
  assert(!body.tools?.length && !body.previous_response_id && !body.conversation);
  assert(!body.service_tier || body.service_tier === "default");
  assert(Number.isSafeInteger(body.max_output_tokens) && body.max_output_tokens > 0);
  // UTF-8 bytes exceed text token count; overhead covers schema/control tokens.
  // Price all input at cache-write rates, long-context and fast premiums, plus
  // a 10% margin. Unknown outcomes keep this entire reservation charged.
  const inputBound = Buffer.byteLength(JSON.stringify(body)) + 8192;
  return (inputBound * .125 * 2 + body.max_output_tokens * .5 * 1.5) * 2.2 / 1e6;
}

export function evaluationCost(payload) {
  const u = payload.usage;
  if (!u || !Number.isSafeInteger(u.input_tokens) || !Number.isSafeInteger(u.output_tokens)) return null;
  const cached = u.input_tokens_details?.cached_tokens || 0;
  const writes = u.input_tokens_details?.cache_write_tokens || 0;
  assert(cached >= 0 && writes >= 0 && cached + writes <= u.input_tokens);
  const long = u.input_tokens > 272000;
  const tier = payload.service_tier;
  assert(!tier || ["default", "auto", "priority", "fast"].includes(tier), "Unknown pricing tier");
  const multiplier = ["priority", "fast"].includes(tier) ? 2 : 1;
  return (((u.input_tokens - cached - writes) * .1 + cached * .01 + writes * .125) * (long ? 2 : 1) +
    u.output_tokens * .5 * (long ? 1.5 : 1)) * multiplier / 1e6;
}

export function evaluationBudget(path, capUSD = 15.73) {
  assert(path && Number.isFinite(capUSD) && capUSD > 0 && capUSD <= 15.73);
  const transaction = update => {
    const lock = `${path}.lock`;
    const fd = openSync(lock, "wx", 0o600);
    try {
      let ledger;
      try { ledger = JSON.parse(readFileSync(path, "utf8")); }
      catch (e) { if (e.code !== "ENOENT") throw e; ledger = { version: 1, capUSD, pricing: evaluationPricing, calls: [] }; }
      assert.equal(ledger.capUSD, capUSD, "Never silently reset or expand a campaign budget");
      const result = update(ledger);
      writeFileSync(`${path}.tmp`, JSON.stringify(ledger, null, 2), { mode: 0o600 });
      renameSync(`${path}.tmp`, path);
      return result;
    } finally { closeSync(fd); unlinkSync(lock); }
  };
  return {
    reserve(call) { return transaction(ledger => {
      assert(!ledger.calls.some(c => c.id === call.id), "Duplicate reservation");
      assert(!ledger.calls.some(c => ["pending", "unknown"].includes(c.status)), "Reconcile unsettled calls before further spending");
      const spent = ledger.calls.reduce((sum, c) => sum + (c.costUSD ?? c.reservedUSD), 0);
      assert(call.reservedUSD > 0 && Number.isFinite(call.reservedUSD));
      if (spent + call.reservedUSD > capUSD) throw Object.assign(Error("Campaign spending cap reached"), { code: "RESEARCH_EVAL_SPEND_CAP" });
      ledger.calls.push({ ...call, status: "pending" });
    }); },
    settle(id, result) { return transaction(ledger => {
      const call = ledger.calls.find(c => c.id === id);
      assert(call && call.status === "pending", "Only a pending call can settle");
      assert(["settled", "unknown", "rejected"].includes(result.status));
      if (result.costUSD != null) assert(result.costUSD >= 0 && result.costUSD <= call.reservedUSD,
        "Cost exceeded reservation; stop and reconcile before further spending");
      Object.assign(call, result);
    }); },
    snapshot() { return transaction(ledger => structuredClone(ledger)); }
  };
}
