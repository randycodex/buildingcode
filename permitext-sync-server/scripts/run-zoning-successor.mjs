import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "../evals/zoning-successor-paid-authorization.mjs";
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
const authorizationPath = resolve(
  serverRoot,
  "evals",
  "zoning-successor-paid-authorization.json"
);
const runLockPath = resolve(
  serverRoot,
  "evals",
  ".zoning-successor-paid-run.lock"
);

async function acquireRunLock() {
  let handle;
  try {
    handle = await open(runLockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        "A Zoning successor paid run is already active or its fail-closed lock requires review."
      );
    }
    throw error;
  }
  await handle.writeFile(`${process.pid}\n`, "utf8");
  return async () => {
    await handle.close();
    await rm(runLockPath, { force: true });
  };
}

async function resultFiles() {
  return new Set(
    (await readdir(resultsDirectory))
      .filter((name) => name.endsWith(".json"))
  );
}

async function consumeAuthorization({ beforeResults, cohort, cohortSHA256 }) {
  const afterResults = await resultFiles();
  const newFiles = [...afterResults].filter((name) => !beforeResults.has(name));
  assert.equal(newFiles.length, 1,
    "The paid run did not produce exactly one new machine-result file; authorization remains active for manual review.");
  const resultFile = resolve(resultsDirectory, newFiles[0]);
  const result = JSON.parse(await readFile(resultFile, "utf8"));
  assert.equal(result.configuration?.datasetSHA256, cohortSHA256,
    "The new result is not bound to the authorized successor SHA.");
  assert.equal(result.configuration?.repeat, 1,
    "The new result does not record the authorized one repetition.");
  assert.deepEqual(result.configuration?.caseIDs, cohort.cases.map((item) => item.id),
    "The new result does not contain the exact authorized case order.");
  assert.match(result.configuration?.runID || "", /^[0-9a-f-]{36}$/i,
    "The new result has no valid run ID.");

  const authorization = JSON.parse(await readFile(authorizationPath, "utf8"));
  assert.equal(authorization.status, "authorized",
    "The one-time authorization was not active when the run completed.");
  authorization.status = "consumed";
  authorization.consumption = {
    status: "consumed",
    runID: result.configuration.runID,
    consumedAt: new Date().toISOString()
  };
  authorization.notes =
    `One-time authorization consumed by ${newFiles[0]}. ` +
    "The result still requires quality, cost, and release-gate review.";
  const temporaryPath = `${authorizationPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(authorization, null, 2)}\n`, "utf8");
  await rename(temporaryPath, authorizationPath);
  return { resultFile, result };
}

function runEvaluation(environment, repetitions) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      "tests/research-evals.mjs",
      "--zoning-successor",
      "--run-live",
      "--repeat",
      String(repetitions)
    ], {
      cwd: serverRoot,
      env: environment,
      stdio: "inherit"
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

async function main() {
  const validation = requireActiveZoningSuccessorPaidAuthorization(
    await validateZoningSuccessorPaidAuthorization()
  );
  const { authorization, cohort } = validation;
  assert.equal(cohort.cases.length, authorization.scope.caseCount,
    "Frozen successor case count does not match the authorization.");
  assert(process.env.OPENAI_API_KEY,
    "Set OPENAI_API_KEY before running the paid Zoning successor diagnostic.");

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
      "20260826-established-facts-v3"
  };
  const paidEnvironment = validatePaidResearchEvaluationEnvironment(environment);
  assert.equal(
    paidEnvironment.approvedSpendCapUSD,
    authorization.scope.maximumCumulativeSpendUSD
  );
  const releaseRunLock = await acquireRunLock();
  let result;
  let consumed;
  try {
    const beforeResults = await resultFiles();
    console.log(
      `Running the exact frozen ${cohort.cases.length}-case owner-approved Zoning successor ` +
      `once with a $${paidEnvironment.approvedSpendCapUSD.toFixed(2)} maximum cumulative cap. ` +
      "The 24,000-character candidate remains disabled."
    );
    result = await runEvaluation(environment, authorization.scope.repetitions);
    consumed = await consumeAuthorization({
      beforeResults,
      cohort,
      cohortSHA256: authorization.cohort.sha256
    });
    console.log(
      `Consumed the one-time authorization for run ${consumed.result.configuration.runID}.`
    );
  } finally {
    await releaseRunLock();
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
