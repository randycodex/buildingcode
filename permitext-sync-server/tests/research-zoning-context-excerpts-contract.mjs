import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { targetedZoningContextExcerpt, refreshZoningContextEvidence } from "../research-zoning-context-excerpts.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";
import { researchTopicDependencyPlan } from "../research-topic-dependencies.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in Zoning context excerpt contract."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === "ZR-06"),
  { original: true, zoningSummary: zoningSectionSummary });
const plan = planZoningResearchQuestion(input);
const body = await zoningSection(20022473);
const canonical = body.blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim();
const source = { sectionID: "20022473", codePrefix: "ZR", sectionNumber: "42-192", text: canonical };
const original = structuredClone(source);
const excerpt = targetedZoningContextExcerpt(source, { question: input.question, plan });
assert.ok(excerpt);
assert.deepEqual(source, original, "Selecting an excerpt must not mutate the canonical source.");
assert.equal(excerpt.metadata.canonicalSectionSHA256, createHash("sha256").update(canonical).digest("hex"));
assert.equal(excerpt.text, excerpt.metadata.spans.map(({ start, end }) => canonical.slice(start, end)).join("\n\n"),
  "Every delivered character must round-trip to a complete canonical source span.");
for (const pattern of [/Subarea 1/, /Subarea 2/, /December 19, 2017/, /documentation satisfactory/,
  /no increase in lot area/, /may be reconstructed/, /shall be considered non-conforming/]) assert.match(excerpt.text, pattern);
assert.match(excerpt.metadata.limitation, /omitted/);
assert.match(excerpt.metadata.limitation, /cannot establish a parcel/);
for (const question of [
  "Can self-storage be permitted on a specific property with unknown mapped status?",
  "A proposed self-service storage facility has no verified property location. Can applicability be established?"
]) assert.ok(targetedZoningContextExcerpt(source, { question, plan }));
for (const question of [
  "Design a self-service storage facility while mapped status is unknown.",
  "How much industrial floor space does this self-service storage facility need?",
  "What reporting or signage does a self-service storage facility require?",
  "Is self-service storage permitted, and what clear height is required?",
  "At this specific property, what storage spaces does a self-service storage facility need?",
  "Calculate the business-sized storage area for a self-storage facility."
]) assert.equal(targetedZoningContextExcerpt(source, { question, plan }), null);
assert.equal(targetedZoningContextExcerpt(source, { question: input.question, plan: { ...plan, missingFacts: [] } }), null);
assert.equal(targetedZoningContextExcerpt({ ...source, codePrefix: "PC" }, { question: input.question, plan }), null);
assert.equal(targetedZoningContextExcerpt({ ...source, text: canonical.replaceAll("December 19, 2017", "December 19, 2030") },
  { question: input.question, plan }), null, "Changed anchoring provisions need fresh source review.");
assert.equal(targetedZoningContextExcerpt({ ...source, text: canonical.slice(0, -200) }, { question: input.question, plan }), null,
  "A missing closing condition cannot become a complete excerpt.");

const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
const delivered = assembled.sources.find((item) => item.sectionID === source.sectionID);
assert.equal(delivered.text, excerpt.text);
assert.equal(delivered.canonicalContextComplete, false);
assert.equal(delivered.truncated, false, "The selected spans are complete; the canonical section is explicitly partial.");
assert.ok(delivered.targetedZoningContext);
assert.equal(assembled.zoningSelection.pass, true);
assert.ok(assembled.zoningSelection.usage.characterCount <= 8_000);
assert.equal(assembled.sources.filter((item) => item.origin === "user_pinned").length, 5);
assert.ok(assembled.limitations.some((item) => item.kind === "targeted-zoning-context-excerpt"));
assert.equal(plan.callPolicy.maximumProviderCalls, 0, "An excerpt does not authorize a parcel determination or provider dispatch.");

