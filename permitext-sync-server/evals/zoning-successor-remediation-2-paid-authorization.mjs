import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "./zoning-successor-paid-authorization.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-2-paid-authorization.json",
  import.meta.url
));
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-2.json";
const expectedCohortSHA256 =
  "459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function validateZoningRemediationSuccessor2PaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  assert(validation.authorization.cohort.file === expectedCohortFile,
    "The remediation-successor-2 authorization names the wrong cohort file.");
  assert(validation.authorization.cohort.sha256 === expectedCohortSHA256,
    "The remediation-successor-2 authorization names the wrong cohort SHA.");
  return validation;
}

export function requireActiveZoningRemediationSuccessor2PaidAuthorization(validation) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningRemediationSuccessor2PaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor2PaidAuthorization(validation);
  }
  console.log("Zoning remediation-successor-2 paid-authorization guard passed", {
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
