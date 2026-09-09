import assert from "node:assert/strict";
import {
  guidanceQualificationReviewPacket,
  guidanceQualificationVerificationSchema,
  validateGuidanceQualificationReview
} from "../research-guidance-qualification-review.mjs";

const input = {
  question: "Can the preparer submit before the remaining stakeholders attest?",
  userFacts: ["Applicant and owner attestations are incomplete."],
  passages: [
    { sourceID: "guide", claimID: "roles", contentHash: "a".repeat(64), text: "Preparation access does not authorize applicant or owner attestation." },
    { sourceID: "update", claimID: "board", contentHash: "b".repeat(64), text: "For the stated ownership type, the board representative must also attest before submission." },
    { sourceID: "faq", claimID: "fees", contentHash: "c".repeat(64), text: "The records-management payment appears in the fees tab." }
  ],
  proposedAnswer: {
    paragraphs: [{ text: "No. Applicant and owner must attest. For the stated ownership type the board must also attest before submission." }],
    missingFacts: [], evidenceLimitations: []
  }
};
input.qualificationReviewPacket = guidanceQualificationReviewPacket(input);
const value = {
  pass: true, issues: [], qualificationReview: {
    packetSHA256: input.qualificationReviewPacket.packetSHA256,
    passages: [
      { passageIndex: 0, finding: "addressed", conditionQuotes: [input.passages[0].text], answerReferences: ["paragraph:0"], reason: "The answer separates preparation from the outstanding attestations." },
      { passageIndex: 1, finding: "addressed", conditionQuotes: [input.passages[1].text], answerReferences: ["paragraph:0"], reason: "The answer preserves the conditional additional attestation." },
      { passageIndex: 2, finding: "not_material", conditionQuotes: [], answerReferences: [], reason: "Payment-tab location does not qualify this attestation permission." }
    ]
  }
};
const verification = { pass: true, issues: [], model: "offline-verifier" };
const check = (candidate = value, packetInput = input, base = verification) =>
  validateGuidanceQualificationReview({ input: packetInput, value: candidate, verification: base });
const original = structuredClone({ input, value });
const passed = check();
assert.equal(passed.pass, true);
assert.equal(passed.qualificationReview.pass, true);
assert.equal(passed.qualificationReview.passages[1].sourceID, "update");
assert.equal(passed.qualificationReview.passages[1].contentHash, "b".repeat(64));
assert.deepEqual({ input, value }, original, "Review validation must not rewrite source text or the candidate answer.");

// Contradictory top-level approval cannot override a recorded omission.
const omitted = structuredClone(value);
omitted.qualificationReview.passages[1] = { ...omitted.qualificationReview.passages[1],
  finding: "missing_or_misstated", answerReferences: [], reason: "The conditional board attestation is absent." };
assert.equal(check(omitted).pass, false);
assert.match(check(omitted).issues[0].detail, /board attestation/);
assert.equal(check(value, input, { ...verification, pass: false, issues: [{ type: "wrong_attribution", detail: "The cited passage does not support the proposed statement." }] }).pass, false);
assert.equal(check({ pass: true, issues: [] }).pass, false, "Bare historical verifier approvals cannot satisfy new live verification.");
for (const mutate of [
  (candidate) => { candidate.qualificationReview.passages.pop(); },
  (candidate) => { candidate.qualificationReview.passages[1].passageIndex = 0; },
  (candidate) => { candidate.qualificationReview.packetSHA256 = "d".repeat(64); },
  (candidate) => { candidate.qualificationReview.passages[1].conditionQuotes = ["An invented unconditional permission."]; },
  (candidate) => { candidate.qualificationReview.passages[1].conditionQuotes = [input.passages[0].text]; },
  (candidate) => { candidate.qualificationReview.passages[1].answerReferences = ["paragraph:1"]; },
  (candidate) => { candidate.qualificationReview.passages[1].answerReferences = ["missing_fact:0"]; },
  (candidate) => { candidate.qualificationReview.passages[1].answerReferences = []; },
  (candidate) => { candidate.qualificationReview.passages[1].conditionQuotes = []; },
  (candidate) => { candidate.qualificationReview.passages[2].reason = " "; },
  (candidate) => { candidate.qualificationReview.passages[1] = null; }
]) {
  const candidate = structuredClone(value);
  mutate(candidate);
  assert.equal(check(candidate).pass, false);
}
for (const mutate of [
  (changed) => { changed.question += " Has the job type changed?"; },
  (changed) => { changed.userFacts[0] = "All attestations are complete."; },
  (changed) => { changed.proposedAnswer.paragraphs[0].text = "Submission is permitted now."; },
  (changed) => { changed.passages[1].text = "The board requirement was removed."; },
  (changed) => { changed.passages[1].contentHash = "e".repeat(64); }
]) {
  const changed = structuredClone(input);
  mutate(changed);
  assert.equal(check(value, changed).pass, false, "A receipt cannot be reused after its question, facts, draft or source changed.");
}
const spoof = structuredClone(value);
spoof.qualificationReview.passages[1].sourceID = "invented";
assert.equal(check(spoof).qualificationReview.passages[1].sourceID, "update", "Only server-bound source IDs enter the saved receipt.");
const schema = guidanceQualificationVerificationSchema({ properties: { pass: { type: "boolean" } }, required: ["pass"] }, input.qualificationReviewPacket);
assert.deepEqual(schema.required, ["pass", "qualificationReview"]);
assert.equal(schema.properties.qualificationReview.properties.passages.minItems, 3);
console.log("Guidance qualification receipt rejects omissions, bare approvals, stale inputs, missing coverage and invalid source/answer bindings; no provider calls or semantic acceptance claimed.");
