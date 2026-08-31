import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "./zoning-successor-paid-authorization.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-paid-authorization.json",
  import.meta.url
));
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function validateZoningRemediationSuccessor3PaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  assert(validation.authorization.cohort.file === expectedCohortFile,
    "The remediation-successor-3 authorization names the wrong cohort file.");
  assert(validation.authorization.cohort.sha256 === expectedCohortSHA256,
    "The remediation-successor-3 authorization names the wrong cohort SHA.");
  const exactSpendingCapPhrase =
    validation.authorization.ownerDecision?.exactSpendingCapPhrase;
  if (validation.authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked remediation-successor-3 authorization may not record a spending-cap phrase.");
  } else {
    assert(typeof exactSpendingCapPhrase === "string" &&
      exactSpendingCapPhrase.length > 0,
    "Remediation-successor-3 authorization must retain the owner's exact spending-cap phrase.");
  }
  if (["running", "consumed"].includes(validation.authorization.status)) {
    assert(typeof validation.authorization.consumption?.attemptID === "string" &&
      validation.authorization.consumption.attemptID.length > 0 &&
      typeof validation.authorization.consumption?.startedAt === "string" &&
      validation.authorization.consumption.startedAt.length > 0,
    "Remediation-successor-3 execution must retain its durable attempt identity.");
  }
  if (validation.authorization.status === "consumed") {
    assert(validation.authorization.consumption.attemptID ===
      validation.authorization.consumption.runID,
    "The consumed remediation-successor-3 result must match its pre-dispatch attempt identity.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3PaidAuthorization(validation) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningRemediationSuccessor3PaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3PaidAuthorization(validation);
  }
  console.log("Zoning remediation-successor-3 paid-authorization guard passed", {
    status: validation.authorization.status,
    cohortCases: validation.cohort.cases.length,
    cohortSHA256: validation.authorization.cohort.sha256,
    active: validation.active,
    maximumCumulativeSpendUSD:
      validation.authorization.scope.maximumCumulativeSpendUSD,
    publicResearchReleaseAuthorized:
      validation.authorization.publicResearchReleaseAuthorized
  });
}
