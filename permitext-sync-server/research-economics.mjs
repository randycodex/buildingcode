const completedStatuses = new Set(["completed"]);
const failureStatuses = new Set(["failed", "cancelled"]);

function nonnegativeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function nonnegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function fixed(value, places = 6) {
  return Number(nonnegativeNumber(value).toFixed(places));
}

function boundedRate(value, label) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new TypeError(`${label} must be a number from 0 up to, but not including, 1.`);
  }
  return rate;
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive number.`);
  }
  return number;
}

function requiredNonnegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${label} must be a nonnegative number.`);
  }
  return number;
}

function roundUp(value, increment) {
  const units = Math.ceil((value - Number.EPSILON) / increment);
  return fixed(units * increment, 2);
}

function normalizedStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["completed", "failed", "cancelled", "replayed", "rejected"].includes(status)
    ? status
    : "unknown";
}

function normalizedOperation(operation = {}) {
  return {
    ...operation,
    status: normalizedStatus(operation.status),
    charged: operation.charged === true,
    escalated: operation.escalated === true,
    estimatedCostUSD: operation.estimatedCostUSD === null || operation.estimatedCostUSD === undefined
      ? null
      : nonnegativeNumber(operation.estimatedCostUSD, null),
    actualProviderCostUSD: operation.actualProviderCostUSD === null || operation.actualProviderCostUSD === undefined
      ? null
      : nonnegativeNumber(operation.actualProviderCostUSD, null),
    conservativeProviderCostUSD:
      operation.conservativeProviderCostUSD === null || operation.conservativeProviderCostUSD === undefined
        ? null
        : nonnegativeNumber(operation.conservativeProviderCostUSD, null),
    durationMilliseconds: nonnegativeInteger(operation.durationMilliseconds),
    providerRequestCount: nonnegativeInteger(operation.providerRequestCount),
    pendingProviderRequestCount: nonnegativeInteger(operation.pendingProviderRequestCount),
    verificationAttemptCount: nonnegativeInteger(operation.verificationAttemptCount),
    inputTokens: nonnegativeInteger(operation.inputTokens),
    cachedInputTokens: nonnegativeInteger(operation.cachedInputTokens),
    outputTokens: nonnegativeInteger(operation.outputTokens),
    totalTokens: nonnegativeInteger(operation.totalTokens),
    modelUsage: Array.from(new Set(
      (Array.isArray(operation.modelUsage) ? operation.modelUsage : [])
        .map((model) => String(model || "").trim())
        .filter(Boolean)
    )),
    escalationStages: Array.isArray(operation.escalationStages)
      ? operation.escalationStages
      : [],
    verificationIssueTypes: Array.from(new Set(
      (Array.isArray(operation.verificationIssueTypes) ? operation.verificationIssueTypes : [])
        .map((issue) => String(issue || "").trim())
        .filter(Boolean)
    )),
    failureCode: String(operation.failureCode || "").trim() || null
  };
}

function normalizedString(value, maximumLength = 160) {
  return String(value || "").trim().slice(0, maximumLength) || null;
}

