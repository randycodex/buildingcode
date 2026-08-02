import { createHash, randomUUID } from "node:crypto";

export const reportDraftSchemaVersion = 1;
export const reportManifestSchemaVersion = 2;
export const reportGeneratorVersion = "permitext-report-v2";

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
  if (["workboardPreview", "attachment"].includes(kind)) return "project-material";
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
      description: optionalText(project?.description, 5_000)
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
