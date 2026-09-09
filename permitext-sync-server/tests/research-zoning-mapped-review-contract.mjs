import assert from "node:assert/strict";
import { zoningConditionalExplanationVersion } from "../research-zoning-conditional-explanation.mjs";
import { planZoningMappedScopeReview, zoningMappedReviewSchema, validateZoningMappedScopeReview,
  resolveZoningMappedScopeSafety, hasExplicitZoningPropertyDetermination } from "../research-zoning-mapped-review.mjs";

globalThis.fetch = async () => { throw new Error("No network in map-scope review contracts."); };
const plan = { disposition: "conditional_source_explanation", path: "property_map_applicability",
  conditionalExplanation: { version: zoningConditionalExplanationVersion, determinationStatus: "unresolved" },
  callPolicy: { subjectiveVerification: true } };
const evidence = [{ sourceID: "source-a", sectionID: "42", codePrefix: "ZR", codeVersion: "snapshot-A", text: "Supplied source A." },
  { sourceID: "source-b", sectionID: "43", codePrefix: "ZR", text: "Supplied source B." }];
const answer = { answerText: "A property determination cannot be made from the supplied facts.",
  conclusion: "A property determination cannot be made from the supplied facts.",
  supportedPoints: [{ heading: "Generic rule", explanation: "The source describes conditional rules.", sourceIDs: ["source-a"] }],
  citations: [{ sourceIDs: ["source-a", "source-b"] }], missingFacts: ["Address and mapped district"] };
const safety = { pass: false, issues: [{ type: "zoning_missing_mapped_location", detail: "Uncertain lexical classification" }] };
const packet = planZoningMappedScopeReview({ plan, answer, evidence, safety });
assert(packet);
assert.equal(packet.units.length, 3);
assert.deepEqual(packet.units[0].fields, ["answerText", "conclusion"]);
assert(packet.units.some((unit) => unit.fields.includes("missingFacts")));
assert(!JSON.stringify(packet).includes(answer.answerText), "Use field pointers, not a second copy of the answer in the prompt.");
const review = { mappedScopeReview: { packetHash: packet.packetHash, units: packet.units.map((unit) => ({
  unitID: unit.id, classification: unit.id === "unit_1" ? "source_explanation" : "unresolved_boundary",
  sourceIDs: unit.id === "unit_1" ? ["source-a"] : [], reason: "Handwritten verifier double for protocol coverage only."
})) } };
const validate = (value = review, extra = {}) => validateZoningMappedScopeReview({ packet, value, answer, evidence,
  verification: { pass: true, issues: [] }, ...extra });
const verified = validate();
assert.equal(verified.pass, true);
assert.equal(resolveZoningMappedScopeSafety({ safety, packet, verification: verified, answer, evidence }).pass, true);
assert.deepEqual(resolveZoningMappedScopeSafety({ safety, packet, verification: verified, answer, evidence }).lexicalMapIssues, safety.issues);
assert.deepEqual(safety.issues, [{ type: "zoning_missing_mapped_location", detail: "Uncertain lexical classification" }]);
assert.equal(resolveZoningMappedScopeSafety({ safety, packet, verification: { pass: true }, answer, evidence }), safety,
  "An ordinary verifier pass cannot resolve an outstanding map finding.");
for (const mutate of [
  (v) => { delete v.mappedScopeReview; },
  (v) => { v.mappedScopeReview.packetHash = "stale"; },
  (v) => { v.mappedScopeReview.units.pop(); },
  (v) => { v.mappedScopeReview.units[1].unitID = "unknown"; },
  (v) => { v.mappedScopeReview.units[1].unitID = "unit_0"; },
  (v) => { v.mappedScopeReview.units[1].sourceIDs = []; },
  (v) => { v.mappedScopeReview.units[1].sourceIDs = ["source-b"]; },
  (v) => { v.mappedScopeReview.units[1].sourceIDs = ["invented"]; },
  (v) => { v.mappedScopeReview.units[1].reason = " "; },
  (v) => { v.mappedScopeReview.units[1].classification = "project_determination"; },
  (v) => { v.mappedScopeReview.units[1].classification = "uncertain"; }
]) {
  const invalid = structuredClone(review); mutate(invalid);
  const result = validate(invalid);
  assert.equal(result.pass, false);
  assert(result.issues.some((issue) => issue.type === "fact_evidence_confusion"));
  assert.equal(resolveZoningMappedScopeSafety({ safety, packet, verification: result, answer, evidence }), safety);
}
const rejection = validate(review, { verification: { pass: false, issues: [{ type: "incorrect_citation", detail: "Unsupported source rule." }] } });
assert.equal(rejection.pass, false);
assert.equal(resolveZoningMappedScopeSafety({ safety, packet, verification: rejection, answer, evidence }), safety);
for (const extra of [
  { answer: { ...answer, answerText: "This property is approved." } },
  { answer: { ...answer, missingFacts: [] } },
  { evidence: evidence.map((item) => ({ ...item, codeVersion: "another-edition" })) },
  { evidence: evidence.map((item) => ({ ...item, codeEdition: "another-edition" })) },
  { evidence: evidence.map((item) => ({ ...item, corpusID: "another-corpus" })) },
  { evidence: evidence.map((item) => ({ ...item, sectionNumber: "another-section" })) },
  { evidence: evidence.map((item) => ({ ...item, text: "Changed text" })) },
  { packet: { ...packet, units: packet.units.slice(1) } }
]) {
  assert.equal(validate(review, extra).pass, false);
  assert.equal(resolveZoningMappedScopeSafety({ safety, packet, verification: verified, answer, evidence, ...extra }), safety);
}
const unrelated = { ...safety, issues: [...safety.issues, { type: "zoning_table_binding", detail: "Other defect" }] };
assert.equal(resolveZoningMappedScopeSafety({ safety: unrelated, packet, verification: verified, answer, evidence }).pass, false);
assert.equal(planZoningMappedScopeReview({ plan, answer, evidence, safety: unrelated }), null);
for (const changedPlan of [undefined, { ...plan, disposition: "ready" }, { ...plan, callPolicy: { subjectiveVerification: false } },
  { ...plan, path: "effective_date_history" }]) assert.equal(planZoningMappedScopeReview({ plan: changedPlan, answer, evidence, safety }), null);
for (const claim of ["The property is approved.", "The proposed facility is not permitted as-of-right.",
  "The owner may proceed.", "This applies to the project.", "This site is in Subarea 1.",
  "Cannot determine whether the property is approved, but the owner may proceed."]) {
  const unsafe = { ...answer, answerText: `${answer.answerText} ${claim}` };
  assert(hasExplicitZoningPropertyDetermination(unsafe), claim);
  assert.equal(planZoningMappedScopeReview({ plan, answer: unsafe, evidence, safety }), null, claim);
}
assert(!hasExplicitZoningPropertyDetermination({ answerText: "Cannot determine whether the proposed facility is permitted as-of-right from the supplied facts." }));
const base = { properties: { pass: { type: "boolean" } }, required: ["pass"] };
assert.equal(zoningMappedReviewSchema(base), base);
assert(zoningMappedReviewSchema(base, packet).required.includes("mappedScopeReview"));
console.log("Map-scope review protocol passed: exact answer/evidence binding, complete per-unit verdicts, source bounds, rejection and stale/malformed controls; no semantic quality claim or API calls.");
