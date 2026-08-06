/**
 * Code Question workspace contracts (Phase 0 scaffolding).
 *
 * Pure domain normalization, lifecycle/readiness derivation, feature-flag helpers,
 * and transition tables. Storage, server handlers, and UI remain Phase 1+.
 *
 * Feature flag ID: permitext:codeQuestionWorkspace (capability: code-question-workspace)
 * Default: disabled. When disabled, no product navigation or API surface is exposed.
 */

import { createHash } from "node:crypto";

export const codeQuestionContractSchemaVersion = 1;

/** Server / client capability and feature-flag identifiers. */
export const codeQuestionFeatureFlag = Object.freeze({
  /** Stable product flag name used in docs and rollout config. */
  name: "permitext:codeQuestionWorkspace",
  /** Capability ID exposed on capabilityContract.capabilities. */
  capabilityID: "code-question-workspace",
  /** Default release state while Phase 0–1 land. */
  defaultEnabled: false,
  release: "unavailable"
});

/**
 * Resolve whether the Code Question workspace is enabled for a request/session.
 * Defaults to disabled. Does not enable UI by itself — callers must gate on this.
 */
export function isCodeQuestionWorkspaceEnabled(options = {}) {
  if (options?.codeQuestionWorkspaceEnabled === true) return true;
  if (options?.capabilities?.[codeQuestionFeatureFlag.capabilityID]?.enabled === true) {
    return true;
  }
  if (options?.featureFlags?.[codeQuestionFeatureFlag.name] === true) return true;
  return false;
}

export const codeQuestionArtifactKinds = Object.freeze([
  "codeQuestion",
  "questionInput",
  "evidenceSnapshotV2",
  "questionEvidenceSet",
  "questionAnalysis",
  "professionalConclusion",
  "conclusionApproval",
  "codeMemoReadiness",
  "codeMemoApproval",
  "issuedDecisionRecord"
]);

export const codeQuestionWorkflowStages = Object.freeze([
  "define",
  "evidence",
  "analyze",
  "review",
  "issue"
]);

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

export const evidenceProposalStates = Object.freeze([
  "proposed",
  "verification-blocked",
  "approved",
  "rejected",
  "excluded"
]);

export const evidenceRoles = Object.freeze([
  "governing",
  "supporting",
  "conflicting"
]);

export const questionRecordStates = Object.freeze([
  "active",
  "archived"
]);

export const codeMemoIssueStates = Object.freeze([
  "draft",
  "ready-for-approval",
  "approved",
  "issuing",
  "issued",
  "superseded"
]);

export const reviewRequestTypes = Object.freeze([
  "fact-request",
  "evidence-review",
  "interpretation-review",
  "revision-request"
]);

export const readinessClassifications = Object.freeze([
  "blocker",
  "disclosed-limitation",
  "accepted-condition"
]);

