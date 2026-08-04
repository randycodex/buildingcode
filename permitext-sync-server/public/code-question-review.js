/** Code Question Review workspace contract (Phase 6). */

export const codeQuestionReviewRequestTypes = Object.freeze([
  "fact-request", "evidence-review", "interpretation-review", "revision-request"
]);
export const codeQuestionReviewStatuses = Object.freeze(["open", "waiting", "resolved", "dismissed"]);
export const codeQuestionReviewTargetKinds = Object.freeze([
  "codeQuestion", "questionInput", "questionEvidenceSet", "questionAnalysis",
  "professionalConclusion", "codeMemoDraft"
]);

const requestTypeSet = new Set(codeQuestionReviewRequestTypes);
const statusSet = new Set(codeQuestionReviewStatuses);
const targetKindSet = new Set(codeQuestionReviewTargetKinds);
const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
function requiredText(value, label, maximum = 512) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) throw new Error(`Invalid ${label}.`);
  return normalized;
}
function actor(value = {}) {
  return {
    userID: requiredText(value.userID || "local-user", "review actor", 256),
    displayName: String(value.displayName || value.userID || "Permitext professional").trim()
  };
}

export function reviewRequestTypeToLegacyKind(requestType) {
  switch (requestType) {
    case "fact-request": return "missing-project-fact";
    case "revision-request": return "revision-request";
    case "evidence-review":
    case "interpretation-review": return "general-review";
    default: throw new Error("Invalid Review Request type.");
  }
}
export function legacyKindToReviewRequestType(kind) {
  switch (String(kind || "").trim()) {
    case "missing-project-fact": return "fact-request";
    case "revision-request": return "revision-request";
    case "general-review": return "interpretation-review";
    default: return null;
  }
}

export function emptyReviewWorkspace(questionID = "") {
  return { schemaVersion: 1, questionID: String(questionID || ""), requests: [], comments: [], history: [], approvals: [], activeFilter: "open", updatedAt: null };
}
export function normalizeReviewWorkspace(value, questionID = "") {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...emptyReviewWorkspace(questionID || source.questionID), ...copy(source),
    questionID: String(questionID || source.questionID || ""),
    requests: Array.isArray(source.requests) ? copy(source.requests) : [],
    comments: Array.isArray(source.comments) ? copy(source.comments) : [],
    history: Array.isArray(source.history) ? copy(source.history) : [],
    approvals: Array.isArray(source.approvals) ? copy(source.approvals) : [],
    activeFilter: statusSet.has(source.activeFilter) ? source.activeFilter : "open"
  };
}
function historyEvent({ id, requestID = null, action, from = null, to = null, by, at, metadata = {} }) {
  return { id, requestID, action: requiredText(action, "review history action", 128), from, to, actor: actor(by), at: new Date(at || Date.now()).toISOString(), metadata: copy(metadata) };
}

export function createReviewRequest(workspace, options = {}) {
  const current = normalizeReviewWorkspace(workspace, options.questionID);
  const requestType = requiredText(options.requestType, "Review Request type", 64);
  const targetKind = requiredText(options.targetKind, "review target kind", 64);
  if (!requestTypeSet.has(requestType)) throw new Error("Invalid Review Request type.");
  if (!targetKindSet.has(targetKind)) throw new Error("Invalid Review Request target.");
  const createdAt = new Date(options.createdAt || Date.now()).toISOString();
  const id = options.id || `review-${current.questionID}-${Date.now()}`;
  const request = {
    id, version: 1, questionID: requiredText(current.questionID, "question ID", 256),
    kind: reviewRequestTypeToLegacyKind(requestType), requestType, status: "open", reviewRound: 1,
    blocking: options.blocking !== false, targetKind,
    targetID: requiredText(options.targetID, "review target ID", 256),
    targetLabel: requiredText(options.targetLabel || targetKind, "review target label", 240),
    targetAnchor: options.targetAnchor && typeof options.targetAnchor === "object" ? copy(options.targetAnchor) : null,
    title: requiredText(options.title, "review title", 200), body: String(options.body || "").trim(),
    assigneeUserID: String(options.assigneeUserID || "").trim() || null,
    createdBy: actor(options.actor), updatedBy: actor(options.actor), createdAt, updatedAt: createdAt,
    resolution: null, resolvedAt: null
  };
  const event = historyEvent({ id: `${id}:event:1`, requestID: id, action: "review-thread.created", to: "open", by: options.actor, at: createdAt, metadata: { requestType, targetKind, targetID: request.targetID, reviewRound: 1 } });
  return { request, workspace: { ...current, requests: [...current.requests, request], history: [...current.history, event], updatedAt: createdAt } };
}

