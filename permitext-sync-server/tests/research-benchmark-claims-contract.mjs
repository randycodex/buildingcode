import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  benchmarkClaimRequirements,
  researchBenchmarkClaimsVersion,
  scoreBenchmarkAnswerOmissions,
  validateBenchmarkClaimRequirements
} from "../evals/research-benchmark-claims.mjs";
import {
  parseResearchBenchmarkMarkdown,
  validateResearchBenchmark
} from "../evals/research-benchmark-v2.mjs";

const root = dirname(fileURLToPath(import.meta.url));

async function parsedDataset(path, parseOptions = {}, validationOptions = {}) {
  const markdown = await readFile(join(root, "../..", path), "utf8");
  return validateResearchBenchmark(
    parseResearchBenchmarkMarkdown(markdown, parseOptions),
    validationOptions
  );
}

const primary = await parsedDataset("docs/Permitext_Research_Benchmark_40_Cases_v2.md");
const distinct = await parsedDataset(
  "docs/Permitext_Research_Benchmark_40_Distinct_Cases_v2.md",
  {
    idPrefix: "distinct-benchmark",
    benchmarkVersion: "20260811-distinct-corrected-v2",
    sharedRubricNumber: null
  },
  {
    expectedCaseCount: 40,
    fixtureRange: null,
    idPrefix: "distinct-benchmark",
    sharedRubricNumber: null
  }
);

assert.equal(primary.claimRequirementsVersion, researchBenchmarkClaimsVersion);
assert.equal(distinct.claimRequirementsVersion, researchBenchmarkClaimsVersion);
assert.equal(
  primary.cases.reduce((total, testCase) => total + testCase.claimRequirements.required.length, 0),
  206,
  "The primary benchmark required-claim inventory changed without review."
);
assert.equal(
  distinct.cases.reduce((total, testCase) => total + testCase.claimRequirements.required.length, 0),
  190,
  "The distinct benchmark required-claim inventory changed without review."
);
assert.equal(
  primary.cases.reduce((total, testCase) => total + testCase.claimRequirements.forbidden.length, 0),
  165,
  "The primary benchmark forbidden-claim inventory changed without review."
);
assert.equal(
  distinct.cases.reduce((total, testCase) => total + testCase.claimRequirements.forbidden.length, 0),
  164,
  "The distinct benchmark forbidden-claim inventory changed without review."
);

for (const dataset of [primary, distinct]) {
  for (const testCase of dataset.cases) {
    assert.deepEqual(
      testCase.claimRequirements.forbidden.map((claim) => claim.text),
      testCase.forbiddenClaims,
      `${testCase.id} must preserve every human-authored forbidden claim.`
    );
    assert(
      testCase.claimRequirements.forbidden.every((claim) =>
        claim.match.mode === "semantic-review-only" &&
        claim.match.minimumTermMatches === null &&
        claim.match.minimumDistinctiveTermMatches === null
      ),
      `${testCase.id} must not turn forbidden claims into automatic legal conclusions.`
    );
    const idealScore = scoreBenchmarkAnswerOmissions(testCase, testCase.idealAnswer);
    assert.equal(idealScore.score, 1, `${testCase.id} ideal answer must cover its derived required claims.`);
    assert.equal(idealScore.omittedCount, 0, `${testCase.id} ideal answer produced a false omission.`);
    assert.equal(idealScore.diagnosticOnly, true);
    for (const claim of testCase.claimRequirements.required) {
      const removedClaim = scoreBenchmarkAnswerOmissions(
        testCase,
        testCase.idealAnswer.replace(claim.text, "")
      );
      assert(
        removedClaim.omittedClaimIDs.includes(claim.id),
        `${testCase.id} ${claim.id} has no independently detectable omission anchors.`
      );
    }
  }
}

const accessibilityCase = primary.cases.find((testCase) => testCase.number === 25);
const typeAClaim = accessibilityCase.claimRequirements.required.find((claim) => /Type A unit/.test(claim.text));
assert(typeAClaim, "Benchmark Test 25 must expose its Type A/Type B+NYC distinction as a required claim.");
const accessibilityOmission = scoreBenchmarkAnswerOmissions(
  accessibilityCase,
  accessibilityCase.idealAnswer.replace(typeAClaim.text, "")
);
assert(
  accessibilityOmission.omittedClaimIDs.includes(typeAClaim.id),
  "The diagnostic scorer failed to detect a known Test 25 answer omission."
);

const syntheticRequirements = benchmarkClaimRequirements(
  "BC §1107.6.2.1 requires Type B+NYC units. Elevator service affects the available exceptions.",
  ["Every 100-unit residential project requires exactly five Accessible units."]
);
const syntheticCase = {
  id: "synthetic-claims",
  forbiddenClaims: syntheticRequirements.forbidden.map((claim) => claim.text),
  claimRequirements: syntheticRequirements
};
const paraphrased = scoreBenchmarkAnswerOmissions(
  syntheticCase,
  "Under BC 1107.6.2.1, Type B+NYC dwelling units are required. Available exceptions depend on the building's elevator service."
);
assert.equal(paraphrased.omittedCount, 0, "Lexical anchors should tolerate a direct professional paraphrase.");

const incomplete = scoreBenchmarkAnswerOmissions(
  syntheticCase,
  "Under BC 1107.6.2.1, Type B+NYC dwelling units are required."
);
assert.deepEqual(incomplete.omittedClaimIDs, ["required-02"]);
assert.equal(incomplete.forbiddenClaims[0].match.mode, "semantic-review-only");
assert.equal("violated" in incomplete.forbiddenClaims[0], false);
assert.deepEqual(
  scoreBenchmarkAnswerOmissions(
    syntheticCase,
    "Under BC 1107.6.2.1, Type B+NYC dwelling units are required."
  ),
  incomplete,
  "The omission diagnostic must be deterministic for identical input."
);

const invalid = structuredClone(syntheticRequirements);
invalid.required[0].match.minimumTermMatches = 999;
assert.throws(
  () => validateBenchmarkClaimRequirements(invalid, {
    caseID: syntheticCase.id,
    legacyForbiddenClaims: syntheticCase.forbiddenClaims
  }),
  /invalid term threshold/
);

console.log("permitext Research benchmark claim requirements contract passed");
