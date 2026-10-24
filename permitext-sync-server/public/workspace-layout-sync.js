// Account-owned presentation metadata only. Never send documents, drafts,
// cached section bodies, search text, or Code Question domain records here.
export const workspaceLayoutsKey = 'workspaceLayoutsJSON';
export const workspaceLayoutSyncDelay = 1500;
const text = value => typeof value === 'string' ? value.slice(0, 500) : '';
const list = value => Array.isArray(value) ? value.slice(0, 100) : [];
const ids = value => [...new Set(list(value).map(text).filter(Boolean))];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const widths = value => Object.fromEntries(Object.entries(object(value)).slice(0, 200)
  .filter(([id, width]) => id && id.length <= 500 && Number.isFinite(width) && width > 40)
  .sort(([a], [b]) => a.localeCompare(b)).map(([id, width]) => [id, Math.round(Math.min(width, 10000))]));
const views = ['research', 'notebook', 'report', 'project-details', 'notes-research-explicit'];
const toolKeys = ['notebooks', 'reportDrafts', 'coordinations'];

export function sharedWorkspaceLayout(source = {}) {
  const cq = object(source.codeQuestionWorkspace);
  const research = object(source.researchViewState);
  // Accept this projection itself as input as well as the runtime workspace.
  const tools = object(source.tools);
  return {
    readers: list(source.readers).filter(item => text(item?.id)).map(item => ({
      id: text(item.id), codePrefix: text(item.codePrefix), codeVersion: text(item.codeVersion),
      chapterID: String(item.chapterID || '').slice(0, 500), sectionID: String(item.sectionID || '').slice(0, 500),
      sectionNumber: text(item.sectionNumber)
    })),
    utilityInstances: list(source.utilityInstances).filter(item => text(item?.id) && ['search', 'saved', 'analysis'].includes(item.key))
      .map(item => ({id: text(item.id), key: item.key, ...(item.key === 'analysis' ? {conversationID: text(item.conversationID), historyShowing: item.historyShowing === true} : {})})),
    utilities: Object.fromEntries(['archive', 'search', 'saved', 'analysis', 'calculator'].map(key => [key, source.utilities?.[key] === true])),
    projectHostPaneID: text(source.projectHostPaneID),
    projectContextOpen: source.projectContextOpen === true,
    projectFactsOpen: source.projectFactsOpen === true,
    tools: Object.fromEntries(toolKeys.map(key => [key, tools[key] === true || list(source[key]).length > 0])),
    notebookColumns: list(source.notebookColumns).filter(item => text(item?.id) && text(item.projectID) && !item.newNote)
      .map(item => ({id: text(item.id), projectID: text(item.projectID), cardID: text(item.cardID), open: item.open !== false})),
    coordinationThreads: list(source.coordinationThreads).filter(item => text(item?.threadID))
      .map(item => ({threadID: text(item.threadID)})),
    paneOrder: ids(source.paneOrder), paneWeights: widths(source.paneWeights),
    workflowPaneWeights: Object.fromEntries(Object.entries(object(source.workflowPaneWeights)).filter(([view]) => views.includes(view))
      .sort(([a], [b]) => a.localeCompare(b)).map(([view, value]) => [view, widths(value)])),
    workflowMembership: Object.fromEntries(Object.entries(object(source.workflowMembership)).slice(0, 200)
      .filter(([id]) => id && id.length <= 500).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => [id, ids(value).filter(view => views.includes(view))])),
    researchColumnWidthsManual: source.researchColumnWidthsManual === true,
    collapsedPaneIDs: ids(source.collapsedPaneIDs), pinnedPaneID: text(source.pinnedPaneID),
    researchConversationID: text(source.researchConversationID),
    researchViewState: {conversationOpen: research.conversationOpen === true, historyShowing: research.historyShowing === true,
      supplementalIDs: ids(research.supplementalIDs)},
    codeQuestionWorkspace: {activeQuestionID: text(cq.activeQuestionID),
      activeStage: ['define', 'evidence', 'analyze', 'review', 'issue'].includes(cq.activeStage) ? cq.activeStage : 'define',
      questionIndexOpen: cq.questionIndexOpen === true,
      openPanes: list(cq.openPanes).filter(item => text(item?.projectID) && text(item.paneRole) && text(item.paneID))
        .map(item => ({projectID: text(item.projectID), questionID: text(item.questionID) || '_', paneRole: text(item.paneRole), paneID: text(item.paneID)}))}
  };
}

