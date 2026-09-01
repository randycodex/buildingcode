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
  validateZoningRemediationSuccessor3V14ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V14ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V14ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V14ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V14ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V14ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V14ConfirmationRunID
} from "./zoning-successor-remediation-3-v14-confirmation-paid-authorization.mjs";
import {
  zoningV11RunnerHandoffProtocol,
  zoningV11RunnerPublicKeyDERBase64
} from "./zoning-v11-paid-runner-handoff.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v15-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V15ConfirmationLockedAuthorizationSHA256 =
  "774e18e65313eaeeb601c2ed3bbf3f6f050907f564ba5765aeea3d9d2824855b";
export const zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit =
  "8fe33ab45f8d2d4b4653207aee47d8bb557c68b3";
export const zoningRemediationSuccessor3V15ConfirmationExecutionCommit =
  "1fde866860433e9152d00bd78cc324e825034956";
export const zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256 =
  "0ef1e44e90ab0b7802913e4a3bc2785889875324eec1579a30e13331e14455a5";
export const zoningRemediationSuccessor3V15ConfirmationRunID =
  "fe0367c2-2c62-41e3-bc4c-1fc168fae68e";
export const zoningRemediationSuccessor3V15ConfirmationResultJSONFile =
  "results/2026-09-01T01-20-39-269Z-fe0367c2-2c62-41e3-bc4c-1fc168fae68e.json";
export const zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256 =
  "0ce9050c8aa4e7d59b42a524b1c20372b7535bc1b42efa0527a56bf3357f0e58";
export const zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile =
  "results/2026-09-01T01-20-39-269Z-fe0367c2-2c62-41e3-bc4c-1fc168fae68e.md";
export const zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256 =
  "4ce4144d54d62b297355f25a5b6a5cd2d26b877f83dbdac4e84fc762f38e15d6";
export const zoningRemediationSuccessor3V15ConfirmationPreparedFromCommit =
  "167a8ee0106dd4e2ecce7a4c259b09d969f60990";
export const zoningRemediationSuccessor3V15ConfirmationSafetySHA256 =
  "b9e863d030b800f27f142d5b6b5ee1ee83dbdff9b8a9ec890ab3cc0236f3a6a0";
export const zoningRemediationSuccessor3V15ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningRemediationSuccessor3V15ConfirmationAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
export const zoningRemediationSuccessor3V15ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningRemediationSuccessor3V15ConfirmationRunnerPublicKeySHA256 =
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918";

