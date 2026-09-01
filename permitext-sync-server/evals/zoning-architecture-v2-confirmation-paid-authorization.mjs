import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const repositoryRoot = dirname(serverRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "zoning-architecture-v2-confirmation-paid-authorization.json"
);
const cohortPath = join(
  evalRoot,
  "zoning-cases-expanded-batch-1-successor-remediation-3.json"
);
const preflightPath = join(
  evalRoot,
  "results",
  "zoning-architecture-v2-no-cost-preflight.json"
);

export const zoningArchitectureV2ConfirmationAuthorizationID =
  "7b58a481-a900-4be1-9cf5-1d26e5fda78b";
export const zoningArchitectureV2ConfirmationLockedAuthorizationSHA256 =
  "50db45e451be9718f2e4c735dcbc2dbcd72c3d0315b96fe1133ae02a16440e5c";
export const zoningArchitectureV2ConfirmationConsumedAuthorizationSHA256 =
  "275dbe7be87b74a02fc6ab2c7b99b48efbaf339a57984bbabc427a2c0376ea42";
export const zoningArchitectureV2ConfirmationResultJSONFile =
  "results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json";
export const zoningArchitectureV2ConfirmationResultJSONSHA256 =
  "06af0893b2dc201f12c48a405accaf5b6262f72aeaa67014013de89c7b9ece44";
export const zoningArchitectureV2ConfirmationResultMarkdownFile =
  "results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.md";
export const zoningArchitectureV2ConfirmationResultMarkdownSHA256 =
  "91bcefe323918e20ca11acf1d57ad758008f83f5a405d87db6e3488347172128";
export const zoningArchitectureV2ConfirmationRunID =
  "9f67f4ba-3944-46a4-b438-fcec082144e3";
export const zoningArchitectureV2ConfirmationExecutionCommit =
  "fffd5c58c8b781bd9e322bdfad421ab2a65450e3";
export const zoningArchitectureV2ConfirmationCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
export const zoningArchitectureV2ConfirmationPreparedFromCommit =
  "991d38a0047f53d49975fa6af5259f0063d4bd0e";
export const zoningArchitectureV2ConfirmationAppSHA256 =
  "e3088a644dfdf9ecfb929a607a95a5eb38ee9e3b2b06276cc01d24bbd49b910a";
export const zoningArchitectureV2ConfirmationSafetySHA256 =
  "e0c5f298e9cfbeaed9ed6d084df30b77643f29f011cfe5f309a0fb59a11277df";
export const zoningArchitectureV2ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningArchitectureV2ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningArchitectureV2ConfirmationPaidRunnerSHA256 =
  "df4d71757d534f7e310c47b79c4281389312beebdf2b67541aff0fccfa178c9f";
export const zoningArchitectureV2ConfirmationEvaluationHarnessSHA256 =
  "19f1200321194e23368f7a5f9ffe4536e5a5c21c2e032773e0b54e996ad851fd";

