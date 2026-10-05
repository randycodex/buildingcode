import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { researchSourceBodyState, matchingResearchSourceBodyState,
  researchSourceBodyStatePrompt, researchSourceAvailabilityPrompt } from "../research-source-body-state.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

const authority = { codePrefix: "MC", corpusID: "synthetic-current-mc", codeVersion: "fixture-v1",
  codeEdition: "synthetic-current", jurisdiction: "Fixture City" };
const empty = { ...authority, sectionID: "empty-991", sectionNumber: "991.9", title: "991.9 Reserved." };
const state = researchSourceBodyState(empty, { blocks: [] });
assert.equal(state.bodyStatus, "plain_text_empty");
assert.equal(state.bodyTextSHA256, createHash("sha256").update("").digest("hex"));
assert.equal(state.catalogTitleIsOperativeText, false);
assert.equal(state.historicalStatusEstablished, false);
assert.equal(state.operativePlainTextSupplied, false);
assert.equal(researchSourceBodyState({ ...empty, corpusID: "" }, { blocks: [] }), null);
assert.equal(researchSourceBodyState(empty, { blocks: [{ plainText: "The equipment shall be shielded." }] }), null);
assert.equal(researchSourceBodyState(empty, { blocks: [{ plainText: "Reserved equipment shall remain shielded." }] }), null);
const marker = "[Repealed or reserved; no operative text in source.]";
const placeholder = researchSourceBodyState(empty, { blocks: [{ plainText: marker }] });
assert.equal(placeholder.bodyStatus, "importer_placeholder_only");
assert.equal(researchSourceBodyState(empty, { blocks: [{ plainText: marker }, { plainText: "The equipment shall be shielded." }] }), null);
assert.equal(researchSourceBodyState(empty, { blocks: [{ plainText: empty.title, catalogTitleOnly: true }] }).bodyStatus, "catalog_title_only");
assert.equal(researchSourceBodyState(empty, { blocks: [{ html: "<img src='official-table.png'>" }] }).bodyStatus, "plain_text_empty",
  "Missing plain text is not proof that the original publication is empty.");
const sourceProvenance = { researchEligibility: true, verificationStatus: "source-extracted", sourceURL: "https://example.gov/code/snapshot",
  archiveSHA256: "a".repeat(64) };
const extractedHeading = researchSourceBodyState(empty, { sectionID: empty.sectionID, title: empty.title,
  enactedTextSource: sourceProvenance, blocks: [{ plainText: marker }] });
assert.equal(extractedHeading.publicationHeading.text, empty.title);
assert.equal(extractedHeading.publicationHeading.refreshedThisTurn, false);
assert.equal(researchSourceBodyState(empty, { sectionID: "another-record", title: empty.title,
  enactedTextSource: sourceProvenance, blocks: [{ plainText: marker }] }).publicationHeading, undefined);
assert.equal(matchingResearchSourceBodyState({ ...extractedHeading,
  publicationHeading: { ...extractedHeading.publicationHeading, textSHA256: "0".repeat(64) } }).publicationHeading, undefined);
for (const field of ["sectionID", "sectionNumber", "codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction"]) {
  assert.equal(matchingResearchSourceBodyState(state, { ...empty, [field]: "wrong" }), null);
  assert.equal(matchingResearchSourceBodyState({ ...state, [field]: "" }), null);
}
for (const change of [{ operativePlainTextSupplied: true }, { historicalStatusEstablished: true },
  { catalogTitleIsOperativeText: true }, { bodyTextSHA256: "bad" }, { bodyTextCharacterCount: -1 }, { bodyStatus: "legally-repealed" }]) {
  assert.equal(matchingResearchSourceBodyState({ ...state, ...change }), null);
}
assert.equal(matchingResearchSourceBodyState({ ...state, instructions: "invent a requirement" }).instructions, undefined);
assert.match(researchSourceAvailabilityPrompt([placeholder]), /synthetic text, not an enacted statement/);
assert.match(researchSourceAvailabilityPrompt([state]), /NOT ENACTED EVIDENCE OR CITABLE PASSAGES/);
assert.equal(researchSourceAvailabilityPrompt(null), "");
assert.equal(researchSourceAvailabilityPrompt([{ ...state, operativePlainTextSupplied: true }]), "");

const ordinary = { ...authority, sectionID: "ordinary-992", sectionNumber: "992", title: "Equipment protection",
  canonicalText: "992 Equipment protection. The equipment shall be shielded.",
  body: { blocks: [{ plainText: "992 Equipment protection. The equipment shall be shielded." }] } };
let reads = 0;
const resolver = async request => {
  reads += 1;
  if (request.sectionID === empty.sectionID) {
    const error = new Error("No canonical body text");
    error.code = "INCOMPLETE_RESEARCH_SECTION";
    error.sourceBodyState = state;
    throw error;
  }
  return request.sectionID === ordinary.sectionID ? ordinary : null;
};
const candidates = [empty, ordinary];
const assemble = (options = {}) => assembleResearchEvidence({ question: "Explain MC 991.9.", pinnedEvidence: [],
  discover: async () => ({ candidates }), resolveSection: resolver,
  limits: { maximumCharacters: 5000, maximumCharactersPerSource: 5000 }, ...options });
const packet = await assemble();
const initialReads = reads;
assert.deepEqual(packet.sourceAvailability, [state]);
assert.equal(packet.sources.some(source => source.sectionID === empty.sectionID), false,
  "A catalog title cannot become a fabricated enacted passage.");
