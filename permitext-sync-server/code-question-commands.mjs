/**
 * Code Question command layer (Phase 1).
 *
 * Pure domain operations over a storage port. Handlers pass a store that
 * implements list/get/CAS-save for foundation artifacts, counters, pending
 * issuance, and outbox. Capability gating is the caller's responsibility.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  activityEvent,
  artifactEnvelope,
  ownerScope,
  projectLinkRecord
} from "./project-foundation-contract.mjs";
import {
  assertValidTransition,
  computeDependencyHash,
  deterministicCodeQuestionPromotionID,
  formatQuestionDisplayID,
  isCodeQuestionWorkspaceEnabled,
  normalizeCodeQuestionPayload,
  normalizeCodeMemoApprovalPayload,
  normalizeCodeMemoReadinessPayload,
  normalizeCodeQuestionPromotionPayload,
  normalizeConclusionApprovalPayload,
  normalizeEvidenceSnapshotV2,
  normalizeIssuedDecisionRecordPayload,
  normalizeProfessionalConclusionPayload,
  normalizeQuestionAnalysisPayload,
  normalizeQuestionEvidenceSetPayload,
  normalizeQuestionInputPayload,
  codeQuestionFeatureFlag
} from "./code-question-contract.mjs";
import { organizationPermissions, roleAllows } from "./organization-contract.mjs";

export const codeQuestionMigrationVersion = 1;
export const codeQuestionMigrationCheckpointName = "code-question-workspace-v1";

export const codeQuestionCommandKinds = Object.freeze([
  "codeQuestion.create",
  "codeQuestion.update",
  "codeQuestion.archive",
  "codeQuestion.restore",
  "codeQuestion.input.save",
  "codeQuestion.evidence.propose",
  "codeQuestion.evidence.approve",
  "codeQuestion.evidenceSet.version",
  "codeQuestion.analysis.create",
  "codeQuestion.conclusion.publish",
  "codeQuestion.conclusion.approve",
  "codeQuestion.review.manage",
  "codeQuestion.memo.prepare",
  "codeQuestion.memo.ready",
  "codeQuestion.memo.approve",
  "codeQuestion.issue.start",
  "codeQuestion.issue.complete",
  "codeQuestion.issue.fail",
  "codeQuestion.issue.supersede",
  "codeQuestion.migration.run",
  "codeQuestion.legacy.promote",
  "codeQuestion.legacy.unlink"
]);

export class CodeQuestionCommandError extends Error {
  constructor(message, { code = "CODE_QUESTION_ERROR", status = 400, details = null } = {}) {
    super(message);
    this.name = "CodeQuestionCommandError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function codeQuestionWorkspaceFeatureEnabled(environment = process.env) {
  return String(environment.PERMITEXT_CODE_QUESTION_WORKSPACE || "").trim() === "1";
}

export function assertCodeQuestionWorkspaceEnabled(options = {}) {
  const enabled = isCodeQuestionWorkspaceEnabled({
    codeQuestionWorkspaceEnabled: options.codeQuestionWorkspaceEnabled === true ||
      codeQuestionWorkspaceFeatureEnabled(options.environment)
  });
  if (!enabled) {
    throw new CodeQuestionCommandError(
      "Code Question workspace is not enabled for this account.",
      { code: "CODE_QUESTION_WORKSPACE_DISABLED", status: 403 }
    );
  }
}

export function assertCodeQuestionPermission(role, permission) {
  if (!roleAllows(role, permission)) {
    throw new CodeQuestionCommandError("Permission denied for this Code Question action.", {
      code: "CODE_QUESTION_PERMISSION_DENIED",
      status: 403,
      details: { permission, role }
    });
  }
}

export function blockingReviewRequestIDs(artifacts, questionID) {
  const normalizedQuestionID = String(questionID || "").trim();
  if (!normalizedQuestionID) return [];
  return (Array.isArray(artifacts) ? artifacts : [])
    .filter((item) =>
      item?.envelope?.type === "reviewThread" &&
      item?.payload?.questionID === normalizedQuestionID &&
      item?.payload?.blocking === true &&
      ["open", "waiting"].includes(item?.payload?.status)
    )
    .map((item) => item.envelope.id);
}

/**
 * Atomic expectedVersion compare-and-swap for foundation artifacts.
 * Store implementation must perform this under a single write lock/transaction.
 */
