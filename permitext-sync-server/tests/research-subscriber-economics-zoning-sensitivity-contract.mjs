import assert from "node:assert/strict";
import {
  createZoningSubscriberSensitivityReport,
  renderZoningSubscriberSensitivityMarkdown
} from "../scripts/report-research-subscriber-economics-zoning-sensitivity.mjs";

const report = await createZoningSubscriberSensitivityReport();
assert.equal(report.decisionStatus, "preliminary-zoning-sensitivity-not-pricing-ready");
assert.equal(report.source.zoningRunID, "5b54b6cf-2a04-4a4a-a920-edb2d65bf4f6");
assert.equal(report.source.zoningActualPaidEvaluationUSD, 1.857548);
assert.equal(report.zoningMeasurement.completedChargedTurns, 20);
assert.equal(report.zoningMeasurement.failedOperations, 1);
assert.equal(report.zoningMeasurement.qualityPasses, 11);
assert.equal(report.zoningMeasurement.qualityEvaluatedCases, 20);
assert.equal(report.zoningMeasurement.sampleReady, false);
assert.equal(report.zoningMeasurement.allQualityCasesPassed, false);
assert.equal(report.scenarios.length, 4);
assert.equal(report.scenarios[0].providerCostUSD.p50, report.baselineV6.providerCostUSD.p50);
assert.equal(report.scenarios[0].providerCostUSD.p90, report.baselineV6.providerCostUSD.p90);
assert(report.scenarios.at(-1).providerCostUSD.p90 > report.scenarios[0].providerCostUSD.p90);
assert.equal(report.recommendation.pricingOrAllowanceChangeAuthorized, false);
assert.equal(report.recommendation.zoningPublicEnablementReady, false);

const markdown = renderZoningSubscriberSensitivityMarkdown(report);
assert.match(markdown, /Only 11\/20 graded answers passed/);
assert.match(markdown, /No price or allowance change is authorized/);
assert.match(markdown, /Public Zoning Research remains disabled/);
console.log("Permitext preliminary Zoning subscriber-economics sensitivity contract passed; paid model calls: no.");
