import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const prompt = researchConversationFactPromptContext(result);
  assert.ok(prompt.qualified.includes(statement), "Scoped coverage is supplied, without establishing full coverage.");
  assert.equal(prompt.unknown.some((line) => line.includes(statement)), false);
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
assert.equal(researchConversationFactPromptContext(knownThenUnknown).qualified.length, 0);
assert(researchConversationFactPromptContext(knownThenUnknown).unknown.length);

for (const statement of [
  "The building is not fully sprinklered, reportedly.",
  "The owner claims the building is partially sprinklered.",
  "The building is not fully sprinklered, but this is unverified.",
  "The sprinkler coverage is not yet known.",
  "The occupancy classification is not supplied.",
  "The construction type has not been established.",
  "The application does not state how many units are occupied at filing or how many will remain occupied during the work.",
  "The user provides a brief work description but no property restrictions, filing type, complete scope, agency approvals, or Applicant of Record certification basis."
]) {
  const result = resolve(statement);
  const prompt = researchConversationFactPromptContext(result);
  assert.equal(prompt.qualified.length, 0, statement);
  assert(prompt.unknown.some((line) => line.includes(statement)), statement);
}
assert.equal(researchConversationFactPromptContext(resolve("Using only the selected table, summarize how Use Group I allowances differ across M1, M2, and M3 districts and explain the table symbols.")).qualified.length, 0,
  "A research instruction must not become a supplied project premise.");

// Reproduce the actual routing failure without changing the saved response or
// treating conservative canonical categories as proven positive facts.
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json", import.meta.url)));
const routingQuestion = retained.results.find((item) => item.id === "DOBNOW-001").question;
const routingFacts = resolve(routingQuestion);
const beforePrompt = structuredClone(routingFacts);
const routingPrompt = researchConversationFactPromptContext(routingFacts);
assert.equal(routingPrompt.unknown.length, 0, "The scenario does not state an unknown routing condition.");
assert.equal(routingPrompt.qualified.length, 2, "Preserve both distinct supplied assertions without duplicated canonical categories.");
assert(routingPrompt.qualified.some((line) => line.includes("does not require the alteration to meet New Building requirements")));
assert(routingPrompt.qualified.some((line) => line.includes("does not change occupancy, use, exits, or number of stories")));
assert.equal(value(routingFacts, "building_status"), undefined);
assert.equal(value(routingFacts, "occupancy_group"), undefined);
assert.deepEqual(routingFacts, beforePrompt, "Prompt formatting must not promote or mutate saved facts.");
assert.deepEqual(researchConversationFactPromptContext(resolve("Explain those routing responses.", routingFacts)).qualified, routingPrompt.qualified);

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
  assert.equal(researchConversationFactPromptContext(legacy).qualified.length, 0,
    "Legacy reconfirmation records must remain unresolved.");
}

for (const question of ["Is the building not fully sprinklered?", "Could it be an existing building?", "BC 903 requires a fully sprinklered building."]) {
  const result = resolve(question);
  assert.equal(result.establishedFacts.length, 0, "An unresolved question or legal requirement is not an assertion.");
}
console.log("Permitext qualified conversation facts contract passed.");
