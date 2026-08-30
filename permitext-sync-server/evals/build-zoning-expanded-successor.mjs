import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireZoningSuccessorGenerationAuthorization,
  validateZoningSuccessorDispositions
} from "./zoning-successor-governance.mjs";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(evalsDirectory, "zoning-expanded-successor-dispositions.json");
const outputPath = resolve(evalsDirectory, "zoning-cases-expanded-batch-1-successor.json");
const frozenAt = "2026-08-30T19:09:05.000Z";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function caseByID(dataset, caseID) {
  const testCase = dataset.cases.find((candidate) => candidate.id === caseID);
  assert(testCase, `Missing Zoning successor case: ${caseID}`);
  return testCase;
}

function removeConcept(testCase, concept) {
  const index = testCase.requiredConcepts.indexOf(concept);
  assert(index >= 0, `Missing concept in ${testCase.id}: ${concept}`);
  testCase.requiredConcepts.splice(index, 1);
}

function replaceConcept(testCase, previous, replacement) {
  const index = testCase.requiredConcepts.indexOf(previous);
  assert(index >= 0, `Missing concept in ${testCase.id}: ${previous}`);
  testCase.requiredConcepts.splice(index, 1, replacement);
}

function recordDisposition(testCase, decisionID, note) {
  testCase.successorDispositionIDs = [
    ...new Set([...(testCase.successorDispositionIDs || []), decisionID])
  ];
  testCase.successorRevisionNotes = note;
  testCase.successorRevisionAppliedAt = frozenAt;
  testCase.reviewer = "Permitext owner";
  testCase.reviewedAt = frozenAt;
  testCase.approvalScope = "Evaluation testing only; no public Research, professional sign-off, deployment, or paid-run authorization.";
}

const validation = requireZoningSuccessorGenerationAuthorization(
  await validateZoningSuccessorDispositions({ manifestPath })
);
const manifestText = await readFile(manifestPath, "utf8");
const successor = structuredClone(validation.source);
successor.name = "Permitext NYC Zoning Resolution expanded diagnostic successor — owner-approved remediation 1";
successor.governance = {
  status: "frozen",
  frozenAt,
  frozenCaseCount: validation.source.cases.length,
  parentCohort: {
    file: validation.manifest.sourceCohort.file,
    caseCount: validation.manifest.sourceCohort.caseCount,
    sha256: validation.manifest.sourceCohort.sha256,
    mutationAuthorized: false
  },
  ownerDisposition: {
    file: "zoning-expanded-successor-dispositions.json",
    sha256: sha256(manifestText),
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
    notes: "Successor creation and no-cost verification do not authorize any paid semantic run."
  },
  evidenceBudgetCandidate: {
    maximumSupplementalCharacters: 24000,
    enabledByDefault: false,
    productionConfigurationChanged: false
  },
  notes: "The frozen 30-case parent and retained paid result remain unchanged. This separately frozen successor contains only eight explicitly approved answer-key and rubric-scope dispositions."
};

const uap = caseByID(successor, "zr-candidate-b1-r6a-uap-insufficient-affordable-area");
uap.expectedConclusion = "No—not on the stated facts and selected evidence alone. The proposal is 3.875 FAR. That is below the table's 3.90 numerical ceiling but above the 3.00 standard-residence ceiling by 7,000 square feet. The stated intent to make 6,200 square feet affordable does not establish calculated affordable floor area, UAP-site eligibility, or entitlement to the qualifying-affordable-housing column. Those conclusions require the missing enacted UAP eligibility/linkage provisions and qualifying project documents.";
uap.requiredConcepts = [
  "Calculate 31,000 / 8,000 = 3.875 FAR, the 24,000-square-foot standard maximum, and the 31,200-square-foot table ceiling.",
  "Distinguish a numerical ceiling from entitlement to use the qualifying-affordable-housing column.",
  "State that owner-designated unit area does not by itself establish affordable floor area under the selected definition.",
  "Identify the missing UAP eligibility/FAR-linkage provision and applicable affordable-housing agreement or restrictive declaration.",
  "Do not invent the one-for-one increment, 30,200-square-foot maximum, or 800-square-foot deficiency unless added enacted evidence proves those rules."
];
recordDisposition(
  uap,
  "replace-uap-insufficient-affordable-area-key",
  "Replaced the unsupported one-for-one UAP increment key with the owner-approved source-bound insufficiency key."
);

