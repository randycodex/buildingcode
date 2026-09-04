import { researchFactQualification } from "./research-fact-qualification.mjs";

export const projectFactProjectionVersion = "20260904-qualified-project-facts-v1";

const statuses = new Set(["stated", "confirmed", "sourced", "unknown", "rejected"]);
const aliases = new Map([
  ["stories", ["stories-above-grade", "Stories Above Grade"]],
  ["sprinkler-status", ["sprinkler-protection", "Sprinkler Protection"]],
  ["work-type", ["work-filing-type", "Work / Filing Type"]]
]);
const buildingCodeKeys = new Set([
  "occupancy", "construction-type", "stories-above-grade", "levels-below-grade",
  "building-height", "sprinkler-protection", "project-status", "work-filing-type",
  "code-basis", "building-area", "building-count", "residential-units", "total-units",
  "year-built", "years-altered", "building-class"
]);
const zoningKeys = new Set([
  "address", "bbl", "borough", "block", "tax-lots", "zip-code", "tax-lot-area",
  "land-use-code", "zoning-lot-composition", "zoning-districts",
  "commercial-overlays", "special-purpose-district", "zoning-map", "community-district",
  "zoning-lot-area", "lot-width", "lot-depth", "lot-type", "street-frontages",
  "mih-area-options", "affordable-housing-zoning-status", "transit-zone",
  "limited-height-district", "waterfront-status", "lower-density-growth-management-area",
  "fresh-program-area", "appendix-j-designated-m-district"
]);

function text(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function normalizedResearchProjectStructuredFacts(project) {
  return (Array.isArray(project?.structuredFacts) ? project.structuredFacts : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const key = text(item.key || item.id, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const [canonicalKey, canonicalLabel] = aliases.get(key) || [key, item.label];
    const label = text(canonicalLabel, 160);
    const recordedValue = text(item.recordedValue || item.value, 1_000);
    const sourceText = text(item.sourceText, 2_000);
    if (!key || !label || !recordedValue) return [];
    const sourceQualification = researchFactQualification(sourceText);
    // Older extractors may have stored an unconditional value beside qualified
    // source wording. The wording wins in both consumers; retain the old value
    // only as provenance, never as the projected assertion.
    const value = sourceText && (sourceQualification.qualified || sourceQualification.hypothetical)
      ? sourceText
      : text(item.value, 1_000);
    const qualification = researchFactQualification(value);
    const status = statuses.has(String(item.status || "").toLowerCase()) ? String(item.status).toLowerCase() : "stated";
    return [{
      id: text(item.id || `project-fact:${canonicalKey}`, 200),
      key: canonicalKey,
      label,
      value,
      recordedValue,
      group: buildingCodeKeys.has(canonicalKey) ? "buildingCode" : zoningKeys.has(canonicalKey) ? "zoning" : "custom",
      status,
      source: text(item.source || "description", 100),
      sourceText,
      updatedAt: item.updatedAt || null,
      hypothetical: qualification.hypothetical,
      qualified: qualification.qualified,
      usedInResearch: ["stated", "confirmed", "sourced"].includes(status)
    }];
  });
}

export function researchProjectFactLine(fact) {
  const groupLabel = fact.group === "buildingCode" ? "Building / Code Fact" : fact.group === "zoning" ? "Zoning Fact" : "Custom Fact";
  const statusLabel = fact.status === "sourced"
    ? "sourced data; verify current official records"
    : fact.status === "confirmed"
      ? "user-confirmed; not independently verified"
      : fact.status === "unknown"
        ? "unknown; not established"
        : fact.status === "rejected"
          ? "rejected; excluded from active Research"
          : "user-stated; not independently verified";
  const qualifiers = [statusLabel];
  if (fact.hypothetical) qualifiers.push("hypothetical assumption; not an established condition");
  if (fact.qualified) qualifiers.push("preserve the stated negation, scope and uncertainty");
  const source = fact.sourceText && fact.sourceText !== fact.value ? ` Original user/source wording: ${fact.sourceText}` : "";
  return `${fact.status === "unknown" ? "Unknown: " : ""}${groupLabel} — ${fact.label}: ${fact.value} (${qualifiers.join("; ")}).${source}`;
}

// This projection is shared by live Research and the immutable Report snapshot.
// Callers still own authorization and the timestamp at which they capture it.
export function projectFactProjection(project) {
  const structuredFacts = normalizedResearchProjectStructuredFacts(project);
  const address = text(project?.address, 2_000);
  const addressFact = structuredFacts.find((fact) => fact.key === "address" && fact.value === address && fact.usedInResearch);
  const usableFacts = structuredFacts.filter((fact) => fact.usedInResearch && fact.key !== "floor-affected");
  if (address && !addressFact) usableFacts.unshift({
    id: "project-address", key: "address", label: "Address", value: address, recordedValue: address,
    status: "confirmed", source: "project-record", sourceText: "", group: "zoning",
    updatedAt: project?.updatedAt || null, hypothetical: false, qualified: false, usedInResearch: true
  });
  const buildingCodeFacts = usableFacts.filter((fact) => fact.group === "buildingCode");
  const zoningFacts = usableFacts.filter((fact) => fact.group === "zoning");
  const customFacts = usableFacts.filter((fact) => fact.group === "custom");
  const description = text(project?.description, 4_000);
  const additionalFacts = description ? [`Additional Project facts (user wording; not independently verified): ${description}`] : [];
  const researchFacts = [
    ...buildingCodeFacts, ...zoningFacts, ...customFacts,
    ...structuredFacts.filter((fact) => fact.status === "unknown")
  ].map(researchProjectFactLine).concat(additionalFacts);
  const reportFacts = [
    ...structuredFacts,
    ...usableFacts.filter((fact) => fact.id === "project-address")
  ].map(researchProjectFactLine).concat(additionalFacts).join("\n\n");
  return {
    projectionVersion: projectFactProjectionVersion,
    address, description, structuredFacts, usableFacts,
    buildingCodeFacts, zoningFacts, customFacts,
    researchFacts, reportFacts,
    missingFactsAreUnknown: true
  };
}
