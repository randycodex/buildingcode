import { createHash } from "node:crypto";
import { guidanceSourceRelationships } from "./research-guidance-source-relationships.mjs";

export const guidanceSourceResolutionVersion = "20260909-source-resolutions-v2";
const compact = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const key = use => `${use?.sourceID}\u0000${use?.claimID}`;
const outcomes = ["resolved", "conditional", "unresolved", "not_material"];
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const invalid = () => Object.assign(new Error("The source relationship resolutions are incomplete or not carried into the cited main answer."), {
  code: "INVALID_RESEARCH_RESPONSE"
});

// The packet identifies questions to resolve, not predetermined conclusions.
// Complete source passages stay in the input; the model supplies the outcome.
export function guidanceSourceResolutionPacket(input) {
  const relationships = guidanceSourceRelationships(input);
  if (!relationships.length) return null;
  const context = { question: input.question, userFacts: input.userFacts, conversationFacts: input.conversationFacts,
    recentConversation: input.recentConversation, retrievalLimitation: input.retrievalLimitation,
    passages: input.passages, sourceRelationships: relationships };
  return {
    version: guidanceSourceResolutionVersion,
    packetSHA256: digest({ version: guidanceSourceResolutionVersion, ...context }),
    relationships: relationships.map((relationship, relationshipIndex) => ({
      relationshipIndex,
      requiredSourceUses: [...new Map([relationship.evidence, ...(relationship.relatedEvidence || [])]
        .map(({ sourceID, claimID }) => [key({ sourceID, claimID }), { sourceID, claimID }])).values()]
    }))
  };
}

export function guidanceSourceResolutionSchema(packet) {
  return {
    type: "object", additionalProperties: false,
    properties: {
      packetSHA256: { type: "string", enum: [packet.packetSHA256] },
      relationships: { type: "array", minItems: packet.relationships.length, maxItems: packet.relationships.length,
        items: { type: "object", additionalProperties: false,
          properties: {
            relationshipIndex: { type: "integer", enum: packet.relationships.map(item => item.relationshipIndex) },
            outcome: { type: "string", enum: outcomes },
            statement: { type: "string", minLength: 1, maxLength: 600 }
          }, required: ["relationshipIndex", "outcome", "statement"] }
      }
    }, required: ["packetSHA256", "relationships"]
  };
}

export function guidanceSourceResolutionPartsSchema(packet) {
  return { type: "array", minItems: 1, maxItems: 8, items: {
    type: "object", additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["text", "source_resolution"] },
      text: { type: ["string", "null"] },
      relationshipIndex: { type: ["integer", "null"], enum: [null, ...packet.relationships.map(item => item.relationshipIndex)] }
    }, required: ["kind", "text", "relationshipIndex"]
  } };
}

export const guidanceSourceResolutionDraftInstruction = [
  "Complete sourceResolutions before drafting the paragraphs. For each indexed source relationship, use the full passages and supplied facts to select resolved, conditional, unresolved or not_material.",
  "Write statement as one concise, source-supported finding, including its material condition or precise unresolved issue, not an analysis transcript. In the main paragraph, insert one part with kind source_resolution, its relationshipIndex and null text. The server inserts the statement there verbatim. Cite every requiredSourceUses source in that paragraph. Do not copy or paraphrase the statement again in a text part; other text must not contradict or overgeneralize it.",
  "Use text parts for the direct answer and other necessary guidance; set their relationshipIndex to null. Use not_material only when the relationship cannot change or qualify the requested decision under the supplied facts; give the specific reason in statement and do not reference it in a paragraph. Unknown facts alone do not make a conditional requirement irrelevant. Do not add unrelated filing instructions to explain a source relationship.",
  "This structure does not supply the answer or establish correctness. Do not invent a resolution to complete it; unresolved is an appropriate outcome when the complete sources and facts do not reconcile the directions."
].join(" ");

export const guidanceSourceResolutionVerificationInstruction = [
  "The proposed sourceResolutions are model-authored findings, not evidence or proof of correctness. Independently check their outcomes and statements against the full sources and facts.",
  "A not_material reason must actually exclude the relationship from the requested decision and all volunteered claims. Check the entire main answer for statements that contradict or overgeneralize any resolution, including earlier categorical claims. A structurally valid resolution cannot override a semantic failure or replace the passage-by-passage qualification review."
].join(" ");

