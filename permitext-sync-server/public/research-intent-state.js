export const pendingResearchIntentStorageKey = "permitext:pendingResearchIntent:v1";
export const pendingResearchIntentTTLMS = 2 * 60 * 60 * 1000;

const pendingResearchIntentKinds = new Set([
  "create-selection",
  "append-selection"
]);
const pendingResearchOriginSurfaces = new Set([
  "reader",
  "saved",
  "search"
]);

function cleanText(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

function cleanIdentifier(value, maximumLength = 160) {
  return cleanText(value, maximumLength).replace(/[^a-zA-Z0-9._:@/-]/g, "");
}

function normalizePassage(value) {
  if (!value || typeof value !== "object") return null;
  const sectionID = cleanIdentifier(value.sectionID, 80);
  const selectedText = cleanText(value.selectedText, 12_000);
  if (!sectionID || !selectedText) return null;
  return {
    sectionID,
    selectedText,
    savedItemID: cleanIdentifier(value.savedItemID, 200)
  };
}

export function normalizePendingResearchIntent(value, options = {}) {
  if (!value || typeof value !== "object" || value.version !== 1) return null;
  const now = Number(options.now ?? Date.now());
  const createdAt = Number(value.createdAt);
  const expiresAt = Number(value.expiresAt);
  const kind = cleanText(value.kind, 40);
  const intentID = cleanIdentifier(value.intentID, 100);
  const workspaceID = cleanIdentifier(value.workspaceID, 160);
  const passages = (Array.isArray(value.passages) ? value.passages : [])
    .slice(0, 12)
    .map(normalizePassage)
    .filter(Boolean);
  if (
    !pendingResearchIntentKinds.has(kind) ||
    !intentID ||
    !workspaceID ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt > now + 60_000 ||
    expiresAt <= now ||
    expiresAt - createdAt > pendingResearchIntentTTLMS ||
    !passages.length
  ) return null;
  const conversationID = cleanIdentifier(value.conversationID, 160);
  if (kind === "append-selection" && !conversationID) return null;
  const allowedWorkspaceIDs = options.allowedWorkspaceIDs instanceof Set
    ? options.allowedWorkspaceIDs
    : null;
  if (allowedWorkspaceIDs && !allowedWorkspaceIDs.has(workspaceID)) return null;
  const originSurface = pendingResearchOriginSurfaces.has(value.originSurface)
    ? value.originSurface
    : "reader";
  return {
    version: 1,
    intentID,
    kind,
    createdAt,
    expiresAt,
    workspaceID,
    projectID: cleanIdentifier(value.projectID, 160),
    conversationID,
    originPaneID: cleanIdentifier(value.originPaneID, 200),
    originSurface,
    passages
  };
}

export function createPendingResearchIntent(values, options = {}) {
  const now = Number(options.now ?? Date.now());
  const intent = normalizePendingResearchIntent({
    version: 1,
    intentID: cleanIdentifier(values?.intentID, 100) || crypto.randomUUID(),
    kind: values?.kind,
    createdAt: now,
    expiresAt: now + pendingResearchIntentTTLMS,
    workspaceID: values?.workspaceID,
    projectID: values?.projectID,
    conversationID: values?.conversationID,
    originPaneID: values?.originPaneID,
    originSurface: values?.originSurface,
    passages: values?.passages
  }, { now });
  if (!intent) throw new Error("This Research action could not be preserved safely.");
  return intent;
}

export function readPendingResearchIntent(storage, options = {}) {
  try {
    const raw = storage?.getItem?.(pendingResearchIntentStorageKey);
    if (!raw) return null;
    const intent = normalizePendingResearchIntent(JSON.parse(raw), options);
    if (!intent) storage?.removeItem?.(pendingResearchIntentStorageKey);
    return intent;
  } catch {
    storage?.removeItem?.(pendingResearchIntentStorageKey);
    return null;
  }
}

export function writePendingResearchIntent(storage, values, options = {}) {
  const intent = createPendingResearchIntent(values, options);
  storage?.setItem?.(pendingResearchIntentStorageKey, JSON.stringify(intent));
  return intent;
}

export function clearPendingResearchIntent(storage, intentID = "") {
  try {
    if (intentID) {
      const current = readPendingResearchIntent(storage);
      if (current && current.intentID !== intentID) return false;
    }
    storage?.removeItem?.(pendingResearchIntentStorageKey);
    return true;
  } catch {
    return false;
  }
}
