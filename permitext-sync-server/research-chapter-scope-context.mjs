import { createHash } from "node:crypto";
import { createResearchCorpusRegistry } from "./research-corpus-registry.mjs";
import { researchEvidencePriorityMetadata } from "./research-evidence-priority.mjs";

// These are exact-text nominations, not chapter applicability decisions. The
// canonical resolver must supply the complete enacted qualification afresh.
export const researchChapterScopeContextVersion = "20261003-search-vocabulary-scope-priority-v3";
// Actual primary evidence already bounds this plan. Assembly reuses complete
// supplied scopes or admits them within its structural and character limits.
export const researchChapterScopeContextMaximumChapters = null;
const purpose = "canonical_chapter_scope";
const fields = ["codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction"];
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const text = value => String(value ?? "").trim();
const compact = value => text(value).replace(/\s+/g, " ");
const identity = value => text(value?.sectionID || value?.id);
const chapter = value => text(value?.sourceChapterNumber || value?.chapterNumber);
const hash = value => createHash("sha256").update(compact(value)).digest("hex");
const sameField = (field, left, right) => field === "jurisdiction"
  ? compact(left).toLowerCase() === compact(right).toLowerCase()
  : field === "codePrefix" ? text(left).toUpperCase() === text(right).toUpperCase() : text(left) === text(right);
const sameAuthority = (left, right) => fields.every(field => text(left?.[field]) && text(right?.[field]) &&
  sameField(field, left[field], right[field]));
const sameChapter = (left, right) => chapter(left) && chapter(left) === chapter(right) && sameAuthority(left, right);
const chapterKey = value => [...fields.map(field => field === "jurisdiction"
  ? compact(value[field]).toLowerCase() : text(value[field])), chapter(value)].join("\u0000");
