export const zoningAmendmentMetadataVersion = "20260909-requested-snapshot-v1";

const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

export function asksForZoningAmendmentHistoryEvents(question) {
  const text = compact(question);
  return /\b(?:amendment[- ]history|amendment\s+metadata)\b/i.test(text) &&
    /^(?:what|which|list|show|summarize|identify|give)\b/i.test(text);
}

export function requestedZoningAmendmentHistory(section, question, { explicitlyPinned = false } = {}) {
  if (section?.codePrefix !== "ZR" || !asksForZoningAmendmentHistoryEvents(question)) return null;
  const requestedSections = Array.from(String(question || "").matchAll(
    /(?:\bZR\s+(?:(?:Section|§)\s*)?|\bSection\s+|§\s*)(\d{1,3}-\d{2,4})\b/gi
  ), (match) => match[1]);
  if (requestedSections.length ? !requestedSections.includes(section.sectionNumber) : !explicitlyPinned) return null;
  const sources = (section.richSources || []).filter((source) => source.kind === "amendment-history" &&
    source.id && source.contentHash && compact(source.text) && source.grids?.length && source.rowCount > 1);
  if (sources.length !== 1) return null;
  const source = sources[0];
  try {
    const url = new URL(source.sourceURL);
    if (url.protocol !== "https:" || url.hostname !== "zr.planning.nyc.gov" || url.username || url.password) return null;
  } catch { return null; }
  return source;
}

export function zoningAmendmentHistoryRecord(section, history, { sourceID, characterAllowance, retrievedAt }) {
  if (!history || history.text.length > characterAllowance) return null;
  return {
    ...section,
    body: undefined,
    richSources: undefined,
    crossReferences: [],
    sourceID,
    origin: "permitext_discovered",
    sourceType: "official_metadata",
    authorityClass: "official_metadata",
    title: history.reference,
    sourceURL: history.sourceURL,
    relationship: "Official amendment-history metadata requested for this section; supplied corpus snapshot, not historical enacted text",
    retrievalReason: "The question explicitly requests this section's amendment-history events",
    retrievedAt,
    text: history.text,
    canonicalText: history.text,
    canonicalContextResolved: true,
    canonicalContextComplete: false,
    truncated: false,
    metadataCurrentness: "not_refreshed_in_this_turn",
    metadataRetrievalVersion: zoningAmendmentMetadataVersion,
    richSourceID: history.id,
    richSourceKind: history.kind,
    richSourceReference: history.reference,
    richSourceContentHash: history.contentHash,
    richSourceRowCount: history.rowCount,
    richSourceGrids: structuredClone(history.grids),
    evidencePriority: { evidenceRole: "supporting", primaryFunction: "amendment_history", claimCoverageRequired: false }
  };
}
