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

// Uncertainty is a reply to the active question, not a new search topic.
for (const question of ["I'm not sure. What should I check first?", "I don’t know.", "What should I check next?"]) {
  const decision = decideResearchConversationTopic({ question, previousMessages: [{role: "user", question: "Does my building need sprinklers?"}] });
  assert.equal(decision.decision, researchConversationTopicDecisions.continuation);
  assert.equal(decision.contextPolicy.includeRootTopic, true);
  assert.match(decision.nextRootTopic.text, /sprinklers/);
}
assert.equal(decideResearchConversationTopic({ question: "Separate question: I don't know the required exit width.", previousMessages: history }).decision, researchConversationTopicDecisions.topicSwitch);

const { researchEvidenceRetrievalQuery } = await import("../research-evidence-assembly.mjs");
const uncertaintyQuery = researchEvidenceRetrievalQuery({ question: "I'm not sure. What should I check first?", topicContext: { rootTopic: "Does my building need sprinklers?", currentTopic: "Does my building need sprinklers?" } });
assert.match(uncertaintyQuery.retrievalQuery, /sprinklers/);
assert.equal(uncertaintyQuery.previousTopicApplied, true);

// A production follow-up restates a failure condition without naming the
// equipment again. Read the actual canonical narrow provisions offline; prior
// citations nominate fresh retrieval only and never carry an answer forward.
globalThis.fetch = () => { throw new Error("Provider/network calls forbidden in causal-topic contract."); };
const { createResearchCorpusRegistry, routeResearchCorpora } = await import("../research-corpus-registry.mjs");
const { researchCorpusResources, researchBodyForCatalogSection } = await import("../app.mjs");
const { semanticResearchProjectFacts } = await import("../research-retrieval-query-context.mjs");
const causalRegistry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const causalCorpus = causalRegistry.find(corpus => corpus.id === "nyc-2022-construction-codes");
const causalResources = await researchCorpusResources({ selected: [causalCorpus] });
const causalCitations = [];
for (const [codePrefix, sectionNumber] of [["PC", "314.2.1"], ["MC", "307.2.1"], ["PC", "314.2.3"], ["MC", "307.2.3"]]) {
  const section = causalResources.catalog.find(entry => entry.codePrefix === codePrefix && entry.sectionNumber === sectionNumber);
  assert(section, "The prior citation must exist in the canonical corpus.");
  const body = await researchBodyForCatalogSection(section);
  causalCitations.push({ ...section, sectionID: section.id,
    supportingPassages: [{ selectedText: body.blocks.map(block => block.plainText || "").filter(Boolean).join("\n") }] });
}
const causalRoot = "Is the primary condensate drain steep enough for the saved cooling-unit example, or does its fall need to change?";
const causalQuestion = "Since a blocked drain could damage the ceiling and there is no floor drain, what overflow protection can we use? Do we have to add a separate overflow pipe?";
const causalHistory = [{ role: "user", question: causalRoot }, { role: "assistant", answer: {
  mode: "openai", verification: { pass: true }, supportedPoints: [{ sourceIDs: ["canonical-regression-source"] }], citations: causalCitations
} }];
const causalSnapshot = structuredClone(causalHistory);
const causalDecision = decideResearchConversationTopic({ question: causalQuestion, previousMessages: causalHistory });
assert.equal(causalDecision.decision, researchConversationTopicDecisions.continuation);
assert.equal(causalDecision.signals.causalSubjectContinuation, true);
assert.equal(causalDecision.signals.citedSubjectContinuation, false,
  "The whole-question 40% threshold remains unchanged; this is a separate bounded causal signal.");
assert(causalDecision.signals.rootTokenOverlap < 0.2);
const causalProjectFacts = ["Additional Project facts (user wording; not independently verified): " +
  "Public project background is unrelated to this equipment example. ".repeat(14) +
  "FICTIONAL RESEARCH TEST SCENARIO — supplied only for research, not actual project conditions: assume a proposed cooling coil. " +
  "A condensate-producing cooling coil has an 8-foot primary drain run with a half-inch fall; blockage could damage the ceiling below, and there is no suitably sized and located floor drain."];
