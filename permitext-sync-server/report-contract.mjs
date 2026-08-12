import { createHash, randomUUID } from "node:crypto";

export const reportDraftSchemaVersion = 1;
export const reportDraftSchemaVersionV2 = 2;
export const reportManifestSchemaVersion = 2;
export const reportManifestSchemaVersionV3 = 3;
export const reportGeneratorVersion = "permitext-report-v2";
export const reportGeneratorVersionV3 = "permitext-report-v3";
export const codeDecisionMemoRecordType = "codeDecisionMemo";

const unavailableReportEvidenceCodes = new Set([
  "ENOENT",
  "INCOMPLETE_RESEARCH_SECTION",
  "INVALID_RESEARCH_SECTION"
]);

export function unavailableReportEvidenceWarning(error, section = {}) {
  if (!unavailableReportEvidenceCodes.has(error?.code)) return null;
  return {
    kind: "evidence",
    sourceID: String(section.canonicalID || section.requestedID || ""),
    code: error.code,
    message: [section.sectionNumber, section.title].filter(Boolean).join(" ") ||
      `Linked section ${section.requestedID || section.canonicalID || "is unavailable"}`
  };
}

export const reportDraftBlockKinds = Object.freeze([
  "heading",
  "paragraph",
  "list",
  "projectFacts",
  "evidence",
  "notebookCard",
  "researchAnswer",
  "workboardPreview",
  "attachment"
]);

const authoredBlockKinds = new Set(["heading", "paragraph", "list"]);
const referencedBlockKinds = new Set(
  reportDraftBlockKinds.filter((kind) => !authoredBlockKinds.has(kind))
);
const maximumDraftBlocks = 200;
const maximumAuthoredTextLength = 20_000;

function requiredText(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function optionalText(value, maximum = 20_000) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error("Report text is too long.");
  return normalized;
}

