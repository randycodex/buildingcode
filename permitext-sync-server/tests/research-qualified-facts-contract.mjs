import assert from "node:assert/strict";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";

const rootTopic = "Synthetic building facts";
const topicDecision = { decision: "continuation", nextRootTopic: { text: rootTopic } };
function resolve(question, previous = null) {
  return resolveResearchConversationFacts({
    question, topicDecision, topicContext: previous ? { factTopics: previous.nextFactTopics } : null
  });
}
const value = (result, key) => result.establishedFacts.find((item) => item.key === key)?.value;
const initial = resolve("This is an existing six-story Group R-2 building. The building is fully sprinklered.");
assert.equal(value(initial, "building_status"), "existing");
assert.equal(value(initial, "sprinkler_status"), "fully_sprinklered");

for (const statement of [
  "The building is sprinklered on the ground floor only.",
  "Only the ground floor of the building is fully sprinklered.",
  "The ground floor is fully sprinklered.",
  "The building is partially sprinklered.",
  "The building is not fully sprinklered.",
  "The building is sprinklered except for the basement.",
  "The building is fully sprinklered above grade.",
  "The building is fully sprinklered in the commercial space.",
  "The building is fully sprinklered in selected areas.",
  "The building is fully sprinklered in part.",
  "The building is sprinklered."
]) {
  const result = resolve(statement, initial);
  assert.equal(value(result, "sprinkler_status"), undefined, statement);
  assert.equal(value(result, "story_count"), "6", "A sprinkler qualification must not erase an unrelated prior fact.");
  assert.equal(result.unknownFacts.find((item) => item.key === "sprinkler_status")?.sourceText, statement);
  assert.ok(researchConversationFactPromptContext(result).unknown.some((line) => line.includes(statement)));
  const followUp = resolve("Explain the applicable requirements.", result);
  assert.equal(value(followUp, "sprinkler_status"), undefined, "A follow-up must not revive full coverage.");
}

for (const statement of ["This is not an existing building.", "The building isn't existing.", "This is a non-existing building.", "The project is not new construction."]) {
  const result = resolve(statement, initial);
  assert.equal(value(result, "building_status"), undefined, statement);
  assert.equal(result.unknownFacts.find((item) => item.key === "building_status")?.sourceText, statement);
}

const mixed = resolve("The occupant load is 48. For this analysis, assume the building is fully sprinklered.");
assert.equal(value(mixed, "occupant_load"), "48");
assert.equal(value(mixed, "sprinkler_status"), undefined);
assert.ok(mixed.hypotheticalFacts.some((item) => item.key === "sprinkler_status"));
assert.equal(resolve("Explain the requirements.", mixed).hypotheticalFacts.length, 0);
assert.equal(value(resolve("Explain the requirements.", mixed), "sprinkler_status"), undefined);

for (const statement of [
  "For comparison, suppose this is a new building.",
  "Under these assumptions, the building is fully sprinklered.",
  "The building would be fully sprinklered if the upgrade is installed.",
  "Assume the building is fully sprinklered. The occupant load is 80.",
  "The building is fully sprinklered, assuming the proposed system is installed."
]) {
  const result = resolve(statement, initial);
  assert.equal(value(result, "building_status"), "existing", "A hypothetical cannot replace established status.");
  assert.equal(value(result, "occupant_load"), undefined, "Assumption scope must survive sentence boundaries.");
  assert.ok(result.hypotheticalFacts.length, statement);
  assert.equal(value(resolve(statement), "sprinkler_status"), undefined, "An embedded condition must qualify the preceding assertion too.");
}

const unknownThenKnown = resolve("The sprinkler status is unknown. The building is fully sprinklered.");
assert.equal(value(unknownThenKnown, "sprinkler_status"), "fully_sprinklered");
assert.equal(unknownThenKnown.unknownFacts.some((item) => item.key === "sprinkler_status"), false);
const knownThenUnknown = resolve("The building is fully sprinklered. The sprinkler status is unknown.");
assert.equal(value(knownThenUnknown, "sprinkler_status"), undefined);

for (const sourceText of [
  "The building is sprinklered on the ground floor only.",
  "For this calculation, assume the building is fully sprinklered."
]) {
  const legacy = resolveResearchConversationFacts({
    question: "Explain the requirements.", topicDecision,
    topicContext: { factTopics: [{ rootTopic, establishedFacts: [{
      key: "sprinkler_status", value: "fully_sprinklered", statement: "The active-topic building is fully sprinklered.", sourceText
    }], unknownFacts: [] }] }
  });
  assert.equal(value(legacy, "sprinkler_status"), undefined, "Legacy inferred facts need revalidation against their wording.");
  assert.ok(legacy.unknownFacts.some((item) => item.sourceText === sourceText));
}

for (const question of ["Is the building not fully sprinklered?", "Could it be an existing building?", "BC 903 requires a fully sprinklered building."]) {
  const result = resolve(question);
  assert.equal(result.establishedFacts.length, 0, "An unresolved question or legal requirement is not an assertion.");
}
console.log("Permitext qualified conversation facts contract passed.");
