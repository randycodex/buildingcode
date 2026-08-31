import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "../evals/zoning-successor-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor2PaidAuthorization,
  validateZoningRemediationSuccessor2PaidAuthorization
} from "../evals/zoning-successor-remediation-2-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor3PaidAuthorization,
  validateZoningRemediationSuccessor3PaidAuthorization
} from "../evals/zoning-successor-remediation-3-paid-authorization.mjs";
import {
  researchCommercializationBenchmark,
  researchCommercializationBenchmarkEnvironment
} from "./run-research-commercialization-benchmark.mjs";
import {
  supportedResearchPromptVersions,
  validatePaidResearchEvaluationEnvironment
} from "../research-config.mjs";

const serverRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(serverRoot, "..");
const resultsDirectory = resolve(serverRoot, "evals", "results");
const globalRunLockPath = resolve(serverRoot, "evals", ".paid-evaluation-run.lock");
const runnerArguments = process.argv.slice(2);
assert(
  runnerArguments.length <= 1 &&
    runnerArguments.every((argument) =>
      ["--remediation-2", "--remediation-3"].includes(argument)),
  "Unsupported Zoning successor paid-run argument."
);
const remediationSuccessor2Mode = process.argv.includes("--remediation-2");
const remediationSuccessor3Mode = process.argv.includes("--remediation-3");
const authorizationPath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3Mode
    ? "zoning-successor-remediation-3-paid-authorization.json"
    : remediationSuccessor2Mode
    ? "zoning-successor-remediation-2-paid-authorization.json"
    : "zoning-successor-paid-authorization.json"
);
const authorizationModulePath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3Mode
    ? "zoning-successor-remediation-3-paid-authorization.mjs"
    : remediationSuccessor2Mode
    ? "zoning-successor-remediation-2-paid-authorization.mjs"
    : "zoning-successor-paid-authorization.mjs"
);
const runLockPath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3Mode
    ? ".zoning-successor-remediation-3-paid-run.lock"
    : remediationSuccessor2Mode
    ? ".zoning-successor-remediation-2-paid-run.lock"
    : ".zoning-successor-paid-run.lock"
);

async function acquireRunLock(lockPath, label, evidence) {
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `A ${label} paid run is already active or its fail-closed lock requires review.`
      );
    }
    throw error;
  }
  await handle.writeFile(`${JSON.stringify(evidence)}\n`, "utf8");
  return async () => {
    await handle.close();
    await rm(lockPath, { force: true });
  };
}

async function writeAuthorizationAtomically(authorization) {
  const temporaryPath = `${authorizationPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(authorization, null, 2)}\n`, "utf8");
  await rename(temporaryPath, authorizationPath);
}

async function beginAuthorizationAttempt(runID) {
  const authorization = JSON.parse(await readFile(authorizationPath, "utf8"));
  assert.equal(authorization.status, "authorized",
    "The one-time authorization was not active before provider dispatch.");
  authorization.status = "running";
  authorization.consumption = {
    status: "running",
    attemptID: runID,
    startedAt: new Date().toISOString(),
    runID: null,
    consumedAt: null
  };
  authorization.notes =
    `One-time authorization entered fail-closed running state for attempt ${runID}. ` +
    "A crash or missing result requires manual review and may not be retried automatically.";
  await writeAuthorizationAtomically(authorization);
  return authorization;
}

async function consumeAuthorization({ runID, cohort, cohortSHA256 }) {
  const resultNames = (await readdir(resultsDirectory))
    .filter((name) => name.endsWith(`-${runID}.json`));
  assert.equal(resultNames.length, 1,
    "The paid run did not produce exactly one result bound to its durable attempt ID; authorization remains fail-closed for manual review.");
  const resultFile = resolve(resultsDirectory, resultNames[0]);
  const result = JSON.parse(await readFile(resultFile, "utf8"));
  assert.equal(result.configuration?.runID, runID,
    "The new result is not bound to the pre-dispatch attempt ID.");
  assert.equal(result.configuration?.datasetSHA256, cohortSHA256,
    "The new result is not bound to the authorized successor SHA.");
  assert.equal(result.configuration?.repeat, 1,
    "The new result does not record the authorized one repetition.");
  assert.deepEqual(result.configuration?.caseIDs, cohort.cases.map((item) => item.id),
    "The new result does not contain the exact authorized case order.");
  assert.match(result.configuration?.runID || "", /^[0-9a-f-]{36}$/i,
    "The new result has no valid run ID.");
  if (remediationSuccessor3Mode) {
    assert.equal(result.configuration?.webSupportEnabled, false,
      "The capped remediation-successor-3 result unexpectedly enabled unbudgeted web-search fees.");
    assert.equal(result.configuration?.stopOnExecutionError, true,
      "The remediation-successor-3 result did not retain its fail-fast execution policy.");
  }

  const authorization = JSON.parse(await readFile(authorizationPath, "utf8"));
  assert.equal(authorization.status, "running",
    "The one-time authorization was not in its fail-closed running state when the run completed.");
  assert.equal(authorization.consumption?.attemptID, runID,
    "The running authorization does not match the completed attempt.");
  authorization.status = "consumed";
  authorization.consumption = {
    ...authorization.consumption,
    status: "consumed",
    runID: result.configuration.runID,
    consumedAt: new Date().toISOString()
  };
  authorization.notes =
    `One-time authorization consumed by ${resultNames[0]}. ` +
    "The result still requires quality, cost, and release-gate review.";
  await writeAuthorizationAtomically(authorization);
  return { resultFile, result };
}

