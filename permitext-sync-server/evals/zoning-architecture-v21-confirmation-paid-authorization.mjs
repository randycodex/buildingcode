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
  "zoning-architecture-v21-confirmation-paid-authorization.json"
);
const cohortPath = join(
  evalRoot,
  "zoning-cases-expanded-batch-1-successor-remediation-3.json"
);
const preflightPath = join(
  evalRoot,
  "results",
  "zoning-architecture-v21-no-cost-preflight.json"
);
const priorAuthorizationPath = join(
  evalRoot,
  "zoning-architecture-v2-confirmation-paid-authorization.json"
);
const priorResultPath = join(
  evalRoot,
  "results",
  "2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json"
);

export const zoningArchitectureV21ConfirmationAuthorizationID =
  "1dd05bd4-a98d-4b44-8de5-f0e2a79b890f";
export const zoningArchitectureV21ConfirmationLockedAuthorizationSHA256 =
  "3799b837f47e81732bbdfe832aada98b582d2cead78660b345c56d9ae441437f";
export const zoningArchitectureV21ConfirmationConsumedAuthorizationSHA256 =
  "932db83353b6770cdb791a93628b970d0073bb89587b262c1ec9a0a1c2ff47d4";
export const zoningArchitectureV21ConfirmationResultJSONFile =
  "results/2026-09-01T21-37-38-497Z-06e55e77-4419-4732-b7ca-825afabc3bc2.json";
export const zoningArchitectureV21ConfirmationResultJSONSHA256 =
  "ac389904942b84b13a0934a6ea40cc46079de402f19ab1f0199491c093b1c9d6";
export const zoningArchitectureV21ConfirmationResultMarkdownFile =
  "results/2026-09-01T21-37-38-497Z-06e55e77-4419-4732-b7ca-825afabc3bc2.md";
export const zoningArchitectureV21ConfirmationResultMarkdownSHA256 =
  "898b9c7e2a29685ea28220c79c7595e66542b4bcaf00d615c433ad0001a72323";
export const zoningArchitectureV21ConfirmationRunID =
  "06e55e77-4419-4732-b7ca-825afabc3bc2";
export const zoningArchitectureV21ConfirmationExecutionCommit =
  "a1162d426fa77ee9036530296e3dd61a9efc6328";
export const zoningArchitectureV21ConfirmationCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
export const zoningArchitectureV21ConfirmationPreparedFromCommit =
  "d35a8cba80077f24da9ed945ae30e5c84ededc62";
export const zoningArchitectureV21ConfirmationAppSHA256 =
  "dadd566fa0c916365c05725f6e819cc935f0f174aa21e21ac7dc5c1f16828074";
export const zoningArchitectureV21ConfirmationSafetySHA256 =
  "e0c5f298e9cfbeaed9ed6d084df30b77643f29f011cfe5f309a0fb59a11277df";
export const zoningArchitectureV21ConfirmationEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
export const zoningArchitectureV21ConfirmationRunnerHandoffSHA256 =
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327";
export const zoningArchitectureV21ConfirmationPaidRunnerSHA256 =
  "13f8acdd40ca79d563ea51382a451339122c611b5c246d90a1913e0a204b8985";
export const zoningArchitectureV21ConfirmationEvaluationHarnessSHA256 =
  "938f617de16aa2283ac8b0476454c6493932946463c9eb8fcb2e56946acfe4c6";

