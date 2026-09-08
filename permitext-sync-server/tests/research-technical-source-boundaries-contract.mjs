import assert from "node:assert/strict";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

// Exercise source selection, not regex membership. Same-number historical
// entries and adjacent topics must not acquire the current technical route.
const probes = [
  { prefix: "BC", section: "303.1.2", question: "Is a small community hall automatically Group A-3?", adjacent: "Which spaces need emergency lighting?" },
  { prefix: "FGC", section: "407.2", question: "May I hang a gas pipe from an adjacent water line?", adjacent: "How much water can this pipe carry?" },
  { prefix: "MC", section: "401.2", question: "We added air conditioning to a studio. Do its windows satisfy ventilation?", adjacent: "How high must the accessible window controls be?" },
  { prefix: "AC", section: "28-105.10", question: "Could an issued permit be revoked for a false statement?", adjacent: "Which permit drawings show the work area?" },
  { prefix: "AC", section: "28-116.1", question: "Does a satisfactory inspection make a code violation legal?", adjacent: "How do I schedule an inspection?" },
  { prefix: "PC", section: "704.2", question: "Can the drain become smaller downstream to clear an obstruction?", adjacent: "Can the vent become smaller above the roof?" }
];

async function discover(question, catalog) {
  return discoverRelevantEvidence({ question, catalog, invertedIndex: new Map(), limit: 12,
    readSectionBody: async () => ({ blocks: [{ plainText: "Canonical source body with no query keywords." }] }) });
}

for (const probe of probes) {
  const catalog = ["2022", "2014"].map((edition) => ({
    id: `${probe.prefix}-${edition}-${probe.section}`, codePrefix: probe.prefix,
    codeEdition: edition, sectionNumber: probe.section, title: "Canonical provision"
  }));
  const currentID = catalog[0].id;
  const routed = await discover(probe.question, catalog);
  assert(routed.candidates.some((candidate) => candidate.sectionID === currentID), probe.question);
  assert(!routed.candidates.some((candidate) => candidate.sectionID === catalog[1].id), "Do not apply the reviewed 2022 route to same-number historical text.");
  const adjacent = await discover(probe.adjacent, catalog);
  assert(!adjacent.candidates.some((candidate) => candidate.sectionID === currentID), "An adjacent topic must not receive the technical route.");
  const restricted = await discover(probe.question, catalog.slice(1));
  assert.equal(restricted.candidates.length, 0, "An unavailable current source must not be synthesized or substituted from another edition.");
}
const savedFetch = globalThis.fetch;
const savedDiscovery = process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA;
let networkAttempts = 0;
try {
  process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
  globalThis.fetch = async () => { networkAttempts += 1; throw new Error("External calls forbidden in this source-scope regression."); };
  const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
  for (const room of ["bathroom", "sleeping room"]) {
    const assembled = await assembledResearchEvidenceForTurn({
      question: `Is a gas-fired appliance categorically prohibited in every ${room}?`,
      messages: [], pinnedEvidence: [], projectFacts: []
    });
    const root = assembled.sources.find((source) => source.codePrefix === "FGC" && source.sectionNumber === "303.3");
    const child = assembled.sources.find((source) => source.codePrefix === "FGC" && source.sectionNumber === "303.3.1");
    assert(root && child, "Both source scopes remain available in the actual assembled package.");
    assert.equal(root.evidencePriority.claimCoverageRequired, true);
    assert.match(root.text, /direct-vent[\s\S]*all combustion air[\s\S]*listing[\s\S]*manufacturer/i,
      "The complete applicable exception must survive scope changes.");
    assert.equal(child.evidencePriority.claimCoverageRequired, room === "sleeping room");
  }
  assert.equal(networkAttempts, 0);
} finally {
  globalThis.fetch = savedFetch;
  if (savedDiscovery === undefined) delete process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA;
  else process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = savedDiscovery;
}
console.log("Permitext technical source boundaries passed: paraphrases, adjacent topics, editions, restricted catalogs and full bathroom/sleeping-room assembly; no paid calls.");
