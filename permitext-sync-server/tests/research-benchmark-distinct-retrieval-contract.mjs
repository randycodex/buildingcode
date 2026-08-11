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
  formatResearchBenchmarkRetrievalReport
} from "../evals/research-benchmark-retrieval.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const [benchmarkMarkdown, canonicalIndex] = await Promise.all([
  readFile(join(serverRoot, "../docs/Permitext_Research_Benchmark_40_Distinct_Cases_v2.md"), "utf8"),
  readFile(join(serverRoot, "config/canonical-section-ids.json"), "utf8").then(JSON.parse)
]);
const dataset = validateResearchBenchmark(
  parseResearchBenchmarkMarkdown(benchmarkMarkdown, {
    idPrefix: "distinct-benchmark",
    benchmarkVersion: "20260811-distinct-corrected-v2",
    sharedRubricNumber: null
  }),
  {
    expectedCaseCount: 40,
    fixtureRange: null,
    idPrefix: "distinct-benchmark",
    sharedRubricNumber: null
  }
);

await withOfflineResearchHTTPHarness("distinct-benchmark-retrieval", async ({ discover, resolveSection }) => {
  const report = await evaluateResearchBenchmarkRetrieval({
    dataset,
    canonicalSectionIndex: canonicalIndex,
    discover,
    resolveSection,
    firstCase: 1,
    lastCase: 40,
    authorityPrefixes: ["BC", "MC", "PC", "FGC", "AC"],
    allConcreteRequiredCitations: true
  });

  assert.equal(report.scope.firstCase, 1);
  assert.equal(report.scope.lastCase, 40);
  assert.deepEqual(report.scope.authorityPrefixes, ["BC", "MC", "PC", "FGC", "AC"]);
  assert.equal(report.paidModelCall, false);
  assert.equal(report.summary.caseCount, 36);
  assert.equal(report.summary.requiredCitationCount, 92);
  assert.deepEqual(report.summary.requiredCitationCountByPrefix, {
    BC: 74,
    MC: 6,
    FGC: 2,
    PC: 10
  });
  assert.equal(report.summary.candidateRecall, 1);
  assert.equal(report.summary.evidenceRecall, 1);
  assert.equal(report.summary.fullCandidateRecallCases, 36);
  assert.equal(report.summary.fullEvidenceRecallCases, 36);
  assert(report.cases.every((result) => result.required.length > 0));
  assert(report.cases.every((result) => result.candidateCount <= 12));

  const tests15Through27 = report.cases.filter((result) =>
    result.number >= 15 && result.number <= 27
  );
  assert.deepEqual(
    tests15Through27.map((result) => result.number),
    [15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27],
    "The local enacted-corpus regression should explicitly exclude the 2025 NYCECC-only cases 23 and 24."
  );
  assert.equal(
    tests15Through27.reduce((count, result) => count + result.required.length, 0),
    32
  );
  assert(
    tests15Through27.every((result) => result.fullCandidateRecall),
    "Distinct Tests 15–27 must retrieve every locally mapped required citation within 12 candidates."
  );
  assert(
    tests15Through27.every((result) => result.fullEvidenceRecall),
    "Distinct Tests 15–27 must assemble every locally mapped required citation as evidence."
  );

  const misses = report.cases.flatMap((result) => result.required
    .filter((item) => !item.candidateHit || !item.evidenceHit)
    .map((item) => ({
      caseID: result.id,
      reference: item.reference,
      candidateHit: item.candidateHit,
      evidenceHit: item.evidenceHit
    }))
  );
  console.log(formatResearchBenchmarkRetrievalReport(report));
  assert.deepEqual(misses, []);
  console.log(`Distinct benchmark regression summary: ${JSON.stringify(report.summary)}`);
});
