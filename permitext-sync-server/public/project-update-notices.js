// Per-account local metadata. Detection and acknowledgement create no requests.
export function readProjectUpdateNotices(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
const timestamp = value => Date.parse(value || '') || 0;
export function observeProjectUpdate(notices, event, browserID) {
  const {projectID, domain, version, updatedAt, sourceClientID, local = false, details, project, previousProject} = event;
  if (!projectID || !['project', 'artifacts'].includes(domain) || !Number.isFinite(version) || !timestamp(updatedAt)) return notices;
  const current = notices[projectID] || {domains: {}};
  const prior = current.domains?.[domain];
  if (prior && version <= prior.version) return notices;
  // Establish unknown legacy records as a baseline. Layout-only events from
  // older browsers cannot create an update notice.
  const pending = !local && sourceClientID !== browserID && (Boolean(prior) || domain === 'project' && Boolean(previousProject) && Boolean(sourceClientID));
  const next = {version, updatedAt, pending, ...(details ? {details} : {})};
  return {...notices, [projectID]: {...current, domains: {...current.domains, [domain]: next},
    ...(domain === 'project' && project ? pending
      ? {project: current.project || previousProject || project, pendingProject: project}
      : {project, pendingProject: null} : {})}};
}
export function projectUpdateNotice(notices, projectID) {
  const domains = notices[projectID]?.domains || {};
  const pending = Object.fromEntries(Object.entries(domains).filter(([domain,value]) => ['project', 'artifacts'].includes(domain) && value?.pending));
  const updatedAt = Object.values(pending).map(value => value.updatedAt).sort((a,b)=>timestamp(b)-timestamp(a))[0];
  return updatedAt ? {updatedAt, domains: pending} : null;
}
export function acknowledgeProjectUpdates(notices, projectID, applied) {
  const current = notices[projectID];
  if (!current) return notices;
  const domains = {...current.domains};
  for (const [domain, value] of Object.entries(applied || {})) {
    // Do not clear a newer update that arrived while content was loading.
    if (domains[domain]?.version === value.version) domains[domain] = {...domains[domain], pending:false};
  }
  return {...notices, [projectID]: {...current, domains,
    ...(applied?.project && domains.project?.pending === false && current.pendingProject
      ? {project: current.pendingProject, pendingProject: null} : {})}};
}
