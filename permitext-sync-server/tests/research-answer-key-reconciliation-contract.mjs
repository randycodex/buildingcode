import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  reconciledAnswerKeyURL, reconciledAnswerKeyMarkdownURL,
  validateReconciledAnswerKey, renderReconciledAnswerKey, reconciledResearchEvaluationInput
} from "../evals/research-answer-key-reconciliation.mjs";
import { researchAnswerPresentationContract } from "../research-answer-presentation.mjs";

const dataset = JSON.parse(await readFile(reconciledAnswerKeyURL, "utf8"));
assert.deepEqual(await validateReconciledAnswerKey(dataset), { CC: 5, ZR: 21, DOBNOW: 24 });
assert.equal(await readFile(reconciledAnswerKeyMarkdownURL, "utf8"), renderReconciledAnswerKey(dataset));
const caseByID = (id) => dataset.cases.find((item) => item.id === id);
assert.match(caseByID("CC-04").expectedAnswer, /nonaccessory/);
assert.match(caseByID("CC-05").expectedAnswer, /lavatory and a vanity/);
assert.match(caseByID("ZR-09").expectedAnswer, /limits.*amount of affordable housing/);
assert.match(caseByID("ZR-17").question, /11-333/);
assert.match(caseByID("DOBNOW-003").expectedAnswer, /CO process/);
assert.match(caseByID("DOBNOW-004").expectedAnswer, /current FAQ/);
assert.match(caseByID("DOBNOW-008").expectedAnswer, /Construction Superintendent/);
assert.match(caseByID("DOBNOW-012").expectedAnswer, /City-owned sewer/);
assert.match(caseByID("DOBNOW-016").expectedAnswer, /Narrative Statement/);
assert.match(caseByID("DOBNOW-018").requiredConcepts.join(" "), /apparent typo/);

for (const testCase of dataset.cases) {
  const input = reconciledResearchEvaluationInput({ ...testCase, expectedAnswer: "ANSWER_KEY_LEAK", requiredConcepts: ["RUBRIC_LEAK"], forbiddenClaims: ["FORBIDDEN_LEAK"] });
  assert.doesNotMatch(JSON.stringify(input), /ANSWER_KEY_LEAK|RUBRIC_LEAK|FORBIDDEN_LEAK/);
  if (testCase.id.startsWith("DOBNOW")) assert.ok(input.question.includes(testCase.scenario));
  if (testCase.id.startsWith("CC")) assert.ok(input.selectedEvidence.length);
  if (testCase.id.startsWith("ZR")) assert.ok(input.selectedEvidenceSectionIDs.length);
  const format = researchAnswerPresentationContract({ question: testCase.question, evidence: testCase.selectedEvidence || [] });
  assert.deepEqual(format.answerSequence, dataset.answerSequence);
  assert.ok(format.universalRules.some((rule) => /not four mandatory headings/.test(rule)));
  assert.ok(format.universalRules.some((rule) => /condition.*opening answer/.test(rule)));
}
const corrupted = structuredClone(dataset);
corrupted.cases.find((item) => item.id === "DOBNOW-005").scenario = "";
await assert.rejects(() => validateReconciledAnswerKey(corrupted), /lost its scenario/);
const lostCorrection = structuredClone(dataset);
lostCorrection.cases.find((item) => item.id === "DOBNOW-003").expectedAnswer = "Every subsequent filing needs its own LOC.";
await assert.rejects(() => validateReconciledAnswerKey(lostCorrection), /lost a reviewed answer correction/);
console.log("Reconciled 50-case provenance, scenarios, corrections, input isolation and answer format passed.");
