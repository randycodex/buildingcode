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

export async function validateZoningSuccessorDispositions({
  manifestPath = resolve(evalsDirectory, "zoning-expanded-successor-dispositions.json")
} = {}) {
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  assert(manifest.schemaVersion === 1, "Unsupported Zoning successor disposition schema.");
  assert(manifest.sourceCohort?.mutationAuthorized === false,
    "The frozen source cohort must remain immutable.");
  const sourcePath = resolve(evalsDirectory, manifest.sourceCohort.file);
  const sourceText = await readFile(sourcePath, "utf8");
  assert(sha256(sourceText) === manifest.sourceCohort.sha256,
    "The frozen source cohort hash changed after disposition preparation.");
  const source = JSON.parse(sourceText);
  assert(source.cases.length === manifest.sourceCohort.caseCount,
    "The frozen source cohort case count changed.");

  for (const evidence of manifest.reviewEvidence || []) {
    const evidencePath = resolve(evalsDirectory, evidence.file);
    const evidenceText = await readFile(evidencePath, "utf8");
    assert(sha256(evidenceText) === evidence.sha256,
      `Disposition review evidence changed: ${evidence.file}`);
  }

  assert(Array.isArray(manifest.decisions) && manifest.decisions.length === 8,
    "Exactly eight owner dispositions must be recorded.");
  assert(new Set(manifest.decisions.map((decision) => decision.id)).size === 8,
    "Owner disposition IDs must be unique.");
  assert(manifest.decisions.filter((decision) => decision.kind === "answer_key_replacement").length === 2,
    "Exactly two answer-key replacements are expected.");
  assert(manifest.decisions.filter((decision) => decision.kind === "rubric_scope_disposition").length === 6,
    "Exactly six rubric-scope dispositions are expected.");
  const sourceCaseIDs = new Set(source.cases.map((testCase) => testCase.id));
  for (const decision of manifest.decisions) {
    assert(sourceCaseIDs.has(decision.caseID), `Unknown disposition case: ${decision.caseID}`);
    assert(["pending_owner_approval", "approved", "rejected"].includes(decision.status),
      `Invalid disposition status: ${decision.status}`);
    assert(decision.changesQuestion === false, `${decision.id} may not change the question.`);
    assert(decision.changesSelectedEvidence === false,
      `${decision.id} may not change selected evidence without a new source review.`);
    assert(decision.changesForbiddenClaims === false,
      `${decision.id} may not weaken forbidden safety claims.`);
  }

  const approvedDecisionIDs = manifest.decisions
    .filter((decision) => decision.status === "approved")
    .map((decision) => decision.id);
  const allApproved = approvedDecisionIDs.length === manifest.decisions.length;
  const acceptedDecisionIDs = manifest.ownerDecision?.acceptedDecisionIDs || [];
  const acceptedDecisionSetMatches = acceptedDecisionIDs.length === approvedDecisionIDs.length &&
    acceptedDecisionIDs.every((decisionID) => approvedDecisionIDs.includes(decisionID));
  const ownerRecorded = manifest.ownerDecision?.required === true &&
    manifest.ownerDecision?.recordedBy === "Permitext owner" &&
    typeof manifest.ownerDecision?.recordedAt === "string" &&
    manifest.ownerDecision.recordedAt.length > 0 &&
    manifest.ownerDecision?.exactApprovalPhrase === "I approve" &&
    Array.isArray(manifest.ownerDecision?.acceptedDecisionIDs) &&
    acceptedDecisionSetMatches;
  const generationAuthorized = allApproved && ownerRecorded &&
    manifest.status === "owner_approved" && manifest.successor?.generationAllowed === true;

  assert(manifest.successor?.paidEvaluationAllowed === false,
    "Successor preparation may not authorize a paid evaluation.");
  assert(manifest.successor?.publicResearchReleaseAuthorized === false,
    "Successor preparation may not authorize public Zoning Research.");
  assert(manifest.successor?.professionalZoningSignoff === false,
    "Successor preparation may not claim professional Zoning sign-off.");
  assert(manifest.successor?.requiresSeparatePaidAuthorization === true,
    "A later paid run must require separate owner authorization.");
  assert(manifest.successor?.requiresSeparateCumulativeSpendCap === true,
    "A later paid run must require a separate cumulative spend cap.");

  return {
    manifest,
    manifestPath,
    sourcePath,
    source,
    approvedDecisionIDs,
    pendingDecisionIDs: manifest.decisions
      .filter((decision) => decision.status === "pending_owner_approval")
      .map((decision) => decision.id),
    generationAuthorized
  };
}

export function requireZoningSuccessorGenerationAuthorization(validation) {
  assert(validation?.generationAuthorized === true,
    "Zoning successor generation is locked pending explicit owner approval of all eight dispositions.");
  return validation;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningSuccessorDispositions();
  if (process.argv.includes("--require-approved")) {
    requireZoningSuccessorGenerationAuthorization(validation);
  }
  console.log("Zoning successor disposition governance passed", {
    status: validation.manifest.status,
    decisions: validation.manifest.decisions.length,
    approved: validation.approvedDecisionIDs.length,
    pending: validation.pendingDecisionIDs.length,
    generationAuthorized: validation.generationAuthorized,
    paidEvaluationAllowed: validation.manifest.successor.paidEvaluationAllowed,
    publicResearchReleaseAuthorized: validation.manifest.successor.publicResearchReleaseAuthorized
  });
}
