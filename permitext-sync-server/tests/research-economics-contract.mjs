import assert from "node:assert/strict";
import {
  createResearchOperationMetric,
  researchEconomicsReport,
  researchPackPricingReport,
  researchPercentile
} from "../research-economics.mjs";

const privacySafeMetric = createResearchOperationMetric({
  id: "operation-1",
  createdAt: "2026-08-26T12:00:00.000Z",
  status: "completed",
  charged: true,
  model: "gpt-5.6-luna",
  question: "Private question",
  answer: "Private answer",
  projectFacts: ["Private address"]
});
assert.equal(privacySafeMetric.id, "operation-1");
assert.equal(privacySafeMetric.model, "gpt-5.6-luna");
assert.equal("question" in privacySafeMetric, false);
assert.equal("answer" in privacySafeMetric, false);
assert.equal("projectFacts" in privacySafeMetric, false);

assert.equal(researchPercentile([], 0.5), null);
assert.equal(researchPercentile([1], 0.9), 1);
assert.equal(researchPercentile([1, 2, 3, 4], 0.5), 2.5);
assert.equal(researchPercentile([1, 2, 3, 4], 0.9), 3.7);

const completed = Array.from({ length: 25 }, (_, index) => ({
  id: `completed-${index}`,
  status: "completed",
  charged: true,
  requestedModel: "gpt-5.6-luna",
  model: index < 20 ? "gpt-5.6-luna" : "gpt-5.6-terra",
  modelUsage: index < 20
    ? ["gpt-5.6-luna"]
    : ["gpt-5.6-luna", "gpt-5.6-terra"],
  routingMode: "hybrid",
  answerTier: index < 20 ? "fast" : "accurate",
  escalated: index >= 20,
  escalationStages: index >= 20 ? [{ stage: "answer_verification_revision" }] : [],
  verificationAttemptCount: index >= 20 ? 2 : 1,
  verificationIssueTypes: index >= 20 ? ["unsupported_claim"] : [],
  providerRequestCount: index >= 20 ? 4 : 3,
  estimatedCostUSD: index >= 20 ? 0.08 : 0.02,
  conservativeProviderCostUSD: index >= 20 ? 0.08 : 0.02,
  durationMilliseconds: index >= 20 ? 40_000 : 20_000
}));

const report = researchEconomicsReport([
  ...completed,
  {
    id: "failed-1",
    status: "failed",
    charged: false,
    failureCode: "RESEARCH_PROVIDER_ERROR",
    conservativeProviderCostUSD: 0.05,
    providerRequestCount: 1,
    durationMilliseconds: 2_000
  },
  {
    id: "replayed-1",
    status: "replayed",
    charged: false,
    durationMilliseconds: 30
  },
  {
    id: "project-context-1",
    status: "completed",
    charged: false,
    model: "permitext-project-context",
    routingMode: "project_context",
    durationMilliseconds: 100
  }
]);

assert.equal(report.sample.completedCharged, 25);
assert.equal(report.sample.completedUncharged, 1);
assert.equal(report.sample.failed, 1);
assert.equal(report.sample.replayed, 1);
assert.equal(report.sample.sampleReady, true);
assert.equal(report.economics.totalOperatingCostUSD, 0.85);
assert.equal(report.economics.failedOperatingCostUSD, 0.05);
assert.equal(report.economics.amortizedCostPerCompletedTurnUSD, 0.034);
assert.equal(report.economics.projectedCostPer100TurnsUSD, 3.4);
assert.equal(report.economics.targetBand, "below");
assert.equal(report.economics.targetReady, true);
assert.equal(report.latencyMilliseconds.p50, 20_000);
assert.equal(report.latencyMilliseconds.p90, 40_000);
assert.equal(report.routing.escalatedTurns, 5);
assert.equal(report.routing.escalationRate, 0.2);
assert.equal(report.routing.verificationRevisionRate, 0.2);
assert.equal(report.failures.codes[0].key, "RESEARCH_PROVIDER_ERROR");
assert.equal(report.charging.integrityPass, true);
assert.equal(report.readyForPricingDecision, true);

const unsafeCharging = researchEconomicsReport([
  { status: "completed", charged: true, estimatedCostUSD: 0.01 },
  { status: "failed", charged: true, estimatedCostUSD: 0.01 }
], { minimumCompletedTurns: 1 });
assert.equal(unsafeCharging.charging.failedCharged, 1);
assert.equal(unsafeCharging.charging.integrityPass, false);
assert.equal(unsafeCharging.readyForPricingDecision, false);

const pricing = researchPackPricingReport(report, {
  infrastructureCostPerTurnUSD: 0.005,
  supportReserveRate: 0.04,
  refundReserveRate: 0.02,
  targetGrossMarginRate: 0.6,
  channels: [
    { id: "web", percentageFeeRate: 0.03, fixedFeeUSD: 0.30, priceIncrementUSD: 0.01 },
    { id: "ios", percentageFeeRate: 0.15, fixedFeeUSD: 0, priceIncrementUSD: 0.01 }
  ]
});
assert.equal(pricing.pricingDecisionReady, true);
assert.equal(pricing.decisionStatus, "benchmark-ready");
assert.equal(pricing.packs.length, 2);
assert.equal(pricing.packs[0].turns, 25);
assert.equal(pricing.packs[1].turns, 100);
assert.equal(pricing.benchmark.failedOperationAllowancePerTurnUSD, 0.002);
const webP90 = pricing.packs[0].channels.find((channel) => channel.id === "web").p90;
const iosP90 = pricing.packs[0].channels.find((channel) => channel.id === "ios").p90;
assert.equal(webP90.providerCostPerTurnUSD, 0.082);
assert.equal(webP90.operatingCostUSD, 2.175);
assert.equal(webP90.minimumListPriceUSD, 6.31);
assert.equal(webP90.grossMarginRate >= 0.6, true);
assert.equal(iosP90.minimumListPriceUSD, 6.89);
assert.equal(iosP90.grossMarginRate >= 0.6, true);

const illustrativePricing = researchPackPricingReport(unsafeCharging, {
  infrastructureCostPerTurnUSD: 0,
  supportReserveRate: 0,
  refundReserveRate: 0,
  targetGrossMarginRate: 0.5,
  packTurnCounts: [25],
  channels: [{ id: "web", percentageFeeRate: 0, fixedFeeUSD: 0 }]
});
assert.equal(illustrativePricing.pricingDecisionReady, false);
assert.equal(illustrativePricing.decisionStatus, "illustrative-only-benchmark-not-ready");

assert.throws(
  () => researchPackPricingReport(report, {
    infrastructureCostPerTurnUSD: 0,
    supportReserveRate: 0.5,
    refundReserveRate: 0.5,
    targetGrossMarginRate: 0.5,
    channels: [{ id: "web", percentageFeeRate: 0, fixedFeeUSD: 0 }]
  }),
  /must total less than 1/
);

console.log("permitext Research economics contract passed");
