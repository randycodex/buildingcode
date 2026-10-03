import assert from "node:assert/strict";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
const sections = [
  { id: "rule", codePrefix: "FC", sectionNumber: "315", title: "Storage", corpusID: "fire-current", codeVersion: "current-1" },
  { id: "named", codePrefix: "BC", sectionNumber: "999", title: "Other provision", corpusID: "bc-current", codeVersion: "current-1" },
  ...Array.from({ length: 20 }, (_, index) => ({ id: `noise-${index}`, codePrefix: "BC", sectionNumber: `1705.${index}`, title: "Boxes and building maintenance" }))
];
const bodies = new Map(sections.map(section => [section.id, { blocks: [{ id: section.id,
  plainText: section.id === "rule" ? "315.2.3 Equipment rooms\nCombustible material shall not be stored in mechanical rooms."
    : section.id === "named" ? "Named enacted provision shall retain priority when explicitly requested."
    : "Cardboard boxes are used during new building maintenance under the NYC code edition." }] }]));
const index = await buildResearchPassageIndex(sections, async section => bodies.get(section.id));
const actual = index.passages.find(passage => passage.sectionID === "rule");
const semanticSearch = { search: async () => ({ hits: [{ ...actual, score: .9, similarity: .9, exactReference: false }],
  metadata: { enabled: true, queryCached: true, costUSD: 0, fallbackReason: null } }) };
const run = (question, semantic = semanticSearch) => discoverRelevantEvidence({ question, catalog: sections,
  invertedIndex: new Map(), passageIndex: index, semanticSearch: semantic, readSectionBody: async section => bodies.get(section.id), limit: 3 });
const result = await run("May cardboard boxes be kept in a mechanical room?");
assert.equal(result.candidates[0].sectionID, "rule");
assert.equal(result.candidates[0].indexedPassage.sourceTextHash, actual.sourceTextHash);
assert.match(result.candidates[0].selectedText, /shall not be stored/);
assert.equal(result.semanticSearch.queryCached, true);
const named = await run("Explain BC 999; also may cardboard boxes be kept in a mechanical room?");
assert.equal(named.candidates[0].sectionID, "named", "Semantic relevance cannot evict an explicit user reference.");
const fallback = await run("May cardboard boxes be kept in a mechanical room?", { search: async () => ({ hits: [], metadata: { fallbackReason: "semantic_provider_timeout" } }) });
assert(fallback.candidates.length);
assert.equal(fallback.semanticSearch.fallbackReason, "semantic_provider_timeout");
assert.equal(fallback.passageIndexFingerprint, index.fingerprint);

// A named subsection within a monolithic section must keep the same priority
// as a directly cataloged reference, even when fusion favors other sections.
const childSections = [
  { id: "parent", codePrefix: "FC", sectionNumber: "799", title: "Stored materials", codeEdition: "current", corpusID: "fire-current" },
  ...Array.from({ length: 12 }, (_, position) => ({ id: `distractor-${position}`, codePrefix: "FC",
    sectionNumber: String(800 + position), title: "Storage procedures", codeEdition: "current", corpusID: "fire-current" }))
];
const childBodies = new Map(childSections.map(section => [section.id, { blocks: [{ id: section.id,
  plainText: section.id === "parent" ? "799.2 Detailed restriction\nA specific restriction governs the named subsection."
    : "Storage procedures contain unrelated criteria." }] }]));
const childIndex = await buildResearchPassageIndex(childSections, async section => childBodies.get(section.id));
const childSemanticSearch = { search: async () => ({ hits: childIndex.passages.filter(passage => passage.sectionID !== "parent")
  .map(passage => ({ ...passage, score: .9, exactReference: false })), metadata: {} }) };
const childQuestion = "Explain FC 799.2 storage procedures.";
const childOptions = { question: childQuestion, catalog: childSections, invertedIndex: new Map(),
  passageIndex: childIndex, semanticSearch: childSemanticSearch,
  readSectionBody: async section => childBodies.get(section.id), limit: 3 };
const childResult = await discoverRelevantEvidence(childOptions);
assert.equal(childResult.candidates[0].sectionID, "parent", "Hybrid ranking cannot evict the explicitly named child provision");
assert.equal(childResult.candidates[0].signals.exactReference, true);
assert.equal(childResult.candidates[0].indexedPassage.subsectionNumber, "799.2");
assert.equal(childResult.candidates[0].codeEdition, "current");
assert.equal(childResult.candidates[0].corpusID, "fire-current");
const childComparison = await discoverRelevantEvidence({ ...childOptions, retrievalContext: {
  currentQuestion: childQuestion, sourceQuery: childQuestion, relevanceComparison: true
} });
assert.equal(childComparison.candidates[0].sectionID, "parent");
assert.equal(childComparison.candidates[0].signals.contextualReference, true,
  "A child reference used for a relevance comparison retains contextual-reference treatment");
console.log("Hybrid passage discovery passed: ordinary terminology, canonical source locators, direct-reference precedence and usable observable lexical fallback.");