export function createResearchOperationMetric(operation = {}) {
  const normalized = normalizedOperation(operation);
  const id = normalizedString(operation.id, 200);
  const createdAt = normalizedString(operation.createdAt, 40);
  if (!id || !createdAt || !Number.isFinite(Date.parse(createdAt))) {
    throw new TypeError("Research operation telemetry requires an ID and timestamp.");
  }
  return {
    schemaVersion: 1,
    id,
    createdAt: new Date(createdAt).toISOString(),
    status: normalized.status,
    mode: normalizedString(operation.mode, 80),
    charged: normalized.charged,
    fundingSource: normalizedString(operation.fundingSource, 80),
    model: normalizedString(operation.model, 160),
    requestedModel: normalizedString(operation.requestedModel, 160),
    modelUsage: normalized.modelUsage,
    routingVersion: normalizedString(operation.routingVersion, 160),
    routingMode: normalizedString(operation.routingMode, 80),
    answerTier: normalizedString(operation.answerTier, 80),
    escalated: normalized.escalated,
    escalationStages: normalized.escalationStages.map((stage) => ({
      stage: normalizedString(stage?.stage, 120),
      fromModel: normalizedString(stage?.fromModel, 160),
      toModel: normalizedString(stage?.toModel, 160),
      reasonCode: normalizedString(stage?.reasonCode, 160),
      issueTypes: Array.from(new Set(
        (Array.isArray(stage?.issueTypes) ? stage.issueTypes : [])
          .map((issue) => normalizedString(issue, 160))
          .filter(Boolean)
      ))
    })),
    verificationAttemptCount: normalized.verificationAttemptCount,
    verificationIssueTypes: normalized.verificationIssueTypes,
    providerRequestCount: normalized.providerRequestCount,
    pendingProviderRequestCount: normalized.pendingProviderRequestCount,
    inputTokens: normalized.inputTokens,
    cachedInputTokens: normalized.cachedInputTokens,
    outputTokens: normalized.outputTokens,
    totalTokens: normalized.totalTokens,
    estimatedCostUSD: normalized.estimatedCostUSD,
    actualProviderCostUSD: normalized.actualProviderCostUSD,
    conservativeProviderCostUSD: normalized.conservativeProviderCostUSD,
    durationMilliseconds: normalized.durationMilliseconds,
    failureCode: normalized.failureCode,
    webSupportRequested: operation.webSupportRequested === true,
    webSupportSearched: operation.webSupportSearched === true,
    pricingVersion: normalizedString(operation.pricingVersion, 240)
  };
}

function operationCostUSD(operation) {
  if (operation.conservativeProviderCostUSD !== null) {
    return operation.conservativeProviderCostUSD;
  }
  if (operation.estimatedCostUSD !== null) return operation.estimatedCostUSD;
  if (operation.actualProviderCostUSD !== null) return operation.actualProviderCostUSD;
  return 0;
}

export function researchPercentile(values, percentile) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  const bounded = Math.min(1, Math.max(0, Number(percentile)));
  const position = (sorted.length - 1) * bounded;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function distribution(values, places = 6) {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!normalized.length) {
    return { count: 0, mean: null, p50: null, p90: null, maximum: null };
  }
  return {
    count: normalized.length,
    mean: Number((normalized.reduce((total, value) => total + value, 0) / normalized.length).toFixed(places)),
    p50: Number(researchPercentile(normalized, 0.5).toFixed(places)),
    p90: Number(researchPercentile(normalized, 0.9).toFixed(places)),
    maximum: Number(Math.max(...normalized).toFixed(places))
  };
}

