import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  requireZoningRemediationSuccessor3GenerationAuthorization,
  validateZoningRemediationSuccessor3Dispositions
} from "../evals/zoning-successor-remediation-3-governance.mjs";
import { adaptZoningEvaluationDataset } from "../evals/zoning-evaluation-adapter.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const validation = await validateZoningRemediationSuccessor3Dispositions();
const { manifest, source } = validation;

assert.equal(manifest.status, "owner_approved");
assert.equal(manifest.ownerDecision.recordedAt, "2026-08-30T23:58:38.000Z");
assert.equal(manifest.ownerDecision.recordedBy, "Permitext owner");
assert.equal(manifest.ownerDecision.exactApprovalPhrase, "Ok, go ahead");
assert.equal(validation.approvedDecisionIDs.length, 2);
assert.equal(validation.generationAuthorized, true);
assert.equal(
  requireZoningRemediationSuccessor3GenerationAuthorization(validation),
  validation
);

const successorText = await readFile(
  new URL(
    "../evals/zoning-cases-expanded-batch-1-successor-remediation-3.json",
    import.meta.url
  ),
  "utf8"
);
const successor = JSON.parse(successorText);
const manifestText = await readFile(
  new URL(
    "../evals/zoning-expanded-successor-remediation-3-dispositions.json",
    import.meta.url
  ),
  "utf8"
);

assert.equal(sha256(validation.sourceText),
  "459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b");
