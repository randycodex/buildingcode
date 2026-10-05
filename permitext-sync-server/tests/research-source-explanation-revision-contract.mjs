import assert from "node:assert/strict";
import { researchTargetedRevisionEligible, researchRevisionAnswerHash,
  researchRevisionTargets, applyResearchTargetedRevision } from "../research-targeted-revision.mjs";

globalThis.fetch = () => { throw Error("Source explanation repair contracts forbid providers"); };
const answer = { answerText: "An independent condition remains. Any room is excluded.",
  supportedPoints: [{ heading: "Any room excluded", explanation: "Any room is excluded.", sourceIDs: ["rule"] }],
  citations: [{ sourceIDs: ["rule"], relevance: "An exclusion for any room.",
    supportingPassages: [{ selectedText: "Immutable enacted rule and conditions." }] }],
  conversationFacts: [{ text: "An unconfirmed proposed condition." }] };
const materialScopeReview = { packetHash: "a".repeat(64), unboundCategoricalApplication: false,
  checks: { rule: { categoricalApplication: false, sourceResult: "unsupported", relations: {} } } };
const previousVerification = { pass: false, reviewedAnswerHash: researchRevisionAnswerHash(answer), materialScopeReview };
const revisionFeedback = [{ type: "misstated_provision", detail: "The exception's subject is a building, not a room." },
  { type: "fact_evidence_confusion", detail: "The source explanation broadens the exception." }];
const options = { previousInterpretation: answer, previousVerification, revisionFeedback };
assert.equal(researchTargetedRevisionEligible(options), true);
for (const mutate of [
  o => { delete o.previousVerification; },
  o => { o.previousVerification.pass = true; },
  o => { o.previousVerification.reviewedAnswerHash = "b".repeat(64); },
  o => { o.previousInterpretation.answerText += " A changed claim."; },
  o => { o.previousVerification.materialScopeReview.unboundCategoricalApplication = true; },
  o => { o.previousVerification.materialScopeReview.checks.rule.categoricalApplication = true; },
  o => { delete o.previousVerification.materialScopeReview.checks.rule; },
  o => { o.previousVerification.materialScopeReview.checks.other = o.previousVerification.materialScopeReview.checks.rule; },
  o => { o.previousVerification.materialScopeReview.checks.rule.sourceResult = "supported"; },
  o => { o.previousVerification.materialScopeReview.packetHash = "stale"; },
  o => { o.revisionFeedback.push({ type: "unresolved_project_fact" }); },
  o => { o.revisionFeedback.push({ type: "unsupported_requirement" }); }
]) {
  const changed = structuredClone(options); mutate(changed);
  assert.equal(researchTargetedRevisionEligible(changed), false, "Unsafe, unbound or stale classifications keep full revision");
}
// False limitations can be repaired when bound uses are all supported; this
// does not license removing a real evidence gap or a project premise.
const limitation = structuredClone(options);
limitation.revisionFeedback = [{ type: "false_evidence_limitation", detail: "The supplied interpretation clause resolves the stated conflict." },
  { type: "unnecessary_qualification", detail: "No installation approval was requested." }];
limitation.previousVerification.materialScopeReview.checks.rule.sourceResult = "supported";
assert.equal(researchTargetedRevisionEligible(limitation), true);
for (const mutate of [
  o => { o.previousVerification.reviewedAnswerHash = "b".repeat(64); },
  o => { o.previousVerification.materialScopeReview.checks.rule.sourceResult = "evidence_gap_only"; },
  o => { o.previousVerification.materialScopeReview.checks.rule.categoricalApplication = true; },
  o => { delete o.previousVerification.materialScopeReview.checks.rule; },
  o => { o.previousVerification.materialScopeReview.unboundCategoricalApplication = true; },
  o => { o.revisionFeedback.push({ type: "unsupported_requirement" }); },
  o => { o.revisionFeedback.push({ type: "unresolved_project_fact" }); },
  o => { o.revisionFeedback.push({ type: "misstated_provision" }); }
]) {
  const changed = structuredClone(limitation); mutate(changed);
  assert.equal(researchTargetedRevisionEligible(changed), false);
}
const targets = researchRevisionTargets(answer);
const replacements = new Map([
  ["answerText", "Only an exclusively qualifying building is excluded."],
  ["supportedPoints/0/heading", "Building exception"],
  ["supportedPoints/0/explanation", "Only an exclusively qualifying building is excluded."],
  ["citations/0/relevance", "A building-level exception with its use condition."]
]);
const patch = { edits: targets.filter(t => t.text.includes("Any room") || t.path === "citations/0/relevance")
  .map(t => ({ targetID: t.id, after: replacements.get(t.path), remove: false })),
  bindingAdditions: [], pointRemovals: [], citationRemovals: [] };
const before = structuredClone(answer), after = applyResearchTargetedRevision(answer, patch, [{ sourceID: "rule" }]);
assert(after.answerText.startsWith("An independent condition remains."));
assert.equal(after.supportedPoints[0].heading, "Building exception");
assert.deepEqual(after.supportedPoints[0].sourceIDs, answer.supportedPoints[0].sourceIDs);
assert.deepEqual(after.citations[0].supportingPassages, answer.citations[0].supportingPassages);
assert.deepEqual(after.conversationFacts, answer.conversationFacts);
assert.deepEqual(answer, before);
assert.equal(researchTargetedRevisionEligible({ ...options, previousInterpretation: after }), false,
  "The old review cannot authorize another material patch of the changed answer");
console.log("Source explanation repair guard passed: complete noncategorical review bound to the unchanged answer, all prose representations editable, independent text/source/facts preserved; no semantic acceptance claim.");
