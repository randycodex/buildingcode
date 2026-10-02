import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { projectFactProjection } from "../project-fact-projection.mjs";
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = async () => { throw Error("Retrieval contract must not use the network"); };
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const assemble = question => assembledResearchEvidenceForTurn({question,messages:[],pinnedEvidence:[],projectFacts:[]});
const water = await assemble("Under the 2022 NYC Plumbing Code, what is the maximum hot-water temperature at a public lavatory?");
const control = water.sources.find(source => source.codePrefix === "PC" && source.sectionNumber === "607.1.2");
assert(control);
assert.match(control.text,/110/);
assert.equal(control.canonicalContextComplete,true);
assert(water.sources.some(source=>source.codePrefix === "PC" && source.sectionNumber === "416.5"));
assert(water.rulePackets.recoverySearchCount <= 1,"At most one targeted search");
const fixture = JSON.parse(await readFile(new URL("../evals/research-accuracy-project-context-2026-10-02.json", import.meta.url)));
const projectFacts = projectFactProjection(fixture.project).researchFacts;
assert.equal(projectFacts.length, 29);
for (const facts of [projectFacts, [...projectFacts].reverse()]) {
  const contextualWater = await assembledResearchEvidenceForTurn({
    question: fixture.conversations[0].questions[0], messages: [], pinnedEvidence: [], projectFacts: facts
  });
  assert(contextualWater.sources.some(source => source.codePrefix === "PC" && source.sectionNumber === "607.1.2" && /110/.test(source.text)),
    "The full project inventory must not evict the temperature limit");
  assert(!contextualWater.sources.some(source => source.codePrefix === "BC" && source.sectionNumber === "303.1.3" && source.evidencePriority?.claimCoverageRequired),
    "Property metadata must not make fixture-count classification a required temperature claim");
}
const heater = await assemble("Under the 2022 NYC Fire Code, can I plug a portable electric space heater into an extension cord if its ampacity is adequate?");
const electrical = heater.sources.find(source=>source.codePrefix === "FC" && source.sectionNumber === "605");
assert(electrical);
assert.match(electrical.text,/Extension cords shall not be used for electrical connections for portable electric space heaters/);
assert.equal(electrical.canonicalContextComplete,true,"Do not cut the final condition out of a leading provision that fits the source ceiling");
for (const packet of [water,heater]) {
  assert(packet.sources.reduce((sum,source)=>sum+source.text.length,0)<=packet.limits.maximumCharacters);
  assert(packet.sources.every(source=>source.text.length<=packet.limits.maximumCharactersPerSource));
}
const doorComparison = await assembledResearchEvidenceForTurn({
  question: "For that same hypothetical room, is swing direction the same issue as clear opening width? Keep it brief.",
  messages: [
    { role: "user", question: "For a hypothetical Group B office room with 90 occupants, must the door swing in the direction of egress?" },
    { role: "assistant", answer: { citations: [{ codePrefix: "BC", sectionNumber: "1010.1.2.2" }], verification: { pass: true } } }
  ], pinnedEvidence: [], projectFacts: []
});
const width = doorComparison.sources.find(source => source.codePrefix === "BC" && source.sectionNumber === "1010.1.1.1");
assert(width, "An explicit follow-up comparison must retrieve the related requirement");
assert.notEqual(width.evidencePriority?.topicRouteRelationship, "collateral",
  "A historical door-swing citation must not prohibit answering the newly requested width comparison");
assert.match(width.text, /32 inches/);
console.log("Accuracy retrieval contracts passed: numerical recovery, full heater condition, follow-up comparison and unchanged evidence ceilings.");
