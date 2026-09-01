import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "zoning-architecture-v1-confirmation-paid-authorization.json"
);
const cohortPath = join(
  evalRoot,
  "zoning-cases-expanded-batch-1-successor-remediation-3.json"
);

export const zoningArchitectureV1ConfirmationAuthorizationID =
  "048cb366-4332-4379-9dbc-62feb3fe7224";
export const zoningArchitectureV1ConfirmationLockedAuthorizationSHA256 =
  "f36c09e48fb6f60d58a34d4d392b6aea63349bb1e21e6b06ac34953668ce40f4";
export const zoningArchitectureV1ConfirmationConsumedAuthorizationSHA256 =
  "74161dd63bc0f29487c1fb0bf5be62329226e9c43c1b9ea5a324fb1d2b143b2e";
export const zoningArchitectureV1ConfirmationResultJSONFile =
  "results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json";
export const zoningArchitectureV1ConfirmationResultJSONSHA256 =
  "551ea803cb2e7758f9952874e2ea86dd31cb2b7c17abde3eb487a19f51a0cb0f";
export const zoningArchitectureV1ConfirmationResultMarkdownFile =
  "results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.md";
export const zoningArchitectureV1ConfirmationResultMarkdownSHA256 =
  "a8c7730617681ea8b211fbc01167e54f084d26b26eac7e54dc77fbed112eef77";
export const zoningArchitectureV1ConfirmationRunID =
  "90f42d5b-b758-4df4-98af-933350f036e7";
export const zoningArchitectureV1ConfirmationExecutionCommit =
  "5e3263505a33c2dff2055558be19e274aab5d36a";
export const zoningArchitectureV1ConfirmationCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
export const zoningArchitectureV1ConfirmationPreparedFromCommit =
  "3f72999be05ebfbababe55ba0a2a9c48052738cb";
export const zoningArchitectureV1ConfirmationAppSHA256 =
  "e33bf343a987980cc993274d5783bd1d84389bd32c1e8cbe12d89135ce833f4b";
export const zoningArchitectureV1ConfirmationSafetySHA256 =
  "e0c5f298e9cfbeaed9ed6d084df30b77643f29f011cfe5f309a0fb59a11277df";
export const zoningArchitectureV1ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningArchitectureV1ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningArchitectureV1ConfirmationPaidRunnerSHA256 =
  "aed95f015846c9645dbd8299240de8dbb391f88c78447b8b66d9a5e945062a2d";
export const zoningArchitectureV1ConfirmationEvaluationHarnessSHA256 =
  "31b659d0fc7717a30f77cd52571ab241f9dad6e60e30c8983c8bc848d3284a2e";

