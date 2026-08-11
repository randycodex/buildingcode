import { createHash, randomUUID } from "node:crypto";
import {
  freePlanLimits,
  hasActiveProEntitlement,
  hasActiveResearchEntitlement,
  researchEntitlementMode
} from "./entitlement-contract.mjs";

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
  organizationAdministration: "organization-administration",
  /** Phase 0: Code Question workspace. Default disabled; no UI path when off. */
  codeQuestionWorkspace: "code-question-workspace"
});

export const artifactTypes = Object.freeze([
  "note",
  "projectNote",
  "notebookCard",
  "notebookImageAsset",
  "reportDraft",
  "attachment",
  "workboardPreview",
  "reportManifest",
  "generatedReport",
  "evidenceReview",
  "reviewThread",
  "reviewComment",
  "codeQuestion",
  "questionInput",
  "evidenceSnapshotV2",
  "questionEvidenceSet",
  "questionAnalysis",
  "professionalConclusion",
  "conclusionApproval",
  "codeMemoReadiness",
  "codeMemoApproval",
  "issuedDecisionRecord",
  "codeQuestionPromotion"
]);

export const projectTargetKinds = Object.freeze([
  "canonicalSection",
  "selectedPassage",
  "savedItem",
  "note",
  "projectNote",
  "notebookCard",
  "researchConversation",
  "researchAnswer",
  "approvedEvidence",
  "workboard",
  "workboardPreview",
  "attachment",
  "reportDraft",
  "reportManifest",
  "generatedReport",
  "evidenceReview",
  "reviewThread",
  "reviewComment",
  "codeQuestion",
  "questionInput",
  "evidenceSnapshotV2",
  "questionEvidenceSet",
  "questionAnalysis",
  "professionalConclusion",
  "conclusionApproval",
  "codeMemoReadiness",
  "codeMemoApproval",
  "issuedDecisionRecord",
  "codeQuestionPromotion"
]);

export const projectMembershipRules = Object.freeze({
  canonicalSection: { maximumProjects: null, requiresExplicitLink: true },
  selectedPassage: { maximumProjects: null, requiresExplicitLink: true },
  savedItem: { maximumProjects: null, requiresExplicitLink: true },
  note: { maximumProjects: null, requiresExplicitLink: true },
  projectNote: { maximumProjects: 1, relationship: "owner" },
  notebookCard: { maximumProjects: null, requiresExplicitLink: true },
  researchConversation: { maximumProjects: 1, relationship: "primary" },
  researchAnswer: { maximumProjects: 1, relationship: "primary" },
  approvedEvidence: { maximumProjects: null, requiresExplicitLink: true },
  workboard: { maximumProjects: 1, relationship: "owner" },
  workboardPreview: { maximumProjects: 1, relationship: "owner" },
  attachment: { maximumProjects: 1, relationship: "owner" },
  reportDraft: { maximumProjects: 1, relationship: "owner" },
  reportManifest: { maximumProjects: 1, relationship: "owner" },
  generatedReport: { maximumProjects: 1, relationship: "owner" },
  evidenceReview: { maximumProjects: 1, relationship: "reference" },
  reviewThread: { maximumProjects: 1, relationship: "owner" },
  reviewComment: { maximumProjects: 1, relationship: "reference" },
  codeQuestion: { maximumProjects: 1, relationship: "owner" },
  questionInput: { maximumProjects: 1, relationship: "owner" },
  evidenceSnapshotV2: { maximumProjects: null, requiresExplicitLink: true },
  questionEvidenceSet: { maximumProjects: 1, relationship: "owner" },
  questionAnalysis: { maximumProjects: 1, relationship: "owner" },
  professionalConclusion: { maximumProjects: 1, relationship: "owner" },
  conclusionApproval: { maximumProjects: 1, relationship: "owner" },
  codeMemoReadiness: { maximumProjects: 1, relationship: "owner" },
  codeMemoApproval: { maximumProjects: 1, relationship: "owner" },
  issuedDecisionRecord: { maximumProjects: 1, relationship: "owner" },
  codeQuestionPromotion: { maximumProjects: 1, relationship: "owner" }
});

