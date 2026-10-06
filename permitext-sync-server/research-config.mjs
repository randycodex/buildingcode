import { AsyncLocalStorage } from "node:async_hooks";
import { researchProviderCostEntry } from "./research-cost-usage.mjs";
import {
  researchSemanticEmbeddingCost, researchSemanticEmbeddingReservation,
  researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions,
  researchSemanticEmbeddingMaximumCharacters, researchSemanticEmbeddingPricingVersion
} from "./research-semantic-passages.mjs";

export const supportedResearchPromptVersions = [
  "20261006-site-investigation-v34",
  "20260930-project-investigation-v33",
  "20260930-conversational-fast-v32",
  "20260827-material-completeness-v31",
  "20260827-explicit-unknown-coverage-v29",
  "20260827-authority-term-boundary-v28",
  "20260827-project-condition-coverage-v27",
  "20260827-accessory-group-b-boundary-v26",
  "20260827-pinned-budget-accessory-scope-v25",
  "20260827-user-facing-whitespace-v24",
  "20260827-dining-surface-grammar-v23",
  "20260827-dining-surface-binding-v22",
  "20260827-natural-selected-boundary-v21",
  "20260827-strict-selected-boundary-v20",
  "20260827-consolidated-citation-gates-v19",
  "20260827-unresolved-project-facts-v18",
  "20260827-pinned-answer-scope-v17",
  "20260827-simplified-hybrid-answer-v16",
  "20260826-current-facts-answer-v15",
  "20260826-exact-pinned-answer-v14",
  "20260826-pinned-conjunction-answer-v13",
  "20260826-pinned-selection-answer-v12",
  "20260826-ancestor-scope-answer-v11",
  "20260817-adaptive-answer-v10",
  "20260730-readable-grounded-answer-v9",
  "20260725-grounded-visual-evidence-v8",
  "20260722-grounded-passages-v7"
];
export const researchPromptVersion = process.env.PERMITEXT_RESEARCH_PROMPT_VERSION || supportedResearchPromptVersions[0];
export const researchEvidenceVersion = process.env.PERMITEXT_RESEARCH_EVIDENCE_VERSION || "selected-multimodal-evidence-v3";

let evaluationSpendReservation = {
  configurationKey: "",
  capUSD: null,
  reservedUSD: 0,
  actualUSD: 0,
  requestCount: 0,
  pendingReservations: new Map()
};
const productionSpendContext = new AsyncLocalStorage();

export function researchModelConfiguration(environment = process.env, modelOverride = null) {
  return {
    model: modelOverride || environment.PERMITEXT_RESEARCH_MODEL || "gpt-6-luna",
    reasoningEffort: environment.PERMITEXT_RESEARCH_REASONING_EFFORT || "low",
    verificationReasoningEffort: environment.PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT || "medium",
    serviceTier: modelOverride && modelOverride === environment.PERMITEXT_RESEARCH_ACCURATE_MODEL
      ? environment.PERMITEXT_RESEARCH_ACCURATE_SERVICE_TIER || environment.PERMITEXT_RESEARCH_SERVICE_TIER || "default"
      : environment.PERMITEXT_RESEARCH_SERVICE_TIER || "default",
    promptVersion: environment.PERMITEXT_RESEARCH_PROMPT_VERSION || researchPromptVersion,
    evidenceVersion: environment.PERMITEXT_RESEARCH_EVIDENCE_VERSION || researchEvidenceVersion
  };
}

export function researchAnswerConfigurationForRevision(configuration, options = {}) {
  if (!/^gpt-6-luna(?:-|$)/.test(configuration.model || "") ||
      configuration.reasoningEffort !== "low" ||
      !Array.isArray(options.revisionFeedback) || !options.revisionFeedback.length) {
    return configuration;
  }
  // Use more reasoning within the existing bounded source-verification repair.
  return { ...configuration, reasoningEffort: "medium" };
}

function nonnegativeNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function researchPricing(environment = process.env, model = null) {
  const base = {
    inputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS),
    cachedInputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS),
    outputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS),
    pricingVersion: String(environment.PERMITEXT_RESEARCH_PRICING_VERSION || "").trim()
  };
  const fastModel = String(environment.PERMITEXT_RESEARCH_FAST_MODEL || "").trim();
  if (!model || !fastModel || String(model).trim() !== fastModel) return base;
  const fast = {
    inputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS),
    cachedInputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS),
    outputRate: nonnegativeNumber(environment.PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS),
    pricingVersion: String(environment.PERMITEXT_RESEARCH_FAST_PRICING_VERSION || "").trim()
  };
  return fast.inputRate !== null && fast.cachedInputRate !== null && fast.outputRate !== null && fast.pricingVersion
    ? fast
    : base;
}

export function researchSpendGuardrails(environment = process.env) {
  const enabled = environment.PERMITEXT_RESEARCH_KILL_SWITCH !== "1";
  const maximumRequestUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_MAX_REQUEST_USD);
  const userDailyCapUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_USER_DAILY_CAP_USD);
  const userMonthlyCapUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD);
  const dailyCapUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_DAILY_CAP_USD);
  const monthlyCapUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_MONTHLY_CAP_USD);
  const hosted = environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
  const problems = [];
  if (!enabled) problems.push("The Research kill switch is active.");
  if (!maximumRequestUSD) problems.push("PERMITEXT_RESEARCH_MAX_REQUEST_USD must be a positive amount.");
  if (!userDailyCapUSD) problems.push("PERMITEXT_RESEARCH_USER_DAILY_CAP_USD must be a positive amount.");
  if (!userMonthlyCapUSD) problems.push("PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD must be a positive amount.");
  if (!dailyCapUSD) problems.push("PERMITEXT_RESEARCH_DAILY_CAP_USD must be a positive amount.");
  if (!monthlyCapUSD) problems.push("PERMITEXT_RESEARCH_MONTHLY_CAP_USD must be a positive amount.");
  if (maximumRequestUSD && userDailyCapUSD && maximumRequestUSD > userDailyCapUSD) {
    problems.push("The per-request maximum cannot exceed the per-user daily cap.");
  }
  if (userDailyCapUSD && dailyCapUSD && userDailyCapUSD > dailyCapUSD) {
    problems.push("The per-user daily cap cannot exceed the system daily cap.");
  }
  if (userDailyCapUSD && userMonthlyCapUSD && userDailyCapUSD > userMonthlyCapUSD) {
    problems.push("The per-user daily cap cannot exceed the per-user monthly cap.");
  }
  if (userMonthlyCapUSD && monthlyCapUSD && userMonthlyCapUSD > monthlyCapUSD) {
    problems.push("The per-user monthly cap cannot exceed the system monthly cap.");
  }
  if (dailyCapUSD && monthlyCapUSD && dailyCapUSD > monthlyCapUSD) {
    problems.push("The system daily cap cannot exceed the monthly cap.");
  }
  const pricing = researchPricing(environment);
  if (
    pricing.inputRate === null ||
    pricing.cachedInputRate === null ||
    pricing.outputRate === null ||
    !pricing.pricingVersion
  ) {
    problems.push("Versioned input, cached-input, and output pricing must be configured for Research spend enforcement.");
  }
  return {
    ready: enabled && problems.length === 0,
    enabled,
    hosted,
    problems,
    maximumRequestUSD,
    userDailyCapUSD,
    userMonthlyCapUSD,
    dailyCapUSD,
    monthlyCapUSD,
    pricingVersion: pricing.pricingVersion || null
  };
}

function spendCapError(message) {
  const error = new Error(message);
  error.code = "RESEARCH_SPEND_CAP";
  return error;
}

function providerToolAllowance(requestBody) {
  const tools = requestBody?.tools || [];
  if (!tools.length) return { inputTokens: 0, costUSD: 0 };
  const calls = requestBody.max_tool_calls;
  if (!Number.isSafeInteger(calls) || calls <= 0 || tools.some((tool) =>
    tool.type !== "web_search" || tool.return_token_budget === "unlimited"
  )) throw spendCapError("Research cannot bound this provider tool request.");
  // https://developers.openai.com/api/docs/guides/tools-web-search
  // Search has a 128k context window. Reserve that entire window for every
  // possible tool step and final synthesis, not an average search size.
  // https://developers.openai.com/api/docs/pricing (2026-09-03): $10/1k calls.
  return { inputTokens: 128_000 * (calls + 1), costUSD: calls * 0.01 };
}

