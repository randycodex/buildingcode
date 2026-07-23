export const researchPromptVersion = process.env.PERMITEXT_RESEARCH_PROMPT_VERSION || "20260722-grounded-passages-v2";
export const researchEvidenceVersion = process.env.PERMITEXT_RESEARCH_EVIDENCE_VERSION || "selected-passages-only-v2";

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

export function estimatedResearchCost(usage, environment = process.env) {
  const inputRate = nonnegativeNumber(environment.PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS);
  const cachedInputRate = nonnegativeNumber(environment.PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS);
  const outputRate = nonnegativeNumber(environment.PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS);
  const pricingVersion = String(environment.PERMITEXT_RESEARCH_PRICING_VERSION || "").trim();
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
