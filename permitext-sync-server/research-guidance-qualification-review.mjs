import { createHash } from "node:crypto";

export const guidanceQualificationReviewVersion = "20260909-guidance-qualifications-v2";
const compact = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const findings = ["addressed", "missing_or_misstated", "not_material"];
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

function sourceSpans(text) {
  const segments = [...segmenter.segment(text)].map((entry) => entry.segment);
  // Bound catalogue size without losing any source text or deciding which
  // conditions matter. Long tails remain one complete source span.
  const bounded = segments.length > 128 ? [...segments.slice(0, 127), segments.slice(127).join("")] : segments;
  return bounded.map((text, spanIndex) => ({ spanIndex, text }));
}

// Bind the review to the question, facts, full source text and exact draft.
// Indices keep the provider response small; saved records restore source IDs.
export function guidanceQualificationReviewPacket(input) {
  const { qualificationReviewPacket: ignored, ...content } = input;
  return {
    version: guidanceQualificationReviewVersion,
    packetSHA256: hash({ version: guidanceQualificationReviewVersion, content }),
    passages: content.passages.map((passage, passageIndex) => ({
      passageIndex, sourceID: passage.sourceID, claimID: passage.claimID, contentHash: passage.contentHash,
      spans: sourceSpans(passage.text)
    }))
  };
}

export const guidanceQualificationReviewInstruction = [
  "Before deciding pass, review every passage in qualificationReviewPacket once, including passages the proposed answer does not cite.",
  "For each passage, check all conditions material to the user's requested action and to claims the answer volunteers: actors, prerequisites, exceptions, scope, dates, alternatives and conflicting directions. Do not dismiss a conditional requirement merely because the fact selecting its branch is unknown; a short conditional statement or precise unresolved item may be needed.",
  "Record finding addressed only when every material qualification from that passage is preserved. Select conditionSpanIDs from that passage's supplied spans and answerReferences (paragraph:0, missing_fact:0 or evidence_limitation:0, zero-based). The server preserves the full original span text: do not copy or paraphrase quotations. A missing-fact question alone does not preserve a known conditional rule. Generic disclaimers do not address source-specific conditions.",
  "Check what the referenced answer text actually says before crediting it. A statement found only in the source or your review reason is not present in the answer. In particular, a prohibition on attesting or submitting does not itself state permission to prepare or enter data, and listing conflicting source directions does not itself resolve their relationship.",
  "Use missing_or_misstated if any material condition is missing, contradicted or universalized; select its source spans and explain the omission. Report the corresponding issue and fail verification. Reconcile both sides of a material source conflict, rather than crediting one cited passage alone. Assess a claim against all of its selected sources together; do not declare it unsupported because one selected source alone is narrower.",
  "Use not_material with a specific reason only when the passage adds no material condition to the requested action or any volunteered claim; do not require unrelated page topics, generic account setup or navigation details merely because someone must log in. Keep each reason to one short sentence. This review is internal: it must not add a checklist to the user-facing answer. Return the exact packetSHA256 and all passage indices."
].join(" ");

export function guidanceQualificationVerificationSchema(base, packet) {
  return {
    ...base,
    properties: {
      ...base.properties,
      qualificationReview: {
        type: "object", additionalProperties: false,
        properties: {
          packetSHA256: { type: "string", enum: [packet.packetSHA256] },
          passages: {
            type: "array", minItems: packet.passages.length, maxItems: packet.passages.length,
            items: {
              type: "object", additionalProperties: false,
              properties: {
                passageIndex: { type: "integer", enum: packet.passages.map((passage) => passage.passageIndex) },
                finding: { type: "string", enum: findings },
                conditionSpanIDs: { type: "array", maxItems: 8, items: { type: "integer", minimum: 0, maximum: Math.max(...packet.passages.map((passage) => passage.spans.length - 1)) } },
                answerReferences: { type: "array", maxItems: 12, items: { type: "string" } },
                reason: { type: "string", maxLength: 400 }
              }, required: ["passageIndex", "finding", "conditionSpanIDs", "answerReferences", "reason"]
            }
          }
        }, required: ["packetSHA256", "passages"]
      }
    }, required: [...(base.required || []), "qualificationReview"]
  };
}

