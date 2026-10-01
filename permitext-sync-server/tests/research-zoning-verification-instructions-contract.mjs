import assert from "node:assert/strict";
import { researchZoningVerificationInstructions, researchZoningWriterInstructions } from "../research-zoning-verification-instructions.mjs";
import { researchZoningExplanationScopeInstruction } from "../research-claim-scope.mjs";
import { researchGuidedNextStepInstruction } from "../research-answer-presentation.mjs";
import { zoningMappedReviewInstruction } from "../research-zoning-mapped-review.mjs";

const question = "can you explain the transparency requirements for this project?";
const evidence = [{ codePrefix: "ZR", sectionNumber: "example", text: "Supplied evidence fixture" }];
const options = { zoningPlan: { questionSignals: { streetscapeExplanation: true } } };
for (const builder of [researchZoningVerificationInstructions, researchZoningWriterInstructions]) {
  assert.equal(builder({ question, evidence }), null);
  assert.equal(builder({ question, evidence, options: { zoningPlan: { questionSignals: {} } } }), null, "Other zoning flows retain their existing instructions.");
}
const review = researchZoningVerificationInstructions({ question, evidence, options });
assert(review.includes(researchZoningExplanationScopeInstruction));
assert(review.includes(researchGuidedNextStepInstruction));
for (const boundary of ["point's exact supplied sourceIDs", "Historical or future-effective", "Unknowns remain unknown", "tax-lot records", "DETERMINISTIC REQUIRED CLAIM CHECKLIST", "PRIOR REVIEW HISTORY", "priorReviewCorrection", "projectFactQuestions=[] on a failed answer", "missingFactsOnly=true only", "zero-based indices", "fresh verification"]) assert(review.includes(boundary), boundary);
assert(review.includes("not required prose"));
for (const boundary of [
  "actual claim and express premises",
  "how that omission changes or makes that claim misleading",
  "inventory record of an existing building alone does not meet this test",
  "Unknown proposed work does not establish an alteration",
  "A statement that another branch remains unevaluated is a scope boundary",
  "Reject a false exhaustive list",
  "including its material dimensions, datum and qualifications"
]) assert(review.includes(boundary), boundary);
assert(!review.includes(zoningMappedReviewInstruction));
const mapped = researchZoningVerificationInstructions({ question, evidence, options: { ...options, mappedScopeReview: { units: [] } } });
assert(mapped.includes(zoningMappedReviewInstruction), "Mapped review cannot be dropped by prompt specialization.");
const writer = researchZoningWriterInstructions({ question, evidence, options });
assert(writer.includes('"mode":"requirements-checklist"'));
assert(writer.includes("a useful baseline under an explicit work/applicability condition"));
assert(writer.includes("Preserve numerical limits"));
assert(writer.includes("exact supplied sourceIDs"));
assert(writer.includes("state the baseline's work condition explicitly instead of calling it likely"));
assert(writer.includes("put the promised usable baseline in answerText itself"));
assert(writer.includes("Attach each exception only to the specific condition it modifies"));
const followup = researchZoningWriterInstructions({ question: "It’s a new building with ground-floor retail and community facility space", evidence, options: { ...options, messages: [{ role: "assistant", answer: { answerText: "Prior conditional overview" } }] } });
assert(followup.includes('"mode":"conversation-update"'));
assert(review.length < 14_000 && writer.length < 14_000, "Keep scoped prompts bounded without copying unrelated Building Code rubrics.");
console.log(JSON.stringify({ contract: "streetscape-scoped-instructions", reviewCharacters: review.length, writerCharacters: writer.length, providerCalls: 0, limitation: "Prompt boundaries only; real answer quality requires provider replay." }));
