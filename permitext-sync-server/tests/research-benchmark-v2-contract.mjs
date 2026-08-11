import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseResearchBenchmarkMarkdown,
  validateResearchBenchmark
} from "../evals/research-benchmark-v2.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const original = await readFile(join(root, "../../docs/Permitext_Research_Benchmark_40_Cases_original.md"), "utf8");
const corrected = await readFile(join(root, "../../docs/Permitext_Research_Benchmark_40_Cases_v2.md"), "utf8");
const canonicalSectionIndex = JSON.parse(await readFile(join(root, "../config/canonical-section-ids.json"), "utf8"));
assert.equal(
  createHash("sha256").update(original).digest("hex"),
  "9346a46855ad85a19a13e9784054310e46424052459a680935187dab8974540d",
  "The preserved original benchmark changed."
);

const dataset = validateResearchBenchmark(parseResearchBenchmarkMarkdown(corrected));
assert.equal(dataset.cases.length, 40);
assert.equal(dataset.cases.at(-1).evaluationKind, "shared-synthesis-rubric");
assert.deepEqual(dataset.cases.map((testCase) => testCase.number), Array.from({ length: 40 }, (_, index) => index + 1));

const caseByNumber = new Map(dataset.cases.map((testCase) => [testCase.number, testCase]));
const citationText = (testCase) => testCase.citations.map((citation) => citation.authority).join("\n");
assert.match(citationText(caseByNumber.get(1)), /§1004\.1\.3|Table 1004\.1\.3/);
assert.doesNotMatch(citationText(caseByNumber.get(1)), /§1004\.5|Table 1004\.5/);
assert.match(caseByNumber.get(4).idealAnswer, /§508\.2\.3/);
assert.match(caseByNumber.get(13).idealAnswer, /75/);
assert.match(caseByNumber.get(13).idealAnswer, /§1010\.1\.2\.2/);
assert.match(caseByNumber.get(14).idealAnswer, /§1020\.4/);
assert.match(caseByNumber.get(15).idealAnswer, /§1020\.1(?:\.1)?/);
assert.match(citationText(caseByNumber.get(15)), /Table 1020\.1\.1/);
assert.match(citationText(caseByNumber.get(15)), /Table 1020\.1\.2/);
assert.doesNotMatch(citationText(caseByNumber.get(15)), /§1020\.2\b/);
assert.match(caseByNumber.get(16).idealAnswer, /three stories or more/i);
assert.doesNotMatch(caseByNumber.get(16).idealAnswer, /four stories or more/i);
assert.match(citationText(caseByNumber.get(17)), /Table 716\.5/);
assert.doesNotMatch(citationText(caseByNumber.get(17)), /Table 716\.1/);
assert.match(caseByNumber.get(22).idealAnswer, /basement.*story above grade plane/is);
assert.match(caseByNumber.get(22).idealAnswer, /cellar.*not counted/is);
assert.equal(
  caseByNumber.get(23).citations.find((citation) => /§403/.test(citation.authority))?.role,
  "conditional"
);
for (const number of [24, 25, 26, 27]) {
  const incorporatedStandardCitations = caseByNumber.get(number).citations
    .filter((citation) => /^ICC A117\.1-2009/.test(citation.authority));
  assert(incorporatedStandardCitations.length > 0, `benchmark-${number} must identify its incorporated-standard boundary.`);
  assert(
    incorporatedStandardCitations.every((citation) => citation.role === "conditional" && /not reproduced/i.test(citation.authority)),
    `benchmark-${number} must keep unreproduced ICC A117.1 text conditional.`
  );
}
assert.match(caseByNumber.get(28).importantQualifications, /fil(?:e|ed|ing).*date|as-of date/i);
assert.match(caseByNumber.get(28).fixture, /August 10, 2026/);
assert.match(caseByNumber.get(28).evaluationInput, /REGRESSION FIXTURE[\s\S]*August 10, 2026[\s\S]*QUESTION/);
assert.match(citationText(caseByNumber.get(28)), /Local Law 33 of 2026/);
assert.equal(caseByNumber.get(28).citations[0].qualifier, "governing/enacted");
assert.equal(
  caseByNumber.get(28).citations.find((citation) => citation.role === "supporting")?.qualifier,
  "noncontrolling"
);
assert.match(caseByNumber.get(31).fixture, /regularly used for sleeping/);
assert.match(caseByNumber.get(39).idealAnswer, /outside|separate authority|Fire Code|FDNY/i);
assert.match(caseByNumber.get(40).regressionStatus, /Common synthesis rubric only/);

const canonicalBuildingCodeSections = new Set(
  Object.keys(canonicalSectionIndex.byCodeChapterSection || {})
    .filter((key) => key.startsWith("BC:"))
    .map((key) => key.split(":").at(-1))
);
for (const testCase of dataset.cases) {
  for (const citation of testCase.citations.filter((item) => /NYC BC/.test(item.authority))) {
    const buildingCodeAuthority = citation.authority.slice(citation.authority.indexOf("NYC BC"));
    for (const match of buildingCodeAuthority.matchAll(/§{1,2}\s*([A-Z]?\d+(?:\.\d+)*)/g)) {
      const reference = match[1];
      assert(
        canonicalBuildingCodeSections.has(reference) ||
          [...canonicalBuildingCodeSections].some((section) => section.startsWith(`${reference}.`)),
        `${testCase.id} cites NYC BC ${reference}, which is absent from the canonical corpus index.`
      );
    }
  }
}

console.log("permitext Research benchmark v2 contract passed");
