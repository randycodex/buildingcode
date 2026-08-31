import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireZoningRemediationSuccessor3GenerationAuthorization,
  validateZoningRemediationSuccessor3Dispositions
} from "./zoning-successor-remediation-3-governance.mjs";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(
  evalsDirectory,
  "zoning-expanded-successor-remediation-3-dispositions.json"
);
const outputPath = resolve(
  evalsDirectory,
  "zoning-cases-expanded-batch-1-successor-remediation-3.json"
);
const frozenAt = "2026-08-30T23:58:38.000Z";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function caseByID(dataset, caseID) {
  const testCase = dataset.cases.find((candidate) => candidate.id === caseID);
  assert(testCase, `Missing Zoning remediation-successor-3 case: ${caseID}`);
  return testCase;
}

function replaceConcept(testCase, previous, replacement) {
  const index = testCase.requiredConcepts.indexOf(previous);
  assert(index >= 0, `Missing concept in ${testCase.id}: ${previous}`);
  assert(!testCase.requiredConcepts.includes(replacement),
    `Replacement concept was already applied in ${testCase.id}.`);
  testCase.requiredConcepts.splice(index, 1, replacement);
}

function replaceQuestion(testCase, previous, replacement) {
  assert(testCase.question === previous,
    `The source question changed before remediation-3 generation: ${testCase.id}`);
  testCase.question = replacement;
}

function recordRemediationDisposition(testCase, decisionID, note) {
  testCase.successorDispositionIDs = [
    ...new Set([...(testCase.successorDispositionIDs || []), decisionID])
  ];
  testCase.remediationSuccessor3Revisions = [
    ...(testCase.remediationSuccessor3Revisions || []),
    { decisionID, note, appliedAt: frozenAt }
  ];
}

const validation = requireZoningRemediationSuccessor3GenerationAuthorization(
  await validateZoningRemediationSuccessor3Dispositions({ manifestPath })
);
const successor = structuredClone(validation.source);
successor.name =
  "Permitext NYC Zoning Resolution expanded diagnostic successor — owner-approved remediation 3";
successor.governance = {
  status: "frozen",
  frozenAt,
  frozenCaseCount: validation.source.cases.length,
  parentSuccessor: {
    file: validation.manifest.sourceCohort.file,
    caseCount: validation.manifest.sourceCohort.caseCount,
    sha256: validation.manifest.sourceCohort.sha256,
    mutationAuthorized: false
  },
  inheritedLineage: {
    rootParentCohort:
      validation.source.governance.inheritedLineage?.rootParentCohort ||
      validation.source.governance.parentSuccessor,
    priorOwnerDisposition: validation.source.governance.ownerDisposition
  },
  ownerDisposition: {
    file: "zoning-expanded-successor-remediation-3-dispositions.json",
    sha256: sha256(validation.manifestText),
    approvedAt: validation.manifest.ownerDecision.recordedAt,
    approvedBy: validation.manifest.ownerDecision.recordedBy,
    decisionIDs: validation.manifest.ownerDecision.acceptedDecisionIDs
  },
  humanOwnerReviewRequired: true,
  humanOwnerReviewComplete: true,
  automaticApprovalAllowed: false,
  professionalZoningSignoff: false,
  publicResearchReleaseAuthorized: false,
  paidEvaluationAllowed: false,
  paidEvaluationAuthorization: {
    status: "locked",
    maximumCumulativeSpendUSD: null,
    requiresNewExplicitOwnerAuthorization: true,
    requiresNewExplicitCumulativeSpendCap: true,
    notes: "Remediation-successor-3 creation and no-cost verification do not authorize any paid semantic run."
  },
  evidenceBudgetCandidate: structuredClone(
    validation.source.governance.evidenceBudgetCandidate
  ),
  notes: "The remediation-successor-2 cohort, its consumed authorization, and its immutable semantic result remain unchanged. This separately frozen successor contains only the two owner-approved rubric/evidence corrections."
};

