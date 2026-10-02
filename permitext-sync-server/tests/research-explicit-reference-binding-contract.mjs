import assert from "node:assert/strict";
globalThis.fetch = async () => { throw Error("No external calls in binding contracts"); };
const { normalizeResearchInterpretationEvidenceBindings: normalize } = await import("../app.mjs");
const sources = [
  {sourceID:"location", sectionID:"a", codePrefix:"MC", sectionNumber:"777.3", codeEdition:"2022"},
  {sourceID:"inspection", sectionID:"b", codePrefix:"AC", sectionNumber:"28-777.1", codeEdition:"2022"}
];
const point = explanation => ({heading:"Distinction",explanation,sectionID:"b",sourceIDs:["inspection"]});
const answer = explanation => ({supportedPoints:[point(explanation)],citations:[{sectionID:"b",sourceIDs:["inspection"]}]});
const original = answer("AC § 28-777.1 requires inspection; it does not override MC § 777.3.");
const result = normalize(original,sources);
assert.deepEqual(original.supportedPoints[0].sourceIDs,["inspection"],"Do not mutate the draft");
assert.deepEqual(result.supportedPoints[0].sourceIDs,["inspection","location"]);
assert(result.citations.some(citation=>citation.sectionID === "a" && citation.sourceIDs.includes("location")));
for (const text of ["The mechanical location restriction still applies.","MC § 777 does not permit this.","MC § 777.31 applies.","PC § 777.3 applies."]) {
  assert.deepEqual(normalize(answer(text),sources).supportedPoints[0].sourceIDs,["inspection"],"No topic or parent-section inference");
}
assert.deepEqual(normalize(original,[...sources,{...sources[0],sourceID:"historical-location",codeEdition:"2014"}]).supportedPoints[0].sourceIDs,["inspection"],"Do not choose an edition for an ambiguous reference");
const unknown = structuredClone(original); unknown.supportedPoints[0].sourceIDs=["invented"];
assert.deepEqual(normalize(unknown,sources).supportedPoints[0].sourceIDs,["invented"],"Unknown bindings remain invalid, not silently repaired");
console.log("Explicit reference binding passed: exact unique supplied sources only; ambiguous, unknown and inferred sources excluded. Semantic verification remains required.");
