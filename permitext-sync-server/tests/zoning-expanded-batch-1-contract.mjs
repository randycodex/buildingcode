import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { adaptZoningEvaluationDataset } from "../evals/zoning-evaluation-adapter.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

await import("../evals/build-zoning-expanded-batch-1.mjs");

const originalText = await readFile(new URL("../evals/zoning-cases.json", import.meta.url), "utf8");
const intakeText = await readFile(
  new URL("../evals/zoning-candidate-batch-1-intake.json", import.meta.url),
  "utf8"
);
const sourceText = await readFile(
  new URL("../../Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md", import.meta.url),
  "utf8"
);
const expandedText = await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1.json", import.meta.url),
  "utf8"
);
const reviews = JSON.parse(await readFile(new URL("../evals/reviews.json", import.meta.url), "utf8"));
const original = JSON.parse(originalText);
const intake = JSON.parse(intakeText);
const expanded = JSON.parse(expandedText);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const approvedSourceCaseNumbers = [2, 4, 5, 6, 7, 8, 9, 10, 12];
const heldSourceCaseNumbers = [1, 3, 11];

assert.equal(original.cases.length, 21);
assert.equal(expanded.schemaVersion, 1);
assert.equal(expanded.libraryID, "nyc-zoning-resolution");
assert.equal(expanded.researchEligibility, false);
assert.equal(expanded.governance.status, "frozen");
assert.equal(expanded.governance.frozenCaseCount, 30);
assert.equal(expanded.governance.paidEvaluationAllowed, false);
assert.equal(expanded.governance.paidEvaluationAuthorization.status, "locked");
assert.equal(expanded.governance.paidEvaluationAuthorization.maximumCumulativeSpendUSD, null);
assert.equal(expanded.governance.paidEvaluationAuthorization.requiresNewExplicitOwnerAuthorization, true);
assert.equal(expanded.governance.paidEvaluationAuthorization.requiresNewExplicitCumulativeSpendCap, true);
assert.equal(expanded.governance.professionalZoningSignoff, false);
assert.equal(expanded.governance.publicResearchReleaseAuthorized, false);
assert.equal(expanded.governance.parentCohort.caseCount, 21);
assert.equal(expanded.governance.parentCohort.sha256, sha256(originalText));
assert.equal(expanded.governance.parentCohort.mutationAuthorized, false);
assert.equal(expanded.governance.expansionSource.intakeSHA256, sha256(intakeText));
assert.equal(expanded.governance.expansionSource.sourceSHA256, sha256(sourceText));
assert.deepEqual(expanded.governance.expansionSource.approvedSourceCaseNumbers, approvedSourceCaseNumbers);
assert.deepEqual(expanded.governance.expansionSource.heldSourceCaseNumbers, heldSourceCaseNumbers);
assert.equal(expanded.cases.length, 30);
assert.deepEqual(expanded.cases.slice(0, 21), original.cases, "The original 21 cases must remain logically unchanged.");

const appended = expanded.cases.slice(21);
const approvedIntakeCases = intake.cases.filter((testCase) => testCase.status === "approved");
const heldIntakeCases = intake.cases.filter((testCase) => testCase.status === "draft");
assert.deepEqual(appended.map((testCase) => testCase.sourceCaseNumber), approvedSourceCaseNumbers);
assert.deepEqual(approvedIntakeCases.map((testCase) => testCase.sourceCaseNumber), approvedSourceCaseNumbers);
assert.deepEqual(heldIntakeCases.map((testCase) => testCase.sourceCaseNumber), heldSourceCaseNumbers);
assert.equal(new Set(expanded.cases.map((testCase) => testCase.id)).size, 30);
for (const testCase of appended) {
  assert.equal(testCase.status, "approved");
  assert.equal(testCase.reviewer, "Permitext owner");
  assert.match(testCase.reviewedAt, /^2026-08-30T/);
  assert.match(testCase.approvalScope, /Evaluation testing only/);
  assert(testCase.question.length >= 80);
  assert(testCase.selectedEvidenceSectionIDs.length > 0);
  assert(testCase.requiredConcepts.length >= 10);
  assert(testCase.forbiddenClaims.length >= 5);
  assert(
    reviews.reviews.some((review) =>
      review.kind === "zoning-case" &&
      review.caseID === testCase.id &&
      review.decision === "approved" &&
      review.runID === null
    ),
    `${testCase.id} has no durable owner review record.`
  );
}
for (const heldCase of heldIntakeCases) {
  assert(!expanded.cases.some((testCase) => testCase.id === heldCase.id));
}

const adapted = await adaptZoningEvaluationDataset({
  zoningDataset: expanded,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary
});
assert.equal(adapted.cases.length, 30);
assert.match(adapted.description, /30-case/);
for (const testCase of adapted.cases) {
  assert(testCase.selectedEvidence.length > 0, `${testCase.id} has no selected evidence.`);
  for (const source of testCase.selectedEvidence) {
    assert(source.exactPassages.length > 0, `${testCase.id} has no exact passage for ${source.reference}.`);
    assert(
      source.exactPassages.reduce((sum, passage) => sum + passage.length, 0) <= 11_800,
      `${testCase.id} exceeds the evidence limit for ${source.reference}.`
    );
  }
}

for (const caseID of [
  "zr-candidate-b1-r6-parking-unverified-transit-zone",
  "zr-candidate-b1-city-of-yes-transition",
  "zr-candidate-b1-mih-historical-zoning-lot"
]) {
  assert.equal(adapted.cases.find((testCase) => testCase.id === caseID).expectedUncertainty.level, "insufficient evidence");
}
assert.match(
  adapted.cases.find((testCase) => testCase.id === "zr-candidate-b1-mx-nonadditive-far")
    .expectedConclusion,
  /4,900 square feet/i
);
assert.match(
  adapted.cases.find((testCase) => testCase.id === "zr-candidate-b1-r7a-r8a-weighted-far")
    .expectedConclusion,
  /5,760 square feet/i
);

console.log("zoning expanded Batch 1 contract passed", {
  parentCases: original.cases.length,
  appendedOwnerApprovedCases: appended.length,
  heldCases: heldIntakeCases.length,
  frozenCases: expanded.cases.length,
  paidEvaluationAllowed: expanded.governance.paidEvaluationAllowed,
  publicResearchReleaseAuthorized: expanded.governance.publicResearchReleaseAuthorized
});