function increment(map, key) {
  const normalized = String(key || "unknown").trim() || "unknown";
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function sortedCounts(map) {
  return Array.from(map, ([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function researchEconomicsReport(rawOperations = [], options = {}) {
  const operations = rawOperations.map(normalizedOperation);
  const targetMinimumUSD = nonnegativeNumber(options.targetCostPer100MinimumUSD, 4);
  const targetMaximumUSD = Math.max(
    targetMinimumUSD,
    nonnegativeNumber(options.targetCostPer100MaximumUSD, 6)
  );
  const minimumCompletedTurns = Math.max(
    1,
    nonnegativeInteger(options.minimumCompletedTurns, 25)
  );
  const completed = operations.filter((operation) => completedStatuses.has(operation.status));
  const completedCharged = completed.filter((operation) => operation.charged);
  const failures = operations.filter((operation) => failureStatuses.has(operation.status));
  const replayed = operations.filter((operation) => operation.status === "replayed");
  const rejected = operations.filter((operation) => operation.status === "rejected");
  const escalated = completedCharged.filter((operation) => operation.escalated);
  const verificationRevisions = completedCharged.filter((operation) =>
    operation.verificationAttemptCount > 1
  );
  const allCosts = operations.map(operationCostUSD);
  const chargedCosts = completedCharged.map(operationCostUSD);
  const totalOperatingCostUSD = fixed(allCosts.reduce((total, cost) => total + cost, 0));
  const failedOperatingCostUSD = fixed(
    failures.reduce((total, operation) => total + operationCostUSD(operation), 0)
  );
  const amortizedCostPerCompletedTurnUSD = completedCharged.length
    ? fixed(totalOperatingCostUSD / completedCharged.length)
    : null;
  const projectedCostPer100TurnsUSD = amortizedCostPerCompletedTurnUSD === null
    ? null
    : fixed(amortizedCostPerCompletedTurnUSD * 100, 2);
  const modelCounts = new Map();
  const routingCounts = new Map();
  const failureCounts = new Map();
  const escalationStageCounts = new Map();
  const verificationIssueCounts = new Map();
  for (const operation of operations) {
    const models = operation.modelUsage.length
      ? operation.modelUsage
      : [operation.model || operation.requestedModel || "unknown"];
    for (const model of models) increment(modelCounts, model);
    increment(routingCounts, operation.routingMode || operation.answerTier || "unknown");
    if (operation.failureCode) increment(failureCounts, operation.failureCode);
    for (const stage of operation.escalationStages) {
      increment(escalationStageCounts, stage?.stage || "unknown");
    }
    for (const issue of operation.verificationIssueTypes) {
      increment(verificationIssueCounts, issue);
    }
  }
  const failedCharged = failures.filter((operation) => operation.charged);
  const replayedCharged = replayed.filter((operation) => operation.charged);
  const rejectedCharged = rejected.filter((operation) => operation.charged);
  const chargeIntegrityPass = !failedCharged.length && !replayedCharged.length && !rejectedCharged.length;
  const sampleReady = completedCharged.length >= minimumCompletedTurns;
  const targetReady = projectedCostPer100TurnsUSD !== null &&
    projectedCostPer100TurnsUSD <= targetMaximumUSD;
  return {
    generatedAt: new Date().toISOString(),
    targets: {
      minimumCompletedTurns,
      costPer100MinimumUSD: targetMinimumUSD,
      costPer100MaximumUSD: targetMaximumUSD
    },
    sample: {
      operations: operations.length,
      completed: completed.length,
      completedCharged: completedCharged.length,
      completedUncharged: completed.length - completedCharged.length,
      failed: failures.filter((operation) => operation.status === "failed").length,
      cancelled: failures.filter((operation) => operation.status === "cancelled").length,
      replayed: replayed.length,
      rejected: rejected.length,
      sampleReady
    },
    economics: {
      totalOperatingCostUSD,
      failedOperatingCostUSD,
      completedTurnCostUSD: distribution(chargedCosts),
      amortizedCostPerCompletedTurnUSD,
      projectedCostPer100TurnsUSD,
      targetReady,
      targetBand: projectedCostPer100TurnsUSD === null
        ? "unmeasured"
        : projectedCostPer100TurnsUSD < targetMinimumUSD
          ? "below"
          : projectedCostPer100TurnsUSD <= targetMaximumUSD
            ? "within"
            : "above"
    },
    latencyMilliseconds: distribution(
      completedCharged.map((operation) => operation.durationMilliseconds),
      0
    ),
    routing: {
      escalatedTurns: escalated.length,
      escalationRate: completedCharged.length
        ? Number((escalated.length / completedCharged.length).toFixed(4))
        : null,
      verificationRevisionTurns: verificationRevisions.length,
      verificationRevisionRate: completedCharged.length
        ? Number((verificationRevisions.length / completedCharged.length).toFixed(4))
        : null,
      providerRequests: distribution(
        completedCharged.map((operation) => operation.providerRequestCount),
        2
      ),
      models: sortedCounts(modelCounts),
      modes: sortedCounts(routingCounts),
      escalationStages: sortedCounts(escalationStageCounts),
      verificationIssues: sortedCounts(verificationIssueCounts)
    },
    failures: {
      count: failures.length,
      rate: operations.length ? Number((failures.length / operations.length).toFixed(4)) : null,
      codes: sortedCounts(failureCounts)
    },
    charging: {
      chargedCompletedTurns: completedCharged.length,
      unchargedCompletedOperations: completed.length - completedCharged.length,
      failedCharged: failedCharged.length,
      replayedCharged: replayedCharged.length,
      rejectedCharged: rejectedCharged.length,
      integrityPass: chargeIntegrityPass
    },
    readyForPricingDecision: sampleReady && targetReady && chargeIntegrityPass
  };
}

function normalizedPricingChannel(channel = {}) {
  const id = normalizedString(channel.id, 80);
  if (!id) throw new TypeError("Each Research pack pricing channel requires an ID.");
  return {
    id,
    percentageFeeRate: boundedRate(channel.percentageFeeRate, `${id} percentage fee rate`),
    fixedFeeUSD: requiredNonnegativeNumber(channel.fixedFeeUSD, `${id} fixed fee`),
    priceIncrementUSD: positiveNumber(channel.priceIncrementUSD ?? 0.01, `${id} price increment`)
  };
}

function packPriceScenario({
  turns,
  providerCostPerTurnUSD,
  infrastructureCostPerTurnUSD,
  supportReserveRate,
  refundReserveRate,
  targetGrossMarginRate,
  channel
}) {
  const operatingCostUSD = fixed(
    turns * (providerCostPerTurnUSD + infrastructureCostPerTurnUSD)
  );
  const requiredNetRevenueUSD = operatingCostUSD / (1 - targetGrossMarginRate);
  const proportionalDeductions = channel.percentageFeeRate + supportReserveRate + refundReserveRate;
  if (proportionalDeductions >= 1) {
    throw new TypeError(
      `${channel.id} percentage fee and reserve rates must total less than 1.`
    );
  }
  const rawMinimumListPriceUSD =
    (requiredNetRevenueUSD + channel.fixedFeeUSD) / (1 - proportionalDeductions);
  const minimumListPriceUSD = roundUp(rawMinimumListPriceUSD, channel.priceIncrementUSD);
  const paymentFeeUSD = fixed(
    minimumListPriceUSD * channel.percentageFeeRate + channel.fixedFeeUSD
  );
  const supportReserveUSD = fixed(minimumListPriceUSD * supportReserveRate);
  const refundReserveUSD = fixed(minimumListPriceUSD * refundReserveRate);
  const netRevenueUSD = fixed(
    minimumListPriceUSD - paymentFeeUSD - supportReserveUSD - refundReserveUSD
  );
  const grossProfitUSD = fixed(netRevenueUSD - operatingCostUSD);
  const grossMarginRate = netRevenueUSD > 0 ? fixed(grossProfitUSD / netRevenueUSD, 4) : null;
  return {
    providerCostPerTurnUSD: fixed(providerCostPerTurnUSD),
    providerCostUSD: fixed(turns * providerCostPerTurnUSD),
    infrastructureCostUSD: fixed(turns * infrastructureCostPerTurnUSD),
    operatingCostUSD,
    rawMinimumListPriceUSD: fixed(rawMinimumListPriceUSD),
    minimumListPriceUSD,
    paymentFeeUSD,
    supportReserveUSD,
    refundReserveUSD,
    netRevenueUSD,
    grossProfitUSD,
    grossMarginRate
  };
}

/**
 * Converts a clean Research benchmark into minimum sustainable pack-price
 * scenarios. This report is decision support only: it does not configure or
 * expose products, and it remains not ready while the source benchmark is not
 * ready for a pricing decision.
 */
export function researchPackPricingReport(benchmarkReport = {}, assumptions = {}) {
  const economics = benchmarkReport?.economics || {};
  const completedTurnCost = economics.completedTurnCostUSD || {};
  const p50ProviderCostPerTurnUSD = nonnegativeNumber(completedTurnCost.p50, NaN);
  const p90ProviderCostPerTurnUSD = nonnegativeNumber(completedTurnCost.p90, NaN);
  if (!Number.isFinite(p50ProviderCostPerTurnUSD) || !Number.isFinite(p90ProviderCostPerTurnUSD)) {
    throw new TypeError("Research pack pricing requires benchmark p50 and p90 completed-turn costs.");
  }
  const completedCharged = nonnegativeInteger(benchmarkReport?.sample?.completedCharged);
  const failedOperationAllowancePerTurnUSD = completedCharged > 0
    ? nonnegativeNumber(economics.failedOperatingCostUSD) / completedCharged
    : 0;
  const providerCosts = {
    p50: p50ProviderCostPerTurnUSD + failedOperationAllowancePerTurnUSD,
    p90: p90ProviderCostPerTurnUSD + failedOperationAllowancePerTurnUSD
  };
  const infrastructureCostPerTurnUSD = requiredNonnegativeNumber(
    assumptions.infrastructureCostPerTurnUSD,
    "Infrastructure cost per turn"
  );
  const supportReserveRate = boundedRate(
    assumptions.supportReserveRate,
    "Support reserve rate"
  );
  const refundReserveRate = boundedRate(
    assumptions.refundReserveRate,
    "Refund reserve rate"
  );
  const targetGrossMarginRate = boundedRate(
    assumptions.targetGrossMarginRate,
    "Target gross margin rate"
  );
  const turns = Array.from(new Set(
    (Array.isArray(assumptions.packTurnCounts) ? assumptions.packTurnCounts : [25, 100])
      .map((value) => nonnegativeInteger(value))
      .filter((value) => value > 0)
  )).sort((left, right) => left - right);
  if (!turns.length) throw new TypeError("Research pack pricing requires at least one positive turn count.");
  const channels = (Array.isArray(assumptions.channels) ? assumptions.channels : [])
    .map(normalizedPricingChannel);
  if (!channels.length) throw new TypeError("Research pack pricing requires at least one sales channel.");
  if (new Set(channels.map((channel) => channel.id)).size !== channels.length) {
    throw new TypeError("Research pack pricing channel IDs must be unique.");
  }
  const pricingDecisionReady = benchmarkReport?.readyForPricingDecision === true;
  return {
    generatedAt: new Date().toISOString(),
    pricingDecisionReady,
    decisionStatus: pricingDecisionReady
      ? "benchmark-ready"
      : "illustrative-only-benchmark-not-ready",
    benchmark: {
      completedCharged,
      sampleReady: benchmarkReport?.sample?.sampleReady === true,
      targetReady: economics.targetReady === true,
      chargeIntegrityPass: benchmarkReport?.charging?.integrityPass === true,
      failedOperationAllowancePerTurnUSD: fixed(failedOperationAllowancePerTurnUSD)
    },
    assumptions: {
      infrastructureCostPerTurnUSD: fixed(infrastructureCostPerTurnUSD),
      supportReserveRate,
      refundReserveRate,
      targetGrossMarginRate,
      channels
    },
    packs: turns.map((turnCount) => ({
      turns: turnCount,
      channels: channels.map((channel) => ({
        id: channel.id,
        p50: packPriceScenario({
          turns: turnCount,
          providerCostPerTurnUSD: providerCosts.p50,
          infrastructureCostPerTurnUSD,
          supportReserveRate,
          refundReserveRate,
          targetGrossMarginRate,
          channel
        }),
        p90: packPriceScenario({
          turns: turnCount,
          providerCostPerTurnUSD: providerCosts.p90,
          infrastructureCostPerTurnUSD,
          supportReserveRate,
          refundReserveRate,
          targetGrossMarginRate,
          channel
        })
      }))
    }))
  };
}
