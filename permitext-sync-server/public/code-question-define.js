/**
 * Code Question Define-stage helpers (Phase 3).
 * Pure functions for definition drafts, structured inputs, fact requests,
 * readiness derivation, and dependency-fingerprint staleness.
 * Does not advance shared review/approval/issue state.
 */

export const questionInputKinds = Object.freeze([
  "confirmedFact",
  "assumption",
  "unknown"
]);

export const questionInputStates = Object.freeze([
  "proposed",
  "confirmed",
  "disputed",
  "resolved",
  "retired"
]);

export const factRequestStatuses = Object.freeze([
  "open",
  "waiting",
  "resolved",
  "dismissed"
]);

const inputKindSet = new Set(questionInputKinds);
const inputStateSet = new Set(questionInputStates);
const factRequestStatusSet = new Set(factRequestStatuses);

function requiredText(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function optionalText(value, maximum = 20_000) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error("Text is too long.");
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

/** Deterministic non-crypto fingerprint for dependency change detection (browser-safe). */
export function stableFingerprint(value) {
  const json = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function emptyDefinitionRecord(questionID, options = {}) {
  const now = options.createdAt || new Date().toISOString();
  const actor = options.createdBy || "local-user";
  return {
    questionID: String(questionID || ""),
    title: options.title || "New Code Question",
    questionText: options.questionText || "",
    scope: options.scope || "",
    desiredOutput: options.desiredOutput || "",
    jurisdiction: options.jurisdiction || "",
    asOfDate: options.asOfDate || null,
    definitionRevision: 1,
    expectedVersion: 1,
    inputs: [],
    inputHistory: [],
    factRequests: [],
    lastDependencyFingerprint: "",
    dependentsStale: {
      analysis: false,
      conclusion: false,
      approval: false,
      draft: false
    },
    createdBy: actor,
    updatedBy: actor,
    createdAt: now,
    updatedAt: now,
    offlineQueue: []
  };
}

export function normalizeDefinitionRecord(value = {}, questionID = "") {
  const source = value && typeof value === "object" ? value : {};
  const base = emptyDefinitionRecord(questionID || source.questionID || "", {
    title: source.title,
    questionText: source.questionText,
    scope: source.scope,
    desiredOutput: source.desiredOutput,
    jurisdiction: source.jurisdiction,
    asOfDate: source.asOfDate,
    createdBy: source.createdBy,
    createdAt: source.createdAt
  });
  base.questionID = String(source.questionID || questionID || base.questionID);
  base.title = String(source.title || base.title).slice(0, 240);
  base.questionText = String(source.questionText || "").slice(0, 8_000);
  base.scope = String(source.scope || "").slice(0, 4_000);
  base.desiredOutput = String(source.desiredOutput || "").slice(0, 2_000);
  base.jurisdiction = String(source.jurisdiction || "").slice(0, 240);
  base.asOfDate = source.asOfDate || null;
  base.definitionRevision = Number.isSafeInteger(Number(source.definitionRevision))
    ? Math.max(1, Number(source.definitionRevision))
    : 1;
  base.expectedVersion = Number.isSafeInteger(Number(source.expectedVersion))
    ? Math.max(1, Number(source.expectedVersion))
    : 1;
  base.inputs = (Array.isArray(source.inputs) ? source.inputs : [])
    .map(normalizeQuestionInput)
    .filter(Boolean);
  base.inputHistory = (Array.isArray(source.inputHistory) ? source.inputHistory : [])
    .map(normalizeQuestionInput)
    .filter(Boolean)
    .slice(-200);
  base.factRequests = (Array.isArray(source.factRequests) ? source.factRequests : [])
    .map(normalizeFactRequest)
    .filter(Boolean);
  base.lastDependencyFingerprint = String(source.lastDependencyFingerprint || "");
  base.dependentsStale = {
    analysis: source.dependentsStale?.analysis === true,
    conclusion: source.dependentsStale?.conclusion === true,
    approval: source.dependentsStale?.approval === true,
    draft: source.dependentsStale?.draft === true
  };
  base.createdBy = String(source.createdBy || base.createdBy);
  base.updatedBy = String(source.updatedBy || base.updatedBy);
  base.createdAt = String(source.createdAt || base.createdAt);
  base.updatedAt = String(source.updatedAt || base.updatedAt);
  base.offlineQueue = (Array.isArray(source.offlineQueue) ? source.offlineQueue : [])
    .filter((item) => item && typeof item === "object")
    .slice(-50);
  if (!base.lastDependencyFingerprint) {
    base.lastDependencyFingerprint = fingerprintDefinitionFields(base);
  }
  return base;
}

export function normalizeQuestionInput(value) {
  if (!value || typeof value !== "object") return null;
  const inputKind = String(value.inputKind || value.kind || "").trim();
  if (!inputKindSet.has(inputKind)) return null;
  const state = String(value.state || "proposed").trim();
  if (!inputStateSet.has(state)) return null;
  // Assumptions must never be stored as confirmed facts.
  if (inputKind === "assumption" && state === "confirmed") return null;
  return {
    id: String(value.id || "").trim() || null,
    questionID: String(value.questionID || "").trim() || null,
    inputKind,
    statement: String(value.statement || "").trim().slice(0, 4_000),
    state,
    basis: String(value.basis || "").trim().slice(0, 2_000),
    responsibleUserID: value.responsibleUserID ? String(value.responsibleUserID) : null,
    responsibleDisplayName: String(value.responsibleDisplayName || "").slice(0, 160),
    revision: Number.isSafeInteger(Number(value.revision)) ? Math.max(1, Number(value.revision)) : 1,
    priorInputID: value.priorInputID ? String(value.priorInputID) : null,
    createdBy: String(value.createdBy || "").slice(0, 256),
    updatedBy: String(value.updatedBy || value.createdBy || "").slice(0, 256),
    createdAt: String(value.createdAt || ""),
    updatedAt: String(value.updatedAt || value.createdAt || ""),
    changeIndicator: value.changeIndicator === true
  };
}

export function normalizeFactRequest(value) {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "open").trim().toLowerCase();
  if (!factRequestStatusSet.has(status)) return null;
  return {
    id: String(value.id || "").trim() || null,
    questionID: String(value.questionID || "").trim() || null,
    inputID: value.inputID ? String(value.inputID) : null,
    title: String(value.title || "").trim().slice(0, 200),
    body: String(value.body || "").trim().slice(0, 4_000),
    status,
    requestType: "fact-request",
    createdBy: String(value.createdBy || "").slice(0, 256),
    createdByDisplayName: String(value.createdByDisplayName || "").slice(0, 160),
    createdAt: String(value.createdAt || ""),
    resolvedAt: value.resolvedAt ? String(value.resolvedAt) : null
  };
}

/**
 * Presentation labels — never confuse kinds visually.
 */
export function inputKindLabel(inputKind) {
  switch (String(inputKind || "")) {
    case "confirmedFact":
      return "Confirmed fact";
    case "assumption":
      return "Assumption";
    case "unknown":
      return "Unknown";
    default:
      return "Input";
  }
}

export function inputKindCssClass(inputKind) {
  switch (String(inputKind || "")) {
    case "confirmedFact":
      return "is-confirmed-fact";
    case "assumption":
      return "is-assumption";
    case "unknown":
      return "is-unknown";
    default:
      return "";
  }
}

export function assertInputPresentationSeparation(inputs = []) {
  for (const input of inputs) {
    if (input.inputKind === "assumption" && input.state === "confirmed") {
      throw new Error("Assumptions must never be rendered as confirmed facts.");
    }
    if (input.inputKind === "confirmedFact" && input.presentationKind === "assumption") {
      throw new Error("Confirmed facts must not be labeled as assumptions.");
    }
  }
  return true;
}

function fingerprintDefinitionFields(record) {
  const inputs = Array.isArray(record?.inputs) ? record.inputs : [];
  return stableFingerprint({
    questionText: record?.questionText || "",
    scope: record?.scope || "",
    jurisdiction: record?.jurisdiction || "",
    asOfDate: record?.asOfDate || null,
    desiredOutput: record?.desiredOutput || "",
    title: record?.title || "",
    inputs: inputs
      .filter((item) => item && item.state !== "retired")
      .map((item) => ({
        id: item.id,
        inputKind: item.inputKind,
        state: item.state,
        statement: item.statement,
        revision: item.revision
      }))
  });
}

export function computeDefinitionDependencyFingerprint(definition) {
  const record = definition && typeof definition === "object"
    ? definition
    : emptyDefinitionRecord("");
  // Avoid re-entering normalizeDefinitionRecord (which may call this helper).
  if (record.questionID != null || record.inputs || record.questionText != null) {
    return fingerprintDefinitionFields(record);
  }
  return fingerprintDefinitionFields(normalizeDefinitionRecord(definition));
}

/**
 * Apply a definition field update. Bumps definition revision when canonical fields change.
 * Marks dependents stale when dependency fingerprint changes.
 */
export function updateDefinitionFields(definition, patch = {}, options = {}) {
  const current = normalizeDefinitionRecord(definition);
  const actor = options.actorUserID || current.updatedBy || "local-user";
  const now = options.now || new Date().toISOString();
  const expectedVersion = options.expectedVersion;
  if (
    expectedVersion !== undefined &&
    expectedVersion !== null &&
    Number(expectedVersion) !== Number(current.expectedVersion)
  ) {
    const error = new Error("Definition version conflict.");
    error.code = "CODE_QUESTION_VERSION_CONFLICT";
    error.currentVersion = current.expectedVersion;
    throw error;
  }

  const next = {
    ...current,
    title: patch.title !== undefined ? String(patch.title).slice(0, 240) : current.title,
    questionText: patch.questionText !== undefined
      ? String(patch.questionText).slice(0, 8_000)
      : current.questionText,
    scope: patch.scope !== undefined ? String(patch.scope).slice(0, 4_000) : current.scope,
    desiredOutput: patch.desiredOutput !== undefined
      ? String(patch.desiredOutput).slice(0, 2_000)
      : current.desiredOutput,
    jurisdiction: patch.jurisdiction !== undefined
      ? String(patch.jurisdiction).slice(0, 240)
      : current.jurisdiction,
    asOfDate: patch.asOfDate !== undefined ? patch.asOfDate || null : current.asOfDate,
    updatedBy: actor,
    updatedAt: now
  };

  const prevFingerprint = current.lastDependencyFingerprint || fingerprintDefinitionFields(current);
  const nextFingerprint = fingerprintDefinitionFields(next);
  if (nextFingerprint !== prevFingerprint) {
    next.definitionRevision = current.definitionRevision + 1;
    next.expectedVersion = current.expectedVersion + 1;
    next.lastDependencyFingerprint = nextFingerprint;
    next.dependentsStale = {
      analysis: true,
      conclusion: true,
      approval: true,
      draft: true
    };
  } else {
    next.lastDependencyFingerprint = prevFingerprint;
  }
  return next;
}

export function createQuestionInput(definition, {
  inputKind,
  statement,
  state = null,
  basis = "",
  responsibleUserID = null,
  responsibleDisplayName = "",
  actorUserID = "local-user",
  now = new Date().toISOString(),
  id = null
} = {}) {
  if (!inputKindSet.has(String(inputKind || ""))) {
    throw new Error("Invalid question input kind.");
  }
  const defaultState = inputKind === "confirmedFact"
    ? "confirmed"
    : inputKind === "unknown"
      ? "proposed"
      : "proposed";
  const resolvedState = state || defaultState;
  if (!inputStateSet.has(resolvedState)) throw new Error("Invalid question input state.");
  if (inputKind === "assumption" && resolvedState === "confirmed") {
    throw new Error("Assumptions must never be stored as confirmed facts.");
  }
  const current = normalizeDefinitionRecord(definition);
  const input = normalizeQuestionInput({
    id: id || `qi-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    questionID: current.questionID,
    inputKind,
    statement: requiredText(statement, "input statement", 4_000),
    state: resolvedState,
    basis,
    responsibleUserID,
    responsibleDisplayName,
    revision: 1,
    createdBy: actorUserID,
    updatedBy: actorUserID,
    createdAt: now,
    updatedAt: now,
    changeIndicator: true
  });
  const next = {
    ...current,
    inputs: [...current.inputs, input],
    inputHistory: [...current.inputHistory, input],
    updatedBy: actorUserID,
    updatedAt: now
  };
  return markStaleIfFingerprintChanged(current, next);
}

/**
 * Revise an input: keep prior revision in history, bump revision, mark change.
 */
export function reviseQuestionInput(definition, inputID, patch = {}, options = {}) {
  const current = normalizeDefinitionRecord(definition);
  const actor = options.actorUserID || current.updatedBy || "local-user";
  const now = options.now || new Date().toISOString();
  const existing = current.inputs.find((item) => item.id === inputID);
  if (!existing) throw new Error("Question input not found.");
  const nextState = patch.state !== undefined ? String(patch.state) : existing.state;
  if (!inputStateSet.has(nextState)) throw new Error("Invalid question input state.");
  if (existing.inputKind === "assumption" && nextState === "confirmed") {
    throw new Error("Assumptions must never be stored as confirmed facts.");
  }
  const revised = normalizeQuestionInput({
    ...existing,
    statement: patch.statement !== undefined
      ? requiredText(patch.statement, "input statement", 4_000)
      : existing.statement,
    state: nextState,
    basis: patch.basis !== undefined ? optionalText(patch.basis, 2_000) : existing.basis,
    responsibleUserID: patch.responsibleUserID !== undefined
      ? patch.responsibleUserID
      : existing.responsibleUserID,
    responsibleDisplayName: patch.responsibleDisplayName !== undefined
      ? String(patch.responsibleDisplayName || "")
      : existing.responsibleDisplayName,
    revision: existing.revision + 1,
    priorInputID: existing.id,
    // Keep stable ID for the active line; history retains prior snapshot.
    id: existing.id,
    updatedBy: actor,
    updatedAt: now,
    changeIndicator: true
  });
  // Snapshot prior values into history under a history ID.
  const historyEntry = normalizeQuestionInput({
    ...existing,
    id: `${existing.id}:r${existing.revision}`,
    changeIndicator: false
  });
  const next = {
    ...current,
    inputs: current.inputs.map((item) => (item.id === inputID ? revised : item)),
    inputHistory: [...current.inputHistory, historyEntry, revised],
    updatedBy: actor,
    updatedAt: now
  };
  return markStaleIfFingerprintChanged(current, next);
}

function markStaleIfFingerprintChanged(previous, next) {
  const prevFp = previous.lastDependencyFingerprint || fingerprintDefinitionFields(previous);
  const nextFp = fingerprintDefinitionFields(next);
  if (nextFp === prevFp) {
    return {
      ...next,
      lastDependencyFingerprint: prevFp
    };
  }
  return {
    ...next,
    definitionRevision: previous.definitionRevision + 1,
    expectedVersion: previous.expectedVersion + 1,
    lastDependencyFingerprint: nextFp,
    dependentsStale: {
      analysis: true,
      conclusion: true,
      approval: true,
      draft: true
    }
  };
}

export function openFactRequest(definition, {
  inputID = null,
  title,
  body = "",
  actorUserID = "local-user",
  actorDisplayName = "",
  now = new Date().toISOString(),
  id = null
} = {}) {
  const current = normalizeDefinitionRecord(definition);
  if (inputID && !current.inputs.some((item) => item.id === inputID)) {
    throw new Error("Fact Request must anchor to an existing input or be unanchored.");
  }
  const request = normalizeFactRequest({
    id: id || `fr-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`,
    questionID: current.questionID,
    inputID,
    title: requiredText(title, "fact request title", 200),
    body,
    status: "open",
    createdBy: actorUserID,
    createdByDisplayName: actorDisplayName,
    createdAt: now
  });
  // Fact requests do not by themselves change dependency hash (not model context).
  return {
    ...current,
    factRequests: [...current.factRequests, request],
    updatedBy: actorUserID,
    updatedAt: now
  };
}

export function resolveFactRequest(definition, requestID, options = {}) {
  const current = normalizeDefinitionRecord(definition);
  const actor = options.actorUserID || current.updatedBy;
  const now = options.now || new Date().toISOString();
  return {
    ...current,
    factRequests: current.factRequests.map((item) =>
      item.id === requestID
        ? { ...item, status: "resolved", resolvedAt: now }
        : item
    ),
    updatedBy: actor,
    updatedAt: now
  };
}

/**
 * Readiness for Define stage gates. Does not mutate shared review/approval/issue state.
 * Unresolved unknowns are blockers for approval/issuance policy by default.
 */
export function deriveDefineReadiness(definition, options = {}) {
  const record = normalizeDefinitionRecord(definition);
  const blockers = [];
  const disclosedLimitations = [];
  const acceptedConditions = [];
  const role = String(options.role || "editor").toLowerCase();

  if (!String(record.questionText || "").trim()) {
    blockers.push({
      code: "missing-question-text",
      message: "Precise question text is required.",
      classification: "blocker"
    });
  }
  if (!String(record.title || "").trim()) {
    blockers.push({
      code: "missing-title",
      message: "A concise title is required.",
      classification: "blocker"
    });
  }

  const activeInputs = record.inputs.filter((item) => item.state !== "retired");
  const unknowns = activeInputs.filter((item) =>
    item.inputKind === "unknown" && item.state !== "resolved"
  );
  const assumptions = activeInputs.filter((item) => item.inputKind === "assumption");
  const facts = activeInputs.filter((item) =>
    item.inputKind === "confirmedFact" && item.state === "confirmed"
  );

  for (const unknown of unknowns) {
    blockers.push({
      code: "unresolved-unknown",
      message: `Unresolved unknown: ${unknown.statement}`,
      inputID: unknown.id,
      classification: "blocker"
    });
  }

  for (const assumption of assumptions) {
    acceptedConditions.push({
      code: "assumption",
      message: assumption.statement,
      inputID: assumption.id,
      classification: "accepted-condition"
    });
  }

  const openFactRequests = record.factRequests.filter((item) =>
    item.status === "open" || item.status === "waiting"
  );
  if (openFactRequests.length) {
    disclosedLimitations.push({
      code: "open-fact-requests",
      message: `${openFactRequests.length} open Fact Request(s).`,
      classification: "disclosed-limitation"
    });
  }

  if (record.dependentsStale?.analysis || record.dependentsStale?.conclusion) {
    disclosedLimitations.push({
      code: "stale-dependents",
      message: "Downstream analysis or conclusion may be stale after definition changes.",
      classification: "disclosed-limitation"
    });
  }

  return {
    canEdit: role === "owner" || role === "editor",
    readOnly: role === "viewer" || role === "reviewer",
    canApprove: blockers.length === 0,
    canIssue: blockers.length === 0,
    blockers,
    disclosedLimitations,
    acceptedConditions,
    summary: {
      confirmedFactCount: facts.length,
      assumptionCount: assumptions.length,
      unknownCount: unknowns.length,
      openFactRequestCount: openFactRequests.length,
      definitionRevision: record.definitionRevision,
      dependencyFingerprint: record.lastDependencyFingerprint,
      dependentsStale: { ...record.dependentsStale }
    }
  };
}

/**
 * Queue a mutation for offline replay. Transport only — not a second domain store.
 */
export function enqueueDefinitionOfflineMutation(definition, mutation) {
  const current = normalizeDefinitionRecord(definition);
  const entry = {
    id: `oq-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`,
    commandKind: String(mutation?.commandKind || "codeQuestion.input.save"),
    payload: mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {},
    expectedVersion: current.expectedVersion,
    createdAt: mutation?.createdAt || new Date().toISOString(),
    status: "queued"
  };
  return {
    ...current,
    offlineQueue: [...current.offlineQueue, entry].slice(-50)
  };
}

/**
 * Replay queued mutations with expectedVersion conflict detection.
 * Returns { definition, results } without silent data loss.
 */
export function replayDefinitionOfflineQueue(definition, options = {}) {
  let current = normalizeDefinitionRecord(definition);
  const results = [];
  const queue = [...current.offlineQueue];
  current = { ...current, offlineQueue: [] };
  for (const entry of queue) {
    try {
      if (
        options.serverVersion != null &&
        Number(options.serverVersion) !== Number(entry.expectedVersion) &&
        options.strictConflict === true
      ) {
        const error = new Error("Offline queue version conflict.");
        error.code = "CODE_QUESTION_VERSION_CONFLICT";
        throw error;
      }
      if (entry.commandKind === "codeQuestion.definition.update") {
        current = updateDefinitionFields(current, entry.payload || {}, {
          expectedVersion: entry.expectedVersion,
          actorUserID: entry.payload?.actorUserID
        });
      } else if (entry.commandKind === "codeQuestion.input.save") {
        current = createQuestionInput(current, entry.payload || {});
      } else if (entry.commandKind === "codeQuestion.input.revise") {
        current = reviseQuestionInput(
          current,
          entry.payload?.inputID,
          entry.payload || {},
          { actorUserID: entry.payload?.actorUserID }
        );
      }
      results.push({ id: entry.id, status: "applied" });
    } catch (error) {
      results.push({
        id: entry.id,
        status: "conflict",
        code: error.code || "CODE_QUESTION_ERROR",
        message: error.message
      });
      // Preserve failed intent for recovery.
      current = {
        ...current,
        offlineQueue: [...current.offlineQueue, { ...entry, status: "conflict", lastError: error.message }]
      };
    }
  }
  return { definition: current, results };
}

export function groupInputsByKind(inputs = []) {
  const active = (Array.isArray(inputs) ? inputs : []).filter((item) => item.state !== "retired");
  return {
    confirmedFacts: active.filter((item) => item.inputKind === "confirmedFact"),
    assumptions: active.filter((item) => item.inputKind === "assumption"),
    unknowns: active.filter((item) => item.inputKind === "unknown")
  };
}

export function inputRevisionHistory(definition, inputID) {
  const record = normalizeDefinitionRecord(definition);
  return record.inputHistory.filter((item) =>
    item.id === inputID ||
    item.id?.startsWith(`${inputID}:r`) ||
    item.priorInputID === inputID
  ).sort((a, b) => a.revision - b.revision);
}