// Structural validation only. The unchanged independent semantic gate still
// decides support, materiality and consistency across all generated claims.
export function validateGuidanceSourceResolutions(input, draft) {
  const packet = guidanceSourceResolutionPacket(input);
  if (!packet) {
    if (draft?.sourceResolutions !== undefined) throw invalid();
    return null;
  }
  if (!input.sourceResolutionPacket || !Array.isArray(input.sourceRelationships) ||
      digest(input.sourceRelationships) !== digest(guidanceSourceRelationships(input)) ||
      digest(input.sourceResolutionPacket) !== digest(packet)) throw invalid();
  const plan = draft?.sourceResolutions, records = plan?.relationships;
  if (plan?.packetSHA256 !== packet.packetSHA256 || !Array.isArray(records) ||
      records.length !== packet.relationships.length ||
      new Set(records.map(record => record?.relationshipIndex)).size !== records.length) throw invalid();
  for (const record of records) {
    const index = record?.relationshipIndex;
    const expected = packet.relationships[index];
    if (!Number.isSafeInteger(index) || !expected || !outcomes.includes(record.outcome) ||
        !compact(record.statement) || record.statement.length > 600) throw invalid();
    if (record.outcome === "not_material") {
      if (record.paragraphIndex !== null) throw invalid();
      continue;
    }
    const paragraph = draft?.paragraphs?.[record.paragraphIndex];
    if (!Number.isSafeInteger(record.paragraphIndex) || record.paragraphIndex < 0 || record.paragraphIndex > 5 ||
        !paragraph || !compact(paragraph.text).includes(compact(record.statement)) ||
        !Array.isArray(paragraph.sourceUses) ||
        expected.requiredSourceUses.some(use => !paragraph.sourceUses.some(citation => key(citation) === key(use)))) throw invalid();
  }
  return { version: packet.version, packetSHA256: packet.packetSHA256, complete: true };
}

// Compose only model-authored text and explicit references, before attribution
// and semantic verification. No free-text claim is removed or rewritten. This
// avoids asking the model to write the same finding twice with identical words.
export function materializeGuidanceSourceResolutions(input, rawDraft) {
  const packet = guidanceSourceResolutionPacket(input);
  if (!packet) {
    validateGuidanceSourceResolutions(input, rawDraft);
    return rawDraft;
  }
  const records = rawDraft?.sourceResolutions?.relationships;
  if (!exactKeys(rawDraft, ["sourceResolutions", "paragraphs", "missingFacts", "evidenceLimitations"]) ||
      !exactKeys(rawDraft.sourceResolutions, ["packetSHA256", "relationships"]) ||
      !Array.isArray(records) || records.some(record => !exactKeys(record, ["relationshipIndex", "outcome", "statement"])) ||
      !Array.isArray(rawDraft.paragraphs) || !rawDraft.paragraphs.length || rawDraft.paragraphs.length > 6) throw invalid();
  const uses = new Map();
  const paragraphs = rawDraft.paragraphs.map((paragraph, paragraphIndex) => {
    if (!exactKeys(paragraph, ["parts", "sourceUses"]) || !Array.isArray(paragraph.parts) || !paragraph.parts.length || paragraph.parts.length > 8) throw invalid();
    const text = paragraph.parts.map(part => {
      if (!exactKeys(part, ["kind", "text", "relationshipIndex"])) throw invalid();
      if (part?.kind === "text") {
        if (part.relationshipIndex !== null || !compact(part.text)) throw invalid();
        return part.text.trim();
      }
      if (part?.kind !== "source_resolution" || part.text !== null || !Number.isSafeInteger(part.relationshipIndex)) throw invalid();
      const record = records.find(item => item?.relationshipIndex === part.relationshipIndex);
      if (!record || record.outcome === "not_material" || uses.has(part.relationshipIndex) || !compact(record.statement)) throw invalid();
      uses.set(part.relationshipIndex, paragraphIndex);
      return record.statement.trim();
    }).join(" ");
    return { text, sourceUses: paragraph.sourceUses };
  });
  const normalized = { sourceResolutions: {
    packetSHA256: rawDraft.sourceResolutions.packetSHA256,
    relationships: records.map(record => ({ ...record, paragraphIndex: uses.get(record?.relationshipIndex) ?? null }))
  }, paragraphs, missingFacts: rawDraft.missingFacts, evidenceLimitations: rawDraft.evidenceLimitations };
  validateGuidanceSourceResolutions(input, normalized);
  return normalized;
}
