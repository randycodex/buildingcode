import { createHash } from "node:crypto";

export const researchSourceBodyStateVersion = "20261005-canonical-source-body-state-v1";
const compact = value => String(value || "").replace(/\s+/g, " ").trim();
const identityFields = ["sectionID", "codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition", "jurisdiction"];
const importerPlaceholder = "[Repealed or reserved; no operative text in source.]";

// This describes the local record, not the legal status of a provision. Keep
// the importer marker and catalog headings out of the operative-text class.
export function researchSourceBodyState(section, body) {
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  const rawText = blocks.map(block => String(block?.plainText || "")).join("\n\n");
  const nonempty = blocks.filter(block => compact(block?.plainText));
  const bodyStatus = !compact(rawText) ? "plain_text_empty"
    : nonempty.every(block => block.catalogTitleOnly === true) ? "catalog_title_only"
    : nonempty.every(block => compact(block.plainText) === importerPlaceholder) ? "importer_placeholder_only" : null;
  if (!bodyStatus) return null;
  const identity = Object.fromEntries(identityFields.map(field => [field,
    compact(field === "sectionID" ? section?.sectionID || section?.id : section?.[field])]));
  if (!identityFields.every(field => identity[field])) return null;
  const source = body?.enactedTextSource;
  const heading = String(body?.title || "");
  const publicationHeading = heading && heading.length <= 240 && compact(heading) === compact(section?.title) &&
    String(body?.sectionID) === identity.sectionID && source?.researchEligibility === true &&
    /^source-extracted\b/.test(source.verificationStatus || "") && /^[a-f0-9]{64}$/.test(source.archiveSHA256 || "") &&
    /^https:\/\//.test(source.sourceURL || "")
    ? { kind: "source_extracted_heading", text: heading,
        textSHA256: createHash("sha256").update(heading).digest("hex"),
        sourceURL: source.sourceURL, archiveSHA256: source.archiveSHA256, refreshedThisTurn: false } : null;
  return {
    version: researchSourceBodyStateVersion,
    ...identity,
    bodyStatus,
    bodyTextSHA256: createHash("sha256").update(rawText).digest("hex"),
    bodyTextCharacterCount: rawText.length,
    catalogTitle: compact(section?.title).slice(0, 240),
    ...(publicationHeading ? { publicationHeading } : {}),
    catalogTitleIsOperativeText: false,
    historicalStatusEstablished: false,
    operativePlainTextSupplied: false
  };
}

export function matchingResearchSourceBodyState(state, request = {}) {
  if (state?.version !== researchSourceBodyStateVersion ||
      !identityFields.every(field => typeof state[field] === "string" && state[field].trim()) ||
      !["plain_text_empty", "catalog_title_only", "importer_placeholder_only"].includes(state.bodyStatus) ||
      !/^[a-f0-9]{64}$/.test(state.bodyTextSHA256 || "") ||
      !Number.isSafeInteger(state.bodyTextCharacterCount) || state.bodyTextCharacterCount < 0 ||
      state.catalogTitleIsOperativeText !== false || state.historicalStatusEstablished !== false ||
      state.operativePlainTextSupplied !== false) return null;
  if (identityFields.some(field => compact(request[field]) && compact(request[field]) !== state[field])) return null;
  // Return only server-defined fields. Neither search hints nor caught error
  // messages can inject a status interpretation or prompt instruction.
  const heading = state.publicationHeading;
  const validHeading = heading?.kind === "source_extracted_heading" && typeof heading.text === "string" && heading.text.length <= 240 &&
    compact(heading.text) === compact(state.catalogTitle) && heading.refreshedThisTurn === false &&
    createHash("sha256").update(heading.text).digest("hex") === heading.textSHA256 &&
    /^[a-f0-9]{64}$/.test(heading.archiveSHA256 || "") && /^https:\/\//.test(heading.sourceURL || "");
  return { version: state.version, ...Object.fromEntries(identityFields.map(field => [field, state[field]])),
    bodyStatus: state.bodyStatus, bodyTextSHA256: state.bodyTextSHA256,
    bodyTextCharacterCount: state.bodyTextCharacterCount, catalogTitle: compact(state.catalogTitle).slice(0, 240),
    ...(validHeading ? { publicationHeading: { kind: heading.kind, text: heading.text, textSHA256: heading.textSHA256,
      sourceURL: heading.sourceURL, archiveSHA256: heading.archiveSHA256, refreshedThisTurn: false } } : {}),
    catalogTitleIsOperativeText: false, historicalStatusEstablished: false, operativePlainTextSupplied: false };
}

export const researchSourceBodyStateInstruction =
  "SOURCE_BODY_STATE and SOURCE_AVAILABILITY describe freshly inspected local records, not enacted rules. " +
  "An empty plain-text body establishes only that this record supplies no operative plain text; it does not establish legal Reserved status or absence of rules elsewhere. " +
  "An importer placeholder is synthetic text, not an enacted statement that a provision was repealed or reserved. " +
  "A catalog title may be described accurately as a catalog label; it cannot supply an operative requirement, a repeal history, or historical wording. " +
  "When a source_extracted_heading is supplied with its canonical snapshot provenance, an accurate description of that heading is supported by that snapshot; it is not a live publication refresh or historical enacted text. " +
  "Keep publication headings, body availability and legal history distinct. Do not infer requirements from an old title or borrow a neighboring provision's rule. " +
  "Reject any substantive or historical assertion unsupported by actual supplied enacted text; a real record boundary may be explained without inventing a positive rule point or citation.";

export function researchSourceBodyStatePrompt(state) {
  const valid = matchingResearchSourceBodyState(state);
  return valid ? `SOURCE_BODY_STATE: ${JSON.stringify(valid)}` : "";
}

export function researchSourceAvailabilityPrompt(records = []) {
  const valid = (Array.isArray(records) ? records : []).slice(0, 12)
    .map(value => matchingResearchSourceBodyState(value)).filter(Boolean);
  return valid.length ? ["SOURCE_AVAILABILITY — LOCAL RECORD STATE; NOT ENACTED EVIDENCE OR CITABLE PASSAGES",
    researchSourceBodyStateInstruction, JSON.stringify(valid)].join("\n") : "";
}
