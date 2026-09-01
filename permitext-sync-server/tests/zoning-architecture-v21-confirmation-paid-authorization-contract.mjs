import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  requireActiveZoningArchitectureV21ConfirmationPaidAuthorization,
  validateZoningArchitectureV21ConfirmationPaidAuthorization,
  zoningArchitectureV21ConfirmationAuthorizationID,
  zoningArchitectureV21ConfirmationCohortSHA256,
  zoningArchitectureV21ConfirmationConsumedAuthorizationSHA256,
  zoningArchitectureV21ConfirmationExecutionCommit,
  zoningArchitectureV21ConfirmationLockedAuthorizationSHA256,
  zoningArchitectureV21ConfirmationPreparedFromCommit,
  zoningArchitectureV21ConfirmationRunID
} from "../evals/zoning-architecture-v21-confirmation-paid-authorization.mjs";
import {
  zoningArchitectureV2ContinuableResult
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(serverRoot, "..");
const authorizationPath = join(
  serverRoot,
  "evals",
  "zoning-architecture-v21-confirmation-paid-authorization.json"
);
const authorizationText = await readFile(authorizationPath, "utf8");
const consumed = await validateZoningArchitectureV21ConfirmationPaidAuthorization();
const lockedPackage = spawnSync(
  "git",
  [
    "show",
    "0c5eda19a62b4873aebaf47ef015197a5d4f15e6:permitext-sync-server/evals/zoning-architecture-v21-confirmation-paid-authorization.json"
  ],
  { cwd: repositoryRoot, encoding: "utf8" }
);
assert.equal(lockedPackage.status, 0, lockedPackage.stderr);
const lockedText = lockedPackage.stdout;
const lockedFixture = JSON.parse(lockedText);

assert.equal(consumed.authorization.authorizationID,
  zoningArchitectureV21ConfirmationAuthorizationID);
assert.equal(consumed.authorizationSHA256,
  zoningArchitectureV21ConfirmationConsumedAuthorizationSHA256);
assert.equal(createHash("sha256").update(lockedText).digest("hex"),
  zoningArchitectureV21ConfirmationLockedAuthorizationSHA256);
assert.equal(createHash("sha256").update(authorizationText).digest("hex"),
  zoningArchitectureV21ConfirmationConsumedAuthorizationSHA256);
assert.equal(consumed.authorization.status, "consumed");
assert.equal(consumed.authorization.consumption.runID,
  zoningArchitectureV21ConfirmationRunID);
assert.equal(consumed.authorization.execution.executionCommit,
  zoningArchitectureV21ConfirmationExecutionCommit);
assert.equal(consumed.active, false);
assert.equal(consumed.result.results.length, 30);
assert.equal(consumed.result.configuration.actualUSD, 0.810632);
assert.equal(consumed.result.configuration.pendingPaidRequestCount, 0);
assert.equal(consumed.result.economics.sample.completed, 13);
assert.equal(consumed.result.economics.economics.projectedCostPer100TurnsUSD, 3.94);
assert.equal(consumed.result.economics.readyForPricingDecision, false);
assert.equal(consumed.cohort.cases.length, 30);
assert.equal(consumed.authorization.cohort.sha256,
  zoningArchitectureV21ConfirmationCohortSHA256);
assert.equal(consumed.authorization.lineage.preparedFromCommit,
  zoningArchitectureV21ConfirmationPreparedFromCommit);
assert.equal(consumed.preflight.summary.pass, true);
assert.equal(consumed.preflight.summary.readyCaseCount, 24);
assert.equal(consumed.preflight.summary.zeroModelBoundaryCount, 6);
assert.equal(consumed.preflight.aggregateGates.noPaidSpend, true);
assert.equal(consumed.preflight.aggregateGates.noNetworkOrProviderCalls, true);
assert.equal(consumed.preflight.retainedV2Confirmation.answerReplay
  .preservedFullScoreIDs.length, 16);
assert.equal(consumed.preflight.retainedV2Confirmation.answerReplay
  .rejectedKnownJudgeFailureIDs.length, 5);
assert.equal(consumed.preflight.observedFailureRegressions.caseCount, 8);
assert.equal(consumed.priorAuthorization.status, "consumed");
assert.equal(consumed.priorAuthorization.consumption.runID,
  "9f67f4ba-3944-46a4-b438-fcec082144e3");
assert.throws(
  () => requireActiveZoningArchitectureV21ConfirmationPaidAuthorization(consumed),
  (error) => error?.code === "ZONING_ARCHITECTURE_V21_AUTHORIZATION_REQUIRED"
);

for (const failureCode of [
  "RESEARCH_ZONING_PREREQUISITES_REQUIRED",
  "RESEARCH_ZONING_EVIDENCE_REQUIRED",
  "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED"
]) {
  assert.equal(zoningArchitectureV2ContinuableResult({
    operationMetric: {
      status: "rejected",
      charged: false,
      failureCode,
      providerRequestCount: 0,
      pendingProviderRequestCount: 0
    }
  }), true);
}
assert.equal(zoningArchitectureV2ContinuableResult({
  operationMetric: {
    status: "failed",
    charged: false,
    failureCode: "RESEARCH_VERIFICATION_FAILED",
    providerRequestCount: 1,
    pendingProviderRequestCount: 0
  }
}), true);
for (const fixture of [
  {
    status: "rejected",
    charged: true,
    failureCode: "RESEARCH_ZONING_EVIDENCE_REQUIRED",
    providerRequestCount: 0,
    pendingProviderRequestCount: 0
  },
  {
    status: "rejected",
    charged: false,
    failureCode: "RESEARCH_ZONING_EVIDENCE_REQUIRED",
    providerRequestCount: 1,
    pendingProviderRequestCount: 0
  },
  {
    status: "failed",
    charged: false,
    failureCode: "RESEARCH_PROVIDER_FAILED",
    providerRequestCount: 1,
    pendingProviderRequestCount: 0
  }
]) {
  assert.equal(zoningArchitectureV2ContinuableResult({ operationMetric: fixture }), false);
}

const blockedRunner = spawnSync(
  process.execPath,
  ["scripts/run-zoning-successor.mjs", "--zoning-architecture-v21-confirmation"],
  {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      AZURE_OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
      PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
    }
  }
);
assert.notEqual(blockedRunner.status, 0);
assert.match(
  `${blockedRunner.stdout}\n${blockedRunner.stderr}`,
  /exact locked-package authorization sentence and cumulative spend cap/
);

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-architecture-v21-authorization-")
);
const fixturePath = join(temporaryDirectory, "authorization.json");
try {
  const packageCommit = "a".repeat(40);
  const exactPhrase =
    `authorize exactly package commit ${packageCommit} for all 30 ordered cases, ` +
    "one repetition, with a maximum cumulative API spend of $5.";
  const authorizedFixture = structuredClone(lockedFixture);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope = {
    caseCount: 30,
    repetitions: 1,
    maximumCumulativeSpendUSD: 5
  };
  authorizedFixture.ownerDecision = {
    required: true,
    authorizedAt: "2026-09-01T20:00:00.000Z",
    authorizedBy: "Permitext owner",
    exactAuthorizationPhrase: exactPhrase,
    exactSpendingCapPhrase: exactPhrase
  };
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
  authorizedFixture.execution.executionCommit = null;
  authorizedFixture.networkOrModelCallAuthorized = true;
  await writeFile(fixturePath, `${JSON.stringify(authorizedFixture, null, 2)}\n`);
  const authorized = await validateZoningArchitectureV21ConfirmationPaidAuthorization({
    authorizationPath: fixturePath
  });
  assert.equal(authorized.active, true);
  assert.equal(
    requireActiveZoningArchitectureV21ConfirmationPaidAuthorization(authorized),
    authorized
  );

  for (const [mutate, expected] of [
    [(fixture) => { fixture.scope.caseCount = 29; }, /30-case, one-repetition, \$5 scope/],
    [(fixture) => { fixture.scope.maximumCumulativeSpendUSD = 6; }, /30-case, one-repetition, \$5 scope/],
    [(fixture) => { fixture.ownerDecision.authorizedAt = null; }, /exact owner package and spend-cap sentence/],
    [(fixture) => { fixture.ownerDecision.authorizedBy = null; }, /exact owner package and spend-cap sentence/],
    [(fixture) => { fixture.ownerDecision.exactAuthorizationPhrase += " "; }, /exact owner package and spend-cap sentence/],
    [(fixture) => { fixture.execution.webSupportEnabled = true; }, /reviewed execution policy/],
    [(fixture) => { fixture.execution.fullAnswerRewriteAllowed = true; }, /reviewed execution policy/],
    [(fixture) => { fixture.execution.maximumSourceBoundedRepairsPerCase = 2; }, /reviewed execution policy/],
    [(fixture) => { fixture.execution.allowedContinuationFailureCodes.push("OTHER"); }, /continuation allowlist/],
    [(fixture) => { fixture.evidenceBudgetCandidateEnabled = true; }, /may not authorize evidenceBudgetCandidateEnabled/],
    [(fixture) => { fixture.deploymentAuthorized = true; }, /may not authorize deploymentAuthorized/],
    [(fixture) => { fixture.networkOrModelCallAuthorized = false; }, /exact active owner authorization may permit a provider call/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`);
    await assert.rejects(
      validateZoningArchitectureV21ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  "Permitext Zoning Architecture V2.1 consumed confirmation contract passed; " +
  "30 ordered results retained, settled cost ledger retained, re-dispatch blocked; paid model calls: no."
);
