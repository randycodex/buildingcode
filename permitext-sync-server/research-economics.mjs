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

function fixedSigned(value, places = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(places)) : 0;
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

function benchmarkRunIntegrity(benchmarkReport = {}) {
  const snapshotProvided = Boolean(
    benchmarkReport &&
    typeof benchmarkReport === "object" &&
    benchmarkReport.configuration &&
    Array.isArray(benchmarkReport.results)
  );
  const configuredCaseIDs = snapshotProvided
    ? (Array.isArray(benchmarkReport.configuration?.caseIDs)
        ? benchmarkReport.configuration.caseIDs.map((value) => String(value || "").trim()).filter(Boolean)
        : [])
    : [];
  const resultCaseIDs = snapshotProvided
    ? benchmarkReport.results.map((result) => String(result?.testCase?.id || "").trim())
    : [];
  const configuredCaseIDSet = new Set(configuredCaseIDs);
  const resultCaseIDSet = new Set(resultCaseIDs);
  const integrity = {
    snapshotProvided,
    completed: snapshotProvided && benchmarkReport.status === "completed",
    gitCommitRecorded: snapshotProvided && /^[a-f0-9]{40}$/.test(
      String(benchmarkReport.configuration?.gitCommit || "")
    ),
    noPendingProviderRequests: snapshotProvided &&
      nonnegativeInteger(benchmarkReport.configuration?.pendingPaidRequestCount) === 0,
    exactCaseSet: snapshotProvided &&
      configuredCaseIDs.length > 0 &&
      configuredCaseIDs.length === configuredCaseIDSet.size &&
      resultCaseIDs.length === configuredCaseIDs.length &&
      resultCaseIDs.length === resultCaseIDSet.size &&
      resultCaseIDs.every((caseID) => configuredCaseIDSet.has(caseID)),
    allResultsComplete: snapshotProvided && benchmarkReport.results.every((result) =>
      !result?.error && result?.operationMetric && result?.scoring
    ),
    allQualityCasesPassed: snapshotProvided && benchmarkReport.results.every((result) =>
      result?.scoring?.passed === true
    )
  };
  return {
    ...integrity,
    pass: Object.values(integrity).every(Boolean)
  };
}

function normalizedPercentileCost(value, label) {
  const p50 = requiredNonnegativeNumber(value?.p50, `${label} p50`);
  const p90 = requiredNonnegativeNumber(value?.p90, `${label} p90`);
  if (p90 < p50) throw new TypeError(`${label} p90 must be at least p50.`);
  return { p50, p90 };
}

function normalizedSubscriberChannel(channel = {}) {
  const normalized = normalizedPricingChannel(channel);
  return {
    ...normalized,
    taxAdministrationRate: boundedRate(
      channel.taxAdministrationRate ?? 0,
      `${normalized.id} tax administration rate`
    ),
    requiredForDecision: channel.requiredForDecision !== false
  };
}

function seededRandom(seed) {
  let state = nonnegativeInteger(seed, 0x5045524d) >>> 0;
  if (state === 0) state = 0x5045524d;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function aggregateSubscriberCostDistributions(costs, turnCounts, iterations, seed) {
  const maximumTurns = Math.max(...turnCounts);
  const samples = new Map(turnCounts.map((turns) => [turns, []]));
  const requestedTurns = new Set(turnCounts);
  const random = seededRandom(seed);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let aggregateCostUSD = 0;
    for (let turn = 1; turn <= maximumTurns; turn += 1) {
      aggregateCostUSD += costs[Math.floor(random() * costs.length)];
      if (requestedTurns.has(turn)) samples.get(turn).push(aggregateCostUSD);
    }
  }
  return new Map(turnCounts.map((turns) => [turns, distribution(samples.get(turns))]));
}

