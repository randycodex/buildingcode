import { syncCodeVersion } from "./sync-identity.js";

export const foregroundSyncSchedule = Object.freeze({
  activeWindowMs: 5 * 60_000,
  recentlyActiveWindowMs: 15 * 60_000,
  activeIntervalMs: 60_000,
  recentlyActiveIntervalMs: 2 * 60_000,
  idleIntervalMs: 5 * 60_000,
  maximumStalenessMs: 15 * 60_000,
  jitterMs: 5_000,
  leaderLeaseMs: 45_000,
  leaderHeartbeatMs: 15_000
});

export function foregroundSyncDelay({
  now = Date.now(),
  lastActivityAt = 0,
  random = Math.random(),
  schedule = foregroundSyncSchedule
} = {}) {
  const idleFor = Math.max(0, Number(now) - Number(lastActivityAt || 0));
  const interval = idleFor < schedule.activeWindowMs
    ? schedule.activeIntervalMs
    : idleFor < schedule.recentlyActiveWindowMs
      ? schedule.recentlyActiveIntervalMs
      : schedule.idleIntervalMs;
  const boundedRandom = Math.min(1, Math.max(0, Number(random) || 0));
  const jitter = Math.round((boundedRandom * 2 - 1) * schedule.jitterMs);
  return Math.max(500, interval + jitter);
}

export function syncCheckpointRequiresFullPull({
  checkpoint,
  latestEventID = 0,
  contentMapVersion = 0,
  entitlementFingerprint = "",
  lastFullPullAt = 0,
  now = Date.now(),
  maximumStalenessMs = foregroundSyncSchedule.maximumStalenessMs
} = {}) {
  if (!checkpoint || checkpoint.changed === true) return true;
  if (Number(checkpoint.latestEventID || 0) !== Number(latestEventID || 0)) return true;
  if (Number(checkpoint.contentMapVersion || 0) !== Number(contentMapVersion || 0)) return true;
  if (String(checkpoint.entitlementFingerprint || "") !== String(entitlementFingerprint || "")) return true;
  return Number(now) - Number(lastFullPullAt || 0) >= maximumStalenessMs;
}

export function syncLeaderLeaseIsAvailable(lease, {
  accountUserID = "",
  tabID = "",
  now = Date.now()
} = {}) {
  if (!lease || typeof lease !== "object") return true;
  if (String(lease.accountUserID || "") !== String(accountUserID || "")) return true;
  if (String(lease.tabID || "") === String(tabID || "")) return true;
  return Number(lease.expiresAt || 0) <= Number(now);
}

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

export function bulkClearEventID(clearRecords, codeVersion, scope) {
  const key = [syncCodeVersion(codeVersion), scope].join(":");
  const matchingRecords = clearRecords instanceof Map
    ? [clearRecords.get(key)]
    : (clearRecords || []).filter((candidate) => bulkClearKey(candidate) === key);
  return matchingRecords.reduce((latest, record) => {
    const eventID = Number(record?.serverEventID || 0);
    return Number.isSafeInteger(eventID) ? Math.max(latest, eventID) : latest;
  }, 0);
}

export function recordSurvivesBulkClear(record, clearRecords, scopes) {
  const updatedAt = Date.parse(record?.updatedAt || "");
  const recordEventID = Number(record?.serverEventID || 0);
  return !scopes.some((scope) => {
    const clearedAtEventID = bulkClearEventID(clearRecords, record?.codeVersion, scope);
    const clearedAt = bulkClearTimestamp(clearRecords, record?.codeVersion, scope);
    const clearedByServerOrder = Number.isSafeInteger(recordEventID) && recordEventID > 0 &&
      clearedAtEventID > 0 && clearedAtEventID >= recordEventID;
    const clearedByEditOrder = clearedAt > 0 &&
      (!Number.isFinite(updatedAt) || clearedAt >= updatedAt);
    // Old browser overlays did not always carry updatedAt. Once a durable
    // clear exists, an undated copy is necessarily older than that clear.
    // Either causal axis can prove that a queued record predates a clear;
    // this prevents an offline replay from resurrecting deleted content.
    return clearedByServerOrder || clearedByEditOrder;
  });
}

export function annotationAfterBulkClears(record, clearRecords) {
  if (!record || record.deletedAt) return null;
  const noteBody = recordSurvivesBulkClear(record, clearRecords, ["notes"])
    ? record.noteBody
    : null;
  const tags = recordSurvivesBulkClear(record, clearRecords, ["tags"])
    ? record.tags
    : [];
  const hasNote = String(noteBody || "").trim().length > 0;
  const hasTags = Array.isArray(tags) && tags.length > 0;
  return hasNote || hasTags ? { ...record, noteBody, tags } : null;
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
