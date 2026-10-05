import assert from "node:assert/strict";
export const validationPricing = Object.freeze({
  source: "evals/retrieval-companions-2026-10-03/model-policy-v18.json",
  verified: "2026-10-03 America/New_York",
  models: {
    "gpt-6-luna": { input: .10, cached: .01, write: .125, output: .50 },
    "gpt-6.1-sol": { input: 2, cached: .10, write: 2.5, output: 10 }
  },
  unknownOutcome: "Retain entire conservative reservation and block further spending"
});
export function validationReservation(body) {
  const rates = validationPricing.models[body.model]; assert(rates);
  assert(!body.tools?.length && !body.previous_response_id && !body.conversation);
  assert(Number.isSafeInteger(body.max_output_tokens) && body.max_output_tokens > 0);
  assert(["priority", "default"].includes(body.service_tier));
  const bytes = Buffer.byteLength(JSON.stringify(body)) + 8192;
  // Long-context prices, possible cache writes, priority premium and 10% margin
  // bound the request. The envelope's output maximum includes reasoning tokens.
  return (bytes * rates.write * 2 + body.max_output_tokens * rates.output * 1.5) * 2.2 / 1e6;
}
export function validationCost(payload) {
  const rates = validationPricing.models[payload.model] || validationPricing.models[
    String(payload.model || "").startsWith("gpt-6.1-sol") ? "gpt-6.1-sol" :
      String(payload.model || "").startsWith("gpt-6-luna") ? "gpt-6-luna" : "unsupported"];
  assert(rates, "Unexpected returned model must be reconciled before further calls");
  const u = payload.usage; assert(u && Number.isSafeInteger(u.input_tokens) && Number.isSafeInteger(u.output_tokens));
  const cached = u.input_tokens_details?.cached_tokens || 0, writes = u.input_tokens_details?.cache_write_tokens || 0;
  assert(cached >= 0 && writes >= 0 && cached + writes <= u.input_tokens);
  assert(!payload.service_tier || ["default", "priority", "auto", "fast"].includes(payload.service_tier));
  const long = u.input_tokens > 272000, multiplier = ["priority", "fast"].includes(payload.service_tier) ? 2 : 1;
  return (((u.input_tokens - cached - writes) * rates.input + cached * rates.cached + writes * rates.write) * (long ? 2 : 1) +
    u.output_tokens * rates.output * (long ? 1.5 : 1)) * multiplier / 1e6;
}
