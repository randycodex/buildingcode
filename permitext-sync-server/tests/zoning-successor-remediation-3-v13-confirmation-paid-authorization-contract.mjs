import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V13ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V13ConfirmationAppSHA256,
  zoningRemediationSuccessor3V13ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V13ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V13ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V13ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V13ConfirmationRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V13ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v13-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V12ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V12ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V12ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V12ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V12ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V12ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v12-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v13-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "dc46f544-f4f9-4085-b8f5-f29ab5412936";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactLockedAuthorizationSHA256 =
  "ea4d49cae91e99b2344c8e84321f503adc04b219d5c9785876f70cfd01e9bf11";
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const noPaidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};

const authorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(authorizationText), exactLockedAuthorizationSHA256);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationPreparedFromCommit,
  "c933bb4a5789e6698668732057c5aa7b19c5c9f8"
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationSafetySHA256,
  "44b19001559326ea73349ea828566879b7df9491c7d3a9c6db086a679c0a41f6"
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationEconomicsSHA256,
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0"
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationAppSHA256,
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797"
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationRunnerHandoffSHA256,
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327"
);
assert.equal(
  zoningRemediationSuccessor3V13ConfirmationRunnerPublicKeySHA256,
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918"
);

const locked =
  await validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization();
assert.equal(locked.authorization.authorizationID, exactAuthorizationID);
assert.equal(locked.authorization.status, "locked");
assert.equal(locked.active, false);
assert.equal(locked.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(locked.cohort.cases.length, 30);
assert.deepEqual(
  {
    caseCount: locked.authorization.scope.caseCount,
    repetitions: locked.authorization.scope.repetitions,
    maximumCumulativeSpendUSD:
      locked.authorization.scope.maximumCumulativeSpendUSD,
    authorizedAt: locked.authorization.ownerDecision.authorizedAt,
    authorizedBy: locked.authorization.ownerDecision.authorizedBy,
    exactAuthorizationPhrase:
      locked.authorization.ownerDecision.exactAuthorizationPhrase,
    exactSpendingCapPhrase:
      locked.authorization.ownerDecision.exactSpendingCapPhrase,
    authorizationPackageCommit:
      locked.authorization.execution.authorizationPackageCommit,
    executionCommit: locked.authorization.execution.executionCommit
  },
  {
    caseCount: null,
    repetitions: null,
    maximumCumulativeSpendUSD: null,
    authorizedAt: null,
    authorizedBy: null,
    exactAuthorizationPhrase: null,
    exactSpendingCapPhrase: null,
    authorizationPackageCommit: null,
    executionCommit: null
  }
);
assert.equal(locked.authorization.consumption.status, "not_started");
assert.equal(locked.authorization.publicResearchReleaseAuthorized, false);
assert.equal(locked.authorization.professionalZoningSignoff, false);
assert.equal(locked.authorization.deploymentAuthorized, false);
assert.equal(locked.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(locked.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V13ConfirmationPaidAuthorization(
    locked
  ),
  /requires a new explicit owner authorization and cumulative spend cap/
);

assert.equal(
  locked.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V12ConfirmationConsumedAuthorizationSHA256
);
assert.equal(
  locked.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V12ConfirmationAuthorizationPackageCommit
);
assert.equal(
  locked.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V12ConfirmationExecutionCommit
);
assert.equal(
  locked.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V12ConfirmationRunID
);
assert.equal(
  locked.authorization.lineage.priorResultJSONFile,
  zoningRemediationSuccessor3V12ConfirmationResultJSONFile
);
assert.equal(
  locked.authorization.lineage.priorResultJSONSHA256,
  zoningRemediationSuccessor3V12ConfirmationResultJSONSHA256
);
assert.equal(
  locked.authorization.lineage.priorResultMarkdownFile,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownFile
);
assert.equal(
  locked.authorization.lineage.priorResultMarkdownSHA256,
  zoningRemediationSuccessor3V12ConfirmationResultMarkdownSHA256
);

const scrubbedEnvironment = zoningRemediationSuccessor3V11PaidRunEnvironment({
  ...process.env,
  NODE_ENV: "test",
  NODE_OPTIONS: "--import=/tmp/hostile-loader.mjs",
  HTTP_PROXY: "http://127.0.0.1:9001",
  HTTPS_PROXY: "http://127.0.0.1:9002",
  PERMITEXT_SYNC_DATABASE_URL: "postgres://must-not-be-used",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "1",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "xhigh",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "on"
}, 5);
assert.equal(scrubbedEnvironment.NODE_ENV, "production");
assert.equal(scrubbedEnvironment.NODE_OPTIONS, "");
assert.equal(scrubbedEnvironment.HTTP_PROXY, "");
assert.equal(scrubbedEnvironment.HTTPS_PROXY, "");
assert.equal(scrubbedEnvironment.PERMITEXT_SYNC_DATABASE_URL, "");
assert.equal(scrubbedEnvironment.PERMITEXT_TEST_RESEARCH_MOCK, "");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_WEB_SUPPORT, "off");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS, "0");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_REASONING_EFFORT, "medium");

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "--remediation-3-v13-confirmation",
  ".zoning-successor-remediation-3-v13-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V13ConfirmationLockedAuthorizationSHA256",
  "assertPinnedAuthenticatedRuntimeInputsAtCommit",
  "assertExactLockedAuthorizationPackage",
  "respondToZoningV11RunnerChallenge",
  "Only the locked authorization record may change",
  "pendingPaidRequestCount",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\""
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v13 confirmation runner is missing guard: ${requiredGuard}`);
}

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v13-confirmation",
  ".zoning-successor-remediation-3-v13-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V13ConfirmationLockedAuthorizationSHA256",
  "assertAuthenticatedConfirmationChildExecutionInputs",
  "requireAuthenticatedZoningV11RunnerHandoff",
  "server changes other than the authorization",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit",
  "may not expose its runner authentication in the environment"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v13 confirmation evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v13-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v13-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v13-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v13-confirmation"]
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
  "A locked or malformed v12 attempt created a result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v13-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: noPaidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v13 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v13 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v13-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(locked.authorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T22:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  const packageCommit = "1".repeat(40);
  const ownerPhrase =
    `authorize exactly package commit ${packageCommit} for all 30 ordered ` +
    "cases, one repetition, with a maximum cumulative API spend of $5.";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase = ownerPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase = ownerPhrase;
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
  await writeFile(fixturePath,
    `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization({
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
    }, /bind the owner's exact phrase/],
    [(fixture) => {
      fixture.ownerDecision.exactSpendingCapPhrase = null;
    }, /same exact package-bound spending-cap phrase/],
    [(fixture) => {
      fixture.execution.webSupportEnabled = true;
    }, /may not enable unbudgeted web search/],
    [(fixture) => {
      fixture.lineage.zoningSafetySHA256 = "0".repeat(64);
    }, /wrong Zoning safety SHA/],
    [(fixture) => {
      fixture.lineage.priorAuthorizationSHA256 = "0".repeat(64);
    }, /wrong historical v12 authorization SHA/],
    [(fixture) => {
      fixture.deploymentAuthorized = true;
    }, /may not authorize deployment/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`,
      "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V13ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

assert.equal(sha256(await readFile(authorizationPath, "utf8")),
  exactLockedAuthorizationSHA256);
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The v13 authorization contract created a paid result file.");
console.log(
  "Zoning remediation-successor-3 v13 confirmation authorization contract passed; locked scope, consumed v12 lineage, hostile-runtime scrubbing, paid-dispatch blocks, and 30/30 no-cost preflight remain intact."
);
