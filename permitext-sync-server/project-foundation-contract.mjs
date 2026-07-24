import { createHash, randomUUID } from "node:crypto";
import { freePlanLimits, hasActiveProEntitlement } from "./entitlement-contract.mjs";

export const projectFoundationSchemaVersion = 1;
export const syncSchemaVersion = 2;
export const defaultResearchMonthlyLimit = 100;

export const capabilityIDs = Object.freeze({
  savedWork: "saved-work",
  notes: "notes",
  projects: "projects",
  notebook: "notebook",
  professionalExports: "professional-exports",
  offlineAccess: "offline-access",
  research: "research",
  evidenceDiscovery: "evidence-discovery",
  collaboration: "collaboration",
  organizationAdministration: "organization-administration"
});

export const artifactTypes = Object.freeze([
  "note",
  "notebookCard",
  "reportDraft",
  "attachment",
  "workboardPreview",
  "reportManifest",
  "generatedReport"
]);

export const projectTargetKinds = Object.freeze([
  "canonicalSection",
  "selectedPassage",
  "savedItem",
  "note",
  "notebookCard",
  "researchConversation",
  "researchAnswer",
  "approvedEvidence",
  "workboard",
  "attachment",
  "reportDraft",
  "reportManifest",
  "generatedReport"
]);

export const projectMembershipRules = Object.freeze({
  canonicalSection: { maximumProjects: null, requiresExplicitLink: true },
  selectedPassage: { maximumProjects: null, requiresExplicitLink: true },
  savedItem: { maximumProjects: null, requiresExplicitLink: true },
  note: { maximumProjects: null, requiresExplicitLink: true },
  notebookCard: { maximumProjects: null, requiresExplicitLink: true },
  researchConversation: { maximumProjects: 1, relationship: "primary" },
  researchAnswer: { maximumProjects: 1, relationship: "primary" },
  approvedEvidence: { maximumProjects: null, requiresExplicitLink: true },
  workboard: { maximumProjects: 1, relationship: "owner" },
  attachment: { maximumProjects: 1, relationship: "owner" },
  reportDraft: { maximumProjects: 1, relationship: "owner" },
  reportManifest: { maximumProjects: 1, relationship: "owner" },
  generatedReport: { maximumProjects: 1, relationship: "owner" }
});

export const conflictPolicies = Object.freeze({
  savedItem: "latest-valid-record",
  note: "explicit-revision",
  notebookCard: "explicit-revision",
  researchConversation: "server-ordered-append",
  researchAnswer: "immutable",
  approvedEvidence: "immutable",
  workboard: "whole-record-revision",
  attachment: "immutable-binary-metadata-revision",
  reportDraft: "explicit-revision",
  reportManifest: "immutable",
  generatedReport: "immutable",
  activityEvent: "append-only",
  projectLink: "latest-explicit-link-state"
});

export const activityActions = Object.freeze([
  "item.linked",
  "item.unlinked",
  "note.created",
  "note.revision.saved",
  "notebook-card.created",
  "notebook-card.revision.saved",
  "evidence.approved",
  "evidence.removed",
  "research.question.submitted",
  "research.answer.generated",
  "research.project-context.reviewed",
  "review-status.changed",
  "report.generated",
  "project.archived",
  "project.restored",
  "member.invited",
  "permission.changed"
]);

const artifactTypeSet = new Set(artifactTypes);
const targetKindSet = new Set(projectTargetKinds);
const activityActionSet = new Set(activityActions);

