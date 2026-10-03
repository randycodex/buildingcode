import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { researchCorpusResources, researchBodyForCatalogSection, validateResearchInterpretation,
  researchInterpretationSchemaForEvidence } from "../app.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { targetedDefinitionExcerpt, researchEmbeddedDefinitionCarrier,
  researchBoundDefinitionPublishedReference, researchSourcePublishedCitationReference,
  researchCommonPublishedCitationReference } from "../research-definition-excerpts.mjs";
import { researchSourceApplicabilityPrompt } from "../research-rule-packets.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = () => { throw Error("Network/provider calls forbidden in published citation contract."); };
process.env.NODE_ENV = "test";
delete process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH;
delete process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH;
const compact = value => String(value).replace(/\s+/g, " ").trim();
const current = createResearchCorpusRegistry({ zoningResearchEligibility: true })
  .find(corpus => corpus.id === "nyc-2022-construction-codes");
const { catalog } = await researchCorpusResources({ selected: [current] });
const canonical = async (number, prefix = "PC") => {
  const summary = catalog.find(section => section.codePrefix === prefix && section.sectionNumber === number);
  assert(summary, `Actual current ${prefix} ${number} must exist.`);
  const body = await researchBodyForCatalogSection(summary);
  return { ...summary, sectionID: String(summary.id), body,
    text: body.blocks.map(block => block.plainText || "").join("\n\n") };
};
const [carrier, operative] = await Promise.all([canonical("201.4"), canonical("416.5")]);
const beforeCarrier = structuredClone(carrier);
const excerpt = targetedDefinitionExcerpt(carrier, "TEMPERED WATER", {
  maximumCharacters: 1000, completeDefinitionLabels: ["TEMPERED WATER"] });
assert(excerpt);
const reference = researchBoundDefinitionPublishedReference(carrier, excerpt, excerpt.text);
assert(reference);
assert.equal(reference.sectionNumber, "202");
assert.equal(reference.title, "General Definitions");
assert.equal(reference.carrierSectionID, carrier.sectionID);
assert.equal(reference.carrierSectionNumber, "201.4");
assert.equal(reference.sourceTextHash, createHash("sha256").update(carrier.body.blocks[0].plainText).digest("hex"));
assert.equal(reference.canonicalEntryBindings[0].label, "TEMPERED WATER");
assert.equal(compact(carrier.body.blocks[0].plainText.slice(reference.canonicalEntryBindings[0].sourceOffsets.start,
  reference.canonicalEntryBindings[0].sourceOffsets.end)), compact(excerpt.passages[0]));

// No catalogue title, cached model number or incomplete entry can establish a
// published reference. Fresh HTML/plain-text heading, full entries and offsets
// must agree within the same canonical authority.
for (const change of [
  value => { value.embeddedDefinitionSection.sectionNumber = "203"; },
  value => { value.embeddedDefinitionSection.heading = "Section PC 203: General Definitions"; },
  value => { value.embeddedDefinitionSection.sourceTextHash = "0".repeat(64); },
  value => { value.embeddedDefinitionSection.sourceOffsets.start++; },
  value => { value.canonicalEntryBindings[0].sourceOffsets.end--; },
  value => { value.canonicalEntryBindings[0].sourceTextHash = "1".repeat(64); },
  value => { value.passages[0] = value.passages[0].split(" between ")[0] + "."; },
  value => { value.labels[0] = "HOT WATER"; },
  value => { value.sectionID = "foreign-carrier"; },
  value => { value.sectionNumber = "202"; },
  value => { value.codeEdition = "2014"; },
  value => { value.codeVersion = "foreign-version"; },
  value => { value.jurisdiction = "Elsewhere"; },
  value => { value.codePrefix = "MC"; }
]) {
  const changed = structuredClone(excerpt); change(changed);
  assert.equal(researchBoundDefinitionPublishedReference(carrier, changed, changed.text), null);
}
for (const field of ["corpusID", "codeVersion", "codeEdition", "jurisdiction", "codePrefix"]) {
  const missing = structuredClone(carrier); delete missing[field];
  assert.equal(researchBoundDefinitionPublishedReference(missing, excerpt, excerpt.text), null);
}
for (const change of [value => { value.truncated = true; }, value => { value.body.truncated = true; },
  value => { value.body.blocks[0].researchClaimEligible = false; },
  value => { value.body.blocks[0].plainText += " Changed canonical body."; },
  value => { value.body.blocks[0].html = "<h6>General Definitions</h6>"; }]) {
  const changed = structuredClone(carrier); change(changed);
  assert.equal(researchBoundDefinitionPublishedReference(changed, excerpt, excerpt.text), null);
}
assert.equal(researchBoundDefinitionPublishedReference(carrier, excerpt, carrier.text), null,
  "A definition heading later in a whole carrier cannot relabel its ordinary opening text.");
