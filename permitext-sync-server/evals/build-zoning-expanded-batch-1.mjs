import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(evalsDirectory, "..");
const workspaceRoot = resolve(serverRoot, "..");
const originalPath = resolve(evalsDirectory, "zoning-cases.json");
const intakePath = resolve(evalsDirectory, "zoning-candidate-batch-1-intake.json");
const sourcePath = resolve(workspaceRoot, "Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md");
const outputPath = resolve(evalsDirectory, "zoning-cases-expanded-batch-1.json");
const originalExpectedSHA256 = "90b9cf4c5c3ea40522103d42a9b8ec052b044cf42be019cae53eed61cfa008a6";
const approvedSourceCaseNumbers = [2, 4, 5, 6, 7, 8, 9, 10, 12];
const heldSourceCaseNumbers = [1, 3, 11];

const categoryBySourceCaseNumber = new Map([
  [2, "conditional-qualification"],
  [4, "dimensional"],
  [5, "mapped-applicability"],
  [6, "arithmetic"],
  [7, "nonconforming-use"],
  [8, "arithmetic"],
  [9, "conditional-qualification"],
  [10, "effective-date-transition"],
  [12, "explicit-uncertainty"]
]);

const evidenceReviewTermsBySourceCaseNumber = new Map([
  [2, { "20022699": ["Affordable floor area", "UAP development"] }],
  [4, { "20018523": ["lot, through"] }],
  [5, {
    "20018523": ["Transit Zone, Greater", "Transit Zone, Inner", "Transit Zone, Outer"]
  }],
  [12, {
    "20018523": ["a lot of record existing on December 15, 1961", "minimum of 10 linear feet"]
  }]
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeMarkdown(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blockBetween(body, startMarker, endMarker) {
  const start = body.indexOf(startMarker);
  assert(start >= 0, `Missing ${startMarker}.`);
  const contentStart = start + startMarker.length;
  const end = body.indexOf(endMarker, contentStart);
  assert(end >= 0, `Missing ${endMarker}.`);
  return body.slice(contentStart, end).trim();
}

function bulletBlocks(block) {
  const items = [];
  let current = null;
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      if (current) items.push(normalizeMarkdown(current));
      current = line.slice(2);
    } else if (current) {
      current += ` ${line}`;
    }
  }
  if (current) items.push(normalizeMarkdown(current));
  return items.filter(Boolean);
}

function answerConcepts(block) {
  const concepts = [];
  let paragraph = [];
  const flush = () => {
    const value = normalizeMarkdown(paragraph.join(" "));
    if (value) concepts.push(value);
    paragraph = [];
  };
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("- ")) {
      flush();
      concepts.push(normalizeMarkdown(line.slice(2)));
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return concepts;
}

function sourceCases(sourceMarkdown) {
  const cases = new Map();
  for (const match of sourceMarkdown.matchAll(/^## Case (\d+)\n([\s\S]*?)(?=^## Case \d+\n|(?![\s\S]))/gm)) {
    cases.set(Number(match[1]), match[2]);
  }
  return cases;
}

function candidateCase(intakeCase, sourceBody) {
  const question = normalizeMarkdown(blockBetween(
    sourceBody,
    "**Realistic customer question:**",
    "**Known facts:**"
  ));
  const safeAnswer = answerConcepts(blockBetween(
    sourceBody,
    "**Expected safe answer:**",
    "**Required concepts:**"
  ));
  const concepts = bulletBlocks(blockBetween(
    sourceBody,
    "**Required concepts:**",
    "**Required calculation, if any:**"
  ));
  const calculations = bulletBlocks(blockBetween(
    sourceBody,
    "**Required calculation, if any:**",
    "**Forbidden or unsafe claims:**"
  ));
  const forbiddenClaims = bulletBlocks(blockBetween(
    sourceBody,
    "**Forbidden or unsafe claims:**",
    "**Necessary follow-up questions:**"
  ));
  assert(question, `Source case ${intakeCase.sourceCaseNumber} has no question.`);
  assert(safeAnswer.length > 0, `Source case ${intakeCase.sourceCaseNumber} has no safe answer.`);
  assert(concepts.length > 0, `Source case ${intakeCase.sourceCaseNumber} has no required concepts.`);
  assert(calculations.length > 0, `Source case ${intakeCase.sourceCaseNumber} has no calculations.`);
  assert(forbiddenClaims.length > 0, `Source case ${intakeCase.sourceCaseNumber} has no forbidden claims.`);

  return {
    id: intakeCase.id,
    title: intakeCase.title,
    category: categoryBySourceCaseNumber.get(intakeCase.sourceCaseNumber),
    status: "approved",
    question,
    selectedEvidenceSectionIDs: intakeCase.selectedEvidenceSectionIDs,
    ...(evidenceReviewTermsBySourceCaseNumber.has(intakeCase.sourceCaseNumber)
      ? { evidenceReviewTermsBySection: evidenceReviewTermsBySourceCaseNumber.get(intakeCase.sourceCaseNumber) }
      : {}),
    requiredConcepts: [...safeAnswer, ...concepts, ...calculations],
    forbiddenClaims,
    evidenceMode: intakeCase.evidenceMode,
    sourceCaseNumber: intakeCase.sourceCaseNumber,
    sourceFile: "Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md",
    approvalScope: intakeCase.approvalScope,
    reviewer: intakeCase.reviewer,
    reviewedAt: intakeCase.reviewedAt
  };
}

const [originalText, intakeText, sourceMarkdown] = await Promise.all([
  readFile(originalPath, "utf8"),
  readFile(intakePath, "utf8"),
  readFile(sourcePath, "utf8")
]);
assert(sha256(originalText) === originalExpectedSHA256, "The immutable 21-case parent benchmark changed.");

const original = JSON.parse(originalText);
const intake = JSON.parse(intakeText);
const sourceByNumber = sourceCases(sourceMarkdown);
assert(original.cases.length === 21, "The immutable parent benchmark must contain 21 cases.");
assert(intake.governance?.createSeparateExpandedCohortAuthorized === true, "Expanded-cohort creation lacks owner authorization.");
assert(intake.governance?.paidEvaluationAllowed === false, "Candidate intake unexpectedly permits paid evaluation.");
assert(sourceByNumber.size === 12, "Candidate source must contain exactly 12 cases.");

const approvedCandidates = approvedSourceCaseNumbers.map((sourceCaseNumber) => {
  const intakeCase = intake.cases.find((testCase) => testCase.sourceCaseNumber === sourceCaseNumber);
  assert(intakeCase, `Missing intake case ${sourceCaseNumber}.`);
  assert(intakeCase.status === "approved", `Intake case ${sourceCaseNumber} is not owner-approved.`);
  assert(intakeCase.reviewer && intakeCase.reviewedAt, `Intake case ${sourceCaseNumber} lacks reviewer metadata.`);
  assert(sourceByNumber.has(sourceCaseNumber), `Missing source case ${sourceCaseNumber}.`);
  return candidateCase(intakeCase, sourceByNumber.get(sourceCaseNumber));
});

for (const sourceCaseNumber of heldSourceCaseNumbers) {
  const intakeCase = intake.cases.find((testCase) => testCase.sourceCaseNumber === sourceCaseNumber);
  assert(intakeCase?.status === "draft", `Held intake case ${sourceCaseNumber} must remain draft.`);
}

const expanded = {
  schemaVersion: 1,
  name: "Permitext NYC Zoning Resolution expanded diagnostic cohort — Batch 1",
  libraryID: original.libraryID,
  codeVersion: original.codeVersion,
  researchEligibility: false,
  governance: {
    status: "frozen",
    frozenAt: "2026-08-30T17:34:16.000Z",
    frozenCaseCount: 30,
    parentCohort: {
      file: "zoning-cases.json",
      caseCount: 21,
      sha256: originalExpectedSHA256,
      mutationAuthorized: false
    },
    expansionSource: {
      sourceFile: "Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md",
      sourceSHA256: sha256(sourceMarkdown),
      intakeFile: "zoning-candidate-batch-1-intake.json",
      intakeSHA256: sha256(intakeText),
      approvedSourceCaseNumbers,
      heldSourceCaseNumbers
    },
    humanOwnerReviewRequired: true,
    automaticApprovalAllowed: false,
    professionalZoningSignoff: false,
    publicResearchReleaseAuthorized: false,
    paidEvaluationAllowed: false,
    paidEvaluationAuthorization: {
      status: "locked",
      authorizedCaseCount: null,
      repetitions: null,
      maximumCumulativeSpendUSD: null,
      requiresNewExplicitOwnerAuthorization: true,
      requiresNewExplicitCumulativeSpendCap: true,
      notes: "No paid call is authorized by candidate approval or no-cost cohort validation."
    },
    notes: "The first 21 cases are byte-for-byte logical copies of the immutable parent cohort. Nine owner-approved Batch 1 cases are appended. Cases 1, 3, and 11 remain held outside this cohort."
  },
  cases: [...original.cases, ...approvedCandidates]
};

assert(expanded.cases.length === expanded.governance.frozenCaseCount, "Expanded case count mismatch.");
assert(new Set(expanded.cases.map((testCase) => testCase.id)).size === expanded.cases.length, "Expanded cohort has duplicate case IDs.");

const output = `${JSON.stringify(expanded, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  const existing = await readFile(outputPath, "utf8");
  assert(existing === output, "Expanded cohort is stale. Run node evals/build-zoning-expanded-batch-1.mjs --write.");
  console.log("Expanded Zoning Batch 1 cohort is current.");
}
