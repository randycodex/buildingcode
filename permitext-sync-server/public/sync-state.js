import { syncCodeVersion } from "./sync-identity.js";

export function bulkClearScope(record) {
  return String(record?.values?.scope || "").trim();
}

export function bulkClearKey(record) {
  const scope = bulkClearScope(record);
  if (!scope) return null;
  return [syncCodeVersion(record.codeVersion), scope].join(":");
}

export function bulkClearTimestamp(clearRecords, codeVersion, scope) {
  const key = [syncCodeVersion(codeVersion), scope].join(":");
  const matchingRecords = clearRecords instanceof Map
    ? [clearRecords.get(key)]
    : (clearRecords || []).filter((candidate) => bulkClearKey(candidate) === key);
  return matchingRecords.reduce((latest, record) => {
    const timestamp = Date.parse(record?.updatedAt || "");
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

export function recordSurvivesBulkClear(record, clearRecords, scopes) {
  const updatedAt = Date.parse(record?.updatedAt || "");
  return !scopes.some((scope) => {
    const clearedAt = bulkClearTimestamp(clearRecords, record?.codeVersion, scope);
    if (clearedAt <= 0) return false;
    // Old browser overlays did not always carry updatedAt. Once a durable
    // clear exists, an undated copy is necessarily older than that clear.
    return !Number.isFinite(updatedAt) || clearedAt >= updatedAt;
  });
}

export function mergeNewestRecord(recordsByIdentity, identity, candidate) {
  if (!identity || !candidate) return;
  const existing = recordsByIdentity.get(identity);
  if (!existing) {
    recordsByIdentity.set(identity, candidate);
    return;
  }
  const existingUpdatedAt = Date.parse(existing.updatedAt || "");
  const candidateUpdatedAt = Date.parse(candidate.updatedAt || "");
  if (
    (Number.isFinite(candidateUpdatedAt) && !Number.isFinite(existingUpdatedAt)) ||
    (Number.isFinite(candidateUpdatedAt) && candidateUpdatedAt > existingUpdatedAt)
  ) {
    recordsByIdentity.set(identity, candidate);
  }
}
