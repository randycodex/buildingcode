import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// A controlled dependency-order profile of the actual orchestration functions.
// No application server, account, database, browser storage or device is used.
// This measures blocking dependencies, not browser paint or network latency.
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, `Missing ${name}`);
  return source.slice(start, end + 2);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise(done => setImmediate(done));
async function profile(mode) {
  const sync = deferred(), notebook = deferred(), report = deferred();
  const events = [], visible = [], created = [], checkpoints = [];
  const panel = id => ({ dataset: { paneId: id }, querySelector: () => null });
  const existing = mode === 'utility' ? [panel('reader:r1'), panel('reader:r2')] : [];
  visible.push(...existing.map(pane => pane.dataset.paneId));
  const readers = [{ id: 'r1' }, { id: 'r2' }];
  const utilities = [{ id: 'search', key: 'search' }, { id: 'saved', key: 'saved' }];
  const project = { id: 'project' };
  const make = async (id, dependency = null) => {
    events.push(`start:${id}`); created.push(id);
    if (dependency) await dependency.promise;
    events.push(`ready:${id}`);
    return panel(id);
  };
  const noop = () => {};
  const context = vm.createContext({
    Map, Set, Promise,
    workspaceRenderGeneration: 0, suppressReaderScrollRestore: false,
    detachedProjectWindow: false, detachedProject: null,
    genericWorkboardIdentity: {}, releaseSurfaceVisibility: { coordination: false },
    supplementalResearchConversationIDs: [],
    state: { utilityInstances: utilities, readers, utilities: {} },
    track: { querySelectorAll: () => existing, querySelector: () => null },
    restoreResearchWorkspaceState: noop, captureReaderScrollPositions: () => new Map(),
    ensureSyncedContentForRender: async () => { events.push('sync:start'); await sync.promise; events.push('sync:ready'); },
    reconcileProjectWorkspaces: noop, scopeSavedInstanceToWorkspace: noop,
    enforceReaderPlanLimit: noop, updateReaderPlanControls: noop, renderWorkspaceTabs: noop,
    closeDeletedProjectDetails: noop, renderCodeQuestionShellChrome: noop,
    activePaneIDs: () => ['notebook:project','report:project','search:search','saved:saved','reader:r1','reader:r2'],
    normalizePaneWeights: noop, setUtilityButtonStates: noop,
    genericWorkboardIsOpen: () => false, openProjectDetails: () => [project],
    projectHasOpenNotebook: () => true, projectHasOpenReportDraft: () => true,
    projectHasOpenCoordination: () => false, openCodeQuestionPaneIDs: () => [],
    paneIDForProjectNotebook: () => 'notebook:project', paneIDForProjectReportDraft: () => 'report:project',
    paneIDForUtilityInstance: value => `${value.key}:${value.id}`, paneIDForReader: value => `reader:${value.id}`,
    renderProjectNotebook: () => make('notebook:project', notebook),
    renderProjectReportDraft: () => make('report:project', report),
    renderUtilityInstance: value => make(`${value.key}:${value.id}`),
    renderReader: value => make(`reader:${value.id}`),
    sectionDetailsBySearch: () => ({}), paneIDForSectionDetail: id => `detail:${id}`,
    researchConversationPaneIsOpen: () => false,
    wireUtilityInstanceActions: noop, applyPaneWeight: noop,
    bindAllReaderScrollIndicators: noop, enhanceReaderSelects: noop,
    restoreReaderScrollPositions: noop, saveWorkspaceState: noop,
    scheduleWorkspaceStateSaveAfterPaint: noop, startProjectArtifactCheckpointLoop: noop,
    appendPaneSequence: panes => { visible.splice(0, visible.length, ...panes.map(pane => pane.dataset.paneId)); events.push('mounted'); }
  });
  const name = mode === 'full' ? 'renderWorkspace' : 'renderUtilityWorkspace';
  vm.runInContext(`${actual(name)}\nglobalThis.run = ${name};`, context);
  const running = context.run();
  const capture = label => checkpoints.push({ label, visible: [...visible], started: [...created] });
  await tick(); capture('sync unresolved');
  sync.resolve(); await tick(); capture('sync resolved; notebook and report unresolved');
  notebook.resolve(); await tick(); capture('notebook resolved; report unresolved');
  report.resolve(); await running; capture('all dependencies resolved');
  assert.equal(visible.length, 6, 'The profile must eventually mount every requested fixture pane');
  if (mode === 'utility') assert.ok(!created.some(id => id.startsWith('reader:')), 'Existing Reader reuse must remain exercised');
  return { mode, checkpoints, events };
}
console.log(JSON.stringify({
  source: 'Actual renderWorkspace/renderUtilityWorkspace extracted from public/app.js',
  scope: 'Controlled deferred dependencies with renderer/DOM adapters. Not browser paint, network or device timing.',
  fixture: 'Two Readers, Search, Saved, Project Notebook, Project Report',
  samples: [await profile('full'), await profile('utility')]
}, null, 2));
