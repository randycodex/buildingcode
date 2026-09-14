import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const cleanup = app.slice(app.indexOf('async function deleteLocalWorkboard('), app.indexOf('function accountScopedWorkboardProjectIDs('));
const deletion = app.slice(app.indexOf('async function deleteArchivedProjects('), app.indexOf('function projectActivityLabel('));
for (const mode of ['existing', 'missing', 'unavailable', 'blocked', 'transaction-error']) {
  const removed = [];
  const mutations = [];
  const notices = [];
  const projects = [{ id: 'one' }, { id: 'two' }, { id: 'keep' }];
  const state = { localProjects: projects, localProjectSections: [], archivedProjectIDs: projects.map(p => p.id), detachedWorkboards: [] };
  const indexedDB = { open(name) {
    assert.equal(name, 'permitext-workboards');
    if (mode === 'unavailable') throw new Error('Storage denied');
    const request = {};
    queueMicrotask(() => {
      if (mode === 'blocked') return request.onblocked();
      if (mode === 'missing') {
        request.transaction = { abort() { request.onerror(); } };
        return request.onupgradeneeded();
      }
      request.result = {
        objectStoreNames: { contains: () => true }, close() {},
        transaction() {
          const tx = { objectStore: () => ({ delete(id) {
            if (mode === 'existing') removed.push(id);
            queueMicrotask(() => mode === 'transaction-error' ? tx.onerror() : tx.oncomplete());
          } }) };
          return tx;
        }
      };
      request.onsuccess();
    });
    return request;
  } };
  const context = vm.createContext({
    indexedDB, state, workboardMounts: new Map(), disposeProjectWorkboardMount() {},
    loadWorkboardModule() { throw new Error('Removed bundle must never load'); },
    requirePrivateWorkspaceWritable() {}, captureAccountRequest: () => 1, requireCurrentAccountRequest() {},
    activeAccount: () => ({}), projectRecordID: p => p.id, projectIdentity: p => p.id,
    workboardProjectID: id => id, currentContentSummary: () => ({ projectSections: [] }),
    archivedProjectIDSet: () => new Set(state.archivedProjectIDs), saveWorkspaceState() {},
    deletedProjectMutationForRecord: p => ({ project: { ...p, deletedAt: 'now' } }),
    enqueueSyncMutation: m => mutations.push(m), flushSyncOutbox: async () => {},
    deleteSyncedWorkboard: async () => {}, closeProjectDetailForProject() {},
    detachedWorkboards: () => [], projectDetailMatches: () => false,
    folderRecordCountLabel: () => 'projects', confirmWebWarning: async () => true,
    track: { scrollLeft: 0 }, showWebNotice: async (...args) => notices.push(args),
    transitionWorkspace: async () => {}, projectOverviewRefreshPaneIDs: () => [],
  });
  vm.runInContext(cleanup + '\n' + deletion, context);
  assert.equal(await context.deleteArchivedProjects(projects.slice(0, 2)), true, mode);
  assert.equal(mutations.length, 2, mode);
  assert.equal(notices.length, 0, mode);
  assert.deepEqual(Array.from(state.localProjects, p => p.id), ['keep'], mode);
  assert.deepEqual(removed, mode === 'existing' ? ['one', 'two'] : [], mode);
}
console.log('Bulk project deletion passes with existing, missing, denied, blocked, and failing legacy storage.');
