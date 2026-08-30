import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedDecisions = new Map([
  ["rephrase-special-district-selected-applicability", {
    caseID: "zr-special-district-demolition",
    kind: "answer_key_evidence_alignment",
    changesQuestion: false,
    allowedSubstantiveFields: ["requiredConcepts"]
  }],
  ["rephrase-narrow-rear-yard-selected-exceptions", {
    caseID: "zr-narrow-attached-rear-yard",
    kind: "answer_key_evidence_alignment",
    changesQuestion: false,
    allowedSubstantiveFields: ["requiredConcepts"]
  }],
  ["correct-deep-through-lot-residential-branch", {
    caseID: "zr-candidate-b1-deep-through-lot-vertical-yard",
    kind: "answer_key_replacement",
    changesQuestion: true,
    allowedSubstantiveFields: ["question", "expectedConclusion", "requiredConcepts"]
  }]
]);

const expectedReviewEvidenceFiles = [
  "../../docs/PERMITEXT_ZONING_SUCCESSOR_REMEDIATION_2_OWNER_DISPOSITION_2026-08-30.md",
  "../../docs/PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md",
  "../../docs/PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md"
];

export async function validateZoningRemediationSuccessor2Dispositions({
  manifestPath = resolve(evalsDirectory, "zoning-expanded-successor-remediation-2-dispositions.json")
} = {}) {
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  assert(manifest.schemaVersion === 2,
    "Unsupported Zoning remediation-successor-2 disposition schema.");
  assert(manifest.status === "owner_approved",
    "Zoning remediation successor 2 remains locked pending owner approval.");
  assert(manifest.sourceCohort?.file === "zoning-cases-expanded-batch-1-successor.json",
    "Remediation successor 2 must inherit from the immutable first successor.");
  assert(manifest.sourceCohort?.mutationAuthorized === false,
    "The first owner-approved successor must remain immutable.");

  const sourcePath = resolve(evalsDirectory, manifest.sourceCohort.file);
  const sourceText = await readFile(sourcePath, "utf8");
  assert(sha256(sourceText) === manifest.sourceCohort.sha256,
    "The immutable first successor hash changed after remediation-2 disposition preparation.");
  const source = JSON.parse(sourceText);
  assert(source.cases.length === 30 && source.cases.length === manifest.sourceCohort.caseCount,
    "The remediation-2 parent must retain the exact 30-case successor.");
  assert(source.governance?.status === "frozen" && source.researchEligibility === false,
    "The remediation-2 parent must remain a frozen, non-public evaluation successor.");

  assert(Array.isArray(manifest.reviewEvidence) && manifest.reviewEvidence.length === 3,
    "Exactly three remediation-2 review records must be bound.");
  assert(JSON.stringify(manifest.reviewEvidence.map((evidence) => evidence.file)) ===
    JSON.stringify(expectedReviewEvidenceFiles),
  "The exact remediation-2 owner, applicability, and triage review records must be bound.");
  for (const evidence of manifest.reviewEvidence) {
    const evidencePath = resolve(evalsDirectory, evidence.file);
    const evidenceText = await readFile(evidencePath, "utf8");
    assert(sha256(evidenceText) === evidence.sha256,
      `Remediation-2 review evidence changed: ${evidence.file}`);
  }

  assert(Array.isArray(manifest.decisions) && manifest.decisions.length === expectedDecisions.size,
    "Exactly three remediation-2 owner dispositions must be recorded.");
  assert(new Set(manifest.decisions.map((decision) => decision.id)).size === expectedDecisions.size,
    "Remediation-2 disposition IDs must be unique.");
  const sourceCaseIDs = new Set(source.cases.map((testCase) => testCase.id));
  for (const decision of manifest.decisions) {
    const expected = expectedDecisions.get(decision.id);
    assert(expected, `Unexpected remediation-2 disposition: ${decision.id}`);
    assert(decision.status === "approved", `Unapproved remediation-2 disposition: ${decision.id}`);
    assert(decision.caseID === expected.caseID && sourceCaseIDs.has(decision.caseID),
      `Unexpected remediation-2 case for ${decision.id}`);
    assert(decision.kind === expected.kind, `Unexpected remediation-2 kind for ${decision.id}`);
    assert(decision.changesQuestion === expected.changesQuestion,
      `Unexpected question-change scope for ${decision.id}`);
    assert(JSON.stringify(decision.allowedSubstantiveFields) ===
      JSON.stringify(expected.allowedSubstantiveFields),
    `Unexpected substantive-field scope for ${decision.id}`);
    assert(decision.changesSelectedEvidence === false,
      `${decision.id} may not change selected evidence.`);
    assert(decision.changesForbiddenClaims === false,
      `${decision.id} may not weaken forbidden safety claims.`);
  }

  const approvedDecisionIDs = manifest.decisions.map((decision) => decision.id);
  const acceptedDecisionIDs = manifest.ownerDecision?.acceptedDecisionIDs || [];
  const acceptedDecisionSetMatches = acceptedDecisionIDs.length === approvedDecisionIDs.length &&
    acceptedDecisionIDs.every((decisionID) => approvedDecisionIDs.includes(decisionID));
  const ownerRecorded = manifest.ownerDecision?.required === true &&
    manifest.ownerDecision?.recordedBy === "Permitext owner" &&
    manifest.ownerDecision?.recordedAt === "2026-08-30T21:40:28.000Z" &&
    manifest.ownerDecision?.exactApprovalPhrase === "go ahead - non stop, im here if you need me" &&
    manifest.ownerDecision?.approvalContextFile ===
      "../../docs/PERMITEXT_ZONING_SUCCESSOR_REMEDIATION_2_OWNER_DISPOSITION_2026-08-30.md" &&
    acceptedDecisionSetMatches;
  const generationAuthorized = ownerRecorded &&
    manifest.successor?.generationAllowed === true;

  assert(manifest.successor?.outputFile ===
    "zoning-cases-expanded-batch-1-successor-remediation-2.json",
  "Unexpected remediation-successor-2 output path.");
  assert(manifest.successor?.paidEvaluationAllowed === false,
    "Remediation successor 2 preparation may not authorize a paid evaluation.");
  assert(manifest.successor?.publicResearchReleaseAuthorized === false,
    "Remediation successor 2 preparation may not authorize public Zoning Research.");
  assert(manifest.successor?.professionalZoningSignoff === false,
    "Remediation successor 2 may not claim professional Zoning sign-off.");
  assert(manifest.successor?.requiresSeparatePaidAuthorization === true,
    "A later paid run must require separate owner authorization.");
  assert(manifest.successor?.requiresSeparateCumulativeSpendCap === true,
    "A later paid run must require a separate cumulative spend cap.");

  return {
    manifest,
    manifestText,
    manifestPath,
    source,
    sourceText,
    sourcePath,
    approvedDecisionIDs,
    generationAuthorized
  };
}

export function requireZoningRemediationSuccessor2GenerationAuthorization(validation) {
  assert(validation?.generationAuthorized === true,
    "Zoning remediation successor 2 generation is locked pending the exact recorded owner approval.");
  return validation;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningRemediationSuccessor2Dispositions();
  if (process.argv.includes("--require-approved")) {
    requireZoningRemediationSuccessor2GenerationAuthorization(validation);
  }
  console.log("Zoning remediation successor 2 disposition governance passed", {
    status: validation.manifest.status,
    decisions: validation.manifest.decisions.length,
    generationAuthorized: validation.generationAuthorized,
    paidEvaluationAllowed: validation.manifest.successor.paidEvaluationAllowed,
    publicResearchReleaseAuthorized:
      validation.manifest.successor.publicResearchReleaseAuthorized
  });
}
