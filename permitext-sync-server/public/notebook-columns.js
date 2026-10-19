export function normalizeNotebookColumns(value) {
  const ids = new Set(), openCards = new Set();
  return (Array.isArray(value) ? value : []).flatMap(column => {
    if (!column || typeof column.id !== 'string' || !column.id ||
        typeof column.projectID !== 'string' || !column.projectID) return [];
    const key = JSON.stringify([column.projectID, column.id]);
    const cardID = typeof column.cardID === 'string' ? column.cardID : '';
    const cardKey = JSON.stringify([column.projectID, cardID]);
    if (ids.has(key) || column.open !== false && cardID && openCards.has(cardKey)) return [];
    ids.add(key);
    if (column.open !== false && cardID) openCards.add(cardKey);
    return [{id: column.id, projectID: column.projectID, cardID,
      title: typeof column.title === 'string' ? column.title.slice(0, 300) : '', open: column.open !== false,
      ...(column.newNote === true && !cardID ? {newNote: true} : {})}];
  });
}

export function notebookColumnPaneID(column) {
  const base = `project:notebook:${encodeURIComponent(column.projectID)}`;
  return column.id === 'primary' ? base : `${base}:note:${encodeURIComponent(column.id)}`;
}

// Project consumers retain one stable facade, while every column owns its
// editor, autosave queue, selection and recovery state independently.
export function createNotebookMountRegistry(projects, {openCard}) {
  const mounts = new Map(), owners = new Map(), focused = new Map();
  const entries = projectID => [...mounts].filter(([id]) => owners.get(id) === projectID);
  const active = projectID => mounts.get(focused.get(projectID)) || entries(projectID)[0]?.[1];
  const all = (projectID, method, ...args) => Promise.all(entries(projectID).map(([, mount]) => mount[method]?.(...args)));
  function remove(paneID) {
    const projectID = owners.get(paneID), mount = mounts.get(paneID);
    if (!mount) return;
    mount.dispose?.();
    mounts.delete(paneID); owners.delete(paneID);
    if (focused.get(projectID) === paneID) focused.delete(projectID);
    if (!entries(projectID).length) projects.delete(projectID);
  }
  function register(projectID, paneID, mount) {
    if (mounts.get(paneID) !== mount) remove(paneID);
    mounts.set(paneID, mount); owners.set(paneID, projectID);
    if (!projects.has(projectID)) projects.set(projectID, {
      get panel() { return active(projectID)?.panel; },
      activeCardID: () => active(projectID)?.activeCardID?.() || '',
      insertionTarget: () => active(projectID)?.insertionTarget?.() || null,
      insertLinkedReference: (...args) => {
        const mount = active(projectID);
        if (!mount?.insertLinkedReference) throw new Error('The destination Note is unavailable. Open it again.');
        return mount.insertLinkedReference(...args);
      },
      focusCard: cardID => openCard(projectID, cardID),
      createLocalNote: () => active(projectID)?.createLocalNote?.(),
      persistDraft: () => all(projectID, 'persistDraft'),
      syncDraft: () => all(projectID, 'syncDraft'),
      async syncCard(cardID) {
        const match = entries(projectID).find(([, item]) => item.activeCardID?.() === cardID)?.[1];
        if (!match) return false;
        await match.syncDraft?.(); return true;
      },
      refreshCards: () => all(projectID, 'refreshCards'),
      refreshReferenceSources: options => all(projectID, 'refreshReferenceSources', options),
      refreshReportStatus: () => all(projectID, 'refreshReportStatus'),
      async confirmDiscardIfNeeded() {
        for (const [, item] of entries(projectID)) if (await item.confirmDiscardIfNeeded?.() === false) return false;
        return true;
      },
      dispose() { for (const [id] of entries(projectID)) remove(id); }
    });
    if (!focused.has(projectID)) focused.set(projectID, paneID);
    return projects.get(projectID);
  }
  return {mounts, register, remove, activate(paneID) {
    if (mounts.has(paneID)) focused.set(owners.get(paneID), paneID);
  }};
}
