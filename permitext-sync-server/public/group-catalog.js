const valueKeys = ['id', 'key', 'chapterID', 'codeSectionID', 'codePrefix', 'codeVersion', 'conversationID', 'projectID', 'clientID', 'localFolderID', 'name', 'folderType', 'selectedFolderID'];
export function sharedGroup(group) {
  const paneIDs = [...new Set((group.paneIDs || []).filter(id => typeof id === 'string'))];
  const columns = {};
  for (const id of paneIDs) {
    const column = group.columns?.[id];
    if (!column || !['reader','utility','research','project','singleton'].includes(column.kind)) continue;
    columns[id] = { kind: column.kind };
    if (typeof column.key === 'string') columns[id].key = column.key;
    if (column.value) columns[id].value = Object.fromEntries(valueKeys.filter(key => ['string','number','boolean'].includes(typeof column.value[key])).map(key => [key, column.value[key]]));
  }
  return { id: group.id, name: String(group.name || 'Group').slice(0,40), paneIDs, columns };
}
export function mergeGroupCatalogs(...catalogs) {
  const map = new Map();
  for (let records of catalogs) {
    try { if (typeof records === 'string') records = JSON.parse(records); } catch { continue; }
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!record || typeof record.workspaceID !== 'string' || typeof record.id !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))) continue;
      const clean = { ...sharedGroup(record), workspaceID: record.workspaceID, order: Number(record.order) || 0, updatedAt: record.updatedAt, deleted: record.deleted === true };
      const key = JSON.stringify([clean.workspaceID, clean.id]);
      const old = map.get(key);
      if (!old || clean.updatedAt > old.updatedAt || (clean.updatedAt === old.updatedAt && JSON.stringify(clean) > JSON.stringify(old))) map.set(key, clean);
    }
  }
  return [...map.values()].sort((a,b) => a.workspaceID.localeCompare(b.workspaceID) || a.order-b.order || a.id.localeCompare(b.id));
}
export function applySharedGroups(localGroups, records) {
  return records.filter(r => !r.deleted).map(record => {
    const local = localGroups.find(g => g.id === record.id);
    const group = sharedGroup(record);
    group.collapsed = local?.collapsed || false;
    for (const id of group.paneIDs) {
      if (!group.columns[id]) continue;
      for (const key of ['width','position','collapsed','draft','draftShowing']) {
        if (local?.columns?.[id]?.[key] !== undefined) group.columns[id][key] = local.columns[id][key];
      }
    }
    return group;
  });
}
