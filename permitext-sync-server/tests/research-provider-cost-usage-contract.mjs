import assert from "node:assert/strict";
import { researchProviderCostEntry } from "../research-cost-usage.mjs";
import { requestResearchProvider } from "../research-provider-client.mjs";
import { estimatedResearchCost, beginResearchSpendReservation, endResearchSpendReservation,
  reserveResearchProviderSpend, settleResearchProviderSpend } from "../research-config.mjs";

globalThis.fetch = async () => { throw new Error("External network forbidden in provider cost checks."); };
const environment = {
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "recorded-standard-20260908",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "10", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "100", PERMITEXT_RESEARCH_DAILY_CAP_USD: "100",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "1000"
};
const payload = (input = 1000, cached = 200, written = 300, output = 100) => ({
  model: "gpt-5.6-terra", usage: { input_tokens: input, output_tokens: output,
    input_tokens_details: { cached_tokens: cached, cache_write_tokens: written } }
});
const cost = (response) => estimatedResearchCost({ modelUsage: [researchProviderCostEntry(response)] }, environment).estimatedUSD;
assert.equal(cost(payload()), .00299, "Cache reads, cache writes, uncached input and output have distinct prices.");
assert.equal(cost({ ...payload(), output: [{ type: "web_search_call" }, { type: "message" }, { type: "web_search_call" }] }), .02299);
assert.equal(cost(payload(272000, 0, 0, 1000)), .556, "The boundary remains short context.");
assert.equal(cost(payload(272001, 0, 0, 1000)), 1.106004, "Above the boundary, input doubles and output increases by half.");
assert.equal(cost(payload(272001, 0, 272001, 1000)), 1.378005, "Long-context cache writes include both multipliers.");
assert.equal(cost(payload(1000, 900, 200, 100)), null, "Contradictory cache counters cannot be reported as a priced result.");
assert.equal(cost(payload(1000, 0, -1, 100)), null);
assert.equal(cost({}), null, "Missing provider usage must not become a zero-cost estimate.");
assert.equal(cost({ usage: { input_tokens: null, output_tokens: null } }), null);

for (const finish of ["complete", "fail"]) {
  let attempts = 0;
  beginResearchSpendReservation({ id: `cache-retry-${finish}` }, environment);
  const options = {
    apiKey: "offline-test-double", requestBody: { model: "gpt-5.6-terra", input: "x".repeat(200000), max_output_tokens: 1000 },
    timeoutMilliseconds: 1000, failureMessage: "Offline retry control",
    reserveProviderSpend: (body) => reserveResearchProviderSpend(body, environment),
    settleProviderSpend: (reservation, value) => settleResearchProviderSpend(reservation, value, environment),
    fetchImpl: async () => {
      attempts++;
      return Response.json(payload(200000, 0, 200000, 1000), { status: attempts === 1 || finish === "fail" ? 503 : 200 });
    }
  };
  let usage;
  if (finish === "complete") usage = (await requestResearchProvider(options)).payload.usage;
  else {
    await assert.rejects(requestResearchProvider(options), (error) => {
      usage = error.providerUsage;
      return error.code === "RESEARCH_PROVIDER_ERROR";
    });
  }
  assert.equal(attempts, 2);
  assert.equal(usage.input_tokens_details.cache_write_tokens, 400000);
  assert.deepEqual(usage.permitext_cost_entries.map((entry) => entry.pricingContext), ["short", "short"]);
  assert.equal(estimatedResearchCost({ modelUsage: usage.permitext_cost_entries }, environment).estimatedUSD, 1.024,
    "Two short-context attempts must not be billed as a single long-context request.");
  const spend = endResearchSpendReservation();
  assert.equal(spend.actualUSD, 1.024);
  assert.equal(spend.cacheWriteInputTokens, 400000);
  assert.equal(spend.reservedUSD, 2.036, "The existing conservative token ceiling remains intact.");
  assert.equal(spend.pendingProviderReservationCount, 0);
}

beginResearchSpendReservation({ id: "actual-tools-versus-allowance" }, environment);
const reservation = reserveResearchProviderSpend({ model: "gpt-5.6-terra", input: "text", max_output_tokens: 100,
  tools: [{ type: "web_search" }], max_tool_calls: 1 }, environment);
settleResearchProviderSpend(reservation, { ...payload(), output: [{ type: "web_search_call" }] }, environment);
const tools = endResearchSpendReservation();
assert.equal(tools.actualUSD, .01299);
assert.equal(tools.reservedUSD, .0168, "Actual tool fees must not be double-counted with their full reserved allowance.");
assert.equal(tools.pendingProviderReservationCount, 0);

beginResearchSpendReservation({ id: "invalid-cost-counters" }, environment);
const invalid = reserveResearchProviderSpend({ model: "gpt-5.6-terra", input: "text", max_output_tokens: 100 }, environment);
assert.throws(() => settleResearchProviderSpend(invalid, payload(1000, 900, 200, 100), environment), { code: "RESEARCH_SPEND_CAP" });
assert.equal(endResearchSpendReservation().pendingProviderReservationCount, 1);
console.log("Provider cost usage passed: cache-write premiums, per-request context tiers, tools, retries, failures and preserved conservative caps; no external calls.");
