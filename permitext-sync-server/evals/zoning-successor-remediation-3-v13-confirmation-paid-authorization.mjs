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
  validateZoningRemediationSuccessor3V12ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V12ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V12ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V12ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V12ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V12ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V12ConfirmationRunID
} from "./zoning-successor-remediation-3-v12-confirmation-paid-authorization.mjs";
import {
  zoningV11RunnerHandoffProtocol,
  zoningV11RunnerPublicKeyDERBase64
} from "./zoning-v11-paid-runner-handoff.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v13-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V13ConfirmationLockedAuthorizationSHA256 =
  "ea4d49cae91e99b2344c8e84321f503adc04b219d5c9785876f70cfd01e9bf11";
export const zoningRemediationSuccessor3V13ConfirmationPreparedFromCommit =
  "c933bb4a5789e6698668732057c5aa7b19c5c9f8";
export const zoningRemediationSuccessor3V13ConfirmationSafetySHA256 =
  "44b19001559326ea73349ea828566879b7df9491c7d3a9c6db086a679c0a41f6";
export const zoningRemediationSuccessor3V13ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningRemediationSuccessor3V13ConfirmationAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
export const zoningRemediationSuccessor3V13ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningRemediationSuccessor3V13ConfirmationRunnerPublicKeySHA256 =
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918";

const expectedAuthorizationID = "dc46f544-f4f9-4085-b8f5-f29ab5412936";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion = "20260831-zoning-mapped-boundary-context-v13";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v12-confirmation-paid-authorization.json";
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertFileHash(url, expectedHash, message) {
  assert(sha256(await readFile(fileURLToPath(url), "utf8")) === expectedHash,
    message);
}

function assertHistoricalFileHash(relativePath, expectedHash, message) {
  const blob = spawnSync("git", [
    "show",
    `${zoningRemediationSuccessor3V13ConfirmationPreparedFromCommit}:${relativePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(blob.status === 0,
    `Unable to read the reviewed v13 historical bytes for ${relativePath}.`);
  assert(sha256(blob.stdout) === expectedHash, message);
}

function validateHistoricalReviewedInputs() {
  assertHistoricalFileHash(
    "permitext-sync-server/research-zoning-safety.mjs",
    zoningRemediationSuccessor3V13ConfirmationSafetySHA256,
    "The reviewed v13 historical Zoning safety bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/research-economics.mjs",
    zoningRemediationSuccessor3V13ConfirmationEconomicsSHA256,
    "The reviewed v13 historical Research economics bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/app.mjs",
    zoningRemediationSuccessor3V13ConfirmationAppSHA256,
    "The reviewed v13 historical application bytes changed."
  );
}

async function validateRunnerHandoffInputs(authorization) {
  assert(authorization.lineage?.runnerHandoffProtocol ===
    zoningV11RunnerHandoffProtocol,
  "The v13 package names the wrong signed runner handoff protocol.");
  assert(authorization.lineage?.runnerHandoffSHA256 ===
    zoningRemediationSuccessor3V13ConfirmationRunnerHandoffSHA256,
  "The v13 package names the wrong signed runner handoff SHA.");
  assert(authorization.lineage?.runnerHandoffPublicKeySHA256 ===
    zoningRemediationSuccessor3V13ConfirmationRunnerPublicKeySHA256,
  "The v13 package names the wrong signed runner public-key SHA.");
  await assertFileHash(
    new URL("./zoning-v11-paid-runner-handoff.mjs", import.meta.url),
    zoningRemediationSuccessor3V13ConfirmationRunnerHandoffSHA256,
    "The signed v13 runner handoff implementation changed."
  );
  assert(
    sha256(Buffer.from(zoningV11RunnerPublicKeyDERBase64, "base64")) ===
      zoningRemediationSuccessor3V13ConfirmationRunnerPublicKeySHA256,
    "The signed v13 runner handoff public key changed."
  );
}

async function validateHistoricalV12Lineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v13 package names the wrong historical v12 authorization.");
  assert(lineage?.priorAuthorizationSHA256 ===
    zoningRemediationSuccessor3V12ConfirmationConsumedAuthorizationSHA256,
  "The v13 package names the wrong historical v12 authorization SHA.");
  assert(lineage?.priorAuthorizationPackageCommit ===
    zoningRemediationSuccessor3V12ConfirmationAuthorizationPackageCommit,
  "The v13 package names the wrong historical v12 package commit.");
  assert(lineage?.priorExecutionCommit ===
    zoningRemediationSuccessor3V12ConfirmationExecutionCommit,
  "The v13 package names the wrong historical v12 execution commit.");
  assert(lineage?.priorRunID === zoningRemediationSuccessor3V12ConfirmationRunID,
    "The v13 package names the wrong historical v12 run.");

  await assertFileHash(
    new URL(`./${expectedPriorAuthorizationFile}`, import.meta.url),
    zoningRemediationSuccessor3V12ConfirmationConsumedAuthorizationSHA256,
    "The consumed historical v12 authorization changed."
  );
  await validateZoningRemediationSuccessor3V12ConfirmationPaidAuthorization();

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V12ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V12ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V12ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V12ConfirmationResultMarkdownSHA256,
      "Markdown"]
  ]) {
    assert(lineage?.[`priorResult${label}File`] === file,
      `The v13 package names the wrong historical v12 ${label} result.`);
    assert(lineage?.[`priorResult${label}SHA256`] === expectedHash,
      `The v13 package names the wrong historical v12 ${label} result SHA.`);
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained historical v12 ${label} result changed.`
    );
  }
}

export async function validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v13 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v13 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v13 confirmation authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V13ConfirmationPreparedFromCommit,
  "The v13 confirmation package is not bound to the reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v13 confirmation package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V13ConfirmationSafetySHA256,
  "The v13 confirmation package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V13ConfirmationEconomicsSHA256,
  "The v13 confirmation package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V13ConfirmationAppSHA256,
  "The v13 confirmation package names the wrong application SHA.");
  validateHistoricalReviewedInputs();
  await validateRunnerHandoffInputs(authorization);
  await validateHistoricalV12Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v13 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v13 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase =
    authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v13 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v13 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v13 confirmation authorization may not name an execution commit.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V13 confirmation authorization must bind the exact committed locked package.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "V13 confirmation authorization must retain the exact 30-case, one-repetition, $5 scope.");
    const expectedOwnerPhrase =
      `authorize exactly package commit ${authorizationPackageCommit} for all 30 ` +
      "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
    assert(authorization.ownerDecision?.exactAuthorizationPhrase ===
      expectedOwnerPhrase,
    "V13 confirmation authorization must bind the owner's exact phrase to the selected package and scope.");
    assert(exactSpendingCapPhrase === expectedOwnerPhrase,
      "V13 confirmation authorization must retain the same exact package-bound spending-cap phrase.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v13 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V13 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V13 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v13 confirmation result must match its pre-dispatch attempt identity.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V13ConfirmationPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V13ConfirmationPaidAuthorization(
      validation
    );
  }
  console.log("Zoning remediation-successor-3 v13 confirmation authorization guard passed", {
    status: validation.authorization.status,
    cohortCases: validation.cohort.cases.length,
    cohortSHA256: validation.authorization.cohort.sha256,
    active: validation.active,
    authorizationPackageCommit:
      validation.authorization.execution.authorizationPackageCommit,
    maximumCumulativeSpendUSD:
      validation.authorization.scope.maximumCumulativeSpendUSD,
    publicResearchReleaseAuthorized:
      validation.authorization.publicResearchReleaseAuthorized
  });
}
