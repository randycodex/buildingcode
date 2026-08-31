import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "./zoning-successor-paid-authorization.mjs";

const defaultAuthorizationPath = fileURLToPath(new URL(
  "./zoning-successor-remediation-3-v8-confirmation-paid-authorization.json",
  import.meta.url
));
export const zoningRemediationSuccessor3V8ConfirmationLockedAuthorizationSHA256 =
  "b84e663c5eeaadf83b42d8a0a208aa6021d39a0d5d6912cbbdbaabcdc0f664c6";
export const zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit =
  "747887054e1bba16578a44477720f813a55fc357";
export const zoningRemediationSuccessor3V8ConfirmationSafetySHA256 =
  "62bb5459c2ea22f981b4b2b0367d25b7086c7d86bf0d0cb92d582ae1d817dc94";
export const zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit =
  "7cc2af325dbb3c5c98e4e15e2c15196a4794cb76";
export const zoningRemediationSuccessor3V8ConfirmationExecutionCommit =
  "9d4af1b31762568caa5accf63b52e275f0e39bde";
export const zoningRemediationSuccessor3V8ConfirmationRunID =
  "1521497c-8df4-4ed9-98ce-79ef2805d1a6";
export const zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256 =
  "f9d01e8f94d96d3bc7e8e0a71fc43f183ed31b686a6e773e204fc0afc3872e58";
export const zoningRemediationSuccessor3V8ConfirmationResultJSONFile =
  "results/2026-08-31T01-59-26-104Z-1521497c-8df4-4ed9-98ce-79ef2805d1a6.json";
export const zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256 =
  "1fc4dccc10791014baac9714f7c20fbe099084a4b7ae15d346c95939ab9a3c3e";
export const zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile =
  "results/2026-08-31T01-59-26-104Z-1521497c-8df4-4ed9-98ce-79ef2805d1a6.md";
export const zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256 =
  "ef7e1d2eaaef2847fc5b0abfa81d1755980a5683e1eeae58cdb18a992325506e";

const expectedCohortFile =
  "zoning-cases-expanded-batch-1-successor-remediation-3.json";
const expectedCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const expectedAuthorizationID =
  "151aa121-7962-48d1-80b3-56728e62fc75";
const expectedPreparedFromCommit =
  zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit;
const expectedSafetyVersion =
  "20260830-zoning-material-completeness-v8";
const expectedSafetySHA256 =
  zoningRemediationSuccessor3V8ConfirmationSafetySHA256;
const expectedPriorAuthorizationFile =
  "zoning-successor-remediation-3-paid-authorization.json";
const expectedPriorAuthorizationSHA256 =
  "f25b5c41897c6aaa251f812e1b0565cd69d661cb2ae60886d446a9a26df26bd9";
const expectedPriorRunID =
  "b4ef6990-5347-40d5-8654-611b893e8f1b";
const expectedPriorResultJSONFile =
  "results/2026-08-31T00-41-50-396Z-b4ef6990-5347-40d5-8654-611b893e8f1b.json";
const expectedPriorResultJSONSHA256 =
  "3e5728cce04fa4f810bcbb7fe8c52a7a26acdd991a2061f73055766e44a1abf9";
const expectedPriorResultMarkdownFile =
  "results/2026-08-31T00-41-50-396Z-b4ef6990-5347-40d5-8654-611b893e8f1b.md";
const expectedPriorResultMarkdownSHA256 =
  "73d5f34a043ecd948bd87837a2aeea4892fa29e69aafed6063308f42aa161c56";
function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateRetainedLineage(authorization) {
  const lineage = authorization.lineage;
  assert(lineage?.preparedFromCommit === expectedPreparedFromCommit,
    "The v8 confirmation package is not bound to the reviewed repair commit.");
  assert(lineage?.zoningSafetyVersion === expectedSafetyVersion,
    "The v8 confirmation package names the wrong Zoning safety version.");
  assert(lineage?.zoningSafetySHA256 === expectedSafetySHA256,
    "The v8 confirmation package names the wrong Zoning safety SHA.");
  assert(lineage?.priorAuthorizationFile === expectedPriorAuthorizationFile,
    "The v8 confirmation package names the wrong prior authorization.");
  assert(lineage?.priorAuthorizationSHA256 === expectedPriorAuthorizationSHA256,
    "The v8 confirmation package names the wrong prior authorization SHA.");
  const priorAuthorizationPath = fileURLToPath(new URL(
    `./${expectedPriorAuthorizationFile}`,
    import.meta.url
  ));
  const priorAuthorizationText = await readFile(priorAuthorizationPath, "utf8");
  assert(sha256(priorAuthorizationText) === expectedPriorAuthorizationSHA256,
    "The consumed remediation-successor-3 authorization changed.");
  const priorAuthorization = JSON.parse(priorAuthorizationText);
  assert(priorAuthorization.status === "consumed" &&
    priorAuthorization.consumption?.runID === expectedPriorRunID,
  "The v8 confirmation package cannot replace or reuse the prior consumed run.");
  assert(lineage?.priorRunID === expectedPriorRunID,
    "The v8 confirmation package names the wrong prior run ID.");

  for (const [file, expectedHash, label] of [
    [lineage?.priorResultJSONFile, lineage?.priorResultJSONSHA256, "JSON"],
    [lineage?.priorResultMarkdownFile, lineage?.priorResultMarkdownSHA256, "Markdown"]
  ]) {
    assert(
      (label === "JSON" && file === expectedPriorResultJSONFile &&
        expectedHash === expectedPriorResultJSONSHA256) ||
      (label === "Markdown" && file === expectedPriorResultMarkdownFile &&
        expectedHash === expectedPriorResultMarkdownSHA256),
      `The v8 confirmation package names the wrong prior ${label} result.`
    );
    const resultPath = fileURLToPath(new URL(`./${file}`, import.meta.url));
    assert(sha256(await readFile(resultPath, "utf8")) === expectedHash,
      `The retained prior ${label} result changed.`);
  }
}

