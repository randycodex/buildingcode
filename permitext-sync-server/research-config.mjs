import { AsyncLocalStorage } from "node:async_hooks";

export const supportedResearchPromptVersions = [
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

export function researchModelConfiguration(environment = process.env) {
  return {
    model: environment.PERMITEXT_RESEARCH_MODEL || "gpt-5.6-terra",
    reasoningEffort: environment.PERMITEXT_RESEARCH_REASONING_EFFORT || "medium",
    promptVersion: environment.PERMITEXT_RESEARCH_PROMPT_VERSION || researchPromptVersion,
    evidenceVersion: environment.PERMITEXT_RESEARCH_EVIDENCE_VERSION || researchEvidenceVersion
  };
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

function maximumProviderRequestCost(requestBody, environment = process.env) {
  const pricing = researchPricing(environment, requestBody?.model);
  const maxOutputTokens = nonnegativeNumber(requestBody?.max_output_tokens);
  if (pricing.inputRate === null || pricing.outputRate === null || !pricing.pricingVersion || !maxOutputTokens) {
    const error = new Error("Research model requests require versioned pricing and a positive max_output_tokens ceiling.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  const maximumInputTokens = Buffer.byteLength(JSON.stringify(requestBody), "utf8");
  return Math.ceil(
    ((maximumInputTokens * pricing.inputRate + maxOutputTokens * pricing.outputRate) / 1_000_000) * 1_000_000
  ) / 1_000_000;
}

export function beginResearchSpendReservation(reservation, environment = process.env) {
  const guardrails = researchSpendGuardrails(environment);
  if (!guardrails.ready) {
    const error = new Error("Research is temporarily unavailable.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  productionSpendContext.enterWith({
    id: reservation.id,
    maximumRequestUSD: guardrails.maximumRequestUSD,
    reservedUSD: 0,
    actualUSD: 0,
    providerRequestCount: 0,
    pendingProviderReservations: new Map()
  });
  return guardrails;
}

export function reserveResearchProviderSpend(requestBody, environment = process.env) {
  const context = productionSpendContext.getStore();
  if (!context) {
    return { active: false, reservedUSD: 0, actualUSD: 0, providerRequestCount: 0 };
  }
  const maximumRequestUSD = maximumProviderRequestCost(requestBody, environment);
  const nextReservedUSD = Number((context.reservedUSD + maximumRequestUSD).toFixed(6));
  context.reservedUSD = nextReservedUSD;
  context.providerRequestCount += 1;
  const reservationID = `${context.id}:${context.providerRequestCount}`;
  context.pendingProviderReservations.set(reservationID, maximumRequestUSD);
  return {
    active: true,
    reservationID,
    maximumRequestUSD,
    reservedUSD: context.reservedUSD,
    actualUSD: context.actualUSD,
    providerRequestCount: context.providerRequestCount
  };
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
    inputTokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
    outputTokens,
    modelUsage: [{
      model: providerPayload?.model || null,
      inputTokens,
      cachedInputTokens: usage.input_tokens_details?.cached_tokens,
      outputTokens
    }]
  }, environment).estimatedUSD;
  if (actualCost === null) {
    const error = new Error("Research provider usage could not be reconciled against versioned pricing.");
    error.code = "RESEARCH_SPEND_CAP";
    throw error;
  }
  context.pendingProviderReservations.delete(reservation.reservationID);
  context.actualUSD = Number((context.actualUSD + actualCost).toFixed(6));
  context.reservedUSD = Number(Math.max(
    0,
    context.reservedUSD - maximumRequestUSD + actualCost
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
  productionSpendContext.enterWith(null);
  return context ? {
    id: context.id,
    maximumRequestUSD: context.maximumRequestUSD,
    reservedUSD: context.reservedUSD,
    actualUSD: context.actualUSD,
    providerRequestCount: context.providerRequestCount,
    pendingProviderReservationCount: context.pendingProviderReservations.size
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

export function estimatedResearchCost(usage, environment = process.env) {
  const entries = Array.isArray(usage?.modelUsage) && usage.modelUsage.length
    ? usage.modelUsage
    : [usage || {}];
  let estimatedUSD = 0;
  const versions = new Set();
  for (const entry of entries) {
    const { inputRate, cachedInputRate, outputRate, pricingVersion } = researchPricing(
      environment,
      entry?.model
    );
    if (inputRate === null || cachedInputRate === null || outputRate === null || !pricingVersion) {
      return { estimatedUSD: null, pricingVersion: null };
    }
    const inputTokens = nonnegativeNumber(entry?.inputTokens) || 0;
    const cachedInputTokens = Math.min(inputTokens, nonnegativeNumber(entry?.cachedInputTokens) || 0);
    const uncachedInputTokens = inputTokens - cachedInputTokens;
    const outputTokens = nonnegativeNumber(entry?.outputTokens) || 0;
    estimatedUSD += (uncachedInputTokens * inputRate + cachedInputTokens * cachedInputRate + outputTokens * outputRate) / 1_000_000;
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

  const requestCount = evaluationSpendReservation.requestCount + 1;
  const reservationID = `${pricingVersion}:${requestCount}`;
  evaluationSpendReservation.reservedUSD = nextReservedUSD;
  evaluationSpendReservation.requestCount = requestCount;
  evaluationSpendReservation.pendingReservations.set(reservationID, maximumRequestUSD);
  const reservation = {
    active: true,
    configurationKey,
    reservationID,
    maximumRequestUSD,
    capUSD,
    reservedUSD: nextReservedUSD,
    actualUSD: evaluationSpendReservation.actualUSD,
    requestCount,
    pendingRequestCount: evaluationSpendReservation.pendingReservations.size
  };
  return {
    ...reservation,
    settle: (providerPayload) => settleResearchEvaluationSpend(reservation, providerPayload, environment)
  };
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
    inputTokens,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens,
    outputTokens,
    modelUsage: [{
      model: providerPayload?.model || null,
      inputTokens,
      cachedInputTokens: usage?.input_tokens_details?.cached_tokens,
      outputTokens
    }]
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
