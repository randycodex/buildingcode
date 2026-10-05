import assert from "node:assert/strict";
import { recoverResearchEvidenceBeforeRepair, researchEvidenceAssemblyLimits as limits } from "../research-evidence-assembly.mjs";
delete process.env.OPENAI_API_KEY;
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "0";
globalThis.fetch = () => { throw Error("Repair scope contracts forbid network/providers"); };
const { researchCorpusPlanForTurn, researchCorpusResources, resolveResearchAssemblySection, researchBodyForCatalogSection } = await import("../app.mjs");
const plan = await researchCorpusPlanForTurn({ question: "Explain the 2022 NYC Construction Codes." });
const { catalog } = await researchCorpusResources(plan);
let reads = 0;
const resolve = async request => {
  reads++;
  const source = await resolveResearchAssemblySection(request, catalog);
  return source ? { ...source, body: await researchBodyForCatalogSection({ ...source, id: source.sectionID }) } : null;
};
const sourceFor = async (codePrefix, sectionNumber) => {
  const section = catalog.find(s => s.codePrefix === codePrefix && s.sectionNumber === sectionNumber);
  assert(section);
  return { ...await resolve(section), sourceID: `actual-${codePrefix}-${sectionNumber}`, origin: "permitext_discovered",
    authorityClass: "enacted", canonicalContextComplete: true, canonicalContextResolved: true };
};
const bound = sources => ({ answerText: "Synthetic explanation; no semantic acceptance.",
  supportedPoints: sources.map(s => ({ sourceIDs: [s.sourceID], explanation: "Conditions retained." })),
  citations: sources.map(s => ({ sourceIDs: [s.sourceID], sectionID: s.sectionID, supportingPassages: [{ selectedText: s.text }] })) });
for (const [family, number, parent, clause] of [
  ["BC", "1010.1.6", "1010.1", /Means of egress doors shall meet/],
  ["MC", "506.3.6", "506.3", /Ducts serving Type I hoods/i],
  ["FGC", "409.5.1", "409.5", /Each appliance shall be provided with a shutoff valve/i]
]) {
  const original = await sourceFor("BC", "1012.5.2"), introduced = await sourceFor(family, number);
  const packet = { sources: [original, introduced], strategy: { mode: "broad" }, limits };
  const previousInterpretation = bound([original]), repairedInterpretation = bound([original, introduced]);
  const frozen = structuredClone({ packet, previousInterpretation, repairedInterpretation });
  const options = { evidencePackage: packet, previousInterpretation, repairedInterpretation, resolveSection: resolve };
  const recovered = await recoverResearchEvidenceBeforeRepair(options);
  const supplied = recovered.evidencePackage.sources.find(s => s.codePrefix === family && s.sectionNumber === parent);
  assert(supplied?.canonicalContextComplete, `${family} parent must accompany the newly used child`);
  assert.match(supplied.text, clause);
  assert.equal(supplied.corpusID, introduced.corpusID);
  assert.equal(supplied.codeEdition, introduced.codeEdition);
  assert.deepEqual(recovered.evidencePackage.sources.slice(0, 2), packet.sources, "Original identities/text are immutable");
  assert.deepEqual({ packet, previousInterpretation, repairedInterpretation }, frozen);
  assert(recovered.evidencePackage.usage.repairRetrievalReadCount <= 2);
  assert(recovered.evidencePackage.usage.characterCount <= 48000);
  const totalReads = reads;
  const repeat = await recoverResearchEvidenceBeforeRepair({ ...options, evidencePackage: recovered.evidencePackage });
  assert.equal(reads, totalReads, "Recovery cannot receive a fresh read allowance");
  assert.equal(repeat.diagnostic.supplied.length, 0);
  for (const [variant, reason] of [
    [{ usage: { crossReferenceCount: limits.maximumCrossReferences } }, "cross_reference_budget_exhausted"],
    [{ limits: { ...limits, maximumCharacters: original.text.length + introduced.text.length + 1 } }, "complete_source_exceeds_budget"],
    [{ usage: { repairRetrievalReadCount: 2 } }, "canonical_read_budget_exhausted"]
  ]) {
    const rejected = await recoverResearchEvidenceBeforeRepair({ ...options, evidencePackage: { ...packet, ...variant } });
    assert.equal(rejected.diagnostic.supplied.length, 0);
    assert(rejected.diagnostic.unresolved.some(g => g.reason === reason), reason);
    assert.deepEqual(rejected.evidencePackage.sources, packet.sources);
  }
  const oneRead = await recoverResearchEvidenceBeforeRepair({ ...options, evidencePackage: { ...packet, usage: { repairRetrievalReadCount: 1 } } });
  assert(oneRead.evidencePackage.sources.some(s => s.codePrefix === family && s.sectionNumber === parent));
  assert.equal(oneRead.evidencePackage.usage.repairRetrievalReadCount, 2, "Pre/post repair share one counter");
  const absent = await recoverResearchEvidenceBeforeRepair({ ...options, resolveSection: async () => null });
  assert.equal(absent.diagnostic.supplied.length, 0);
  assert(absent.diagnostic.unresolved.length, "Absent parent remains explicit");
  const wrongEdition = await recoverResearchEvidenceBeforeRepair({ ...options, resolveSection: async request => {
    const value = await resolve(request); return value ? { ...value, codeEdition: "wrong edition" } : null;
  } });
  assert.equal(wrongEdition.diagnostic.supplied.length, 0);
  for (const restricted of [
    { ...packet, strategy: { mode: "pinned_first" } },
    { ...packet, sources: [original, { ...introduced, origin: "user_pinned" }] },
    { ...packet, sources: [original, { ...introduced, canonicalContextResolved: false }] },
    { ...packet, sources: [original, { ...introduced, codeVersion: undefined }] }
  ]) assert.equal((await recoverResearchEvidenceBeforeRepair({ ...options, evidencePackage: restricted })).diagnostic.attemptedReads, 0);
  assert.equal((await recoverResearchEvidenceBeforeRepair({ ...options, previousInterpretation: repairedInterpretation })).diagnostic.attemptedReads, 0);
  assert.equal((await recoverResearchEvidenceBeforeRepair({ ...options, repairedInterpretation: { citations: [{ sourceIDs: ["invented"] }] } })).diagnostic.attemptedReads, 0);
}
console.log("Actual-corpus repair-introduced parents passed across BC/MC/FGC: immutable bindings, complete same-edition parents, shared budgets, explicit gaps; zero providers, no applicability acceptance.");
