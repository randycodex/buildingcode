import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "research-product-example-repaired-v2-confirmation-paid-authorization.json"
);
const previousAuthorizationPath = join(
  evalRoot,
  "research-product-example-repaired-confirmation-paid-authorization.json"
);
const previousResultPath = join(
  evalRoot,
  "results",
  "2026-09-02T16-56-49-594Z-fa52cca6-d28f-4d16-968a-0d8c06d596e9-product-example-repaired-confirmation.json"
);

export const researchProductExampleRepairedV2ConfirmationAuthorizationID =
  "1c44bd94-38cc-4d5f-874d-26260f696d4d";
export const researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256 =
  "a63ab7ca76d519448c19b295d55939a088909ab39ffe00c229d7e7dc9e73dfee";
export const researchProductExampleRepairedV2ConfirmationPreparedFromCommit =
  "dbc884a4fc6ad940359ecd49951b2b75bee044f2";
export const researchProductExampleRepairedV2ConfirmationMaximumSpendUSD = 2;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function exactAuthorizationPhrase(packageCommit) {
  return `authorize exactly package commit ${packageCommit} for all 9 ordered turns ` +
    "in 7 conversations, one repetition, with a maximum cumulative API spend of $2.";
}

async function validateBoundInputs(authorization) {
  for (const [relativePath, expectedHash] of Object.entries(
    authorization.lineage?.inputSHA256 || {}
  )) {
    const value = await readFile(join(serverRoot, relativePath));
    assert(
      /^[0-9a-f]{64}$/i.test(expectedHash) && sha256(value) === expectedHash,
      `The repaired-v2 owner-example confirmation input changed: ${relativePath}.`
    );
  }
}

