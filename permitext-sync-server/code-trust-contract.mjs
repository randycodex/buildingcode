export const codeTrustSchemaVersion = 1;

const verifiedOn = "2026-07-30";
const constructionCodesSourceURL =
  "https://www.nyc.gov/site/buildings/codes/2022-construction-codes.page";

function libraryByID(libraries, id) {
  return (libraries || []).find((library) => library.id === id) || {};
}

function sourceForPrefix(library, prefix) {
  return (library.codeSections || []).find((source) => source.prefix === prefix) || {};
}

function trustProfile(prefix, values) {
  return {
    schemaVersion: codeTrustSchemaVersion,
    codePrefix: prefix,
    verifiedOn,
    ...values
  };
}

function constructionProfiles() {
  const shared = {
    statusKind: "enacted-edition",
    statusLabel: "Enacted 2022 edition",
    editionLabel: "2022 NYC Construction Codes",
    effectiveDate: "2022-11-07",
    authority: "New York City Department of Buildings",
    sourceLabel: "NYC 2022 Construction Codes",
    sourceURL: constructionCodesSourceURL,
    boundary:
      "Permitext reproduces the published 2022 NYC edition. Later local laws, rules, bulletins, and project filing dates may affect applicability.",
    verificationLabel: "Official source checked"
  };
  return [
    trustProfile("BC", {
      ...shared,
      basis: "2015 International Building Code with New York City amendments"
    }),
    trustProfile("AC", {
      ...shared,
      basis: "General Administrative Provisions for the 2022 NYC Construction Codes"
    }),
    trustProfile("PC", {
      ...shared,
      basis: "2015 International Plumbing Code with New York City amendments"
    }),
    trustProfile("MC", {
      ...shared,
      basis: "2015 International Mechanical Code with New York City amendments"
    }),
    trustProfile("FGC", {
      ...shared,
      basis: "2015 International Fuel Gas Code with New York City amendments"
    })
  ];
}

function administrativeProfiles(library) {
  const currentThrough = library.statedCurrency || "";
  const shared = {
    statusKind: "current-consolidation",
    statusLabel: "Current consolidated text",
    editionLabel: "NYC Administrative Code",
    currentThrough,
    authority: library.sourceAuthority || "New York City Administrative Code",
    boundary:
      library.extractionBoundary ||
      "Enacted text is included; publisher editorial material is excluded.",
    verificationLabel: "Source snapshot checked"
  };
  return ["T24", "T25", "T26", "T28"].map((prefix) => {
    const source = sourceForPrefix(library, prefix);
    return trustProfile(prefix, {
      ...shared,
      editionLabel: source.name || shared.editionLabel,
      sourceLabel: source.name || "NYC Administrative Code",
      sourceURL: source.sourceURL || library.sourceURL || ""
    });
  });
}