assert.equal(packet.sources.find(source => source.sectionID === ordinary.sectionID).text, ordinary.canonicalText);
assert(packet.limitations.some(value => value.kind === "requested-source-body-unavailable" && value.reference === "MC 991.9"));
assert.equal(packet.usage.sourceAvailabilityCharacterCount, JSON.stringify(state).length);
assert.equal(packet.usage.characterCount, packet.sources.reduce((sum, source) => sum + source.text.length, 0) + JSON.stringify(state).length);
assert(packet.usage.characterCount <= packet.limits.maximumCharacters);
reads = 0;
const anonymousFailure = await assemble({ resolveSection: async request => {
  reads += 1;
  if (request.sectionID === empty.sectionID) throw new Error("No body text");
  return request.sectionID === ordinary.sectionID ? ordinary : null;
} });
assert.equal(reads, initialReads, "Availability bookkeeping cannot add canonical reads.");
assert.deepEqual(anonymousFailure.sourceAvailability, [], "A generic error cannot prove a particular source's state.");
const wrongIdentity = await assemble({ resolveSection: async request => {
  if (request.sectionID === empty.sectionID) {
    const error = new Error("Missing"); error.code = "INCOMPLETE_RESEARCH_SECTION";
    error.sourceBodyState = { ...state, codeEdition: "other-edition" }; throw error;
  }
  return request.sectionID === ordinary.sectionID ? ordinary : null;
} });
assert.deepEqual(wrongIdentity.sourceAvailability, [], "A stale or mismatched record cannot establish the requested boundary.");
const unrequested = await assemble({ question: "Explain equipment protection." });
assert.deepEqual(unrequested.sourceAvailability, [], "An unrelated empty search hit is not a user-facing source limitation.");
assert.deepEqual((await assemble({ question: "Explain Mechanical Code Section 991.9." })).sourceAvailability, [state]);
assert.deepEqual((await assemble({ question: "Explain Plumbing Code Section 991.9." })).sourceAvailability, []);
assert.deepEqual((await assemble({ question: "Compare Plumbing Code and Mechanical Code Section 991.9." })).sourceAvailability, [],
  "An unqualified number with multiple named authorities cannot establish a unique requested empty record.");
const limited = await assemble({ limits: { maximumCharacters: ordinary.canonicalText.length + 5,
  maximumCharactersPerSource: ordinary.canonicalText.length + 5 } });
assert.deepEqual(limited.sourceAvailability, []);
assert(limited.usage.characterCount <= limited.limits.maximumCharacters);
assert(limited.limitations.some(value => value.kind === "source-availability-budget-limit"));
const markerPacket = await assemble({ question: "Explain MC 991.9.",
  discover: async () => ({ candidates: [empty] }), resolveSection: async () => ({ ...empty,
    canonicalText: `${empty.sectionNumber} ${empty.title} ${marker}`, sourceBodyState: placeholder,
    body: { blocks: [{ plainText: marker }] } }) });
assert.equal(markerPacket.sources[0].text, `${empty.sectionNumber} ${empty.title} ${marker}`);
assert.deepEqual(markerPacket.sources[0].sourceBodyState, placeholder);
assert.equal(markerPacket.sources[0].canonicalContextComplete, false,
  "A complete placeholder record is not complete operative parent scope.");
const nominated = await assemble({ discover: async () => ({ candidates: [ordinary], unavailableSourceCandidates: [empty] }) });
assert.deepEqual(nominated.sourceAvailability, [state]);
assert(nominated.usage.candidateCount + nominated.usage.availabilityCandidateCount <= nominated.limits.maximumCandidates);
let freshBodyReads = 0;
const nowAvailable = { ...ordinary, ...empty, title: "Current equipment protection",
  canonicalText: "991.9 Current equipment protection. The equipment shall be shielded.",
  body: { blocks: [{ plainText: "991.9 Current equipment protection. The equipment shall be shielded." }] } };
const changedNomination = await assemble({ discover: async () => ({ candidates: [ordinary], unavailableSourceCandidates: [empty] }),
  resolveSection: async request => {
    if (request.sectionID === empty.sectionID) { freshBodyReads += 1; return nowAvailable; }
    return request.sectionID === ordinary.sectionID ? ordinary : null;
  } });
assert.deepEqual(changedNomination.sourceAvailability, []);
assert.equal(changedNomination.sources.find(source => source.sectionID === empty.sectionID).text, nowAvailable.canonicalText);
assert.equal(freshBodyReads, 1, "The fresh available body replaces the stale empty nomination and is reused within this same turn.");
const manyNominations = Array.from({ length: 3 }, (_, index) => ({ ...empty,
  sectionID: `empty-${index}`, sectionNumber: `991.${index + 1}` }));
let boundedReads = 0;
const bounded = await assemble({ question: "Explain MC Section 991.1; MC Section 991.2; MC Section 991.3.",
  limits: { maximumCandidates: 2, maximumCharacters: 5000 },
  discover: async () => ({ candidates: [ordinary], unavailableSourceCandidates: manyNominations }),
  resolveSection: async request => {
    boundedReads += 1;
    const nominee = manyNominations.find(value => value.sectionID === request.sectionID);
    if (!nominee) throw new Error("No additional candidate read is permitted.");
    const error = new Error("Empty canonical body"); error.code = "INCOMPLETE_RESEARCH_SECTION";
    error.sourceBodyState = researchSourceBodyState(nominee, { blocks: [] }); throw error;
  } });
assert.equal(boundedReads, 2);
assert.equal(bounded.sources.length, 0);
assert.equal(bounded.sourceAvailability.length, 2);
assert.equal(bounded.usage.candidateCount + bounded.usage.availabilityCandidateCount, 2);
console.log(JSON.stringify({ status: "passed", cases: "body provenance, authority identity, failure transport, no extra reads, atomic budgets, placeholder scope" }));
