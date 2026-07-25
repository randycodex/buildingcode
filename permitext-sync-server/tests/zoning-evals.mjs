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
const sourceManifest = await zoningSourceManifest();

assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.libraryID, "nyc-zoning-resolution");
assert.equal(dataset.codeVersion, "NYC Zoning Resolution — text through 2026-07-16");
assert.equal(dataset.researchEligibility, false);
assert.equal(dataset.governance.status, "draft");
assert.equal(dataset.governance.humanReviewRequired, true);
assert.equal(dataset.governance.automaticApprovalAllowed, false);
assert.equal(dataset.governance.paidEvaluationAllowed, false);
assert.equal(sourceManifest.researchEligibility, false);
assert.equal(zoningSyncCodeVersion, "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1");

const requiredCategories = new Set([
  "citation-fidelity",
  "table",
  "map",
  "special-purpose-district",
  "amendment-history",
  "explicit-uncertainty"
]);
const caseIDs = new Set();
for (const testCase of dataset.cases) {
  assert(!caseIDs.has(testCase.id), `Duplicate zoning evaluation case: ${testCase.id}`);
  caseIDs.add(testCase.id);
  requiredCategories.delete(testCase.category);
  assert(
    ["draft", "reviewed", "approved", "rejected"].includes(testCase.status),
    `${testCase.id} has an invalid human-review status.`
  );
  const hasReviewer = Boolean(String(testCase.reviewer || "").trim());
  const hasReviewDate = Number.isFinite(Date.parse(testCase.reviewedAt || ""));
  assert.equal(hasReviewer, hasReviewDate, `${testCase.id} has incomplete reviewer metadata.`);
  if (["reviewed", "approved", "rejected"].includes(testCase.status)) {
    assert(hasReviewer, `${testCase.id} needs reviewer metadata for status ${testCase.status}.`);
  }
  assert(testCase.question.trim().length >= 40);
  assert(testCase.requiredConcepts.length >= 3);
  assert(testCase.forbiddenClaims.length >= 2);
  assert(testCase.selectedEvidenceSectionIDs.length > 0);
  for (const sectionID of testCase.selectedEvidenceSectionIDs) {
    const [summary, section] = await Promise.all([
      zoningSectionSummary(sectionID),
      zoningSection(sectionID)
    ]);
    assert(summary, `${testCase.id} references unknown section ${sectionID}.`);
    assert(section?.blocks?.length, `${testCase.id} references section ${sectionID} without evidence blocks.`);
    assert.equal(section.zoning?.researchEligibility, false);
    assert.match(section.zoning?.sourceURL || "", /^https:\/\/zr\.planning\.nyc\.gov\//);
  }
}

assert.equal(requiredCategories.size, 0, `Missing zoning evaluation categories: ${[...requiredCategories].join(", ")}`);
assert.equal(dataset.researchEligibility, false, "Zoning cases cannot enable public Research.");

console.log("zoning evaluation review cases passed", {
  total: dataset.cases.length,
  draft: dataset.cases.filter((testCase) => testCase.status === "draft").length,
  approved: dataset.cases.filter((testCase) => testCase.status === "approved").length,
  rejected: dataset.cases.filter((testCase) => testCase.status === "rejected").length,
  publicResearchEnabled: false
});
