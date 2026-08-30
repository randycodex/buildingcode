import {
  parseZoningHomepageHTML,
  zoningResolutionContract
} from "./zoning-resolution.mjs";

function validISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function evaluateZoningFreshness({ homepageHTML, retrievedAt = new Date().toISOString() }) {
  const homepage = parseZoningHomepageHTML(homepageHTML);
  const officialTextChangesThrough = homepage.textChangesThrough;
  const importedTextChangesThrough = zoningResolutionContract.textChangesThrough;

  if (!validISODate(officialTextChangesThrough)) {
    throw new Error("The official Zoning Resolution page did not expose a valid text-change date.");
  }
  if (!validISODate(importedTextChangesThrough)) {
    throw new Error("The imported Zoning Resolution contract has no valid text-change date.");
  }

  const status = officialTextChangesThrough === importedTextChangesThrough
    ? "current"
    : officialTextChangesThrough > importedTextChangesThrough
      ? "stale"
      : "source-behind-contract";

  return {
    schemaVersion: 1,
    retrievedAt,
    sourceAuthority: "New York City Department of City Planning",
    sourceURL: zoningResolutionContract.sourceHomepageURL,
    importedTextChangesThrough,
    officialTextChangesThrough,
    status,
    corpusFresh: status === "current",
    publicResearchEnabled: false,
    researchEnablementReady: false,
    requiredAction: status === "current"
      ? "Continue the remaining Zoning citation, table, map, amendment, applicability, evaluation, and cost gates."
      : status === "stale"
        ? `Refresh and validate the imported corpus through ${officialTextChangesThrough} before any Zoning Research enablement.`
        : "Stop and investigate why the official source date is older than the imported contract."
  };
}
