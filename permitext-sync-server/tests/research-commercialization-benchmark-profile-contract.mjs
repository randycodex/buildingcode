import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchCommercializationBenchmark,
  researchCommercializationBenchmarkEnvironment,
  validateResearchCommercializationBenchmark
} from "../scripts/run-research-commercialization-benchmark.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(join(root, "../evals/research-cases.json"), "utf8"));
const profile = validateResearchCommercializationBenchmark();
const diagnosticCases = dataset.cases.filter((testCase) =>
  ["approved", "draft"].includes(testCase.status)
);
const environment = researchCommercializationBenchmarkEnvironment({
  OPENAI_API_KEY: "not-a-real-key"
});

assert.equal(diagnosticCases.length, profile.targetQuestionCount);
assert.equal(profile.targetQuestionCount, 21);
assert.equal(profile.minimumCompletedTurns, 20);
assert.equal(profile.completedAt, null);
assert.equal(profile.gitCommit, null);
assert.equal(profile.resultFile, null);
assert.equal(environment.PERMITEXT_RESEARCH_ROUTING_MODE, "hybrid");
assert.equal(environment.PERMITEXT_RESEARCH_FAST_MODEL, "gpt-5.6-luna");
assert.equal(environment.PERMITEXT_RESEARCH_ACCURATE_MODEL, "gpt-5.6-terra");
assert.equal(environment.PERMITEXT_RESEARCH_PROMPT_VERSION, profile.promptVersion);
assert.equal(environment.PERMITEXT_RESEARCH_ECONOMICS_MINIMUM_COMPLETED_TURNS, "20");
assert.equal(environment.PERMITEXT_RESEARCH_TARGET_100_TURN_COST_MIN_USD, "4.00");
assert.equal(environment.PERMITEXT_RESEARCH_TARGET_100_TURN_COST_MAX_USD, "6.00");
assert.equal(environment.PERMITEXT_RESEARCH_KILL_SWITCH, "0");
assert.equal(environment.PERMITEXT_RESEARCH_PAID_TURNS_ENABLED, "0");
assert.equal(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD, "12.00");

console.log("Permitext open commercialization benchmark profile contract passed; paid model calls: no.");