const inherited = value => value?.inheritedAuthorityReference === true || value?.signals?.inheritedAuthorityReference === true;
const scopeTitle = value => {
  const number = text(value?.sectionNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const title = number ? text(value?.title).replace(new RegExp(`^(?:[A-Z]+\\s+)?${number}\\.?\\s+`, "i"), "") : text(value?.title);
  return /^(?:scope|applicability)\b/i.test(title);
};
// "Elsewhere in this chapter" and a locally titled Scope do not establish a
// chapter-wide rule. Require enacted words expressly governing the chapter.
const chapterWideText = value => /\b(?:(?:the\s+)?(?:provisions|requirements)\s+of\s+(?:this|the entire)\s+chapter\s+(?:shall\s+)?(?:govern|apply)\b|(?:this|the entire)\s+chapter\s+shall\s+(?:govern|apply)\b)/i.test(text(value));
function registeredAuthority(value) {
  return registry.find(corpus => corpus.authorityClass === "enacted" && corpus.id === text(value?.corpusID) &&
    corpus.codePrefixes.includes(text(value?.codePrefix).toUpperCase()) &&
    ["codeVersion", "codeEdition", "jurisdiction"].every(field => text(value?.[field]) &&
      sameField(field, corpus[field], value[field]))) || null;
}

// Reassemble all exact indexed slices, including continuation blocks. A full
// block hash proves that no tail, exception or note was dropped by the index.
function indexedScopeText(section, passages, index) {
  const blocks = new Map();
  for (const passage of passages) {
    if (index.passagesByID?.get(passage.id) !== passage || identity(section) !== text(passage.sectionID) ||
        fields.some(field =>
          passage[field] && !sameField(field, passage[field], section[field]))) return null;
    const { blockID, start, end } = passage.sourceOffsets || {};
    if (!text(blockID) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start ||
        end - start !== String(passage.text ?? "").length ||
        !Number.isSafeInteger(passage.blockIndex) || !/^[a-f0-9]{64}$/.test(passage.sourceTextHash || "")) return null;
    const block = blocks.get(blockID) || { index: passage.blockIndex, hash: passage.sourceTextHash, slices: [] };
    if (block.index !== passage.blockIndex || block.hash !== passage.sourceTextHash) return null;
    block.slices.push({ start, end, text: String(passage.text) }); blocks.set(blockID, block);
  }
  if (!blocks.size) return null;
  const result = [];
  for (const block of [...blocks.values()].sort((a, b) => a.index - b.index)) {
    let body = "";
    for (const slice of block.slices.sort((a, b) => a.start - b.start || b.end - a.end)) {
      if (slice.start > body.length || body.slice(slice.start, Math.min(body.length, slice.end)) !==
          slice.text.slice(0, Math.min(body.length, slice.end) - slice.start)) return null;
      if (slice.end > body.length) body += slice.text.slice(body.length - slice.start);
    }
    if (createHash("sha256").update(body).digest("hex") !== block.hash) return null;
    result.push(body);
  }
  return result.join("\n\n");
}

/** Nominate only scope text present in the same already-authorized full index. */
export function nominateResearchChapterScopeCandidates(candidates, catalog, index) {
  if (!Array.isArray(candidates) || !Array.isArray(catalog) || !index?.sections?.get ||
      !index?.passagesByID?.get || !Array.isArray(index.passages)) return [];
  const anchors = candidates.map(candidate => candidate?.section || candidate).filter(value =>
    registeredAuthority(value) && chapter(value) && identity(value));
  const scopes = catalog.filter(section => scopeTitle(section) && registeredAuthority(section) &&
    anchors.some(anchor => sameChapter(anchor, section)) &&
    sameAuthority(index.sections.get(identity(section)), section) &&
    chapter(index.sections.get(identity(section))) === chapter(section));
  const byID = new Map(scopes.map(section => [identity(section), []]));
  for (const passage of index.passages) byID.get(text(passage.sectionID))?.push(passage);
  return scopes.flatMap(section => {
    const fullText = indexedScopeText(section, byID.get(identity(section)), index);
    if (!fullText || !chapterWideText(fullText)) return [];
    return [{ ...section, sectionID: identity(section), sourceChapterNumber: chapter(section),
      chapterScopeContext: true, referencePurpose: purpose, optional: true,
      indexedCanonicalScopeText: fullText, canonicalScopeTextHash: hash(fullText),
      matchedAnchorSectionIDs: anchors.filter(anchor => sameChapter(anchor, section)).map(identity) }];
  });
}

function anchorRejection(anchor) {
  if (!anchor?.eligiblePrimary) return "not_eligible_primary";
  if (!identity(anchor) || !text(anchor.sectionNumber) || !chapter(anchor)) return "missing_operative_identity";
  if (!registeredAuthority(anchor)) return "unrecognized_authority_identity";
  if ((anchor.authorityClass && anchor.authorityClass !== "enacted") || anchor.referenceOnly ||
      anchor.selectionMode === "section_reference" || anchor.contextualReference || anchor.signals?.contextualReference ||
      ["contextual", "irrelevant"].includes(anchor.evidencePriority?.evidenceRole) || anchor.targetedDefinition ||
      anchor.chapterScopeContext || anchor.interpretationContext || anchor.richSourceKind === "amendment-history") return "not_operative_anchor";
  if (inherited(anchor) && anchor.activeTopic !== true) return "inactive_inherited_authority";
  return null;
}
function currentForeground(anchor) {
  const signal = anchor.signals?.currentQuestionForeground;
  if (signal === true) return { source: "literal_current_question" };
  return signal && Number.isSafeInteger(signal.rank) && signal.rank >= 1 && signal.rank <= 5 &&
    ["positive_equipment_subject", "positive_search_vocabulary", "literal_current_question"].includes(signal.source) ? signal : null;
}
const importance = anchor => Number(anchor.origin === "user_pinned") * 8 +
  Number(anchor.signals?.exactReference === true) * 4 +
  Number(!!currentForeground(anchor) || !!anchor.signals?.currentQuestionLexicalReservation ||
    anchor.signals?.exactTopicRouteTarget === true) * 2 +
  Number(["positive_equipment_subject", "positive_search_vocabulary"].includes(currentForeground(anchor)?.source)) + Number(!inherited(anchor));

/** Only actual primary writer evidence can admit its nominated chapter scope. */
export function researchChapterScopeContextPlan({ anchors = [], canonicalScopeRecords = [], strategy = { mode: "broad" },
  strictBoundary = false, pinnedEvidence = [], explicitlyAuthorizedBroadening = false } = {}) {
  const mode = typeof strategy === "string" ? strategy : strategy?.mode;
  const strict = strictBoundary || strategy?.reason === "question_explicitly_bounded_to_selected_evidence";
  const hasPins = pinnedEvidence.length > 0 || anchors.some(anchor => anchor?.origin === "user_pinned");
  const boundaryReason = strict ? "strict_selected_evidence_boundary" :
    (mode !== "broad" || hasPins) && !explicitlyAuthorizedBroadening ? "broad_context_not_authorized" : null;
  const plan = { version: researchChapterScopeContextVersion, optional: true, boundaryReason,
    maximumChapters: researchChapterScopeContextMaximumChapters, references: [], skippedAnchors: [] };
  if (boundaryReason) return plan;
  const groups = new Map();
  for (const { anchor, index } of anchors.map((anchor, index) => ({ anchor, index }))
    .sort((a, b) => importance(b.anchor) - importance(a.anchor))) {
    const reason = anchorRejection(anchor);
    if (reason) { plan.skippedAnchors.push({ index, reason }); continue; }
    const key = chapterKey(anchor);
    if (!groups.has(key)) {
      const record = canonicalScopeRecords.find(value => sameChapter(value, anchor) && registeredAuthority(value) &&
        value.chapterScopeContext === true && value.referencePurpose === purpose && scopeTitle(value) &&
        chapterWideText(value.indexedCanonicalScopeText) && hash(value.indexedCanonicalScopeText) === value.canonicalScopeTextHash &&
        value.matchedAnchorSectionIDs?.includes(identity(anchor)));
      if (!record) { plan.skippedAnchors.push({ index, reason: "no_qualified_indexed_scope" }); continue; }
      groups.set(key, { ...record, referenceKind: "section", anchorSourceIDs: [], anchorSectionIDs: [], parentDepth: 0,
        scopeAnchorPriority: importance(anchor) });
    }
    const reference = groups.get(key);
    if (text(anchor.sourceID) && !reference.anchorSourceIDs.includes(text(anchor.sourceID))) reference.anchorSourceIDs.push(text(anchor.sourceID));
    if (!reference.anchorSectionIDs.includes(identity(anchor))) reference.anchorSectionIDs.push(identity(anchor));
    reference.parentSourceID ||= text(anchor.sourceID);
  }
  plan.references = [...groups.values()];
  return plan;
}

/** Validate fresh complete source identity/text; nomination metadata is not law. */
export async function resolveResearchChapterScopeContext(reference, resolveSection) {
  const failure = (reason, failedFields = []) => ({ source: null, limitation: {
    kind: "chapter-scope-context-unavailable", reason, fields: failedFields, optional: true,
    codePrefix: text(reference?.codePrefix), sectionNumber: text(reference?.sectionNumber),
    corpusID: text(reference?.corpusID), codeEdition: text(reference?.codeEdition)
  } });
  if (!reference?.chapterScopeContext || reference.referencePurpose !== purpose || !identity(reference) ||
      !registeredAuthority(reference) || !scopeTitle(reference) || !chapter(reference) ||
      !chapterWideText(reference.indexedCanonicalScopeText) || hash(reference.indexedCanonicalScopeText) !== reference.canonicalScopeTextHash)
    return failure("invalid_scope_reference");
  if (typeof resolveSection !== "function") return failure("canonical_resolver_unavailable");
  // Do not send cached text, legal interpretation or ranking hints to resolution.
  let canonical;
  try { canonical = await resolveSection({ sectionID: identity(reference), sectionNumber: text(reference.sectionNumber),
    ...Object.fromEntries(fields.map(field => [field, reference[field]])), sourceChapterNumber: chapter(reference),
    chapterNumber: reference.chapterNumber, origin: "permitext_cross_reference" }); }
  catch { return failure("canonical_resolution_failed"); }
  if (!canonical || typeof canonical !== "object") return failure("canonical_source_unavailable");
  const missing = ["sectionNumber", ...fields].filter(field => !text(canonical[field]));
  if (!identity(canonical)) missing.push("sectionID");
  if (!chapter(canonical)) missing.push("sourceChapterNumber");
  if (missing.length) return failure("missing_canonical_identity", missing);
  const mismatched = fields.filter(field => !sameField(field, canonical[field], reference[field]));
  if (identity(canonical) !== identity(reference)) mismatched.push("sectionID");
  if (text(canonical.sectionNumber) !== text(reference.sectionNumber)) mismatched.push("sectionNumber");
  if (chapter(canonical) !== chapter(reference)) mismatched.push("sourceChapterNumber");
  if (mismatched.length) return failure("canonical_identity_mismatch", mismatched);
  if (!registeredAuthority(canonical) || canonical.authorityClass && canonical.authorityClass !== "enacted" ||
      canonical.authorityStatus && canonical.authorityStatus !== "enacted") return failure("canonical_authority_ineligible");
  if (canonical.truncated || canonical.body?.truncated || canonical.canonicalContextComplete === false ||
      canonical.discoveryPassageOnly || canonical.pinnedSelectionExact || canonical.referenceOnly || canonical.textComplete === false ||
      canonical.body?.blocks?.some(block => block.researchClaimEligible !== false && block.truncated)) return failure("incomplete_canonical_scope");
  // The app's canonicalText also contains its separately labeled heading;
  // text is the complete enacted body, which the full index hashed.
  const bodyText = canonical.body?.blocks?.filter(block => block.researchClaimEligible !== false)
    .map(block => block.plainText || "").join("\n\n");
  const fullText = text(bodyText || canonical.text || canonical.canonicalText);
  if (!scopeTitle(canonical) || !chapterWideText(fullText)) return failure("not_enacted_chapter_scope");
  if (hash(fullText) !== reference.canonicalScopeTextHash) return failure("stale_indexed_scope");
  const source = { ...canonical, sectionID: identity(canonical), sourceChapterNumber: chapter(canonical), text: fullText, canonicalText: fullText,
    origin: "permitext_cross_reference", retrievalDepth: 1, authorityClass: "enacted", chapterScopeContext: true,
    referencePurpose: purpose, optional: true, anchorSourceIDs: [...reference.anchorSourceIDs || []],
    anchorSectionIDs: [...reference.anchorSectionIDs || []], canonicalContextResolved: true, canonicalContextComplete: true,
    signals: { chapterScopeContext: true } };
  source.evidencePriority = researchEvidencePriorityMetadata(source);
  return { source, limitation: null };
}