export function codeTrustProfilesForLibraries(libraries = []) {
  const administrative = libraryByID(libraries, "nyc-enacted-administrative-code");
  const specialty = libraryByID(libraries, "nyc-2025-specialty-codes");
  const existing = libraryByID(libraries, "nyc-existing-building-code");
  const zoning = libraryByID(libraries, "nyc-zoning-resolution");
  const fireSource = sourceForPrefix(administrative, "FC");
  const historicalSource = sourceForPrefix(administrative, "BC68");
  const housingSource = sourceForPrefix(administrative, "HMC");
  const localLawSource = sourceForPrefix(administrative, "LL");

  return [
    ...constructionProfiles(),
    trustProfile("ECC", {
      statusKind: "current-enforced",
      statusLabel: "Current enforced code",
      editionLabel: "2025 NYC Energy Conservation Code",
      effectiveDate: specialty.energyEffectiveDate || "2026-03-30",
      authority: specialty.sourceAuthority || "New York City Department of Buildings",
      sourceLabel: "NYC Energy Conservation Code",
      sourceURL:
        specialty.energySourceURL ||
        "https://www.nyc.gov/site/buildings/codes/energy-conservation-code.page",
      basis:
        "2025 New York State energy code, based on the 2024 IECC, with New York City provisions",
      boundary:
        "Applicability depends on filing date and submission status. Complete applications filed before the enforcement date may remain under the 2020 NYCECC.",
      verificationLabel: "Official source checked"
    }),
    trustProfile("EC", {
      statusKind: "amendments-only",
      statusLabel: "Current NYC amendments only",
      editionLabel: "2025 NYC Electrical Code amendments",
      effectiveDate: specialty.electricalEffectiveDate || "2025-12-21",
      authority: specialty.sourceAuthority || "New York City Department of Buildings",
      sourceLabel: "NYC Electrical Code",
      sourceURL:
        specialty.electricalSourceURL ||
        "https://www.nyc.gov/site/buildings/codes/electrical-code.page",
      basis: "2020 NFPA 70 with New York City amendments",
      boundary:
        specialty.extractionBoundary ||
        "Permitext includes the New York City amendments only; the incorporated NFPA 70 text is not reproduced.",
      verificationLabel: "Official source checked"
    }),
    trustProfile("EBC", {
      statusKind: "future-effective",
      statusLabel: "Enacted · not yet effective",
      editionLabel: "NYC Existing Building Code",
      enactedDate: existing.enactedDate || "2026-01-17",
      effectiveDate: existing.effectiveDate || "2027-07-17",
      authority: existing.sourceAuthority || "New York City Council",
      sourceLabel: existing.effectiveDateAuthority || "NYC Existing Building Code",
      sourceURL: existing.effectiveDateSourceURL || existing.sourceURL || "",
      boundary:
        "Until July 17, 2027, existing-building work remains governed by the currently applicable Administrative Code and 2022 NYC Construction Codes.",
      verificationLabel: "Official effective date checked"
    }),
    trustProfile("FC", {
      statusKind: "current-consolidation",
      statusLabel: "Current consolidated Fire Code",
      editionLabel: fireSource.name || "2022 NYC Fire Code",
      effectiveDate: "2022-04-15",
      currentThrough: administrative.statedCurrency || "",
      authority: "New York City Fire Department",
      sourceLabel: "NYC Fire Code",
      sourceURL: "https://www.nyc.gov/site/fdny/codes/fire-code/proposed-fire-code.page",
      boundary:
        administrative.extractionBoundary ||
        "Enacted Fire Code text is included; Fire Department rules and project-specific guidance remain separate authorities.",
      verificationLabel: "Source snapshot checked"
    }),
    trustProfile("BC68", {
      statusKind: "historical",
      statusLabel: "Historical / prior code",
      editionLabel: historicalSource.name || "1968 NYC Building Code",
      authority: "New York City Department of Buildings",
      sourceLabel: "1968 Building Code reference",
      sourceURL: "https://www.nyc.gov/site/buildings/codes/1968-construction-codes.page",
      boundary:
        "Provided for prior-code research. Applicability depends on building history, later amendments, and current alteration rules; the web copy is not the sole official version.",
      verificationLabel: "Official reference page checked"
    }),
    trustProfile("HMC", {
      statusKind: "current-consolidation",
      statusLabel: "Current consolidated text",
      editionLabel: housingSource.name || "NYC Housing Maintenance Code",
      currentThrough: administrative.statedCurrency || "",
      authority: "New York City Administrative Code / HPD",
      sourceLabel: "NYC Housing Maintenance Code",
      sourceURL: "https://www.nyc.gov/assets/buildings/pdf/HousingMaintenanceCode.pdf",
      boundary:
        administrative.extractionBoundary ||
        "The Housing Maintenance Code is one part of the authorities governing dwellings; applicable rules and later laws must also be reviewed.",
      verificationLabel: "Source snapshot checked"
    }),
    ...administrativeProfiles(administrative),
    trustProfile("LL", {
      statusKind: "selected-local-laws",
      statusLabel: "Selected enacted local laws",
      editionLabel: localLawSource.name || "Construction-related local laws",
      currentThrough: administrative.statedCurrency || "",
      authority: "New York City Council",
      sourceLabel: "Construction-related unconsolidated local laws",
      sourceURL: localLawSource.sourceURL || "",
      boundary:
        "This is a selected construction-related collection, not a complete archive of New York City local laws or every provision applicable to a project.",
      verificationLabel: "Source snapshot checked"
    }),
    trustProfile("ZR", {
      statusKind: "continuously-amended",
      statusLabel: "Enacted · continuously amended",
      editionLabel: "NYC Zoning Resolution",
      currentThrough: zoning.textChangesThrough
        ? `Text changes approved through ${zoning.textChangesThrough}`
        : "",
      authority: zoning.sourceAuthority || "New York City Department of City Planning",
      sourceLabel: "NYC Zoning Resolution",
      sourceURL: zoning.sourceURL || "https://zr.planning.nyc.gov/",
      boundary:
        "Zoning applicability can depend on maps, special districts, amendments, vesting, and project facts. Permitext does not provide an official project determination.",
      verificationLabel: "Official source snapshot checked"
    })
  ];
}
