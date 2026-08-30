import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  requireZoningSuccessorGenerationAuthorization,
  validateZoningSuccessorDispositions
} from "../evals/zoning-successor-governance.mjs";
import { adaptZoningEvaluationDataset } from "../evals/zoning-evaluation-adapter.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const validation = await validateZoningSuccessorDispositions();
const { manifest, source } = validation;

assert.equal(manifest.status, "owner_approved");
assert.equal(manifest.ownerDecision.required, true);
assert.equal(manifest.ownerDecision.recordedAt, "2026-08-30T19:09:05.000Z");
assert.equal(manifest.ownerDecision.recordedBy, "Permitext owner");
assert.equal(manifest.ownerDecision.exactApprovalPhrase, "I approve");
assert.equal(manifest.ownerDecision.acceptedDecisionIDs.length, 8);
assert.equal(validation.approvedDecisionIDs.length, 8);
assert.equal(validation.pendingDecisionIDs.length, 0);
assert.equal(validation.generationAuthorized, true);
assert.equal(manifest.successor.generationAllowed, true);
assert.equal(requireZoningSuccessorGenerationAuthorization(validation), validation);

const successorText = await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1-successor.json", import.meta.url),
  "utf8"
);
const successor = JSON.parse(successorText);
const manifestText = await readFile(
  new URL("../evals/zoning-expanded-successor-dispositions.json", import.meta.url),
  "utf8"
);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

assert.equal(successor.governance.status, "frozen");
assert.equal(successor.researchEligibility, false);
assert.equal(successor.governance.parentCohort.sha256, manifest.sourceCohort.sha256);
assert.equal(successor.governance.parentCohort.mutationAuthorized, false);
assert.equal(successor.governance.ownerDisposition.sha256, sha256(manifestText));
assert.deepEqual(successor.governance.ownerDisposition.decisionIDs,
  manifest.ownerDecision.acceptedDecisionIDs);
assert.equal(successor.governance.humanOwnerReviewComplete, true);
assert.equal(successor.governance.paidEvaluationAllowed, false);
assert.equal(successor.governance.paidEvaluationAuthorization.status, "locked");
assert.equal(successor.governance.paidEvaluationAuthorization.maximumCumulativeSpendUSD, null);
assert.equal(successor.governance.publicResearchReleaseAuthorized, false);
assert.equal(successor.governance.professionalZoningSignoff, false);
assert.equal(successor.governance.evidenceBudgetCandidate.maximumSupplementalCharacters, 24_000);
assert.equal(successor.governance.evidenceBudgetCandidate.enabledByDefault, false);
assert.equal(successor.governance.evidenceBudgetCandidate.productionConfigurationChanged, false);
assert.equal(successor.cases.length, source.cases.length);
assert.deepEqual(successor.cases.map((testCase) => testCase.id),
  source.cases.map((testCase) => testCase.id));

const dispositionCaseIDs = new Set(manifest.decisions.map((decision) => decision.caseID));
for (const originalCase of source.cases) {
  const successorCase = successor.cases.find((testCase) => testCase.id === originalCase.id);
  assert.equal(successorCase.question, originalCase.question,
    `${originalCase.id} changed its owner-approved question.`);
  assert.deepEqual(successorCase.selectedEvidenceSectionIDs, originalCase.selectedEvidenceSectionIDs,
    `${originalCase.id} changed its selected evidence.`);
  assert.deepEqual(successorCase.forbiddenClaims, originalCase.forbiddenClaims,
    `${originalCase.id} weakened its forbidden safety claims.`);
  if (!dispositionCaseIDs.has(originalCase.id)) {
    assert.deepEqual(successorCase, originalCase,
      `${originalCase.id} changed without an owner-approved disposition.`);
  } else {
    assert(successorCase.successorDispositionIDs?.length >= 1,
      `${originalCase.id} lacks its durable successor disposition record.`);
  }
}

const byID = (caseID) => successor.cases.find((testCase) => testCase.id === caseID);
const originalByID = (caseID) => source.cases.find((testCase) => testCase.id === caseID);

