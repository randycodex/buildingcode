export const freePlanLimits = Object.freeze({
  savedItems: 25,
  notes: 10,
  projects: 0
});

function mutationEntry(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record: record || {} };
}

function recordID(mutation) {
  const { kind, record } = mutationEntry(mutation);
  if (kind === "continuity") {
    return [record.userID, "continuity", record.codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    return [record.userID, "code-version-clear", record.codeVersion, record.values?.scope]
      .filter(Boolean)
      .join(":");
  }
  return record.id || null;
}

function isDeleted(record) {
  return Number.isFinite(Date.parse(record?.deletedAt || ""));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasActiveProEntitlement(entitlement, now = Date.now()) {
  if (String(entitlement?.plan || "").toLowerCase() !== "pro") return false;
  const expiration = Date.parse(entitlement?.expiresAt || "");
  return !Number.isFinite(expiration) || expiration > now;
}

export function freePlanUsage(mutations) {
  const latestByID = new Map();
  for (const mutation of mutations || []) {
    const id = recordID(mutation);
    if (!id) continue;
    const existing = latestByID.get(id);
    const incomingDate = Date.parse(mutationEntry(mutation).record.updatedAt || "");
    const existingDate = Date.parse(mutationEntry(existing).record.updatedAt || "");
    if (!existing || !Number.isFinite(existingDate) || incomingDate >= existingDate) {
      latestByID.set(id, mutation);
    }
  }

  const usage = { savedItems: 0, notes: 0, projects: 0 };
  for (const mutation of latestByID.values()) {
    const { kind, record } = mutationEntry(mutation);
    if (isDeleted(record)) continue;
    if (kind === "savedItem") usage.savedItems += 1;
    if (kind === "annotation" && record.tags === undefined && hasText(record.noteBody)) usage.notes += 1;
    if (kind === "project") usage.projects += 1;
  }
  return usage;
}

export function freePlanMutationDecision({ mutation, existingMutation, entitlement, usage }) {
  if (hasActiveProEntitlement(entitlement)) return { allowed: true };

  const { kind, record } = mutationEntry(mutation);
  if (!kind || isDeleted(record) || kind === "continuity" || kind === "codeVersionClear") {
    return { allowed: true };
  }

  const existingRecord = mutationEntry(existingMutation).record;
  const updatesActiveRecord = Boolean(existingMutation) && !isDeleted(existingRecord);
  const updatesFreeRecord =
    kind === "savedItem" ||
    (kind === "annotation" && record.tags === undefined);
  if (updatesActiveRecord && updatesFreeRecord) return { allowed: true };

  if (kind === "savedItem" && usage.savedItems >= freePlanLimits.savedItems) {
    return {
      allowed: false,
      code: "FREE_SAVED_ITEM_LIMIT",
      message: `Free includes up to ${freePlanLimits.savedItems} saved sections. Upgrade to Pro to save more.`
    };
  }
  if (kind === "annotation" && record.tags === undefined && hasText(record.noteBody) && usage.notes >= freePlanLimits.notes) {
    return {
      allowed: false,
      code: "FREE_NOTE_LIMIT",
      message: `Free includes up to ${freePlanLimits.notes} notes. Upgrade to Pro to add more.`
    };
  }
  if (kind === "annotation" && record.tags !== undefined && Array.isArray(record.tags) && record.tags.length > 0) {
    return {
      allowed: false,
      code: "PRO_REQUIRED_ORGANIZATION",
      message: "Tags and advanced organization require Pro."
    };
  }
  if (kind === "project") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_PROJECTS",
      message: "Projects require Pro."
    };
  }
  if (kind === "projectSection") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_PROJECTS",
      message: "Project organization requires Pro."
    };
  }
  if (kind === "workboard") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_WORKBOARDS",
      message: "Workboards require Pro."
    };
  }
  return { allowed: true };
}

export function enforceFreePlanMutationBatch(existingMutations, incomingMutations, entitlement) {
  const workingByID = new Map(
    (existingMutations || [])
      .map((mutation) => [recordID(mutation), mutation])
      .filter(([id]) => Boolean(id))
  );
  const acceptedMutations = [];
  const rejectedMutationIDs = [];
  const rejectionReasons = {};

  for (const mutation of incomingMutations || []) {
    const id = recordID(mutation);
    if (!id) continue;
    const existingMutation = workingByID.get(id);
    const decision = freePlanMutationDecision({
      mutation,
      existingMutation,
      entitlement,
      usage: freePlanUsage(Array.from(workingByID.values()))
    });
    if (!decision.allowed) {
      rejectedMutationIDs.push(id);
      rejectionReasons[id] = { code: decision.code, message: decision.message };
      continue;
    }
    acceptedMutations.push(mutation);
    const incomingUpdatedAt = Date.parse(mutationEntry(mutation).record.updatedAt || "");
    const existingUpdatedAt = Date.parse(mutationEntry(existingMutation).record.updatedAt || "");
    if (!existingMutation || !Number.isFinite(existingUpdatedAt) || incomingUpdatedAt >= existingUpdatedAt) {
      workingByID.set(id, mutation);
    }
  }

  return { acceptedMutations, rejectedMutationIDs, rejectionReasons };
}
