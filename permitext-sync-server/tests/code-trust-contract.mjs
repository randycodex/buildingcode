import assert from "node:assert/strict";

import {
  codeTrustProfilesForLibraries,
  codeTrustSchemaVersion
} from "../code-trust-contract.mjs";

const sourceURL = "https://example.test/official";
const libraries = [
  {
    id: "nyc-enacted-administrative-code",
    statedCurrency: "Current through Local Law 116 of 2026",
    sourceAuthority: "New York City Administrative Code",
    sourceURL,
    extractionBoundary: "Enacted text only.",
    codeSections: ["FC", "BC68", "HMC", "T24", "T25", "T26", "T28", "LL"].map((prefix) => ({
      prefix,
      name: `${prefix} official text`,
      sourceURL: `${sourceURL}/${prefix.toLowerCase()}`
    }))
  },
  {
    id: "nyc-2025-specialty-codes",
    sourceAuthority: "New York City Department of Buildings",
    energyEffectiveDate: "2026-03-30",
    electricalEffectiveDate: "2025-12-21",
    energySourceURL: `${sourceURL}/energy`,
    electricalSourceURL: `${sourceURL}/electrical`,
    extractionBoundary: "NYC amendments only; incorporated NFPA 70 text is not reproduced."
  },
  {
    id: "nyc-existing-building-code",
    sourceAuthority: "New York City Council",
    sourceURL: `${sourceURL}/existing`,
    effectiveDateAuthority: "NYC Existing Building Code",
    effectiveDateSourceURL: `${sourceURL}/existing-effective-date`,
    enactedDate: "2026-01-17",
    effectiveDate: "2027-07-17"
  },
  {
    id: "nyc-zoning-resolution",
    sourceAuthority: "New York City Department of City Planning",
    sourceURL: `${sourceURL}/zoning`,
    textChangesThrough: "2026-07-16"
  }
];

const expectedPrefixes = [
  "BC", "AC", "PC", "MC", "FGC", "ECC", "EC", "EBC", "FC",
  "BC68", "HMC", "T24", "T25", "T26", "T28", "LL", "ZR"
];
const profiles = codeTrustProfilesForLibraries(libraries);
const profilesByPrefix = new Map(profiles.map((profile) => [profile.codePrefix, profile]));

assert.equal(codeTrustSchemaVersion, 1);
assert.equal(profiles.length, expectedPrefixes.length);
assert.equal(profilesByPrefix.size, expectedPrefixes.length);
assert.deepEqual([...profilesByPrefix.keys()].sort(), [...expectedPrefixes].sort());

for (const profile of profiles) {
  assert.equal(profile.schemaVersion, codeTrustSchemaVersion);
  assert.match(profile.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  for (const field of [
    "statusKind",
    "statusLabel",
    "editionLabel",
    "authority",
    "sourceLabel",
    "sourceURL",
    "boundary",
    "verificationLabel"
  ]) {
    assert.ok(String(profile[field] || "").trim(), `${profile.codePrefix}.${field} must be present`);
  }
}

assert.equal(profilesByPrefix.get("BC").statusKind, "enacted-edition");
assert.equal(profilesByPrefix.get("BC").effectiveDate, "2022-11-07");
assert.match(profilesByPrefix.get("BC").basis, /International Building Code/i);
assert.equal(profilesByPrefix.get("EC").statusKind, "amendments-only");
assert.match(profilesByPrefix.get("EC").boundary, /NFPA 70 text is not reproduced/i);
assert.equal(profilesByPrefix.get("EBC").statusKind, "future-effective");
assert.equal(profilesByPrefix.get("EBC").effectiveDate, "2027-07-17");
assert.equal(profilesByPrefix.get("BC68").statusKind, "historical");
assert.equal(profilesByPrefix.get("LL").statusKind, "selected-local-laws");
assert.equal(profilesByPrefix.get("ZR").statusKind, "continuously-amended");
assert.match(profilesByPrefix.get("ZR").currentThrough, /2026-07-16/);

const reorderedByPrefix = new Map(
  codeTrustProfilesForLibraries([...libraries].reverse())
    .map((profile) => [profile.codePrefix, profile])
);
assert.deepEqual(reorderedByPrefix, profilesByPrefix);

console.log("code trust contract tests passed");
