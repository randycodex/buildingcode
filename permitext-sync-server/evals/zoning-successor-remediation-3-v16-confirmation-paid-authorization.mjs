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
  validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V15ConfirmationRunID
} from "./zoning-successor-remediation-3-v15-confirmation-paid-authorization.mjs";
import {
  zoningV11RunnerHandoffProtocol,
  zoningV11RunnerPublicKeyDERBase64
} from "./zoning-v11-paid-runner-handoff.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v16-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V16ConfirmationLockedAuthorizationSHA256 =
  "33c8112e307ecde61ab1b8007d318e16a932875b5df3fba2202d53154ce180f6";
export const zoningRemediationSuccessor3V16ConfirmationConsumedAuthorizationSHA256 =
  "f841d27c4f664990305a28ac6d2cc2817a2c910f53f402be44d3c0e3959153e5";
export const zoningRemediationSuccessor3V16ConfirmationAuthorizationPackageCommit =
  "9751e50d1f830db527a822b1a515552465749907";
export const zoningRemediationSuccessor3V16ConfirmationExecutionCommit =
  "0e17527e218daeb0d8ab938a37f34c04ee10febf";
export const zoningRemediationSuccessor3V16ConfirmationRunID =
  "784648df-2d7b-4957-972a-1ef14a054c43";
export const zoningRemediationSuccessor3V16ConfirmationResultJSONFile =
  "results/2026-09-01T01-59-08-536Z-784648df-2d7b-4957-972a-1ef14a054c43.json";
export const zoningRemediationSuccessor3V16ConfirmationResultJSONSHA256 =
  "94b0032df134daf360eb5ed59c80d4fd7c6cfd0b80e1564f095493b9a6fb673d";
export const zoningRemediationSuccessor3V16ConfirmationResultMarkdownFile =
  "results/2026-09-01T01-59-08-536Z-784648df-2d7b-4957-972a-1ef14a054c43.md";
export const zoningRemediationSuccessor3V16ConfirmationResultMarkdownSHA256 =
  "f48f5d5005fb5c347b7d368dbbc929ed4b2cdc2b42bb9afd152d65f5e7a89a58";
export const zoningRemediationSuccessor3V16ConfirmationPreparedFromCommit =
  "661eda3cc5f6eef5959851caeb35e198ea4eb911";
export const zoningRemediationSuccessor3V16ConfirmationSafetySHA256 =
  "c3d1a470bb88314086f23acb04d5d40b3011f5ec35f7bda7341f1ef7bed8f7aa";
export const zoningRemediationSuccessor3V16ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningRemediationSuccessor3V16ConfirmationAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
export const zoningRemediationSuccessor3V16ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningRemediationSuccessor3V16ConfirmationRunnerPublicKeySHA256 =
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918";

