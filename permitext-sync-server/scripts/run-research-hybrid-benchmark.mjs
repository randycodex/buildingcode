import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const frozenResearchHybridBenchmark = Object.freeze({
  id: "20260826-hybrid-economics-baseline-v1",
  targetCompletedTurns: 27,
  diagnosticCaseCount: 21,
  approvedCaseCount: 6,
  promptVersion: "20260826-current-facts-answer-v15",
  evidenceVersion: "selected-multimodal-evidence-v3",
  evidenceAssemblyVersion: "20260826-pinned-prose-context-v15",
  routingVersion: "20260825-luna-terra-hybrid-v2",
  judgePromptVersion: "20260826-established-facts-v3",
  answerModel: "gpt-5.6-terra",
  fastModel: "gpt-5.6-luna",
  routingMode: "hybrid",
  gitCommit: "ecc20bb0616719e29a0f70f50e3126217bf4b8d9",
  completedAt: "2026-08-27T00:58:14.866Z",
  resultFiles: Object.freeze({
    diagnostic: "2026-08-27T00-30-43-437Z-6d2193f1-3f44-4583-914b-0efd4a2d08a7.json",
    approved: "2026-08-27T00-52-32-938Z-fe1f9e36-23eb-4d39-8f24-47be864d110e.json"
  }),
  answerPricing: Object.freeze({
    inputUSDPerMillionTokens: "2.00",
    cachedInputUSDPerMillionTokens: "0.20",
    outputUSDPerMillionTokens: "12.00",
    version: "openai-gpt-5.6-terra-2026-08-24"
  }),
  fastPricing: Object.freeze({
    inputUSDPerMillionTokens: "0.20",
    cachedInputUSDPerMillionTokens: "0.02",
    outputUSDPerMillionTokens: "1.20",
    version: "openai-gpt-5.6-luna-2026-08-24"
  })
});

export function frozenResearchHybridBenchmarkEnvironment(environment = process.env) {
  const profile = frozenResearchHybridBenchmark;
  return {
    ...environment,
    PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
    PERMITEXT_RUN_UNAPPROVED_RESEARCH_DIAGNOSTICS: "1",
    PERMITEXT_RESEARCH_EVAL_MAX_USD: "20.00",
    PERMITEXT_RESEARCH_MODEL: profile.answerModel,
    PERMITEXT_RESEARCH_ACCURATE_MODEL: profile.answerModel,
    PERMITEXT_RESEARCH_FAST_MODEL: profile.fastModel,
    PERMITEXT_RESEARCH_ROUTING_MODE: profile.routingMode,
    PERMITEXT_RESEARCH_PROMPT_VERSION: profile.promptVersion,
    PERMITEXT_RESEARCH_EVIDENCE_VERSION: profile.evidenceVersion,
    PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:
      profile.answerPricing.inputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:
      profile.answerPricing.cachedInputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:
      profile.answerPricing.outputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_PRICING_VERSION: profile.answerPricing.version,
    PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS:
      profile.fastPricing.inputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS:
      profile.fastPricing.cachedInputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS:
      profile.fastPricing.outputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION: profile.fastPricing.version,
    PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1.00",
    PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "30.00",
    PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "100.00",
    PERMITEXT_RESEARCH_DAILY_CAP_USD: "100.00",
    PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "1000.00",
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL: profile.answerModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION: profile.judgePromptVersion
  };
}

export function validateFrozenResearchHybridBenchmark() {
  const profile = frozenResearchHybridBenchmark;
  assert.match(profile.gitCommit, /^[a-f0-9]{40}$/);
  assert.ok(Number.isFinite(Date.parse(profile.completedAt)));
  assert.ok(profile.resultFiles.diagnostic.endsWith(".json"));
  assert.ok(profile.resultFiles.approved.endsWith(".json"));
  assert.equal(
    profile.targetCompletedTurns,
    profile.diagnosticCaseCount + profile.approvedCaseCount,
    "Frozen benchmark cohort does not produce the declared turn count."
  );
  return profile;
}

function runEvaluation(arguments_, environment) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ["tests/research-evals.mjs", ...arguments_], {
      cwd: resolve(fileURLToPath(new URL("..", import.meta.url))),
      env: environment,
      stdio: "inherit"
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

async function main() {
  const profile = validateFrozenResearchHybridBenchmark();
  if (profile.completedAt) {
    throw new Error(
      `The frozen baseline already completed at ${profile.completedAt}. ` +
      `Its immutable results are tied to ${profile.gitCommit}; create a new benchmark profile for another paid run.`
    );
  }
  assert(process.env.OPENAI_API_KEY, "Set OPENAI_API_KEY before running the paid benchmark.");
  const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  for (const args of [["diff", "--quiet"], ["diff", "--cached", "--quiet"]]) {
    const status = spawnSync("git", args, { cwd: repositoryRoot, stdio: "ignore" });
    assert.equal(status.status, 0, "Commit tracked changes before running the frozen benchmark.");
  }
  const environment = frozenResearchHybridBenchmarkEnvironment();
  console.log(`Running ${profile.id}: ${profile.targetCompletedTurns} Research turns.`);
  const suites = [
    ["--run-live", "--include-drafts"],
    ["--run-live"]
  ];
  let qualityFailure = false;
  for (const arguments_ of suites) {
    const result = await runEvaluation(arguments_, environment);
    if (result.signal) throw new Error(`Research benchmark stopped by ${result.signal}.`);
    if (![0, 3].includes(result.code)) {
      throw new Error(`Research benchmark suite exited with status ${result.code}.`);
    }
    qualityFailure ||= result.code === 3;
  }
  if (qualityFailure) {
    console.error("The frozen benchmark completed, but one or more quality cases failed.");
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
