import {
  beginResearchSpendReservation,
  endResearchSpendReservation,
  estimatedResearchCost,
  researchSpendGuardrails,
  reserveResearchProviderSpend,
  settleResearchProviderSpend
} from "../research-config.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const environment = {
  VERCEL_ENV: "production",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.03",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
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

beginResearchSpendReservation({ id: "reservation-contract" }, environment);
const first = reserveResearchProviderSpend({ input: "first", max_output_tokens: 1_000 }, environment);
assert(first.active && first.providerRequestCount === 1, "The first provider request did not reserve spend.");
const second = reserveResearchProviderSpend({ input: "second", max_output_tokens: 1_000 }, environment);
assert(second.providerRequestCount === 2, "The second provider request did not accumulate spend.");
const third = reserveResearchProviderSpend({ input: "third", max_output_tokens: 1_000 }, environment);
assert(third.providerRequestCount === 3, "Internal dollar telemetry interrupted a Research turn.");
assert(third.reservedUSD > Number(environment.PERMITEXT_RESEARCH_MAX_REQUEST_USD), "The contract did not cross the advisory threshold.");
const ended = endResearchSpendReservation();
assert(ended.providerRequestCount === 3, "Research spend telemetry did not preserve its audit count.");

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
assert(settled.reservedUSD === settled.actualUSD, "Completed requests retained their worst-case reservations.");

const unreserved = reserveResearchProviderSpend({ input: "unreserved", max_output_tokens: 100 }, environment);
assert(!unreserved.active, "Missing telemetry context interrupted an otherwise valid provider request.");

console.log("permitext Research cost guardrail contract passed");
