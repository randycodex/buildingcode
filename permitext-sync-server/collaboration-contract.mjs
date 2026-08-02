import {
  notebookPlainText,
  renderNotebookDocumentHTML,
  validateNotebookDocument
} from "./notebook-contract.mjs";

export const collaborationSchemaVersion = 2;

export const projectReviewKinds = Object.freeze([
  "general-review",
  "revision-request",
  "missing-project-fact"
]);

export const projectReviewStatuses = Object.freeze([
  "open",
  "waiting",
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

function nullableIdentifier(value, field) {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, field, 256);
}

function normalizedLinkedItemSnapshot(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid linked item snapshot.");
  }
  const label = optionalText(value.label, 240);
  const description = optionalText(value.description, 2_000);
  const updatedAt = optionalISO(value.updatedAt, "linked item snapshot date");
  if (!label && !description && !updatedAt) return null;
  return {
    label,
    description,
    updatedAt
  };
}

export function latestReviewThreadUpdatedAt(threadUpdatedAt, comments = []) {
  const baseline = requiredISO(threadUpdatedAt, "review thread update date");
  return (Array.isArray(comments) ? comments : [])
    .map((comment) => optionalISO(comment?.createdAt ?? comment, "review comment date"))
    .filter(Boolean)
    .reduce((latest, candidate) => candidate > latest ? candidate : latest, baseline);
}

export function normalizeProjectNotePayload({
  projectID,
  title = "Project information",
  body,
  document,
  createdByUserID,
  updatedByUserID = createdByUserID,
  createdByDisplayName = "",
  updatedByDisplayName = createdByDisplayName
}) {
  let normalizedBody = optionalText(body, 20_000);
  let structuredDocument = null;
  let renderedHTML = "";
  let imageAssets = [];
  if (document !== undefined) {
    const validated = validateNotebookDocument(document);
    structuredDocument = validated.document;
    imageAssets = validated.imageAssets;
    normalizedBody = optionalText(notebookPlainText(structuredDocument), 20_000);
    renderedHTML = renderNotebookDocumentHTML(structuredDocument);
  }
  return {
    schemaVersion: collaborationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    title: requiredText(title, "Project note title", 160),
    body: normalizedBody,
    ...(structuredDocument ? { document: structuredDocument, renderedHTML, imageAssets } : {}),
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
  linkedItemSnapshot = null,
  title,
  body,
  createdByUserID,
  updatedByUserID = createdByUserID,
  createdByDisplayName = "",
  updatedByDisplayName = createdByDisplayName,
  assigneeUserID = null,
  resolvedByUserID = null,
  resolvedByDisplayName = "",
  resolvedAt = null,
  resolution = null,
  allowLegacyResolvedWithoutResolution = false
}) {
  const normalizedKind = requiredText(kind, "review kind", 64).toLowerCase();
  if (!reviewKindSet.has(normalizedKind)) throw new Error("Invalid review kind.");
  const normalizedStatus = requiredText(status, "review status", 32).toLowerCase();
  if (!reviewStatusSet.has(normalizedStatus)) throw new Error("Invalid review status.");
  const normalizedTargetKind = requiredText(targetKind, "review target kind", 64);
  if (!reviewTargetKindSet.has(normalizedTargetKind)) {
    throw new Error("Invalid review target kind.");
  }
  const isClosed = normalizedStatus === "resolved" || normalizedStatus === "dismissed";
  const normalizedResolution = optionalText(resolution, 2_000);
  if (
    normalizedStatus === "resolved" &&
    !normalizedResolution &&
    allowLegacyResolvedWithoutResolution !== true
  ) {
    throw new Error("A resolution statement is required to resolve a coordination thread.");
  }
  return {
    schemaVersion: collaborationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    kind: normalizedKind,
    status: normalizedStatus,
    targetKind: normalizedTargetKind,
    targetID: requiredText(targetID, "review target ID", 256),
    linkedItemSnapshot: normalizedLinkedItemSnapshot(linkedItemSnapshot),
    title: requiredText(title, "review title", 200),
    body: optionalText(body, 20_000),
    createdByUserID: requiredText(createdByUserID, "review creator", 256),
    updatedByUserID: requiredText(updatedByUserID, "review updater", 256),
    createdByDisplayName: optionalText(createdByDisplayName, 160),
    updatedByDisplayName: optionalText(updatedByDisplayName, 160),
    assigneeUserID: nullableIdentifier(assigneeUserID, "review assignee"),
    resolvedByUserID: isClosed
      ? requiredText(resolvedByUserID, "review resolver", 256)
      : null,
    resolvedByDisplayName: isClosed
      ? optionalText(resolvedByDisplayName, 160)
      : "",
    resolvedAt: isClosed
      ? requiredISO(resolvedAt, "review resolution date")
      : null,
    resolution: normalizedStatus === "resolved" ? normalizedResolution || null : null
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
