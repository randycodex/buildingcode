import { createResearchCorpusRegistry } from "./research-corpus-registry.mjs";
import { researchEvidencePriorityMetadata } from "./research-evidence-priority.mjs";

// This is a bounded reference plan, not an interpretation of the requested law.
// Only the resolver's complete, same-authority enacted text can supply context.
export const researchInterpretationContextVersion = "20261003-same-authority-interpretation-context-v1";
export const researchInterpretationContextMaximumFamilies = 2;

const supportedPrefixes = new Set(["BC", "MC", "FGC", "PC"]);
const identityFields = ["corpusID", "codeVersion", "codeEdition", "jurisdiction"];
const contextPurpose = "canonical_interpretation_context";
const registry = createResearchCorpusRegistry();
const text = value => typeof value === "string" || typeof value === "number"
  ? String(value).trim() : "";
const prefix = value => text(value).toUpperCase();
const normalizedJurisdiction = value => text(value).replace(/\s+/g, " ").toLowerCase();
const sameIdentityField = (field, left, right) => field === "jurisdiction"
  ? normalizedJurisdiction(left) === normalizedJurisdiction(right)
  : text(left) === text(right);
const authorityKey = value => [value.corpusID, value.codeVersion, value.codeEdition,
  normalizedJurisdiction(value.jurisdiction), prefix(value.codePrefix)].join("\u0000");

function registeredAuthority(value) {
  if (!supportedPrefixes.has(prefix(value.codePrefix)) || identityFields.some(field => !text(value[field]))) return null;
  return registry.find(corpus => corpus.id === text(value.corpusID) &&
    corpus.authorityClass === "enacted" && corpus.automaticResearchEligible === true &&
    corpus.optInRequired !== true && corpus.codePrefixes.includes(prefix(value.codePrefix)) &&
    sameIdentityField("codeVersion", corpus.codeVersion, value.codeVersion) &&
    sameIdentityField("codeEdition", corpus.codeEdition, value.codeEdition) &&
    sameIdentityField("jurisdiction", corpus.jurisdiction, value.jurisdiction)) || null;
}

function isInherited(anchor) {
  return anchor.inheritedAuthorityReference === true || anchor.signals?.inheritedAuthorityReference === true;
}

function anchorRejection(anchor) {
  if (!anchor || anchor.eligiblePrimary !== true) return "not_eligible_primary";
  if (!text(anchor.sectionNumber) || !text(anchor.sourceID || anchor.sectionID || anchor.id)) return "missing_operative_anchor";
  if (!supportedPrefixes.has(prefix(anchor.codePrefix))) return "unsupported_code_family";
  if (identityFields.some(field => !text(anchor[field]))) return "missing_authority_identity";
  if (!registeredAuthority(anchor)) return "unrecognized_authority_identity";
  if (anchor.referenceOnly === true || anchor.selectionMode === "section_reference" || anchor.contextualReference === true ||
      anchor.signals?.contextualReference === true || anchor.evidenceRole === "contextual" ||
      ["contextual", "irrelevant"].includes(anchor.evidencePriority?.evidenceRole) ||
      anchor.referencePurpose === contextPurpose || anchor.interpretationContext === true ||
      anchor.targetedDefinition === true || anchor.richSourceKind === "amendment-history") return "not_operative_anchor";
  if (isInherited(anchor) && anchor.activeTopic !== true) return "inactive_inherited_authority";
  if (anchor.authorityClass && anchor.authorityClass !== "enacted") return "non_enacted_anchor";
  return null;
}

/**
 * Callers determine eligiblePrimary from the operative evidence for this turn;
 * merely mentioned citations, recall-only corpora and previous-answer text do
 * not qualify. An inherited primary additionally needs activeTopic:true.
 * Non-strict broadening authorization is a trusted caller decision, never a
 * model signal. Explicit selected-only boundaries cannot be widened here.
 */
