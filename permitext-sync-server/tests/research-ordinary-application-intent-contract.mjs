import assert from "node:assert/strict";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { researchEvidencePriorityMetadata } from "../research-evidence-priority.mjs";
for (const question of [
  "An outdoor unit sits on a concrete pad. The manufacturer permits this support. Is the pad height enough under the mechanical rules?",
  "Does the stair width requirement apply to this building?",
  "Can this hanger support a gas pipe while allowing expansion?",
  "Is that fire partition required for our storage room?"
]) {
  const decision = decideResearchConversationTopic({ question, previousMessages: [] });
  assert.equal(decision.signals.relevanceComparison, false, question);
  const source = researchEvidencePriorityMetadata({ codePrefix: "MC", sectionNumber: "304.10", title: "Clearances from grade",
    text: "Equipment installed at grade shall be supported on a level concrete slab extending at least 3 inches above grade.",
    signals: { relevanceComparison: decision.signals.relevanceComparison } });
  assert.notEqual(source.evidenceRole, "irrelevant", "Physical support/applicability wording cannot prohibit using genuinely relevant enacted evidence.");
}
const history = [{ role: "user", question: "What governs stair width?" }];
for (const question of ["Is this text related?", "Does BC 101.1 support the previous stair-width answer?", "How is BC 101.1 relevant to my question?"]) {
  assert.equal(decideResearchConversationTopic({ question, previousMessages: history }).signals.relevanceComparison, true, question);
}
console.log("Ordinary application intent passed: physical support and project applicability stay substantive; actual source-relevance comparisons retain their boundary.");
