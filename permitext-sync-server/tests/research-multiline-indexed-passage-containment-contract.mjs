import assert from "node:assert/strict";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { researchPassagesForSection } from "../research-passage-index.mjs";

globalThis.fetch = () => { throw new Error("Network/provider calls forbidden in indexed containment contract."); };
const descriptor = {
  id: "fixture-parent", sectionID: "fixture-parent", sectionNumber: "990", title: "Fixture equipment rules",
  codePrefix: "MC", codeVersion: "fixture-edition-1", codeEdition: "Fixture edition 1", corpusID: "fixture-current"
};
const general = "990.1 General.\n\nThese provisions apply only to outdoor equipment.";
const condition = "990.2 Protective spacing.\n\nThe following spacing applies to equipment with an exposed opening.";
const operative = "990.2.1 Clearance.\n\nThe exposed opening shall retain at least six feet of clear space.\n\nException: A listed sealed enclosure shall retain the manufacturer's specified clearance.";
const unrelated = "990.3 Other equipment.\n\n" + "Other equipment has separately specified fabrication conditions. ".repeat(300);
const raw = [general, condition, operative, unrelated].join("\n\n");
const body = { blocks: [{ id: "fixture-block", plainText: raw }] };
const target = researchPassagesForSection(descriptor, body).find(passage => passage.subsectionNumber === "990.2.1");
assert(target?.scopeComplete);
assert(raw.length > 12000, "The whole source cannot fit; the complete indexed child must be retained instead.");
const expected = [...new Set([...target.contextTexts, target.completeSubsectionText].map(text => text.trim()))].join("\n\n");
assert(expected.length < 2000);
assert.match(expected, /outdoor equipment[\s\S]*exposed opening[\s\S]*Exception:/);
const flattened = [descriptor.sectionNumber, descriptor.title, raw].join(" ").replace(/\s+/g, " ").trim();

async function packet(indexedPassage = target, overrides = {}, limits = {}) {
  const resolved = { ...descriptor, body, text: flattened, canonicalText: flattened, crossReferences: [], ...overrides };
  return assembleResearchEvidence({
    question: "What protective spacing does the exposed opening need?",
    discover: async () => ({ candidates: [{ ...descriptor, rank: 1, indexedPassage }] }),
    resolveSection: async () => resolved,
    limits: { maximumCharacters: 4000, maximumSupplementalCharacters: 4000, maximumCharactersPerSource: 4000, ...limits }
  });
}
const retained = await packet();
const source = retained.sources.find(source => source.sectionID === descriptor.sectionID);
assert(source?.indexedPassage, "A flattened canonical resolver must not discard a hash-validated multiline indexed child.");
assert.equal(source.text, expected, "Containment comparison must not rewrite the emitted exact child/context text.");
assert.equal(source.indexedPassage.subsectionNumber, "990.2.1");
assert.equal(source.indexedPassage.completeSubsection, true);
assert.equal(source.canonicalContextComplete, false, "An indexed subsection is not the whole canonical parent.");
assert.equal(source.truncated, false);
assert.equal(retained.usage.characterCount, retained.sources.reduce((sum, value) => sum + value.text.length, 0));
assert(retained.usage.characterCount <= retained.limits.maximumCharacters);

const invalid = [
  { name: "changed legal word", value: { ...target, text: target.text.replace("six feet", "two feet") } },
  { name: "wrong raw block hash", value: { ...target, sourceTextHash: "0".repeat(64) } },
  { name: "shifted raw offsets", value: { ...target, sourceOffsets: { ...target.sourceOffsets, start: target.sourceOffsets.start + 1 } } },
  { name: "invented completion", value: { ...target, completeSubsectionText: target.completeSubsectionText + "Invented waiver authorizes every other configuration." } },
  { name: "invented parent condition", value: { ...target, contextTexts: ["Invented waiver authorizes every other configuration.", ...target.contextTexts] } }
];
for (const test of invalid) {
  const rejected = await packet(test.value);
  assert(rejected.sources.every(source => !source.indexedPassage), `${test.name}: whitespace normalization must not admit an invalid indexed passage.`);
  assert(rejected.sources.every(source => !source.text.includes("Invented waiver") && !source.text.includes("two feet")), `${test.name}: fabricated words must never enter evidence.`);
}
const wrongEdition = await packet(target, { codeVersion: "fixture-edition-2" });
assert.equal(wrongEdition.sources.length, 0, "Canonical edition identity mismatch remains rejected.");
assert.equal(wrongEdition.usage.resolverFailureCount, 1);
const changedBody = await packet(target, { body: { blocks: [{ ...body.blocks[0], plainText: raw.replace(/\n\n/g, "\n") }] } });
assert(changedBody.sources.every(source => !source.indexedPassage), "A reflowed raw source invalidates its old block hash even when canonical whitespace is equivalent.");
const tooSmall = await packet(target, {}, { maximumCharacters: expected.length - 1, maximumSupplementalCharacters: expected.length - 1 });
assert(tooSmall.sources.every(source => !source.indexedPassage && !source.canonicalContextComplete), "A complete child/context cannot be admitted by dropping its condition or exception to fit.");
assert(tooSmall.usage.characterCount <= expected.length - 1);

let discoveryCalls = 0;
const selected = "The exposed opening shall retain at least six feet of clear space.";
const strict = await assembleResearchEvidence({
  question: "Using only the selected passage, explain its spacing statement.",
  pinnedEvidence: [{ ...descriptor, selectedText: selected, userSelectedText: selected, text: selected }],
  strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" },
  discover: async () => { discoveryCalls += 1; throw new Error("Strict selected evidence must not discover additional text."); },
  resolveSection: async () => ({ ...descriptor, body, text: flattened, canonicalText: flattened, crossReferences: [] })
});
assert.equal(discoveryCalls, 0);
assert.equal(strict.sources.length, 1);
assert.equal(strict.sources[0].text, selected, "Whitespace-compatible containment must not expand the user's strict selection.");
assert.equal(strict.sources[0].pinnedSelectionExact, true);
assert.equal(strict.sources[0].indexedPassage, undefined);
assert.equal(strict.usage.crossReferenceCount, 0);
assert.equal(strict.rulePackets.recoveryReads, 0);

console.log("Indexed containment contract passed: flattened canonical text retains complete multiline child/scope/exception; emitted text, hash/offset/word/edition checks and strict selected boundaries remain intact; no API calls.");