function requiredISO(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}.`);
  return new Date(parsed).toISOString();
}

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function normalizeReportPresentation(presentation) {
  if (!presentation) return null;
  const accentColorHex = String(presentation.branding?.accentColorHex || "").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(accentColorHex)) {
    throw new Error("Invalid Report branding accent color.");
  }
  return {
    firmControlsVersion: positiveInteger(
      presentation.firmControlsVersion,
      "Report firm controls version"
    ),
    organization: presentation.organization ? {
      id: requiredText(presentation.organization.id, "Report organization ID", 256),
      name: requiredText(presentation.organization.name, "Report organization name", 160)
    } : null,
    template: {
      id: requiredText(presentation.template?.id, "Report template ID", 256),
      name: requiredText(presentation.template?.name, "Report template name", 120),
      coverLabel: requiredText(
        presentation.template?.coverLabel,
        "Report template cover label",
        160
      )
    },
    branding: {
      displayName: requiredText(
        presentation.branding?.displayName,
        "Report branding name",
        160
      ),
      accentColorHex,
      website: optionalText(presentation.branding?.website, 500) || null,
      footerText: optionalText(presentation.branding?.footerText, 500) || null
    }
  };
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

export function stableReportJSON(value) {
  return JSON.stringify(stableValue(value));
}

function normalizeAuthoredBlock(block, kind) {
  if (kind === "list") {
    const items = (Array.isArray(block.items) ? block.items : [])
      .map((item) => optionalText(item, 2_000))
      .filter(Boolean);
    if (!items.length || items.length > 100) throw new Error("Report lists require 1 to 100 items.");
    return { items };
  }
  return {
    text: requiredText(
      block.text,
      kind === "heading" ? "Report heading" : "Report paragraph",
      kind === "heading" ? 500 : maximumAuthoredTextLength
    )
  };
}

export function normalizeReportDraftBlock(block, index = 0) {
  const kind = requiredText(block?.kind, "Report block kind", 64);
  if (!reportDraftBlockKinds.includes(kind)) throw new Error("Unsupported Report block kind.");
  const normalized = {
    id: requiredText(block?.id || randomUUID(), "Report block ID", 256),
    kind,
    order: index
  };
  if (authoredBlockKinds.has(kind)) {
    return {
      ...normalized,
      sourceClassification: "user-authored",
      ...normalizeAuthoredBlock(block, kind)
    };
  }
  if (!referencedBlockKinds.has(kind)) throw new Error("Unsupported Report source block.");
  return {
    ...normalized,
    sourceID: requiredText(block?.sourceID, "Report source ID", 256),
    label: requiredText(block?.label, "Report source label", 500)
  };
}

export function normalizeReportDraftPayload({
  title,
  reportDate,
  introduction = "",
  blocks,
  createdBy,
  updatedBy
}) {
  const sourceBlocks = Array.isArray(blocks) ? blocks : [];
  if (sourceBlocks.length > maximumDraftBlocks) {
    throw new Error(`Report Drafts are limited to ${maximumDraftBlocks} blocks.`);
  }
  const normalizedBlocks = sourceBlocks.map(normalizeReportDraftBlock);
  const seenIDs = new Set();
  normalizedBlocks.forEach((block) => {
    if (seenIDs.has(block.id)) throw new Error("Report block IDs must be unique.");
    seenIDs.add(block.id);
  });
  return {
    schemaVersion: reportDraftSchemaVersion,
    title: requiredText(title, "Report title", 300),
    reportDate: requiredISO(reportDate, "Report date"),
    introduction: optionalText(introduction, maximumAuthoredTextLength),
    blocks: normalizedBlocks,
    createdBy: requiredText(createdBy, "Report Draft creator", 256),
    updatedBy: requiredText(updatedBy, "Report Draft editor", 256)
  };
}

/**
 * Report Draft v2 for typed Code Decision Memos (and future typed drafts).
 * Does not mutate stored v1 payloads — callers must store v2 as a distinct revision.
 */
export function normalizeReportDraftPayloadV2({
  title,
  reportDate,
  introduction = "",
  blocks,
  createdBy,
  updatedBy,
  recordType = codeDecisionMemoRecordType,
  questionID,
  projectID = null,
  draftRevision = 1,
  codeMemo = null
}) {
  const base = normalizeReportDraftPayload({
    title,
    reportDate,
    introduction,
    blocks,
    createdBy,
    updatedBy
  });
  const normalizedRecordType = requiredText(recordType, "Report record type", 64);
  if (normalizedRecordType === codeDecisionMemoRecordType && !questionID) {
    throw new Error("Code Decision Memo drafts require a questionID.");
  }
  const normalized = {
    ...base,
    schemaVersion: reportDraftSchemaVersionV2,
    recordType: normalizedRecordType,
    questionID: questionID
      ? requiredText(questionID, "Code Question ID", 256)
      : null,
    projectID: projectID
      ? requiredText(projectID, "Project ID", 256)
      : null,
    draftRevision: positiveInteger(draftRevision, "draft revision"),
    codeMemo: codeMemo && typeof codeMemo === "object" && !Array.isArray(codeMemo)
      ? {
          conclusionRevision: codeMemo.conclusionRevision == null
            ? null
            : positiveInteger(codeMemo.conclusionRevision, "conclusion revision"),
          evidenceSetVersion: codeMemo.evidenceSetVersion == null
            ? null
            : positiveInteger(codeMemo.evidenceSetVersion, "evidence set version"),
          definitionRevision: codeMemo.definitionRevision == null
            ? null
            : positiveInteger(codeMemo.definitionRevision, "definition revision"),
          analysisRunID: codeMemo.analysisRunID
            ? requiredText(codeMemo.analysisRunID, "analysis run ID", 256)
            : null,
          readinessState: optionalText(codeMemo.readinessState, 64) || null,
          includeAnalysis: codeMemo.includeAnalysis !== false,
          definitionHash: optionalText(codeMemo.definitionHash, 256) || null,
          inputSetHash: optionalText(codeMemo.inputSetHash, 256) || null,
          evidenceSetID: optionalText(codeMemo.evidenceSetID, 256) || null,
          evidenceSetHash: optionalText(codeMemo.evidenceSetHash, 256) || null,
          conclusionID: optionalText(codeMemo.conclusionID, 256) || null,
          conclusionHash: optionalText(codeMemo.conclusionHash, 256) || null,
          conclusionApprovalID: optionalText(codeMemo.conclusionApprovalID, 256) || null,
          correctionOfIssuedRecordID: optionalText(codeMemo.correctionOfIssuedRecordID, 256) || null
        }
      : null
  };
  return {
    ...normalized,
    contentHash: createHash("sha256").update(stableReportJSON(normalized)).digest("hex")
  };
}

/**
 * Adapter: lift a stored v1 draft view to a v2-shaped object without rewriting storage.
 * Never mutates the input.
 */
export function adaptReportDraftV1ToV2View(v1Payload, extras = {}) {
  if (!v1Payload || typeof v1Payload !== "object") {
    throw new Error("Invalid Report Draft payload.");
  }
  if (Number(v1Payload.schemaVersion) === reportDraftSchemaVersionV2) {
    return { ...v1Payload };
  }
  if (Number(v1Payload.schemaVersion) !== reportDraftSchemaVersion) {
    throw new Error("Unsupported Report Draft schema version.");
  }
  return {
    ...v1Payload,
    schemaVersion: reportDraftSchemaVersionV2,
    recordType: extras.recordType || "genericReport",
    questionID: extras.questionID || null,
    projectID: extras.projectID || null,
    draftRevision: extras.draftRevision || 1,
    codeMemo: extras.codeMemo || null,
    adaptedFromSchemaVersion: reportDraftSchemaVersion
  };
}

/**
 * Strip unknown v2 fields when presenting to a v1-only client (does not rewrite storage).
 */
export function reportDraftV1CompatibleView(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    schemaVersion: reportDraftSchemaVersion,
    title: payload.title,
    reportDate: payload.reportDate,
    introduction: payload.introduction,
    blocks: payload.blocks,
    createdBy: payload.createdBy,
    updatedBy: payload.updatedBy
  };
}

export function reportDraftForClient(artifact, projectIDs = []) {
  return {
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    createdAt: artifact.envelope.createdAt,
    updatedAt: artifact.envelope.updatedAt,
    projectIDs,
    ...artifact.payload
  };
}

function manifestSourceClassification(kind) {
  if (kind === "evidence") return "published-code";
  if (kind === "researchAnswer") return "ai-assisted";
  if (["projectFacts", "workboardPreview", "attachment"].includes(kind)) return "project-material";
  return "user-authored";
}

function normalizeEvidenceManifestItem(item, base) {
  return {
    ...base,
    sectionID: requiredText(item.sectionID, "Report evidence section ID", 256),
    sectionNumber: requiredText(item.sectionNumber || item.sectionID, "Report evidence section number", 256),
    codeBook: requiredText(item.codeBook, "Report evidence code book", 256),
    chapter: requiredText(item.chapter || "unknown", "Report evidence chapter", 256),
    title: requiredText(item.title, "Report evidence title", 1_000),
    passageText: requiredText(item.passageText, "Report evidence passage", 50_000),
    passageTextHash: requiredText(item.passageTextHash, "Report evidence hash", 256),
    sourceLibraryVersion: requiredText(item.sourceLibraryVersion, "Report evidence source version", 1_024)
  };
}

function normalizeNotebookManifestItem(item, base) {
  return {
    ...base,
    cardID: requiredText(item.cardID || item.sourceID, "Report Notebook card ID", 256),
    cardType: requiredText(item.cardType, "Report Notebook card type", 64),
    title: requiredText(item.title, "Report Notebook title", 500),
    plainText: optionalText(item.plainText, maximumAuthoredTextLength),
    references: Array.isArray(item.references) ? structuredClone(item.references).slice(0, 100) : []
  };
}

function normalizeResearchManifestItem(item, base) {
  return {
    ...base,
    answerID: requiredText(item.answerID || item.sourceID, "Report Research answer ID", 256),
    conversationID: requiredText(item.conversationID, "Report Research conversation ID", 256),
    question: requiredText(item.question, "Report Research question", 2_000),
    conclusion: requiredText(item.conclusion, "Report Research conclusion", maximumAuthoredTextLength),
    supportedPoints: (Array.isArray(item.supportedPoints) ? item.supportedPoints : [])
      .slice(0, 20)
      .map((point) => ({
        heading: requiredText(point.heading, "Report Research supported-point heading", 500),
        explanation: requiredText(
          point.explanation,
          "Report Research supported-point explanation",
          maximumAuthoredTextLength
        ),
        sectionID: requiredText(point.sectionID, "Report Research supported-point section", 256),
        sourceIDs: (Array.isArray(point.sourceIDs) ? point.sourceIDs : [])
          .slice(0, 100)
          .map((value) => requiredText(value, "Report Research supported-point source", 256))
      })),
    explanation: optionalText(item.explanation, maximumAuthoredTextLength),
    assumptions: (Array.isArray(item.assumptions) ? item.assumptions : []).map((value) => optionalText(value, 2_000)),
    missingFacts: (Array.isArray(item.missingFacts) ? item.missingFacts : []).map((value) => optionalText(value, 2_000)),
    limitations: (Array.isArray(item.limitations) ? item.limitations : []).map((value) => optionalText(value, 2_000)),
    additionalEvidenceNeeded: (Array.isArray(item.additionalEvidenceNeeded) ? item.additionalEvidenceNeeded : [])
      .map((value) => optionalText(value, 2_000)),
    citations: Array.isArray(item.citations) ? structuredClone(item.citations).slice(0, 100) : [],
    evidence: Array.isArray(item.evidence) ? structuredClone(item.evidence).slice(0, 100) : [],
    reviewStatus: requiredText(item.reviewStatus || "unreviewed", "Report Research review status", 64)
  };
}

function normalizeProjectFactsManifestItem(item, base) {
  return {
    ...base,
    sourceID: requiredText(item.sourceID, "Report Project facts source ID", 256),
    title: requiredText(item.title || "Project facts", "Report Project facts title", 500),
    address: optionalText(item.address, 2_000),
    facts: requiredText(item.facts, "Report Project facts", maximumAuthoredTextLength)
  };
}

export function normalizeReportManifestItem(item, index = 0) {
  const kind = requiredText(item?.kind, "Report item kind", 64);
  if (!reportDraftBlockKinds.includes(kind)) throw new Error("Unsupported Report manifest item.");
  const base = {
    id: requiredText(item?.id || randomUUID(), "Report item ID", 256),
    kind,
    order: index,
    sourceClassification: manifestSourceClassification(kind)
  };
  if (authoredBlockKinds.has(kind)) return { ...base, ...normalizeAuthoredBlock(item, kind) };
  if (kind === "evidence") return normalizeEvidenceManifestItem(item, base);
  if (kind === "projectFacts") return normalizeProjectFactsManifestItem(item, base);
  if (kind === "notebookCard") return normalizeNotebookManifestItem(item, base);
  if (kind === "researchAnswer") return normalizeResearchManifestItem(item, base);
  return {
    ...base,
    sourceID: requiredText(item.sourceID, "Report source ID", 256),
    title: requiredText(item.title || item.label, "Report source title", 500),
    contentType: optionalText(item.contentType, 256),
    contentHash: requiredText(item.contentHash, "Report source hash", 256),
    readPath: optionalText(item.readPath, 2_000)
  };
}

export function immutableReportManifest({
  id = randomUUID(),
  project,
  draftID,
  title,
  reportDate,
  author,
  codeEdition,
  items,
  disclaimers,
  presentation = null,
  reportVersion,
  sourceVersions,
  createdAt = new Date().toISOString()
}) {
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeReportManifestItem);
  if (!normalizedItems.length) throw new Error("A generated Report requires at least one item.");
  const normalized = {
    id: requiredText(id, "Report Manifest ID", 256),
    immutable: true,
    schemaVersion: reportManifestSchemaVersion,
    generatorVersion: reportGeneratorVersion,
    project: {
      id: requiredText(project?.id, "Report Project ID", 256),
      name: requiredText(project?.name, "Report Project name", 500),
      address: optionalText(project?.address, 1_000),
      description: optionalText(project?.description, maximumAuthoredTextLength)
    },
    draftID: requiredText(draftID, "Report Draft ID", 256),
    title: requiredText(title, "Report title", 300),
    reportDate: requiredISO(reportDate, "Report date"),
    author: {
      userID: requiredText(author?.userID, "Report author user ID", 256),
      displayName: requiredText(author?.displayName || "Permitext user", "Report author", 500)
    },
    codeEdition: requiredText(codeEdition, "Report code edition", 500),
    items: normalizedItems,
    disclaimers: (Array.isArray(disclaimers) ? disclaimers : [])
      .map((value) => requiredText(value, "Report disclaimer", 5_000)),
    presentation: normalizeReportPresentation(presentation),
    reportVersion: positiveInteger(reportVersion, "Report version"),
    sourceVersions: sourceVersions && typeof sourceVersions === "object" && !Array.isArray(sourceVersions)
      ? structuredClone(sourceVersions)
      : {},
    createdAt: requiredISO(createdAt, "Report creation date")
  };
  return {
    ...normalized,
    contentHash: createHash("sha256").update(stableReportJSON(normalized)).digest("hex")
  };
}

/**
 * Report Manifest v3 for Code Question issued records.
 * Retains all v2 fields and adds question snapshot + lineage metadata.
 * Never mutates stored v1/v2 manifests — create a new immutable v3 record.
 */
export function immutableReportManifestV3({
  id = randomUUID(),
  project,
  draftID,
  title,
  reportDate,
  author,
  codeEdition,
  items,
  disclaimers,
  presentation = null,
  reportVersion,
  sourceVersions,
  createdAt = new Date().toISOString(),
  questionSnapshot,
  evidenceSetIdentity = null,
  conclusionRevision = null,
  approval = null,
  issueLineage = null,
  evidenceRoles = null,
  inputSnapshots = null,
  analysisIdentity = null,
  conclusionIdentity = null,
  memoApproval = null
}) {
  const base = immutableReportManifest({
    id,
    project,
    draftID,
    title,
    reportDate,
    author,
    codeEdition,
    items,
    disclaimers,
    presentation,
    reportVersion,
    sourceVersions,
    createdAt
  });
  // Rebuild without v2 contentHash so v3 hash covers the extended body.
  const {
    contentHash: _ignored,
    schemaVersion: _sv,
    generatorVersion: _gv,
    ...rest
  } = base;
  const normalized = {
    ...rest,
    immutable: true,
    schemaVersion: reportManifestSchemaVersionV3,
    generatorVersion: reportGeneratorVersionV3,
    questionSnapshot: {
      questionID: requiredText(questionSnapshot?.questionID, "question snapshot ID", 256),
      displayID: requiredText(questionSnapshot?.displayID, "question display ID", 32),
      title: requiredText(questionSnapshot?.title, "question title", 240),
      questionText: requiredText(questionSnapshot?.questionText, "question text", 8_000),
      definitionRevision: positiveInteger(
        questionSnapshot?.definitionRevision,
        "definition revision"
      ),
      definitionHash: requiredText(questionSnapshot?.definitionHash, "definition hash", 128)
    },
    evidenceSetIdentity: evidenceSetIdentity
      ? {
          evidenceSetID: requiredText(evidenceSetIdentity.evidenceSetID, "evidence set ID", 256),
          version: positiveInteger(evidenceSetIdentity.version, "evidence set version"),
          contentHash: requiredText(evidenceSetIdentity.contentHash, "evidence set hash", 128)
        }
      : null,
    conclusionRevision: conclusionRevision == null
      ? null
      : positiveInteger(conclusionRevision, "conclusion revision"),
    approval: approval
      ? {
          actorUserID: requiredText(approval.actorUserID, "approval actor", 256),
          approvedAt: requiredISO(approval.approvedAt, "approval date"),
          basis: optionalText(approval.basis, 4_000)
        }
      : null,
    issueLineage: issueLineage
      ? {
          issueVersion: positiveInteger(issueLineage.issueVersion, "issue version"),
          predecessorID: issueLineage.predecessorID
            ? requiredText(issueLineage.predecessorID, "predecessor ID", 256)
            : null,
          successorID: issueLineage.successorID
            ? requiredText(issueLineage.successorID, "successor ID", 256)
            : null
        }
      : null,
    evidenceRoles: Array.isArray(evidenceRoles)
      ? evidenceRoles.map((entry) => ({
          snapshotID: requiredText(entry.snapshotID, "evidence role snapshot ID", 256),
          role: requiredText(entry.role, "evidence role", 32),
          analysisEligible: entry.analysisEligible === true,
          qualification: optionalText(entry.qualification, 2_000),
          projectApplicabilityNote: optionalText(entry.projectApplicabilityNote, 2_000)
        }))
      : null,
    inputSnapshots: Array.isArray(inputSnapshots)
      ? inputSnapshots.map((input) => ({
          id: requiredText(input.id, "question input ID", 256),
          inputKind: requiredText(input.inputKind, "question input kind", 64),
          state: requiredText(input.state, "question input state", 64),
          statement: requiredText(input.statement, "question input statement", 4_000),
          revision: positiveInteger(input.revision, "question input revision")
        }))
      : null,
    analysisIdentity: analysisIdentity
      ? {
          analysisRunID: requiredText(analysisIdentity.analysisRunID, "analysis run ID", 256),
          dependencyHash: requiredText(analysisIdentity.dependencyHash, "analysis dependency hash", 256),
          researchAnswerID: requiredText(analysisIdentity.researchAnswerID, "Research answer ID", 256)
        }
      : null,
    conclusionIdentity: conclusionIdentity
      ? {
          conclusionID: requiredText(conclusionIdentity.conclusionID, "conclusion ID", 256),
          revision: positiveInteger(conclusionIdentity.revision, "conclusion revision"),
          contentHash: requiredText(conclusionIdentity.contentHash, "conclusion hash", 256)
        }
      : null,
    memoApproval: memoApproval
      ? {
          approvalID: requiredText(memoApproval.approvalID, "Code Memo approval ID", 256),
          actorUserID: requiredText(memoApproval.actorUserID, "Code Memo approval actor", 256),
          approvedAt: requiredISO(memoApproval.approvedAt, "Code Memo approval date"),
          basis: requiredText(memoApproval.basis, "Code Memo approval basis", 4_000),
          draftHash: requiredText(memoApproval.draftHash, "Code Memo Draft hash", 256)
        }
      : null
  };
  return {
    ...normalized,
    contentHash: createHash("sha256").update(stableReportJSON(normalized)).digest("hex")
  };
}

/**
 * Reader adapter for mixed v1/v2/v3 manifests without mutating storage.
 */
export function reportManifestForClient(manifest) {
  if (!manifest || typeof manifest !== "object") return manifest;
  const version = Number(manifest.schemaVersion) || reportManifestSchemaVersion;
  return {
    ...manifest,
    schemaVersion: version,
    isCodeQuestionManifest: version >= reportManifestSchemaVersionV3 &&
      Boolean(manifest.questionSnapshot?.questionID)
  };
}

/**
 * v1/v2-compatible summary that drops v3-only fields for older clients (view only).
 */
export function reportManifestV2CompatibleView(manifest) {
  if (!manifest || typeof manifest !== "object") return manifest;
  const summary = reportManifestSummary({
    ...manifest,
    schemaVersion: reportManifestSchemaVersion,
    generatorVersion: manifest.generatorVersion || reportGeneratorVersion
  });
  return {
    ...summary,
    schemaVersion: Math.min(Number(manifest.schemaVersion) || 2, reportManifestSchemaVersion)
  };
}

export function reportManifestSummary(manifest) {
  return {
    id: manifest.id,
    projectID: manifest.project.id,
    draftID: manifest.draftID,
    title: manifest.title,
    reportDate: manifest.reportDate,
    author: manifest.author,
    codeEdition: manifest.codeEdition,
    reportVersion: manifest.reportVersion,
    itemCount: manifest.items.length,
    presentation: manifest.presentation ? structuredClone(manifest.presentation) : null,
    contentHash: manifest.contentHash,
    generatorVersion: manifest.generatorVersion,
    createdAt: manifest.createdAt
  };
}