// Select the real, full Reader body, including its original paragraph breaks.
// The answering packet retains closing conditions without claiming that its
// excerpt is the user's complete selection.
const fullSelection = body.blocks.map((block) => block.plainText || "").join("\n\n");
const readerInput = { ...input, originSurface: "reader", pinnedEvidence: [
  { ...input.pinnedEvidence.find((item) => item.sectionID === source.sectionID), selectedText: fullSelection,
    canonicalText: `42-192 Use Group IX – uses permitted with limited applicability ${canonical}` }
] };
const reader = await assembledResearchEvidenceForTurn({ ...readerInput, corpusPlan: await researchCorpusPlanForTurn(readerInput), zoningPlan: plan });
const readerSource = reader.sources.find((item) => item.sectionID === source.sectionID);
assert.equal(readerSource.text, excerpt.text);
assert.equal(readerSource.userSelectedText.replace(/\s+/g, " "), canonical);
assert.equal(readerSource.pinnedSelectionExact, false);
assert.equal(readerSource.pinnedSelectionExcerpted, true);
assert.equal(readerSource.truncated, false);
assert.equal(reader.usage.pinnedSelectionTruncatedCount, 0);
assert.equal(reader.usage.pinnedSelectionExcerptedCount, 1);
const snapshot = immutableEvidenceSnapshot({ source: readerSource });
assert.equal(snapshot.passageText, excerpt.text);
assert.equal(snapshot.provenance.userSelectedText, readerSource.userSelectedText);
assert.equal(snapshot.provenance.userSelectedTextHash, createHash("sha256").update(readerSource.userSelectedText).digest("hex"));
assert.deepEqual(snapshot.provenance.targetedZoningContext, readerSource.targetedZoningContext);
assert.equal(snapshot.provenance.canonicalContextComplete, false);
assert.equal(snapshot.provenance.pinnedSelectionExcerpted, true);
const snapshotHash = snapshot.snapshotHash;
const alteredSource = structuredClone(readerSource);
alteredSource.targetedZoningContext.spans[0].start++;
assert.notEqual(immutableEvidenceSnapshot({ source: alteredSource, id: snapshot.id, approvedAt: snapshot.approvedAt }).snapshotHash, snapshotHash);
const originalStart = readerSource.targetedZoningContext.spans[0].start;
readerSource.targetedZoningContext.spans[0].start++;
assert.equal(snapshot.provenance.targetedZoningContext.spans[0].start, originalStart, "Snapshot metadata is independently copied.");
readerSource.targetedZoningContext.spans[0].start = originalStart;

const headedSource = { ...source, title: "Use Group IX – uses permitted with limited applicability" };
headedSource.canonicalText = `${headedSource.sectionNumber} ${headedSource.title} ${canonical}`;
for (const selectedText of [canonical, headedSource.canonicalText, fullSelection]) {
  assert(targetedZoningContextExcerpt(headedSource, { question: input.question, plan, selectedText }));
}
for (const selectedText of [canonical.slice(100), canonical.slice(0, 1_000), canonical.replace("2017", "2030")]) {
  assert.equal(targetedZoningContextExcerpt(headedSource, { question: input.question, plan, selectedText }), null,
    "A partial or changed Reader selection does not authorize automatic paragraph substitution.");
}
const partialText = canonical.slice(0, 1_000);
const partialInput = { ...readerInput, pinnedEvidence: [{ ...readerInput.pinnedEvidence[0], selectedText: partialText }] };
const partial = await assembledResearchEvidenceForTurn({ ...partialInput, corpusPlan: await researchCorpusPlanForTurn(partialInput), zoningPlan: plan });
assert.equal(partial.sources[0].text, partialText);
assert.equal(partial.sources[0].pinnedSelectionExact, true);
assert.equal(partial.sources[0].targetedZoningContext, undefined);

