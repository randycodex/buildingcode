import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "research-product-example-confirmation-paid-authorization.json"
);

export const researchProductExampleConfirmationAuthorizationID =
  "2ae2f240-6c7d-43ac-b893-d15dafbf0d55";
export const researchProductExampleConfirmationLockedAuthorizationSHA256 =
  "868f9223e5565c40a600af8f010cc0b68a7c9fab974d42211211c80bf6f8c689";
export const researchProductExampleConfirmationPreparedFromCommit =
  "32b83a69b14fe1910643e8781f4796fe87fc6f71";
export const researchProductExampleConfirmationMaximumSpendUSD = 2;

const expectedFiles = Object.freeze({
  "app.mjs": "82dd78f875c1f56f115dd23cb6ae46189c69ff8586f2b84a1524f6a1f3690c44",
  "research-answer-presentation.mjs":
    "19496df94960d3676cf3304769461a49e11ce155ea40f3aadca8a668aefce248",
  "research-corpus-registry.mjs":
    "1e3dbf3c072723dffa79326a0c13e08c52fca6ed09469f2fc9e27b208ae96443",
  "evals/research-product-example-cases.json":
    "39cbbe5b6d88254e585003576212f4d4227cca28f1ac4bc14c98007490f96d97",
  "evals/results/research-product-example-confirmation-no-cost-preflight.json":
    "08f45c335ccc8452b41286c2c67337601d0badad487fe9c081daae8401635968",
  "scripts/preflight-research-product-example-confirmation.mjs":
    "e827585b6934a9ec9e9639409672a942be28d27fbc96f35bdce3ae99fb277d46",
  "scripts/run-research-product-example-confirmation.mjs":
    "a2dc213c4a898bafd6c898a1b5fa56eb30ad5cf39a9ab104bab28e1171b6be33",
  "tests/research-product-example-acceptance-contract.mjs":
    "af5a736b6c8ca128679573b96327b187480c01c357fed8ebcb1370b4090e1c19"
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
      `The owner-example confirmation input changed: ${relativePath}.`
    );
  }
}

