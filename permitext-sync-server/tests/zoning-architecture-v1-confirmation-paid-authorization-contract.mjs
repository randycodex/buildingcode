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
  zoningArchitectureV1ConfirmationLockedAuthorizationSHA256
} from "../evals/zoning-architecture-v1-confirmation-paid-authorization.mjs";

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
assert.equal(sha256(authorizationText), zoningArchitectureV1ConfirmationLockedAuthorizationSHA256);
const locked = await validateZoningArchitectureV1ConfirmationPaidAuthorization();
assert.equal(locked.authorization.authorizationID, zoningArchitectureV1ConfirmationAuthorizationID);
assert.equal(locked.authorization.cohort.sha256, zoningArchitectureV1ConfirmationCohortSHA256);
assert.equal(locked.authorization.status, "locked");
assert.equal(locked.active, false);
assert.equal(typeof locked.cohortPath, "string");
assert.match(locked.cohortPath, /zoning-cases-expanded-batch-1-successor-remediation-3\.json$/);
assert.equal(locked.cohort.cases.length, 30);
assert.equal(locked.preflight.summary.pass, true);
assert.equal(locked.preflight.summary.providerRequests.p50, 1);
assert.equal(locked.preflight.summary.providerRequests.maximum, 2);
assert.ok(locked.preflight.summary.productionCost.adverseUSDPerHundred <= 6);
assert.equal(locked.preflight.summary.judgeCost.adverseUSDPerHundred, 0);
assert.equal(locked.authorization.networkOrModelCallAuthorized, false);
assert.equal(locked.authorization.publicResearchReleaseAuthorized, false);
assert.equal(locked.authorization.deploymentAuthorized, false);
assert.equal(locked.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(locked.authorization.evidenceBudgetCandidateEnabled, false);
assert.equal(locked.authorization.execution.continueAfterPrerequisiteBoundary, true);
assert.deepEqual(
  locked.authorization.execution.allowedContinuationFailureCodes,
  ["RESEARCH_VERIFICATION_FAILED", "RESEARCH_ZONING_PREREQUISITES_REQUIRED"]
);
assert.throws(
  () => requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(locked),
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
  const authorizedFixture = structuredClone(locked.authorization);
  const packageCommit = "1".repeat(40);
  const exactPhrase = `authorize exactly package commit ${packageCommit} for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.`;
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-09-01T12:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase = exactPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase = exactPhrase;
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
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

console.log("Permitext Zoning Architecture V1 locked confirmation authorization contract passed; paid model calls: no.");
