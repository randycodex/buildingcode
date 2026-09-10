import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { repairGuidanceDeclaredActions } from "../research-guidance-action-repairs.mjs";
import { materializeGuidanceSourceResolutions, validateGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";
import { guidanceQualificationReviewPacket, validateGuidanceQualificationReview } from "../research-guidance-qualification-review.mjs";

globalThis.fetch = () => { throw new Error("Declared-action replay forbids provider/network calls."); };
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-attestation-preparation-2026-09-09.json", import.meta.url)));
const draftCall = run.providerCalls[0];
const input = JSON.parse(draftCall.retainedRequestBody.input);
const raw = JSON.parse(draftCall.output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
const answer = materializeGuidanceSourceResolutions(input, raw);
const original = structuredClone({ input, answer });
const preview = input.passages.find(passage => passage.heading === "STEP 6: Preview Submission");
const fixed = repairGuidanceDeclaredActions(input, answer);
assert.equal(fixed.repairs.length, 1);
assert.equal(fixed.repairs[0].addedSourceUse, true);
assert.equal(fixed.repairs[0].replacements.length, 1);
assert.equal(fixed.answer.paragraphs[0].text, answer.paragraphs[0].text.replace(
  "and provide the final electronic signature", "and review the filing and provide the final electronic signature"));
assert.deepEqual(fixed.answer.paragraphs[0].sourceUses, [...answer.paragraphs[0].sourceUses, { sourceID: preview.sourceID, claimID: preview.claimID }]);
const restored = structuredClone(fixed.answer);
restored.paragraphs[0] = structuredClone(answer.paragraphs[0]);
assert.deepEqual(restored, answer, "No other field, source-resolution finding or qualification may change.");
assert.deepEqual({ input, answer }, original);
assert.equal(validateGuidanceSourceResolutions(input, fixed.answer).complete, true);
assert.deepEqual(repairGuidanceDeclaredActions(input, fixed.answer), { answer: fixed.answer, repairs: [] });

const changePreview = change => ({ ...input, passages: input.passages.map(passage => passage === preview ? change(passage) : passage) });
for (const changed of [
  { ...input, passages: input.passages.filter(passage => passage !== preview) },
  { ...input, passages: [...input.passages, preview] },
  changePreview(passage => ({ ...passage, heading: "An unrelated workflow" })),
  changePreview(passage => ({ ...passage, text: passage.text + " This applies only after a separate approval." })),
  changePreview(passage => ({ ...passage, text: passage.text.replace("must review", "must not review") })),
  changePreview(passage => ({ ...passage, text: passage.text.replace("Applicant", "Owner") })),
  changePreview(passage => ({ ...passage, text: passage.text.replace("review the filing and ", "") })),
  changePreview(passage => ({ ...passage, sourceID: "other-document" })),
  changePreview(passage => ({ ...passage, contentHash: "a".repeat(64) })),
  changePreview(passage => ({ ...passage, contentHash: "invalid" })),
  changePreview(passage => ({ ...passage, url: "https://www.nyc.gov/another-workflow" }))
]) assert.deepEqual(repairGuidanceDeclaredActions(changed, answer), { answer, repairs: [] });
for (const text of [
  "The owner must provide the final electronic signature.",
  "The applicant must not provide the final electronic signature.",
  "If the additional condition is satisfied, the applicant must provide the final electronic signature.",
  "The applicant must, if permitted, provide the final electronic signature.",
  "The applicant must ask the owner to provide the final electronic signature.",
  "The representative may provide the final electronic signature.",
  "The applicant must complete the attestation."
]) {
  const variant = structuredClone(answer); variant.paragraphs[0].text = text;
  assert.deepEqual(repairGuidanceDeclaredActions(input, variant), { answer: variant, repairs: [] }, text);
}
const reviewed = structuredClone(answer);
reviewed.paragraphs[0].text = "The applicant must review the filing and provide the final electronic signature.";
const rebound = repairGuidanceDeclaredActions(input, reviewed);
assert.equal(rebound.repairs.length, 1);
assert.equal(rebound.repairs[0].replacements.length, 0, "A stated review action only needs its missing source binding.");
assert.equal(rebound.answer.paragraphs[0].text, reviewed.paragraphs[0].text);
const separateReview = structuredClone(answer);
separateReview.paragraphs[0].text = "The applicant must review the filing. The applicant must provide the final electronic signature.";
const separateBound = repairGuidanceDeclaredActions(input, separateReview);
assert.equal(separateBound.repairs.length, 1);
assert.equal(separateBound.repairs[0].replacements.length, 0);
assert.equal(separateBound.answer.paragraphs[0].text, separateReview.paragraphs[0].text);
const lowerCase = structuredClone(answer); lowerCase.paragraphs[0].text = "the applicant must provide a final electronic signature.";
assert.equal(repairGuidanceDeclaredActions(input, lowerCase).answer.paragraphs[0].text,
  "the applicant must review the filing and provide a final electronic signature.");
const alreadyCited = structuredClone(answer);
alreadyCited.paragraphs[0].sourceUses.push({ sourceID: preview.sourceID, claimID: preview.claimID });
assert.equal(repairGuidanceDeclaredActions(input, alreadyCited).repairs[0].addedSourceUse, false);
const full = structuredClone(answer);
full.paragraphs[0].sourceUses = input.passages.filter(passage => passage !== preview).slice(0, 8).map(({ sourceID, claimID }) => ({ sourceID, claimID }));
assert.deepEqual(repairGuidanceDeclaredActions(input, full), { answer: full, repairs: [] }, "Never overflow the paragraph citation limit or insert uncitable text.");
const unused = structuredClone(answer); unused.paragraphs[0].sourceUses = [];
assert.deepEqual(repairGuidanceDeclaredActions(input, unused), { answer: unused, repairs: [] });
const protectedAnswer = structuredClone(answer);
protectedAnswer.sourceResolutions.relationships.push({ paragraphIndex: 0, statement: answer.paragraphs[0].text });
assert.deepEqual(repairGuidanceDeclaredActions(input, protectedAnswer), { answer: protectedAnswer, repairs: [] });

// A historical passing receipt cannot approve the modified answer. Even a
// freshly rebound synthetic receipt cannot override a negative semantic verdict.
const verifierInput = JSON.parse(run.providerCalls[1].retainedRequestBody.input);
const verdict = JSON.parse(run.providerCalls[1].output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
assert.equal(validateGuidanceQualificationReview({ input: verifierInput, value: verdict, verification: { pass: true, issues: [] } }).pass, true);
const changedInput = { ...verifierInput, proposedAnswer: { ...fixed.answer,
  answerText: verifierInput.proposedAnswer.answerText.replace("and provide the final electronic signature", "and review the filing and provide the final electronic signature") } };
assert.equal(validateGuidanceQualificationReview({ input: changedInput, value: verdict, verification: { pass: true, issues: [] } }).pass, false);
changedInput.qualificationReviewPacket = guidanceQualificationReviewPacket(changedInput);
const newReceipt = structuredClone(verdict); newReceipt.qualificationReview.packetSHA256 = changedInput.qualificationReviewPacket.packetSHA256;
assert.equal(validateGuidanceQualificationReview({ input: changedInput, value: newReceipt,
  verification: { pass: false, issues: [{ type: "misstated_provision", detail: "Synthetic rejection remains decisive." }] } }).pass, false);
console.log("Retained preview-action omission and binding repaired; source/actor/condition/limit controls and stale/negative verifier rejection passed. No API calls or live answer acceptance.");