const expectedFiles = Object.freeze({
  "evals/results/zoning-architecture-v1-no-cost-preflight.json":
    "0c1337c26c237f774d7320cc95bb034f2b6bb6e6f6a6a19016814d141b6b5c88",
  "research-zoning-planner.mjs":
    "e9ec4d986ad7c150af51bcfb1f60ec87b03ce2d6d723b1296726c865af1fa500",
  "research-model-routing.mjs":
    "acd1c85f3f88ffda919a24138035d458791c216ef1f06e0f44964037b7e8aa65",
  "research-evidence-assembly.mjs":
    "a5f094303fd72fb011ea858d5539b2cf4ff2f60b8e84d291c606156b453cdcb1",
  "research-zoning-safety.mjs":
    "e0c5f298e9cfbeaed9ed6d084df30b77643f29f011cfe5f309a0fb59a11277df",
  "app.mjs":
    "e33bf343a987980cc993274d5783bd1d84389bd32c1e8cbe12d89135ce833f4b",
  "research-economics.mjs":
    "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0",
  "evals/zoning-v11-paid-runner-handoff.mjs":
    "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327",
  "scripts/run-zoning-successor.mjs":
    "aed95f015846c9645dbd8299240de8dbb391f88c78447b8b66d9a5e945062a2d",
  "tests/research-evals.mjs":
    "31b659d0fc7717a30f77cd52571ab241f9dad6e60e30c8983c8bc848d3284a2e",
  "scripts/preflight-zoning-architecture-v1.mjs":
    "3b191d855061b91ea2efe4ab1a5f5e281c4a7466a26707886659eeb2c0052211",
  "tests/research-zoning-planner-contract.mjs":
    "dd5e130beefab2897c71209e8f103125668492a5d88b23375d6dfdb41a45d4c3",
  "evals/zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json":
    "5474123dc94e2c934eb556bc05e1bce823f743d1db39cde8f65cecfade1487aa",
  "evals/results/2026-09-01T13-08-16-791Z-4381fd0a-f719-4e86-b231-972b299e6a57.json":
    "ce98f26f6856b64d2483b9c0047a8d577bde86c8e9734af61a37849294c125f1",
  "evals/results/2026-09-01T13-08-16-791Z-4381fd0a-f719-4e86-b231-972b299e6a57.md":
    "ec97efbd6dc277d2a986b06ae12aaad1aac05622baf60205cb7c73aec4397d3b",
  [`evals/${zoningArchitectureV1ConfirmationResultJSONFile}`]:
    zoningArchitectureV1ConfirmationResultJSONSHA256,
  [`evals/${zoningArchitectureV1ConfirmationResultMarkdownFile}`]:
    zoningArchitectureV1ConfirmationResultMarkdownSHA256
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateBoundFiles() {
  for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
    const value = await readFile(join(serverRoot, relativePath));
    assert(sha256(value) === expectedHash,
      `The locked Architecture V1 input changed: ${relativePath}.`);
  }
}

export async function validateZoningArchitectureV1ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [
    authorizationText,
    cohortText,
    preflightText,
    priorAuthorizationText,
    resultText
  ] = await Promise.all([
    readFile(authorizationPath, "utf8"),
    readFile(cohortPath, "utf8"),
    readFile(join(evalRoot, "results", "zoning-architecture-v1-no-cost-preflight.json"), "utf8"),
    readFile(join(evalRoot, "zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json"), "utf8"),
    readFile(join(evalRoot, zoningArchitectureV1ConfirmationResultJSONFile), "utf8")
  ]);
  const authorization = JSON.parse(authorizationText);
  const cohort = JSON.parse(cohortText);
  const preflight = JSON.parse(preflightText);
  const priorAuthorization = JSON.parse(priorAuthorizationText);
  const result = JSON.parse(resultText);
  await validateBoundFiles();

  assert(authorization.authorizationID === zoningArchitectureV1ConfirmationAuthorizationID,
    "The Architecture V1 confirmation has the wrong authorization identity.");
  assert(authorization.cohort?.sha256 === zoningArchitectureV1ConfirmationCohortSHA256 &&
    sha256(cohortText) === zoningArchitectureV1ConfirmationCohortSHA256,
  "The Architecture V1 confirmation is not bound to the frozen cohort.");
  assert(authorization.cohort?.caseCount === 30 && cohort.cases?.length === 30,
    "The Architecture V1 confirmation must retain all 30 ordered cases.");
  assert(authorization.cohort?.ordered === true,
    "The Architecture V1 confirmation must preserve cohort order.");
  assert(preflight.summary?.pass === true &&
    Object.values(preflight.aggregateGates || {}).every(Boolean),
  "The locked Architecture V1 no-cost preflight is not fully green.");
  assert(preflight.summary?.productionCost?.nominalUSDPerHundred <= 6 &&
    preflight.summary?.productionCost?.adverseUSDPerHundred <= 6,
  "The Architecture V1 production projection exceeds the owner-directed cost ceiling.");
  assert(preflight.summary?.judgeCost?.nominalUSDPerHundred === 0 &&
    preflight.summary?.judgeCost?.adverseUSDPerHundred === 0,
  "The no-cost Architecture V1 preflight must retain a separate zero judge ledger.");
  assert(preflight.summary?.providerRequests?.p50 <= 1 &&
    preflight.summary?.providerRequests?.maximum <= 2,
  "The Architecture V1 request-count projection changed.");
  assert(priorAuthorization.status === "consumed" &&
    priorAuthorization.consumption?.runID === authorization.lineage?.priorV17RunID,
  "The Architecture V1 package lost its consumed V17 lineage.");
  assert(authorization.lineage?.preparedFromCommit ===
    zoningArchitectureV1ConfirmationPreparedFromCommit,
  "The Architecture V1 package is not bound to the reviewed redesign commit.");
  assert(authorization.lineage?.appSHA256 ===
    zoningArchitectureV1ConfirmationAppSHA256 &&
    authorization.lineage?.zoningSafetySHA256 ===
      zoningArchitectureV1ConfirmationSafetySHA256 &&
    authorization.lineage?.researchEconomicsSHA256 ===
      zoningArchitectureV1ConfirmationEconomicsSHA256 &&
    authorization.lineage?.runnerHandoffSHA256 ===
      zoningArchitectureV1ConfirmationRunnerHandoffSHA256 &&
    authorization.lineage?.paidRunnerSHA256 ===
      zoningArchitectureV1ConfirmationPaidRunnerSHA256 &&
    authorization.lineage?.evaluationHarnessSHA256 ===
      zoningArchitectureV1ConfirmationEvaluationHarnessSHA256,
  "The Architecture V1 package lost a pinned runtime input.");
  assert(authorization.lineage?.priorArchitectureV1AuthorizationID ===
      "fd3fe34f-0d25-4fad-90b5-bae5c9bdde31" &&
    authorization.lineage?.priorArchitectureV1ConsumedAuthorizationSHA256 ===
      "56fdf3442620b6032b0ce3267e3ea28a17f07ab4b7feed761c7ae5008087175c" &&
    authorization.lineage?.priorArchitectureV1RunID ===
      "4381fd0a-f719-4e86-b231-972b299e6a57" &&
    authorization.lineage?.priorArchitectureV1ResultSHA256 ===
      "ce98f26f6856b64d2483b9c0047a8d577bde86c8e9734af61a37849294c125f1" &&
    authorization.lineage?.priorArchitectureV1ReportSHA256 ===
      "ec97efbd6dc277d2a986b06ae12aaad1aac05622baf60205cb7c73aec4397d3b" &&
    authorization.lineage?.priorArchitectureV1OrderedOperations === 3 &&
    authorization.lineage?.priorArchitectureV1ActualSpendUSD === 0.03472 &&
    authorization.lineage?.priorArchitectureV1PaidRequests === 5 &&
    authorization.lineage?.priorArchitectureV1PendingPaidRequests === 0,
  "The Architecture V1 package lost its consumed partial-run lineage.");
  assert(authorization.execution?.webSupportEnabled === false,
    "The Architecture V1 confirmation may not enable web support.");
  assert(authorization.execution?.lunaFirst === true,
    "The Architecture V1 confirmation must remain Luna-first.");
  assert(authorization.execution?.fullAnswerRewriteAllowed === false,
    "The Architecture V1 confirmation may not enable full-answer rewrites.");
  assert(authorization.execution?.maximumProviderRequestsPerCase === 2,
    "The Architecture V1 confirmation must retain its two-request maximum.");
  assert(authorization.execution?.judgeLedgerSeparate === true,
    "The Architecture V1 confirmation must keep production and judge ledgers separate.");
  assert(authorization.execution?.continueAfterPrerequisiteBoundary === true,
    "The Architecture V1 confirmation must retain deterministic prerequisite-boundary continuation.");
  assert(JSON.stringify(authorization.execution?.allowedContinuationFailureCodes) ===
    JSON.stringify([
      "RESEARCH_VERIFICATION_FAILED",
      "RESEARCH_ZONING_PREREQUISITES_REQUIRED"
    ]),
  "The Architecture V1 confirmation changed its continuation failure allowlist.");
  for (const field of [
    "publicResearchReleaseAuthorized",
    "professionalZoningSignoff",
    "deploymentAuthorized",
    "pricingOrAllowanceChangeAuthorized",
    "evidenceBudgetCandidateEnabled"
  ]) {
    assert(authorization[field] === false,
      `The Architecture V1 confirmation may not authorize ${field}.`);
  }

  const allowedStatuses = new Set(["locked", "authorized", "running", "consumed"]);
  assert(allowedStatuses.has(authorization.status),
    "The Architecture V1 confirmation has an unsupported status.");
  const packageCommit = authorization.execution?.authorizationPackageCommit;
  if (authorization.status === "locked") {
    assert(authorization.scope?.caseCount === null &&
      authorization.scope?.repetitions === null &&
      authorization.scope?.maximumCumulativeSpendUSD === null,
    "Locked Architecture V1 scope fields must remain null.");
    assert(authorization.ownerDecision?.authorizedAt === null &&
      authorization.ownerDecision?.authorizedBy === null &&
      authorization.ownerDecision?.exactAuthorizationPhrase === null &&
      authorization.ownerDecision?.exactSpendingCapPhrase === null,
    "Locked Architecture V1 owner-decision fields must remain null.");
    assert(packageCommit === null && authorization.execution?.executionCommit === null,
      "Locked Architecture V1 execution fields must remain null.");
    assert(authorization.networkOrModelCallAuthorized === false,
      "Locked Architecture V1 cannot authorize a network or model call.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(packageCommit || ""),
      "An active Architecture V1 authorization must name the exact package commit.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "Architecture V1 authorization must retain the 30-case, one-repetition, $5 scope.");
    const exactPhrase = `authorize exactly package commit ${packageCommit} for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.`;
    assert(authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
      authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase,
    "Architecture V1 authorization must retain the exact owner package and spend-cap sentence.");
    assert(authorization.networkOrModelCallAuthorized === true,
      "Only the exact active owner authorization may permit a provider call.");
  }
  if (authorization.status === "authorized") {
    assert(authorization.execution?.executionCommit === null &&
      authorization.consumption?.status === "not_started" &&
      authorization.consumption?.attemptID === null &&
      authorization.consumption?.runID === null,
    "Authorized Architecture V1 execution must not retain a prior attempt.");
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(typeof authorization.consumption?.attemptID === "string" &&
      authorization.consumption.attemptID.length > 0 &&
      typeof authorization.consumption?.startedAt === "string" &&
      authorization.consumption.startedAt.length > 0 &&
      /^[0-9a-f]{40}$/i.test(authorization.execution?.executionCommit || ""),
    "Architecture V1 execution must retain its durable attempt and execution commit.");
  }
  if (authorization.status === "consumed") {
    assert(sha256(authorizationText) ===
      zoningArchitectureV1ConfirmationConsumedAuthorizationSHA256,
    "The consumed Architecture V1 authorization changed.");
    assert(authorization.consumption?.status === "consumed" &&
      authorization.consumption?.attemptID === zoningArchitectureV1ConfirmationRunID &&
      authorization.consumption?.runID === zoningArchitectureV1ConfirmationRunID &&
      typeof authorization.consumption?.consumedAt === "string" &&
      authorization.execution?.executionCommit ===
        zoningArchitectureV1ConfirmationExecutionCommit,
    "The consumed Architecture V1 authorization lost its exact run identity.");
    assert(result.configuration?.runID === zoningArchitectureV1ConfirmationRunID &&
      result.configuration?.gitCommit ===
        zoningArchitectureV1ConfirmationExecutionCommit &&
      result.status === "partial" &&
      result.configuration?.repeat === 1 &&
      result.configuration?.caseIDs?.length === 30 &&
      result.results?.length === 30,
    "The retained Architecture V1 result lost its exact execution scope.");
    assert(result.configuration.caseIDs.every((caseID, index) =>
      result.results[index]?.testCase?.id === caseID),
    "The retained Architecture V1 result is not in the authorized cohort order.");
    assert(result.configuration?.approvedSpendCapUSD === 5 &&
      result.configuration?.actualUSD === 0.391986 &&
      result.configuration?.paidRequestCount === 42 &&
      result.configuration?.pendingPaidRequestCount === 0,
    "The retained Architecture V1 result lost its settled cost ledger.");
    const completed = result.results.filter((entry) =>
      entry.operationMetric?.status === "completed");
    const failed = result.results.filter((entry) =>
      entry.operationMetric?.status === "failed");
    const rejected = result.results.filter((entry) =>
      entry.operationMetric?.status === "rejected");
    const productionUSD = result.results.reduce((total, entry) =>
      total + (entry.operationMetric?.actualProviderCostUSD || 0), 0);
    const judgeUSD = result.results.reduce((total, entry) =>
      total + (entry.judge?.estimatedCost?.estimatedUSD || 0), 0);
    assert(completed.length === 14 &&
      completed.filter((entry) => entry.scoring?.passed === true).length === 12 &&
      failed.length === 11 &&
      rejected.length === 5,
    "The retained Architecture V1 result changed its terminal outcome counts.");
    assert(Number(productionUSD.toFixed(6)) === 0.103877 &&
      Number(judgeUSD.toFixed(6)) === 0.288109 &&
      Number((productionUSD + judgeUSD).toFixed(6)) ===
        result.configuration.actualUSD,
    "The retained Architecture V1 production and judge ledgers no longer reconcile.");
    assert(completed.every((entry) =>
      entry.operationMetric?.charged === true &&
      entry.operationMetric?.model === "gpt-5.6-luna" &&
      entry.operationMetric?.escalated === false &&
      entry.operationMetric?.webSupportRequested === false) &&
      failed.every((entry) =>
      entry.operationMetric?.failureCode === "RESEARCH_VERIFICATION_FAILED" &&
      entry.operationMetric?.charged === false &&
      entry.operationMetric?.providerRequestCount > 0 &&
      entry.operationMetric?.pendingProviderRequestCount === 0) &&
      rejected.every((entry) =>
        entry.operationMetric?.failureCode ===
          "RESEARCH_ZONING_PREREQUISITES_REQUIRED" &&
        entry.operationMetric?.charged === false &&
        entry.operationMetric?.providerRequestCount === 0 &&
        entry.operationMetric?.pendingProviderRequestCount === 0),
    "The retained Architecture V1 fail-closed outcomes changed.");
    assert(result.economics?.sample?.sampleReady === false &&
      result.economics?.readyForPricingDecision === false,
    "The retained Architecture V1 result may not be promoted to pricing evidence.");
  }
  const active = authorization.status === "authorized" &&
    authorization.networkOrModelCallAuthorized === true;
  return {
    authorization,
    cohort,
    cohortPath,
    preflight,
    result,
    active,
    authorizationSHA256: sha256(authorizationText)
  };
}

export function requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(validation) {
  if (validation?.active) return validation;
  const error = new Error(
    "Zoning Architecture V1 requires the exact locked-package authorization sentence and cumulative spend cap before any provider request."
  );
  error.code = "ZONING_ARCHITECTURE_V1_AUTHORIZATION_REQUIRED";
  throw error;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningArchitectureV1ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning Architecture V1 confirmation authorization guard passed", {
    status: validation.authorization.status,
    active: validation.active,
    cohortCases: validation.cohort.cases.length,
    productionAdverseUSDPerHundred:
      validation.preflight.summary.productionCost.adverseUSDPerHundred,
    judgeUSDPerHundred:
      validation.preflight.summary.judgeCost.adverseUSDPerHundred,
    networkOrModelCallAuthorized:
      validation.authorization.networkOrModelCallAuthorized
  });
}
