import {
  emptyCodeQuestionWorkspaceState,
  normalizeCodeQuestionWorkspaceState
} from "./code-question-workspace.js?v=20260809-code-decision-v3";

export const codeQuestionAccountCacheVersion = 1;
export const codeQuestionAccountCacheKeyPrefix = "permitext:codeQuestionAccount:v1:";

const queuedStatusSet = new Set(["queued", "retrying"]);
const offlineSafeCommandKinds = new Set([
  "codeQuestion.create",
  "codeQuestion.update",
  "codeQuestion.definition.update",
  "codeQuestion.input.save",
  "codeQuestion.input.revise",
  "codeQuestion.evidence.propose"
]);

function copy(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requiredText(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`Missing ${label}.`);
  return normalized;
}

function mutationID(options = {}) {
  const supplied = String(options.clientMutationID || options.id || "").trim();
  if (supplied) return supplied;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cq-mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function codeQuestionAccountCacheKey(accountUserID) {
  return `${codeQuestionAccountCacheKeyPrefix}${encodeURIComponent(requiredText(accountUserID, "account user ID"))}`;
}

export function emptyCodeQuestionAccountState(accountUserID = "") {
  return {
    schemaVersion: codeQuestionAccountCacheVersion,
    accountUserID: String(accountUserID || "").trim(),
    workspaceSnapshots: {},
    accessByProjectID: {},
    outbox: [],
    conflicts: [],
    updatedAt: null
  };
}

function normalizeProjectAccess(value) {
  if (!value || typeof value !== "object") return null;
  const role = String(value.role || "").trim().toLowerCase();
  if (!["owner", "editor", "reviewer", "viewer"].includes(role)) return null;
  return {
    role,
    permissions: Array.from(new Set(
      (Array.isArray(value.permissions) ? value.permissions : []).map(String).filter(Boolean)
    )),
    cachedAt: String(value.cachedAt || new Date().toISOString())
  };
}

function normalizePaneOrder(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .filter((paneID) => typeof paneID === "string" && paneID.startsWith("cq:"))
  ));
}

function normalizePaneWeights(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([paneID, width]) =>
        paneID.startsWith("cq:") && Number.isFinite(Number(width)) && Number(width) > 40
      )
      .map(([paneID, width]) => [paneID, Number(width)])
  );
}

function normalizeWorkspaceSnapshot(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    workspace: normalizeCodeQuestionWorkspaceState(source.workspace),
    paneOrder: normalizePaneOrder(source.paneOrder),
    paneWeights: normalizePaneWeights(source.paneWeights),
    updatedAt: source.updatedAt ? String(source.updatedAt) : null
  };
}

export function codeQuestionMutationIsIssuance(value = {}) {
  const commandKind = String(value.commandKind || "").trim().toLowerCase();
  const path = String(value.path || "").trim().toLowerCase();
  return commandKind.startsWith("codequestion.issue") ||
    commandKind.includes("issuance") ||
    /\/(?:issue|issuance)(?:\/|$)/.test(path);
}

export function codeQuestionMutationIsOfflineSafe(value = {}) {
  if (codeQuestionMutationIsIssuance(value)) return false;
  return offlineSafeCommandKinds.has(String(value.commandKind || "").trim());
}