assert.equal(researchBoundDefinitionPublishedReference(carrier, excerpt, excerpt.text.slice(0, -1)), null);
assert.deepEqual(carrier, beforeCarrier, "Derivation does not mutate canonical or historical records.");

const mechanicalCarrier = await canonical("201.4", "MC");
const mechanicalExcerpt = targetedDefinitionExcerpt(mechanicalCarrier, "APPLIANCE", {
  maximumCharacters: 3000, completeDefinitionLabels: ["APPLIANCE"] });
assert(mechanicalExcerpt);
const mechanicalReference = researchBoundDefinitionPublishedReference(mechanicalCarrier, mechanicalExcerpt, mechanicalExcerpt.text);
assert(mechanicalReference);
assert.equal(mechanicalReference.codePrefix, "MC");
assert.equal(mechanicalReference.carrierSectionID, mechanicalCarrier.sectionID);
assert.equal(mechanicalReference.sectionNumber, mechanicalExcerpt.embeddedDefinitionSection.sectionNumber);
assert.notEqual(mechanicalReference.sourceTextHash, reference.sourceTextHash,
  "A separate code family binds its own canonical heading/body; no PC heading or ID is substituted.");

const question = "What do we need to prevent scalding at a public restroom lavatory?";
const packet = await assembleResearchEvidence({ question,
  discover: async () => ({ candidates: [operative], supplementalDefinitionCandidates: [{ ...carrier,
    signals: { canonicalEmbeddedDefinitions: researchEmbeddedDefinitionCarrier(carrier) } }] }),
  resolveSection: async request => [carrier, operative].find(section => section.sectionID === request.sectionID) || null });
const definitionSource = packet.sources.find(source => source.targetedDefinition);
assert(definitionSource?.publishedCitationReference);
assert.equal(definitionSource.sectionNumber, "201.4", "Assembly retains the immutable carrier number.");
assert.equal(definitionSource.title, carrier.title);
assert.equal(definitionSource.sectionID, carrier.sectionID);
assert.equal(researchSourcePublishedCitationReference(definitionSource).sectionNumber, "202");
assert(packet.sources.some(source => source.sectionNumber === "416.5" && !source.publishedCitationReference));
assert.match(packet.sources.find(source => source.sectionNumber === "416.5").text, /customers, patrons and visitors/,
  "The original operative scope and exception are unchanged.");

const input = (sources = [definitionSource]) => ({
  answerText: "The supplied complete tempered-water definition establishes its stated temperature range (PC 202).",
  supportedPoints: [{ heading: "Definition", explanation: "Only the supplied complete definition is bound by this fixture.",
    sectionID: carrier.sectionID, sourceIDs: sources.map(source => source.sourceID) }],
  citations: [{ sectionID: carrier.sectionID, sourceIDs: sources.map(source => source.sourceID), relevance: "Supplies the exact definition." }],
  assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: []
});
const raw = input();
const storedBefore = structuredClone(raw);
const sourceBefore = structuredClone(definitionSource);
const normalized = validateResearchInterpretation(raw, packet.sources);
const citation = normalized.citations[0];
assert.equal(citation.sectionNumber, "202");
assert.equal(citation.title, "General Definitions");
assert.equal(citation.carrierSectionNumber, "201.4");
assert.equal(citation.carrierTitle, carrier.title);
assert.equal(citation.sectionID, carrier.sectionID);
assert.deepEqual(citation.sourceIDs, [definitionSource.sourceID]);
assert.deepEqual(citation.publishedCitationReference.sourceBindings[0].canonicalEntryBindings,
  definitionSource.publishedCitationReference.canonicalEntryBindings);
