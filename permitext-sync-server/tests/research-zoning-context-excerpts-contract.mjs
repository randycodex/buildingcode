import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { targetedZoningContextExcerpt, refreshZoningContextEvidence } from "../research-zoning-context-excerpts.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";

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
assert.equal(await refreshZoningContextEvidence(assembled, plan, () => { throw new Error("Unneeded reassembly"); }), assembled);
const resolvedPlan = planZoningResearchQuestion({ ...input, projectFacts: ["Verified mapped district M1-1."] });
assert.deepEqual(resolvedPlan.missingFacts, []);
let refreshes = 0;
const refreshed = await refreshZoningContextEvidence(assembled, resolvedPlan, async (questionPlan) => {
  refreshes++;
  return assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: questionPlan });
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
