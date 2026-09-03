import {
  beginResearchSpendReservation,
  endResearchSpendReservation,
  estimatedResearchCost,
  estimatedResearchCostWithProviderAllowance,
  researchSpendGuardrails,
  reserveResearchProviderSpend,
  settleResearchProviderSpend
} from "../research-config.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const environment = {
  VERCEL_ENV: "production",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.05",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "7",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "10",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "1",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "10",
  PERMITEXT_RESEARCH_PRICING_VERSION: "contract-v1"
};

const hybridEnvironment = {
  ...environment,
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "1",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.1",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "luna-contract-v1"
};
const hybridCost = estimatedResearchCost({
  modelUsage: [
    { model: "gpt-5.6-luna", inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
    { model: "gpt-5.6-terra", inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 }
  ]
}, hybridEnvironment);
assert(hybridCost.estimatedUSD === 23, "Hybrid model usage was not priced by the model that incurred it.");
assert(
  hybridCost.pricingVersion === "contract-v1+luna-contract-v1",
  "Hybrid pricing did not retain both version identifiers."
);
const hybridCostWithAllowance = estimatedResearchCostWithProviderAllowance({
  modelUsage: [
    { model: "gpt-5.6-luna", inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 },
    { model: "gpt-5.6-terra", inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 }
  ],
  unreconciledProviderCostUSD: 0.05
}, hybridEnvironment);
assert(
  hybridCostWithAllowance.estimatedUSD === 23.05,
  "Unreconciled provider-attempt allowance was not included in internal cost telemetry."
);

assert(researchSpendGuardrails(environment).ready, "Complete production Research spend caps were rejected.");
assert(
  !researchSpendGuardrails({ ...environment, PERMITEXT_RESEARCH_KILL_SWITCH: "1" }).ready,
  "The Research kill switch did not fail closed."
);
assert(
  !researchSpendGuardrails({ ...environment, PERMITEXT_RESEARCH_DAILY_CAP_USD: "0.5" }).ready,
  "An invalid spend-cap hierarchy was accepted."
);
assert(
  !researchSpendGuardrails({ ...environment, PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "0.5" }).ready,
  "A per-user monthly cap below the per-user daily cap was accepted."
);
assert(
  !researchSpendGuardrails({ ...environment, PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "" }).ready,
  "Missing cached-input pricing was accepted even though actual spend reconciliation needs it."
);

let invalidConfigurationFailedClosed = false;
try {
  beginResearchSpendReservation(
    { id: "invalid-configuration-contract" },
    { ...environment, PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "" }
  );
} catch (error) {
  invalidConfigurationFailedClosed = error?.code === "RESEARCH_SPEND_CAP";
}
assert(
  invalidConfigurationFailedClosed,
  "Incomplete pricing configuration did not fail before a provider spend context could begin."
);

beginResearchSpendReservation({ id: "reservation-contract" }, environment);
const first = reserveResearchProviderSpend({ input: "first", max_output_tokens: 1_000 }, environment);
assert(first.active && first.providerRequestCount === 1, "The first provider request did not reserve spend.");
assert(first.maximumRequestUSD > 0, "The provider reservation did not expose its bounded attempt allowance.");
const second = reserveResearchProviderSpend({ input: "second", max_output_tokens: 1_000 }, environment);
assert(second.providerRequestCount === 2, "The second provider request did not accumulate spend.");
let thirdBlocked = false;
try {
  reserveResearchProviderSpend({ input: "third", max_output_tokens: 1_000 }, environment);
} catch (error) { thirdBlocked = error.code === "RESEARCH_SPEND_CAP"; }
assert(thirdBlocked, "The third internal provider call could exceed the cumulative cap.");
const ended = endResearchSpendReservation();
assert(ended.providerRequestCount === 2, "A blocked call was counted as dispatched.");
assert(ended.reservedUSD === second.reservedUSD, "A blocked call changed the reserved cost.");

beginResearchSpendReservation({ id: "settlement-contract" }, environment);
for (const input of ["analysis", "answer", "verification"]) {
  const reservation = reserveResearchProviderSpend({ input, max_output_tokens: 1_000 }, environment);
  settleResearchProviderSpend(reservation, {
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 20 },
      output_tokens: 100
    }
  }, environment);
}
const settled = endResearchSpendReservation();
assert(settled.providerRequestCount === 3, "A normal three-stage Research turn did not complete.");
assert(settled.pendingProviderReservationCount === 0, "Completed provider reservations remained pending.");
assert(settled.reservedUSD >= settled.actualUSD && settled.reservedUSD < 0.01, "Completed requests did not release their unused token ceiling while retaining uncached allowance.");

