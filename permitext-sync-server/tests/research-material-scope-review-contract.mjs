import assert from "node:assert/strict";
import { buildResearchClaimScopeContext } from "../research-claim-applicability-review.mjs";
import { buildResearchMaterialScopeReviewPacket, researchMaterialScopeReviewSchema,
  validateResearchMaterialScopeReview } from "../research-material-scope-review.mjs";
import { researchAuthorityClassification } from "../app.mjs";
import { researchVerificationResultForWebContext } from "../research-web-attribution.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";
globalThis.fetch = () => { throw Error("Material-scope mechanics forbid providers."); };
const authority = { codePrefix: "FC", corpusID: "unrelated-fixture", codeVersion: "current-fixture", codeEdition: "2022" };
const rule = { ...authority, sourceID: "rule", sectionID: "rule-section", sectionNumber: "915.4",
  text: "Cabinets shall have a label.", evidencePriority: { evidenceRole: "governing" } };
const scope = { ...authority, sourceID: "scope", sectionID: "scope-section", sectionNumber: "915.1",
  text: "This chapter applies to equipment in shared corridors.", chapterScopeContext: true, anchorSourceIDs: ["rule"] };
const independent = { ...authority, sourceID: "action", sectionID: "action-section", sectionNumber: "912.2",
  text: "Damaged labels shall be replaced.", evidencePriority: { evidenceRole: "supporting" } };
const answer = { answerText: "The scenario requires a label. The actual-project rule remains conditional on its location. Replace the damaged label.",
  citations: [{ sourceIDs: ["rule"] }, { sourceIDs: ["action"] }], supportedPoints: [], missingFacts: [] };
const make = (changes = {}) => {
  const context = buildResearchClaimScopeContext({ question: "Assume a shared corridor. Is a label required?", answer,
    evidence: [rule, scope, independent], ...changes });
  return buildResearchMaterialScopeReviewPacket(context, changes.answer || answer);
};
const packet = make(), relation = packet.checks.find(check => check.sourceID === "rule").relationIDs[0];
assert.throws(() => make({ answer: { ...answer, citations: [{ sourceIDs: ["nonexistent"] }] } }), /not bound/);
assert.throws(() => make({ evidence: [rule, { ...scope, codeEdition: "2014" }, independent] }), /not bound/);
const outer = { ...authority, sourceID: "outer", sectionID: "outer-section", sectionNumber: "915",
  text: "This part applies only to occupied facilities.", applicabilityScopeAnchors: [{ sourceID: "scope" }] };
const ancestry = make({ evidence: [rule, scope, outer, independent] });
assert.equal(ancestry.checks.find(row => row.sourceID === "rule").relationIDs.length, 2,
  "A bound child must review its complete supplied parent/chapter ancestry, even when the parent is not cited.");
const witness = () => ({ packetHash: packet.packetHash, unboundCategoricalApplication: false, checks: {
  rule: { categoricalApplication: true, sourceResult: "supported", relations: { [relation]: "established" }, reason: "The stated scenario establishes the material corridor scope; the actual-project use stays conditional." },
  action: { categoricalApplication: true, sourceResult: "supported", relations: {}, reason: "The independent damaged-label duty is supported." }
} });
const check = (review = witness(), verification = { pass: true, issues: [], missingFactsOnly: false }, current = packet) =>
  validateResearchMaterialScopeReview({ packet: current, value: { materialScopeReview: review }, verification });
assert.equal(check().pass, true, "Same-source established scenario plus separately conditional actual use is representable.");
const conditional = witness(); conditional.checks.rule.categoricalApplication = false;
conditional.checks.rule.relations[relation] = "condition_preserved";
const conditionalAnswer = { ...answer, answerText: "If the cabinet is in a shared corridor, a label is required. Replace the damaged label." };
const conditionalPacket = make({ answer: conditionalAnswer }); conditional.packetHash = conditionalPacket.packetHash;
assert.equal(check(conditional, undefined, conditionalPacket).pass, true,
  "Conditional rule needs preserved source conditions, not fabricated human facts; independent action survives.");