export function normalizeCodeQuestionMutation(value, accountUserID) {
  if (!value || typeof value !== "object") return null;
  const owner = String(accountUserID || "").trim();
  const entryOwner = String(value.accountUserID || owner).trim();
  const id = String(value.clientMutationID || value.id || "").trim();
  const commandKind = String(value.commandKind || "").trim();
  const path = String(value.path || "").trim();
  const projectID = String(value.projectID || value.payload?.projectID || "").trim();
  if (!owner || entryOwner !== owner || !id || !commandKind || !path || !projectID) return null;
  if (codeQuestionMutationIsIssuance({ commandKind, path })) return null;
  return {
    id,
    clientMutationID: id,
    accountUserID: owner,
    commandKind,
    path,
    projectID,
    questionID: String(
      value.questionID ||
      value.payload?.questionID ||
      (commandKind === "codeQuestion.create" ? value.payload?.id : "") ||
      ""
    ).trim() || null,
    expectedVersion: value.expectedVersion == null ? null : Number(value.expectedVersion),
    payload: value.payload && typeof value.payload === "object" ? copy(value.payload) : {},
    queuedAt: String(value.queuedAt || new Date().toISOString()),
    attemptCount: Math.max(0, Number(value.attemptCount || 0)),
    status: queuedStatusSet.has(value.status) ? value.status : "queued",
    lastError: value.lastError ? String(value.lastError) : null
  };
}

function normalizeConflict(value, accountUserID) {
  const mutation = normalizeCodeQuestionMutation(value?.mutation || value, accountUserID);
  if (!mutation) return null;
  return {
    ...mutation,
    mutation,
    status: "conflict",
    conflictCode: String(value.conflictCode || value.code || "CODE_QUESTION_VERSION_CONFLICT"),
    lastError: String(value.lastError || value.message || "The server has a newer version of this record."),
    serverVersion: value.serverVersion == null ? null : Number(value.serverVersion),
    conflictedAt: String(value.conflictedAt || new Date().toISOString())
  };
}

export function normalizeCodeQuestionAccountState(value = {}, options = {}) {
  const accountUserID = requiredText(options.accountUserID || value.accountUserID, "account user ID");
  const source = value && typeof value === "object" ? value : {};
  const workspaceSnapshots = source.workspaceSnapshots && typeof source.workspaceSnapshots === "object"
    ? Object.fromEntries(
        Object.entries(source.workspaceSnapshots)
          .filter(([workspaceID, snapshot]) => workspaceID && snapshot && typeof snapshot === "object")
          .map(([workspaceID, snapshot]) => [workspaceID, normalizeWorkspaceSnapshot(snapshot)])
      )
    : {};
  const accessByProjectID = source.accessByProjectID && typeof source.accessByProjectID === "object"
    ? Object.fromEntries(
        Object.entries(source.accessByProjectID)
          .map(([projectID, access]) => [String(projectID || "").trim(), normalizeProjectAccess(access)])
          .filter(([projectID, access]) => projectID && access)
      )
    : {};
  const normalizedOutbox = (Array.isArray(source.outbox) ? source.outbox : [])
    .map((entry) => normalizeCodeQuestionMutation(entry, accountUserID))
    .filter(Boolean);
  const outbox = normalizedOutbox.filter(codeQuestionMutationIsOfflineSafe);
  const unsafeConflicts = normalizedOutbox
    .filter((entry) => !codeQuestionMutationIsOfflineSafe(entry))
    .map((mutation) => normalizeConflict({
      mutation,
      conflictCode: "CODE_QUESTION_COMMAND_REQUIRES_ONLINE",
      lastError: "This queued action requires an online server transaction and was quarantined without replay."
    }, accountUserID));
  const conflicts = [
    ...(Array.isArray(source.conflicts) ? source.conflicts : [])
    .map((entry) => normalizeConflict(entry, accountUserID))
    .filter(Boolean),
    ...unsafeConflicts
  ];
  return {
    schemaVersion: codeQuestionAccountCacheVersion,
    accountUserID,
    workspaceSnapshots,
    accessByProjectID,
    outbox: Array.from(new Map(outbox.map((entry) => [entry.id, entry])).values()),
    conflicts: Array.from(new Map(conflicts.map((entry) => [entry.id, entry])).values()),
    updatedAt: source.updatedAt ? String(source.updatedAt) : null
  };
}

export function readCodeQuestionAccountState(storage, accountUserID) {
  if (!accountUserID) return emptyCodeQuestionAccountState();
  try {
    const raw = storage?.getItem?.(codeQuestionAccountCacheKey(accountUserID));
    return normalizeCodeQuestionAccountState(raw ? JSON.parse(raw) : {}, { accountUserID });
  } catch {
    return emptyCodeQuestionAccountState(accountUserID);
  }
}