assert.deepEqual(citation.supportingPassages[0].publishedCitationReference, definitionSource.publishedCitationReference);
assert.equal(citation.supportingPassages[0].selectedText, definitionSource.text);
for (const field of ["codeVersion", "codeEdition", "corpusID"]) assert.equal(citation[field], definitionSource[field]);
assert.deepEqual(raw, storedBefore, "Normalization never relabels an existing stored answer in place.");
assert.deepEqual(definitionSource, sourceBefore);

// Mixed citations retain the carrier display instead of pretending that the
// carrier's non-definition paragraph occurs in its embedded published chapter.
const ordinaryText = carrier.body.blocks[0].plainText.slice(0, reference.sourceOffsets.start).trim();
const ordinary = { ...definitionSource, sourceID: "ordinary-carrier-text", text: ordinaryText,
  targetedDefinition: null, canonicalContextComplete: false };
delete ordinary.publishedCitationReference;
assert.equal(researchSourcePublishedCitationReference(ordinary), null);
const ordinaryCitation = validateResearchInterpretation(input([ordinary]), [ordinary, definitionSource]).citations[0];
assert.equal(ordinaryCitation.sectionNumber, "201.4");
assert.equal(ordinaryCitation.title, carrier.title);
assert.equal(ordinaryCitation.publishedCitationReference, undefined);
const mixed = validateResearchInterpretation(input([ordinary, definitionSource]), [ordinary, definitionSource]).citations[0];
assert.equal(mixed.sectionNumber, "201.4");
assert.equal(mixed.publishedCitationReference, undefined);
assert.equal(mixed.supportingPassages[0].publishedCitationReference, undefined);
assert.equal(mixed.supportingPassages[1].publishedCitationReference.sectionNumber, "202");
assert.equal(researchCommonPublishedCitationReference([ordinary, definitionSource]), null);

const secondExcerpt = targetedDefinitionExcerpt(carrier, "WATER HEATER", {
  maximumCharacters: 1000, completeDefinitionLabels: ["WATER HEATER"] });
const { text: secondText, ...secondMetadata } = secondExcerpt;
const secondDefinitionSource = { ...definitionSource, sourceID: "second-definition-passage", text: secondText,
  targetedDefinition: secondMetadata,
  publishedCitationReference: researchBoundDefinitionPublishedReference(carrier, secondExcerpt, secondText) };
const combined = validateResearchInterpretation(input([definitionSource, secondDefinitionSource]),
  [ordinary, definitionSource, secondDefinitionSource]).citations[0];
assert.equal(combined.sectionNumber, "202");
assert.equal(combined.publishedCitationReference.sourceBindings.length, 2);
assert.deepEqual(combined.publishedCitationReference.sourceBindings.map(binding => binding.sourceID),
  [definitionSource.sourceID, secondDefinitionSource.sourceID]);
assert.equal(combined.supportingPassages[1].selectedText, secondText);
assert.equal(combined.supportingPassages[1].publishedCitationReference.canonicalEntryBindings[0].label, "WATER HEATER");
const priorEditionCarrier = { ...ordinary, codeEdition: "2014", codeVersion: "prior-version" };
const actualBoundEdition = validateResearchInterpretation(input(), [priorEditionCarrier, definitionSource]).citations[0];
assert.equal(actualBoundEdition.codeVersion, definitionSource.codeVersion,
  "Published display and edition derive from the actually cited passage, not an earlier array entry for that carrier.");
for (const source of [ordinary, definitionSource]) {
  const noID = { ...source }; delete noID.sourceID;
  assert.equal(researchSourcePublishedCitationReference(noID), null);
  const fallbackInput = input([{ sourceID: `section-${carrier.sectionID}` }]);
  const fallbackCitation = validateResearchInterpretation(fallbackInput, [noID]).citations[0];
  assert.equal(fallbackCitation.sectionNumber, "201.4",
    "Legacy missing-sourceID fallback cannot promote an entire carrier or manufacture a published source binding.");
}

