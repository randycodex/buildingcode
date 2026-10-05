import assert from "node:assert/strict";
import { recoverResearchEvidenceBeforeRepair, researchEvidenceAssemblyLimits } from "../research-evidence-assembly.mjs";
delete process.env.OPENAI_API_KEY;
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
process.env.PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES = "1";
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = "1";
globalThis.fetch = () => { throw Error("Dependency recovery must make no provider calls"); };
const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection, resolveResearchAssemblySection, assembledResearchEvidenceForTurn } = await import("../app.mjs");
const plan = await researchCorpusPlanForTurn({ question: "Explain the 2022 NYC Construction Codes." });
const { catalog } = await researchCorpusResources(plan);
const resolve = async request => {
  const source = await resolveResearchAssemblySection(request, catalog);
  return source ? { ...source, body: await researchBodyForCatalogSection({ ...source, id: source.sectionID }) } : null;
};
const sourceFor = async (codePrefix, sectionNumber) => {
  const section = catalog.find(section => section.codePrefix === codePrefix && section.sectionNumber === sectionNumber);
  assert(section);
  return { ...await resolve(section), sourceID: `real-${codePrefix}-${sectionNumber}`, origin: "permitext_discovered",
    authorityClass: "enacted", canonicalContextComplete: true, canonicalContextResolved: true };
};
const packetFor = source => ({ strategy: { mode: "broad" }, sources: [source], limits: researchEvidenceAssemblyLimits });
const parentSource = await sourceFor("BC", "903.3.3");
const parentIssue = { type: "unsupported_requirement", detail: "The supplied evidence lacks BC 903.3, the enclosing parent needed to assess this claim." };
const parent = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(parentSource), issues: [parentIssue], resolveSection: resolve });
assert.equal(parent.diagnostic.supplied.length, 1);
assert.equal(parent.diagnostic.supplied[0].referenceKind, "ancestor_scope");
assert.match(parent.evidencePackage.sources[1].text, /Sections 903\.3\.1 through 903\.3\.8/);
assert.equal(parent.evidencePackage.sources[1].canonicalContextComplete, true);
const unverified = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor({ ...parentSource, canonicalContextResolved: false }), issues: [parentIssue], resolveSection: resolve });
assert.equal(unverified.diagnostic.attemptedReads, 0, "Unverified metadata cannot nominate a parent");
const unrelated = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(parentSource), issues: [{ ...parentIssue, detail: "BC 904.3 is missing." }], resolveSection: resolve });
assert.equal(unrelated.diagnostic.attemptedReads, 0, "A sibling hierarchy cannot become the missing parent");

const water = await sourceFor("PC", "603.2");
const tableIssue = { type: "false_evidence_limitation", detail: "PC Table 702.2 was not provided; its material list and footnote are missing." };
const table = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(water), issues: [tableIssue], resolveSection: resolve });
assert.equal(table.diagnostic.supplied.length, 1);
const supplied = table.evidencePackage.sources[1];
assert.equal(supplied.richSourceReference, "PC Table 702.2", "Canonical plumbing tables must not acquire zoning identity");
assert.equal(supplied.sectionNumber, "702.2");
assert.equal(supplied.canonicalContextComplete, true);
assert.equal(supplied.richSourceKind, "table");
assert(supplied.richSourceGrids.length);
assert.match(supplied.text, /Limited to residential buildings five stories or less/i, "Table scope footnote stays with the material row");
assert.match(supplied.text, /Underground building sanitary drainage and vent pipe/i, "The table introduction must survive grid attachment");
assert.equal(table.evidencePackage.usage.crossReferenceCount, 1);
const noGrid = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(water), issues: [tableIssue], resolveSection: async request => ({ ...await resolve(request), richSources: [] }) });
assert.equal(noGrid.diagnostic.supplied.length, 0);
assert.equal(noGrid.diagnostic.unresolved[0].reason, "referenced_table_not_verified");
const wrongGrid = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(water), issues: [tableIssue], resolveSection: async request => {
  const source = await resolve(request);
  return { ...source, richSources: source.richSources.map(grid => ({ ...grid, reference: "PC Table 702.3" })) };
} });
assert.equal(wrongGrid.diagnostic.supplied.length, 0);
const tight = await recoverResearchEvidenceBeforeRepair({ evidencePackage: { ...packetFor(water),
  limits: { ...researchEvidenceAssemblyLimits, maximumCharacters: water.text.length + 1 } }, issues: [tableIssue], resolveSection: resolve });
assert.equal(tight.diagnostic.supplied.length, 0, "A table and footnote cannot be clipped to fit");

const access = await sourceFor("MC", "306.2");
const excerpt = { ...access, text: access.text.slice(0, access.text.indexOf("Exception:")), canonicalContextComplete: false, truncated: true };
const restored = await recoverResearchEvidenceBeforeRepair({ evidencePackage: packetFor(excerpt),
  issues: [{ type: "fact_evidence_confusion", detail: "MC Section 306.2 is incomplete; the dwelling exception was not included." }], resolveSection: resolve });
assert.equal(restored.diagnostic.supplied.length, 1);
assert.equal(restored.evidencePackage.sources[0].origin, "permitext_discovered");
assert.equal(restored.evidencePackage.usage.crossReferenceCount, 0, "Replacing discovery text must not silently consume a new cross-reference slot");
assert.equal(restored.evidencePackage.sources[0].sourceID, excerpt.sourceID);
assert.match(restored.evidencePackage.sources[0].text, /removal of the largest appliance/);

const question = "Explain the sprinkler obstruction and covered-display requirements in BC 903.3.3 under the 2022 NYC codes.";
const corpusPlan = await researchCorpusPlanForTurn({ question });
const assembled = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts: [], pinnedEvidence: [], corpusPlan });
assert.equal(assembled.usage.repairCharacterReservation, 2048);
assert.equal(assembled.usage.repairCrossReferenceReservation, 1);
assert.equal(assembled.usage.supplementalCharacterCeiling, 48000, "The complete initial-plus-repair budget remains unchanged");
assert(assembled.usage.characterCount <= assembled.usage.initialSupplementalCharacterCeiling);
assert(assembled.usage.crossReferenceCount <= assembled.limits.maximumCrossReferences - 1);
assert(assembled.sources.some(source => source.codePrefix === "BC" && source.sectionNumber === "903.3.3"));
const missingParentPacket = { ...assembled, sources: assembled.sources.filter(source => !(source.codePrefix === "BC" && source.sectionNumber === "903.3")) };
const capacity = await recoverResearchEvidenceBeforeRepair({ evidencePackage: missingParentPacket, issues: [parentIssue], resolveSection: resolve });
assert.equal(capacity.diagnostic.supplied.length, 1);
assert(capacity.evidencePackage.sources.some(source => source.codePrefix === "BC" && source.sectionNumber === "903.3" && source.canonicalContextComplete),
  "The ordinary actual-corpus packet must retain capacity to supply the reviewed parent scope");
assert(capacity.evidencePackage.usage.characterCount <= 48000);
assert(capacity.evidencePackage.usage.crossReferenceCount <= assembled.limits.maximumCrossReferences);
console.log("Actual dependency recovery passed: canonical parent scope, verified table grids and complete footnotes, immutable source identity and atomic shared budgets; zero provider calls.");
