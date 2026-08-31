import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V9ConfirmationAppSHA256,
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationRunID,
  zoningRemediationSuccessor3V9ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V8ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "9aaade99-759b-41d6-ad73-3ef9b4a168f9";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactRepairCommit = "1fae244d775192f55f0fd6ee17d90cb82648ba01";
const exactSafetySHA256 =
  "56b945d1a29405bd9b3e41c44909ec69a70c043a03464b9b35b9e82245ab5e71";
const exactEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
const exactAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
const exactLockedAuthorizationSHA256 =
  "f8176550c79a3e7caddfc903760123d07467201ba8b83a260c105bd831e53b7c";
const exactAuthorizationPackageCommit =
  "571367800030d49a103a999090eaa615baa361ec";
const exactExecutionCommit =
  "17fea6186d35a43348c5b73f419ccc9014dfb374";
const exactRunID = "00570309-e1f2-441b-9f09-8df4f0603253";
const exactConsumedAuthorizationSHA256 =
  "ffa134fc6f2855264ff54c8b285ba49f3bb16ab908b712072854d61bc2eb39e4";
const exactResultJSONSHA256 =
  "ad43aee5d7d9038eef1de09f1b9595b779abe4bcb7199421e5a905807380c9d6";
const exactResultMarkdownSHA256 =
  "46a1f7c0b299ac1e1b6234f19e34a557389dcde2381f89c253802ef2152f30ad";
const paidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "--remediation-3-v9-confirmation",
  ".zoning-successor-remediation-3-v9-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V9ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit",
  "zoningRemediationSuccessor3V9ConfirmationSafetySHA256",
  "zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256",
  "zoningRemediationSuccessor3V9ConfirmationAppSHA256",
  "maxBuffer: 4 * 1024 * 1024",
  "assertExactLockedAuthorizationPackage",
  "Only the locked authorization record may change",
  "pendingPaidRequestCount",
  "webSupportRequested",
  "webSupportSearched",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\"",
  "beginAuthorizationAttempt",
  "AggregateError"
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v9 confirmation runner is missing guard: ${requiredGuard}`);
}
assert.match(runnerSource,
  /if \(!remediationSuccessor3V9ConfirmationMode\)[\s\S]{0,120}retiredPaidPathMessage/,
  "Historical runner modes, including v8, must remain retired.");

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v9-confirmation",
  ".zoning-successor-remediation-3-v9-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization",
  ".paid-evaluation-run.lock",
  "PERMITEXT_ZONING_PAID_RUNNER_NONCE",
  "Paid v9 confirmation requires the exact clean execution commit",
  "Only the durable running authorization may differ in the child",
  "globalRunnerLock?.nonce === runnerLock?.nonce",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v9 confirmation evaluator is missing guard: ${requiredGuard}`);
}

assert.equal(zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit,
  exactRepairCommit);
assert.equal(zoningRemediationSuccessor3V9ConfirmationSafetySHA256,
  exactSafetySHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
  exactEconomicsSHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationAppSHA256,
  exactAppSHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  exactAuthorizationPackageCommit);
assert.equal(zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  exactExecutionCommit);
assert.equal(zoningRemediationSuccessor3V9ConfirmationRunID, exactRunID);
assert.equal(zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256,
  exactResultJSONSHA256);
assert.equal(zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256,
  exactResultMarkdownSHA256);

const lockedAuthorizationBlob = spawnSync("git", [
  "show",
  `${exactAuthorizationPackageCommit}:permitext-sync-server/evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.json`
], {
  cwd: serverRoot,
  encoding: "utf8"
});
assert.equal(lockedAuthorizationBlob.status, 0,
  combinedOutput(lockedAuthorizationBlob));
assert.equal(sha256(lockedAuthorizationBlob.stdout),
  exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationBlob.stdout);
assert.equal(lockedAuthorization.status, "locked");
assert.equal(lockedAuthorization.authorizationID, exactAuthorizationID);
assert.equal(lockedAuthorization.scope.caseCount, null);

const current =
  await validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization();
const consumedAuthorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(consumedAuthorizationText), exactConsumedAuthorizationSHA256);
assert.equal(current.authorization.authorizationID, exactAuthorizationID);
assert.equal(current.authorization.status, "consumed");
assert.equal(current.active, false);
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.scope.caseCount, 30);
assert.equal(current.authorization.scope.repetitions, 1);
assert.equal(current.authorization.scope.maximumCumulativeSpendUSD, 5);
assert.equal(current.authorization.ownerDecision.authorizedBy, "Permitext owner");
assert.equal(
  current.authorization.ownerDecision.exactAuthorizationPhrase,
  "authorize exactly package commit 571367800030d49a103a999090eaa615baa361ec for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5."
);
assert.equal(
  current.authorization.ownerDecision.exactSpendingCapPhrase,
  "authorize exactly package commit 571367800030d49a103a999090eaa615baa361ec for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5."
);
assert.equal(current.authorization.consumption.status, "consumed");
assert.equal(current.authorization.consumption.attemptID, exactRunID);
assert.equal(current.authorization.consumption.runID, exactRunID);
assert.equal(current.authorization.execution.authorizationPackageCommit,
  exactAuthorizationPackageCommit);
