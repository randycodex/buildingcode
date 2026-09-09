import { createHash } from "node:crypto";
import { isZoningConditionalExplanation } from "./research-zoning-conditional-explanation.mjs";

export const zoningMappedReviewVersion = "20260909-explicit-semantic-map-scope-v1";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const compact = (value) => String(value || "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
const sourceIDs = (value) => [...new Set((Array.isArray(value) ? value : []).map(String))];
const evidenceIdentity = (evidence) => evidence.map(({ sourceID, sectionID, sectionNumber, corpusID, codePrefix, codeEdition, codeVersion, text }) =>
  ({ sourceID, sectionID, sectionNumber, corpusID, codePrefix, codeEdition, codeVersion, textHash: hash(text) }));
function packetMatches(packet, answer, evidence) {
  const { packetHash, ...body } = packet;
  return body.version === zoningMappedReviewVersion && packetHash === hash(body) &&
    body.answerHash === hash(answer) && body.evidenceHash === hash(evidenceIdentity(evidence));
}

// Obvious direct property/actor determinations stay at the deterministic gate.
// This is deliberately not a proof that all other prose is safe. The remaining
// lexical finding can be resolved only by an explicit, complete semantic review.
export function hasExplicitZoningPropertyDetermination(answer) {
  const fields = [answer?.answerText, answer?.conclusion, answer?.explanation,
    ...(answer?.supportedPoints || []).flatMap((point) => [point.heading, point.explanation])];
  const actor = String.raw`(?:(?:the|this|that|our|your|their)\s+(?:(?:proposed|subject|specific|existing)\s+)?(?:self[- ]service\s+storage\s+)?(?:property|site|parcel|project|facility|building|proposal|application|owner|applicant|developer|operator)|(?:he|she|you|we|they))`;
  const result = String.raw`(?:(?:is|are|remains?|stays?)\s+(?:not\s+)?(?:permitted|allowed|authorized|approved|prohibited|eligible|entitled|compliant|within|outside|in\s+Subarea)|(?:may|can|could|will|would|shall)\s+(?:not\s+)?(?:proceed|operate|go\s+forward)|(?:receives?|gets?|has|have|retains?)\s+(?:the\s+)?(?:benefit|permission|approval|right\s+to\s+proceed))`;
  const explicit = new RegExp(String.raw`\b${actor}\s+${result}\b`, "gi");
  const transfer = /\b(?:this|that|(?:the\s+)?(?:rule|provision))\s+(?:applies|extends|is applicable)\s+to\s+(?:the|this|our|your)\s+(?:project|property|site|facility)\b/i;
  return fields.some((field) => {
    const text = compact(field);
    if (transfer.test(text)) return true;
    return [...text.matchAll(explicit)].some((match) => {
      const prefix = text.slice(0, match.index).split(/[,;.!?]|\b(?:but|however|and)\b/i).at(-1);
      // A predicate inside a withheld whether-clause is not a determination.
      return !/\b(?:whether|if)\b[^,;.!?]{0,120}$/i.test(prefix);
    });
  });
}

export function planZoningMappedScopeReview({ plan, answer, evidence = [], safety } = {}) {
  if (!isZoningConditionalExplanation(plan) || plan.path !== "property_map_applicability" ||
      plan.callPolicy?.subjectiveVerification !== true || safety?.pass !== false ||
      !safety.issues?.length || safety.issues.some((issue) => issue.type !== "zoning_missing_mapped_location") ||
      hasExplicitZoningPropertyDetermination(answer)) return null;
  const cited = sourceIDs((answer.citations || []).flatMap((citation) => citation.sourceIDs || []));
  const available = new Set(evidence.filter((source) => source.codePrefix === "ZR" && compact(source.text)).map((source) => source.sourceID));
  if (!cited.length || cited.some((id) => !available.has(id))) return null;
  const units = [];
  const seen = new Map();
  for (const field of ["answerText", "conclusion", "explanation"]) {
    const text = compact(answer[field]);
    if (!text) continue;
    if (seen.has(text)) { seen.get(text).fields.push(field); continue; }
    const unit = { id: `unit_${units.length}`, fields: [field], sourceIDs: cited };
    units.push(unit); seen.set(text, unit);
  }
  for (const [index, point] of (answer.supportedPoints || []).entries()) {
    const bound = sourceIDs(point.sourceIDs);
    if (!bound.length || bound.some((id) => !available.has(id))) return null;
    units.push({ id: `unit_${units.length}`, fields: [`supportedPoints[${index}].heading`, `supportedPoints[${index}].explanation`], sourceIDs: bound });
  }
  const uncertaintyFields = ["assumptions", "missingFacts", "evidenceLimitations", "additionalEvidenceNeeded", "followUpQuestions"]
    .filter((field) => answer[field]?.length);
  if (uncertaintyFields.length) units.push({ id: `unit_${units.length}`, fields: uncertaintyFields, sourceIDs: cited });
  if (!units.length || units.length > 18) return null;
  const packet = { version: zoningMappedReviewVersion, answerHash: hash(answer), evidenceHash: hash(evidenceIdentity(evidence)), units };
  return { ...packet, packetHash: hash(packet) };
}

export const zoningMappedReviewInstruction = "MAPPED SCOPE REVIEW is mandatory for this conditional explanation. The lexical map check could not distinguish source-rule language from a property finding. Review EVERY listed unit in PROPOSED ANSWER JSON, including its complete prose and all listed fields. Source explanations may describe generic applicability branches and their conditions; they must not assign those branches or permissions to this unidentified property. Classify a unit as project_determination if ANY part asserts a positive or negative property result, mapping, eligibility, or an unstated premise, even after a disclaimer, condition, source preface or in an example. Classify mixed source rules and unresolved boundaries as source_explanation only if no project determination is made. Use uncertain when you cannot establish the distinction. For source_explanation, list the exact bound sources supporting its rules, using only that unit's allowed sourceIDs. Cite no source merely because it shares the topic. For unresolved_boundary, confirm the complete unit only withholds a determination or identifies missing facts/source limits. Give one short reason per unit. Return every unit exactly once and the supplied packetHash in mappedScopeReview. The ordinary substantive, citation, completeness and fact checks still apply; any project_determination or uncertain unit must fail the overall answer.";

export function zoningMappedReviewSchema(base, packet) {
  if (!packet) return base;
  return { ...base, properties: { ...base.properties, mappedScopeReview: {
    type: "object", additionalProperties: false,
    properties: {
      packetHash: { type: "string", enum: [packet.packetHash] },
      units: { type: "array", minItems: packet.units.length, maxItems: packet.units.length,
        items: { type: "object", additionalProperties: false, properties: {
          unitID: { type: "string", enum: packet.units.map((unit) => unit.id) },
          classification: { type: "string", enum: ["source_explanation", "unresolved_boundary", "project_determination", "uncertain"] },
          sourceIDs: { type: "array", items: { type: "string" } }, reason: { type: "string", maxLength: 600 }
        }, required: ["unitID", "classification", "sourceIDs", "reason"] } }
    }, required: ["packetHash", "units"]
  } }, required: [...base.required, "mappedScopeReview"] };
}

export function validateZoningMappedScopeReview({ packet, value, answer, evidence, verification } = {}) {
  if (!packet) return verification;
  const review = value?.mappedScopeReview;
  const records = review?.units;
  const units = new Map(packet.units.map((unit) => [unit.id, unit]));
  const current = packetMatches(packet, answer, evidence);
  const complete = current && review?.packetHash === packet.packetHash && Array.isArray(records) && records.length === units.size &&
    new Set(records.map((record) => record.unitID)).size === units.size && records.every((record) => {
      const unit = units.get(record.unitID);
      return unit && ["source_explanation", "unresolved_boundary"].includes(record.classification) && compact(record.reason) && record.reason.length <= 600 &&
        Array.isArray(record.sourceIDs) && record.sourceIDs.every((id) => unit.sourceIDs.includes(id)) &&
        (record.classification !== "source_explanation" || record.sourceIDs.length > 0);
    });
  const outcome = { version: zoningMappedReviewVersion, packetHash: packet.packetHash, pass: Boolean(complete && verification.pass),
    units: Array.isArray(records) ? records : [] };
  if (complete) return { ...verification, mappedScopeReview: outcome };
  return { ...verification, pass: false, issues: [...verification.issues, {
    type: "fact_evidence_confusion", detail: "The required map-scope review was incomplete, mismatched, unbound, uncertain, or found a property determination. The unresolved property finding must not be delivered."
  }].slice(0, 12), mappedScopeReview: outcome };
}

export function resolveZoningMappedScopeSafety({ safety, packet, verification, answer, evidence } = {}) {
  if (!packet || verification?.pass !== true || verification.mappedScopeReview?.pass !== true ||
      verification.mappedScopeReview.packetHash !== packet.packetHash || !packetMatches(packet, answer, evidence)) return safety;
  const checked = validateZoningMappedScopeReview({ packet, value: { mappedScopeReview: verification.mappedScopeReview }, answer, evidence, verification });
  if (!checked.pass) return safety;
  // Preserve every original lexical finding and every unrelated safety issue.
  const issues = safety.issues.filter((issue) => issue.type !== "zoning_missing_mapped_location");
  return { ...safety, pass: issues.length === 0, issues, lexicalMapIssues: safety.issues,
    mappedScopeReview: verification.mappedScopeReview };
}
