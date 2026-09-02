export const researchProductExampleRepairedRuntimeEnvironmentVersion =
  "20260902-isolated-spend-guardrails-v1";

function positiveAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TypeError(`${label} must be a positive amount.`);
  }
  return amount;
}

export function researchProductExampleRepairedRuntimeEnvironment(
  environment = process.env,
  { maximumCumulativeSpendUSD } = {}
) {
  const capUSD = positiveAmount(
    maximumCumulativeSpendUSD,
    "The repaired confirmation cumulative spend cap"
  );
  const cap = String(capUSD);
  const maximumRequest = String(Math.min(1, capUSD));
  return {
    ...environment,
    PERMITEXT_RESEARCH_EVAL_MAX_USD: cap,
    PERMITEXT_RESEARCH_MAX_REQUEST_USD: maximumRequest,
    PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: cap,
    PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: cap,
    PERMITEXT_RESEARCH_DAILY_CAP_USD: cap,
    PERMITEXT_RESEARCH_MONTHLY_CAP_USD: cap,
    PERMITEXT_RESEARCH_KILL_SWITCH: "0",
    PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0"
  };
}