const uap = byID("zr-candidate-b1-r6a-uap-insufficient-affordable-area");
assert.match(uap.expectedConclusion, /selected evidence alone/i);
assert.match(uap.expectedConclusion, /3\.875 FAR/);
assert.match(uap.expectedConclusion, /missing enacted UAP eligibility\/linkage provisions/i);
assert.equal(uap.requiredConcepts.length, 5);
assert(!uap.requiredConcepts.join(" ").includes("30,200-square-foot project maximum"));

const deepThroughLot = byID("zr-candidate-b1-deep-through-lot-vertical-yard");
assert.match(deepThroughLot.expectedConclusion, /ZR 24-382/);
assert.match(deepThroughLot.expectedConclusion, /60 feet deep/);
assert.match(deepThroughLot.expectedConclusion, /30 feet short/);
assert.equal(deepThroughLot.requiredConcepts.length, 6);

const rules = byID("zr-rules-of-construction");
assert(!rules.requiredConcepts.includes("The particular controls the general."));
assert(rules.requiredConcepts.includes(
  "The enacted text controls over a caption, illustration, summary table, or illustrative table."
));

const warehouse = byID("zr-candidate-b1-nonconforming-warehouse-enlargement");
assert(warehouse.requiredConcepts.some((concept) => concept.includes("5,000 sf ÷ 20,000 sf = 25%")));
assert(!warehouse.requiredConcepts.some((concept) => concept.includes("9,000 sf − 5,000 sf")));

const weightedFAR = byID("zr-candidate-b1-r7a-r8a-weighted-far");
assert(weightedFAR.requiredConcepts.some((concept) => concept.includes("Proposed FAR: 110,000 sf ÷ 20,000 sf = 5.50 FAR")));
assert(!weightedFAR.requiredConcepts.some((concept) => concept.startsWith("Alternative direct check:")));

const conversion = byID("zr-candidate-b1-c6-2-office-residential-conversion");
assert.deepEqual(conversion.requiredConcepts,
  originalByID("zr-candidate-b1-c6-2-office-residential-conversion").requiredConcepts);
assert(conversion.requiredConcepts.some((concept) => concept.includes("Existing FAR: 90,000 sf ÷ 15,000 sf = 6.00 FAR")));

const transition = byID("zr-candidate-b1-city-of-yes-transition");
assert(transition.requiredConcepts.some((concept) => /old substantive provisions.*verified pre-December 5, 2024/i.test(concept)));
assert(!transition.requiredConcepts.includes("Amendment adoption and effective date."));
assert(!transition.requiredConcepts.some((concept) => concept.includes("100% − 60% = 40%")));
assert(!transition.requiredConcepts.some((concept) => concept.includes("40 percentage points short")));

const mih = byID("zr-candidate-b1-mih-historical-zoning-lot");
assert(mih.requiredConcepts.includes(
  "Official historical zoning-lot evidence, including any relevant recorded declaration or legal description."
));
assert(mih.requiredConcepts.includes("Current Appendix F map versus historical establishment record."));
assert(!mih.requiredConcepts.some((concept) => concept.includes("Margin:")));

const adapted = await adaptZoningEvaluationDataset({
  zoningDataset: successor,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary,
  paidExecution: false
});
assert.equal(adapted.cases.length, 30);
assert.equal(adapted.cases.find((testCase) => testCase.id === uap.id).expectedConclusion,
  uap.expectedConclusion);
assert.equal(adapted.cases.find((testCase) => testCase.id === deepThroughLot.id).expectedConclusion,
  deepThroughLot.expectedConclusion);
for (const testCase of adapted.cases) {
  assert(testCase.selectedEvidence.length > 0, `${testCase.id} has no selected enacted evidence.`);
  for (const evidence of testCase.selectedEvidence) {
    assert(evidence.exactPassages.length > 0,
      `${testCase.id} has no exact passage for ${evidence.reference}.`);
  }
}

console.log("Zoning successor governance contract passed", {
  decisions: manifest.decisions.length,
  approved: validation.approvedDecisionIDs.length,
  cases: successor.cases.length,
  sourceCohortUnchanged: true,
  selectedEvidenceUnchanged: true,
  forbiddenClaimsUnchanged: true,
  paidEvaluationAllowed: successor.governance.paidEvaluationAllowed,
  publicResearchReleaseAuthorized: successor.governance.publicResearchReleaseAuthorized
});
