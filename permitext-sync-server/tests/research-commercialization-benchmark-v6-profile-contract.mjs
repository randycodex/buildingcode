import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchCommercializationBenchmarkV6,
  researchCommercializationBenchmarkV6Environment,
  validateResearchCommercializationBenchmarkV6
} from "../scripts/run-research-commercialization-benchmark-v6.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(join(root, "../evals/research-cases.json"), "utf8"));
const profile = validateResearchCommercializationBenchmarkV6();
const frozenResult = JSON.parse(
  await readFile(join(root, "..", profile.resultFile), "utf8")
);
const environment = researchCommercializationBenchmarkV6Environment({
  OPENAI_API_KEY: "not-a-real-key"
});
const cohortCases = dataset.cases.filter((testCase) =>
  ["approved", "draft"].includes(testCase.status) &&
  !profile.excludedSafetyCaseIDs.includes(testCase.id)
);

assert.equal(profile, researchCommercializationBenchmarkV6);
assert.equal(cohortCases.length, 20);
assert.equal(profile.targetQuestionCount, 20);
assert.equal(profile.minimumCompletedTurns, 20);
assert.deepEqual(profile.excludedSafetyCaseIDs, ["nyc-018-fire-district-map-boundary"]);
assert.equal(profile.promptVersion, "20260827-material-completeness-v31");
assert.equal(profile.sourcePolicyVersion, "20260828-supporting-web-v10");
assert.equal(profile.answerQualityVersion, "20260828-occupant-load-filing-boundary-v23");
assert.equal(profile.applicationCommit, "3071a47286bd985b42937798c943a80b973d48ee");
assert.equal(profile.completedAt, "2026-08-28T02:39:40.949Z");
assert.equal(profile.resultStatus, "complete");
assert.equal(
  profile.resultFile,
  "evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json"
);
assert.equal(frozenResult.configuration.gitCommit, "c1db6e4ddf9768a3de424c826529586da3f6dfaa");
assert.equal(frozenResult.configuration.actualUSD, 1.779355);
assert.equal(frozenResult.results.length, 20);
assert.equal(frozenResult.results.filter((result) => result.scoring?.passed).length, 20);
assert.equal(frozenResult.economics.sample.completedCharged, 20);
assert.equal(frozenResult.economics.economics.totalOperatingCostUSD, 1.148132);
assert.equal(frozenResult.economics.economics.projectedCostPer100TurnsUSD, 5.74);
assert.equal(frozenResult.economics.charging.integrityPass, true);
assert.equal(frozenResult.economics.readyForPricingDecision, true);
assert.equal(environment.PERMITEXT_RESEARCH_EVAL_MAX_USD, "4.00");
assert.equal(environment.PERMITEXT_RESEARCH_ROUTING_MODE, "hybrid");
assert.equal(environment.PERMITEXT_RESEARCH_FAST_MODEL, "gpt-5.6-luna");
assert.equal(environment.PERMITEXT_RESEARCH_ACCURATE_MODEL, "gpt-5.6-terra");
assert.equal(environment.PERMITEXT_RESEARCH_PROMPT_VERSION, profile.promptVersion);
assert.equal(environment.PERMITEXT_RESEARCH_ECONOMICS_MINIMUM_COMPLETED_TURNS, "20");
assert.equal(environment.PERMITEXT_RESEARCH_KILL_SWITCH, "0");
assert.equal(environment.PERMITEXT_RESEARCH_PAID_TURNS_ENABLED, "0");

console.log("Permitext v6 commercialization benchmark profile contract passed; paid model calls: no.");
