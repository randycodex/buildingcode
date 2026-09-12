import assert from 'node:assert/strict';
import { planLegacyWorkspaceRestore, commitLegacyWorkspaceRestore } from '../public/legacy-workspace-restore.js';
import { privateWorkspaceKeys } from '../public/private-workspace-state.js';
class Storage {
  #failure;
  constructor(values) { Object.assign(this, values); }
  getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
  setItem(key, value) { if (this.#failure === key) { this.#failure = null; throw new Error('quota'); } this[key] = String(value); }
  removeItem(key) { delete this[key]; }
  failOnce(key) { this.#failure = key; }
}
const owner = 'synthetic-owner';
const keys = privateWorkspaceKeys(owner);
const old = { account: { userID: owner, sessionToken: 'never-import-me' },
  readers: [{ id: 'old-reader', code: 'BC', chapterID: '1' }],
  localProjects: [{ id: 'old-project', userID: owner }, { id: 'shared-project', name: 'older' }, { id: 'deleted', deletedAt: 'yesterday' }],
  localSavedItems: [{ id: 'old-saved', sectionID: 10 }],
  sectionNotes: { old: 'retained note', conflict: 'older note' },
  syncOutbox: [{ mutation: { operation: 'delete' }, accountUserID: owner }]
};
const initial = {
  'permitext:webWorkspace:v1': JSON.stringify(old),
  [keys.baseWorkspaceKey]: JSON.stringify({ localProjects: [{ id: 'shared-project', name: 'current' }], sectionNotes: { conflict: 'current note' }, syncOutbox: [{ current: true }] }),
  [keys.workspaceRegistryKey]: JSON.stringify({ version: 2, activeWorkspaceID: 'main', workspaces: [{ id: 'main', name: 'Main' }] }),
  [`${keys.workspaceStateKeyPrefix}main`]: JSON.stringify({ readers: [{ id: 'current-reader' }] })
};
const storage = new Storage(initial);
assert.throws(() => planLegacyWorkspaceRestore(storage, ''), /recorded owner/);
assert.throws(() => planLegacyWorkspaceRestore(storage, 'other'), /recorded owner/);
assert.deepEqual({ ...storage }, initial);
const plan = planLegacyWorkspaceRestore(storage, owner);
const receipt = commitLegacyWorkspaceRestore(storage, plan);
assert.equal(receipt.workspaceIDs.length, 1);
assert.equal(storage['permitext:webWorkspace:v1'], initial['permitext:webWorkspace:v1']);
assert.equal(storage[`${keys.workspaceStateKeyPrefix}main`], initial[`${keys.workspaceStateKeyPrefix}main`]);
const restored = JSON.parse(storage[keys.baseWorkspaceKey]);
assert.equal(restored.localProjects.find(p => p.id === 'shared-project').name, 'current');
assert(restored.localProjects.some(p => p.id === 'old-project'));
assert(!restored.localProjects.some(p => p.id === 'deleted'));
assert.deepEqual(restored.syncOutbox, [{ current: true }]);
assert.equal(restored.sectionNotes.conflict, 'current note');
assert.equal(restored.sectionNotes.old, 'retained note');
assert(!storage[keys.baseWorkspaceKey].includes('never-import-me'));
const beforeRetry = { ...storage };
assert.equal(planLegacyWorkspaceRestore(storage, owner).alreadyRestored, true);
assert.deepEqual({ ...storage }, beforeRetry);
// Every write boundary can fail without losing or changing current/legacy work.
for (let n = 0; n < plan.writes.length; n++) {
  const store = new Storage(initial);
  const attempt = planLegacyWorkspaceRestore(store, owner);
  store.failOnce(attempt.writes[n][0]);
  assert.throws(() => commitLegacyWorkspaceRestore(store, attempt), /could not be saved/);
  assert.deepEqual({ ...store }, initial);
  commitLegacyWorkspaceRestore(store, planLegacyWorkspaceRestore(store, owner));
}
// A tab may close after any write, without running rollback. Retry must reuse
// saved layouts and registry IDs instead of creating duplicate recovered tabs.
for (let n = 1; n < plan.writes.length; n++) {
  const store = new Storage(initial);
  const interrupted = planLegacyWorkspaceRestore(store, owner);
  for (const [key, value] of interrupted.writes.slice(0, n)) store.setItem(key, value);
  commitLegacyWorkspaceRestore(store, planLegacyWorkspaceRestore(store, owner));
  const registry = JSON.parse(store.getItem(keys.workspaceRegistryKey));
  assert.equal(registry.workspaces.filter(item => item.id.startsWith('recovered-')).length, 1);
}
const changed = new Storage(initial);
const stale = planLegacyWorkspaceRestore(changed, owner);
changed.setItem(keys.baseWorkspaceKey, '{"newer":true}');
assert.throws(() => commitLegacyWorkspaceRestore(changed, stale), /workspace changed/);
assert.equal(changed[keys.baseWorkspaceKey], '{"newer":true}');
const remote = planLegacyWorkspaceRestore(new Storage(initial), owner, {
  summary: { projects: [{ id: 'old-project', name: 'remote current' }] },
  acceptRecord: (field) => field !== 'localSavedItems', allowLegacyNotes: false
});
assert(!remote.shared.localProjects.some(p => p.id === 'old-project'));
assert.equal(remote.shared.localSavedItems.length, 0);
assert(!Object.hasOwn(remote.shared.sectionNotes, 'old'));
const unreadable = new Storage({ ...initial, 'permitext:webWorkspace:v2:bad': '{' });
assert.throws(() => planLegacyWorkspaceRestore(unreadable, owner), /recorded owner/);
const invalid = new Storage({ ...initial, 'permitext:webWorkspace:v2:bad': '[]' });
assert.throws(() => planLegacyWorkspaceRestore(invalid, owner), /layout is invalid/);
console.log('Legacy restore passed: ownership, current/remote precedence, preserved originals, no credential/command replay, repeat safety, stale plans and every write failure.');

// Execute the shipped automatic-recovery coordinator with in-memory state.
const { readFile } = await import('node:fs/promises');
const { default: vm } = await import('node:vm');
const privateState = await import('../public/private-workspace-state.js');
const { legacyWorkspaceRestoreReceipt } = await import('../public/legacy-workspace-restore.js');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const coordinator = app.slice(app.indexOf('function recoverVerifiedLegacyWorkspace('), app.indexOf('function appendLegacyWorkspaceRecoveryControls('));
function automatic({ userID = owner, current = true, openWork = false, fail = false } = {}) {
  const store = new Storage({ ...initial, 'permitext:privateWorkspaceMigration:v1': '{"status":"quarantined"}' });
  if (fail) store.failOnce(keys.baseWorkspaceKey);
  let applied = 0;
  let registrySaved = 0;
  const issues = [];
  const sandbox = {
    ...privateState, planLegacyWorkspaceRestore, commitLegacyWorkspaceRestore, legacyWorkspaceRestoreReceipt,
    localStorage: store, isCurrentAccountRequest: () => current,
    requireCurrentAccountRequest: () => { if (!current) throw new Error('account changed'); },
    workspaceRestoreError: null, workspaceMigrationError: null,
    requirePrivateWorkspaceWritable() {}, saveWorkspaceState() {}, currentBulkClearRecords: () => [],
    recordSurvivesBulkClear: () => true, projectRecordID: item => item.id,
    savedEvidenceKey: item => String(item.sectionID),
    state: JSON.parse(initial[keys.baseWorkspaceKey]), workspaceRegistry: {}, activeWorkspaceID: 'main', renderWorkspaceTabs() {},
    workspaceLayoutHasVisiblePanes: () => openWork,
    loadWorkspaceSnapshot: id => JSON.parse(store.getItem(keys.workspaceStateKeyPrefix + id)),
    applyStoredWorkspaceLayout: () => { applied++; }, persistWorkspaceRegistry: () => { registrySaved++; },
    presentWorkspaceIssue: message => issues.push(message), JSON, Object
  };
  vm.runInNewContext(coordinator, sandbox);
  const before = { ...store };
  sandbox.recoverVerifiedLegacyWorkspace({ userID }, {});
  if (!userID || userID !== owner || !current) {
    assert.deepEqual({ ...store }, before);
    assert.equal(issues.length, 0);
  } else if (fail) {
    assert.deepEqual({ ...store }, before);
    assert.equal(issues.length, 1);
    sandbox.recoverVerifiedLegacyWorkspace({ userID }, {});
    assert(legacyWorkspaceRestoreReceipt(store, owner), 'Later sync retries storage failures.');
  } else {
    assert(legacyWorkspaceRestoreReceipt(store, owner));
    assert.equal(applied, openWork ? 0 : 1);
    assert.equal(registrySaved, openWork ? 0 : 1);
    assert.equal(issues.length, 0);
    const after = { ...store };
    sandbox.recoverVerifiedLegacyWorkspace({ userID }, {});
    assert.deepEqual({ ...store }, after, 'Repeated sync must not duplicate recovered work.');
    assert(sandbox.state.localProjects.some(item => item.id === 'old-project'));
  }
}
automatic();
automatic({ openWork: true });
automatic({ userID: '' });
automatic({ userID: 'another-account' });
automatic({ current: false });
automatic({ fail: true });
assert.match(app, /await applyRemoteContinuityIfNewer\(\);[\s\S]*?isCurrentAccountRequest\(identity\)[\s\S]*?recoverVerifiedLegacyWorkspace\(identity, syncedContent.summary\)/);
assert(!app.includes('restore.textContent = "Restore available work"'));
console.log('Automatic recovery passed: verified sync, empty-workspace opening, existing-workspace preservation, account/guest isolation, repeat safety and storage-failure retry.');
