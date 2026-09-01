import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "./zoning-successor-paid-authorization.mjs";
import {
  validateZoningRemediationSuccessor3V17ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V17ConfirmationAppSHA256,
  zoningRemediationSuccessor3V17ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V17ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V17ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V17ConfirmationRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V17ConfirmationSafetySHA256
} from "./zoning-successor-remediation-3-v17-confirmation-paid-authorization.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json",
  import.meta.url
));
const supersededAuthorizationURL = new URL(
  "./zoning-successor-remediation-3-v17-confirmation-paid-authorization.json",
  import.meta.url
);
export const zoningRemediationSuccessor3V17FullCohortLockedAuthorizationSHA256 =
  "89f6049bb4e1c72852e8edbfc870dd561864cce8ef6691b6c1ef5f6175bc0c81";
export const zoningRemediationSuccessor3V17FullCohortConsumedAuthorizationSHA256 =
  "5474123dc94e2c934eb556bc05e1bce823f743d1db39cde8f65cecfade1487aa";
export const zoningRemediationSuccessor3V17FullCohortPreparedFromCommit =
  zoningRemediationSuccessor3V17ConfirmationPreparedFromCommit;
export const zoningRemediationSuccessor3V17FullCohortSafetySHA256 =
  zoningRemediationSuccessor3V17ConfirmationSafetySHA256;
export const zoningRemediationSuccessor3V17FullCohortEconomicsSHA256 =
  zoningRemediationSuccessor3V17ConfirmationEconomicsSHA256;
export const zoningRemediationSuccessor3V17FullCohortAppSHA256 =
  zoningRemediationSuccessor3V17ConfirmationAppSHA256;
export const zoningRemediationSuccessor3V17FullCohortRunnerHandoffSHA256 =
  zoningRemediationSuccessor3V17ConfirmationRunnerHandoffSHA256;
export const zoningRemediationSuccessor3V17FullCohortRunnerPublicKeySHA256 =
  zoningRemediationSuccessor3V17ConfirmationRunnerPublicKeySHA256;
export const zoningRemediationSuccessor3V17FullCohortSupersededPackageCommit =
  "4d858e8813127f1adf16569e60d3d1bb570ee515";

const expectedAuthorizationID = "1d284c44-1f93-4abd-9992-f77d88d60697";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion =
  "20260831-zoning-canonical-source-output-table-legend-v17";
const expectedSupersededAuthorizationFile =
  "zoning-successor-remediation-3-v17-confirmation-paid-authorization.json";
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateSupersededLockedV17Lineage(authorization) {
  const supersededText = await readFile(supersededAuthorizationURL, "utf8");
  assert(sha256(supersededText) ===
    zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256,
  "The superseded locked v17 authorization changed.");
  const superseded = JSON.parse(supersededText);
  assert(superseded.status === "locked",
    "The superseded fail-fast v17 package must remain locked and unused.");
  await validateZoningRemediationSuccessor3V17ConfirmationPaidAuthorization();

  const lineage = authorization.lineage;
  assert(lineage?.supersededLockedAuthorizationFile ===
    expectedSupersededAuthorizationFile,
  "The full-cohort package names the wrong superseded v17 authorization.");
  assert(lineage?.supersededLockedAuthorizationSHA256 ===
    zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256,
  "The full-cohort package names the wrong superseded v17 authorization SHA.");
  assert(lineage?.supersededLockedPackageCommit ===
    zoningRemediationSuccessor3V17FullCohortSupersededPackageCommit,
  "The full-cohort package names the wrong superseded v17 package commit.");

  for (const key of [
    "priorAuthorizationFile",
    "priorAuthorizationSHA256",
    "priorAuthorizationPackageCommit",
    "priorExecutionCommit",
    "priorRunID",
    "priorResultJSONFile",
    "priorResultJSONSHA256",
    "priorResultMarkdownFile",
    "priorResultMarkdownSHA256"
  ]) {
    assert(lineage?.[key] === superseded.lineage?.[key],
      `The full-cohort package changed historical v16 lineage field ${key}.`);
  }

  const historicalBlob = spawnSync("git", [
    "show",
    `${zoningRemediationSuccessor3V17FullCohortSupersededPackageCommit}:` +
      `permitext-sync-server/evals/${expectedSupersededAuthorizationFile}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(historicalBlob.status === 0,
    "Unable to read the superseded locked v17 package authorization.");
  assert(sha256(historicalBlob.stdout) ===
    zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256,
  "The superseded v17 package commit does not contain its exact locked authorization.");
}

export async function validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v17 full-cohort authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v17 full-cohort authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v17 full-cohort authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V17FullCohortPreparedFromCommit,
  "The v17 full-cohort package is not bound to the reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v17 full-cohort package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V17FullCohortSafetySHA256,
  "The v17 full-cohort package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V17FullCohortEconomicsSHA256,
  "The v17 full-cohort package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V17FullCohortAppSHA256,
  "The v17 full-cohort package names the wrong application SHA.");
  assert(authorization.lineage?.runnerHandoffSHA256 ===
    zoningRemediationSuccessor3V17FullCohortRunnerHandoffSHA256,
  "The v17 full-cohort package names the wrong signed runner handoff SHA.");
  assert(authorization.lineage?.runnerHandoffPublicKeySHA256 ===
    zoningRemediationSuccessor3V17FullCohortRunnerPublicKeySHA256,
  "The v17 full-cohort package names the wrong signed runner public-key SHA.");
  await validateSupersededLockedV17Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v17 full-cohort package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === false,
    "The v17 full-cohort package may not use the superseded fail-fast policy.");
  assert(authorization.execution?.continueAfterVerifiedResearchFailure === true,
    "The v17 full-cohort package must continue only after verified Research failures.");
  assert(
    JSON.stringify(authorization.execution?.allowedContinuationFailureCodes) ===
      JSON.stringify(["RESEARCH_VERIFICATION_FAILED"]),
    "The v17 full-cohort continuation failure-code allowlist changed."
  );

  const exactSpendingCapPhrase =
    authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v17 full-cohort authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v17 full-cohort authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v17 full-cohort authorization may not name an execution commit.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V17 full-cohort authorization must bind the exact committed locked package.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "V17 full-cohort authorization must retain the exact 30-case, one-repetition, $5 scope.");
    const expectedOwnerPhrase =
      `authorize exactly package commit ${authorizationPackageCommit} for all 30 ` +
      "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
    assert(authorization.ownerDecision?.exactAuthorizationPhrase ===
      expectedOwnerPhrase,
    "V17 full-cohort authorization must bind the owner's exact package and scope phrase.");
    assert(exactSpendingCapPhrase === expectedOwnerPhrase,
      "V17 full-cohort authorization must retain the same exact spending-cap phrase.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v17 full-cohort execution may not name a commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V17 full-cohort execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V17 full-cohort execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v17 full-cohort result must match its attempt identity.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V17FullCohortPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V17FullCohortPaidAuthorization(
      validation
    );
  }
  console.log("Zoning remediation-successor-3 v17 full-cohort authorization guard passed", {
    status: validation.authorization.status,
    cohortCases: validation.cohort.cases.length,
    active: validation.active,
    authorizationPackageCommit:
      validation.authorization.execution.authorizationPackageCommit,
    maximumCumulativeSpendUSD:
      validation.authorization.scope.maximumCumulativeSpendUSD,
    continueAfterVerifiedResearchFailure:
      validation.authorization.execution.continueAfterVerifiedResearchFailure,
    publicResearchReleaseAuthorized:
      validation.authorization.publicResearchReleaseAuthorized
  });
}