assert.equal(sha256(successorText),
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc");
assert.equal(successor.governance.status, "frozen");
assert.equal(successor.researchEligibility, false);
assert.equal(successor.governance.parentSuccessor.sha256, manifest.sourceCohort.sha256);
assert.equal(successor.governance.parentSuccessor.mutationAuthorized, false);
assert.equal(successor.governance.ownerDisposition.sha256, sha256(manifestText));
assert.deepEqual(
  successor.governance.ownerDisposition.decisionIDs,
  manifest.ownerDecision.acceptedDecisionIDs
);
assert.equal(successor.governance.humanOwnerReviewComplete, true);
assert.equal(successor.governance.paidEvaluationAllowed, false);
assert.equal(successor.governance.paidEvaluationAuthorization.status, "locked");
assert.equal(successor.governance.paidEvaluationAuthorization.maximumCumulativeSpendUSD, null);
assert.equal(successor.governance.publicResearchReleaseAuthorized, false);
assert.equal(successor.governance.professionalZoningSignoff, false);
assert.equal(successor.governance.evidenceBudgetCandidate.maximumSupplementalCharacters, 24_000);
assert.equal(successor.governance.evidenceBudgetCandidate.enabledByDefault, false);
assert.equal(successor.governance.evidenceBudgetCandidate.productionConfigurationChanged, false);
assert.deepEqual(
  successor.cases.map((testCase) => testCase.id),
  source.cases.map((testCase) => testCase.id)
);

const dispositionCaseIDs = new Set(
  manifest.decisions.map((decision) => decision.caseID)
);
const actualChangedCaseIDs = [];
const allowedMetadataFields = [
  "successorDispositionIDs",
  "remediationSuccessor3Revisions"
];
for (const parentCase of source.cases) {
  const successorCase = successor.cases.find(
    (testCase) => testCase.id === parentCase.id
  );
  assert(successorCase, `Missing remediation-3 case ${parentCase.id}`);
  assert.deepEqual(
    successorCase.selectedEvidenceSectionIDs,
    parentCase.selectedEvidenceSectionIDs,
    `${parentCase.id} changed selected evidence.`
  );
  assert.deepEqual(
    successorCase.evidenceReviewTermsBySection,
    parentCase.evidenceReviewTermsBySection,
    `${parentCase.id} changed evidence-review terms.`
  );
  assert.deepEqual(
    successorCase.forbiddenClaims,
    parentCase.forbiddenClaims,
    `${parentCase.id} changed forbidden claims.`
  );
  if (JSON.stringify(successorCase) !== JSON.stringify(parentCase)) {
    actualChangedCaseIDs.push(parentCase.id);
  }
  if (!dispositionCaseIDs.has(parentCase.id)) {
    assert.deepEqual(
      successorCase,
      parentCase,
      `${parentCase.id} changed without an approved remediation-3 disposition.`
    );
    continue;
  }
  const decision = manifest.decisions.find(
    (item) => item.caseID === parentCase.id
  );
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
  assert.deepEqual(
    successorComparable,
    parentComparable,
    `${parentCase.id} changed outside its approved remediation-3 fields.`
  );
  assert(successorCase.successorDispositionIDs.includes(decision.id),
    `${parentCase.id} lacks its remediation-3 disposition ID.`);
  assert.deepEqual(
    successorCase.remediationSuccessor3Revisions.map((item) => item.decisionID),
    [decision.id]
  );
}
assert.deepEqual(actualChangedCaseIDs, [
  "zr-missing-location-facts",
  "zr-candidate-b1-r6-parking-unverified-transit-zone"
]);

const byID = (caseID) => successor.cases.find(
  (testCase) => testCase.id === caseID
);
const parentByID = (caseID) => source.cases.find(
  (testCase) => testCase.id === caseID
);

const missingLocation = byID("zr-missing-location-facts");
const parentMissingLocation = parentByID(missingLocation.id);
assert.equal(missingLocation.question,
  "Can a proposed self-service storage facility be found permitted as-of-right on a specific property when its address, mapped zoning district, special-district status, Appendix J subarea, current lot area, and zoning-lot area on December 19, 2017 have not been provided?");
assert.equal(missingLocation.requiredConcepts[0], parentMissingLocation.requiredConcepts[0]);
assert.equal(missingLocation.requiredConcepts[2], parentMissingLocation.requiredConcepts[2]);
assert.equal(missingLocation.requiredConcepts[1],
  "The answer identifies the missing address, mapped zoning district, special-district status, Appendix J map/subarea, current lot area, and zoning-lot area on December 19, 2017.");
assert.equal(missingLocation.requiredConcepts[3],
  "The answer explains that selected Section 42-192 uses December 19, 2017 to determine whether the zoning lot was less than 50,000 square feet in area on that date.");
assert(!/existing-facility|conforming-use|nonconforming-use|enlargement|reconstruction/i.test(
  `${missingLocation.question} ${missingLocation.requiredConcepts.join(" ")}`
));
assert.match(`${missingLocation.question} ${missingLocation.requiredConcepts.join(" ")}`,
  /December 19, 2017/i);
assert.match(missingLocation.requiredConcepts.join(" "),
  /less than 50,000 square feet/i);

const parking = byID("zr-candidate-b1-r6-parking-unverified-transit-zone");
const parentParking = parentByID(parking.id);
const parkingReplacement =
  "The selected ZR 12-10 evidence establishes only that the Greater Transit Zone includes special parking areas. Because no selected passage supplies the governing special-parking-area rule, the answer must not assign a parking result for that geography and must identify the controlling enacted special-parking provision as additional evidence needed.";
assert.equal(parking.question, parentParking.question);
assert.equal(parking.requiredConcepts.length, parentParking.requiredConcepts.length);
assert.equal(parking.requiredConcepts[4], parkingReplacement);
assert.equal(parking.requiredConcepts[8], parentParking.requiredConcepts[8]);
for (let index = 0; index < parking.requiredConcepts.length; index += 1) {
  if (index === 4) continue;
  assert.equal(parking.requiredConcepts[index], parentParking.requiredConcepts[index]);
}
assert(!parking.requiredConcepts.includes(
  "A separately defined special parking area or special district may produce a different result."
));

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
"Every remediation-successor-3 answer-key provision must exist in selected evidence.");
for (const testCase of adapted.cases) {
  assert(testCase.selectedEvidence.length > 0, `${testCase.id} has no selected evidence.`);
  for (const evidence of testCase.selectedEvidence) {
    assert(evidence.exactPassages.length > 0,
      `${testCase.id} has no exact passage for ${evidence.reference}.`);
  }
}
const adaptedMissingLocation = adapted.cases.find(
  (testCase) => testCase.id === missingLocation.id
);
const adaptedParking = adapted.cases.find((testCase) => testCase.id === parking.id);
assert.equal(adaptedMissingLocation.requiredCitations.length, 5);
assert.equal(adaptedParking.requiredCitations.length, 4);
assert(adaptedParking.selectedEvidence.some((evidence) =>
  evidence.reference === "ZR 12-10" &&
  evidence.exactPassages.some((passage) => passage.includes("special parking areas"))
));
assert(!adaptedParking.selectedEvidence.some((evidence) =>
  /special district/i.test(evidence.reference)
));

console.log("Zoning remediation successor 3 governance contract passed", {
  decisions: manifest.decisions.length,
  cases: successor.cases.length,
  changedCases: actualChangedCaseIDs.length,
  answerKeyEvidenceMismatches: 0,
  selectedEvidenceUnchanged: true,
  evidenceReviewTermsUnchanged: true,
  forbiddenClaimsUnchanged: true,
  paidEvaluationAllowed: successor.governance.paidEvaluationAllowed,
  publicResearchReleaseAuthorized: successor.governance.publicResearchReleaseAuthorized
});
