// Shared field names for the property importer, Project editor and Research.
export const nycMappedFactFields = [
  { key: "special-purpose-subdistrict", label: "Special Purpose Subdistrict / Subarea" },
  { key: "mih-area-options", label: "MIH Area / Applicable Option(s)" },
  { key: "affordable-housing-zoning-status", label: "Affordable Housing Zoning Status" },
  { key: "greater-transit-zone", label: "Greater Transit Zone" },
  { key: "parking-geography", label: "Transit Zones Parking Geography" },
  { key: "appendix-i-transit-zone", label: "Appendix I Transit Zone" },
  { key: "zoning-for-accessibility", label: "Zoning for Accessibility" },
  { key: "limited-height-district", label: "Limited Height District" },
  { key: "landmark-status", label: "Landmark Designations" },
  { key: "historic-district", label: "Historic District" },
  { key: "flood-zone-effective-2007", label: "Flood Zone — Effective FIRM 2007" },
  { key: "flood-zone-preliminary-2015", label: "Flood Zone — Preliminary FIRM 2015" },
  { key: "environmental-designations", label: "Environmental E-Designations" },
  { key: "coastal-zone", label: "Coastal Zone" },
  { key: "waterfront-status", label: "Waterfront Status / Waterfront Access Plan" },
  { key: "lower-density-growth-management-area", label: "Lower Density Growth Management Area" },
  { key: "fresh-program-area", label: "FRESH Program Area" },
  { key: "appendix-j-designated-m-district", label: "Appendix J Designated M District" },
  { key: "adopted-zoning-map-amendments", label: "Adopted Zoning Map Amendments" },
  { key: "pending-zoning-map-amendments", label: "Pending Zoning Map Amendments" }
];

export function mergeNYCPropertyFacts(existingFacts, incomingFacts, retrievedAt) {
  const incoming = new Map(incomingFacts.map(fact => [fact.key, fact]));
  const merged = existingFacts.flatMap(fact => {
    // User edits and rejected facts remain authoritative for the Project.
    if (fact.source !== "nyc-planning" || fact.status === "rejected") {
      incoming.delete(fact.key);
      return [fact];
    }
    const replacement = incoming.get(fact.key);
    incoming.delete(fact.key);
    if (replacement) return [replacement];
    // Retire the ambiguous legacy transit field on an explicit refresh.
    if (fact.key === "transit-zone") return [];
    return [{ ...fact, value: "Unknown — current NYC Planning data unavailable", status: "unknown",
      sourceText: `NYC Planning refresh; retrieved ${retrievedAt.slice(0, 10)}.`, updatedAt: retrievedAt }];
  });
  return [...merged, ...incoming.values()];
}

export function previewNYCPropertyRefresh(existingFacts, incomingFacts, retrievedAt) {
  const existing = new Map(existingFacts.map(fact => [fact.key, fact]));
  const incoming = new Map(incomingFacts.map(fact => [fact.key, fact]));
  return [...new Set([...incoming.keys(), ...existing.keys()])].flatMap(key => {
    const current = existing.get(key);
    const next = incoming.get(key);
    const protectedFact = current && (current.source !== "nyc-planning" || ["confirmed", "rejected"].includes(current.status));
    if (!next && (!current || protectedFact)) return [];
    const unavailable = !next || next.status === "unknown";
    if (!current && unavailable) return [];
    const kind = protectedFact ? "conflict" : unavailable ? "unavailable" : !current ? "new" : current.value !== next.value ? "changed" : "unchanged";
    const replacement = unavailable ? {
      ...current, status: "unknown", updatedAt: retrievedAt,
      sourceText: `${current.sourceText || ""} Last refresh ${retrievedAt}: current NYC Planning data unavailable; retained previous value for review.`
    } : next;
    return [{ key, label: next?.label || current.label || key, current, next, replacement, kind,
      selected: !protectedFact, retrievedAt }];
  });
}

export function applyNYCPropertyRefresh(existingFacts, preview, selectedKeys) {
  const replacements = new Map(preview.filter(row => selectedKeys.has(row.key)).map(row => [row.key, row.replacement]));
  const merged = existingFacts.map(fact => {
    const replacement = replacements.get(fact.key);
    replacements.delete(fact.key);
    return replacement || fact;
  });
  return [...merged, ...replacements.values()];
}