assert.equal(current.authorization.execution.executionCommit, exactExecutionCommit);
assert.equal(current.authorization.execution.webSupportEnabled, false);
assert.equal(current.authorization.execution.stopOnExecutionError, true);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.professionalZoningSignoff, false);
assert.equal(current.authorization.deploymentAuthorized, false);
assert.equal(current.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization(current),
  /requires a new explicit owner authorization and cumulative spend cap/
);

for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
    exactResultJSONSHA256],
  [zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
    exactResultMarkdownSHA256]
]) {
  assert.equal(
    sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash
  );
}

assert.equal(current.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256);
assert.equal(current.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit);
assert.equal(current.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V8ConfirmationExecutionCommit);
assert.equal(current.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V8ConfirmationRunID);
for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
    zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256],
  [zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
    zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256]
]) {
  assert.equal(sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v9-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v9-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v9-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v9-confirmation"]
]) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(blocked),
    /(?:consuming runner and active run lock|requires a new explicit owner authorization and cumulative spend cap)/i);
}
for (const args of [
  ["scripts/run-zoning-successor.mjs",
    "--remediation-3-v9-confirmation", "--remediation-3-v9-confirmation"],
  ["scripts/run-zoning-successor.mjs", "--unknown-v9-confirmation"]
]) {
  const unsupported = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(unsupported.status, 1);
  assert.match(combinedOutput(unsupported),
    /unsupported Zoning successor paid-run argument/i);
}
for (const args of [
  ["scripts/run-zoning-successor.mjs"],
  ["scripts/run-zoning-successor.mjs", "--remediation-2"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v8-confirmation"],
  ["tests/research-evals.mjs", "--zoning-successor", "--run-live"],
  ["tests/research-evals.mjs", "--zoning-successor-remediation-2", "--run-live"],
  ["tests/research-evals.mjs", "--zoning-successor-remediation-3", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v8-confirmation", "--run-live"]
]) {
  const retired = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(retired.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(retired),
    /historical Zoning successor paid runner modes are retired/i);
}
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A locked, malformed, or historical attempt created a result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v9-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v9 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v9 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v9-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(lockedAuthorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T03:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase =
    "Fixture authorization for the exact committed v9 confirmation package.";
  authorizedFixture.ownerDecision.exactSpendingCapPhrase =
    "Fixture maximum cumulative API spend of $5.";
  authorizedFixture.execution.authorizationPackageCommit = "1".repeat(40);
  await writeFile(fixturePath, `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);
  assert.equal(
    requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization(authorized),
    authorized
  );

  for (const mutate of [
    (fixture) => { fixture.authorizationID = "recycled-authorization"; },
    (fixture) => { fixture.lineage.preparedFromCommit = "2".repeat(40); },
    (fixture) => { fixture.lineage.zoningSafetySHA256 = "3".repeat(64); },
    (fixture) => { fixture.lineage.researchEconomicsSHA256 = "4".repeat(64); },
    (fixture) => { fixture.lineage.appSHA256 = "5".repeat(64); },
    (fixture) => { fixture.lineage.priorAuthorizationSHA256 = "6".repeat(64); },
    (fixture) => { fixture.scope.caseCount = 29; },
    (fixture) => { fixture.scope.repetitions = 2; },
    (fixture) => { fixture.scope.maximumCumulativeSpendUSD = 5.01; },
    (fixture) => { fixture.execution.authorizationPackageCommit = null; },
    (fixture) => { fixture.execution.webSupportEnabled = true; },
    (fixture) => { fixture.execution.stopOnExecutionError = false; },
    (fixture) => { fixture.publicResearchReleaseAuthorized = true; }
  ]) {
    const invalid = structuredClone(authorizedFixture);
    mutate(invalid);
    await writeFile(fixturePath, `${JSON.stringify(invalid, null, 2)}\n`, "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      })
    );
  }

  const runningFixture = structuredClone(authorizedFixture);
  runningFixture.status = "running";
  runningFixture.consumption.status = "running";
  runningFixture.consumption.attemptID =
    "11111111-1111-4111-8111-111111111111";
  runningFixture.consumption.startedAt = "2026-08-31T03:01:00.000Z";
  runningFixture.execution.executionCommit = "7".repeat(40);
  await writeFile(fixturePath, `${JSON.stringify(runningFixture, null, 2)}\n`, "utf8");
  const running =
    await validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(running.active, false);
  assert.throws(
    () => requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization(running),
    /requires a new explicit owner authorization and cumulative spend cap/
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Zoning remediation-successor-3 v9 confirmation guard contract passed", {
  status: current.authorization.status,
  authorizationID: exactAuthorizationID,
  exactCohortCases: current.cohort.cases.length,
  exactCohortSHA256,
  exactRepairCommit,
  exactSafetySHA256,
  exactEconomicsSHA256,
  exactAppSHA256,
  exactLockedAuthorizationSHA256,
  historicalV8AuthorizationSHA256:
    zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  historicalV8RunID: zoningRemediationSuccessor3V8ConfirmationRunID,
  directLiveAttemptBlocked: true,
  runnerAttemptBlocked: true,
  historicalLivePathsRetired: 8,
  fullMockPreflightCases: 30,
  testPaidRequests: 0,
  publicResearchReleaseAuthorized:
    current.authorization.publicResearchReleaseAuthorized
});
