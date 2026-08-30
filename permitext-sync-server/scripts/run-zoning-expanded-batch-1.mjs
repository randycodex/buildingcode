import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchCommercializationBenchmark,
  researchCommercializationBenchmarkEnvironment
} from "./run-research-commercialization-benchmark.mjs";
import { supportedResearchPromptVersions, validatePaidResearchEvaluationEnvironment } from "../research-config.mjs";

const serverRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(serverRoot, "..");
const datasetPath = resolve(serverRoot, "evals", "zoning-cases-expanded-batch-1.json");

function runEvaluation(environment) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      "tests/research-evals.mjs",
      "--zoning-expanded-batch-1",
      "--run-live",
      "--repeat",
      "1"
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
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const authorization = dataset.governance?.paidEvaluationAuthorization;
  assert(dataset.governance?.paidEvaluationAllowed === true, "Expanded Zoning paid execution is locked.");
  assert.equal(authorization?.status, "authorized", "Expanded Zoning authorization is not active.");
  assert.equal(authorization.caseCount, 30, "Authorization must cover exactly 30 cases.");
  assert.equal(authorization.repetitions, 1, "Authorization must cover exactly one repetition.");
  assert.equal(authorization.maximumCumulativeSpendUSD, 5, "Authorization must use the exact $5 cap.");
  assert.equal(dataset.cases.length, authorization.caseCount, "Frozen case count does not match the authorization.");
  assert(process.env.OPENAI_API_KEY, "Set OPENAI_API_KEY before running the paid Zoning diagnostic.");

  for (const args of [
    ["diff", "--quiet", "--", "permitext-sync-server"],
    ["diff", "--cached", "--quiet", "--", "permitext-sync-server"]
  ]) {
    const status = spawnSync("git", args, { cwd: repositoryRoot, stdio: "ignore" });
    assert.equal(status.status, 0, "Commit tracked server changes before running the Zoning diagnostic.");
  }

  const environment = {
    ...researchCommercializationBenchmarkEnvironment(process.env),
    PERMITEXT_RESEARCH_EVAL_MAX_USD: String(authorization.maximumCumulativeSpendUSD),
    PERMITEXT_RESEARCH_PROMPT_VERSION: supportedResearchPromptVersions[0],
    PERMITEXT_RESEARCH_PRICING_VERSION: "openai-gpt-5.6-terra-2026-08-30",
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-gpt-5.6-luna-2026-08-30",
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL: researchCommercializationBenchmark.accurateModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_REASONING_EFFORT: "medium",
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION: "20260826-established-facts-v3"
  };
  const validation = validatePaidResearchEvaluationEnvironment(environment);
  assert.equal(validation.approvedSpendCapUSD, 5);
  console.log(
    `Running the frozen ${dataset.cases.length}-case Zoning Batch 1 successor once with a ` +
    `$${validation.approvedSpendCapUSD.toFixed(2)} maximum cumulative paid-evaluation cap.`
  );
  const result = await runEvaluation(environment);
  if (result.signal) throw new Error(`Zoning diagnostic stopped by ${result.signal}.`);
  if (![0, 3].includes(result.code)) {
    throw new Error(`Zoning diagnostic exited with status ${result.code}.`);
  }
  if (result.code === 3) {
    console.error("The complete cohort finished, but one or more cases failed quality or execution checks.");
    process.exitCode = 3;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