export async function validateResearchProductExampleConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [authorizationText, fixtureText, preflightText] = await Promise.all([
    readFile(authorizationPath, "utf8"),
    readFile(join(evalRoot, "research-product-example-cases.json"), "utf8"),
    readFile(
      join(
        evalRoot,
        "results",
        "research-product-example-confirmation-no-cost-preflight.json"
      ),
      "utf8"
    )
  ]);
  const authorization = JSON.parse(authorizationText);
  const fixture = JSON.parse(fixtureText);
  const preflight = JSON.parse(preflightText);
  await validateBoundFiles();

  assert(
    authorization.authorizationID === researchProductExampleConfirmationAuthorizationID,
    "The owner-example confirmation has the wrong authorization identity."
  );
  assert(
    authorization.cohort?.sha256 === sha256(fixtureText) &&
      authorization.cohort.sha256 === expectedFiles["evals/research-product-example-cases.json"],
    "The owner-example confirmation is not bound to the frozen benchmark."
  );
  assert(
    authorization.cohort?.conversationCount === 7 &&
      authorization.cohort?.orderedTurnCount === 9 &&
      authorization.cohort?.ordered === true &&
      fixture.cases?.length === 7 &&
      fixture.cases.reduce((sum, item) => sum + item.turns.length, 0) === 9,
    "The owner-example confirmation must retain seven conversations and nine ordered turns."
  );
  assert(
    preflight.pass === true &&
      preflight.scope?.conversationCount === 7 &&
      preflight.scope?.orderedTurnCount === 9 &&
      preflight.scope?.repetitions === 1 &&
      preflight.scope?.separateJudgeRequests === 0 &&
      preflight.safety?.networkAttempts === 0 &&
      preflight.safety?.paidProviderCalls === 0 &&
      preflight.safety?.productionWrites === 0,
    "The retained owner-example no-cost preflight is not fully green."
  );
  assert(
    authorization.lineage?.preparedFromCommit ===
      researchProductExampleConfirmationPreparedFromCommit &&
      authorization.lineage?.presentationVersion ===
        "20260902-product-example-contract-v1" &&
      authorization.lineage?.appSHA256 === expectedFiles["app.mjs"] &&
      authorization.lineage?.answerPresentationSHA256 ===
        expectedFiles["research-answer-presentation.mjs"] &&
      authorization.lineage?.corpusRegistrySHA256 ===
        expectedFiles["research-corpus-registry.mjs"] &&
      authorization.lineage?.acceptanceContractSHA256 ===
        expectedFiles["tests/research-product-example-acceptance-contract.mjs"] &&
      authorization.lineage?.noCostPreflightSHA256 ===
        expectedFiles["evals/results/research-product-example-confirmation-no-cost-preflight.json"] &&
      authorization.lineage?.preflightRunnerSHA256 ===
        expectedFiles["scripts/preflight-research-product-example-confirmation.mjs"] &&
      authorization.lineage?.paidRunnerSHA256 ===
        expectedFiles["scripts/run-research-product-example-confirmation.mjs"],
    "The owner-example confirmation lost a reviewed implementation or preflight input."
  );
  assert(
    authorization.plannedScope?.conversationCount === 7 &&
      authorization.plannedScope?.orderedTurnCount === 9 &&
      authorization.plannedScope?.repetitions === 1 &&
      authorization.plannedScope?.maximumCumulativeSpendUSD ===
        researchProductExampleConfirmationMaximumSpendUSD &&
      authorization.plannedScope?.separateJudgeRequests === 0,
    "The owner-example confirmation changed its planned live scope."
  );
  assert(
    authorization.execution?.webSupportEnabled === false &&
      authorization.execution?.automaticEnactedCorpusRetrieval === true &&
      authorization.execution?.conversationFollowUpsPreserved === true &&
      authorization.execution?.separateJudgeRequests === 0 &&
      authorization.execution?.maximumConversations === 7 &&
      authorization.execution?.maximumOrderedTurns === 9 &&
      authorization.execution?.maximumRepetitions === 1 &&
      authorization.execution?.continueAfterSettledUnchargedFailure === true &&
      authorization.execution?.stopOnSpendCapProviderOrTelemetryFailure === true,
    "The owner-example confirmation changed its reviewed execution policy."
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
      `The owner-example confirmation may not authorize ${field}.`
    );
  }

  assert(
    ["locked", "authorized", "running", "consumed"].includes(authorization.status),
    "The owner-example confirmation has an unsupported status."
  );
  if (authorization.status === "locked") {
    assert(
      sha256(authorizationText) ===
        researchProductExampleConfirmationLockedAuthorizationSHA256,
      "The locked owner-example confirmation authorization changed."
    );
    assert(
      authorization.scope?.conversationCount === null &&
        authorization.scope?.orderedTurnCount === null &&
        authorization.scope?.repetitions === null &&
        authorization.scope?.maximumCumulativeSpendUSD === null,
      "Locked owner-example scope fields must remain null."
    );
    assert(
      authorization.ownerDecision?.authorizedAt === null &&
        authorization.ownerDecision?.authorizedBy === null &&
        authorization.ownerDecision?.exactAuthorizationPhrase === null &&
        authorization.ownerDecision?.exactSpendingCapPhrase === null,
      "Locked owner-example owner-decision fields must remain null."
    );
    assert(
      authorization.execution?.authorizationPackageCommit === null &&
        authorization.execution?.executionCommit === null &&
        authorization.networkOrModelCallAuthorized === false,
      "Locked owner-example confirmation may not authorize provider access."
    );
  } else {
    const packageCommit = authorization.execution?.authorizationPackageCommit;
    const exactPhrase =
      `authorize exactly package commit ${packageCommit} for all 9 ordered turns ` +
      "in 7 conversations, one repetition, with a maximum cumulative API spend of $2.";
    assert(
      /^[0-9a-f]{40}$/i.test(packageCommit || "") &&
        authorization.scope?.conversationCount === 7 &&
        authorization.scope?.orderedTurnCount === 9 &&
        authorization.scope?.repetitions === 1 &&
        authorization.scope?.maximumCumulativeSpendUSD ===
          researchProductExampleConfirmationMaximumSpendUSD,
      "Active owner-example confirmation must retain the exact seven-conversation, nine-turn, one-repetition, $2 scope."
    );
    assert(
      authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
        authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase &&
        authorization.networkOrModelCallAuthorized === true,
      "Active owner-example confirmation must retain the exact package-bound owner sentence."
    );
    if (authorization.status === "authorized") {
      assert(
        authorization.execution?.executionCommit === null &&
          authorization.consumption?.status === "not_started" &&
          authorization.consumption?.attemptID === null &&
          authorization.consumption?.runID === null,
        "A fresh owner-example authorization must let the runner record the immutable execution commit."
      );
    } else {
      assert(
        /^[0-9a-f]{40}$/i.test(authorization.execution?.executionCommit || ""),
        "A running or consumed owner-example confirmation must retain its execution commit."
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

export function requireActiveResearchProductExampleConfirmationPaidAuthorization(validation) {
  const authorization = validation?.authorization;
  assert(
    authorization?.status === "authorized",
    "The owner-example live confirmation is locked and no provider call is authorized."
  );
  assert(
    authorization.networkOrModelCallAuthorized === true,
    "The owner-example live confirmation does not authorize provider access."
  );
  assert(
    authorization.consumption?.status === "not_started" &&
      authorization.consumption?.attemptID === null &&
      authorization.consumption?.runID === null,
    "The owner-example live confirmation authorization is already attempted or consumed."
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
