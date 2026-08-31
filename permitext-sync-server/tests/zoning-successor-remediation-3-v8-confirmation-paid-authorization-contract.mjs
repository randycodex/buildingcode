import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V8ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V8ConfirmationRunID,
  zoningRemediationSuccessor3V8ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.mjs";

const serverRoot = new URL("../", import.meta.url);
const defaultAuthorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "151aa121-7962-48d1-80b3-56728e62fc75";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactRepairCommit = "747887054e1bba16578a44477720f813a55fc357";
const exactSafetySHA256 =
  "62bb5459c2ea22f981b4b2b0367d25b7086c7d86bf0d0cb92d582ae1d817dc94";
const exactLockedAuthorizationSHA256 =
  "b84e663c5eeaadf83b42d8a0a208aa6021d39a0d5d6912cbbdbaabcdc0f664c6";
const exactAuthorizationPackageCommit =
  "7cc2af325dbb3c5c98e4e15e2c15196a4794cb76";
const exactExecutionCommit =
  "9d4af1b31762568caa5accf63b52e275f0e39bde";
const exactRunID = "1521497c-8df4-4ed9-98ce-79ef2805d1a6";
const exactConsumedAuthorizationSHA256 =
  "f9d01e8f94d96d3bc7e8e0a71fc43f183ed31b686a6e773e204fc0afc3872e58";
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
  "--remediation-3-v8-confirmation",
  ".zoning-successor-remediation-3-v8-confirmation-paid-run.lock",
  "authorizationPackageCommit",
  "assertExactLockedAuthorizationPackage",
  "zoningRemediationSuccessor3V8ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit",
  "zoningRemediationSuccessor3V8ConfirmationSafetySHA256",
  "gitOutput",
  "show",
  "merge-base",
  "Only the locked authorization record may change",
  "executionCommit",
  "pendingPaidRequestCount",
  "webSupportRequested",
  "webSupportSearched",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\"",
  "beginAuthorizationAttempt",
  "completed",
  "paidRequestCount",
  "AggregateError"
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v8 confirmation runner is missing guard: ${requiredGuard}`);
}
const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v8-confirmation",
  ".zoning-successor-remediation-3-v8-confirmation-paid-run.lock",
  ".paid-evaluation-run.lock",
  "PERMITEXT_ZONING_PAID_RUNNER_NONCE",
  "exact clean execution commit",
  "Only the durable running authorization may differ in the child",
  "globalRunnerLock?.nonce === runnerLock?.nonce",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v8 confirmation evaluator is missing guard: ${requiredGuard}`);
}
assert(evaluatorSource.includes("rename(temporaryPath, jsonPath)"),
  "Evaluation snapshots must be replaced atomically.");
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit,
  exactRepairCommit
);
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationSafetySHA256,
  exactSafetySHA256
);
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationAuthorizationPackageCommit,
  exactAuthorizationPackageCommit
);
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationExecutionCommit,
  exactExecutionCommit
);
assert.equal(zoningRemediationSuccessor3V8ConfirmationRunID, exactRunID);
assert.equal(
  zoningRemediationSuccessor3V8ConfirmationConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256
);

for (const [file, expectedHash, expectedRunID] of [
  ["zoning-successor-paid-authorization.json",
    "572a06bab1c45d06be2ca80dfc95b5ce80f25777bf8ee35758ba90c5cd6e67cb",
    "5480ed8f-6d0c-46b1-a108-d12e8e13b7da"],
  ["zoning-successor-remediation-2-paid-authorization.json",
    "671a88a1445f2c8c818fdf8746795cab95121fed425d916953cc8f4fa93511e0",
    "f35eed33-cb4e-4b7b-a719-86b072271660"],
  ["zoning-successor-remediation-3-paid-authorization.json",
    "f25b5c41897c6aaa251f812e1b0565cd69d661cb2ae60886d446a9a26df26bd9",
    "b4ef6990-5347-40d5-8654-611b893e8f1b"]
]) {
  const text = await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8");
  const authorization = JSON.parse(text);
  assert.equal(sha256(text), expectedHash);
  assert.equal(authorization.status, "consumed");
  assert.equal(authorization.consumption.runID, expectedRunID);
}

const current =
  await validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization();
const consumedAuthorizationText = await readFile(defaultAuthorizationPath, "utf8");
assert.equal(sha256(consumedAuthorizationText), exactConsumedAuthorizationSHA256);
assert.equal(current.authorization.authorizationID, exactAuthorizationID);
assert.equal(current.authorization.status, "consumed");
assert.equal(current.active, false);
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.scope.caseCount, 30);
assert.equal(current.authorization.scope.repetitions, 1);
assert.equal(current.authorization.scope.maximumCumulativeSpendUSD, 5);
assert.equal(
  current.authorization.ownerDecision.exactAuthorizationPhrase,
  "I authorize exactly package commit 7cc2af325dbb3c5c98e4e15e2c15196a4794cb76 for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5."
);
assert.equal(
  current.authorization.ownerDecision.exactSpendingCapPhrase,
  "with a maximum cumulative API spend of $5."
);
assert.equal(
  current.authorization.execution.authorizationPackageCommit,
  exactAuthorizationPackageCommit
);
assert.equal(current.authorization.execution.executionCommit, exactExecutionCommit);
assert.equal(current.authorization.consumption.attemptID, exactRunID);
assert.equal(current.authorization.consumption.runID, exactRunID);
assert.equal(current.authorization.lineage.preparedFromCommit, exactRepairCommit);
assert.equal(current.authorization.lineage.zoningSafetySHA256, exactSafetySHA256);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization(current),
  /requires a new explicit owner authorization and cumulative spend cap/
);

