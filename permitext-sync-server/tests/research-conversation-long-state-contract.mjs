import assert from "node:assert/strict";
import { researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";
import { resolveResearchConversationFacts } from "../research-conversation-facts.mjs";

const turns = [];
let topicContext = null;

function values(facts) {
  return Object.fromEntries(facts.establishedFacts.map((item) => [item.key, item.value]));
}

function turn(question) {
  const query = researchEvidenceRetrievalQuery({
    question,
    previousMessages: turns.map((item) => ({ role: "user", question: item.question })),
    topicContext
  });
  const facts = resolveResearchConversationFacts({ question, topicDecision: query.topicDecision, topicContext });
  const originalTopic = topicContext?.originalTopic || query.topicDecision.rootTopic.text || question;
  topicContext = {
    ...(topicContext || {}),
    originalTopic,
    rootTopic: query.topicDecision.nextRootTopic.text,
    currentTopic: query.topicDecision.nextCurrentTopic.text,
    factTopics: facts.nextFactTopics
  };
  turns.push({ question, query, facts });
  return { query, facts };
}

const initial = turn("An existing six-story Group R-2 building of Type IIB construction is 68 feet high.");
assert.deepEqual(values(initial.facts), {
  story_count: "6",
  construction_type: "IIB",
  building_height_feet: "68",
  occupancy_group: "R-2",
  building_status: "existing"
});

const scope = turn("The work is an alteration on the third floor.");
assert.equal(scope.query.topicDecision.decision, "continuation");
assert.equal(values(scope.facts).work_scope, "alteration");
assert.equal(values(scope.facts).floor_location, "3");

const egress = turn("The occupant load is 48 and the exit access travel distance is 120 feet.");
assert.equal(values(egress.facts).occupant_load, "48");
assert.equal(values(egress.facts).travel_distance_feet, "120");

const sprinklered = turn("The building is fully sprinklered.");
assert.equal(values(sprinklered.facts).sprinkler_status, "fully_sprinklered");

const corrected = turn("Actually, the travel distance is 95 feet.");
assert.equal(corrected.query.topicDecision.decision, "correction");
assert.equal(values(corrected.facts).travel_distance_feet, "95");
assert.equal(corrected.facts.establishedFacts.some((item) => item.value === "120"), false);

const hypothetical = turn("What if the occupant load were 80?");
assert.equal(hypothetical.facts.turnKind, "hypothetical");
assert.equal(hypothetical.facts.hypotheticalFacts.find((item) => item.key === "occupant_load")?.value, "80");
assert.equal(values(hypothetical.facts).occupant_load, "48");

const office = turn("New topic: A 1,200 sf space is used as a small architectural office with 12 employees.");
assert.equal(office.query.topicDecision.decision, "topic_switch");
assert.deepEqual(values(office.facts), {
  area_square_feet: "1,200",
  employee_count: "12",
  use: "a small architectural office"
});

const officeFollowUp = turn("Why is that Group B?");
assert.equal(officeFollowUp.query.topicDecision.decision, "continuation");
assert.equal(values(officeFollowUp.facts).use, "a small architectural office");
assert.equal(values(officeFollowUp.facts).story_count, undefined);

const returned = turn("Go back to the original egress question.");
assert.equal(returned.query.topicDecision.signals.returnToOriginal, true);
assert.equal(values(returned.facts).story_count, "6");
assert.equal(values(returned.facts).travel_distance_feet, "95");
assert.equal(values(returned.facts).occupant_load, "48");
assert.equal(values(returned.facts).use, undefined);

const filed = turn("The application was filed August 10, 2026 under the 2022 Construction Codes.");
assert.equal(filed.query.topicDecision.decision, "continuation");
assert.equal(values(filed.facts).filing_date, "2026-08-10");
assert.equal(values(filed.facts).code_basis_year, "2022");
assert.equal(values(filed.facts).story_count, "6");
assert.equal(values(filed.facts).travel_distance_feet, "95");
assert.equal(values(filed.facts).occupant_load, "48");
assert.equal(topicContext.factTopics.length, 2);

console.log("Permitext 10-turn conversation state contract passed.");
