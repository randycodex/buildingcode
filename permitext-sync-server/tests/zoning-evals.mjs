import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  zoningSection,
  zoningSectionSummary,
  zoningSourceManifest,
  zoningSyncCodeVersion
} from "../zoning-content.mjs";

const dataset = JSON.parse(
  await readFile(new URL("../evals/zoning-cases.json", import.meta.url), "utf8")
);
const reviewStore = JSON.parse(
  await readFile(new URL("../evals/reviews.json", import.meta.url), "utf8")
);
const sourceManifest = await zoningSourceManifest();

assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.libraryID, "nyc-zoning-resolution");
assert.equal(dataset.codeVersion, "NYC Zoning Resolution — text through 2026-07-16");
assert.equal(dataset.researchEligibility, false);
assert.equal(dataset.governance.status, "draft");
assert.equal(dataset.governance.humanReviewRequired, true);
assert.equal(dataset.governance.automaticApprovalAllowed, false);
assert.equal(dataset.governance.paidEvaluationAllowed, false);
assert.equal(dataset.governance.approvedCaseUse, "Terra answer-key testing only");
assert.equal(dataset.governance.professionalZoningSignoff, false);
assert.equal(dataset.governance.publicResearchReleaseAuthorized, false);
assert.equal(sourceManifest.researchEligibility, false);
assert.equal(zoningSyncCodeVersion, "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1");
assert.equal(dataset.cases.length, 21);

const requiredCategories = new Set([
  "citation-fidelity",
  "table",
  "map",
  "special-purpose-district",
  "amendment-history",
  "explicit-uncertainty"
]);
const caseIDs = new Set();
const blockedEvidenceCaseIDs = new Set();
const statusCounts = { draft: 0, reviewed: 0, approved: 0, rejected: 0 };
for (const testCase of dataset.cases) {
  assert(!caseIDs.has(testCase.id), `Duplicate zoning evaluation case: ${testCase.id}`);
  caseIDs.add(testCase.id);
  requiredCategories.delete(testCase.category);
  assert(
    ["draft", "reviewed", "approved", "rejected"].includes(testCase.status),
    `${testCase.id} has an invalid human-review status.`
  );
  statusCounts[testCase.status] += 1;
  const hasReviewer = Boolean(String(testCase.reviewer || "").trim());
  const hasReviewDate = Number.isFinite(Date.parse(testCase.reviewedAt || ""));
  assert.equal(hasReviewer, hasReviewDate, `${testCase.id} has incomplete reviewer metadata.`);
  if (["reviewed", "approved", "rejected"].includes(testCase.status)) {
    assert(hasReviewer, `${testCase.id} needs reviewer metadata for status ${testCase.status}.`);
  }
  if (testCase.status === "approved") {
    assert.equal(testCase.reviewer, "Permitext owner");
  }
  if (testCase.revisionNotes) {
    assert.equal(testCase.status, "draft", `${testCase.id} must be reviewed again after revision.`);
    assert(Number.isFinite(Date.parse(testCase.revisionAppliedAt || "")));
  }
  assert(testCase.question.trim().length >= 40);
  assert(testCase.requiredConcepts.length >= 3);
  assert(testCase.forbiddenClaims.length >= 2);
  assert(testCase.selectedEvidenceSectionIDs.length > 0);
  if (testCase.evidenceReadiness === "blocked") {
    blockedEvidenceCaseIDs.add(testCase.id);
    assert(testCase.knownEvidenceLimitations?.length > 0);
  }
  for (const sectionID of testCase.selectedEvidenceSectionIDs) {
    const [summary, section] = await Promise.all([
      zoningSectionSummary(sectionID),
      zoningSection(sectionID)
    ]);
    assert(summary, `${testCase.id} references unknown section ${sectionID}.`);
    assert(section?.blocks?.length, `${testCase.id} references section ${sectionID} without evidence blocks.`);
    assert.equal(section.zoning?.researchEligibility, false);
    assert.match(section.zoning?.sourceURL || "", /^https:\/\/zr\.planning\.nyc\.gov\//);
    const selectedText = section.blocks.map((block) => block.plainText).join("\n").toLowerCase();
    const reviewTerms = [
      ...(testCase.evidenceReviewTerms || []),
      ...(testCase.evidenceReviewTermsBySection?.[String(sectionID)] || [])
    ];
    for (const term of reviewTerms) {
      assert(
        selectedText.includes(term.toLowerCase()),
        `${testCase.id} review term is absent from selected section ${sectionID}: ${term}`
      );
    }
    for (const expectedEvent of (testCase.evidenceReviewAmendmentEvents || [])
      .filter((event) => String(event.sectionID) === String(sectionID))) {
      const event = (section.zoning.amendmentHistory || []).find((candidate) =>
        candidate.effectiveDate === expectedEvent.effectiveDate &&
        candidate.reportNumber === expectedEvent.reportNumber
      );
      assert(event, `${testCase.id} references a missing amendment event.`);
      assert.match(event.reportURL || "", /^https?:\/\/a030-cpc\.nyc\.gov\/html\/cpc\/report\.aspx\?/);
    }
  }
}

assert.equal(requiredCategories.size, 0, `Missing zoning evaluation categories: ${[...requiredCategories].join(", ")}`);
assert.deepEqual(blockedEvidenceCaseIDs, new Set());
assert.deepEqual(statusCounts, { draft: 6, reviewed: 0, approved: 15, rejected: 0 });
const latestZoningReviews = new Map();
for (const review of reviewStore.reviews) {
  if (review.kind === "zoning-case") latestZoningReviews.set(review.caseID, review);
}
for (const testCase of dataset.cases.filter((candidate) => candidate.status === "approved")) {
  const review = latestZoningReviews.get(testCase.id);
  assert(review, `${testCase.id} has no Zoning review audit entry.`);
  assert.equal(review.decision, "approved");
  assert.equal(review.reviewer, testCase.reviewer);
  assert.equal(review.reviewedAt, testCase.reviewedAt);
  assert.match(review.notes, /high-confidence, human-quality answer-key candidate for testing Terra/);
  assert.match(review.notes, /not professional zoning sign-off/);
  assert.match(review.notes, /not .*authorization to enable public Zoning Research/);
}
assert.deepEqual(
  dataset.cases.find((testCase) => testCase.id === "zr-special-district-demolition")
    .selectedEvidenceSectionIDs,
  [20020818, 20020889]
);
assert.deepEqual(
  dataset.cases.find((testCase) => testCase.id === "zr-missing-location-facts")
    .selectedEvidenceSectionIDs,
  [20022472, 20022473, 20022474, 20019206, 20021237]
);
assert(
  dataset.cases.find((testCase) => testCase.id === "zr-inner-transit-zone-new-unit-parking")
    .selectedEvidenceSectionIDs.includes(20018444)
);
assert.equal(dataset.researchEligibility, false, "Zoning cases cannot enable public Research.");

console.log("zoning evaluation review cases passed", {
  total: dataset.cases.length,
  draft: dataset.cases.filter((testCase) => testCase.status === "draft").length,
  approved: dataset.cases.filter((testCase) => testCase.status === "approved").length,
  rejected: dataset.cases.filter((testCase) => testCase.status === "rejected").length,
  publicResearchEnabled: false
});