function runEvaluation(environment, repetitions, runID) {
  return new Promise((resolveRun, rejectRun) => {
    const childArguments = [
      "tests/research-evals.mjs",
      remediationSuccessor3Mode
        ? "--zoning-successor-remediation-3"
        : remediationSuccessor2Mode
        ? "--zoning-successor-remediation-2"
        : "--zoning-successor",
      "--run-live",
      "--repeat",
      String(repetitions),
      "--run-id",
      runID,
      ...(remediationSuccessor3Mode ? ["--stop-on-execution-error"] : [])
    ];
    const child = spawn(process.execPath, childArguments, {
      cwd: serverRoot,
      env: environment,
      stdio: "inherit"
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

async function main() {
  const validation = remediationSuccessor3Mode
    ? requireActiveZoningRemediationSuccessor3PaidAuthorization(
        await validateZoningRemediationSuccessor3PaidAuthorization()
      )
    : remediationSuccessor2Mode
    ? requireActiveZoningRemediationSuccessor2PaidAuthorization(
        await validateZoningRemediationSuccessor2PaidAuthorization()
      )
    : requireActiveZoningSuccessorPaidAuthorization(
        await validateZoningSuccessorPaidAuthorization()
      );
  const { authorization, cohort } = validation;
  assert.equal(cohort.cases.length, authorization.scope.caseCount,
    "Frozen successor case count does not match the authorization.");
  assert(process.env.OPENAI_API_KEY,
    "Set OPENAI_API_KEY before running the paid Zoning successor diagnostic.");

  const requiredTrackedPaths = [
    resolve(serverRoot, "scripts", "run-zoning-successor.mjs"),
    resolve(serverRoot, "tests", "research-evals.mjs"),
    resolve(serverRoot, "evals", "zoning-successor-paid-authorization.mjs"),
    authorizationModulePath,
    authorizationPath,
    validation.cohortPath
  ].map((path) => relative(repositoryRoot, path));
  const trackedStatus = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", ...requiredTrackedPaths],
    { cwd: repositoryRoot, stdio: "ignore" }
  );
  assert.equal(trackedStatus.status, 0,
    "Every paid-run input, authorization, and guard must be tracked at HEAD before dispatch.");

  for (const args of [
    ["diff", "--quiet", "--", "permitext-sync-server"],
    ["diff", "--cached", "--quiet", "--", "permitext-sync-server"]
  ]) {
    const status = spawnSync("git", args, {
      cwd: repositoryRoot,
      stdio: "ignore"
    });
    assert.equal(status.status, 0,
      "Commit tracked server changes before running the Zoning successor diagnostic.");
  }

  const environment = {
    ...researchCommercializationBenchmarkEnvironment(process.env),
    PERMITEXT_RESEARCH_EVAL_MAX_USD:
      String(authorization.scope.maximumCumulativeSpendUSD),
    PERMITEXT_RESEARCH_PROMPT_VERSION: supportedResearchPromptVersions[0],
    PERMITEXT_RESEARCH_PRICING_VERSION: "openai-gpt-5.6-terra-2026-08-30",
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-gpt-5.6-luna-2026-08-30",
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL:
      researchCommercializationBenchmark.accurateModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_REASONING_EFFORT: "medium",
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION:
      "20260826-established-facts-v3",
    ...(remediationSuccessor3Mode
      ? { PERMITEXT_RESEARCH_WEB_SUPPORT: "off" }
      : {})
  };
  const paidEnvironment = validatePaidResearchEvaluationEnvironment(environment);
  assert.equal(
    paidEnvironment.approvedSpendCapUSD,
    authorization.scope.maximumCumulativeSpendUSD
  );
  const runID = randomUUID();
  const runnerNonce = randomUUID();
  environment.PERMITEXT_ZONING_PAID_RUNNER_NONCE = runnerNonce;
  const releaseGlobalRunLock = await acquireRunLock(
    globalRunLockPath,
    "global Permitext evaluation",
    { pid: process.pid, runID }
  );
  let releaseRunLock;
  let result;
  let consumed;
  try {
    releaseRunLock = await acquireRunLock(
      runLockPath,
      "Zoning successor",
      { pid: process.pid, runID, nonce: runnerNonce }
    );
    await beginAuthorizationAttempt(runID);
    console.log(
      `Running the exact frozen ${cohort.cases.length}-case owner-approved Zoning ` +
      `${remediationSuccessor3Mode
        ? "remediation successor 3"
        : remediationSuccessor2Mode ? "remediation successor 2" : "successor"} ` +
      `once with a $${paidEnvironment.approvedSpendCapUSD.toFixed(2)} maximum cumulative cap. ` +
      "The 24,000-character candidate remains disabled."
    );
    result = await runEvaluation(
      environment,
      authorization.scope.repetitions,
      runID
    );
    consumed = await consumeAuthorization({
      runID,
      cohort,
      cohortSHA256: authorization.cohort.sha256
    });
    console.log(
      `Consumed the one-time authorization for run ${consumed.result.configuration.runID}.`
    );
  } finally {
    if (releaseRunLock) await releaseRunLock();
    await releaseGlobalRunLock();
  }
  if (result.signal) throw new Error(`Zoning successor diagnostic stopped by ${result.signal}.`);
  if (![0, 3].includes(result.code)) {
    throw new Error(`Zoning successor diagnostic exited with status ${result.code}.`);
  }
  if (result.code === 3) {
    console.error(
      "The complete cohort finished, but one or more cases failed quality or execution checks."
    );
    process.exitCode = 3;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