for (const state of ["unsupported_application", "excluded_application"]) {
  const review = witness(); review.checks.rule.relations[relation] = state;
  const result = check(review, { pass: true, issues: [], missingFactsOnly: true, projectFactQuestions: ["An unrelated question?"] });
  assert.equal(result.pass, false); assert.equal(result.missingFactsOnly, false); assert.deepEqual(result.projectFactQuestions, []);
  assert(result.issues[0].detail.includes("rule:"));
  assert.equal(result.materialScopeReview.checks.action.sourceResult, "supported");
}
const contradictory = witness(); contradictory.checks.rule.relations[relation] = "condition_preserved";
assert.throws(() => check(contradictory), error => error.code === "INVALID_RESEARCH_VERIFICATION" &&
  error.failureStage === "verification_envelope_validation" &&
  error.verificationInvariant === "material_scope_categorical_condition_contradiction",
  "Contradictory flags require a fresh review; neither automatic support nor a fabricated legal issue.");
const unboundPacket = make({ answer: { ...conditionalAnswer, answerText: "Your installation is allowed. " + conditionalAnswer.answerText } });
const unbound = structuredClone(conditional); unbound.packetHash = unboundPacket.packetHash; unbound.unboundCategoricalApplication = true;
assert.equal(check(unbound, undefined, unboundPacket).pass, false, "Unsupported opening is checked independently of source flags.");
unbound.unboundCategoricalApplication = false;
assert.equal(check(unbound, undefined, unboundPacket).pass, true,
  "A false semantic flag remains a model-truth limitation; identity coverage is not semantic detection proof.");
for (const mutate of [
  r => { delete r.checks.rule; }, r => { r.checks.foreign = r.checks.rule; },
  r => { delete r.checks.rule.relations[relation]; }, r => { r.checks.rule.relations.foreign = "established"; },
  r => { r.packetHash = "0".repeat(64); }, r => { r.checks.rule.reason = ""; },
  r => { r.checks.rule.categoricalApplication = "yes"; }
]) {
  const review = witness(); mutate(review);
  assert.throws(() => check(review), error => error.code === "INVALID_RESEARCH_VERIFICATION" &&
    error.failureStage === "verification_envelope_validation");
}
for (const changes of [{ answer: { ...answer, answerText: "Changed after repair." } },
  { evidence: [{ ...rule, text: rule.text + " Exception." }, scope, independent] },
  { question: "Correction: the cabinet is in a private room." },
  { options: { projectContextFacts: ["Changed current fact."] } }])
  assert.throws(() => check(witness(), undefined, make(changes)), /not bound/);