const missingLocation = caseByID(successor, "zr-missing-location-facts");
replaceQuestion(
  missingLocation,
  "Can a proposed self-service storage facility be found permitted as-of-right on a specific property when its address, mapped zoning district, special-district status, Appendix J subarea, lot area, and any December 19, 2017 existing-facility facts have not been provided?",
  "Can a proposed self-service storage facility be found permitted as-of-right on a specific property when its address, mapped zoning district, special-district status, Appendix J subarea, current lot area, and zoning-lot area on December 19, 2017 have not been provided?"
);
replaceConcept(
  missingLocation,
  "The answer identifies the missing address, mapped zoning district, special-district status, Appendix J map/subarea, lot area, and existing-facility/date facts.",
  "The answer identifies the missing address, mapped zoning district, special-district status, Appendix J map/subarea, current lot area, and zoning-lot area on December 19, 2017."
);
replaceConcept(
  missingLocation,
  "The answer explains that a December 19, 2017 facility may follow separate conforming-use documentation, enlargement, reconstruction, or nonconforming-use rules that cannot be assumed from the question.",
  "The answer explains that selected Section 42-192 uses December 19, 2017 to determine whether the zoning lot was less than 50,000 square feet in area on that date."
);
recordRemediationDisposition(
  missingLocation,
  "narrow-missing-location-to-selected-lot-area-fact",
  "Replaced the unsupported existing-facility legal branch with the selected ZR 42-192 zoning-lot area fact dated December 19, 2017."
);

const parking = caseByID(
  successor,
  "zr-candidate-b1-r6-parking-unverified-transit-zone"
);
replaceConcept(
  parking,
  "A separately defined special parking area or special district may produce a different result.",
  "The selected ZR 12-10 evidence establishes only that the Greater Transit Zone includes special parking areas. Because no selected passage supplies the governing special-parking-area rule, the answer must not assign a parking result for that geography and must identify the controlling enacted special-parking provision as additional evidence needed."
);
recordRemediationDisposition(
  parking,
  "narrow-parking-special-area-to-selected-evidence",
  "Replaced the unsupported special-parking-area or special-district result with the selected-evidence limitation and request for the controlling enacted provision."
);

assert(successor.researchEligibility === false,
  "Remediation successor 3 may not enable Research eligibility.");
assert(successor.governance.evidenceBudgetCandidate.maximumSupplementalCharacters === 24_000 &&
  successor.governance.evidenceBudgetCandidate.enabledByDefault === false &&
  successor.governance.evidenceBudgetCandidate.productionConfigurationChanged === false,
"The retained evidence-budget candidate must remain disabled and non-Production.");
assert(successor.cases.length === 30,
  "The remediation successor 3 must retain all 30 case identities.");
assert(new Set(successor.cases.map((testCase) => testCase.id)).size === 30,
  "The remediation successor 3 has duplicate case IDs.");

const changedCaseIDs = new Set(
  validation.manifest.decisions.map((decision) => decision.caseID)
);
for (const parentCase of validation.source.cases) {
  const successorCase = caseByID(successor, parentCase.id);
  assert(JSON.stringify(successorCase.selectedEvidenceSectionIDs) ===
    JSON.stringify(parentCase.selectedEvidenceSectionIDs),
  `${parentCase.id} changed selected evidence.`);
  assert(JSON.stringify(successorCase.evidenceReviewTermsBySection) ===
    JSON.stringify(parentCase.evidenceReviewTermsBySection),
  `${parentCase.id} changed evidence-review terms.`);
  assert(JSON.stringify(successorCase.forbiddenClaims) ===
    JSON.stringify(parentCase.forbiddenClaims),
  `${parentCase.id} changed forbidden claims.`);
  if (!changedCaseIDs.has(parentCase.id)) {
    assert(JSON.stringify(successorCase) === JSON.stringify(parentCase),
      `${parentCase.id} changed without a remediation-3 disposition.`);
  }
}

const output = `${JSON.stringify(successor, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  const existing = await readFile(outputPath, "utf8");
  assert(existing === output,
    "The Zoning remediation successor 3 is stale. Run node evals/build-zoning-expanded-successor-remediation-3.mjs --write.");
  console.log("Zoning remediation successor 3 is current.");
}
