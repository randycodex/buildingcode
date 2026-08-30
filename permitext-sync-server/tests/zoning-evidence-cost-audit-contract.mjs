import assert from "node:assert/strict";
import {
  createZoningEvidenceCostAudit,
  renderZoningEvidenceCostAuditMarkdown
} from "../scripts/report-zoning-evidence-cost-audit.mjs";

const report = await createZoningEvidenceCostAudit();
assert.equal(report.source.runID, "5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53");
assert.equal(report.sample.completedCases, 28);
assert.equal(report.sample.qualityPasses, 12);
assert.equal(report.sample.revisedCases, 17);
assert.equal(report.source.maximumEvidenceCharacters, 48_000);
assert.equal(report.pressure.nearMaximumCaseCount, 11);
assert(report.distributions.assembledEvidenceCharacters.mean > 42_000);
assert(report.distributions.reviewedPassageCharacters.mean < 6_300);
assert(report.distributions.nonPassageEvidenceCharacters.mean > 35_000);
assert.equal(report.recommendation.evidenceCostReductionRequired, true);
assert.equal(report.recommendation.retrievalLimitChangeAuthorized, false);
assert.match(renderZoningEvidenceCostAuditMarkdown(report), /No retrieval limit change is authorized/);
console.log("Permitext Zoning evidence-cost audit contract passed; paid model calls: no.");
