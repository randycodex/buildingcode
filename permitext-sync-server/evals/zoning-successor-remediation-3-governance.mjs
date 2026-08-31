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
  ["narrow-missing-location-to-selected-lot-area-fact", {
    caseID: "zr-missing-location-facts",
    kind: "question_and_answer_key_evidence_alignment",
    changesQuestion: true,
    allowedSubstantiveFields: ["question", "requiredConcepts"]
  }],
  ["narrow-parking-special-area-to-selected-evidence", {
    caseID: "zr-candidate-b1-r6-parking-unverified-transit-zone",
    kind: "answer_key_evidence_alignment",
    changesQuestion: false,
    allowedSubstantiveFields: ["requiredConcepts"]
  }]
]);

const expectedReviewEvidenceFiles = [
  "../../docs/PERMITEXT_ZONING_REMEDIATION_2_SEMANTIC_RESULT_2026-08-30.md",
  "../../docs/PERMITEXT_ZONING_SUCCESSOR_REMEDIATION_3_OWNER_DISPOSITION_2026-08-30.md"
];

export async function validateZoningRemediationSuccessor3Dispositions({
  manifestPath = resolve(
    evalsDirectory,
    "zoning-expanded-successor-remediation-3-dispositions.json"
  )
} = {}) {
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  assert(manifest.schemaVersion === 3,
    "Unsupported Zoning remediation-successor-3 disposition schema.");
  assert(manifest.status === "owner_approved",
    "Zoning remediation successor 3 remains locked pending owner approval.");
  assert(manifest.sourceCohort?.file ===
    "zoning-cases-expanded-batch-1-successor-remediation-2.json",
  "Remediation successor 3 must inherit from the immutable remediation successor 2.");
  assert(manifest.sourceCohort?.mutationAuthorized === false,
    "Remediation successor 2 must remain immutable.");

  const sourcePath = resolve(evalsDirectory, manifest.sourceCohort.file);
  const sourceText = await readFile(sourcePath, "utf8");
  assert(sha256(sourceText) === manifest.sourceCohort.sha256,
    "The immutable remediation-successor-2 hash changed after remediation-3 disposition preparation.");
  const source = JSON.parse(sourceText);
  assert(source.cases.length === 30 &&
    source.cases.length === manifest.sourceCohort.caseCount,
  "The remediation-3 parent must retain the exact 30-case successor.");
  assert(source.governance?.status === "frozen" && source.researchEligibility === false,
    "The remediation-3 parent must remain a frozen, non-public evaluation successor.");

  assert(Array.isArray(manifest.reviewEvidence) &&
    manifest.reviewEvidence.length === expectedReviewEvidenceFiles.length,
  "Exactly two remediation-3 review records must be bound.");
  assert(JSON.stringify(manifest.reviewEvidence.map((evidence) => evidence.file)) ===
    JSON.stringify(expectedReviewEvidenceFiles),
  "The exact remediation-3 semantic-result and owner-disposition records must be bound.");
  for (const evidence of manifest.reviewEvidence) {
    const evidencePath = resolve(evalsDirectory, evidence.file);
    const evidenceText = await readFile(evidencePath, "utf8");
    assert(sha256(evidenceText) === evidence.sha256,
      `Remediation-3 review evidence changed: ${evidence.file}`);
  }

  assert(Array.isArray(manifest.decisions) &&
    manifest.decisions.length === expectedDecisions.size,
  "Exactly two remediation-3 owner dispositions must be recorded.");
  assert(new Set(manifest.decisions.map((decision) => decision.id)).size ===
    expectedDecisions.size,
  "Remediation-3 disposition IDs must be unique.");
  const sourceCaseIDs = new Set(source.cases.map((testCase) => testCase.id));
  for (const decision of manifest.decisions) {
    const expected = expectedDecisions.get(decision.id);
    assert(expected, `Unexpected remediation-3 disposition: ${decision.id}`);
    assert(decision.status === "approved", `Unapproved remediation-3 disposition: ${decision.id}`);
    assert(decision.caseID === expected.caseID && sourceCaseIDs.has(decision.caseID),
      `Unexpected remediation-3 case for ${decision.id}`);
    assert(decision.kind === expected.kind, `Unexpected remediation-3 kind for ${decision.id}`);
    assert(decision.changesQuestion === expected.changesQuestion,
      `Unexpected question-change scope for ${decision.id}`);
    assert(JSON.stringify(decision.allowedSubstantiveFields) ===
      JSON.stringify(expected.allowedSubstantiveFields),
    `Unexpected substantive-field scope for ${decision.id}`);
    assert(decision.changesSelectedEvidence === false,
      `${decision.id} may not change selected evidence.`);
    assert(decision.changesForbiddenClaims === false,
      `${decision.id} may not change forbidden safety claims.`);
  }

  const approvedDecisionIDs = manifest.decisions.map((decision) => decision.id);
  const acceptedDecisionIDs = manifest.ownerDecision?.acceptedDecisionIDs || [];
  const acceptedDecisionSetMatches =
    acceptedDecisionIDs.length === approvedDecisionIDs.length &&
    acceptedDecisionIDs.every((decisionID) => approvedDecisionIDs.includes(decisionID));
  const ownerRecorded = manifest.ownerDecision?.required === true &&
    manifest.ownerDecision?.recordedBy === "Permitext owner" &&
    manifest.ownerDecision?.recordedAt === "2026-08-30T23:58:38.000Z" &&
    manifest.ownerDecision?.exactApprovalPhrase === "Ok, go ahead" &&
    manifest.ownerDecision?.approvalContextFile ===
      "../../docs/PERMITEXT_ZONING_SUCCESSOR_REMEDIATION_3_OWNER_DISPOSITION_2026-08-30.md" &&
    acceptedDecisionSetMatches;
  const generationAuthorized = ownerRecorded &&
    manifest.successor?.generationAllowed === true;

  assert(manifest.successor?.outputFile ===
    "zoning-cases-expanded-batch-1-successor-remediation-3.json",
  "Unexpected remediation-successor-3 output path.");
  assert(manifest.successor?.paidEvaluationAllowed === false,
    "Remediation successor 3 preparation may not authorize a paid evaluation.");
  assert(manifest.successor?.publicResearchReleaseAuthorized === false,
    "Remediation successor 3 preparation may not authorize public Zoning Research.");
  assert(manifest.successor?.professionalZoningSignoff === false,
    "Remediation successor 3 may not claim professional Zoning sign-off.");
  assert(manifest.successor?.productionConfigurationChanged === false,
    "Remediation successor 3 may not change Production configuration.");
  assert(manifest.successor?.pricingChanged === false,
    "Remediation successor 3 may not change pricing.");
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

export function requireZoningRemediationSuccessor3GenerationAuthorization(validation) {
  assert(validation?.generationAuthorized === true,
    "Zoning remediation successor 3 generation is locked pending the exact recorded owner approval.");
  return validation;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningRemediationSuccessor3Dispositions();
  if (process.argv.includes("--require-approved")) {
    requireZoningRemediationSuccessor3GenerationAuthorization(validation);
  }
  console.log("Zoning remediation successor 3 disposition governance passed", {
    status: validation.manifest.status,
    decisions: validation.manifest.decisions.length,
    generationAuthorized: validation.generationAuthorized,
    paidEvaluationAllowed: validation.manifest.successor.paidEvaluationAllowed,
    publicResearchReleaseAuthorized:
      validation.manifest.successor.publicResearchReleaseAuthorized
  });
}
