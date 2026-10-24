// Pure code-library helpers shared by the page and download worker. Keep this
// module independent of account storage, service workers, and app releases.
import { parseActiveCodeSearchScope } from "./active-code-search-scope.js";
import { codeSourceIdentity, codeSourceKey } from "./active-code-sources.js?v=2";
import { syncCodeVersion } from "./sync-identity.js?v=20261021-identity-fast-path-v8";

function normalizedOfflineAssetName(value) {
  const source = String(value || "").split(/[?#]/, 1)[0];
  if (!source || source.startsWith("data:")) return null;
  let decoded = source;
  try {
    decoded = decodeURIComponent(source);
  } catch {
    // Use the undecoded source so malformed input is rejected by the allowlist below.
  }
  const name = decoded.split("/").at(-1) || "";
  return /^[a-zA-Z0-9._-]+$/.test(name) ? name : null;
}

export function offlineAssetNamesForChapter(chapter) {
  const names = new Set();
  for (const section of chapter?.sections || []) {
    for (const block of section?.blocks || []) {
      const imageID = normalizedOfflineAssetName(block?.imageID);
      if (imageID) names.add(imageID);
      for (const match of String(block?.html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
        const name = normalizedOfflineAssetName(match[1]);
        if (name) names.add(name);
      }
    }
  }
  return [...names];
}

export function validatedOfflineCodeSources(value) {
  if (!Array.isArray(value) || !value.length) throw new Error("Offline code source metadata is unavailable. Update the offline download when connected.");
  const keys = new Set();
  return value.map(source => {
    const identity = codeSourceIdentity(source);
    const key = codeSourceKey(identity);
    if (keys.has(key) || typeof source.codePrefix !== "string" || !source.codePrefix) throw new Error("Offline code source metadata is invalid. Update the offline download when connected.");
    keys.add(key);
    return { ...identity, codePrefix: source.codePrefix,
      ...(typeof source.categoryLabel === "string" ? { categoryLabel: source.categoryLabel } : {}),
      ...(typeof source.editionLabel === "string" ? { editionLabel: source.editionLabel } : {}) };
  });
}

export function offlineSourceIdentity(record, sources) {
  if (!record || typeof record.codeVersion !== "string" || !record.codeVersion || record.codeSectionID == null) return null;
  const matches = sources.filter(source => source.canonicalEdition === syncCodeVersion(record.codeVersion) &&
    source.categoryID === record.codeSectionID && source.codePrefix === record.codePrefix);
  return matches.length === 1 ? codeSourceIdentity(matches[0]) : null;
}

export function offlineSourceScope(metadata, url) {
  if (!url.searchParams.has("sourceScope")) return null;
  // An explicit empty scope needs no catalog identity, including old downloads.
  // Run the shared strict parser first; malformed or duplicate parameters do
  // not become an unrestricted legacy request.
  try {
    const empty = parseActiveCodeSearchScope(url.searchParams, []);
    if (empty.isEmpty) return { isEmpty: true, permits() { return false; } };
  } catch (error) {
    if (error.message !== "A requested code source is not installed.") throw error;
  }
  const sources = validatedOfflineCodeSources(metadata.codeSources);
  const scope = parseActiveCodeSearchScope(url.searchParams, sources);
  return { isEmpty: scope.isEmpty, permits(record) {
    const identity = offlineSourceIdentity(record, sources);
    if (!identity) throw new Error("Exact offline code source identity is unavailable. Update the offline download when connected.");
    return scope.isEnabled(identity);
  } };
}

export function offlineSectionMetadata(record, metadata, requestedVersions = []) {
  if (requestedVersions.length > 1 || (requestedVersions.length && !requestedVersions[0].trim())) throw new Error("Provide one nonempty code edition.");
  const identity = offlineSourceIdentity(record, validatedOfflineCodeSources(metadata.codeSources));
  if (!identity) throw new Error("Exact offline code source identity is unavailable. Update the offline download when connected.");
  if (requestedVersions.length && requestedVersions[0] !== identity.canonicalEdition) throw new Error("This section does not belong to the requested code edition.");
  return { id: Number(record.id), sectionID: Number(record.id), webSectionID: record.webSectionID || null,
    chapterID: record.chapterID, codePrefix: record.codePrefix,
    codeVersion: identity.canonicalEdition, codeSectionID: identity.categoryID,
    chapterNumber: record.chapterNumber, sectionNumber: record.sectionNumber, title: record.title,
    codeSource: identity };
}

export function resolveOfflineSectionMetadata(records, metadata, { code, sectionNumber, version }) {
  const normalized = value => String(value || "").replace(/^Section\s+/i, "").replace(/\([^)]+\)/g, "").trim().toLowerCase();
  if (!code || !version || !version.trim() || !normalized(sectionNumber)) throw new Error("Provide one code, section number, and canonical edition.");
  const matches = new Map();
  for (const record of records) {
    if (record.codePrefix !== code || record.codeVersion !== version || normalized(record.sectionNumber) !== normalized(sectionNumber)) continue;
    const section = offlineSectionMetadata(record, metadata, [version]);
    matches.set(String(section.id), section);
  }
  if (!matches.size) { const error = new Error("This exact offline section was not found."); error.statusCode = 404; throw error; }
  if (matches.size > 1) { const error = new Error("This offline section reference is ambiguous."); error.statusCode = 409; throw error; }
  return [...matches.values()][0];
}
