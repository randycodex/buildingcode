import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "research-product-example-repaired-confirmation-paid-authorization.json"
);
const historicalAuthorizationPath = join(
  evalRoot,
  "research-product-example-confirmation-paid-authorization.json"
);

export const researchProductExampleRepairedConfirmationAuthorizationID =
  "fcbb0ba5-2148-4c33-84e2-43b76852f9a3";
export const researchProductExampleRepairedConfirmationLockedAuthorizationSHA256 =
  "d1c0467c21e220f2d69e8f6d1f995cf71ad8bbae462f81d24ebd0a477d8e06b8";
export const researchProductExampleRepairedConfirmationPreparedFromCommit =
  "c1ea51e3b55aaa15be2639b0cdf14c3461b35b2e";
export const researchProductExampleRepairedConfirmationMaximumSpendUSD = 2;

const expectedFiles = Object.freeze({
  "app.mjs": "aec3c1390abcd170d04aff34185c74f1c561288e60621488cb70e86e6c8b17f7",
  "evidence-discovery.mjs":
    "890bff5fe06276b5f3c849de49e0826c8afeb6435c586402dd67c931fcf4ab91",
  "research-answer-presentation.mjs":
    "d52799dddf0a9ceb18aab2d7aa016de6cc684044234f659e7ac5adab74625ebc",
  "research-corpus-registry.mjs":
    "1e3dbf3c072723dffa79326a0c13e08c52fca6ed09469f2fc9e27b208ae96443",
  "research-source-policy.mjs":
    "1197b66fcc134a739980f9571ec3f3dc235a4bbf82f93d668793ceba7ce2bace",
  "evals/research-product-example-cases.json":
    "39cbbe5b6d88254e585003576212f4d4227cca28f1ac4bc14c98007490f96d97",
  "evals/research-product-example-confirmation-paid-authorization.json":
    "a22d6e028429174bf3bf99d7582ad0dc7b3b26c945bc53c2854ff03e80a7ec7a",
  "evals/results/research-product-example-repaired-confirmation-no-cost-preflight.json":
    "22865a7c4ee67af5da56f1d7b90fdf5c241341baa58990450744e1fd402f993f",
  "scripts/preflight-research-product-example-repaired-confirmation.mjs":
    "0671885e67a279594640eea3c00151a33a0c92ea1756acc0c9536dcf7564cf4f",
  "scripts/run-research-product-example-repaired-confirmation.mjs":
    "21f56e96c39e204c6b57c5d6a39e487a14e5106016bb3f413f4b84898177dcb0",
  "tests/research-product-example-acceptance-contract.mjs":
    "af5a736b6c8ca128679573b96327b187480c01c357fed8ebcb1370b4090e1c19",
  "tests/research-product-example-runtime-contract.mjs":
    "834e829d6aa4ec3434c2f808c13be2cafba950b848a0190d24379724c56382cd"
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
    assert(
      sha256(value) === expectedHash,
      `The repaired owner-example confirmation input changed: ${relativePath}.`
    );
  }
}

function exactAuthorizationPhrase(packageCommit) {
  return `authorize exactly package commit ${packageCommit} for all 9 ordered turns ` +
    "in 7 conversations, one repetition, with a maximum cumulative API spend of $2.";
}

export async function validateResearchProductExampleRepairedConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [authorizationText, fixtureText, preflightText, historicalAuthorization] =
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
      readFile(historicalAuthorizationPath)
    ]);
  const authorization = JSON.parse(authorizationText);
  const fixture = JSON.parse(fixtureText);
  const preflight = JSON.parse(preflightText);
  if (authorizationPath === defaultAuthorizationPath && authorization.status !== "consumed") {
    await validateBoundFiles();
  }

  assert(
    sha256(historicalAuthorization) ===
      expectedFiles["evals/research-product-example-confirmation-paid-authorization.json"],
    "The prior consumed owner-example authorization changed."
  );
  assert(
    authorization.authorizationID ===
      researchProductExampleRepairedConfirmationAuthorizationID,
    "The repaired owner-example confirmation has the wrong authorization identity."
  );
  assert(
    authorization.cohort?.sha256 === sha256(fixtureText) &&
      authorization.cohort.sha256 ===
        expectedFiles["evals/research-product-example-cases.json"],
    "The repaired owner-example confirmation is not bound to the frozen benchmark."
  );
  assert(
    authorization.cohort?.conversationCount === 7 &&
      authorization.cohort?.orderedTurnCount === 9 &&
      authorization.cohort?.ordered === true &&
      fixture.cases?.length === 7 &&
      fixture.cases.reduce((sum, item) => sum + item.turns.length, 0) === 9,
    "The repaired owner-example confirmation must retain seven conversations and nine ordered turns."
  );
  assert(
    preflight.pass === true &&
      preflight.scope?.conversationCount === 7 &&
      preflight.scope?.orderedTurnCount === 9 &&
      preflight.scope?.repetitions === 1 &&
      preflight.scope?.separateJudgeRequests === 0 &&
      preflight.scope?.liveWebSupportEnabledAfterAuthorizationOnly === true &&
      preflight.safety?.networkAttempts === 0 &&
      preflight.safety?.paidProviderCalls === 0 &&
      preflight.safety?.productionWrites === 0 &&
      preflight.runtimeRegression?.passed === true,
    "The retained repaired owner-example no-cost preflight is not fully green."
  );
  for (const domain of ["ny.gov", "ada.gov"]) {
    assert(
      preflight.supportingWeb?.officialDomains?.includes(domain),
      `The repaired preflight lost required official domain ${domain}.`
    );
  }
  for (const seedURL of [
    "https://omh.ny.gov/omhweb/policy_and_regulations/",
    "https://www.ada.gov/"
  ]) {
    assert(
      preflight.supportingWeb?.requiredSeedURLs?.includes(seedURL),
      `The repaired preflight lost official seed ${seedURL}.`
    );
  }

  const lineage = authorization.lineage || {};
  assert(
    lineage.preparedFromCommit ===
      researchProductExampleRepairedConfirmationPreparedFromCommit &&
      lineage.presentationVersion === "20260902-product-example-contract-v1" &&
      lineage.evidenceDiscoveryVersion === "20260902-official-source-seeds-v21" &&
      lineage.sourcePolicyVersion === "20260902-supporting-web-v12" &&
      lineage.appSHA256 === expectedFiles["app.mjs"] &&
      lineage.evidenceDiscoverySHA256 === expectedFiles["evidence-discovery.mjs"] &&
      lineage.answerPresentationSHA256 ===
        expectedFiles["research-answer-presentation.mjs"] &&
      lineage.corpusRegistrySHA256 === expectedFiles["research-corpus-registry.mjs"] &&
      lineage.sourcePolicySHA256 === expectedFiles["research-source-policy.mjs"] &&
      lineage.acceptanceContractSHA256 ===
        expectedFiles["tests/research-product-example-acceptance-contract.mjs"] &&
      lineage.runtimeContractSHA256 ===
        expectedFiles["tests/research-product-example-runtime-contract.mjs"] &&
      lineage.noCostPreflightSHA256 ===
        expectedFiles[
          "evals/results/research-product-example-repaired-confirmation-no-cost-preflight.json"
        ] &&
      lineage.preflightRunnerSHA256 ===
        expectedFiles["scripts/preflight-research-product-example-repaired-confirmation.mjs"] &&
      lineage.paidRunnerSHA256 ===
        expectedFiles["scripts/run-research-product-example-repaired-confirmation.mjs"] &&
      lineage.historicalConsumedAuthorizationSHA256 ===
        expectedFiles["evals/research-product-example-confirmation-paid-authorization.json"],
    "The repaired owner-example confirmation lost a reviewed implementation or preflight input."
  );
  assert(
    authorization.plannedScope?.conversationCount === 7 &&
      authorization.plannedScope?.orderedTurnCount === 9 &&
      authorization.plannedScope?.repetitions === 1 &&
      authorization.plannedScope?.maximumCumulativeSpendUSD ===
        researchProductExampleRepairedConfirmationMaximumSpendUSD &&
      authorization.plannedScope?.separateJudgeRequests === 0,
    "The repaired owner-example confirmation changed its planned live scope."
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
      execution.continueAfterSettledUnchargedFailure === true &&
      execution.stopOnSpendCapProviderOrTelemetryFailure === true,
    "The repaired owner-example confirmation changed its reviewed execution policy."
  );
  for (const field of [
    "publicResearchReleaseAuthorized",
    "publicZoningResearchAuthorized",
    "professionalCodeDetermination",
    "deploymentAuthorized",
    "pricingOrAllowanceChangeAuthorized",
    "mergeOrPushAuthorized"
  ]) {
    assert(
      authorization[field] === false,
      `The repaired owner-example confirmation may not authorize ${field}.`
    );
  }

  assert(
    ["locked", "authorized", "running", "consumed"].includes(authorization.status),
    "The repaired owner-example confirmation has an unsupported status."
  );
  if (authorization.status === "locked") {
    assert(
      sha256(authorizationText) ===
        researchProductExampleRepairedConfirmationLockedAuthorizationSHA256,
      "The locked repaired owner-example confirmation authorization changed."
    );
    assert(
      authorization.scope?.conversationCount === null &&
        authorization.scope?.orderedTurnCount === null &&
        authorization.scope?.repetitions === null &&
        authorization.scope?.maximumCumulativeSpendUSD === null,
      "Locked repaired owner-example scope fields must remain null."
    );
    assert(
      authorization.ownerDecision?.authorizedAt === null &&
        authorization.ownerDecision?.authorizedBy === null &&
        authorization.ownerDecision?.exactAuthorizationPhrase === null &&
        authorization.ownerDecision?.exactSpendingCapPhrase === null,
      "Locked repaired owner-example owner-decision fields must remain null."
    );
    assert(
      authorization.execution?.authorizationPackageCommit === null &&
        authorization.execution?.executionCommit === null &&
        authorization.networkOrModelCallAuthorized === false,
      "Locked repaired owner-example confirmation may not authorize provider access."
    );
  } else {
    const packageCommit = authorization.execution?.authorizationPackageCommit;
    const exactPhrase = exactAuthorizationPhrase(packageCommit);
    assert(
      /^[0-9a-f]{40}$/i.test(packageCommit || "") &&
        authorization.scope?.conversationCount === 7 &&
        authorization.scope?.orderedTurnCount === 9 &&
        authorization.scope?.repetitions === 1 &&
        authorization.scope?.maximumCumulativeSpendUSD ===
          researchProductExampleRepairedConfirmationMaximumSpendUSD,
      "Active repaired owner-example confirmation must retain the exact seven-conversation, nine-turn, one-repetition, $2 scope."
    );
    assert(
      authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
        authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase &&
        authorization.networkOrModelCallAuthorized === true,
      "Active repaired owner-example confirmation must retain the exact package-bound owner sentence."
    );
    if (authorization.status === "authorized") {
      assert(
        authorization.execution?.executionCommit === null &&
          authorization.consumption?.status === "not_started" &&
          authorization.consumption?.attemptID === null &&
          authorization.consumption?.runID === null,
        "A fresh repaired owner-example authorization must let the runner record the immutable execution commit."
      );
    } else {
      assert(
        /^[0-9a-f]{40}$/i.test(authorization.execution?.executionCommit || ""),
        "A running or consumed repaired confirmation must retain its execution commit."
      );
    }
  }
  return {
    authorization,
    authorizationSHA256: sha256(authorizationText),
    fixture,
    preflight
  };
}

export function requireActiveResearchProductExampleRepairedConfirmationPaidAuthorization(
  validation
) {
  const authorization = validation?.authorization;
  assert(
    authorization?.status === "authorized",
    "The repaired owner-example live confirmation is locked and no provider call is authorized."
  );
  assert(
    authorization.networkOrModelCallAuthorized === true,
    "The repaired owner-example live confirmation does not authorize provider access."
  );
  assert(
    authorization.consumption?.status === "not_started" &&
      authorization.consumption?.attemptID === null &&
      authorization.consumption?.runID === null,
    "The repaired owner-example live confirmation authorization is already attempted or consumed."
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
