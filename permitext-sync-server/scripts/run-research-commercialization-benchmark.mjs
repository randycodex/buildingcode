import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * One-time current-code cohort used for the Phase 2 pricing decision.
 *
 * Keep the profile open only until the paid run completes. Then record the
 * exact application commit, result file, and completion time. The runner will
 * refuse to spend against a frozen profile.
 */
export const researchCommercializationBenchmark = Object.freeze({
  id: "20260827-commercialization-cohort-v1",
  targetQuestionCount: 20,
  minimumCompletedTurns: 20,
  excludedSafetyCaseIDs: Object.freeze([
    "nyc-018-fire-district-map-boundary"
  ]),
  promptVersion: "20260827-explicit-unknown-coverage-v29",
  evidenceVersion: "selected-multimodal-evidence-v3",
  evidenceAssemblyVersion: "20260827-pinned-evidence-budget-v20",
  routingVersion: "20260827-luna-terra-hybrid-v3",
  judgePromptVersion: "20260826-established-facts-v3",
  accurateModel: "gpt-5.6-terra",
  fastModel: "gpt-5.6-luna",
  routingMode: "hybrid",
  gitCommit: "30ecbb657a1a051d264c7916f74c3d91e728cf80",
  completedAt: "2026-08-27T22:08:25.090Z",
  resultFile: "evals/results/2026-08-27T21-53-23-508Z-bf772b34-fb6e-4b54-b303-7adab469edb5.json",
  accuratePricing: Object.freeze({
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

export function researchCommercializationBenchmarkEnvironment(environment = process.env) {
  const profile = researchCommercializationBenchmark;
  return {
    ...environment,
    PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
    PERMITEXT_RUN_UNAPPROVED_RESEARCH_DIAGNOSTICS: "1",
    PERMITEXT_RESEARCH_EVAL_MAX_USD: "4.00",
    PERMITEXT_RESEARCH_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_ACCURATE_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_FAST_MODEL: profile.fastModel,
    PERMITEXT_RESEARCH_ROUTING_MODE: profile.routingMode,
    PERMITEXT_RESEARCH_PROMPT_VERSION: profile.promptVersion,
    PERMITEXT_RESEARCH_EVIDENCE_VERSION: profile.evidenceVersion,
    PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:
      profile.accuratePricing.inputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:
      profile.accuratePricing.cachedInputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:
      profile.accuratePricing.outputUSDPerMillionTokens,
    PERMITEXT_RESEARCH_PRICING_VERSION: profile.accuratePricing.version,
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
    PERMITEXT_RESEARCH_ECONOMICS_MINIMUM_COMPLETED_TURNS:
      String(profile.minimumCompletedTurns),
    PERMITEXT_RESEARCH_TARGET_100_TURN_COST_MIN_USD: "4.00",
    PERMITEXT_RESEARCH_TARGET_100_TURN_COST_MAX_USD: "6.00",
    PERMITEXT_RESEARCH_KILL_SWITCH: "0",
    PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0",
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL: profile.accurateModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION: profile.judgePromptVersion
  };
}

export function validateResearchCommercializationBenchmark() {
  const profile = researchCommercializationBenchmark;
  assert(profile.targetQuestionCount >= 20 && profile.targetQuestionCount <= 30);
  assert(profile.minimumCompletedTurns >= 20);
  assert(profile.minimumCompletedTurns <= profile.targetQuestionCount);
  assert.equal(new Set(profile.excludedSafetyCaseIDs).size, profile.excludedSafetyCaseIDs.length);
  if (profile.completedAt || profile.gitCommit || profile.resultFile) {
    assert(profile.completedAt && Number.isFinite(Date.parse(profile.completedAt)));
    assert.match(profile.gitCommit || "", /^[a-f0-9]{40}$/);
    assert(profile.resultFile?.endsWith(".json"));
  }
  return profile;
}

export async function verifyResearchCommercializationProviderAccess({
  environment = process.env,
  fetchImplementation = fetch
} = {}) {
  const apiKey = String(environment.OPENAI_API_KEY || "").trim();
  assert(apiKey, "Set OPENAI_API_KEY before running the paid benchmark.");
  const model = researchCommercializationBenchmark.fastModel;
  const response = await fetchImplementation("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: "Reply with only OK.",
      max_output_tokens: 16,
      store: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(payload?.error?.code || payload?.error?.type || `HTTP_${response.status}`);
    throw new Error(
      `Paid Research benchmark provider preflight failed (${code}). ` +
      "Verify the server-only OpenAI key, project access, and available API credits before retrying."
    );
  }
  return { model: String(payload?.model || model), responseID: String(payload?.id || "") || null };
}

function runEvaluation(environment) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      "tests/research-evals.mjs",
      "--run-live",
      "--include-drafts",
      ...researchCommercializationBenchmark.excludedSafetyCaseIDs.flatMap((caseID) => [
        "--exclude-case",
        caseID
      ])
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
  const profile = validateResearchCommercializationBenchmark();
  if (profile.completedAt) {
    throw new Error(
      `The commercialization benchmark already completed at ${profile.completedAt}. ` +
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
    assert.equal(status.status, 0, "Commit tracked changes before running the benchmark.");
  }
  const environment = researchCommercializationBenchmarkEnvironment();
  await verifyResearchCommercializationProviderAccess({ environment });
  console.log(
    `Running ${profile.id}: ${profile.targetQuestionCount} distinct Research questions ` +
    `with a $${environment.PERMITEXT_RESEARCH_EVAL_MAX_USD} maximum paid-evaluation budget.`
  );
  const result = await runEvaluation(environment);
  if (result.signal) throw new Error(`Research benchmark stopped by ${result.signal}.`);
  if (![0, 3].includes(result.code)) {
    throw new Error(`Research benchmark suite exited with status ${result.code}.`);
  }
  if (result.code === 3) {
    console.error("The cohort completed, but one or more quality cases failed.");
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
