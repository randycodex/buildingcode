import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseResearchBenchmarkMarkdown,
  validateResearchBenchmark
} from "../evals/research-benchmark-v2.mjs";
import {
  requiredBuildingCodeReferences,
  requiredEnactedCodeReferences
} from "../evals/research-benchmark-retrieval.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const original = await readFile(
  join(root, "../../docs/Permitext_Research_Benchmark_40_Distinct_Cases_original.md"),
  "utf8"
);
const corrected = await readFile(
  join(root, "../../docs/Permitext_Research_Benchmark_40_Distinct_Cases_v2.md"),
  "utf8"
);
const canonicalSectionIndex = JSON.parse(
  await readFile(join(root, "../config/canonical-section-ids.json"), "utf8")
);

assert.equal(
  createHash("sha256").update(original).digest("hex"),
  "736bd7560207765d9a4b797673ed88679c397dc31907f345e904af7f5f5cf4d5",
  "The preserved original distinct benchmark changed."
);

const parseOptions = {
  idPrefix: "distinct-benchmark",
  benchmarkVersion: "20260811-distinct-corrected-v2",
  sharedRubricNumber: null
};
const validationOptions = {
  expectedCaseCount: 40,
  fixtureRange: null,
  idPrefix: "distinct-benchmark",
  sharedRubricNumber: null
};
const dataset = validateResearchBenchmark(
  parseResearchBenchmarkMarkdown(corrected, parseOptions),
  validationOptions
);

assert.equal(dataset.benchmarkVersion, "20260811-distinct-corrected-v2");
assert.deepEqual(
  dataset.cases.map((testCase) => testCase.number),
  Array.from({ length: 40 }, (_, index) => index + 1)
);
assert.deepEqual(
  dataset.cases.map((testCase) => testCase.id),
  Array.from({ length: 40 }, (_, index) => `distinct-benchmark-${String(index + 1).padStart(2, "0")}`)
);
assert(dataset.cases.every((testCase) => testCase.evaluationKind === "research-case"));
assert.doesNotMatch(corrected, /\b(?:approved|selected) evidence\b/i);
assert.match(corrected, /automatically retrieved, authorized evidence package/i);
for (const pattern of [
  /^## Test\s+\d+\s*$/gm,
  /^\*\*Q:\*\*/gm,
  /^\*\*Ideal answer:\*\*/gm,
  /^\*\*(?:Expected citations|Citation expectations):\*\*/gm,
  /^\*\*Important qualifications:\*\*/gm,
  /^\*\*Claims Permitext must avoid:\*\*/gm
]) {
  assert.equal(corrected.match(pattern)?.length, 40, `Distinct benchmark structure is incomplete for ${pattern}.`);
}

const allowedCitationRoles = new Set(["required", "conditional", "supporting", "outside authority"]);
for (const testCase of dataset.cases) {
  assert(testCase.citations.length > 0, `${testCase.id} must have citation expectations.`);
  assert(
    testCase.citations.every((citation) => allowedCitationRoles.has(citation.role)),
    `${testCase.id} must classify every citation expectation.`
  );
}
const decoratedQualifierByRole = new Map([
  ["required", "governing/enacted"],
  ["conditional", "governing/enacted"],
  ["supporting", "noncontrolling"],
  ["outside authority", "unavailable"]
]);
for (const testCase of dataset.cases.filter((item) => item.number >= 28)) {
  assert.deepEqual(
    new Set(testCase.citations.map((citation) => citation.role)),
    new Set(decoratedQualifierByRole.keys()),
    `${testCase.id} must include every explicit citation role.`
  );
  for (const citation of testCase.citations) {
    assert.equal(
      citation.qualifier,
      decoratedQualifierByRole.get(citation.role),
      `${testCase.id} has an inconsistent qualifier for ${citation.role}.`
    );
  }
}

const caseByNumber = new Map(dataset.cases.map((testCase) => [testCase.number, testCase]));
const citationText = (number) => caseByNumber.get(number).citations
  .map((citation) => citation.authority)
  .join("\n");

assert.match(caseByNumber.get(29).idealAnswer, /BC §1030\b/);
assert.match(citationText(29), /NYC BC §1030\.1/);
assert.doesNotMatch(`${caseByNumber.get(29).idealAnswer}\n${citationText(29)}`, /§1031\b/);
assert.match(caseByNumber.get(31).idealAnswer, /§711\.2\.3/);
assert.match(citationText(33), /§803\.11[^\n]*Table 803\.11/);
assert.equal(
  caseByNumber.get(32).citations.find((citation) => /Buildings Bulletin 2022-013/.test(citation.authority))?.role,
  "supporting"
);
assert.equal(
  caseByNumber.get(40).citations.find((citation) => /Buildings Bulletin|service notice|FAQ/i.test(citation.authority))?.role,
  "supporting"
);
assert.match(caseByNumber.get(40).idealAnswer, /cannot determine|generic prompt alone/i);

assert.equal(caseByNumber.get(28).citations[0].qualifier, "governing/enacted");
assert.equal(
  caseByNumber.get(28).citations.find((citation) => /ASCE 24 provisions actually used/.test(citation.authority))?.role,
  "outside authority"
);
assert.equal(
  caseByNumber.get(28).citations.find((citation) => /ASCE 24 provisions actually used/.test(citation.authority))?.qualifier,
  "unavailable"
);

const concreteReferences = (number, prefixes = ["BC", "PC", "MC", "FGC"]) =>
  requiredEnactedCodeReferences(
    caseByNumber.get(number),
    canonicalSectionIndex,
    prefixes,
    { allConcrete: true }
  );
const referenceNames = (result) => result.references.map((item) => item.reference).sort();

assert.deepEqual(referenceNames(concreteReferences(10)), [
  "BC 2702.1",
  "BC 403.4.8",
  "BC 403.4.8.3.2",
  "BC 403.4.8.4.2",
  "BC 403.4.8.4.3"
].sort());
assert.deepEqual(referenceNames(concreteReferences(20)), [
  "BC 1004.1.2",
  "BC 1004.1.3",
  "PC 403.1",
  "PC 403.1.1",
  "PC 403.3"
].sort());
assert.deepEqual(referenceNames(concreteReferences(25)), ["BC 1704.1"]);
assert.deepEqual(referenceNames(concreteReferences(30)), [
  "BC 709.1",
  "BC 709.3",
  "BC 710.1",
  "BC 710.3"
]);
assert.deepEqual(referenceNames(concreteReferences(32)), [
  "BC 718.2.6",
  "BC 718.2.6.1",
  "BC 718.2.6.1.1",
  "BC 718.2.6.1.2"
]);

const mixedPrefixReferences = requiredEnactedCodeReferences(
  {
    citations: [{
      role: "required",
      authority: "NYC BC §304.1 and NYC PC §403.1"
    }]
  },
  canonicalSectionIndex,
  ["BC", "PC"],
  { allConcrete: true }
);
assert.deepEqual(referenceNames(mixedPrefixReferences), ["BC 304.1", "PC 403.1"]);
assert.deepEqual(
  referenceNames(requiredBuildingCodeReferences(caseByNumber.get(20), canonicalSectionIndex)),
  ["BC 1004.1.2", "BC 1004.1.3"]
);

console.log("permitext Research distinct benchmark contract passed");
