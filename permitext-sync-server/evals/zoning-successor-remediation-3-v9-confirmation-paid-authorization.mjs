import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "./zoning-successor-paid-authorization.mjs";
import {
  validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V8ConfirmationRunID
} from "./zoning-successor-remediation-3-v8-confirmation-paid-authorization.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v9-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V9ConfirmationLockedAuthorizationSHA256 =
  "f8176550c79a3e7caddfc903760123d07467201ba8b83a260c105bd831e53b7c";
export const zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit =
  "1fae244d775192f55f0fd6ee17d90cb82648ba01";
export const zoningRemediationSuccessor3V9ConfirmationSafetySHA256 =
  "56b945d1a29405bd9b3e41c44909ec69a70c043a03464b9b35b9e82245ab5e71";
export const zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningRemediationSuccessor3V9ConfirmationAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";

const expectedAuthorizationID = "9aaade99-759b-41d6-ad73-3ef9b4a168f9";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion = "20260830-zoning-material-completeness-v9";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v8-confirmation-paid-authorization.json";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertFileHash(url, expectedHash, message) {
  assert(sha256(await readFile(fileURLToPath(url), "utf8")) === expectedHash, message);
}

async function validateReviewedInputs() {
  await assertFileHash(
    new URL("../research-zoning-safety.mjs", import.meta.url),
    zoningRemediationSuccessor3V9ConfirmationSafetySHA256,
    "The reviewed v9 Zoning safety bytes changed."
  );
  await assertFileHash(
    new URL("../research-economics.mjs", import.meta.url),
    zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
    "The reviewed v9 Research economics bytes changed."
  );
  await assertFileHash(
    new URL("../app.mjs", import.meta.url),
    zoningRemediationSuccessor3V9ConfirmationAppSHA256,
    "The reviewed v9 application bytes changed."
  );
}

async function validateHistoricalV8Lineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v9 package names the wrong historical v8 authorization.");
  assert(lineage?.priorAuthorizationSHA256 ===
    zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  "The v9 package names the wrong historical v8 authorization SHA.");
  assert(lineage?.priorAuthorizationPackageCommit ===
    zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  "The v9 package names the wrong historical v8 package commit.");
  assert(lineage?.priorExecutionCommit ===
    zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  "The v9 package names the wrong historical v8 execution commit.");
  assert(lineage?.priorRunID === zoningRemediationSuccessor3V8ConfirmationRunID,
    "The v9 package names the wrong historical v8 run.");

  const priorAuthorizationURL = new URL(`./${expectedPriorAuthorizationFile}`, import.meta.url);
  await assertFileHash(
    priorAuthorizationURL,
    zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
    "The consumed historical v8 authorization changed."
  );
  await validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization();

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256, "Markdown"]
  ]) {
    assert(lineage?.[`priorResult${label}File`] === file,
      `The v9 package names the wrong historical v8 ${label} result.`);
    assert(lineage?.[`priorResult${label}SHA256`] === expectedHash,
      `The v9 package names the wrong historical v8 ${label} result SHA.`);
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained historical v8 ${label} result changed.`
    );
  }
}

export async function validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({ authorizationPath });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v9 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v9 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v9 confirmation authorization names the wrong cohort SHA.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit,
  "The v9 confirmation package is not bound to the independently reviewed repair commit.");
  assert(authorization.lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v9 confirmation package names the wrong Zoning safety version.");
  assert(authorization.lineage?.zoningSafetySHA256 ===
    zoningRemediationSuccessor3V9ConfirmationSafetySHA256,
  "The v9 confirmation package names the wrong Zoning safety SHA.");
  assert(authorization.lineage?.researchEconomicsSHA256 ===
    zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
  "The v9 confirmation package names the wrong Research economics SHA.");
  assert(authorization.lineage?.appSHA256 ===
    zoningRemediationSuccessor3V9ConfirmationAppSHA256,
  "The v9 confirmation package names the wrong application SHA.");
  await validateReviewedInputs();
  await validateHistoricalV8Lineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v9 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v9 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase = authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v9 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v9 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v9 confirmation authorization may not name an execution commit.");
  } else {
    assert(typeof exactSpendingCapPhrase === "string" &&
      exactSpendingCapPhrase.length > 0,
    "V9 confirmation authorization must retain the owner's exact spending-cap phrase.");
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V9 confirmation authorization must bind the exact committed locked package.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v9 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V9 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V9 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID === authorization.consumption.runID,
      "The consumed v9 confirmation result must match its pre-dispatch attempt identity.");
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization(
  validation
) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning remediation-successor-3 v9 confirmation authorization guard passed", {
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
