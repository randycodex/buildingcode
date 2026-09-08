import assert from "node:assert/strict";
import {
  researchOfficialGuidanceSummaryInput,
  researchOfficialGuidanceSummaryInterpretation,
  researchOfficialGuidanceSummaryRequest,
  researchOfficialGuidanceSummaryProof,
  hasVerifiedResearchOfficialGuidanceSummary
} from "../research-official-guidance-summary.mjs";
import { evaluateResearchWebAttribution } from "../research-web-attribution.mjs";
import { immutableResearchAnswer, ownerScope } from "../project-foundation-contract.mjs";

const hash = "a".repeat(64);
const webSupport = { sources: [{
  id: "notice", title: "Official service notice", url: "https://www.nyc.gov/notice.pdf",
  sourceValidation: "official_pdf", sourceContentHash: hash, controlling: false,
  authorityClass: "official_guidance", role: "supporting",
  extractionLimitations: ["Page 3 has no readable text."],
  attributedClaims: [
    { id: "review", text: "New filings use Standard Plan Review; review does not itself grant a permit.", verbatimText: "New filings use Standard Plan Review; review does not itself grant a permit.", contentHash: hash, pageNumber: 1, sourceURL: "https://www.nyc.gov/notice.pdf#page=1" },
    { id: "waiver", text: "A document waiver is available only if the determination establishes that no permit is needed.", contentHash: hash, pageNumber: 2, sourceURL: "https://www.nyc.gov/notice.pdf#page=2" }
  ]
}, {
  id: "other", title: "Other official notice", url: "https://www.nyc.gov/other.html",
  sourceValidation: "official_html", sourceContentHash: hash, controlling: false,
  attributedClaims: [{ id: "other-claim", text: "An unrelated filing workflow.", contentHash: hash }]
}] };
const snapshot = structuredClone(webSupport);
const draft = { paragraphs: [{
  text: "Use Standard Plan Review for the new filing. Review does not itself grant the permit.",
  sourceUses: [{ sourceID: "notice", claimID: "review" }]
}], missingFacts: [], evidenceLimitations: [] };
const answer = researchOfficialGuidanceSummaryInterpretation(draft, webSupport);
assert.match(answer.answerText, /Review does not itself grant the permit/);
assert.match(answer.answerText, /#page=1/);
assert.doesNotMatch(answer.answerText, /document waiver|other\.html/);
assert.match(answer.answerText, /noncontrolling/);
assert.equal(answer.supportingSourceUses[0].claim, webSupport.sources[0].attributedClaims[0].text);
assert.equal(answer.supportingSources[0].attributedClaims[0].verbatimText, webSupport.sources[0].attributedClaims[0].verbatimText);
assert.deepEqual(answer.citations, []);
assert.deepEqual(answer.supportedPoints, []);
assert(answer.evidenceLimitations.includes("Page 3 has no readable text."));
assert(evaluateResearchWebAttribution({ question: "Which review type?", evidence: [], answer, webSupport }).pass);
assert.deepEqual(webSupport, snapshot, "Narrative selection must not rewrite the original document claims.");

for (const sourceUses of [[], [{ sourceID: "other", claimID: "review" }], [{ sourceID: "notice", claimID: "invented" }]]) {
  assert.throws(() => researchOfficialGuidanceSummaryInterpretation({ ...draft, paragraphs: [{ ...draft.paragraphs[0], sourceUses }] }, webSupport));
}
assert.throws(() => researchOfficialGuidanceSummaryInterpretation({ ...draft, paragraphs: [{ ...draft.paragraphs[0], text: "Use [this invented source](https://example.com)." }] }, webSupport));
for (const changed of [
  { ...webSupport.sources[0], sourceValidation: "model_claim" },
  { ...webSupport.sources[0], sourceContentHash: "b".repeat(64) }
]) assert.throws(() => researchOfficialGuidanceSummaryInput("Question", { sources: [changed] }));
const input = researchOfficialGuidanceSummaryInput("Question", webSupport, { conversationFactContext: { established: ["A new filing."] } });
assert.equal(input.passages.length, 3, "The verifier receives all retrieved passages, including qualifications outside the selected prose.");
assert.deepEqual(input.conversationFacts.established, ["A new filing."]);
const proposedAnswer = { ...draft, paragraphs: [{ ...draft.paragraphs[0], text: "The permit is automatically approved." }] };
const verification = researchOfficialGuidanceSummaryRequest({ question: "Is the permit approved?", webSupport, model: "test-model", userID: "synthetic-user", verificationSchema: { type: "object" }, proposedAnswer });
assert.equal(JSON.parse(verification.input).proposedAnswer.paragraphs[0].text, "The permit is automatically approved.");
assert(JSON.parse(verification.input).passages.some((passage) => /does not itself grant/.test(passage.text)));
assert.equal(verification.text.format.name, "permitext_official_guidance_verification");

// A successful semantic check binds the saved prose, source passages and gaps.
// Merely labeling an arbitrary summary as verified must not make it saveable.
const question = "Which review type?";
const savedInput = {
  ...answer,
  authorityStatus: "official_supporting_guidance",
  authorityLabel: "Official supporting guidance — noncontrolling",
  retrieval: { allowOfficialGuidanceOnly: true }, verification: { status: "passed", pass: true },
  structuredEvidenceAnalysis: Object.fromEntries([
    "controllingProvisions", "generalRules", "exceptions", "conditions", "limitations", "definitions",
    "crossReferences", "tables", "userPinnedEvidence", "permitextDiscoveredEvidence", "projectFactsUsed",
    "unresolvedProjectFacts", "evidenceLimitations", "highValueFollowUpQuestions"
  ].map((key) => [key, []])),
  factUsage: { projectContext: [], conversation: [], other: [] }
};
const persist = (value, savedQuestion = question) => immutableResearchAnswer({
  owner: ownerScope("offline-summary-user"), conversationID: "offline-summary-conversation",
  question: savedQuestion, answer: value, evidence: [], citations: [], model: "offline-draft",
  researchSystemVersion: "offline-summary-version"
});
assert.throws(() => persist(savedInput), /require evidence/);
assert.throws(() => researchOfficialGuidanceSummaryProof(question, savedInput, { pass: false, issues: [], model: "offline-verifier" }, verification.input));
assert.throws(() => researchOfficialGuidanceSummaryProof(question, savedInput, { pass: true, issues: [{ type: "unsupported_requirement" }], model: "offline-verifier" }, verification.input));
savedInput.officialGuidanceSummary = researchOfficialGuidanceSummaryProof(question, savedInput,
  { pass: true, issues: [], model: "offline-verifier" }, verification.input);
assert(hasVerifiedResearchOfficialGuidanceSummary(question, savedInput));
const persisted = persist(savedInput).answer;
assert.equal(persisted.answerText, answer.answerText);
assert.deepEqual(persisted.supportingSources, answer.supportingSources);
for (const mutate of [
  (value) => { value.answerText = value.answerText.replace("does not", "does"); },
  (value) => { value.conclusion = "The permit is approved."; },
  (value) => { value.explanation += " No further review is necessary."; },
  (value) => { value.missingFacts.push("An unverified new condition."); },
  (value) => { value.evidenceLimitations.pop(); },
  (value) => { value.supportingSources[0].attributedClaims[0].text = "Tampered source."; },
  (value) => { value.supportingSources[0].sourceContentHash = "b".repeat(64); },
  (value) => { value.supportingSourceUses[0].claimID = "waiver"; },
  (value) => { delete value.officialGuidanceSummary; },
  (value) => { value.officialGuidanceSummary.verification.pass = false; },
  (value) => { value.officialGuidanceSummary.verification.issues.push({ type: "unsupported_requirement" }); }
]) {
  const changed = structuredClone(savedInput);
  mutate(changed);
  assert(!hasVerifiedResearchOfficialGuidanceSummary(question, changed));
  assert.throws(() => persist(changed), /require evidence/);
}
assert.throws(() => persist(savedInput, "An unrelated question?"), /require evidence/);
for (const malformed of [
  { ...draft, missingFacts: [{}] }, { ...draft, evidenceLimitations: Array(7).fill("Gap") },
  { ...draft, paragraphs: [null] }, { ...draft, paragraphs: [{ ...draft.paragraphs[0], text: {} }] }
]) assert.throws(() => researchOfficialGuidanceSummaryInterpretation(malformed, webSupport));
console.log("Official summary source binding, semantic verification integrity, persistence and tamper rejection passed; no external/provider calls.");
