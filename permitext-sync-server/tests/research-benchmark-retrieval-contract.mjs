import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseResearchBenchmarkMarkdown,
  validateResearchBenchmark
} from "../evals/research-benchmark-v2.mjs";
import {
  evaluateResearchBenchmarkRetrieval,
  formatResearchBenchmarkRetrievalReport,
  requiredBuildingCodeReferences
} from "../evals/research-benchmark-retrieval.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const [benchmarkMarkdown, canonicalIndex] = await Promise.all([
  readFile(join(serverRoot, "../docs/Permitext_Research_Benchmark_40_Cases_v2.md"), "utf8"),
  readFile(join(serverRoot, "config/canonical-section-ids.json"), "utf8").then(JSON.parse)
]);
const dataset = validateResearchBenchmark(parseResearchBenchmarkMarkdown(benchmarkMarkdown));
const caseByNumber = new Map(dataset.cases.map((testCase) => [testCase.number, testCase]));

const constructionTypeReferences = requiredBuildingCodeReferences(caseByNumber.get(19), canonicalIndex);
assert.deepEqual(
  constructionTypeReferences.references.map((item) => item.sectionNumber),
  ["602.2", "601.1", "602.1"],
  "Table 601 and Table 602 must resolve to their canonical containing sections."
);
const residentialUnitReferences = requiredBuildingCodeReferences(caseByNumber.get(25), canonicalIndex);
assert.deepEqual(
  residentialUnitReferences.references.map((item) => item.sectionNumber),
  ["1107.6", "1107.6.1", "1107.6.2", "1107.6.3", "1107.6.1.1", "1107.6.1.2", "1107.6.2.1", "1107.6.2.2"],
  "A comparison across residential unit categories must retrieve every material Group R branch and quantity provision."
);
assert.equal(residentialUnitReferences.skipped.length, 0);

await withOfflineResearchHTTPHarness("benchmark-retrieval", async ({ discover, resolveSection }) => {
  const report = await evaluateResearchBenchmarkRetrieval({
    dataset,
    canonicalSectionIndex: canonicalIndex,
    discover,
    resolveSection
  });
  assert.equal(report.scope.firstCase, 1);
  assert.equal(report.scope.lastCase, 27);
  assert.equal(report.summary.caseCount, 27);
  assert.equal(report.summary.requiredCitationCount, 55);
  assert.equal(report.summary.candidateRecall, 1);
  assert.equal(report.summary.evidenceRecall, 1);
  assert.equal(report.summary.fullCandidateRecallCases, 27);
  assert.equal(report.summary.fullEvidenceRecallCases, 27);
  assert.equal(report.paidModelCall, false);
  assert(report.cases.every((result) => result.required.length > 0));
  assert(report.cases.every((result) => result.candidateCount <= 12));
  console.log(formatResearchBenchmarkRetrievalReport(report));
});
