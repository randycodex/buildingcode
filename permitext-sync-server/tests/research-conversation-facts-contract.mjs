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

const expanded = resolve(
  "This is an existing six-story Group R-2 building of Type IIB construction, 68 feet high."
);
const expandedFacts = Object.fromEntries(expanded.facts.establishedFacts.map((item) => [item.key, item.value]));
assert.equal(expandedFacts.building_status, "existing");
assert.equal(expandedFacts.story_count, "6");
assert.equal(expandedFacts.occupancy_group, "R-2");
assert.equal(expandedFacts.construction_type, "IIB");
assert.equal(expandedFacts.building_height_feet, "68");

const workFacts = resolve(
  "The work is an alteration on the third floor.",
  expanded.topicContext,
  [{ role: "user", question: expanded.topicContext.currentTopic }]
);
assert.equal(workFacts.topicDecision.decision, "continuation");
assert.equal(workFacts.facts.establishedFacts.find((item) => item.key === "work_scope")?.value, "alteration");
assert.equal(workFacts.facts.establishedFacts.find((item) => item.key === "floor_location")?.value, "3");

const egressFacts = resolve(
  "The occupant load is 48 and the exit access travel distance is 120 feet.",
  workFacts.topicContext,
  [{ role: "user", question: workFacts.topicContext.currentTopic }]
);
assert.equal(egressFacts.facts.establishedFacts.find((item) => item.key === "occupant_load")?.value, "48");
assert.equal(egressFacts.facts.establishedFacts.find((item) => item.key === "travel_distance_feet")?.value, "120");

const filing = resolve(
  "The application was filed August 10, 2026 under the 2022 Construction Codes.",
  egressFacts.topicContext,
  [{ role: "user", question: egressFacts.topicContext.currentTopic }]
);
assert.equal(filing.facts.establishedFacts.find((item) => item.key === "filing_date")?.value, "2026-08-10");
assert.equal(filing.facts.establishedFacts.find((item) => item.key === "code_basis_year")?.value, "2022");

const combinedNaturalFacts = resolve(
  "An existing six-story Group R-2 building of Type IIB construction is 68 feet high and fully sprinklered."
);
assert.equal(combinedNaturalFacts.facts.establishedFacts.find((item) => item.key === "building_status")?.value, "existing");
assert.equal(combinedNaturalFacts.facts.establishedFacts.find((item) => item.key === "sprinkler_status")?.value, "fully_sprinklered");

assert.equal(
  resolve("BC 1017.2 permits an exit access travel distance of 250 feet.").facts.establishedFacts.length,
  0,
  "A code travel-distance threshold was incorrectly promoted into a project fact."
);
assert.equal(
  resolve("Table 601 lists Type IIB construction.").facts.establishedFacts.length,
  0,
  "A construction type mentioned in enacted text was incorrectly promoted into a project fact."
);

console.log("Permitext topic-scoped conversation facts contract passed.");
