import assert from "node:assert/strict";
import { assembleResearchEvidence, researchEvidenceStrategies } from "../research-evidence-assembly.mjs";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";

globalThis.fetch = async () => { throw new Error("No provider/network calls in assembly contracts."); };
const registry = createResearchCorpusRegistry();
const current = registry.find(corpus => corpus.id === "nyc-2022-construction-codes");
const identity = corpus => ({ corpusID: corpus.id, codeVersion: corpus.codeVersion,
  codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction });
const operativeText = "A specific fixture requirement applies in the stated room. Exception: the enclosed alternative configuration is permitted only when the listed conditions are satisfied. The complete closing condition remains attached to this rule.";
const contextText = "Canonical synthetic interpretation context, including its complete closing condition.";
const fixture = (prefix, number = "777.1", extra = {}) => ({ ...identity(current),
  sectionID: `${prefix}-${number}`, codePrefix: prefix, chapterNumber: number.split(".")[0], sectionNumber: number,
  title: "Fixture Rule", text: operativeText, ...extra });
const candidates = [fixture("MC"), fixture("PC"), fixture("BC")].map((source, rank) => ({ ...source,
  rank: rank + 1, evidencePriority: { evidenceRole: "supporting", primaryFunction: "candidate", functions: ["candidate"], claimCoverageRequired: false } }));
async function run({ selected = candidates, pins = [], strategy, limits, contextMutation = {}, question = "Explain the room fixture rule." } = {}) {
  const reads = [];
  const result = await assembleResearchEvidence({ question, pinnedEvidence: pins, strategy, limits,
    discover: async () => ({ candidates: selected }),
    resolveSection: async request => {
      reads.push(structuredClone(request));
      if (request.sectionNumber === "102.1") return fixture(request.codePrefix, "102.1", { title: "General", text: contextText, ...contextMutation });
      return selected.find(source => source.sectionID === request.sectionID) || pins.find(source => source.sectionID === request.sectionID);
    }
  });
  return { result, reads };
}
const broad = await run();
assert.deepEqual(broad.result.sources.filter(source => source.interpretationContext).map(source => source.codePrefix), ["MC", "PC"]);
assert.equal(broad.result.usage.interpretationContextCount, 2);
assert.equal(broad.result.sources.filter(source => source.retrievalDepth === 0).length, 3);
for (const source of broad.result.sources.filter(source => source.interpretationContext)) {
  assert.equal(source.text, contextText);
  assert.equal(source.canonicalContextComplete, true);
  assert.equal(source.optional, true);
  assert.equal(source.evidencePriority.claimCoverageRequired, false);
  assert.equal(source.evidencePriority.evidenceRole, "supporting");
  assert.equal(source.retrievalDepth, 1);
  assert(source.anchorSourceIDs.length > 0);
  assert(source.anchorSectionIDs.length > 0);
}
assert.equal(broad.result.sources[0].text, operativeText);
assert(broad.result.usage.characterCount <= broad.result.limits.maximumCharacters);

for (const [field, value] of Object.entries({ corpusID: "another-corpus", codeVersion: "old-version", codeEdition: "2014", jurisdiction: "Another City", codePrefix: "FC", sectionNumber: "102.2" })) {
  const rejected = await run({ selected: [candidates[0]], contextMutation: { [field]: value } });
  assert.equal(rejected.result.sources.some(source => source.interpretationContext), false, `Canonical ${field} mismatch is rejected before request hints can be filled.`);
  assert.equal(rejected.result.sources[0].text, operativeText);
  assert(rejected.result.limitations.some(limitation => limitation.kind === "optional_interpretation_context_unavailable" && limitation.optional));
}
const missingIdentity = await run({ selected: [candidates[0]], contextMutation: { codeEdition: undefined } });
assert.equal(missingIdentity.result.usage.interpretationContextCount, 0);
assert.equal(missingIdentity.result.sources[0].text, operativeText);

