import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bindResearchNarrativeSources } from "../research-narrative-source-bindings.mjs";

globalThis.fetch = () => { throw new Error("Narrative binding replay forbids network/provider calls."); };
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json", import.meta.url)));
const result = run.results.find(item => item.id === "MC-05");
const answer = result.answer ?? result.response?.conversation?.messages?.at(-1)?.answer;
const evidence = answer.answerQuality.sources.map(({ reference, ...source }) => {
  const [codePrefix, sectionNumber] = reference.split(" ");
  return { ...source, codePrefix, sectionNumber };
});
const source = evidence.find(item => item.codePrefix === "MC" && item.sectionNumber === "606.4.2");
const original = structuredClone({ answer, evidence });
const repaired = bindResearchNarrativeSources(answer, evidence);
assert.equal(repaired.repairs.length, 1);
assert.equal(repaired.repairs[0].sourceID, source.sourceID);
assert.deepEqual(repaired.answer.citations.slice(0, -1), answer.citations);
assert.deepEqual({ ...repaired.answer, citations: answer.citations }, answer);
assert.deepEqual({ answer, evidence }, original);
assert.deepEqual(bindResearchNarrativeSources(repaired.answer, evidence), { answer: repaired.answer, repairs: [] });
assert.equal(repaired.answer.citations.at(-1).sectionID, source.sectionID);
assert.deepEqual(repaired.answer.citations.at(-1).sourceIDs, [source.sourceID]);

const otherSources = evidence.filter(item => item !== source);
for (const variant of [
  otherSources,
  [...evidence, source],
  [...evidence, { ...source, sourceID: "another-passage" }],
  [...evidence, { ...source, sourceID: "another-edition", codeVersion: "old-version" }],
  [...evidence, { ...source, codePrefix: "BC" }],
  [...evidence, { ...source, sourceID: "duplicate-section", sectionNumber: "606.4.3" }],
  ...[
    { text: "" }, { sourceID: "" }, { sectionID: "" }, { codePrefix: "BC" },
    { sectionNumber: "606.4" }, { sectionNumber: "606.4.2.1" },
    { evidenceRole: "contextual" }, { evidenceRole: "irrelevant" },
    { evidencePriority: { evidenceRole: "irrelevant" } },
    { evidencePriority: { topicRouteRelationship: "collateral" } },
    { topicRouteRelationship: "collateral" }
  ].map(change => [...otherSources, { ...source, ...change }])
]) assert.deepEqual(bindResearchNarrativeSources(answer, variant), { answer, repairs: [] });

for (const citation of [
  { sectionID: "conflicting-section", sourceIDs: [source.sourceID] },
  { sectionID: source.sectionID, sourceIDs: ["conflicting-source"] },
  { sectionID: "other-edition", sourceIDs: ["other-source"], codePrefix: "MC", sectionNumber: "606.4.2" }
]) {
  const variant = { ...answer, citations: [...answer.citations, citation] };
  assert.deepEqual(bindResearchNarrativeSources(variant, evidence), { answer: variant, repairs: [] });
}

for (const answerText of [
  "MC § 606.4.2 was not supplied and cannot be evaluated.",
  "The quoted question asks about MC § 606.4.2.",
  "The supplied rule refers to MC § 606.4.2 but does not establish its requirements.",
  "The rule incorporates MC § 606.4.2 by reference.",
  "For example, consult MC Table 606.4.2.",
  "MC § 606.4.2(1) requires a condition.",
  "The rule applies to 606.4.2 items.",
  "ZR § 42-00 was amended on December 15, 1961 and August 15, 1974."
]) {
  const variant = { ...answer, answerText };
  assert.deepEqual(bindResearchNarrativeSources(variant, evidence), { answer: variant, repairs: [] }, answerText);
}
for (const [codePrefix, sectionNumber] of [["BC", "1005.1"], ["PC", "403.1.3"], ["FGC", "406.4"], ["AC", "28-118.1"], ["ZR", "42-111"]]) {
  const passage = { ...source, codePrefix, sectionNumber, sourceID: "synthetic-reference", sectionID: "synthetic-section" };
  for (const answerText of [`${codePrefix} § ${sectionNumber} requires a stated condition.`,
    `The system is subject to ${codePrefix} § ${sectionNumber}, so the stated rule applies.`,
    `**${codePrefix} § ${sectionNumber}** expressly permits a stated alternative.`]) {
    const variant = { ...answer, answerText };
    const result = bindResearchNarrativeSources(variant, [passage]);
    assert.equal(result.repairs.length, 1, answerText);
    assert.equal(result.answer.answerText, answerText);
  }
}
console.log("Narrative reference resolved from retained evidence; absent/ambiguous/collateral/mismatched references remain unchanged. No API calls or semantic acceptance.");
