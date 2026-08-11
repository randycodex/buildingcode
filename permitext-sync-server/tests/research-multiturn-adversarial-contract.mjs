import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateResearchMultiturnAdversarial,
  formatResearchMultiturnAdversarialReport,
  researchMultiturnAdversarialEvaluationVersion
} from "../evals/research-multiturn-adversarial.mjs";

const dataset = JSON.parse(await readFile(
  new URL("../evals/research-multiturn-adversarial-cases.json", import.meta.url),
  "utf8"
));

const expectedBehaviors = [
  "pronoun follow-up",
  "correction",
  "request for details",
  "exact unrelated provision relevance check",
  "same-number other code books",
  "explicit new topic",
  "implicit new topic",
  "return to original topic",
  "pasted text",
  "project-fact follow-up"
];

assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.cases.length, expectedBehaviors.length);
assert.deepEqual(dataset.cases.map((testCase) => testCase.behavior), expectedBehaviors);
assert(dataset.cases.every((testCase) => testCase.expected?.topicAction));
assert(dataset.cases.every((testCase) =>
  Array.isArray(testCase.expected?.requiredEvidenceRoles) &&
  Array.isArray(testCase.expected?.forbiddenEvidenceRoles) &&
  Array.isArray(testCase.expected?.requiredCodePrefixes) &&
  Array.isArray(testCase.expected?.forbiddenCodePrefixes)
));

const discover = async ({ testCase }) => ({
  retrievalVersion: dataset.benchmarkVersion,
  generatedAnswer: false,
  paidModelCall: false,
  candidates: structuredClone(testCase.evidence)
});

const resolveSection = async (request, testCase) => {
  const match = testCase.evidence.find((source) =>
    String(source.sectionID) === String(request.sectionID) ||
    (source.codePrefix === request.codePrefix && source.sectionNumber === request.sectionNumber)
  );
  return match ? structuredClone(match) : null;
};

const first = await evaluateResearchMultiturnAdversarial({ dataset, discover, resolveSection });
const second = await evaluateResearchMultiturnAdversarial({ dataset, discover, resolveSection });

assert.deepEqual(second, first, "Offline scoring must be deterministic across identical runs.");
assert.equal(first.evaluationVersion, researchMultiturnAdversarialEvaluationVersion);
assert.equal(first.diagnosticOnly, true);
assert.equal(first.paidModelCall, false);
assert.equal(first.summary.caseCount, 10);
assert.equal(first.summary.passedCaseCount, 10);
assert.equal(first.summary.passedCheckCount, first.summary.checkCount);
assert.equal(first.summary.score, 1);
assert(first.cases.every((result) => result.passed));
assert(first.cases.every((result) => result.paidModelCall === false));

assert.equal(first.cases.find((result) => result.id === "pronoun-follow-up").topicAction, "continue_root");
assert.equal(first.cases.find((result) => result.id === "exact-unrelated-provision-relevance").topicAction, "compare_to_root");
assert.deepEqual(
  first.cases.find((result) => result.id === "exact-unrelated-provision-relevance").evidenceRoles,
  ["governing", "contextual"]
);
assert.deepEqual(
  first.cases.find((result) => result.id === "same-number-other-code-books").codePrefixes,
  ["BC"]
);
assert.equal(first.cases.find((result) => result.id === "same-number-other-code-books").topicAction, "continue_root");
assert.equal(first.cases.find((result) => result.id === "explicit-new-topic").topicAction, "replace_topic");
assert.equal(first.cases.find((result) => result.id === "implicit-new-topic").topicAction, "replace_topic");
assert.match(
  first.cases.find((result) => result.id === "return-to-original-topic").retrievalQuery,
  /Previous topic:.*BC 709\.3/s
);
assert.match(
  first.cases.find((result) => result.id === "pasted-text-comparison").retrievalQuery,
  /Root topic:.*BC 709\.3.*Previous topic: Pasted text.*BC 101\.1/s
);
assert.match(
  first.cases.find((result) => result.id === "project-fact-follow-up").retrievalQuery,
  /Project facts:.*100 dwelling units.*R-2/s
);

const contaminationDataset = structuredClone(dataset);
contaminationDataset.cases.find((testCase) =>
  testCase.id === "same-number-other-code-books"
).evidence.push({
  sectionID: "fgc-101-1-contamination",
  codePrefix: "FGC",
  sectionNumber: "101.1",
  title: "Title",
  canonicalText: "This code shall be known as the New York City Fuel Gas Code.",
  signals: { exactTopicRouteTarget: true }
});
const contaminated = await evaluateResearchMultiturnAdversarial({
  dataset: contaminationDataset,
  discover,
  resolveSection
});
const contaminatedCase = contaminated.cases.find((result) =>
  result.id === "same-number-other-code-books"
);
assert.equal(contaminatedCase.passed, false);
assert.equal(
  contaminatedCase.checks.find((item) => item.name === "forbidden-code-prefixes").passed,
  false,
  "Same-number evidence from the wrong code book must deterministically fail the benchmark."
);
assert.equal(
  contaminatedCase.checks.find((item) => item.name === "forbidden-references").passed,
  false
);

const paidCall = await evaluateResearchMultiturnAdversarial({
  dataset: { ...dataset, cases: [dataset.cases[0]] },
  discover: async (options) => ({ ...(await discover(options)), paidModelCall: true }),
  resolveSection
});
assert.equal(paidCall.paidModelCall, true);
assert.equal(paidCall.cases[0].passed, false);
assert.equal(
  paidCall.cases[0].checks.find((item) => item.name === "no-paid-model-call").passed,
  false
);

const formatted = formatResearchMultiturnAdversarialReport(first);
assert.match(formatted, /10\/10 cases/);
assert.match(formatted, /paid model calls: no/);
assert.match(formatted, /diagnostic only/);

console.log("Permitext Research multi-turn adversarial contract passed.");
