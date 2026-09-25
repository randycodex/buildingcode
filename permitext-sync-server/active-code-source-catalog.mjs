import { open } from "node:fs/promises";
import { codeSourceIdentity, codeSourceKey } from "./public/active-code-sources.js";
import { historicalConstructionCodePrefixes, historicalConstructionSyncCodeVersion } from "./historical-construction-content.mjs";
import { zoningCodePrefix, zoningSyncCodeVersion } from "./zoning-content.mjs";
import { existingBuildingCodePrefix, existingBuildingSyncCodeVersion } from "./existing-building-content.mjs";

const definitions = [
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/bundle.json", import.meta.url), "2022-construction-codes", { 1: "BC", 3: "AC", 4: "FGC", 5: "PC", 6: "MC" }],
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2014-construction-codes/bundle.json", import.meta.url), "2014-construction-codes", Object.fromEntries(historicalConstructionCodePrefixes.map((prefix, index) => [index + 1, prefix])), historicalConstructionSyncCodeVersion],
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json", import.meta.url), "2026-zoning-resolution", { 1: zoningCodePrefix }, zoningSyncCodeVersion],
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json", import.meta.url), "2026-existing-building-code", { 1: existingBuildingCodePrefix }, existingBuildingSyncCodeVersion],
  // These explicit mappings match enacted-code-content's source-manifest order.
  // IDs are validated against the authored categories, never inferred from names.
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json", import.meta.url), "2026-enacted-administrative-code", { 1: "T24", 2: "T25", 3: "T26", 4: "BC68", 5: "HMC", 6: "T28", 7: "FC", 8: "LL" }],
  [new URL("../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json", import.meta.url), "2025-specialty-codes", { 1: "ECC", 2: "EC" }]
];

function arrayInMetadataPrefix(text, field) {
  const match = new RegExp(`"${field}"\\s*:\\s*\\[`).exec(text);
  if (!match) return null;
  const start = match.index + match[0].lastIndexOf("[");
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return JSON.parse(text.slice(start, index + 1));
  }
  return null;
}

/** Read only the bundle's catalog header; never JSON-decode its passage/table bodies. */
export async function readActiveCodeSourceMetadata(url) {
  const file = await open(url, "r");
  try {
    const chunks = [];
    for (let bytes = 0; bytes < 1024 * 1024;) {
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      bytes += bytesRead;
      chunks.push(buffer.subarray(0, bytesRead));
      const text = Buffer.concat(chunks).toString("utf8");
      const metadata = Object.fromEntries(["jurisdictions", "codes", "codeSections"].map(field => [field, arrayInMetadataPrefix(text, field)]));
      if (Object.values(metadata).every(Array.isArray)) return metadata;
    }
    throw new Error("Code source catalog metadata is missing or exceeds its bounded header.");
  } finally { await file.close(); }
}

export function buildActiveCodeSourceOptions(metadata, canonicalEdition, prefixes) {
  const { jurisdictions, codes, codeSections } = metadata;
  if (![jurisdictions, codes, codeSections].every(Array.isArray) || !codeSections.length) throw new Error("Invalid code source catalog metadata.");
  const unique = records => new Set(records.map(record => record.id)).size === records.length;
  if (![jurisdictions, codes, codeSections].every(unique) || codeSections.length !== Object.keys(prefixes).length) throw new Error("Ambiguous code source catalog metadata.");
  const prefixSet = new Set();
  return codeSections.map(category => {
    const code = codes.find(record => record.id === category.codeID);
    const jurisdiction = jurisdictions.find(record => record.id === code?.jurisdictionID);
    const codePrefix = prefixes[category.id];
    if (!code || !jurisdiction || !codePrefix || prefixSet.has(codePrefix) || !category.name || !code.name) throw new Error("Code source category mapping is unavailable.");
    prefixSet.add(codePrefix);
    const identity = codeSourceIdentity({ canonicalEdition, jurisdictionID: jurisdiction.id, codeID: code.id, categoryID: category.id });
    return Object.freeze({ ...identity, categoryLabel: category.name, editionLabel: code.name, codePrefix });
  });
}

const families = Object.freeze({
  "2022-construction-codes": "construction",
  "2014-construction-codes": "historical2014",
  "2026-zoning-resolution": "zoning",
  "2026-existing-building-code": "existingBuilding",
  "2026-enacted-administrative-code": "enacted",
  "2025-specialty-codes": "enacted"
});

let catalogPromise;
export function activeCodeSourceCatalog() {
  return catalogPromise ||= Promise.all(definitions.map(async ([url, directory, prefixes, canonical]) =>
    buildActiveCodeSourceOptions(await readActiveCodeSourceMetadata(url), canonical || `CodeContent/authored/new-york-city/${directory}/bundle.json#1`, prefixes)
      .map(source => Object.freeze({ ...source, family: families[directory] }))
  )).then(groups => {
    const catalog = groups.flat();
    if (new Set(catalog.map(codeSourceKey)).size !== catalog.length) throw new Error("Duplicate active code source identity.");
    return Object.freeze(catalog.sort((a, b) => codeSourceKey(a).localeCompare(codeSourceKey(b))));
  }).catch(error => { catalogPromise = undefined; throw error; });
}

/** Exact canonical edition required; ambiguous or unmatched requests never fall back. */
export async function findActiveCodeSource({ canonicalEdition, categoryID, codePrefix } = {}) {
  if (!canonicalEdition || (categoryID === undefined && !codePrefix)) return null;
  const matches = (await activeCodeSourceCatalog()).filter(source => source.canonicalEdition === canonicalEdition &&
    (categoryID === undefined || source.categoryID === categoryID) &&
    (!codePrefix || source.codePrefix === codePrefix));
  return matches.length === 1 ? matches[0] : null;
}
