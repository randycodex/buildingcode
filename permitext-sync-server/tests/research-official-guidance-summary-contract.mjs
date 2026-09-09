import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyResearchOutsideAuthorityStartingPoints } from "../research-answer-presentation.mjs";
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
const scopedHTML = structuredClone(webSupport);
scopedHTML.sources[1].attributedClaims[0] = {
  id: "other-claim", contentHash: hash,
  heading: "Specialized filings", intro: "Does the general completion process apply to this filing type?",
  text: "Specialized filings — Does the general completion process apply to this filing type? — No, use the parent filing's completion process.",
  verbatimText: "No, use the parent filing's completion process."
};
const scopedSnapshot = structuredClone(scopedHTML);
for (const proposedAnswer of [undefined, draft]) {
  const request = researchOfficialGuidanceSummaryRequest({ question: "How does this filing close?", webSupport: scopedHTML,
    model: "test-model", userID: "synthetic-user", verificationSchema: { type: "object" }, proposedAnswer });
  const passages = JSON.parse(request.input).passages;
  const html = passages.find((passage) => passage.sourceID === "other");
  assert.equal(html.text, scopedHTML.sources[1].attributedClaims[0].text,
    "The primary passage text must carry the complete FAQ scope, even when the draft did not cite it.");
  assert.equal(html.intro, scopedHTML.sources[1].attributedClaims[0].intro);
  assert.equal(passages[0].text, scopedHTML.sources[0].attributedClaims[0].verbatimText,
    "Do not rewrite extracted PDF page text.");
}
assert.deepEqual(scopedHTML, scopedSnapshot, "Request formatting must not mutate the source or its citation proof.");
const proposedAnswer = { ...draft, paragraphs: [{ ...draft.paragraphs[0], text: "The permit is automatically approved." }] };
const verification = researchOfficialGuidanceSummaryRequest({ question: "Is the permit approved?", webSupport, model: "test-model", userID: "synthetic-user", verificationSchema: { type: "object" }, proposedAnswer });
assert.equal(JSON.parse(verification.input).proposedAnswer.paragraphs[0].text, "The permit is automatically approved.");
assert(JSON.parse(verification.input).passages.some((passage) => /does not itself grant/.test(passage.text)));
assert.equal(verification.text.format.name, "permitext_official_guidance_verification");
for (const proposedAnswer of [undefined, draft]) {
  const request = researchOfficialGuidanceSummaryRequest({
    question: "How should the routing questions be answered?", webSupport,
    context: { conversationFactContext: { qualified: ["The work does not change occupancy."], unknown: ["The filing date is unknown."] } },
    model: "test-model", userID: "synthetic-user", verificationSchema: { type: "object" }, proposedAnswer
  });
  const facts = JSON.parse(request.input).conversationFacts;
  assert.deepEqual(facts.qualified, ["The work does not change occupancy."]);
  assert.deepEqual(facts.unknown, ["The filing date is unknown."]);
  assert.match(request.instructions, /on the stated facts/);
  assert.match(request.instructions, /Keep actual uncertainty unresolved/);
}

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
assert.equal(savedInput.officialGuidanceSummary.version, "20260908-document-summary-v1", "Historical source-bound summaries remain readable.");
const qualifiedInput = structuredClone(savedInput);
qualifiedInput.officialGuidanceSummary = researchOfficialGuidanceSummaryProof(question, qualifiedInput, {
  pass: true, issues: [], model: "offline-verifier",
  qualificationReview: { version: "20260909-guidance-qualifications-v1", packetSHA256: "c".repeat(64), pass: true,
    passages: [{ sourceID: "notice", claimID: "review", contentHash: hash, finding: "addressed" }] }
}, verification.input);
assert.equal(qualifiedInput.officialGuidanceSummary.version, "20260909-document-summary-v2");
assert(hasVerifiedResearchOfficialGuidanceSummary(question, qualifiedInput));
assert.deepEqual(persist(qualifiedInput).answer.officialGuidanceSummary, qualifiedInput.officialGuidanceSummary);
for (const mutate of [
  (value) => { delete value.officialGuidanceSummary.verification.qualificationReview; },
  (value) => { delete value.officialGuidanceSummary.qualificationReviewSHA256; },
  (value) => { delete value.officialGuidanceSummary.qualificationReviewSHA256; delete value.officialGuidanceSummary.verification.qualificationReview; },
  (value) => { value.officialGuidanceSummary.verification.qualificationReview.pass = false; },
  (value) => { value.officialGuidanceSummary.verification.qualificationReview.passages[0].contentHash = "d".repeat(64); }
]) {
  const changed = structuredClone(qualifiedInput);
  mutate(changed);
  assert(!hasVerifiedResearchOfficialGuidanceSummary(question, changed));
  assert.throws(() => persist(changed), /require evidence/);
}
assert.throws(() => researchOfficialGuidanceSummaryProof(question, qualifiedInput, {
  pass: true, issues: [], model: "offline-verifier", qualificationReview: { pass: false }
}, verification.input));
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
// The retained LPC answer passed the provider verifier, then failed to save
// because a post-verification starting-point link changed its fingerprint.
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json", import.meta.url)));
const retainedCase = retained.results.find((item) => item.id === "DOBNOW-020");
const retainedCall = (phase) => retained.providerCalls.find((call) => call.caseID === retainedCase.id && call.phase === phase);
const output = (call) => JSON.parse(call.output.flatMap((message) => message.content || []).find((part) => part.type === "output_text").text);
const retainedDraft = output(retainedCall("permitext_official_guidance_summary"));
const retainedVerification = { ...output(retainedCall("permitext_official_guidance_verification")), model: retainedCall("permitext_official_guidance_verification").model };
assert.equal(retainedVerification.pass, true);
assert.equal(retainedCase.httpStatus, 500, "Preserve the live failure as evidence.");
const fixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-official-document-pages-20260909.json", import.meta.url)));
const release = fixture.documents.find((item) => item.source.id === "dob-build-release-notes");
const usedIDs = new Set(retainedDraft.paragraphs.flatMap((paragraph) => paragraph.sourceUses.map((use) => use.claimID)));
const source = {
  id: retainedDraft.paragraphs[0].sourceUses[0].sourceID,
  url: release.source.url, title: release.source.title,
  authorityClass: "official_guidance", role: "supporting", controlling: false,
  sourceValidation: "official_pdf", sourceContentHash: release.document.passages[0].contentHash,
  attributedClaims: release.document.passages.filter((passage) => usedIDs.has(passage.id)).map((passage) => ({
    id: passage.id, text: passage.claim, verbatimText: passage.text,
    contentHash: passage.contentHash, pageNumber: passage.pageNumber, sourceURL: passage.sourceURL
  }))
};
assert.equal(source.attributedClaims.length, usedIDs.size);
const retainedAnswer = { ...savedInput, ...researchOfficialGuidanceSummaryInterpretation(retainedDraft, { sources: [source] }) };
retainedAnswer.officialGuidanceSummary = researchOfficialGuidanceSummaryProof(retainedCase.question, retainedAnswer,
  retainedVerification, "Offline reconstruction of retained source bindings; no new semantic judge.");
assert(hasVerifiedResearchOfficialGuidanceSummary(retainedCase.question, retainedAnswer));
const presented = applyResearchOutsideAuthorityStartingPoints(retainedAnswer, [{
  sourceName: "Landmarks Preservation Commission", sourceURL: "https://www.nyc.gov/site/lpc/index.page"
}], { sourcePolicy: { useWeb: true }, question: retainedCase.question });
assert.deepEqual(presented, retainedAnswer, "Presentation must preserve verified prose and source bindings.");
assert(hasVerifiedResearchOfficialGuidanceSummary(retainedCase.question, presented));
assert.deepEqual(persist(presented, retainedCase.question).answer.answerText, retainedAnswer.answerText);
const tamperedRetained = structuredClone(presented);
tamperedRetained.answerText += " Approval is automatic.";
assert.throws(() => persist(tamperedRetained, retainedCase.question), /require evidence/);
console.log("Official summary source binding, semantic verification integrity, retained LPC presentation/persistence and tamper rejection passed; no external/provider calls.");
