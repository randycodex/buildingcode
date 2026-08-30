import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  zoningSection,
  zoningSectionCatalog,
  zoningSourceManifest
} from "../zoning-content.mjs";

const intake = JSON.parse(
  await readFile(new URL("../evals/zoning-candidate-batch-1-intake.json", import.meta.url), "utf8")
);
const frozenDataset = JSON.parse(
  await readFile(new URL("../evals/zoning-cases.json", import.meta.url), "utf8")
);
const sourceMarkdown = await readFile(
  new URL("../../Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md", import.meta.url),
  "utf8"
);
const sourceManifest = await zoningSourceManifest();
const catalog = await zoningSectionCatalog();
const catalogByNumber = new Map(catalog.map((section) => [section.sectionNumber, section]));

assert.equal(intake.schemaVersion, 1);
assert.equal(intake.libraryID, "nyc-zoning-resolution");
assert.equal(intake.researchEligibility, false);
assert.equal(intake.governance.status, "owner-reviewed-partial");
assert.equal(intake.governance.humanOwnerReviewRequired, true);
assert.equal(intake.governance.automaticApprovalAllowed, false);
assert.equal(intake.governance.paidEvaluationAllowed, false);
assert.equal(intake.governance.professionalZoningSignoff, false);
assert.equal(intake.governance.publicResearchReleaseAuthorized, false);
assert.equal(intake.governance.mergeIntoFrozenBenchmarkAuthorized, false);
assert.equal(intake.governance.createSeparateExpandedCohortAuthorized, true);
assert.deepEqual(intake.governance.ownerReview.approvedSourceCaseNumbers, [2, 4, 5, 6, 7, 8, 9, 10, 12]);
assert.deepEqual(intake.governance.ownerReview.heldSourceCaseNumbers, [1, 3, 11]);
assert.equal(sourceManifest.researchEligibility, false);
assert.equal(frozenDataset.cases.length, 21, "Candidate intake must not change the frozen benchmark.");

