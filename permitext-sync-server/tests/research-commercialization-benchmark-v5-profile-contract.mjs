import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchCommercializationBenchmarkV5,
  researchCommercializationBenchmarkV5Environment,
  validateResearchCommercializationBenchmarkV5
} from "../scripts/run-research-commercialization-benchmark-v5.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(join(root, "../evals/research-cases.json"), "utf8"));
const profile = validateResearchCommercializationBenchmarkV5();
const environment = researchCommercializationBenchmarkV5Environment({
  OPENAI_API_KEY: "not-a-real-key"
});
const cohortCases = dataset.cases.filter((testCase) =>
  ["approved", "draft"].includes(testCase.status) &&
  !profile.excludedSafetyCaseIDs.includes(testCase.id)
);

assert.equal(profile, researchCommercializationBenchmarkV5);
assert.equal(cohortCases.length, 20);
assert.equal(profile.targetQuestionCount, 20);
assert.equal(profile.minimumCompletedTurns, 20);
assert.deepEqual(profile.excludedSafetyCaseIDs, ["nyc-018-fire-district-map-boundary"]);
assert.equal(profile.promptVersion, "20260827-material-completeness-v31");
assert.equal(profile.sourcePolicyVersion, "20260828-supporting-web-v10");
assert.equal(profile.answerQualityVersion, "20260828-prior-code-accessibility-repair-v22");
assert.equal(profile.applicationCommit, "db2c0e9e67f95b2b36f22912628bee457edf0468");
assert.equal(profile.completedAt, null);
assert.equal(profile.resultStatus, null);
assert.equal(profile.resultFile, null);
assert.equal(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD, "4.00");
assert.equal(environment.PERMITEXT_RESEARCH_ROUTING_MODE, "hybrid");
assert.equal(environment.PERMITEXT_RESEARCH_FAST_MODEL, "gpt-5.6-luna");
assert.equal(environment.PERMITEXT_RESEARCH_ACCURATE_MODEL, "gpt-5.6-terra");
assert.equal(environment.PERMITEXT_RESEARCH_PROMPT_VERSION, profile.promptVersion);
assert.equal(environment.PERMITEXT_RESEARCH_ECONOMICS_MINIMUM_COMPLETED_TURNS, "20");
assert.equal(environment.PERMITEXT_RESEARCH_KILL_SWITCH, "0");
assert.equal(environment.PERMITEXT_RESEARCH_PAID_TURNS_ENABLED, "0");

console.log("Permitext v5 commercialization benchmark profile contract passed; paid model calls: no.");
