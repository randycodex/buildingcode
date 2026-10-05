import assert from "node:assert/strict";
import { recoverResearchEvidenceBeforeRepair, researchEvidenceAssemblyLimits, researchEvidenceStrategies } from "../research-evidence-assembly.mjs";

// Real shipped law, controlled retrieval omissions. This checks recovery and
// source identity, not model reasoning or previously unseen answer accuracy.
delete process.env.OPENAI_API_KEY;
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "0";
globalThis.fetch = () => { throw new Error("Network/provider calls forbidden in canonical corpus recovery."); };
const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection } = await import("../app.mjs");
const plan = await researchCorpusPlanForTurn({ question: "Under the 2022 Building Code, explain BC Section 102.1." });
const { catalog } = await researchCorpusResources(plan);
const same = (source, request) => ["codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition", "jurisdiction"]
  .every(field => source[field] === request[field]);
const canonicalSource = async request => {
  const matches = catalog.filter(source => same(source, request));
  assert.equal(matches.length, 1, "The real catalog establishes a unique exact authority.");
  const section = matches[0], body = await researchBodyForCatalogSection(section);
  const text = body.blocks.map(block => block.plainText).join("\n\n");
  return { ...section, sectionID: String(section.id), body, text,
    canonicalText: [section.sectionNumber, section.title, text].join(" ").replace(/\s+/g, " ").trim() };
};
const section = catalog.find(source => source.codePrefix === "BC" && source.sectionNumber === "102.1" &&
  source.corpusID === "nyc-2022-construction-codes");
assert(section);
const full = await canonicalSource(section);
assert.match(full.text, /specific requirement/i);
assert.match(full.text, /most restrictive/i);
const incomplete = { ...full, text: full.text.split(/(?<=\.)\s+/)[0], sourceID: "controlled-missing-scope",
  authorityClass: "enacted", origin: "permitext_discovered", canonicalContextComplete: false, truncated: true };
assert(incomplete.text.length < full.text.length);
const packet = { sources: [incomplete], strategy: { mode: researchEvidenceStrategies.broad },
  limits: researchEvidenceAssemblyLimits, usage: { supplementalCharacterCeiling: 48_000 } };
const recovered = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packet,
  issues: [{ type: "missed_material_conclusion", detail: "BC Section 102.1 is incomplete; its closing interpretation clause is missing." }],
  resolveSection: canonicalSource });
assert.equal(recovered.diagnostic.supplied.length, 1);
assert.equal(recovered.evidencePackage.sources[0].sourceID, incomplete.sourceID);
assert.equal(recovered.evidencePackage.sources[0].text, full.canonicalText);
assert.equal(recovered.evidencePackage.sources[0].canonicalContextComplete, true);
assert.equal(recovered.evidencePackage.sources[0].sectionID, String(section.id));
for (const field of ["codeEdition", "codeVersion", "corpusID", "jurisdiction"]) assert.equal(recovered.evidencePackage.sources[0][field], section[field]);
const limited = await recoverResearchEvidenceBeforeRepair({ evidencePackage: { ...packet,
  limits: { ...packet.limits, maximumCharacters: incomplete.text.length + 1 } },
  issues: [{ type: "incorrect_citation", detail: "BC Section 102.1 is incomplete in the supplied source." }], resolveSection: canonicalSource });
assert.equal(limited.diagnostic.supplied.length, 0);
assert.equal(limited.evidencePackage.sources[0].text, incomplete.text);
console.log("Actual-corpus repair retrieval passed: exact current BC authority, both interpretation clauses, unchanged source ID and atomic budget rejection; no API calls.");
