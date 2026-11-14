// A Reader remains the stable workspace column. Each tab stores only its own
// reading session; switching tabs never changes the column's pane identity.
const copy = value => JSON.parse(JSON.stringify(value));
const columnKeys = new Set(['id', 'tabs', 'activeTabID', 'sourceOwnerPaneID']);
export const maximumReaderTabs = 6;

export function canAddReaderTab(reader) {
  return readerTabs(reader).length < maximumReaderTabs;
}

export function readerTabSnapshot(reader, id = reader.activeTabID || `${reader.id}:initial`) {
  return { ...copy(Object.fromEntries(Object.entries(reader).filter(([key]) => !columnKeys.has(key)))), id };
}

export function readerTabs(reader) {
  const seen = new Set();
  const tabs = (Array.isArray(reader.tabs) ? reader.tabs : []).filter(tab => {
    if (!tab || typeof tab.id !== 'string' || !tab.id || seen.has(tab.id)) return false;
    seen.add(tab.id); return true;
  });
  if (!tabs.length) return [readerTabSnapshot(reader)];
  return tabs.map(tab => tab.id === reader.activeTabID ? readerTabSnapshot(reader, tab.id) : copy(tab));
}

export function initializeReaderTabs(reader) {
  const hadTabs = Array.isArray(reader.tabs) && reader.tabs.some(tab => typeof tab?.id === 'string' && tab.id);
  reader.tabs = readerTabs(reader);
  if (!reader.tabs.some(tab => tab.id === reader.activeTabID)) {
    // Legacy Readers have no tabs; their live reading state is the first tab.
    if (!hadTabs) reader.activeTabID = reader.tabs[0].id;
    else activateReaderTab(reader, reader.tabs[0].id);
  }
  return reader.tabs;
}

export function activateReaderTab(reader, tabID) {
  const tabs = readerTabs(reader), tab = tabs.find(item => item.id === tabID);
  if (!tab) return false;
  for (const key of Object.keys(reader)) if (!columnKeys.has(key)) delete reader[key];
  const { id, ...session } = tab;
  Object.assign(reader, copy(session), { tabs, activeTabID: id });
  return true;
}

export function addReaderTab(reader, session, id = crypto.randomUUID()) {
  if (!canAddReaderTab(reader)) return null;
  initializeReaderTabs(reader);
  reader.tabs = [...readerTabs(reader), readerTabSnapshot(session, id)];
  activateReaderTab(reader, id);
  return id;
}

// Notebook keeps a short source history: reopen exact sources at the front,
// preserve their sessions, and retire only the least recently opened tabs.
export function openRecentReaderTab(reader, session, id) {
  initializeReaderTabs(reader);
  const tabs = readerTabs(reader);
  const matches = tab => tab.codePrefix === session.codePrefix && tab.codeVersion === session.codeVersion &&
    String(tab.sectionID || '') === String(session.sectionID || '') &&
    (Boolean(session.sectionID) || String(tab.chapterID || '') === String(session.chapterID || ''));
  const existing = tabs.find(matches);
  const next = existing || readerTabSnapshot(session, id || crypto.randomUUID());
  reader.tabs = [next, ...tabs.filter(tab => tab.id !== next.id && !matches(tab))].slice(0, maximumReaderTabs);
  activateReaderTab(reader, next.id);
  return next.id;
}

export function removeReaderTab(reader, tabID) {
  initializeReaderTabs(reader);
  const tabs = readerTabs(reader), index = tabs.findIndex(tab => tab.id === tabID);
  if (index < 0) return false;
  reader.tabs = tabs.filter(tab => tab.id !== tabID);
  if (!reader.tabs.length) return true;
  if (reader.activeTabID === tabID) activateReaderTab(reader, reader.tabs[Math.min(index, reader.tabs.length - 1)].id);
  return true;
}

// Preview ownership belongs to a column's current source interaction. Copies
// and moved tabs are retained reading sessions, not another search preview.
export function retainedReaderTab(tab) {
  const result = readerTabSnapshot(tab, tab.id);
  for (const key of ['searchPreviewPaneID', 'pinnedSearchPaneID', 'pinnedDetailSourceID',
    'recentlyViewedSourceSearchID', 'referenceSourceReaderID', 'sourceRevealToken']) delete result[key];
  return result;
}
