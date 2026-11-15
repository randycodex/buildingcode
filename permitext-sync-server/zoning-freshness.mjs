import {
  parseZoningHomepageHTML,
  zoningResolutionContract
} from "./zoning-resolution.mjs";

function validISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function evaluateZoningFreshness({ homepageHTML, sourceManifest, retrievedAt = new Date().toISOString() }) {
  const homepage = parseZoningHomepageHTML(homepageHTML);
  const officialTextChangesThrough = homepage.textChangesThrough;
  const importedTextChangesThrough = sourceManifest?.textChangesThrough;
  const consolidatedTextChangesThrough = sourceManifest?.consolidatedTextChangesThrough;

  if (!validISODate(officialTextChangesThrough)) {
    throw new Error("The official Zoning Resolution page did not expose a valid text-change date.");
  }
  if (!validISODate(importedTextChangesThrough)) {
    throw new Error("The imported Zoning Resolution contract has no valid text-change date.");
  }

  const supplements = sourceManifest?.adoptedAmendments || [];
  const supplementsComplete = [736, 737].every(resolution => supplements.some(item =>
    item.resolution === resolution && item.adoptedDate === "2026-11-12" &&
    /^[a-f0-9]{64}$/.test(item.sourceSHA256 || "") && item.affectedSections?.length));
  const expectedSnapshot = importedTextChangesThrough === zoningResolutionContract.textChangesThrough &&
    consolidatedTextChangesThrough === zoningResolutionContract.consolidatedTextChangesThrough && supplementsComplete;
  const status = !expectedSnapshot ? "incomplete-import"
    : officialTextChangesThrough === consolidatedTextChangesThrough
    ? "current-with-adopted-supplements"
    : officialTextChangesThrough > consolidatedTextChangesThrough
      ? "stale"
      : "source-behind-contract";

  return {
    schemaVersion: 1,
    retrievedAt,
    sourceAuthority: "New York City Department of City Planning",
    sourceURL: zoningResolutionContract.sourceHomepageURL,
    importedTextChangesThrough,
    consolidatedTextChangesThrough,
    officialTextChangesThrough,
    adoptedSupplementCount: supplements.length,
    status,
    corpusFresh: status === "current-with-adopted-supplements",
    requiredAction: status === "current-with-adopted-supplements"
      ? "DCP consolidation matches the imported baseline; Council Resolutions 736 and 737 supply the November 12 adopted amendments. Continue monitoring both sources."
      : status === "stale"
        ? `Refresh and validate the imported corpus through ${officialTextChangesThrough} before any Zoning Research enablement.`
        : status === "incomplete-import" ? "Refresh and validate the imported snapshot and both adopted Council supplements."
        : "Stop and investigate why the official source date is older than the imported consolidation."
  };
}