const lockedAuthorizationBlob = spawnSync("git", [
  "show",
  `${exactAuthorizationPackageCommit}:permitext-sync-server/evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.json`
], {
  cwd: serverRoot,
  encoding: "utf8"
});
assert.equal(lockedAuthorizationBlob.status, 0, combinedOutput(lockedAuthorizationBlob));
assert.equal(sha256(lockedAuthorizationBlob.stdout), exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationBlob.stdout);
assert.equal(lockedAuthorization.status, "locked");
assert.equal(lockedAuthorization.authorizationID, exactAuthorizationID);
assert.equal(lockedAuthorization.scope.caseCount, null);

for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V8ConfirmationResultJSONFile,
    zoningRemediationSuccessor3V8ConfirmationResultJSONSHA256],
  [zoningRemediationSuccessor3V8ConfirmationResultMarkdownFile,
    zoningRemediationSuccessor3V8ConfirmationResultMarkdownSHA256]
]) {
  assert.equal(
    sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash
  );
}

const resultsBefore = (await readdir(resultsPath)).sort();
const blockedAttempts = [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v8-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v8-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v8-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v8-confirmation"]
];
for (const args of blockedAttempts) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(
    combinedOutput(blocked),
    /(?:consuming runner and active run lock|requires a new explicit owner authorization and cumulative spend cap)/i
  );
}
for (const args of [
  ["scripts/run-zoning-successor.mjs",
    "--remediation-3-v8-confirmation", "--remediation-3-v8-confirmation"],
  ["scripts/run-zoning-successor.mjs", "--unknown-v8-confirmation"]
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
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A locked or malformed v8 confirmation attempt created a result file.");

for (const args of [
  ["scripts/run-zoning-successor.mjs"],
  ["scripts/run-zoning-successor.mjs", "--remediation-2"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3"],
  ["tests/research-evals.mjs", "--zoning-successor", "--run-live"],
  ["tests/research-evals.mjs", "--zoning-successor-remediation-2", "--run-live"],
  ["tests/research-evals.mjs", "--zoning-successor-remediation-3", "--run-live"]
]) {
  const retired = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(retired.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(retired), /historical Zoning successor paid runner modes are retired/i);
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v8-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const lockedFixture = structuredClone(lockedAuthorization);
  const authorizedFixture = structuredClone(lockedFixture);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T01:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase =
    "Fixture authorization for the exact committed v8 confirmation package.";
  authorizedFixture.ownerDecision.exactSpendingCapPhrase =
    "Fixture maximum cumulative API spend of $5.";
  authorizedFixture.execution.authorizationPackageCommit = "1".repeat(40);
  await writeFile(
    fixturePath,
    `${JSON.stringify(authorizedFixture, null, 2)}\n`,
    "utf8"
  );
  const authorized =
    await validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);
  assert.equal(
    requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization(authorized),
    authorized
  );

  for (const mutate of [
    (fixture) => { fixture.authorizationID = "recycled-consumed-authorization"; },
    (fixture) => { fixture.lineage.preparedFromCommit = "2".repeat(40); },
    (fixture) => { fixture.lineage.zoningSafetySHA256 = "3".repeat(64); },
    (fixture) => { fixture.scope.caseCount = 29; },
    (fixture) => { fixture.scope.repetitions = 2; },
    (fixture) => { fixture.scope.maximumCumulativeSpendUSD = 5.01; },
    (fixture) => { fixture.execution.authorizationPackageCommit = null; },
    (fixture) => { fixture.execution.webSupportEnabled = true; },
    (fixture) => { fixture.execution.stopOnExecutionError = false; }
  ]) {
    const invalid = structuredClone(authorizedFixture);
    mutate(invalid);
    await writeFile(fixturePath, `${JSON.stringify(invalid, null, 2)}\n`, "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      })
    );
  }

  const runningFixture = structuredClone(authorizedFixture);
  runningFixture.status = "running";
  runningFixture.consumption.status = "running";
  runningFixture.consumption.attemptID =
    "11111111-1111-4111-8111-111111111111";
  runningFixture.consumption.startedAt = "2026-08-31T01:01:00.000Z";
  runningFixture.execution.executionCommit = "4".repeat(40);
  await writeFile(
    fixturePath,
    `${JSON.stringify(runningFixture, null, 2)}\n`,
    "utf8"
  );
  const running =
    await validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(running.active, false);
  assert.throws(
    () => requireActiveZoningRemediationSuccessor3V8ConfirmationPaidAuthorization(running),
    /requires a new explicit owner authorization and cumulative spend cap/
  );

  await assert.rejects(
    validateZoningRemediationSuccessor3V8ConfirmationPaidAuthorization({
      authorizationPath: new URL(
        "../evals/zoning-successor-remediation-3-paid-authorization.json",
        import.meta.url
      )
    }),
    /wrong unique identity/i
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Zoning remediation-successor-3 v8 confirmation guard contract passed", {
  status: current.authorization.status,
  authorizationID: exactAuthorizationID,
  exactCohortCases: current.cohort.cases.length,
  exactCohortSHA256,
  exactRepairCommit,
  exactSafetySHA256,
  exactLockedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256,
  exactAuthorizationPackageCommit,
  exactExecutionCommit,
  exactRunID,
  priorAuthorizationsConsumedAndUnchanged: 3,
  historicalLivePathsRetired: 6,
  directLiveAttemptBlocked: true,
  runnerAttemptBlocked: true,
  retainedPaidRequests: 10,
  testPaidRequests: 0,
  publicResearchReleaseAuthorized:
    current.authorization.publicResearchReleaseAuthorized
});
