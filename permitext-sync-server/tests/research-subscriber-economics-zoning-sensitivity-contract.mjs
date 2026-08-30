import assert from "node:assert/strict";
import {
  createZoningSubscriberSensitivityReport,
  renderZoningSubscriberSensitivityMarkdown
} from "../scripts/report-research-subscriber-economics-zoning-sensitivity.mjs";

const report = await createZoningSubscriberSensitivityReport();
assert.equal(report.decisionStatus, "preliminary-zoning-sensitivity-not-pricing-ready");
assert.equal(report.source.zoningRunID, "5480ed8f-6d0c-46b1-a108-d12e8e13b7da");
assert.equal(report.source.zoningActualPaidEvaluationUSD, 3.333192);
assert.equal(report.zoningMeasurement.completedChargedTurns, 27);
assert.equal(report.zoningMeasurement.failedOperations, 3);
assert.equal(report.zoningMeasurement.qualityPasses, 18);
assert.equal(report.zoningMeasurement.qualityEvaluatedCases, 27);
assert.equal(report.zoningMeasurement.sampleReady, true);
assert.equal(report.zoningMeasurement.allQualityCasesPassed, false);
assert.equal(report.scenarios.length, 4);
assert.equal(report.scenarios[0].providerCostUSD.p50, report.baselineV6.providerCostUSD.p50);
assert.equal(report.scenarios[0].providerCostUSD.p90, report.baselineV6.providerCostUSD.p90);
assert(report.scenarios.at(-1).providerCostUSD.p90 > report.scenarios[0].providerCostUSD.p90);
assert.equal(report.recommendation.pricingOrAllowanceChangeAuthorized, false);
assert.equal(report.recommendation.zoningPublicEnablementReady, false);

const markdown = renderZoningSubscriberSensitivityMarkdown(report);
assert.match(markdown, /Only 18\/27 graded answers passed/);
assert.match(markdown, /No price or allowance change is authorized/);
assert.match(markdown, /Public Zoning Research remains disabled/);
console.log("Permitext preliminary Zoning subscriber-economics sensitivity contract passed; paid model calls: no.");
