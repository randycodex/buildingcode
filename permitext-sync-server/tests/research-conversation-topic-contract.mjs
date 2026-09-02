import assert from "node:assert/strict";
import {
  decideResearchConversationTopic,
  extractResearchCodeReferences,
  researchConversationTopicDecisions,
  researchConversationTopicVersion
} from "../research-conversation-topic.mjs";

const history = [{
  role: "user",
  question: "Under BC §1107.6, which accessible-unit categories apply to this residential project?"
}, {
  role: "assistant",
  content: "The occupancy group controls the applicable branch."
}, {
  role: "user",
  question: "Does BC 1107.7 change the required quantities?"
}];
const historySnapshot = structuredClone(history);

const continuation = decideResearchConversationTopic({
  question: "Explain that in more detail.",
  previousMessages: history
});
assert.equal(continuation.version, researchConversationTopicVersion);
assert.equal(continuation.decision, researchConversationTopicDecisions.continuation);
assert.equal(continuation.rootTopic.source, "conversation_root");
assert.equal(continuation.currentTopic.source, "conversation_current");
assert.equal(continuation.rootTopic.codeReferences[0].reference, "BC § 1107.6");
assert.equal(continuation.currentTopic.codeReferences[0].reference, "BC § 1107.7");
assert.equal(continuation.contextPolicy.includeRootTopic, true);
assert.equal(continuation.contextPolicy.includeCurrentTopic, true);
assert.equal(continuation.contextPolicy.replaceRootTopic, false);
assert.equal(continuation.nextRootTopic.text, continuation.rootTopic.text);
assert.equal(continuation.nextCurrentTopic.text, continuation.question.text);

const formatFollowUp = decideResearchConversationTopic({
  question: "give me just a short paragraph to explain quickly",
  previousMessages: [{
    role: "user",
    question: "zoning area c4-4d, how similar it is to r8a?"
  }]
});
assert.equal(formatFollowUp.decision, researchConversationTopicDecisions.continuation);
assert.equal(formatFollowUp.signals.formatTransformation, true);
assert.equal(formatFollowUp.contextPolicy.includeRootTopic, true);

const correction = decideResearchConversationTopic({
  question: "Correction: I meant Group R-2, not R-1. Apply BC 1107.6.2.",
  previousMessages: history
});
assert.equal(correction.decision, researchConversationTopicDecisions.correction);
assert.equal(correction.signals.correction, true);
assert.equal(correction.question.codeReferences[0].reference, "BC § 1107.6.2");
assert.equal(correction.nextRootTopic.text, correction.rootTopic.text);
assert.equal(correction.nextCurrentTopic.text, correction.question.text);
assert.equal(correction.contextPolicy.includeRootTopic, true);

const relevance = decideResearchConversationTopic({
  question: "How is BC 1107.7 relevant to the original question under BC 1107.6?",
  previousMessages: history
});
assert.equal(relevance.decision, researchConversationTopicDecisions.relevanceComparison);
assert.equal(relevance.signals.relevanceComparison, true);
assert.deepEqual(
  relevance.question.codeReferences.map((reference) => reference.reference),
  ["BC § 1107.7", "BC § 1107.6"]
);
assert.equal(relevance.nextRootTopic.text, relevance.rootTopic.text);
assert.equal(
  relevance.nextCurrentTopic.text,
  relevance.currentTopic.text,
  "A relevance comparison should not replace the substantive current topic with the comparison wording."
);

const explicitSwitch = decideResearchConversationTopic({
  question: "New topic: under PC 403.1, how many plumbing fixtures are required for an office?",
  previousMessages: history
});
assert.equal(explicitSwitch.decision, researchConversationTopicDecisions.topicSwitch);
assert.equal(explicitSwitch.signals.explicitSwitch, true);
assert.equal(explicitSwitch.question.codeReferences[0].reference, "PC § 403.1");
assert.equal(explicitSwitch.contextPolicy.includeRootTopic, false);
assert.equal(explicitSwitch.contextPolicy.includeCurrentTopic, false);
assert.equal(explicitSwitch.contextPolicy.replaceRootTopic, true);
assert.equal(explicitSwitch.nextRootTopic.text, explicitSwitch.question.text);

const citedSwitch = decideResearchConversationTopic({
  question: "Under BC 504.4, how many stories are permitted?",
  previousMessages: history
});
assert.equal(citedSwitch.decision, researchConversationTopicDecisions.topicSwitch);
assert.equal(citedSwitch.signals.disjointExplicitReference, true);

const uncitedSwitch = decideResearchConversationTopic({
  question: "What occupant load factor applies to a small architectural office?",
  previousMessages: history
});
assert.equal(uncitedSwitch.decision, researchConversationTopicDecisions.topicSwitch);
assert.equal(uncitedSwitch.signals.selfContained, true);

