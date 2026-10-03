import assert from "node:assert/strict";
import { evaluateResearchWebAttribution, researchWebAttributionRevisionIssues } from "../research-web-attribution.mjs";

globalThis.fetch = async () => { throw new Error("No network in enacted-wording attribution contracts"); };

// Known handrail failure class: the definition's ordinary English is enacted
// content, not an assertion that an external guidance document creates a rule.
const definition = "A horizontal or sloping rail intended for grasping by the hand for guidance or support.";
const evidence = [{ sourceID: "bc-definition", sectionID: "bc-202", codePrefix: "BC", sectionNumber: "202",
  sourceType: "enacted_text", title: "Handrail definition", text: `HANDRAIL. ${definition}` }];
const answer = {
  supportedPoints: [{ heading: "Handrail definition", explanation: `BC § 202 defines a handrail as ${definition.toLowerCase()}`,
    sectionID: "bc-202", sourceIDs: ["bc-definition"] }],
  citations: [{ sectionID: "bc-202", sourceIDs: ["bc-definition"] }],
  supportingSourceUses: []
};
const evaluate = (changes = {}) => evaluateResearchWebAttribution({ answer, evidence, supportingSources: [], ...changes });
assert.equal(evaluate().pass, true, "A bound enacted definition is not web guidance because it contains the word guidance");
assert.deepEqual(researchWebAttributionRevisionIssues(evaluate()), []);
const original = structuredClone(answer);
evaluate();
assert.deepEqual(answer, original, "Attribution review must not change the answer or its bindings");

const paraphrase = structuredClone(answer);
paraphrase.supportedPoints[0].explanation = "The definition describes a rail intended for guidance or support.";
assert.equal(evaluate({ answer: paraphrase }).pass, true,
  "The local enacted wording can be preserved within a longer paraphrase");
assert.equal(evaluate({ evidence: [] }).pass, false, "A familiar phrase without supplied evidence receives no exemption");
assert.equal(evaluate({ evidence: [{ ...evidence[0], sourceID: "unbound-definition" }] }).pass, false,
  "Another available passage cannot establish this point's source provenance");
assert.equal(evaluate({ evidence: [{ ...evidence[0], text: "A handrail is provided on a stairway." }] }).pass, false,
  "The bound body must contain the actual local wording");
assert.equal(evaluate({ evidence: [{ ...evidence[0], text: "A handrail is provided on a stairway.", title: definition }] }).pass, false,
  "A source title alone cannot substantiate the ordinary enacted wording");
assert.equal(evaluate({ evidence: [{ ...evidence[0], sourceType: "official_guidance", authorityClass: "official_guidance" }] }).pass, false,
  "A web source cannot qualify as enacted evidence through a matching source ID");
assert.equal(evaluate({ evidence: [{ ...evidence[0], evidencePriority: { evidenceRole: "irrelevant" } }] }).pass, false);

const duplicatedDefinitionWebSource = [{ id: "web-definition", attributedClaims: [{ id: "repeats-definition", text: definition }] }];
assert.equal(evaluate({ supportingSources: duplicatedDefinitionWebSource }).pass, true,
  "A web page repeating the definition does not change the independently bound enacted provenance");

for (const text of [
  "DOB guidance requires a larger handrail.",
  "According to guidance, a larger handrail is required.",
  "Guidance requires a larger handrail.",
  "The guidance includes additional filing requirements.",
  "Buildings Bulletin 2022-013 requires additional review."
]) {
  const attributed = structuredClone(answer);
  attributed.supportedPoints[0].explanation = `${definition} ${text}`;
  const result = evaluate({ answer: attributed,
    evidence: [{ ...evidence[0], text: `${evidence[0].text} ${text}` }], deferLexicalOverlapToVerifier: true });
  assert.equal(result.pass, false, "Explicit attribution remains blocked even when those words occur in supplied text: " + text);
  assert.equal(result.guidanceSupportedPointMatches[0].reason, "explicit_guidance_attribution");
}
const mixedUses = structuredClone(answer);
mixedUses.supportedPoints[0].explanation += " More guidance on approvals is also relevant.";
assert.equal(evaluate({ answer: mixedUses }).pass, false,
  "An enacted occurrence cannot exempt a second, unsupported occurrence of guidance");

const webOnlyClaim = "A notarized access approval must accompany the application.";
const mixedWebClaim = structuredClone(answer);
mixedWebClaim.supportedPoints[0].explanation += ` ${webOnlyClaim}`;
const webSources = [{ id: "web-approval", attributedClaims: [{ id: "approval-claim", text: webOnlyClaim }] }];
const mixedResult = evaluate({ answer: mixedWebClaim, supportingSources: webSources });
assert.equal(mixedResult.pass, false, "Enacted wording does not exempt an appended web-only claim");
assert.equal(mixedResult.guidanceSupportedPointMatches[0].reason, "web_claim_overlap");
assert.deepEqual(mixedResult.guidanceSupportedPointMatches[0].bindings,
  [{ sourceID: "web-approval", claimID: "approval-claim" }]);
const deferred = evaluate({ answer: mixedWebClaim, supportingSources: webSources, deferLexicalOverlapToVerifier: true });
assert.equal(deferred.deferredOverlapMatches.length, 1, "The separate semantic-review path retains the real web overlap");

// No handrail-specific allowlist: another ordinary physical use requires the
// same exact bound-source proof and still receives no substantive approval.
const physicalWording = "Physical guidance markings remain visible.";
const physical = structuredClone(answer);
physical.supportedPoints[0].explanation = physicalWording;
assert.equal(evaluate({ answer: physical, evidence: [{ ...evidence[0], text: physicalWording }] }).pass, true);
assert.equal(evaluate({ answer: physical }).pass, false);

console.log("Enacted guidance wording contracts passed: exact bound-source phrases allowed; explicit guidance, missing provenance and real web-only overlap remain protected.");
