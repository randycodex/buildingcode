import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput, ownerResearchHTTPSelections } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { researchCorpusPlanForTurn } from "../app.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in authored-input contract."); };
const original = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const additional = JSON.parse(await readFile(new URL("../evals/results/research-owner-code-source-review-2026-09-08.json", import.meta.url)));
const cases = [...original.cases.map((item) => ({ item, original: true })),
  ...additional.cases.map((item) => ({ item, original: false }))];
assert.equal(cases.length, 110);
let pins = 0;
let exactGroups = 0;
let exactPassages = 0;
for (const { item, original } of cases) {
  const options = { original, zoningSummary: zoningSectionSummary };
  const input = await ownerResearchScopeInput(item, options);
  const polluted = { ...item, expectedAnswer: "REFERENCE_LEAK", requiredConcepts: ["RUBRIC_LEAK"],
    forbiddenClaims: ["FORBIDDEN_LEAK"], rationale: "RATIONALE_LEAK", reviewedExpectedAnswer: "REVIEW_LEAK",
    sourceReferences: ["AUTHORITY_LEAK"], sourceIDs: ["SOURCE_LEAK"], developmentAmendmentID: "AMENDMENT_LEAK" };
  assert.deepEqual(await ownerResearchScopeInput(polluted, options), input,
    `${item.id}: evaluator data must not affect planning or retrieval inputs.`);
  assert.deepEqual(Object.keys(input).sort(), ["messages", "pinnedEvidence", "projectCodeVersion", "projectFacts", "question"]);
  assert.equal(input.question, [original && item.questionContext ? `Context: ${item.questionContext}` : "", original && item.scenario, item.question].filter(Boolean).join("\n\n"));
  assert.deepEqual(input.messages, []);
  assert.equal(input.pinnedEvidence.length,
    (item.selectedEvidence || []).reduce((count, selection) => count + selection.exactPassages.length, 0) +
    (item.selectedEvidenceSectionIDs?.length || 0));
  assert.equal(new Set(input.pinnedEvidence.map((source) => source.sourceID)).size, input.pinnedEvidence.length);
  const exactPins = input.pinnedEvidence.filter((source) => Object.hasOwn(source, "selectedText"));
  assert.deepEqual(exactPins.map((pin) => ({ sectionID: pin.sectionID, selectedText: pin.selectedText })),
    (item.selectedEvidence || []).flatMap((selection) => selection.exactPassages.map((selectedText) => ({
      sectionID: String(selection.sectionID), selectedText
    }))));
  for (const selection of item.selectedEvidence || []) {
    for (const selectedText of selection.exactPassages) {
      const pin = exactPins.find((source) => source.sectionID === String(selection.sectionID) && source.selectedText === selectedText);
      assert.equal(pin.codePrefix, selection.codePrefix);
      assert.equal(pin.sectionNumber, selection.sectionNumber);
      exactPassages++;
    }
    exactGroups++;
  }
  for (const id of item.selectedEvidenceSectionIDs || []) {
    const pin = input.pinnedEvidence.find((source) => source.sectionID === String(id));
    assert.equal(pin.codePrefix, "ZR");
    assert.equal(pin.sectionNumber, (await zoningSectionSummary(id)).sectionNumber);
    assert.equal(pin.selectedText, undefined, "A whole-section pin must resolve through the canonical source assembler.");
  }
  const selections = ownerResearchHTTPSelections(input);
  assert.equal(selections.length, input.pinnedEvidence.length);
  for (const [index, selection] of selections.entries()) {
    const pin = input.pinnedEvidence[index];
    assert.equal(selection.sectionID, pin.sectionID);
    if (pin.selectedText !== undefined) assert.deepEqual(selection, { sectionID: pin.sectionID, selectedText: pin.selectedText });
    else assert.deepEqual(selection, { sectionID: pin.sectionID, selectionMode: "section_reference" });
  }
  pins += input.pinnedEvidence.length;
}
assert.equal(pins, 53);
assert.equal(exactGroups, 8);
assert.equal(exactPassages, 14);
for (const exactPassages of [undefined, null, [], [""], [" \n "], ["Valid passage", null], "Not an array"]) {
  await assert.rejects(() => ownerResearchScopeInput({ question: "Explain my selection.",
    selectedEvidence: [{ sectionID: "2197", exactPassages }] }, { original: true }),
  { code: "AUTHORED_SELECTION_INVALID" });
}
assert.throws(() => ownerResearchHTTPSelections({ pinnedEvidence: [{ sectionID: "113", selectedText: "" }] }));
assert.throws(() => ownerResearchHTTPSelections({ pinnedEvidence: [{ selectedText: "Exact passage" }] }));
const cc01 = await ownerResearchScopeInput(original.cases.find((item) => item.id === "CC-01"), { original: true });
assert.deepEqual(cc01.projectFacts, [
  "occupancy: Group R-2 stated by the question", "configuration: Scissor stair with entrance doors 15 feet apart",
  "unknowns: enclosure rating", "unknowns: separating construction rating", "unknowns: construction material"
]);
const zr03 = await ownerResearchScopeInput(original.cases.find((item) => item.id === "ZR-03"),
  { original: true, zoningSummary: zoningSectionSummary });
const corpus = await researchCorpusPlanForTurn(zr03);
assert.ok([...corpus.selected, ...(corpus.pinnedCorpora || [])].some((item) => item.id === "nyc-zoning-resolution"),
  "Authored Zoning pins must select their corpus even when the question names no ZR section.");
await assert.rejects(() => ownerResearchScopeInput({ question: "Explain my selection.", selectedEvidenceSectionIDs: [123] },
  { original: true, zoningSummary: async () => null }), { code: "AUTHORED_SELECTION_UNAVAILABLE" });
console.log("All 110 authored inputs preserve 53 pins: 14 exact fragments in eight authored groups and 39 section references, with Project facts and no reference-answer leakage.");
