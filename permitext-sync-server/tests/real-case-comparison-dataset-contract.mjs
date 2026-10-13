import assert from "node:assert/strict";
import { prepareRealCaseDataset } from "../scripts/real-case-comparison-dataset.mjs";
import { writerComparisonRequests, assertWriterControls } from "../scripts/real-case-comparison-requests.mjs";
import { researchPracticalNextStepInstruction } from "../research-practical-next-step.mjs";

const entry = {
  id: "TEST-01", category: "Mechanical Code", target_jurisdiction: "New York City",
  research_as_of: "2026-10-06", question: "Can I drain this unit by gravity?", provided_facts: ["Interior-wall unit"],
  missing_facts: ["SECRET missing facts"], expected_answer: "SECRET answer key", code_edition: "2022 MC",
  answer_time_basis: "Current counterpart", location_status: "Unknown; adapted to NYC", review_status: "Needs review",
  source: { url: "https://example.com/thread", retrieval_status: "opened" },
  authorities: [{ section: "SECRET section", url: "https://example.com/law" }],
  must_include: ["SECRET required rubric"], must_not_claim: ["SECRET forbidden rubric"]
};
const fixture = { metadata: { case_count: 1, unique_original_thread_count: 1, coverage: { "Mechanical Code": 1 }, additional_review_flags: ["TEST-01"], explicit_NYC_adaptation_with_unstated_source_jurisdiction: ["TEST-01"] }, cases: [entry] };
const result = prepareRealCaseDataset(JSON.stringify(fixture));
assert.equal(result.inputs.length, 1);
assert.doesNotMatch(JSON.stringify(result.inputs), /SECRET|authorities|must_include|must_not_claim|missing_facts|expected_answer/);
assert.match(result.inputs[0].prompt, /Interior-wall unit/);
assert.match(result.inputs[0].prompt, /original project's jurisdiction is unknown/);
assert.match(result.inputs[0].prompt, /Unknown; adapted to NYC/);
assert.equal(result.references[0].status, "draft");
assert.equal(result.references[0].independentlyVerifiedInThisExercise, false);
assert.equal(result.references[0].additionalVerificationRequired, true);
assert.equal(result.sourceSHA256.length, 64);
for (const mutate of [
  d => { d.cases.push(structuredClone(entry)); d.metadata.case_count = 2; },
  d => { d.metadata.case_count = 2; },
  d => { d.cases[0].authorities = []; },
  d => { d.cases[0].source.url = "javascript:alert(1)"; },
  d => { d.cases[0].id = "../../outside"; },
  d => { d.metadata.additional_review_flags = ["NONEXISTENT"]; }
]) {
  const invalid = structuredClone(fixture); mutate(invalid);
  assert.throws(() => prepareRealCaseDataset(JSON.stringify(invalid)));
}
console.log("Real-case dataset integrity and answer-key separation passed; provider calls: 0.");
const sourceBlock = "AUTHORIZED ENACTED EVIDENCE\nENACTED_TEXT: Fixed official evidence.";
const request = { model: "gpt-6-luna", reasoning: { effort: "low" }, store: false, instructions: "Current writer policy", input: `QUESTION\nExample?\n\nPrefix policy\n\n${sourceBlock}\n\nSuffix policy`, text: { format: { type: "json_schema" } }, max_output_tokens: 24000 };
const variants = writerComparisonRequests({ currentRequest: request, question: "Example?", sourceBlock });
assertWriterControls(variants);
assert.match(variants.current.instructions, /Prefix policy/);
assert.match(variants.current.instructions, /Suffix policy/);
assert.doesNotMatch(variants.minimal.instructions, /Prefix policy|Suffix policy/);
assert.equal(variants.minimal.input, variants.current.input);
const changed = structuredClone(variants); changed.minimal.reasoning.effort = "medium";
assert.throws(() => assertWriterControls(changed));
assert.throws(() => writerComparisonRequests({ currentRequest: request, question: "Different?", sourceBlock }));
assert.throws(() => writerComparisonRequests({ currentRequest: { ...request, instructions: researchPracticalNextStepInstruction }, question: "Example?", sourceBlock }), /guidance-only/);
assert.throws(() => writerComparisonRequests({ currentRequest: { ...request, text: { format: { schema: { properties: { citations: { maxItems: 0 } } } } } }, question: "Example?", sourceBlock }), /guidance-only/);
console.log("Three-arm writer controls passed; provider calls: 0.");
