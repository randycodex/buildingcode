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
export const zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit =
  "571367800030d49a103a999090eaa615baa361ec";
export const zoningRemediationSuccessor3V9ConfirmationExecutionCommit =
  "17fea6186d35a43348c5b73f419ccc9014dfb374";
export const zoningRemediationSuccessor3V9ConfirmationRunID =
  "00570309-e1f2-441b-9f09-8df4f0603253";
export const zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256 =
  "ffa134fc6f2855264ff54c8b285ba49f3bb16ab908b712072854d61bc2eb39e4";
export const zoningRemediationSuccessor3V9ConfirmationResultJSONFile =
  "results/2026-08-31T17-22-10-000Z-00570309-e1f2-441b-9f09-8df4f0603253.json";
export const zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256 =
  "ad43aee5d7d9038eef1de09f1b9595b779abe4bcb7199421e5a905807380c9d6";
export const zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile =
  "results/2026-08-31T17-22-10-000Z-00570309-e1f2-441b-9f09-8df4f0603253.md";
export const zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256 =
  "46a1f7c0b299ac1e1b6234f19e34a557389dcde2381f89c253802ef2152f30ad";

const expectedAuthorizationID = "9aaade99-759b-41d6-ad73-3ef9b4a168f9";
const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedSafetyVersion = "20260830-zoning-material-completeness-v9";
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-v8-confirmation-paid-authorization.json";
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
    `${zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit}:${relativePath}`
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert(blob.status === 0,
    `Unable to read the reviewed v9 historical bytes for ${relativePath}.`);
  assert(sha256(blob.stdout) === expectedHash, message);
}

function validateHistoricalReviewedInputs() {
  assertHistoricalFileHash(
    "permitext-sync-server/research-zoning-safety.mjs",
    zoningRemediationSuccessor3V9ConfirmationSafetySHA256,
    "The reviewed v9 historical Zoning safety bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/research-economics.mjs",
    zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
    "The reviewed v9 historical Research economics bytes changed."
  );
  assertHistoricalFileHash(
    "permitext-sync-server/app.mjs",
    zoningRemediationSuccessor3V9ConfirmationAppSHA256,
    "The reviewed v9 historical application bytes changed."
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

async function validateConsumedEvidence(authorization) {
  assert(authorization.execution?.authorizationPackageCommit ===
    zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  "The consumed v9 confirmation names the wrong locked package commit.");
  assert(authorization.execution?.executionCommit ===
    zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  "The consumed v9 confirmation names the wrong execution commit.");
  assert(authorization.consumption?.attemptID ===
    zoningRemediationSuccessor3V9ConfirmationRunID &&
    authorization.consumption?.runID ===
      zoningRemediationSuccessor3V9ConfirmationRunID,
  "The consumed v9 confirmation names the wrong retained run.");

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256, "Markdown"]
  ]) {
    await assertFileHash(
      new URL(`./${file}`, import.meta.url),
      expectedHash,
      `The retained v9 confirmation ${label} result changed.`
    );
  }

  const result = JSON.parse(await readFile(fileURLToPath(new URL(
    `./${zoningRemediationSuccessor3V9ConfirmationResultJSONFile}`,
    import.meta.url
  )), "utf8"));
  assert(result.status === "partial",
    "The retained v9 confirmation must remain a terminal partial result.");
  assert(result.configuration?.runID ===
    zoningRemediationSuccessor3V9ConfirmationRunID &&
    result.configuration?.gitCommit ===
      zoningRemediationSuccessor3V9ConfirmationExecutionCommit &&
    result.configuration?.datasetSHA256 === expectedCohortSHA256,
  "The retained v9 confirmation result lineage changed.");
  assert(result.configuration?.repeat === 1 &&
    result.configuration?.caseIDs?.length === 30 &&
    result.configuration?.approvedSpendCapUSD === 5,
  "The retained v9 confirmation result scope changed.");
  assert(result.configuration?.webSupportEnabled === false &&
    result.configuration?.stopOnExecutionError === true,
  "The retained v9 confirmation execution policy changed.");
  assert(result.configuration?.actualUSD === 0.299904 &&
    result.configuration?.conservativeReservedUSD === 0.299904 &&
    result.configuration?.paidRequestCount === 10 &&
    result.configuration?.pendingPaidRequestCount === 0,
  "The retained v9 confirmation spend ledger changed.");
  assert(result.results?.length === 3 &&
    result.results[0]?.testCase?.id === "zr-rules-of-construction" &&
    result.results[1]?.testCase?.id === "zr-use-group-table" &&
    result.results[2]?.testCase?.id === "zr-appendix-map-boundaries" &&
    result.results[0]?.scoring?.passed === true &&
    result.results[1]?.scoring?.passed === true &&
    result.results[2]?.operationMetric?.status === "failed" &&
    result.results[2]?.operationMetric?.charged === false &&
    result.results[2]?.operationMetric?.verificationIssueTypes?.includes(
      "zoning_missing_mapped_location"
    ),
  "The retained v9 confirmation case outcomes changed.");

  const diagnostics =
    result.results[2]?.operationMetric?.verificationAttemptDiagnostics;
  assert(Array.isArray(diagnostics) && diagnostics.length === 2,
    "The retained v9 confirmation must preserve two bounded diagnostics.");
  assert(diagnostics.every((item) =>
    item?.zoningSafety?.kind === "zoning_mapped_location" &&
    item.zoningSafety.sourceBoundaryQuestion === true &&
    item.zoningSafety.citedAppendixJ === true &&
    item.zoningSafety.mappedLocationBoundaryPresent === true &&
    Array.isArray(item.zoningSafety.triggeringClauses) &&
    item.zoningSafety.triggeringClauses.length > 0 &&
    item.zoningSafety.triggeringClauses.every((clause) =>
      clause.locationBoundary === false &&
      clause.sourceRule === false &&
      clause.directConclusion === true &&
      typeof clause.clauseHash === "string" &&
      /^[0-9a-f]{64}$/i.test(clause.clauseHash) &&
      typeof clause.clauseLength === "number" &&
      !("text" in clause)
    )
  ), "The retained v9 privacy-bounded diagnostic classification changed.");
  assert(result.economics?.sample?.completed === 2 &&
    result.economics?.sample?.sampleReady === false &&
    result.economics?.economics?.projectedCostPer100TurnsUSD === 13.44 &&
    result.economics?.readyForPricingDecision === false,
  "The retained v9 confirmation economics changed.");
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
  validateHistoricalReviewedInputs();
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
    await validateConsumedEvidence(authorization);
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
