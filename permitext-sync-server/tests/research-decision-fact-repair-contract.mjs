import assert from "node:assert/strict";
import { researchDecisionFactRepair } from "../research-decision-fact-repair.mjs";
import { applyResearchProjectFactCoverage } from "../research-project-fact-coverage.mjs";
import { openAIResearchVerification } from "../app.mjs";
import { beginResearchSpendReservation, endResearchSpendReservation } from "../research-config.mjs";
import { researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";

const answer = { answerText: "Unchanged decision, qualifications and citations.", missingFacts: ["Optional detail A", "Material applicability fact", "Optional detail B"],
  supportedPoints: [{ explanation: "Unchanged rule", sourceIDs: ["source-1"] }], citations: [{ sourceIDs: ["source-1"] }], followUpQuestions: ["Material follow-up"] };
const original = structuredClone(answer);
const verification = { pass: false, issues: [{ type: "unnecessary_qualification", detail: "Only optional details A and B are unnecessary." }], unnecessaryMissingFactIndices: [2, 0] };
const repaired = researchDecisionFactRepair(answer, verification);
assert.equal(repaired.applied, true);
assert.deepEqual(repaired.removedMissingFactIndices, [0, 2]);
assert.deepEqual(repaired.answer, { ...answer, missingFacts: ["Material applicability fact"] });
assert.deepEqual(answer, original, "A candidate repair must not mutate the original record.");
const declared = ["Owner claim: prior-code-building status"];
const protectedAnswer = applyResearchProjectFactCoverage({ ...answer, missingFacts: [] }, declared);
const misguidedEdit = researchDecisionFactRepair(protectedAnswer, { ...verification, unnecessaryMissingFactIndices: [0] });
assert.deepEqual(applyResearchProjectFactCoverage(misguidedEdit.answer, declared), protectedAnswer,
  "Reapplying declared-fact coverage restores a representation even if a verifier incorrectly proposes removing it.");
for (const changed of [
  { ...verification, pass: true }, { ...verification, issues: [] },
  { ...verification, issues: [...verification.issues, { type: "incorrect_citation", detail: "Another substantive defect." }] },
  ...[undefined, null, [], [0, 0], [-1], [3], ["0"], [0.5]].map((indices) => ({ ...verification, unnecessaryMissingFactIndices: indices }))
]) {
  const result = researchDecisionFactRepair(answer, changed);
  assert.equal(result.applied, false);
  assert.equal(result.answer, answer);
}

// Exercise the actual production response parser with synthetic provider replies.
Object.assign(process.env, researchRequestEnvelopeEnvironment, { OPENAI_API_KEY: "offline-verifier-double" });
delete process.env.PERMITEXT_RESEARCH_EVAL_MAX_USD;
let reply;
let calls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  calls++;
  const body = JSON.parse(options.body);
  assert(body.text.format.schema.required.includes("unnecessaryMissingFactIndices"));
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 20, output_tokens: 20 },
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(reply) }] }] });
};
for (const [value, valid] of [
  [verification, true], [{ pass: true, issues: [] }, true], [{ pass: true, issues: [], unnecessaryMissingFactIndices: [] }, true],
  ...[null, [3], [-1], ["0"], [0, 0]].map((indices) => [{ ...verification, unnecessaryMissingFactIndices: indices }, false]),
  [{ ...verification, pass: true, issues: [] }, false]
]) {
  reply = value;
  beginResearchSpendReservation({ id: `synthetic-parser-${calls}` });
  try {
    const request = openAIResearchVerification("Synthetic question.", [], answer, "synthetic-user", { model: "gpt-5.6-luna" });
    if (valid) assert.equal((await request).result.pass, value.pass);
    else await assert.rejects(request, { code: "INVALID_RESEARCH_VERIFICATION" });
  } finally {
    assert.equal(endResearchSpendReservation().pendingProviderReservationCount, 0);
  }
}
console.log("Decision-fact candidate repair and production parser contracts passed; provider responses were synthetic.");
