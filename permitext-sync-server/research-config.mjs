export const supportedResearchPromptVersions = ["20260722-grounded-passages-v7"];
export const researchPromptVersion = process.env.PERMITEXT_RESEARCH_PROMPT_VERSION || supportedResearchPromptVersions[0];
export const researchEvidenceVersion = process.env.PERMITEXT_RESEARCH_EVIDENCE_VERSION || "selected-passages-only-v2";

let evaluationSpendReservation = {
  configurationKey: "",
  capUSD: null,
  reservedUSD: 0,
  requestCount: 0
};

export function researchModelConfiguration(environment = process.env) {
  return {
    model: environment.PERMITEXT_RESEARCH_MODEL || "gpt-5.6-terra",
    reasoningEffort: environment.PERMITEXT_RESEARCH_REASONING_EFFORT || "medium",
    promptVersion: environment.PERMITEXT_RESEARCH_PROMPT_VERSION || researchPromptVersion,
    evidenceVersion: environment.PERMITEXT_RESEARCH_EVIDENCE_VERSION || researchEvidenceVersion
  };
}

function nonnegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function researchPricing(environment = process.env) {
  return {
    inputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS),
    cachedInputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS),
    outputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS),
    pricingVersion: String(environment.PERMITEXT_RESEARCH_PRICING_VERSION || "").trim()
  };
}

export function estimatedResearchCost(usage, environment = process.env) {
  const { inputRate, cachedInputRate, outputRate, pricingVersion } = researchPricing(environment);
  if (inputRate === null || cachedInputRate === null || outputRate === null || !pricingVersion) {
    return { estimatedUSD: null, pricingVersion: null };
  }
  const inputTokens = nonnegativeNumber(usage?.inputTokens) || 0;
  const cachedInputTokens = Math.min(inputTokens, nonnegativeNumber(usage?.cachedInputTokens) || 0);
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const outputTokens = nonnegativeNumber(usage?.outputTokens) || 0;
  return {
    estimatedUSD: Number(((uncachedInputTokens * inputRate + cachedInputTokens * cachedInputRate + outputTokens * outputRate) / 1_000_000).toFixed(6)),
    pricingVersion
  };
}

export function reserveResearchEvaluationSpend(requestBody, environment = process.env) {
  const rawCap = String(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD || "").trim();
  if (!rawCap) return { active: false, capUSD: null, reservedUSD: 0, requestCount: 0 };

  const capUSD = nonnegativeNumber(rawCap);
  const { inputRate, cachedInputRate, outputRate, pricingVersion } = researchPricing(environment);
  if (!capUSD || inputRate === null || cachedInputRate === null || outputRate === null || !pricingVersion) {
    const error = new Error("The paid evaluation cap and all versioned token prices must be configured before a model request.");
    error.code = "RESEARCH_EVAL_SPEND_CAP";
    throw error;
  }
  const maxOutputTokens = nonnegativeNumber(requestBody?.max_output_tokens);
  if (!maxOutputTokens) {
    const error = new Error("A paid evaluation request must declare a positive max_output_tokens value.");
    error.code = "RESEARCH_EVAL_SPEND_CAP";
    throw error;
  }

  const configurationKey = [capUSD, inputRate, cachedInputRate, outputRate, pricingVersion].join(":");
  if (evaluationSpendReservation.configurationKey !== configurationKey) {
    evaluationSpendReservation = { configurationKey, capUSD, reservedUSD: 0, requestCount: 0 };
  }

  // A tokenizer token cannot represent less than one byte. Treating every UTF-8
  // request byte as an uncached input token therefore overestimates input cost.
  // max_output_tokens is the provider-enforced ceiling for billed output/reasoning.
  const maximumInputTokens = Buffer.byteLength(JSON.stringify(requestBody), "utf8");
  const maximumRequestUSD = Math.ceil(
    ((maximumInputTokens * inputRate + maxOutputTokens * outputRate) / 1_000_000) * 1_000_000
  ) / 1_000_000;
  const nextReservedUSD = Number((evaluationSpendReservation.reservedUSD + maximumRequestUSD).toFixed(6));
  if (nextReservedUSD > capUSD) {
    const error = new Error(
      `The next paid evaluation request could exceed the approved $${capUSD.toFixed(2)} cap ` +
      `($${evaluationSpendReservation.reservedUSD.toFixed(6)} already reserved; ` +
      `$${maximumRequestUSD.toFixed(6)} maximum for the next request).`
    );
    error.code = "RESEARCH_EVAL_SPEND_CAP";
    throw error;
  }

  evaluationSpendReservation = {
    ...evaluationSpendReservation,
    reservedUSD: nextReservedUSD,
    requestCount: evaluationSpendReservation.requestCount + 1
  };
  return { active: true, ...evaluationSpendReservation };
}

export function researchEvaluationSpendStatus() {
  return {
    active: Boolean(evaluationSpendReservation.configurationKey),
    capUSD: evaluationSpendReservation.capUSD,
    reservedUSD: evaluationSpendReservation.reservedUSD,
    requestCount: evaluationSpendReservation.requestCount
  };
}
