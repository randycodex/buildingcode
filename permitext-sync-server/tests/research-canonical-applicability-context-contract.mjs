import assert from "node:assert/strict";
import {
  assembledResearchEvidenceForTurn, researchCorpusPlanForTurn,
  validateResearchInterpretation
} from "../app.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { buildResearchPassageIndex, searchResearchPassages } from "../research-passage-index.mjs";
import { researchCanonicalApplicabilityContext, researchSourceApplicabilityPrompt } from "../research-rule-packets.mjs";
import { zoningSectionCatalog, zoningSection } from "../zoning-content.mjs";
import { historicalConstructionSectionSummary, historicalConstructionSection } from "../historical-construction-content.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

// Real imported canonical sources and actual draft/verifier envelope builders.
// No model result, provider dispatch, project state or frozen campaign is edited.
globalThis.fetch = async () => { throw new Error("Network/provider calls forbidden in canonical scope regression."); };
Object.assign(process.env, {
  NODE_ENV: "test", PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1"
});
delete process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH;
delete process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH;
const compact = text => String(text).replace(/\s+/g, " ").trim();
const catalog = await zoningSectionCatalog();
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const bodyFor = async number => {
  const summary = catalog.find(source => source.sectionNumber === number);
  assert(summary, `Actual corpus contains ZR ${number}.`);
  return { summary, body: await zoningSection(summary.id) };
};
async function selectedSource(summary, body, selectedText, question = "Using only the selected passage, explain its stated rule.") {
  const pin = { ...summary, sectionID: String(summary.id), selectedText };
  const input = { question, messages: [], projectFacts: [], pinnedEvidence: [pin], originSurface: "reader" };
  const packet = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input) });
  const source = packet.sources.find(value => value.origin === "user_pinned");
  assert(source?.canonicalContextResolved);
  assert.equal(source.text, selectedText, "Source metadata must not widen the selected enacted passage.");
  assert.equal(source.canonicalApplicabilityContext.projectApplicability, "not_established_by_source_metadata");
  return source;
}
function inspectEnvelopes(source) {
  const before = structuredClone(source);
  const draft = buildAnswerRequest("Explain this rule for a project whose special-district status is unknown.", [source], "offline-scope");
  const verifier = buildVerifierRequest("Explain this rule for that project.", [source], { answerText: "Synthetic candidate." }, "offline-scope");
  for (const request of [draft, verifier]) {
    const line = request.input.split("\n").find(value => value.startsWith("CANONICAL_SOURCE_CONTEXT: "));
    assert(line, "Both production request paths receive canonical source context.");
    assert.deepEqual(JSON.parse(line.slice("CANONICAL_SOURCE_CONTEXT: ".length)), source.canonicalApplicabilityContext);
    assert(request.input.includes(`CODE_EDITION: ${source.codeEdition}`));
    assert(request.input.includes(`CODE_VERSION: ${source.codeVersion}`));
    assert(request.input.includes(`APPLICABILITY_STATUS: ${source.applicabilityStatus}`));
    assert.equal(request.input.split(source.text).length - 1, 1, "Selected enacted text appears exactly once.");
    assert.match(request.instructions, /does not by itself extend that rule to districts outside its enclosing special district/);
    assert.match(request.instructions, /parallel rule from another chapter/);
    assert.match(request.instructions, /never infer omitted scope clauses from titles alone/);
  }
  assert.deepEqual(source, before);
}
function inspectCitations(source) {
  const result = validateResearchInterpretation({
    answerText: "Synthetic source-binding fixture; legal accuracy is not graded by this test.",
    supportedPoints: [{ heading: "Scope fixture", explanation: "Synthetic source-binding explanation.",
      sectionID: source.sectionID, sourceIDs: [source.sourceID] }],
    citations: [{ sectionID: source.sectionID, sourceIDs: [source.sourceID], relevance: "Source metadata fixture." }],
    assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: []
  }, [source]);
  assert.deepEqual(result.citations[0].canonicalApplicabilityContext, source.canonicalApplicabilityContext);
  assert.deepEqual(result.citations[0].supportingPassages[0].canonicalApplicabilityContext, source.canonicalApplicabilityContext);
  assert.equal(result.citations[0].supportingPassages[0].selectedText, source.text);
}