function boundedProviderInputTokens(requestBody) {
  // Remote history/files and multimodal tokenization cannot be bounded by
  // serialized text bytes. Fail before dispatch until a reviewed bound exists.
  if (requestBody?.previous_response_id || requestBody?.conversation || requestBody?.prompt ||
      !([undefined, null, "default", "priority", "fast"].includes(requestBody?.service_tier))) {
    throw spendCapError("Research cannot bound this provider input or pricing tier.");
  }
  let imageTokens = 0;
  const textBody = JSON.stringify(requestBody, (key, value) => {
    if (["input_file", "input_audio", "item_reference"].includes(value?.type)) {
      throw spendCapError("Research cannot bound this provider input.");
    }
    if (value?.type === "input_image") {
      if (!/^gpt-5\.6-(?:sol|terra|luna)(?:-\d{4}-\d{2}-\d{2})?$/.test(requestBody.model || "")) {
        throw spendCapError("Research has no reviewed image-token bound for this model.");
      }
      // Official images-vision guide: at most 30,000 patches per image,
      // multiplied by 1.2 for GPT-5.6. Larger images are rejected by the API.
      imageTokens += 36_000;
      return { type: "input_image", detail: value.detail };
    }
    return value;
  });
  return Buffer.byteLength(textBody, "utf8") + 1_024 + imageTokens;
}

