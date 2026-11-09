import { createHash } from 'node:crypto';
import { recordSurvivesBulkClear } from './public/sync-state.js';
import { syncCodeVersion } from './public/sync-identity.js';
import {workspaceContentState, workspaceEvidenceKey, workspaceProjectKey, workspaceLinkKey} from './workspace-content.mjs';

export const trashRetentionDays = 30;
const kinds = new Set(['savedItem', 'annotation', 'project', 'projectSection']);
const entry = mutation => Object.entries(mutation || {})[0] || [];
const timestamp = record => Date.parse(record?.updatedAt || '') || 0;
const scopesFor = kind => kind === 'annotation' ? ['notes'] : kind === 'project' ? ['folders'] : kind === 'projectSection' ? ['bookmarks', 'folders'] : ['bookmarks'];
const clearsFrom = mutations => mutations.filter(m => m.codeVersionClear).map(m => m.codeVersionClear);
function active(kind, record, clears) {
  return !record.deletedAt && recordSurvivesBulkClear(record, clears, scopesFor(kind));
}

// Preserve the last visible value, never a previously deleted or cleared copy.
// Capture only mutations accepted by the ordinary sync conflict rules.
export function captureTrash(userID, existing, accepted, now = new Date()) {
  const workspaceState = workspaceContentState(userID, existing);
  const clears = clearsFrom(existing);
  const incomingClears = clearsFrom(accepted);
  const incomingByID = new Map();
  for (const [, record] of accepted.map(entry)) {
    if (record?.id) incomingByID.set(record.id, [...(incomingByID.get(record.id) || []), record]);
  }
  const records = [];
  for (const mutation of existing) {
    const [kind, record] = entry(mutation);
    if (!kinds.has(kind) || record.userID !== userID || !active(kind,record,clears)) continue;
    const changes = (incomingByID.get(record.id) || []).filter(next => timestamp(next) >= timestamp(record));
    const directDelete = changes.some(next => next.deletedAt);
    const noteRemoved = kind === 'annotation' && String(record.noteBody || '').trim() && changes.some(next => !String(next.noteBody || '').trim());
    const bulk = incomingClears.some(clear => syncCodeVersion(clear.codeVersion) === syncCodeVersion(record.codeVersion)
      && scopesFor(kind).includes(clear.values?.scope) && timestamp(clear) >= timestamp(record));
    if (!(directDelete || noteRemoved || bulk)) continue;
    if (kind === 'annotation' && !String(record.noteBody || '').trim()) continue;
    const original = structuredClone(record);
    delete original.serverEventID;
    const projectIDs = kind === 'project' ? [workspaceProjectKey(record, userID)]
      : kind === 'projectSection' ? [workspaceLinkKey(record, userID)]
      : workspaceState.links.filter(link => workspaceEvidenceKey(link) === workspaceEvidenceKey(record)).map(link => workspaceLinkKey(link, userID));
    records.push({kind, record:original, mode:kind === 'annotation' ? 'note' : 'record', projectIDs: [...new Set(projectIDs.filter(Boolean))]});
  }
  if (!records.length) return null;
  const id = createHash('sha256').update(JSON.stringify([userID, accepted])).digest('hex');
  const counts = {};
  for (const {kind} of records) counts[kind] = (counts[kind] || 0) + 1;
  const labels = [['project','Projects / collections'],['savedItem','saved passages'],['annotation','notes'],['projectSection','Project evidence']];
  return {id,userID,deletedAt:now.toISOString(),expiresAt:new Date(now.getTime()+trashRetentionDays*86400000).toISOString(),
    title:labels.filter(([kind])=>counts[kind]).map(([kind,label])=>`${counts[kind]} ${label}`).join(', '),records};
}

