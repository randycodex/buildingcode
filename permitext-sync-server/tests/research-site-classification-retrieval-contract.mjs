import assert from "node:assert/strict";
import { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection,
  resolveResearchAssemblySection, researchProjectInformation } from "../app.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";
import { searchResearchPassages } from "../research-passage-index.mjs";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";

globalThis.fetch = () => { throw Error("Offline retrieval contract cannot call external services."); };
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
const question = "based on the project address, is this a corner lot site?";
const project = { address: "155 E 182nd Street, Bronx", structuredFacts: [
  ["zoning-districts", "Zoning District(s)", "R8"],
  ["special-purpose-district", "Special Purpose District(s)", "C — Special Grand Concourse Preservation District"],
  ["special-purpose-subdistrict", "Special Purpose Subdistrict / Subarea", "Limited Commercial Area; Residential Preservation Area. Includes partial tax-lot intersections; verify boundaries"],
  ["lot-width", "Lot Width", "47 ft"], ["lot-depth", "Lot Depth", "120 ft"],
  ["building-area", "Building Area", "28,745 sq ft"], ["stories-above-grade", "Stories Above Grade", "6"],
  ["land-use-code", "Land Use Code", "02"]
].map(([key, label, value]) => ({ key, label, value, source: "nyc-planning", status: "sourced" })) };
const projectFacts = researchProjectInformation("isolated", project).facts;
const snapshot = structuredClone(projectFacts);
for (const classification of ["corner lot", "interior lot", "through lot", "front lot line", "rear lot line"]) {
  const text = `Based on the project address, is this a ${classification}?`;
  const query = researchEvidenceRetrievalQuery({ question: text, projectFacts });
  assert.equal(query.retrievalQuery, text);
  assert.equal(query.semanticQuery, text);
}
const yard = researchEvidenceRetrievalQuery({ question: "What yard rules apply to this corner lot in R8?", projectFacts });
assert.match(yard.semanticQuery, /R8/,
  "District-dependent rules must retain the supplied applicability search context.");
const corpusPlan = await researchCorpusPlanForTurn({ question, projectFacts });
const resources = await researchCorpusResources(corpusPlan);
const plan = planZoningResearchQuestion({ question, projectFacts });
// Production meaning search nominated unrelated special-district rules. Use
// real authorized indexed hits to reproduce that pressure without API calls.
const misleadingHits = searchResearchPassages(resources.passageIndex,
  "Special Grand Concourse Preservation District use regulations", { limit: 100 });
assert(misleadingHits.some(hit => hit.sectionNumber === "122-10"));
for (const semanticSearch of [null, { search: async () => ({ hits: misleadingHits, metadata: { enabled: true } }) }]) {
  const packet = await assembleResearchEvidence({ question, projectFacts, questionPlan: plan,
    limits: plan.evidenceLimits,
    discover: ({ question, limit, retrievalContext }) => discoverRelevantEvidence({
      question, limit, retrievalContext, ...resources, semanticSearch,
      readSectionBody: researchBodyForCatalogSection }),
    resolveSection: request => resolveResearchAssemblySection(request, resources.catalog) });
  const definition = packet.sources.find(source => source.codePrefix === "ZR" && source.sectionNumber === "12-10");
  assert(definition?.requestedDefinitionReservation, "Reserve the canonical classification definition before incidental rules.");
  assert.deepEqual(definition.targetedDefinition.labels, ["lot, corner"]);
  assert.match(definition.text, /135 degrees or less/);
  assert.match(definition.text, /100 feet from each intersecting street line/);
  assert.match(definition.text, /tangent to the curve/);
  assert.equal(definition.truncated, false);
  assert(packet.usage.characterCount <= plan.evidenceLimits.maximumCharacters);
  assert(packet.usage.targetedDefinitionCount <= plan.evidenceLimits.maximumTargetedDefinitions);
}
assert.deepEqual(projectFacts, snapshot, "Search filtering must not delete or rewrite saved facts.");
console.log("Site classification retrieval passed: rich saved facts, misleading semantic nominations, complete canonical alias target and unchanged evidence budgets.");