export function writeCodeQuestionAccountState(storage, value, accountUserID = value?.accountUserID) {
  const normalized = normalizeCodeQuestionAccountState(value, { accountUserID });
  const existing = readCodeQuestionAccountState(storage, normalized.accountUserID);
  const semantic = (state) => JSON.stringify({
    ...state,
    updatedAt: null,
    workspaceSnapshots: Object.fromEntries(
      Object.entries(state.workspaceSnapshots || {}).map(([workspaceID, snapshot]) => [workspaceID, {
        ...snapshot,
        updatedAt: null
      }])
    ),
    accessByProjectID: Object.fromEntries(
      Object.entries(state.accessByProjectID || {}).map(([projectID, access]) => [projectID, {
        ...access,
        cachedAt: null
      }])
    )
  });
  if (semantic(existing) === semantic(normalized)) return existing;
  const stored = { ...normalized, updatedAt: new Date().toISOString() };
  storage?.setItem?.(codeQuestionAccountCacheKey(normalized.accountUserID), JSON.stringify(stored));
  return stored;
}

export function codeQuestionWorkspaceSnapshot(accountState, workspaceID, options = {}) {
  const id = String(workspaceID || "").trim();
  const snapshot = id ? accountState?.workspaceSnapshots?.[id] : null;
  if (!snapshot) {
    return {
      workspace: normalizeCodeQuestionWorkspaceState(emptyCodeQuestionWorkspaceState(), options),
      paneOrder: [],
      paneWeights: {},
      updatedAt: null
    };
  }
  return {
    ...normalizeWorkspaceSnapshot(snapshot),
    workspace: normalizeCodeQuestionWorkspaceState(snapshot.workspace, options)
  };
}

export function updateCodeQuestionWorkspaceSnapshot(accountState, workspaceID, snapshot) {
  const current = normalizeCodeQuestionAccountState(accountState, {
    accountUserID: accountState?.accountUserID
  });
  const id = requiredText(workspaceID, "workspace ID");
  return {
    ...current,
    workspaceSnapshots: {
      ...current.workspaceSnapshots,
      [id]: {
        ...normalizeWorkspaceSnapshot(snapshot),
        updatedAt: new Date().toISOString()
      }
    }
  };
}

export function createCodeQuestionOfflineMutation(options = {}) {
  if (codeQuestionMutationIsIssuance(options)) {
    const error = new Error("Code Memo issuance requires an online server transaction and cannot be queued offline.");
    error.code = "CODE_QUESTION_ISSUANCE_REQUIRES_ONLINE";
    throw error;
  }
  if (!codeQuestionMutationIsOfflineSafe(options)) {
    const error = new Error("This Code Question action requires an online server transaction and cannot be queued offline.");
    error.code = "CODE_QUESTION_COMMAND_REQUIRES_ONLINE";
    throw error;
  }
  const accountUserID = requiredText(options.accountUserID, "account user ID");
  const projectID = requiredText(options.projectID || options.payload?.projectID, "Project ID");
  const path = requiredText(options.path, "Code Question command path");
  const commandKind = requiredText(options.commandKind, "Code Question command kind");
  const id = mutationID(options);
  return normalizeCodeQuestionMutation({
    ...options,
    id,
    clientMutationID: id,
    accountUserID,
    projectID,
    path,
    commandKind,
    status: "queued",
    queuedAt: options.queuedAt || new Date().toISOString()
  }, accountUserID);
}

