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
  validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationRunID
} from "./zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs";
import {
  zoningV11RunnerHandoffProtocol,
  zoningV11RunnerPublicKeyDERBase64
} from "./zoning-v11-paid-runner-handoff.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v11-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256 =
  "c5b89c1dd7dca9109e0be01ab78763e6da108cace19dc2fb92f4cc6aed56c024";
export const zoningRemediationSuccessor3V11ConfirmationAuthorizationPackageCommit =
  "8d075b442083db3536de0ff9e90372802ddeadaa";
export const zoningRemediationSuccessor3V11ConfirmationExecutionCommit =
  "42f1429cc8f32f987788474e955f36918aef2658";
export const zoningRemediationSuccessor3V11ConfirmationConsumedAuthorizationSHA256 =
  "3625175f43ec9d0977183569e8809fa838ad4a19504ac1222b2a7cd845a8df0a";
export const zoningRemediationSuccessor3V11ConfirmationRunID =
  "eea4db77-5144-47b8-9a89-b364d1e973ca";
export const zoningRemediationSuccessor3V11ConfirmationResultJSONFile =
  "results/2026-08-31T21-10-26-190Z-eea4db77-5144-47b8-9a89-b364d1e973ca.json";
export const zoningRemediationSuccessor3V11ConfirmationResultJSONSHA256 =
  "66542a5848ccb7113d73056fa078aee345f5ad7fdace63ed4578a71c817f794c";
export const zoningRemediationSuccessor3V11ConfirmationResultMarkdownFile =
  "results/2026-08-31T21-10-26-190Z-eea4db77-5144-47b8-9a89-b364d1e973ca.md";
export const zoningRemediationSuccessor3V11ConfirmationResultMarkdownSHA256 =
  "67abb7849f5f4d275131fd820f6e483cd351e3fe918c8c5cc02f9381f5d12c5b";
export const zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit =
  "cd1f3a99f32a3648dd8f0d7a8b1d540e5db29bf5";
export const zoningRemediationSuccessor3V11ConfirmationSafetySHA256 =
  "8003374fb8302a69bdcb924e2e6fe66855c11f52444f045dfb6e75bff1b476f7";
export const zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningRemediationSuccessor3V11ConfirmationAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
export const zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningRemediationSuccessor3V11ConfirmationRunnerPublicKeySHA256 =
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918";

const expectedAuthorizationID = "ee72ca2f-5410-4ce9-a6d6-30deb8ff5169";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion = "20260831-zoning-material-completeness-v11";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v9-confirmation-paid-authorization.json";
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertFileHash(url, expectedHash, message) {
  assert(sha256(await readFile(fileURLToPath(url), "utf8")) === expectedHash, message);
}

function assertHistoricalFileHash(relativePath, expectedHash, message) {
  const blob = spawnSync("git", [
    "show",
    `${zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit}:${relativePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(blob.status === 0,
    `Unable to read the reviewed v11 historical bytes for ${relativePath}.`);
  assert(sha256(blob.stdout) === expectedHash, message);
}

function validateHistoricalReviewedInputs() {
  assertHistoricalFileHash(
    "permitext-sync-server/research-zoning-safety.mjs",
    zoningRemediationSuccessor3V11ConfirmationSafetySHA256,
    "The reviewed v11 historical Zoning safety bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/research-economics.mjs",
    zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
    "The reviewed v11 historical Research economics bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/app.mjs",
    zoningRemediationSuccessor3V11ConfirmationAppSHA256,
    "The reviewed v11 historical application bytes changed."
  );
}

async function validateRunnerHandoffInputs(authorization) {
  assert(authorization.lineage?.runnerHandoffProtocol ===
    zoningV11RunnerHandoffProtocol,
  "The v11 package names the wrong signed runner handoff protocol.");
  assert(authorization.lineage?.runnerHandoffSHA256 ===
    zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
  "The v11 package names the wrong signed runner handoff SHA.");
  assert(authorization.lineage?.runnerHandoffPublicKeySHA256 ===
    zoningRemediationSuccessor3V11ConfirmationRunnerPublicKeySHA256,
  "The v11 package names the wrong signed runner public-key SHA.");
  await assertFileHash(
    new URL("./zoning-v11-paid-runner-handoff.mjs", import.meta.url),
    zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
    "The signed v11 runner handoff implementation changed."
  );
  assert(
    sha256(Buffer.from(zoningV11RunnerPublicKeyDERBase64, "base64")) ===
      zoningRemediationSuccessor3V11ConfirmationRunnerPublicKeySHA256,
    "The signed v11 runner handoff public key changed."
  );
}

async function validateHistoricalV9Lineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v11 package names the wrong historical v9 authorization.");
  assert(lineage?.priorAuthorizationSHA256 ===
    zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  "The v11 package names the wrong historical v9 authorization SHA.");
  assert(lineage?.priorAuthorizationPackageCommit ===
    zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  "The v11 package names the wrong historical v9 package commit.");
  assert(lineage?.priorExecutionCommit ===
    zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  "The v11 package names the wrong historical v9 execution commit.");
  assert(lineage?.priorRunID === zoningRemediationSuccessor3V9ConfirmationRunID,
    "The v11 package names the wrong historical v9 run.");

  await assertFileHash(
    new URL(`./${expectedPriorAuthorizationFile}`, import.meta.url),
    zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
    "The consumed historical v9 authorization changed."
  );
  await validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization();

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256, "Markdown"]
  ]) {
    assert(lineage?.[`priorResult${label}File`] === file,
      `The v11 package names the wrong historical v9 ${label} result.`);
    assert(lineage?.[`priorResult${label}SHA256`] === expectedHash,
      `The v11 package names the wrong historical v9 ${label} result SHA.`);
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained historical v9 ${label} result changed.`
    );
  }
}

export async function validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({ authorizationPath });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v11 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v11 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v11 confirmation authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  "The v11 confirmation package is not bound to the independently reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v11 confirmation package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V11ConfirmationSafetySHA256,
  "The v11 confirmation package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  "The v11 confirmation package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  "The v11 confirmation package names the wrong application SHA.");
  validateHistoricalReviewedInputs();
  await validateRunnerHandoffInputs(authorization);
  await validateHistoricalV9Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v11 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v11 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase = authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v11 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v11 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v11 confirmation authorization may not name an execution commit.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V11 confirmation authorization must bind the exact committed locked package.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "V11 confirmation authorization must retain the exact 30-case, one-repetition, $5 scope.");
    const expectedOwnerPhrase =
      `authorize exactly package commit ${authorizationPackageCommit} for all 30 ` +
      "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
    assert(authorization.ownerDecision?.exactAuthorizationPhrase === expectedOwnerPhrase,
      "V11 confirmation authorization must bind the owner's exact phrase to the selected package and scope.");
    assert(exactSpendingCapPhrase === expectedOwnerPhrase,
      "V11 confirmation authorization must retain the same exact package-bound spending-cap phrase.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v11 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V11 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V11 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v11 confirmation result must match its pre-dispatch attempt identity.");
    assert(authorizationPackageCommit ===
      zoningRemediationSuccessor3V11ConfirmationAuthorizationPackageCommit,
    "The consumed v11 confirmation must retain its exact locked package commit.");
    assert(executionCommit ===
      zoningRemediationSuccessor3V11ConfirmationExecutionCommit,
    "The consumed v11 confirmation must retain its exact execution commit.");
    assert(authorization.consumption.runID ===
      zoningRemediationSuccessor3V11ConfirmationRunID,
    "The consumed v11 confirmation must retain its exact run ID.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning remediation-successor-3 v11 confirmation authorization guard passed", {
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