/** Canonical transition table (storage must not collapse these into one mutable status). */
export const codeQuestionTransitions = Object.freeze([
  {
    record: "codeQuestion",
    from: "nonexistent",
    to: "active",
    authorized: ["owner", "editor"],
    effect: "allocate-stable-id-and-project-question-number"
  },
  {
    record: "codeQuestion",
    from: "active",
    to: "archived",
    authorized: ["owner", "editor"],
    effect: "hide-from-active-list-preserve-history"
  },
  {
    record: "codeQuestion",
    from: "archived",
    to: "active",
    authorized: ["owner", "editor"],
    effect: "restore-without-mutating-history"
  },
  {
    record: "evidenceProposal",
    from: "proposed",
    to: "approved",
    authorized: ["reviewer", "owner"],
    effect: "immutable-snapshot-and-new-evidence-set-version"
  },
  {
    record: "evidenceProposal",
    from: "proposed",
    to: "rejected",
    authorized: ["reviewer", "owner"],
    effect: "audit-only-no-model-input"
  },
  {
    record: "evidenceProposal",
    from: "proposed",
    to: "verification-blocked",
    authorized: ["reviewer", "owner"],
    effect: "audit-only-no-model-input"
  },
  {
    record: "evidenceProposal",
    from: "proposed",
    to: "excluded",
    authorized: ["reviewer", "owner"],
    effect: "audit-only-no-model-input"
  },
  {
    record: "evidenceSet",
    from: "vN",
    to: "vN+1",
    authorized: ["reviewer", "owner"],
    effect: "version-add-remove-reclassify-stale-dependents"
  },
  {
    record: "analysisRun",
    from: "nonexistent",
    to: "immutable",
    authorized: ["owner", "editor"],
    effect: "server-bound-research-answer-plus-descriptor"
  },
  {
    record: "conclusion",
    from: "working-draft",
    to: "immutable-revision",
    authorized: ["owner", "editor"],
    effect: "bind-dependency-hashes"
  },
  {
    record: "conclusionApproval",
    from: "unapproved",
    to: "approved",
    authorized: ["reviewer", "owner"],
    effect: "target-one-immutable-revision"
  },
  {
    record: "reviewRequest",
    from: "open",
    to: "waiting",
    authorized: ["assignee", "reviewer", "editor"],
    effect: "record-actor-time"
  },
  {
    record: "reviewRequest",
    from: "waiting",
    to: "open",
    authorized: ["assignee", "reviewer", "editor"],
    effect: "record-actor-time"
  },
  {
    record: "reviewRequest",
    from: "open",
    to: "resolved",
    authorized: ["reviewer", "assignee"],
    effect: "immutable-comments-plus-resolution-event"
  },
  {
    record: "reviewRequest",
    from: "open",
    to: "dismissed",
    authorized: ["reviewer", "assignee"],
    effect: "immutable-comments-plus-resolution-event"
  },
  {
    record: "reviewRequest",
    from: "resolved",
    to: "open",
    authorized: ["reopen"],
    effect: "append-reopen-event-increment-round-never-store-reopened-status"
  },
  {
    record: "reviewRequest",
    from: "dismissed",
    to: "open",
    authorized: ["reopen"],
    effect: "append-reopen-event-increment-round-never-store-reopened-status"
  },
  {
    record: "codeMemo",
    from: "draft",
    to: "ready-for-approval",
    authorized: ["owner", "editor"],
    effect: "validate-dependencies-no-issue-date"
  },
  {
    record: "codeMemo",
    from: "ready-for-approval",
    to: "draft",
    authorized: ["system", "editor"],
    effect: "invalidate-ready-on-content-change"
  },
  {
    record: "codeMemo",
    from: "ready-for-approval",
    to: "approved",
    authorized: ["reviewer", "owner"],
    effect: "bind-draft-and-conclusion-hashes"
  },
  {
    record: "codeMemo",
    from: "approved",
    to: "issuing",
    authorized: ["issuer"],
    effect: "start-idempotent-issuance-saga"
  },
  {
    record: "codeMemo",
    from: "issuing",
    to: "approved",
    authorized: ["system"],
    effect: "durable-failure-no-issued-record"
  },
  {
    record: "codeMemo",
    from: "issuing",
    to: "issued",
    authorized: ["server"],
    effect: "commit-manifest-v3-wrapper-links-activity"
  },
  {
    record: "issuedRecord",
    from: "issued",
    to: "superseded",
    authorized: ["server"],
    effect: "link-successor-preserve-prior"
  }
]);

const artifactKindSet = new Set(codeQuestionArtifactKinds);
const stageSet = new Set(codeQuestionWorkflowStages);
const inputKindSet = new Set(questionInputKinds);
const inputStateSet = new Set(questionInputStates);
const evidenceRoleSet = new Set(evidenceRoles);
const evidenceProposalStateSet = new Set(evidenceProposalStates);
const questionStateSet = new Set(questionRecordStates);
const issueStateSet = new Set(codeMemoIssueStates);

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

function requiredISO(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}.`);
  return new Date(parsed).toISOString();
}

function optionalISO(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return requiredISO(value, label);
}

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function nonNegativeInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Invalid ${label}.`);
  }
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

export function stableCodeQuestionJSON(value) {
  return JSON.stringify(stableValue(value));
}

export function contentHash(value) {
  return createHash("sha256").update(stableCodeQuestionJSON(value)).digest("hex");
}

