import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { researchAnswerQualityVersion } from "../research-answer-quality.mjs";
import { researchSourcePolicyVersion } from "../research-source-policy.mjs";
import {
  researchCommercializationBenchmarkEnvironment
} from "./run-research-commercialization-benchmark.mjs";

/**
 * Frozen post-v22-remediation cohort for the Beta 1 Research quality and
 * economics decision. Record its terminal result before another cohort is
 * authorized so this profile cannot spend twice.
 */
export const researchCommercializationBenchmarkV5 = Object.freeze({
  id: "20260828-commercialization-cohort-v5",
  targetQuestionCount: 20,
  minimumCompletedTurns: 20,
  excludedSafetyCaseIDs: Object.freeze([
    "nyc-018-fire-district-map-boundary"
  ]),
  promptVersion: "20260827-material-completeness-v31",
  evidenceVersion: "selected-multimodal-evidence-v3",
  evidenceAssemblyVersion: "20260827-pinned-evidence-budget-v20",
  sourcePolicyVersion: "20260828-supporting-web-v10",
  routingVersion: "20260827-luna-terra-hybrid-v4",
  answerQualityVersion: "20260828-prior-code-accessibility-repair-v22",
  judgePromptVersion: "20260826-established-facts-v3",
  accurateModel: "gpt-5.6-terra",
  fastModel: "gpt-5.6-luna",
  routingMode: "hybrid",
  applicationCommit: "db2c0e9e67f95b2b36f22912628bee457edf0468",
  completedAt: "2026-08-28T01:55:13.996Z",
  resultStatus: "partial",
  resultFile: "evals/results/2026-08-28T01-49-25-092Z-8aaf2e22-a707-496a-ba66-5e2f5275c983.json"
});

export function researchCommercializationBenchmarkV5Environment(environment = process.env) {
  const profile = researchCommercializationBenchmarkV5;
  return {
    ...researchCommercializationBenchmarkEnvironment(environment),
    PERMITEXT_RESEARCH_EVAL_MAX_USD: "4.00",
    PERMITEXT_RESEARCH_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_ACCURATE_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_FAST_MODEL: profile.fastModel,
    PERMITEXT_RESEARCH_ROUTING_MODE: profile.routingMode,
    PERMITEXT_RESEARCH_PROMPT_VERSION: profile.promptVersion,
    PERMITEXT_RESEARCH_EVIDENCE_VERSION: profile.evidenceVersion,
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION: profile.judgePromptVersion,
    PERMITEXT_RESEARCH_ECONOMICS_MINIMUM_COMPLETED_TURNS:
      String(profile.minimumCompletedTurns)
  };
}

export function validateResearchCommercializationBenchmarkV5() {
  const profile = researchCommercializationBenchmarkV5;
  assert.equal(profile.targetQuestionCount, 20);
  assert.equal(profile.minimumCompletedTurns, 20);
  assert.deepEqual(profile.excludedSafetyCaseIDs, ["nyc-018-fire-district-map-boundary"]);
  assert.equal(new Set(profile.excludedSafetyCaseIDs).size, profile.excludedSafetyCaseIDs.length);
  assert.match(profile.applicationCommit, /^[a-f0-9]{40}$/);
  assert.equal(profile.sourcePolicyVersion, "20260828-supporting-web-v10");
  assert.equal(profile.answerQualityVersion, "20260828-prior-code-accessibility-repair-v22");
  if (!profile.completedAt) {
    assert.equal(profile.sourcePolicyVersion, researchSourcePolicyVersion);
    assert.equal(profile.answerQualityVersion, researchAnswerQualityVersion);
  }
  if (profile.completedAt || profile.resultFile || profile.resultStatus) {
    assert(profile.completedAt && Number.isFinite(Date.parse(profile.completedAt)));
    assert(["complete", "partial", "failed"].includes(profile.resultStatus));
    assert(profile.resultFile?.endsWith(".json"));
  }
  return profile;
}

function runEvaluation(profile, environment) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      "tests/research-evals.mjs",
      "--run-live",
      "--include-drafts",
      "--stop-on-error",
      ...profile.excludedSafetyCaseIDs.flatMap((caseID) => ["--exclude-case", caseID])
    ], {
      cwd: resolve(fileURLToPath(new URL("..", import.meta.url))),
      env: environment,
      stdio: "inherit"
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

async function main() {
  const profile = validateResearchCommercializationBenchmarkV5();
  if (profile.completedAt) {
    throw new Error(
      `The v5 commercialization benchmark already completed at ${profile.completedAt}. ` +
      "Create a new immutable profile before authorizing another paid run."
    );
  }
  assert(process.env.OPENAI_API_KEY, "Set OPENAI_API_KEY before running the paid benchmark.");
  const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const serverPath = "permitext-sync-server";
  for (const args of [
    ["diff", "--quiet", "--", serverPath],
    ["diff", "--cached", "--quiet", "--", serverPath]
  ]) {
    const status = spawnSync("git", args, { cwd: repositoryRoot, stdio: "ignore" });
    assert.equal(status.status, 0, "Commit tracked server changes before running the benchmark.");
  }
  const environment = researchCommercializationBenchmarkV5Environment();
  console.log(
    `Running ${profile.id}: ${profile.targetQuestionCount} distinct Research questions ` +
    `with a $${environment.PERMITEXT_RESEARCH_EVAL_MAX_USD} paid-evaluation cap and stop-on-error-or-quality-failure enabled.`
  );
  const result = await runEvaluation(profile, environment);
  if (result.signal) throw new Error(`Research benchmark stopped by ${result.signal}.`);
  if (![0, 3].includes(result.code)) {
    throw new Error(`Research benchmark suite exited with status ${result.code}.`);
  }
  if (result.code === 3) {
    console.error("The cohort ended with one or more quality failures or a provider error.");
    process.exitCode = 3;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