// Chat supplies no hand-picked passages. This catches number-only resolution
// accidentally matching an empty webSectionID in the first catalog record.
const chatInput = { ...input, pinnedEvidence: [], originSurface: "chat" };
const chat = await assembledResearchEvidenceForTurn({ ...chatInput, corpusPlan: await researchCorpusPlanForTurn(chatInput), zoningPlan: plan });
assert.equal(chat.sources.find((item) => item.sectionNumber === "42-192").text, excerpt.text);
for (const number of ["42-191", "42-193"]) {
  const dependency = chat.sources.find((item) => item.sectionNumber === number);
  assert(dependency, `${number} must be retrieved without supplied section IDs.`);
  assert.equal(dependency.canonicalContextComplete, true);
  assert.equal(dependency.evidencePriority.claimCoverageRequired, true);
  assert.equal(dependency.evidencePriority.evidenceRole, "governing", "A required governing claim must be satisfiable by its actual dependency source.");
}
assert.equal(chat.usage.topicDependencyCount, 2);
assert.equal(chat.usage.resolverFailureCount, 0);
assert(chat.usage.characterCount <= 8_000);
assert(!chat.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
assert.equal(chat.sources.find((item) => item.sectionNumber === "42-193").codeVersion, readerSource.codeVersion);
assert.equal(researchTopicDependencyPlan({ question: input.question, sources: [{ ...readerSource, corpusID: "" }] }), null,
  "An unidentified source corpus cannot authorize dependencies from another edition.");

const dependencySources = new Map(chat.sources.map((item) => [item.sectionNumber, item]));
dependencySources.set("42-192", { ...dependencySources.get("42-192"), text: headedSource.canonicalText });
delete dependencySources.get("42-192").targetedZoningContext;
const dependencyAssembly = (variant) => assembleResearchEvidence({
  question: input.question, questionPlan: plan,
  limits: { maximumCharacters: variant === "budget" ? 5_000 : 8_000,
    maximumCharactersPerSource: 5_000, maximumDiscovered: 2, maximumCrossReferences: 0, maximumTargetedDefinitions: 0 },
  discover: async () => ({ candidates: ["APPENDIX J", "42-192"].map((number) => ({
    ...dependencySources.get(number), ...(variant === "selected_passage" && number === "42-192"
      ? { signals: { useSelectedPassageOnly: true }, selectedText: partialText } : {})
  })) }),
  resolveSection: async ({ sectionNumber }) => {
    const value = structuredClone(dependencySources.get(sectionNumber));
    if (sectionNumber === "42-193") {
      if (variant === "missing") return null;
      if (variant === "edition") value.codeVersion = "another-edition";
      if (variant === "identity") delete value.corpusID;
    }
    return value;
  }
});
for (const variant of ["missing", "edition", "identity", "budget"]) {
  const result = await dependencyAssembly(variant);
  assert(result.limitations.some((item) => item.kind === "topic-dependency-coverage-gap" && /42-193/.test(item.text)), variant);
  assert(!result.sources.some((item) => item.sectionNumber === "42-193"), variant);
  assert(result.usage.characterCount <= result.limits.maximumCharacters);
}
const discoverySelection = await dependencyAssembly("selected_passage");
assert.equal(discoverySelection.sources.find((item) => item.sectionNumber === "42-192").text, partialText);
assert.equal(discoverySelection.sources.some((item) => item.targetedZoningContext), false);
assert.equal(discoverySelection.usage.topicDependencyCount, 0);

assert.equal(await refreshZoningContextEvidence(assembled, plan, () => { throw new Error("Unneeded reassembly"); }), assembled);
const partiallyResolvedPlan = planZoningResearchQuestion({ ...input, projectFacts: ["Verified mapped district M1-1."] });
assert.deepEqual(partiallyResolvedPlan.missingFacts.map((fact) => fact.id),
  ["special_district_status", "zoning_lot_area"],
  "Resolving the mapped district does not resolve the other explicitly missing facts.");
// Once the user's question no longer asserts those missing facts, the resolved
// map can remove the conditional excerpt. Keep the full authored case above.
const resolvedInput = { ...input,
  question: "What conditions apply to a self-service storage facility on this property?",
  projectFacts: ["Verified mapped district M1-1.", "Special-district status: none.", "Current zoning-lot area: 10,000 square feet."] };
const resolvedPlan = planZoningResearchQuestion(resolvedInput);
assert.deepEqual(resolvedPlan.missingFacts, []);
let refreshes = 0;
const refreshed = await refreshZoningContextEvidence(assembled, resolvedPlan, async (questionPlan) => {
  refreshes++;
  return assembledResearchEvidenceForTurn({ ...resolvedInput, corpusPlan: await researchCorpusPlanForTurn(resolvedInput), zoningPlan: questionPlan });
});
assert.equal(refreshes, 1);
assert.equal(refreshed.sources.some((item) => item.targetedZoningContext), false,
  "Resolving a prerequisite must remove the now-inapplicable excerpt before a generation request.");
await assert.rejects(() => refreshZoningContextEvidence(assembled, resolvedPlan, async () => assembled),
  { code: "RESEARCH_ZONING_EXCERPT_SCOPE_MISMATCH" });

// Preserve explicit selections when reserving the optional source excerpt.
const selectedText = "User-selected enacted passage. ".repeat(105).trim();
const synthetic = async (extraPins, limits = {}) => assembleResearchEvidence({
  question: input.question, questionPlan: plan,
  pinnedEvidence: [{ sectionID: "selection", codePrefix: "ZR", sectionNumber: "11-14", selectedText },
    { sectionID: source.sectionID, codePrefix: "ZR", sectionNumber: "42-192" }, ...extraPins],
  limits: { maximumCharacters: 8_000, maximumCharactersPerSource: 4_000, ...limits },
  discover: async () => ({ candidates: [] }),
  resolveSection: async ({ sectionID }) => sectionID === source.sectionID ? source : {
    sectionID, codePrefix: "ZR", sectionNumber: sectionID === "selection" ? "11-14" : "11-12",
    text: sectionID === "selection" ? selectedText : "Other selected enacted text."
  }
});
const mixed = await synthetic([{ sectionID: "other", codePrefix: "ZR", sectionNumber: "11-12" }]);
assert.equal(mixed.sources[0].text, selectedText);
assert.equal(mixed.sources.find((item) => item.sectionID === source.sectionID).text, excerpt.text);
assert.ok(mixed.sources.some((item) => item.sectionID === "other" && item.text));
const noReservation = await synthetic([], { maximumCharacters: 4_000 });
assert.equal(noReservation.sources.some((item) => item.targetedZoningContext), false,
  "Disable the optional excerpt rather than crowding out an explicit selection reservation.");

// Selecting complete blocks is still a partial section; do not mislabel it.
const selectedBlock = await assembleResearchEvidence({
  question: "Explain historical storage records.", pinnedEvidence: [{ sectionID: "blocks", codePrefix: "ZR", sectionNumber: "99-99" }],
  limits: { maximumCharacters: 100, maximumCharactersPerSource: 100 }, discover: async () => ({ candidates: [] }),
  resolveSection: async () => ({ sectionID: "blocks", codePrefix: "ZR", sectionNumber: "99-99",
    text: "Unrelated material. ".repeat(80) + "Historical storage records are required.",
    body: { blocks: [{ plainText: "Unrelated material. ".repeat(80) }, { plainText: "Historical storage records are required." }] } })
});
assert.equal(selectedBlock.sources[0].text, "Historical storage records are required.");
assert.equal(selectedBlock.sources[0].canonicalContextComplete, false);
assert.equal(selectedBlock.sources[0].truncated, true);
console.log("Zoning context excerpts passed: canonical span binding, retained closing conditions, scoped use, atomic reservations and partial-source metadata; no network/provider calls.");
