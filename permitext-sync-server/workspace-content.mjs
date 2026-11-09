import {syncCodeVersion, syncProjectIdentity} from './public/sync-identity.js';
import {recordSurvivesBulkClear} from './public/sync-state.js';

export const workspaceEvidenceKey = record => JSON.stringify([syncCodeVersion(record.codeVersion), String(record.sectionID), String(record.blockID || '').trim()]);
export const workspaceProjectKey = (record, userID) => syncProjectIdentity(record.clientID || record.id, userID) ||
  (record.localFolderID == null ? null : `legacy-project-${record.localFolderID}`);
export const workspaceLinkKey = (record, userID) => syncProjectIdentity(record.folderClientID, userID) ||
  (record.localFolderID == null ? null : `legacy-project-${record.localFolderID}`);
const stamp = record => Date.parse(record?.updatedAt || '') || 0;
const owned = (mutations, userID) => mutations.filter(m => Object.values(m)[0]?.userID === userID);
export function workspaceContentState(userID, mutations) {
  const records = owned(mutations, userID);
  const clears = records.flatMap(m => m.codeVersionClear ? [m.codeVersionClear] : []);
  const active = (record, scopes) => record && !record.deletedAt && recordSurvivesBulkClear(record, clears, scopes);
  const projects = records.flatMap(m => active(m.project, ['folders']) ? [m.project] : []);
  const projectIDs = new Set(projects.map(project => workspaceProjectKey(project, userID)));
  const links = records.flatMap(m => active(m.projectSection, ['bookmarks', 'folders']) &&
    projectIDs.has(workspaceLinkKey(m.projectSection, userID)) ? [m.projectSection] : []);
  return {projects, links,
    saves: records.flatMap(m => active(m.savedItem, ['bookmarks']) ? [m.savedItem] : []),
    notes: records.flatMap(m => active(m.annotation, ['notes']) && String(m.annotation.noteBody || '').trim() ? [m.annotation] : [])};
}

// Only retire content whose last real workspace disappears in this operation.
// Existing unassigned records are preserved; this is not a cleanup migration.
export function workspaceContentRetirements(userID, existing, incoming) {
  if (!incoming.some(m => m.project?.deletedAt || m.projectSection?.deletedAt ||
      ['folders', 'bookmarks'].includes(m.codeVersionClear?.values?.scope))) return [];
  const merged = new Map(owned(existing, userID).map(m => {
    const [kind, record] = Object.entries(m)[0]; return [`${kind}:${record.id || `${record.codeVersion}:${record.values?.scope}`}`, m];
  }));
  for (const mutation of owned(incoming, userID)) {
    const [kind, record] = Object.entries(mutation)[0];
    const key = `${kind}:${record.id || `${record.codeVersion}:${record.values?.scope}`}`;
    const previous = Object.values(merged.get(key) || {})[0];
    if (!previous || stamp(record) >= stamp(previous)) merged.set(key, {[kind]: {...previous, ...record}});
  }
  const before = workspaceContentState(userID, existing), after = workspaceContentState(userID, [...merged.values()]);
  const afterKeys = new Set(after.links.map(workspaceEvidenceKey));
  const lost = new Set(before.links.map(workspaceEvidenceKey).filter(key => !afterKeys.has(key)));
  const now = new Date([...existing, ...incoming].reduce((latest, m) => Math.max(latest, stamp(Object.values(m)[0]) + 1), Date.now())).toISOString();
  const result = [];
  // Deleting a Project also tombstones links omitted by older clients.
  for (const link of before.links) if (!after.links.some(item => item.id === link.id)) {
    const latest = [...merged.values()].find(m => m.projectSection?.id === link.id)?.projectSection;
    if (latest && !latest.deletedAt) result.push({projectSection: {...latest, updatedAt: now, deletedAt: now}});
  }
  for (const record of after.saves) if (lost.has(workspaceEvidenceKey(record))) {
    result.push({savedItem: {...record, updatedAt: now, deletedAt: now}});
  }
  for (const record of after.notes) if (lost.has(workspaceEvidenceKey(record))) {
    result.push({annotation: {...record, noteBody: '', updatedAt: now,
      deletedAt: record.tags?.length ? null : now}});
  }
  return result;
}