function maximumProviderRequestCost(requestBody, environment = process.env) {
  const inputTokens = boundedProviderInputTokens(requestBody);
  const pricing = researchPricing(environment, requestBody?.model);
  const maxOutputTokens = nonnegativeNumber(requestBody?.max_output_tokens);
  if (pricing.inputRate === null || pricing.outputRate === null || !pricing.pricingVersion || !maxOutputTokens) {
    const error = new Error("Research model requests require versioned pricing and a positive max_output_tokens ceiling.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  const toolAllowance = providerToolAllowance(requestBody);
  // Include protocol framing overhead in addition to one token per JSON byte.
  const maximumInputTokens = inputTokens + toolAllowance.inputTokens;
  const ceiling = providerPricingCeiling(requestBody?.model, pricing, requestBody?.service_tier, maximumInputTokens);
  return Math.ceil(
    ((maximumInputTokens * ceiling.inputRate + maxOutputTokens * ceiling.outputRate) / 1_000_000 + toolAllowance.costUSD) * 1_000_000
  ) / 1_000_000;
}

function providerPricingCeiling(model, pricing, serviceTier = "default", maximumInputTokens = null) {
  const multiplier = researchServiceTierMultiplier(serviceTier);
  // GPT-5.6 and GPT-6 long-context cache writes can cost 2.5x standard short-context
  // input; long-context output can cost 1.5x. Do not release these allowances
  // based on a short-context-only usage estimate. Prices remain versioned env.
  const tiered = /^(?:gpt-5\.6-|gpt-6(?:\.1)?-(?:sol|luna)(?:-|$))/.test(model || "");
  // The exact serialized request already bounds text/image/tool input. A Sol
  // request proven below272K cannot incur the long-context premium. Preserve
  // the short-context cache-write premium; unknown/large requests retain the
  // full conservative ceiling. Other model policies remain unchanged.
  const shortSol = /^gpt-6\.1-sol(?:-|$)/.test(model || "") && Number.isFinite(maximumInputTokens) && maximumInputTokens <= 272_000;
  return {
    inputRate: multiplier * Math.max(pricing.inputRate * (shortSol ? 1.25 : tiered ? 2.5 : 1), pricing.cachedInputRate || 0),
    outputRate: multiplier * pricing.outputRate * (shortSol ? 1 : tiered ? 1.5 : 1)
  };
}

// Install a request-local mutable scope before lazy retrieval. Activation still
// requires the caller's durable turn reservation; preparing alone permits no call.
export function prepareResearchSpendReservation() {
  productionSpendContext.enterWith({ prepared: true, active: false });
}

export function beginResearchSpendReservation(reservation, environment = process.env) {
  const guardrails = researchSpendGuardrails(environment);
  if (!guardrails.ready) {
    const error = new Error("Research is temporarily unavailable.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  const values = {
    active: true,
    id: reservation.id,
    maximumRequestUSD: guardrails.maximumRequestUSD,
    reservedUSD: 0,
    actualUSD: 0,
    providerRequestCount: 0,
    cacheWriteInputTokens: 0,
    pendingProviderReservations: new Map(),
    embeddingReservationIDs: new Set(),
    embeddingSettlements: new Map(),
    embeddingModelUsage: []
  };
  const prepared = productionSpendContext.getStore();
  if (prepared?.prepared && !prepared.active) Object.assign(prepared, values);
  else productionSpendContext.enterWith(values);
  return guardrails;
}

export function reserveResearchProviderSpend(requestBody, environment = process.env) {
  const context = productionSpendContext.getStore();
  if (!context?.active) {
    if (environment.VERCEL === "1" || environment.VERCEL_ENV) {
      throw spendCapError("A hosted Research request requires a cumulative spend reservation.");
    }
    return { active: false, reservedUSD: 0, actualUSD: 0, providerRequestCount: 0 };
  }
  const maximumRequestUSD = maximumProviderRequestCost(requestBody, environment);
  const nextReservedUSD = Number((context.reservedUSD + maximumRequestUSD).toFixed(6));
  if (nextReservedUSD > context.maximumRequestUSD) {
    throw spendCapError(`Research stopped before another provider call could exceed the cumulative per-turn spending limit. Reserved upper bound: $${context.reservedUSD.toFixed(6)}; next request upper bound: $${maximumRequestUSD.toFixed(6)}; turn limit: $${context.maximumRequestUSD.toFixed(6)}.`);
  }
  context.reservedUSD = nextReservedUSD;
  context.providerRequestCount += 1;
  const reservationID = `${context.id}:${context.providerRequestCount}`;
  context.pendingProviderReservations.set(reservationID, maximumRequestUSD);
  return {
    active: true,
    reservationID,
    maximumRequestUSD,
    model: requestBody?.model || null,
    serviceTier: requestBody?.service_tier || "default",
    pricingCeiling: providerPricingCeiling(requestBody?.model, researchPricing(environment, requestBody?.model), requestBody?.service_tier,
      boundedProviderInputTokens(requestBody) + providerToolAllowance(requestBody).inputTokens),
    toolAllowanceUSD: providerToolAllowance(requestBody).costUSD,
    reservedUSD: context.reservedUSD,
    actualUSD: context.actualUSD,
    providerRequestCount: context.providerRequestCount
  };
}

export function reserveResearchEmbeddingSpend(requestBody, environment = process.env) {
  const context = productionSpendContext.getStore();
  if (!context?.active) {
    if (environment.VERCEL === "1" || environment.VERCEL_ENV) {
      throw spendCapError("A hosted query embedding requires a durable Research spend reservation.");
    }
    return { active: false };
  }
  const inputs = requestBody?.input;
  if (requestBody?.model !== researchSemanticEmbeddingModel || requestBody?.dimensions !== researchSemanticEmbeddingDimensions ||
      requestBody?.encoding_format !== "float" || Object.keys(requestBody || {}).some(key => !["model", "dimensions", "input", "encoding_format"].includes(key)) ||
      !Array.isArray(inputs) || inputs.length < 1 || inputs.length > 128 || inputs.some(input => typeof input !== "string" ||
        !input.trim() || input.length > researchSemanticEmbeddingMaximumCharacters || Buffer.byteLength(input, "utf8") > 8192)) {
    throw spendCapError("Research cannot bound this query embedding request.");
  }
  const maximumRequestUSD = Math.ceil(researchSemanticEmbeddingReservation(inputs) * 1e6) / 1e6;
  const nextReservedUSD = Number((context.reservedUSD + maximumRequestUSD).toFixed(6));
  if (nextReservedUSD > context.maximumRequestUSD) {
    throw spendCapError("Research stopped before a query embedding could exceed the cumulative per-turn spending limit.");
  }
  context.reservedUSD = nextReservedUSD;
  context.providerRequestCount += 1;
  const reservationID = `${context.id}:${context.providerRequestCount}`;
  context.pendingProviderReservations.set(reservationID, maximumRequestUSD);
  context.embeddingReservationIDs.add(reservationID);
  return { active: true, reservationID, contextID: context.id, maximumRequestUSD,
    model: researchSemanticEmbeddingModel, pricingVersion: researchSemanticEmbeddingPricingVersion };
}

export function settleResearchEmbeddingSpend(reservation, accounting) {
  if (!reservation?.active) return { active: false };
  const context = productionSpendContext.getStore();
  if (!context?.active || context.id !== reservation.contextID || !context.embeddingReservationIDs.has(reservation.reservationID)) {
    throw spendCapError("A query embedding reservation could not be reconciled in its originating request.");
  }
  // Provider callbacks can report an unknown outcome after a settlement error.
  // A known settlement is final and may never be counted twice.
  if (context.embeddingSettlements.has(reservation.reservationID)) return context.embeddingSettlements.get(reservation.reservationID);
  const held = context.pendingProviderReservations.get(reservation.reservationID);
  const totalTokens = accounting?.usage?.total_tokens;
  const promptTokens = accounting?.usage?.prompt_tokens;
  const validUsage = Number.isSafeInteger(totalTokens) && totalTokens >= 0 &&
    (promptTokens == null || (Number.isSafeInteger(promptTokens) && promptTokens === totalTokens));
  const rejected = accounting?.status === "rejected" && accounting?.costUSD === 0 && !validUsage;
  if (!validUsage && !rejected) return { active: true, settled: false, reservationID: reservation.reservationID, maximumRequestUSD: held };
  const actualCost = rejected ? 0 : researchSemanticEmbeddingCost(accounting.usage);
  context.pendingProviderReservations.delete(reservation.reservationID);
  context.actualUSD = Number((context.actualUSD + actualCost).toFixed(6));
  context.reservedUSD = Number(Math.max(0, context.reservedUSD - held + actualCost).toFixed(6));
  if (!rejected) context.embeddingModelUsage.push({ requestKind: "embedding", model: researchSemanticEmbeddingModel,
    dimensions: researchSemanticEmbeddingDimensions, pricingVersion: researchSemanticEmbeddingPricingVersion,
    inputTokens: totalTokens, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0,
    serviceTier: "default", costUsageValid: true });
  const settled = { active: true, settled: true, reservationID: reservation.reservationID, settledUSD: actualCost };
  context.embeddingSettlements.set(reservation.reservationID, settled);
  if (context.reservedUSD > context.maximumRequestUSD || actualCost > held) {
    throw spendCapError("Query embedding usage exceeded its conservative reservation.");
  }
  return settled;
}

export function researchEmbeddingUsage() {
  const context = productionSpendContext.getStore();
  if (!context?.active) return null;
  const modelUsage = context.embeddingModelUsage.map(entry => ({ ...entry }));
  const inputTokens = modelUsage.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const pending = [...context.embeddingReservationIDs].filter(id => context.pendingProviderReservations.has(id));
  return { inputTokens, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, totalTokens: inputTokens,
    providerRequestCount: context.embeddingReservationIDs.size,
    pendingProviderRequestCount: pending.length,
    unreconciledProviderCostUSD: Number(pending.reduce((sum, id) => sum + context.pendingProviderReservations.get(id), 0).toFixed(6)),
    modelUsage };
}

export function settleResearchProviderSpend(reservation, providerPayload, environment = process.env) {
  if (!reservation?.active) return { active: false, reservedUSD: 0, actualUSD: 0, providerRequestCount: 0 };
  const context = productionSpendContext.getStore();
  const maximumRequestUSD = context?.pendingProviderReservations?.get(reservation.reservationID);
  if (!context || maximumRequestUSD === undefined) {
    const error = new Error("A Research provider spend reservation could not be reconciled.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  const usage = providerPayload?.usage;
  const inputTokens = nonnegativeNumber(usage?.input_tokens);
  const outputTokens = nonnegativeNumber(usage?.output_tokens);
  if (inputTokens === null || outputTokens === null) {
    return {
      active: true,
      reservationID: reservation.reservationID,
      maximumRequestUSD,
      reservedUSD: context.reservedUSD,
      actualUSD: context.actualUSD,
      providerRequestCount: context.providerRequestCount,
      settled: false
    };
  }
  const actualCost = estimatedResearchCost({
    modelUsage: [researchProviderCostEntry(providerPayload, reservation.model, reservation.serviceTier)]
  }, environment).estimatedUSD;
  if (actualCost === null) {
    const error = new Error("Research provider usage could not be reconciled against versioned pricing.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  context.pendingProviderReservations.delete(reservation.reservationID);
  // Actual recorded tool fees enter the usage estimate. The full permitted
  // tool allowance still bounds spending, including unreported tool steps.
  const toolAllowanceUSD = reservation.toolAllowanceUSD || 0;
  const tokenCostBound = reservation.pricingCeiling
    ? Math.ceil(inputTokens * reservation.pricingCeiling.inputRate + outputTokens * reservation.pricingCeiling.outputRate) / 1_000_000
    : actualCost;
  context.actualUSD = Number((context.actualUSD + actualCost).toFixed(6));
  context.cacheWriteInputTokens += Number(usage.input_tokens_details?.cache_write_tokens || 0);
  context.reservedUSD = Number(Math.max(
    0,
    context.reservedUSD - maximumRequestUSD + Math.max(actualCost, tokenCostBound + toolAllowanceUSD)
  ).toFixed(6));
  return {
    active: true,
    reservationID: reservation.reservationID,
    maximumRequestUSD,
    reservedUSD: context.reservedUSD,
    actualUSD: context.actualUSD,
    providerRequestCount: context.providerRequestCount,
    settledUSD: actualCost,
    settled: true
  };
}

export function endResearchSpendReservation() {
  const context = productionSpendContext.getStore();
  const embeddingUsage = researchEmbeddingUsage();
  productionSpendContext.enterWith(null);
  return context?.active ? {
    id: context.id,
    maximumRequestUSD: context.maximumRequestUSD,
    reservedUSD: context.reservedUSD,
    actualUSD: context.actualUSD,
    providerRequestCount: context.providerRequestCount,
    cacheWriteInputTokens: context.cacheWriteInputTokens,
    pendingProviderReservationCount: context.pendingProviderReservations.size,
    embeddingUsage
  } : null;
}

export function validatePaidResearchEvaluationEnvironment(environment = process.env) {
  if (environment.PERMITEXT_RUN_PAID_RESEARCH_EVALS !== "1") {
    throw new Error("Paid evals are locked. Ask for spending approval, then set PERMITEXT_RUN_PAID_RESEARCH_EVALS=1.");
  }
  if (!String(environment.OPENAI_API_KEY || "").trim()) {
    throw new Error("Paid evals require OPENAI_API_KEY in the server environment.");
  }
  const pricing = researchPricing(environment);
  if (
    pricing.inputRate === null ||
    pricing.cachedInputRate === null ||
    pricing.outputRate === null ||
    !pricing.pricingVersion
  ) {
    throw new Error(
      "Paid evals require configured input, cached-input, and output token prices plus " +
      "PERMITEXT_RESEARCH_PRICING_VERSION so cost scoring is reliable."
    );
  }
  const approvedSpendCapUSD = nonnegativeNumber(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD);
  if (!approvedSpendCapUSD) {
    throw new Error(
      "Paid evals require PERMITEXT_RESEARCH_EVAL_MAX_USD set to the explicitly approved maximum spend."
    );
  }
  return {
    approvedSpendCapUSD,
    pricingVersion: pricing.pricingVersion
  };
}

export function researchServiceTierMultiplier(serviceTier) {
  if (["fast", "priority"].includes(serviceTier)) return 2;
  return !serviceTier || serviceTier === "default" ? 1 : null;
}

export function estimatedResearchCost(usage, environment = process.env) {
  const entries = Array.isArray(usage?.modelUsage) && usage.modelUsage.length
    ? usage.modelUsage
    : [usage || {}];
  let estimatedUSD = 0;
  const versions = new Set();
  for (const entry of entries) {
    if (!entry || entry.costUsageValid === false) return { estimatedUSD: null, pricingVersion: null };
    if (entry.requestKind === "embedding") {
      if (entry.model !== researchSemanticEmbeddingModel || entry.dimensions !== researchSemanticEmbeddingDimensions ||
          entry.pricingVersion !== researchSemanticEmbeddingPricingVersion || !Number.isSafeInteger(entry.inputTokens) || entry.inputTokens < 0 ||
          entry.outputTokens !== 0 || entry.cachedInputTokens !== 0 || entry.cacheWriteInputTokens !== 0 || entry.serviceTier !== "default") {
        return { estimatedUSD: null, pricingVersion: null };
      }
      estimatedUSD += researchSemanticEmbeddingCost({ total_tokens: entry.inputTokens });
      versions.add(researchSemanticEmbeddingPricingVersion);
      continue;
    }
    const { inputRate, cachedInputRate, outputRate, pricingVersion } = researchPricing(
      environment,
      entry?.model
    );
    if (inputRate === null || cachedInputRate === null || outputRate === null || !pricingVersion) {
      return { estimatedUSD: null, pricingVersion: null };
    }
    const inputTokens = nonnegativeNumber(entry?.inputTokens) || 0;
    const cachedInputTokens = Math.min(inputTokens, nonnegativeNumber(entry?.cachedInputTokens) || 0);
    const cacheWriteInputTokens = nonnegativeNumber(entry?.cacheWriteInputTokens) || 0;
    if (cachedInputTokens + cacheWriteInputTokens > inputTokens) return { estimatedUSD: null, pricingVersion: null };
    const tiered = /^(?:gpt-5\.6-(?:sol|terra|luna)|gpt-6(?:\.1)?-(?:sol|luna))(?:-\d{4}-\d{2}-\d{2})?$/.test(entry?.model || "");
    if (cacheWriteInputTokens && !tiered) return { estimatedUSD: null, pricingVersion: null };
    const longContext = tiered && entry?.pricingContext === "long";
    const uncachedInputTokens = inputTokens - cachedInputTokens - cacheWriteInputTokens;
    const outputTokens = nonnegativeNumber(entry?.outputTokens) || 0;
    // Versioned environment rates remain the standard short-context prices.
    // Official GPT-5.6/GPT-6 rates: writes 1.25x input; long context 2x input/cache
    // and 1.5x output. Tier assignment belongs to each request, not the sum.
    const tierMultiplier = researchServiceTierMultiplier(entry?.serviceTier || "default");
    if (tierMultiplier === null) return { estimatedUSD: null, pricingVersion: null };
    estimatedUSD += tierMultiplier * ((uncachedInputTokens * inputRate + cachedInputTokens * cachedInputRate +
      cacheWriteInputTokens * inputRate * 1.25) * (longContext ? 2 : 1) +
      outputTokens * outputRate * (longContext ? 1.5 : 1)) / 1_000_000;
    estimatedUSD += (nonnegativeNumber(entry?.webSearchCalls) || 0) * 0.01;
    versions.add(pricingVersion);
  }
  return {
    estimatedUSD: Number(estimatedUSD.toFixed(6)),
    pricingVersion: Array.from(versions).sort().join("+")
  };
}

export function estimatedResearchCostWithProviderAllowance(usage, environment = process.env) {
  const estimated = estimatedResearchCost(usage, environment);
  if (estimated.estimatedUSD === null) return estimated;
  const unreconciledProviderCostUSD = nonnegativeNumber(usage?.unreconciledProviderCostUSD) || 0;
  return {
    ...estimated,
    estimatedUSD: Number((estimated.estimatedUSD + unreconciledProviderCostUSD).toFixed(6))
  };
}

export function reserveResearchEvaluationSpend(requestBody, environment = process.env) {
  const rawCap = String(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD || "").trim();
  if (!rawCap) {
    return {
      active: false,
      capUSD: null,
      reservedUSD: 0,
      actualUSD: 0,
      requestCount: 0,
      pendingRequestCount: 0
    };
  }

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
    evaluationSpendReservation = {
      configurationKey,
      capUSD,
      reservedUSD: 0,
      actualUSD: 0,
      requestCount: 0,
      pendingReservations: new Map()
    };
  }

  const maximumRequestUSD = maximumProviderRequestCost(requestBody, environment);
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

  const requestCount = evaluationSpendReservation.requestCount + 1;
  const reservationID = `${pricingVersion}:${requestCount}`;
  evaluationSpendReservation.reservedUSD = nextReservedUSD;
  evaluationSpendReservation.requestCount = requestCount;
  evaluationSpendReservation.pendingReservations.set(reservationID, maximumRequestUSD);
  const reservation = {
    active: true,
    configurationKey,
    reservationID,
    model: requestBody.model,
    serviceTier: requestBody.service_tier || "default",
    maximumRequestUSD,
    capUSD,
    reservedUSD: nextReservedUSD,
    actualUSD: evaluationSpendReservation.actualUSD,
    requestCount,
    pendingRequestCount: evaluationSpendReservation.pendingReservations.size
  };
  return {
    ...reservation,
    cancelBeforeDispatch: () => cancelResearchEvaluationSpendBeforeDispatch(reservation),
    settle: (providerPayload) => settleResearchEvaluationSpend(reservation, providerPayload, environment)
  };
}

// Only the provider client's reservation stage may use this release. Once
// dispatch starts, missing usage or an uncertain response retains its allowance.
export function cancelResearchEvaluationSpendBeforeDispatch(reservation) {
  if (!reservation?.active || reservation.configurationKey !== evaluationSpendReservation.configurationKey) return researchEvaluationSpendStatus();
  const maximumRequestUSD = evaluationSpendReservation.pendingReservations.get(reservation.reservationID);
  if (maximumRequestUSD === undefined) return researchEvaluationSpendStatus();
  evaluationSpendReservation.pendingReservations.delete(reservation.reservationID);
  evaluationSpendReservation.reservedUSD = Number(Math.max(
    evaluationSpendReservation.actualUSD,
    evaluationSpendReservation.reservedUSD - maximumRequestUSD
  ).toFixed(6));
  return researchEvaluationSpendStatus();
}

export function settleResearchEvaluationSpend(reservation, providerPayload, environment = process.env) {
  if (!reservation?.active) {
    return {
      active: false,
      capUSD: null,
      reservedUSD: 0,
      actualUSD: 0,
      requestCount: 0,
      pendingRequestCount: 0,
      settled: false
    };
  }
  const maximumRequestUSD = evaluationSpendReservation.pendingReservations
    ?.get(reservation.reservationID);
  if (
    reservation.configurationKey !== evaluationSpendReservation.configurationKey ||
    maximumRequestUSD === undefined
  ) {
    const error = new Error("A paid evaluation spend reservation could not be reconciled.");
    error.code = "RESEARCH_EVAL_SPEND_CAP";
    throw error;
  }
  const usage = providerPayload?.usage;
  const inputTokens = nonnegativeNumber(usage?.input_tokens);
  const outputTokens = nonnegativeNumber(usage?.output_tokens);
  if (inputTokens === null || outputTokens === null) {
    return { ...researchEvaluationSpendStatus(), reservationID: reservation.reservationID, settled: false };
  }
  const actualCost = estimatedResearchCost({
    modelUsage: [researchProviderCostEntry(providerPayload, reservation.model, reservation.serviceTier)]
  }, environment).estimatedUSD;
  if (actualCost === null) {
    const error = new Error("Paid evaluation usage could not be reconciled against versioned pricing.");
    error.code = "RESEARCH_EVAL_SPEND_CAP";
    throw error;
  }
  evaluationSpendReservation.pendingReservations.delete(reservation.reservationID);
  evaluationSpendReservation.actualUSD = Number(
    (evaluationSpendReservation.actualUSD + actualCost).toFixed(6)
  );
  evaluationSpendReservation.reservedUSD = Number(Math.max(
    evaluationSpendReservation.actualUSD,
    evaluationSpendReservation.reservedUSD - maximumRequestUSD + actualCost
  ).toFixed(6));
  return {
    ...researchEvaluationSpendStatus(),
    reservationID: reservation.reservationID,
    settledUSD: actualCost,
    settled: true
  };
}

export function researchEvaluationSpendStatus() {
  return {
    active: Boolean(evaluationSpendReservation.configurationKey),
    capUSD: evaluationSpendReservation.capUSD,
    reservedUSD: evaluationSpendReservation.reservedUSD,
    actualUSD: evaluationSpendReservation.actualUSD,
    requestCount: evaluationSpendReservation.requestCount,
    pendingRequestCount: evaluationSpendReservation.pendingReservations.size
  };
}
