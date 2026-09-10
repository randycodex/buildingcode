import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchTopicDependencyPlan } from "../research-topic-dependencies.mjs";
import { assembleResearchEvidence, researchEvidenceAssemblyLimits } from "../research-evidence-assembly.mjs";

for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = () => { throw new Error("Occupancy dependency checks forbid network/provider calls."); };
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const definition = JSON.parse(await readFile(new URL("../evals/research-owner-code-candidates.json", import.meta.url))).cases.find(item => item.id === "GAP-14");
const question = definition.question;
const assembled = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts: [], pinnedEvidence: [] });
const source = number => assembled.sources.find(item => item.codePrefix === "AC" && item.sectionNumber === number);
const anchor = source("28-118.1");
const plan = researchTopicDependencyPlan({ question, sources: [anchor] });
assert.equal(plan.id, "nyc-2022-occupancy-certificate-alternatives");
assert.equal(plan.preserveGenericExpansion, true);
assert.equal(plan.references.length, 6);
for (const reference of plan.references) {
  const passage = source(reference.sectionNumber);
  assert(passage, reference.sectionNumber);
  assert(passage.canonicalContextComplete && !passage.truncated, reference.sectionNumber);
  assert.equal(passage.codeVersion, anchor.codeVersion);
  assert.equal(passage.corpusID, anchor.corpusID);
  assert.equal(passage.evidencePriority.claimCoverageRequired, false, "Reviewing an alternative cannot require discussing every eligibility condition in every answer.");
}
assert.equal(anchor.evidencePriority.claimCoverageRequired, true);
assert.match(source("28-118.15").text, /shall set a time period/);
assert.match(source("28-118.15").text, /will not endanger public safety, health, or welfare/);
assert.match(source("28-118.15.1").text, /Residential buildings with fewer than eight stories or fewer than four dwelling units/);
assert.match(source("28-118.15.1").text, /Parking structures/);
assert.match(source("28-118.15.1.1").text, /after an inspection by the commissioner/);
assert.match(source("28-118.15.1.2").text, /remain in effect until the issuance/);
assert.match(source("28-118.15.2").text, /revoke or suspend/);
assert.match(source("28-118.20").text, /prior to January 1, 1938/);
assert.match(source("28-118.20").text, /not otherwise required to have a certificate/);
assert(!assembled.limitations.some(item => item.kind === "topic-dependency-coverage-gap"));

for (const changed of [[], [anchor, anchor], ...[
  { canonicalContextComplete: false }, { truncated: true }, { text: "A certificate may sometimes be required." },
  { corpusID: "nyc-2014-construction-codes" }, { codeEdition: "2014 NYC Construction Codes" },
  { codeVersion: "" }, { jurisdiction: "" }, { sectionNumber: "28-118" }
].map(change => [{ ...anchor, ...change }])]) assert.equal(researchTopicDependencyPlan({ question, sources: changed }), null);
for (const otherQuestion of [
  "Where must a certificate of occupancy be posted?",
  "The project requires a Certificate of Occupancy. When does its final inspection take place?",
  "Context: DOB NOW workflow. Can I use this Certificate of Occupancy for the portal filing?",
  "Using only the selected certificate of occupancy passage, can the owner occupy the building?",
  "Can I use the final inspection report to request an LOC?"
]) assert.equal(researchTopicDependencyPlan({ question: otherQuestion, sources: [anchor] }), null);
for (const variant of [
  "May the tenant occupy the building without a Certificate of Occupancy?",
  "Is occupancy permitted before a Certificate of Occupancy is issued?",
  "Does passing inspection authorize occupancy before the Certificate of Occupancy arrives?"
]) assert.equal(researchTopicDependencyPlan({ question: variant, sources: [anchor] })?.id, plan.id);

// Exercise resolver identity, complete-section and budget gaps independently
// of today's discovery rankings. Never fill a missing source from memory.
const values = new Map(assembled.sources.map(item => [item.sectionNumber, { ...item, crossReferences: [] }]));
const build = async ({ replace = value => value, limits = researchEvidenceAssemblyLimits, extra = [] } = {}) =>
  assembleResearchEvidence({ question, previousMessages: [], projectFacts: [], pinnedEvidence: [], limits,
    discover: async () => ({ candidates: [anchor, ...extra].map(value => ({ ...value, selectedText: value.text })), limitations: [] }),
    resolveSection: async reference => {
      const value = reference.sectionNumber ? values.get(reference.sectionNumber) : [...values.values()].find(value => value.sectionID === reference.sectionID);
      return value ? replace(value) : null;
    } });
const complete = await build();
assert(!complete.limitations.some(item => item.kind === "topic-dependency-coverage-gap"));
assert.equal(complete.usage.topicDependencyCount, 6);
for (const replace of [
  value => value.sectionNumber === "28-118.15" ? null : value,
  value => value.sectionNumber === "28-118.15" ? { ...value, corpusID: "other-edition" } : value,
  value => value.sectionNumber === "28-118.15" ? { ...value, sectionNumber: "28-118.15.1" } : value,
  value => value.sectionNumber === "28-118.15" ? { ...value, text: "x".repeat(researchEvidenceAssemblyLimits.maximumCharactersPerSource + 1) } : value
]) {
  const missing = await build({ replace });
  const gap = missing.limitations.find(item => item.kind === "topic-dependency-coverage-gap");
  assert(gap?.text.includes("28-118.15"));
  assert(!missing.sources.some(item => item.sectionNumber === "28-118.15"));
}
const bounded = await build({ limits: { ...researchEvidenceAssemblyLimits, maximumTopicDependencies: 1 } });
assert.equal(bounded.usage.topicDependencyCount, 1);
assert(bounded.limitations.some(item => item.kind === "topic-dependency-coverage-gap"));
const governing = { ...source("28-118.15"), origin: "permitext_discovered", retrievalDepth: 0, relationship: "",
  signals: { exactTopicRouteTarget: true }, evidencePriority: { ...source("28-118.15").evidencePriority,
  evidenceRole: "governing", claimCoverageRequired: true, claimCoverageReason: "independently selected rule" } };
const independentlyRequired = await build({ extra: [governing] });
assert.equal(independentlyRequired.sources.find(item => item.sectionNumber === "28-118.15").evidencePriority.claimCoverageRequired, true);
console.log("Complete occupancy alternatives retained as review sources; scope, corpus, missing-source, budget and independent-governing controls passed. No provider calls or answer acceptance.");
