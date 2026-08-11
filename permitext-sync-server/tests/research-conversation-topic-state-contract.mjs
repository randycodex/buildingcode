import assert from "node:assert/strict";
import { researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";

function nextContext(query, originalTopic = "") {
  return {
    version: query.topicDecision.version,
    originalTopic: originalTopic || query.topicDecision.rootTopic.text || query.question,
    rootTopic: query.topicDecision.nextRootTopic.text,
    currentTopic: query.topicDecision.nextCurrentTopic.text,
    lastDecision: query.topicDecision.decision
  };
}

const smokeQuestion = "Does a smoke barrier require a 1-hour rating under BC 709.3?";
const first = researchEvidenceRetrievalQuery({ question: smokeQuestion });
assert.equal(first.topicDecision.decision, "topic_switch");
assert.equal(first.previousTopicApplied, false);
const firstContext = nextContext(first);

const officeQuestion = "New topic: how should an architectural office be classified under BC 304.1?";
const switched = researchEvidenceRetrievalQuery({
  question: officeQuestion,
  topicContext: firstContext,
  previousMessages: [{ role: "user", question: smokeQuestion }]
});
assert.equal(switched.topicDecision.decision, "topic_switch");
assert.equal(switched.previousTopicApplied, false);
assert.doesNotMatch(switched.retrievalQuery, /709\.3|smoke barrier/i);
assert.equal(switched.conversationTopic, officeQuestion);
const switchedContext = nextContext(switched, firstContext.originalTopic);

const officeFollowUp = researchEvidenceRetrievalQuery({
  question: "Why does the employee count not change that classification?",
  topicContext: switchedContext,
  previousMessages: [
    { role: "user", question: smokeQuestion },
    { role: "user", question: officeQuestion }
  ]
});
assert.equal(officeFollowUp.topicDecision.decision, "continuation");
assert.equal(officeFollowUp.previousTopicApplied, true);
assert.match(officeFollowUp.retrievalQuery, /Previous topic:.*architectural office/is);
assert.doesNotMatch(officeFollowUp.retrievalQuery, /709\.3|smoke barrier/i);

const returned = researchEvidenceRetrievalQuery({
  question: "Go back to the original question: what establishes the rating?",
  topicContext: switchedContext,
  previousMessages: [
    { role: "user", question: smokeQuestion },
    { role: "user", question: officeQuestion }
  ]
});
assert.equal(returned.topicDecision.decision, "continuation");
assert.equal(returned.topicDecision.signals.returnToOriginal, true);
assert.match(returned.retrievalQuery, /Previous topic:.*smoke barrier.*709\.3/is);
assert.doesNotMatch(returned.retrievalQuery, /architectural office|304\.1/i);

console.log("Permitext Research conversation-topic state contract passed.");