function validAnswerReference(reference, answer) {
  if (typeof reference !== "string") return false;
  const match = /^(paragraph|missing_fact|evidence_limitation):(0|[1-9]\d*)$/.exec(reference);
  if (!match) return false;
  const index = Number(match[2]);
  const field = { paragraph: "paragraphs", missing_fact: "missingFacts", evidence_limitation: "evidenceLimitations" }[match[1]];
  const item = answer?.[field]?.[index];
  return Number.isSafeInteger(index) && Boolean(compact(match[1] === "paragraph" ? item?.text : item));
}

export function validateGuidanceQualificationReview({ input, value, verification }) {
  const packet = guidanceQualificationReviewPacket(input);
  const review = value?.qualificationReview;
  const records = review?.passages;
  const complete = input.qualificationReviewPacket?.packetSHA256 === packet.packetSHA256 &&
    hash(input.qualificationReviewPacket) === hash(packet) &&
    review?.packetSHA256 === packet.packetSHA256 && Array.isArray(records) &&
    records.length === packet.passages.length && new Set(records.map((record) => record?.passageIndex)).size === records.length &&
    records.every((record) => {
      const passage = input.passages[record?.passageIndex];
      if (!Number.isSafeInteger(record?.passageIndex) || !passage || !findings.includes(record.finding) ||
          !compact(record.reason) || record.reason.length > 400 ||
          !Array.isArray(record.conditionSpanIDs) || record.conditionSpanIDs.length > 8 ||
          !Array.isArray(record.answerReferences) || record.answerReferences.length > 12) return false;
      const spans = packet.passages[record.passageIndex].spans;
      if (record.conditionSpanIDs.some((index) => !Number.isSafeInteger(index) || index < 0 || !spans[index]) ||
          new Set(record.conditionSpanIDs).size !== record.conditionSpanIDs.length ||
          record.answerReferences.some((reference) => !validAnswerReference(reference, input.proposedAnswer)) ||
          new Set(record.answerReferences).size !== record.answerReferences.length) return false;
      if (record.finding === "not_material") return record.answerReferences.length === 0;
      return record.conditionSpanIDs.length > 0 &&
        (record.finding !== "addressed" || record.answerReferences.length > 0);
    });
  const missing = complete ? records.filter((record) => record.finding === "missing_or_misstated") : [];
  const pass = Boolean(complete && !missing.length && verification.pass);
  const issue = !complete
    ? "The required guidance qualification review is incomplete, stale or not bound to the supplied passages and answer."
    : missing.length
      ? `The guidance review identified a missing or misstated material condition: ${missing.map((record) => `passage ${record.passageIndex}: ${compact(record.reason)}`).join("; ")}`.slice(0, 1500)
      : null;
  return {
    ...verification, pass,
    issues: issue ? [...verification.issues, { type: "missed_material_conclusion", detail: issue }].slice(0, 12) : verification.issues,
    qualificationReview: {
      version: guidanceQualificationReviewVersion, packetSHA256: packet.packetSHA256, pass,
      passages: complete ? records.map((record) => ({
        passageIndex: record.passageIndex, sourceID: packet.passages[record.passageIndex].sourceID,
        claimID: packet.passages[record.passageIndex].claimID, contentHash: packet.passages[record.passageIndex].contentHash,
        finding: record.finding, conditionSpanIDs: [...record.conditionSpanIDs],
        conditionQuotes: record.conditionSpanIDs.map((index) => packet.passages[record.passageIndex].spans[index].text),
        answerReferences: [...record.answerReferences], reason: compact(record.reason)
      })) : []
    }
  };
}