function requiredText(value, field, maximum = 512) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${field}.`);
  }
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

function boundedVersion(value, field = "version") {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error(`Invalid ${field}.`);
  }
  return normalized;
}

export function ownerScope(userID) {
  return {
    kind: "user",
    id: requiredText(userID, "owner user ID", 256),
    organizationID: null
  };
}

export function artifactEnvelope({
  id = randomUUID(),
  type,
  owner,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  version = 1,
  archivedAt = null,
  deletedAt = null
}) {
  const normalizedType = requiredText(type, "artifact type", 64);
  if (!artifactTypeSet.has(normalizedType)) throw new Error("Unsupported artifact type.");
  if (!owner || owner.kind !== "user" || !owner.id) throw new Error("Invalid owner scope.");
  return {
    id: requiredText(id, "artifact ID", 256),
    type: normalizedType,
    createdAt: requiredISO(createdAt, "created date"),
    updatedAt: requiredISO(updatedAt, "updated date"),
    owner: ownerScope(owner.id),
    version: boundedVersion(version),
    archivedAt: optionalISO(archivedAt, "archive date"),
    deletedAt: optionalISO(deletedAt, "deletion date")
  };
}

export function projectLinkRecord({
  id = randomUUID(),
  owner,
  projectID,
  targetKind,
  targetID,
  relationship,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  deletedAt = null,
  version = 1,
  metadata = {}
}) {
  const kind = requiredText(targetKind, "project target kind", 64);
  if (!targetKindSet.has(kind)) throw new Error("Unsupported project target kind.");
  const rule = projectMembershipRules[kind];
  const normalizedRelationship = requiredText(
    relationship || rule.relationship || "reference",
    "project relationship",
    64
  );
  if (rule.relationship && normalizedRelationship !== rule.relationship) {
    throw new Error(`${kind} links must use the ${rule.relationship} relationship.`);
  }
  return {
    id: requiredText(id, "project link ID", 256),
    owner: ownerScope(owner?.id),
    projectID: requiredText(projectID, "project ID", 256),
    targetKind: kind,
    targetID: requiredText(targetID, "project target ID", 256),
    relationship: normalizedRelationship,
    createdAt: requiredISO(createdAt, "created date"),
    updatedAt: requiredISO(updatedAt, "updated date"),
    deletedAt: optionalISO(deletedAt, "deletion date"),
    version: boundedVersion(version),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}
  };
}

export function capabilityContract(entitlement, now = Date.now(), options = {}) {
  const pro = hasActiveProEntitlement(entitlement, now);
  const researchMonthlyLimit = Number.isSafeInteger(Number(options.researchMonthlyLimit))
    ? Number(options.researchMonthlyLimit)
    : defaultResearchMonthlyLimit;
  return {
    schemaVersion: 1,
    plan: pro ? "pro" : "free",
    capabilities: {
      [capabilityIDs.savedWork]: { enabled: true, limit: pro ? null : freePlanLimits.savedItems },
      [capabilityIDs.notes]: { enabled: true, limit: pro ? null : freePlanLimits.notes },
      [capabilityIDs.projects]: { enabled: pro, limit: pro ? null : freePlanLimits.projects },
      [capabilityIDs.notebook]: { enabled: pro },
      [capabilityIDs.professionalExports]: { enabled: pro },
      [capabilityIDs.offlineAccess]: { enabled: true },
      [capabilityIDs.research]: { enabled: true, monthlyLimit: researchMonthlyLimit },
      [capabilityIDs.evidenceDiscovery]: { enabled: false },
      [capabilityIDs.collaboration]: { enabled: false },
      [capabilityIDs.organizationAdministration]: { enabled: false }
    }
  };
}

export function syncContract({
  entitlement,
  clientSchemaVersion = null,
  clientCapabilities = [],
  contentMapVersion,
  migrationCheckpoint = null,
  researchMonthlyLimit = defaultResearchMonthlyLimit
}) {
  const normalizedClientSchemaVersion = Number(clientSchemaVersion);
  return {
    syncSchemaVersion,
    minimumSupportedSyncSchemaVersion: 1,
    clientSchemaVersion: Number.isSafeInteger(normalizedClientSchemaVersion)
      ? normalizedClientSchemaVersion
      : null,
    clientCapabilities: Array.from(new Set(
      (Array.isArray(clientCapabilities) ? clientCapabilities : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )).slice(0, 100),
    capabilityContract: capabilityContract(entitlement, Date.now(), { researchMonthlyLimit }),
    contentMapVersion: Number(contentMapVersion || 0),
    migrationCheckpoint,
    unknownRecordPolicy: "preserve-and-ignore",
    conflictPolicies
  };
}

export function immutableEvidenceSnapshot({
  id = randomUUID(),
  source,
  approvedAt = new Date().toISOString(),
  evidenceSetVersion = 1,
  sourceLibraryVersion
}) {
  const passageText = requiredText(source?.text || source?.selectedText, "evidence passage", 20_000);
  const sectionID = requiredText(source?.sectionID, "evidence section ID", 256);
  const sourceID = requiredText(source?.sourceID || source?.id, "evidence source ID", 256);
  const libraryVersion = requiredText(
    sourceLibraryVersion || source?.codeVersion,
    "source library version",
    1_024
  );
  const snapshot = {
    id: requiredText(id, "evidence snapshot ID", 256),
    sourceID,
    jurisdiction: requiredText(source?.jurisdiction || "New York City", "jurisdiction", 256),
    codeEdition: requiredText(source?.codeEdition, "code edition", 256),
    codeBook: requiredText(source?.codeBook || source?.codePrefix || "NYC Construction Code", "code book", 256),
    chapter: requiredText(source?.chapterNumber || "unknown", "chapter", 256),
    sectionID,
    sectionNumber: requiredText(source?.sectionNumber || sectionID, "section number", 256),
    passageID: requiredText(source?.passageID || sourceID, "passage ID", 256),
    passageText,
    passageTextHash: createHash("sha256").update(passageText).digest("hex"),
    approvedAt: requiredISO(approvedAt, "evidence approval date"),
    evidenceSetVersion: boundedVersion(evidenceSetVersion, "evidence set version"),
    sourceLibraryVersion: libraryVersion
  };
  return {
    ...snapshot,
    snapshotHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
  };
}

export function immutableResearchAnswer({
  id = randomUUID(),
  owner,
  conversationID,
  projectID = null,
  question,
  answer,
  evidence,
  citations,
  model,
  researchSystemVersion,
  createdAt = new Date().toISOString(),
  reviewStatus = "unreviewed",
  userFeedback = null
}) {
  if (!Array.isArray(evidence) || evidence.length < 1) throw new Error("Research answers require evidence.");
  if (!Array.isArray(citations) || citations.length < 1) throw new Error("Research answers require citations.");
  const evidenceIDs = new Set(evidence.map((item) => item.id));
  const sourceIDs = new Set(evidence.map((item) => item.sourceID));
  const mapping = citations.map((citation) => {
    const citationSourceIDs = (citation.sourceIDs || []).filter((sourceID) => sourceIDs.has(sourceID));
    if (!citationSourceIDs.length) throw new Error("Research citation is not backed by the approved evidence set.");
    return {
      sectionID: requiredText(citation.sectionID, "citation section ID", 256),
      sourceIDs: citationSourceIDs,
      evidenceSnapshotIDs: evidence
        .filter((item) => citationSourceIDs.includes(item.sourceID))
        .map((item) => item.id),
      relevance: String(citation.relevance || "").trim()
    };
  });
  if (mapping.some((item) => item.evidenceSnapshotIDs.some((id) => !evidenceIDs.has(id)))) {
    throw new Error("Invalid passage-to-citation mapping.");
  }
  return {
    id: requiredText(id, "research answer ID", 256),
    immutable: true,
    schemaVersion: projectFoundationSchemaVersion,
    version: 1,
    owner: ownerScope(owner?.id),
    conversationID: requiredText(conversationID, "conversation ID", 256),
    projectID: projectID ? requiredText(projectID, "project ID", 256) : null,
    question: requiredText(question, "research question", 2_000),
    evidence,
    evidenceSetVersion: Math.max(...evidence.map((item) => item.evidenceSetVersion)),
    answer,
    assumptions: Array.isArray(answer?.assumptions) ? answer.assumptions : [],
    missingFacts: Array.isArray(answer?.missingFacts) ? answer.missingFacts : [],
    limitations: Array.isArray(answer?.evidenceLimitations) ? answer.evidenceLimitations : [],
    additionalEvidenceNeeded: Array.isArray(answer?.additionalEvidenceNeeded)
      ? answer.additionalEvidenceNeeded
      : [],
    citations,
    passageToCitationMapping: mapping,
    model: requiredText(model, "research model", 256),
    researchSystemVersion: requiredText(researchSystemVersion, "research system version", 256),
    createdAt: requiredISO(createdAt, "creation date"),
    reviewStatus: requiredText(reviewStatus, "review status", 64),
    userFeedback
  };
}

export function activityEvent({
  id = randomUUID(),
  owner,
  projectID,
  actorUserID,
  action,
  objectKind,
  objectID,
  previousStatus = null,
  newStatus = null,
  createdAt = new Date().toISOString(),
  metadata = {}
}) {
  const normalizedAction = requiredText(action, "activity action", 128);
  if (!activityActionSet.has(normalizedAction)) throw new Error("Unsupported activity action.");
  return {
    id: requiredText(id, "activity ID", 256),
    owner: ownerScope(owner?.id),
    projectID: requiredText(projectID, "project ID", 256),
    actorUserID: requiredText(actorUserID, "actor user ID", 256),
    action: normalizedAction,
    objectKind: requiredText(objectKind, "affected object kind", 64),
    objectID: requiredText(objectID, "affected object ID", 256),
    previousStatus,
    newStatus,
    createdAt: requiredISO(createdAt, "activity date"),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}
  };
}
