import { legacyWorkspaceRecoveryBundle, privateWorkspaceKeys, privateWorkspacePrefix } from './private-workspace-state.js?v=20260912-account-recovery-v8';
import { normalizeWorkspaceRegistry, normalizeWorkspaceLayout } from './workspace-state.js?v=20260811-research-columns-v3';
import { workspaceLayoutWithoutCodeQuestionData } from './code-question-client-state.js?v=20260809-session-stability-v3';

const baseKey = 'permitext:webWorkspace:v1';
const registryKey = 'permitext:webWorkspaces:v2';
const layoutPrefix = 'permitext:webWorkspace:v2:';
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function legacyWorkspaceRestoreReceipt(storage, accountUserID) {
  if (!accountUserID) return null;
  const receipt = JSON.parse(storage.getItem(`${privateWorkspacePrefix(accountUserID)}legacy-restoration:v1`) || 'null');
  if (receipt && (!Array.isArray(receipt.workspaceIDs) || !receipt.workspaceIDs.every(id => typeof id === 'string'))) {
    throw new Error('The recovery record could not be read. Original work is preserved.');
  }
  return receipt;
}

// Plan from one owner-checked, credential-redacted snapshot. No old credentials,
// outbox commands, deletions or account settings are imported.
export function planLegacyWorkspaceRestore(storage, accountUserID, options = {}) {
  const bundle = legacyWorkspaceRecoveryBundle(storage, accountUserID);
  const keys = privateWorkspaceKeys(accountUserID);
  const receiptKey = `${privateWorkspacePrefix(accountUserID)}legacy-restoration:v1`;
  const receipt = legacyWorkspaceRestoreReceipt(storage, accountUserID);
  if (receipt) return { alreadyRestored: true, receipt };
  const currentRaw = storage.getItem(keys.baseWorkspaceKey);
  const registryRaw = storage.getItem(keys.workspaceRegistryKey);
  const current = JSON.parse(currentRaw || '{}');
  const storedRegistry = JSON.parse(registryRaw || 'null');
  const source = bundle.workspaces[baseKey];
  if (!object(source) || !object(current) || (storedRegistry && !object(storedRegistry))) {
    throw new Error('Workspace records could not be read safely. Originals are preserved; download a recovery copy for review.');
  }
  const registry = normalizeWorkspaceRegistry(storedRegistry);
  const legacyRegistry = bundle.workspaces[registryKey];
  const layouts = Object.entries(bundle.workspaces).filter(([key]) => key.startsWith(layoutPrefix));
  if (!layouts.length) layouts.push([baseKey, source]);
  const writes = [];
  const recoveredIDs = [];
  const now = new Date().toISOString();
  for (const [key, value] of layouts) {
    if (!object(value)) throw new Error('An older workspace layout is invalid. Originals are preserved.');
    // Stable IDs make a retry after a closed tab/crash reuse its earlier copy.
    const id = `recovered-legacy-${encodeURIComponent(key)}`;
    const oldID = key.slice(layoutPrefix.length);
    const oldName = legacyRegistry?.workspaces?.find(item => item?.id === oldID)?.name || 'workspace';
    const name = `Recovered ${String(oldName).slice(0, 24)}`;
    if (!registry.workspaces.some(item => item.id === id)) registry.workspaces.push({ id, name, createdAt: now, updatedAt: now });
    recoveredIDs.push(id);
    const destination = `${keys.workspaceStateKeyPrefix}${id}`;
    if (storage.getItem(destination) === null) {
      writes.push([destination, JSON.stringify(workspaceLayoutWithoutCodeQuestionData(normalizeWorkspaceLayout(value))), null]);
    }
  }
  let restoredRecords = 0;
  let retainedRecords = 0;
  const shared = {};
  const summary = options.summary || {};
  for (const [field, summaryField] of [['localProjects','projects'], ['localSavedItems','savedItems'], ['localProjectSections','projectSections'], ['localAnnotations','annotations']]) {
    const existing = current[field] || [];
    const older = source[field] || [];
    if (!Array.isArray(existing) || !Array.isArray(older)) throw new Error('Saved content has an unsupported format. Originals are preserved.');
    const identity = item => options.recordKey ? options.recordKey(field, item) : field === 'localSavedItems'
      ? `saved:${item.codeVersion || ''}:${item.sectionID || ''}:${item.blockID || ''}`
      : String(item.id || item.clientID || item.localFolderID || '');
    const known = new Set([...existing, ...(summary[summaryField] || [])].filter(object).map(identity));
    shared[field] = [...existing];
    for (const item of older) {
      if (!object(item) || !identity(item) || item.deletedAt || known.has(identity(item)) ||
          (options.acceptRecord && !options.acceptRecord(field, item))) {
        retainedRecords += 1;
        continue;
      }
      known.add(identity(item));
      shared[field].push(item);
      restoredRecords += 1;
    }
  }
  // Legacy text notes do not carry reliable timestamps. Keep conflicting values
  // in the original snapshot, never overwrite a current note.
  const notes = { ...(current.sectionNotes || {}) };
  for (const [key, value] of Object.entries(source.sectionNotes || {})) {
    if (Object.hasOwn(notes, key) || typeof value !== 'string' || options.allowLegacyNotes === false) retainedRecords += 1;
    else { Object.defineProperty(notes, key, { value, enumerable: true, configurable: true, writable: true }); restoredRecords += 1; }
  }
  shared.sectionNotes = notes;
  const result = { restoredAt: now, workspaceIDs: recoveredIDs, restoredRecords, retainedRecords };
  writes.push([keys.baseWorkspaceKey, JSON.stringify({ ...current, ...shared }), currentRaw]);
  writes.push([keys.workspaceRegistryKey, JSON.stringify(registry), registryRaw]);
  writes.push([receiptKey, JSON.stringify(result), null]);
  return { alreadyRestored: false, registry, shared, receipt: result, writes };
}

export function commitLegacyWorkspaceRestore(storage, plan) {
  if (plan.alreadyRestored) return plan.receipt;
  for (const [key, , before] of plan.writes) {
    if (storage.getItem(key) !== before) throw new Error('Your workspace changed. Review recovery again before restoring.');
  }
  const applied = [];
  try {
    for (const [key, value, before] of plan.writes) {
      storage.setItem(key, value);
      applied.push([key, before]);
    }
  } catch (error) {
    // Remove new allocations first so rollback has room under a storage quota.
    for (const [key, before] of applied) if (before === null) storage.removeItem(key);
    for (const [key, before] of applied) if (before !== null) storage.setItem(key, before);
    throw new Error('Recovery could not be saved. Your original records are preserved. Free browser storage and try again.', { cause: error });
  }
  return plan.receipt;
}
