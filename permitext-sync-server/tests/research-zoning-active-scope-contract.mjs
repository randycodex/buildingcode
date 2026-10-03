import assert from "node:assert/strict";
import {
  applyZoningResearchDeterministicRepairs,
  evaluateZoningResearchSafety,
  zoningResearchSafetyPromptContext
} from "../research-zoning-safety.mjs";

globalThis.fetch = async () => { throw new Error("No provider calls in active-scope contracts."); };

// These invented excerpts exercise scope and binding, not real zoning answers.
const source = (sourceID, codePrefix, sectionNumber, text, extra = {}) => ({
  sourceID, codePrefix, sectionNumber, title: `${codePrefix} rule ${sectionNumber}`,
  corpusID: codePrefix === "ZR" ? "nyc-zoning-resolution" : `test-${codePrefix.toLowerCase()}`,
  text, canonicalContextComplete: true, truncated: false, ...extra
});
const answer = (text, sourceIDs = []) => ({
  answerText: text, conclusion: text, explanation: "",
  supportedPoints: sourceIDs.length ? [{ heading: "Operative rule", explanation: text, sourceIDs }] : [],
  citations: sourceIDs.length ? [{ sectionID: "test", sourceIDs }] : [],
  missingFacts: [], evidenceLimitations: []
});
const grid = [{ rows: [{ cells: [{ text: "Category" }, { text: "Required count" }] }] }];
const cellar = source("collateral-definition", "ZR", "88-10",
  "Definition of cellar: a cellar is measured from the base plane, except where a yard was lowered after December 5, 1990, when the original yard level applies.",
  { title: "Definitions", evidencePriority: { primaryFunction: "definition", functions: ["definition"] } });
const unrelatedTable = source("optional-width-table", "ZR", "88-20",
  "The table specifies loading bay width and length, not the number of berths.",
  { richSourceGrids: grid, richSourceCanonicalReference: "ZR Table 88-20" });
const unrelatedMap = source("optional-map", "ZR", "Appendix Q",
  "This special-district map does not identify the subject parcel.",
  { visualSources: [{ id: "test-map" }] });

for (const code of ["FC", "MC", "PC", "BC"]) {
  const operative = source(`operative-${code}`, code, "999.1", "A clear opening must be at least 8 feet high.");
  const result = evaluateZoningResearchSafety({
    question: "Does the stated 7-foot clear opening meet the minimum height?",
    evidence: [operative, unrelatedTable, cellar, unrelatedMap],
    answer: answer("No. The opening must be at least 8 feet high, so the stated 7 feet is insufficient.", [operative.sourceID])
  });
  assert.equal(result.applies, false, `${code}: incidental Zoning retrieval is not the answer's rule family`);
  assert.equal(result.pass, true);
  assert.deepEqual(result.issues, []);
}

const fireRule = source("fire-rule", "FC", "999.1", "The required clear opening is 8 feet.");
for (const claim of [
  "The project is permitted as-of-right under zoning.",
  "The property is approved.",
  "The site is in C8-7 and may proceed.",
  "A zoning lot may be approved for this use."
]) {
  const result = evaluateZoningResearchSafety({
    question: "Does this clear opening meet the minimum?",
    evidence: [fireRule, unrelatedTable],
    answer: answer(`The opening is too short. ${claim}`, ["fire-rule"])
  });
  assert(result.issues.some(i => i.type === "zoning_unbound_conclusion"), claim);
}
assert(evaluateZoningResearchSafety({
  question: "Under zoning, is the property permitted for this use?",
  evidence: [fireRule, unrelatedTable], answer: answer("The property is approved.", ["fire-rule"])
}).issues.some(i => i.type === "zoning_unbound_conclusion"));

const countTable = source("count-table", "ZR", "88-30",
  "The loading table applies to new developments. Category Q requires no berth for the first 80,000 square feet and one for the next 160,000 square feet.",
  { title: "Required loading counts" });
const countQuestion = "For the stated new development, how many loading berths does the ordinary table require?";
const countAnswer = answer("One berth. The stated 110,000 square feet occupies the next 160,000-square-foot table band.", ["count-table"]);
for (const extra of [unrelatedTable, { ...unrelatedTable, codePrefix: "BC", corpusID: "test-bc" }]) {
  const result = evaluateZoningResearchSafety({
    question: countQuestion, evidence: [countTable, extra], answer: countAnswer
  });
  assert.equal(result.pass, true, JSON.stringify(result.issues));
}
const onlyPointBound = { ...countAnswer, citations: [] };
assert(evaluateZoningResearchSafety({
  question: countQuestion, evidence: [countTable, unrelatedTable], answer: onlyPointBound
}).issues.some(i => i.type === "zoning_table_binding"), "Point binding cannot replace the actual citation");
assert(evaluateZoningResearchSafety({
  question: countQuestion, evidence: [countTable, unrelatedTable], answer: answer("One berth.")
}).issues.some(i => i.type === "zoning_table_binding"), "An uncited numeric table result remains guarded");