const expectedAuthorizationID = "23d686fc-1a01-4cf0-8242-7c894f67ecbd";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion =
  "20260831-zoning-appendix-j-explicit-input-boundary-v15";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v14-confirmation-paid-authorization.json";
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
    `${zoningRemediationSuccessor3V15ConfirmationPreparedFromCommit}:${relativePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(blob.status === 0,
    `Unable to read the reviewed v15 historical bytes for ${relativePath}.`);
  assert(sha256(blob.stdout) === expectedHash, message);
}

function validateHistoricalReviewedInputs() {
  assertHistoricalFileHash(
    "permitext-sync-server/research-zoning-safety.mjs",
    zoningRemediationSuccessor3V15ConfirmationSafetySHA256,
    "The reviewed v15 historical Zoning safety bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/research-economics.mjs",
    zoningRemediationSuccessor3V15ConfirmationEconomicsSHA256,
    "The reviewed v15 historical Research economics bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/app.mjs",
    zoningRemediationSuccessor3V15ConfirmationAppSHA256,
    "The reviewed v15 historical application bytes changed."
  );
}

async function validateRunnerHandoffInputs(authorization) {
  assert(authorization.lineage?.runnerHandoffProtocol ===
    zoningV11RunnerHandoffProtocol,
  "The v15 package names the wrong signed runner handoff protocol.");
  assert(authorization.lineage?.runnerHandoffSHA256 ===
    zoningRemediationSuccessor3V15ConfirmationRunnerHandoffSHA256,
  "The v15 package names the wrong signed runner handoff SHA.");
  assert(authorization.lineage?.runnerHandoffPublicKeySHA256 ===
    zoningRemediationSuccessor3V15ConfirmationRunnerPublicKeySHA256,
  "The v15 package names the wrong signed runner public-key SHA.");
  await assertFileHash(
    new URL("./zoning-v11-paid-runner-handoff.mjs", import.meta.url),
    zoningRemediationSuccessor3V15ConfirmationRunnerHandoffSHA256,
    "The signed v15 runner handoff implementation changed."
  );
  assert(
    sha256(Buffer.from(zoningV11RunnerPublicKeyDERBase64, "base64")) ===
      zoningRemediationSuccessor3V15ConfirmationRunnerPublicKeySHA256,
    "The signed v15 runner handoff public key changed."
  );
}

async function validateHistoricalV14Lineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v15 package names the wrong historical v14 authorization.");
  assert(lineage?.priorAuthorizationSHA256 ===
    zoningRemediationSuccessor3V14ConfirmationConsumedAuthorizationSHA256,
  "The v15 package names the wrong historical v14 authorization SHA.");
  assert(lineage?.priorAuthorizationPackageCommit ===
    zoningRemediationSuccessor3V14ConfirmationAuthorizationPackageCommit,
  "The v15 package names the wrong historical v14 package commit.");
  assert(lineage?.priorExecutionCommit ===
    zoningRemediationSuccessor3V14ConfirmationExecutionCommit,
  "The v15 package names the wrong historical v14 execution commit.");
  assert(lineage?.priorRunID === zoningRemediationSuccessor3V14ConfirmationRunID,
    "The v15 package names the wrong historical v14 run.");

  await assertFileHash(
    new URL(`./${expectedPriorAuthorizationFile}`, import.meta.url),
    zoningRemediationSuccessor3V14ConfirmationConsumedAuthorizationSHA256,
    "The consumed historical v14 authorization changed."
  );
  await validateZoningRemediationSuccessor3V14ConfirmationPaidAuthorization();

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V14ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V14ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V14ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V14ConfirmationResultMarkdownSHA256,
      "Markdown"]
  ]) {
    assert(lineage?.[`priorResult${label}File`] === file,
      `The v15 package names the wrong historical v14 ${label} result.`);
    assert(lineage?.[`priorResult${label}SHA256`] === expectedHash,
      `The v15 package names the wrong historical v14 ${label} result SHA.`);
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained historical v14 ${label} result changed.`
    );
  }
}

export async function validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v15 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v15 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v15 confirmation authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V15ConfirmationPreparedFromCommit,
  "The v15 confirmation package is not bound to the reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v15 confirmation package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V15ConfirmationSafetySHA256,
  "The v15 confirmation package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V15ConfirmationEconomicsSHA256,
  "The v15 confirmation package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V15ConfirmationAppSHA256,
  "The v15 confirmation package names the wrong application SHA.");
  validateHistoricalReviewedInputs();
  await validateRunnerHandoffInputs(authorization);
  await validateHistoricalV14Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v15 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v15 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase =
    authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v15 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v15 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v15 confirmation authorization may not name an execution commit.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V15 confirmation authorization must bind the exact committed locked package.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "V15 confirmation authorization must retain the exact 30-case, one-repetition, $5 scope.");
    const expectedOwnerPhrase =
      `authorize exactly package commit ${authorizationPackageCommit} for all 30 ` +
      "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
    assert(authorization.ownerDecision?.exactAuthorizationPhrase ===
      expectedOwnerPhrase,
    "V15 confirmation authorization must bind the owner's exact phrase to the selected package and scope.");
    assert(exactSpendingCapPhrase === expectedOwnerPhrase,
      "V15 confirmation authorization must retain the same exact package-bound spending-cap phrase.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v15 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V15 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V15 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v15 confirmation result must match its pre-dispatch attempt identity.");
    assert(authorizationPackageCommit ===
      zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
    "The consumed v15 confirmation must retain its exact locked package commit.");
    assert(executionCommit ===
      zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
    "The consumed v15 confirmation must retain its exact execution commit.");
    assert(authorization.consumption.runID ===
      zoningRemediationSuccessor3V15ConfirmationRunID,
    "The consumed v15 confirmation must retain its exact run ID.");
    for (const [file, expectedHash, label] of [
      [zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
        zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256, "JSON"],
      [zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
        zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256,
        "Markdown"]
    ]) {
      await assertFileHash(
        new URL(`./${file}`, import.meta.url),
        expectedHash,
        `The retained v15 ${label} result changed.`
      );
    }
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V15ConfirmationPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V15ConfirmationPaidAuthorization(
      validation
    );
  }
  console.log("Zoning remediation-successor-3 v15 confirmation authorization guard passed", {
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