export async function validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [authorizationText, fixtureText, preflightText, previousAuthorization, previousResultText] =
    await Promise.all([
      readFile(authorizationPath, "utf8"),
      readFile(join(evalRoot, "research-product-example-cases.json"), "utf8"),
      readFile(
        join(
          evalRoot,
          "results",
          "research-product-example-repaired-confirmation-no-cost-preflight.json"
        ),
        "utf8"
      ),
      readFile(previousAuthorizationPath),
      readFile(previousResultPath, "utf8")
    ]);
  const authorization = JSON.parse(authorizationText);
  const fixture = JSON.parse(fixtureText);
  const preflight = JSON.parse(preflightText);
  const previousResult = JSON.parse(previousResultText);

  if (authorizationPath === defaultAuthorizationPath && authorization.status !== "consumed") {
    await validateBoundInputs(authorization);
  }
  assert(
    authorization.authorizationID ===
      researchProductExampleRepairedV2ConfirmationAuthorizationID,
    "The repaired-v2 owner-example confirmation has the wrong authorization identity."
  );
  assert(
    authorization.lineage?.preparedFromCommit ===
      researchProductExampleRepairedV2ConfirmationPreparedFromCommit &&
      authorization.lineage?.runtimeEnvironmentVersion ===
        "20260902-isolated-spend-guardrails-v1",
    "The repaired-v2 package lost its reviewed repair lineage."
  );
  assert(
    sha256(previousAuthorization) === authorization.lineage?.previousAuthorizationSHA256 &&
      sha256(previousResultText) === authorization.lineage?.previousResultSHA256 &&
      previousResult.runID === authorization.lineage?.previousRunID &&
      previousResult.status === "failed" &&
      previousResult.scope?.completedTurnCount === 0 &&
      previousResult.spend?.actualUSD === 0 &&
      previousResult.spend?.reservedUSD === 0 &&
      previousResult.spend?.pendingRequestCount === 0,
    "The consumed zero-spend predecessor evidence changed."
  );
  assert(
    authorization.cohort?.sha256 === sha256(fixtureText) &&
      fixture.cases?.length === 7 &&
      fixture.cases.reduce((sum, item) => sum + item.turns.length, 0) === 9,
    "The repaired-v2 package is not bound to the seven-conversation, nine-turn cohort."
  );
  assert(
    preflight.pass === true &&
      preflight.scope?.conversationCount === 7 &&
      preflight.scope?.orderedTurnCount === 9 &&
      preflight.safety?.networkAttempts === 0 &&
      preflight.safety?.paidProviderCalls === 0 &&
      preflight.simulatedLiveSpendGuardrails?.passed === true &&
      preflight.simulatedLiveSpendGuardrails?.maximumRequestUSD === 1 &&
      preflight.simulatedLiveSpendGuardrails?.userMonthlyCapUSD === 2 &&
      preflight.simulatedLiveSpendGuardrails?.monthlyCapUSD === 2,
    "The repaired-v2 no-cost live-environment preflight is not fully green."
  );
  assert(
    authorization.plannedScope?.conversationCount === 7 &&
      authorization.plannedScope?.orderedTurnCount === 9 &&
      authorization.plannedScope?.repetitions === 1 &&
      authorization.plannedScope?.maximumCumulativeSpendUSD ===
        researchProductExampleRepairedV2ConfirmationMaximumSpendUSD &&
      authorization.plannedScope?.separateJudgeRequests === 0,
    "The repaired-v2 package changed its planned paid scope."
  );
  const execution = authorization.execution || {};
  assert(
    execution.webSupportEnabled === true &&
      execution.officialDomains?.includes("ny.gov") &&
      execution.officialDomains?.includes("ada.gov") &&
      execution.requiredOfficialSeedURLs?.includes(
        "https://omh.ny.gov/omhweb/policy_and_regulations/"
      ) &&
      execution.requiredOfficialSeedURLs?.includes("https://www.ada.gov/") &&
      execution.officialSupportingSourcesRemainNoncontrolling === true &&
      execution.automaticEnactedCorpusRetrieval === true &&
      execution.conversationFollowUpsPreserved === true &&
      execution.separateJudgeRequests === 0 &&
      execution.maximumConversations === 7 &&
      execution.maximumOrderedTurns === 9 &&
      execution.maximumRepetitions === 1 &&
      execution.maximumProviderRequestUSD === 1 &&
      execution.isolatedUserDailyCapUSD === 2 &&
      execution.isolatedUserMonthlyCapUSD === 2 &&
      execution.isolatedSystemDailyCapUSD === 2 &&
      execution.isolatedSystemMonthlyCapUSD === 2 &&
      execution.additionalTurnSalesEnabled === false &&
      execution.validateBothSpendControlLayersBeforeLock === true &&
      execution.continueAfterSettledUnchargedFailure === true &&
      execution.stopOnSpendCapProviderOrTelemetryFailure === true,
    "The repaired-v2 package changed its reviewed isolated execution policy."
  );
  for (const field of [
    "publicResearchReleaseAuthorized",
    "publicZoningResearchAuthorized",
    "professionalCodeDetermination",
    "deploymentAuthorized",
    "pricingOrAllowanceChangeAuthorized",
    "mergeOrPushAuthorized"
  ]) {
    assert(authorization[field] === false, `The repaired-v2 package may not authorize ${field}.`);
  }

  assert(
    ["locked", "authorized", "running", "consumed"].includes(authorization.status),
    "The repaired-v2 authorization has an unsupported status."
  );
  if (authorization.status === "locked") {
    assert(
      sha256(authorizationText) ===
        researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256,
      "The locked repaired-v2 authorization changed."
    );
    assert(
      Object.values(authorization.scope || {}).every((value) => value === null) &&
        authorization.ownerDecision?.authorizedAt === null &&
        authorization.ownerDecision?.authorizedBy === null &&
        authorization.ownerDecision?.exactAuthorizationPhrase === null &&
        authorization.ownerDecision?.exactSpendingCapPhrase === null &&
        authorization.execution?.authorizationPackageCommit === null &&
        authorization.execution?.executionCommit === null &&
        authorization.networkOrModelCallAuthorized === false,
      "The locked repaired-v2 authorization contains an active owner decision."
    );
  } else {
    const packageCommit = authorization.execution?.authorizationPackageCommit;
    const phrase = exactAuthorizationPhrase(packageCommit);
    assert(
      /^[0-9a-f]{40}$/i.test(packageCommit || "") &&
        authorization.scope?.conversationCount === 7 &&
        authorization.scope?.orderedTurnCount === 9 &&
        authorization.scope?.repetitions === 1 &&
        authorization.scope?.maximumCumulativeSpendUSD === 2 &&
        authorization.ownerDecision?.exactAuthorizationPhrase === phrase &&
        authorization.ownerDecision?.exactSpendingCapPhrase === phrase &&
        authorization.networkOrModelCallAuthorized === true,
      "The active repaired-v2 authorization does not match the exact package-bound sentence."
    );
    if (authorization.status === "authorized") {
      assert(
        authorization.execution?.executionCommit === null &&
          authorization.consumption?.status === "not_started" &&
          authorization.consumption?.attemptID === null &&
          authorization.consumption?.runID === null,
        "A fresh repaired-v2 authorization must remain unattempted."
      );
    } else {
      assert(
        /^[0-9a-f]{40}$/i.test(authorization.execution?.executionCommit || ""),
        "A running or consumed repaired-v2 authorization must retain its execution commit."
      );
    }
  }
  return { authorization, authorizationSHA256: sha256(authorizationText), fixture, preflight };
}

export function requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization(
  validation
) {
  const authorization = validation?.authorization;
  assert(
    authorization?.status === "authorized",
    "The repaired-v2 owner-example live confirmation is locked and no provider call is authorized."
  );
  assert(
    authorization.networkOrModelCallAuthorized === true &&
      authorization.consumption?.status === "not_started" &&
      authorization.consumption?.attemptID === null &&
      authorization.consumption?.runID === null,
    "The repaired-v2 owner-example authorization is already attempted or consumed."
  );
  return {
    authorizationID: authorization.authorizationID,
    packageCommit: authorization.execution.authorizationPackageCommit,
    conversationCount: authorization.scope.conversationCount,
    orderedTurnCount: authorization.scope.orderedTurnCount,
    repetitions: authorization.scope.repetitions,
    maximumCumulativeSpendUSD: authorization.scope.maximumCumulativeSpendUSD
  };
}