export function compareAndSwapFoundationArtifact(existing, nextArtifact, expectedVersion) {
  const currentVersion = existing?.envelope?.version;
  if (!existing) {
    if (expectedVersion !== 0 && expectedVersion !== null && expectedVersion !== undefined) {
      throw new CodeQuestionCommandError(
        "Expected version does not match; artifact does not exist.",
        { code: "CODE_QUESTION_VERSION_CONFLICT", status: 409, details: { expectedVersion, currentVersion: 0 } }
      );
    }
    return nextArtifact;
  }
  if (!Number.isSafeInteger(Number(expectedVersion)) || Number(expectedVersion) !== currentVersion) {
    throw new CodeQuestionCommandError(
      "This Code Question record changed after you opened it.",
      {
        code: "CODE_QUESTION_VERSION_CONFLICT",
        status: 409,
        details: { expectedVersion, currentVersion }
      }
    );
  }
  const policy = nextArtifact?.envelope?.type;
  // Immutable kinds: refuse in-place mutation when an existing row is present.
  const immutable = new Set([
    "evidenceSnapshotV2",
    "questionEvidenceSet",
    "questionAnalysis",
    "professionalConclusion",
    "issuedDecisionRecord"
  ]);
  if (immutable.has(policy) && existing.envelope.id === nextArtifact.envelope.id) {
    // Allow only if payloads are identical (idempotent retry).
    if (JSON.stringify(existing.payload) !== JSON.stringify(nextArtifact.payload)) {
      throw new CodeQuestionCommandError("Immutable Code Question artifact cannot be changed.", {
        code: "CODE_QUESTION_IMMUTABLE",
        status: 409
      });
    }
    return existing;
  }
  return nextArtifact;
}

/**
 * Allocate next Project-scoped question number using a counter map.
 * counters: { [projectID]: lastAllocatedNumber }
 */
export function allocateQuestionNumber(counters, projectID) {
  const key = String(projectID || "").trim();
  if (!key) throw new CodeQuestionCommandError("Project ID is required for question number allocation.");
  const next = Number(counters[key] || 0) + 1;
  if (!Number.isSafeInteger(next) || next < 1) {
    throw new CodeQuestionCommandError("Failed to allocate question number.");
  }
  return { questionNumber: next, counters: { ...counters, [key]: next } };
}

/**
 * Allocate next version within a question-scoped counter map.
 * scopes: { [scopeKey]: lastVersion }
 */
export function allocateScopedVersion(scopes, scopeKey) {
  const key = String(scopeKey || "").trim();
  if (!key) throw new CodeQuestionCommandError("Scope key is required for version allocation.");
  const next = Number(scopes[key] || 0) + 1;
  if (!Number.isSafeInteger(next) || next < 1) {
    throw new CodeQuestionCommandError("Failed to allocate scoped version.");
  }
  return { version: next, scopes: { ...scopes, [key]: next } };
}

export function uniquenessKey(scope, ...parts) {
  return [scope, ...parts.map((part) => String(part || "").trim())].join("::");
}

/** Pending issuance saga states. */
export const issuanceSagaStates = Object.freeze([
  "reserved",
  "staged",
  "committing",
  "issued",
  "failed",
  "abandoned"
]);

