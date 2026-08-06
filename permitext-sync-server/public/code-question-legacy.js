/** Code Question legacy promotion and supporting-tool contract (Phase 8). */

export const legacySourceKinds = Object.freeze([
  "notebookCard",
  "savedItem",
  "researchAnswer",
  "reportDraft",
  "reviewThread",
  "workboard"
]);

export const legacyFilters = Object.freeze([
  "all",
  "unassigned",
  "linked",
  "recovery"
]);

export const legacySourceLabels = Object.freeze({
  notebookCard: "Working Notes",
  savedItem: "Saved passage",
  researchAnswer: "Research answer",
  reportDraft: "Advanced Report Draft",
  reviewThread: "Coordination thread",
  workboard: "Workboard"
});

const sourceKindSet = new Set(legacySourceKinds);
const filterSet = new Set(legacyFilters);
const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function text(value, maximum = 1_000) {
  return String(value || "").trim().slice(0, maximum);
}

function requiredText(value, label, maximum = 512) {
  const normalized = text(value, maximum);
  if (!normalized) throw new Error(`Invalid ${label}.`);
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function legacyFingerprint(value) {
  const input = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function legacyPromotionID({ projectID, questionID, sourceKind, sourceID }) {
  return `local-cq-promotion-${legacyFingerprint({
    projectID: requiredText(projectID, "Project ID"),
    questionID: requiredText(questionID, "question ID"),
    sourceKind: requiredText(sourceKind, "source kind"),
    sourceID: requiredText(sourceID, "source ID")
  })}`;
}

export function emptyLegacyWorkspace(projectID = "") {
  return {
    schemaVersion: 1,
    projectID: String(projectID || ""),
    items: [],
    promotions: [],
    filter: "all",
    sourceKindFilter: "all",
    migration: {
      migrationVersion: 1,
      status: "not-run",
      migratedCount: 0,
      alreadyCurrentCount: 0,
      skippedCount: 0,
      ambiguousCount: 0,
      failedCount: 0,
      recoverableCount: 0,
      lastSuccessfulCheckpoint: null,
      note: "No legacy content is converted automatically."
    },
    loading: false,
    error: null,
    updatedAt: null
  };
}

export function normalizeLegacyPromotion(value = {}) {
  const sourceKind = String(value.sourceKind || "").trim();
  if (!sourceKindSet.has(sourceKind)) return null;
  const status = value.status === "unlinked" ? "unlinked" : "linked";
  const sourceID = String(value.sourceID || "").trim();
  const questionID = String(value.questionID || "").trim();
  if (!sourceID || !questionID) return null;
  return {
    ...copy(value),
    id: String(value.id || legacyPromotionID({
      projectID: value.projectID,
      questionID,
      sourceKind,
      sourceID
    })),
    version: Math.max(1, Number(value.version || 1)),
    projectID: String(value.projectID || ""),
    questionID,
    sourceKind,
    sourceID,
    sourceVersion: value.sourceVersion == null ? null : Number(value.sourceVersion),
    sourceLabel: text(value.sourceLabel, 500),
    sourceProjectID: value.sourceProjectID ? String(value.sourceProjectID) : null,
    action: value.action === "create-question" ? "create-question" : "link-existing",
    status,
    idempotencyKey: String(value.idempotencyKey || ""),
    recoveryCount: Math.max(0, Number(value.recoveryCount || 0)),
    createdAt: String(value.createdAt || value.updatedAt || new Date(0).toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date(0).toISOString()),
    unlinkedAt: status === "unlinked" ? String(value.unlinkedAt || value.updatedAt || "") : null
  };
}

function normalizeLegacyItem(value = {}, promotions = []) {
  const sourceKind = String(value.sourceKind || "").trim();
  const sourceID = String(value.sourceID || "").trim();
  if (!sourceKindSet.has(sourceKind) || !sourceID) return null;
  const promotionMap = new Map();
  [...(Array.isArray(value.promotions) ? value.promotions : []), ...(Array.isArray(promotions) ? promotions : [])]
    .map(normalizeLegacyPromotion)
    .filter((promotion) => promotion && promotion.sourceKind === sourceKind && promotion.sourceID === sourceID)
    .forEach((promotion) => promotionMap.set(promotion.id, promotion));
  const itemPromotions = Array.from(promotionMap.values());
  const linked = itemPromotions.filter((promotion) => promotion.status === "linked");
  const recovery = !linked.length && itemPromotions.some((promotion) => promotion.status === "unlinked");
  return {
    id: String(value.id || `${sourceKind}:${sourceID}`),
    sourceKind,
    sourceID,
    sourceVersion: value.sourceVersion == null ? null : Number(value.sourceVersion),
    typeLabel: text(value.typeLabel || legacySourceLabels[sourceKind], 120),
    title: text(value.title || legacySourceLabels[sourceKind], 500),
    summary: text(value.summary, 1_000),
    updatedAt: value.updatedAt ? String(value.updatedAt) : null,
    assignment: value.assignment === "project" ? "project" : "unassigned",
    promotionState: linked.length ? "linked" : recovery ? "recovery" : "unassigned",
    questionIDs: linked.map((promotion) => promotion.questionID),
    promotions: itemPromotions
  };
}

export function legacyCounts(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    unassigned: list.filter((item) => item.promotionState === "unassigned").length,
    linked: list.filter((item) => item.promotionState === "linked").length,
    recovery: list.filter((item) => item.promotionState === "recovery").length,
    projectOwned: list.filter((item) => item.assignment === "project").length,
    accountUnassigned: list.filter((item) => item.assignment === "unassigned").length
  };
}

export function normalizeLegacyWorkspace(value, projectID = "") {
  const source = value && typeof value === "object" ? value : {};
  const base = emptyLegacyWorkspace(projectID || source.projectID);
  const promotions = (Array.isArray(source.promotions) ? source.promotions : [])
    .map(normalizeLegacyPromotion)
    .filter(Boolean);
  const items = (Array.isArray(source.items) ? source.items : [])
    .map((item) => normalizeLegacyItem(item, promotions))
    .filter(Boolean);
  return {
    ...base,
    ...copy(source),
    projectID: String(projectID || source.projectID || ""),
    items,
    promotions,
    counts: legacyCounts(items),
    filter: filterSet.has(source.filter) ? source.filter : "all",
    sourceKindFilter: source.sourceKindFilter === "all" || sourceKindSet.has(source.sourceKindFilter)
      ? source.sourceKindFilter
      : "all",
    migration: { ...base.migration, ...(source.migration || {}) },
    loading: source.loading === true,
    error: source.error ? String(source.error) : null,
    updatedAt: source.updatedAt ? String(source.updatedAt) : null
  };
}

export function mergeLegacyInventory(workspace, inventory = {}, projectID = "") {
  const current = normalizeLegacyWorkspace(workspace, projectID || inventory.projectID);
  const remotePromotions = (Array.isArray(inventory.promotions) ? inventory.promotions : [])
    .map(normalizeLegacyPromotion)
    .filter(Boolean);
  const promotionMap = new Map(current.promotions.map((promotion) => [promotion.id, promotion]));
  remotePromotions.forEach((promotion) => promotionMap.set(promotion.id, promotion));
  const promotions = Array.from(promotionMap.values());
  const items = (Array.isArray(inventory.items) ? inventory.items : current.items)
    .map((item) => normalizeLegacyItem(item, promotions))
    .filter(Boolean);
  return normalizeLegacyWorkspace({
    ...current,
    items,
    promotions,
    migration: inventory.migration || current.migration,
    loading: false,
    error: null,
    updatedAt: new Date().toISOString()
  }, current.projectID);
}

export function filterLegacyItems(workspace, options = {}) {
  const current = normalizeLegacyWorkspace(workspace);
  const filter = filterSet.has(options.filter) ? options.filter : current.filter;
  const sourceKindFilter = options.sourceKindFilter === "all" || sourceKindSet.has(options.sourceKindFilter)
    ? options.sourceKindFilter
    : current.sourceKindFilter;
  const query = text(options.query, 500).toLowerCase();
  return current.items.filter((item) => {
    if (filter !== "all" && item.promotionState !== filter) return false;
    if (sourceKindFilter !== "all" && item.sourceKind !== sourceKindFilter) return false;
    if (!query) return true;
    return [item.typeLabel, item.title, item.summary, item.sourceID]
      .join(" ").toLowerCase().includes(query);
  });
}

export function promoteLegacyItem(workspace, source, questionID, options = {}) {
  const current = normalizeLegacyWorkspace(workspace, options.projectID);
  const item = normalizeLegacyItem(source, current.promotions);
  if (!item) throw new Error("Legacy source is unavailable.");
  const targetQuestionID = requiredText(questionID, "question ID");
  const id = legacyPromotionID({
    projectID: current.projectID,
    questionID: targetQuestionID,
    sourceKind: item.sourceKind,
    sourceID: item.sourceID
  });
  const existing = current.promotions.find((promotion) => promotion.id === id);
  if (existing?.status === "linked") {
    return { workspace: current, promotion: existing, replayed: true, recovered: false };
  }
  const now = new Date(options.at || Date.now()).toISOString();
  const recovered = existing?.status === "unlinked";
  const promotion = normalizeLegacyPromotion({
    ...(existing || {}),
    id,
    version: Number(existing?.version || 0) + 1,
    projectID: current.projectID,
    questionID: targetQuestionID,
    sourceKind: item.sourceKind,
    sourceID: item.sourceID,
    sourceVersion: item.sourceVersion,
    sourceLabel: item.title,
    sourceProjectID: item.assignment === "project" ? current.projectID : null,
    action: options.action === "create-question" ? "create-question" : "link-existing",
    status: "linked",
    idempotencyKey: options.idempotencyKey || `local:${id}`,
    recoveryCount: Number(existing?.recoveryCount || 0) + (recovered ? 1 : 0),
    createdByUserID: existing?.createdByUserID || options.actorUserID || "local-user",
    createdAt: existing?.createdAt || now,
    updatedByUserID: options.actorUserID || "local-user",
    updatedAt: now,
    unlinkedAt: null
  });
  const promotions = existing
    ? current.promotions.map((candidate) => candidate.id === id ? promotion : candidate)
    : [...current.promotions, promotion];
  return {
    promotion,
    replayed: false,
    recovered,
    workspace: mergeLegacyInventory({ ...current, promotions }, { items: current.items, promotions }, current.projectID)
  };
}

export function unlinkLegacyPromotion(workspace, promotionID, options = {}) {
  const current = normalizeLegacyWorkspace(workspace);
  const existing = current.promotions.find((promotion) => promotion.id === promotionID);
  if (!existing) throw new Error("Promotion relationship not found.");
  if (existing.status === "unlinked") {
    return { workspace: current, promotion: existing, replayed: true };
  }
  const now = new Date(options.at || Date.now()).toISOString();
  const promotion = normalizeLegacyPromotion({
    ...existing,
    version: existing.version + 1,
    status: "unlinked",
    updatedByUserID: options.actorUserID || "local-user",
    updatedAt: now,
    unlinkedAt: now
  });
  const promotions = current.promotions.map((candidate) =>
    candidate.id === promotionID ? promotion : candidate
  );
  return {
    promotion,
    replayed: false,
    workspace: mergeLegacyInventory({ ...current, promotions }, { items: current.items, promotions }, current.projectID)
  };
}

export function legacyGuidanceForSource(sourceKind) {
  const guidance = {
    notebookCard: "Link this Working Notes card as background. Its prose does not become a governed fact automatically.",
    savedItem: "Link this Saved passage as a candidate. It is not approved Evidence until reviewed in the Evidence stage.",
    researchAnswer: "Link this historical answer as provenance and a starting point. It is not silently reused as current analysis.",
    reportDraft: "Link this advanced Report Draft as authored background. The generic draft remains editable and separate from the Code Memo.",
    reviewThread: "Link this Coordination thread while preserving its comments, statuses, actors, and existing editing rules.",
    workboard: "Link this Project Workboard without changing Project ownership or treating diagram text as hidden model context."
  };
  return guidance[sourceKind] || "Link this source explicitly without changing or deleting the original record.";
}