const pin = { ...fixture("MC"), selectedText: "Exact selected rule fragment.", text: "Exact selected rule fragment." };
const strict = await run({ selected: [candidates[0]], pins: [pin], strategy: {
  mode: researchEvidenceStrategies.pinnedFirst, reason: "question_explicitly_bounded_to_selected_evidence"
}, question: "Using only the selected text, explain this rule." });
assert.equal(strict.result.sources.length, 1);
assert.equal(strict.result.sources[0].text, pin.selectedText);
assert.equal(strict.reads.some(request => request.sectionNumber === "102.1"), false);
const nonStrict = await run({ selected: [candidates[0]], pins: [pin], strategy: { mode: researchEvidenceStrategies.pinnedFirst } });
assert.equal(nonStrict.reads.some(request => request.sectionNumber === "102.1"), false);
const authorized = await run({ selected: [candidates[0]], pins: [pin], strategy: { mode: researchEvidenceStrategies.broad } });
assert.equal(authorized.result.sources[0].text, pin.selectedText);
assert.equal(authorized.result.usage.interpretationContextCount, 1);

const noRoom = await run({ selected: [candidates[0]], limits: { maximumCharacters: operativeText.length + 20,
  maximumCharactersPerSource: operativeText.length + 20, maximumSupplementalCharacters: operativeText.length + 20 } });
assert.equal(noRoom.result.sources[0].text, operativeText);
assert.equal(noRoom.result.usage.interpretationContextCount, 0, "Optional context must not displace operative text or be truncated.");
assert(noRoom.result.limitations.some(limitation => limitation.kind === "optional-interpretation-context-budget"));

const component = (number, text, rank) => ({ ...fixture("MC", number), title: "Synthetic component fixture", text, rank });
const fullContext = "Canonical general context. ".repeat(7).trim();
const crowdedCandidates = [component("777.1", "Root fixture.", 1), component("102.1", fullContext, 3),
  ...Array.from({ length: 8 }, (_, index) => component(`777.${index + 2}`, "Short fixture.", index + 4))];
const restored = await assembleResearchEvidence({ question: "Explain the component fixture.",
  limits: { maximumCharacters: 500, maximumCharactersPerSource: 400 },
  discover: async () => ({ candidates: crowdedCandidates }),
  resolveSection: async request => crowdedCandidates.find(source => source.sectionNumber === request.sectionNumber)
});
const restoredContext = restored.sources.find(source => source.sectionNumber === "102.1");
assert.equal(restoredContext.text, fullContext, "A partial existing copy cannot suppress complete optional context recovery.");
assert.equal(restoredContext.canonicalContextComplete, true);
assert.equal(restoredContext.truncated, false);
assert.match(restoredContext.sourceID, /^research-permitext_discovered-/);
assert.equal(restoredContext.origin, "permitext_discovered");
assert.equal(restoredContext.evidencePriority.primaryFunction, "candidate");
assert(restored.usage.characterCount <= 500);

const contextual = await run({ selected: [{ ...candidates[0], signals: { contextualReference: true } }] });
assert.equal(contextual.reads.some(request => request.sectionNumber === "102.1"), false);
const inactiveInherited = await run({ selected: [{ ...candidates[0], signals: { inheritedAuthorityReference: true } }] });
assert.equal(inactiveInherited.reads.some(request => request.sectionNumber === "102.1"), false);
for (const extra of [{ referenceOnly: true }, { selectionMode: "section_reference" }, { title: "Definitions" }]) {
  const referenced = await run({ selected: [{ ...candidates[0], ...extra }] });
  assert.equal(referenced.reads.some(request => request.sectionNumber === "102.1"), false);
}
const pinnedDefinition = await run({ selected: [{ ...candidates[0], title: "Definitions" }], pins: [{ ...pin, title: "Definitions" }],
  strategy: { mode: researchEvidenceStrategies.broad } });
assert.equal(pinnedDefinition.reads.some(request => request.sectionNumber === "102.1"), false,
  "A pinned definition remains required evidence without becoming an operative interpretation anchor.");
for (const codePrefix of ["FC", "ZR"]) {
  const book = registry.find(corpus => corpus.codePrefixes.includes(codePrefix));
  const source = { ...candidates[0], ...identity(book), codePrefix, sectionID: `${codePrefix}-777.1` };
  const unsupported = await run({ selected: [source] });
  assert.equal(unsupported.reads.some(request => request.sectionNumber === "102.1"), false, "Unsupported books cannot borrow same-numbered construction context.");
}
console.log("Interpretation assembly passed: complete optional same-authority context follows operative evidence, with strict boundaries and atomic budget checks.");
