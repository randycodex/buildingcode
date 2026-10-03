import assert from "node:assert/strict";
import { createResearchCorpusRegistry, routeResearchCorpora, researchCorpusPlanRequestsCorpus } from "../research-corpus-registry.mjs";
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
for (const question of [
  "For a new NYC building under the 2022 codes, what net crawl-space vent opening area is required?",
  "Under the NYC Plumbing Code, can a clinical sink also serve as a service sink?",
  "Under the NYC Fire Code, how close must a fuel-oil boiler extinguisher be?"
]) {
  const plan = routeResearchCorpora({ question, registry });
  assert(plan.selected.some(corpus => corpus.id === "nyc-zoning-resolution"), "Wider recall still makes zoning searchable.");
  assert.equal(researchCorpusPlanRequestsCorpus(plan, "nyc-zoning-resolution"), false,
    "Adding a book to recall must not activate its domain-specific answer selection or budgets.");
}
for (const question of [
  "May equipment be only 8 inches from another cooking appliance?",
  "Does the rule apply to an exclusively residential building?",
  "Is a pad only 2 inches above grade enough?"
]) {
  const plan = routeResearchCorpora({ question, registry });
  assert(plan.selected.some(corpus => corpus.id === "nyc-2022-fire-code"));
  assert(plan.selected.some(corpus => corpus.id === "nyc-zoning-resolution"),
    "Quantity/use qualifiers do not restrict the authorized source library.");
}
for (const question of [
  "Use only the Building Code passages to answer this question.",
  "Search the Mechanical Code only for this question.",
  "Only the NYC Fire Code: what does the supplied rule say?"
]) {
  const plan = routeResearchCorpora({ question, registry });
  assert(!plan.selected.some(corpus => corpus.retrievalRole === "recall_only"),
    "Explicit source restrictions still prevent widening the library.");
}
for (const question of ["Explain the zoning transparency requirements.", "For a C4-2 zoning site, may two buildings share loading berths?"]) {
  const plan = routeResearchCorpora({ question, registry });
  assert.equal(researchCorpusPlanRequestsCorpus(plan, "nyc-zoning-resolution"), true);
}
assert.equal(researchCorpusPlanRequestsCorpus({ pinnedCorpora: [{ id: "nyc-zoning-resolution" }], selected: [] }, "nyc-zoning-resolution"), true);
assert.equal(researchCorpusPlanRequestsCorpus({ selected: [{ id: "nyc-zoning-resolution", routeReason: "authorized current-library recall; applicability unresolved" }] }, "nyc-zoning-resolution"), false,
  "Stored plans from the prior version retain recall-only treatment.");
console.log("Recall/domain selection passed: searchable adjacent books do not activate unrelated answer filtering; actual requested and pinned domains remain active.");
