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
  zoningArchitectureV21ConfirmationLockedAuthorizationSHA256,
  zoningArchitectureV21ConfirmationPreparedFromCommit
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
const lockedFixture = JSON.parse(authorizationText);
const locked = await validateZoningArchitectureV21ConfirmationPaidAuthorization();

assert.equal(locked.authorization.authorizationID,
  zoningArchitectureV21ConfirmationAuthorizationID);
assert.equal(locked.authorizationSHA256,
  zoningArchitectureV21ConfirmationLockedAuthorizationSHA256);
assert.equal(createHash("sha256").update(authorizationText).digest("hex"),
  zoningArchitectureV21ConfirmationLockedAuthorizationSHA256);
assert.equal(locked.authorization.status, "locked");
assert.equal(locked.authorization.networkOrModelCallAuthorized, false);
assert.equal(locked.active, false);
assert.equal(locked.cohort.cases.length, 30);
assert.equal(locked.authorization.cohort.sha256,
  zoningArchitectureV21ConfirmationCohortSHA256);
assert.equal(locked.authorization.lineage.preparedFromCommit,
  zoningArchitectureV21ConfirmationPreparedFromCommit);
assert.equal(locked.preflight.summary.pass, true);
assert.equal(locked.preflight.summary.readyCaseCount, 24);
assert.equal(locked.preflight.summary.zeroModelBoundaryCount, 6);
assert.equal(locked.preflight.aggregateGates.noPaidSpend, true);
assert.equal(locked.preflight.aggregateGates.noNetworkOrProviderCalls, true);
assert.equal(locked.preflight.retainedV2Confirmation.answerReplay
  .preservedFullScoreIDs.length, 16);
assert.equal(locked.preflight.retainedV2Confirmation.answerReplay
  .rejectedKnownJudgeFailureIDs.length, 5);
assert.equal(locked.preflight.observedFailureRegressions.caseCount, 8);
assert.equal(locked.priorAuthorization.status, "consumed");
assert.equal(locked.priorAuthorization.consumption.runID,
  "9f67f4ba-3944-46a4-b438-fcec082144e3");
assert.throws(
  () => requireActiveZoningArchitectureV21ConfirmationPaidAuthorization(locked),
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
  "Permitext Zoning Architecture V2.1 locked confirmation contract passed for 30 ordered cases; " +
  "provider dispatch remains unauthorized; paid model calls: no."
);