/**
 * Format a Project-scoped display ID such as Q-001.
 * Allocation uniqueness is a storage concern (Phase 1); this only formats.
 */
export function formatQuestionDisplayID(questionNumber) {
  const n = positiveInteger(questionNumber, "question number");
  return `Q-${String(n).padStart(3, "0")}`;
}

/**
 * Validate a proposed transition against the canonical table.
 * Does not mutate state — Phase 1 storage applies authorized transitions.
 */
export function assertValidTransition(record, from, to) {
  const match = codeQuestionTransitions.find(
    (row) => row.record === record && row.from === from && row.to === to
  );
  if (!match) {
    throw new Error(`Invalid ${record} transition ${from} → ${to}.`);
  }
  return match;
}

export function isValidTransition(record, from, to) {
  try {
    assertValidTransition(record, from, to);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a Code Question definition revision payload.
 */
export function normalizeCodeQuestionPayload({
  projectID,
  displayID,
  questionNumber,
  title,
  questionText,
  scope = "",
  desiredOutput = "",
  jurisdiction = "",
  asOfDate = null,
  responsibleUserID = null,
  assigneeUserID = null,
  reviewerUserID = null,
  recordState = "active",
  definitionRevision = 1,
  currentEvidenceSetVersion = null,
  currentAnalysisID = null,
  currentConclusionRevision = null,
  latestIssuedRecordID = null,
  createdBy,
  updatedBy,
  createdAt,
  updatedAt,
  expectedVersion = 1,
  archivedAt = null
}) {
  const state = String(recordState || "active").trim();
  if (!questionStateSet.has(state)) throw new Error("Invalid Code Question record state.");
  const number = positiveInteger(questionNumber, "question number");
  const formattedDisplayID = requiredText(displayID || formatQuestionDisplayID(number), "display ID", 32);
  if (formattedDisplayID !== formatQuestionDisplayID(number)) {
    throw new Error("Code Question display ID must match its Project question number.");
  }
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "codeQuestion",
    projectID: requiredText(projectID, "project ID", 256),
    displayID: formattedDisplayID,
    questionNumber: number,
    title: requiredText(title, "question title", 240),
    questionText: requiredText(questionText, "question text", 8_000),
    scope: optionalText(scope, 4_000),
    desiredOutput: optionalText(desiredOutput, 2_000),
    jurisdiction: optionalText(jurisdiction, 240),
    asOfDate: optionalISO(asOfDate, "as-of date"),
    responsibleUserID: responsibleUserID
      ? requiredText(responsibleUserID, "responsible user ID", 256)
      : null,
    assigneeUserID: assigneeUserID
      ? requiredText(assigneeUserID, "assignee user ID", 256)
      : null,
    reviewerUserID: reviewerUserID
      ? requiredText(reviewerUserID, "reviewer user ID", 256)
      : null,
    recordState: state,
    definitionRevision: positiveInteger(definitionRevision, "definition revision"),
    currentEvidenceSetVersion: currentEvidenceSetVersion == null
      ? null
      : positiveInteger(currentEvidenceSetVersion, "evidence set version"),
    currentAnalysisID: currentAnalysisID
      ? requiredText(currentAnalysisID, "analysis ID", 256)
      : null,
    currentConclusionRevision: currentConclusionRevision == null
      ? null
      : positiveInteger(currentConclusionRevision, "conclusion revision"),
    latestIssuedRecordID: latestIssuedRecordID
      ? requiredText(latestIssuedRecordID, "issued record ID", 256)
      : null,
    createdBy: requiredText(createdBy, "created by", 256),
    updatedBy: requiredText(updatedBy || createdBy, "updated by", 256),
    createdAt: requiredISO(createdAt, "created date"),
    updatedAt: requiredISO(updatedAt || createdAt, "updated date"),
    expectedVersion: positiveInteger(expectedVersion, "expected version"),
    archivedAt: optionalISO(archivedAt, "archived date")
  };
}

export function normalizeQuestionInputPayload({
  id,
  questionID,
  kind,
  statement,
  state = "proposed",
  basis = "",
  responsibleUserID = null,
  revision = 1,
  priorInputID = null,
  createdBy,
  updatedBy,
  createdAt,
  updatedAt
}) {
  const inputKind = String(kind || "").trim();
  if (!inputKindSet.has(inputKind)) throw new Error("Invalid question input kind.");
  const inputState = String(state || "proposed").trim();
  if (!inputStateSet.has(inputState)) throw new Error("Invalid question input state.");
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "questionInput",
    id: requiredText(id, "question input ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    inputKind,
    statement: requiredText(statement, "input statement", 4_000),
    state: inputState,
    basis: optionalText(basis, 2_000),
    responsibleUserID: responsibleUserID
      ? requiredText(responsibleUserID, "responsible user ID", 256)
      : null,
    revision: positiveInteger(revision, "input revision"),
    priorInputID: priorInputID
      ? requiredText(priorInputID, "prior input ID", 256)
      : null,
    createdBy: requiredText(createdBy, "created by", 256),
    updatedBy: requiredText(updatedBy || createdBy, "updated by", 256),
    createdAt: requiredISO(createdAt, "created date"),
    updatedAt: requiredISO(updatedAt || createdAt, "updated date")
  };
}

/**
 * Immutable evidence snapshot v2 content (hash excludes set number, approval, rationale).
 */
export function normalizeEvidenceSnapshotV2({
  id,
  sourceIdentity,
  passageLocator,
  quotedText,
  textHash = null,
  structuredMaterial = null,
  sourceVersion = "",
  createdAt
}) {
  const quoted = requiredText(quotedText, "quoted passage text", 50_000);
  const hash = textHash || contentHash({ quotedText: quoted, passageLocator, sourceIdentity });
  return {
    schemaVersion: 2,
    kind: "evidenceSnapshotV2",
    id: requiredText(id, "evidence snapshot ID", 256),
    sourceIdentity: requiredText(sourceIdentity, "source identity", 512),
    passageLocator: requiredText(passageLocator, "passage locator", 512),
    quotedText: quoted,
    textHash: requiredText(hash, "text hash", 128),
    structuredMaterial: structuredMaterial && typeof structuredMaterial === "object"
      ? structuredMaterial
      : null,
    sourceVersion: optionalText(sourceVersion, 240),
    createdAt: requiredISO(createdAt, "snapshot created date")
  };
}

export function normalizeEvidenceSetEntry({
  snapshotID,
  role = "supporting",
  analysisEligible = true,
  qualification = "",
  professionalNote = "",
  approvalActor,
  approvalAt,
  sourceVerificationState = "verified",
  projectApplicabilityNote = ""
}) {
  const evidenceRole = String(role || "supporting").trim();
  if (!evidenceRoleSet.has(evidenceRole)) throw new Error("Invalid evidence role.");
  return {
    snapshotID: requiredText(snapshotID, "snapshot ID", 256),
    role: evidenceRole,
    analysisEligible: analysisEligible === true,
    qualification: optionalText(qualification, 2_000),
    professionalNote: optionalText(professionalNote, 4_000),
    approvalActor: requiredText(approvalActor, "approval actor", 256),
    approvalAt: requiredISO(approvalAt, "approval time"),
    sourceVerificationState: requiredText(sourceVerificationState, "source verification state", 64),
    projectApplicabilityNote: optionalText(projectApplicabilityNote, 2_000)
  };
}

export function normalizeQuestionEvidenceSetPayload({
  id,
  questionID,
  version,
  entries = [],
  createdBy,
  createdAt
}) {
  if (!Array.isArray(entries)) throw new Error("Evidence Set entries must be an array.");
  const normalizedEntries = entries.map((entry) => normalizeEvidenceSetEntry(entry));
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "questionEvidenceSet",
    id: requiredText(id, "evidence set ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    version: positiveInteger(version, "evidence set version"),
    entries: normalizedEntries,
    contentHash: contentHash({
      questionID,
      version,
      entries: normalizedEntries.map((entry) => ({
        snapshotID: entry.snapshotID,
        role: entry.role,
        analysisEligible: entry.analysisEligible,
        qualification: entry.qualification
      }))
    }),
    createdBy: requiredText(createdBy, "created by", 256),
    createdAt: requiredISO(createdAt, "created date")
  };
}

export function normalizeQuestionAnalysisPayload({
  id,
  questionID,
  definitionRevision,
  definitionHash,
  inputSnapshotIDs = [],
  inputSetHash,
  evidenceSetID,
  evidenceSetVersion,
  evidenceSetHash,
  dependencyHash,
  researchAnswerID,
  modelID = "",
  analysisPolicyID = "",
  promptTemplateVersion = "",
  requestedBy,
  createdAt,
  requestID,
  citationValidation = "pending"
}) {
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "questionAnalysis",
    id: requiredText(id, "analysis ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    definitionRevision: positiveInteger(definitionRevision, "definition revision"),
    definitionHash: requiredText(definitionHash, "definition hash", 128),
    inputSnapshotIDs: (Array.isArray(inputSnapshotIDs) ? inputSnapshotIDs : [])
      .map((value) => requiredText(value, "input snapshot ID", 256)),
    inputSetHash: requiredText(inputSetHash, "input set hash", 128),
    evidenceSetID: requiredText(evidenceSetID, "evidence set ID", 256),
    evidenceSetVersion: positiveInteger(evidenceSetVersion, "evidence set version"),
    evidenceSetHash: requiredText(evidenceSetHash, "evidence set hash", 128),
    dependencyHash: requiredText(dependencyHash, "dependency hash", 128),
    researchAnswerID: requiredText(researchAnswerID, "research answer ID", 256),
    modelID: optionalText(modelID, 240),
    analysisPolicyID: optionalText(analysisPolicyID, 240),
    promptTemplateVersion: optionalText(promptTemplateVersion, 64),
    requestedBy: requiredText(requestedBy, "requested by", 256),
    createdAt: requiredISO(createdAt, "created date"),
    requestID: requiredText(requestID, "request ID", 256),
    citationValidation: requiredText(citationValidation, "citation validation", 64)
  };
}

export function normalizeProfessionalConclusionPayload({
  id,
  questionID,
  revision,
  definitionRevision,
  definitionHash,
  inputSetHash,
  evidenceSetID,
  evidenceSetVersion,
  evidenceSetHash,
  analysisRunID = null,
  analysisDependencyHash = null,
  conclusionText,
  reasoning = "",
  citations = [],
  assumptions = [],
  unknowns = [],
  aiAssistanceDisclosure = "",
  predecessorRevisionID = null,
  authorUserID,
  createdAt
}) {
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "professionalConclusion",
    id: requiredText(id, "conclusion ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    revision: positiveInteger(revision, "conclusion revision"),
    definitionRevision: positiveInteger(definitionRevision, "definition revision"),
    definitionHash: requiredText(definitionHash, "definition hash", 128),
    inputSetHash: requiredText(inputSetHash, "input set hash", 128),
    evidenceSetID: requiredText(evidenceSetID, "evidence set ID", 256),
    evidenceSetVersion: positiveInteger(evidenceSetVersion, "evidence set version"),
    evidenceSetHash: requiredText(evidenceSetHash, "evidence set hash", 128),
    analysisRunID: analysisRunID
      ? requiredText(analysisRunID, "analysis run ID", 256)
      : null,
    analysisDependencyHash: analysisDependencyHash
      ? requiredText(analysisDependencyHash, "analysis dependency hash", 128)
      : null,
    conclusionText: requiredText(conclusionText, "conclusion text", 20_000),
    reasoning: optionalText(reasoning, 20_000),
    citations: (Array.isArray(citations) ? citations : [])
      .map((value) => requiredText(value, "citation snapshot ID", 256)),
    assumptions: (Array.isArray(assumptions) ? assumptions : [])
      .map((value) => requiredText(value, "assumption statement", 4_000)),
    unknowns: (Array.isArray(unknowns) ? unknowns : [])
      .map((value) => requiredText(value, "unknown statement", 4_000)),
    aiAssistanceDisclosure: optionalText(aiAssistanceDisclosure, 2_000),
    predecessorRevisionID: predecessorRevisionID
      ? requiredText(predecessorRevisionID, "predecessor revision ID", 256)
      : null,
    authorUserID: requiredText(authorUserID, "author user ID", 256),
    createdAt: requiredISO(createdAt, "created date")
  };
}

export function normalizeConclusionApprovalPayload({
  id,
  questionID,
  conclusionID,
  conclusionRevision,
  dependencyHash,
  reviewRound,
  approvalBasis,
  approvedByUserID,
  approvedAt
}) {
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "conclusionApproval",
    id: requiredText(id, "approval ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    conclusionID: requiredText(conclusionID, "conclusion ID", 256),
    conclusionRevision: positiveInteger(conclusionRevision, "conclusion revision"),
    dependencyHash: requiredText(dependencyHash, "approval dependency hash", 128),
    reviewRound: positiveInteger(reviewRound, "review round"),
    approvalBasis: requiredText(approvalBasis, "approval basis", 4_000),
    approvedByUserID: requiredText(approvedByUserID, "approval actor", 256),
    approvedAt: requiredISO(approvedAt, "approval time")
  };
}

export function normalizeCodeMemoApprovalPayload({
  id,
  questionID,
  draftID,
  draftRevision,
  draftHash,
  conclusionID,
  conclusionRevision,
  conclusionHash,
  approvalBasis,
  approvedByUserID,
  approvedAt
}) {
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "codeMemoApproval",
    id: requiredText(id, "Code Memo approval ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    draftID: requiredText(draftID, "Code Memo Draft ID", 256),
    draftRevision: positiveInteger(draftRevision, "Code Memo Draft revision"),
    draftHash: requiredText(draftHash, "Code Memo Draft hash", 256),
    conclusionID: requiredText(conclusionID, "conclusion ID", 256),
    conclusionRevision: positiveInteger(conclusionRevision, "conclusion revision"),
    conclusionHash: requiredText(conclusionHash, "conclusion hash", 256),
    approvalBasis: requiredText(approvalBasis, "Code Memo approval basis", 4_000),
    approvedByUserID: requiredText(approvedByUserID, "Code Memo approval actor", 256),
    approvedAt: requiredISO(approvedAt, "Code Memo approval time")
  };
}

export function normalizeCodeMemoReadinessPayload({
  id,
  questionID,
  draftID,
  draftRevision,
  draftHash,
  checks,
  markedByUserID,
  markedAt
}) {
  const normalizedChecks = (Array.isArray(checks) ? checks : []).map((check) => ({
    id: requiredText(check.id, "readiness check ID", 128),
    label: requiredText(check.label, "readiness check label", 240),
    ready: check.ready === true,
    message: requiredText(check.message, "readiness check message", 2_000)
  }));
  if (!normalizedChecks.length || normalizedChecks.some((check) => !check.ready)) {
    throw new Error("Code Memo readiness requires every check to pass.");
  }
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "codeMemoReadiness",
    id: requiredText(id, "Code Memo readiness ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    draftID: requiredText(draftID, "Code Memo Draft ID", 256),
    draftRevision: positiveInteger(draftRevision, "Code Memo Draft revision"),
    draftHash: requiredText(draftHash, "Code Memo Draft hash", 256),
    checks: normalizedChecks,
    markedByUserID: requiredText(markedByUserID, "readiness actor", 256),
    markedAt: requiredISO(markedAt, "readiness time")
  };
}

export function normalizeIssuedDecisionRecordPayload({
  id,
  questionID,
  issueVersion,
  status = "issued",
  reportManifestID,
  componentVersions = {},
  componentHashes = {},
  issuingActor,
  approvalBasis = "",
  predecessorID = null,
  successorID = null,
  supersessionReason = "",
  issuedAt
}) {
  const issueStatus = String(status || "issued").trim().toLowerCase();
  if (issueStatus !== "issued" && issueStatus !== "superseded") {
    throw new Error("Invalid issued decision record status.");
  }
  return {
    schemaVersion: codeQuestionContractSchemaVersion,
    kind: "issuedDecisionRecord",
    id: requiredText(id, "issued record ID", 256),
    questionID: requiredText(questionID, "question ID", 256),
    issueVersion: positiveInteger(issueVersion, "issue version"),
    status: issueStatus,
    reportManifestID: requiredText(reportManifestID, "report manifest ID", 256),
    componentVersions: componentVersions && typeof componentVersions === "object"
      ? componentVersions
      : {},
    componentHashes: componentHashes && typeof componentHashes === "object"
      ? componentHashes
      : {},
    issuingActor: requiredText(issuingActor, "issuing actor", 256),
    approvalBasis: optionalText(approvalBasis, 4_000),
    predecessorID: predecessorID
      ? requiredText(predecessorID, "predecessor ID", 256)
      : null,
    successorID: successorID
      ? requiredText(successorID, "successor ID", 256)
      : null,
    supersessionReason: optionalText(supersessionReason, 2_000),
    issuedAt: requiredISO(issuedAt, "issued date")
  };
}

/**
 * Compute the canonical dependency hash for analysis/conclusion staleness.
 * Excludes presentation-only metadata (project color, pane layout, timestamps, assignee display).
 */
export function computeDependencyHash({
  questionText,
  scope = "",
  jurisdiction = "",
  asOfDate = null,
  inputs = [],
  evidenceSet
}) {
  const payload = {
    questionText: requiredText(questionText, "question text", 8_000),
    scope: optionalText(scope, 4_000),
    jurisdiction: optionalText(jurisdiction, 240),
    asOfDate: asOfDate || null,
    inputs: (Array.isArray(inputs) ? inputs : []).map((input) => ({
      id: input.id,
      inputKind: input.inputKind || input.kind,
      state: input.state,
      statement: input.statement,
      revision: input.revision
    })),
    evidenceSet: {
      id: evidenceSet?.id,
      version: evidenceSet?.version,
      contentHash: evidenceSet?.contentHash,
      entries: (evidenceSet?.entries || []).map((entry) => ({
        snapshotID: entry.snapshotID,
        role: entry.role,
        analysisEligible: entry.analysisEligible,
        qualification: entry.qualification
      }))
    }
  };
  return contentHash(payload);
}

/**
 * Derive display readiness for a Code Question without mutating shared professional state.
 * Per-user stage is workspace state; this returns blockers/limitations for gates.
 */
export function deriveQuestionReadiness({
  question,
  inputs = [],
  evidenceSet = null,
  analysis = null,
  conclusion = null,
  blockingReviewOpen = false,
  currentDependencyHash = null
}) {
  const blockers = [];
  const disclosedLimitations = [];
  const acceptedConditions = [];

  if (!question || question.recordState === "archived") {
    blockers.push({ code: "question-inactive", message: "Code Question is not active." });
  }
  if (!String(question?.questionText || "").trim()) {
    blockers.push({ code: "missing-question-text", message: "Precise question text is required." });
  }

  const confirmedFacts = inputs.filter((item) => item.inputKind === "confirmedFact" && item.state === "confirmed");
  const unknowns = inputs.filter((item) => item.inputKind === "unknown" && item.state !== "resolved" && item.state !== "retired");
  const assumptions = inputs.filter((item) => item.inputKind === "assumption" && item.state !== "retired");

  for (const unknown of unknowns) {
    blockers.push({
      code: "unresolved-unknown",
      message: `Unresolved unknown: ${unknown.statement}`,
      inputID: unknown.id,
      classification: "blocker"
    });
  }

  const approvedEntries = (evidenceSet?.entries || []).filter((entry) => entry.analysisEligible !== false);
  if (!evidenceSet || approvedEntries.length === 0) {
    blockers.push({ code: "no-approved-evidence", message: "At least one approved analysis-eligible evidence entry is required." });
  }

  if (analysis && currentDependencyHash && analysis.dependencyHash !== currentDependencyHash) {
    disclosedLimitations.push({
      code: "stale-analysis",
      message: "Selected analysis is stale relative to current dependencies.",
      classification: "disclosed-limitation"
    });
  }

  if (!conclusion || !String(conclusion.conclusionText || "").trim()) {
    blockers.push({ code: "missing-conclusion", message: "A published professional conclusion is required before approval." });
  }

  if (blockingReviewOpen) {
    blockers.push({ code: "open-blocking-review", message: "Blocking Review Requests remain open." });
  }

  for (const assumption of assumptions) {
    acceptedConditions.push({
      code: "assumption",
      message: assumption.statement,
      inputID: assumption.id,
      classification: "accepted-condition"
    });
  }

  return {
    canApprove: blockers.length === 0,
    canIssue: blockers.length === 0,
    blockers,
    disclosedLimitations,
    acceptedConditions,
    summary: {
      confirmedFactCount: confirmedFacts.length,
      assumptionCount: assumptions.length,
      unknownCount: unknowns.length,
      approvedEvidenceCount: approvedEntries.length,
      hasConclusion: Boolean(conclusion?.conclusionText),
      analysisStale: Boolean(
        analysis && currentDependencyHash && analysis.dependencyHash !== currentDependencyHash
      )
    }
  };
}

/**
 * Derived list label for mixed issued + in-progress work. Not canonical storage.
 */
export function deriveQuestionListLabel({ question, latestIssuedVersion = null, revisionInProgress = false }) {
  const parts = [];
  if (latestIssuedVersion != null) {
    parts.push(`Issued v${positiveInteger(latestIssuedVersion, "issued version")}`);
  }
  if (revisionInProgress) parts.push("Revision in progress");
  if (parts.length === 0) {
    if (question?.recordState === "archived") return "Archived";
    return "Active";
  }
  return parts.join(" · ");
}

/**
 * Map Review Request type labels onto legacy collaboration kinds for adapters.
 */
export function reviewRequestTypeToLegacyKind(requestType) {
  switch (String(requestType || "").trim()) {
    case "fact-request":
      return "missing-project-fact";
    case "revision-request":
      return "revision-request";
    case "evidence-review":
    case "interpretation-review":
      return "general-review";
    default:
      throw new Error("Invalid review request type.");
  }
}

/**
 * Per-user workflow stage is workspace state — never advance shared approval/issue state.
 */
export function normalizeWorkspaceStage(stage) {
  const normalized = String(stage || "define").trim().toLowerCase();
  if (!stageSet.has(normalized)) throw new Error("Invalid Code Question workspace stage.");
  return normalized;
}

/**
 * Pane identity for question-scoped columns: project + question + role.
 */
export function questionPaneKey({ projectID, questionID, paneRole }) {
  return [
    "cq",
    requiredText(projectID, "project ID", 256),
    requiredText(questionID, "question ID", 256),
    requiredText(paneRole, "pane role", 64)
  ].join(":");
}

export function isCodeQuestionArtifactKind(kind) {
  return artifactKindSet.has(String(kind || "").trim());
}

/**
 * Capability fragment for capabilityContract integration (default disabled).
 */
export function codeQuestionCapabilityFragment(options = {}) {
  const enabled = isCodeQuestionWorkspaceEnabled(options);
  return {
    [codeQuestionFeatureFlag.capabilityID]: {
      enabled,
      release: enabled ? (options.release || "private-beta") : codeQuestionFeatureFlag.release,
      featureFlag: codeQuestionFeatureFlag.name
    }
  };
}

/**
 * Assert that assumptions are never labeled as confirmed facts in a presentation model.
 */
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

/**
 * Phase 1 storage requirements expressed as a frozen checklist for tests/ADRs.
 * These are not implemented here; tests assert the checklist remains complete.
 */
export const phase1StorageRequirements = Object.freeze({
  uniquenessScopes: Object.freeze([
    "(projectID, questionNumber)",
    "(questionID, evidenceSetVersion)",
    "(questionID, issueVersion)"
  ]),
  concurrency: "atomic-expectedVersion-compare-and-swap",
  offlineTransport: "dedicated-idempotent-question-command-outbox-or-equivalent-mutation-kinds",
  issuance: "idempotent-saga-with-pending-record-and-staged-file-recovery",
  adapters: Object.freeze([
    "report-draft-v1-to-v2",
    "report-manifest-v1-v2-to-v3",
    "review-requestType-on-legacy-kind",
    "code-trust-v1-to-v2"
  ]),
  unknownRecordPolicy: "preserve-and-ignore",
  migrationPolicy: "additive-idempotent-explicit-promotion-for-user-content"
});