function subscriberCostScenario({
  subscriptionPriceUSD,
  providerCostUSD,
  infrastructureCostUSD,
  supportCostUSD,
  refundReserveRate,
  taxReserveRate,
  minimumContributionUSD,
  channel
}) {
  const paymentFeeUSD = fixed(
    subscriptionPriceUSD * channel.percentageFeeRate + channel.fixedFeeUSD
  );
  const taxReserveUSD = fixed(subscriptionPriceUSD * taxReserveRate);
  const taxAdministrationUSD = fixed(
    subscriptionPriceUSD * channel.taxAdministrationRate
  );
  const refundReserveUSD = fixed(subscriptionPriceUSD * refundReserveRate);
  const fullServiceCostUSD = fixed(
    providerCostUSD +
    paymentFeeUSD +
    taxReserveUSD +
    taxAdministrationUSD +
    refundReserveUSD +
    infrastructureCostUSD +
    supportCostUSD
  );
  const contributionUSD = fixedSigned(subscriptionPriceUSD - fullServiceCostUSD);
  return {
    providerCostUSD: fixed(providerCostUSD),
    paymentFeeUSD,
    taxReserveUSD,
    taxAdministrationUSD,
    refundReserveUSD,
    infrastructureCostUSD: fixed(infrastructureCostUSD),
    supportCostUSD: fixed(supportCostUSD),
    fullServiceCostUSD,
    contributionUSD,
    contributionMarginRate: fixedSigned(contributionUSD / subscriptionPriceUSD, 4),
    nonModelHeadroomUSD: fixedSigned(subscriptionPriceUSD - providerCostUSD),
    contributionPositive: contributionUSD > 0,
    contributionTargetPass: contributionUSD >= minimumContributionUSD
  };
}

/**
 * Aggregates measured per-turn costs into fully utilized subscriber-month
 * distributions, then layers explicit channel, tax, refund, infrastructure,
 * and support assumptions onto p50 and p90 costs. This is local decision
 * support only; it does not call a provider or change any commercial setting.
 */