beginResearchSpendReservation({ id: "unsettled-contract" }, environment);
const unresolved = reserveResearchProviderSpend({ input: "unresolved", max_output_tokens: 1_000 }, environment);
const unresolvedSettlement = settleResearchProviderSpend(unresolved, {
  error: { code: "service_unavailable" }
}, environment);
assert(!unresolvedSettlement.settled, "Missing provider usage was incorrectly settled as zero cost.");
const unresolvedEnded = endResearchSpendReservation();
assert(
  unresolvedEnded.pendingProviderReservationCount === 1,
  "A failed attempt without usage did not retain its conservative cost reservation."
);
assert(
  unresolvedEnded.reservedUSD === unresolved.maximumRequestUSD && unresolvedEnded.actualUSD === 0,
  "Unresolved provider billing did not retain the exact bounded attempt allowance."
);

let missingContextBlocked = false;
try {
  reserveResearchProviderSpend({ input: "unreserved", max_output_tokens: 100 }, environment);
} catch (error) { missingContextBlocked = error.code === "RESEARCH_SPEND_CAP"; }
assert(missingContextBlocked, "Hosted calls without a cumulative reservation did not fail closed.");
const unreserved = reserveResearchProviderSpend({ input: "unreserved", max_output_tokens: 100 }, {});
assert(!unreserved.active, "Missing telemetry context interrupted an otherwise valid provider request.");

beginResearchSpendReservation({ id: "unsupported-input-contract" }, environment);
for (const extra of [
  { tools: [{ type: "web_search" }] },
  { tools: [{ type: "code_interpreter" }], max_tool_calls: 1 },
  { tools: [{ type: "web_search", return_token_budget: "unlimited" }], max_tool_calls: 1 },
  { input: [{ role: "user", content: [{ type: "input_image", image_url: "https://example.test/image.png" }] }] },
  { previous_response_id: "unbounded-history" },
  { service_tier: "priority" }
]) {
  let blocked = false;
  try { reserveResearchProviderSpend({ input: "text", max_output_tokens: 100, ...extra }, environment); }
  catch (error) { blocked = error.code === "RESEARCH_SPEND_CAP"; }
  assert(blocked, "An unbounded or differently priced request passed the guard.");
}
assert(endResearchSpendReservation().providerRequestCount === 0, "An unbounded request reserved spend.");

const toolEnvironment = { ...hybridEnvironment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "2", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "3" };
beginResearchSpendReservation({ id: "tool-cost-contract" }, toolEnvironment);
const web = reserveResearchProviderSpend({
  model: "gpt-5.6-luna", input: "official guidance", max_output_tokens: 100,
  tools: [{ type: "web_search" }], max_tool_calls: 3
}, toolEnvironment);
assert(web.maximumRequestUSD >= 1.31, "Search context tokens, tiered pricing, or the three tool fees were omitted.");
settleResearchProviderSpend(web, {
  model: "gpt-5.6-luna", usage: { input_tokens: 100, output_tokens: 100 }
}, toolEnvironment);
const webSettled = endResearchSpendReservation();
assert(webSettled.reservedUSD >= webSettled.actualUSD + 0.03, "Tool fees were incorrectly released as zero.");

beginResearchSpendReservation({ id: "bounded-image-contract" }, toolEnvironment);
const image = reserveResearchProviderSpend({
  model: "gpt-5.6-luna", max_output_tokens: 100,
  input: [{ role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,fixture", detail: "original" }] }]
}, toolEnvironment);
assert(image.maximumRequestUSD >= 0.09, "The documented image-patch ceiling was not reserved.");
endResearchSpendReservation();

// Independent request contexts must not consume or release each other's cap.
const isolated = await Promise.all(["request-a", "request-b"].map(async (id) => {
  beginResearchSpendReservation({ id }, environment);
  const held = reserveResearchProviderSpend({ input: id, max_output_tokens: 100 }, environment);
  await Promise.resolve();
  settleResearchProviderSpend(held, { usage: { input_tokens: 10, output_tokens: 10 } }, environment);
  return endResearchSpendReservation();
}));
assert(isolated[0].id === "request-a" && isolated[1].id === "request-b", "Concurrent Research contexts leaked.");
assert(isolated.every((item) => item.providerRequestCount === 1 && item.pendingProviderReservationCount === 0), "Concurrent reservations did not settle independently.");
endResearchSpendReservation();

console.log("permitext Research cost guardrail contract passed");
