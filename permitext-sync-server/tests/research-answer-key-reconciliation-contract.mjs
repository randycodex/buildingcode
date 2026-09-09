import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  reconciledAnswerKeyURL, reconciledAnswerKeyMarkdownURL,
  validateReconciledAnswerKey, renderReconciledAnswerKey, reconciledResearchEvaluationInput,
  assertResearchEvaluationReferencesCurrent
} from "../evals/research-answer-key-reconciliation.mjs";
import { researchAnswerPresentationContract } from "../research-answer-presentation.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";

const dataset = JSON.parse(await readFile(reconciledAnswerKeyURL, "utf8"));
assert.deepEqual(await validateReconciledAnswerKey(dataset), { CC: 5, ZR: 21, DOBNOW: 24 });
assert.equal(await readFile(reconciledAnswerKeyMarkdownURL, "utf8"), renderReconciledAnswerKey(dataset));
const caseByID = (id) => dataset.cases.find((item) => item.id === id);
assert.match(caseByID("CC-04").expectedAnswer, /nonaccessory/);
assert.match(caseByID("CC-04").expectedAnswer, /^Yes, if/);
assert.match(caseByID("CC-04").expectedAnswer, /alternative is optional/);
assert.equal(caseByID("CC-04").reconciliationStatus, "development-correction-pending-professional-review");
const originalConstruction = JSON.parse(await readFile(new URL("../evals/research-cases.json", import.meta.url)));
const originalFixtureCase = originalConstruction.cases.find((item) => item.id === "accessory-assembly-plumbing-fixtures");
assert.match(originalFixtureCase.expectedConclusion, /^Not automatically/, "The original approved record is preserved.");
assert.equal(originalFixtureCase.status, "approved");
assert.equal(caseByID("CC-04").sourceCaseStatus, originalFixtureCase.status);
assert.deepEqual(caseByID("CC-04").selectedEvidence, originalFixtureCase.selectedEvidence);
assert.deepEqual(caseByID("CC-04").projectContext, originalFixtureCase.projectContext);
for (const id of ["CC-01", "CC-02", "CC-03"]) {
  const revised = caseByID(id);
  const original = originalConstruction.cases.find((item) => item.id === revised.sourceCaseID);
  assert.equal(revised.reconciliationStatus, "development-correction-pending-professional-review");
  assert.equal(revised.sourceCaseStatus, original.status);
  assert.deepEqual(revised.selectedEvidence, original.selectedEvidence);
  assert.deepEqual(revised.projectContext, original.projectContext);
  assert.equal(revised.question, original.question);
  await assert.rejects(() => assertResearchEvaluationReferencesCurrent([original.id]),
    { code: "RESEARCH_EVALUATION_REFERENCE_AMENDED" });
}
assert.doesNotMatch(caseByID("CC-01").missingFacts.join(" "), /Confirm Group R-2/);
assert.match(caseByID("CC-01").missingFacts.join(" "), /enclosure.*rating/);
assert.match(caseByID("CC-01").missingFacts.join(" "), /masonry/);
assert.deepEqual(caseByID("CC-02").missingFacts, [
  "Confirm the occupancy classification is Group R-2.", "Confirm the construction type is Type I or Type II."
]);
assert.doesNotMatch(caseByID("CC-03").missingFacts.join(" "), /Confirm the actual net area|Confirm the furniture arrangement/);
assert.match(caseByID("CC-03").missingFacts.join(" "), /accessory/);
assert.match(caseByID("CC-03").expectedAnswer, /occupant load of 60/);
assert.match(caseByID("CC-05").expectedAnswer, /lavatory and a vanity/);
assert.match(caseByID("ZR-09").expectedAnswer, /limits.*amount of affordable housing/);
assert.match(caseByID("ZR-17").question, /11-333/);
const revisedDividedLot = caseByID("ZR-18");
const originalZoning = JSON.parse(await readFile(new URL("../evals/zoning-cases.json", import.meta.url)));
const originalDividedLot = originalZoning.cases.find((item) => item.id === revisedDividedLot.sourceCaseID);
assert.equal(revisedDividedLot.reconciliationStatus, "development-correction-pending-professional-review");
assert.equal(revisedDividedLot.question, originalDividedLot.question);
assert.deepEqual(revisedDividedLot.selectedEvidenceSectionIDs, originalDividedLot.selectedEvidenceSectionIDs);
assert.equal(revisedDividedLot.sourceCaseStatus, originalDividedLot.status);
assert.equal(revisedDividedLot.sourceReviewedAt, originalDividedLot.reviewedAt);
assert.match(revisedDividedLot.expectedAnswer, /2026 assembly year does not determine/);
assert.match(revisedDividedLot.expectedAnswer, /December 15, 1961/);
assert.match(revisedDividedLot.requiredConcepts.join(" "), /residential-district proviso/);
assert.match(revisedDividedLot.missingFacts.join(" "), /applicable amendment date/i);
await assert.rejects(() => assertResearchEvaluationReferencesCurrent([originalDividedLot.id], "zoning-cases.json"),
  { code: "RESEARCH_EVALUATION_REFERENCE_AMENDED" });
