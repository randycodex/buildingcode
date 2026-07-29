export const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
export const zoningSyncCodeVersion = "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";
export const existingBuildingSyncCodeVersion =
  "CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1";
export const enactedAdministrativeSyncCodeVersion =
  "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1";
export const specialtyCodesSyncCodeVersion =
  "CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json#1";
const enactedAdministrativePrefixes = new Set([
  "T24", "T25", "T26", "BC68", "HMC", "T28", "FC", "LL"
]);
const specialtyCodePrefixes = new Set(["ECC", "EC"]);

export function syncCodeVersion(value) {
  const candidate = String(value || "").trim();
  const normalized = candidate.toLocaleLowerCase("en-US");
  if (
    !candidate ||
    normalized === "nyc-2022" ||
    normalized === "2022 construction codes" ||
    normalized === defaultSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return defaultSyncCodeVersion;
  if (
    normalized === "nyc-zoning-resolution" ||
    normalized === "nyc zoning resolution" ||
    normalized === "nyc zoning resolution — text through 2026-07-16" ||
    normalized === zoningSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return zoningSyncCodeVersion;
  if (
    normalized === "nyc-existing-building-code" ||
    normalized === "nyc existing building code" ||
    normalized ===
      "nyc existing building code - enacted 2026-01-17; effective 2027-07-17" ||
    normalized === existingBuildingSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return existingBuildingSyncCodeVersion;
  if (
    normalized === "nyc-enacted-administrative-code" ||
    normalized === "nyc enacted administrative code" ||
    normalized === enactedAdministrativeSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return enactedAdministrativeSyncCodeVersion;
  if (
    normalized === "nyc-2025-specialty-codes" ||
    normalized === "2025 nyc energy conservation and electrical codes" ||
    normalized === specialtyCodesSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return specialtyCodesSyncCodeVersion;
  return candidate;
}

export function syncCodeVersionForPrefix(prefix) {
  const normalized = String(prefix || "").trim().toUpperCase();
  if (normalized === "ZR") return zoningSyncCodeVersion;
  if (normalized === "EBC") return existingBuildingSyncCodeVersion;
  if (enactedAdministrativePrefixes.has(normalized)) return enactedAdministrativeSyncCodeVersion;
  if (specialtyCodePrefixes.has(normalized)) return specialtyCodesSyncCodeVersion;
  return defaultSyncCodeVersion;
}

function nonEmpty(value) {
  const candidate = String(value ?? "").trim();
  return candidate || null;
}

export function syncProjectIdentity(value, userID = null) {
  let candidate = nonEmpty(value);
  if (!candidate) return null;

  while (candidate) {
    const explicitPrefix = nonEmpty(userID) ? `${String(userID).trim()}:project:` : null;
    const markerIndex = explicitPrefix
      ? (candidate.startsWith(explicitPrefix) ? 0 : -1)
      : candidate.indexOf(":project:");
    if (markerIndex === -1) return candidate;

    const prefixEnd = explicitPrefix
      ? explicitPrefix.length
      : markerIndex + ":project:".length;
    const prefix = candidate.slice(0, prefixEnd);
    const remainder = candidate.slice(prefixEnd);
    const separatorIndex = remainder.indexOf(":");
    if (separatorIndex === -1) return candidate;
    const codeVersion = remainder.slice(0, separatorIndex);
    const identity = remainder.slice(separatorIndex + 1).trim();
    if (!identity) return candidate;
    if (identity.startsWith(prefix)) {
      candidate = identity;
      continue;
    }
    if (codeVersion.toLocaleLowerCase("en-US") === defaultSyncCodeVersion.toLocaleLowerCase("en-US")) {
      return identity;
    }
    return candidate;
  }
  return null;
}

export function syncMutationRecordID(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  if (!kind || !record?.userID) return null;

  const userID = nonEmpty(record.userID);
  const codeVersion = syncCodeVersion(record.codeVersion);
  const sectionID = nonEmpty(record.sectionID);

  if (kind === "savedItem") {
    return sectionID ? [userID, "saved", codeVersion, sectionID].join(":") : null;
  }
  if (kind === "annotation") {
    if (!sectionID) return null;
    return [
      userID,
      record.tags !== undefined ? "tags" : "note",
      codeVersion,
      sectionID,
      nonEmpty(record.blockID)
    ].filter(Boolean).join(":");
  }
  if (kind === "project") {
    const projectID = syncProjectIdentity(record.clientID, userID) ||
      syncProjectIdentity(record.id, userID) ||
      nonEmpty(record.localFolderID);
    return projectID ? [userID, "project", codeVersion, projectID].join(":") : null;
  }
  if (kind === "projectSection") {
    const projectID = syncProjectIdentity(record.folderClientID, userID) || nonEmpty(record.localFolderID);
    if (!sectionID) return null;
    return [
      userID,
      "project-section",
      codeVersion,
      projectID,
      sectionID,
      nonEmpty(record.blockID),
      nonEmpty(record.scope)
    ]
      .filter(Boolean)
      .join(":");
  }
  if (kind === "workboard") {
    const projectID = nonEmpty(record.projectID);
    return projectID ? [userID, "workboard", projectID].join(":") : null;
  }
  if (kind === "continuity") {
    return [userID, "continuity", codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    const scope = nonEmpty(record.values?.scope);
    return scope ? [userID, "code-version-clear", codeVersion, scope].join(":") : null;
  }
  return nonEmpty(record.id);
}
