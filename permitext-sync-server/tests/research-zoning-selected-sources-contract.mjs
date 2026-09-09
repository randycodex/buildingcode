import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { researchEvidenceStrategyForTurn } from "../research-evidence-assembly.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness } from "../research-zoning-planner.mjs";
import { requestedZoningAmendmentHistory, zoningAmendmentHistoryRecord } from "../research-zoning-metadata.mjs";

globalThis.fetch = async () => { throw new Error("No network in selected-source regressions."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const inputFor = async (id) => {
  const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
  for (const pin of input.pinnedEvidence) {
    const section = await zoningSection(pin.sectionID);
    pin.selectedText = section.blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim();
  }
  return { ...input, originSurface: "reader" };
};
const assemble = async (input) => {
  const plan = planZoningResearchQuestion(input);
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
  const deterministicContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan });
  return { ...assembled, readiness: evaluateZoningEvidenceReadiness({ ...input, evidence: assembled.sources, plan, deterministicContext }) };
};

const tableInput = await inputFor("ZR-02");
const table = await assemble(tableInput);
assert.equal(table.strategy.reason, "question_explicitly_bounded_to_selected_evidence");
assert.equal(table.sources.length, 1);
assert.equal(table.sources[0].sectionID, tableInput.pinnedEvidence[0].sectionID);
assert.equal(table.sources[0].text, tableInput.pinnedEvidence[0].selectedText);
assert.equal(table.sources[0].richSourceKind, "table");
assert.equal(table.sources[0].richSourceGrids.length, 1);
assert.equal(table.readiness.pass, true);
assert.equal(table.usage.discoveredCount, 0);
assert.equal(table.usage.crossReferenceCount, 0);
const partialTable = await assemble({ ...tableInput, pinnedEvidence: [{ ...tableInput.pinnedEvidence[0], selectedText: "Agricultural uses" }] });
assert(partialTable.sources.every((source) => !source.richSourceGrids));
assert.equal(partialTable.readiness.pass, false, "A fragment cannot stand in for the complete selected table.");
for (const question of ["Using only the selected table, explain its symbols.", "Using only pinned tables, compare their rows.", "Using only selected text, explain the rule."]) {
  for (const originSurface of ["reader", "research"]) assert.equal(researchEvidenceStrategyForTurn({ question, originSurface, pinnedEvidence: tableInput.pinnedEvidence }).mode, "pinned_first");
  assert.equal(researchEvidenceStrategyForTurn({ question, pinnedEvidence: [] }).mode, "broad");
}

const historyInput = await inputFor("ZR-05");
const section = await zoningSection(historyInput.pinnedEvidence[0].sectionID);
const history = structuredRichSources(section).find((source) => source.kind === "amendment-history");
for (const input of [historyInput, { ...historyInput, pinnedEvidence: [], question: historyInput.question.replace("Section 42-00", "ZR Section 42-00") }]) {
  const assembled = await assemble(input);
  const sources = assembled.sources.filter((source) => source.richSourceKind === "amendment-history");
  assert.equal(sources.length, 1);
  assert.equal(sources[0].text, history.text);
  assert.equal(sources[0].richSourceContentHash, history.contentHash);
  assert.equal(sources[0].authorityClass, "official_metadata");
  assert.equal(sources[0].canonicalContextComplete, false);
  assert.equal(sources[0].metadataCurrentness, "not_refreshed_in_this_turn");
  assert(assembled.usage.characterCount <= assembled.limits.maximumCharacters);
}
for (const question of ["What does ZR Section 42-00 require?", "Using only the selected text, summarize the amendment-history events.", "What does the amendment history for ZR Section 42-111 identify?"]) {
  const assembled = await assemble({ ...historyInput, question });
  assert(!assembled.sources.some((source) => source.richSourceKind === "amendment-history" && source.sectionNumber === "42-00"), question);
}
const descriptor = { ...section, codePrefix: "ZR", sectionNumber: "42-00", richSources: [history] };
assert(requestedZoningAmendmentHistory(descriptor, historyInput.question));
assert.equal(requestedZoningAmendmentHistory({ ...descriptor, richSources: [{ ...history, sourceURL: "https://example.com/history" }] }, historyInput.question), null);
assert.equal(requestedZoningAmendmentHistory({ ...descriptor, richSources: [history, history] }, historyInput.question), null);
assert.equal(zoningAmendmentHistoryRecord(descriptor, history, { sourceID: "bounded-metadata", characterAllowance: history.text.length - 1 }), null);
console.log("Selected-source contract passed: exact table/grid/legend, partial-selection rejection, requested official metadata, authority and size boundaries; no API calls.");
