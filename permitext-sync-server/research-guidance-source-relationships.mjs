// Source-derived applicability questions, not answer-key text or conclusions.
// These DOB workflow relationships are emitted only while both their question
// context and the fetched source wording are present. Full passages remain in
// the request and the ordinary semantic verifier remains mandatory.
export const guidanceSourceRelationshipsVersion = "20260909-source-relationships-v1";
const compact = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export function guidanceSourceRelationships(input) {
  const question = compact(input?.question);
  const actorQuestion = /\b(?:attest(?:ations?|ing|s)?|sign(?:atures?|ing)?|stakeholders?)\b/i.test(question) &&
    /\b(?:owner|applicant|representative)\b/i.test(question);
  const subsequentQuestion = /\bsubsequent\s+filings?\b/i.test(question);
  if (!actorQuestion && !subsequentQuestion) return [];
  const relationships = [], seen = new Set();
  for (const passage of input.passages || []) {
    if (!passage.sourceID || !passage.claimID || !/^[a-f0-9]{64}$/.test(passage.contentHash || "")) continue;
    const text = compact(passage.text);
    const add = (kind, excerpts, questionToResolve) => {
      const key = `${kind}:${passage.sourceID}:${passage.claimID}`;
      if (seen.has(key)) return;
      seen.add(key);
      relationships.push({
        kind, questionToResolve,
        evidence: { sourceID: passage.sourceID, claimID: passage.claimID, contentHash: passage.contentHash, excerpts }
      });
    };
    if (actorQuestion) {
      const scope = text.match(/\bWhen\b[^.!?]{0,600}\bOwner Type\b[^.!?]{0,300}\brequired Stakeholder\b[^.!?]*[.!?]?/i)?.[0];
      const prerequisite = text.match(/\bBoth\b[^.!?]{0,500}\battestations?\b[^.!?]{0,250}\bbefore\b[^.!?]{0,150}\bfiling\b[^.!?]*[.!?]?/i)?.[0];
      if (scope && prerequisite) add("conditional_stakeholder", [scope, prerequisite],
        "Does the source's Owner Type condition require an additional stakeholder attestation before this filing can proceed? Apply known facts or retain the condition briefly; do not treat the named applicant and owner as an exhaustive list without resolving this condition.");
    }
    if (subsequentQuestion) {
      const initiation = text.match(/\bSubsequent filings can be initiated and submitted after\b[^.!?]{0,300}\binitial\b[^.!?]{0,160}\bsubmitted\b[^.!?]*[.!?]?/i)?.[0];
      const creation = text.match(/\bFields from the subsequent filing\b[^.!?]*[.!?]\s*The fields will not update\b[^.!?]*\bI1\b[^.!?]*\bsubmitted\b[.!?]\s*To prevent\b[^.!?]*\bbefore creating the subsequent filing\b[^.!?]*[.!?]?/i)?.[0];
      if (initiation && creation) add("creation_and_submission_timing", [initiation, creation],
        "Reconcile the after-initial-submission initiation statement with the passage acknowledging a subsequent filing before initial submission. Distinguish creation from submission and identify any unresolved creation-timing question instead of presenting one statement as universal.");
    }
  }
  return relationships;
}

export const guidanceSourceRelationshipInstruction = [
  "The sourceRelationships identify applicability questions from the fetched passages, not an answer key or independent authority.",
  "Resolve each material relationship before writing or approving a general statement about required actors, readiness to submit, or creation timing. Verify the excerpts in their complete source context and apply the user's facts.",
  "When the source condition cannot be resolved from the facts, preserve a brief conditional qualification or the precise unresolved issue with its source citation. Do not silently choose one side of competing timing guidance or infer that named prerequisites are sufficient. Keep the answer focused on the requested decision, without unrelated form-entry instructions."
].join(" ");
