import assert from "node:assert/strict";
import {
  researchConversationFactsVersion,
  researchConversationFactPromptContext,
  resolveResearchConversationFacts
} from "../research-conversation-facts.mjs";

globalThis.fetch = () => { throw new Error("Subject-scope checks must not make network or provider calls."); };
const rootTopic = "System and building facts";
const topicDecision = { decision: "continuation", nextRootTopic: { text: rootTopic } };
const resolve = (question, prior) => resolveResearchConversationFacts({
  question, topicDecision, topicContext: prior ? { factTopics: prior.nextFactTopics } : null
});
const value = (result, key) => result.establishedFacts.find((item) => item.key === key)?.value;
const has = (result, key) => [...result.establishedFacts, ...result.unknownFacts, ...result.hypotheticalFacts].some((item) => item.key === key);

const pipingQuestion = "A new natural-gas piping system in a Manhattan commercial building will operate at 15 psig. Can it be designed only under the ordinary Fuel Gas Code piping provisions, without considering Appendix G?";
const systemStatement = "A central system serving two dwelling units is designed to use return air from Apartment A as part of the ventilation air supplied to Apartment B.";

for (const question of [
  pipingQuestion,
  "Existing equipment within a commercial building is being replaced.",
  "A new ventilation system serving a residential building is proposed.",
  "This is a new project in a commercial building.",
  "This project is new construction equipment testing.",
  "A new building permit is required for the work.",
  "Existing building equipment is being replaced.",
  "A new boiler heats the building.",
  "New equipment requires a building.",
  "Existing equipment, the building is being renovated.",
  "The building is new equipment storage space.",
  "A new building-wide system is proposed.",
  "Only a new boiler in the building is proposed.",
  "An existing valve in the building may be reused."
]) {
  assert.equal(has(resolve(question), "building_status"), false, question);
}

for (const [question, expected] of [
  ["This is an existing six-story Group R-2 building.", "existing"],
  ["A new steel-framed commercial building is proposed.", "new"],
  ["The building is existing.", "existing"],
  ["The building will be new.", "new"],
  ["This project is new construction.", "new"],
  ["A new boiler in an existing commercial building is proposed.", "existing"],
  ["Existing equipment in a new commercial building is being reused.", "new"],
  ["The building is new and has five stories.", "new"]
]) {
  assert.equal(value(resolve(question), "building_status"), expected, question);
}

const prior = resolve("This is an existing building. The building contains 20 dwelling units.");
assert.equal(value(prior, "dwelling_unit_count"), "20");
assert.equal(value(resolve(pipingQuestion, prior), "building_status"), "existing", "Equipment changes cannot replace a supplied building status.");
for (const question of [
  "The building is not new.",
  "This is not an existing building.",
  "The building isn't existing.",
  "This is a non-existing building.",
  "The building may be new.",
  "The building might be existing."
]) {
  const result = resolve(question, prior);
  assert.equal(value(result, "building_status"), undefined, question);
  assert.equal(result.unknownFacts.find((item) => item.key === "building_status")?.sourceText, question);
}
assert.equal(value(resolve("Suppose this is a new commercial building.", prior), "building_status"), "existing");
assert.equal(value(resolve("Could this be an existing building?"), "building_status"), undefined);

// The system's service area is distinct from the building's total units. The
// partial-air wording remains a supplied, scoped premise in the writer context.
const system = resolve(`${systemStatement} Is that permitted?`, prior);
assert.equal(value(system, "dwelling_unit_count"), "20");
assert.equal(system.unknownFacts.some((item) => item.key === "dwelling_unit_count"), false);
assert.equal(system.unknownFacts.find((item) => item.key === "system_served_dwelling_unit_count")?.sourceText, systemStatement);
const prompt = researchConversationFactPromptContext(system);
assert.deepEqual(prompt.qualified, [systemStatement]);
assert.deepEqual(prompt.unknown, [], "Supplied system facts must not become a missing-facts request.");
assert.deepEqual(researchConversationFactPromptContext(resolve("Explain that rule.", system)), prompt);

const exactSystem = resolve("The central system serves two dwelling units.", prior);
assert.equal(value(exactSystem, "system_served_dwelling_unit_count"), "2");
assert.equal(value(exactSystem, "dwelling_unit_count"), "20");
for (const question of [
  "The system serves approximately three dwelling units.",
  "The system does not serve two dwelling units.",
  "The system may serve three dwelling units."
]) {
  const result = resolve(question, exactSystem);
  assert.equal(value(result, "system_served_dwelling_unit_count"), undefined, question);
  assert.equal(value(result, "dwelling_unit_count"), "20", question);
}
const hypothetical = resolve("Assume the system serves three dwelling units.", exactSystem);
assert.equal(value(hypothetical, "system_served_dwelling_unit_count"), "2");
assert(hypothetical.hypotheticalFacts.some((item) => item.key === "system_served_dwelling_unit_count"));
assert.equal(has(resolve("Can the system serve two dwelling units?"), "system_served_dwelling_unit_count"), false);

// Changing the parser version forces saved positive claims through their source
// wording. A legacy equipment-derived building status cannot survive that check.
const legacy = resolveResearchConversationFacts({
  question: "Explain the requirements.", topicDecision,
  topicContext: { factTopics: [{ rootTopic, establishedFacts: [{
    key: "building_status", value: "new", statement: "The active-topic building is new construction.",
    sourceText: pipingQuestion.split(". ")[0] + ".", qualificationVersion: "20260908-negative-work-premise-v6"
  }], unknownFacts: [] }] }
});
assert.equal(value(legacy, "building_status"), undefined);
assert.equal(legacy.unknownFacts.find((item) => item.key === "building_status")?.qualificationVersion, researchConversationFactsVersion);
assert.match(researchConversationFactPromptContext(legacy).unknown.join(" "), /requires reconfirmation/);
console.log("Permitext Research fact subject scope contract passed.");