const expectedFiles = Object.freeze({
  "evals/results/zoning-architecture-v21-no-cost-preflight.json":
    "5501d15f40567a824a2f9efa10dd469703f358969c7eb10ae6507352cb47f4f2",
  "evals/zoning-architecture-v21-regression-fixtures.json":
    "d53e11f8e7955822775b5c4e681694b2e753804a2ca6d4d3dd2ccbcd723f3f8c",
  "research-zoning-planner.mjs":
    "cafa083e33d5c2706cf6eb683e09a3796132fda7b2bb834f5de95bb9b1b0e099",
  "research-model-routing.mjs":
    "c10f4be6bf5249868744a4794997008d6d5548811672f7da1a6b0101836ae634",
  "research-evidence-assembly.mjs":
    "a5f094303fd72fb011ea858d5539b2cf4ff2f60b8e84d291c606156b453cdcb1",
  "research-zoning-safety.mjs": zoningArchitectureV21ConfirmationSafetySHA256,
  "app.mjs": zoningArchitectureV21ConfirmationAppSHA256,
  "research-economics.mjs": zoningArchitectureV21ConfirmationEconomicsSHA256,
  "evals/zoning-v11-paid-runner-handoff.mjs":
    zoningArchitectureV21ConfirmationRunnerHandoffSHA256,
  "scripts/run-zoning-successor.mjs":
    zoningArchitectureV21ConfirmationPaidRunnerSHA256,
  "tests/research-evals.mjs":
    zoningArchitectureV21ConfirmationEvaluationHarnessSHA256,
  "scripts/preflight-zoning-architecture-v2.mjs":
    "191057d00cf281778ca28d6172f26c860420d13693b2d49c3edb4871bc301d6e",
  "tests/research-zoning-architecture-v2-contract.mjs":
    "21ea3cb67641fd3f59c64f7462252a87637153f32ea3fabf64eaafc24434841a",
  "tests/research-zoning-architecture-v21-regressions.mjs":
    "29f3a8245ef3ad35b73cf957aea05d58ea86413be0bdd364c2192f268370774a",
  "evals/zoning-architecture-v2-confirmation-paid-authorization.json":
    "275dbe7be87b74a02fc6ab2c7b99b48efbaf339a57984bbabc427a2c0376ea42",
  "evals/results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json":
    "06af0893b2dc201f12c48a405accaf5b6262f72aeaa67014013de89c7b9ece44",
  [`evals/${zoningArchitectureV21ConfirmationResultJSONFile}`]:
    zoningArchitectureV21ConfirmationResultJSONSHA256,
  [`evals/${zoningArchitectureV21ConfirmationResultMarkdownFile}`]:
    zoningArchitectureV21ConfirmationResultMarkdownSHA256
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
      ["show", `${zoningArchitectureV21ConfirmationExecutionCommit}:${historicalPath}`],
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
      `The locked Architecture V2.1 input changed: ${relativePath}.`
    );
  }
}