const expectedAuthorizationID = "7eb2e708-3802-403f-95e6-4e594f3310da";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion =
  "20260831-zoning-appendix-j-preposed-subarea-source-rule-v16";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v15-confirmation-paid-authorization.json";
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
    `${zoningRemediationSuccessor3V16ConfirmationPreparedFromCommit}:${relativePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(blob.status === 0,
    `Unable to read the reviewed v16 historical bytes for ${relativePath}.`);
  assert(sha256(blob.stdout) === expectedHash, message);
}

function validateHistoricalReviewedInputs() {
  assertHistoricalFileHash(
    "permitext-sync-server/research-zoning-safety.mjs",
    zoningRemediationSuccessor3V16ConfirmationSafetySHA256,
    "The reviewed v16 historical Zoning safety bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/research-economics.mjs",
    zoningRemediationSuccessor3V16ConfirmationEconomicsSHA256,
    "The reviewed v16 historical Research economics bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/app.mjs",
    zoningRemediationSuccessor3V16ConfirmationAppSHA256,
    "The reviewed v16 historical application bytes changed."
  );
}

async function validateRunnerHandoffInputs(authorization) {
  assert(authorization.lineage?.runnerHandoffProtocol ===
    zoningV11RunnerHandoffProtocol,
  "The v16 package names the wrong signed runner handoff protocol.");
  assert(authorization.lineage?.runnerHandoffSHA256 ===
    zoningRemediationSuccessor3V16ConfirmationRunnerHandoffSHA256,
  "The v16 package names the wrong signed runner handoff SHA.");
  assert(authorization.lineage?.runnerHandoffPublicKeySHA256 ===
    zoningRemediationSuccessor3V16ConfirmationRunnerPublicKeySHA256,
  "The v16 package names the wrong signed runner public-key SHA.");
  await assertFileHash(
    new URL("./zoning-v11-paid-runner-handoff.mjs", import.meta.url),
    zoningRemediationSuccessor3V16ConfirmationRunnerHandoffSHA256,
    "The signed v16 runner handoff implementation changed."
  );
  assert(
    sha256(Buffer.from(zoningV11RunnerPublicKeyDERBase64, "base64")) ===
      zoningRemediationSuccessor3V16ConfirmationRunnerPublicKeySHA256,
    "The signed v16 runner handoff public key changed."
  );
}

async function validateHistoricalV15Lineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v16 package names the wrong historical v15 authorization.");
  assert(lineage?.priorAuthorizationSHA256 ===
    zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
  "The v16 package names the wrong historical v15 authorization SHA.");
  assert(lineage?.priorAuthorizationPackageCommit ===
    zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
  "The v16 package names the wrong historical v15 package commit.");
  assert(lineage?.priorExecutionCommit ===
    zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
  "The v16 package names the wrong historical v15 execution commit.");
  assert(lineage?.priorRunID === zoningRemediationSuccessor3V15ConfirmationRunID,
    "The v16 package names the wrong historical v15 run.");

  await assertFileHash(
    new URL(`./${expectedPriorAuthorizationFile}`, import.meta.url),
    zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
    "The consumed historical v15 authorization changed."
  );
  await validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization();

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256,
      "Markdown"]
  ]) {
    assert(lineage?.[`priorResult${label}File`] === file,
      `The v16 package names the wrong historical v15 ${label} result.`);
    assert(lineage?.[`priorResult${label}SHA256`] === expectedHash,
      `The v16 package names the wrong historical v15 ${label} result SHA.`);
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained historical v15 ${label} result changed.`
    );
  }
}

export async function validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v16 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v16 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v16 confirmation authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V16ConfirmationPreparedFromCommit,
  "The v16 confirmation package is not bound to the reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v16 confirmation package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V16ConfirmationSafetySHA256,
  "The v16 confirmation package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V16ConfirmationEconomicsSHA256,
  "The v16 confirmation package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V16ConfirmationAppSHA256,
  "The v16 confirmation package names the wrong application SHA.");
  validateHistoricalReviewedInputs();
  await validateRunnerHandoffInputs(authorization);
  await validateHistoricalV15Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v16 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v16 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase =
    authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v16 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v16 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v16 confirmation authorization may not name an execution commit.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V16 confirmation authorization must bind the exact committed locked package.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "V16 confirmation authorization must retain the exact 30-case, one-repetition, $5 scope.");
    const expectedOwnerPhrase =
      `authorize exactly package commit ${authorizationPackageCommit} for all 30 ` +
      "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
    assert(authorization.ownerDecision?.exactAuthorizationPhrase ===
      expectedOwnerPhrase,
    "V16 confirmation authorization must bind the owner's exact phrase to the selected package and scope.");
    assert(exactSpendingCapPhrase === expectedOwnerPhrase,
      "V16 confirmation authorization must retain the same exact package-bound spending-cap phrase.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v16 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V16 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V16 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v16 confirmation result must match its pre-dispatch attempt identity.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V16ConfirmationPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V16ConfirmationPaidAuthorization(
      validation
    );
  }
  console.log("Zoning remediation-successor-3 v16 confirmation authorization guard passed", {
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