export function appendReviewComment(workspace, requestID, options = {}) {
  const current = normalizeReviewWorkspace(workspace);
  const request = current.requests.find((item) => item.id === requestID);
  if (!request) throw new Error("Review Request not found.");
  if (["resolved", "dismissed"].includes(request.status)) throw new Error("Closed Review Requests cannot receive comments.");
  const createdAt = new Date(options.createdAt || Date.now()).toISOString();
  const comment = Object.freeze({ id: options.id || `${requestID}:comment:${current.comments.length + 1}`, immutable: true, requestID, body: requiredText(options.body, "review comment", 10_000), createdBy: actor(options.actor), createdAt });
  const event = historyEvent({ id: `${comment.id}:event`, requestID, action: "review-comment.created", from: request.status, to: request.status, by: options.actor, at: createdAt });
  return { comment, workspace: { ...current, comments: [...current.comments, copy(comment)], history: [...current.history, event], updatedAt: createdAt } };
}

export function transitionReviewRequest(workspace, requestID, nextStatus, options = {}) {
  const current = normalizeReviewWorkspace(workspace);
  if (!statusSet.has(nextStatus)) throw new Error("Invalid Review Request status.");
  const existing = current.requests.find((item) => item.id === requestID);
  if (!existing) throw new Error("Review Request not found.");
  const allowed = { open: new Set(["waiting", "resolved", "dismissed"]), waiting: new Set(["open", "resolved", "dismissed"]), resolved: new Set(["open"]), dismissed: new Set(["open"]) };
  if (!allowed[existing.status]?.has(nextStatus)) throw new Error("Invalid Review Request transition.");
  const closed = ["resolved", "dismissed"].includes(nextStatus);
  const reopened = ["resolved", "dismissed"].includes(existing.status) && nextStatus === "open";
  const resolution = String(options.resolution || "").trim();
  if (nextStatus === "resolved" && !resolution) throw new Error("A resolution statement is required.");
  const updatedAt = new Date(options.updatedAt || Date.now()).toISOString();
  const next = { ...existing, version: Number(existing.version || 1) + 1, status: nextStatus, reviewRound: reopened ? Number(existing.reviewRound || 1) + 1 : Number(existing.reviewRound || 1), updatedBy: actor(options.actor), updatedAt, resolution: nextStatus === "resolved" ? resolution : null, resolvedAt: closed ? updatedAt : null };
  const action = reopened ? "code-question.review.reopened" : closed ? "code-question.review.resolved" : "review-thread.status.changed";
  const event = historyEvent({ id: `${requestID}:event:${next.version}`, requestID, action, from: existing.status, to: nextStatus, by: options.actor, at: updatedAt, metadata: { reviewRound: next.reviewRound, resolution: next.resolution } });
  return { request: next, workspace: { ...current, requests: current.requests.map((item) => item.id === requestID ? next : item), history: [...current.history, event], updatedAt } };
}

export function unresolvedBlockingRequests(workspace) {
  return normalizeReviewWorkspace(workspace).requests.filter((request) => request.blocking !== false && ["open", "waiting"].includes(request.status));
}
export function approveProfessionalConclusion(workspace, conclusion, options = {}) {
  const current = normalizeReviewWorkspace(workspace, conclusion?.questionID);
  if (!conclusion?.id || !conclusion?.immutable) throw new Error("Publish a professional conclusion revision before approval.");
  if (unresolvedBlockingRequests(current).length) throw new Error("Resolve all blocking Review Requests before approval.");
  const approvedAt = new Date(options.approvedAt || Date.now()).toISOString();
  const round = current.approvals.length + 1;
  const approval = { id: options.id || `approval-${current.questionID}-r${round}`, immutable: true, kind: "conclusionApproval", questionID: current.questionID, conclusionID: conclusion.id, conclusionRevision: conclusion.revision, dependencyHash: conclusion.analysisDependencyHash || conclusion.evidenceSetHash, reviewRound: round, basis: requiredText(options.basis, "approval basis", 4_000), approvedBy: actor(options.actor), approvedAt };
  const event = historyEvent({ id: `${approval.id}:event`, action: "code-question.conclusion.approved", to: "approved", by: options.actor, at: approvedAt, metadata: { conclusionID: conclusion.id, conclusionRevision: conclusion.revision, reviewRound: round } });
  return { approval, workspace: { ...current, approvals: [...current.approvals, approval], history: [...current.history, event], updatedAt: approvedAt } };
}
export function adaptLegacyReviewThread(thread, questionID) {
  if (!thread || typeof thread !== "object") return null;
  const requestType = thread.requestType || legacyKindToReviewRequestType(thread.kind);
  if (!requestType) return null;
  return { ...copy(thread), questionID: thread.questionID || questionID || null, requestType, reviewRound: Number.isSafeInteger(Number(thread.reviewRound)) ? Number(thread.reviewRound) : 1, blocking: thread.blocking === true, targetAnchor: thread.targetAnchor || null };
}