const gapPacket = make({ evidence: [{ ...rule, chapterScopeContextGaps: [{ reference: "FC 915.1", reason: "scope_unavailable" }] }, independent] });
const gapRelation = gapPacket.checks[0].relationIDs[0];
const gap = witness(); gap.packetHash = gapPacket.packetHash; gap.checks.rule.relations = { [gapRelation]: "established" };
assert.equal(check(gap, undefined, gapPacket).pass, false, "Unavailable parent scope cannot be established by assertion.");
gap.checks.rule.categoricalApplication = false; gap.checks.rule.relations[gapRelation] = "condition_preserved";
assert.equal(check(gap, undefined, gapPacket).pass, true);
// An unavailable nomination is not an actual source gap when one complete,
// exact-authority source is already supplied. Parent text need not name its
// numbered child; availability never establishes its applicable conditions.
const gapIdentity = { ...authority, jurisdiction: "New York City", sectionID: "scope-section", sectionNumber: "915.1" };
const nominatedRule = { ...rule, jurisdiction: "New York City", parentScopeContextGaps: [{ reference: "FC 915.1", reason: "parent_scope_unavailable", identity: gapIdentity }] };
const suppliedScope = { ...scope, jurisdiction: "New York City", chapterScopeContext: false, canonicalContextResolved: true, canonicalContextComplete: true };
const availability = (extraEvidence = [suppliedScope], change = {}) => {
  const current = make({ evidence: [{ ...nominatedRule, ...change }, ...extraEvidence, independent] });
  const currentReview = witness(); currentReview.packetHash = current.packetHash;
  currentReview.checks.rule.relations = Object.fromEntries(current.checks.find(row => row.sourceID === "rule").relationIDs.map(id => [id, "established"]));
  return { current, currentReview, verdict: check(currentReview, undefined, current) };
};
const available = availability();
assert.equal(available.verdict.pass, true);
assert(available.current.graph.every(edge => !edge.gap));
assert(available.current.graph.some(edge => edge.scopeSourceID === suppliedScope.sourceID));
for (const [sourceID, expectedPass] of [[suppliedScope.sourceID, true], ["foreign-source", false]]) {
  const result = availability(undefined, { parentScopeContextGaps: [{ ...nominatedRule.parentScopeContextGaps[0],
    identity: { ...gapIdentity, sourceID } }] });
  assert.equal(result.verdict.pass, expectedPass, "An explicitly supplied source identity cannot redirect to another source.");
}
for (const state of ["unsupported_application", "excluded_application"]) {
  const review = structuredClone(available.currentReview);
  review.checks.rule.relations[available.current.checks[0].relationIDs[0]] = state;
  assert.equal(check(review, undefined, available.current).pass, false, "Supplied scope still requires a genuine semantic assessment.");
}
for (const changedScope of [null, { canonicalContextResolved: false }, { canonicalContextComplete: false }, { truncated: true },
  { discoveryPassageOnly: true }, { referenceOnly: true }, { textComplete: false }, { researchClaimEligible: false },
  { corpusID: "foreign" }, { codeEdition: "2014" }, { codeVersion: "stale" }, { jurisdiction: "Foreign City" },
  { sectionID: "different-section" }, { authorityClass: "guidance" }, { authorityStatus: "draft" },
  { body: { truncated: true } }, { body: { researchClaimEligible: false } },
  { body: { blocks: [{ plainText: "Incomplete context", truncated: true }] } },
  { pinnedSelectionExact: true }, { canonicalContextText: suppliedScope.text },
  { ...gapIdentity, corpusID: undefined }]) {
  const guarded = availability(changedScope === null ? [] : [{ ...suppliedScope, ...changedScope }]);
  assert.equal(guarded.verdict.pass, false, JSON.stringify(changedScope));
  assert(guarded.current.graph.some(edge => edge.gap));
  assert.notEqual(guarded.current.packetHash, available.current.packetHash);
  assert.throws(() => check(available.currentReview, undefined, guarded.current), /not bound/);
}
const duplicateScope = availability([suppliedScope, { ...suppliedScope, sourceID: "ambiguous-target" }]);
assert.equal(duplicateScope.verdict.pass, false, "Ambiguous equivalent targets stay a gap.");
for (const field of ["corpusID", "codePrefix", "codeEdition", "codeVersion"]) {
  const identity = { ...gapIdentity }; delete identity[field];
  assert.equal(availability(undefined, { parentScopeContextGaps: [{ ...nominatedRule.parentScopeContextGaps[0], identity }] }).verdict.pass, false);
}
const twoGaps = { ...nominatedRule, parentScopeContextGaps: [...nominatedRule.parentScopeContextGaps,
  { reference: "FC 916.1", reason: "parent_scope_unavailable", identity: { ...gapIdentity, sectionID: "absent", sectionNumber: "916.1" } }] };
const mixedAvailability = availability(undefined, twoGaps);
assert.equal(mixedAvailability.current.graph.filter(edge => edge.gap).length, 1);
assert.equal(mixedAvailability.verdict.pass, false, "Only the matching gap is reconciled; true missing scope cannot be established.");
const immutableInput = [nominatedRule, suppliedScope, independent], inputSnapshot = JSON.stringify(immutableInput);
const currentContext = buildResearchClaimScopeContext({ question: "Is a label required?", answer, evidence: immutableInput });
assert.equal(JSON.stringify(immutableInput), inputSnapshot, "Graph reconciliation does not modify evidence.");
const reconciledSource = currentContext.sources.find(source => source.sourceID === "rule");
assert.deepEqual(reconciledSource.parentScopeContextGaps, []);
assert.deepEqual(reconciledSource.reconciledScopeNominations[0].originalGap, nominatedRule.parentScopeContextGaps[0]);
assert.equal(reconciledSource.reconciledScopeNominations[0].suppliedScopeIdentity.sourceID, "scope");
const failed = witness(); failed.checks.rule.relations[relation] = "unsupported_application";
const webNoise = Array.from({ length: 12 }, () => ({ type: "wrong_attribution", detail: "The answer relies on supporting web guidance." }));
const processed = researchVerificationResultForWebContext(check(failed, { pass: false, issues: webNoise }),
  { webSupport: { sources: [] }, webAttribution: { pass: true } });
