import assert from "node:assert/strict";
import {
  createZoningSubscriberSensitivityReport,
  renderZoningSubscriberSensitivityMarkdown
} from "../scripts/report-research-subscriber-economics-zoning-sensitivity.mjs";

const report = await createZoningSubscriberSensitivityReport();
assert.equal(report.decisionStatus, "preliminary-zoning-sensitivity-not-pricing-ready");
assert.equal(report.source.zoningRunID, "5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53");
assert.equal(report.source.zoningActualPaidEvaluationUSD, 3.24798);
assert.equal(report.zoningMeasurement.completedChargedTurns, 28);
assert.equal(report.zoningMeasurement.failedOperations, 2);
assert.equal(report.zoningMeasurement.qualityPasses, 12);
assert.equal(report.zoningMeasurement.qualityEvaluatedCases, 28);
assert.equal(report.zoningMeasurement.sampleReady, true);
assert.equal(report.zoningMeasurement.allQualityCasesPassed, false);
assert.equal(report.scenarios.length, 4);
assert.equal(report.scenarios[0].providerCostUSD.p50, report.baselineV6.providerCostUSD.p50);
assert.equal(report.scenarios[0].providerCostUSD.p90, report.baselineV6.providerCostUSD.p90);
assert(report.scenarios.at(-1).providerCostUSD.p90 > report.scenarios[0].providerCostUSD.p90);
assert.equal(report.recommendation.pricingOrAllowanceChangeAuthorized, false);
assert.equal(report.recommendation.zoningPublicEnablementReady, false);

const markdown = renderZoningSubscriberSensitivityMarkdown(report);
assert.match(markdown, /Only 12\/28 graded answers passed/);
assert.match(markdown, /No price or allowance change is authorized/);
assert.match(markdown, /Public Zoning Research remains disabled/);
console.log("Permitext preliminary Zoning subscriber-economics sensitivity contract passed; paid model calls: no.");
