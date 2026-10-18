// Legacy string-only queries have no reliable Project ownership and remain
// outside Projects. Explicit records carry Project identity through sync.
export function recentSearchProjectID(entry) {
  return typeof entry?.projectID === 'string' ? entry.projectID.trim() : '';
}

export function recentSearchIdentity(entry) {
  const query = String(entry?.query || '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
  return query ? JSON.stringify([recentSearchProjectID(entry), query]) : '';
}

export function normalizeProjectSearchHistory(entries, limit = 50) {
  const byIdentity = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const query = String(entry?.query || '').trim();
    const searchedAt = Number(entry?.searchedAt);
    if (!query || !Number.isFinite(searchedAt)) continue;
    const projectID = recentSearchProjectID(entry);
    const next = {query, searchedAt, ...(projectID ? {projectID} : {}), ...(entry.deleted === true ? {deleted:true} : {})};
    const identity = recentSearchIdentity(next), prior = byIdentity.get(identity);
    if (!prior || next.searchedAt > prior.searchedAt || (next.searchedAt === prior.searchedAt &&
      (Number(Boolean(next.deleted)) > Number(Boolean(prior.deleted)) ||
       Boolean(next.deleted) === Boolean(prior.deleted) && next.query.localeCompare(prior.query) > 0))) byIdentity.set(identity, next);
  }
  const counts = new Map();
  return [...byIdentity.values()].sort((a,b) => b.searchedAt - a.searchedAt || recentSearchIdentity(a).localeCompare(recentSearchIdentity(b)))
    .filter(entry => {
      // Removed queries stay as bounded tombstones so a stale device cannot
      // immediately bring them back. They do not consume the visible quota.
      const key = JSON.stringify([recentSearchProjectID(entry), Boolean(entry.deleted)]);
      const count = counts.get(key) || 0;
      if (count >= limit) return false;
      counts.set(key, count + 1); return true;
    });
}

export function migrateProjectSearchHistory(entries, legacyQueries = [], fallbackTimestamp = 0, limit = 50) {
  const normalized = normalizeProjectSearchHistory(entries, limit);
  const known = new Set(normalized.map(recentSearchIdentity));
  const legacy = (Array.isArray(legacyQueries) ? legacyQueries : []).map((query,index) => ({
    query:String(query || '').trim(), searchedAt:Math.max(0, fallbackTimestamp - index)
  })).filter(entry => entry.query && !known.has(recentSearchIdentity(entry)));
  return normalizeProjectSearchHistory([...normalized, ...legacy], limit);
}

export function projectRecentSearchQueries(entries, projectID = '', limit = 50) {
  return normalizeProjectSearchHistory(entries, limit)
    .filter(entry => !entry.deleted && recentSearchProjectID(entry) === String(projectID || '').trim())
    .slice(0,limit).map(entry => entry.query);
}