const causalQuery = researchEvidenceRetrievalQuery({ question: causalQuestion, previousMessages: causalHistory, projectFacts: causalProjectFacts });
assert.equal(causalQuery.previousTopicApplied, true);
assert.match(causalQuery.sourceQuery, /primary condensate drain/);
assert.match(causalQuery.semanticQuery, /Condensate disposal/);
assert.match(causalQuery.semanticQuery, /8-foot primary drain run with a half-inch fall/);
assert.match(causalQuery.semanticQuery, /FICTIONAL RESEARCH TEST SCENARIO/);
assert.match(causalQuery.semanticQuery, /not actual project conditions/);
assert(causalQuery.inheritedAuthorityReferences.some(reference => reference.codePrefix === "PC" && reference.sectionNumber === "314.2.3"));
const causalRoute = routeResearchCorpora({ question: causalQuestion, previousMessages: causalHistory,
  projectFacts: causalProjectFacts, registry: causalRegistry });
assert(causalRoute.selected.some(corpus => corpus.id === causalCorpus.id && /verified citation/.test(corpus.routeReason)),
  "A continuing question preserves the checked source's code book while resolving text anew.");
for (const question of [
  "New topic: how do roof drains and emergency overflow scuppers work?",
  "Separate question: how deep must an outdoor gas pipe be buried?",
  "Since a blocked drain could damage the ceiling, under the 2014 NYC Mechanical Code what overflow protection can we use?",
  "Since a blocked drain could damage the ceiling, under the Fuel Gas Code what overflow protection can we use?"
]) {
  const decision = decideResearchConversationTopic({ question, previousMessages: causalHistory });
  assert.equal(decision.signals.causalSubjectContinuation, false, question);
  assert.equal(decision.decision, researchConversationTopicDecisions.topicSwitch, question);
  const query = researchEvidenceRetrievalQuery({ question, previousMessages: causalHistory, projectFacts: causalProjectFacts });
  assert.deepEqual(query.inheritedAuthorityReferences, [], question);
  assert.doesNotMatch(query.semanticQuery, /8-foot primary drain|Condensate disposal/, question);
}
for (const question of [
  "Since a roof drain could damage the ceiling, what overflow protection can we use?",
  "Since a water tank could damage the ceiling, what overflow protection can we use?",
  "What overflow protection can we use?",
  "Since the building could be damaged, what overflow protection can we use?"
]) assert.equal(decideResearchConversationTopic({ question, previousMessages: causalHistory }).signals.causalSubjectContinuation, false,
  "The causal rule cannot bridge generic property nouns or newly named equipment modifiers.");
for (const mutate of [
  answer => { answer.verification.pass = false; },
  answer => { answer.supportedPoints = []; },
  answer => { answer.mode = "evidence_boundary"; },
  answer => { answer.citations = []; },
  answer => { for (const citation of answer.citations) citation.evidenceRole = "contextual"; },
  answer => { for (const citation of answer.citations) citation.sectionID = null; },
  answer => { for (const citation of answer.citations) delete citation.corpusID; },
  answer => { for (const citation of answer.citations) citation.codePrefix = "FAKE"; },
  answer => { for (const citation of answer.citations) citation.sectionNumber = "forged section"; },
  answer => { for (const citation of answer.citations) { citation.title = "Unrelated surface requirements";
    citation.supportingPassages = [{ selectedText: "This purported citation contains no equipment detail or failure-protection requirement." }]; } }
]) {
  const altered = structuredClone(causalHistory);
  mutate(altered.at(-1).answer);
  assert.equal(decideResearchConversationTopic({ question: causalQuestion, previousMessages: altered }).signals.causalSubjectContinuation, false,
    "Missing, unverified, contextual, malformed or unrelated purported citations cannot enable the new signal.");
}
assert.equal(decideResearchConversationTopic({ question: causalQuestion, previousMessages: [{ role: "user", question: causalRoot }] }).signals.causalSubjectContinuation, false);
assert.equal(decideResearchConversationTopic({ question: "Because a blocked drain could damage the ceiling, what overflow protection can we use?", previousMessages: causalHistory }).signals.causalSubjectContinuation, true);
assert.deepEqual(causalHistory, causalSnapshot, "Subject inheritance does not mutate or promote prior answer content.");
// A pure topic planner trusts server-persisted verification metadata as a hint.
// It cannot authenticate a fully fabricated canonical-looking answer packet.
// The normal resolver must still fetch the real section, and verification must
// establish every new answer independently of these topic decisions.
console.log("Bounded causal-topic continuation passed: ordinary blocked-drain follow-up, canonical source/title hints, saved-example scope, explicit topic/family/edition boundaries, missing or malformed sources, and immutable history; no provider calls.");
