// Preserve billing dimensions per provider request. Combining retries before
// assigning a context tier would turn two short requests into one long request.
export function researchProviderCostEntry(payload, requestedModel = null) {
  const usage = payload?.usage;
  if (usage?.input_tokens == null || usage?.output_tokens == null) return null;
  const inputTokens = Number(usage.input_tokens);
  const outputTokens = Number(usage.output_tokens);
  const cachedInputTokens = Number(usage.input_tokens_details?.cached_tokens ?? 0);
  const cacheWriteInputTokens = Number(usage.input_tokens_details?.cache_write_tokens ?? 0);
  const costUsageValid = [inputTokens, outputTokens, cachedInputTokens, cacheWriteInputTokens]
    .every((value) => Number.isSafeInteger(value) && value >= 0) &&
    cachedInputTokens + cacheWriteInputTokens <= inputTokens;
  return {
    model: requestedModel || payload.model || null,
    inputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens,
    pricingContext: inputTokens > 272_000 ? "long" : "short",
    webSearchCalls: (Array.isArray(payload.output) ? payload.output : [])
      .filter((item) => item?.type === "web_search_call").length,
    costUsageValid
  };
}
