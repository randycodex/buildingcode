import assert from "node:assert/strict";

process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
let externalCalls = 0;
globalThis.fetch = async () => { externalCalls += 1; throw Error("No network in resource-cache contract"); };
const { researchCorpusPlanForTurn, researchCorpusResources, assembledResearchEvidenceForTurn } = await import("../app.mjs");
const plan = await researchCorpusPlanForTurn({ question: "Under the current NYC Building Code, what clearance is needed for an egress corridor?", messages: [] });
assert(plan.selected.length >= 2);
const { researchCorpusPlanRequestsCorpus } = await import("../research-corpus-registry.mjs");
const readerPlan = await researchCorpusPlanForTurn({ question: "Can you explain this passage?", messages: [],
  pinnedEvidence: [{ codePrefix: "ZR", sectionNumber: "36-65" }] });
assert.equal(researchCorpusPlanRequestsCorpus(readerPlan, "nyc-zoning-resolution"), true,
  "An explicit Reader/saved-passage pin retains zoning planning even when the same book was already searchable for recall.");
const partitions = await Promise.all(plan.selected.map(corpus => researchCorpusResources({ selected: [corpus] })));
const combined = await researchCorpusResources(plan);
assert.equal(combined.passageIndex.passages.length, partitions.reduce((sum, resource) => sum + resource.passageIndex.passages.length, 0));
const combinedByID = new Map(combined.passageIndex.records.map(record => [record.passage.id, record]));
for (const partition of partitions) {
  assert(partition.passageIndex.records.length);
  for (const record of partition.passageIndex.records) assert.equal(combinedByID.get(record.passage.id), record,
    "Combined authorized views must share canonical records instead of rebuilding source bodies.");
  assert.equal(await researchCorpusResources({ selected: plan.selected.filter(corpus =>
    corpus.id === partition.catalog[0].corpusID) }), partition);
}
const oneCorpusPlan = { ...plan, selected: [plan.selected[0]] };
const one = await researchCorpusResources(oneCorpusPlan);
assert.deepEqual([...new Set(one.passageIndex.passages.map(passage => passage.corpusID))], [plan.selected[0].id]);
assert.equal(await researchCorpusResources(plan), combined);
assert.equal(externalCalls, 0);

// Hosted semantic retrieval must remain observable lexical fallback until
// retrieval itself has a durable reservation, rather than dispatching outside
// the normal Research spending guardrails.
process.env.VERCEL = "1";
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "1";
const packet = await assembledResearchEvidenceForTurn({ question: "What clearance is needed for an egress corridor?",
  messages: [], pinnedEvidence: [], projectFacts: [], corpusPlan: oneCorpusPlan });
assert.equal(packet.discovery.semanticSearch.fallbackReason, "semantic_production_spend_integration_required");
assert(packet.sources.length);
assert.equal(externalCalls, 0);
console.log("Corpus partition caching passed: canonical record reuse, selected corpus boundaries, stable combined views and observable hosted spend fallback; no provider calls.");
