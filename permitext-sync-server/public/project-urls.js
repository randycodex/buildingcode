// Project names belong in addresses; sync identities remain unchanged.
export function projectURLSlug(name) {
  return String(name || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 80).replace(/^-+|-+$/g, '') || 'project';
}

function suffix(id) {
  let hash = 14695981039346656037n;
  for (const character of String(id)) hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0))) * 1099511628211n);
  return hash.toString(36).padStart(13, '0');
}

export function projectURLNameRecords(projects = []) {
  return projects.filter(project => project?.projectID && project.name).map(project => ({
    projectID: project.projectID, name: project.name,
    claimedAt: project.updatedAt || project.createdAt || '1970-01-01T00:00:00.000Z'
  }));
}

export function mergeProjectURLNames(...collections) {
  const names = new Map();
  for (const entry of collections.flat()) {
    if (!entry?.projectID || !entry.name) continue;
    const key = `${entry.projectID}\n${projectURLSlug(entry.name)}`;
    const previous = names.get(key);
    if (!previous || (Date.parse(entry.claimedAt) || 0) < (Date.parse(previous.claimedAt) || 0)) names.set(key, entry);
  }
  return [...names.values()].sort((a, b) => (Date.parse(a.claimedAt) || 0) - (Date.parse(b.claimedAt) || 0) ||
    a.projectID.localeCompare(b.projectID) || a.name.localeCompare(b.name));
}

export function createProjectURLCatalog(projects = [], history = []) {
  const records = new Map(projects.map(project => [project.projectID, project]));
  const names = mergeProjectURLNames(history.filter(item => records.has(item.projectID)), projects.map(project => {
    const previous = history.filter(item => item.projectID === project.projectID);
    return {projectID:project.projectID, name:project.name,
      claimedAt:previous.length ? project.updatedAt || project.createdAt : project.createdAt || project.updatedAt};
  }));
  const owners = new Map();
  for (const item of names) {
    const slug = projectURLSlug(item.name);
    if (!owners.has(slug)) owners.set(slug, item.projectID);
  }
  const aliases = new Map(), slugs = new Map(), assigned = new Map(owners);
  for (const item of names) {
    const base = projectURLSlug(item.name);
    const key = `${item.projectID}\n${base}`;
    let slug = slugs.get(key) || base;
    if (!slugs.has(key) && owners.get(base) !== item.projectID) {
      const tail = suffix(item.projectID);
      let length = 6;
      do {slug = `${base}-${tail.slice(0, length++)}`;} while (assigned.has(slug) && assigned.get(slug) !== item.projectID && length <= 14);
    }
    assigned.set(slug, item.projectID);slugs.set(key, slug);aliases.set(slug, records.get(item.projectID));
  }
  return {
    slugFor(projectID) {
      const record = records.get(projectID);
      return record ? slugs.get(`${projectID}\n${projectURLSlug(record.name)}`) || null : null;
    },
    resolve(slug) {return aliases.get(String(slug || '').toLowerCase()) || null;}
  };
}

export function parseProjectWorkspaceURL(location) {
  const match = String(location.pathname || '').match(/^\/workspace\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[1]).toLowerCase();
    if (!/^[\p{L}\p{N}][\p{L}\p{N}-]{0,110}$/u.test(slug) || slug.endsWith('-')) return null;
    return {slug};
  } catch {return null;}
}

export function buildProjectWorkspaceURL(slug) {
  return `/workspace/${encodeURIComponent(slug)}`;
}
