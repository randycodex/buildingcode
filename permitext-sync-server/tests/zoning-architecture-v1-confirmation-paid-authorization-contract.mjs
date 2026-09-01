import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveZoningArchitectureV1ConfirmationPaidAuthorization,
  validateZoningArchitectureV1ConfirmationPaidAuthorization,
  zoningArchitectureV1ConfirmationAuthorizationID,
  zoningArchitectureV1ConfirmationCohortSHA256,
  zoningArchitectureV1ConfirmationConsumedAuthorizationSHA256,
  zoningArchitectureV1ConfirmationExecutionCommit,
  zoningArchitectureV1ConfirmationRunID
} from "../evals/zoning-architecture-v1-confirmation-paid-authorization.mjs";
import {
  zoningArchitectureV1ContinuableResult
} from "../scripts/run-zoning-successor.mjs";

const authorizationPath = new URL(
  "../evals/zoning-architecture-v1-confirmation-paid-authorization.json",
  import.meta.url
);
const guardPath = new URL(
  "../evals/zoning-architecture-v1-confirmation-paid-authorization.mjs",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const authorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(authorizationText), zoningArchitectureV1ConfirmationConsumedAuthorizationSHA256);
const consumed = await validateZoningArchitectureV1ConfirmationPaidAuthorization();
assert.equal(consumed.authorization.authorizationID, zoningArchitectureV1ConfirmationAuthorizationID);
assert.equal(consumed.authorization.cohort.sha256, zoningArchitectureV1ConfirmationCohortSHA256);
assert.equal(consumed.authorization.status, "consumed");
assert.equal(consumed.authorization.consumption.runID, zoningArchitectureV1ConfirmationRunID);
assert.equal(consumed.authorization.execution.executionCommit,
  zoningArchitectureV1ConfirmationExecutionCommit);
