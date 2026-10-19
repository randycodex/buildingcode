import {trashRetentionDays} from './trash-recovery.mjs';

export function notebookTrashMetadata(links, now = new Date()) {
  return {expiresAt: new Date(now.getTime() + trashRetentionDays * 86400000).toISOString(), links: structuredClone(links)};
}

export function isNotebookTrashArtifact(artifact, now = new Date()) {
  return artifact?.envelope?.type === 'notebookCard' && Boolean(artifact.envelope.deletedAt) &&
    Array.isArray(artifact.payload?._notebookTrash?.links) && Date.parse(artifact.payload._notebookTrash.expiresAt) > now.getTime();
}

export function notebookTrashSummary(artifact) {
  return {id: `notebook:${encodeURIComponent(artifact.envelope.id)}:${artifact.envelope.version}`,
    title: `Note · ${artifact.payload.title || 'Untitled Note'}`, count: 1,
    deletedAt: artifact.envelope.deletedAt, expiresAt: artifact.payload._notebookTrash.expiresAt};
}

export function notebookTrashContents(artifact) {
  return {...notebookTrashSummary(artifact), items: [{kind: 'notebookCard', title: artifact.payload.title || 'Untitled Note',
    excerpt: String(artifact.payload.plainText || '').slice(0, 600)}]};
}

// Restore only the exact deleted generation and its original links. A changed
// link is a conflict, rather than permission to overwrite newer Project work.
export function planNotebookTrashMutation(artifact, currentLinks, action, now = new Date()) {
  if (!isNotebookTrashArtifact(artifact, now)) throw new Error('This Note is unavailable or its Trash entry has expired.');
  const expectedVersion = artifact.envelope.version;
  const payload = {...artifact.payload};
  const originalLinks = payload._notebookTrash.links;
  delete payload._notebookTrash;
  delete payload._saveReceipt;
  const mutation = {expectedVersion, expectedDeletedAt: artifact.envelope.deletedAt, links: [], expectedLinks: [],
    artifact: {...artifact, envelope: {...artifact.envelope, updatedAt: now.toISOString(), version: expectedVersion + 1}, payload}};
  if (action === 'restore') {
    mutation.artifact.envelope.deletedAt = null;
    for (const original of originalLinks) {
      const current = currentLinks.find(link => link.id === original.id);
      if (!current?.deletedAt || current.version !== original.version + 1 || current.deletedAt !== artifact.envelope.deletedAt) {
        throw new Error('This Note’s Project links changed. Refresh Trash before restoring it.');
      }
      mutation.expectedLinks.push(current);
      mutation.links.push({...original, updatedAt: now.toISOString(), deletedAt: null, version: current.version + 1});
    }
  } else if (action === 'purge') {
    mutation.artifact.payload = {cardType: payload.cardType || 'finding', title: 'Deleted Note', plainText: '',
      document: {schema: 'permitext-notebook-card', schemaVersion: 2, format: 'blocknote-json', document: []},
      references: [], evidenceLinks: [], imageAssets: []};
  } else throw new Error('Unknown Note Trash action.');
  return mutation;
}
