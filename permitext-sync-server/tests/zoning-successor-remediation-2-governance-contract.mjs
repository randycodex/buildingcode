import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireZoningRemediationSuccessor2GenerationAuthorization,
  validateZoningRemediationSuccessor2Dispositions
} from "../evals/zoning-successor-remediation-2-governance.mjs";
import { adaptZoningEvaluationDataset } from "../evals/zoning-evaluation-adapter.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testsDirectory, "..");
const validation = await validateZoningRemediationSuccessor2Dispositions();
const { manifest, source } = validation;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

assert.equal(manifest.status, "owner_approved");
assert.equal(manifest.ownerDecision.recordedAt, "2026-08-30T21:40:28.000Z");
assert.equal(manifest.ownerDecision.recordedBy, "Permitext owner");
assert.equal(manifest.ownerDecision.exactApprovalPhrase,
  "go ahead - non stop, im here if you need me");
assert.equal(validation.approvedDecisionIDs.length, 3);
assert.equal(validation.generationAuthorized, true);
assert.equal(requireZoningRemediationSuccessor2GenerationAuthorization(validation), validation);

const successorText = await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1-successor-remediation-2.json", import.meta.url),
  "utf8"
);
const successor = JSON.parse(successorText);
const manifestText = await readFile(
  new URL("../evals/zoning-expanded-successor-remediation-2-dispositions.json", import.meta.url),
  "utf8"
);

assert.equal(sha256(validation.sourceText),
  "d07063fa12ec993fde8802e6b58971d5cc1873a52fbefbe9e538b81acb94d30f");
assert.equal(successor.governance.status, "frozen");
assert.equal(successor.researchEligibility, false);
assert.equal(successor.governance.parentSuccessor.sha256, manifest.sourceCohort.sha256);
assert.equal(successor.governance.parentSuccessor.mutationAuthorized, false);
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
assert.deepEqual(successor.cases.map((testCase) => testCase.id),
  source.cases.map((testCase) => testCase.id));

const dispositionCaseIDs = new Set(manifest.decisions.map((decision) => decision.caseID));
const actualChangedCaseIDs = [];
const allowedMetadataFields = [
  "successorDispositionIDs",
  "remediationSuccessor2Revisions"
];
for (const parentCase of source.cases) {
  const successorCase = successor.cases.find((testCase) => testCase.id === parentCase.id);
  assert(successorCase, `Missing remediation-2 case ${parentCase.id}`);
  assert.deepEqual(successorCase.selectedEvidenceSectionIDs,
    parentCase.selectedEvidenceSectionIDs,
  `${parentCase.id} changed selected evidence.`);
  assert.deepEqual(successorCase.forbiddenClaims, parentCase.forbiddenClaims,
    `${parentCase.id} changed forbidden claims.`);
  if (JSON.stringify(successorCase) !== JSON.stringify(parentCase)) {
    actualChangedCaseIDs.push(parentCase.id);
  }
  if (!dispositionCaseIDs.has(parentCase.id)) {
    assert.deepEqual(successorCase, parentCase,
      `${parentCase.id} changed without an approved remediation-2 disposition.`);
    continue;
  }
  const decision = manifest.decisions.find((item) => item.caseID === parentCase.id);
  const allowedFields = new Set([
    ...decision.allowedSubstantiveFields,
    ...allowedMetadataFields
  ]);
  const parentComparable = structuredClone(parentCase);
  const successorComparable = structuredClone(successorCase);
  for (const field of allowedFields) {
    delete parentComparable[field];
    delete successorComparable[field];
  }
  assert.deepEqual(successorComparable, parentComparable,
    `${parentCase.id} changed outside its approved remediation-2 fields.`);
  assert(successorCase.successorDispositionIDs.includes(decision.id),
    `${parentCase.id} lacks its remediation-2 disposition ID.`);
  assert.deepEqual(successorCase.remediationSuccessor2Revisions.map((item) => item.decisionID),
    [decision.id]);
}
assert.deepEqual(actualChangedCaseIDs, [
  "zr-special-district-demolition",
  "zr-narrow-attached-rear-yard",
  "zr-candidate-b1-deep-through-lot-vertical-yard"
]);

const byID = (caseID) => successor.cases.find((testCase) => testCase.id === caseID);
const parentByID = (caseID) => source.cases.find((testCase) => testCase.id === caseID);

const specialDistrict = byID("zr-special-district-demolition");
const parentSpecialDistrict = parentByID(specialDistrict.id);
const approvedSpecialDistrictConcept =
  "Section 101-04 establishes that Section 101-75 applies to the Atlantic Avenue Subdistrict within the Special Downtown Brooklyn District.";
assert.equal(specialDistrict.question, parentSpecialDistrict.question);
assert.deepEqual(specialDistrict.requiredConcepts, [
  approvedSpecialDistrictConcept,
  ...parentSpecialDistrict.requiredConcepts.slice(1)
]);
assert(!specialDistrict.requiredConcepts.join(" ").includes("101-70"));

