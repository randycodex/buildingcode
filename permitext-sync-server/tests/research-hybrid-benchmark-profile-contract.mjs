import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  frozenResearchHybridBenchmark,
  frozenResearchHybridBenchmarkEnvironment,
  validateFrozenResearchHybridBenchmark
} from "../scripts/run-research-hybrid-benchmark.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(join(root, "../evals/research-cases.json"), "utf8"));
const profile = validateFrozenResearchHybridBenchmark();
const approvedCases = dataset.cases.filter((testCase) => testCase.status === "approved");
const diagnosticCases = dataset.cases.filter((testCase) => ["approved", "draft"].includes(testCase.status));
const resultsRoot = join(root, "../evals/results");
const [diagnosticResult, approvedResult] = await Promise.all([
  readFile(join(resultsRoot, profile.resultFiles.diagnostic), "utf8").then(JSON.parse),
  readFile(join(resultsRoot, profile.resultFiles.approved), "utf8").then(JSON.parse)
]);

assert.equal(diagnosticCases.length, profile.diagnosticCaseCount);
assert.equal(approvedCases.length, profile.approvedCaseCount);
assert.equal(diagnosticCases.length + approvedCases.length, profile.targetCompletedTurns);
assert(profile.targetCompletedTurns >= 25 && profile.targetCompletedTurns <= 40);

const environment = frozenResearchHybridBenchmarkEnvironment({ OPENAI_API_KEY: "not-a-real-key" });
assert.equal(environment.PERMITEXT_RESEARCH_PROMPT_VERSION, profile.promptVersion);
assert.equal(environment.PERMITEXT_RESEARCH_EVIDENCE_VERSION, profile.evidenceVersion);
assert.equal(environment.PERMITEXT_RESEARCH_ROUTING_MODE, "hybrid");
assert.equal(environment.PERMITEXT_RESEARCH_FAST_MODEL, "gpt-5.6-luna");
assert.equal(environment.PERMITEXT_RESEARCH_ACCURATE_MODEL, "gpt-5.6-terra");
assert.equal(environment.PERMITEXT_RUN_UNAPPROVED_RESEARCH_DIAGNOSTICS, "1");
assert.equal(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD, "20.00");
assert.equal(frozenResearchHybridBenchmark.id, "20260826-hybrid-economics-baseline-v1");
for (const result of [diagnosticResult, approvedResult]) {
  assert.equal(result.configuration.gitCommit, profile.gitCommit);
  assert.equal(result.configuration.promptVersion, profile.promptVersion);
  assert.equal(result.configuration.evidenceVersion, profile.evidenceVersion);
  assert.equal(result.results.length > 0, true);
}
assert.equal(diagnosticResult.configuration.suiteScope, "diagnostic");
assert.equal(approvedResult.configuration.suiteScope, "full");
assert.equal(diagnosticResult.economics.sample.operations, 20);
assert.equal(approvedResult.economics.sample.operations, 6);

console.log("Permitext frozen hybrid Research benchmark profile contract passed; paid model calls: no.");