export function researchInterpretationContextPlan({
  anchors = [], strategy = { mode: "broad" }, strictBoundary = false,
  pinnedEvidence = [], explicitlyAuthorizedBroadening = false
} = {}) {
  const candidates = Array.isArray(anchors) ? anchors : [];
  const mode = typeof strategy === "string" ? strategy : strategy?.mode;
  const strict = strictBoundary === true ||
    strategy?.reason === "question_explicitly_bounded_to_selected_evidence";
  const hasPins = (Array.isArray(pinnedEvidence) && pinnedEvidence.length > 0) ||
    candidates.some(anchor => anchor?.origin === "user_pinned");
  const boundaryReason = strict ? "strict_selected_evidence_boundary" :
    ((mode !== "broad" || hasPins) && explicitlyAuthorizedBroadening !== true)
      ? "broad_context_not_authorized" : null;
  const plan = { version: researchInterpretationContextVersion, optional: true,
    maximumFamilies: researchInterpretationContextMaximumFamilies,
    boundaryReason, references: [], skippedAnchors: [] };
  if (boundaryReason) return plan;
  const families = new Map();
  const suppliedContexts = new Set(candidates.filter(anchor => !anchorRejection(anchor) &&
    text(anchor.sectionNumber) === "102.1" && anchor.canonicalContextComplete === true).map(authorityKey));
  // A currently operative family takes precedence over inherited context.
  const ordered = candidates.map((anchor, index) => ({ anchor, index }))
    .sort((left, right) => Number(isInherited(left.anchor || {})) - Number(isInherited(right.anchor || {})));
  for (const { anchor, index } of ordered) {
    const reason = anchorRejection(anchor);
    if (reason) { plan.skippedAnchors.push({ index, reason }); continue; }
    if (suppliedContexts.has(authorityKey(anchor))) {
      plan.skippedAnchors.push({ index, reason: "context_already_primary" }); continue;
    }
    const key = authorityKey(anchor);
    const existing = families.get(key);
    const sourceID = text(anchor.sourceID);
    const sectionID = text(anchor.sectionID || anchor.id);
    if (existing) {
      if (sourceID && !existing.anchorSourceIDs.includes(sourceID)) existing.anchorSourceIDs.push(sourceID);
      if (sectionID && !existing.anchorSectionIDs.includes(sectionID)) existing.anchorSectionIDs.push(sectionID);
      continue;
    }
    if (families.size >= researchInterpretationContextMaximumFamilies) {
      plan.skippedAnchors.push({ index, reason: "family_limit" }); continue;
    }
    families.set(key, {
      ...Object.fromEntries(identityFields.map(field => [field, text(anchor[field])])),
      codePrefix: prefix(anchor.codePrefix), chapterNumber: "1", sectionNumber: "102.1",
      referenceKind: "section", referencePurpose: contextPurpose,
      interpretationContext: true, optional: true,
      anchorSourceIDs: sourceID ? [sourceID] : [], anchorSectionIDs: sectionID ? [sectionID] : [],
      ...(sourceID ? { parentSourceID: sourceID } : {}), parentDepth: 0
    });
  }
  plan.references = [...families.values()];
  return plan;
}

/**
 * The canonical resolver must return its own complete identity. Request hints
 * are never used to fill a missing canonical edition, corpus or jurisdiction.
 * A failed optional lookup is diagnostic, not a mandatory evidence gap.
 */
export async function resolveResearchInterpretationContext(reference, resolveSection) {
  const failure = (reason, fields = []) => ({ source: null, limitation: {
    kind: "optional_interpretation_context_unavailable", reason, fields, optional: true,
    codePrefix: prefix(reference?.codePrefix), sectionNumber: text(reference?.sectionNumber),
    corpusID: text(reference?.corpusID), codeEdition: text(reference?.codeEdition)
  } });
  if (!reference || reference.referencePurpose !== contextPurpose || reference.interpretationContext !== true ||
      reference.sectionNumber !== "102.1" || !registeredAuthority(reference)) return failure("invalid_context_reference");
  if (typeof resolveSection !== "function") return failure("canonical_resolver_unavailable");
  const request = { ...reference, origin: "permitext_cross_reference" };
  let canonical;
  try { canonical = await resolveSection(request); }
  catch { return failure("canonical_resolution_failed"); }
  if (!canonical || typeof canonical !== "object") return failure("canonical_source_unavailable");
  const missing = ["codePrefix", "sectionNumber", ...identityFields].filter(field => !text(canonical[field]));
  if (missing.length) return failure("missing_canonical_identity", missing);
  const mismatched = identityFields.filter(field => !sameIdentityField(field, canonical[field], reference[field]));
  if (prefix(canonical.codePrefix) !== prefix(reference.codePrefix)) mismatched.push("codePrefix");
  if (text(canonical.sectionNumber) !== reference.sectionNumber) mismatched.push("sectionNumber");
  if (mismatched.length) return failure("canonical_identity_mismatch", mismatched);
  const corpus = registeredAuthority(canonical);
  if (!corpus || (canonical.authorityClass && canonical.authorityClass !== "enacted") ||
      (canonical.authorityStatus && canonical.authorityStatus !== "enacted")) return failure("canonical_authority_ineligible");
  const sectionID = text(canonical.sectionID || canonical.id);
  if (!sectionID) return failure("missing_canonical_section_id");
  if (canonical.truncated === true || canonical.canonicalContextComplete === false ||
      canonical.discoveryPassageOnly === true || canonical.pinnedSelectionExact === true ||
      canonical.referenceOnly === true) return failure("incomplete_canonical_context");
  const canonicalText = text(canonical.canonicalText || canonical.text);
  if (!canonicalText) return failure("empty_canonical_text");
  const source = { ...canonical, sectionID, codePrefix: prefix(canonical.codePrefix), text: canonicalText,
    origin: "permitext_cross_reference", retrievalDepth: 1, authorityClass: corpus.authorityClass,
    interpretationContext: true, referencePurpose: contextPurpose, optional: true,
    anchorSourceIDs: [...new Set((Array.isArray(reference.anchorSourceIDs) ? reference.anchorSourceIDs : []).map(text).filter(Boolean))],
    anchorSectionIDs: [...new Set((Array.isArray(reference.anchorSectionIDs) ? reference.anchorSectionIDs : []).map(text).filter(Boolean))],
    signals: { interpretationContext: true },
    canonicalContextResolved: true, canonicalContextComplete: true,
    ...(text(reference.parentSourceID) ? { parentSourceID: text(reference.parentSourceID) } : {}) };
  source.evidencePriority = researchEvidencePriorityMetadata(source);
  return { source, limitation: null };
}
