import assert from "node:assert/strict";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import {
  resolveResearchConversationFacts,
  researchConversationFactPromptContext
} from "../research-conversation-facts.mjs";

function resolve(question, topicContext = null, previousMessages = []) {
  const topicDecision = decideResearchConversationTopic({
    question,
    previousMessages,
    rootTopic: topicContext?.rootTopic || "",
    currentTopic: topicContext?.currentTopic || ""
  });
  const facts = resolveResearchConversationFacts({ question, topicDecision, topicContext });
  return {
    topicDecision,
    facts,
    topicContext: {
      ...(topicContext || {}),
      rootTopic: topicDecision.nextRootTopic.text,
      currentTopic: topicDecision.nextCurrentTopic.text,
      factTopics: facts.nextFactTopics
    }
  };
}

const officeQuestion =
  "A 1,200 sf space is used as a small architectural office with 12 employees. Under BC 304.1, what occupancy group applies, and why?";
const office = resolve(officeQuestion);
assert.deepEqual(
  Object.fromEntries(office.facts.establishedFacts.map((item) => [item.key, item.value])),
  {
    area_square_feet: "1,200",
    employee_count: "12",
    use: "a small architectural office"
  }
);
assert.equal(
  resolve("BC 303.1.3 uses a threshold of 75 persons.").facts.establishedFacts.length,
  0,
  "A legal threshold was incorrectly promoted into a project fact."
);
assert.equal(
  resolve("BC 304.1 includes Group B.").facts.establishedFacts.length,
  0,
  "A code classification statement was incorrectly promoted into a project fact."
);

const officeFollowUp = resolve(
  "Why do the 1,200 sf area and 12 employees not change that classification under the cited provision?",
  office.topicContext,
  [{ role: "user", question: officeQuestion }]
);
assert.equal(officeFollowUp.topicDecision.decision, "continuation");
assert.equal(officeFollowUp.facts.establishedFacts.length, 3);
assert.match(
  researchConversationFactPromptContext(officeFollowUp.facts).established.join(" "),
  /used as a small architectural office/
);

const building = resolve("This is a six-story R-2 building.");
const sprinkler = resolve(
  "The building is fully sprinklered.",
  building.topicContext,
  [{ role: "user", question: "This is a six-story Group R-2 building." }]
);
assert.deepEqual(
  Object.fromEntries(sprinkler.facts.establishedFacts.map((item) => [item.key, item.value])),
  { story_count: "6", occupancy_group: "R-2", sprinkler_status: "fully_sprinklered" }
);

const correction = resolve(
  "Actually, it is a five-story building.",
  sprinkler.topicContext,
  [{ role: "user", question: "The building is fully sprinklered." }]
);
assert.equal(correction.topicDecision.decision, "correction");
assert.equal(correction.facts.establishedFacts.find((item) => item.key === "story_count")?.value, "5");
assert.equal(correction.facts.establishedFacts.find((item) => item.key === "occupancy_group")?.value, "R-2");
assert.equal(correction.facts.establishedFacts.find((item) => item.key === "sprinkler_status")?.value, "fully_sprinklered");

const hypothetical = resolve(
  "What if it had 80 occupants?",
  correction.topicContext,
  [{ role: "user", question: "Actually, it is a five-story building." }]
);
assert.equal(hypothetical.facts.turnKind, "hypothetical");
assert.equal(hypothetical.facts.hypotheticalFacts[0]?.key, "occupant_count");
assert.equal(hypothetical.facts.establishedFacts.some((item) => item.key === "occupant_count"), false);
assert.equal(
  hypothetical.facts.nextFactTopics
    .find((topic) => topic.rootTopic === hypothetical.facts.activeRootTopic)
    ?.establishedFacts.some((item) => item.key === "occupant_count"),
  false
);

const unknown = resolve(
  "The sprinkler status is unknown.",
  correction.topicContext,
  [{ role: "user", question: "Actually, it is a five-story building." }]
);
assert.equal(unknown.facts.unknownFacts.find((item) => item.key === "sprinkler_status")?.value, "unknown");
assert.equal(unknown.facts.establishedFacts.some((item) => item.key === "sprinkler_status"), false);

const switched = resolve(
  "New topic: A room is used as a community hall.",
  officeFollowUp.topicContext,
  [{ role: "user", question: officeFollowUp.topicContext.currentTopic }]
);
assert.equal(switched.topicDecision.decision, "topic_switch");
assert.equal(switched.facts.establishedFacts.some((item) => item.key === "area_square_feet"), false);

const returnDecision = decideResearchConversationTopic({
  question: "Go back to the original office question.",
  rootTopic: officeQuestion,
  currentTopic: switched.topicContext.currentTopic
});
const returned = resolveResearchConversationFacts({
  question: "Go back to the original office question.",
  topicDecision: returnDecision,
  topicContext: switched.topicContext
});
assert.equal(returned.establishedFacts.find((item) => item.key === "use")?.value, "a small architectural office");

console.log("Permitext topic-scoped conversation facts contract passed.");
