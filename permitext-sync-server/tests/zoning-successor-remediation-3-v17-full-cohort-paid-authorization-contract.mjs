import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V17FullCohortPaidAuthorization,
  validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization,
  zoningRemediationSuccessor3V17FullCohortAppSHA256,
  zoningRemediationSuccessor3V17FullCohortConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V17FullCohortEconomicsSHA256,
  zoningRemediationSuccessor3V17FullCohortLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V17FullCohortPreparedFromCommit,
  zoningRemediationSuccessor3V17FullCohortRunnerHandoffSHA256,
  zoningRemediationSuccessor3V17FullCohortRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V17FullCohortSafetySHA256,
  zoningRemediationSuccessor3V17FullCohortSupersededPackageCommit
} from "../evals/zoning-successor-remediation-3-v17-full-cohort-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256
} from "../evals/zoning-successor-remediation-3-v17-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "1d284c44-1f93-4abd-9992-f77d88d60697";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactLockedAuthorizationSHA256 =
  "89f6049bb4e1c72852e8edbfc870dd561864cce8ef6691b6c1ef5f6175bc0c81";
const exactConsumedAuthorizationSHA256 =
  "5474123dc94e2c934eb556bc05e1bce823f743d1db39cde8f65cecfade1487aa";
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const noPaidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};

const authorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(authorizationText), exactConsumedAuthorizationSHA256);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortPreparedFromCommit,
  "d191ceae2aa390c3034f5275cceb5cb84935fd5a"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortSafetySHA256,
  "aa9ee2368af89a302770413bb9fbaa1fe38e7e60457b946b7b0d3687bda442c8"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortEconomicsSHA256,
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortAppSHA256,
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortRunnerHandoffSHA256,
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortRunnerPublicKeySHA256,
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918"
);
assert.equal(
  zoningRemediationSuccessor3V17FullCohortSupersededPackageCommit,
  "4d858e8813127f1adf16569e60d3d1bb570ee515"
);

const retained =
  await validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization();
