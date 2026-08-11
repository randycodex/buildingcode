import {
  benchmarkClaimRequirements,
  researchBenchmarkClaimsVersion,
  validateBenchmarkClaimRequirements
} from "./research-benchmark-claims.mjs";

const citationRoles = new Set(["required", "conditional", "supporting", "outside authority"]);

function field(block, label, nextLabels) {
  const boundary = nextLabels.length
    ? `(?=${nextLabels.map((item) => `\\*\\*${item}:\\*\\*`).join("|")}|$)`
    : "$";
  const match = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)${boundary}`));
  return String(match?.[1] || "").trim();
}

function bulletItems(value) {
  return String(value || "")
    .split(/\n(?=- )/)
    .map((item) => item.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function citationItem(item) {
  const decorated = item.match(
    /^\*\*(Required|Conditional|Supporting|Outside authority)(?:\s*(?:—|\/)\s*([^*:]+))?:?\*\*\s*[:—-]?\s*(.+)$/i
  );
  if (decorated) {
    return {
      role: decorated[1].toLowerCase(),
      qualifier: String(decorated[2] || "").trim().toLowerCase() || null,
      authority: decorated[3].trim()
    };
  }
  const plain = item.match(/^(Required|Conditional|Supporting|Outside authority)\s*[:—-]\s*(.+)$/i);
  return plain
    ? { role: plain[1].toLowerCase(), qualifier: null, authority: plain[2].trim() }
    : { role: "unclassified", qualifier: null, authority: item };
}

export function parseResearchBenchmarkMarkdown(markdown, options = {}) {
  const idPrefix = String(options.idPrefix || "benchmark");
  const sharedRubricNumber = options.sharedRubricNumber === undefined
    ? 40
    : options.sharedRubricNumber;
  const source = String(markdown || "").replaceAll("**Citation expectations:**", "**Expected citations:**");
  const parts = source.split(/^## Test\s+(\d+)\s*$/m);
  const cases = [];
  for (let index = 1; index < parts.length; index += 2) {
    const number = Number(parts[index]);
    const block = parts[index + 1] || "";
    const fixture = field(block, "Regression fixture", ["Q"]);
    const regressionStatus = field(block, "Regression status", ["Q"]);
    const question = field(block, "Q", ["Ideal answer"]);
    const idealAnswer = field(block, "Ideal answer", ["Expected citations"]);
    const forbiddenClaims = bulletItems(field(block, "Claims Permitext must avoid", []));
    cases.push({
      id: `${idPrefix}-${String(number).padStart(2, "0")}`,
      number,
      fixture,
      regressionStatus,
      question,
      evaluationInput: [fixture ? `REGRESSION FIXTURE\n${fixture}` : "", `QUESTION\n${question}`]
        .filter(Boolean)
        .join("\n\n"),
      idealAnswer,
      citations: bulletItems(field(block, "Expected citations", ["Important qualifications"]))
        .map(citationItem),
      importantQualifications: field(block, "Important qualifications", ["Claims Permitext must avoid"]),
      forbiddenClaims,
      claimRequirements: benchmarkClaimRequirements(idealAnswer, forbiddenClaims),
      evaluationKind: number === sharedRubricNumber ? "shared-synthesis-rubric" : "research-case"
    });
  }
  return {
    schemaVersion: 1,
    benchmarkVersion: String(options.benchmarkVersion || "20260811-corrected-v2"),
    claimRequirementsVersion: researchBenchmarkClaimsVersion,
    corpus: String(options.corpus || "2022 New York City Construction Codes"),
    status: "draft-human-review",
    cases
  };
}

export function validateResearchBenchmark(dataset, options = {}) {
  const expectedCaseCount = Number(options.expectedCaseCount || 40);
  const firstNumber = Number(options.firstNumber || 1);
  const idPrefix = String(options.idPrefix || "benchmark");
  const fixtureRange = options.fixtureRange === undefined ? [28, 39] : options.fixtureRange;
  const sharedRubricNumber = options.sharedRubricNumber === undefined
    ? 40
    : options.sharedRubricNumber;
  if (dataset?.schemaVersion !== 1) throw new Error("Research benchmark schemaVersion must be 1.");
  if (dataset.claimRequirementsVersion !== researchBenchmarkClaimsVersion) {
    throw new Error("Research benchmark claim requirements use an unsupported version.");
  }
  if (!Array.isArray(dataset.cases) || dataset.cases.length !== expectedCaseCount) {
    throw new Error(`Research benchmark must contain exactly ${expectedCaseCount} cases.`);
  }
  const ids = new Set();
  for (const [index, testCase] of dataset.cases.entries()) {
    const expectedNumber = firstNumber + index;
    if (testCase.number !== expectedNumber || testCase.id !== `${idPrefix}-${String(expectedNumber).padStart(2, "0")}`) {
      const lastNumber = firstNumber + expectedCaseCount - 1;
      throw new Error(`Research benchmark cases must be numbered consecutively from ${firstNumber} through ${lastNumber}; found ${testCase.id} at position ${expectedNumber}.`);
    }
    if (ids.has(testCase.id)) throw new Error(`Duplicate benchmark case ${testCase.id}.`);
    ids.add(testCase.id);
    for (const [fieldName, value] of [
      ["question", testCase.question],
      ["idealAnswer", testCase.idealAnswer],
      ["importantQualifications", testCase.importantQualifications]
    ]) {
      if (!String(value || "").trim()) throw new Error(`${testCase.id} is missing ${fieldName}.`);
    }
    if (!testCase.citations.length) throw new Error(`${testCase.id} has no citation expectations.`);
    if (testCase.citations.some((citation) => !citationRoles.has(citation.role))) {
      throw new Error(`${testCase.id} has an unclassified citation expectation.`);
    }
    if (!testCase.forbiddenClaims.length) throw new Error(`${testCase.id} has no forbidden claims.`);
    validateBenchmarkClaimRequirements(testCase.claimRequirements, {
      caseID: testCase.id,
      legacyForbiddenClaims: testCase.forbiddenClaims
    });
    if (Array.isArray(fixtureRange) && testCase.number >= fixtureRange[0] && testCase.number <= fixtureRange[1] && !testCase.fixture) {
      throw new Error(`${testCase.id} is missing its regression fixture.`);
    }
    if (sharedRubricNumber !== null && testCase.number === sharedRubricNumber && !testCase.regressionStatus) {
      throw new Error(`${testCase.id} is missing its shared-rubric status.`);
    }
    if (!String(testCase.evaluationInput || "").includes(testCase.question)) {
      throw new Error(`${testCase.id} has an invalid evaluation input.`);
    }
  }
  return dataset;
}