export function createPendingIssuanceRecord({
  id = randomUUID(),
  questionID,
  issueVersion,
  idempotencyKey,
  actorUserID,
  stagedObjectKey = null,
  draftID = null,
  draftHash = null,
  memoApprovalID = null,
  predecessorID = null,
  manifestID = null,
  issuedRecordID = null,
  status = "reserved",
  createdAt = new Date().toISOString(),
  error = null
}) {
  if (!issuanceSagaStates.includes(status)) {
    throw new CodeQuestionCommandError("Invalid issuance saga status.");
  }
  return {
    id: String(id),
    questionID: String(questionID),
    issueVersion: Number(issueVersion),
    idempotencyKey: String(idempotencyKey),
    actorUserID: String(actorUserID),
    stagedObjectKey,
    draftID: draftID ? String(draftID) : null,
    draftHash: draftHash ? String(draftHash) : null,
    memoApprovalID: memoApprovalID ? String(memoApprovalID) : null,
    predecessorID: predecessorID ? String(predecessorID) : null,
    manifestID: manifestID ? String(manifestID) : null,
    issuedRecordID: issuedRecordID ? String(issuedRecordID) : null,
    status,
    createdAt,
    updatedAt: createdAt,
    error
  };
}

export function advanceIssuanceSaga(pending, nextStatus, patch = {}) {
  if (!issuanceSagaStates.includes(nextStatus)) {
    throw new CodeQuestionCommandError("Invalid issuance saga status.");
  }
  const allowed = {
    reserved: ["staged", "failed", "abandoned"],
    staged: ["committing", "failed", "abandoned"],
    committing: ["issued", "failed"],
    issued: [],
    failed: ["reserved"], // retry with same idempotency key re-enters reserved/reconcile
    abandoned: []
  };
  if (!(allowed[pending.status] || []).includes(nextStatus) && pending.status !== nextStatus) {
    throw new CodeQuestionCommandError(
      `Invalid issuance saga transition ${pending.status} → ${nextStatus}.`,
      { code: "ISSUANCE_SAGA_INVALID_TRANSITION", status: 409 }
    );
  }
  return {
    ...pending,
    ...patch,
    status: nextStatus,
    updatedAt: patch.updatedAt || new Date().toISOString()
  };
}

/**
 * Offline Question command outbox entry (transport only).
 */
export function createQuestionOutboxEntry({
  id = randomUUID(),
  commandKind,
  payload,
  idempotencyKey,
  createdAt = new Date().toISOString()
}) {
  if (!codeQuestionCommandKinds.includes(commandKind)) {
    throw new CodeQuestionCommandError("Unsupported Code Question outbox command kind.");
  }
  return {
    id: String(id),
    commandKind,
    payload: payload && typeof payload === "object" ? payload : {},
    idempotencyKey: String(idempotencyKey || id),
    createdAt,
    status: "queued",
    attempts: 0,
    lastError: null
  };
}