export function enqueueCodeQuestionOfflineMutation(accountState, mutation) {
  const current = normalizeCodeQuestionAccountState(accountState, {
    accountUserID: accountState?.accountUserID || mutation?.accountUserID
  });
  const entry = normalizeCodeQuestionMutation(mutation, current.accountUserID);
  if (!entry || !codeQuestionMutationIsOfflineSafe(mutation)) {
    const error = new Error(codeQuestionMutationIsIssuance(mutation)
      ? "Code Memo issuance requires an online server transaction and cannot be queued offline."
      : entry
        ? "This Code Question action requires an online server transaction and cannot be queued offline."
        : "Invalid Code Question offline mutation.");
    error.code = codeQuestionMutationIsIssuance(mutation)
      ? "CODE_QUESTION_ISSUANCE_REQUIRES_ONLINE"
      : entry
        ? "CODE_QUESTION_COMMAND_REQUIRES_ONLINE"
        : "CODE_QUESTION_OFFLINE_MUTATION_INVALID";
    throw error;
  }
  return {
    ...current,
    outbox: [...current.outbox.filter((item) => item.id !== entry.id), entry],
    conflicts: current.conflicts.filter((item) => item.id !== entry.id)
  };
}

export function migrateCodeQuestionAccountState(storage, sourceUserID, targetUserID) {
  const sourceID = requiredText(sourceUserID, "source account user ID");
  const targetID = requiredText(targetUserID, "target account user ID");
  if (sourceID === targetID) return readCodeQuestionAccountState(storage, targetID);
  const source = readCodeQuestionAccountState(storage, sourceID);
  const target = readCodeQuestionAccountState(storage, targetID);
  const retargetMutation = (entry) => ({
    ...copy(entry),
    accountUserID: targetID,
    mutation: entry.mutation ? { ...copy(entry.mutation), accountUserID: targetID } : entry.mutation
  });
  const merged = normalizeCodeQuestionAccountState({
    ...target,
    accountUserID: targetID,
    workspaceSnapshots: { ...target.workspaceSnapshots, ...source.workspaceSnapshots },
    accessByProjectID: { ...source.accessByProjectID, ...target.accessByProjectID },
    outbox: [...target.outbox, ...source.outbox.map(retargetMutation)],
    conflicts: [...target.conflicts, ...source.conflicts.map(retargetMutation)]
  }, { accountUserID: targetID });
  const stored = writeCodeQuestionAccountState(storage, merged, targetID);
  storage?.removeItem?.(codeQuestionAccountCacheKey(sourceID));
  return stored;
}

