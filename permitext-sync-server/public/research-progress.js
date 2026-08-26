export const researchProgressVersion = "20260826-research-request-recovery-v121";

export const researchRequestRecoveryStorageKey = "permitext:research-request-recovery:v1";
export const researchRequestRecoveryMaxAgeMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const researchRequestRecoveryMaximumRecords = 20;

export const researchProgressStages = Object.freeze([
  Object.freeze({ id: "preparing_question", label: "Preparing the question" }),
  Object.freeze({ id: "searching_authorized_library", label: "Searching the authorized enacted library" }),
  Object.freeze({ id: "reviewing_provisions", label: "Reviewing potentially applicable provisions" }),
  Object.freeze({ id: "following_cross_references", label: "Following cross-references" }),
  Object.freeze({ id: "checking_citation_support", label: "Checking citation support" }),
  Object.freeze({ id: "preparing_conclusion", label: "Preparing the conclusion" })
]);

export const researchProgressStates = Object.freeze([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
  "retrying"
]);

const stageByID = new Map(researchProgressStages.map((stage, index) => [stage.id, { ...stage, index }]));
const allowedStates = new Set(researchProgressStates);
const recoverableRequestStates = new Set(["active", "retrying", "failed", "cancelled"]);

export function researchProgressStage(stageID) {
  return stageByID.get(String(stageID || "")) || null;
}

export function createResearchProgressEvent({ stageID, state, sequence, at = new Date().toISOString() }) {
  const stage = researchProgressStage(stageID);
  if (!stage) throw new Error("Unsupported public Research progress stage.");
  if (!allowedStates.has(state) || state === "pending") {
    throw new Error("Unsupported emitted Research progress state.");
  }
  const normalizedSequence = Number(sequence);
  if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
    throw new Error("Research progress sequence must be a positive integer.");
  }
  return Object.freeze({
    version: researchProgressVersion,
    stage: stage.id,
    label: stage.label,
    state,
    sequence: normalizedSequence,
    at: new Date(at).toISOString()
  });
}

export function researchProgressSummary(events, { startedAt, completedAt } = {}) {
  const latestByStage = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const stage = researchProgressStage(event?.stage);
    if (!stage || !allowedStates.has(event?.state)) continue;
    latestByStage.set(stage.id, event.state);
  }
  return {
    version: researchProgressVersion,
    status: researchProgressStages.every((stage) => latestByStage.get(stage.id) === "completed")
      ? "completed"
      : "incomplete",
    startedAt: new Date(startedAt || events?.[0]?.at || Date.now()).toISOString(),
    completedAt: completedAt ? new Date(completedAt).toISOString() : null,
    stages: researchProgressStages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      state: latestByStage.get(stage.id) || "pending"
    }))
  };
}

function normalizedResearchRequestRecovery(value) {
  if (!value || typeof value !== "object") return null;
  const accountUserID = String(value.accountUserID || "").trim();
  const workspaceID = String(value.workspaceID || "").trim();
  const conversationID = String(value.conversationID || "").trim();
  const requestID = String(value.requestID || "").trim();
  const question = String(value.question || "").replace(/\s+/g, " ").trim().slice(0, 2_000);
  const status = String(value.status || "").trim().toLowerCase();
  const startedAt = Number(value.startedAt);
  const endedAt = value.endedAt == null ? null : Number(value.endedAt);
  const updatedAt = Number(value.updatedAt);
  if (
    !accountUserID || !workspaceID || !conversationID || !requestID || question.length < 3 ||
    !recoverableRequestStates.has(status) || !Number.isFinite(startedAt) || !Number.isFinite(updatedAt)
  ) return null;
  const stages = researchProgressStages.map((stage) => {
    const saved = Array.isArray(value.stages)
      ? value.stages.find((candidate) => candidate?.id === stage.id)?.state
      : null;
    return {
      id: stage.id,
      state: allowedStates.has(saved) ? saved : "pending"
    };
  });
  return {
    accountUserID,
    workspaceID,
    conversationID,
    requestID,
    question,
    status,
    startedAt,
    endedAt: endedAt == null ? null : (Number.isFinite(endedAt) ? endedAt : null),
    updatedAt,
    error: String(value.error || "").trim().slice(0, 1_000),
    errorCode: String(value.errorCode || "").trim().slice(0, 160),
    stages
  };
}

function researchRequestRecoveries(storage, now = Date.now()) {
  if (!storage || typeof storage.getItem !== "function") return [];
  try {
    const decoded = JSON.parse(storage.getItem(researchRequestRecoveryStorageKey) || "[]");
    if (!Array.isArray(decoded)) return [];
    return decoded
      .map(normalizedResearchRequestRecovery)
      .filter((record) => record && now - record.updatedAt <= researchRequestRecoveryMaxAgeMilliseconds)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, researchRequestRecoveryMaximumRecords);
  } catch {
    return [];
  }
}

function saveResearchRequestRecoveries(storage, records) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(researchRequestRecoveryStorageKey, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function researchRequestRecoveryMatches(record, scope = {}) {
  const accountUserID = String(scope.accountUserID || "").trim();
  const workspaceID = String(scope.workspaceID || "").trim();
  const conversationID = String(scope.conversationID || "").trim();
  const requestID = String(scope.requestID || "").trim();
  return (!accountUserID || record.accountUserID === accountUserID) &&
    (!workspaceID || record.workspaceID === workspaceID) &&
    (!conversationID || record.conversationID === conversationID) &&
    (!requestID || record.requestID === requestID);
}

export function writeResearchRequestRecovery(storage, value, now = Date.now()) {
  const normalized = normalizedResearchRequestRecovery({ ...value, updatedAt: now });
  if (!normalized) return false;
  const records = researchRequestRecoveries(storage, now)
    .filter((record) => !researchRequestRecoveryMatches(record, normalized));
  records.unshift(normalized);
  return saveResearchRequestRecoveries(storage, records.slice(0, researchRequestRecoveryMaximumRecords));
}

export function readResearchRequestRecovery(storage, scope, now = Date.now()) {
  const records = researchRequestRecoveries(storage, now);
  // Reading also prunes expired or malformed data so private failed questions
  // cannot accumulate indefinitely on a shared browser.
  saveResearchRequestRecoveries(storage, records);
  return records.find((record) => researchRequestRecoveryMatches(record, scope)) || null;
}

export function removeResearchRequestRecovery(storage, scope, now = Date.now()) {
  const records = researchRequestRecoveries(storage, now);
  const retained = records.filter((record) => !researchRequestRecoveryMatches(record, scope));
  return saveResearchRequestRecoveries(storage, retained);
}

export function clearResearchRequestRecoveries(storage, { accountUserID } = {}, now = Date.now()) {
  const normalizedAccountID = String(accountUserID || "").trim();
  const records = researchRequestRecoveries(storage, now);
  const retained = normalizedAccountID
    ? records.filter((record) => record.accountUserID !== normalizedAccountID)
    : [];
  return saveResearchRequestRecoveries(storage, retained);
}
