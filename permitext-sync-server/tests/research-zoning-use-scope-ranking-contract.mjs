import assert from "node:assert/strict";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = "1";
// Identical synthetic operative text isolates the prior supplied by published
// chapter subjects. These entries do not encode an actual zoning answer.
const catalog = [
  { id: "nonresidential", sectionNumber: "33-99", chapterTitle: "Bulk Regulations for Commercial or Community Facility Buildings in Commercial Districts" },
  { id: "residential", sectionNumber: "34-99", chapterTitle: "Bulk Regulations for Residential Buildings in Commercial Districts" },
  { id: "mixed", sectionNumber: "35-99", chapterTitle: "Bulk Regulations for Mixed Buildings in Commercial Districts" }
].map(section => ({ ...section, codePrefix: "ZR", title: "Yard Provisions", headerLine: "ARTICLE III — Commercial District Regulations" }));
const body = section => ({ blocks: [{ id: `${section.id}-rule`, plainText: "A required yard is subject to the stated building conditions and exceptions. Review the complete yard provisions before selecting the applicable requirement." }] });
const index = await buildResearchPassageIndex(catalog, async section => body(section));
const semantic = { search: async () => ({ hits: [...index.passages].reverse().map(passage => ({ ...passage, sectionID: passage.sectionID, score: 1 })), metadata: {} }) };
const neutral = "In C4-2, explain the yard provisions and building conditions.";
const legacy = `${neutral}\nPrevious subject: mixed-use residential and commercial building.`;
const discover = (currentQuestion, sourceQuery = neutral, search = semantic) => discoverRelevantEvidence({
  question: sourceQuery, retrievalContext: { currentQuestion, sourceQuery }, catalog, invertedIndex: new Map(),
  passageIndex: index, semanticSearch: search, readSectionBody: async section => body(section), availableCodePrefixes: ["ZR"], limit: 3
});
const ids = result => result.candidates.map(candidate => candidate.sectionID);
for (const search of [semantic, null, { search: async () => ({ hits: [], metadata: { fallbackReason: "semantic_provider_timeout" } }) }]) {
  assert.equal(ids(await discover("In C4-2, this is a mixed-use residential and commercial building.", neutral, search))[0], "mixed");
  assert.equal(ids(await discover("Correction: it is no longer mixed-use; it is entirely commercial.", legacy, search))[0], "nonresidential");
  assert.equal(ids(await discover("Correction: it is not mixed; it is residential-only.", legacy, search))[0], "residential");
  assert.equal(ids(await discover("The building is entirely residential.", legacy, search))[0], "residential");
  const neutralPrior = ids(await discover("Explain the yard provisions.", neutral, search));
  for (const current of [
    "It is not mixed-use. Explain the yard provisions.",
    "It is not entirely commercial. Explain the yard provisions.",
    "Compare mixed and residential-only buildings.",
    "It might be mixed-use; that has not been decided.",
    "Is this a mixed-use building?"
  ]) {
    assert.deepEqual(ids(await discover(current, neutral, search)), neutralPrior,
      "A negated, uncertain or comparative current scenario must not choose a chapter category.");
    // The lexical subject remains identical, so this checks that deliberate
    // uncertainty suppresses a stale category instead of falling back to it.
    const staleSuppressed = await discover(current, legacy, search);
    const neutralSuppressed = await discover("Compare the chapter frameworks.", legacy, search);
    assert.deepEqual(ids(staleSuppressed), ids(neutralSuppressed));
  }
  const exact = await discover("For this mixed-use building, explain ZR 33-99.", `${neutral}\nZR 33-99`, search);
  assert.equal(ids(exact)[0], "nonresidential", "A direct citation retains priority even when the weak chapter prior differs.");
  assert.equal(exact.candidates[0].signals.exactReference, true);
  assert.equal(ids(await discover("This is a mixed-use residential and commercial building.", neutral, search)).length, 3,
    "Alternative chapter frameworks remain available for applicability and exception review.");
}
console.log("Zoning use scope ranking passed: bounded chapter priors respect current corrections, uncertainty and direct citations without filtering alternatives.");