const sourceCases = new Map();
for (const match of sourceMarkdown.matchAll(/^## Case (\d+)\n([\s\S]*?)(?=^## Case \d+\n|(?![\s\S]))/gm)) {
  const sourceCaseNumber = Number(match[1]);
  const body = match[2];
  const title = body.match(/^\*\*Case title:\*\* (.+)$/m)?.[1]?.trim();
  const sourceDeclaredStatus = /\*\*Source-verification status:\*\*\s+\*\*READY\*\*/m.test(body)
    ? "ready"
    : /\*\*Source-verification status:\*\*\s+\*\*BLOCKED FOR SOURCE VERIFICATION\*\*/m.test(body)
      ? "blocked-for-source-verification"
      : null;
  assert(title, `Source case ${sourceCaseNumber} has no title.`);
  assert(sourceDeclaredStatus, `Source case ${sourceCaseNumber} has no declared status.`);
  sourceCases.set(sourceCaseNumber, { body, title, sourceDeclaredStatus });
}

assert.equal(sourceCases.size, 12);
assert.equal(intake.cases.length, 12);
assert.equal(intake.verification.sourceCaseCount, 12);
assert.equal(intake.verification.sourceDeclaredReadyCount, 7);
assert.equal(intake.verification.sourceDeclaredBlockedCount, 5);
assert.equal(intake.verification.calculationChecksPassedCount, 12);

const caseIDs = new Set();
const sourceCaseNumbers = new Set();
const statusCounts = { ready: 0, "blocked-for-source-verification": 0 };
const approvedSourceCaseNumbers = new Set(intake.governance.ownerReview.approvedSourceCaseNumbers);
const heldSourceCaseNumbers = new Set(intake.governance.ownerReview.heldSourceCaseNumbers);
const allowedRecommendations = new Set([
  "advance-to-owner-review",
  "advance-as-explicit-uncertainty",
  "revise-before-owner-review",
  "hold-as-near-duplicate",
  "hold-for-visual-map-evidence"
]);

for (const testCase of intake.cases) {
  assert(!caseIDs.has(testCase.id), `Duplicate candidate ID ${testCase.id}.`);
  assert(!sourceCaseNumbers.has(testCase.sourceCaseNumber), `Duplicate source case ${testCase.sourceCaseNumber}.`);
  caseIDs.add(testCase.id);
  sourceCaseNumbers.add(testCase.sourceCaseNumber);
  assert.equal(testCase.status, approvedSourceCaseNumbers.has(testCase.sourceCaseNumber) ? "approved" : "draft");
  if (approvedSourceCaseNumbers.has(testCase.sourceCaseNumber)) {
    assert.equal(testCase.reviewer, "Permitext owner");
    assert.match(testCase.reviewedAt, /^2026-08-30T/);
    assert.match(testCase.approvalScope, /Evaluation testing only/);
  } else {
    assert(heldSourceCaseNumbers.has(testCase.sourceCaseNumber));
    assert.equal(testCase.reviewer, undefined);
  }
  assert(allowedRecommendations.has(testCase.recommendation));
  assert(testCase.reason.length >= 60);
  assert(testCase.selectedEvidenceSectionIDs.length > 0);
  assert.equal(testCase.selectedEvidenceSectionIDs.length, testCase.selectedEvidenceSectionNumbers.length);

  const sourceCase = sourceCases.get(testCase.sourceCaseNumber);
  assert(sourceCase, `Missing source case ${testCase.sourceCaseNumber}.`);
  assert.equal(testCase.title, sourceCase.title);
  assert.equal(testCase.sourceDeclaredStatus, sourceCase.sourceDeclaredStatus);
  statusCounts[testCase.sourceDeclaredStatus] += 1;

  for (const [index, sectionNumber] of testCase.selectedEvidenceSectionNumbers.entries()) {
    const sectionSummary = catalogByNumber.get(sectionNumber);
    assert(sectionSummary, `${testCase.id} references unknown ZR ${sectionNumber}.`);
    assert.equal(Number(sectionSummary.id), testCase.selectedEvidenceSectionIDs[index]);
    const section = await zoningSection(sectionSummary.id);
    assert(section?.blocks?.length, `${testCase.id} references empty ZR ${sectionNumber}.`);
    assert.equal(section.zoning?.researchEligibility, false);
    assert.match(section.zoning?.sourceURL || "", /^https:\/\/zr\.planning\.nyc\.gov\//);
    assert(
      sourceCase.body.includes(`/article-`) && sourceCase.body.includes(`/${sectionNumber}`),
      `${testCase.id} source case does not cite the official URL for ZR ${sectionNumber}.`
    );
  }
}

assert.deepEqual(statusCounts, { ready: 7, "blocked-for-source-verification": 5 });
assert.equal(intake.verification.uniqueOfficialSectionURLCount, 42);
assert.equal(intake.verification.canonicalSectionsFoundCount, 42);
const officialSectionNumbers = new Set(
  [...sourceMarkdown.matchAll(/https:\/\/zr\.planning\.nyc\.gov\/article-[^\s)]+\/(\d{1,3}-\d{1,3})/g)]
    .map((match) => match[1])
);
assert.equal(officialSectionNumbers.size, 42);
assert([...officialSectionNumbers].every((sectionNumber) => catalogByNumber.has(sectionNumber)));
assert(intake.verification.liveOfficialSourceSpotChecks.length >= 10);
assert(intake.verification.liveOfficialSourceSpotChecks.every((url) =>
  /^https:\/\/zr\.planning\.nyc\.gov\//.test(url)
));

assert.equal(intake.cases[0].recommendation, "revise-before-owner-review");
assert.equal(intake.cases[2].recommendation, "hold-as-near-duplicate");
assert.equal(intake.cases[10].recommendation, "hold-for-visual-map-evidence");
assert.equal(intake.cases[10].evidenceMode, "visual-map-dependent");
assert.equal(intake.cases.filter((testCase) => testCase.status === "approved").length, 9);
assert.equal(intake.cases.filter((testCase) => testCase.status === "draft").length, 3);

function close(actual, expected) {
  assert(Math.abs(actual - expected) < 0.000_001, `Expected ${expected}; received ${actual}.`);
}

close(85_000 / 12_000, 7.083333333333333);
close(12_000 * 6.02, 72_240);
close(12_000 * 7.2, 86_400);
close(31_000 / 8_000, 3.875);
close(31_000 - (8_000 * 3 + 6_200), 800);
close(105 - 85, 20);
close(40 - 30, 10);
close(60 - 30, 30);
close(60 * 0.25, 15);
close(60 * 0.5, 30);
close(55_000 - 10_000 * 5.01, 4_900);
close(20_000 * 0.45, 9_000);
close(20_000 * (0.4 * 4 + 0.6 * 6.02), 104_240);
close(110_000 - 104_240, 5_760);
close(15_000 * 6.02 / 680, 132.7941176470588);
assert.equal(Math.floor(15_000 * 6.02 / 680) + 1, 133);
close(90_000 * 0.03, 2_700);
close(90_000 * 0.02, 1_800);
close(100 - 60, 40);
close(120 - 65, 55);
close(10 - 8, 2);
close(12_500 - 10_000, 2_500);

console.log("zoning candidate batch 1 intake passed", {
  cases: intake.cases.length,
  sourceDeclaredReady: statusCounts.ready,
  sourceDeclaredBlocked: statusCounts["blocked-for-source-verification"],
  ownerApproved: intake.cases.filter((testCase) => testCase.status === "approved").length,
  held: intake.cases.filter((testCase) => testCase.status === "draft").length,
  officialSectionsMapped: officialSectionNumbers.size,
  frozenBenchmarkCases: frozenDataset.cases.length,
  publicResearchReleaseAuthorized: intake.governance.publicResearchReleaseAuthorized
});

await import("./zoning-expanded-batch-1-contract.mjs");
