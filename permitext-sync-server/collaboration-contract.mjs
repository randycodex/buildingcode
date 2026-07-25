export const collaborationSchemaVersion = 1;

export const projectReviewKinds = Object.freeze([
  "general-review",
  "revision-request",
  "missing-project-fact"
]);

export const projectReviewStatuses = Object.freeze([
  "open",
  "resolved",
  "dismissed"
]);

export const projectReviewTargetKinds = Object.freeze([
  "project",
  "researchAnswer",
  "evidenceReview",
  "reportDraft",
  "notebookCard"
]);

const reviewKindSet = new Set(projectReviewKinds);
const reviewStatusSet = new Set(projectReviewStatuses);
const reviewTargetKindSet = new Set(projectReviewTargetKinds);

function requiredText(value, field, maximum = 512) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${field}.`);
  }
  return normalized;
}

function optionalText(value, maximum = 512) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error(`Invalid text; maximum is ${maximum} characters.`);
  return normalized;
}

function optionalISO(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field}.`);
  return new Date(parsed).toISOString();
}

function requiredISO(value, field) {
  const normalized = optionalISO(value, field);
  if (!normalized) throw new Error(`Invalid ${field}.`);
  return normalized;
}

export function normalizeProjectNotePayload({
  projectID,
  title,
  body,
  createdByUserID,
  updatedByUserID = createdByUserID,
  createdByDisplayName = "",
  updatedByDisplayName = createdByDisplayName
}) {
  return {
    schemaVersion: collaborationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    title: requiredText(title, "Project note title", 160),
    body: optionalText(body, 20_000),
    createdByUserID: requiredText(createdByUserID, "Project note creator", 256),
    updatedByUserID: requiredText(updatedByUserID, "Project note updater", 256),
    createdByDisplayName: optionalText(createdByDisplayName, 160),
    updatedByDisplayName: optionalText(updatedByDisplayName, 160)
  };
}

export function normalizeReviewThreadPayload({
  projectID,
  kind = "general-review",
  status = "open",
  targetKind = "project",
  targetID = projectID,
  title,
  body,
  createdByUserID,
  updatedByUserID = createdByUserID,
  createdByDisplayName = "",
  updatedByDisplayName = createdByDisplayName,
  resolvedByUserID = null,
  resolvedByDisplayName = "",
  resolvedAt = null
}) {
  const normalizedKind = requiredText(kind, "review kind", 64).toLowerCase();
  if (!reviewKindSet.has(normalizedKind)) throw new Error("Invalid review kind.");
  const normalizedStatus = requiredText(status, "review status", 32).toLowerCase();
  if (!reviewStatusSet.has(normalizedStatus)) throw new Error("Invalid review status.");
  const normalizedTargetKind = requiredText(targetKind, "review target kind", 64);
  if (!reviewTargetKindSet.has(normalizedTargetKind)) {
    throw new Error("Invalid review target kind.");
  }
  const isClosed = normalizedStatus !== "open";
  return {
    schemaVersion: collaborationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    kind: normalizedKind,
    status: normalizedStatus,
    targetKind: normalizedTargetKind,
    targetID: requiredText(targetID, "review target ID", 256),
    title: requiredText(title, "review title", 200),
    body: optionalText(body, 20_000),
    createdByUserID: requiredText(createdByUserID, "review creator", 256),
    updatedByUserID: requiredText(updatedByUserID, "review updater", 256),
    createdByDisplayName: optionalText(createdByDisplayName, 160),
    updatedByDisplayName: optionalText(updatedByDisplayName, 160),
    resolvedByUserID: isClosed
      ? requiredText(resolvedByUserID, "review resolver", 256)
      : null,
    resolvedByDisplayName: isClosed
      ? optionalText(resolvedByDisplayName, 160)
      : "",
    resolvedAt: isClosed
      ? requiredISO(resolvedAt, "review resolution date")
      : null
  };
}

export function normalizeReviewCommentPayload({
  projectID,
  threadID,
  body,
  createdByUserID,
  createdByDisplayName = "",
  createdAt = new Date().toISOString()
}) {
  return {
    schemaVersion: collaborationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    threadID: requiredText(threadID, "review thread ID", 256),
    body: requiredText(body, "review comment", 10_000),
    createdByUserID: requiredText(createdByUserID, "review comment creator", 256),
    createdByDisplayName: optionalText(createdByDisplayName, 160),
    createdAt: requiredISO(createdAt, "review comment date")
  };
}
