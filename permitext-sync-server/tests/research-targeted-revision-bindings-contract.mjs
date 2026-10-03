import assert from "node:assert/strict";
import {
  applyResearchTargetedRevision,
  researchRevisionTargets
} from "../research-targeted-revision.mjs";

globalThis.fetch = async () => { throw new Error("No external calls in targeted binding contracts"); };
const { normalizeResearchInterpretationEvidenceBindings: normalize } = await import("../app.mjs");

// Shape of fresh-dev-05-exhaust-3's second revision: prose was already corrected
// to the independently supporting provision, but the withdrawn source remained
// attached to the point and the normalizer recreated its citation.
const evidence = [
  { sourceID: "discharge", sectionID: "10454", codePrefix: "MC", sectionNumber: "501.3" },
  { sourceID: "domestic", sectionID: "10603", codePrefix: "MC", sectionNumber: "505.1" },
  { sourceID: "additional", sectionID: "third", codePrefix: "MC", sectionNumber: "777.3" }
];
const draft = {
  answerText: "The exception in MC § 501.3 requires installation according to the manufacturer's instructions and ventilation otherwise provided under Chapter 4.",
  supportedPoints: [{
    heading: "Ductless-hood exception",
    explanation: "MC § 501.3 states the exception with both installation and ventilation conditions.",
    sectionID: "10454", sourceIDs: ["discharge", "domestic"]
  }],
  citations: [
    { sectionID: "10454", sourceIDs: ["discharge"], relevance: "The exception and its conditions." },
    { sectionID: "10603", sourceIDs: ["domestic"], relevance: "The same unqualified exception." }
  ],
  conversationFacts: [{ text: "The proposed hood is listed and labeled." }],
  evidenceLimitations: ["This is limited to the stated discharge question."]
};
const original = structuredClone(draft);
const removal = { edits: [], citationRemovals: [1] };
const revised = applyResearchTargetedRevision(draft, removal, evidence);
assert.deepEqual(draft, original, "Do not mutate the rejected draft");
assert.deepEqual(revised.supportedPoints[0].sourceIDs, ["discharge"]);
assert.deepEqual(revised.citations, [draft.citations[0]]);
assert.equal(revised.answerText, draft.answerText, "Keep every stated condition");
assert.equal(revised.supportedPoints[0].explanation, draft.supportedPoints[0].explanation);
assert.deepEqual(revised.conversationFacts, draft.conversationFacts);
assert.deepEqual(revised.evidenceLimitations, draft.evidenceLimitations);
assert.deepEqual(normalize(revised, evidence).citations, revised.citations,
  "Normalization must not resurrect the withdrawn citation from a stale point binding");

const editOnly = { edits: [{ targetID: researchRevisionTargets(draft)[0].id,
  after: "The supplied exception retains its installation and ventilation conditions.", remove: false }] };
assert.deepEqual(applyResearchTargetedRevision(draft, editOnly, evidence).supportedPoints, draft.supportedPoints,
  "Prose changes alone do not authorize source removal");

const shared = structuredClone(draft);
shared.citations.push({ sectionID: "10603", sourceIDs: ["domestic"], relevance: "Separate supported qualification." });
assert.deepEqual(applyResearchTargetedRevision(shared, removal, evidence).supportedPoints, shared.supportedPoints,
  "A surviving citation keeps the shared source binding");
assert.deepEqual(applyResearchTargetedRevision(shared, { edits: [], citationRemovals: [1, 2] }, evidence)
  .supportedPoints[0].sourceIDs, ["discharge"], "Withdraw only after all citations for the source are removed");

const unrelated = structuredClone(draft);
unrelated.supportedPoints[0].sourceIDs.push("unrelated-existing-binding");
assert.deepEqual(applyResearchTargetedRevision(unrelated, removal, evidence).supportedPoints[0].sourceIDs,
  ["discharge", "unrelated-existing-binding"], "Do not sweep unrelated uncited or invalid bindings into this repair");

const soleSupport = structuredClone(draft);
soleSupport.supportedPoints.push({ heading: "Separate claim", explanation: "A separate claim needs its own support.",
  sectionID: "10603", sourceIDs: ["domestic"] });
assert.throws(() => applyResearchTargetedRevision(soleSupport, removal, evidence), { code: "INVALID_RESEARCH_RESPONSE" },
  "Do not leave any surviving claim without evidence");
assert.deepEqual(applyResearchTargetedRevision(soleSupport, { ...removal, pointRemovals: [1] }, evidence)
  .supportedPoints, revised.supportedPoints, "Explicit point removal permits removal of its only citation");

const replacement = applyResearchTargetedRevision(soleSupport, { ...removal,
  bindingAdditions: [{ pointIndex: 1, sourceIDs: ["additional"] }] }, evidence);
const normalizedReplacement = normalize(replacement, evidence);
assert.deepEqual(normalizedReplacement.supportedPoints[1].sourceIDs, ["additional"]);
assert.equal(normalizedReplacement.supportedPoints[1].sectionID, "third");
assert(normalizedReplacement.citations.some(citation => citation.sourceIDs.includes("additional")),
  "Existing normalization can bind a supplied replacement; substantive verification still decides support");
assert.throws(() => applyResearchTargetedRevision(draft, { ...removal,
  bindingAdditions: [{ pointIndex: 0, sourceIDs: ["domestic"] }] }, evidence), { code: "INVALID_RESEARCH_RESPONSE" },
  "A patch cannot both withdraw and add back the same source");

const mandatoryEvidence = evidence.map(source => source.sourceID === "domestic"
  ? { ...source, evidencePriority: { claimCoverageRequired: true } } : source);
assert.throws(() => applyResearchTargetedRevision(draft, removal, mandatoryEvidence), { code: "INVALID_RESEARCH_RESPONSE" },
  "Explicit citation deletion cannot bypass mandatory source coverage");
assert.deepEqual(applyResearchTargetedRevision(shared, removal, mandatoryEvidence).supportedPoints, shared.supportedPoints,
  "Removing a duplicate citation can preserve required coverage through the surviving citation");

// A remaining explicit source reference is not proof that its source became
// unnecessary. Normalization must continue binding it for full verification.
const explicit = structuredClone(draft);
explicit.supportedPoints[0].explanation += " MC § 505.1 adds a separate qualification.";
const rebound = normalize(applyResearchTargetedRevision(explicit, removal, evidence), evidence);
assert(rebound.supportedPoints[0].sourceIDs.includes("domestic"));
assert(rebound.citations.some(citation => citation.sourceIDs.includes("domestic")),
  "Citation deletion must not disable explicit-reference evidence checks");

console.log("Targeted citation dependency cleanup passed: stale bindings removed, shared and mandatory support protected, prose and verification bindings preserved.");
