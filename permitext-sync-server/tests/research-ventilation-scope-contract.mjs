import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in ventilation scope checks."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const baseline = JSON.parse(await readFile(new URL("../evals/results/research-owner-full-scope-temporal-2026-09-08.json", import.meta.url))).results.find((item) => item.id === "MC-01");
const reference = (source) => `${source.codePrefix} ${source.sectionNumber}`;
const hash = (text) => createHash("sha256").update(text).digest("hex");
const input = { question: baseline.question, projectFacts: [], messages: [], pinnedEvidence: [] };
const actual = await assembledResearchEvidenceForTurn(input);
const retainedReferences = actual.sources.map(reference);
for (const required of ["MC 401.2", "MC 403.1", "MC 403.3.1.1", "MC 501.3", "MC 501.3.1"]) {
  const source = actual.sources.find((source) => reference(source) === required);
  assert(source, required);
  assert.equal(hash(source.text), baseline.sources.find((source) => source.reference === required).textSHA256, required);
}
for (const unrelated of ["BC 1107.2.4", "BC 1109.13.1", "BC 917.1", "BC 1203.5.1.3", "BC 1203.5.1.4."]) {
  assert(!retainedReferences.includes(unrelated), unrelated);
}
assert(actual.sources.find((source) => reference(source) === "MC 401.2").canonicalContextComplete);
assert.match(actual.sources.find((source) => reference(source) === "MC 401.2").text, /Every habitable space shall be naturally ventilated/);
assert.match(actual.sources.find((source) => reference(source) === "MC 403.1").text, /shall not prevent doors from closing/);
assert(actual.sources.find((source) => reference(source) === "MC 403.3.1.1").richSourceGrids.length);
const definitions = actual.sources.find((source) => reference(source) === "BC 202");
for (const label of ["HABITABLE SPACE", "OCCUPIABLE SPACE", "VENTILATION"]) {
  assert(definitions.targetedDefinition.labels.includes(label), label);
}
const habitable = definitions.targetedDefinition.passages.find((text) => text.startsWith("HABITABLE SPACE."));
assert.match(habitable, /Exception:[\s\S]*1\.[\s\S]*2\.[\s\S]*3\.[\s\S]*4\.[\s\S]*5\.[\s\S]*New York City Housing Maintenance Code/);
assert(actual.usage.nonMaterialCandidateCount > 0);
assert(actual.usage.characterCount < baseline.usage.characterCount * .75);
assert.equal(actual.limits.maximumCharacters, 48000, "Reduce irrelevant matches, not the permitted evidence budget.");

for (const question of [
  "Our new air-conditioned shop has operable windows. Can natural ventilation satisfy its ventilation obligation?",
  "A new studio will have air conditioning and large windows. Is natural ventilation enough for the code-required ventilation?"
]) {
  const result = await assembledResearchEvidenceForTurn({ ...input, question });
  for (const rule of ["MC 401.2", "MC 403.1"]) assert(result.sources.some((source) => reference(source) === rule), rule);
  assert(result.usage.nonMaterialCandidateCount > 0, question);
}

// Injected discovery isolates the scope boundary from changing search rank.
// Canonical text and explicit cross-references still use normal assembly.
const identity = { codeEdition: "2022 New York City Construction Codes", codeVersion: "2022#1", corpusID: "nyc-2022-construction-codes", jurisdiction: "New York City" };
const rows = [
  ["m401", "MC", "401.2", "All habitable spaces and occupiable spaces provided with air conditioning shall be mechanically ventilated in accordance with Section 403."],
  ["m403", "MC", "403.1", "Mechanical ventilation shall be provided by a method of supply air and return or exhaust air. Door forces shall comply with BC 1010.1.3."],
  ["b1107", "BC", "1107.2.4", "Controls for operable windows shall be accessible."],
  ["b1010", "BC", "1010.1.3", "This complete door force provision remains available through the governing mechanical passage."],
  ["b917", "BC", "917.1", "This is a fire-system provision, not a ventilation requirement."]
].map(([sectionID, codePrefix, sectionNumber, text], index) => ({ ...identity, sectionID, codePrefix, sectionNumber, selectedText: text, text, rank: index + 1,
  signals: { exactTopicRouteTarget: codePrefix === "MC", topicRoutes: codePrefix === "MC" ? ["mechanical ventilation of air-conditioned occupiable spaces"] : [] } }));
