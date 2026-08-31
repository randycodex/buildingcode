import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V11ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const globalRunLockPath = new URL("../evals/.paid-evaluation-run.lock", import.meta.url);
const v11RunLockPath = new URL(
  "../evals/.zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  import.meta.url
);
const exactAuthorizationID = "ee72ca2f-5410-4ce9-a6d6-30deb8ff5169";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactRepairCommit = "cd1f3a99f32a3648dd8f0d7a8b1d540e5db29bf5";
const exactSafetySHA256 =
  "8003374fb8302a69bdcb924e2e6fe66855c11f52444f045dfb6e75bff1b476f7";
const exactEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
const exactAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
const exactLockedAuthorizationSHA256 =
  "91b712dcd50c75937253315f5d0af53862144a61e8d4e27879908d6830f10982";
const paidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const hostileEnvironment = zoningRemediationSuccessor3V11PaidRunEnvironment({
  ...process.env,
  NODE_ENV: "test",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_TEST_RESEARCH_MOCK_WEB_FIXTURE: "bb-2022-013",
  PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS: "100",
  PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS: "24000",
  PERMITEXT_TEST_RESEARCH_EVIDENCE_PACKAGE_ONLY: "1",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "on"
}, 5);
assert.equal(hostileEnvironment.NODE_ENV, "production");
assert.equal(hostileEnvironment.PERMITEXT_RESEARCH_WEB_SUPPORT, "off");
for (const key of [
  "PERMITEXT_TEST_RESEARCH_MOCK",
  "PERMITEXT_TEST_RESEARCH_MOCK_WEB_FIXTURE",
  "PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS",
  "PERMITEXT_TEST_RESEARCH_EVIDENCE_PACKAGE_ONLY"
]) assert.equal(hostileEnvironment[key], "", `${key} was not scrubbed.`);

assert.equal(zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  exactRepairCommit);
assert.equal(zoningRemediationSuccessor3V11ConfirmationSafetySHA256,
  exactSafetySHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  exactEconomicsSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  exactAppSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256);

const lockedAuthorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(lockedAuthorizationText), exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationText);
const current =
  await validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization();
assert.equal(current.authorization.authorizationID, exactAuthorizationID);
assert.equal(current.authorization.status, "locked");
assert.equal(current.active, false);
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.scope.caseCount, null);
assert.equal(current.authorization.scope.repetitions, null);
assert.equal(current.authorization.scope.maximumCumulativeSpendUSD, null);
assert.equal(current.authorization.ownerDecision.authorizedAt, null);
assert.equal(current.authorization.ownerDecision.authorizedBy, null);
assert.equal(current.authorization.ownerDecision.exactAuthorizationPhrase, null);
assert.equal(current.authorization.ownerDecision.exactSpendingCapPhrase, null);
assert.equal(current.authorization.execution.authorizationPackageCommit, null);
assert.equal(current.authorization.execution.executionCommit, null);
assert.equal(current.authorization.execution.webSupportEnabled, false);
assert.equal(current.authorization.execution.stopOnExecutionError, true);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.professionalZoningSignoff, false);
assert.equal(current.authorization.deploymentAuthorized, false);
assert.equal(current.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization(current),
  /requires a new explicit owner authorization and cumulative spend cap/
);

assert.equal(current.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256);
assert.equal(current.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit);
assert.equal(current.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit);
assert.equal(current.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V9ConfirmationRunID);
assert.equal(current.authorization.lineage.priorResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile);
assert.equal(current.authorization.lineage.priorResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256);
assert.equal(current.authorization.lineage.priorResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile);
assert.equal(current.authorization.lineage.priorResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256);

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "--remediation-3-v11-confirmation",
  ".zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit",
  "zoningRemediationSuccessor3V11ConfirmationSafetySHA256",
  "zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256",
  "zoningRemediationSuccessor3V11ConfirmationAppSHA256",
  "assertPinnedV11RuntimeInputsAtCommit",
  "zoningRemediationSuccessor3V11PaidRunEnvironment",
  "NODE_ENV: \"production\"",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS: \"\"",
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
    `The v11 confirmation runner is missing guard: ${requiredGuard}`);
}
assert.match(runnerSource,
  /if \(runnerInvokedDirectly && !remediationSuccessor3V11ConfirmationMode\)[\s\S]{0,120}retiredPaidPathMessage/,
  "Every historical paid runner mode must remain retired.");

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v11-confirmation",
  ".zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit",
  ".paid-evaluation-run.lock",
  "PERMITEXT_ZONING_PAID_RUNNER_NONCE",
  "Paid v11 confirmation requires the exact clean execution commit",
  "Only the durable running authorization may differ in the child",
  "globalRunnerLock?.nonce === runnerLock?.nonce",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit",
  "server changes other than the authorization",
  "The paid v11 child must run with a non-test NODE_ENV",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v11 confirmation evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v11-confirmation"]
]) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(blocked),
    /(?:consuming runner and active run lock|requires a new explicit owner authorization and cumulative spend cap)/i);
}
for (const args of [
  ["scripts/run-zoning-successor.mjs",
    "--remediation-3-v11-confirmation", "--remediation-3-v11-confirmation"],
  ["scripts/run-zoning-successor.mjs", "--unknown-v11-confirmation"]
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
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v9-confirmation"],
  ["tests/research-evals.mjs", "--zoning-successor", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v9-confirmation", "--run-live"]
]) {
  const retired = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(retired.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(retired),
    /historical Zoning successor paid runner modes are retired/i);
}
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A locked, malformed, or historical attempt created a result file.");

const exactHead = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: serverRoot,
  encoding: "utf8"
}).stdout.trim();
const forgedRunID = "11111111-1111-4111-8111-111111111111";
const forgedNonce = "22222222-2222-4222-8222-222222222222";
const forgedOwnerPhrase =
  `authorize exactly package commit ${exactHead} for all 30 ordered cases, one ` +
  "repetition, with a maximum cumulative API spend of $5.";