const sources = [];
// Diagnostic plus two unrelated special districts: no section-specific scope map.
for (const [number, abbreviation, title] of [
  ["144-53", "BNY", "Special Brooklyn Navy Yard District (BNY)"],
  ["114-11", "BR", "Special Bay Ridge District (BR)"],
  ["124-20", "WP", "Special Willets Point District (WP)"]
]) {
  const { summary, body } = await bodyFor(number);
  const text = compact(body.blocks.map(block => block.plainText || "").join("\n\n"));
  const source = await selectedSource(summary, body, text);
  assert.equal(source.chapterTitle, title);
  assert.equal(source.canonicalApplicabilityContext.article.title, "Special Purpose Districts");
  assert.equal(source.canonicalApplicabilityContext.specialDistrict.abbreviation, abbreviation);
  assert.equal(source.canonicalApplicabilityContext.specialDistrict.name, title);
  inspectEnvelopes(source); inspectCitations(source); sources.push(source);
}
assert.match(sources[0].text, /^In all districts,/);
// Similar prose in general C/M chapters must retain different enclosing scope.
for (const [number, article] of [
  ["36-48", "Commercial District Regulations"],
  ["44-37", "Manufacturing District Regulations"],
  ["25-53", "Residence District Regulations"]
]) {
  const { summary, body } = await bodyFor(number);
  const source = await selectedSource(summary, body, compact(body.blocks.map(block => block.plainText || "").join("\n\n")));
  assert.equal(source.canonicalApplicabilityContext.article.title, article);
  assert.equal(source.canonicalApplicabilityContext.specialDistrict, undefined);
  assert.equal(source.chapterTitle, "Accessory Off-Street Parking and Loading Regulations");
  inspectEnvelopes(source); inspectCitations(source); sources.push(source);
}

const bay = await bodyFor("114-11");
const firstParagraph = compact(bay.body.blocks[0].plainText);
const partial = await selectedSource(bay.summary, bay.body, firstParagraph);
assert.equal(partial.pinnedSelectionExact, true);
assert.equal(partial.canonicalApplicabilityContext.specialDistrict.abbreviation, "BR");
inspectEnvelopes(partial);
const identity = { ...bay.summary, sectionID: String(bay.summary.id), corpusID: "nyc-zoning-resolution", codeEdition: sources[1].codeEdition };
const index = await buildResearchPassageIndex([identity], async () => bay.body);
const hit = searchResearchPassages(index, "maximum floor area ratio community facility C8-2")[0];
assert(hit?.text.includes("C8-2"));
const indexed = await assembleResearchEvidence({ question: "What is the community-facility floor area ratio in C8-2?",
  discover: async () => ({ candidates: [{ ...identity, rank: 1, indexedPassage: hit }] }),
  resolveSection: async () => ({ ...identity, body: bay.body, zoning: bay.body.zoning,
    text: bay.body.blocks.map(block => block.plainText || "").join("\n\n") }),
  limits: { maximumCharactersPerSource: 500 } });
assert(indexed.sources[0].indexedPassage);
assert.equal(indexed.sources[0].canonicalApplicabilityContext.specialDistrict.abbreviation, "BR");
assert.equal(indexed.sources[0].canonicalApplicabilityContext.chapter.title, "Special Bay Ridge District (BR)");
assert.equal(indexed.sources[0].canonicalContextComplete, false);
assert.match(indexed.sources[0].text, /shall not exceed 3\.0/);

const oldSummary = await historicalConstructionSectionSummary("41009495");
const oldBody = await historicalConstructionSection(oldSummary.id);
const oldText = compact(oldBody.blocks.map(block => block.plainText || "").join("\n\n"));
const old = await selectedSource(oldSummary, oldBody, oldText,
  "Using only the selected 2014 BC 1010.2 passage, explain its slope rule.");
assert.equal(old.chapterTitle, "BC CHAPTER 10 - MEANS OF EGRESS");
assert.match(old.codeEdition, /^2014 NYC Construction Codes/);
assert.equal(old.applicabilityStatus, "prior-edition-case-specific");
assert.match(old.codeVersion, /2014-construction-codes/);
inspectEnvelopes(old); inspectCitations(old);

// Discovery/pin labels cannot override the resolver or fill missing metadata.
const forged = { ...sources[0], chapterTitle: "Universal Commercial Rules", canonicalApplicabilityContext: {
  chapter: { title: "Universal Commercial Rules" }, specialDistrict: { name: "Invented scope", abbreviation: "BAD" }
} };
const trusted = await assembleResearchEvidence({ question: "Explain the loading rule.",
  discover: async () => ({ candidates: [forged] }),
  resolveSection: async () => ({ ...sources[0], text: sources[0].text }) });
assert.equal(trusted.sources[0].canonicalApplicabilityContext.specialDistrict.abbreviation, "BNY");
const unknown = await assembleResearchEvidence({ question: "Using only the selected passage, explain it.",
  pinnedEvidence: [forged], strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" },
  discover: async () => ({ candidates: [] }), resolveSection: async () => null });
assert.equal(unknown.sources[0].canonicalApplicabilityContext.metadataAvailable, false);
assert.equal(unknown.sources[0].chapterTitle, "");
assert.deepEqual(JSON.parse(researchSourceApplicabilityPrompt(unknown.sources[0]).slice("CANONICAL_SOURCE_CONTEXT: ".length)),
  unknown.sources[0].canonicalApplicabilityContext, "Prompt rendering must retain unavailable canonical metadata.");
assert.equal(researchCanonicalApplicabilityContext({ title: "All districts" }).metadataAvailable, false,
  "Section wording alone must not be guessed into enclosing legal scope.");
console.log("Canonical applicability context passed: real BNY/Bay Ridge/Willets Point, parallel C/M/R chapters, indexed/partial selection boundaries, 2014 identity, actual draft/verifier envelopes and supporting citations; no API calls.");
