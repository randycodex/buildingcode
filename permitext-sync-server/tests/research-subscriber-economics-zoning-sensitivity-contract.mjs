import assert from "node:assert/strict";
import {
  createZoningSubscriberSensitivityReport,
  renderZoningSubscriberSensitivityMarkdown
} from "../scripts/report-research-subscriber-economics-zoning-sensitivity.mjs";

const report = await createZoningSubscriberSensitivityReport();
assert.equal(report.decisionStatus, "preliminary-zoning-sensitivity-not-pricing-ready");
assert.equal(report.source.zoningRunID, "f35eed33-cb4e-4b7b-a719-86b072271660");
assert.equal(report.source.zoningActualPaidEvaluationUSD, 3.357895);
assert.equal(report.zoningMeasurement.completedChargedTurns, 15);
assert.equal(report.zoningMeasurement.failedOperations, 15);
assert.equal(report.zoningMeasurement.postRunNoCostTriggerRepairOperations, 10);
assert.equal(report.zoningMeasurement.unresolvedExecutionPaths, 5);
assert.equal(report.zoningMeasurement.qualityPasses, 13);
assert.equal(report.zoningMeasurement.qualityEvaluatedCases, 15);
assert.equal(report.zoningMeasurement.sampleReady, false);
assert.equal(report.zoningMeasurement.allQualityCasesPassed, false);
assert.equal(report.scenarios.length, 4);
assert.equal(report.scenarios[0].providerCostUSD.p50, report.baselineV6.providerCostUSD.p50);
assert.equal(report.scenarios[0].providerCostUSD.p90, report.baselineV6.providerCostUSD.p90);
assert(report.scenarios.at(-1).providerCostUSD.p90 > report.scenarios[0].providerCostUSD.p90);
assert.equal(report.recommendation.pricingOrAllowanceChangeAuthorized, false);
assert.equal(report.recommendation.zoningPublicEnablementReady, false);
assert.match(report.recommendation.nextGate, /implicated in 10 failed operations/);
assert.match(report.recommendation.nextGate, /review 5 remaining execution paths and 2 graded quality failures/);
assert.match(report.recommendation.nextGate, /two identified frozen case\/evidence defects/);

const markdown = renderZoningSubscriberSensitivityMarkdown(report);
assert.match(markdown, /Only 13\/15 graded answers passed/);
assert.match(markdown, /remediation-successor-2 Zoning diagnostic/);
assert.match(markdown, /trigger narrowing implicated in 10 failed operations/);
assert.match(markdown, /review 5 remaining execution paths and 2 graded quality failures/);
assert.match(markdown, /two identified frozen case\/evidence defects/);
assert.match(markdown, /-\$1\.54/);
assert.doesNotMatch(markdown, /\$-1\.54/);
assert.match(markdown, /No price or allowance change is authorized/);
assert.match(markdown, /Public Zoning Research remains disabled/);
console.log("Permitext preliminary Zoning subscriber-economics sensitivity contract passed; paid model calls: no.");
