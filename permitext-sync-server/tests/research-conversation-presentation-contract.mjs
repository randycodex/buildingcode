import assert from "node:assert/strict";
import { researchAnswerPresentationContract, researchContextualSectionFollowupInstruction, researchGuidedNextStepInstruction } from "../research-answer-presentation.mjs";
import { researchZoningVerificationInstructions, researchZoningWriterInstructions } from "../research-zoning-verification-instructions.mjs";
import { researchClaimScopeInstruction, researchZoningExplanationScopeInstruction } from "../research-claim-scope.mjs";

const messages = [
  { role: "user", question: "Can you explain the transparency requirements for this project?" },
  { role: "assistant", answer: { answerText: "The applicable frontage rules depend on the proposed work and street frontage." } }
];
const question = "It’s a new building with ground-floor retail and community facility space";
const zoningPlan = { questionSignals: { streetscapeExplanation: true } };
const initial = researchAnswerPresentationContract({
  question: "can you explain the transparency requirements for this project?",
  evidence: Array.from({ length: 10 }, (_, index) => ({ sectionID: `source-${index}` })),
  zoningPlan
});
assert.equal(initial.mode, "requirements-checklist", "An explanation request must not inherit the yes/no two-paragraph format.");
assert.match(initial.preferredStructure, /compact rule bullets/);
assert.match(initial.requiredElements.join(" "), /three to five compact bullets/);
const continued = researchAnswerPresentationContract({ question, messages, zoningPlan });
assert.equal(continued.mode, "conversation-update");
assert(continued.universalRules.includes(researchZoningExplanationScopeInstruction));
assert(!continued.universalRules.includes(researchClaimScopeInstruction), "Do not give zoning overviews contradictory completeness instructions.");
assert(continued.universalRules.includes(researchGuidedNextStepInstruction));
assert.match(continued.requiredElements.join(" "), /Preserve the conditions and citations of every new legal claim/);

assert.equal(researchAnswerPresentationContract({ question, zoningPlan }).mode, "direct-answer", "A standalone fact does not invent a previous conversation.");
assert.equal(researchAnswerPresentationContract({ question, messages: [{ role: "user", question }], zoningPlan }).mode, "direct-answer");
assert.equal(researchAnswerPresentationContract({ question: "It's a new building. Can its ground floor omit glazing?", messages, zoningPlan }).mode, "direct-answer", "An explicit new question keeps its requested decision.");
assert.equal(researchAnswerPresentationContract({ question: "It's a new building. Explain the complete requirements.", messages, zoningPlan }).mode, "requirements-checklist", "A full requirements request takes precedence over the compact factual-reply presentation.");
assert.equal(researchAnswerPresentationContract({ question: "What is the governing ZR number?", messages, zoningPlan }).mode, "governing-reference");
assert.equal(researchAnswerPresentationContract({ question: "Compare the applicable provisions.", messages, zoningPlan }).mode, "comparison-table");
assert.equal(researchAnswerPresentationContract({ question: "Briefly explain the governing ZR number.", messages, zoningPlan }).mode, "compact-paragraph");
assert.equal(researchAnswerPresentationContract({ question: "Was this from the 1968 code?", messages, zoningPlan }).mode, "edition-check");
for (const sectionQuestion of ["then explain the 141-32", "Explain ZR § 141-32.", "What about section 32-34?", "Explain BC 1006.3.2."]) {
  const sectionContract = researchAnswerPresentationContract({ question: sectionQuestion, messages, zoningPlan });
  assert.equal(sectionContract.mode, "section-followup", sectionQuestion);
  assert.match(sectionContract.requiredElements.join(" "), /never infer historical text, a renumbering/);
}
for (const fullQuestion of ["Explain all requirements of ZR 141-32.", "Then explain the whole section 141-32 in full.", "Explain every paragraph of ZR 141-32.", "Explain ZR 141-32 in detail."]) {
  assert.equal(researchContextualSectionFollowupInstruction({ question: fullQuestion, messages }), "", "An explicit request for broader explanation must not be narrowed.");
}
assert.equal(researchContextualSectionFollowupInstruction({ question: "Explain ZR 141-32." }), "", "Do not invent conversational scope for a standalone section request.");
const sectionOptions = { messages, zoningPlan };
const sectionReview = researchZoningVerificationInstructions({ question: "then explain the 141-32", options: sectionOptions });
assert.match(sectionReview, /CONTEXTUAL SECTION FOLLOW-UP/);
assert.match(researchZoningWriterInstructions({ question: "then explain the 141-32", options: sectionOptions }), /section-followup/);
const ordinaryCode = researchAnswerPresentationContract({ question: "Can this stair serve the building?", messages });
assert(ordinaryCode.universalRules.includes(researchClaimScopeInstruction), "Non-zoning legal scope remains unchanged.");
console.log("Research continuation presentation keeps supplied facts, narrow follow-ups and claim scope aligned; no provider calls.");
