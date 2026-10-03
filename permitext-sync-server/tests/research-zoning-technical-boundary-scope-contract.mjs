import assert from "node:assert/strict";
import { evaluateZoningResearchSafety } from "../research-zoning-safety.mjs";

globalThis.fetch = async () => { throw new Error("No providers in scope contracts."); };

// Invented provisions test authority/scope boundaries, not enacted answers.
const technical = (codePrefix = "BC", extra = {}) => ({
  sourceID: "technical", codePrefix, corpusID: `test-${codePrefix.toLowerCase()}`,
  sectionNumber: "999.1", title: "Clearance",
  text: "A clear opening must be at least 8 feet high.",
  textComplete: true, canonicalContextComplete: true, truncated: false,
  evidencePriority: { evidenceRole: "governing" }, ...extra
});
const incidental = {
  sourceID: "incidental-zoning", codePrefix: "ZR", corpusID: "nyc-zoning-resolution",
  sectionNumber: "88-90", title: "Unrelated zoning table",
  text: "An unrelated zoning table provides dimensional limits.",
  evidencePriority: { evidenceRole: "irrelevant" }
};
const question = "Does this 7-foot clear opening meet the height requirement?";
const answer = (extra = {}) => ({
  answerText: "No. This opening is not compliant with the required 8-foot clear height; the stated 7 feet is 1 foot short.",
  conclusion: "No.", explanation: "",
  supportedPoints: [{ heading: "Clear height", explanation: "The rule requires 8 feet, not the proposed 7 feet.", sourceIDs: ["technical"] }],
  citations: [{ sourceIDs: ["technical"] }], missingFacts: [], evidenceLimitations: [],
  ...extra
});
const check = (proposal = answer(), evidence = [technical(), incidental], request = question, questionPlan = null) =>
  evaluateZoningResearchSafety({ question: request, evidence, answer: proposal, questionPlan });

for (const code of ["BC", "FC", "PC", "MC", "FGC", "AC"]) {
  for (const limitation of [
    "Zoning applicability is not determined by this technical answer.",
    "This answer does not establish zoning compliance.",
    "The zoning requirements have not been assessed in this review."
  ]) {
    const result = check(answer({ evidenceLimitations: [limitation] }), [technical(code), incidental]);
    assert.equal(result.applies, false, `${code}: ${limitation}`);
    assert.equal(result.pass, true);
    assert.equal(result.scopeDecision.ancillaryBoundaryCount, 1);
    assert.equal(result.scopeDecision.eligibleTechnicalSourceCount, 1);
    assert.deepEqual(result.scopeDecision.reasonCodes, ["eligible_technical_bindings"]);
  }
}

// A complete selected technical passage still proves the technical rule family.
assert.equal(check(answer({ evidenceLimitations: ["Zoning applicability is not determined."] }),
  [technical("BC", { origin: "user_pinned" }), incidental]).applies, false);
const completeChild = check(answer({ evidenceLimitations: ["Zoning applicability is not determined."] }),
  [technical("BC", { scopeComplete: true, textComplete: true, canonicalContextComplete: false }), incidental]);
assert.equal(completeChild.applies, false, "A complete atomic child remains a technical binding without its whole canonical parent.");
assert.equal(completeChild.scopeDecision.bindingRejections.incomplete, 0);

for (const limitation of [
  "Zoning applicability is not determined. The property is nevertheless approved under zoning.",
  "Zoning applicability is not determined, but the site may proceed as-of-right.",
  "Zoning does not apply to this property.",
  "No zoning permit is required for this project.",
  "The property is outside the mapped zoning district.",
  "Zoning approval has not been obtained for this project."
]) {
  const result = check(answer({ evidenceLimitations: [limitation] }));
  assert.equal(result.applies, true, limitation);
  assert.equal(result.scopeDecision.ancillaryBoundaryCount, 0, limitation);
}
const mixedPoint = answer({ supportedPoints: [
  ...answer().supportedPoints,
  { heading: "Zoning", explanation: "This use is permitted as-of-right.", sourceIDs: ["technical"] }
] });
assert(check(mixedPoint).issues.some(issue => issue.type === "zoning_unbound_conclusion"));
assert.equal(check(answer({ citations: [{ sourceIDs: ["technical", "incidental-zoning"] }] })).applies, true);

