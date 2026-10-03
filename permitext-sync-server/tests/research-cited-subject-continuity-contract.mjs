import assert from "node:assert/strict";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { researchInheritedAuthorityReferences, researchPriorAnswerSources } from "../research-conversation-continuity.mjs";
import { researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";

const atticRoot = "Under 2022 NYC MC, can an attic HVAC passage be 40 feet long if clear 6 feet high and 24 inches wide throughout? Address only this length exception.";
const atticLast = "Can I keep a 20-by 30-inch access opening if the largest appliance cannot fit through it?";
const atticCitation = {
  codePrefix: "MC", sectionNumber: "306.3", sectionID: "10348",
  corpusID: "nyc-2022-construction-codes", codeEdition: "2022 New York City Construction Codes",
  codeVersion: "fixture-current-mc", applicabilityStatus: "current-enacted-edition",
  title: "306.3 Appliances in attics.",
  supportingPassages: [{ selectedText: "Attics containing appliances shall be provided with an opening and unobstructed passageway large enough to allow removal of the largest appliance. A level service space not less than 30 inches (762 mm) deep and 30 inches (762 mm) wide shall be present at the front or service side of the appliance. The clear access opening dimensions shall be not less than 20 inches by 30 inches, and large enough to allow removal of the largest appliance." }]
};
const history = [
  { role: "user", question: atticRoot },
  { role: "assistant", answer: { verification: { pass: true }, citations: [atticCitation] } },
  { role: "user", question: atticLast },
  { role: "assistant", answer: { answerText: "No. The opening must permit removal of the largest appliance.", verification: { pass: true }, citations: [atticCitation] } }
];
const snapshot = structuredClone(history);
const question = "What ordinary level service-space size is needed at sides requiring access?";
const decide = (q, messages = history) => decideResearchConversationTopic({
  question: q, previousMessages: messages, rootTopic: atticRoot, currentTopic: atticLast
});
const decision = decide(question);
assert.equal(decision.decision, "continuation", "A different detail in the just-cited rule must retain the attic-appliance context.");
assert.equal(decision.signals.citedSubjectContinuation, true);
assert(decision.signals.rootTokenOverlap < 0.2 && decision.signals.currentTokenOverlap < 0.2,
  "This regression must exercise cited-passage subject continuity, not the existing user-question overlap.");
const inherited = researchInheritedAuthorityReferences({ question, previousMessages: history, topicDecision: decision });
assert.equal(inherited.length, 1);
assert.equal(inherited[0].reference, "MC § 306.3");
assert.equal(inherited[0].codeEdition, atticCitation.codeEdition);
assert.equal(inherited[0].codeVersion, atticCitation.codeVersion);
assert.equal(inherited[0].corpusID, atticCitation.corpusID);
assert(!("selectedText" in inherited[0]), "Passage context should not become answer authority or mandatory prompt content.");
const query = researchEvidenceRetrievalQuery({ question, previousMessages: history,
  topicContext: { rootTopic: atticRoot, currentTopic: atticLast } });
assert.equal(query.contextDependentFollowUp, true);
assert.match(query.retrievalQuery, /attic HVAC/);
assert.match(query.retrievalQuery, /MC § 306\.3/);
assert(query.semanticQuery.startsWith(question));
assert.match(query.semanticQuery, /Appliances in attics/);
assert.doesNotMatch(query.semanticQuery, /40 feet|6 feet|20-by|306\.3/,
  "Prior measurements and citations must not drown out the current detail in meaning search.");
const vagueQuery = researchEvidenceRetrievalQuery({ question: "Why is that?", previousMessages: history,
  topicContext: { rootTopic: atticRoot, currentTopic: atticLast } });
assert.match(vagueQuery.semanticQuery, /attic HVAC/,
  "A short pronoun-only follow-up still needs its user-supplied subject context.");
const excludedExampleQuestion = "For an ordinary straight stair, are 7.5-inch risers acceptable? This is not a dwelling, spiral stair, or assembly aisle.";
const excludedExample = researchEvidenceRetrievalQuery({ question: excludedExampleQuestion });
assert.doesNotMatch(excludedExample.semanticQuery, /spiral stair/,
  "An expressly excluded example is not the subject of meaning search.");
assert.equal(excludedExample.question, excludedExampleQuestion,
  "Scenario exclusions must still reach the writer and verifier unchanged.");
assert.match(researchEvidenceRetrievalQuery({ question: "Is this not required for an ordinary stair?" }).semanticQuery, /not required/,
  "Do not erase negation in the actual question.");

const fireHistory = [
  { role: "user", question: "Does placing noncombustible storage within 30 inches of a fire partition automatically allow storage to the ceiling?" },
  { role: "assistant", answer: { verification: { pass: true }, citations: [{
    codePrefix: "FC", sectionNumber: "315", sectionID: "31004696",
    corpusID: "nyc-2022-fire-code", codeEdition: "2022 NYC Fire Code — current consolidated text",
    codeVersion: "fixture-consolidated-fc", applicabilityStatus: "current-consolidation",
    title: "FC 315: Combustible Materials Storage and Other Storage Hazards",
    supportingPassages: [{ selectedText: "315.2.1 Ceiling clearance. Storage shall be maintained 2 feet or more below the ceiling in areas of buildings not protected by a sprinkler system. 315.2.2 Means of egress. Materials shall not be stored in a manner that obstructs egress from any building, structure or premises." }]
  }] } }
];
const fireQuestion = "May storage obstruct the means of egress if it meets the vertical clearance?";
const fireDecision = decideResearchConversationTopic({ question: fireQuestion, previousMessages: fireHistory });
const fireRefs = researchInheritedAuthorityReferences({ question: fireQuestion, previousMessages: fireHistory, topicDecision: fireDecision });
assert.equal(fireRefs[0]?.corpusID, "nyc-2022-fire-code", "A continuing subject must retain its actual cited code family when the latest user question omits that name.");

for (const q of [
  "New topic: what ordinary level service-space size is needed at sides requiring access?",
  "Separate question: what is the occupant load factor for an architectural office?",
  "Under PC 403.1, how many water closets does an office require?"
]) {
  const switched = decide(q);
  assert.equal(switched.decision, "topic_switch", q);
  assert.deepEqual(researchInheritedAuthorityReferences({ question: q, previousMessages: history, topicDecision: switched }), []);
  assert.doesNotMatch(researchEvidenceRetrievalQuery({ question: q, previousMessages: history,
    topicContext: { rootTopic: atticRoot, currentTopic: atticLast } }).retrievalQuery, /MC § 306\.3/);
}
const returnQuestion = "Back to the original question: why does that exception apply?";
const returned = decide(returnQuestion);
assert.equal(returned.signals.returnToOriginal, true);
assert.deepEqual(researchInheritedAuthorityReferences({ question: returnQuestion, previousMessages: fireHistory, topicDecision: returned }), [],
  "Return-to-original retrieval must use the original topic rather than importing the last different subject's citations.");

for (const answer of [
  { verification: { pass: false }, citations: [atticCitation] },
  { citations: [atticCitation] },
  { mode: "evidence_boundary", verification: { pass: true }, citations: [atticCitation] },
  { authorityStatus: "evidence_boundary", verification: { pass: true }, citations: [atticCitation] },
  { supportedPoints: [], verification: { pass: true }, citations: [atticCitation] },
  { verification: { pass: true }, citations: [{ ...atticCitation, evidenceRole: "contextual" }] },
  { mode: "clarification", verification: { pass: true }, citations: [atticCitation] }
]) {
  const unchecked = [...history.slice(0, -1), { role: "assistant", answer }];
  assert.equal(decide(question, unchecked).signals.citedSubjectContinuation, false);
  assert.deepEqual(researchPriorAnswerSources(unchecked), []);
}
const laterFailure = [...history, { role: "user", question: "A different question." },
  { role: "assistant", answer: { mode: "clarification", verification: { pass: false } } }];
assert.deepEqual(researchPriorAnswerSources(laterFailure), [], "Do not reach backward indefinitely past newer answers for a stale source.");

const irrelevantText = "Minimum size is 30 inches. Access is required. Level work is needed. Side conditions apply.";
const scattered = structuredClone(history);
scattered.at(-1).answer.citations[0].supportingPassages = [{ selectedText: irrelevantText }];
assert.equal(decide(question, scattered).signals.citedSubjectContinuation, false,
  "Shared measurement language and scattered individual terms must not override a topic switch.");

const historical = structuredClone(history);
historical.at(-1).answer.citations[0] = { ...atticCitation,
  codeEdition: "2014 NYC Mechanical Code", codeVersion: "fixture-historical-mc",
  corpusID: "nyc-2014-construction-codes", applicabilityStatus: "historical-edition" };
const historicalDecision = decide(question, historical);
const historicalRef = researchInheritedAuthorityReferences({ question, previousMessages: historical, topicDecision: historicalDecision })[0];
assert.equal(historicalRef.corpusID, "nyc-2014-construction-codes");
assert.equal(historicalRef.applicabilityStatus, "historical-edition", "The caller must retain edition boundaries when resolving an inherited citation.");

const oversized = structuredClone(history);
oversized.at(-1).answer.citations = Array.from({ length: 10 }, (_, i) => ({
  ...atticCitation, sectionNumber: `306.${i}`, supportingPassages: [{ selectedText: "text ".repeat(4_000) }]
}));
assert.equal(researchPriorAnswerSources(oversized).length, 3);
assert(researchPriorAnswerSources(oversized).every(source => source.selectedText.length <= 6_000));
assert.deepEqual(researchPriorAnswerSources(oversized, { maximumSources: 0 }), []);
assert.deepEqual(history, snapshot, "Continuity analysis must not change stored conversation records.");

console.log("Cited-subject continuity passed: implicit details retain checked sources, explicit switches and unchecked/stale answers do not, edition metadata and size bounds remain intact.");
