// Shared identity only. Column layouts and active selection stay on each device.
export function mergeWorkspaceCatalogs(...catalogs) {
  const records = new Map();
  for (const catalog of catalogs) {
    let items;
    try { items = typeof catalog === 'string' ? JSON.parse(catalog) : catalog; } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 200 || !Number.isFinite(Date.parse(item.updatedAt))) continue;
      const record = { id: item.id, name: String(item.name || 'Workspace').slice(0, 40), updatedAt: item.updatedAt, deleted: item.deleted === true };
      const prior = records.get(record.id);
      if (!prior || record.updatedAt > prior.updatedAt || (record.updatedAt === prior.updatedAt && JSON.stringify(record) > JSON.stringify(prior))) records.set(record.id, record);
    }
  }
  return [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
}
