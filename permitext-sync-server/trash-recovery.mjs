import { createHash } from 'node:crypto';
import { recordSurvivesBulkClear } from './public/sync-state.js';
import { syncCodeVersion } from './public/sync-identity.js';

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
    records.push({kind, record:original, mode:kind === 'annotation' ? 'note' : 'record'});
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
  for (const {kind} of records) counts[kind] = (counts[kind] || 0) + 1;
  const labels = [['project','Projects / collections'],['savedItem','saved passages'],['annotation','notes'],['projectSection','Project evidence']];
  const names = records.filter(item => item.kind === 'project').map(item => String(item.record.name || '').slice(0,80)).filter(Boolean).slice(0,2);
  const title = labels.filter(([kind]) => counts[kind]).map(([kind,label]) => `${counts[kind]} ${label}`).join(', ')
    + (names.length ? ` — ${names.join(', ')}` : '');
  return {...summary, title, count:records.length};
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