export function evictCodeQuestionProject(accountState, projectIDValue, options = {}) {
  const current = normalizeCodeQuestionAccountState(accountState, {
    accountUserID: accountState?.accountUserID
  });
  const projectID = requiredText(projectIDValue, "Project ID");
  const requestedQuestionID = String(options.questionID || "").trim();
  const workspaceSnapshots = Object.fromEntries(
    Object.entries(current.workspaceSnapshots).map(([workspaceID, snapshot]) => {
      const workspace = copy(snapshot.workspace);
      const projectQuestionIDs = new Set(
        (workspace.questionsByProjectID?.[projectID] || []).map((question) => String(question.id || "")).filter(Boolean)
      );
      (workspace.openPanes || [])
        .filter((pane) => pane.projectID === projectID && pane.questionID && pane.questionID !== "_")
        .forEach((pane) => projectQuestionIDs.add(String(pane.questionID)));
      const removedPaneIDs = new Set((workspace.openPanes || [])
        .filter((pane) => pane.projectID === projectID && (!requestedQuestionID || pane.questionID === requestedQuestionID))
        .map((pane) => pane.paneID));
      if (requestedQuestionID) projectQuestionIDs.add(requestedQuestionID);
      const removeQuestion = (questionID) => !requestedQuestionID || questionID === requestedQuestionID;
      if (requestedQuestionID) {
        if (workspace.questionsByProjectID?.[projectID]) {
          workspace.questionsByProjectID[projectID] = workspace.questionsByProjectID[projectID]
            .filter((question) => String(question.id || "") !== requestedQuestionID);
        }
      } else {
        delete workspace.questionsByProjectID?.[projectID];
      }
      for (const mapName of [
        "definitionsByQuestionID", "evidenceByQuestionID", "analysisByQuestionID",
        "reviewByQuestionID", "issueByQuestionID"
      ]) {
        for (const questionID of projectQuestionIDs) {
          if (removeQuestion(questionID)) delete workspace[mapName]?.[questionID];
        }
      }
      workspace.openPanes = (workspace.openPanes || []).filter((pane) =>
        pane.projectID !== projectID || (requestedQuestionID && pane.questionID !== requestedQuestionID)
      );
      if (projectQuestionIDs.has(workspace.activeQuestionID) && removeQuestion(workspace.activeQuestionID)) {
        workspace.activeQuestionID = "";
        workspace.activeStage = "define";
      }
      return [workspaceID, {
        ...snapshot,
        workspace,
        paneOrder: (snapshot.paneOrder || []).filter((paneID) => !removedPaneIDs.has(paneID)),
        paneWeights: Object.fromEntries(
          Object.entries(snapshot.paneWeights || {}).filter(([paneID]) => !removedPaneIDs.has(paneID))
        )
      }];
    })
  );
  const denied = current.outbox.filter((entry) =>
    entry.projectID === projectID && (!requestedQuestionID || entry.questionID === requestedQuestionID)
  );
  const now = new Date().toISOString();
  const deniedConflicts = denied.map((mutation) => normalizeConflict({
    mutation,
    conflictCode: options.conflictCode || "CODE_QUESTION_ACCESS_REVOKED",
    lastError: options.message || "Server access was denied. The local intent was quarantined and will not replay.",
    conflictedAt: now
  }, current.accountUserID));
  const accessByProjectID = { ...current.accessByProjectID };
  if (!requestedQuestionID) delete accessByProjectID[projectID];
  return {
    ...current,
    workspaceSnapshots,
    accessByProjectID,
    outbox: current.outbox.filter((entry) => !denied.includes(entry)),
    conflicts: [
      ...current.conflicts.filter((entry) => !denied.some((mutation) => mutation.id === entry.id)),
      ...deniedConflicts
    ]
  };
}

export function acknowledgeCodeQuestionMutation(accountState, mutationIDValue) {
  const current = normalizeCodeQuestionAccountState(accountState, {
    accountUserID: accountState?.accountUserID
  });
  const id = String(mutationIDValue || "").trim();
  return {
    ...current,
    outbox: current.outbox.filter((entry) => entry.id !== id),
    conflicts: current.conflicts.filter((entry) => entry.id !== id)
  };
}

export function conflictCodeQuestionMutation(accountState, mutationIDValue, details = {}) {
  const current = normalizeCodeQuestionAccountState(accountState, {
    accountUserID: accountState?.accountUserID
  });
  const id = String(mutationIDValue || "").trim();
  const mutation = current.outbox.find((entry) => entry.id === id);
  if (!mutation) return current;
  const conflict = normalizeConflict({ mutation, ...details }, current.accountUserID);
  return {
    ...current,
    outbox: current.outbox.filter((entry) => entry.id !== id),
    conflicts: [...current.conflicts.filter((entry) => entry.id !== id), conflict]
  };
}

/** Remove every Code Question payload and pane identifier from general workspace persistence. */
export function workspaceLayoutWithoutCodeQuestionData(layout = {}) {
  const source = layout && typeof layout === "object" ? copy(layout) : {};
  delete source.codeQuestionWorkspace;
  if (Array.isArray(source.paneOrder)) {
    source.paneOrder = source.paneOrder
      .filter((paneID) => !String(paneID).startsWith("cq:"));
  }
  if (source.paneWeights && typeof source.paneWeights === "object") {
    source.paneWeights = Object.fromEntries(
      Object.entries(source.paneWeights)
        .filter(([paneID]) => !String(paneID).startsWith("cq:"))
    );
  }
  return source;
}