const forgedAuthorization = structuredClone(lockedAuthorization);
forgedAuthorization.status = "running";
forgedAuthorization.scope.caseCount = 30;
forgedAuthorization.scope.repetitions = 1;
forgedAuthorization.scope.maximumCumulativeSpendUSD = 5;
forgedAuthorization.ownerDecision.authorizedAt = "2026-08-31T20:00:00.000Z";
forgedAuthorization.ownerDecision.authorizedBy = "Permitext owner";
forgedAuthorization.ownerDecision.exactAuthorizationPhrase = forgedOwnerPhrase;
forgedAuthorization.ownerDecision.exactSpendingCapPhrase = forgedOwnerPhrase;
forgedAuthorization.consumption = {
  status: "running",
  attemptID: forgedRunID,
  startedAt: "2026-08-31T20:00:01.000Z",
  runID: null,
  consumedAt: null
};
forgedAuthorization.execution.authorizationPackageCommit = exactHead;
forgedAuthorization.execution.executionCommit = exactHead;
const forgedLock = `${JSON.stringify({
  pid: process.pid,
  runID: forgedRunID,
  nonce: forgedNonce,
  executionCommit: exactHead
})}\n`;
let globalLockCreated = false;
let cohortLockCreated = false;
try {
  await writeFile(globalRunLockPath, forgedLock, { encoding: "utf8", flag: "wx" });
  globalLockCreated = true;
  await writeFile(v11RunLockPath, forgedLock, { encoding: "utf8", flag: "wx" });
  cohortLockCreated = true;
  await writeFile(
    authorizationPath,
    `${JSON.stringify(forgedAuthorization, null, 2)}\n`,
    "utf8"
  );
  const forgedDirectAttempt = spawnSync(process.execPath, [
    "tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation",
    "--run-live",
    "--repeat", "1",
    "--stop-on-execution-error",
    "--run-id", forgedRunID
  ], {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...hostileEnvironment,
      OPENAI_API_KEY: "forged-direct-attempt-must-not-dispatch",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
      PERMITEXT_ZONING_PAID_RUNNER_NONCE: forgedNonce
    },
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(forgedDirectAttempt.status, 1,
    "A forged direct-evaluator parent unexpectedly dispatched.");
  assert.match(combinedOutput(forgedDirectAttempt),
    /(?:server changes other than the authorization|Only the durable running authorization may differ)/i);
} finally {
  await writeFile(authorizationPath, lockedAuthorizationText, "utf8");
  if (cohortLockCreated) await rm(v11RunLockPath, { force: true });
  if (globalLockCreated) await rm(globalRunLockPath, { force: true });
}
assert.equal(sha256(await readFile(authorizationPath, "utf8")),
  exactLockedAuthorizationSHA256,
"The forged-lock regression did not restore the locked authorization.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The forged-lock regression created a paid result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v11-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v11 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v11 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v11-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(lockedAuthorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T20:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  const fixturePackageCommit = "1".repeat(40);
  const fixtureOwnerPhrase =
    `authorize exactly package commit ${fixturePackageCommit} for all 30 ordered ` +
    "cases, one repetition, with a maximum cumulative API spend of $5.";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase =
    fixtureOwnerPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase =
    fixtureOwnerPhrase;
  authorizedFixture.execution.authorizationPackageCommit = fixturePackageCommit;
  await writeFile(fixturePath, `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);
  assert.equal(authorized.authorization.scope.caseCount, 30);
  assert.equal(authorized.authorization.scope.repetitions, 1);
  assert.equal(authorized.authorization.scope.maximumCumulativeSpendUSD, 5);

  for (const [label, mutate, expected] of [
    ["wrong safety SHA", (fixture) => {
      fixture.lineage.zoningSafetySHA256 = "0".repeat(64);
    }, /wrong Zoning safety SHA/],
    ["wrong prior authorization", (fixture) => {
      fixture.lineage.priorAuthorizationSHA256 = "0".repeat(64);
    }, /wrong historical v9 authorization SHA/],
    ["web enabled", (fixture) => {
      fixture.execution.webSupportEnabled = true;
    }, /may not enable unbudgeted web search/],
    ["candidate enabled", (fixture) => {
      fixture.evidenceBudgetCandidateEnabled = true;
    }, /24,000-character evidence candidate must remain disabled/],
    ["missing exact cap phrase", (fixture) => {
      fixture.ownerDecision.exactSpendingCapPhrase = null;
    }, /same exact package-bound spending-cap phrase/],
    ["mismatched phrase package", (fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("1".repeat(40), "2".repeat(40));
    }, /bind the owner's exact phrase to the selected package and scope/],
    ["mismatched phrase scope", (fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("all 30", "all 29");
    }, /bind the owner's exact phrase to the selected package and scope/],
    ["mismatched structured cap", (fixture) => {
      fixture.scope.maximumCumulativeSpendUSD = 4;
    }, /exact 30-case, one-repetition, \$5 scope/]
  ]) {
    const fixture = structuredClone(authorizedFixture);
    mutate(fixture);
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected,
      label
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The v11 authorization contract created a paid result file.");
console.log(
  "Locked Zoning remediation-successor-3 v11 confirmation authorization contract passed for 30 ordered cases. No paid model calls were made."
);
