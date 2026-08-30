import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireZoningRemediationSuccessor2GenerationAuthorization,
  validateZoningRemediationSuccessor2Dispositions
} from "./zoning-successor-remediation-2-governance.mjs";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(
  evalsDirectory,
  "zoning-expanded-successor-remediation-2-dispositions.json"
);
const outputPath = resolve(
  evalsDirectory,
  "zoning-cases-expanded-batch-1-successor-remediation-2.json"
);
const frozenAt = "2026-08-30T21:40:28.000Z";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function caseByID(dataset, caseID) {
  const testCase = dataset.cases.find((candidate) => candidate.id === caseID);
  assert(testCase, `Missing Zoning remediation-successor-2 case: ${caseID}`);
  return testCase;
}

function replaceConcept(testCase, previous, replacement) {
  const index = testCase.requiredConcepts.indexOf(previous);
  assert(index >= 0, `Missing concept in ${testCase.id}: ${previous}`);
  testCase.requiredConcepts.splice(index, 1, replacement);
}

function recordRemediationDisposition(testCase, decisionID, note) {
  testCase.successorDispositionIDs = [
    ...new Set([...(testCase.successorDispositionIDs || []), decisionID])
  ];
  testCase.remediationSuccessor2Revisions = [
    ...(testCase.remediationSuccessor2Revisions || []),
    { decisionID, note, appliedAt: frozenAt }
  ];
}

const validation = requireZoningRemediationSuccessor2GenerationAuthorization(
  await validateZoningRemediationSuccessor2Dispositions({ manifestPath })
);
const successor = structuredClone(validation.source);
successor.name =
  "Permitext NYC Zoning Resolution expanded diagnostic successor — owner-approved remediation 2";
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
    rootParentCohort: validation.source.governance.parentCohort,
    priorOwnerDisposition: validation.source.governance.ownerDisposition
  },
  ownerDisposition: {
    file: "zoning-expanded-successor-remediation-2-dispositions.json",
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
    notes: "Remediation-successor-2 creation and no-cost verification do not authorize any paid semantic run."
  },
  evidenceBudgetCandidate: structuredClone(
    validation.source.governance.evidenceBudgetCandidate
  ),
  notes: "The historical parent successor, its consumed authorization, and retained paid result remain unchanged. This separately frozen successor contains only the three explicitly approved source-bound case corrections."
};

const specialDistrict = caseByID(successor, "zr-special-district-demolition");
replaceConcept(
  specialDistrict,
  "Section 101-04 establishes that Sections 101-70 through 101-75 apply to the Atlantic Avenue Subdistrict within the Special Downtown Brooklyn District.",
  "Section 101-04 establishes that Section 101-75 applies to the Atlantic Avenue Subdistrict within the Special Downtown Brooklyn District."
);
recordRemediationDisposition(
  specialDistrict,
  "rephrase-special-district-selected-applicability",
  "Rephrased only the applicability concept so it names selected ZR 101-04 and 101-75 without requiring unselected ZR 101-70."
);

const narrowRearYard = caseByID(successor, "zr-narrow-attached-rear-yard");
replaceConcept(
  narrowRearYard,
  "The conclusion is limited to the stated standard-lot facts and does not erase the shallow-lot modification or other exceptions in Section 23-34.",
  "The conclusion is limited to the stated standard-lot facts; selected Section 23-342 contains the shallow-lot modification, and any other exception must be separately evidenced before it can change the result."
);
recordRemediationDisposition(
  narrowRearYard,
  "rephrase-narrow-rear-yard-selected-exceptions",
  "Rephrased only the exception boundary so selected ZR 23-342 supplies the shallow-lot modification and any other exception requires separate evidence."
);

const deepThroughLot = caseByID(
  successor,
  "zr-candidate-b1-deep-through-lot-vertical-yard"
);
const approvedQuestionFact =
  " The building and zoning lot contain no community-facility use.";
assert(!deepThroughLot.question.endsWith(approvedQuestionFact),
  "The remediation-2 Case 23 fact was already applied to its immutable parent.");