const pinned = { ...unrelatedTable, origin: "user_pinned" };
assert(evaluateZoningResearchSafety({
  question: "Using only the selected table, explain its dimensional rows.",
  evidence: [countTable, pinned], answer: countAnswer
}).issues.some(i => i.type === "zoning_table_binding"), "A different table cannot replace the selected passage");
assert(evaluateZoningResearchSafety({
  question: "Using Table 88-20, explain its dimensional rows.",
  evidence: [countTable, unrelatedTable], answer: countAnswer
}).issues.some(i => i.type === "zoning_table_binding"), "An explicitly named table retains its binding");
const secondPin = { ...countTable, origin: "user_pinned", richSourceGrids: grid };
assert(evaluateZoningResearchSafety({
  question: "Using only both selected tables, compare their rows.",
  evidence: [pinned, secondPin], answer: countAnswer
}).issues.some(i => i.type === "zoning_table_binding"), "A comparison must bind both selected passages");
const alternativeCopy = { ...unrelatedTable, sourceID: "width-table-copy" };
assert(!evaluateZoningResearchSafety({
  question: "Using Table 88-20, explain its rows.",
  evidence: [unrelatedTable, alternativeCopy],
  answer: answer("The table supplies width and length requirements.", ["width-table-copy"])
}).issues.some(i => i.type === "zoning_table_binding"), "Alternate complete copies of one table need not both be cited");

for (const question of [
  "Correction: total floor area is 70,000 square feet. How many loading berths does the same table require?",
  "For a larger version with 260,000 square feet of office floor area, what does the loading table require?",
  "The confirmed office floor area is 70,000 square feet, excluding residential uses. How many loading berths does the table require?"
]) {
  const evidence = [countTable, unrelatedTable, cellar];
  const proposal = answer("The count follows from the expressly supplied floor area and the ordinary table band.", ["count-table"]);
  const result = evaluateZoningResearchSafety({ question, evidence, answer: proposal,
    projectFacts: ["User-confirmed floor area: 110,000 square feet initially"] });
  assert(!result.issues.some(i => i.type === "zoning_definition_lowered_yard_fact"), JSON.stringify(result.issues));
  assert.doesNotMatch(zoningResearchSafetyPromptContext({ question, evidence }), /lowered-yard measurement clause/);
  assert.deepEqual(applyZoningResearchDeterministicRepairs(proposal, evidence, { question }), proposal);
}
assert(!evaluateZoningResearchSafety({
  question: countQuestion, evidence: [countTable, cellar],
  answer: answer("One berth on the supplied floor-area premise. The collateral cellar measurement provision is not a classification of a project space.", ["count-table"])
}).issues.some(i => i.type === "zoning_definition_lowered_yard_fact"), "Mentioning a collateral definition does not derive or change the supplied table input");
assert(evaluateZoningResearchSafety({
  question: countQuestion,
  evidence: [countTable, { ...unrelatedTable, evidencePriority: { evidenceRole: "irrelevant" } }],
  answer: answer("One berth under the table.", ["optional-width-table"])
}).issues.some(i => i.type === "zoning_table_binding"), "An irrelevant table cannot satisfy the operative count binding");
for (const question of [
  "A below-grade level is below the base plane. Does it count as zoning floor area?",
  "How is the cellar classification measured?",
  "Should this storage level be excluded from floor area?"
]) {
  assert(evaluateZoningResearchSafety({ question, evidence: [countTable, cellar],
    answer: answer("No, the level is excluded as a cellar.", ["collateral-definition"])
  }).issues.some(i => i.type === "zoning_definition_lowered_yard_fact"), question);
}
assert(evaluateZoningResearchSafety({
  question: countQuestion, evidence: [countTable, cellar],
  answer: answer("The table requires one berth because the basement is excluded as a cellar.", ["count-table", "collateral-definition"])
}).issues.some(i => i.type === "zoning_definition_lowered_yard_fact"), "A new classification claim activates its material measurement condition");
assert(evaluateZoningResearchSafety({
  question: "Is this site within the mapped special district?", evidence: [unrelatedMap],
  answer: answer("This site is in the mapped area and may proceed.", ["optional-map"])
}).issues.some(i => i.type === "zoning_missing_mapped_location"), "Mapped applicability is still guarded");

console.log("Active zoning-safety scope passed: incidental code-family recall, operative and selected table bindings, duplicate references, supplied inputs, and material definition/map boundaries; no provider calls.");
