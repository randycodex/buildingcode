// Source-derived applicability questions, not answer-key text or conclusions.
// These DOB workflow relationships are emitted only while both their question
// context and the fetched source wording are present. Full passages remain in
// the request and the ordinary semantic verifier remains mandatory.
export const guidanceSourceRelationshipsVersion = "20260909-field-editability-relationships-v3";
const compact = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const evidenceFor = (passage, excerpts) => ({ sourceID: passage.sourceID, claimID: passage.claimID, contentHash: passage.contentHash, excerpts });

export function guidanceSourceRelationships(input) {
  const question = compact(input?.question);
  const actorQuestion = /\b(?:attest(?:ations?|ing|s)?|sign(?:atures?|ing)?|stakeholders?)\b/i.test(question) &&
    /\b(?:owner|applicant|representative)\b/i.test(question);
  const subsequentQuestion = /\bsubsequent\s+filings?\b/i.test(question);
  const amendmentQuestion = /\b(?:PAA|post[ -]approval amendments?)\b|\bapproved\b[^.?]{0,100}\b(?:scope|drawings)\b[^.?]{0,100}\b(?:revis(?:e|ed|ion)|amend(?:ed|ment)?|chang(?:e|ed))\b/i.test(question);
  if (!actorQuestion && !subsequentQuestion && !amendmentQuestion) return [];
  const relationships = [], seen = new Set();
  const validPassages = (input.passages || []).filter((passage) => passage.sourceID && passage.claimID && /^[a-f0-9]{64}$/.test(passage.contentHash || ""));
  for (const passage of validPassages) {
    const text = compact(passage.text);
    const add = (kind, excerpts, questionToResolve) => {
      const key = `${kind}:${passage.sourceID}:${passage.claimID}`;
      if (seen.has(key)) return;
      seen.add(key);
      relationships.push({
        kind, questionToResolve,
        evidence: evidenceFor(passage, excerpts)
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
  if (subsequentQuestion) {
    const general = validPassages.map((passage) => ({ passage, excerpt: compact(passage.text).match(/\ban LOC needs to be requested for each filing, initial and subsequent filings[.!?]?/i)?.[0] ||
      compact(passage.text).match(/\ba Letter of Completion\s*\(LOC\) is requested separately on each filing[.!?]?/i)?.[0] })).find((item) => item.excerpt);
    const specialized = validPassages.map((passage) => ({ passage, excerpt: compact(passage.text).match(/\bDo I need to request a Letter of Completion for the subsequent filing of an NB or Alteration-CO filing\?\s*—\s*No,\s*the status of the subsequent filings will remain Permit Entire\.\s*Only the status of the initial \(I1\) filing will change to CO issued\./i)?.[0] })).find((item) => item.excerpt);
    if (general && specialized) relationships.push({
      kind: "filing_completion_scope",
      questionToResolve: "The chosen filing path has separate processing and a job-type-dependent completion consequence. Reconcile the general separate-LOC direction with the specialized NB/Alteration-CO initial-CO path. State the branches briefly and identify the initial job type if unknown; do not drop the completion consequence while explaining which filing to use.",
      evidence: evidenceFor(general.passage, [general.excerpt]),
      relatedEvidence: [evidenceFor(specialized.passage, [specialized.excerpt])]
    });
  }
  if (amendmentQuestion) {
    // Identify the field from an actual PAA locked-field list, then locate a
    // contrary editing direction for that same field. Preserve both complete
    // paragraph/FAQ contexts: matching words alone do not resolve applicability.
    const paragraphs = validPassages.flatMap((passage) => String(passage.text || "").split(/\n\s*\n/)
      .map((text) => ({ passage, text: compact(text) })));
    for (const locked of paragraphs) {
      const list = locked.text.match(/\bWhen a PAA is filed, the following fields are NOT editable:\s*(?:—\s*)?(•.+)$/i)?.[1];
      if (!list) continue;
      for (const item of list.split("•").map(compact).filter(Boolean)) {
        const field = compact(item.replace(/\s*\([^)]*\)\s*/g, " "));
        if (!field || field.length > 100) continue;
        const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const permission = new RegExp(`\\b${escaped}\\s+can be changed with a PAA\\b`, "i");
        const editable = paragraphs.find((candidate) => permission.test(candidate.text));
        if (!editable) continue;
        const key = `field_editability:${field.toLowerCase()}:${locked.passage.sourceID}:${editable.passage.sourceID}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({
          kind: "field_editability", field,
          questionToResolve: `The PAA locked-field list and a separate editing direction both name ${field}. Determine whether their complete contexts reconcile the directions. If they do not, disclose the unresolved field-editability issue in the main answer; do not include this field in an unconditional locked-or-editable list.`,
          evidence: evidenceFor(locked.passage, [locked.text]),
          relatedEvidence: [evidenceFor(editable.passage, [editable.text])]
        });
      }
    }
  }
  return relationships;
}

export const guidanceSourceRelationshipInstruction = [
  "The sourceRelationships identify applicability questions from the fetched passages, not an answer key or independent authority.",
  "Resolve each material relationship before writing or approving a general statement about required actors, readiness to submit, creation timing, or the consequences of a filing choice. Verify the excerpts and any relatedEvidence in their complete source context and apply the user's facts.",
  "When the source condition cannot be resolved from the facts, preserve a brief conditional qualification or the precise unresolved issue with its source citation. Do not silently choose one side of competing timing guidance or infer that named prerequisites are sufficient. Keep the answer focused on the requested decision, without unrelated form-entry instructions."
].join(" ");
