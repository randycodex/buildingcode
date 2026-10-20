import { normalizeProjectDetailsWidths } from './project-details-columns.js?v=20261019-project-workflow-v2';

const views = ['research', 'notebook', 'report', 'project-details', 'account'];
export const reportResumeFlags = ['libraryOpen', 'outlineHidden', 'comparisonOpen', 'versionsCollapsed'];
export const reportResumeWidths = ['libraryWidth', 'outlineWidth', 'versionsWidth', 'reportComparisonWidth', 'pdfComparisonWidth'];
export const reportResumeScrolls = {
  document: '.report-document', outline: '.report-outline', sources: '.report-source-picker', columns: '.report-document-columns'
};
const id = value => typeof value === 'string' ? value.slice(0, 300) : '';
const position = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const positions = value => Object.fromEntries(Object.keys(reportResumeScrolls).map(key => [key, position(value?.[key])]));

// This is a per-tab presentation snapshot. It contains identifiers and layout,
// never report text, credentials, or an alternative copy of account records.
export function normalizeWorkspaceResume(value, context) {
  if (!value || !views.includes(value.view) || value.userID !== context.userID ||
      value.workspaceID !== context.workspaceID || value.projectID !== context.projectID) return null;
  const report = value.report || {};
  return {
    ...context, view: value.view, workflowView: value.workflowView === 'notebook' ? 'notebook' : 'research',
    report: {
      draftID: id(report.draftID), versionID: id(report.versionID),
      flags: Object.fromEntries(reportResumeFlags.map(key => [key, report.flags?.[key] === true])),
      widths: Object.fromEntries(reportResumeWidths.map(key => [key, position(report.widths?.[key])])),
      scrolls: positions(report.scrolls),
      comparisonScroll: {pdf: position(report.comparisonScroll?.pdf), versions: position(report.comparisonScroll?.versions)},
      outlineSections: (Array.isArray(report.outlineSections) ? report.outlineSections : [])
        .filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'boolean')
        .slice(0, 500).map(([key, expanded]) => [id(key), expanded])
    },
    details: {
      section: ['context', 'facts', 'records'].includes(value.details?.section) ? value.details.section : 'context',
      scroll: position(value.details?.scroll), contentScroll: position(value.details?.contentScroll),
      scrollLeft: position(value.details?.scrollLeft),
      columnWidths: normalizeProjectDetailsWidths(value.details?.columnWidths),
      columnScrolls: value.details?.columnScrolls && typeof value.details.columnScrolls === 'object'
        ? Object.fromEntries(['context', 'facts', 'records'].map(kind => [kind, position(value.details.columnScrolls[kind])]))
        : null
    },
    account: {
      scroll: position(value.account?.scroll),
      cards: (Array.isArray(value.account?.cards) ? value.account.cards : [])
        .slice(0, 30).map(card => ({id: id(card.id), scroll: position(card.scroll)})),
      sourceGroups: (Array.isArray(value.account?.sourceGroups) ? value.account.sourceGroups : [])
        .filter(group => typeof group === 'string').slice(0, 50).map(id)
    }
  };
}

const key = (tabKey, context) => `${tabKey}:resume:${encodeURIComponent(context.workspaceID)}`;
export function readWorkspaceResume(storage, tabKey, context) {
  try { return normalizeWorkspaceResume(JSON.parse(storage.getItem(key(tabKey, context)) || 'null'), context); }
  catch { return null; }
}
export function writeWorkspaceResume(storage, tabKey, context, value) {
  try {
    const snapshot = normalizeWorkspaceResume({...value, ...context}, context);
    if (!snapshot) return false;
    storage.setItem(key(tabKey, context), JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

export async function restoreWorkspaceResume(snapshot, {isCurrent, waitForAccess, openWorkflow, openReport, openDetails, openAccount}) {
  if (!snapshot || !isCurrent()) return false;
  if (snapshot.view !== 'account') {
    if (!await waitForAccess() || !isCurrent()) return false;
  }
  if (snapshot.view === 'report') return openReport(snapshot.report);
  if (snapshot.view === 'project-details') return openDetails(snapshot.details);
  if (snapshot.view === 'account') return openAccount(snapshot.account);
  return openWorkflow(snapshot.view);
}

export function captureReportResume(panel, {draftID, versionID, comparisonScroll, outlineSections}) {
  return {
    draftID, versionID,
    flags: Object.fromEntries(reportResumeFlags.map(key => [key, panel.dataset[key] === 'true'])),
    widths: Object.fromEntries(reportResumeWidths.map(key => [key, position(panel.dataset[key])])),
    scrolls: Object.fromEntries(Object.entries(reportResumeScrolls).map(([key, selector]) => {
      const element = panel.querySelector(selector);
      return [key, (key === 'columns' ? element?.scrollLeft : element?.scrollTop) || 0];
    })),
    comparisonScroll, outlineSections
  };
}

export function applyReportResumeLayout(panel, snapshot) {
  for (const key of reportResumeFlags) panel.dataset[key] = String(snapshot.flags[key]);
  for (const key of reportResumeWidths) {
    if (snapshot.widths[key]) panel.dataset[key] = String(snapshot.widths[key]);
    else delete panel.dataset[key];
  }
}

export function restoreReportResumeScroll(panel, snapshot) {
  for (const [key, selector] of Object.entries(reportResumeScrolls)) {
    const element = panel.querySelector(selector);
    if (!element) continue;
    if (key === 'columns') element.scrollLeft = snapshot.scrolls[key];
    else element.scrollTop = snapshot.scrolls[key];
  }
}