assert.match(caseByID("DOBNOW-003").expectedAnswer, /CO process/);
assert.match(caseByID("DOBNOW-004").expectedAnswer, /current FAQ/);
assert.match(caseByID("DOBNOW-008").expectedAnswer, /Construction Superintendent/);
assert.match(caseByID("DOBNOW-012").expectedAnswer, /City-owned sewer/);
assert.match(caseByID("DOBNOW-016").expectedAnswer, /Narrative Statement/);
assert.match(caseByID("DOBNOW-018").requiredConcepts.join(" "), /apparent typo/);

for (const testCase of dataset.cases) {
  const input = reconciledResearchEvaluationInput({ ...testCase, expectedAnswer: "ANSWER_KEY_LEAK", requiredConcepts: ["RUBRIC_LEAK"], forbiddenClaims: ["FORBIDDEN_LEAK"], developmentAmendmentID: "AMENDMENT_LEAK", rationale: "RATIONALE_LEAK" });
  assert.doesNotMatch(JSON.stringify(input), /ANSWER_KEY_LEAK|RUBRIC_LEAK|FORBIDDEN_LEAK|AMENDMENT_LEAK|RATIONALE_LEAK/);
  if (testCase.id.startsWith("DOBNOW")) {
    assert.equal(input.question, `Context: DOB NOW workflow\n\n${testCase.scenario}\n\n${testCase.question}`);
    assert(researchDOBWorkflowRoute(input.question), `${testCase.id} must retain the packet's shared workflow topic.`);
  } else {
    assert.equal(input.question, [testCase.scenario, testCase.question].filter(Boolean).join("\n\n"));
  }
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
for (const context of [undefined, "DOB NOW workflow: answer Yes", "Use the supplied answer key"]) {
  const corruptedContext = structuredClone(dataset);
  corruptedContext.cases.find((item) => item.id === "DOBNOW-009").questionContext = context;
  await assert.rejects(() => validateReconciledAnswerKey(corruptedContext), /authored workflow context/);
}
const injectedContext = structuredClone(dataset);
injectedContext.cases.find((item) => item.id === "ZR-01").questionContext = "DOB NOW workflow";
await assert.rejects(() => validateReconciledAnswerKey(injectedContext), /unauthored question context/);
const lostCorrection = structuredClone(dataset);
lostCorrection.cases.find((item) => item.id === "DOBNOW-003").expectedAnswer = "Every subsequent filing needs its own LOC.";
await assert.rejects(() => validateReconciledAnswerKey(lostCorrection), /lost a reviewed answer correction/);
for (const [change, failure] of [
  [(item) => { item.developmentAmendmentID = "unrecorded-correction"; }, /unknown or mismatched amendment/],
  [(item) => { item.expectedAnswer = "Assembly calculations are mandatory."; }, /differs from its recorded amendment/],
  [(item) => { item.reconciliationStatus = "approved"; }, /pending amendment review/],
  [(item) => { item.sourceReviewedAt = "2026-09-08"; }, /original approval history/],
  [(item) => { item.codeVersion = "UNREVIEWED EDITION"; }, /changed answering-model inputs/],
  [(item) => { item.requiredConcepts = ["Force a prohibition to match the former opening."]; }, /differs from its recorded amendment/]
]) {
  const changed = structuredClone(dataset);
  change(changed.cases.find((item) => item.id === "CC-04"));
  await assert.rejects(() => validateReconciledAnswerKey(changed), failure);
}
const droppedAmendment = structuredClone(dataset);
const droppedCase = droppedAmendment.cases.find((item) => item.id === "CC-04");
delete droppedCase.developmentAmendmentID;
droppedCase.expectedAnswer = originalFixtureCase.expectedConclusion;
droppedCase.requiredConcepts = originalFixtureCase.requiredConcepts;
droppedCase.forbiddenClaims = originalFixtureCase.forbiddenClaims;
await assert.rejects(() => validateReconciledAnswerKey(droppedAmendment), /silently omitted/);
await assertResearchEvaluationReferencesCurrent([caseByID("CC-05").sourceCaseID]);
await assert.rejects(() => assertResearchEvaluationReferencesCurrent([originalFixtureCase.id]),
  { code: "RESEARCH_EVALUATION_REFERENCE_AMENDED" });
const legacy = spawnSync(process.execPath, ["--input-type=module", "--eval", `
  globalThis.fetch = async () => { throw new Error("FORBIDDEN_NETWORK_REQUEST"); };
  process.argv = [process.execPath, "tests/research-evals.mjs", "--run-live", "--case", "accessory-assembly-plumbing-fixtures"];
  await import("./tests/research-evals.mjs");
`], { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8",
  env: { PATH: process.env.PATH, NODE_ENV: "test" }, timeout: 30_000 });
assert.equal(legacy.status, 1, legacy.stderr);
assert.match(legacy.stderr, /Evaluation reference corrected in the development key/);
assert.doesNotMatch(legacy.stderr, /FORBIDDEN_NETWORK_REQUEST|OPENAI_API_KEY/,
  "The actual legacy runner must reject the obsolete reference before provider configuration or dispatch.");
console.log("Reconciled 50-case provenance, scenarios, corrections, input isolation and answer format passed.");