export const conflictPolicies = Object.freeze({
  savedItem: "latest-valid-record",
  note: "explicit-revision",
  projectNote: "explicit-revision",
  notebookCard: "explicit-revision",
  notebookImageAsset: "immutable-binary-metadata-revision",
  researchConversation: "server-ordered-append",
  researchAnswer: "immutable",
  approvedEvidence: "immutable",
  workboard: "whole-record-revision",
  workboardPreview: "immutable",
  attachment: "immutable-binary-metadata-revision",
  reportDraft: "explicit-revision",
  reportManifest: "immutable",
  generatedReport: "immutable",
  evidenceReview: "explicit-revision",
  reviewThread: "explicit-revision",
  reviewComment: "immutable",
  activityEvent: "append-only",
  projectLink: "latest-explicit-link-state",
  codeQuestion: "explicit-revision",
  questionInput: "explicit-revision",
  evidenceSnapshotV2: "immutable",
  questionEvidenceSet: "immutable",
  questionAnalysis: "immutable",
  professionalConclusion: "immutable",
  conclusionApproval: "immutable",
  codeMemoReadiness: "immutable",
  codeMemoApproval: "immutable",
  issuedDecisionRecord: "immutable",
  codeQuestionPromotion: "explicit-revision"
});

export const activityActions = Object.freeze([
  "item.linked",
  "item.unlinked",
  "note.created",
  "note.revision.saved",
  "project-note.created",
  "project-note.revision.saved",
  "notebook-card.created",
  "notebook-card.revision.saved",
  "evidence.approved",
  "evidence.removed",
  "research.question.submitted",
  "research.answer.generated",
  "research.project-context.reviewed",
  "review-status.changed",
  "review-thread.created",
  "review-thread.revision.saved",
  "review-thread.status.changed",
  "review-thread.assignee.changed",
  "review-comment.created",
  "report.generated",
  "report.export.saved",
  "project.archived",
  "project.restored",
  "project.transferred",
  "member.invited",
  "permission.changed",
  "code-question.created",
  "code-question.definition.revised",
  "code-question.archived",
  "code-question.restored",
  "code-question.input.confirmed",
  "code-question.input.created",
  "code-question.input.disputed",
  "code-question.input.revised",
  "code-question.evidence.approved",
  "code-question.evidence.removed",
  "code-question.evidence.stale",
  "code-question.analysis.generated",
  "code-question.analysis.stale",
  "code-question.conclusion.revised",
  "code-question.conclusion.approved",
  "code-question.memo.prepared",
  "code-question.memo.ready",
  "code-question.memo.approved",
  "code-question.review.opened",
  "code-question.review.assigned",
  "code-question.review.resolved",
  "code-question.review.reopened",
  "code-question.record.issued",
  "code-question.record.superseded",
  "code-question.migration.promoted",
  "code-question.migration.unlinked",
  "code-question.migration.recovered"
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

function immutableStructuredEvidenceSource(source, passageText) {
  if (!source?.richSourceID) return null;
  const grids = (Array.isArray(source.richSourceGrids) ? source.richSourceGrids : [])
    .slice(0, 8)
    .map((grid) => ({
      rows: (Array.isArray(grid?.rows) ? grid.rows : []).slice(0, 500).map((row) => ({
        cells: (Array.isArray(row?.cells) ? row.cells : []).slice(0, 100).map((cell) => ({
          text: requiredText(cell?.text, "structured evidence cell", 20_000),
          rowSpan: boundedVersion(cell?.rowSpan || 1, "structured evidence row span"),
          columnSpan: boundedVersion(cell?.columnSpan || 1, "structured evidence column span")
        }))
      }))
    }));
  const rowCount = grids.reduce((total, grid) => total + grid.rows.length, 0);
  if (!grids.length || !rowCount || rowCount !== Number(source.richSourceRowCount)) {
    throw new Error("Invalid structured evidence rows.");
  }
  const reference = requiredText(source.richSourceReference, "structured evidence reference", 512);
  const contentHash = requiredText(
    source.richSourceContentHash,
    "structured evidence content hash",
    64
  );
  if (!/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new Error("Invalid structured evidence content hash.");
  }
  const expectedHash = createHash("sha256")
    .update(JSON.stringify({ reference, text: passageText, grids }))
    .digest("hex");
  if (contentHash !== expectedHash) {
    throw new Error("Structured evidence content no longer matches its integrity hash.");
  }
  return {
    id: requiredText(source.richSourceID, "structured evidence source ID", 256),
    kind: requiredText(source.richSourceKind, "structured evidence kind", 64),
    reference,
    contentHash,
    rowCount,
    grids
  };
}

function immutableVisualEvidenceSources(source) {
  const sources = Array.isArray(source?.visualSources) ? source.visualSources : [];
  if (!sources.length) return [];
  if (sources.length > 4) throw new Error("Too many visual evidence sources.");
  return sources.map((visualSource) => {
    const id = requiredText(visualSource?.id, "visual evidence source ID", 256);
    const assetName = requiredText(visualSource?.assetName, "visual evidence asset name", 512);
    const assetURL = requiredText(visualSource?.assetURL, "visual evidence asset URL", 1_024);
    const mediaType = requiredText(visualSource?.mediaType, "visual evidence media type", 64);
    const contentHash = requiredText(visualSource?.contentHash, "visual evidence content hash", 64);
    const dataBase64 = requiredText(
      visualSource?.dataBase64,
      "visual evidence binary snapshot",
      6_000_000
    );
    if (
      !/^[a-zA-Z0-9._-]+\.(?:gif|jpe?g|png|webp)$/i.test(assetName) ||
      !/^\/code\/assets\/[a-zA-Z0-9._%-]+$/.test(assetURL) ||
      !["image/gif", "image/jpeg", "image/png", "image/webp"].includes(mediaType) ||
      !/^[a-f0-9]{64}$/.test(contentHash) ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(dataBase64)
    ) {
      throw new Error("Invalid visual evidence source.");
    }
    const body = Buffer.from(dataBase64, "base64");
    if (
      !body.length ||
      body.toString("base64") !== dataBase64 ||
      body.length !== Number(visualSource.byteLength) ||
      createHash("sha256").update(body).digest("hex") !== contentHash
    ) {
      throw new Error("Visual evidence content no longer matches its integrity metadata.");
    }
    const displayWidth = Number(visualSource.displayWidth);
    const displayHeight = Number(visualSource.displayHeight);
    return {
      id,
      kind: "image",
      assetName,
      assetURL,
      mediaType,
      contentHash,
      byteLength: body.length,
      displayWidth: Number.isFinite(displayWidth) && displayWidth > 0 ? displayWidth : null,
      displayHeight: Number.isFinite(displayHeight) && displayHeight > 0 ? displayHeight : null,
      dataBase64
    };
  });
}

export function ownerScope(userID) {
  return {
    kind: "user",
    id: requiredText(userID, "owner user ID", 256),
    organizationID: null
  };
}

export function organizationOwnerScope(organizationID) {
  const id = requiredText(organizationID, "owner organization ID", 256);
  return {
    kind: "organization",
    id,
    organizationID: id
  };
}

export function normalizedOwnerScope(owner) {
  if (owner?.kind === "organization") {
    return organizationOwnerScope(owner.organizationID || owner.id);
  }
  if (owner?.kind === "user") {
    return ownerScope(owner.id);
  }
  throw new Error("Invalid owner scope.");
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
  return {
    id: requiredText(id, "artifact ID", 256),
    type: normalizedType,
    createdAt: requiredISO(createdAt, "created date"),
    updatedAt: requiredISO(updatedAt, "updated date"),
    owner: normalizedOwnerScope(owner),
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
    owner: normalizedOwnerScope(owner),
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
  const research = hasActiveResearchEntitlement(entitlement, now);
  const researchMode = researchEntitlementMode(entitlement, now);
  const evidenceDiscovery = research && options.evidenceDiscoveryEnabled === true;
  const collaboration = options.collaborationEnabled === true;
  const organizationAdministration = options.organizationAdministrationEnabled === true;
  const codeQuestionWorkspace = options.codeQuestionWorkspaceEnabled === true;
  const researchMonthlyLimit = Number.isSafeInteger(Number(options.researchMonthlyLimit))
    ? Number(options.researchMonthlyLimit)
    : defaultResearchMonthlyLimit;
  return {
    schemaVersion: 2,
    plan: pro ? "pro" : "free",
    packages: {
      pro: { active: pro },
      research: {
        active: research,
        requiresPro: true,
        mode: researchMode
      }
    },
    capabilities: {
      [capabilityIDs.savedWork]: { enabled: true, limit: pro ? null : freePlanLimits.savedItems },
      [capabilityIDs.notes]: { enabled: true, limit: pro ? null : freePlanLimits.notes },
      [capabilityIDs.projects]: { enabled: pro, limit: pro ? null : freePlanLimits.projects },
      [capabilityIDs.notebook]: { enabled: pro },
      [capabilityIDs.professionalExports]: { enabled: pro },
      [capabilityIDs.offlineAccess]: { enabled: pro },
      [capabilityIDs.research]: {
        enabled: research,
        requiresPro: true,
        monthlyLimit: research ? researchMonthlyLimit : 0
      },
      [capabilityIDs.evidenceDiscovery]: {
        enabled: evidenceDiscovery,
        requiresResearch: true,
        release: evidenceDiscovery ? "private-beta" : "unavailable"
      },
      [capabilityIDs.collaboration]: { enabled: collaboration },
      [capabilityIDs.organizationAdministration]: { enabled: organizationAdministration },
      [capabilityIDs.codeQuestionWorkspace]: {
        enabled: codeQuestionWorkspace,
        release: codeQuestionWorkspace ? "private-beta" : "unavailable",
        featureFlag: "permitext:codeQuestionWorkspace"
      }
    }
  };
}

export function syncContract({
  entitlement,
  clientSchemaVersion = null,
  clientCapabilities = [],
  contentMapVersion,
  migrationCheckpoint = null,
  researchMonthlyLimit = defaultResearchMonthlyLimit,
  evidenceDiscoveryEnabled = false,
  collaborationEnabled = false,
  organizationAdministrationEnabled = false,
  codeQuestionWorkspaceEnabled = false
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
    capabilityContract: capabilityContract(entitlement, Date.now(), {
      researchMonthlyLimit,
      evidenceDiscoveryEnabled,
      collaborationEnabled,
      organizationAdministrationEnabled,
      codeQuestionWorkspaceEnabled
    }),
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
  const provenance = {
    origin: String(source?.origin || "user_pinned").trim(),
    authorityClass: String(source?.authorityClass || "enacted").trim(),
    relationship: String(source?.relationship || "").trim() || null,
    retrievalReason: String(source?.retrievalReason || "").trim() || null,
    retrievalRank: source?.retrievalRank !== null && source?.retrievalRank !== "" &&
      Number.isFinite(Number(source?.retrievalRank)) ? Number(source.retrievalRank) : null,
    retrievalScore: source?.retrievalScore !== null && source?.retrievalScore !== "" &&
      Number.isFinite(Number(source?.retrievalScore)) ? Number(source.retrievalScore) : null,
    retrievalVersion: String(source?.retrievalVersion || "").trim() || null,
    retrievalDepth: Number.isFinite(Number(source?.retrievalDepth)) ? Number(source.retrievalDepth) : null,
    retrievedAt: optionalISO(source?.retrievedAt, "evidence retrieval date")
  };
  const userSelectedText = String(source?.userSelectedText || "").trim();
  if (userSelectedText) {
    provenance.userSelectedText = userSelectedText;
    provenance.userSelectedTextHash = createHash("sha256").update(userSelectedText).digest("hex");
  }
  snapshot.provenance = provenance;
  const structuredSource = immutableStructuredEvidenceSource(source, passageText);
  if (structuredSource) snapshot.structuredSource = structuredSource;
  const visualSources = immutableVisualEvidenceSources(source);
  if (visualSources.length) snapshot.visualSources = visualSources;
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
    owner: normalizedOwnerScope(owner),
    conversationID: requiredText(conversationID, "conversation ID", 256),
    projectID: projectID ? requiredText(projectID, "project ID", 256) : null,
    question: requiredText(question, "research question", 2_000),
    evidence,
    evidenceSetVersion: Math.max(...evidence.map((item) => item.evidenceSetVersion)),
    answer,
    codeBasis: answer?.codeBasis && typeof answer.codeBasis === "object"
      ? structuredClone(answer.codeBasis)
      : null,
    assumptions: Array.isArray(answer?.assumptions) ? answer.assumptions : [],
    missingFacts: Array.isArray(answer?.missingFacts) ? answer.missingFacts : [],
    followUpQuestions: Array.isArray(answer?.followUpQuestions) ? answer.followUpQuestions : [],
    limitations: Array.isArray(answer?.evidenceLimitations) ? answer.evidenceLimitations : [],
    additionalEvidenceNeeded: Array.isArray(answer?.additionalEvidenceNeeded)
      ? answer.additionalEvidenceNeeded
      : [],
    sourceSummary: answer?.sourceSummary && typeof answer.sourceSummary === "object"
      ? structuredClone(answer.sourceSummary)
      : null,
    supportingSources: Array.isArray(answer?.supportingSources)
      ? structuredClone(answer.supportingSources)
      : [],
    retrieval: answer?.retrieval && typeof answer.retrieval === "object"
      ? structuredClone(answer.retrieval)
      : null,
    verification: answer?.verification && typeof answer.verification === "object"
      ? structuredClone(answer.verification)
      : null,
    structuredEvidenceAnalysis: answer?.structuredEvidenceAnalysis &&
      typeof answer.structuredEvidenceAnalysis === "object"
      ? structuredClone(answer.structuredEvidenceAnalysis)
      : null,
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
    owner: normalizedOwnerScope(owner),
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
