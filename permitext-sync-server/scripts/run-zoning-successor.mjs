import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
  console.log(
    `Running the exact frozen ${cohort.cases.length}-case owner-approved Zoning successor ` +
    `once with a $${paidEnvironment.approvedSpendCapUSD.toFixed(2)} maximum cumulative cap. ` +
    "The 24,000-character candidate remains disabled."
  );
  const result = await runEvaluation(environment, authorization.scope.repetitions);
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