export async function validateZoningArchitectureV21ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [
    authorizationText,
    cohortText,
    preflightText,
    priorAuthorizationText,
    priorResultText,
    resultText
  ] = await Promise.all([
    readFile(authorizationPath, "utf8"),
    readFile(cohortPath, "utf8"),
    readFile(preflightPath, "utf8"),
    readFile(priorAuthorizationPath, "utf8"),
    readFile(priorResultPath, "utf8"),
    readFile(join(evalRoot, zoningArchitectureV21ConfirmationResultJSONFile), "utf8")
  ]);
  const authorization = JSON.parse(authorizationText);
  const cohort = JSON.parse(cohortText);
  const preflight = JSON.parse(preflightText);
  const priorAuthorization = JSON.parse(priorAuthorizationText);
  const priorResult = JSON.parse(priorResultText);
  const result = JSON.parse(resultText);
  await validateBoundFiles();

  assert(
    authorization.authorizationID === zoningArchitectureV21ConfirmationAuthorizationID,
    "The Architecture V2.1 confirmation has the wrong authorization identity."
  );
  assert(
    authorization.cohort?.sha256 === zoningArchitectureV21ConfirmationCohortSHA256 &&
      sha256(cohortText) === zoningArchitectureV21ConfirmationCohortSHA256,
    "The Architecture V2.1 confirmation is not bound to the frozen cohort."
  );
  assert(
    authorization.cohort?.file ===
      "zoning-cases-expanded-batch-1-successor-remediation-3.json" &&
    authorization.cohort?.caseCount === 30 &&
      authorization.cohort?.ordered === true &&
      cohort.cases?.length === 30,
    "The Architecture V2.1 confirmation must retain all 30 ordered cases."
  );
  assert(
    authorization.plannedScope?.caseCount === 30 &&
      authorization.plannedScope?.repetitions === 1 &&
      authorization.plannedScope?.maximumCumulativeSpendUSD === 5,
    "The Architecture V2.1 planned confirmation scope changed."
  );
  assert(
    preflight.plannerVersion === "20260901-question-compiler-v2" &&
      preflight.compilerVersion === "20260901-answer-obligations-v21" &&
      preflight.summary?.pass === true &&
      Object.values(preflight.aggregateGates || {}).every(Boolean) &&
      preflight.summary?.readyCaseCount === 24 &&
      preflight.summary?.zeroModelBoundaryCount === 6,
    "The locked Architecture V2.1 no-cost preflight is not fully green."
  );
  assert(
    preflight.summary?.productionCost?.nominalUSDPerHundredCompleted <= 6 &&
      preflight.summary?.productionCost?.adverseUSDPerHundredCompleted <= 6 &&
      preflight.summary?.judgeCost?.requestCount === 0 &&
      preflight.summary?.judgeCost?.nominalUSD === 0 &&
      preflight.summary?.judgeCost?.adverseUSD === 0,
    "The Architecture V2.1 no-cost cost gate or separate zero judge ledger changed."
  );
  assert(
    preflight.summary?.providerRequests?.nominalP90 <= 2 &&
      preflight.summary?.providerRequests?.adverseMaximum <= 3,
    "The Architecture V2.1 logical-stage projection changed."
  );
  assert(
    preflight.retainedV2Confirmation?.answerReplay?.preservedFullScoreIDs?.length === 16 &&
      preflight.retainedV2Confirmation?.answerReplay?.rejectedKnownJudgeFailureIDs?.length === 5 &&
      preflight.observedFailureRegressions?.caseCount === 8 &&
      preflight.observedFailureRegressions?.rubricsModified === false,
    "The Architecture V2.1 retained-answer or observed-failure regression gate changed."
  );
  assert(
    preflight.noCostInstrumentation?.providerDispatchPath === "not_imported" &&
      preflight.noCostInstrumentation?.networkAttemptCount === 0 &&
      preflight.noCostInstrumentation?.credentialVariablesPresent?.length === 0,
    "The Architecture V2.1 no-cost package lost its static no-dispatch guarantee."
  );
  assert(
    priorAuthorization.authorizationID === "7b58a481-a900-4be1-9cf5-1d26e5fda78b" &&
      priorAuthorization.status === "consumed" &&
      priorAuthorization.consumption?.runID === "9f67f4ba-3944-46a4-b438-fcec082144e3" &&
      sha256(priorAuthorizationText) ===
        "275dbe7be87b74a02fc6ab2c7b99b48efbaf339a57984bbabc427a2c0376ea42" &&
      priorResult.configuration?.runID === "9f67f4ba-3944-46a4-b438-fcec082144e3" &&
      sha256(priorResultText) ===
        "06af0893b2dc201f12c48a405accaf5b6262f72aeaa67014013de89c7b9ece44",
    "The Architecture V2.1 package lost its consumed V2 diagnostic lineage."
  );
  assert(
    authorization.lineage?.preparedFromCommit ===
      zoningArchitectureV21ConfirmationPreparedFromCommit &&
      authorization.lineage?.plannerVersion === "20260901-question-compiler-v2" &&
      authorization.lineage?.compilerVersion === "20260901-answer-obligations-v21" &&
      authorization.lineage?.repairVersion === "20260901-source-bounded-patch-v2" &&
      authorization.lineage?.plannerSHA256 ===
        expectedFiles["research-zoning-planner.mjs"] &&
      authorization.lineage?.routingSHA256 ===
        expectedFiles["research-model-routing.mjs"] &&
      authorization.lineage?.appSHA256 === zoningArchitectureV21ConfirmationAppSHA256 &&
      authorization.lineage?.zoningSafetySHA256 ===
        zoningArchitectureV21ConfirmationSafetySHA256 &&
      authorization.lineage?.researchEconomicsSHA256 ===
        zoningArchitectureV21ConfirmationEconomicsSHA256 &&
      authorization.lineage?.runnerHandoffSHA256 ===
        zoningArchitectureV21ConfirmationRunnerHandoffSHA256 &&
      authorization.lineage?.runnerHandoffProtocol ===
        "permitext-zoning-v11-runner-handoff-v1" &&
      authorization.lineage?.paidRunnerSHA256 ===
        zoningArchitectureV21ConfirmationPaidRunnerSHA256 &&
      authorization.lineage?.evaluationHarnessSHA256 ===
        zoningArchitectureV21ConfirmationEvaluationHarnessSHA256 &&
      authorization.lineage?.noCostPreflightSHA256 ===
        expectedFiles["evals/results/zoning-architecture-v21-no-cost-preflight.json"] &&
      authorization.lineage?.regressionFixturesSHA256 ===
        expectedFiles["evals/zoning-architecture-v21-regression-fixtures.json"] &&
      authorization.lineage?.regressionContractSHA256 ===
        expectedFiles["tests/research-zoning-architecture-v21-regressions.mjs"],
    "The Architecture V2.1 package lost a pinned implementation, regression, or runner input."
  );
  assert(
    authorization.lineage?.priorArchitectureV2AuthorizationID ===
      "7b58a481-a900-4be1-9cf5-1d26e5fda78b" &&
      authorization.lineage?.priorArchitectureV2RunID ===
        "9f67f4ba-3944-46a4-b438-fcec082144e3" &&
      authorization.lineage?.priorArchitectureV2ResultSHA256 ===
        "06af0893b2dc201f12c48a405accaf5b6262f72aeaa67014013de89c7b9ece44" &&
      authorization.lineage?.priorArchitectureV2ConsumedAuthorizationSHA256 ===
        "275dbe7be87b74a02fc6ab2c7b99b48efbaf339a57984bbabc427a2c0376ea42",
    "The Architecture V2.1 package lost its declared V2 lineage."
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
    "The Architecture V2.1 confirmation changed its reviewed execution policy."
  );
  assert(
    JSON.stringify(execution.allowedContinuationFailureCodes) ===
      JSON.stringify([
        "RESEARCH_VERIFICATION_FAILED",
        "RESEARCH_ZONING_PREREQUISITES_REQUIRED",
        "RESEARCH_ZONING_EVIDENCE_REQUIRED",
        "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED"
      ]),
    "The Architecture V2.1 confirmation changed its continuation allowlist."
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
      `The Architecture V2.1 confirmation may not authorize ${field}.`
    );
  }

  const allowedStatuses = new Set(["locked", "authorized", "running", "consumed"]);
  assert(
    allowedStatuses.has(authorization.status),
    "The Architecture V2.1 confirmation has an unsupported status."
  );
  const packageCommit = execution.authorizationPackageCommit;
  if (authorization.status === "locked") {
    assert(
      sha256(authorizationText) ===
        zoningArchitectureV21ConfirmationLockedAuthorizationSHA256,
      "The locked Architecture V2.1 authorization changed."
    );
    assert(
      authorization.scope?.caseCount === null &&
        authorization.scope?.repetitions === null &&
        authorization.scope?.maximumCumulativeSpendUSD === null,
      "Locked Architecture V2.1 scope fields must remain null."
    );
    assert(
      authorization.ownerDecision?.authorizedAt === null &&
        authorization.ownerDecision?.authorizedBy === null &&
        authorization.ownerDecision?.exactAuthorizationPhrase === null &&
        authorization.ownerDecision?.exactSpendingCapPhrase === null,
      "Locked Architecture V2.1 owner-decision fields must remain null."
    );
    assert(
      authorization.consumption?.status === "not_started" &&
        authorization.consumption?.attemptID === null &&
        authorization.consumption?.startedAt === null &&
        authorization.consumption?.runID === null &&
        authorization.consumption?.consumedAt === null &&
      packageCommit === null && execution.executionCommit === null &&
        authorization.networkOrModelCallAuthorized === false,
      "Locked Architecture V2.1 may not name an execution or authorize a provider call."
    );
  } else {
    assert(
      /^[0-9a-f]{40}$/i.test(packageCommit || ""),
      "An active Architecture V2.1 authorization must name the exact package commit."
    );
    assert(
      authorization.scope?.caseCount === 30 &&
        authorization.scope?.repetitions === 1 &&
        authorization.scope?.maximumCumulativeSpendUSD === 5,
      "Architecture V2.1 authorization must retain the 30-case, one-repetition, $5 scope."
    );
    const exactPhrase =
      `authorize exactly package commit ${packageCommit} for all 30 ordered cases, ` +
      "one repetition, with a maximum cumulative API spend of $5.";
    assert(
      authorization.ownerDecision?.required === true &&
        typeof authorization.ownerDecision?.authorizedAt === "string" &&
        authorization.ownerDecision.authorizedAt.length > 0 &&
        authorization.ownerDecision?.authorizedBy === "Permitext owner" &&
      authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
        authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase,
      "Architecture V2.1 authorization must retain the exact owner package and spend-cap sentence."
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
      "Authorized Architecture V2.1 execution must not retain a prior attempt."
    );
  }
  if (["running", "consumed"].includes(authorization.status)) {
    assert(
      typeof authorization.consumption?.attemptID === "string" &&
        authorization.consumption.attemptID.length > 0 &&
        typeof authorization.consumption?.startedAt === "string" &&
        authorization.consumption.startedAt.length > 0 &&
        /^[0-9a-f]{40}$/i.test(execution.executionCommit || ""),
      "Architecture V2.1 execution must retain its durable attempt and execution commit."
    );
  }
  if (authorization.status === "running") {
    assert(
      authorization.consumption?.status === "running" &&
        authorization.consumption?.runID === null &&
        authorization.consumption?.consumedAt === null,
      "Running Architecture V2.1 authorization must remain fail-closed and unconsumed."
    );
  }
  if (authorization.status === "consumed") {
    assert(
      sha256(authorizationText) ===
        zoningArchitectureV21ConfirmationConsumedAuthorizationSHA256,
      "The consumed Architecture V2.1 authorization changed."
    );
    assert(
      authorization.consumption?.status === "consumed" &&
        authorization.consumption?.attemptID === zoningArchitectureV21ConfirmationRunID &&
        authorization.consumption?.runID === zoningArchitectureV21ConfirmationRunID &&
        typeof authorization.consumption?.consumedAt === "string" &&
        execution.executionCommit === zoningArchitectureV21ConfirmationExecutionCommit,
      "The consumed Architecture V2.1 authorization lost its exact run identity."
    );
    assert(
      result.configuration?.runID === zoningArchitectureV21ConfirmationRunID &&
        result.configuration?.gitCommit === zoningArchitectureV21ConfirmationExecutionCommit &&
        result.status === "partial" &&
        result.configuration?.repeat === 1 &&
        result.configuration?.caseIDs?.length === 30 &&
        result.results?.length === 30 &&
        result.configuration.caseIDs.every(
          (caseID, index) => result.results[index]?.testCase?.id === caseID
        ),
      "The retained Architecture V2.1 result lost its exact execution scope or order."
    );
    assert(
      result.configuration?.approvedSpendCapUSD === 5 &&
        result.configuration?.actualUSD === 0.810632 &&
        result.configuration?.conservativeReservedUSD === 0.810632 &&
        result.configuration?.paidRequestCount === 42 &&
        result.configuration?.pendingPaidRequestCount === 0 &&
        result.configuration.actualUSD <= result.configuration.approvedSpendCapUSD,
      "The retained Architecture V2.1 result lost its settled cost ledger."
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
      completed.length === 13 &&
        completed.filter((entry) => entry.scoring?.passed === true).length === 12 &&
        completed.filter((entry) => entry.scoring?.overallScore === 4).length === 8 &&
        failed.length === 5 &&
        rejected.length === 12,
      "The retained Architecture V2.1 result changed its terminal outcome counts."
    );
    assert(
      Number(productionUSD.toFixed(6)) === 0.511598 &&
        Number(judgeUSD.toFixed(6)) === 0.299034 &&
        Number((productionUSD + judgeUSD).toFixed(6)) ===
          result.configuration.actualUSD,
      "The retained Architecture V2.1 Production and judge ledgers no longer reconcile."
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
          (entry) => [
            "RESEARCH_ZONING_PREREQUISITES_REQUIRED",
            "RESEARCH_ZONING_EVIDENCE_REQUIRED"
          ].includes(entry.operationMetric?.failureCode) &&
            entry.operationMetric?.charged === false &&
            entry.operationMetric?.providerRequestCount === 0 &&
            entry.operationMetric?.pendingProviderRequestCount === 0
        ),
      "The retained Architecture V2.1 fail-closed charging outcomes changed."
    );
    assert(
      result.economics?.sample?.completed === 13 &&
        result.economics?.sample?.sampleReady === false &&
        result.economics?.economics?.projectedCostPer100TurnsUSD === 3.94 &&
        result.economics?.economics?.targetBand === "below" &&
        result.economics?.routing?.verificationRevisionTurns === 2 &&
        result.economics?.charging?.integrityPass === true &&
        result.economics?.readyForPricingDecision === false,
      "The retained Architecture V2.1 reliability or economics result changed."
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
    priorAuthorization,
    priorResult,
    result,
    active,
    authorizationSHA256: sha256(authorizationText)
  };
}

export function requireActiveZoningArchitectureV21ConfirmationPaidAuthorization(validation) {
  if (validation?.active) return validation;
  const error = new Error(
    "Zoning Architecture V2.1 requires the exact locked-package authorization sentence and cumulative spend cap before any provider request."
  );
  error.code = "ZONING_ARCHITECTURE_V21_AUTHORIZATION_REQUIRED";
  throw error;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningArchitectureV21ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningArchitectureV21ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning Architecture V2.1 confirmation authorization guard passed", {
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
