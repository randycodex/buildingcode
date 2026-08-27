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
const [datasetText, evaluationSource, appSource, readme] = await Promise.all([
  readFile(join(root, "../evals/research-cases.json"), "utf8"),
  readFile(join(root, "research-evals.mjs"), "utf8"),
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../README.md"), "utf8")
]);
const dataset = JSON.parse(datasetText);
const profile = validateResearchCommercializationBenchmark();
const diagnosticCases = dataset.cases.filter((testCase) =>
  ["approved", "draft"].includes(testCase.status) &&
  !profile.excludedSafetyCaseIDs.includes(testCase.id)
);
const environment = researchCommercializationBenchmarkEnvironment({
  OPENAI_API_KEY: "not-a-real-key"
});

assert.equal(diagnosticCases.length, profile.targetQuestionCount);
assert.equal(profile.targetQuestionCount, 20);
assert.equal(profile.minimumCompletedTurns, 20);
assert.deepEqual(profile.excludedSafetyCaseIDs, ["nyc-018-fire-district-map-boundary"]);
assert.equal(profile.promptVersion, "20260827-explicit-unknown-coverage-v29");
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
assert.match(readme, /which runs 20 distinct/);
assert.match(readme, /map-only fire-district case remains in the safety suite/);
assert.match(
  evaluationSource,
  /terminalEvaluationOperationStatuses[\s\S]*terminalEvaluationOperation\([\s\S]*awaitingOperationTelemetry[\s\S]*result\.operationMetric = operationMetric/,
  "Failed paid turns can advance before terminal no-charge telemetry is durably available."
);
assert.match(
  evaluationSource,
  /function evaluationProjectFacts[\s\S]*flatMap[\s\S]*Array\.isArray\(value\)[\s\S]*\.map\(\(item\) => `\$\{label\}: \$\{item\}`\)/,
  "Evaluation Project unknowns are still collapsed into one comma-separated fact."
);
assert.match(
  appSource,
  /When Project facts explicitly list multiple unknowns[\s\S]*Do not collapse distinct approvals, records, capacity or dimension inputs, and technical inputs/,
  "The Research prompt does not preserve separately declared material unknowns."
);

console.log("Permitext open commercialization benchmark profile contract passed; paid model calls: no.");