const narrowRearYard = byID("zr-narrow-attached-rear-yard");
const parentNarrowRearYard = parentByID(narrowRearYard.id);
const approvedNarrowRearYardConcept =
  "The conclusion is limited to the stated standard-lot facts; selected Section 23-342 contains the shallow-lot modification, and any other exception must be separately evidenced before it can change the result.";
assert.equal(narrowRearYard.question, parentNarrowRearYard.question);
assert.deepEqual(narrowRearYard.requiredConcepts, [
  ...parentNarrowRearYard.requiredConcepts.slice(0, 2),
  approvedNarrowRearYardConcept
]);
assert(!/\b23-34(?!\d)/.test(narrowRearYard.requiredConcepts.join(" ")));

const deepThroughLot = byID("zr-candidate-b1-deep-through-lot-vertical-yard");
const parentDeepThroughLot = parentByID(deepThroughLot.id);
assert.equal(deepThroughLot.question,
  `${parentDeepThroughLot.question} The building and zoning lot contain no community-facility use.`);
assert.deepEqual(deepThroughLot.selectedEvidenceSectionIDs, [20018523, 20018060]);
assert.equal(deepThroughLot.expectedConclusion,
  "No, assuming the stated 30 feet is the regulated depth. Because the building and zoning lot contain no community-facility use, selected ZR 23-343 supplies the residential branch. For the stated 200-foot-deep through lot, the 190-foot standard-lot rule requires a rear yard equivalent 40 feet deep for building portions at or below 75 feet and 60 feet deep above 75 feet, where permitted. The 30-foot depth is therefore 10 feet short at and below 75 feet and 30 feet short above 75 feet; the upper 25 feet of each 100-foot wing is in the above-75-foot tier. The standard location is midway, or within 10 feet of being midway, between the street lines. The plans must still confirm the dimension's orientation, qualifying through-lot geometry, listed exceptions, permitted obstructions, and any special-district modification.");
assert.deepEqual(deepThroughLot.requiredConcepts, [
  "With the stated absence of any community-facility use in the building or zoning lot, apply selected ZR 23-343's residential through-lot rule.",
  "Apply the 190-foot standard-lot threshold to the stated 200-foot-deep through lot.",
  "For building portions at or below 75 feet, require a 40-foot rear yard equivalent and calculate a 10-foot deficiency if the supplied 30-foot dimension is the regulated depth.",
  "For building portions above 75 feet, where permitted, require a 60-foot rear yard equivalent and calculate a 30-foot deficiency if the supplied 30-foot dimension is the regulated depth.",
  "Because both wings rise to 100 feet, identify the upper 25 vertical feet of each wing as above the 75-foot tier.",
  "State that the standard location is midway, or within 10 feet of being midway, between the two street lines.",
  "Distinguish a generic space between wings from a legally compliant rear yard equivalent.",
  "Preserve uncertainty about dimensional orientation, qualifying through-lot geometry, listed exceptions, permitted obstructions, and any special-district modification."
]);
assert(!deepThroughLot.expectedConclusion.includes("24-382"));
assert(deepThroughLot.successorDispositionIDs.includes("replace-deep-through-lot-key"));
assert(deepThroughLot.successorDispositionIDs.includes(
  "correct-deep-through-lot-residential-branch"));
assert.equal(deepThroughLot.successorRevisionNotes, parentDeepThroughLot.successorRevisionNotes);
assert.equal(deepThroughLot.successorRevisionAppliedAt,
  parentDeepThroughLot.successorRevisionAppliedAt);

const adapted = await adaptZoningEvaluationDataset({
  zoningDataset: successor,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary,
  paidExecution: false
});
assert.equal(adapted.cases.length, 30);
assert(adapted.cases.every((testCase) =>
  testCase.answerKeyEvidenceMismatches.length === 0),
"Every remediation-successor-2 answer-key provision must exist in selected evidence.");
for (const testCase of adapted.cases) {
  assert(testCase.selectedEvidence.length > 0, `${testCase.id} has no selected evidence.`);
  for (const evidence of testCase.selectedEvidence) {
    assert(evidence.exactPassages.length > 0,
      `${testCase.id} has no exact passage for ${evidence.reference}.`);
  }
}

const directLiveAttempt = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-2",
  "--run-live"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: { ...process.env, OPENAI_API_KEY: "" }
});
assert.equal(directLiveAttempt.status, 1);
assert.match(`${directLiveAttempt.stdout}\n${directLiveAttempt.stderr}`,
  /has no paid authorization.*No provider request was made/i);

console.log("Zoning remediation successor 2 governance contract passed", {
  decisions: manifest.decisions.length,
  cases: successor.cases.length,
  changedCases: actualChangedCaseIDs.length,
  answerKeyEvidenceMismatches: 0,
  selectedEvidenceUnchanged: true,
  forbiddenClaimsUnchanged: true,
  directLiveAttemptBlocked: true,
  paidEvaluationAllowed: successor.governance.paidEvaluationAllowed,
  publicResearchReleaseAuthorized: successor.governance.publicResearchReleaseAuthorized
});