const simulated = async ({ question = baseline.question, candidates = rows.filter((row) => row.sectionID !== "b1010"), pins = [] } = {}) =>
  assembleResearchEvidence({ question, pinnedEvidence: pins,
    discover: async () => ({ candidates }),
    resolveSection: async (request) => {
      const row = rows.find((item) => item.sectionID === request.sectionID || (item.codePrefix === request.codePrefix && item.sectionNumber === request.sectionNumber));
      if (!row) return null;
      return { ...row, canonicalText: row.text, crossReferences: row.sectionID === "m403" ? [{ codePrefix: "BC", sectionNumber: "1010.1.3" }] : [] };
    } });
const focused = await simulated();
assert(!focused.sources.some((source) => source.sectionID === "b1107"));
assert(focused.sources.some((source) => source.sectionID === "b1010"), "A governing mechanical passage can still bring in an enacted Building Code cross-reference.");
for (const modification of [
  (values) => values.filter((candidate) => candidate.sectionID !== "m401"),
  (values) => values.map((candidate) => ({ ...candidate, selectedText: "Unresolved heading" })),
  (values) => values.map((candidate) => ({ ...candidate, codeEdition: "2014 New York City Construction Codes" })),
  (values) => values.map((candidate) => candidate.sectionID === "m401" ? { ...candidate, codeVersion: "different-edition" } : candidate),
  (values) => values.map((candidate) => ({ ...candidate, corpusID: "" })),
  (values) => values.map((candidate) => candidate.sectionID === "b917" ? { ...candidate, signals: { exactTopicRouteTarget: true } } : candidate)
]) {
  const result = await simulated({ candidates: modification(rows) });
  assert(result.sources.some((source) => source.sectionID === "b1107"), "Missing/mismatched anchors and mixed routes retain ordinary retrieval.");
}
for (const signal of ["exactReference", "contextualReference"]) {
  const result = await simulated({ candidates: rows.map((row) => row.sectionID === "b1107" ? { ...row, signals: { [signal]: true } } : row) });
  assert(result.sources.some((source) => source.sectionID === "b1107"), signal);
}
const pinned = await simulated({ pins: [{ sectionID: "b1107", selectedText: rows.find((row) => row.sectionID === "b1107").text }] });
assert(pinned.sources.some((source) => source.sectionID === "b1107" && source.origin === "user_pinned"));
for (const question of [
  "The office has no air conditioning. Can its windows satisfy natural ventilation?",
  "An air-conditioned residential dwelling has windows. Can it use natural ventilation?",
  "Under the Building Code and Mechanical Code, can an air-conditioned office rely on windows for natural ventilation?",
  `${baseline.question} Also explain the lighting requirements.`,
  `${baseline.question} Calculate the required outdoor airflow.`,
  `${baseline.question} Explain the bathroom exhaust requirements.`,
  baseline.question.replace("new office", "existing office"),
  "How high must the controls of windows be in an air-conditioned office?"
]) {
  const result = await simulated({ question });
  assert(result.sources.some((source) => source.sectionID === "b1107"), question);
}
console.log(JSON.stringify({ case: "MC-01", previousSources: baseline.sources.length, currentSources: actual.sources.length,
  previousEvidenceCharacters: baseline.usage.characterCount, currentEvidenceCharacters: actual.usage.characterCount,
  completeVentilationRulesAndTableTextPreserved: true, requestSpeedMeasured: false, paidProviderCalls: 0 }));
