import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V15ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V15ConfirmationAppSHA256,
  zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V15ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V15ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V15ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V15ConfirmationRunID,
  zoningRemediationSuccessor3V15ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V15ConfirmationRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V15ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v15-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V14ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V14ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V14ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V14ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V14ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V14ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v14-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v15-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "23d686fc-1a01-4cf0-8242-7c894f67ecbd";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactLockedAuthorizationSHA256 =
  "774e18e65313eaeeb601c2ed3bbf3f6f050907f564ba5765aeea3d9d2824855b";
const exactConsumedAuthorizationSHA256 =
  "0ef1e44e90ab0b7802913e4a3bc2785889875324eec1579a30e13331e14455a5";
const exactAuthorizationPackageCommit =
  "8fe33ab45f8d2d4b4653207aee47d8bb557c68b3";
const exactExecutionCommit = "1fde866860433e9152d00bd78cc324e825034956";
const exactRunID = "fe0367c2-2c62-41e3-bc4c-1fc168fae68e";
const authorizationRelativePath =
  "evals/zoning-successor-remediation-3-v15-confirmation-paid-authorization.json";
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const noPaidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};

assert.equal(
  zoningRemediationSuccessor3V15ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
  exactAuthorizationPackageCommit
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
  exactExecutionCommit
);
assert.equal(zoningRemediationSuccessor3V15ConfirmationRunID, exactRunID);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationPreparedFromCommit,
  "167a8ee0106dd4e2ecce7a4c259b09d969f60990"
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationSafetySHA256,
  "b9e863d030b800f27f142d5b6b5ee1ee83dbdff9b8a9ec890ab3cc0236f3a6a0"
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationEconomicsSHA256,
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0"
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationAppSHA256,
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797"
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationRunnerHandoffSHA256,
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327"
);
assert.equal(
  zoningRemediationSuccessor3V15ConfirmationRunnerPublicKeySHA256,
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918"
);

const lockedAuthorizationBlob = spawnSync("git", [
  "show",
  `${exactAuthorizationPackageCommit}:permitext-sync-server/${authorizationRelativePath}`
], {
  cwd: serverRoot,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024
});
assert.equal(lockedAuthorizationBlob.status, 0,
  "The historical locked v15 authorization could not be read.");
const lockedAuthorizationText = lockedAuthorizationBlob.stdout;
assert.equal(sha256(lockedAuthorizationText), exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationText);

const consumedAuthorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(consumedAuthorizationText), exactConsumedAuthorizationSHA256);
const current =
  await validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization();
assert.equal(current.authorization.authorizationID, exactAuthorizationID);
assert.equal(current.authorization.status, "consumed");
assert.equal(current.active, false);
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.scope.caseCount, 30);
assert.equal(current.authorization.scope.repetitions, 1);
assert.equal(current.authorization.scope.maximumCumulativeSpendUSD, 5);
assert.equal(current.authorization.ownerDecision.authorizedBy, "Permitext owner");
const exactOwnerPhrase =
  `authorize exactly package commit ${exactAuthorizationPackageCommit} for all 30 ` +
  "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
assert.equal(current.authorization.ownerDecision.exactAuthorizationPhrase,
  exactOwnerPhrase);
assert.equal(current.authorization.ownerDecision.exactSpendingCapPhrase,
  exactOwnerPhrase);
assert.equal(current.authorization.execution.authorizationPackageCommit,
  exactAuthorizationPackageCommit);
assert.equal(current.authorization.execution.executionCommit, exactExecutionCommit);
assert.equal(current.authorization.consumption.attemptID, exactRunID);
assert.equal(current.authorization.consumption.runID, exactRunID);
assert.equal(current.authorization.execution.webSupportEnabled, false);
assert.equal(current.authorization.execution.stopOnExecutionError, true);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.professionalZoningSignoff, false);
assert.equal(current.authorization.deploymentAuthorized, false);
assert.equal(current.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V15ConfirmationPaidAuthorization(
    current
  ),
  /requires a new explicit owner authorization and cumulative spend cap/
);

for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
    zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256],
  [zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
    zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256]
]) {
  assert.equal(
    sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash,
    `The retained v15 result changed: ${file}`
  );
}

assert.equal(
  current.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V14ConfirmationConsumedAuthorizationSHA256
);
assert.equal(
  current.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V14ConfirmationAuthorizationPackageCommit
);
assert.equal(
  current.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V14ConfirmationExecutionCommit
);
assert.equal(
  current.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V14ConfirmationRunID
);
assert.equal(
  current.authorization.lineage.priorResultJSONFile,
  zoningRemediationSuccessor3V14ConfirmationResultJSONFile
);
assert.equal(
  current.authorization.lineage.priorResultJSONSHA256,
  zoningRemediationSuccessor3V14ConfirmationResultJSONSHA256
);
assert.equal(
  current.authorization.lineage.priorResultMarkdownFile,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownFile
);
assert.equal(
  current.authorization.lineage.priorResultMarkdownSHA256,
  zoningRemediationSuccessor3V14ConfirmationResultMarkdownSHA256
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
  "--remediation-3-v15-confirmation",
  ".zoning-successor-remediation-3-v15-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V15ConfirmationLockedAuthorizationSHA256",
  "assertPinnedAuthenticatedRuntimeInputsAtCommit",
  "assertExactLockedAuthorizationPackage",
  "respondToZoningV11RunnerChallenge",
  "Only the locked authorization record may change",
  "pendingPaidRequestCount",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\""
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v15 confirmation runner is missing guard: ${requiredGuard}`);
}

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v15-confirmation",
  ".zoning-successor-remediation-3-v15-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V15ConfirmationLockedAuthorizationSHA256",
  "assertAuthenticatedConfirmationChildExecutionInputs",
  "requireAuthenticatedZoningV11RunnerHandoff",
  "server changes other than the authorization",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit",
  "may not expose its runner authentication in the environment"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v15 confirmation evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v15-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v15-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v15-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v15-confirmation"]
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
  "A consumed or malformed v15 attempt created a result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v15-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: noPaidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v15 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v15 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v15-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(lockedAuthorization);
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
    await validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization({
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
    }, /wrong historical v14 authorization SHA/],
    [(fixture) => {
      fixture.deploymentAuthorized = true;
    }, /may not authorize deployment/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`,
      "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V15ConfirmationPaidAuthorization({
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
  "The v15 authorization contract created a paid result file.");
console.log(
  "Zoning remediation-successor-3 v15 confirmation authorization contract passed; consumed run/result integrity, immutable locked-package history, consumed v14 lineage, hostile-runtime scrubbing, paid-dispatch blocks, and 30/30 no-cost preflight remain intact."
);
