import {
  beginResearchSpendReservation,
  endResearchSpendReservation,
  researchSpendGuardrails,
  reserveResearchProviderSpend
} from "../research-config.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const environment = {
  VERCEL_ENV: "production",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.03",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "10",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "1",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "10",
  PERMITEXT_RESEARCH_PRICING_VERSION: "contract-v1"
};

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
  !researchSpendGuardrails({ ...environment, PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "" }).ready,
  "Missing cached-input pricing was accepted even though actual spend reconciliation needs it."
);

beginResearchSpendReservation({ id: "reservation-contract" }, environment);
const first = reserveResearchProviderSpend({ input: "first", max_output_tokens: 1_000 }, environment);
assert(first.active && first.providerRequestCount === 1, "The first provider request did not reserve spend.");
const second = reserveResearchProviderSpend({ input: "second", max_output_tokens: 1_000 }, environment);
assert(second.providerRequestCount === 2, "The second provider request did not accumulate spend.");
try {
  reserveResearchProviderSpend({ input: "third", max_output_tokens: 1_000 }, environment);
  throw new Error("A Research turn exceeded its reserved maximum.");
} catch (error) {
  assert(error.code === "RESEARCH_SPEND_CAP", "Research overspend returned the wrong error code.");
}
const ended = endResearchSpendReservation();
assert(ended.providerRequestCount === 2, "Research spend reservation did not preserve its audit count.");

try {
  reserveResearchProviderSpend({ input: "unreserved", max_output_tokens: 100 }, environment);
  throw new Error("A hosted provider request ran without a spend reservation.");
} catch (error) {
  assert(error.code === "RESEARCH_SPEND_CAP", "Unreserved production spend returned the wrong error code.");
}

console.log("permitext Research cost guardrail contract passed");
