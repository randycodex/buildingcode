import assert from "node:assert/strict";
import { historicalConstructionSectionCatalog, historicalConstructionSection } from "../historical-construction-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";

// Actual bundled corpus, no model/provider calls or account writes.
const catalog = await historicalConstructionSectionCatalog();
const summary = catalog.find((section) => section.codePrefix === "BC" && section.sectionNumber === "1010.2");
assert(summary);
const body = await historicalConstructionSection(summary.id);
const text = body.blocks.map((block) => block.plainText || "").filter(Boolean).join("\n\n");
assert.match(text, /one unit vertical in 12 units horizontal/i);
const pinned = { ...summary, sectionID: String(summary.id), text, selectedText: text };
const question = "What are the requirements for designing a ramp under the 2022 NYC Building Code?";
async function assemble(pin) {
  const corpusPlan = await researchCorpusPlanForTurn({ question, pinnedEvidence: [pin] });
  assert.deepEqual(corpusPlan.selected.map((corpus) => corpus.id), ["nyc-2022-construction-codes"]);
  assert(corpusPlan.pinnedCorpora.some((corpus) => corpus.id === "nyc-2014-construction-codes"));
  return assembledResearchEvidenceForTurn({ question, messages: [], pinnedEvidence: [pin], originSurface: "reader", projectFacts: [], corpusPlan });
}
const result = await assemble(pinned);
const actual = result.sources.find((source) => source.origin === "user_pinned");
assert(actual);
assert.equal(String(actual.sectionID), String(summary.id));
assert.equal(actual.codeVersion, summary.codeVersion);
assert.match(actual.codeEdition, /2014/);
assert.equal(actual.text, text);
assert.equal(actual.sectionNumber, "1010.2");
const invalid = await assemble({ ...pinned, sectionID: "invalid-exact-2014-section-id", id: "invalid-exact-2014-section-id" });
const unresolved = invalid.sources.find((source) => source.origin === "user_pinned");
// Unresolved selected text can retain its original boundary, but must never
// acquire an unrelated current-edition canonical section's identity.
if (unresolved) {
  assert.equal(unresolved.sectionID, "invalid-exact-2014-section-id");
  assert.equal(unresolved.codeVersion, summary.codeVersion);
  assert.doesNotMatch(unresolved.codeEdition || "", /2022/);
}
assert(invalid.usage.resolverFailureCount > 0);
console.log("Actual-corpus pinned edition identity passed: 2014 selected ramp text retains 2014 identity in a 2022 turn; invalid IDs cannot rebind by section number. Provider calls: zero.");

const { researchAssemblyCrossReferences } = await import("../app.mjs");
const currentVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const mixedCatalog = [
  { id: 2285, codePrefix: "BC", sectionNumber: "1010.2", codeVersion: currentVersion, corpusID: "nyc-2022-construction-codes" },
  { ...summary, corpusID: "nyc-2014-construction-codes" }
];
const references = researchAssemblyCrossReferences({ text: "See Section 1010.2.", codePrefix: "BC", codeVersion: summary.codeVersion, corpusID: "nyc-2014-construction-codes" }, mixedCatalog);
assert(references.length);
assert(references.every((reference) => reference.sectionID === String(summary.id)));
const unavailableReferences = researchAssemblyCrossReferences({ text: "See Section 1010.2.", codePrefix: "BC", codeVersion: summary.codeVersion, corpusID: "nyc-2014-construction-codes" }, mixedCatalog.slice(0, 1));
assert(unavailableReferences.every((reference) => !reference.sectionID));

// The assembly must carry edition identity for inline references too, not just
// catalog-bound references. The resolver double rejects missing/wrong identity.
const { assembleResearchEvidence } = await import("../research-evidence-assembly.mjs");
const requestedReferences = [];
await assembleResearchEvidence({
  question: "Explain this selected provision and its related provisions.",
  pinnedEvidence: [{ sectionID: "source-2014", codePrefix: "BC", sectionNumber: "1010.6.3", codeVersion: summary.codeVersion, corpusID: "nyc-2014-construction-codes", text: "See Section 1010.2." }],
  discover: async () => ({ candidates: [] }),
  resolveSection: async (request) => {
    if (request.sectionID === "source-2014") return { ...request, text: "See Section 1010.2." };
    requestedReferences.push(request);
    assert.equal(request.codeVersion, summary.codeVersion);
    assert.equal(request.corpusID, "nyc-2014-construction-codes");
    return { ...request, sectionID: "target-2014", text: "Referenced historical provision." };
  }
});
assert(requestedReferences.some((reference) => reference.sectionNumber === "1010.2"));
console.log("Cross-edition reference identity passed: catalog links and inline/ancestor expansion retain source edition.");
