import assert from "node:assert/strict";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { researchInheritedAuthorityReferences } from "../research-conversation-continuity.mjs";
import { researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";

const root = "For a permanent open accessory parking facility in a NYC C4-2 commercial district, can we leave the surface as dusty bare soil?";
const failure = { role: "assistant", answer: {
  answerText: "Research could not finish checking the draft against the retrieved code text.",
  verification: { pass: false }, citations: []
} };
const history = [{ role: "user", question: root }, failure];
const snapshot = structuredClone(history);
const second = "Would permeable paving be allowed, or must the surface be conventional asphalt?";
const secondDecision = decideResearchConversationTopic({
  question: second, previousMessages: history, rootTopic: root, currentTopic: root
});
assert.equal(secondDecision.decision, "continuation");
assert.equal(secondDecision.signals.definiteSubjectContinuation, true);
assert(secondDecision.signals.rootTokenOverlap < 0.2,
  "Exercise definite subject reference rather than the existing overlap threshold.");
assert.equal(secondDecision.nextRootTopic.text, root);
assert.deepEqual(researchInheritedAuthorityReferences({
  question: second, previousMessages: history, topicDecision: secondDecision
}), [], "Retaining the user's topic must not promote an unverified answer into authority.");
const query = researchEvidenceRetrievalQuery({
  question: second, previousMessages: history,
  topicContext: { rootTopic: root, currentTopic: root }
});
assert.match(query.retrievalQuery, /C4-2/);
assert.match(query.retrievalQuery, /accessory parking/);
assert.equal(query.contextDependentFollowUp, true);

const third = "If the paving is dustless but the site is graded so water collects without adequate drainage, is the surfacing rule satisfied?";
const thirdDecision = decideResearchConversationTopic({
  question: third, previousMessages: [...history, { role: "user", question: second }, failure],
  rootTopic: secondDecision.nextRootTopic.text, currentTopic: secondDecision.nextCurrentTopic.text
});
assert.equal(thirdDecision.decision, "continuation");
assert.equal(thirdDecision.signals.definiteSubjectContinuation, true);
assert.equal(thirdDecision.nextRootTopic.text, root);

const doorRoot = "For a required exit door in a new NYC office building under BC 1010.1.1.1, does a 31-inch clear opening satisfy the ordinary minimum?";
const decideDoor = question => decideResearchConversationTopic({
  question, previousMessages: [{ role: "user", question: doorRoot }, failure],
  rootTopic: doorRoot, currentTopic: doorRoot
});
const clearOpening = decideDoor("Can the opening be narrowed using separate hinged leaves?");
assert.equal(clearOpening.decision, "continuation");
assert.equal(clearOpening.signals.definiteSubjectContinuation, true);

for (const question of [
  "New topic: would permeable paving be allowed, or must the surface be conventional asphalt?",
  "Different question: would permeable paving be allowed, or must the surface be conventional asphalt?"
]) {
  assert.equal(decideResearchConversationTopic({ question, previousMessages: history,
    rootTopic: root, currentTopic: root }).decision, "topic_switch");
}
assert.equal(decideDoor("Under FGC 404.3, can the opening be used to route fuel-gas piping?").decision,
  "topic_switch", "Disjoint current code references retain precedence over anaphora.");

for (const question of [
  "Does the office stair require additional dedicated smoke protection around landings?",
  "Does the building require seismic special inspection for concrete frames?",
  "For a different school, would the opening require additional smoke protection around landings?"
]) {
  const decision = decideDoor(question);
  assert.equal(decision.signals.definiteSubjectContinuation, false, question);
  assert.equal(decision.decision, "topic_switch", question);
}

const boilerTopic = "Can a gas boiler use an outdoor air intake for combustion?";
const afterSwitch = decideResearchConversationTopic({
  question: second,
  previousMessages: [...history, { role: "user", question: `New topic: ${boilerTopic}` }, failure],
  rootTopic: boilerTopic, currentTopic: boilerTopic
});
assert.equal(afterSwitch.signals.definiteSubjectContinuation, false,
  "The subject match uses active topics rather than any old conversation noun.");
assert.equal(afterSwitch.decision, "topic_switch");
assert.deepEqual(history, snapshot);

console.log("Definite-subject continuity passed: implicit nouns retain user context after blocked answers; explicit switches, fresh settings and different noun heads remain separate.");
