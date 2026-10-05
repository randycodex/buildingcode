import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { researchCorpusResources, researchBodyForCatalogSection, researchAssemblyCrossReferences } from "../app.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";
import { buildResearchClaimScopeContext } from "../research-claim-applicability-review.mjs";
import { buildResearchMaterialScopeReviewPacket, validateResearchMaterialScopeReview } from "../research-material-scope-review.mjs";
let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error("This scope contract forbids network/providers."); };
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
// Previously executed failure is now known. These logged final references are
// controlled recall seeds, not the inaccessible original semantic rankings.
const question = "For our NYC project using the 2022 codes, a new storage-tank water heater will sit above a finished room where a leak would cause damage. What sort of catch pan and drain should we provide?";
const refs = ["PC 201.4", "FGC 201.4", "PC 504.7", "PC 504.1", "PC 504.7.1", "PC 314.2.3.2", "PC 1303.6", "PC 503.1", "PC 504.7.2", "PC 501.4", "PC 1302.7", "PC 1301.9.9", "PC 1301.9", "PC 501.1", "PC 301.1", "PC 102.1"];
const selected = createResearchCorpusRegistry({ zoningResearchEligibility: true }).filter(v =>
  ["nyc-2022-construction-codes", "nyc-2022-fire-code", "nyc-zoning-resolution"].includes(v.id));
const resources = await researchCorpusResources({ selected });
const hits = refs.map(ref => {
  const [prefix, number] = ref.split(" ");
  const section = resources.catalog.find(v => v.codePrefix === prefix && v.sectionNumber === number);
  return section && resources.passageIndex.passages.find(p => p.sectionID === String(section.id));
}).filter(Boolean);
const query = researchEvidenceRetrievalQuery({ question });
const discovery = await discoverRelevantEvidence({ question, ...resources,
  retrievalContext: { ...query, currentQuestion: question }, readSectionBody: researchBodyForCatalogSection, limit: 12,
  semanticSearch: { search: async () => ({ hits: hits.map((p, rank) => ({ ...p, score: 1 - rank / 100, passages: [p] })),
    metadata: { enabled: true, mockProvider: true } }) } });
const resolver = async request => {
  const section = resources.catalog.find(v => String(v.id) === String(request.sectionID) ||
    !request.sectionID && v.codePrefix === request.codePrefix && v.sectionNumber === request.sectionNumber);
  if (!section) return null;
  const body = await researchBodyForCatalogSection(section);
  const text = [section.sectionNumber, section.title, ...body.blocks.filter(b => b.researchClaimEligible !== false)
    .map(b => b.plainText || "")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const value = { ...section, sectionID: String(section.id), body, text, canonicalText: text };
  return { ...value, crossReferences: researchAssemblyCrossReferences(value, resources.catalog) };
};
const assembled = await assembleResearchEvidence({ question, discover: async () => discovery, resolveSection: resolver });
const parent = assembled.sources.find(s => s.codePrefix === "PC" && s.sectionNumber === "504.7");
const child = assembled.sources.find(s => s.codePrefix === "PC" && s.sectionNumber === "504.7.1");
const chapter = assembled.sources.find(s => s.codePrefix === "PC" && s.sectionNumber === "501.1");
assert(parent?.canonicalContextComplete && child?.canonicalContextComplete && chapter?.canonicalContextComplete);
assert.match(parent.text, /Where a storage tank-type water heater/);
assert.match(chapter.text, /provisions of this chapter shall govern/);
assert(!parent.text.includes("504.7.1"), "A real parent can lack an explicit forward child reference.");
assert(child.parentScopeContextGaps.some(gap => gap.identity?.sectionNumber === "504.7"), "Actual assembly reproduces the stale advisory gap nomination.");
const answer = { answerText: "The supplied pan and drain provisions are explained; material selection from the referenced table remains unresolved.",
  citations: [{ sourceIDs: [child.sourceID] }], supportedPoints: [], missingFacts: [] };
const packetFor = evidence => buildResearchMaterialScopeReviewPacket(buildResearchClaimScopeContext({ question, answer, evidence }), answer);
const packet = packetFor(assembled.sources), snapshot = JSON.stringify(assembled.sources);
const edge = packet.graph.find(e => e.anchorSourceID === child.sourceID && e.kind === "parent_scope");
assert.equal(edge.scopeSourceID, parent.sourceID); assert.equal(edge.gap, null);
assert(packet.graph.some(e => e.anchorSourceID === child.sourceID && e.scopeSourceID === chapter.sourceID));
assert.equal(JSON.stringify(assembled.sources), snapshot);
// Replay the recorded positive classification as a mechanical witness only;
// no provider-free contract can establish the actual answer's semantic truth.
const reviewFor = current => ({ packetHash: current.packetHash, unboundCategoricalApplication: false,
  checks: Object.fromEntries(current.checks.map(c => [c.sourceID, { categoricalApplication: true, sourceResult: "supported",
    relations: Object.fromEntries(c.relationIDs.map(id => [id, "established"])), reason: "Controlled recorded classification; source semantics still require ordinary model review." }])) });
const validate = current => validateResearchMaterialScopeReview({ packet: current,
  value: { materialScopeReview: reviewFor(current) }, verification: { pass: true, issues: [] } });
assert.equal(validate(packet).pass, true, "Supplied scope is not falsely rejected as unavailable.");
for (const evidence of [assembled.sources.filter(s => s.sourceID !== parent.sourceID),
  assembled.sources.map(s => s.sourceID === parent.sourceID ? { ...s, truncated: true } : s)]) {
  const presentIDs = new Set(evidence.map(source => source.sourceID));
  const guarded = packetFor(evidence.map(source => ({ ...source,
    ...(source.anchorSourceIDs ? { anchorSourceIDs: source.anchorSourceIDs.filter(id => presentIDs.has(id)) } : {}) })));

  assert(guarded.graph.some(e => e.anchorSourceID === child.sourceID && e.gap?.reference === "PC 504.7"));
  assert.equal(validate(guarded).pass, false);
}
assert.throws(() => packetFor(assembled.sources.map(s => s.sourceID === parent.sourceID ? { ...s, codeEdition: "2014" } : s)),
  error => error.code === "INVALID_RESEARCH_VERIFICATION", "Foreign identity also invalidates existing bound chapter relations.");
assert(child.text.includes("605.4") && !assembled.sources.some(source => source.codePrefix === "PC" && source.sectionNumber === "605.4"),
  "Missing referenced table remains unavailable; this does not establish material selection or full compliance.");
assert(discovery.candidates.length <= 12 && assembled.usage.crossReferenceCount <= 6 && assembled.usage.characterCount <= 12000);
assert.equal(providerCalls, 0);
console.log(JSON.stringify({ passed: true, providerCalls, originalLivePacketReproduced: false,
  parentTextSHA256: createHash("sha256").update(parent.text).digest("hex"),
  chapterTextSHA256: createHash("sha256").update(chapter.text).digest("hex"), usage: assembled.usage }));