const expectedFiles = Object.freeze({
  "evals/results/zoning-architecture-v2-no-cost-preflight.json":
    "795676531eda046b046d55215afcf4d01c08846f2e9f1a7404e79ac3348d614c",
  "research-zoning-planner.mjs":
    "87d9a9e425100b17aa7209f04b8084ed065fec7ee5d712c36e85d2e104eb0a17",
  "research-model-routing.mjs":
    "c10f4be6bf5249868744a4794997008d6d5548811672f7da1a6b0101836ae634",
  "research-evidence-assembly.mjs":
    "a5f094303fd72fb011ea858d5539b2cf4ff2f60b8e84d291c606156b453cdcb1",
  "research-zoning-safety.mjs":
    zoningArchitectureV2ConfirmationSafetySHA256,
  "app.mjs": zoningArchitectureV2ConfirmationAppSHA256,
  "research-economics.mjs": zoningArchitectureV2ConfirmationEconomicsSHA256,
  "evals/zoning-v11-paid-runner-handoff.mjs":
    zoningArchitectureV2ConfirmationRunnerHandoffSHA256,
  "scripts/run-zoning-successor.mjs":
    zoningArchitectureV2ConfirmationPaidRunnerSHA256,
  "tests/research-evals.mjs":
    zoningArchitectureV2ConfirmationEvaluationHarnessSHA256,
  "scripts/preflight-zoning-architecture-v2.mjs":
    "7643aa53f86aba9d3b9d983f0d0ed2143466e602376fa85961fa42f422fb219d",
  "tests/research-zoning-architecture-v2-contract.mjs":
    "d6de1d320294bc9ced2aa90bc2ffc22c516ae3e8207f74788f2e4cae1365b156",
  [`evals/${zoningArchitectureV2ConfirmationResultJSONFile}`]:
    zoningArchitectureV2ConfirmationResultJSONSHA256,
  [`evals/${zoningArchitectureV2ConfirmationResultMarkdownFile}`]:
    zoningArchitectureV2ConfirmationResultMarkdownSHA256
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateBoundFiles() {
  for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
    const historicalPath = `permitext-sync-server/${relativePath}`;
    const historical = spawnSync(
      "git",
      ["show", `${zoningArchitectureV2ConfirmationExecutionCommit}:${historicalPath}`],
      {
        cwd: repositoryRoot,
        encoding: null,
        maxBuffer: 16 * 1024 * 1024
      }
    );
    const value = historical.status === 0
      ? historical.stdout
      : await readFile(join(serverRoot, relativePath));
    assert(
      sha256(value) === expectedHash,
      `The locked Architecture V2 input changed: ${relativePath}.`
    );
  }
}

export async function validateZoningArchitectureV2ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [authorizationText, cohortText, preflightText, resultText] = await Promise.all([
    readFile(authorizationPath, "utf8"),
    readFile(cohortPath, "utf8"),
    readFile(preflightPath, "utf8"),
    readFile(join(evalRoot, zoningArchitectureV2ConfirmationResultJSONFile), "utf8")
  ]);
  const authorization = JSON.parse(authorizationText);
  const cohort = JSON.parse(cohortText);
  const preflight = JSON.parse(preflightText);
  const result = JSON.parse(resultText);
  await validateBoundFiles();

  assert(
    authorization.authorizationID === zoningArchitectureV2ConfirmationAuthorizationID,
    "The Architecture V2 confirmation has the wrong authorization identity."
  );
  assert(
    authorization.cohort?.sha256 === zoningArchitectureV2ConfirmationCohortSHA256 &&
      sha256(cohortText) === zoningArchitectureV2ConfirmationCohortSHA256,
    "The Architecture V2 confirmation is not bound to the frozen cohort."
  );
  assert(
    authorization.cohort?.caseCount === 30 &&
      authorization.cohort?.ordered === true &&
      cohort.cases?.length === 30,
    "The Architecture V2 confirmation must retain all 30 ordered cases."
  );
  assert(
    preflight.summary?.pass === true &&
      Object.values(preflight.aggregateGates || {}).every(Boolean) &&
      preflight.summary?.readyCaseCount === 24 &&
      preflight.summary?.zeroModelBoundaryCount === 6,
    "The locked Architecture V2 no-cost preflight is not fully green."
  );
  assert(
    preflight.summary?.productionCost?.nominalUSDPerHundredCompleted <= 6 &&
      preflight.summary?.productionCost?.adverseUSDPerHundredCompleted <= 6,
    "The Architecture V2 Production projection exceeds the owner-directed cost target."
  );
  assert(
    preflight.summary?.judgeCost?.requestCount === 0 &&
      preflight.summary?.judgeCost?.nominalUSD === 0 &&
      preflight.summary?.judgeCost?.adverseUSD === 0,
    "The no-cost Architecture V2 preflight must retain a separate zero judge ledger."
  );
  assert(
    preflight.summary?.providerRequests?.nominalP90 <= 2 &&
      preflight.summary?.providerRequests?.adverseMaximum <= 3,
    "The Architecture V2 logical-stage projection changed."
  );
  assert(
    authorization.lineage?.preparedFromCommit ===
      zoningArchitectureV2ConfirmationPreparedFromCommit &&
      authorization.lineage?.plannerVersion ===
        "20260901-question-compiler-v2" &&
      authorization.lineage?.repairVersion ===
        "20260901-source-bounded-patch-v2" &&
      authorization.lineage?.appSHA256 ===
        zoningArchitectureV2ConfirmationAppSHA256 &&
      authorization.lineage?.zoningSafetySHA256 ===
        zoningArchitectureV2ConfirmationSafetySHA256 &&
      authorization.lineage?.researchEconomicsSHA256 ===
        zoningArchitectureV2ConfirmationEconomicsSHA256 &&
      authorization.lineage?.runnerHandoffSHA256 ===
        zoningArchitectureV2ConfirmationRunnerHandoffSHA256 &&
      authorization.lineage?.paidRunnerSHA256 ===
        zoningArchitectureV2ConfirmationPaidRunnerSHA256 &&
      authorization.lineage?.evaluationHarnessSHA256 ===
        zoningArchitectureV2ConfirmationEvaluationHarnessSHA256 &&
      authorization.lineage?.noCostPreflightSHA256 ===
        expectedFiles["evals/results/zoning-architecture-v2-no-cost-preflight.json"],
    "The Architecture V2 package lost a pinned implementation or runner input."
  );
  assert(
    authorization.lineage?.priorArchitectureV1AuthorizationID ===
      "048cb366-4332-4379-9dbc-62feb3fe7224" &&
      authorization.lineage?.priorArchitectureV1RunID ===
        "90f42d5b-b758-4df4-98af-933350f036e7" &&
      authorization.lineage?.priorArchitectureV1ResultSHA256 ===
        "551ea803cb2e7758f9952874e2ea86dd31cb2b7c17abde3eb487a19f51a0cb0f",
    "The Architecture V2 package lost its consumed V1 diagnostic lineage."
  );

  const execution = authorization.execution || {};
  assert(
    execution.webSupportEnabled === false &&
      execution.selectiveLunaTerraRouting === true &&
      execution.fullAnswerRewriteAllowed === false &&
      execution.maximumLogicalModelStagesPerCase === 3 &&
      execution.maximumSourceBoundedRepairsPerCase === 1 &&
      execution.maximumRepairSources === 5 &&
      execution.maximumRepairSourceCharacters === 8000 &&
      execution.judgeLedgerSeparate === true &&
      execution.stopOnExecutionError === false &&
      execution.continueAfterVerifiedResearchFailure === true &&
      execution.continueAfterPreGenerationBoundary === true,
    "The Architecture V2 confirmation changed its reviewed execution policy."
  );
  assert(
    JSON.stringify(execution.allowedContinuationFailureCodes) ===
      JSON.stringify([
        "RESEARCH_VERIFICATION_FAILED",
        "RESEARCH_ZONING_PREREQUISITES_REQUIRED",
        "RESEARCH_ZONING_EVIDENCE_REQUIRED",
        "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED"
      ]),
    "The Architecture V2 confirmation changed its continuation allowlist."
  );
  for (const field of [
    "publicResearchReleaseAuthorized",
    "professionalZoningSignoff",
    "deploymentAuthorized",
    "pricingOrAllowanceChangeAuthorized",
    "evidenceBudgetCandidateEnabled"
  ]) {
    assert(
      authorization[field] === false,
      `The Architecture V2 confirmation may not authorize ${field}.`
    );
  }

  const allowedStatuses = new Set(["locked", "authorized", "running", "consumed"]);
  assert(
    allowedStatuses.has(authorization.status),
    "The Architecture V2 confirmation has an unsupported status."
  );
  const packageCommit = execution.authorizationPackageCommit;
  if (authorization.status === "locked") {
    assert(
      sha256(authorizationText) ===
        zoningArchitectureV2ConfirmationLockedAuthorizationSHA256,
      "The locked Architecture V2 authorization changed."
    );
    assert(
      authorization.scope?.caseCount === null &&
        authorization.scope?.repetitions === null &&
        authorization.scope?.maximumCumulativeSpendUSD === null,
      "Locked Architecture V2 scope fields must remain null."
    );
    assert(
      authorization.ownerDecision?.authorizedAt === null &&
        authorization.ownerDecision?.authorizedBy === null &&
        authorization.ownerDecision?.exactAuthorizationPhrase === null &&
        authorization.ownerDecision?.exactSpendingCapPhrase === null,
      "Locked Architecture V2 owner-decision fields must remain null."
    );
    assert(
      packageCommit === null && execution.executionCommit === null &&
        authorization.networkOrModelCallAuthorized === false,
      "Locked Architecture V2 may not name an execution or authorize a provider call."
    );
  } else {
    assert(
      /^[0-9a-f]{40}$/i.test(packageCommit || ""),
      "An active Architecture V2 authorization must name the exact package commit."
    );
    assert(
      authorization.scope?.caseCount === 30 &&
        authorization.scope?.repetitions === 1 &&
        authorization.scope?.maximumCumulativeSpendUSD === 5,
      "Architecture V2 authorization must retain the 30-case, one-repetition, $5 scope."
    );
    const exactPhrase =
      `authorize exactly package commit ${packageCommit} for all 30 ordered cases, ` +
      "one repetition, with a maximum cumulative API spend of $5.";
    assert(
      authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
        authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase,
      "Architecture V2 authorization must retain the exact owner package and spend-cap sentence."
    );
    assert(
      authorization.networkOrModelCallAuthorized === true,
      "Only the exact active owner authorization may permit a provider call."
    );
  }
  if (authorization.status === "authorized") {
    assert(
      execution.executionCommit === null &&
        authorization.consumption?.status === "not_started" &&
        authorization.consumption?.attemptID === null &&
        authorization.consumption?.runID === null,
      "Authorized Architecture V2 execution must not retain a prior attempt."
    );
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(
      typeof authorization.consumption?.attemptID === "string" &&
        authorization.consumption.attemptID.length > 0 &&
        typeof authorization.consumption?.startedAt === "string" &&
        authorization.consumption.startedAt.length > 0 &&
        /^[0-9a-f]{40}$/i.test(execution.executionCommit || ""),
      "Architecture V2 execution must retain its durable attempt and execution commit."
    );
  }
  if (authorization.status === "consumed") {
    assert(
      sha256(authorizationText) ===
        zoningArchitectureV2ConfirmationConsumedAuthorizationSHA256,
      "The consumed Architecture V2 authorization changed."
    );
    assert(
      authorization.consumption?.status === "consumed" &&
        authorization.consumption?.attemptID === zoningArchitectureV2ConfirmationRunID &&
        authorization.consumption?.runID === zoningArchitectureV2ConfirmationRunID &&
        typeof authorization.consumption?.consumedAt === "string" &&
        execution.executionCommit === zoningArchitectureV2ConfirmationExecutionCommit,
      "The consumed Architecture V2 authorization lost its exact run identity."
    );
    assert(
      result.configuration?.runID === zoningArchitectureV2ConfirmationRunID &&
        result.configuration?.gitCommit === zoningArchitectureV2ConfirmationExecutionCommit &&
        result.status === "partial" &&
        result.configuration?.repeat === 1 &&
        result.configuration?.caseIDs?.length === 30 &&
        result.results?.length === 30,
      "The retained Architecture V2 result lost its exact execution scope."
    );
    assert(
      result.configuration.caseIDs.every(
        (caseID, index) => result.results[index]?.testCase?.id === caseID
      ),
      "The retained Architecture V2 result is not in the authorized cohort order."
    );
    assert(
      result.configuration?.approvedSpendCapUSD === 5 &&
        result.configuration?.actualUSD === 1.519425 &&
        result.configuration?.conservativeReservedUSD === 1.659459 &&
        result.configuration?.paidRequestCount === 66 &&
        result.configuration?.pendingPaidRequestCount === 1 &&
        result.configuration.conservativeReservedUSD <=
          result.configuration.approvedSpendCapUSD,
      "The retained Architecture V2 result lost its fail-closed cost ledger."
    );
    const completed = result.results.filter(
      (entry) => entry.operationMetric?.status === "completed"
    );
    const failed = result.results.filter(
      (entry) => entry.operationMetric?.status === "failed"
    );
    const rejected = result.results.filter(
      (entry) => entry.operationMetric?.status === "rejected"
    );
    const productionUSD = result.results.reduce(
      (total, entry) => total + (entry.operationMetric?.actualProviderCostUSD || 0),
      0
    );
    const judgeUSD = result.results.reduce(
      (total, entry) => total + (entry.judge?.estimatedCost?.estimatedUSD || 0),
      0
    );
    assert(
      completed.length === 21 &&
        completed.filter((entry) => entry.scoring?.passed === true).length === 16 &&
        completed.filter((entry) => entry.scoring?.overallScore === 4).length === 15 &&
        failed.length === 3 &&
        rejected.length === 6,
      "The retained Architecture V2 result changed its terminal outcome counts."
    );
    assert(
      Number(productionUSD.toFixed(6)) === 0.994388 &&
        Number(judgeUSD.toFixed(6)) === 0.525037 &&
        Number((productionUSD + judgeUSD).toFixed(6)) ===
          result.configuration.actualUSD &&
        Number((result.configuration.conservativeReservedUSD -
          result.configuration.actualUSD).toFixed(6)) === 0.140034,
      "The retained Architecture V2 Production, judge, and pending ledgers no longer reconcile."
    );
    assert(
      completed.every(
        (entry) => entry.operationMetric?.charged === true &&
          entry.operationMetric?.webSupportRequested === false &&
          entry.operationMetric?.pendingProviderRequestCount === 0
      ) &&
        failed.every(
          (entry) => entry.operationMetric?.failureCode === "RESEARCH_VERIFICATION_FAILED" &&
            entry.operationMetric?.charged === false &&
            entry.operationMetric?.providerRequestCount > 0 &&
            entry.operationMetric?.pendingProviderRequestCount === 0
        ) &&
        rejected.every(
          (entry) => entry.operationMetric?.failureCode ===
              "RESEARCH_ZONING_PREREQUISITES_REQUIRED" &&
            entry.operationMetric?.charged === false &&
            entry.operationMetric?.providerRequestCount === 0 &&
            entry.operationMetric?.pendingProviderRequestCount === 0
        ),
      "The retained Architecture V2 fail-closed outcomes changed."
    );
    assert(
      result.economics?.sample?.sampleReady === true &&
        result.economics?.economics?.projectedCostPer100TurnsUSD === 4.74 &&
        result.economics?.economics?.targetBand === "within" &&
        result.economics?.charging?.integrityPass === true,
      "The retained Architecture V2 measured economics changed."
    );
  }

  const active =
    authorization.status === "authorized" &&
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

export function requireActiveZoningArchitectureV2ConfirmationPaidAuthorization(validation) {
  if (validation?.active) return validation;
  const error = new Error(
    "Zoning Architecture V2 requires the exact locked-package authorization sentence and cumulative spend cap before any provider request."
  );
  error.code = "ZONING_ARCHITECTURE_V2_AUTHORIZATION_REQUIRED";
  throw error;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningArchitectureV2ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningArchitectureV2ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning Architecture V2 confirmation authorization guard passed", {
    status: validation.authorization.status,
    active: validation.active,
    cohortCases: validation.cohort.cases.length,
    readyCases: validation.preflight.summary.readyCaseCount,
    productionAdverseUSDPerHundred:
      validation.preflight.summary.productionCost.adverseUSDPerHundredCompleted,
    judgeUSDPerHundred:
      validation.preflight.summary.judgeCost.adverseUSD,
    networkOrModelCallAuthorized:
      validation.authorization.networkOrModelCallAuthorized
  });
}
