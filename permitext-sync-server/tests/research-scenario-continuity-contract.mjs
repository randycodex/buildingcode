import assert from "node:assert/strict";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";

let context = null;
const messages = [];
const turn = question => {
  const decision = decideResearchConversationTopic({ question, previousMessages: messages,
    rootTopic: context?.rootTopic, currentTopic: context?.currentTopic });
  const facts = resolveResearchConversationFacts({ question, topicDecision: decision, topicContext: context });
  context = { rootTopic: decision.nextRootTopic.text, currentTopic: decision.nextCurrentTopic.text,
    factTopics: facts.nextFactTopics };
  messages.push({ role: "user", question });
  return facts;
};
turn("This is a Group B building with 30 occupants.");
let facts = turn("Suppose the same building has 80 occupants.");
assert(facts.hypotheticalFacts.some(f => f.key === "occupant_count" && f.value === "80"));
facts = turn("Actually, make that 90 occupants in the same building.");
assert(facts.hypotheticalFacts.some(f => f.key === "occupant_count" && f.value === "90"));
assert(!facts.establishedFacts.some(f => f.value === "90"));
for (let i = 0; i < 10; i++) facts = turn("For that same building, explain why the occupant count matters.");
assert(facts.hypotheticalFacts.some(f => f.value === "90"), "Scenario assumptions survive longer than the model message window");
assert(researchConversationFactPromptContext(facts).hypothetical.some(s => /90/.test(s)));
facts = turn("Back to the actual project: the building has 35 occupants.");
assert.equal(facts.hypotheticalFacts.length, 0);
assert(facts.establishedFacts.some(f => f.key === "occupant_count" && f.value === "35"));
facts = turn("Suppose the same building has 100 occupants.");
facts = turn("New topic: plumbing fixture trap seals.");
assert.equal(facts.hypotheticalFacts.length, 0, "A new subject must not inherit a different scenario");
turn("New topic: a Class A portable extinguisher. The actual travel distance is 60 feet.");
facts = turn("Suppose the travel distance is 90 feet instead.");
facts = turn("Correction within the hypothetical: the travel distance is 80 feet, not 90 feet.");
assert.equal(facts.hypotheticalFacts.find(f => f.key === "travel_distance_feet")?.value, "80");
assert.equal(facts.establishedFacts.find(f => f.key === "travel_distance_feet")?.value, "60");
assert(!facts.establishedFacts.some(f => /exit access/.test(f.statement)), "Do not invent a different travel-distance subject");
for (let i = 0; i < 10; i++) facts = turn("For that same hypothetical, explain the distance issue.");
assert.equal(facts.hypotheticalFacts.find(f => f.key === "travel_distance_feet")?.value, "80");
console.log("Hypothetical corrections and long follow-ups remain separate from actual project facts; explicit returns reset the scenario.");