for (const change of [source => { source.text += " Changed passage."; }, source => { source.truncated = true; },
  source => { source.canonicalContextResolved = false; }, source => { source.sectionID = "other"; },
  source => { source.sectionNumber = "202"; }, source => { source.title = "Other"; },
  source => { source.corpusID = "other-corpus"; }, source => { source.codeEdition = "2014"; },
  source => { source.codeVersion = "old"; }, source => { source.codePrefix = "MC"; },
  source => { source.jurisdiction = "Elsewhere"; }, source => { source.publishedCitationReference.sectionNumber = "203"; },
  source => { source.publishedCitationReference.title = "Another heading"; },
  source => { source.targetedDefinition.labels[0] = "Other term"; },
  source => { source.targetedDefinition.codeVersion = "old"; }]) {
  const changed = structuredClone(definitionSource); change(changed);
  assert.equal(researchSourcePublishedCitationReference(changed), null);
  assert.equal(researchCommonPublishedCitationReference([definitionSource, changed]), null);
}
const copied = { ...ordinary, publishedCitationReference: definitionSource.publishedCitationReference };
assert.equal(researchSourcePublishedCitationReference(copied), null);
const schema = researchInterpretationSchemaForEvidence(packet.sources).properties.citations.items;
assert.equal(schema.additionalProperties, false);
assert.deepEqual(Object.keys(schema.properties).sort(), ["relevance", "sectionID", "sourceIDs"]);
assert(schema.properties.sectionID.enum.includes(carrier.sectionID));
assert(!schema.properties.sectionID.enum.includes("202"));
const forgedModel = input();
Object.assign(forgedModel.citations[0], { sectionNumber: "999", title: "Model invention", publishedCitationReference: { sectionNumber: "999" } });
assert.equal(validateResearchInterpretation(forgedModel, packet.sources).citations[0].sectionNumber, "202",
  "Normalization derives the reference from evidence, never model metadata.");
const wrongID = input(); wrongID.citations[0].sourceIDs = ["unknown-source"];
assert.throws(() => validateResearchInterpretation(wrongID, packet.sources), error => error.code === "INVALID_RESEARCH_CITATION");
const wrongCarrier = input(); wrongCarrier.citations[0].sectionID = operative.sectionID;
assert.throws(() => validateResearchInterpretation(wrongCarrier, packet.sources), error => error.code === "INVALID_RESEARCH_CITATION");
const irrelevant = { ...definitionSource, evidencePriority: { evidenceRole: "irrelevant" } };
assert.throws(() => validateResearchInterpretation(input(), [irrelevant]), error => error.code === "INVALID_RESEARCH_CITATION");

// Both real prompt builders receive the same server-owned distinction; normal
// source/semantic review remains responsible for all legal claims and numbers.
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
for (const request of [buildAnswerRequest(question, packet.sources, "offline-citation"),
  buildVerifierRequest(question, packet.sources, normalized, "offline-citation")]) {
  const line = request.input.split("\n").find(line => line.startsWith("PUBLISHED_CITATION_REFERENCE: "));
  assert.deepEqual(JSON.parse(line.slice("PUBLISHED_CITATION_REFERENCE: ".length)), definitionSource.publishedCitationReference);
  assert(request.input.includes(`SECTION_ID: ${carrier.sectionID}`));
  assert(request.input.includes("SECTION: PC 201.4") || request.input.includes("SECTION: 201.4"));
  assert.match(request.instructions, /carrier SECTION\/TITLE remain immutable storage identifiers/);
  assert.match(request.instructions, /does not establish rule applicability or excuse a wrong scope/);
  assert(request.input.includes(definitionSource.text));
}
assert(!researchSourceApplicabilityPrompt(ordinary).includes("PUBLISHED_CITATION_REFERENCE"));
const badClaim = input();
badClaim.answerText = "All public restroom lavatories may deliver tempered water up to 210°F without the stated device.";
const badNormalized = validateResearchInterpretation(badClaim, packet.sources);
assert.equal(badNormalized.answerText, badClaim.answerText,
  "Identity normalization must not silently repair or certify a false numeric or applicability claim.");
const badReview = buildVerifierRequest(question, packet.sources, badNormalized, "offline-citation");
assert(badReview.input.includes(badClaim.answerText));
assert(badReview.input.includes("110°F (43°C)"));
assert(badReview.input.includes("customers, patrons and visitors"));
assert(badReview.input.includes("ASSE 1070"));
assert.match(badReview.instructions, /does not establish rule applicability or excuse a wrong scope/);

console.log("Published citation identity contract passed: fresh enacted heading/full entry/hash/offset binding, same writer/verifier metadata, immutable carrier IDs, server-owned display, mixed/ordinary/foreign/stale/truncated negatives and unchanged citation schema.");