async function validateConsumedEvidence(authorization) {
  assert(authorization.execution?.authorizationPackageCommit ===
    zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  "The consumed v8 confirmation names the wrong locked package commit.");
  assert(authorization.execution?.executionCommit ===
    zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  "The consumed v8 confirmation names the wrong execution commit.");
  assert(authorization.consumption?.attemptID ===
    zoningRemediationSuccessor3V8ConfirmationRunID &&
    authorization.consumption?.runID ===
      zoningRemediationSuccessor3V8ConfirmationRunID,
  "The consumed v8 confirmation names the wrong retained run.");

  for (const [file, expectedHash, label] of [
    [zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
      zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256, "JSON"],
    [zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
      zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256, "Markdown"]
  ]) {
    const resultPath = fileURLToPath(new URL(`./${file}`, import.meta.url));
    assert(sha256(await readFile(resultPath, "utf8")) === expectedHash,
      `The retained v8 confirmation ${label} result changed.`);
  }

  const result = JSON.parse(await readFile(fileURLToPath(new URL(
    `./${zoningRemediationSuccessor3V8ConfirmationResultJSONFile}`,
    import.meta.url
  )), "utf8"));
  assert(result.status === "partial",
    "The retained v8 confirmation must remain a terminal partial result.");
  assert(result.configuration?.runID ===
    zoningRemediationSuccessor3V8ConfirmationRunID &&
    result.configuration?.gitCommit ===
      zoningRemediationSuccessor3V8ConfirmationExecutionCommit &&
    result.configuration?.datasetSHA256 === expectedCohortSHA256,
  "The retained v8 confirmation result lineage changed.");
  assert(result.configuration?.repeat === 1 &&
    result.configuration?.caseIDs?.length === 30 &&
    result.configuration?.approvedSpendCapUSD === 5,
  "The retained v8 confirmation result scope changed.");
  assert(result.configuration?.webSupportEnabled === false &&
    result.configuration?.stopOnExecutionError === true,
  "The retained v8 confirmation execution policy changed.");
  assert(result.configuration?.actualUSD === 0.297314 &&
    result.configuration?.conservativeReservedUSD === 0.297314 &&
    result.configuration?.paidRequestCount === 10 &&
    result.configuration?.pendingPaidRequestCount === 0,
  "The retained v8 confirmation spend ledger changed.");
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
  "The retained v8 confirmation case outcomes changed.");
}

export async function validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const validation = await validateZoningSuccessorPaidAuthorization({
    authorizationPath
  });
  const authorization = validation.authorization;
  assert(authorization.authorizationID === expectedAuthorizationID,
    "The v8 confirmation authorization has the wrong unique identity.");
  assert(authorization.cohort.file === expectedCohortFile,
    "The v8 confirmation authorization names the wrong cohort file.");
  assert(authorization.cohort.sha256 === expectedCohortSHA256,
    "The v8 confirmation authorization names the wrong cohort SHA.");
  await validateRetainedLineage(authorization);

  assert(authorization.execution?.webSupportEnabled === false,
    "The v8 confirmation package may not enable unbudgeted web search.");
  assert(authorization.execution?.stopOnExecutionError === true,
    "The v8 confirmation package must stop on its first execution error.");
  const exactSpendingCapPhrase =
    authorization.ownerDecision?.exactSpendingCapPhrase;
  const authorizationPackageCommit =
    authorization.execution?.authorizationPackageCommit;
  const executionCommit = authorization.execution?.executionCommit;
  if (authorization.status === "locked") {
    assert(exactSpendingCapPhrase === null,
      "Locked v8 confirmation authorization may not record a spending-cap phrase.");
    assert(authorizationPackageCommit === null,
      "Locked v8 confirmation authorization may not name an authorized package commit.");
    assert(executionCommit === null,
      "Locked v8 confirmation authorization may not name an execution commit.");
  } else {
    assert(typeof exactSpendingCapPhrase === "string" &&
      exactSpendingCapPhrase.length > 0,
    "V8 confirmation authorization must retain the owner's exact spending-cap phrase.");
    assert(/^[0-9a-f]{40}$/i.test(authorizationPackageCommit || ""),
      "V8 confirmation authorization must bind the exact committed locked package.");
  }
  if (authorization.status === "authorized") {
    assert(executionCommit === null,
      "Authorized v8 confirmation may not name an execution commit before dispatch.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0,
    "V8 confirmation execution must retain its durable attempt identity.");
    assert(/^[0-9a-f]{40}$/i.test(executionCommit || ""),
      "V8 confirmation execution must retain its exact clean execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(authorization.consumption.attemptID ===
      authorization.consumption.runID,
    "The consumed v8 confirmation result must match its pre-dispatch attempt identity.");
    await validateConsumedEvidence(authorization);
  }
  return validation;
}

export function requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization(validation) {
  return requireActiveZoningSuccessorPaidAuthorization(validation);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation =
    await validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning remediation-successor-3 v8 confirmation authorization guard passed", {
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
