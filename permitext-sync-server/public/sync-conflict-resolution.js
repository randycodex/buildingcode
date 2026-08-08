export function stableSyncConflictValue(value) {
  if (Array.isArray(value)) return value.map(stableSyncConflictValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableSyncConflictValue(value[key])]));
}

export function syncConflictSemanticRecord(record) {
  if (!record || typeof record !== "object") return record;
  const semantic = { ...record };
  delete semantic.updatedAt;
  delete semantic.serverVersion;
  if (Array.isArray(semantic.tags)) semantic.tags = [...semantic.tags].map(String).sort();
  return stableSyncConflictValue(semantic);
}

export function syncConflictRecordsMatch(localRecord, serverRecord) {
  return JSON.stringify(syncConflictSemanticRecord(localRecord)) ===
    JSON.stringify(syncConflictSemanticRecord(serverRecord));
}