assert.equal(processed.pass, false); assert.equal(processed.issues[0].type, "fact_evidence_confusion");
const zeroPacket = make({ answer: { answerText: "Your project is allowed.", citations: [], supportedPoints: [] } });
assert.equal(zeroPacket.checks.length, 0);
const zeroReview = { packetHash: zeroPacket.packetHash, unboundCategoricalApplication: true, checks: {} };
assert.equal(check(zeroReview, undefined, zeroPacket).pass, false);
zeroReview.unboundCategoricalApplication = false;
assert.equal(check(zeroReview, undefined, zeroPacket).pass, true, "A false zero-source semantic flag remains a model-truth limitation.");
const explanationPacket = make({ answer: { answerText: "A source-free conversational explanation.", citations: [], supportedPoints: [] } });
assert.equal(check({ ...zeroReview, packetHash: explanationPacket.packetHash }, undefined, explanationPacket).pass, true,
  "A genuine source-free explanation remains possible.");
const baseSchema = { type: "object", additionalProperties: false, properties: { pass: { type: "boolean" } }, required: ["pass"] };
for (const current of [zeroPacket, packet]) {
  const schema = researchMaterialScopeReviewSchema(baseSchema, current);
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (node.enum) assert(node.enum.length > 0);
    if (node.type === "object") { assert.equal(node.additionalProperties, false); assert.deepEqual(node.required.slice().sort(), Object.keys(node.properties).sort()); }
    for (const child of Object.values(node)) if (typeof child === "object") Array.isArray(child) ? child.forEach(visit) : visit(child);
  }; visit(schema);
}
const support = check().materialScopeReview;
const citations = [{ sourceIDs: ["rule"], evidenceRole: "supporting" }, { sourceIDs: ["action"], evidenceRole: "supporting" }];
const classify = (review, used = citations) => researchAuthorityClassification({ citations: used, materialScopeReview: review });
assert.equal(classify(support).status, "supported_by_enacted_text");
const boundary = structuredClone(support); boundary.checks.rule.sourceResult = "evidence_gap_only"; boundary.checks.action.sourceResult = "evidence_gap_only";
assert.equal(classify(boundary).status, "insufficient_evidence", "Neighboring inspected citations alone do not establish responsive support.");
boundary.checks.action.sourceResult = "supported";
assert.equal(classify(boundary).status, "supported_by_enacted_text", "Real independent responsive partial support remains.");
assert.equal(classify(support, citations.slice(0, 1)).status, "supported_by_enacted_text", "Responsive source explanation needs no actual-project facts.");
const { buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const body = buildVerifierRequest("Assume a shared corridor. Is a label required?", [rule, scope, independent], answer, "offline");
assert.equal(body.max_output_tokens, 8000); assert.equal(body.reasoning.effort, "medium");
assert(body.text.format.schema.required.includes("materialScopeReview"));
assert(!body.text.format.schema.required.includes("claimApplicabilityReview"));
assert(body.input.includes(answer.answerText) && body.input.includes(scope.text));
assert.equal(body.text.format.schema.properties.materialScopeReview.properties.checks.required.length, 2);
const zeroBody = buildVerifierRequest("A source-free question.", [], { answerText: "A source-free explanation." }, "offline");
assert(zeroBody.text.format.schema.required.includes("materialScopeReview"));
assert.deepEqual(zeroBody.text.format.schema.properties.materialScopeReview.properties.checks.required, []);
assert.match(zeroBody.input, /MATERIAL SCOPE CHECKS\n\{[^\n]+"checks":\[\]\}/);
assert.match(zeroBody.instructions, /unboundCategoricalApplication=true/);
assert(!JSON.stringify(check().materialScopeReview).includes("shared corridor"), "Operational summary contains no source/fact/reason text.");
console.log("Material scope review mechanics passed: complete identities/relations, stale/foreign/missing rejects, categorical overrides, zero-source opener, mixed conditional/scenario/action, web cleanup, strict schema and responsive badge; no semantic proof.");
