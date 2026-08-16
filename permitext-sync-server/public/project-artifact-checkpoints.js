export const PROJECT_ARTIFACT_DOMAINS = Object.freeze([
  "activity",
  "foundation",
  "notebook",
  "report",
  "research"
]);

const PROJECT_ARTIFACT_DOMAIN_SET = new Set(PROJECT_ARTIFACT_DOMAINS);

export function normalizeProjectArtifactRevisionEnvelope(value = {}, scope = {}) {
  const domains = Array.from(new Set(
    (Array.isArray(value.changedDomains) ? value.changedDomains : value.domains || [])
      .map((domain) => String(domain || ""))
      .filter((domain) => PROJECT_ARTIFACT_DOMAIN_SET.has(domain))
  )).sort();
  return {
    accountUserID: String(value.accountUserID || scope.accountUserID || ""),
    workspaceID: String(value.workspaceID || scope.workspaceID || ""),
    storageOwnerUserID: String(value.storageOwnerUserID || ""),
    projectID: String(value.projectID || ""),
    revision: Math.max(0, Number(value.revision || 0)),
    domains,
    updatedAt: value.updatedAt || null
  };
}

export function projectArtifactRevisionKey(envelope = {}) {
  return [
    envelope.accountUserID,
    envelope.workspaceID,
    envelope.storageOwnerUserID,
    envelope.projectID
  ].map((value) => String(value || "")).join("::");
}

export function normalizeAccountArtifactRevisionEnvelope(value = {}, scope = {}) {
  const domains = Array.from(new Set(
    (Array.isArray(value.changedDomains) ? value.changedDomains : value.domains || [])
      .map((domain) => String(domain || ""))
      .filter((domain) => PROJECT_ARTIFACT_DOMAIN_SET.has(domain))
  )).sort();
  return {
    accountUserID: String(value.accountUserID || scope.accountUserID || ""),
    workspaceID: String(value.workspaceID || scope.workspaceID || ""),
    storageOwnerUserID: String(value.storageOwnerUserID || ""),
    revision: Math.max(0, Number(value.revision || 0)),
    domains,
    updatedAt: value.updatedAt || null
  };
}

export function accountArtifactRevisionKey(envelope = {}) {
  return [
    "account",
    envelope.accountUserID,
    envelope.workspaceID,
    envelope.storageOwnerUserID
  ].map((value) => String(value || "")).join("::");
}

export function reduceAccountArtifactRevision({ envelope, revision = null, scope = {} } = {}) {
  const normalized = normalizeAccountArtifactRevisionEnvelope(envelope, scope);
  const matches = Boolean(
    scope.researchVisible === true &&
    normalized.accountUserID &&
    normalized.accountUserID === String(scope.accountUserID || "") &&
    normalized.workspaceID &&
    normalized.workspaceID === String(scope.workspaceID || "") &&
    normalized.storageOwnerUserID
  );
  if (!matches || (revision && Number(revision.revision || 0) >= normalized.revision)) {
    return { accepted: null, refreshResearch: false };
  }
  return {
    accepted: normalized,
    refreshResearch: normalized.revision > 0 && normalized.domains.includes("research")
  };
}

export function projectArtifactEnvelopeMatchesScope(envelope = {}, scope = {}) {
  const visibleProjectIDs = scope.visibleProjectIDs instanceof Set
    ? scope.visibleProjectIDs
    : new Set(scope.visibleProjectIDs || []);
  return Boolean(
    envelope.accountUserID &&
    envelope.accountUserID === String(scope.accountUserID || "") &&
    envelope.workspaceID &&
    envelope.workspaceID === String(scope.workspaceID || "") &&
    envelope.storageOwnerUserID &&
    envelope.projectID &&
    visibleProjectIDs.has(envelope.projectID)
  );
}

export function uniqueProjectArtifactConsumerIDs(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "")).filter(Boolean)));
}

export function projectArtifactRefreshPlan(domains = []) {
  const changed = new Set(domains);
  const foundationChanged = changed.has("foundation") || changed.has("research");
  return {
    notebookCards: changed.has("notebook"),
    notebookReferences: foundationChanged || changed.has("notebook"),
    notebookFoundation: foundationChanged,
    notebookReportStatus: changed.has("report"),
    reportArtifacts: changed.has("report"),
    reportSources: foundationChanged || changed.has("notebook"),
    summaries: foundationChanged || changed.has("activity")
  };
}

export function reduceProjectArtifactRevisions({
  envelopes = [],
  revisions = new Map(),
  scope = {}
} = {}) {
  const nextRevisions = new Map(revisions);
  const accepted = [];
  const refreshes = new Map();
  envelopes.forEach((rawEnvelope) => {
    const envelope = normalizeProjectArtifactRevisionEnvelope(rawEnvelope, scope);
    if (!projectArtifactEnvelopeMatchesScope(envelope, scope)) return;
    const key = projectArtifactRevisionKey(envelope);
    const previous = nextRevisions.get(key);
    if (previous && Number(previous.revision || 0) >= envelope.revision) return;
    nextRevisions.set(key, envelope);
    accepted.push(envelope);
    if (envelope.revision <= 0) return;
    const existingDomains = refreshes.get(envelope.projectID) || new Set();
    envelope.domains.forEach((domain) => existingDomains.add(domain));
    refreshes.set(envelope.projectID, existingDomains);
  });
  return {
    accepted,
    nextRevisions,
    refreshes: Array.from(refreshes, ([projectID, domains]) => ({
      projectID,
      domains: Array.from(domains).sort(),
      plan: projectArtifactRefreshPlan(domains)
    }))
  };
}