deepThroughLot.question += approvedQuestionFact;
deepThroughLot.expectedConclusion = "No, assuming the stated 30 feet is the regulated depth. Because the building and zoning lot contain no community-facility use, selected ZR 23-343 supplies the residential branch. For the stated 200-foot-deep through lot, the 190-foot standard-lot rule requires a rear yard equivalent 40 feet deep for building portions at or below 75 feet and 60 feet deep above 75 feet, where permitted. The 30-foot depth is therefore 10 feet short at and below 75 feet and 30 feet short above 75 feet; the upper 25 feet of each 100-foot wing is in the above-75-foot tier. The standard location is midway, or within 10 feet of being midway, between the street lines. The plans must still confirm the dimension's orientation, qualifying through-lot geometry, listed exceptions, permitted obstructions, and any special-district modification.";
deepThroughLot.requiredConcepts = [
  "With the stated absence of any community-facility use in the building or zoning lot, apply selected ZR 23-343's residential through-lot rule.",
  "Apply the 190-foot standard-lot threshold to the stated 200-foot-deep through lot.",
  "For building portions at or below 75 feet, require a 40-foot rear yard equivalent and calculate a 10-foot deficiency if the supplied 30-foot dimension is the regulated depth.",
  "For building portions above 75 feet, where permitted, require a 60-foot rear yard equivalent and calculate a 30-foot deficiency if the supplied 30-foot dimension is the regulated depth.",
  "Because both wings rise to 100 feet, identify the upper 25 vertical feet of each wing as above the 75-foot tier.",
  "State that the standard location is midway, or within 10 feet of being midway, between the two street lines.",
  "Distinguish a generic space between wings from a legally compliant rear yard equivalent.",
  "Preserve uncertainty about dimensional orientation, qualifying through-lot geometry, listed exceptions, permitted obstructions, and any special-district modification."
];
recordRemediationDisposition(
  deepThroughLot,
  "correct-deep-through-lot-residential-branch",
  "Added the approved no-community-facility fact and replaced only the expected conclusion and required concepts with the selected ZR 23-343 residential branch."
);

assert(successor.researchEligibility === false,
  "Remediation successor 2 may not enable Research eligibility.");
assert(successor.governance.evidenceBudgetCandidate.maximumSupplementalCharacters === 24_000 &&
  successor.governance.evidenceBudgetCandidate.enabledByDefault === false &&
  successor.governance.evidenceBudgetCandidate.productionConfigurationChanged === false,
"The retained evidence-budget candidate must remain disabled and non-Production.");
assert(successor.cases.length === 30,
  "The remediation successor 2 must retain all 30 case identities.");
assert(new Set(successor.cases.map((testCase) => testCase.id)).size === 30,
  "The remediation successor 2 has duplicate case IDs.");

const changedCaseIDs = new Set(validation.manifest.decisions.map((decision) => decision.caseID));
for (const parentCase of validation.source.cases) {
  const successorCase = caseByID(successor, parentCase.id);
  assert(JSON.stringify(successorCase.selectedEvidenceSectionIDs) ===
    JSON.stringify(parentCase.selectedEvidenceSectionIDs),
  `${parentCase.id} changed selected evidence.`);
  assert(JSON.stringify(successorCase.forbiddenClaims) ===
    JSON.stringify(parentCase.forbiddenClaims),
  `${parentCase.id} changed forbidden claims.`);
  if (!changedCaseIDs.has(parentCase.id)) {
    assert(JSON.stringify(successorCase) === JSON.stringify(parentCase),
      `${parentCase.id} changed without a remediation-2 disposition.`);
  }
}

const output = `${JSON.stringify(successor, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  const existing = await readFile(outputPath, "utf8");
  assert(existing === output,
    "The Zoning remediation successor 2 is stale. Run node evals/build-zoning-expanded-successor-remediation-2.mjs --write.");
  console.log("Zoning remediation successor 2 is current.");
}
