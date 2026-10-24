// Per-account local metadata. Detection and acknowledgement create no requests.
export function readProjectUpdateNotices(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
const timestamp = value => Date.parse(value || '') || 0;
export function observeProjectUpdate(notices, event, browserID) {
  const {projectID, domain, version, updatedAt, sourceClientID, local = false, manual = false, details, project, previousProject} = event;
  if (!projectID || !['project', 'artifacts'].includes(domain) || !Number.isFinite(version) || !timestamp(updatedAt)) return notices;
  const current = notices[projectID] || {domains: {}};
  const prior = current.domains?.[domain];
  if (prior && (version < prior.version || version === prior.version && (!manual || prior.pending))) return notices;
  // Establish unknown legacy records as a baseline. Layout-only events from
  // older browsers cannot create an update notice.
  // A local save can advance the same Project revision while other remote
  // changes remain unapplied. Its receipt must not acknowledge those changes.
  const pending = Boolean(prior?.pending) || !local && sourceClientID !== browserID && (manual || Boolean(prior) || domain === 'project' && Boolean(previousProject) && Boolean(sourceClientID));
  const pendingDetails = pending ? [...new Set([...(prior?.pending ? prior.details || [] : []), ...(details || [])])] : details;
  const next = {version, updatedAt, pending, ...(pendingDetails ? {details:pendingDetails} : {})};
  const domains = {...current.domains, [domain]: next};
  return {...notices, [projectID]: {...current, domains, reviewRequired: Boolean(current.reviewRequired && Object.values(domains).some(value => value.pending)),
    ...(domain === 'project' && project ? pending
      ? {project: current.project || previousProject || project, pendingProject: project}
      : {project, pendingProject: null} : {})}};
}
export function projectUpdateNotice(notices, projectID) {
  const domains = notices[projectID]?.domains || {};
  const pending = Object.fromEntries(Object.entries(domains).filter(([domain,value]) => ['project', 'artifacts'].includes(domain) && value?.pending));
  const updatedAt = Object.values(pending).map(value => value.updatedAt).sort((a,b)=>timestamp(b)-timestamp(a))[0];
  return updatedAt ? {updatedAt, domains: pending, reviewRequired: notices[projectID]?.reviewRequired === true} : null;
}
export function acknowledgeProjectUpdates(notices, projectID, applied) {
  const current = notices[projectID];
  if (!current) return notices;
  const domains = {...current.domains};
  for (const [domain, value] of Object.entries(applied || {})) {
    // Do not clear a newer update that arrived while content was loading.
    if (domains[domain]?.version === value.version) domains[domain] = {...domains[domain], pending:false};
  }
  return {...notices, [projectID]: {...current, domains, reviewRequired: Boolean(current.reviewRequired && Object.values(domains).some(value => value.pending)),
    ...(applied?.project && domains.project?.pending === false && current.pendingProject
      ? {project: current.pendingProject, pendingProject: null} : {})}};
}

export function requireProjectUpdateReview(notices, projectID) {
  const current = notices[projectID];
  if (!current || current.reviewRequired || !projectUpdateNotice(notices, projectID)) return notices;
  return {...notices, [projectID]: {...current, reviewRequired:true}};
}