const deepThroughLot = caseByID(successor, "zr-candidate-b1-deep-through-lot-vertical-yard");
deepThroughLot.expectedConclusion = "No, if the stated 30 feet is the required depth measured perpendicular to the street lines. For the stated 200-foot-deep R7A through lot, ZR 24-382 requires a single open area at least 60 feet deep, midway or within five feet of midway between the street lines. A 30-foot depth is therefore 30 feet short. The plans must still confirm the dimension's orientation, midpoint location, qualifying lot geometry, applicable exceptions, and permitted-obstruction treatment.";
deepThroughLot.requiredConcepts = [
  "Apply the R7A-specific at-least-180-foot rule and its 60-foot depth.",
  "Calculate a 30-foot deficiency if the supplied 30-foot dimension is the regulated depth.",
  "Require the midpoint or within-five-feet-of-midpoint location.",
  "Distinguish a generic space between wings from a legally compliant rear yard equivalent.",
  "Preserve uncertainty about dimensional orientation, geometry, exceptions, and obstructions.",
  "Do not require the general 190-foot or height-tier analysis where the selected R7A-specific rule controls."
];
recordDisposition(
  deepThroughLot,
  "replace-deep-through-lot-key",
  "Replaced the conflicting general height-tier key with the owner-approved R7A-specific ZR 24-382 key."
);

const rules = caseByID(successor, "zr-rules-of-construction");
removeConcept(rules, "The particular controls the general.");
recordDisposition(
  rules,
  "trim-rules-of-construction-collateral-concept",
  "Removed a separate construction rule that did not answer the text-versus-illustration question."
);

const warehouse = caseByID(successor, "zr-candidate-b1-nonconforming-warehouse-enlargement");
removeConcept(warehouse,
  "Proposed amount below potential numerical maximum: 9,000 sf − 5,000 sf = 4,000 sf");
recordDisposition(
  warehouse,
  "trim-warehouse-duplicate-margin",
  "Retained the central 25 percent calculation and removed only the unused duplicate margin."
);

const weightedFAR = caseByID(successor, "zr-candidate-b1-r7a-r8a-weighted-far");
removeConcept(weightedFAR,
  "Alternative direct check: (8,000 sf × 4.00) + (12,000 sf × 6.02) = 32,000 sf + 72,240 sf = 104,240 sf");
recordDisposition(
  weightedFAR,
  "trim-weighted-far-duplicate-proof",
  "Retained the weighted method and proposed-FAR comparison while removing the equivalent direct-area proof."
);

const conversion = caseByID(successor, "zr-candidate-b1-c6-2-office-residential-conversion");
recordDisposition(
  conversion,
  "retain-office-conversion-existing-far",
  "Owner confirmed that the existing 6.00 FAR calculation remains a material required concept; no rubric concept was removed."
);

const transition = caseByID(successor, "zr-candidate-b1-city-of-yes-transition");
for (const concept of [
  "Amendment adoption and effective date.",
  "Current transition text versus archived substantive text.",
  "Reported incomplete foundations: 100% − 60% = 40%",
  "Therefore, the reported work is 40 percentage points short of the general completed-foundation condition."
]) {
  removeConcept(transition, concept);
}
recordDisposition(
  transition,
  "trim-transition-duplicate-history-and-arithmetic",
  "Retained the DOB-record and verified prior-substantive-text boundaries while removing overlapping history and duplicate 40 percent requirements."
);

const mih = caseByID(successor, "zr-candidate-b1-mih-historical-zoning-lot");
replaceConcept(
  mih,
  "Recorded zoning-lot declarations and metes and bounds.",
  "Official historical zoning-lot evidence, including any relevant recorded declaration or legal description."
);
replaceConcept(
  mih,
  "Unit threshold: 8 units ≤ 10 units Margin: 2 units",
  "Unit threshold: 8 units ≤ 10 units."
);
replaceConcept(
  mih,
  "Floor-area threshold: 10,000 sf ≤ 12,500 sf Margin: 2,500 sf",
  "Floor-area threshold: 10,000 sf ≤ 12,500 sf."
);
recordDisposition(
  mih,
  "trim-mih-unused-margins-and-record-prescription",
  "Retained the thresholds and historical map/lot inquiry while removing unused margins and allowing equivalent official historical lot evidence."
);

assert(successor.cases.length === 30, "The successor cohort must retain all 30 case identities.");
assert(new Set(successor.cases.map((testCase) => testCase.id)).size === 30,
  "The successor cohort has duplicate case IDs.");

const output = `${JSON.stringify(successor, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  const existing = await readFile(outputPath, "utf8");
  assert(existing === output,
    "The owner-approved Zoning successor is stale. Run node evals/build-zoning-expanded-successor.mjs --write.");
  console.log("Owner-approved Zoning successor is current.");
}