export function trashSummary(batch) {
  const {records, userID, ...summary} = batch;
  const counts = {};
  for (const {kind,record} of records) {
    const type = kind === 'project' && record.folderType === 'reference' ? 'collection' : kind;
    counts[type] = (counts[type] || 0) + 1;
  }
  const label = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
  const labels = [['project','Project'],['collection','saved collection'],['savedItem','saved passage'],['annotation','section note']];
  const folders = records.filter(item => item.kind === 'project');
  const names = folders.map(item => String(item.record.name || item.record.title || '').replace(/\s+/g,' ').trim().slice(0,200)).filter(Boolean);
  const oneFolder = folders.length === 1 && !counts.savedItem && !counts.annotation;
  const title = oneFolder && names[0] ? names[0]
    : labels.filter(([kind]) => counts[kind]).map(([kind,name]) => label(counts[kind],name)).join(', ')
      || label(counts.projectSection || 0,'Project passage link');
  const description = [
    oneFolder ? (counts.collection ? 'Saved collection' : 'Project') : names.slice(0,2).join(', '),
    counts.projectSection ? label(counts.projectSection,'passage link') : ''
  ].filter(Boolean).join(' · ');
  return {...summary, title, description, count:records.length, containsWorkspaces: folders.length > 0,
    projectIDs: [...new Set(records.flatMap(item => trashRecordProjectIDs(item, batch)))]};
}

function trashRecordProjectIDs(item, batch) {
  if (item.projectIDs?.length) return item.projectIDs;
  if (item.kind === 'project') return [workspaceProjectKey(item.record, batch.userID)].filter(Boolean);
  if (item.kind === 'projectSection') return [workspaceLinkKey(item.record, batch.userID)].filter(Boolean);
  // Older recovery groups can still be scoped by their included passage links.
  return [...new Set(batch.records.filter(candidate => candidate.kind === 'projectSection' &&
    workspaceEvidenceKey(candidate.record) === workspaceEvidenceKey(item.record)).flatMap(candidate => trashRecordProjectIDs(candidate, batch)))];
}

export function trashBatchForWorkspace(batch, projectID) {
  if (!projectID) return batch;
  const records = batch.records.filter(item => trashRecordProjectIDs(item, batch).includes(projectID));
  return records.length ? {...batch, records} : null;
}

export function trashBatchWithoutWorkspace(batch, projectID) {
  if (!projectID) return null;
  const records = batch.records.flatMap(item => {
    const ids = trashRecordProjectIDs(item, batch);
    if (!ids.includes(projectID)) return [item];
    const remaining = ids.filter(id => id !== projectID);
    return remaining.length ? [{...item, projectIDs: remaining}] : [];
  });
  return records.length ? {...batch, records} : null;
}

// Only display fields leave storage; recovery records and account identifiers stay private.
export function trashContents(batch) {
  const text = (value, limit = 600) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
  return {...trashSummary(batch), items: batch.records.map(({kind, record}) => ({
    kind,
    name: kind === 'project' ? text(record.name || record.title, 200) : '',
    folderType: record.folderType === 'reference' ? 'reference' : 'project',
    codeVersion: text(record.codeVersion, 300),
    codePrefix: text(record.codePrefix, 30),
    codeEdition: text(record.codeEdition, 80),
    sectionID: record.sectionID ?? null,
    sectionNumber: text(record.sectionNumber, 80),
    title: text(record.title || record.sectionTitle, 200),
    blockID: text(record.blockID, 200),
    excerpt: text(kind === 'annotation' ? record.noteBody : record.selectedText || record.previewText || record.excerpt)
  }))};
}

export function restoreTrash(batch, current, now = new Date()) {
  if (!batch || Date.parse(batch.expiresAt) <= now.getTime()) throw new Error('This Trash entry has expired.');
  const byID = new Map(current.map(entry).filter(([,r]) => r?.id).map(([k,r])=>[r.id,[k,r]]));
  const clears = clearsFrom(current);
  const mutations = [];
  let skipped = 0;
  for (const {kind,record,mode} of batch.records) {
    const latest = byID.get(record.id)?.[1];
    const latestActive = latest && active(kind,latest,clears);
    if (latestActive && (mode !== 'note' || String(latest.noteBody || '').trim())) { skipped++; continue; }
    const restored = mode === 'note' ? {...record,...latest,noteBody:record.noteBody} : {...record};
    restored.updatedAt = new Date(Math.max(now.getTime(),timestamp(latest)+1,...clears.map(c=>timestamp(c)+1))).toISOString();
    restored.deletedAt = null;
    delete restored.serverEventID;
    mutations.push({[kind]:restored});
  }
  return {mutations,skipped};
}