export function researchSubscriberEconomicsReport(benchmarkReport = {}, assumptions = {}) {
  const integrity = benchmarkRunIntegrity(benchmarkReport);
  if (!integrity.snapshotProvided) {
    throw new TypeError("Research subscriber economics requires a complete benchmark snapshot.");
  }
  const operationCosts = benchmarkReport.results.map((result) => {
    const operation = normalizedOperation(result?.operationMetric || {});
    if (operation.status !== "completed" || !operation.charged) {
      throw new TypeError("Research subscriber economics requires every benchmark result to be completed and charged.");
    }
    return operationCostUSD(operation);
  });
  if (!operationCosts.length || operationCosts.some((cost) => !Number.isFinite(cost) || cost <= 0)) {
    throw new TypeError("Research subscriber economics requires a positive measured cost for every result.");
  }

  const subscriptionPriceUSD = positiveNumber(
    assumptions.subscriptionPriceUSD,
    "Subscription price"
  );
  const currentIncludedTurns = Math.max(
    1,
    nonnegativeInteger(assumptions.currentIncludedTurns)
  );
  const allowanceCandidates = Array.from(new Set(
    [...(Array.isArray(assumptions.allowanceCandidates) ? assumptions.allowanceCandidates : []), currentIncludedTurns]
      .map((value) => nonnegativeInteger(value))
      .filter((value) => value > 0)
  )).sort((left, right) => left - right);
  const bootstrapIterations = Math.max(
    1_000,
    nonnegativeInteger(assumptions.bootstrapIterations, 100_000)
  );
  const bootstrapSeed = nonnegativeInteger(assumptions.bootstrapSeed, 0x5045524d);
  const infrastructureMonthlyUSD = normalizedPercentileCost(
    assumptions.infrastructureMonthlyUSD,
    "Monthly infrastructure cost"
  );
  const fullyUtilizedSubscribers = positiveNumber(
    assumptions.fullyUtilizedSubscribers,
    "Fully utilized subscriber count"
  );
  const subscriberVolumeCandidates = Array.from(new Set(
    [...(Array.isArray(assumptions.subscriberVolumeCandidates)
      ? assumptions.subscriberVolumeCandidates
      : []), fullyUtilizedSubscribers]
      .map((value) => positiveNumber(value, "Subscriber volume candidate"))
  )).sort((left, right) => left - right);
  const supportMinutesPerSubscriber = normalizedPercentileCost(
    assumptions.supportMinutesPerSubscriber,
    "Support minutes per subscriber"
  );
  const supportHourlyCostUSD = requiredNonnegativeNumber(
    assumptions.supportHourlyCostUSD,
    "Support hourly cost"
  );
  const refundReserveRate = boundedRate(
    assumptions.refundReserveRate,
    "Refund reserve rate"
  );
  const refundReserveCandidates = Array.from(new Set(
    [...(Array.isArray(assumptions.refundReserveCandidates)
      ? assumptions.refundReserveCandidates
      : []), refundReserveRate]
      .map((value) => boundedRate(value, "Refund reserve candidate"))
  )).sort((left, right) => left - right);
  const taxReserveRate = boundedRate(
    assumptions.taxReserveRate,
    "Tax reserve rate"
  );
  const targetModelCostPerSubscriberMaximumUSD = positiveNumber(
    assumptions.targetModelCostPerSubscriberMaximumUSD ?? 6,
    "Target model cost per fully utilized subscriber"
  );
  const minimumContributionUSD = requiredNonnegativeNumber(
    assumptions.minimumContributionUSD,
    "Minimum subscriber contribution"
  );
  const channels = (Array.isArray(assumptions.channels) ? assumptions.channels : [])
    .map(normalizedSubscriberChannel);
  if (!channels.length) throw new TypeError("Research subscriber economics requires at least one sales channel.");
  if (new Set(channels.map((channel) => channel.id)).size !== channels.length) {
    throw new TypeError("Research subscriber economics channel IDs must be unique.");
  }
  if (!channels.some((channel) => channel.requiredForDecision)) {
    throw new TypeError("Research subscriber economics requires at least one decision channel.");
  }
  const unverifiedInputs = Array.from(new Set(
    (Array.isArray(assumptions.unverifiedInputs) ? assumptions.unverifiedInputs : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
  const generatedAt = assumptions.generatedAt
    ? new Date(assumptions.generatedAt).toISOString()
    : new Date().toISOString();
  const aggregateCosts = aggregateSubscriberCostDistributions(
    operationCosts,
    allowanceCandidates,
    bootstrapIterations,
    bootstrapSeed
  );
  const infrastructureCostUSD = {
    p50: infrastructureMonthlyUSD.p50 / fullyUtilizedSubscribers,
    p90: infrastructureMonthlyUSD.p90 / fullyUtilizedSubscribers
  };
  const supportCostUSD = {
    p50: supportMinutesPerSubscriber.p50 / 60 * supportHourlyCostUSD,
    p90: supportMinutesPerSubscriber.p90 / 60 * supportHourlyCostUSD
  };
  const allowanceScenarios = allowanceCandidates.map((includedTurns) => {
    const providerCostUSD = aggregateCosts.get(includedTurns);
    const channelScenarios = channels.map((channel) => ({
      id: channel.id,
      requiredForDecision: channel.requiredForDecision,
      p50: subscriberCostScenario({
        subscriptionPriceUSD,
        providerCostUSD: providerCostUSD.p50,
        infrastructureCostUSD: infrastructureCostUSD.p50,
        supportCostUSD: supportCostUSD.p50,
        refundReserveRate,
        taxReserveRate,
        minimumContributionUSD,
        channel
      }),
      p90: subscriberCostScenario({
        subscriptionPriceUSD,
        providerCostUSD: providerCostUSD.p90,
        infrastructureCostUSD: infrastructureCostUSD.p90,
        supportCostUSD: supportCostUSD.p90,
        refundReserveRate,
        taxReserveRate,
        minimumContributionUSD,
        channel
      })
    }));
    const requiredChannelP90Pass = channelScenarios
      .filter((channel) => channel.requiredForDecision)
      .every((channel) => channel.p90.contributionTargetPass);
    const normalizedP90ModelCostPer100USD = fixed(
      providerCostUSD.p90 / includedTurns * 100,
      2
    );
    return {
      includedTurns,
      providerCostUSD,
      normalizedP90ModelCostPer100USD,
      p90ModelTargetPass: providerCostUSD.p90 <= targetModelCostPerSubscriberMaximumUSD,
      requiredChannelP90Pass,
      channels: channelScenarios
    };
  });
  const provisionalIncludedTurns = allowanceScenarios
    .filter((scenario) => scenario.requiredChannelP90Pass && scenario.p90ModelTargetPass)
    .map((scenario) => scenario.includedTurns)
    .at(-1) || null;
  const currentScenario = allowanceScenarios.find((scenario) =>
    scenario.includedTurns === currentIncludedTurns
  );
  const launchVolumeScenarios = subscriberVolumeCandidates.map((subscriberCount) => {
    const scenarioInfrastructureCostUSD = {
      p50: infrastructureMonthlyUSD.p50 / subscriberCount,
      p90: infrastructureMonthlyUSD.p90 / subscriberCount
    };
    return {
      fullyUtilizedSubscribers: subscriberCount,
      infrastructureCostPerSubscriberUSD: {
        p50: fixed(scenarioInfrastructureCostUSD.p50),
        p90: fixed(scenarioInfrastructureCostUSD.p90)
      },
      channels: channels.map((channel) => ({
        id: channel.id,
        requiredForDecision: channel.requiredForDecision,
        p50: subscriberCostScenario({
          subscriptionPriceUSD,
          providerCostUSD: currentScenario.providerCostUSD.p50,
          infrastructureCostUSD: scenarioInfrastructureCostUSD.p50,
          supportCostUSD: supportCostUSD.p50,
          refundReserveRate,
          taxReserveRate,
          minimumContributionUSD,
          channel
        }),
        p90: subscriberCostScenario({
          subscriptionPriceUSD,
          providerCostUSD: currentScenario.providerCostUSD.p90,
          infrastructureCostUSD: scenarioInfrastructureCostUSD.p90,
          supportCostUSD: supportCostUSD.p90,
          refundReserveRate,
          taxReserveRate,
          minimumContributionUSD,
          channel
        })
      }))
    };
  });
  const refundReserveScenarios = refundReserveCandidates.map((candidateRate) => ({
    refundReserveRate: candidateRate,
    channels: channels.map((channel) => ({
      id: channel.id,
      requiredForDecision: channel.requiredForDecision,
      p90: subscriberCostScenario({
        subscriptionPriceUSD,
        providerCostUSD: currentScenario.providerCostUSD.p90,
        infrastructureCostUSD: infrastructureCostUSD.p90,
        supportCostUSD: supportCostUSD.p90,
        refundReserveRate: candidateRate,
        taxReserveRate,
        minimumContributionUSD,
        channel
      })
    }))
  }));
  const minimumFullyUtilizedSubscribersForP90ContributionTarget = channels.map((channel) => {
    const withoutInfrastructure = subscriberCostScenario({
      subscriptionPriceUSD,
      providerCostUSD: currentScenario.providerCostUSD.p90,
      infrastructureCostUSD: 0,
      supportCostUSD: supportCostUSD.p90,
      refundReserveRate,
      taxReserveRate,
      minimumContributionUSD,
      channel
    });
    const availableInfrastructureUSD = withoutInfrastructure.contributionUSD - minimumContributionUSD;
    return {
      id: channel.id,
      fullyUtilizedSubscribers: availableInfrastructureUSD > 0
        ? Math.max(1, Math.ceil(infrastructureMonthlyUSD.p90 / availableInfrastructureUSD))
        : null
    };
  });
  const benchmarkReady = benchmarkReport.economics?.readyForPricingDecision === true && integrity.pass;
  const commercialDecisionReady = benchmarkReady &&
    unverifiedInputs.length === 0 &&
    provisionalIncludedTurns !== null;
  return {
    generatedAt,
    decisionStatus: commercialDecisionReady
      ? "commercial-inputs-verified"
      : "planning-model-commercial-inputs-unverified",
    benchmark: {
      sourceCreatedAt: normalizedString(benchmarkReport.createdAt, 40),
      sourceGitCommit: normalizedString(benchmarkReport.configuration?.gitCommit, 40),
      measuredTurnCount: operationCosts.length,
      measuredTurnCostUSD: distribution(operationCosts),
      readyForPricingDecision: benchmarkReport.economics?.readyForPricingDecision === true,
      runIntegrity: integrity
    },
    assumptions: {
      subscriptionPriceUSD: fixed(subscriptionPriceUSD, 2),
      currentIncludedTurns,
      allowanceCandidates,
      bootstrapIterations,
      bootstrapSeed,
      targetModelCostPerSubscriberMaximumUSD: fixed(targetModelCostPerSubscriberMaximumUSD, 2),
      minimumContributionUSD: fixed(minimumContributionUSD, 2),
      infrastructureMonthlyUSD: {
        p50: fixed(infrastructureMonthlyUSD.p50),
        p90: fixed(infrastructureMonthlyUSD.p90)
      },
      fullyUtilizedSubscribers,
      subscriberVolumeCandidates,
      infrastructureCostPerSubscriberUSD: {
        p50: fixed(infrastructureCostUSD.p50),
        p90: fixed(infrastructureCostUSD.p90)
      },
      supportMinutesPerSubscriber,
      supportHourlyCostUSD: fixed(supportHourlyCostUSD, 2),
      supportCostPerSubscriberUSD: {
        p50: fixed(supportCostUSD.p50),
        p90: fixed(supportCostUSD.p90)
      },
      refundReserveRate,
      refundReserveCandidates,
      taxReserveRate,
      channels,
      unverifiedInputs
    },
    allowanceScenarios,
    launchVolumeScenarios,
    refundReserveScenarios,
    recommendation: {
      currentIncludedTurns,
      provisionalIncludedTurns,
      currentAllowancePlanningP90Pass: Boolean(
        currentScenario?.requiredChannelP90Pass && currentScenario?.p90ModelTargetPass
      ),
      minimumFullyUtilizedSubscribersForP90ContributionTarget,
      benchmarkReady,
      commercialDecisionReady
    }
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
  const hasRunSnapshot = Boolean(
    benchmarkReport &&
    typeof benchmarkReport === "object" &&
    benchmarkReport.configuration &&
    Array.isArray(benchmarkReport.results)
  );
  const economicsReport = hasRunSnapshot ? benchmarkReport.economics || {} : benchmarkReport;
  const economics = economicsReport?.economics || {};
  const completedTurnCost = economics.completedTurnCostUSD || {};
  const p50ProviderCostPerTurnUSD = nonnegativeNumber(completedTurnCost.p50, NaN);
  const p90ProviderCostPerTurnUSD = nonnegativeNumber(completedTurnCost.p90, NaN);
  if (!Number.isFinite(p50ProviderCostPerTurnUSD) || !Number.isFinite(p90ProviderCostPerTurnUSD)) {
    throw new TypeError("Research pack pricing requires benchmark p50 and p90 completed-turn costs.");
  }
  const completedCharged = nonnegativeInteger(economicsReport?.sample?.completedCharged);
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
  const runIntegrity = benchmarkRunIntegrity(benchmarkReport);
  const runIntegrityPass = runIntegrity.pass;
  const pricingDecisionReady = economicsReport?.readyForPricingDecision === true && runIntegrityPass;
  return {
    generatedAt: new Date().toISOString(),
    pricingDecisionReady,
    decisionStatus: pricingDecisionReady
      ? "benchmark-ready"
      : "illustrative-only-benchmark-not-ready",
    benchmark: {
      completedCharged,
      sampleReady: economicsReport?.sample?.sampleReady === true,
      targetReady: economics.targetReady === true,
      chargeIntegrityPass: economicsReport?.charging?.integrityPass === true,
      failedOperationAllowancePerTurnUSD: fixed(failedOperationAllowancePerTurnUSD),
      runIntegrity
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
