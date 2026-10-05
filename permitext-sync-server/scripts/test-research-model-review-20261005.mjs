import assert from "node:assert/strict";
import { buildModelReviewRequest, validateModelReview, modelReviewBatches } from "./run-research-model-review-20261005.mjs";
import { validationReservation } from "./research-validation-pricing-20261005.mjs";
globalThis.fetch = () => { throw Error("Model-review contracts forbid external calls"); };
const { batches } = await modelReviewBatches();
assert.equal(batches.length, 8);
assert.equal(batches.slice(3).flatMap(batch => batch.cases.flatMap(item => item.questions)).length, 40);
for (const batch of batches) {
  const enriched = { ...batch, expectedPass: "PRIOR_GRADE_LEAK", priorAnswer: "PREVIOUS_ANSWER_LEAK",
    cases: batch.cases.map(item => ({ ...item, checks: ["PRIOR_RUBRIC_LEAK"] })) };
  const body = buildModelReviewRequest(enriched, batch.sources);
  assert.equal(body.model, "gpt-6-luna"); assert.equal(body.reasoning.effort, "medium");
  assert.equal(body.service_tier, "priority"); assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 8000);
  assert.equal(body.tools, undefined); assert.equal(body.previous_response_id, undefined);
  assert.doesNotMatch(body.input, /PRIOR_GRADE_LEAK|PREVIOUS_ANSWER_LEAK|PRIOR_RUBRIC_LEAK|"checks"/);
  assert(validationReservation(body) > 0);
  assert.throws(() => buildModelReviewRequest(batch, batch.sources.map((source, index) =>
    index ? source : { ...source, text: source.text + " Invented condition." })), /Expected values/);
  const review = { cases: batch.cases.map(item => ({ id: item.id, turns: item.questions.map((_, index) => ({
    turn: index + 1, status: "clear_from_supplied_text", boundedConclusion: "Synthetic bounded criterion.",
    materialChecks: [{ criterion: "Synthetic mechanics only.", sourceReferences: [batch.sources[0].reference] }],
    forbiddenClaims: [], genuineUnknowns: [], neededReferences: [], reasoning: "Synthetic reviewer envelope." })) })), reviewLimitations: [] };
  assert.equal(validateModelReview(batch, batch.sources, review), review);
  const omitted = structuredClone(review); omitted.cases[0].turns.pop();
  assert.throws(() => validateModelReview(batch, batch.sources, omitted));
  const invented = structuredClone(review); invented.cases[0].turns[0].materialChecks[0].sourceReferences = ["INVENTED 123"];
  assert.throws(() => validateModelReview(batch, batch.sources, invented));
  const ambiguity = structuredClone(review); ambiguity.cases[0].turns[0].status = "ambiguous";
  assert.throws(() => validateModelReview(batch, batch.sources, ambiguity));
  const missing = structuredClone(review); missing.cases.pop();
  assert.throws(() => validateModelReview(batch, batch.sources, missing));
}
console.log("Separate model-review contracts passed: eight source/question batches, no old answers or grades, exact source hashes, Luna medium role, complete turn/binding checks; zero external calls.");
