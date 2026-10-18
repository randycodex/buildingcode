// Untagged legacy visits belong to browsing outside a Project. Never infer a
// Project from whichever workspace happens to be open when history is loaded.
export function recentViewProjectID(entry) {
  return typeof entry?.projectID === 'string' ? entry.projectID.trim() : '';
}

export function recentViewBelongsToProject(entry, projectID) {
  return recentViewProjectID(entry) === String(projectID || '').trim();
}

export function limitRecentViewsByProject(entries, limit = 50) {
  const counts = new Map();
  return (Array.isArray(entries) ? entries : []).filter(entry => {
    if (!entry || !Number.isSafeInteger(Number(entry.sectionID)) || Number(entry.sectionID) <= 0) return false;
    const projectID = recentViewProjectID(entry);
    const count = counts.get(projectID) || 0;
    if (count >= limit) return false;
    counts.set(projectID, count + 1);
    return true;
  });
}
