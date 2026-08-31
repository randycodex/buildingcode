import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const defaultAuthorizationPath = resolve(
  evalsDirectory,
  "zoning-successor-paid-authorization.json"
);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasRecordedOwnerDecision(record) {
  return record.ownerDecision?.required === true &&
    record.ownerDecision?.authorizedBy === "Permitext owner" &&
    typeof record.ownerDecision?.authorizedAt === "string" &&
    record.ownerDecision.authorizedAt.length > 0 &&
    typeof record.ownerDecision?.exactAuthorizationPhrase === "string" &&
    record.ownerDecision.exactAuthorizationPhrase.length > 0;
}

const paidPurposeByCohortFile = new Map([
  [
    "zoning-cases-expanded-batch-1-successor.json",
    "one complete 30-case owner-approved successor semantic run"
  ],
  [
    "zoning-cases-expanded-batch-1-successor-remediation-2.json",
    "one complete 30-case owner-approved remediation successor 2 semantic run"
  ],
  [
    "zoning-cases-expanded-batch-1-successor-remediation-3.json",
    "one complete 30-case owner-approved remediation successor 3 semantic run"
  ]
]);

function validatePurpose(record) {
  const expectedPurpose = paidPurposeByCohortFile.get(record.cohort?.file);
  assert(expectedPurpose, "The paid authorization names an unsupported Zoning cohort.");
  assert(record.scope?.purpose === expectedPurpose,
    "The paid authorization purpose changed for its frozen Zoning cohort.");
}

function validateLockedState(record) {
  assert(record.scope?.caseCount === null, "Locked authorization may not set a case count.");
  assert(record.scope?.repetitions === null, "Locked authorization may not set repetitions.");
  assert(record.scope?.maximumCumulativeSpendUSD === null,
    "Locked authorization may not set a spend cap.");
  assert(record.ownerDecision?.authorizedAt === null,
    "Locked authorization may not record an authorization time.");
  assert(record.ownerDecision?.authorizedBy === null,
    "Locked authorization may not record an authorizer.");
  assert(record.ownerDecision?.exactAuthorizationPhrase === null,
    "Locked authorization may not record an approval phrase.");
  assert(record.consumption?.status === "not_started",
    "Locked authorization must remain not started.");
  assert(record.consumption?.runID === null && record.consumption?.consumedAt === null,
    "Locked authorization may not contain run-consumption evidence.");
  assert(record.consumption?.attemptID == null && record.consumption?.startedAt == null,
    "Locked authorization may not contain run-attempt evidence.");
}

function validateAuthorizedScope(record) {
  assert(record.scope?.caseCount === 30,
    "Successor paid authorization must cover all 30 cases.");
  assert(record.scope?.repetitions === 1,
    "Successor paid authorization must cover exactly one repetition.");
  assert(Number.isFinite(record.scope?.maximumCumulativeSpendUSD) &&
    record.scope.maximumCumulativeSpendUSD > 0 &&
    record.scope.maximumCumulativeSpendUSD <= 5,
    "Successor paid authorization requires a positive cumulative cap no higher than $5.");
  assert(hasRecordedOwnerDecision(record),
    "Successor paid authorization lacks an explicit recorded owner decision.");
}

export async function validateZoningSuccessorPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const authorizationText = await readFile(authorizationPath, "utf8");
  const authorization = JSON.parse(authorizationText);
  assert(authorization.schemaVersion === 1,
    "Unsupported Zoning successor paid-authorization schema.");
  assert(["locked", "authorized", "running", "consumed"].includes(authorization.status),
    "Invalid Zoning successor paid-authorization status.");
  assert(authorization.cohort?.caseCount === 30,
    "The authorization must remain bound to the 30-case successor.");
  validatePurpose(authorization);

  const cohortPath = resolve(evalsDirectory, authorization.cohort.file);
  const cohortText = await readFile(cohortPath, "utf8");
  assert(sha256(cohortText) === authorization.cohort.sha256,
    "The frozen Zoning successor hash does not match its paid-authorization record.");
  const cohort = JSON.parse(cohortText);
  assert(cohort.cases?.length === authorization.cohort.caseCount,
    "The frozen Zoning successor case count changed.");
  assert(cohort.researchEligibility === false,
    "Paid evaluation preparation may not enable public Zoning Research.");

  assert(authorization.publicResearchReleaseAuthorized === false,
    "Paid evaluation authorization may not enable public Zoning Research.");
  assert(authorization.professionalZoningSignoff === false,
    "Paid evaluation authorization may not claim professional Zoning sign-off.");
  assert(authorization.deploymentAuthorized === false,
    "Paid evaluation authorization may not authorize deployment.");
  assert(authorization.pricingOrAllowanceChangeAuthorized === false,
    "Paid evaluation authorization may not change pricing or allowances.");
  assert(authorization.evidenceBudgetCandidateEnabled === false,
    "The 24,000-character evidence candidate must remain disabled for this run.");

  if (authorization.status === "locked") validateLockedState(authorization);
  if (authorization.status === "authorized") {
    validateAuthorizedScope(authorization);
    assert(authorization.consumption?.status === "not_started",
      "An active authorization must not already be consumed.");
    assert(authorization.consumption?.runID === null &&
      authorization.consumption?.consumedAt === null,
      "An active authorization may not contain completed-run evidence.");
    assert(authorization.consumption?.attemptID == null &&
      authorization.consumption?.startedAt == null,
    "An active authorization may not contain started-run evidence.");
  }
  if (authorization.status === "running") {
    validateAuthorizedScope(authorization);
    assert(authorization.consumption?.status === "running" &&
      typeof authorization.consumption?.attemptID === "string" &&
      /^[0-9a-f-]{36}$/i.test(authorization.consumption.attemptID) &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0 &&
      authorization.consumption?.runID === null &&
      authorization.consumption?.consumedAt === null,
    "A running authorization requires durable attempt evidence and may not be reusable.");
  }
  if (authorization.status === "consumed") {
    validateAuthorizedScope(authorization);
    assert(authorization.consumption?.status === "consumed" &&
      typeof authorization.consumption?.runID === "string" &&
      authorization.consumption.runID.length > 0 &&
      typeof authorization.consumption?.consumedAt === "string" &&
      authorization.consumption.consumedAt.length > 0,
      "Consumed authorization requires a retained run ID and consumption time.");
  }

  return {
    authorization,
    authorizationPath,
    cohort,
    cohortPath,
    active: authorization.status === "authorized"
  };
}

export function requireActiveZoningSuccessorPaidAuthorization(validation) {
  assert(validation?.active === true,
    "The Zoning successor paid run is locked. It requires a new explicit owner authorization and cumulative spend cap.");
  return validation;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningSuccessorPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningSuccessorPaidAuthorization(validation);
  }
  console.log("Zoning successor paid-authorization guard passed", {
    status: validation.authorization.status,
    cohortCases: validation.cohort.cases.length,
    active: validation.active,
    maximumCumulativeSpendUSD:
      validation.authorization.scope.maximumCumulativeSpendUSD,
    publicResearchReleaseAuthorized:
      validation.authorization.publicResearchReleaseAuthorized
  });
}
