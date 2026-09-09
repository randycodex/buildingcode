import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext,
  evaluateZoningDeterministicControls, zoningResearchPromptContext } from "../research-zoning-planner.mjs";
import { evaluateZoningResearchSafety, zoningResearchSafetyPromptContext } from "../research-zoning-safety.mjs";
import { zoningLotHistoryPremise } from "../research-zoning-lot-history.mjs";

globalThis.fetch = async () => { throw new Error("No network in zoning-lot history tests."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const retained = JSON.parse(await readFile(new URL("../evals/fixtures/research-section-reference-live-diagnostics-20260909.json", import.meta.url)));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const delivered = retained.cases.find((item) => item.id === "ZR-19").providerResponses
  .find((item) => item.phase === "permitext_code_interpretation").response;
const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === "ZR-19"), { original: true, zoningSummary: zoningSectionSummary });
input.pinnedEvidence = input.pinnedEvidence.map((pin) => ({ ...pin, selectionMode: "section_reference",
  sourceID: delivered.citations.find((citation) => citation.sectionID === pin.sectionID).sourceIDs[0] }));
const plan = planZoningResearchQuestion(input);
const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
const checks = (candidate, supplied = input, sources = assembled.sources) => {
  const questionPlan = planZoningResearchQuestion(supplied);
  const context = zoningResearchDeterministicContext({ ...supplied, evidence: sources, plan: questionPlan });
  return {
    context,
    controls: evaluateZoningDeterministicControls({ plan: questionPlan, deterministicContext: context, answer: candidate, providerRequestCount: 1 }),
    safety: evaluateZoningResearchSafety({ ...supplied, evidence: sources, answer: candidate, questionPlan }),
    prompt: zoningResearchPromptContext(questionPlan, context),
    safetyPrompt: zoningResearchSafetyPromptContext({ ...supplied, evidence: sources, questionPlan })
  };
};
const original = checks(delivered);
assert(original.controls.issues.some((issue) => issue.code === "HISTORICAL_LOT_PREMISE_REOPENED"),
  "The actually delivered answer must fail for asking again about the excluded historical premise.");
assert(original.safety.issues.some((issue) => issue.type === "historical_lot_premise_reopened"));

// Handwritten contrast for the checker, not generated quality evidence or a
// production answer. Reuse the actual source identity; keep retrieval intact.
const corrected = {
  ...structuredClone(delivered),
  answerText: "No. Given your statement that the lots were not historically one zoning lot, the current-formation routes in ZR § 12-10 require at least 10 linear feet of contiguity. Eight feet is below that minimum, so common ownership alone cannot combine them.",
  supportedPoints: [{ ...delivered.supportedPoints[0],
    explanation: "ZR § 12-10's filing-time routes require lots of record in one block to be contiguous for a minimum of 10 linear feet, plus the specified party-in-interest status or a recorded Declaration of Restrictions. A zoning lot may or may not coincide with a lot shown on the official tax map." }],
  missingFacts: [], followUpQuestions: [], additionalEvidenceNeeded: [],
  evidenceLimitations: ["This applies the historical status supplied in the question; no title record was independently verified."]
};
const fixed = checks(corrected);
assert(fixed.controls.pass, JSON.stringify(fixed.controls.issues));
assert(fixed.safety.pass, JSON.stringify(fixed.safety.issues));
assert.match(fixed.prompt, /Do not reopen/);
assert.match(fixed.safetyPrompt, /Do not reopen/);
assert(!fixed.context.answerObligations.find((item) => item.id === "definition_historical_branches").values.length,
  "The excluded historical branches must not force an irrelevant date recital.");

const questionWithoutHistory = input.question.replace(" and were not historically one zoning lot", "");
assert.notEqual(questionWithoutHistory, input.question);
const historicalPremise = "The lots were not historically one zoning lot.";
for (const extra of [
  { projectFacts: [historicalPremise] },
  { conversationFactContext: { established: [historicalPremise] } },
  { conversationFactContext: { qualified: [historicalPremise] } }
]) {
  const result = checks(corrected, { ...input, question: questionWithoutHistory, ...extra });
  assert(result.controls.pass, JSON.stringify(result.controls.issues));
  assert(result.safety.pass, JSON.stringify(result.safety.issues));
  assert.deepEqual(result.context.answerObligations.find((item) => item.id === "definition_historical_branches")
    .lotHistoryPremise.groundingStatements, [historicalPremise]);
}
for (const question of [
  input.question,
  input.question.replace("were not historically one", "were historically not one"),
  input.question.replace("were not historically one", "have never been a single"),
  input.question.replace("were not historically one", "never formed a single"),
  input.question.replaceAll("zoning lot", "zoning-lot")
]) assert.equal(zoningLotHistoryPremise({ question }).exclusion, "stated", question);

