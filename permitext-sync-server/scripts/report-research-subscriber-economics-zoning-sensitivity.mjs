import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { researchPercentile } from "../research-economics.mjs";
import {
  createV6SubscriberEconomicsReport,
  v6SubscriberEconomicsAssumptions
} from "./report-research-subscriber-economics-v6.mjs";

const v6ResultURL = new URL(
  "../evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json",
  import.meta.url
);
const zoningResultURL = new URL(
  "../evals/results/2026-08-30T16-28-27-054Z-5b54b6cf-2a04-4a4a-a920-edb2d65bf4f6.json",
  import.meta.url
);

export const zoningSubscriberSensitivityAssumptions = Object.freeze({
  generatedAt: "2026-08-30T16:45:00.000Z",
  includedTurns: 100,
  zoningTurnShares: [0, 0.25, 0.50, 1],
  bootstrapIterations: 100_000,
  bootstrapSeed: v6SubscriberEconomicsAssumptions.bootstrapSeed
});

function operationCost(operation = {}) {
  for (const value of [
    operation.conservativeProviderCostUSD,
    operation.estimatedCostUSD,
    operation.actualProviderCostUSD
  ]) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  throw new TypeError("A benchmark operation has no measured provider cost.");
}

function completedChargedCosts(result) {
  return result.results
    .map((item) => item.operationMetric)
    .filter((operation) => operation?.status === "completed" && operation.charged === true)
    .map(operationCost);
}

function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x5045524d;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function distribution(values) {
  return {
    count: values.length,
    mean: Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(6)),
    p50: Number(researchPercentile(values, 0.5).toFixed(6)),
    p90: Number(researchPercentile(values, 0.9).toFixed(6)),
    maximum: Number(Math.max(...values).toFixed(6))
  };
}

function bootstrapMixedMonths({
  regularCosts,
  zoningCosts,
  includedTurns,
  zoningTurnShare,
  iterations,
  seed
}) {
  const zoningTurns = Math.round(includedTurns * zoningTurnShare);
  const regularTurns = includedTurns - zoningTurns;
  const random = seededRandom(seed);
  const totals = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let turn = 0; turn < regularTurns; turn += 1) {
      total += regularCosts[Math.floor(random() * regularCosts.length)];
    }
    for (let turn = 0; turn < zoningTurns; turn += 1) {
      total += zoningCosts[Math.floor(random() * zoningCosts.length)];
    }
    totals.push(total);
  }
  return {
    zoningTurns,
    regularTurns,
    providerCostUSD: distribution(totals)
  };
}

function p90ChannelContribution(providerCostUSD, channelID) {
  const assumptions = v6SubscriberEconomicsAssumptions;
  const channel = assumptions.channels.find((candidate) => candidate.id === channelID);
  const paymentFee = assumptions.subscriptionPriceUSD * channel.percentageFeeRate + channel.fixedFeeUSD;
  const taxReserve = assumptions.subscriptionPriceUSD * assumptions.taxReserveRate;
  const taxAdministration = assumptions.subscriptionPriceUSD * (channel.taxAdministrationRate || 0);
  const refundReserve = assumptions.subscriptionPriceUSD * assumptions.refundReserveRate;
  const infrastructure = assumptions.infrastructureMonthlyUSD.p90 / assumptions.fullyUtilizedSubscribers;
  const support = assumptions.supportMinutesPerSubscriber.p90 / 60 * assumptions.supportHourlyCostUSD;
  const fullServiceCostUSD = providerCostUSD + paymentFee + taxReserve + taxAdministration +
    refundReserve + infrastructure + support;
  return {
    fullServiceCostUSD: Number(fullServiceCostUSD.toFixed(6)),
    contributionUSD: Number((assumptions.subscriptionPriceUSD - fullServiceCostUSD).toFixed(6))
  };
}

