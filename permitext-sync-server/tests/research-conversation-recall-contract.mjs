import assert from "node:assert/strict";
import { researchQuestionIsConversationRecall } from "../research-question-intent.mjs";
import { researchInterpretationSchemaForEvidence, validateResearchInterpretation } from "../app.mjs";
import { immutableResearchAnswer } from "../project-foundation-contract.mjs";

const question = "What travel distance are we currently assuming in the hypothetical, and did I confirm it as a change to the actual project?";
assert(researchQuestionIsConversationRecall(question));
for (const substantive of [
  "What travel distance are we currently assuming, and does it comply with the code?",
  "What is the maximum allowed travel distance?",
  "What did I provide, and which code section requires it?"
]) assert(!researchQuestionIsConversationRecall(substantive), substantive);
const value = { answerText: "The hypothetical uses 80 feet. The actual project remains at the 60 feet you gave earlier.",
  supportedPoints: [], citations: [], assumptions: [], missingFacts: [], followUpQuestions: [],
  evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
assert.throws(() => validateResearchInterpretation(value, []), /invalid interpretation/i,
  "Ordinary code interpretations still require enacted bindings");
const parsed = validateResearchInterpretation(value, [], [], { conversationRecall: true });
assert.equal(researchInterpretationSchemaForEvidence([], [], { conversationRecall: true }).properties.citations.maxItems, 0);
const answer = { ...parsed, mode: "openai", conversationRecall: true,
  verification: { status: "passed", pass: true, scope: "conversation_recall", history: [{ pass: true }] } };
const record = { owner: { kind: "user", id: "offline-test" }, conversationID: "conversation", question,
  answer, evidence: [], citations: [], model: "offline-double", researchSystemVersion: "test" };
assert(immutableResearchAnswer(record));
assert.throws(() => immutableResearchAnswer({ ...record, question: "Does the building comply?" }), /evidence|citations/);
assert.throws(() => immutableResearchAnswer({ ...record, answer: { ...answer,
  verification: { ...answer.verification, history: [{ pass: false }] } } }), /evidence|citations/,
"A recalled fact cannot bypass a failed semantic review");
console.log("Conversation recall: nonlegal scope only, no manufactured code citations, independent review required for persistence.");