const projectFactContinuation = decideResearchConversationTopic({
  question: "The work is an alteration on the third floor.",
  previousMessages: history
});
assert.equal(projectFactContinuation.decision, researchConversationTopicDecisions.continuation);
assert.equal(projectFactContinuation.signals.projectSubjectContinuation, true);

const explicitProjectSwitch = decideResearchConversationTopic({
  question: "New topic: the project is a one-story retail building.",
  previousMessages: history
});
assert.equal(explicitProjectSwitch.decision, researchConversationTopicDecisions.topicSwitch);
assert.equal(explicitProjectSwitch.signals.explicitSwitch, true);

const sameTopic = decideResearchConversationTopic({
  question: "Which accessible units are required in this residential project?",
  previousMessages: history
});
assert.equal(sameTopic.decision, researchConversationTopicDecisions.continuation);
assert(sameTopic.signals.rootTokenOverlap >= 0.2);

const explicitMetadata = decideResearchConversationTopic({
  question: "What about those exceptions?",
  previousMessages: history,
  rootTopic: "Explicit root under BC 504.3 and Table 504.4.",
  currentTopic: "Current exception in BC 504.4."
});
assert.equal(explicitMetadata.decision, researchConversationTopicDecisions.continuation);
assert.equal(explicitMetadata.rootTopic.source, "explicit_root");
assert.equal(explicitMetadata.currentTopic.source, "explicit_current");
assert.deepEqual(
  explicitMetadata.rootTopic.codeReferences.map((reference) => reference.reference),
  ["BC § 504.3", "BC Table 504.4"]
);

const returnToOriginal = decideResearchConversationTopic({
  question: "Go back to the original question and explain its exceptions.",
  previousMessages: history,
  rootTopic: history[0].question,
  currentTopic: "New topic: calculate plumbing fixtures under PC 403.1."
});
assert.equal(returnToOriginal.decision, researchConversationTopicDecisions.continuation);
assert.equal(returnToOriginal.signals.returnToOriginal, true);
assert.equal(returnToOriginal.contextPolicy.includeRootTopic, true);
assert.equal(returnToOriginal.contextPolicy.includeCurrentTopic, false);

assert.deepEqual(
  extractResearchCodeReferences("Compare BC §§ 1107.6, 1107.7 and § 1107.8 with PC Table 403.1."),
  [{
    codePrefix: "BC",
    sectionNumber: "1107.6",
    referenceKind: "section",
    reference: "BC § 1107.6"
  }, {
    codePrefix: "BC",
    sectionNumber: "1107.7",
    referenceKind: "section",
    reference: "BC § 1107.7"
  }, {
    codePrefix: "BC",
    sectionNumber: "1107.8",
    referenceKind: "section",
    reference: "BC § 1107.8"
  }, {
    codePrefix: "PC",
    sectionNumber: "403.1",
    referenceKind: "table",
    reference: "PC Table 403.1"
  }]
);
assert.deepEqual(
  extractResearchCodeReferences("SECTION BC 101: GENERAL 101.1 Title."),
  [{
    codePrefix: "BC",
    sectionNumber: "101.1",
    referenceKind: "section",
    reference: "BC § 101.1"
  }]
);
assert.deepEqual(
  extractResearchCodeReferences("Compare ZR § 25-23 with ZR Table 25-23 and Sections 25-24 through 25-26."),
  [{
    codePrefix: "ZR",
    sectionNumber: "25-23",
    referenceKind: "section",
    reference: "ZR § 25-23"
  }, {
    codePrefix: "ZR",
    sectionNumber: "25-23",
    referenceKind: "table",
    reference: "ZR Table 25-23"
  }, {
    codePrefix: "ZR",
    sectionNumber: "25-24",
    referenceKind: "section",
    reference: "ZR § 25-24"
  }, {
    codePrefix: "ZR",
    sectionNumber: "25-26",
    referenceKind: "section",
    reference: "ZR § 25-26"
  }]
);
assert.deepEqual(
  extractResearchCodeReferences("Apply ZR Sections 25-23, 25-24, and 25-25, then check ZR Section 36-21."),
  [{
    codePrefix: "ZR",
    sectionNumber: "25-23",
    referenceKind: "section",
    reference: "ZR § 25-23"
  }, {
    codePrefix: "ZR",
    sectionNumber: "25-24",
    referenceKind: "section",
    reference: "ZR § 25-24"
  }, {
    codePrefix: "ZR",
    sectionNumber: "25-25",
    referenceKind: "section",
    reference: "ZR § 25-25"
  }, {
    codePrefix: "ZR",
    sectionNumber: "36-21",
    referenceKind: "section",
    reference: "ZR § 36-21"
  }]
);
assert.deepEqual(history, historySnapshot, "Topic classification must not mutate conversation history.");
assert.throws(() => decideResearchConversationTopic({ question: "" }), /requires a question/);

console.log("Permitext deterministic Research conversation-topic contract passed.");