assert.equal(retained.authorization.authorizationID, exactAuthorizationID);
assert.equal(retained.authorization.status, "consumed");
assert.equal(retained.active, false);
assert.equal(retained.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(retained.cohort.cases.length, 30);
assert.deepEqual(
  {
    caseCount: retained.authorization.scope.caseCount,
    repetitions: retained.authorization.scope.repetitions,
    maximumCumulativeSpendUSD:
      retained.authorization.scope.maximumCumulativeSpendUSD,
    exactAuthorizationPhrase:
      retained.authorization.ownerDecision.exactAuthorizationPhrase,
    authorizationPackageCommit:
      retained.authorization.execution.authorizationPackageCommit,
    executionCommit: retained.authorization.execution.executionCommit,
    runID: retained.authorization.consumption.runID
  },
  {
    caseCount: 30,
    repetitions: 1,
    maximumCumulativeSpendUSD: 5,
    exactAuthorizationPhrase: "authorize exactly package commit e0c1c5d2846707641a6352fcdf0a397736724fda for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.",
    authorizationPackageCommit: "e0c1c5d2846707641a6352fcdf0a397736724fda",
    executionCommit: "0b8c7dca4ef33cd70f2889a5d61eea2add02d993",
    runID: "d2fdc1c4-7099-430d-9d33-2b759021afd2"
  }
);
assert.equal(retained.authorization.execution.stopOnExecutionError, false);
assert.equal(
  retained.authorization.execution.continueAfterVerifiedResearchFailure,
  true
);
assert.deepEqual(
  retained.authorization.execution.allowedContinuationFailureCodes,
  ["RESEARCH_VERIFICATION_FAILED"]
);
assert.equal(
  retained.authorization.lineage.supersededLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V17ConfirmationLockedAuthorizationSHA256
);
assert.equal(retained.authorization.publicResearchReleaseAuthorized, false);
assert.equal(retained.authorization.deploymentAuthorized, false);
assert.equal(retained.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V17FullCohortPaidAuthorization(
    retained
  ),
  /consumed|not active|authorization/i
);

const scrubbedEnvironment = zoningRemediationSuccessor3V11PaidRunEnvironment({
  ...process.env,
  NODE_ENV: "test",
  NODE_OPTIONS: "--import=/tmp/hostile-loader.mjs",
  HTTP_PROXY: "http://127.0.0.1:9001",
  PERMITEXT_SYNC_DATABASE_URL: "postgres://must-not-be-used",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "on"
}, 5);
assert.equal(scrubbedEnvironment.NODE_ENV, "production");
assert.equal(scrubbedEnvironment.NODE_OPTIONS, "");
assert.equal(scrubbedEnvironment.HTTP_PROXY, "");
assert.equal(scrubbedEnvironment.PERMITEXT_SYNC_DATABASE_URL, "");
assert.equal(scrubbedEnvironment.PERMITEXT_TEST_RESEARCH_MOCK, "");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_WEB_SUPPORT, "off");

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "--remediation-3-v17-full-cohort",
  ".zoning-successor-remediation-3-v17-full-cohort-paid-run.lock",
  "validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization",
  "--continue-after-verified-research-failure",
  "RESEARCH_VERIFICATION_FAILED",
  "pendingProviderRequestCount",
  "Only the locked authorization record may change",
  "The fail-fast v17 package is superseded"
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v17 full-cohort runner is missing guard: ${requiredGuard}`);
}

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v17-full-cohort",
  ".zoning-successor-remediation-3-v17-full-cohort-paid-run.lock",
  "continueAfterVerifiedResearchFailure",
  "continuableVerifiedResearchFailure",
  "RESEARCH_VERIFICATION_FAILED",
  "pendingProviderRequestCount === 0",
  "Choose only one evaluation stop or continuation policy"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v17 full-cohort evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v17-full-cohort", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v17-full-cohort", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v17-full-cohort", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v17-full-cohort"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v17-confirmation"]
]) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: noPaidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
}
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A locked full-cohort attempt created a result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v17-full-cohort"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: noPaidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost full-cohort preflight did not cover all 30 cases.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost full-cohort preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-v17-full-cohort-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(retained.authorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T23:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  const packageCommit = "1".repeat(40);
  const ownerPhrase =
    `authorize exactly package commit ${packageCommit} for all 30 ordered ` +
    "cases, one repetition, with a maximum cumulative API spend of $5.";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase = ownerPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase = ownerPhrase;
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
  authorizedFixture.execution.executionCommit = null;
  authorizedFixture.consumption.status = "not_started";
  authorizedFixture.consumption.attemptID = null;
  authorizedFixture.consumption.startedAt = null;
  authorizedFixture.consumption.runID = null;
  authorizedFixture.consumption.consumedAt = null;
  await writeFile(fixturePath,
    `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);

  for (const [mutate, expected] of [
    [(fixture) => {
      fixture.scope.maximumCumulativeSpendUSD = 4;
    }, /exact 30-case, one-repetition, \$5 scope/],
    [(fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("all 30", "all 29");
    }, /exact package and scope phrase/],
    [(fixture) => {
      fixture.execution.stopOnExecutionError = true;
    }, /may not use the superseded fail-fast policy/],
    [(fixture) => {
      fixture.execution.continueAfterVerifiedResearchFailure = false;
    }, /must continue only after verified Research failures/],
    [(fixture) => {
      fixture.execution.allowedContinuationFailureCodes.push(
        "RESEARCH_PROVIDER_FAILED"
      );
    }, /continuation failure-code allowlist changed/],
    [(fixture) => {
      fixture.execution.webSupportEnabled = true;
    }, /may not enable unbudgeted web search/],
    [(fixture) => {
      fixture.deploymentAuthorized = true;
    }, /may not authorize deployment/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`,
      "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V17FullCohortPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

assert.equal(sha256(await readFile(authorizationPath, "utf8")),
  exactConsumedAuthorizationSHA256);
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The v17 full-cohort authorization contract created a paid result file.");
console.log(
  "Zoning v17 full-cohort consumed authorization contract passed; the fail-fast package remains superseded, retained result integrity passes, and paid redispatch is blocked."
);