// Genuine global approvals and denials remain reviewed, even with valid BC text.
for (const statement of ["The project is approved.", "The property is not approved.", "The project is not compliant."]) {
  const result = check(answer({ answerText: statement, evidenceLimitations: ["Zoning applicability is not determined."] }));
  assert.equal(result.applies, true, statement);
  assert(result.scopeDecision.reasonCodes.includes("categorical_project_approval"), statement);
}
assert.equal(check(answer(), undefined, "Under zoning, does the opening comply?").applies, true);
assert.equal(check(answer(), undefined, question, { path: "property_map_applicability" }).applies, true);

// Missing, reference-only and incomplete bindings cannot prove a narrow exemption.
for (const extra of [
  { signals: { contextualReference: true } },
  { evidencePriority: { evidenceRole: "contextual" } },
  { evidenceRole: "irrelevant", evidencePriority: null },
  { referenceOnly: true }, { selectionMode: "section_reference" },
  { textComplete: false },
  { sourceCompletenessReview: { textComplete: false } }, { truncated: true },
  { text: "" }, { corpusID: "nyc-zoning-resolution" }
]) {
  const result = check(answer({ evidenceLimitations: ["Zoning applicability is not determined."] }),
    [technical("BC", extra), incidental]);
  assert.equal(result.applies, true, JSON.stringify(extra));
  assert.equal(result.scopeDecision.eligibleTechnicalSourceCount, 0);
  assert(result.scopeDecision.reasonCodes.includes("ineligible_technical_binding"));
}
const missing = check(answer({ citations: [{ sourceIDs: ["technical", "absent"] }] }));
assert.equal(missing.applies, true);
assert.equal(missing.scopeDecision.missingBindingCount, 1);
assert.equal(check(answer({ citations: [], supportedPoints: [] })).applies, true);

const pinned = { ...incidental, origin: "user_pinned", richSourceGrids: [{ rows: [["Category", "Limit"]] }] };
const pinResult = check(answer({ evidenceLimitations: ["Zoning applicability is not determined."] }), [technical(), pinned]);
assert.equal(pinResult.applies, true);
assert.equal(pinResult.scopeDecision.pinnedZoningSourceCount, 1);
assert(pinResult.issues.some(issue => issue.type === "zoning_table_binding"));

// Full evidenceLimitations remain in substantive history audits, not only scope.
const historySource = { ...incidental, text: "Current amendment-history metadata does not reproduce prior enacted text." };
const historyQuestion = "Can current amendment-history metadata reconstruct the Zoning text in force on a historical date?";
const historyAnswer = answer({
  answerText: "The supplied material lists current metadata.", conclusion: "Current metadata only.",
  supportedPoints: [], citations: [{ sourceIDs: ["incidental-zoning"] }]
});
assert(check(historyAnswer, [historySource], historyQuestion).issues.some(issue => issue.type === "zoning_amendment_history_boundary"));
assert(!check({ ...historyAnswer, evidenceLimitations: [
  "Current metadata cannot reconstruct historical enacted text; dated archived sources must be verified."
] }, [historySource], historyQuestion).issues.some(issue => issue.type === "zoning_amendment_history_boundary"));

const diagnostic = check(answer({ evidenceLimitations: ["Zoning rules permit this project."] }));
assert.equal(diagnostic.attemptDiagnostic.kind, "zoning_answer_scope");
assert.equal(diagnostic.attemptDiagnostic.nonZoningExemption, false);
assert(diagnostic.attemptDiagnostic.reasonCodes.includes("operative_zoning_limitation"));
const serialized = JSON.stringify(diagnostic.attemptDiagnostic);
assert.doesNotMatch(serialized, /7-foot|8-foot|Clear height|Zoning rules permit|999\.1|incidental-zoning/);
for (const value of Object.values(diagnostic.attemptDiagnostic.bindingRejections)) {
  assert(Number.isInteger(value) && value >= 0);
}

console.log("Technical zoning-boundary scope passed: valid bindings, epistemic boundaries, mixed and pinned zoning, approval denials, incomplete references, history audits and safe diagnostics; no providers.");