export function createCodeQuestionArtifact({
  userID,
  projectID,
  title,
  questionText,
  scope = "",
  desiredOutput = "",
  jurisdiction = "",
  asOfDate = null,
  questionNumber,
  createdAt = new Date().toISOString(),
  id = randomUUID()
}) {
  assertValidTransition("codeQuestion", "nonexistent", "active");
  const payload = normalizeCodeQuestionPayload({
    projectID,
    questionNumber,
    displayID: formatQuestionDisplayID(questionNumber),
    title,
    questionText,
    scope,
    desiredOutput,
    jurisdiction,
    asOfDate,
    recordState: "active",
    definitionRevision: 1,
    createdBy: userID,
    updatedBy: userID,
    createdAt,
    updatedAt: createdAt,
    expectedVersion: 1
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "codeQuestion",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function archiveCodeQuestionArtifact(existing, { userID, expectedVersion, updatedAt = new Date().toISOString() }) {
  assertValidTransition("codeQuestion", "active", "archived");
  if (existing.payload.recordState !== "active") {
    throw new CodeQuestionCommandError("Only active Code Questions can be archived.", {
      code: "CODE_QUESTION_INVALID_STATE",
      status: 409
    });
  }
  compareAndSwapFoundationArtifact(existing, existing, expectedVersion);
  const payload = normalizeCodeQuestionPayload({
    ...existing.payload,
    recordState: "archived",
    archivedAt: updatedAt,
    updatedBy: userID,
    updatedAt,
    expectedVersion: Number(existing.envelope.version) + 1
  });
  return {
    envelope: artifactEnvelope({
      ...existing.envelope,
      owner: existing.envelope.owner || ownerScope(userID),
      updatedAt,
      version: Number(existing.envelope.version) + 1
    }),
    payload
  };
}

export function restoreCodeQuestionArtifact(existing, { userID, expectedVersion, updatedAt = new Date().toISOString() }) {
  assertValidTransition("codeQuestion", "archived", "active");
  if (existing.payload.recordState !== "archived") {
    throw new CodeQuestionCommandError("Only archived Code Questions can be restored.", {
      code: "CODE_QUESTION_INVALID_STATE",
      status: 409
    });
  }
  compareAndSwapFoundationArtifact(existing, existing, expectedVersion);
  const payload = normalizeCodeQuestionPayload({
    ...existing.payload,
    recordState: "active",
    archivedAt: null,
    updatedBy: userID,
    updatedAt,
    expectedVersion: Number(existing.envelope.version) + 1
  });
  return {
    envelope: artifactEnvelope({
      ...existing.envelope,
      owner: existing.envelope.owner || ownerScope(userID),
      updatedAt,
      version: Number(existing.envelope.version) + 1
    }),
    payload
  };
}

export function createQuestionInputArtifact({
  userID,
  questionID,
  kind,
  statement,
  state = "proposed",
  basis = "",
  id = randomUUID(),
  createdAt = new Date().toISOString()
}) {
  const payload = normalizeQuestionInputPayload({
    id,
    questionID,
    kind,
    statement,
    state,
    basis,
    revision: 1,
    createdBy: userID,
    updatedBy: userID,
    createdAt,
    updatedAt: createdAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "questionInput",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function createEvidenceSnapshotArtifact({
  userID,
  sourceIdentity,
  passageLocator,
  quotedText,
  sourceVersion = "",
  structuredMaterial = null,
  id = randomUUID(),
  createdAt = new Date().toISOString()
}) {
  const payload = normalizeEvidenceSnapshotV2({
    id,
    sourceIdentity,
    passageLocator,
    quotedText,
    sourceVersion,
    structuredMaterial,
    createdAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "evidenceSnapshotV2",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function createEvidenceSetArtifact({
  userID,
  questionID,
  version,
  entries,
  id = randomUUID(),
  createdAt = new Date().toISOString()
}) {
  assertValidTransition("evidenceSet", "vN", "vN+1");
  const payload = normalizeQuestionEvidenceSetPayload({
    id,
    questionID,
    version,
    entries,
    createdBy: userID,
    createdAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "questionEvidenceSet",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function createAnalysisArtifact({
  userID,
  questionID,
  definitionRevision,
  definitionHash,
  inputSnapshotIDs,
  inputSetHash,
  evidenceSetID,
  evidenceSetVersion,
  evidenceSetHash,
  dependencyHash,
  researchAnswerID,
  requestID,
  id = randomUUID(),
  createdAt = new Date().toISOString(),
  modelID = "",
  analysisPolicyID = "selected-evidence-only-v1",
  promptTemplateVersion = "1",
  citationValidation = "pending"
}) {
  assertValidTransition("analysisRun", "nonexistent", "immutable");
  const payload = normalizeQuestionAnalysisPayload({
    id,
    questionID,
    definitionRevision,
    definitionHash,
    inputSnapshotIDs,
    inputSetHash,
    evidenceSetID,
    evidenceSetVersion,
    evidenceSetHash,
    dependencyHash,
    researchAnswerID,
    modelID,
    analysisPolicyID,
    promptTemplateVersion,
    requestedBy: userID,
    createdAt,
    requestID,
    citationValidation
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "questionAnalysis",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function createConclusionArtifact({
  userID,
  questionID,
  revision,
  definitionRevision,
  definitionHash,
  inputSetHash,
  evidenceSetID,
  evidenceSetVersion,
  evidenceSetHash,
  conclusionText,
  reasoning = "",
  citations = [],
  assumptions = [],
  unknowns = [],
  analysisRunID = null,
  analysisDependencyHash = null,
  aiAssistanceDisclosure = "",
  predecessorRevisionID = null,
  id = randomUUID(),
  createdAt = new Date().toISOString()
}) {
  assertValidTransition("conclusion", "working-draft", "immutable-revision");
  const payload = normalizeProfessionalConclusionPayload({
    id,
    questionID,
    revision,
    definitionRevision,
    definitionHash,
    inputSetHash,
    evidenceSetID,
    evidenceSetVersion,
    evidenceSetHash,
    analysisRunID,
    analysisDependencyHash,
    conclusionText,
    reasoning,
    citations,
    assumptions,
    unknowns,
    aiAssistanceDisclosure,
    predecessorRevisionID,
    authorUserID: userID,
    createdAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "professionalConclusion",
      owner: ownerScope(userID),
      createdAt,
      updatedAt: createdAt,
      version: 1
    }),
    payload
  };
}

export function createConclusionApprovalArtifact({
  userID,
  questionID,
  conclusionID,
  conclusionRevision,
  dependencyHash,
  reviewRound,
  approvalBasis,
  id = randomUUID(),
  approvedAt = new Date().toISOString()
}) {
  assertValidTransition("conclusionApproval", "unapproved", "approved");
  const payload = normalizeConclusionApprovalPayload({
    id,
    questionID,
    conclusionID,
    conclusionRevision,
    dependencyHash,
    reviewRound,
    approvalBasis,
    approvedByUserID: userID,
    approvedAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "conclusionApproval",
      owner: ownerScope(userID),
      createdAt: approvedAt,
      updatedAt: approvedAt,
      version: 1
    }),
    payload
  };
}

export function createCodeMemoApprovalArtifact({
  userID,
  questionID,
  draftID,
  draftRevision,
  draftHash,
  conclusionID,
  conclusionRevision,
  conclusionHash,
  approvalBasis,
  id = randomUUID(),
  approvedAt = new Date().toISOString()
}) {
  assertValidTransition("codeMemo", "ready-for-approval", "approved");
  const payload = normalizeCodeMemoApprovalPayload({
    id,
    questionID,
    draftID,
    draftRevision,
    draftHash,
    conclusionID,
    conclusionRevision,
    conclusionHash,
    approvalBasis,
    approvedByUserID: userID,
    approvedAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "codeMemoApproval",
      owner: ownerScope(userID),
      createdAt: approvedAt,
      updatedAt: approvedAt,
      version: 1
    }),
    payload
  };
}

export function createCodeMemoReadinessArtifact({
  userID,
  questionID,
  draftID,
  draftRevision,
  draftHash,
  checks,
  id = randomUUID(),
  markedAt = new Date().toISOString()
}) {
  assertValidTransition("codeMemo", "draft", "ready-for-approval");
  const payload = normalizeCodeMemoReadinessPayload({
    id,
    questionID,
    draftID,
    draftRevision,
    draftHash,
    checks,
    markedByUserID: userID,
    markedAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "codeMemoReadiness",
      owner: ownerScope(userID),
      createdAt: markedAt,
      updatedAt: markedAt,
      version: 1
    }),
    payload
  };
}

export function createIssuedRecordArtifact({
  userID,
  questionID,
  issueVersion,
  reportManifestID,
  componentVersions = {},
  componentHashes = {},
  approvalBasis = "",
  predecessorID = null,
  id = randomUUID(),
  issuedAt = new Date().toISOString()
}) {
  assertValidTransition("codeMemo", "issuing", "issued");
  const payload = normalizeIssuedDecisionRecordPayload({
    id,
    questionID,
    issueVersion,
    status: "issued",
    reportManifestID,
    componentVersions,
    componentHashes,
    issuingActor: userID,
    approvalBasis,
    predecessorID,
    issuedAt
  });
  return {
    envelope: artifactEnvelope({
      id,
      type: "issuedDecisionRecord",
      owner: ownerScope(userID),
      createdAt: issuedAt,
      updatedAt: issuedAt,
      version: 1
    }),
    payload
  };
}

export function deterministicPromotedQuestionID({
  userID,
  projectID,
  sourceKind,
  sourceID,
  idempotencyKey
}) {
  const digest = createHash("sha256")
    .update([userID, projectID, sourceKind, sourceID, idempotencyKey].map(String).join("\u001f"))
    .digest("hex")
    .slice(0, 40);
  return `cq-promoted-${digest}`;
}

export function upsertCodeQuestionPromotionArtifact(existing, {
  userID,
  projectID,
  questionID,
  sourceKind,
  sourceID,
  sourceVersion = null,
  sourceLabel = "",
  sourceProjectID = null,
  action = "link-existing",
  status = "linked",
  idempotencyKey,
  now = new Date().toISOString()
}) {
  const id = deterministicCodeQuestionPromotionID({
    ownerID: userID,
    projectID,
    questionID,
    sourceKind,
    sourceID
  });
  if (existing && existing.envelope?.id !== id) {
    throw new CodeQuestionCommandError("Promotion identity does not match its source relationship.", {
      code: "CODE_QUESTION_PROMOTION_IDENTITY_MISMATCH",
      status: 409
    });
  }
  const previousStatus = existing?.payload?.status || "nonexistent";
  if (previousStatus === status && existing?.payload?.questionID === questionID) {
    return { artifact: existing, replayed: true, recovered: false };
  }
  assertValidTransition("legacyPromotion", previousStatus, status);
  const recovered = previousStatus === "unlinked" && status === "linked";
  const payload = normalizeCodeQuestionPromotionPayload({
    id,
    projectID,
    questionID,
    sourceKind,
    sourceID,
    sourceVersion,
    sourceLabel,
    sourceProjectID,
    action: existing?.payload?.action || action,
    status,
    idempotencyKey: existing?.payload?.idempotencyKey || idempotencyKey,
    createdByUserID: existing?.payload?.createdByUserID || userID,
    createdAt: existing?.payload?.createdAt || now,
    updatedByUserID: userID,
    updatedAt: now,
    unlinkedAt: status === "unlinked" ? now : null,
    recoveryCount: Number(existing?.payload?.recoveryCount || 0) + (recovered ? 1 : 0)
  });
  return {
    replayed: false,
    recovered,
    artifact: {
      envelope: artifactEnvelope({
        id,
        type: "codeQuestionPromotion",
        owner: ownerScope(userID),
        createdAt: existing?.envelope?.createdAt || now,
        updatedAt: now,
        version: Number(existing?.envelope?.version || 0) + 1
      }),
      payload
    }
  };
}

export function linkForArtifact({
  userID,
  projectID,
  targetKind,
  targetID,
  relationship = "owner",
  createdAt = new Date().toISOString(),
  metadata = {}
}) {
  return projectLinkRecord({
    id: `link:${userID}:${projectID}:${targetKind}:${targetID}`,
    owner: ownerScope(userID),
    projectID,
    targetKind,
    targetID,
    relationship,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    metadata
  });
}

export function activityFor({
  userID,
  projectID,
  action,
  objectKind,
  objectID,
  previousStatus = null,
  newStatus = null,
  createdAt = new Date().toISOString(),
  metadata = {}
}) {
  return activityEvent({
    owner: ownerScope(userID),
    projectID,
    actorUserID: userID,
    action,
    objectKind,
    objectID,
    previousStatus,
    newStatus,
    createdAt,
    metadata
  });
}

/**
 * Checkpointed schema/bootstrap migration — no-op for user content promotion.
 * Idempotent: re-running after completed checkpoint returns already-current.
 */
export function runCodeQuestionBootstrapMigration({
  previousCheckpoint = null,
  now = new Date().toISOString()
} = {}) {
  if (
    previousCheckpoint &&
    previousCheckpoint.migrationVersion === codeQuestionMigrationVersion &&
    previousCheckpoint.status === "completed"
  ) {
    return {
      migrationVersion: codeQuestionMigrationVersion,
      checkpointName: codeQuestionMigrationCheckpointName,
      status: "completed",
      startedAt: previousCheckpoint.startedAt,
      completedAt: previousCheckpoint.completedAt,
      migratedCount: previousCheckpoint.migratedCount || 0,
      alreadyCurrentCount: (previousCheckpoint.alreadyCurrentCount || 0) + 1,
      skippedCount: previousCheckpoint.skippedCount || 0,
      ambiguousCount: 0,
      failedCount: 0,
      lastSuccessfulCheckpoint: previousCheckpoint.lastSuccessfulCheckpoint || previousCheckpoint.completedAt,
      note: "Bootstrap migration already complete; user-content promotion is explicit and separate."
    };
  }
  return {
    migrationVersion: codeQuestionMigrationVersion,
    checkpointName: codeQuestionMigrationCheckpointName,
    status: "completed",
    startedAt: now,
    completedAt: now,
    migratedCount: 0,
    alreadyCurrentCount: 0,
    skippedCount: 0,
    ambiguousCount: 0,
    failedCount: 0,
    lastSuccessfulCheckpoint: now,
    note: "Additive bootstrap only; no legacy Notebook/Saved/Research/Report records were modified or deleted."
  };
}

/**
 * Permission matrix helper for handlers/tests.
 */
export function permissionForCommand(commandKind) {
  switch (commandKind) {
    case "codeQuestion.create":
    case "codeQuestion.update":
    case "codeQuestion.archive":
    case "codeQuestion.restore":
    case "codeQuestion.input.save":
      return organizationPermissions.codeQuestionEdit;
    case "codeQuestion.evidence.propose":
      return organizationPermissions.codeQuestionEvidencePropose;
    case "codeQuestion.evidence.approve":
    case "codeQuestion.evidenceSet.version":
      return organizationPermissions.codeQuestionEvidenceApprove;
    case "codeQuestion.analysis.create":
      return organizationPermissions.codeQuestionAnalyze;
    case "codeQuestion.conclusion.publish":
      return organizationPermissions.codeQuestionConclusionDraft;
    case "codeQuestion.conclusion.approve":
      return organizationPermissions.codeQuestionConclusionApprove;
    case "codeQuestion.review.manage":
      return organizationPermissions.codeQuestionReview;
    case "codeQuestion.memo.prepare":
    case "codeQuestion.memo.ready":
      return organizationPermissions.codeQuestionEdit;
    case "codeQuestion.memo.approve":
      return organizationPermissions.codeQuestionConclusionApprove;
    case "codeQuestion.issue.start":
    case "codeQuestion.issue.complete":
    case "codeQuestion.issue.fail":
      return organizationPermissions.codeQuestionIssue;
    case "codeQuestion.issue.supersede":
      return organizationPermissions.codeQuestionSupersede;
    case "codeQuestion.migration.run":
    case "codeQuestion.legacy.promote":
    case "codeQuestion.legacy.unlink":
      return organizationPermissions.codeQuestionEdit;
    default:
      return organizationPermissions.codeQuestionEdit;
  }
}

export function dependencyHashForQuestion({ question, inputs, evidenceSet }) {
  return computeDependencyHash({
    questionText: question.questionText || question.payload?.questionText,
    scope: question.scope || question.payload?.scope || "",
    jurisdiction: question.jurisdiction || question.payload?.jurisdiction || "",
    asOfDate: question.asOfDate || question.payload?.asOfDate || null,
    inputs: (inputs || []).map((item) => item.payload || item),
    evidenceSet: evidenceSet?.payload || evidenceSet
  });
}

export { organizationPermissions, codeQuestionFeatureFlag };