export async function createZoningSubscriberSensitivityReport() {
  const [v6Result, zoningResult, v6Economics] = await Promise.all([
    fs.readFile(v6ResultURL, "utf8").then(JSON.parse),
    fs.readFile(zoningResultURL, "utf8").then(JSON.parse),
    createV6SubscriberEconomicsReport()
  ]);
  if (zoningResult.configuration?.datasetKind !== "zoning-resolution") {
    throw new TypeError("The Zoning sensitivity source is not a Zoning benchmark.");
  }
  if (zoningResult.configuration?.pendingPaidRequestCount !== 0) {
    throw new TypeError("The Zoning sensitivity source has pending provider requests.");
  }
  const regularCosts = completedChargedCosts(v6Result);
  const rawZoningCosts = completedChargedCosts(zoningResult);
  const failedOperatingCostUSD = Number(zoningResult.economics?.economics?.failedOperatingCostUSD || 0);
  const failedCostPerCompletedZoningTurnUSD = failedOperatingCostUSD / rawZoningCosts.length;
  const zoningCosts = rawZoningCosts.map((cost) => cost + failedCostPerCompletedZoningTurnUSD);
  const scenarios = zoningSubscriberSensitivityAssumptions.zoningTurnShares.map((zoningTurnShare) => {
    const scenario = bootstrapMixedMonths({
      regularCosts,
      zoningCosts,
      includedTurns: zoningSubscriberSensitivityAssumptions.includedTurns,
      zoningTurnShare,
      iterations: zoningSubscriberSensitivityAssumptions.bootstrapIterations,
      seed: zoningSubscriberSensitivityAssumptions.bootstrapSeed
    });
    return {
      zoningTurnShare,
      ...scenario,
      p90Channels: ["web-stripe", "ios-small-business"].map((id) => ({
        id,
        ...p90ChannelContribution(scenario.providerCostUSD.p90, id)
      }))
    };
  });
  const scored = zoningResult.results.filter((item) => item.scoring);
  const qualityPasses = scored.filter((item) => item.scoring.passed === true).length;
  return {
    generatedAt: zoningSubscriberSensitivityAssumptions.generatedAt,
    decisionStatus: "preliminary-zoning-sensitivity-not-pricing-ready",
    source: {
      v6RunID: v6Result.configuration.runID,
      zoningRunID: zoningResult.configuration.runID,
      zoningRunStatus: zoningResult.status,
      zoningSourceGitCommit: zoningResult.configuration.gitCommit,
      zoningApprovedSpendCapUSD: zoningResult.configuration.approvedSpendCapUSD,
      zoningActualPaidEvaluationUSD: zoningResult.configuration.actualUSD
    },
    zoningMeasurement: {
      operations: zoningResult.economics.sample.operations,
      completedChargedTurns: rawZoningCosts.length,
      failedOperations: zoningResult.economics.sample.failed,
      qualityPasses,
      qualityEvaluatedCases: scored.length,
      failedOperatingCostUSD,
      failedCostPerCompletedZoningTurnUSD: Number(failedCostPerCompletedZoningTurnUSD.toFixed(6)),
      amortizedTurnCostUSD: distribution(zoningCosts),
      sampleReady: zoningResult.economics.sample.sampleReady,
      allQualityCasesPassed: qualityPasses === zoningResult.results.length
    },
    assumptions: zoningSubscriberSensitivityAssumptions,
    baselineV6: {
      providerCostUSD: v6Economics.allowanceScenarios.find((item) => item.includedTurns === 100).providerCostUSD
    },
    scenarios,
    recommendation: {
      pricingOrAllowanceChangeAuthorized: false,
      zoningPublicEnablementReady: false,
      nextGate: "Narrow Zoning passage assembly, resolve the failed cases, and obtain a clean frozen rerun before using this sensitivity for a commercial decision."
    }
  };
}

function usd(value) {
  return `$${Number(value).toFixed(2)}`;
}

export function renderZoningSubscriberSensitivityMarkdown(report) {
  const rows = report.scenarios.map((scenario) => {
    const web = scenario.p90Channels.find((channel) => channel.id === "web-stripe");
    const ios = scenario.p90Channels.find((channel) => channel.id === "ios-small-business");
    return `| ${(scenario.zoningTurnShare * 100).toFixed(0)}% | ${scenario.regularTurns} | ${scenario.zoningTurns} | ${usd(scenario.providerCostUSD.p50)} | ${usd(scenario.providerCostUSD.p90)} | ${usd(web.contributionUSD)} | ${usd(ios.contributionUSD)} |`;
  });
  return `# Permitext Research subscriber economics — preliminary Zoning sensitivity\n\n` +
    `Generated locally from immutable V6 and Zoning benchmark results without provider calls.\n\n` +
    `The first Zoning diagnostic spent ${usd(report.source.zoningActualPaidEvaluationUSD)} including independent grading. Production operations projected ${usd(report.zoningMeasurement.amortizedTurnCostUSD.mean * 100)} per 100 Zoning turns after amortizing the failed operation. Only ${report.zoningMeasurement.qualityPasses}/${report.zoningMeasurement.qualityEvaluatedCases} graded answers passed and the source sample has only ${report.zoningMeasurement.completedChargedTurns} completed charged turns, so this is a sensitivity—not a pricing result.\n\n` +
    `| Zoning share | V6 turns | Zoning turns | Provider p50 | Provider p90 | Web p90 contribution | iOS 15% p90 contribution |\n` +
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n` +
    `${rows.join("\n")}\n\n` +
    `No price or allowance change is authorized. Public Zoning Research remains disabled. Next, narrow Zoning passage assembly and resolve the failed cases before a clean frozen rerun.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await createZoningSubscriberSensitivityReport();
  process.stdout.write(process.argv.includes("--json")
    ? `${JSON.stringify(report, null, 2)}\n`
    : renderZoningSubscriberSensitivityMarkdown(report));
}