for (const fact of [
  "We do not know whether the lots were historically one zoning lot.",
  "It is uncertain whether the lots were not historically one zoning lot.",
  "The lots were not historically one zoning lot, but their history is disputed.",
  "The lots were not historically one zoning lot, according to the owner.",
  "The owner claims the lots were not historically one zoning lot.",
  "Representations: The lots were not historically one zoning lot.",
  "Unknown: The lots were not historically one zoning lot.",
  "The lots were never combined in a recorded zoning-lot merger.",
  "The lots were not one zoning lot in 2020.",
  "The historical zoning-lot records were not provided.",
  "Were the lots not historically one zoning lot?",
  "Can we assume the lots were not historically one zoning lot?",
  "Say the lots were not historically one zoning lot.",
  'The definition says "the lots were not historically one zoning lot."'
]) {
  const supplied = { ...input, question: questionWithoutHistory, projectFacts: [fact] };
  assert.equal(zoningLotHistoryPremise({ question: `${fact} ${questionWithoutHistory}` }).exclusion, null, fact);
  assert.equal(zoningLotHistoryPremise(supplied).exclusion, null, fact);
  const fabricated = checks(corrected, supplied);
  assert(fabricated.controls.issues.some((issue) => issue.code === "HISTORICAL_LOT_EXCLUSION_NOT_SUPPLIED"), fact);
  assert(fabricated.safety.issues.some((issue) => issue.type === "historical_lot_exclusion_not_supplied"), fact);
}
const unresolvedHistoryQuestion = { ...input, question: `The historical zoning-lot records were not provided. ${questionWithoutHistory}` };
assert(checks(corrected, unresolvedHistoryQuestion).safety.issues.some((issue) => issue.type === "historical_lot_exclusion_not_supplied"),
  "The safety check must also reject a fabricated premise when historical wording selects the date/history plan.");
for (const extra of [
  { projectFacts: ["The lots were historically one zoning lot."] },
  { projectFacts: ["The historical zoning-lot status is disputed."] },
  { conversationFactContext: { unknown: ["Historical zoning-lot status"] } }
]) assert.equal(zoningLotHistoryPremise({ ...input, ...extra }).exclusion, null);

const missingHistory = checks(delivered, { ...input, question: questionWithoutHistory });
assert(missingHistory.controls.pass, JSON.stringify(missingHistory.controls.issues));
assert(missingHistory.safety.pass, JSON.stringify(missingHistory.safety.issues));
assert.deepEqual(missingHistory.context.answerObligations.find((item) => item.id === "definition_historical_branches").values, ["December 15, 1961"]);
const noHistoryReview = checks(corrected, { ...input, question: questionWithoutHistory });
assert(noHistoryReview.safety.issues.some((issue) => issue.type === "zoning_definition_branch_omission"));

for (const field of ["missingFacts", "followUpQuestions", "additionalEvidenceNeeded"]) {
  for (const request of ["Whether the tract was in single ownership on December 15, 1961.", "Verify the historical lot-of-record status."]) {
    const result = checks({ ...corrected, [field]: [request] });
    assert(result.controls.issues.some((issue) => issue.code === "HISTORICAL_LOT_PREMISE_REOPENED" && issue.field === field));
    assert(result.safety.issues.some((issue) => issue.type === "historical_lot_premise_reopened" && issue.field === field));
  }
}
for (const field of ["answerText", "conclusion", "explanation", "supportedPoint"]) {
  const bad = structuredClone(corrected);
  const claim = "The historical definition branches are unresolved and must be verified.";
  if (field === "supportedPoint") bad.supportedPoints[0].explanation += ` ${claim}`;
  else bad[field] = `${bad[field] || ""} ${claim}`;
  assert(checks(bad).controls.issues.some((issue) => issue.code === "HISTORICAL_LOT_PREMISE_REOPENED"), field);
}

for (const extra of [
  { question: `Assume the lots have never been a single zoning lot. ${questionWithoutHistory}` },
  { question: questionWithoutHistory, conversationFactContext: { hypothetical: [historicalPremise] } }
]) {
  const supplied = { ...input, ...extra };
  assert.equal(zoningLotHistoryPremise(supplied).exclusion, "hypothetical");
  assert(checks(corrected, supplied).controls.issues.some((issue) => issue.code === "HISTORICAL_LOT_HYPOTHESIS_AS_FACT"));
  const conditional = { ...corrected, answerText: corrected.answerText.replace("Given your statement", "Assuming") };
  assert(checks(conditional, supplied).controls.pass, JSON.stringify(checks(conditional, supplied).controls.issues));
  assert(checks(conditional, supplied).safety.pass, JSON.stringify(checks(conditional, supplied).safety.issues));
}

// Replay the subsequently delivered answer against canonical sources carrying
// its actual identities. This establishes regression behavior, not a new call.
const confirmation = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-lot-history-2026-09-09.json", import.meta.url)));
const confirmed = confirmation.results.find((item) => item.id === "ZR-19");
assert.equal(confirmed.status, "completed");
assert.equal(confirmed.question, input.question);
const confirmedInput = { ...input, pinnedEvidence: input.pinnedEvidence.map((pin) => ({ ...pin,
  sourceID: confirmed.answer.citations.find((citation) => citation.sectionID === pin.sectionID).sourceIDs[0] })) };
const confirmedAssembly = await assembledResearchEvidenceForTurn({ ...confirmedInput,
  corpusPlan: await researchCorpusPlanForTurn(confirmedInput), zoningPlan: planZoningResearchQuestion(confirmedInput) });
const confirmedChecks = checks(confirmed.answer, confirmedInput, confirmedAssembly.sources);
assert(confirmedChecks.controls.pass, JSON.stringify(confirmedChecks.controls.issues));
assert(confirmedChecks.safety.pass, JSON.stringify(confirmedChecks.safety.issues));
for (const field of ["missingFacts", "followUpQuestions", "additionalEvidenceNeeded"]) assert.deepEqual(confirmed.answer[field], []);

console.log("Zoning-lot history contract passed: original defect and subsequent delivered repair; stated, missing, disputed and hypothetical premises; source/rule obligations preserved; zero new API calls.");
