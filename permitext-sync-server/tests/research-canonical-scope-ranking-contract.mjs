import assert from "node:assert/strict";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = "1";
const catalog = [
  { id: "commercial", codePrefix: "ZR", sectionNumber: "36-65", title: "Joint Loading Berths Serving Two or More Buildings",
    headerLine: "ARTICLE III — Commercial District Regulations", headingLine: "Article III, Chapter 6 — Accessory Off-Street Parking and Loading Regulations" },
  { id: "manufacturing", codePrefix: "ZR", sectionNumber: "44-55", title: "Joint Loading Berths Serving Two or More Buildings",
    headerLine: "ARTICLE IV — Manufacturing District Regulations", headingLine: "Article IV, Chapter 4 — Accessory Off-Street Parking and Loading Regulations" },
  { id: "special", codePrefix: "ZR", sectionNumber: "144-53", title: "Loading Berths",
    headerLine: "ARTICLE XIV — Special Purpose Districts", headingLine: "Article XIV, Chapter 4 — Special Brooklyn Navy Yard District (BNY)" }
];
const body = section => ({ blocks: [{ id: `${section.id}-rule`, plainText: "Loading berths may serve two or more buildings with a shared facility and direct access." }] });
const index = await buildResearchPassageIndex(catalog, async section => body(section));
const semanticSearch = { search: async () => ({ hits: [...index.passages].reverse().map(passage => ({ ...passage, sectionID: passage.sectionID, score: 1 })), metadata: {} }) };
const discover = (question, context = null, semantic = semanticSearch) => discoverRelevantEvidence({ question, retrievalContext: context, catalog,
  invertedIndex: new Map(), passageIndex: index,
  semanticSearch: semantic,
  readSectionBody: async section => body(section), availableCodePrefixes: ["ZR"], limit: 3 });
const ids = result => result.candidates.map(candidate => candidate.sectionID);
assert.equal(ids(await discover("In a C4-2 district, may loading berths serve two buildings through a shared facility?"))[0], "commercial");
assert.equal(ids(await discover("In an M2 district, may loading berths serve two buildings through a shared facility?"))[0], "manufacturing");
assert.equal(ids(await discover("In the Special Brooklyn Navy Yard District, explain ZR 144-53 loading berths."))[0], "special",
  "An explicitly requested special-district provision retains exact-reference priority.");
const followup = "For C4-2, can loading berths serve two buildings through a shared facility?";
const inherited = await discover(`${followup}\nPreviously discussed provisions: ZR 144-53`, {
  currentQuestion: followup, sourceQuery: `${followup}\nPreviously discussed provisions: ZR 144-53`,
  inheritedAuthorityReferences: [{ codePrefix: "ZR", sectionNumber: "144-53" }]
});
assert.equal(ids(inherited)[0], "commercial", "Inherited citations are hints, not current-user exact-reference priority.");
const inheritedSource = inherited.candidates.find(candidate => candidate.sectionID === "special");
assert.equal(inheritedSource.signals.inheritedAuthorityReference, true);
assert.equal(inheritedSource.signals.exactReference, false);
assert.equal(inheritedSource.signals.contextualReference, false,
  "Demoting a retrieval hint must not prohibit its canonical text from supporting a later relevant conclusion.");
const explicit = "For C4-2, explain whether ZR 144-53 applies to shared loading berths.";
assert.equal(ids(await discover(explicit, { currentQuestion: explicit, sourceQuery: explicit }))[0], "special");
assert(ids(inherited).includes("special"), "Scope ranking must retain cross-chapter candidates for source review.");
for (const [label, semantic] of [
  ["disabled", null],
  ["hosted fallback", { search: async () => ({ hits: [], metadata: { fallbackReason: "semantic_production_spend_integration_required" } }) }],
  ["provider fallback", { search: async () => ({ hits: [], metadata: { fallbackReason: "semantic_provider_timeout" } }) }]
]) {
  const context = {
    currentQuestion: followup, sourceQuery: `${followup}\nPreviously discussed provisions: ZR 144-53`,
    inheritedAuthorityReferences: [{ codePrefix: "ZR", sectionNumber: "144-53" }]
  };
  const result = await discover(context.sourceQuery, context, semantic);
  assert.equal(ids(result)[0], "commercial", `${label}: inherited passage citations must not retain a hidden lexical exact-reference boost.`);
  const reference = result.candidates.find(candidate => candidate.sectionID === "special");
  assert(reference, `${label}: inherited canonical text remains available for applicability review.`);
  assert.equal(reference.signals.inheritedAuthorityReference, true);
  assert.equal(reference.signals.exactReference, false);
  assert.equal(reference.signals.contextualReference, false);
  assert.equal(ids(await discover(explicit, { currentQuestion: explicit, sourceQuery: explicit }, semantic))[0], "special",
    `${label}: a direct current-user citation retains exact-reference priority.`);
  for (const [currentDistrict, previousDistrict, expected] of [
    ["M2", "C4-2", "manufacturing"], ["C4-2", "M2", "commercial"]
  ]) {
    const currentQuestion = `For ${currentDistrict}, can loading berths serve two buildings through a shared facility?`;
    const sourceQuery = `${currentQuestion}\nPrevious subject: In a ${previousDistrict} district, shared loading berths.`;
    assert.equal(ids(await discover(sourceQuery, { currentQuestion, sourceQuery }, semantic))[0], expected,
      `${label}: the current explicit district must supersede a stale previous district for chapter ranking.`);
  }
}
console.log("Canonical scope ranking passed: district chapters and direct references outrank inherited unrelated citations without excluding cross-references.");