assert.equal(consumed.active, false);
assert.equal(typeof consumed.cohortPath, "string");
assert.match(consumed.cohortPath, /zoning-cases-expanded-batch-1-successor-remediation-3\.json$/);
assert.equal(consumed.cohort.cases.length, 30);
assert.equal(consumed.result.results.length, 30);
assert.equal(consumed.result.configuration.actualUSD, 0.391986);
assert.equal(consumed.result.configuration.pendingPaidRequestCount, 0);
assert.equal(consumed.result.economics.sample.sampleReady, false);
assert.equal(consumed.result.economics.readyForPricingDecision, false);
assert.equal(consumed.preflight.summary.pass, true);
assert.equal(consumed.preflight.summary.providerRequests.p50, 1);
assert.equal(consumed.preflight.summary.providerRequests.maximum, 2);
assert.ok(consumed.preflight.summary.productionCost.adverseUSDPerHundred <= 6);
assert.equal(consumed.preflight.summary.judgeCost.adverseUSDPerHundred, 0);
assert.equal(consumed.authorization.networkOrModelCallAuthorized, true);
assert.equal(consumed.authorization.publicResearchReleaseAuthorized, false);
assert.equal(consumed.authorization.deploymentAuthorized, false);
assert.equal(consumed.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(consumed.authorization.evidenceBudgetCandidateEnabled, false);
assert.equal(consumed.authorization.execution.continueAfterPrerequisiteBoundary, true);
assert.equal(
  consumed.authorization.lineage.priorArchitectureV1RunID,
  "4381fd0a-f719-4e86-b231-972b299e6a57"
);
assert.equal(consumed.authorization.lineage.priorArchitectureV1OrderedOperations, 3);
assert.equal(consumed.authorization.lineage.priorArchitectureV1ActualSpendUSD, 0.03472);
assert.equal(consumed.authorization.lineage.priorArchitectureV1PendingPaidRequests, 0);
assert.deepEqual(
  consumed.authorization.execution.allowedContinuationFailureCodes,
  ["RESEARCH_VERIFICATION_FAILED", "RESEARCH_ZONING_PREREQUISITES_REQUIRED"]
);
const continuablePrerequisiteBoundary = {
  operationMetric: {
    status: "rejected",
    charged: false,
    failureCode: "RESEARCH_ZONING_PREREQUISITES_REQUIRED",
    providerRequestCount: 0,
    pendingProviderRequestCount: 0
  },
  error: {}
};
assert.equal(zoningArchitectureV1ContinuableResult(continuablePrerequisiteBoundary), true);
for (const mutation of [
  { status: "failed" },
  { charged: true },
  { failureCode: "RESEARCH_PROVIDER_FAILED" },
  { providerRequestCount: 1 },
  { pendingProviderRequestCount: 1 }
]) {
  assert.equal(
    zoningArchitectureV1ContinuableResult({
      ...continuablePrerequisiteBoundary,
      operationMetric: {
        ...continuablePrerequisiteBoundary.operationMetric,
        ...mutation
      }
    }),
    false
  );
}
assert.throws(
  () => requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(consumed),
  /exact locked-package authorization sentence and cumulative spend cap/
);

const blocked = spawnSync(process.execPath, [fileURLToPath(guardPath), "--require-active"], {
  encoding: "utf8",
  env: {
    ...process.env,
    OPENAI_API_KEY: "",
    PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
    PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
  }
});
assert.equal(blocked.status, 1, `${blocked.stdout}\n${blocked.stderr}`);
assert.match(`${blocked.stdout}\n${blocked.stderr}`, /ZONING_ARCHITECTURE_V1_AUTHORIZATION_REQUIRED|exact locked-package authorization sentence/);

const blockedRunner = spawnSync(
  process.execPath,
  [fileURLToPath(runnerPath), "--zoning-architecture-v1-confirmation"],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
      PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
    }
  }
);
assert.equal(blockedRunner.status, 1, `${blockedRunner.stdout}\n${blockedRunner.stderr}`);
assert.match(
  `${blockedRunner.stdout}\n${blockedRunner.stderr}`,
  /Zoning Architecture V1 requires the exact locked-package authorization sentence/
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-zoning-architecture-v1-"));
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(consumed.authorization);
  const packageCommit = "1".repeat(40);
  const exactPhrase = `authorize exactly package commit ${packageCommit} for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.`;
  authorizedFixture.status = "authorized";
  authorizedFixture.consumption.status = "not_started";
  authorizedFixture.consumption.attemptID = null;
  authorizedFixture.consumption.startedAt = null;
  authorizedFixture.consumption.runID = null;
  authorizedFixture.consumption.consumedAt = null;
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-09-01T12:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase = exactPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase = exactPhrase;
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
  authorizedFixture.execution.executionCommit = null;
  authorizedFixture.networkOrModelCallAuthorized = true;
  await writeFile(fixturePath, `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized = await validateZoningArchitectureV1ConfirmationPaidAuthorization({
    authorizationPath: fixturePath
  });
  assert.equal(authorized.active, true);
  assert.equal(
    requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(authorized),
    authorized
  );

  for (const [mutate, expected] of [
    [(fixture) => { fixture.scope.caseCount = 29; }, /30-case, one-repetition, \$5 scope/],
    [(fixture) => { fixture.scope.maximumCumulativeSpendUSD = 6; }, /30-case, one-repetition, \$5 scope/],
    [(fixture) => { fixture.ownerDecision.exactAuthorizationPhrase += " "; }, /exact owner package and spend-cap sentence/],
    [(fixture) => { fixture.execution.webSupportEnabled = true; }, /may not enable web support/],
    [(fixture) => { fixture.execution.lunaFirst = false; }, /must remain Luna-first/],
    [(fixture) => { fixture.execution.fullAnswerRewriteAllowed = true; }, /may not enable full-answer rewrites/],
    [(fixture) => { fixture.execution.continueAfterPrerequisiteBoundary = false; }, /must retain deterministic prerequisite-boundary continuation/],
    [(fixture) => { fixture.execution.allowedContinuationFailureCodes.push("OTHER"); }, /changed its continuation failure allowlist/],
    [(fixture) => { fixture.evidenceBudgetCandidateEnabled = true; }, /may not authorize evidenceBudgetCandidateEnabled/],
    [(fixture) => { fixture.deploymentAuthorized = true; }, /may not authorize deploymentAuthorized/],
    [(fixture) => { fixture.networkOrModelCallAuthorized = false; }, /exact active owner authorization may permit a provider call/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`, "utf8");
    await assert.rejects(
      validateZoningArchitectureV1ConfirmationPaidAuthorization({ authorizationPath: fixturePath }),
      expected
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Permitext Zoning Architecture V1 consumed confirmation contract passed; retained 30 ordered results and blocked re-dispatch; paid model calls: no.");