// A Reader's locator is a seed for a newly opened column, not a shared cursor.
// Reading/navigating within an existing column must not produce layout writes.
export function workspaceLayoutFingerprint(value) {
  const layout = sharedWorkspaceLayout(value);
  return JSON.stringify({...layout, readers: layout.readers.map(({id}) => ({id}))});
}

export function mergeWorkspaceLayouts(...catalogs) {
  const records = new Map();
  for (let items of catalogs) {
    try { if (typeof items === 'string') items = JSON.parse(items); } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!text(item?.projectID) || item.id !== `project:${item.projectID}` || !Number.isFinite(Date.parse(item.updatedAt)) ||
          !item.layout || typeof item.layout !== 'object' || Array.isArray(item.layout)) continue;
      const layout = sharedWorkspaceLayout(item.layout);
      if (JSON.stringify(layout).length > 48000) continue;
      const record = {id: item.id, projectID: text(item.projectID), updatedAt: new Date(item.updatedAt).toISOString(), layout};
      const prior = records.get(record.id);
      if (!prior || record.updatedAt > prior.updatedAt || record.updatedAt === prior.updatedAt && JSON.stringify(record) > JSON.stringify(prior)) records.set(record.id, record);
    }
  }
  return [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function applySharedWorkspaceLayout(local, record, project) {
  if (!record || !project || ![project.id, project.clientID, project.localFolderID].includes(record.projectID)) return local;
  const shared = sharedWorkspaceLayout(record.layout);
  const projectIDs = new Set([project.id, project.clientID, project.localFolderID].filter(value => value !== undefined && value !== null && value !== "").map(String));
  const match = (items, id) => list(items).find(item => item.id === id) || {};
  const {tools, codeQuestionWorkspace, researchViewState, ...presentation} = shared;
  const result = {...local, ...presentation,
    readers: shared.readers.map(item => ({title: 'Reader', ...item, ...match(local.readers, item.id)})),
    utilityInstances: shared.utilityInstances.map(item => ({...match(local.utilityInstances, item.id), ...item})),
    utilities: {...local.utilities, ...shared.utilities},
    researchViewState: {...local.researchViewState, ...researchViewState},
    codeQuestionWorkspace: {...local.codeQuestionWorkspace, ...codeQuestionWorkspace,
      openPanes: codeQuestionWorkspace.openPanes.filter(pane => projectIDs.has(pane.projectID))},
    notebookColumns: shared.notebookColumns.filter(item => projectIDs.has(item.projectID)),
    coordinationThreads: shared.coordinationThreads.map(item => ({...project, ...item}))
  };
  for (const key of toolKeys) result[key] = tools[key] ? [project] : [];
  // Unsaved Notes remain local and recoverable even if another device closes them.
  result.notebookColumns.push(...list(local.notebookColumns).filter(item => item.newNote));
  return result;
}

export function isWorkspaceLayoutOnlyMutation(mutation) {
  const record = mutation?.continuity;
  const keys = Object.keys(object(record?.values));
  return Boolean(record && Object.keys(mutation).length === 1 && keys.length === 1 && keys[0] === workspaceLayoutsKey);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

// A pulled continuity record also contains pre-existing reader/history data.
// Ignore only layout and transport revision fields when deciding to refresh content.
export function onlyWorkspaceLayoutsChanged(previous = [], incoming = []) {
  if (!incoming.length) return false;
  return incoming.every(mutation => {
    if (!mutation.continuity) return false;
    const record = mutation.continuity;
    const prior = previous.find(item => item.continuity?.userID === record.userID && item.continuity?.codeVersion === record.codeVersion);
    if (!prior) return isWorkspaceLayoutOnlyMutation(mutation);
    const withoutLayout = item => {
      const {updatedAt, serverVersion, serverEventID, baseVersion, ...rest} = item.continuity;
      const {[workspaceLayoutsKey]: layout, ...values} = rest.values || {};
      return canonical({...rest, values});
    };
    return JSON.stringify(withoutLayout(prior)) === JSON.stringify(withoutLayout(mutation));
  });
}
