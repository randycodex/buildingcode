import {
  X509Certificate,
  createHash,
  createHmac,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature
} from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPostgresAccountRepository } from "./postgres-account-repository.mjs";
import { mergeContinuityMutations } from "./continuity-merge.mjs";
import {
  withFileStoreLock,
  writeJSONFileAtomically
} from "./file-store-coordinator.mjs";
import { createPostgresOrganizationRepository } from "./postgres-organization-repository.mjs";
import { createPostgresRateLimitRepository } from "./postgres-rate-limit-repository.mjs";
import { createPostgresSyncRepository } from "./postgres-sync-repository.mjs";
import {
  intersectCandidateIDsWithPosting,
  normalizedSortedPostingList,
  postingListSize
} from "./search-postings.mjs";
import { resolveContainedPrivatePath } from "./private-path-containment.mjs";
import { createImageStorageProvider } from "./image-storage.mjs";
import {
  createResearchProgressEvent,
  researchProgressSummary
} from "./public/research-progress.js";
import { matchesConfiguredAdminToken, timingSafeAdminTokenEqual } from "./admin-token-auth.mjs";
import {
  accountRateLimitPrincipal,
  clientRateLimitPrincipal,
  consumeRateLimit,
  createLocalRateLimitRepository,
  rateLimitPolicies,
  verifiedAdminRateLimitPrincipal
} from "./rate-limit.mjs";
import {
  entitlementPackageIDs,
  entitlementWithPackage,
  entitlementWithoutPackage,
  enforceFreePlanMutationBatch,
  hasActiveProEntitlement,
  hasActiveResearchEntitlement
} from "./entitlement-contract.mjs";
import {
  evidenceReviewPayload,
  invitationState,
  invitationToken,
  invitationTokenHash,
  organizationInvitationRecord,
  organizationMembershipRecord,
  organizationPermissions,
  organizationRecord,
  organizationSeatUsage,
  organizationSlug,
  projectMembershipRecord,
  projectOwnershipRecord,
  roleAllows
} from "./organization-contract.mjs";
import {
  activityEvent,
  artifactEnvelope,
  immutableEvidenceSnapshot,
  immutableResearchAnswer,
  organizationOwnerScope,
  ownerScope,
  projectFoundationSchemaVersion,
  projectLinkRecord,
  projectMembershipRules,
  syncContract
} from "./project-foundation-contract.mjs";
import {
  allocateQuestionNumber,
  allocateScopedVersion,
  archiveCodeQuestionArtifact,
  assertCodeQuestionWorkspaceEnabled,
  blockingReviewRequestIDs,
  CodeQuestionCommandError,
  codeQuestionMigrationVersion,
  codeQuestionMigrationCheckpointName,
  compareAndSwapFoundationArtifact,
  createAnalysisArtifact,
  createCodeQuestionArtifact,
  createCodeMemoApprovalArtifact,
  createCodeMemoReadinessArtifact,
  createConclusionApprovalArtifact,
  createConclusionArtifact,
  createEvidenceSetArtifact,
  createEvidenceSnapshotArtifact,
  createIssuedRecordArtifact,
  createPendingIssuanceRecord,
  createQuestionInputArtifact,
  createQuestionOutboxEntry,
  deterministicPromotedQuestionID,
  linkForArtifact,
  activityFor,
  permissionForCommand,
  reviseQuestionInputArtifact,
  restoreCodeQuestionArtifact,
  runCodeQuestionBootstrapMigration,
  advanceIssuanceSaga,
  updateCodeQuestionDefinitionArtifact,
  upsertCodeQuestionPromotionArtifact
} from "./code-question-commands.mjs";
import {
  codeQuestionPromotionSourceKinds,
  computeDependencyHash,
  contentHash as codeQuestionContentHash,
  deterministicCodeQuestionPromotionID,
  formatQuestionDisplayID,
  isCodeQuestionWorkspaceEnabled
} from "./code-question-contract.mjs";
import { codeQuestionRolloutAccess } from "./code-question-rollout.mjs";
import {
  notebookCardTypes,
  normalizeNotebookCardPayload
} from "./notebook-contract.mjs";
import { codeTrustProfilesForLibraries } from "./code-trust-contract.mjs";
import {
  immutableReportManifest,
  immutableReportManifestV3,
  normalizeReportDraftPayload,
  normalizeReportDraftPayloadV2,
  reportDraftForClient,
  reportManifestSummary,
  unavailableReportEvidenceWarning
} from "./report-contract.mjs";
import { codeMemoHTML, codeMemoStructuredJSON } from "./public/code-question-issue.js";
import { inlineCodeReferencePhrases } from "./public/code-references.js";
import { syncProjectIdentity } from "./public/sync-identity.js";
import { recordSurvivesBulkClear } from "./public/sync-state.js";
import {
  estimatedResearchCost,
  reserveResearchEvaluationSpend,
  researchModelConfiguration
} from "./research-config.mjs";
import {
  discoverRelevantEvidence,
  evidenceDiscoveryVersion,
  evidenceDiscoveryFeatureEnabled,
  evidenceDiscoveryMaximumVisualSelections,
  structuredRichSources,
  visualSourceReferences
} from "./evidence-discovery.mjs";
import {
  assembleResearchEvidence,
  researchEvidenceAssemblyLimits,
  researchEvidenceAssemblyVersion,
  researchEvidenceStrategyForTurn
} from "./research-evidence-assembly.mjs";
import {
  normalizeResearchWebSources,
  researchSourcePolicyVersion,
  researchSourcePolicyConfiguration,
  sanitizeResearchWebQuery,
  shouldUseResearchWebSupport
} from "./research-source-policy.mjs";
import { resolveResearchCodeBasis } from "./research-code-basis.mjs";
import {
  evaluateResearchRequiredClaimCoverage,
  requiredResearchClaimsFromEvidence,
  researchRequiredClaimCoverageVersion,
  researchRequiredClaimRevisionIssues
} from "./research-required-claim-coverage.mjs";
import {
  evaluateResearchClaimMateriality,
  researchClaimMaterialityVersion
} from "./research-claim-materiality.mjs";
import {
  evaluateResearchAnswerQuality,
  researchAnswerQualityRevisionIssues
} from "./research-answer-quality.mjs";
import {
  resolveResearchConversationFacts,
  researchConversationFactPromptContext,
  researchConversationFactsVersion
} from "./research-conversation-facts.mjs";
import { validateEvaluationDataset } from "./evals/evaluation-schema.mjs";
import { evaluationRunReviewStatus } from "./evals/evaluation-governance.mjs";
import {
  isZoningChapterID,
  isZoningSectionID,
  zoningChapter,
  zoningChapterIndex,
  zoningCodePrefix,
  zoningContentMetadata,
  zoningSearchIndex,
  zoningSection,
  zoningSectionCatalog,
  zoningSectionSummary,
  zoningSyncCodeVersion
} from "./zoning-content.mjs";
import {
  existingBuildingChapter,
  existingBuildingChapterIndex,
  existingBuildingCodePrefix,
  existingBuildingContentMetadata,
  existingBuildingSearchIndex,
  existingBuildingSection,
  existingBuildingSectionCatalog,
  existingBuildingSectionSummary,
  existingBuildingSyncCodeVersion,
  isExistingBuildingChapterID,
  isExistingBuildingSectionID
} from "./existing-building-content.mjs";
import {
  enactedChapter,
  enactedChapterByAnyID,
  enactedChapterIndex,
  enactedCodePrefixes,
  enactedContentMetadata,
  enactedNavigationChapterIndex,
  enactedSearchIndex,
  enactedSection,
  enactedSectionCatalog,
  enactedSectionSummary,
  enactedSyncCodeVersionForPrefix,
  isEnactedCodeChapterID,
  isEnactedCodeSectionID,
  isEnactedNavigationChapterID
} from "./enacted-code-content.mjs";
import { applyVisibleSectionNumber } from "./code-navigation-hierarchy.mjs";
import {
  constructionHTMLBodyForSection,
  officialBodyHasUnboundImages
} from "./construction-html-content.mjs";
import { codeAssetContentType, resolveCodeAsset } from "./code-asset-store.mjs";
import {
  collaborationSchemaVersion,
  latestReviewThreadUpdatedAt,
  normalizeProjectNotePayload,
  normalizeReviewCommentPayload,
  normalizeReviewThreadPayload,
  reviewRequestTypeToKind
} from "./collaboration-contract.mjs";
import {
  activeReportTemplate,
  defaultFirmControls,
  normalizeFirmControls,
  permitextRequiredReportDisclaimers,
  reportDisclaimersForFirm,
  reportPresentationSnapshot
} from "./firm-controls-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.PERMITEXT_SYNC_DATA_PATH || join(__dirname, "data", "sync-store.json");
const canonicalSectionIDsPath = join(__dirname, "config", "canonical-section-ids.json");
const webPublicPath = join(__dirname, "public");
const internalPublicPath = join(__dirname, "internal");
const evaluationRootPath = process.env.NODE_ENV === "test" &&
  String(process.env.PERMITEXT_EVALUATION_ROOT || "").trim()
  ? String(process.env.PERMITEXT_EVALUATION_ROOT).trim()
  : join(__dirname, "evals");
const evaluationCasesPath = join(evaluationRootPath, "research-cases.json");
const evidenceRetrievalCasesPath = join(evaluationRootPath, "evidence-retrieval-cases.json");
const zoningEvaluationCasesPath = join(evaluationRootPath, "zoning-cases.json");
const evaluationResultsPath = join(evaluationRootPath, "results");
const evaluationReviewsPath = join(evaluationRootPath, "reviews.json");
const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const defaultResearchCodeEdition = "2022 New York City Construction Codes";
const maxSyncMutationsPerBatch = 100;
const maxSyncRecordIDCharacters = 512;
const maxSyncFutureClockSkewMilliseconds = 24 * 60 * 60 * 1_000;
const maxWorkboardElements = 5_000;
const maxWorkboardAssets = 250;
const maxWorkboardRecordBytes = 768 * 1024;
const maxWorkboardAssetBytes = 8 * 1024 * 1024;
const maxNotebookAssetBytes = 8 * 1024 * 1024;
const maxWorkboardPreviewBytes = 6 * 1024 * 1024;
const maxReportFileBytes = 25 * 1024 * 1024;
const defaultRequestBodyLimit = 1024 * 1024;
const immutableStaticCacheControl = "public, max-age=31536000, s-maxage=31536000, immutable";
const codeAssetCacheControl = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
const canonicalCodeContentPath = join(
  __dirname,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes"
);
const authoredNYCCodeContentPath = dirname(canonicalCodeContentPath);
const canonicalPreparedContentPath = join(canonicalCodeContentPath, "prepared");
const chapterContentPath = join(canonicalPreparedContentPath, "chapters");
const chapterManifestPath = join(canonicalPreparedContentPath, "manifest.json");
const shippedSearchIndexPath = join(canonicalPreparedContentPath, "searchIndex.json");
const canonicalSectionContentPath = join(canonicalPreparedContentPath, "sections");
const legacySectionContentPath = join(
  __dirname,
  "..",
  "NYC CC APP",
  "NYCCCApp",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "sections"
);
const assetContentPath = join(canonicalCodeContentPath, "assets");
const databaseURL =
  process.env.PERMITEXT_SYNC_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.STORAGE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

let cachedStoreAdapter = null;
let cachedStoreAdapterPromise = null;
let cachedChapterIndex = null;
let cachedChapterManifest = null;
let cachedCanonicalSectionIDs = null;
const cachedCanonicalBlockIDsBySectionID = new Map();
let cachedSectionCatalog = null;
let cachedSectionCatalogPromise = null;
let cachedShippedSearchIndex = null;
let cachedAllSectionCatalogByID = null;
let cachedAllSectionCatalogByIDPromise = null;
let cachedAppleJWKS = null;
let cachedAppleJWKSExpiresAt = 0;
let blobModulePromise = null;
const constructionVisualAssetMetadataCache = new Map();
const searchableSectionPlainTextCache = new Map();
const maxSearchableSectionPlainTextCacheEntries = 2_000;
const maximumResearchVisualEvidenceBytes = 4 * 1024 * 1024;
const maximumResearchConversationVisualSources = 8;
const maximumResearchConversationVisualEvidenceBytes = 8 * 1024 * 1024;

export function createRetryableLazyLoader(loader) {
  let loadPromise = null;
  return function load() {
    if (!loadPromise) {
      loadPromise = Promise.resolve()
        .then(loader)
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }
    return loadPromise;
  };
}

export function createSingleFlightInitializer(initializer) {
  let initialized = false;
  let initializationPromise = null;
  return async function ensureInitialized() {
    if (initialized) return;
    if (!initializationPromise) {
      initializationPromise = Promise.resolve()
        .then(initializer)
        .then(() => {
          initialized = true;
        })
        .catch((error) => {
          initializationPromise = null;
          throw error;
        });
    }
    return initializationPromise;
  };
}

const loadReportPDFModule = createRetryableLazyLoader(() => import("./report-pdf.mjs"));

async function renderReportPDFOnDemand(...args) {
  const module = await loadReportPDFModule();
  return module.renderReportPDF(...args);
}

const emptyStore = () => ({
  users: {},
  entitlements: {},
  appleTransactionOwners: {},
  sessions: {},
  passkeyCredentials: {},
  mutationsByUserID: {},
  syncRevisionsByUserID: {},
  foundationArtifactsByUserID: {},
  projectLinksByUserID: {},
  researchAnswersByUserID: {},
  activityEventsByUserID: {},
  artifactRevisionsByUserID: {},
  migrationCheckpointsByUserID: {},
  researchConversationsByUserID: {},
  researchUsageByUserID: {},
  researchFeedbackByUserID: {},
  organizations: {},
  organizationMembershipsByOrganizationID: {},
  organizationInvitationsByID: {},
  projectOwnerships: {},
  projectMembershipsByProjectID: {},
  codeQuestionCountersByUserID: {},
  codeQuestionPendingIssuanceByUserID: {},
  codeQuestionOutboxByUserID: {}
});

const allowedMutationKinds = new Set([
  "savedItem",
  "annotation",
  "project",
  "projectSection",
  "workboard",
  "continuity",
  "codeVersionClear"
]);
const allowedCodeVersionClearScopes = new Set(["bookmarks", "notes", "tags", "folders"]);

const maximumResearchSupportedPoints = 12;

const researchInterpretationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conclusion: { type: "string" },
    supportedPoints: {
      type: "array",
      minItems: 1,
      maxItems: maximumResearchSupportedPoints,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          explanation: { type: "string" },
          sectionID: { type: "string" },
          sourceIDs: { type: "array", items: { type: "string" }, minItems: 1 }
        },
        required: ["heading", "explanation", "sectionID", "sourceIDs"]
      }
    },
    explanation: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    missingFacts: { type: "array", items: { type: "string" } },
    followUpQuestions: { type: "array", maxItems: 8, items: { type: "string" } },
    evidenceLimitations: { type: "array", items: { type: "string" } },
    additionalEvidenceNeeded: { type: "array", items: { type: "string" } },
    supportingSourceUses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceID: { type: "string" },
          claim: { type: "string" }
        },
        required: ["sourceID", "claim"]
      }
    },
    citations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sectionID: { type: "string" },
          sourceIDs: { type: "array", items: { type: "string" }, minItems: 1 },
          relevance: { type: "string" }
        },
        required: ["sectionID", "sourceIDs", "relevance"]
      }
    }
  },
  required: [
    "conclusion",
    "supportedPoints",
    "explanation",
    "assumptions",
    "missingFacts",
    "followUpQuestions",
    "evidenceLimitations",
    "additionalEvidenceNeeded",
    "supportingSourceUses",
    "citations"
  ]
};

function researchInterpretationSchemaForEvidence(evidence, supportingSources = []) {
  const schema = structuredClone(researchInterpretationSchema);
  const sectionIDs = Array.from(new Set(evidence.map((item) => String(item.sectionID))));
  const sourceIDs = Array.from(new Set(
    evidence.map((item) => String(item.sourceID || `section-${item.sectionID}`))
  ));
  schema.properties.supportedPoints.items.properties.sectionID.enum = sectionIDs;
  schema.properties.supportedPoints.items.properties.sourceIDs.items.enum = sourceIDs;
  schema.properties.citations.items.properties.sectionID.enum = sectionIDs;
  schema.properties.citations.items.properties.sourceIDs.items.enum = sourceIDs;
  const supportingSourceIDs = supportingSources
    .map((source) => String(source.id || ""))
    .filter(Boolean);
  if (supportingSourceIDs.length) {
    schema.properties.supportingSourceUses.items.properties.sourceID.enum = supportingSourceIDs;
  }
  return schema;
}

export function normalizeResearchInterpretationEvidenceBindings(value, evidence) {
  if (!value || typeof value !== "object") return value;
  const sourceSectionIDs = new Map((evidence || []).map((source) => [
    String(source?.sourceID || `section-${source?.sectionID || ""}`),
    String(source?.sectionID || "")
  ]));
  const normalizeBinding = (item) => {
    if (!item || typeof item !== "object" || !Array.isArray(item.sourceIDs)) return item;
    const sourceIDs = Array.from(new Set(
      item.sourceIDs.map((sourceID) => String(sourceID || "").trim()).filter(Boolean)
    ));
    if (!sourceIDs.length) return item;
    if (sourceIDs.some((sourceID) => !sourceSectionIDs.has(sourceID))) return item;
    const sectionIDs = Array.from(new Set(sourceIDs.map((sourceID) => sourceSectionIDs.get(sourceID))));
    const declaredSectionID = String(item.sectionID || "").trim();
    return {
      ...item,
      sectionID: sectionIDs.includes(declaredSectionID) ? declaredSectionID : sectionIDs[0],
      sourceIDs
    };
  };
  const normalizedSupportedPoints = Array.isArray(value.supportedPoints)
    ? value.supportedPoints.map(normalizeBinding)
    : value.supportedPoints;
  const normalizedCitations = Array.isArray(value.citations)
    ? value.citations.flatMap((citation) => {
        const normalized = normalizeBinding(citation);
        if (!normalized || !Array.isArray(normalized.sourceIDs)) return [normalized];
        if (normalized.sourceIDs.some((sourceID) => !sourceSectionIDs.has(sourceID))) return [normalized];
        const sourceIDsBySection = new Map();
        for (const sourceID of normalized.sourceIDs) {
          const sectionID = sourceSectionIDs.get(sourceID);
          sourceIDsBySection.set(sectionID, [...(sourceIDsBySection.get(sectionID) || []), sourceID]);
        }
        return Array.from(sourceIDsBySection, ([sectionID, sourceIDs]) => ({
          ...normalized,
          sectionID,
          sourceIDs
        }));
      })
    : value.citations;
  if (Array.isArray(normalizedCitations) && Array.isArray(normalizedSupportedPoints)) {
    const citedSourceIDs = new Set(normalizedCitations.flatMap((citation) => citation?.sourceIDs || []));
    for (const point of normalizedSupportedPoints) {
      if (!point || !Array.isArray(point.sourceIDs)) continue;
      const missingSourceIDs = point.sourceIDs.filter((sourceID) =>
        sourceSectionIDs.has(sourceID) && !citedSourceIDs.has(sourceID)
      );
      const sourceIDsBySection = new Map();
      for (const sourceID of missingSourceIDs) {
        const sectionID = sourceSectionIDs.get(sourceID);
        sourceIDsBySection.set(sectionID, [...(sourceIDsBySection.get(sectionID) || []), sourceID]);
        citedSourceIDs.add(sourceID);
      }
      for (const [sectionID, sourceIDs] of sourceIDsBySection) {
        normalizedCitations.push({
          sectionID,
          sourceIDs,
          relevance: `Evidence supporting ${String(point.heading || "this point").trim() || "this point"}.`
        });
      }
    }
  }
  const seenCitationBindings = new Set();
  return {
    ...value,
    supportedPoints: normalizedSupportedPoints,
    citations: Array.isArray(normalizedCitations)
      ? normalizedCitations.filter((citation) => {
          if (!citation || !Array.isArray(citation.sourceIDs)) return true;
          const key = `${citation.sectionID}:${citation.sourceIDs.slice().sort().join(",")}`;
          if (seenCitationBindings.has(key)) return false;
          seenCitationBindings.add(key);
          return true;
        })
      : normalizedCitations
  };
}

function safeJSON(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function canonicalJSONString(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJSONString(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJSONString(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

const researchUsageLocks = new Map();
const organizationMutationLocks = new Map();
const researchUsageReservationTTLMilliseconds = 15 * 60 * 1000;

function activeResearchUsageEntry(entry, now = Date.now()) {
  if (entry?.mode !== "reservation") return true;
  const createdAt = Date.parse(entry.createdAt || "");
  return Number.isFinite(createdAt) &&
    createdAt > now - researchUsageReservationTTLMilliseconds;
}

async function withResearchUsageLock(userID, operation) {
  const previous = researchUsageLocks.get(userID) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  researchUsageLocks.set(userID, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (researchUsageLocks.get(userID) === tail) {
      researchUsageLocks.delete(userID);
    }
  }
}

async function withOrganizationMutationLock(organizationID, operation) {
  const previous = organizationMutationLocks.get(organizationID) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  organizationMutationLocks.set(organizationID, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (organizationMutationLocks.get(organizationID) === tail) {
      organizationMutationLocks.delete(organizationID);
    }
  }
}

function fileStoreOrganizationSeatState(store, organizationID) {
  const organizationMemberships =
    store.organizationMembershipsByOrganizationID?.[organizationID] || [];
  const organizationProjectIDs = new Set(
    Object.values(store.projectOwnerships || {})
      .filter((ownership) =>
        ownership.owner?.kind === "organization" &&
        ownership.owner.organizationID === organizationID
      )
      .map((ownership) => ownership.projectID)
  );
  const projectMemberships = Array.from(organizationProjectIDs)
    .flatMap((projectID) => store.projectMembershipsByProjectID?.[projectID] || []);
  const invitations = Object.values(store.organizationInvitationsByID || {})
    .filter((invitation) => invitation.organizationID === organizationID);
  return organizationSeatUsage(
    [...organizationMemberships, ...projectMemberships],
    invitations
  );
}

function createFileStoreAdapter() {
  const rateLimitRepository = createLocalRateLimitRepository();
  async function readUnlocked() {
    try {
      const raw = await readFile(dataPath, "utf8");
      return { ...emptyStore(), ...JSON.parse(raw) };
    } catch (error) {
      if (error.code === "ENOENT") {
        return emptyStore();
      }
      throw error;
    }
  }
  async function writeUnlocked(store) {
    await writeJSONFileAtomically(dataPath, store);
  }
  return {
    kind: "file",
    schema: "json-file",
    rateLimitMode: "local",
    async consumeRateLimit(input) {
      return rateLimitRepository.consume(input);
    },
    async read() {
      return readUnlocked();
    },
    async write(store) {
      // Serialize bare writes so concurrent request handlers cannot clobber each other
      // when the process-wide request lock is intentionally skipped for long-running work.
      return withFileStoreLock(dataPath, () => writeUnlocked(store));
    },
    async withMutation(mutator) {
      return withFileStoreLock(dataPath, async () => {
        const store = await readUnlocked();
        const result = await mutator(store);
        await writeUnlocked(store);
        return result;
      });
    },
    async latestEventID(userID) {
      const store = await this.read();
      return Number(store.syncRevisionsByUserID?.[userID] || 0);
    },
    async accountExists(userID) {
      const store = await this.read();
      return Boolean(store.users?.[userID]);
    },
    async deleteAccount(userID) {
      const store = await this.read();
      if (!store.users?.[userID]) return false;

      const ownedOrganizationIDs = new Set(
        Object.values(store.organizations || {})
          .filter((organization) => organization.ownerUserID === userID)
          .map((organization) => organization.id)
      );
      const removedProjectIDs = new Set(
        Object.entries(store.projectOwnerships || {})
          .filter(([, ownership]) =>
            ownership.storageOwnerUserID === userID ||
            (ownership.owner?.kind === "user" && ownership.owner?.id === userID) ||
            ownedOrganizationIDs.has(ownership.owner?.organizationID)
          )
          .map(([projectID]) => projectID)
      );

      delete store.users[userID];
      delete store.entitlements[userID];
      delete store.sessions[userID];
      delete store.mutationsByUserID[userID];
      delete store.syncRevisionsByUserID[userID];
      delete store.foundationArtifactsByUserID[userID];
      delete store.projectLinksByUserID[userID];
      delete store.researchAnswersByUserID[userID];
      delete store.activityEventsByUserID[userID];
      delete store.artifactRevisionsByUserID[userID];
      delete store.migrationCheckpointsByUserID[userID];
      delete store.researchConversationsByUserID[userID];
      delete store.researchUsageByUserID[userID];
      delete store.researchFeedbackByUserID[userID];

      for (const [credentialID, ownerUserID] of Object.entries(store.passkeyCredentials || {})) {
        if (ownerUserID === userID) delete store.passkeyCredentials[credentialID];
      }
      for (const organizationID of ownedOrganizationIDs) {
        delete store.organizations[organizationID];
        delete store.organizationMembershipsByOrganizationID[organizationID];
      }
      for (const [organizationID, memberships] of Object.entries(
        store.organizationMembershipsByOrganizationID || {}
      )) {
        store.organizationMembershipsByOrganizationID[organizationID] =
          (memberships || []).filter((membership) => membership.userID !== userID);
      }
      for (const [invitationID, invitation] of Object.entries(store.organizationInvitationsByID || {})) {
        if (
          ownedOrganizationIDs.has(invitation.organizationID) ||
          invitation.invitedUserID === userID ||
          invitation.invitedByUserID === userID ||
          invitation.acceptedByUserID === userID
        ) {
          delete store.organizationInvitationsByID[invitationID];
        }
      }
      for (const projectID of removedProjectIDs) {
        delete store.projectOwnerships[projectID];
        delete store.projectMembershipsByProjectID[projectID];
      }
      for (const [projectID, memberships] of Object.entries(store.projectMembershipsByProjectID || {})) {
        store.projectMembershipsByProjectID[projectID] =
          (memberships || []).filter((membership) => membership.userID !== userID);
      }

      await this.write(store);
      return true;
    },
    async summary() {
      const store = await this.read();
      const mutationCountsByKind = mutationCounts(
        Object.values(store.mutationsByUserID || {}).flatMap((mutations) => mutations || [])
      );
      return {
        storage: "file",
        schema: "json-file",
        latestEventID: 0,
        tables: {
          users: Object.keys(store.users || {}).length,
          entitlements: Object.keys(store.entitlements || {}).length,
          sessions: Object.keys(store.sessions || {}).length,
          passkeyCredentials: Object.keys(store.passkeyCredentials || {}).length,
          mutations: Object.values(store.mutationsByUserID || {}).reduce(
            (count, mutations) => count + (mutations?.length || 0),
            0
          ),
          researchConversations: Object.values(store.researchConversationsByUserID || {}).reduce(
            (count, conversations) => count + (conversations?.length || 0),
            0
          ),
          researchUsage: Object.values(store.researchUsageByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          researchFeedback: Object.values(store.researchFeedbackByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          foundationArtifacts: Object.values(store.foundationArtifactsByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          projectLinks: Object.values(store.projectLinksByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          researchAnswers: Object.values(store.researchAnswersByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          activityEvents: Object.values(store.activityEventsByUserID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          organizations: Object.keys(store.organizations || {}).length,
          organizationMemberships: Object.values(store.organizationMembershipsByOrganizationID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          ),
          organizationInvitations: Object.keys(store.organizationInvitationsByID || {}).length,
          projectOwnerships: Object.keys(store.projectOwnerships || {}).length,
          projectMemberships: Object.values(store.projectMembershipsByProjectID || {}).reduce(
            (count, entries) => count + (entries?.length || 0),
            0
          )
        },
        mutationCounts: mutationCountsByKind
      };
    },
    async listResearchConversations(userID, options = {}) {
      const store = await this.read();
      const projectID = String(options.projectID || "").trim();
      let conversations = (store.researchConversationsByUserID?.[userID] || []).slice();
      if (projectID) {
        conversations = conversations.filter((item) => item.primaryProjectID === projectID);
      }
      if (options.summaryOnly) {
        return conversations.map(projectResearchConversationForList).filter(Boolean);
      }
      return conversations;
    },
    async saveResearchConversation(userID, conversation) {
      return this.withMutation((store) => {
        store.researchConversationsByUserID ||= {};
        const conversations = store.researchConversationsByUserID[userID] || [];
        const index = conversations.findIndex((item) => item.id === conversation.id);
        if (index === -1) conversations.push(conversation);
        else conversations[index] = conversation;
        store.researchConversationsByUserID[userID] = conversations;
        return conversation;
      });
    },
    async updateResearchCandidateDisposition(userID, conversationID, change) {
      return this.withMutation((store) => {
        store.researchConversationsByUserID ||= {};
        const conversations = store.researchConversationsByUserID[userID] || [];
        const index = conversations.findIndex((item) => item.id === conversationID);
        if (index === -1) return null;
        const conversation = conversations[index];
        const existing = Array.isArray(conversation.candidateDispositions)
          ? conversation.candidateDispositions
          : [];
        const withoutCandidate = existing.filter((item) => item.candidateID !== change.candidateID);
        const candidateDispositions = change.disposition === "rejected"
          ? [...withoutCandidate, change.record].slice(-100)
          : withoutCandidate;
        const updated = {
          ...conversation,
          candidateDispositions,
          updatedAt: change.updatedAt
        };
        conversations[index] = updated;
        store.researchConversationsByUserID[userID] = conversations;
        return updated;
      });
    },
    async deleteResearchConversation(userID, conversationID) {
      return this.withMutation((store) => {
        const conversations = store.researchConversationsByUserID?.[userID] || [];
        const remaining = conversations.filter((item) => item.id !== conversationID);
        if (remaining.length === conversations.length) return false;
        store.researchConversationsByUserID[userID] = remaining;
        return true;
      });
    },
    async listFoundationArtifacts(userID, options = {}) {
      const store = await this.read();
      const ids = Array.isArray(options.ids)
        ? options.ids.map((value) => String(value || "").trim()).filter(Boolean)
        : null;
      if (ids && ids.length === 0) return [];
      const idSet = ids ? new Set(ids) : null;
      return (store.foundationArtifactsByUserID?.[userID] || [])
        .filter((item) => !idSet || idSet.has(item.envelope?.id))
        .slice();
    },
    async saveFoundationArtifact(userID, artifact) {
      return this.withMutation((store) => {
        store.foundationArtifactsByUserID ||= {};
        const entries = store.foundationArtifactsByUserID[userID] || [];
        const index = entries.findIndex((item) => item.envelope?.id === artifact.envelope?.id);
        if (index === -1) entries.push(artifact);
        else entries[index] = artifact;
        store.foundationArtifactsByUserID[userID] = entries;
        return artifact;
      });
    },
    async saveFoundationArtifactCompareAndSwap(userID, artifact, expectedVersion) {
      return this.withMutation((store) => {
        store.foundationArtifactsByUserID ||= {};
        const entries = store.foundationArtifactsByUserID[userID] || [];
        const index = entries.findIndex((item) => item.envelope?.id === artifact.envelope?.id);
        const existing = index === -1 ? null : entries[index];
        const next = compareAndSwapFoundationArtifact(existing, artifact, expectedVersion);
        if (existing && next === existing) {
          return existing;
        }
        if (index === -1) entries.push(next);
        else entries[index] = next;
        store.foundationArtifactsByUserID[userID] = entries;
        return next;
      });
    },
    async allocateCodeQuestionCounter(userID, scope, scopeKey) {
      return this.withMutation((store) => {
        store.codeQuestionCountersByUserID ||= {};
        const userCounters = store.codeQuestionCountersByUserID[userID] || {};
        const scopeMap = userCounters[scope] || {};
        let result;
        if (scope === "questionNumber") {
          result = allocateQuestionNumber(scopeMap, scopeKey);
          userCounters[scope] = result.counters;
          store.codeQuestionCountersByUserID[userID] = userCounters;
          return { value: result.questionNumber };
        }
        result = allocateScopedVersion(scopeMap, scopeKey);
        userCounters[scope] = result.scopes;
        store.codeQuestionCountersByUserID[userID] = userCounters;
        return { value: result.version };
      });
    },
    async listCodeQuestionPendingIssuance(userID) {
      const store = await this.read();
      return (store.codeQuestionPendingIssuanceByUserID?.[userID] || []).slice();
    },
    async saveCodeQuestionPendingIssuance(userID, record) {
      return this.withMutation((store) => {
        store.codeQuestionPendingIssuanceByUserID ||= {};
        const entries = store.codeQuestionPendingIssuanceByUserID[userID] || [];
        const index = entries.findIndex((item) => item.id === record.id);
        if (index === -1) entries.push(record);
        else entries[index] = record;
        store.codeQuestionPendingIssuanceByUserID[userID] = entries;
        return record;
      });
    },
    async reserveCodeQuestionIssuance(userID, input) {
      return this.withMutation((store) => {
        store.codeQuestionPendingIssuanceByUserID ||= {};
        const entries = store.codeQuestionPendingIssuanceByUserID[userID] || [];
        const existing = entries.find((item) =>
          item.questionID === input.questionID && item.idempotencyKey === input.idempotencyKey
        );
        if (existing) return { pending: existing, replayed: true };
        const active = entries.find((item) =>
          item.questionID === input.questionID && ["reserved", "staged", "committing"].includes(item.status)
        );
        if (active) {
          throw new CodeQuestionCommandError("Another issuance attempt is already active for this Code Question.", {
            code: "CODE_QUESTION_ISSUANCE_IN_PROGRESS", status: 409, details: { pendingID: active.id }
          });
        }
        store.codeQuestionCountersByUserID ||= {};
        const userCounters = store.codeQuestionCountersByUserID[userID] || {};
        const scopeMap = userCounters.issueVersion || {};
        const allocated = allocateScopedVersion(scopeMap, input.questionID);
        userCounters.issueVersion = allocated.scopes;
        store.codeQuestionCountersByUserID[userID] = userCounters;
        const pending = createPendingIssuanceRecord({
          ...input,
          issueVersion: allocated.version,
          stagedObjectKey: `${input.stagedPrefix}issue-v${allocated.version}/${input.deterministicHash}`
        });
        entries.push(pending);
        store.codeQuestionPendingIssuanceByUserID[userID] = entries;
        return { pending, replayed: false };
      });
    },
    async listCodeQuestionOutbox(userID) {
      const store = await this.read();
      return (store.codeQuestionOutboxByUserID?.[userID] || []).slice();
    },
    async saveCodeQuestionOutboxEntry(userID, entry) {
      return this.withMutation((store) => {
        store.codeQuestionOutboxByUserID ||= {};
        const entries = store.codeQuestionOutboxByUserID[userID] || [];
        const index = entries.findIndex((item) => item.id === entry.id);
        if (index === -1) entries.push(entry);
        else entries[index] = entry;
        store.codeQuestionOutboxByUserID[userID] = entries;
        return entry;
      });
    },
    async listProjectLinks(userID, options = {}) {
      const store = await this.read();
      const projectID = String(options.projectID || "").trim();
      const targetKind = String(options.targetKind || "").trim();
      return (store.projectLinksByUserID?.[userID] || [])
        .filter((item) =>
          (!projectID || item.projectID === projectID) &&
          (!targetKind || item.targetKind === targetKind)
        )
        .slice();
    },
    async saveProjectLink(userID, link) {
      return this.withMutation((store) => {
        store.projectLinksByUserID ||= {};
        const entries = store.projectLinksByUserID[userID] || [];
        const index = entries.findIndex((item) => item.id === link.id);
        if (index === -1) entries.push(link);
        else entries[index] = link;
        store.projectLinksByUserID[userID] = entries;
        return link;
      });
    },
    async replaceResearchCodeDecisionLinks(userID, {
      link,
      clearedLinks = [],
      expectedLink = null,
      expectedClearedLinks = []
    }) {
      return this.withMutation((store) => {
        store.projectLinksByUserID ||= {};
        const entries = store.projectLinksByUserID[userID] || [];
        const expectedByID = new Map(expectedClearedLinks.map((item) => [item.id, item]));
        const guardedLinks = [
          ...clearedLinks.map((nextLink) => ({ nextLink, expected: expectedByID.get(nextLink.id) })),
          { nextLink: link, expected: expectedLink }
        ];
        if (
          expectedClearedLinks.length !== clearedLinks.length ||
          guardedLinks.some(({ nextLink, expected }) =>
            !researchProjectLinkCASMatches(
              entries.find((item) => item.id === nextLink.id) || null,
              expected || null
            )
          )
        ) {
          throw researchCodeDecisionLinkConflict();
        }
        for (const nextLink of [...clearedLinks, link]) {
          const index = entries.findIndex((item) => item.id === nextLink.id);
          if (index === -1) entries.push(nextLink);
          else entries[index] = nextLink;
        }
        store.projectLinksByUserID[userID] = entries;
        return { link, clearedLinks };
      });
    },
    async listResearchAnswers(userID, options = {}) {
      const store = await this.read();
      const projectID = String(options.projectID || "").trim();
      return (store.researchAnswersByUserID?.[userID] || [])
        .filter((item) => !projectID || item.projectID === projectID)
        .slice();
    },
    async saveResearchAnswer(userID, answer) {
      return this.withMutation((store) => {
        store.researchAnswersByUserID ||= {};
        const entries = store.researchAnswersByUserID[userID] || [];
        const existing = entries.find((item) => item.id === answer.id);
        if (existing && canonicalJSONString(existing) !== canonicalJSONString(answer)) {
          throw new Error("Immutable Research answer cannot be changed.");
        }
        if (!existing) entries.push(answer);
        store.researchAnswersByUserID[userID] = entries;
        return existing || answer;
      });
    },
    async listActivityEvents(userID, options = {}) {
      const store = await this.read();
      const projectID = String(options.projectID || "").trim();
      return (store.activityEventsByUserID?.[userID] || [])
        .filter((item) => !projectID || item.projectID === projectID)
        .slice();
    },
    async saveActivityEvent(userID, event) {
      return this.withMutation((store) => {
        store.activityEventsByUserID ||= {};
        const entries = store.activityEventsByUserID[userID] || [];
        const existing = entries.find((item) => item.id === event.id);
        if (existing && canonicalJSONString(existing) !== canonicalJSONString(event)) {
          throw new Error("Activity events are append-only.");
        }
        if (!existing) entries.push(event);
        store.activityEventsByUserID[userID] = entries;
        return existing || event;
      });
    },
    async artifactRevisionState(userID, { account = false, projectIDs = [] } = {}) {
      const store = await this.read();
      const state = store.artifactRevisionsByUserID?.[userID] || {};
      return {
        storageOwnerUserID: userID,
        account: account ? state.account || null : null,
        projects: projectIDs.map((projectID) => state.projects?.[projectID] || {
          projectID,
          revision: 0,
          domains: [],
          updatedAt: null
        })
      };
    },
    async bumpArtifactRevisions(userID, { accountDomains = [], projects = [] } = {}) {
      return this.withMutation((store) => {
        store.artifactRevisionsByUserID ||= {};
        const state = store.artifactRevisionsByUserID[userID] || { account: null, projects: {} };
        state.projects ||= {};
        const updatedAt = new Date().toISOString();
        const updateRecord = (existing, domains, extra = {}) => ({
          ...extra,
          revision: Number(existing?.revision || 0) + 1,
          domains: Array.from(new Set([...(existing?.domains || []), ...domains])).sort(),
          updatedAt
        });
        let account = null;
        const normalizedAccountDomains = normalizedArtifactDomains(accountDomains);
        if (normalizedAccountDomains.length) {
          state.account = updateRecord(state.account, normalizedAccountDomains);
          account = { ...state.account, changedDomains: normalizedAccountDomains };
        }
        const changedProjects = [];
        for (const input of normalizedArtifactProjectChanges(projects)) {
          state.projects[input.projectID] = updateRecord(
            state.projects[input.projectID],
            input.domains,
            { projectID: input.projectID }
          );
          changedProjects.push({
            ...state.projects[input.projectID],
            changedDomains: input.domains
          });
        }
        store.artifactRevisionsByUserID[userID] = state;
        return { storageOwnerUserID: userID, account, projects: changedProjects };
      });
    },
    async commitCodeQuestionIssuance(userID, { artifacts, links, events, pending }) {
      return this.withMutation((store) => {
      store.foundationArtifactsByUserID ||= {};
      store.projectLinksByUserID ||= {};
      store.activityEventsByUserID ||= {};
      store.codeQuestionPendingIssuanceByUserID ||= {};
      const storedArtifacts = store.foundationArtifactsByUserID[userID] || [];
      for (const artifact of artifacts) {
        const index = storedArtifacts.findIndex((item) => item.envelope?.id === artifact.envelope.id);
        const existing = index === -1 ? null : storedArtifacts[index];
        if (existing && canonicalJSONString(existing) !== canonicalJSONString(artifact)) {
          throw new Error("Immutable issuance artifacts cannot be changed.");
        }
        if (index === -1) storedArtifacts.push(artifact);
      }
      store.foundationArtifactsByUserID[userID] = storedArtifacts;
      const storedLinks = store.projectLinksByUserID[userID] || [];
      for (const link of links) {
        const index = storedLinks.findIndex((item) => item.id === link.id);
        if (index === -1) storedLinks.push(link);
        else if (canonicalJSONString(storedLinks[index]) !== canonicalJSONString(link)) {
          throw new Error("Immutable issuance links cannot be changed.");
        }
      }
      store.projectLinksByUserID[userID] = storedLinks;
      const storedEvents = store.activityEventsByUserID[userID] || [];
      for (const event of events) {
        const existing = storedEvents.find((item) => item.id === event.id);
        if (existing && canonicalJSONString(existing) !== canonicalJSONString(event)) {
          throw new Error("Activity events are append-only.");
        }
        if (!existing) storedEvents.push(event);
      }
      store.activityEventsByUserID[userID] = storedEvents;
      const pendingEntries = store.codeQuestionPendingIssuanceByUserID[userID] || [];
      const pendingIndex = pendingEntries.findIndex((item) => item.id === pending.id);
      if (pendingIndex === -1) throw new Error("Pending issuance disappeared before commit.");
      pendingEntries[pendingIndex] = pending;
      store.codeQuestionPendingIssuanceByUserID[userID] = pendingEntries;
      return { artifacts, links, events, pending };
      });
    },
    async organization(organizationID) {
      const store = await this.read();
      return store.organizations?.[organizationID] || null;
    },
    async organizationBySlug(slug) {
      const store = await this.read();
      return Object.values(store.organizations || {})
        .find((organization) => organization.slug === slug) || null;
    },
    async listOrganizationsForUser(userID) {
      const store = await this.read();
      const results = [];
      for (const [organizationID, memberships] of Object.entries(
        store.organizationMembershipsByOrganizationID || {}
      )) {
        const membership = (memberships || []).find((item) =>
          item.userID === userID && item.status === "active"
        );
        const organization = store.organizations?.[organizationID];
        if (membership && organization?.status === "active") {
          results.push({ organization, membership });
        }
      }
      return results.sort((left, right) =>
        String(right.organization.updatedAt || "").localeCompare(
          String(left.organization.updatedAt || "")
        )
      );
    },
    async saveOrganization(organization) {
      const store = await this.read();
      store.organizations ||= {};
      store.organizations[organization.id] = organization;
      await this.write(store);
      return organization;
    },
    async deleteOrganization(organizationID, ownerUserID, updatedAt) {
      return withOrganizationMutationLock(organizationID, async () => {
        const store = await this.read();
        const organization = store.organizations?.[organizationID] || null;
        if (!organization) return { outcome: "not_found", restoredProjectIDs: [] };
        if (organization.ownerUserID !== ownerUserID) {
          return { outcome: "forbidden", restoredProjectIDs: [] };
        }
        const restoredProjectIDs = [];
        for (const [projectID, ownership] of Object.entries(store.projectOwnerships || {})) {
          if (
            ownership.owner?.kind !== "organization" ||
            ownership.owner?.organizationID !== organizationID
          ) {
            continue;
          }
          const personalOwnerUserID =
            ownership.originalOwnerUserID ||
            ownership.storageOwnerUserID ||
            ownerUserID;
          store.projectOwnerships[projectID] = {
            ...ownership,
            owner: {
              kind: "user",
              id: personalOwnerUserID,
              organizationID: null
            },
            transferredByUserID: null,
            updatedAt
          };
          delete store.projectMembershipsByProjectID[projectID];
          restoredProjectIDs.push(projectID);
        }
        delete store.organizations[organizationID];
        delete store.organizationMembershipsByOrganizationID[organizationID];
        for (const [invitationID, invitation] of Object.entries(
          store.organizationInvitationsByID || {}
        )) {
          if (invitation.organizationID === organizationID) {
            delete store.organizationInvitationsByID[invitationID];
          }
        }
        await this.write(store);
        return { outcome: "deleted", restoredProjectIDs };
      });
    },
    async membership(organizationID, userID) {
      const store = await this.read();
      return (store.organizationMembershipsByOrganizationID?.[organizationID] || [])
        .find((item) => item.userID === userID) || null;
    },
    async listOrganizationMemberships(organizationID) {
      const store = await this.read();
      return (store.organizationMembershipsByOrganizationID?.[organizationID] || []).slice();
    },
    async saveOrganizationMembership(membership) {
      const store = await this.read();
      store.organizationMembershipsByOrganizationID ||= {};
      const entries = store.organizationMembershipsByOrganizationID[membership.organizationID] || [];
      const index = entries.findIndex((item) => item.userID === membership.userID);
      if (index === -1) entries.push(membership);
      else entries[index] = membership;
      store.organizationMembershipsByOrganizationID[membership.organizationID] = entries;
      await this.write(store);
      return membership;
    },
    async invitationByTokenHash(tokenHash) {
      const store = await this.read();
      return Object.values(store.organizationInvitationsByID || {})
        .find((item) => item.tokenHash === tokenHash) || null;
    },
    async listOrganizationInvitations(organizationID) {
      const store = await this.read();
      return Object.values(store.organizationInvitationsByID || {})
        .filter((item) => item.organizationID === organizationID)
        .sort((left, right) =>
          String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
        );
    },
    async saveOrganizationInvitation(invitation) {
      const store = await this.read();
      store.organizationInvitationsByID ||= {};
      store.organizationInvitationsByID[invitation.id] = invitation;
      await this.write(store);
      return invitation;
    },
    async reserveOrganizationInvitation(invitation, seatLimit) {
      return withOrganizationMutationLock(invitation.organizationID, async () => {
        const store = await this.read();
        store.organizationInvitationsByID ||= {};
        const duplicate = Object.values(store.organizationInvitationsByID)
          .find((candidate) =>
            candidate.organizationID === invitation.organizationID &&
            candidate.projectID === invitation.projectID &&
            invitationState(candidate) === "pending" &&
            (
              (invitation.invitedUserID &&
                candidate.invitedUserID === invitation.invitedUserID) ||
              (invitation.invitedEmail &&
                String(candidate.invitedEmail || "").toLowerCase() ===
                  invitation.invitedEmail.toLowerCase())
            )
          );
        const seats = fileStoreOrganizationSeatState(store, invitation.organizationID);
        if (duplicate) {
          return { outcome: "duplicate", invitation: null, seats };
        }
        store.organizationInvitationsByID[invitation.id] = invitation;
        const reservedSeats = fileStoreOrganizationSeatState(store, invitation.organizationID);
        if (reservedSeats.used > seatLimit) {
          return { outcome: "seat_limit", invitation: null, seats };
        }
        await this.write(store);
        return { outcome: "created", invitation, seats };
      });
    },
    async updatePendingOrganizationInvitation(invitation) {
      return withOrganizationMutationLock(invitation.organizationID, async () => {
        const store = await this.read();
        const current = store.organizationInvitationsByID?.[invitation.id] || null;
        if (!current || invitationState(current) !== "pending") return null;
        store.organizationInvitationsByID[invitation.id] = invitation;
        await this.write(store);
        return invitation;
      });
    },
    async acceptOrganizationInvitation(invitation, membership, seatLimit) {
      return withOrganizationMutationLock(invitation.organizationID, async () => {
        const store = await this.read();
        const current = store.organizationInvitationsByID?.[invitation.id] || null;
        if (
          !current ||
          current.tokenHash !== invitation.tokenHash ||
          invitationState(current) !== "pending"
        ) {
          return {
            outcome: "unavailable",
            invitation: null,
            membership: null
          };
        }
        const seats = fileStoreOrganizationSeatState(store, invitation.organizationID);
        if (seats.used > seatLimit) {
          return {
            outcome: "seat_limit",
            invitation: null,
            membership: null
          };
        }
        if (membership.projectID) {
          store.projectMembershipsByProjectID ||= {};
          const entries = store.projectMembershipsByProjectID[membership.projectID] || [];
          const index = entries.findIndex((item) => item.userID === membership.userID);
          if (index === -1) entries.push(membership);
          else entries[index] = membership;
          store.projectMembershipsByProjectID[membership.projectID] = entries;
        } else {
          store.organizationMembershipsByOrganizationID ||= {};
          const entries =
            store.organizationMembershipsByOrganizationID[membership.organizationID] || [];
          const index = entries.findIndex((item) => item.userID === membership.userID);
          if (index === -1) entries.push(membership);
          else entries[index] = membership;
          store.organizationMembershipsByOrganizationID[membership.organizationID] = entries;
        }
        store.organizationInvitationsByID[invitation.id] = invitation;
        await this.write(store);
        return {
          outcome: "accepted",
          invitation,
          membership
        };
      });
    },
    async projectOwnership(projectID) {
      const store = await this.read();
      return store.projectOwnerships?.[projectID] || null;
    },
    async listProjectOwnershipsForOrganizations(organizationIDs) {
      const allowed = new Set(organizationIDs || []);
      const store = await this.read();
      return Object.values(store.projectOwnerships || {})
        .filter((ownership) => allowed.has(ownership.owner?.organizationID));
    },
    async saveProjectOwnership(ownership) {
      const store = await this.read();
      store.projectOwnerships ||= {};
      store.projectOwnerships[ownership.projectID] = ownership;
      await this.write(store);
      return ownership;
    },
    async projectMembership(projectID, userID) {
      const store = await this.read();
      return (store.projectMembershipsByProjectID?.[projectID] || [])
        .find((item) => item.userID === userID) || null;
    },
    async listProjectMemberships(projectID) {
      const store = await this.read();
      return (store.projectMembershipsByProjectID?.[projectID] || []).slice();
    },
    async listProjectMembershipsForUser(userID) {
      const store = await this.read();
      return Object.values(store.projectMembershipsByProjectID || {})
        .flatMap((entries) => entries || [])
        .filter((item) => item.userID === userID && item.status === "active");
    },
    async saveProjectMembership(membership) {
      const store = await this.read();
      store.projectMembershipsByProjectID ||= {};
      const entries = store.projectMembershipsByProjectID[membership.projectID] || [];
      const index = entries.findIndex((item) => item.userID === membership.userID);
      if (index === -1) entries.push(membership);
      else entries[index] = membership;
      store.projectMembershipsByProjectID[membership.projectID] = entries;
      await this.write(store);
      return membership;
    },
    async saveMembershipWithinSeatLimit(membership, seatLimit) {
      return withOrganizationMutationLock(membership.organizationID, async () => {
        const store = await this.read();
        if (membership.projectID) {
          store.projectMembershipsByProjectID ||= {};
          const entries = store.projectMembershipsByProjectID[membership.projectID] || [];
          const index = entries.findIndex((item) => item.userID === membership.userID);
          if (index === -1) entries.push(membership);
          else entries[index] = membership;
          store.projectMembershipsByProjectID[membership.projectID] = entries;
        } else {
          store.organizationMembershipsByOrganizationID ||= {};
          const entries =
            store.organizationMembershipsByOrganizationID[membership.organizationID] || [];
          const index = entries.findIndex((item) => item.userID === membership.userID);
          if (index === -1) entries.push(membership);
          else entries[index] = membership;
          store.organizationMembershipsByOrganizationID[membership.organizationID] = entries;
        }
        const seats = fileStoreOrganizationSeatState(store, membership.organizationID);
        if (seats.used > seatLimit) {
          return { outcome: "seat_limit", membership: null, seats };
        }
        await this.write(store);
        return { outcome: "saved", membership, seats };
      });
    },
    async migrationCheckpoint(userID, checkpointName) {
      const store = await this.read();
      return store.migrationCheckpointsByUserID?.[userID]?.[checkpointName] || null;
    },
    async saveMigrationCheckpoint(userID, checkpointName, checkpoint) {
      const store = await this.read();
      store.migrationCheckpointsByUserID ||= {};
      store.migrationCheckpointsByUserID[userID] ||= {};
      store.migrationCheckpointsByUserID[userID][checkpointName] = checkpoint;
      await this.write(store);
      return checkpoint;
    },
    async researchUsageSince(userID, since) {
      const store = await this.read();
      return (store.researchUsageByUserID?.[userID] || []).filter((entry) =>
        entry.createdAt >= since && activeResearchUsageEntry(entry)
      );
    },
    async researchSpendSince(since) {
      const store = await this.read();
      return Object.entries(store.researchUsageByUserID || {}).map(([userID, entries]) => {
        const account = store.users?.[userID] || {};
        const completed = (entries || []).filter((entry) =>
          entry.mode !== "reservation" && entry.createdAt >= since
        );
        return {
          userID,
          email: account.email || account.emailAddress || account.privateRelayEmail || null,
          requests: completed.length,
          inputTokens: completed.reduce((total, entry) => total + Number(entry.inputTokens || 0), 0),
          outputTokens: completed.reduce((total, entry) => total + Number(entry.outputTokens || 0), 0),
          totalTokens: completed.reduce((total, entry) => total + Number(entry.totalTokens || 0), 0),
          estimatedCostUSD: Number(completed.reduce(
            (total, entry) => total + (Number.isFinite(entry.estimatedCostUSD) ? entry.estimatedCostUSD : 0),
            0
          ).toFixed(6))
        };
      }).filter((item) => item.requests > 0)
        .sort((left, right) => right.estimatedCostUSD - left.estimatedCostUSD);
    },
    async reserveResearchUsage(userID, reservation) {
      return withResearchUsageLock(userID, async () => {
        const store = await this.read();
        const retentionCutoff = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
        const retainedEntries = (store.researchUsageByUserID?.[userID] || [])
          .filter((entry) => entry.createdAt >= retentionCutoff);
        if (retainedEntries.some((entry) => entry.id === reservation.id)) return false;
        const entries = retainedEntries
          .filter((entry) =>
            entry.createdAt >= reservation.since && activeResearchUsageEntry(entry)
          );
        if (Number.isSafeInteger(reservation.limit) && entries.length >= reservation.limit) return false;
        store.researchUsageByUserID ||= {};
        store.researchUsageByUserID[userID] = [
          ...retainedEntries,
          {
            id: reservation.id,
            model: "pending",
            mode: "reservation",
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            createdAt: reservation.createdAt
          }
        ];
        await this.write(store);
        return true;
      });
    },
    async completeResearchUsageReservation(userID, reservationID, entry) {
      return withResearchUsageLock(userID, async () => {
        const store = await this.read();
        const entries = store.researchUsageByUserID?.[userID] || [];
        const index = entries.findIndex((item) =>
          item.id === reservationID && item.mode === "reservation"
        );
        if (index === -1) {
          throw new Error("Research usage reservation was not found.");
        }
        entries[index] = { ...entry, id: reservationID };
        await this.write(store);
      });
    },
    async commitResearchConversationMessage(userID, payload) {
      return withResearchUsageLock(userID, async () => this.withMutation((store) =>
        applyResearchConversationMessageCommit(store, userID, payload)
      ));
    },
    async releaseResearchUsageReservation(userID, reservationID) {
      return withResearchUsageLock(userID, async () => {
        const store = await this.read();
        const entries = store.researchUsageByUserID?.[userID] || [];
        const remaining = entries.filter((item) =>
          item.id !== reservationID || item.mode !== "reservation"
        );
        if (remaining.length === entries.length) return false;
        store.researchUsageByUserID[userID] = remaining;
        await this.write(store);
        return true;
      });
    },
    async listResearchFeedback(userID) {
      const store = await this.read();
      return (store.researchFeedbackByUserID?.[userID] || []).slice();
    },
    async listAllResearchFeedback() {
      const store = await this.read();
      return Object.values(store.researchFeedbackByUserID || {}).flatMap((entries) => entries || []);
    },
    async saveResearchFeedback(userID, feedback) {
      const store = await this.read();
      store.researchFeedbackByUserID ||= {};
      const entries = store.researchFeedbackByUserID[userID] || [];
      const index = entries.findIndex((item) => item.id === feedback.id);
      if (index === -1) entries.push(feedback);
      else entries[index] = feedback;
      store.researchFeedbackByUserID[userID] = entries;
      await this.write(store);
      return feedback;
    },
    async updateResearchFeedback(feedbackID, feedback) {
      const store = await this.read();
      for (const [userID, entries] of Object.entries(store.researchFeedbackByUserID || {})) {
        const index = (entries || []).findIndex((item) => item.id === feedbackID);
        if (index === -1) continue;
        entries[index] = feedback;
        store.researchFeedbackByUserID[userID] = entries;
        await this.write(store);
        return feedback;
      }
      return null;
    }
  };
}

function storeHasData(store) {
  return Object.values({
    users: store.users,
    entitlements: store.entitlements,
    sessions: store.sessions,
    passkeyCredentials: store.passkeyCredentials,
    mutationsByUserID: store.mutationsByUserID,
    foundationArtifactsByUserID: store.foundationArtifactsByUserID,
    projectLinksByUserID: store.projectLinksByUserID,
    researchAnswersByUserID: store.researchAnswersByUserID,
    activityEventsByUserID: store.activityEventsByUserID,
    migrationCheckpointsByUserID: store.migrationCheckpointsByUserID,
    researchConversationsByUserID: store.researchConversationsByUserID,
    researchUsageByUserID: store.researchUsageByUserID,
    researchFeedbackByUserID: store.researchFeedbackByUserID,
    organizations: store.organizations,
    organizationMembershipsByOrganizationID: store.organizationMembershipsByOrganizationID,
    organizationInvitationsByID: store.organizationInvitationsByID,
    projectOwnerships: store.projectOwnerships,
    projectMembershipsByProjectID: store.projectMembershipsByProjectID
  }).some((value) => value && Object.keys(value).length > 0);
}

function dateToISO(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }
  return new Date(timestamp).toISOString();
}

function normalizedMutationKindAndRecord(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record };
}

function normalizedMutationRecordID(mutation) {
  const { kind, record } = normalizedMutationKindAndRecord(mutation);
  if (!kind || !record) {
    return null;
  }
  if (kind === "continuity") {
    return [record.userID, "continuity", record.codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    return [record.userID, "code-version-clear", record.codeVersion, record.values?.scope]
      .filter(Boolean)
      .join(":");
  }
  return record.id || null;
}

function normalizedBlockID(value) {
  return String(value || "").trim();
}

function mutationRecordUpdatedAt(record) {
  return dateToISO(record?.updatedAt, new Date().toISOString());
}

function mutationRecordDeletedAt(record) {
  return dateToISO(record?.deletedAt);
}

async function createPostgresStoreAdapter() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(databaseURL);
  const organizationRepository = createPostgresOrganizationRepository(sql);
  const rateLimitRepository = createPostgresRateLimitRepository(sql);
  const accountRepository = createPostgresAccountRepository(sql, {
    mergeUserQueries: (sourceUserID, targetUserID) =>
      organizationRepository.mergeUserQueries(sourceUserID, targetUserID)
  });
  const syncRepository = createPostgresSyncRepository(sql);

  const ensureSchema = createSingleFlightInitializer(async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_sync_state (
        id TEXT PRIMARY KEY,
        users JSONB NOT NULL DEFAULT '{}'::jsonb,
        entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
        sessions JSONB NOT NULL DEFAULT '{}'::jsonb,
        passkey_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
        mutations_by_user_id JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      ALTER TABLE permitext_sync_state
      ADD COLUMN IF NOT EXISTS passkey_credentials JSONB NOT NULL DEFAULT '{}'::jsonb
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_users (
        id TEXT PRIMARY KEY,
        auth_provider TEXT NOT NULL,
        auth_provider_user_id TEXT NOT NULL,
        apple_user_id TEXT,
        public_username TEXT,
        display_name TEXT,
        migration_state TEXT,
        account JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS permitext_users_auth_identity_idx
      ON permitext_users (auth_provider, auth_provider_user_id)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS permitext_users_public_username_idx
      ON permitext_users (public_username)
      WHERE public_username IS NOT NULL
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_entitlements (
        user_id TEXT PRIMARY KEY,
        plan TEXT NOT NULL,
        source TEXT NOT NULL,
        granted_user_id TEXT,
        entitlement JSONB NOT NULL DEFAULT '{}'::jsonb,
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_entitlements_source_granted_idx
      ON permitext_entitlements (source, granted_user_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_apple_transaction_owners (
        original_transaction_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_apple_transaction_owners_user_idx
      ON permitext_apple_transaction_owners (user_id)
    `;
    await sql`
      INSERT INTO permitext_apple_transaction_owners (
        original_transaction_id,
        user_id
      )
      SELECT
        entitlement->'provider'->>'appleOriginalTransactionID',
        user_id
      FROM permitext_entitlements
      WHERE source = 'appleSubscription'
        AND coalesce(entitlement->'provider'->>'appleOriginalTransactionID', '') <> ''
      ORDER BY updated_at ASC
      ON CONFLICT (original_transaction_id) DO NOTHING
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_sessions (
        user_id TEXT PRIMARY KEY,
        session_token TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_account_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_account_sessions_user_idx
      ON permitext_account_sessions (user_id, expires_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_passkey_credentials (
        credential_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_passkey_credentials_user_idx
      ON permitext_passkey_credentials (user_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_user_content_records (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_kind TEXT NOT NULL,
        code_version TEXT,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_user_content_user_updated_idx
      ON permitext_user_content_records (user_id, updated_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_user_content_user_version_kind_idx
      ON permitext_user_content_records (user_id, code_version, entity_kind)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_saved_items (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_version TEXT NOT NULL,
        section_id BIGINT NOT NULL,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      DROP INDEX IF EXISTS permitext_saved_items_user_locator_idx
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_saved_items_user_locator_idx
      ON permitext_saved_items (user_id, code_version, section_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_saved_items_user_updated_idx
      ON permitext_saved_items (user_id, updated_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_annotations (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_version TEXT NOT NULL,
        section_id BIGINT NOT NULL,
        block_id TEXT NOT NULL DEFAULT '',
        note_body TEXT,
        tags JSONB,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      DROP INDEX IF EXISTS permitext_annotations_user_locator_idx
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_annotations_user_locator_idx
      ON permitext_annotations (user_id, code_version, section_id, block_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_annotations_user_updated_idx
      ON permitext_annotations (user_id, updated_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_projects (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_version TEXT NOT NULL,
        client_id TEXT,
        local_folder_id BIGINT,
        name TEXT,
        address TEXT,
        description TEXT,
        folder_type TEXT NOT NULL DEFAULT 'project',
        color_hex TEXT,
        sort_order INTEGER,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      ALTER TABLE permitext_projects
      ADD COLUMN IF NOT EXISTS folder_type TEXT NOT NULL DEFAULT 'project'
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_projects_user_version_idx
      ON permitext_projects (user_id, code_version)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_projects_user_updated_idx
      ON permitext_projects (user_id, updated_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_project_items (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_version TEXT NOT NULL,
        project_client_id TEXT,
        local_folder_id BIGINT,
        folder_type TEXT NOT NULL DEFAULT 'project',
        section_id BIGINT NOT NULL,
        block_id TEXT NOT NULL DEFAULT '',
        scope TEXT,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      ALTER TABLE permitext_project_items
      ADD COLUMN IF NOT EXISTS folder_type TEXT NOT NULL DEFAULT 'project'
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_project_items_project_idx
      ON permitext_project_items (user_id, code_version, project_client_id, local_folder_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_project_items_user_updated_idx
      ON permitext_project_items (user_id, updated_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_comments (
        record_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_version TEXT NOT NULL,
        section_id BIGINT NOT NULL,
        block_id TEXT NOT NULL DEFAULT '',
        body TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_comments_user_locator_idx
      ON permitext_comments (user_id, code_version, section_id, block_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_research_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        conversation JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_research_conversations_user_updated_idx
      ON permitext_research_conversations (user_id, updated_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_foundation_artifacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        envelope JSONB NOT NULL DEFAULT '{}'::jsonb,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        archived_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_foundation_artifacts_user_updated_idx
      ON permitext_foundation_artifacts (user_id, updated_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_project_links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        link JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_project_links_project_idx
      ON permitext_project_links (user_id, project_id, updated_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_project_links_target_idx
      ON permitext_project_links (user_id, target_kind, target_id)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS permitext_project_links_research_decision_unique_idx
      ON permitext_project_links (
        user_id,
        project_id,
        ((link->'metadata'->>'codeDecisionID'))
      )
      WHERE deleted_at IS NULL
        AND target_kind = 'researchConversation'
        AND relationship = 'primary'
        AND COALESCE(link->'metadata'->>'codeDecisionID', '') <> ''
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_research_answers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        project_id TEXT,
        answer JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_research_answers_conversation_idx
      ON permitext_research_answers (user_id, conversation_id, created_at ASC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_evidence_snapshots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        answer_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_evidence_snapshots_answer_idx
      ON permitext_evidence_snapshots (user_id, answer_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_project_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        action TEXT NOT NULL,
        object_kind TEXT NOT NULL,
        object_id TEXT NOT NULL,
        event JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_project_activity_project_idx
      ON permitext_project_activity (user_id, project_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_migration_checkpoints (
        user_id TEXT NOT NULL,
        checkpoint_name TEXT NOT NULL,
        checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, checkpoint_name)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_artifact_revisions (
        user_id TEXT NOT NULL,
        scope_kind TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        revision BIGINT NOT NULL DEFAULT 0,
        domains JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, scope_kind, scope_id),
        CHECK (scope_kind IN ('account', 'project'))
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_research_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        model TEXT NOT NULL,
        mode TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        cached_input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        prompt_version TEXT,
        evidence_version TEXT,
        estimated_cost_usd NUMERIC,
        pricing_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`ALTER TABLE permitext_research_usage ADD COLUMN IF NOT EXISTS prompt_version TEXT`;
    await sql`ALTER TABLE permitext_research_usage ADD COLUMN IF NOT EXISTS cached_input_tokens INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE permitext_research_usage ADD COLUMN IF NOT EXISTS evidence_version TEXT`;
    await sql`ALTER TABLE permitext_research_usage ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC`;
    await sql`ALTER TABLE permitext_research_usage ADD COLUMN IF NOT EXISTS pricing_version TEXT`;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_research_usage_user_created_idx
      ON permitext_research_usage (user_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_research_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        answer_id TEXT NOT NULL,
        feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS permitext_research_feedback_user_answer_idx
      ON permitext_research_feedback (user_id, answer_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS permitext_sync_events (
        event_id BIGSERIAL PRIMARY KEY,
        record_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        entity_kind TEXT NOT NULL,
        code_version TEXT,
        mutation_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      ALTER TABLE permitext_sync_events
      ADD COLUMN IF NOT EXISTS mutation_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_sync_events_user_event_idx
      ON permitext_sync_events (user_id, event_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS permitext_sync_events_user_record_event_idx
      ON permitext_sync_events (user_id, record_id, event_id DESC)
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS permitext_sync_events_record_update_idx
      ON permitext_sync_events (record_id, mutation_updated_at)
    `;
    await sql`
      INSERT INTO permitext_sync_state (id)
      VALUES ('default')
      ON CONFLICT (id) DO NOTHING
    `;
    await organizationRepository.initialize();
    await rateLimitRepository.initialize();
  });

  async function readLegacyStore() {
    const rows = await sql`
      SELECT users, entitlements, sessions, passkey_credentials, mutations_by_user_id
      FROM permitext_sync_state
      WHERE id = 'default'
      LIMIT 1
    `;
    const row = rows[0] || {};
    return {
      users: safeJSON(row.users, {}),
      entitlements: safeJSON(row.entitlements, {}),
      sessions: safeJSON(row.sessions, {}),
      passkeyCredentials: safeJSON(row.passkey_credentials, {}),
      mutationsByUserID: safeJSON(row.mutations_by_user_id, {})
    };
  }

  async function writeLegacyBackup(store) {
    await sql`
      INSERT INTO permitext_sync_state (
        id,
        users,
        entitlements,
        sessions,
        passkey_credentials,
        mutations_by_user_id,
        updated_at
      )
      VALUES (
        'default',
        ${JSON.stringify(store.users || {})}::jsonb,
        ${JSON.stringify(store.entitlements || {})}::jsonb,
        ${JSON.stringify(store.sessions || {})}::jsonb,
        ${JSON.stringify(store.passkeyCredentials || {})}::jsonb,
        ${JSON.stringify(store.mutationsByUserID || {})}::jsonb,
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        users = EXCLUDED.users,
        entitlements = EXCLUDED.entitlements,
        sessions = EXCLUDED.sessions,
        passkey_credentials = EXCLUDED.passkey_credentials,
        mutations_by_user_id = EXCLUDED.mutations_by_user_id,
        updated_at = EXCLUDED.updated_at
      `;
  }

  async function writeNormalizedUserContentMutation(userID, mutation) {
    const recordID = normalizedMutationRecordID(mutation);
    const { kind, record } = normalizedMutationKindAndRecord(mutation);
    if (!recordID || !kind || !record) {
      return;
    }

    const ownerUserID = record.userID || userID;
    const codeVersion = record.codeVersion || null;
    const updatedAt = mutationRecordUpdatedAt(record);
    const deletedAt = mutationRecordDeletedAt(record);
    const mutationJSON = JSON.stringify(mutation);

    if (kind === "savedItem") {
      await sql`
        INSERT INTO permitext_saved_items (
          record_id,
          user_id,
          code_version,
          section_id,
          mutation,
          updated_at,
          deleted_at,
          server_version
        )
        VALUES (
          ${recordID},
          ${ownerUserID},
          ${codeVersion},
          ${record.sectionID},
          ${mutationJSON}::jsonb,
          ${updatedAt}::timestamptz,
          ${deletedAt}::timestamptz,
          1
        )
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          code_version = EXCLUDED.code_version,
          section_id = EXCLUDED.section_id,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = permitext_saved_items.server_version + 1
      `;
      return;
    }

    if (kind === "annotation") {
      await sql`
        INSERT INTO permitext_annotations (
          record_id,
          user_id,
          code_version,
          section_id,
          block_id,
          note_body,
          tags,
          mutation,
          updated_at,
          deleted_at,
          server_version
        )
        VALUES (
          ${recordID},
          ${ownerUserID},
          ${codeVersion},
          ${record.sectionID},
          ${normalizedBlockID(record.blockID)},
          ${record.noteBody ?? null},
          ${record.tags === undefined || record.tags === null ? null : JSON.stringify(record.tags)}::jsonb,
          ${mutationJSON}::jsonb,
          ${updatedAt}::timestamptz,
          ${deletedAt}::timestamptz,
          1
        )
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          code_version = EXCLUDED.code_version,
          section_id = EXCLUDED.section_id,
          block_id = EXCLUDED.block_id,
          note_body = EXCLUDED.note_body,
          tags = EXCLUDED.tags,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = permitext_annotations.server_version + 1
      `;
      return;
    }

    if (kind === "project") {
      await sql`
        INSERT INTO permitext_projects (
          record_id,
          user_id,
          code_version,
          client_id,
          local_folder_id,
          name,
          address,
          description,
          folder_type,
          color_hex,
          sort_order,
          mutation,
          updated_at,
          deleted_at,
          server_version
        )
        VALUES (
          ${recordID},
          ${ownerUserID},
          ${codeVersion},
          ${record.clientID || null},
          ${record.localFolderID || null},
          ${record.name ?? null},
          ${record.address ?? null},
          ${record.description ?? null},
          ${record.folderType || "project"},
          ${record.colorHex ?? null},
          ${record.sortOrder ?? null},
          ${mutationJSON}::jsonb,
          ${updatedAt}::timestamptz,
          ${deletedAt}::timestamptz,
          1
        )
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          code_version = EXCLUDED.code_version,
          client_id = EXCLUDED.client_id,
          local_folder_id = EXCLUDED.local_folder_id,
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          folder_type = EXCLUDED.folder_type,
          color_hex = EXCLUDED.color_hex,
          sort_order = EXCLUDED.sort_order,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = permitext_projects.server_version + 1
      `;
      return;
    }

    if (kind === "projectSection") {
      await sql`
        INSERT INTO permitext_project_items (
          record_id,
          user_id,
          code_version,
          project_client_id,
          local_folder_id,
          folder_type,
          section_id,
          block_id,
          scope,
          mutation,
          updated_at,
          deleted_at,
          server_version
        )
        VALUES (
          ${recordID},
          ${ownerUserID},
          ${codeVersion},
          ${record.folderClientID || null},
          ${record.localFolderID || null},
          ${record.folderType || "project"},
          ${record.sectionID},
          ${normalizedBlockID(record.blockID)},
          ${record.scope || null},
          ${mutationJSON}::jsonb,
          ${updatedAt}::timestamptz,
          ${deletedAt}::timestamptz,
          1
        )
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          code_version = EXCLUDED.code_version,
          project_client_id = EXCLUDED.project_client_id,
          local_folder_id = EXCLUDED.local_folder_id,
          folder_type = EXCLUDED.folder_type,
          section_id = EXCLUDED.section_id,
          block_id = EXCLUDED.block_id,
          scope = EXCLUDED.scope,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = permitext_project_items.server_version + 1
      `;
    }
  }

  async function deleteNormalizedUserContentRecord(recordID, kind) {
    if (kind === "savedItem") {
      await sql`DELETE FROM permitext_saved_items WHERE record_id = ${recordID}`;
    } else if (kind === "annotation") {
      await sql`DELETE FROM permitext_annotations WHERE record_id = ${recordID}`;
    } else if (kind === "project") {
      await sql`DELETE FROM permitext_projects WHERE record_id = ${recordID}`;
    } else if (kind === "projectSection") {
      await sql`DELETE FROM permitext_project_items WHERE record_id = ${recordID}`;
    } else if (kind === "comment") {
      await sql`DELETE FROM permitext_comments WHERE record_id = ${recordID}`;
    }
  }

  async function writeSyncEvent(userID, mutation) {
    const recordID = normalizedMutationRecordID(mutation);
    const { kind, record } = normalizedMutationKindAndRecord(mutation);
    if (!recordID || !kind || !record) {
      return;
    }
    await sql`
      INSERT INTO permitext_sync_events (
        record_id,
        user_id,
        entity_kind,
        code_version,
        mutation_updated_at,
        mutation
      )
      VALUES (
        ${recordID},
        ${record.userID || userID},
        ${kind},
        ${record.codeVersion || null},
        ${mutationRecordUpdatedAt(record)}::timestamptz,
        ${JSON.stringify(mutation)}::jsonb
      )
      ON CONFLICT (record_id, mutation_updated_at) DO NOTHING
    `;
  }

  async function latestEventID(userID) {
    const rows = await sql`
      SELECT COALESCE(MAX(event_id), 0)::bigint AS latest_event_id
      FROM permitext_sync_events
      WHERE user_id = ${userID}
    `;
    return Number(rows[0]?.latest_event_id || 0);
  }

  async function mutationsAfterEventID(userID, sinceEventID) {
    const rows = await sql`
      SELECT mutation
      FROM permitext_sync_events
      WHERE user_id = ${userID}
        AND event_id > ${sinceEventID}
      ORDER BY event_id ASC
    `;
    return rows.map((row) => safeJSON(row.mutation, {}));
  }

  async function storageSummary() {
    const rows = await sql`
      SELECT
        (SELECT count(*) FROM permitext_users)::int AS users,
        (SELECT count(*) FROM permitext_entitlements)::int AS entitlements,
        (SELECT count(*) FROM permitext_sessions)::int AS sessions,
        (SELECT count(*) FROM permitext_account_sessions WHERE revoked_at IS NULL AND expires_at > now())::int AS account_sessions,
        (SELECT count(*) FROM permitext_passkey_credentials)::int AS passkey_credentials,
        (SELECT count(*) FROM permitext_saved_items)::int AS saved_items,
        (SELECT count(*) FROM permitext_annotations)::int AS annotations,
        (SELECT count(*) FROM permitext_projects)::int AS projects,
        (SELECT count(*) FROM permitext_project_items)::int AS project_items,
        (SELECT count(*) FROM permitext_comments)::int AS comments,
        (SELECT count(*) FROM permitext_research_conversations)::int AS research_conversations,
        (SELECT count(*) FROM permitext_foundation_artifacts)::int AS foundation_artifacts,
        (SELECT count(*) FROM permitext_project_links)::int AS project_links,
        (SELECT count(*) FROM permitext_research_answers)::int AS research_answers,
        (SELECT count(*) FROM permitext_evidence_snapshots)::int AS evidence_snapshots,
        (SELECT count(*) FROM permitext_project_activity)::int AS project_activity,
        (SELECT count(*) FROM permitext_migration_checkpoints)::int AS migration_checkpoints,
        (SELECT count(*) FROM permitext_research_usage)::int AS research_usage,
        (SELECT count(*) FROM permitext_research_feedback)::int AS research_feedback,
        (SELECT count(*) FROM permitext_organizations)::int AS organizations,
        (SELECT count(*) FROM permitext_organization_memberships)::int AS organization_memberships,
        (SELECT count(*) FROM permitext_organization_invitations)::int AS organization_invitations,
        (SELECT count(*) FROM permitext_project_ownerships)::int AS project_ownerships,
        (SELECT count(*) FROM permitext_project_memberships)::int AS project_memberships,
        (SELECT count(*) FROM permitext_user_content_records)::int AS user_content_records,
        (SELECT count(*) FROM permitext_sync_events)::int AS sync_events,
        COALESCE((SELECT max(event_id) FROM permitext_sync_events), 0)::bigint AS latest_event_id
    `;
    const row = rows[0] || {};
    return {
      storage: "postgres",
      schema: "normalized-v4",
      latestEventID: Number(row.latest_event_id || 0),
      tables: {
        users: Number(row.users || 0),
        entitlements: Number(row.entitlements || 0),
        sessions: Number(row.sessions || 0) + Number(row.account_sessions || 0),
        legacySessions: Number(row.sessions || 0),
        accountSessions: Number(row.account_sessions || 0),
        passkeyCredentials: Number(row.passkey_credentials || 0),
        savedItems: Number(row.saved_items || 0),
        annotations: Number(row.annotations || 0),
        projects: Number(row.projects || 0),
        projectItems: Number(row.project_items || 0),
        comments: Number(row.comments || 0),
        researchConversations: Number(row.research_conversations || 0),
        foundationArtifacts: Number(row.foundation_artifacts || 0),
        projectLinks: Number(row.project_links || 0),
        researchAnswers: Number(row.research_answers || 0),
        evidenceSnapshots: Number(row.evidence_snapshots || 0),
        activityEvents: Number(row.project_activity || 0),
        migrationCheckpoints: Number(row.migration_checkpoints || 0),
        researchUsage: Number(row.research_usage || 0),
        researchFeedback: Number(row.research_feedback || 0),
        organizations: Number(row.organizations || 0),
        organizationMemberships: Number(row.organization_memberships || 0),
        organizationInvitations: Number(row.organization_invitations || 0),
        projectOwnerships: Number(row.project_ownerships || 0),
        projectMemberships: Number(row.project_memberships || 0),
        userContentRecords: Number(row.user_content_records || 0),
        syncEvents: Number(row.sync_events || 0)
      }
    };
  }

  async function writeNormalizedStore(store, { backupLegacy = true } = {}) {
    const users = store.users || {};
    const desiredUserIDs = new Set(Object.keys(users));
    const existingUsers = await sql`SELECT id FROM permitext_users`;
    for (const row of existingUsers) {
      if (!desiredUserIDs.has(row.id)) {
        await sql`DELETE FROM permitext_users WHERE id = ${row.id}`;
      }
    }
    for (const [userID, account] of Object.entries(users)) {
      const authProvider = account.authProvider || "guest";
      const authProviderUserID = account.authProviderUserID || account.appleUserID || userID;
      await sql`
        INSERT INTO permitext_users (
          id,
          auth_provider,
          auth_provider_user_id,
          apple_user_id,
          public_username,
          display_name,
          migration_state,
          account,
          created_at,
          updated_at
        )
        VALUES (
          ${userID},
          ${authProvider},
          ${authProviderUserID},
          ${account.appleUserID || null},
          ${account.publicUsername || null},
          ${account.displayName || null},
          ${account.migrationState || null},
          ${JSON.stringify(account)}::jsonb,
          ${dateToISO(account.signedInAt, new Date().toISOString())}::timestamptz,
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          auth_provider = EXCLUDED.auth_provider,
          auth_provider_user_id = EXCLUDED.auth_provider_user_id,
          apple_user_id = EXCLUDED.apple_user_id,
          public_username = EXCLUDED.public_username,
          display_name = EXCLUDED.display_name,
          migration_state = EXCLUDED.migration_state,
          account = EXCLUDED.account,
          updated_at = EXCLUDED.updated_at
      `;
    }

    const entitlements = store.entitlements || {};
    const desiredEntitlementUserIDs = new Set(Object.keys(entitlements));
    const existingEntitlements = await sql`SELECT user_id FROM permitext_entitlements`;
    for (const row of existingEntitlements) {
      if (!desiredEntitlementUserIDs.has(row.user_id)) {
        await sql`DELETE FROM permitext_entitlements WHERE user_id = ${row.user_id}`;
      }
    }
    for (const [userID, entitlement] of Object.entries(entitlements)) {
      await sql`
        INSERT INTO permitext_entitlements (
          user_id,
          plan,
          source,
          granted_user_id,
          entitlement,
          expires_at,
          updated_at
        )
        VALUES (
          ${userID},
          ${entitlement.plan || "free"},
          ${entitlement.source || "unknown"},
          ${entitlement.grantedUserID || null},
          ${JSON.stringify(entitlement)}::jsonb,
          ${dateToISO(entitlement.expiresAt)}::timestamptz,
          now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          plan = EXCLUDED.plan,
          source = EXCLUDED.source,
          granted_user_id = EXCLUDED.granted_user_id,
          entitlement = EXCLUDED.entitlement,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
      `;
    }

    const appleTransactionOwners = { ...(store.appleTransactionOwners || {}) };
    for (const [userID, entitlement] of Object.entries(entitlements)) {
      const originalTransactionID = entitlement?.source === "appleSubscription"
        ? entitlement?.provider?.appleOriginalTransactionID
        : null;
      if (originalTransactionID && !appleTransactionOwners[originalTransactionID]) {
        appleTransactionOwners[originalTransactionID] = userID;
      }
    }
    for (const [originalTransactionID, userID] of Object.entries(appleTransactionOwners)) {
      await sql`
        INSERT INTO permitext_apple_transaction_owners (
          original_transaction_id,
          user_id,
          updated_at
        )
        VALUES (${originalTransactionID}, ${userID}, now())
        ON CONFLICT (original_transaction_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          updated_at = now()
      `;
    }

    const sessions = store.sessions || {};
    const desiredSessionUserIDs = new Set(Object.keys(sessions));
    const existingSessions = await sql`SELECT user_id FROM permitext_sessions`;
    for (const row of existingSessions) {
      if (!desiredSessionUserIDs.has(row.user_id)) {
        await sql`DELETE FROM permitext_sessions WHERE user_id = ${row.user_id}`;
      }
    }
    for (const [userID, sessionToken] of Object.entries(sessions)) {
      await sql`
        INSERT INTO permitext_sessions (user_id, session_token, updated_at)
        VALUES (${userID}, ${sessionToken}, now())
        ON CONFLICT (user_id) DO UPDATE SET
          session_token = EXCLUDED.session_token,
          updated_at = EXCLUDED.updated_at
      `;
    }

    const passkeyCredentials = store.passkeyCredentials || {};
    const desiredCredentialIDs = new Set(Object.keys(passkeyCredentials));
    const existingCredentials = await sql`SELECT credential_id FROM permitext_passkey_credentials`;
    for (const row of existingCredentials) {
      if (!desiredCredentialIDs.has(row.credential_id)) {
        await sql`DELETE FROM permitext_passkey_credentials WHERE credential_id = ${row.credential_id}`;
      }
    }
    for (const [credentialID, userID] of Object.entries(passkeyCredentials)) {
      await sql`
        INSERT INTO permitext_passkey_credentials (credential_id, user_id, updated_at)
        VALUES (${credentialID}, ${userID}, now())
        ON CONFLICT (credential_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          updated_at = EXCLUDED.updated_at
      `;
    }

    const mutationsByUserID = store.mutationsByUserID || {};
    const desiredMutationIDs = new Set();
    for (const mutations of Object.values(mutationsByUserID)) {
      for (const mutation of mutations || []) {
        const recordID = normalizedMutationRecordID(mutation);
        if (recordID) {
          desiredMutationIDs.add(recordID);
        }
      }
    }
    const existingMutations = await sql`SELECT record_id, entity_kind FROM permitext_user_content_records`;
    for (const row of existingMutations) {
      if (!desiredMutationIDs.has(row.record_id)) {
        await deleteNormalizedUserContentRecord(row.record_id, row.entity_kind);
        await sql`DELETE FROM permitext_user_content_records WHERE record_id = ${row.record_id}`;
      }
    }
    for (const [userID, mutations] of Object.entries(mutationsByUserID)) {
      for (const mutation of mutations || []) {
        const recordID = normalizedMutationRecordID(mutation);
        const { kind, record } = normalizedMutationKindAndRecord(mutation);
        if (!recordID || !kind || !record) {
          continue;
        }
        await sql`
          INSERT INTO permitext_user_content_records (
            record_id,
            user_id,
            entity_kind,
            code_version,
            mutation,
            updated_at,
            deleted_at,
            server_version
          )
          VALUES (
            ${recordID},
            ${record.userID || userID},
            ${kind},
            ${record.codeVersion || null},
            ${JSON.stringify(mutation)}::jsonb,
            ${dateToISO(record.updatedAt, new Date().toISOString())}::timestamptz,
            ${dateToISO(record.deletedAt)}::timestamptz,
            1
          )
          ON CONFLICT (record_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            entity_kind = EXCLUDED.entity_kind,
            code_version = EXCLUDED.code_version,
            mutation = EXCLUDED.mutation,
            updated_at = EXCLUDED.updated_at,
            deleted_at = EXCLUDED.deleted_at,
            server_version = permitext_user_content_records.server_version + 1
        `;
        await writeNormalizedUserContentMutation(userID, mutation);
        await writeSyncEvent(userID, mutation);
      }
    }

    if (backupLegacy) {
      await writeLegacyBackup(store);
    }
  }

  async function readNormalizedStore() {
    const store = emptyStore();
    const [users, entitlements, appleTransactionOwners, sessions, passkeyCredentials, mutations] = await Promise.all([
      sql`SELECT id, account FROM permitext_users ORDER BY id`,
      sql`SELECT user_id, entitlement FROM permitext_entitlements ORDER BY user_id`,
      sql`
        SELECT original_transaction_id, user_id
        FROM permitext_apple_transaction_owners
        ORDER BY original_transaction_id
      `,
      sql`SELECT user_id, session_token FROM permitext_sessions ORDER BY user_id`,
      sql`SELECT credential_id, user_id FROM permitext_passkey_credentials ORDER BY credential_id`,
      sql`
        SELECT user_id, mutation
        FROM (
          SELECT user_id, mutation, record_id FROM permitext_saved_items
          UNION ALL
          SELECT user_id, mutation, record_id FROM permitext_annotations
          UNION ALL
          SELECT user_id, mutation, record_id FROM permitext_projects
          UNION ALL
          SELECT user_id, mutation, record_id FROM permitext_project_items
          UNION ALL
          SELECT user_id, mutation, record_id FROM permitext_user_content_records
          WHERE entity_kind IN ('continuity', 'codeVersionClear', 'workboard')
        ) AS user_content
        ORDER BY user_id, record_id
      `
    ]);

    for (const row of users) {
      store.users[row.id] = safeJSON(row.account, {});
    }
    for (const row of entitlements) {
      store.entitlements[row.user_id] = safeJSON(row.entitlement, {});
    }
    for (const row of appleTransactionOwners) {
      store.appleTransactionOwners[row.original_transaction_id] = row.user_id;
    }
    for (const row of sessions) {
      store.sessions[row.user_id] = row.session_token;
    }
    for (const row of passkeyCredentials) {
      store.passkeyCredentials[row.credential_id] = row.user_id;
    }
    for (const row of mutations) {
      if (!store.mutationsByUserID[row.user_id]) {
        store.mutationsByUserID[row.user_id] = [];
      }
      store.mutationsByUserID[row.user_id].push(safeJSON(row.mutation, {}));
    }

    return store;
  }

  const migrateLegacyStateIfNeeded = createSingleFlightInitializer(async () => {
    const [{ count }] = await sql`
      SELECT (
        (SELECT count(*) FROM permitext_users) +
        (SELECT count(*) FROM permitext_entitlements) +
        (SELECT count(*) FROM permitext_sessions) +
        (SELECT count(*) FROM permitext_passkey_credentials) +
        (SELECT count(*) FROM permitext_user_content_records) +
        (SELECT count(*) FROM permitext_saved_items) +
        (SELECT count(*) FROM permitext_annotations) +
        (SELECT count(*) FROM permitext_projects) +
        (SELECT count(*) FROM permitext_project_items)
      )::int AS count
    `;
    if (Number(count) === 0) {
      const legacyStore = await readLegacyStore();
      if (storeHasData(legacyStore)) {
        await writeNormalizedStore(legacyStore, { backupLegacy: false });
      }
    }
  });

  return {
    kind: "postgres",
    schema: "normalized-v4",
    rateLimitMode: "postgres",
    async consumeRateLimit(input) {
      await ensureSchema();
      return rateLimitRepository.consume(input);
    },
    async initialize() {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
    },
    async read() {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return readNormalizedStore();
    },
    async write(store) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      await writeNormalizedStore(store);
    },
    async latestEventID(userID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return latestEventID(userID);
    },
    async mutationsAfterEventID(userID, sinceEventID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return mutationsAfterEventID(userID, sinceEventID);
    },
    async authenticateUserSession(userID, rawToken) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.authenticate(userID, rawToken);
    },
    async signInAccount(account) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.signIn(account);
    },
    async mergeUserAccounts(sourceUserID, targetUserID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.mergeAccounts(sourceUserID, targetUserID);
    },
    async updateAccount(userID, account) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.updateAccount(userID, account);
    },
    async accountExists(userID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      const rows = await sql`SELECT id FROM permitext_users WHERE id = ${userID} LIMIT 1`;
      return rows.length > 0;
    },
    async saveEntitlement(userID, entitlement) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.saveEntitlement(userID, entitlement);
    },
    async claimAppleEntitlement(userID, originalTransactionID, entitlement) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.claimAppleEntitlement(userID, originalTransactionID, entitlement);
    },
    async deleteEntitlement(userID, expected) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.deleteEntitlement(userID, expected);
    },
    async stripeEntitlementOwner(subscriptionID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.stripeEntitlementOwner(subscriptionID);
    },
    async deleteLegacyPasskeyAccounts() {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.deleteLegacyPasskeyAccounts();
    },
    async hasActiveUserSession(userID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.hasActiveSession(userID);
    },
    async revokeUserSession(userID, rawToken) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.revoke(userID, rawToken);
    },
    async deleteAccount(userID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      const existingRows = await sql`SELECT id FROM permitext_users WHERE id = ${userID} LIMIT 1`;
      if (!existingRows.length) return false;

      await sql.transaction([
        sql`
          DELETE FROM permitext_project_memberships
          WHERE user_id = ${userID}
             OR organization_id IN (
               SELECT id FROM permitext_organizations WHERE owner_user_id = ${userID}
             )
             OR project_id IN (
               SELECT project_id
               FROM permitext_project_ownerships
               WHERE storage_owner_user_id = ${userID}
                  OR (owner_kind = 'user' AND owner_id = ${userID})
                  OR organization_id IN (
                    SELECT id FROM permitext_organizations WHERE owner_user_id = ${userID}
                  )
             )
        `,
        sql`
          DELETE FROM permitext_organization_invitations
          WHERE organization_id IN (
                  SELECT id FROM permitext_organizations WHERE owner_user_id = ${userID}
                )
             OR invited_user_id = ${userID}
             OR invitation->>'invitedByUserID' = ${userID}
             OR invitation->>'acceptedByUserID' = ${userID}
        `,
        sql`
          DELETE FROM permitext_organization_memberships
          WHERE user_id = ${userID}
             OR organization_id IN (
               SELECT id FROM permitext_organizations WHERE owner_user_id = ${userID}
             )
        `,
        sql`
          DELETE FROM permitext_project_ownerships
          WHERE storage_owner_user_id = ${userID}
             OR (owner_kind = 'user' AND owner_id = ${userID})
             OR organization_id IN (
               SELECT id FROM permitext_organizations WHERE owner_user_id = ${userID}
             )
        `,
        sql`DELETE FROM permitext_organizations WHERE owner_user_id = ${userID}`,
        sql`DELETE FROM permitext_sync_events WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_saved_items WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_annotations WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_projects WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_project_items WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_comments WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_evidence_snapshots WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_research_answers WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_project_activity WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_project_links WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_foundation_artifacts WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_artifact_revisions WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_migration_checkpoints WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_research_feedback WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_research_usage WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_research_conversations WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_user_content_records WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_account_sessions WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_sessions WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_entitlements WHERE user_id = ${userID}`,
        sql`DELETE FROM permitext_passkey_credentials WHERE user_id = ${userID}`,
        sql`
          UPDATE permitext_sync_state
          SET users = users - ${userID},
              entitlements = entitlements - ${userID},
              sessions = sessions - ${userID},
              mutations_by_user_id = mutations_by_user_id - ${userID},
              passkey_credentials = COALESCE((
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(passkey_credentials) AS entry
                WHERE entry.value #>> '{}' <> ${userID}
              ), '{}'::jsonb),
              updated_at = now()
          WHERE id = 'default'
        `,
        sql`DELETE FROM permitext_users WHERE id = ${userID}`
      ], { isolationLevel: "Serializable" });
      return true;
    },
    async listResearchConversations(userID, options = {}) {
      await ensureSchema();
      const projectID = String(options.projectID || "").trim();
      if (options.summaryOnly) {
        // Project only list fields so large messages/visuals never leave the database row.
        const summaryRows = projectID
          ? await sql`
              SELECT jsonb_build_object(
                'id', conversation->>'id',
                'title', conversation->>'title',
                'createdAt', conversation->>'createdAt',
                'updatedAt', conversation->>'updatedAt',
                'historyHiddenAt', conversation->>'historyHiddenAt',
                'primaryProjectID', conversation->>'primaryProjectID',
                'starterQuestion', COALESCE(
                  NULLIF(conversation->>'starterQuestion', ''),
                  NULLIF(conversation#>>'{messages,0,question}', '')
                ),
                'projectContextReviewRequired', COALESCE((conversation->>'projectContextReviewRequired')::boolean, false),
                'sourceStatus', COALESCE(conversation->>'sourceStatus', 'current'),
                'messageCount', jsonb_array_length(COALESCE(conversation->'messages', '[]'::jsonb)),
                'sources', COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'kind', 'selection',
                    'sectionID', src->>'sectionID'
                  ))
                  FROM jsonb_array_elements(COALESCE(conversation->'sources', '[]'::jsonb)) AS src
                  WHERE src->>'kind' = 'selection'
                ), '[]'::jsonb)
              ) AS conversation
              FROM permitext_research_conversations
              WHERE user_id = ${userID}
                AND conversation->>'primaryProjectID' = ${projectID}
              ORDER BY updated_at DESC
            `
          : await sql`
              SELECT jsonb_build_object(
                'id', conversation->>'id',
                'title', conversation->>'title',
                'createdAt', conversation->>'createdAt',
                'updatedAt', conversation->>'updatedAt',
                'historyHiddenAt', conversation->>'historyHiddenAt',
                'primaryProjectID', conversation->>'primaryProjectID',
                'starterQuestion', COALESCE(
                  NULLIF(conversation->>'starterQuestion', ''),
                  NULLIF(conversation#>>'{messages,0,question}', '')
                ),
                'projectContextReviewRequired', COALESCE((conversation->>'projectContextReviewRequired')::boolean, false),
                'sourceStatus', COALESCE(conversation->>'sourceStatus', 'current'),
                'messageCount', jsonb_array_length(COALESCE(conversation->'messages', '[]'::jsonb)),
                'sources', COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'kind', 'selection',
                    'sectionID', src->>'sectionID'
                  ))
                  FROM jsonb_array_elements(COALESCE(conversation->'sources', '[]'::jsonb)) AS src
                  WHERE src->>'kind' = 'selection'
                ), '[]'::jsonb)
              ) AS conversation
              FROM permitext_research_conversations
              WHERE user_id = ${userID}
              ORDER BY updated_at DESC
            `;
        return summaryRows.map((row) => safeJSON(row.conversation, {}));
      }
      const rows = projectID
        ? await sql`
            SELECT conversation
            FROM permitext_research_conversations
            WHERE user_id = ${userID}
              AND conversation->>'primaryProjectID' = ${projectID}
            ORDER BY updated_at DESC
          `
        : await sql`
            SELECT conversation
            FROM permitext_research_conversations
            WHERE user_id = ${userID}
            ORDER BY updated_at DESC
          `;
      return rows.map((row) => safeJSON(row.conversation, {}));
    },
    async saveResearchConversation(userID, conversation) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_research_conversations (
          id, user_id, title, conversation, created_at, updated_at
        )
        VALUES (
          ${conversation.id},
          ${userID},
          ${conversation.title},
          ${JSON.stringify(conversation)}::jsonb,
          ${conversation.createdAt}::timestamptz,
          ${conversation.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          conversation = EXCLUDED.conversation,
          updated_at = EXCLUDED.updated_at
        WHERE permitext_research_conversations.user_id = ${userID}
      `;
      return conversation;
    },
    async updateResearchCandidateDisposition(userID, conversationID, change) {
      await ensureSchema();
      const retainedLimit = change.disposition === "rejected" ? 99 : 100;
      const rows = await sql`
        UPDATE permitext_research_conversations AS stored
        SET conversation = (
              jsonb_set(
                stored.conversation,
                '{candidateDispositions}',
                CASE
                  WHEN ${change.disposition} = 'rejected'
                    THEN COALESCE((
                      SELECT jsonb_agg(candidate.item ORDER BY candidate.position)
                      FROM (
                        SELECT entries.item, entries.position
                        FROM jsonb_array_elements(
                          COALESCE(stored.conversation->'candidateDispositions', '[]'::jsonb)
                        ) WITH ORDINALITY AS entries(item, position)
                        WHERE entries.item->>'candidateID' <> ${change.candidateID}
                        ORDER BY entries.position DESC
                        LIMIT ${retainedLimit}
                      ) AS candidate
                    ), '[]'::jsonb) || jsonb_build_array(${JSON.stringify(change.record)}::jsonb)
                  ELSE COALESCE((
                    SELECT jsonb_agg(candidate.item ORDER BY candidate.position)
                    FROM (
                      SELECT entries.item, entries.position
                      FROM jsonb_array_elements(
                        COALESCE(stored.conversation->'candidateDispositions', '[]'::jsonb)
                      ) WITH ORDINALITY AS entries(item, position)
                      WHERE entries.item->>'candidateID' <> ${change.candidateID}
                      ORDER BY entries.position DESC
                      LIMIT ${retainedLimit}
                    ) AS candidate
                  ), '[]'::jsonb)
                END,
                true
              ) || jsonb_build_object('updatedAt', ${change.updatedAt})
            ),
            updated_at = ${change.updatedAt}::timestamptz
        WHERE stored.id = ${conversationID} AND stored.user_id = ${userID}
        RETURNING stored.conversation
      `;
      return rows.length ? safeJSON(rows[0].conversation, null) : null;
    },
    async deleteResearchConversation(userID, conversationID) {
      await ensureSchema();
      const rows = await sql`
        DELETE FROM permitext_research_conversations
        WHERE id = ${conversationID} AND user_id = ${userID}
        RETURNING id
      `;
      return rows.length > 0;
    },
    async listFoundationArtifacts(userID, options = {}) {
      await ensureSchema();
      const ids = Array.isArray(options.ids)
        ? options.ids.map((value) => String(value || "").trim()).filter(Boolean)
        : null;
      if (ids && ids.length === 0) return [];
      const rows = ids
        ? await sql`
            SELECT envelope, payload
            FROM permitext_foundation_artifacts
            WHERE user_id = ${userID}
              AND id = ANY(${ids})
            ORDER BY updated_at DESC
          `
        : await sql`
            SELECT envelope, payload
            FROM permitext_foundation_artifacts
            WHERE user_id = ${userID}
            ORDER BY updated_at DESC
          `;
      return rows.map((row) => ({
        envelope: safeJSON(row.envelope, {}),
        payload: safeJSON(row.payload, {})
      }));
    },
    async saveFoundationArtifact(userID, artifact) {
      await ensureSchema();
      const envelope = artifact.envelope;
      await sql`
        INSERT INTO permitext_foundation_artifacts (
          id, user_id, artifact_type, envelope, payload,
          created_at, updated_at, archived_at, deleted_at
        )
        VALUES (
          ${envelope.id}, ${userID}, ${envelope.type},
          ${JSON.stringify(envelope)}::jsonb, ${JSON.stringify(artifact.payload || {})}::jsonb,
          ${envelope.createdAt}::timestamptz, ${envelope.updatedAt}::timestamptz,
          ${envelope.archivedAt}::timestamptz, ${envelope.deletedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          artifact_type = EXCLUDED.artifact_type,
          envelope = EXCLUDED.envelope,
          payload = EXCLUDED.payload,
          updated_at = EXCLUDED.updated_at,
          archived_at = EXCLUDED.archived_at,
          deleted_at = EXCLUDED.deleted_at
        WHERE permitext_foundation_artifacts.user_id = ${userID}
          AND permitext_foundation_artifacts.updated_at <= EXCLUDED.updated_at
      `;
      return artifact;
    },
    async saveFoundationArtifactCompareAndSwap(userID, artifact, expectedVersion) {
      await ensureSchema();
      const existingRows = await sql`
        SELECT envelope, payload
        FROM permitext_foundation_artifacts
        WHERE user_id = ${userID} AND id = ${artifact.envelope.id}
        LIMIT 1
      `;
      const existing = existingRows[0]
        ? {
            envelope: safeJSON(existingRows[0].envelope, {}),
            payload: safeJSON(existingRows[0].payload, {})
          }
        : null;
      const next = compareAndSwapFoundationArtifact(existing, artifact, expectedVersion);
      if (existing && next === existing) return existing;
      const envelope = next.envelope;
      if (!existing) {
        await sql`
          INSERT INTO permitext_foundation_artifacts (
            id, user_id, artifact_type, envelope, payload,
            created_at, updated_at, archived_at, deleted_at
          )
          VALUES (
            ${envelope.id}, ${userID}, ${envelope.type},
            ${JSON.stringify(envelope)}::jsonb, ${JSON.stringify(next.payload || {})}::jsonb,
            ${envelope.createdAt}::timestamptz, ${envelope.updatedAt}::timestamptz,
            ${envelope.archivedAt}::timestamptz, ${envelope.deletedAt}::timestamptz
          )
        `;
        return next;
      }
      const rows = await sql`
        UPDATE permitext_foundation_artifacts
        SET
          artifact_type = ${envelope.type},
          envelope = ${JSON.stringify(envelope)}::jsonb,
          payload = ${JSON.stringify(next.payload || {})}::jsonb,
          updated_at = ${envelope.updatedAt}::timestamptz,
          archived_at = ${envelope.archivedAt}::timestamptz,
          deleted_at = ${envelope.deletedAt}::timestamptz
        WHERE user_id = ${userID}
          AND id = ${envelope.id}
          AND (envelope->>'version')::int = ${Number(expectedVersion)}
        RETURNING id
      `;
      if (!rows.length) {
        throw new CodeQuestionCommandError(
          "This Code Question record changed after you opened it.",
          { code: "CODE_QUESTION_VERSION_CONFLICT", status: 409 }
        );
      }
      return next;
    },
    async allocateCodeQuestionCounter(userID, scope, scopeKey) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_counters (
          user_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          scope_key TEXT NOT NULL,
          value INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, scope, scope_key)
        )
      `;
      const rows = await sql`
        INSERT INTO permitext_code_question_counters (user_id, scope, scope_key, value, updated_at)
        VALUES (${userID}, ${scope}, ${scopeKey}, 1, now())
        ON CONFLICT (user_id, scope, scope_key) DO UPDATE SET
          value = permitext_code_question_counters.value + 1,
          updated_at = now()
        RETURNING value
      `;
      return { value: Number(rows[0].value) };
    },
    async listCodeQuestionPendingIssuance(userID) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_pending_issuance (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          record JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      const rows = await sql`
        SELECT record FROM permitext_code_question_pending_issuance
        WHERE user_id = ${userID}
      `;
      return rows.map((row) => safeJSON(row.record, {}));
    },
    async saveCodeQuestionPendingIssuance(userID, record) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_pending_issuance (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          record JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        INSERT INTO permitext_code_question_pending_issuance (id, user_id, record, updated_at)
        VALUES (${record.id}, ${userID}, ${JSON.stringify(record)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          record = EXCLUDED.record,
          updated_at = now()
        WHERE permitext_code_question_pending_issuance.user_id = ${userID}
      `;
      return record;
    },
    async reserveCodeQuestionIssuance(userID, input) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_counters (
          user_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          scope_key TEXT NOT NULL,
          value INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, scope, scope_key)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_pending_issuance (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          record JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      const baseRecord = createPendingIssuanceRecord({
        ...input,
        issueVersion: 1,
        stagedObjectKey: `${input.stagedPrefix}issue-v1/${input.deterministicHash}`
      });
      const lockKey = `${userID}:code-question-issue:${input.questionID}`;
      const [_, insertedRows, existingRows, activeRows] = await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`,
        sql`
          WITH existing AS (
            SELECT record
            FROM permitext_code_question_pending_issuance
            WHERE user_id = ${userID}
              AND record->>'questionID' = ${input.questionID}
              AND record->>'idempotencyKey' = ${input.idempotencyKey}
          ), active AS (
            SELECT record
            FROM permitext_code_question_pending_issuance
            WHERE user_id = ${userID}
              AND record->>'questionID' = ${input.questionID}
              AND record->>'status' IN ('reserved', 'staged', 'committing')
            LIMIT 1
          ), next_counter AS (
            INSERT INTO permitext_code_question_counters (user_id, scope, scope_key, value, updated_at)
            SELECT ${userID}, 'issueVersion', ${input.questionID}, 1, now()
            WHERE NOT EXISTS (SELECT 1 FROM existing) AND NOT EXISTS (SELECT 1 FROM active)
            ON CONFLICT (user_id, scope, scope_key) DO UPDATE SET
              value = permitext_code_question_counters.value + 1,
              updated_at = now()
            RETURNING value
          )
          INSERT INTO permitext_code_question_pending_issuance (id, user_id, record, updated_at)
          SELECT
            ${input.id},
            ${userID},
            ${JSON.stringify(baseRecord)}::jsonb || jsonb_build_object(
              'issueVersion', next_counter.value,
              'stagedObjectKey', ${input.stagedPrefix} || 'issue-v' || next_counter.value::text || '/' || ${input.deterministicHash}
            ),
            now()
          FROM next_counter
          ON CONFLICT (id) DO NOTHING
          RETURNING record
        `,
        sql`
          SELECT record
          FROM permitext_code_question_pending_issuance
          WHERE id = ${input.id} AND user_id = ${userID}
          LIMIT 1
        `,
        sql`
          SELECT record
          FROM permitext_code_question_pending_issuance
          WHERE user_id = ${userID}
            AND record->>'questionID' = ${input.questionID}
            AND record->>'status' IN ('reserved', 'staged', 'committing')
          ORDER BY updated_at DESC
          LIMIT 1
        `
      ], { isolationLevel: "Serializable" });
      const pending = safeJSON(existingRows[0]?.record || insertedRows[0]?.record, null);
      if (pending) return { pending, replayed: insertedRows.length === 0 };
      const active = safeJSON(activeRows[0]?.record, null);
      throw new CodeQuestionCommandError("Another issuance attempt is already active for this Code Question.", {
        code: "CODE_QUESTION_ISSUANCE_IN_PROGRESS", status: 409, details: { pendingID: active?.id || null }
      });
    },
    async listCodeQuestionOutbox(userID) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_outbox (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          entry JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      const rows = await sql`
        SELECT entry FROM permitext_code_question_outbox WHERE user_id = ${userID}
      `;
      return rows.map((row) => safeJSON(row.entry, {}));
    },
    async saveCodeQuestionOutboxEntry(userID, entry) {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_code_question_outbox (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          entry JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        INSERT INTO permitext_code_question_outbox (id, user_id, entry, updated_at)
        VALUES (${entry.id}, ${userID}, ${JSON.stringify(entry)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          entry = EXCLUDED.entry,
          updated_at = now()
        WHERE permitext_code_question_outbox.user_id = ${userID}
      `;
      return entry;
    },
    async listProjectLinks(userID, options = {}) {
      await ensureSchema();
      const projectID = String(options.projectID || "").trim();
      const targetKind = String(options.targetKind || "").trim();
      const rows = projectID && targetKind
        ? await sql`
            SELECT link
            FROM permitext_project_links
            WHERE user_id = ${userID}
              AND project_id = ${projectID}
              AND target_kind = ${targetKind}
            ORDER BY updated_at DESC
          `
        : projectID
          ? await sql`
              SELECT link
              FROM permitext_project_links
              WHERE user_id = ${userID}
                AND project_id = ${projectID}
              ORDER BY updated_at DESC
            `
          : targetKind
            ? await sql`
                SELECT link
                FROM permitext_project_links
                WHERE user_id = ${userID}
                  AND target_kind = ${targetKind}
                ORDER BY updated_at DESC
              `
            : await sql`
                SELECT link
                FROM permitext_project_links
                WHERE user_id = ${userID}
                ORDER BY updated_at DESC
              `;
      return rows.map((row) => safeJSON(row.link, {}));
    },
    async saveProjectLink(userID, link) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_project_links (
          id, user_id, project_id, target_kind, target_id, relationship,
          link, created_at, updated_at, deleted_at
        )
        VALUES (
          ${link.id}, ${userID}, ${link.projectID}, ${link.targetKind}, ${link.targetID},
          ${link.relationship}, ${JSON.stringify(link)}::jsonb,
          ${link.createdAt}::timestamptz, ${link.updatedAt}::timestamptz,
          ${link.deletedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          project_id = EXCLUDED.project_id,
          target_kind = EXCLUDED.target_kind,
          target_id = EXCLUDED.target_id,
          relationship = EXCLUDED.relationship,
          link = EXCLUDED.link,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at
        WHERE permitext_project_links.user_id = ${userID}
          AND permitext_project_links.updated_at <= EXCLUDED.updated_at
      `;
      return link;
    },
    async replaceResearchCodeDecisionLinks(userID, {
      link,
      clearedLinks = [],
      expectedLink = null,
      expectedClearedLinks = []
    }) {
      await ensureSchema();
      const expectedByID = new Map(expectedClearedLinks.map((item) => [item.id, item]));
      if (expectedClearedLinks.length !== clearedLinks.length) {
        throw researchCodeDecisionLinkConflict();
      }
      const guardedReplace = (nextLink, expected) => expected ? sql`
        WITH changed AS (
          UPDATE permitext_project_links
          SET project_id = ${nextLink.projectID},
              target_kind = ${nextLink.targetKind},
              target_id = ${nextLink.targetID},
              relationship = ${nextLink.relationship},
              link = ${JSON.stringify(nextLink)}::jsonb,
              updated_at = ${nextLink.updatedAt}::timestamptz,
              deleted_at = ${nextLink.deletedAt}::timestamptz
          WHERE id = ${nextLink.id}
            AND user_id = ${userID}
            AND project_id = ${expected.projectID}
            AND target_kind = ${expected.targetKind}
            AND target_id = ${expected.targetID}
            AND relationship = ${expected.relationship}
            AND (link->>'version')::bigint = ${Number(expected.version || 0)}
            AND deleted_at IS NOT DISTINCT FROM ${expected.deletedAt || null}::timestamptz
            AND COALESCE(link->'metadata'->>'codeDecisionID', '') = ${String(expected.metadata?.codeDecisionID || "")}
          RETURNING id
        )
        SELECT 1 / COUNT(*)::int AS mutation_guard FROM changed
      ` : sql`
        WITH changed AS (
          INSERT INTO permitext_project_links (
            id, user_id, project_id, target_kind, target_id, relationship,
            link, created_at, updated_at, deleted_at
          )
          VALUES (
            ${nextLink.id}, ${userID}, ${nextLink.projectID}, ${nextLink.targetKind}, ${nextLink.targetID},
            ${nextLink.relationship}, ${JSON.stringify(nextLink)}::jsonb,
            ${nextLink.createdAt}::timestamptz, ${nextLink.updatedAt}::timestamptz,
            ${nextLink.deletedAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        )
        SELECT 1 / COUNT(*)::int AS mutation_guard FROM changed
      `;
      try {
        await sql.transaction(
          [
            ...clearedLinks.map((nextLink) =>
              guardedReplace(nextLink, expectedByID.get(nextLink.id) || null)
            ),
            guardedReplace(link, expectedLink)
          ],
          { isolationLevel: "Serializable" }
        );
      } catch (error) {
        if (["22012", "23505", "40001"].includes(String(error?.code || ""))) {
          throw researchCodeDecisionLinkConflict();
        }
        throw error;
      }
      return { link, clearedLinks };
    },
    async listResearchAnswers(userID, options = {}) {
      await ensureSchema();
      const projectID = String(options.projectID || "").trim();
      const rows = projectID
        ? await sql`
            SELECT answer
            FROM permitext_research_answers
            WHERE user_id = ${userID}
              AND project_id = ${projectID}
            ORDER BY created_at ASC
          `
        : await sql`
            SELECT answer
            FROM permitext_research_answers
            WHERE user_id = ${userID}
            ORDER BY created_at ASC
          `;
      return rows.map((row) => safeJSON(row.answer, {}));
    },
    async saveResearchAnswer(userID, answer) {
      await ensureSchema();
      const results = await sql.transaction([
        ...answer.evidence.map((snapshot) => sql`
          INSERT INTO permitext_evidence_snapshots (
            id, user_id, answer_id, source_id, snapshot, approved_at
          )
          VALUES (
            ${snapshot.id}, ${userID}, ${answer.id}, ${snapshot.sourceID},
            ${JSON.stringify(snapshot)}::jsonb, ${snapshot.approvedAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `),
        sql`
          INSERT INTO permitext_research_answers (
            id, user_id, conversation_id, project_id, answer, created_at
          )
          VALUES (
            ${answer.id}, ${userID}, ${answer.conversationID}, ${answer.projectID},
            ${JSON.stringify(answer)}::jsonb, ${answer.createdAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING answer
        `
      ]);
      const inserted = results.at(-1)?.[0]?.answer;
      if (inserted) return safeJSON(inserted, answer);
      const rows = await sql`
        SELECT answer
        FROM permitext_research_answers
        WHERE id = ${answer.id} AND user_id = ${userID}
        LIMIT 1
      `;
      const existing = safeJSON(rows[0]?.answer, null);
      if (!existing || canonicalJSONString(existing) !== canonicalJSONString(answer)) {
        throw new Error("Immutable Research answer cannot be changed.");
      }
      return existing;
    },
    async commitCodeQuestionIssuance(userID, { artifacts, links, events, pending }) {
      await ensureSchema();
      const queries = [
        ...artifacts.map((artifact) => {
          const envelope = artifact.envelope;
          return sql`
            INSERT INTO permitext_foundation_artifacts (
              id, user_id, artifact_type, envelope, payload,
              created_at, updated_at, archived_at, deleted_at
            )
            VALUES (
              ${envelope.id}, ${userID}, ${envelope.type},
              ${JSON.stringify(envelope)}::jsonb, ${JSON.stringify(artifact.payload || {})}::jsonb,
              ${envelope.createdAt}::timestamptz, ${envelope.updatedAt}::timestamptz,
              ${envelope.archivedAt}::timestamptz, ${envelope.deletedAt}::timestamptz
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }),
        ...links.map((link) => sql`
          INSERT INTO permitext_project_links (
            id, user_id, project_id, target_kind, target_id, relationship,
            link, created_at, updated_at, deleted_at
          )
          VALUES (
            ${link.id}, ${userID}, ${link.projectID}, ${link.targetKind}, ${link.targetID},
            ${link.relationship}, ${JSON.stringify(link)}::jsonb,
            ${link.createdAt}::timestamptz, ${link.updatedAt}::timestamptz,
            ${link.deletedAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `),
        ...events.map((event) => sql`
          INSERT INTO permitext_project_activity (
            id, user_id, project_id, action, object_kind, object_id, event, created_at
          )
          VALUES (
            ${event.id}, ${userID}, ${event.projectID}, ${event.action},
            ${event.objectKind}, ${event.objectID}, ${JSON.stringify(event)}::jsonb,
            ${event.createdAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `),
        sql`
          UPDATE permitext_code_question_pending_issuance
          SET record = ${JSON.stringify(pending)}::jsonb, updated_at = now()
          WHERE id = ${pending.id} AND user_id = ${userID}
            AND record->>'status' = 'committing'
          RETURNING id
        `
      ];
      const results = await sql.transaction(queries, { isolationLevel: "Serializable" });
      if (!results.at(-1)?.length) {
        throw new CodeQuestionCommandError("Pending issuance changed before transactional commit.", {
          code: "ISSUANCE_SAGA_INVALID_TRANSITION", status: 409
        });
      }
      return { artifacts, links, events, pending };
    },
    async listActivityEvents(userID, options = {}) {
      await ensureSchema();
      const projectID = String(options.projectID || "").trim();
      const rows = projectID
        ? await sql`
            SELECT event
            FROM permitext_project_activity
            WHERE user_id = ${userID}
              AND project_id = ${projectID}
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT event
            FROM permitext_project_activity
            WHERE user_id = ${userID}
            ORDER BY created_at DESC
          `;
      return rows.map((row) => safeJSON(row.event, {}));
    },
    async saveActivityEvent(userID, event) {
      await ensureSchema();
      const rows = await sql`
        INSERT INTO permitext_project_activity (
          id, user_id, project_id, action, object_kind, object_id, event, created_at
        )
        VALUES (
          ${event.id}, ${userID}, ${event.projectID}, ${event.action},
          ${event.objectKind}, ${event.objectID}, ${JSON.stringify(event)}::jsonb,
          ${event.createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING event
      `;
      if (rows[0]) return safeJSON(rows[0].event, event);
      const existingRows = await sql`
        SELECT event
        FROM permitext_project_activity
        WHERE id = ${event.id} AND user_id = ${userID}
        LIMIT 1
      `;
      const existing = safeJSON(existingRows[0]?.event, null);
      if (!existing || canonicalJSONString(existing) !== canonicalJSONString(event)) {
        throw new Error("Activity events are append-only.");
      }
      return existing;
    },
    async artifactRevisionState(userID, { account = false, projectIDs = [] } = {}) {
      await ensureSchema();
      if (!account && !projectIDs.length) {
        return { storageOwnerUserID: userID, account: null, projects: [] };
      }
      const rows = await sql`
        SELECT scope_kind, scope_id, revision, domains, updated_at
        FROM permitext_artifact_revisions
        WHERE user_id = ${userID}
          AND (
            (scope_kind = 'account' AND scope_id = 'account' AND ${account})
            OR (scope_kind = 'project' AND scope_id = ANY(${projectIDs}::text[]))
          )
      `;
      const byScope = new Map(rows.map((row) => [
        `${row.scope_kind}:${row.scope_id}`,
        {
          ...(row.scope_kind === "project" ? { projectID: row.scope_id } : {}),
          revision: Number(row.revision || 0),
          domains: safeJSON(row.domains, []),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
        }
      ]));
      return {
        storageOwnerUserID: userID,
        account: account ? byScope.get("account:account") || null : null,
        projects: projectIDs.map((projectID) => byScope.get(`project:${projectID}`) || {
          projectID,
          revision: 0,
          domains: [],
          updatedAt: null
        })
      };
    },
    async bumpArtifactRevisions(userID, { accountDomains = [], projects = [] } = {}) {
      await ensureSchema();
      const changes = [
        ...(normalizedArtifactDomains(accountDomains).length ? [{
          kind: "account",
          id: "account",
          domains: normalizedArtifactDomains(accountDomains)
        }] : []),
        ...normalizedArtifactProjectChanges(projects).map((project) => ({
          kind: "project",
          id: project.projectID,
          domains: project.domains
        }))
      ];
      if (!changes.length) {
        return { storageOwnerUserID: userID, account: null, projects: [] };
      }
      const results = await sql.transaction(changes.map((change) => sql`
        INSERT INTO permitext_artifact_revisions (
          user_id, scope_kind, scope_id, revision, domains, updated_at
        )
        VALUES (
          ${userID}, ${change.kind}, ${change.id}, 1,
          ${JSON.stringify(change.domains)}::jsonb, now()
        )
        ON CONFLICT (user_id, scope_kind, scope_id) DO UPDATE SET
          revision = permitext_artifact_revisions.revision + 1,
          domains = (
            SELECT COALESCE(jsonb_agg(domain ORDER BY domain), '[]'::jsonb)
            FROM (
              SELECT DISTINCT value AS domain
              FROM jsonb_array_elements_text(
                permitext_artifact_revisions.domains || EXCLUDED.domains
              )
            ) AS merged_domains
          ),
          updated_at = now()
        RETURNING revision, domains, updated_at
      `));
      const records = changes.map((change, index) => {
        const row = results[index][0];
        return {
          ...(change.kind === "project" ? { projectID: change.id } : {}),
          revision: Number(row.revision),
          domains: safeJSON(row.domains, []),
          changedDomains: change.domains,
          updatedAt: new Date(row.updated_at).toISOString()
        };
      });
      return {
        storageOwnerUserID: userID,
        account: records.find((record, index) => changes[index].kind === "account") || null,
        projects: records.filter((record, index) => changes[index].kind === "project")
      };
    },
    async migrationCheckpoint(userID, checkpointName) {
      await ensureSchema();
      const rows = await sql`
        SELECT checkpoint
        FROM permitext_migration_checkpoints
        WHERE user_id = ${userID} AND checkpoint_name = ${checkpointName}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.checkpoint, null);
    },
    async saveMigrationCheckpoint(userID, checkpointName, checkpoint) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_migration_checkpoints (
          user_id, checkpoint_name, checkpoint, updated_at
        )
        VALUES (
          ${userID}, ${checkpointName}, ${JSON.stringify(checkpoint)}::jsonb, now()
        )
        ON CONFLICT (user_id, checkpoint_name) DO UPDATE SET
          checkpoint = EXCLUDED.checkpoint,
          updated_at = now()
      `;
      return checkpoint;
    },
    async researchUsageSince(userID, since) {
      await ensureSchema();
      const rows = await sql`
        SELECT id, model, mode, input_tokens, cached_input_tokens, output_tokens, total_tokens,
               prompt_version, evidence_version, estimated_cost_usd, pricing_version, created_at
        FROM permitext_research_usage
        WHERE user_id = ${userID}
          AND created_at >= ${since}::timestamptz
          AND (
            mode <> 'reservation'
            OR created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
          )
        ORDER BY created_at DESC
      `;
      return rows.map((row) => ({
        id: row.id,
        model: row.model,
        mode: row.mode,
        inputTokens: Number(row.input_tokens || 0),
        cachedInputTokens: Number(row.cached_input_tokens || 0),
        outputTokens: Number(row.output_tokens || 0),
        totalTokens: Number(row.total_tokens || 0),
        promptVersion: row.prompt_version || null,
        evidenceVersion: row.evidence_version || null,
        estimatedCostUSD: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
        pricingVersion: row.pricing_version || null,
        createdAt: dateToISO(row.created_at)
      }));
    },
    async researchSpendSince(since) {
      await ensureSchema();
      const rows = await sql`
        SELECT
          usage.user_id,
          COALESCE(
            NULLIF(account.account->>'email', ''),
            NULLIF(account.account->>'emailAddress', ''),
            NULLIF(account.account->>'privateRelayEmail', '')
          ) AS email,
          count(*)::bigint AS requests,
          COALESCE(sum(usage.input_tokens), 0)::bigint AS input_tokens,
          COALESCE(sum(usage.output_tokens), 0)::bigint AS output_tokens,
          COALESCE(sum(usage.total_tokens), 0)::bigint AS total_tokens,
          COALESCE(sum(usage.estimated_cost_usd), 0) AS estimated_cost_usd
        FROM permitext_research_usage usage
        LEFT JOIN permitext_users account ON account.id = usage.user_id
        WHERE usage.created_at >= ${since}::timestamptz
          AND usage.mode <> 'reservation'
        GROUP BY 1, 2
        ORDER BY estimated_cost_usd DESC, requests DESC
      `;
      return rows.map((row) => ({
        userID: row.user_id,
        email: row.email || null,
        requests: Number(row.requests || 0),
        inputTokens: Number(row.input_tokens || 0),
        outputTokens: Number(row.output_tokens || 0),
        totalTokens: Number(row.total_tokens || 0),
        estimatedCostUSD: Number(Number(row.estimated_cost_usd || 0).toFixed(6))
      }));
    },
    async reserveResearchUsage(userID, reservation) {
      await ensureSchema();
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const [rows] = await sql.transaction([
            sql`
              INSERT INTO permitext_research_usage (
                id, user_id, model, mode, input_tokens, cached_input_tokens,
                output_tokens, total_tokens, created_at
              )
              SELECT
                ${reservation.id}, ${userID}, 'pending', 'reservation', 0, 0, 0, 0,
                ${reservation.createdAt}::timestamptz
              WHERE (
                ${reservation.limit}::integer IS NULL
                OR (
                  SELECT count(*)
                  FROM permitext_research_usage
                  WHERE user_id = ${userID}
                    AND created_at >= ${reservation.since}::timestamptz
                    AND (
                      mode <> 'reservation'
                      OR created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
                    )
                ) < ${reservation.limit}
              )
              ON CONFLICT (id) DO NOTHING
              RETURNING id
            `
          ], { isolationLevel: "Serializable" });
          return Boolean(rows?.length);
        } catch (error) {
          if (error?.code !== "40001" || attempt === 3) throw error;
        }
      }
      return false;
    },
    async completeResearchUsageReservation(userID, reservationID, entry) {
      await ensureSchema();
      const rows = await sql`
        UPDATE permitext_research_usage
        SET model = ${entry.model},
            mode = ${entry.mode},
            input_tokens = ${entry.inputTokens},
            cached_input_tokens = ${entry.cachedInputTokens || 0},
            output_tokens = ${entry.outputTokens},
            total_tokens = ${entry.totalTokens},
            prompt_version = ${entry.promptVersion || null},
            evidence_version = ${entry.evidenceVersion || null},
            estimated_cost_usd = ${entry.estimatedCostUSD ?? null},
            pricing_version = ${entry.pricingVersion || null},
            created_at = ${entry.createdAt}::timestamptz
        WHERE id = ${reservationID}
          AND user_id = ${userID}
          AND mode = 'reservation'
        RETURNING id
      `;
      if (!rows.length) {
        throw new Error("Research usage reservation was not found.");
      }
    },
    async commitResearchConversationMessage(userID, {
      reservationID = null,
      usageEntry = null,
      answer,
      conversation,
      events = []
    }) {
      await ensureSchema();
      const existingAnswerRows = await sql`
        SELECT answer
        FROM permitext_research_answers
        WHERE id = ${answer.id} AND user_id = ${userID}
        LIMIT 1
      `;
      if (existingAnswerRows.length) {
        const existing = safeJSON(existingAnswerRows[0].answer, null);
        if (!existing || canonicalJSONString(existing) !== canonicalJSONString(answer)) {
          throw new Error("Immutable Research answer cannot be changed.");
        }
        return { replayed: true, answer: existing, conversation };
      }

      const queries = [];
      if (reservationID && usageEntry) {
        queries.push(sql`
          UPDATE permitext_research_usage
          SET model = ${usageEntry.model},
              mode = ${usageEntry.mode},
              input_tokens = ${usageEntry.inputTokens},
              cached_input_tokens = ${usageEntry.cachedInputTokens || 0},
              output_tokens = ${usageEntry.outputTokens},
              total_tokens = ${usageEntry.totalTokens},
              prompt_version = ${usageEntry.promptVersion || null},
              evidence_version = ${usageEntry.evidenceVersion || null},
              estimated_cost_usd = ${usageEntry.estimatedCostUSD ?? null},
              pricing_version = ${usageEntry.pricingVersion || null},
              created_at = ${usageEntry.createdAt}::timestamptz
          WHERE id = ${reservationID}
            AND user_id = ${userID}
            AND mode = 'reservation'
          RETURNING id
        `);
      }
      for (const snapshot of answer.evidence || []) {
        queries.push(sql`
          INSERT INTO permitext_evidence_snapshots (
            id, user_id, answer_id, source_id, snapshot, approved_at
          )
          VALUES (
            ${snapshot.id}, ${userID}, ${answer.id}, ${snapshot.sourceID},
            ${JSON.stringify(snapshot)}::jsonb, ${snapshot.approvedAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      queries.push(sql`
        INSERT INTO permitext_research_answers (
          id, user_id, conversation_id, project_id, answer, created_at
        )
        VALUES (
          ${answer.id}, ${userID}, ${answer.conversationID}, ${answer.projectID},
          ${JSON.stringify(answer)}::jsonb, ${answer.createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `);
      queries.push(sql`
        INSERT INTO permitext_research_conversations (
          id, user_id, title, conversation, created_at, updated_at
        )
        VALUES (
          ${conversation.id},
          ${userID},
          ${conversation.title},
          ${JSON.stringify(conversation)}::jsonb,
          ${conversation.createdAt}::timestamptz,
          ${conversation.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          conversation = EXCLUDED.conversation,
          updated_at = EXCLUDED.updated_at
        WHERE permitext_research_conversations.user_id = ${userID}
      `);
      for (const event of events) {
        queries.push(sql`
          INSERT INTO permitext_project_activity (
            id, user_id, project_id, action, object_kind, object_id, event, created_at
          )
          VALUES (
            ${event.id}, ${userID}, ${event.projectID}, ${event.action},
            ${event.objectKind}, ${event.objectID}, ${JSON.stringify(event)}::jsonb,
            ${event.createdAt}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }

      const results = await sql.transaction(queries, { isolationLevel: "Serializable" });
      if (reservationID && usageEntry) {
        const usageResult = results[0];
        if (!usageResult?.length) {
          throw new Error("Research usage reservation was not found.");
        }
      }
      return { replayed: false, answer, conversation };
    },
    async releaseResearchUsageReservation(userID, reservationID) {
      await ensureSchema();
      const rows = await sql`
        DELETE FROM permitext_research_usage
        WHERE id = ${reservationID}
          AND user_id = ${userID}
          AND mode = 'reservation'
        RETURNING id
      `;
      return Boolean(rows.length);
    },
    async listResearchFeedback(userID) {
      await ensureSchema();
      const rows = await sql`
        SELECT feedback
        FROM permitext_research_feedback
        WHERE user_id = ${userID}
        ORDER BY updated_at DESC
      `;
      return rows.map((row) => safeJSON(row.feedback, {}));
    },
    async listAllResearchFeedback() {
      await ensureSchema();
      const rows = await sql`
        SELECT feedback
        FROM permitext_research_feedback
        ORDER BY updated_at DESC
      `;
      return rows.map((row) => safeJSON(row.feedback, {}));
    },
    async saveResearchFeedback(userID, feedback) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_research_feedback (
          id, user_id, conversation_id, answer_id, feedback, created_at, updated_at
        ) VALUES (
          ${feedback.id}, ${userID}, ${feedback.conversationID}, ${feedback.answerID},
          ${JSON.stringify(feedback)}::jsonb, ${feedback.createdAt}::timestamptz, ${feedback.updatedAt}::timestamptz
        )
        ON CONFLICT (user_id, answer_id) DO UPDATE SET
          feedback = EXCLUDED.feedback,
          updated_at = EXCLUDED.updated_at
      `;
      return feedback;
    },
    async updateResearchFeedback(feedbackID, feedback) {
      await ensureSchema();
      const rows = await sql`
        UPDATE permitext_research_feedback
        SET feedback = ${JSON.stringify(feedback)}::jsonb,
            updated_at = ${feedback.updatedAt}::timestamptz
        WHERE id = ${feedbackID}
        RETURNING id
      `;
      return rows.length ? feedback : null;
    },
    async organization(organizationID) {
      await ensureSchema();
      return organizationRepository.organization(organizationID);
    },
    async organizationBySlug(slug) {
      await ensureSchema();
      return organizationRepository.organizationBySlug(slug);
    },
    async listOrganizationsForUser(userID) {
      await ensureSchema();
      return organizationRepository.listOrganizationsForUser(userID);
    },
    async saveOrganization(organization) {
      await ensureSchema();
      return organizationRepository.saveOrganization(organization);
    },
    async deleteOrganization(organizationID, ownerUserID, updatedAt) {
      await ensureSchema();
      return organizationRepository.deleteOrganization(organizationID, ownerUserID, updatedAt);
    },
    async membership(organizationID, userID) {
      await ensureSchema();
      return organizationRepository.membership(organizationID, userID);
    },
    async listOrganizationMemberships(organizationID) {
      await ensureSchema();
      return organizationRepository.listOrganizationMemberships(organizationID);
    },
    async saveOrganizationMembership(membership) {
      await ensureSchema();
      return organizationRepository.saveOrganizationMembership(membership);
    },
    async invitationByTokenHash(tokenHash) {
      await ensureSchema();
      return organizationRepository.invitationByTokenHash(tokenHash);
    },
    async listOrganizationInvitations(organizationID) {
      await ensureSchema();
      return organizationRepository.listOrganizationInvitations(organizationID);
    },
    async saveOrganizationInvitation(invitation) {
      await ensureSchema();
      return organizationRepository.saveOrganizationInvitation(invitation);
    },
    async reserveOrganizationInvitation(invitation, seatLimit) {
      await ensureSchema();
      return organizationRepository.reserveOrganizationInvitation(invitation, seatLimit);
    },
    async updatePendingOrganizationInvitation(invitation) {
      await ensureSchema();
      return organizationRepository.updatePendingOrganizationInvitation(invitation);
    },
    async acceptOrganizationInvitation(invitation, membership, seatLimit) {
      await ensureSchema();
      return organizationRepository.acceptOrganizationInvitation(
        invitation,
        membership,
        seatLimit
      );
    },
    async projectOwnership(projectID) {
      await ensureSchema();
      return organizationRepository.projectOwnership(projectID);
    },
    async listProjectOwnershipsForOrganizations(organizationIDs) {
      await ensureSchema();
      return organizationRepository.listProjectOwnershipsForOrganizations(organizationIDs);
    },
    async saveProjectOwnership(ownership) {
      await ensureSchema();
      return organizationRepository.saveProjectOwnership(ownership);
    },
    async projectMembership(projectID, userID) {
      await ensureSchema();
      return organizationRepository.projectMembership(projectID, userID);
    },
    async listProjectMemberships(projectID) {
      await ensureSchema();
      return organizationRepository.listProjectMemberships(projectID);
    },
    async listProjectMembershipsForUser(userID) {
      await ensureSchema();
      return organizationRepository.listProjectMembershipsForUser(userID);
    },
    async saveProjectMembership(membership) {
      await ensureSchema();
      return organizationRepository.saveProjectMembership(membership);
    },
    async saveMembershipWithinSeatLimit(membership, seatLimit) {
      await ensureSchema();
      return organizationRepository.saveMembershipWithinSeatLimit(membership, seatLimit);
    },
    async pushUserContent(userID, mutations) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return syncRepository.push(userID, mutations);
    },
    async pullUserContent(userID, options) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return syncRepository.pull(userID, options);
    },
    async summary() {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return storageSummary();
    }
  };
}

async function storeAdapter() {
  if (cachedStoreAdapter) return cachedStoreAdapter;
  if (!cachedStoreAdapterPromise) {
    cachedStoreAdapterPromise = (async () =>
      databaseURL ? createPostgresStoreAdapter() : createFileStoreAdapter()
    )()
      .then((adapter) => {
        cachedStoreAdapter = adapter;
        return adapter;
      })
      .catch((error) => {
        cachedStoreAdapterPromise = null;
        throw error;
      });
  }
  return cachedStoreAdapterPromise;
}

async function readStore() {
  const adapter = await storeAdapter();
  return adapter.read();
}

async function writeStore(store) {
  const adapter = await storeAdapter();
  await adapter.write(store);
}

async function storageKind() {
  const adapter = await storeAdapter();
  return adapter.kind;
}

async function storageSchema() {
  const adapter = await storeAdapter();
  return adapter.schema;
}

async function latestSyncEventID(userID) {
  const adapter = await storeAdapter();
  if (typeof adapter.latestEventID !== "function") {
    return 0;
  }
  return adapter.latestEventID(userID);
}

const artifactRevisionDomains = new Set([
  "activity",
  "foundation",
  "notebook",
  "report",
  "research"
]);

function normalizedArtifactDomains(domains = []) {
  return Array.from(new Set((Array.isArray(domains) ? domains : [])
    .map((domain) => String(domain || "").trim())
    .filter((domain) => artifactRevisionDomains.has(domain)))).sort();
}

function normalizedArtifactProjectChanges(projects = []) {
  const domainsByProjectID = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    const projectID = String(project?.projectID || "").trim();
    if (!projectID) continue;
    const domains = normalizedArtifactDomains(project.domains);
    if (!domains.length) continue;
    domainsByProjectID.set(projectID, Array.from(new Set([
      ...(domainsByProjectID.get(projectID) || []),
      ...domains
    ])).sort());
  }
  return Array.from(domainsByProjectID, ([projectID, domains]) => ({ projectID, domains }));
}

async function storedArtifactRevisionState(userID, options = {}) {
  const adapter = await storeAdapter();
  if (typeof adapter.artifactRevisionState !== "function") {
    return { storageOwnerUserID: userID, account: null, projects: [] };
  }
  return adapter.artifactRevisionState(userID, options);
}

async function bumpStoredArtifactRevisions(userID, changes = {}) {
  const adapter = await storeAdapter();
  if (typeof adapter.bumpArtifactRevisions !== "function") {
    return { storageOwnerUserID: userID, account: null, projects: [] };
  }
  return adapter.bumpArtifactRevisions(userID, changes);
}

function projectArtifactRevisionChange(projectID, domains) {
  return { projects: [{ projectID, domains }] };
}

async function bumpResearchArtifactRevisions(userID, projects = []) {
  const projectChanges = normalizedArtifactProjectChanges(projects);
  const changesByStorageOwner = new Map([[userID, {
    accountDomains: ["research"],
    projects: []
  }]]);
  for (const project of projectChanges) {
    const access = await projectAccessForUser(userID, project.projectID);
    if (!access?.permissions.includes(organizationPermissions.projectView)) {
      const error = new Error("Research Project access changed before artifact revisions could be recorded.");
      error.code = "RESEARCH_PROJECT_ACCESS_CHANGED";
      throw error;
    }
    const existing = changesByStorageOwner.get(access.storageOwnerUserID) || {
      accountDomains: [],
      projects: []
    };
    existing.projects.push(project);
    changesByStorageOwner.set(access.storageOwnerUserID, existing);
  }
  const states = await Promise.all(Array.from(changesByStorageOwner, async ([storageOwnerUserID, changes]) => ({
    storageOwnerUserID,
    state: await bumpStoredArtifactRevisions(storageOwnerUserID, changes)
  })));
  const accountState = states.find(({ storageOwnerUserID }) => storageOwnerUserID === userID)?.state.account || null;
  return {
    schemaVersion: 1,
    account: accountState ? { ...accountState, storageOwnerUserID: userID } : null,
    projects: states.flatMap(({ storageOwnerUserID, state }) => state.projects.map((project) => ({
      ...project,
      storageOwnerUserID
    })))
  };
}

async function mutationsAfterSyncEventID(userID, sinceEventID) {
  const adapter = await storeAdapter();
  if (typeof adapter.mutationsAfterEventID !== "function") {
    return null;
  }
  return adapter.mutationsAfterEventID(userID, sinceEventID);
}

async function storageSummary() {
  const adapter = await storeAdapter();
  if (typeof adapter.summary === "function") {
    return adapter.summary();
  }
  return {
    storage: adapter.kind,
    schema: adapter.schema,
    latestEventID: 0,
    tables: {}
  };
}

async function listStoredResearchConversations(userID, options = {}) {
  const adapter = await storeAdapter();
  return typeof adapter.listResearchConversations === "function"
    ? adapter.listResearchConversations(userID, options)
    : [];
}

async function storedResearchConversation(userID, conversationID) {
  return (await listStoredResearchConversations(userID)).find((item) => item.id === conversationID) || null;
}

async function saveStoredResearchConversation(userID, conversation) {
  const adapter = await storeAdapter();
  return adapter.saveResearchConversation(userID, conversation);
}

async function updateStoredResearchCandidateDisposition(userID, conversationID, change) {
  const adapter = await storeAdapter();
  if (typeof adapter.updateResearchCandidateDisposition !== "function") {
    throw new Error("Candidate disposition storage is unavailable.");
  }
  return adapter.updateResearchCandidateDisposition(userID, conversationID, change);
}

async function deleteStoredResearchConversation(userID, conversationID) {
  const adapter = await storeAdapter();
  return adapter.deleteResearchConversation(userID, conversationID);
}

async function listStoredFoundationArtifacts(userID, options = {}) {
  const adapter = await storeAdapter();
  return typeof adapter.listFoundationArtifacts === "function"
    ? adapter.listFoundationArtifacts(userID, options)
    : [];
}

async function saveStoredFoundationArtifact(userID, artifact) {
  const adapter = await storeAdapter();
  return adapter.saveFoundationArtifact(userID, artifact);
}

async function saveStoredFoundationArtifactCompareAndSwap(userID, artifact, expectedVersion) {
  const adapter = await storeAdapter();
  if (typeof adapter.saveFoundationArtifactCompareAndSwap === "function") {
    return adapter.saveFoundationArtifactCompareAndSwap(userID, artifact, expectedVersion);
  }
  const existing = (await listStoredFoundationArtifacts(userID))
    .find((item) => item.envelope?.id === artifact.envelope?.id) || null;
  const next = compareAndSwapFoundationArtifact(existing, artifact, expectedVersion);
  if (existing && next === existing) return existing;
  return saveStoredFoundationArtifact(userID, next);
}

async function allocateStoredCodeQuestionCounter(userID, scope, scopeKey) {
  const adapter = await storeAdapter();
  if (typeof adapter.allocateCodeQuestionCounter === "function") {
    return adapter.allocateCodeQuestionCounter(userID, scope, scopeKey);
  }
  throw new CodeQuestionCommandError("Code Question counters are unavailable.", {
    code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
    status: 503
  });
}

async function listStoredCodeQuestionPendingIssuance(userID) {
  const adapter = await storeAdapter();
  return typeof adapter.listCodeQuestionPendingIssuance === "function"
    ? adapter.listCodeQuestionPendingIssuance(userID)
    : [];
}

async function saveStoredCodeQuestionPendingIssuance(userID, record) {
  const adapter = await storeAdapter();
  if (typeof adapter.saveCodeQuestionPendingIssuance === "function") {
    return adapter.saveCodeQuestionPendingIssuance(userID, record);
  }
  throw new CodeQuestionCommandError("Pending issuance storage is unavailable.", {
    code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
    status: 503
  });
}

async function reserveStoredCodeQuestionIssuance(userID, input) {
  const adapter = await storeAdapter();
  if (typeof adapter.reserveCodeQuestionIssuance === "function") {
    return adapter.reserveCodeQuestionIssuance(userID, input);
  }
  throw new CodeQuestionCommandError("Transactional issuance reservation is unavailable.", {
    code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
    status: 503
  });
}

async function commitStoredCodeQuestionIssuance(userID, payload) {
  const adapter = await storeAdapter();
  if (typeof adapter.commitCodeQuestionIssuance === "function") {
    return adapter.commitCodeQuestionIssuance(userID, payload);
  }
  throw new CodeQuestionCommandError("Transactional issuance commit is unavailable.", {
    code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
    status: 503
  });
}

async function saveStoredCodeQuestionOutboxEntry(userID, entry) {
  const adapter = await storeAdapter();
  if (typeof adapter.saveCodeQuestionOutboxEntry === "function") {
    return adapter.saveCodeQuestionOutboxEntry(userID, entry);
  }
  throw new CodeQuestionCommandError("Code Question outbox storage is unavailable.", {
    code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
    status: 503
  });
}

async function listStoredProjectLinks(userID, options = {}) {
  const adapter = await storeAdapter();
  return typeof adapter.listProjectLinks === "function"
    ? adapter.listProjectLinks(userID, options)
    : [];
}

async function saveStoredProjectLink(userID, link) {
  const adapter = await storeAdapter();
  return adapter.saveProjectLink(userID, link);
}

async function replaceStoredResearchCodeDecisionLinks(userID, replacement) {
  const adapter = await storeAdapter();
  if (typeof adapter.replaceResearchCodeDecisionLinks !== "function") {
    throw new CodeQuestionCommandError("Research link storage is unavailable.", {
      code: "CODE_QUESTION_STORAGE_UNAVAILABLE",
      status: 503
    });
  }
  return adapter.replaceResearchCodeDecisionLinks(userID, replacement);
}

async function listStoredResearchAnswers(userID, options = {}) {
  const adapter = await storeAdapter();
  return typeof adapter.listResearchAnswers === "function"
    ? adapter.listResearchAnswers(userID, options)
    : [];
}

async function saveStoredResearchAnswer(userID, answer) {
  const adapter = await storeAdapter();
  return adapter.saveResearchAnswer(userID, answer);
}

async function listStoredActivityEvents(userID, options = {}) {
  const adapter = await storeAdapter();
  return typeof adapter.listActivityEvents === "function"
    ? adapter.listActivityEvents(userID, options)
    : [];
}

async function saveStoredActivityEvent(userID, event) {
  const adapter = await storeAdapter();
  return adapter.saveActivityEvent(userID, event);
}

async function storedOrganization(organizationID) {
  const adapter = await storeAdapter();
  return typeof adapter.organization === "function"
    ? adapter.organization(organizationID)
    : null;
}

async function storedOrganizationBySlug(slug) {
  const adapter = await storeAdapter();
  return typeof adapter.organizationBySlug === "function"
    ? adapter.organizationBySlug(slug)
    : null;
}

async function listStoredOrganizationsForUser(userID) {
  const adapter = await storeAdapter();
  return typeof adapter.listOrganizationsForUser === "function"
    ? adapter.listOrganizationsForUser(userID)
    : [];
}

async function saveStoredOrganization(organization) {
  const adapter = await storeAdapter();
  return adapter.saveOrganization(organization);
}

async function deleteStoredOrganization(organizationID, ownerUserID, updatedAt) {
  const adapter = await storeAdapter();
  if (typeof adapter.deleteOrganization !== "function") {
    throw new Error("Firm workspace deletion is unavailable.");
  }
  return adapter.deleteOrganization(organizationID, ownerUserID, updatedAt);
}

async function storedOrganizationMembership(organizationID, userID) {
  const adapter = await storeAdapter();
  return typeof adapter.membership === "function"
    ? adapter.membership(organizationID, userID)
    : null;
}

async function listStoredOrganizationMemberships(organizationID) {
  const adapter = await storeAdapter();
  return typeof adapter.listOrganizationMemberships === "function"
    ? adapter.listOrganizationMemberships(organizationID)
    : [];
}

async function saveStoredOrganizationMembership(membership) {
  const adapter = await storeAdapter();
  return adapter.saveOrganizationMembership(membership);
}

async function storedOrganizationInvitationByToken(token) {
  const adapter = await storeAdapter();
  return typeof adapter.invitationByTokenHash === "function"
    ? adapter.invitationByTokenHash(invitationTokenHash(token))
    : null;
}

async function listStoredOrganizationInvitations(organizationID) {
  const adapter = await storeAdapter();
  return typeof adapter.listOrganizationInvitations === "function"
    ? adapter.listOrganizationInvitations(organizationID)
    : [];
}

async function saveStoredOrganizationInvitation(invitation) {
  const adapter = await storeAdapter();
  return adapter.saveOrganizationInvitation(invitation);
}

async function reserveStoredOrganizationInvitation(invitation, seatLimit) {
  const adapter = await storeAdapter();
  if (typeof adapter.reserveOrganizationInvitation !== "function") {
    throw new Error("Atomic organization invitation reservations are unavailable.");
  }
  return adapter.reserveOrganizationInvitation(invitation, seatLimit);
}

async function updateStoredPendingOrganizationInvitation(invitation) {
  const adapter = await storeAdapter();
  if (typeof adapter.updatePendingOrganizationInvitation !== "function") {
    throw new Error("Atomic organization invitation updates are unavailable.");
  }
  return adapter.updatePendingOrganizationInvitation(invitation);
}

async function acceptStoredOrganizationInvitation(invitation, membership, seatLimit) {
  const adapter = await storeAdapter();
  if (typeof adapter.acceptOrganizationInvitation !== "function") {
    throw new Error("Atomic organization invitation acceptance is unavailable.");
  }
  return adapter.acceptOrganizationInvitation(invitation, membership, seatLimit);
}

async function storedProjectOwnership(projectID) {
  const adapter = await storeAdapter();
  return typeof adapter.projectOwnership === "function"
    ? adapter.projectOwnership(projectID)
    : null;
}

async function listStoredProjectOwnershipsForOrganizations(organizationIDs) {
  const adapter = await storeAdapter();
  return typeof adapter.listProjectOwnershipsForOrganizations === "function"
    ? adapter.listProjectOwnershipsForOrganizations(organizationIDs)
    : [];
}

async function saveStoredProjectOwnership(ownership) {
  const adapter = await storeAdapter();
  return adapter.saveProjectOwnership(ownership);
}

async function storedProjectMembership(projectID, userID) {
  const adapter = await storeAdapter();
  return typeof adapter.projectMembership === "function"
    ? adapter.projectMembership(projectID, userID)
    : null;
}

async function listStoredProjectMemberships(projectID) {
  const adapter = await storeAdapter();
  return typeof adapter.listProjectMemberships === "function"
    ? adapter.listProjectMemberships(projectID)
    : [];
}

async function listStoredProjectMembershipsForUser(userID) {
  const adapter = await storeAdapter();
  return typeof adapter.listProjectMembershipsForUser === "function"
    ? adapter.listProjectMembershipsForUser(userID)
    : [];
}

async function saveStoredProjectMembership(membership) {
  const adapter = await storeAdapter();
  return adapter.saveProjectMembership(membership);
}

async function saveStoredMembershipWithinSeatLimit(membership, seatLimit) {
  const adapter = await storeAdapter();
  if (typeof adapter.saveMembershipWithinSeatLimit !== "function") {
    throw new Error("Atomic organization seat enforcement is unavailable.");
  }
  return adapter.saveMembershipWithinSeatLimit(membership, seatLimit);
}

async function storedMigrationCheckpoint(userID, checkpointName) {
  const adapter = await storeAdapter();
  return typeof adapter.migrationCheckpoint === "function"
    ? adapter.migrationCheckpoint(userID, checkpointName)
    : null;
}

async function saveStoredMigrationCheckpoint(userID, checkpointName, checkpoint) {
  const adapter = await storeAdapter();
  return adapter.saveMigrationCheckpoint(userID, checkpointName, checkpoint);
}

async function researchUsageSince(userID, since) {
  const adapter = await storeAdapter();
  return typeof adapter.researchUsageSince === "function"
    ? adapter.researchUsageSince(userID, since)
    : [];
}

async function researchSpendSince(since) {
  const adapter = await storeAdapter();
  return typeof adapter.researchSpendSince === "function"
    ? adapter.researchSpendSince(since)
    : [];
}

async function reserveResearchUsage(userID, reservation) {
  const adapter = await storeAdapter();
  if (typeof adapter.reserveResearchUsage !== "function") {
    throw new Error("Atomic Research usage reservations are unavailable.");
  }
  return adapter.reserveResearchUsage(userID, reservation);
}

async function completeResearchUsageReservation(userID, reservationID, entry) {
  const adapter = await storeAdapter();
  if (typeof adapter.completeResearchUsageReservation !== "function") {
    throw new Error("Atomic Research usage reservations are unavailable.");
  }
  await adapter.completeResearchUsageReservation(userID, reservationID, entry);
}

/**
 * In-memory file-store mutation for Research message completion.
 * Used by the file adapter under withMutation so either all of usage+answer+
 * conversation+events persist or none do.
 */
export function applyResearchConversationMessageCommit(store, userID, {
  reservationID = null,
  usageEntry = null,
  answer,
  conversation,
  events = [],
  testThrowAfterUsage = false
}) {
  store.researchAnswersByUserID ||= {};
  store.researchConversationsByUserID ||= {};
  store.activityEventsByUserID ||= {};
  store.researchUsageByUserID ||= {};

  const answers = store.researchAnswersByUserID[userID] || [];
  const existingAnswer = answers.find((item) => item.id === answer.id);
  if (existingAnswer) {
    if (canonicalJSONString(existingAnswer) !== canonicalJSONString(answer)) {
      throw new Error("Immutable Research answer cannot be changed.");
    }
    const conversations = store.researchConversationsByUserID[userID] || [];
    const hasConversation = conversations.some((item) => item.id === conversation.id);
    if (!hasConversation) {
      throw new Error("Research conversation missing after answer commit.");
    }
    return { replayed: true, answer: existingAnswer, conversation };
  }

  if (reservationID && usageEntry) {
    const usageEntries = store.researchUsageByUserID[userID] || [];
    const usageIndex = usageEntries.findIndex((item) =>
      item.id === reservationID && item.mode === "reservation"
    );
    if (usageIndex === -1) {
      throw new Error("Research usage reservation was not found.");
    }
    usageEntries[usageIndex] = { ...usageEntry, id: reservationID };
    store.researchUsageByUserID[userID] = usageEntries;
  }

  if (testThrowAfterUsage) {
    throw new Error("TEST_THROW_AFTER_USAGE");
  }

  answers.push(answer);
  store.researchAnswersByUserID[userID] = answers;

  const conversations = store.researchConversationsByUserID[userID] || [];
  const conversationIndex = conversations.findIndex((item) => item.id === conversation.id);
  if (conversationIndex === -1) conversations.push(conversation);
  else conversations[conversationIndex] = conversation;
  store.researchConversationsByUserID[userID] = conversations;

  const activity = store.activityEventsByUserID[userID] || [];
  for (const event of events) {
    const existing = activity.find((item) => item.id === event.id);
    if (existing && canonicalJSONString(existing) !== canonicalJSONString(event)) {
      throw new Error("Activity events are append-only.");
    }
    if (!existing) activity.push(event);
  }
  store.activityEventsByUserID[userID] = activity;

  return { replayed: false, answer, conversation };
}

async function commitResearchConversationMessage(userID, payload) {
  const adapter = await storeAdapter();
  if (typeof adapter.commitResearchConversationMessage === "function") {
    return adapter.commitResearchConversationMessage(userID, payload);
  }
  // Fallback: persist answer/conversation/events first, then mark usage complete so a
  // crash cannot leave usage billed without durable research records.
  await saveStoredResearchAnswer(userID, payload.answer);
  await saveStoredResearchConversation(userID, payload.conversation);
  for (const event of payload.events || []) {
    await saveStoredActivityEvent(userID, event);
  }
  if (payload.reservationID && payload.usageEntry) {
    await completeResearchUsageReservation(userID, payload.reservationID, payload.usageEntry);
  }
  return { replayed: false, answer: payload.answer, conversation: payload.conversation };
}

async function releaseResearchUsageReservation(userID, reservationID) {
  const adapter = await storeAdapter();
  if (typeof adapter.releaseResearchUsageReservation === "function") {
    await adapter.releaseResearchUsageReservation(userID, reservationID);
  }
}

async function listStoredResearchFeedback(userID) {
  const adapter = await storeAdapter();
  return typeof adapter.listResearchFeedback === "function"
    ? adapter.listResearchFeedback(userID)
    : [];
}

async function saveStoredResearchFeedback(userID, feedback) {
  const adapter = await storeAdapter();
  if (typeof adapter.saveResearchFeedback !== "function") {
    throw new Error("Research feedback storage is unavailable.");
  }
  return adapter.saveResearchFeedback(userID, feedback);
}

async function listAllStoredResearchFeedback() {
  const adapter = await storeAdapter();
  return typeof adapter.listAllResearchFeedback === "function"
    ? adapter.listAllResearchFeedback()
    : [];
}

async function updateStoredResearchFeedback(feedbackID, feedback) {
  const adapter = await storeAdapter();
  if (typeof adapter.updateResearchFeedback !== "function") {
    throw new Error("Research feedback triage storage is unavailable.");
  }
  return adapter.updateResearchFeedback(feedbackID, feedback);
}

export function requestBodyLimit(environment = process.env) {
  const configured = Number(environment.PERMITEXT_MAX_REQUEST_BODY_BYTES);
  return Number.isSafeInteger(configured) && configured >= 64 * 1024 && configured <= 10 * 1024 * 1024
    ? configured
    : defaultRequestBodyLimit;
}

class RequestBodyTooLargeError extends Error {}

async function readBody(request, limit = requestBodyLimit()) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new RequestBodyTooLargeError();
  }
  const chunks = [];
  let byteCount = 0;
  for await (const chunk of request) {
    byteCount += chunk.length;
    if (byteCount > limit) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJSON(request) {
  const raw = (await readBody(request)).toString("utf8");
  return raw.length ? JSON.parse(raw) : {};
}

async function readRawBody(request) {
  return readBody(request);
}

function securityHeaders() {
  return {
    "cross-origin-opener-policy": "same-origin-allow-popups",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  };
}

function sendJSON(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function sendRawJSON(response, status, body) {
  response.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendError(response, status, message, extraHeaders = {}) {
  sendJSON(response, status, { error: message }, extraHeaders);
}

function researchRequestSignal(signal, timeoutMilliseconds) {
  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function researchProgressResponder(request, response, enabled) {
  let started = false;
  let ended = false;
  let sequence = 0;
  let activeStageID = null;
  const events = [];
  const startedAt = new Date().toISOString();
  const cancellationController = new AbortController();

  const cancel = () => {
    if (!ended && !cancellationController.signal.aborted) cancellationController.abort();
  };
  request.once("aborted", cancel);
  response.once("close", () => {
    if (!response.writableEnded) cancel();
  });

  const start = () => {
    if (!enabled || started || response.headersSent || response.writableEnded) return;
    response.writeHead(200, {
      ...securityHeaders(),
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no"
    });
    started = true;
  };
  const write = (value) => {
    if (!enabled || ended || response.writableEnded || cancellationController.signal.aborted) return;
    start();
    response.write(`${JSON.stringify(value)}\n`);
  };
  const progress = (stageID, state) => {
    if (cancellationController.signal.aborted) {
      const error = new Error("Research request cancelled.");
      error.code = "RESEARCH_CANCELLED";
      throw error;
    }
    const event = createResearchProgressEvent({ stageID, state, sequence: ++sequence });
    if (state === "active" || state === "retrying") activeStageID = stageID;
    if (["completed", "failed", "cancelled"].includes(state) && activeStageID === stageID) {
      activeStageID = null;
    }
    events.push(event);
    write({ type: "progress", progress: event });
    return event;
  };
  const assertActive = () => {
    if (!cancellationController.signal.aborted) return;
    const error = new Error("Research request cancelled.");
    error.code = "RESEARCH_CANCELLED";
    throw error;
  };
  const json = (status, body, extraHeaders = {}) => {
    if (!enabled) {
      sendJSON(response, status, body, extraHeaders);
      return;
    }
    if (ended || response.writableEnded) return;
    if (status >= 400 && activeStageID && !cancellationController.signal.aborted) {
      progress(activeStageID, "failed");
    }
    write(status >= 400
      ? { type: "error", error: { status, message: body?.error || "Research request failed.", code: body?.code || null } }
      : { type: "result", payload: body });
    ended = true;
    response.end();
  };
  const error = (status, message, extra = {}) => json(status, { error: message, ...extra });
  const failActive = (state) => {
    if (activeStageID && !cancellationController.signal.aborted) progress(activeStageID, state);
  };
  return {
    enabled,
    signal: cancellationController.signal,
    startedAt,
    events,
    progress,
    assertActive,
    json,
    error,
    failActive,
    summary: (completedAt) => researchProgressSummary(events, { startedAt, completedAt })
  };
}

function sendHTML(response, html, { scriptNonce = null, extraHeaders = {} } = {}) {
  const scriptPolicy = scriptNonce
    ? `'self' 'nonce-${scriptNonce}' https://appleid.cdn-apple.com`
    : "'self' https://appleid.cdn-apple.com";
  response.writeHead(200, {
    ...securityHeaders(),
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": [
      "default-src 'self'",
      `script-src ${scriptPolicy}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://appleid.apple.com"
    ].join("; "),
    ...extraHeaders
  });
  response.end(html);
}

function sendStatic(response, contentType, body, cacheControl = "no-store", extraHeaders = {}) {
  response.writeHead(200, {
    ...securityHeaders(),
    "content-type": contentType,
    "cache-control": cacheControl,
    "vercel-cdn-cache-control": cacheControl,
    ...extraHeaders
  });
  response.end(body);
}

function sendNotFound(response) {
  sendError(response, 404, "Not found.");
}

function contentTypeForPath(path) {
  if (path.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (path.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (path.endsWith(".webmanifest")) {
    return "application/manifest+json; charset=utf-8";
  }
  if (path.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (path.endsWith(".avif")) {
    return "image/avif";
  }
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".gif")) {
    return "image/gif";
  }
  if (path.endsWith(".webp")) {
    return "image/webp";
  }
  if (path.endsWith(".woff2")) {
    return "font/woff2";
  }
  if (path.endsWith(".woff")) {
    return "font/woff";
  }
  return "application/octet-stream";
}

async function constructionVisualSourceMetadata(reference) {
  const assetName = String(reference?.assetName || "").trim();
  if (!/^[a-zA-Z0-9._-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(assetName)) return null;
  let metadataPromise = constructionVisualAssetMetadataCache.get(assetName);
  if (!metadataPromise) {
    metadataPromise = readFile(join(assetContentPath, assetName))
      .then((body) => {
        const contentHash = createHash("sha256").update(body).digest("hex");
        return {
          id: `visual-source-${createHash("sha256")
            .update(`${assetName}\u001f${contentHash}`)
            .digest("hex")
            .slice(0, 24)}`,
          kind: "image",
          assetName,
          assetURL: `/code/assets/${encodeURIComponent(assetName)}`,
          mediaType: contentTypeForPath(assetName),
          contentHash,
          byteLength: body.length
        };
      })
      .catch((error) => {
        constructionVisualAssetMetadataCache.delete(assetName);
        if (error.code === "ENOENT") return null;
        throw error;
      });
    constructionVisualAssetMetadataCache.set(assetName, metadataPromise);
  }
  const metadata = await metadataPromise;
  return metadata ? {
    ...metadata,
    displayWidth: reference?.displayWidth || null,
    displayHeight: reference?.displayHeight || null
  } : null;
}

async function constructionVisualSourceWithContent(source) {
  const assetName = String(source?.assetName || "").trim();
  if (!/^[a-zA-Z0-9._-]+\.(?:gif|jpe?g|png|webp)$/i.test(assetName)) {
    const error = new Error("The selected visual evidence format is not supported for Research.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  let body;
  try {
    body = await readFile(join(assetContentPath, assetName));
  } catch (error) {
    if (error.code === "ENOENT") {
      const missing = new Error("The selected visual evidence is no longer available in the enacted source.");
      missing.code = "INVALID_RESEARCH_VISUAL_SOURCE";
      throw missing;
    }
    throw error;
  }
  const contentHash = createHash("sha256").update(body).digest("hex");
  const currentID = `visual-source-${createHash("sha256")
    .update(`${assetName}\u001f${contentHash}`)
    .digest("hex")
    .slice(0, 24)}`;
  if (
    currentID !== source.id ||
    contentHash !== source.contentHash ||
    body.length !== Number(source.byteLength)
  ) {
    const error = new Error("The selected visual evidence no longer matches the current enacted source.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  return {
    id: currentID,
    kind: "image",
    assetName,
    assetURL: source.assetURL,
    mediaType: source.mediaType,
    contentHash,
    byteLength: body.length,
    displayWidth: source.displayWidth || null,
    displayHeight: source.displayHeight || null,
    dataBase64: body.toString("base64")
  };
}

function bearerToken(request) {
  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function requireAdmin(request, response) {
  const adminToken = process.env.PERMITEXT_SYNC_ADMIN_TOKEN;
  if (!adminToken) {
    sendError(response, 403, "Admin API is disabled.");
    return false;
  }
  if (!timingSafeAdminTokenEqual(bearerToken(request), adminToken)) {
    sendError(response, 401, "Unauthorized.");
    return false;
  }
  return true;
}

function requireGrantAdmin(request, response) {
  const configuredTokens = [
    process.env.PERMITEXT_SYNC_ADMIN_TOKEN,
    process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN
  ];
  if (!configuredTokens.some(Boolean)) {
    sendError(response, 403, "Grant API is disabled.");
    return false;
  }
  if (!matchesConfiguredAdminToken(bearerToken(request), configuredTokens)) {
    sendError(response, 401, "Unauthorized.");
    return false;
  }
  return true;
}

function requireSessionToken(request, response, sessionToken, requestAccount) {
  const suppliedToken = bearerToken(request) || requestAccount?.backendSessionToken;
  if (!suppliedToken) {
    sendError(response, 401, "Missing session token.");
    return false;
  }
  if (!sessionToken) {
    sendError(response, 401, "Session not found.");
    return false;
  }

  if (suppliedToken !== sessionToken) {
    sendError(response, 401, "Unauthorized.");
    return false;
  }
  return true;
}

async function authenticatedUserContext(request, response, userID, requestAccount, store = null) {
  const suppliedToken = bearerToken(request) || requestAccount?.backendSessionToken;
  if (!suppliedToken) {
    sendError(response, 401, "Missing session token.");
    return null;
  }
  const adapter = await storeAdapter();
  if (typeof adapter.authenticateUserSession === "function") {
    const context = await adapter.authenticateUserSession(userID, suppliedToken);
    if (!context) {
      sendError(response, 401, "Unauthorized.");
      return null;
    }
    if (!await enforceAuthenticatedRateLimit(request, response, userID)) {
      return null;
    }
    return { ...context, sessionToken: suppliedToken };
  }

  const localStore = store || await readStore();
  if (!requireSessionToken(request, response, localStore.sessions[userID], requestAccount)) {
    return null;
  }
  if (!await enforceAuthenticatedRateLimit(request, response, userID)) {
    return null;
  }
  return {
    account: localStore.users[userID] || null,
    entitlement: localStore.entitlements[userID] || null,
    sessionToken: suppliedToken
  };
}

async function userHasActiveSession(userID, store = null) {
  const adapter = await storeAdapter();
  if (typeof adapter.hasActiveUserSession === "function") {
    return adapter.hasActiveUserSession(userID);
  }
  const localStore = store || await readStore();
  return Boolean(localStore.sessions[userID]);
}

function normalizePath(url) {
  return new URL(url, "http://localhost").pathname.replace(/^\/+/, "");
}

function requestURL(request) {
  return new URL(request.url, "http://localhost");
}

function blobStorageConfigured(environment = process.env) {
  return Boolean(
    environment.BLOB_READ_WRITE_TOKEN ||
    (environment.VERCEL_OIDC_TOKEN && environment.BLOB_STORE_ID)
  );
}

function safeWorkboardPathHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);
}

function workboardAssetPrefix(userID, projectID) {
  return `project-assets/${safeWorkboardPathHash(projectID)}/workboards/`;
}

function legacyWorkboardAssetPrefix(userID, projectID) {
  return `workboards/${safeWorkboardPathHash(userID)}/${safeWorkboardPathHash(projectID)}/`;
}

function workboardAssetPathBelongsToProject(pathname, userID, projectID) {
  return pathname.startsWith(workboardAssetPrefix(userID, projectID)) ||
    pathname.startsWith(legacyWorkboardAssetPrefix(userID, projectID));
}

function notebookAssetPrefix(projectID) {
  return `project-assets/${safeWorkboardPathHash(projectID)}/notebook/`;
}

function notebookAssetExtension(contentType) {
  return {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[contentType] || "";
}

function notebookAssetPathname(projectID, assetID, contentType) {
  return `${notebookAssetPrefix(projectID)}${safeWorkboardPathHash(assetID)}.${notebookAssetExtension(contentType)}`;
}

function notebookAssetPathBelongsToProject(pathname, projectID) {
  return pathname.startsWith(notebookAssetPrefix(projectID)) && /\.(?:gif|jpg|png|webp)$/.test(pathname);
}

function workboardAssetExtension(contentType) {
  return {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[contentType] || "";
}

function workboardAssetPathname(userID, projectID, fileID, contentType) {
  const extension = workboardAssetExtension(contentType);
  return `${workboardAssetPrefix(userID, projectID)}${safeWorkboardPathHash(fileID)}.${extension}`;
}

function workboardPreviewPrefix(projectID) {
  return `project-assets/${safeWorkboardPathHash(projectID)}/workboard-previews/`;
}

function workboardPreviewPathname(projectID, previewID) {
  return `${workboardPreviewPrefix(projectID)}${safeWorkboardPathHash(previewID)}.png`;
}

function workboardPreviewPathBelongsToProject(pathname, projectID) {
  return pathname.startsWith(workboardPreviewPrefix(projectID)) && pathname.endsWith(".png");
}

function localPrivateAssetRoot() {
  return String(process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH || "").trim();
}

function notebookLocalAssetRoot() {
  return localPrivateAssetRoot() || join(dirname(fileURLToPath(import.meta.url)), "data", "private-assets");
}

function notebookImageStorage(providerName = "") {
  return createImageStorageProvider({
    environment: process.env,
    localRoot: notebookLocalAssetRoot(),
    loadBlobModule: vercelBlob,
    providerName
  });
}

function notebookImageContentType(body) {
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (body.length >= 3 && body[0] === 255 && body[1] === 216 && body[2] === 255) return "image/jpeg";
  if (body.length >= 6 && ["GIF87a", "GIF89a"].includes(body.subarray(0, 6).toString("ascii"))) {
    return "image/gif";
  }
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return "";
}

function privateProjectAssetStorageConfigured() {
  return blobStorageConfigured() || Boolean(localPrivateAssetRoot());
}

function reportFilePrefix(projectID) {
  return `project-assets/${safeWorkboardPathHash(projectID)}/reports/`;
}

function reportFilePathname(projectID, manifestID, generatedReportID, format) {
  return [
    reportFilePrefix(projectID),
    safeWorkboardPathHash(manifestID),
    "/",
    safeWorkboardPathHash(generatedReportID),
    "-",
    format,
    ".pdf"
  ].join("");
}

function reportFilePathBelongsToProject(pathname, projectID) {
  return pathname.startsWith(reportFilePrefix(projectID)) && pathname.endsWith(".pdf");
}

async function storePrivateProjectAsset(pathname, body, contentType) {
  if (blobStorageConfigured()) {
    const { put } = await vercelBlob();
    const blob = await put(pathname, body, {
      access: "private",
      addRandomSuffix: false,
      contentType
    });
    return blob.pathname || pathname;
  }
  const root = localPrivateAssetRoot();
  if (!root) throw new Error("Private Report file storage is not configured.");
  const filePath = resolveContainedPrivatePath(root, pathname);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, body, { flag: "wx" });
  return pathname;
}

async function readPrivateProjectAsset(pathname) {
  if (blobStorageConfigured()) {
    const { get } = await vercelBlob();
    const result = await get(pathname, { access: "private" });
    if (!result || !result.stream) return null;
    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  const root = localPrivateAssetRoot();
  if (!root) return null;
  try {
    return await readFile(resolveContainedPrivatePath(root, pathname));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function storePrivateReportFile(pathname, body) {
  return storePrivateProjectAsset(pathname, body, "application/pdf");
}

async function storeOrVerifyPrivateProjectAsset(pathname, body, contentType) {
  try {
    return await storePrivateProjectAsset(pathname, body, contentType);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readPrivateProjectAsset(pathname);
    if (!existing || !Buffer.from(existing).equals(Buffer.from(body))) {
      throw new Error("A deterministic staged output exists with different content.");
    }
    return pathname;
  }
}

function codeMemoFilePathname(projectID, manifestID, format) {
  const extension = format === "pdf" ? "pdf" : format === "html" ? "html" : "json";
  return `${reportFilePrefix(projectID)}${safeWorkboardPathHash(manifestID)}/code-memo.${extension}`;
}

async function readPrivateReportFile(pathname) {
  return readPrivateProjectAsset(pathname);
}

async function vercelBlob() {
  blobModulePromise ||= import("@vercel/blob");
  return blobModulePromise;
}

async function enforceRateLimitPrincipals(request, response, path, principals) {
  if (!rateLimitPolicies.has(path)) return true;
  try {
    const adapter = await storeAdapter();
    const decision = await consumeRateLimit({
      repository: {
        consume: (input) => adapter.consumeRateLimit(input)
      },
      path,
      principals
    });
    if (decision.allowed) return true;
    sendError(response, 429, "Too many requests. Try again later.", {
      "retry-after": String(decision.retryAfterSeconds)
    });
    return false;
  } catch (error) {
    console.error("Rate-limit enforcement failed.", {
      path,
      storage: await storageKind().catch(() => "unavailable"),
      message: error?.message || String(error)
    });
    sendError(response, 503, "Request protection is temporarily unavailable.", {
      "retry-after": "5"
    });
    return false;
  }
}

async function enforceRateLimit(request, response, path) {
  const principals = [
    clientRateLimitPrincipal(request),
    verifiedAdminRateLimitPrincipal(request, path)
  ].filter(Boolean);
  return enforceRateLimitPrincipals(request, response, path, principals);
}

const authenticatedRateLimitAccounts = Symbol("authenticatedRateLimitAccounts");

async function enforceAuthenticatedRateLimit(request, response, userID) {
  const path = normalizePath(request.url);
  if (!rateLimitPolicies.has(path)) return true;
  request[authenticatedRateLimitAccounts] ||= new Map();
  const accountPrincipal = accountRateLimitPrincipal(userID);
  const requestKey = `${path}:${accountPrincipal}`;
  if (request[authenticatedRateLimitAccounts].has(requestKey)) {
    return request[authenticatedRateLimitAccounts].get(requestKey);
  }
  const allowed = await enforceRateLimitPrincipals(request, response, path, [accountPrincipal]);
  request[authenticatedRateLimitAccounts].set(requestKey, allowed);
  return allowed;
}

async function readJSONFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const codeSectionIDPrefixMap = new Map([
  [1, "BC"],
  [3, "AC"],
  [4, "FGC"],
  [5, "PC"],
  [6, "MC"]
]);

function normalizeChapterNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function compareChapterNumbers(left, right) {
  const leftNumber = normalizeChapterNumber(left);
  const rightNumber = normalizeChapterNumber(right);
  const leftNumeric = /^\d+$/.test(leftNumber);
  const rightNumeric = /^\d+$/.test(rightNumber);

  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }
  if (leftNumeric && rightNumeric) {
    return Number.parseInt(leftNumber, 10) - Number.parseInt(rightNumber, 10);
  }
  return leftNumber.localeCompare(rightNumber, undefined, { numeric: true, sensitivity: "base" });
}

async function chapterManifest() {
  if (cachedChapterManifest) {
    return cachedChapterManifest;
  }

  try {
    const manifest = await readJSONFile(chapterManifestPath);
    cachedChapterManifest = new Map(
      (manifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter])
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    cachedChapterManifest = new Map();
  }
  return cachedChapterManifest;
}

async function canonicalSectionIDs() {
  if (cachedCanonicalSectionIDs) {
    return cachedCanonicalSectionIDs;
  }
  try {
    cachedCanonicalSectionIDs = await readJSONFile(canonicalSectionIDsPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    cachedCanonicalSectionIDs = {
      byCodeChapterSection: {},
      legacyWebSectionID: {}
    };
  }
  return cachedCanonicalSectionIDs;
}

function htmlParagraphBlockIDs(block) {
  if (block?.kind !== "html" || !block.html) {
    return [];
  }
  const matches = [...String(block.html).matchAll(/<[^>]+\bid=["']([^"']+)["'][^>]*\bclass=["'][^"']*\bNormal-Level\b[^"']*["'][^>]*>/gi)];
  return matches.map((match) => String(match[1] || "").trim()).filter(Boolean);
}

async function canonicalBlockIDsForSectionID(sectionID) {
  const key = String(sectionID || "").trim();
  if (!key) {
    return [];
  }
  if (cachedCanonicalBlockIDsBySectionID.has(key)) {
    return cachedCanonicalBlockIDsBySectionID.get(key);
  }
  let blockIDs = [];
  const map = await canonicalSectionIDs();
  const legacyWebSectionID = Object.entries(map.legacyWebSectionID || {})
    .find(([, canonicalID]) => String(canonicalID) === key)?.[0];
  let payload = await sectionBody(key, {
    allowMissing: true,
    canonicalSectionID: key
  });
  if (!payload.blocks?.length && legacyWebSectionID && legacyWebSectionID !== key) {
    payload = await sectionBody(legacyWebSectionID, {
      allowMissing: true,
      canonicalSectionID: key
    });
  }
  blockIDs = (payload.blocks || []).flatMap(htmlParagraphBlockIDs);
  cachedCanonicalBlockIDsBySectionID.set(key, blockIDs);
  return blockIDs;
}

function canonicalSectionKey(codePrefix, chapterNumber, sectionNumber) {
  const prefix = String(codePrefix || "").trim().toUpperCase();
  const chapter = String(chapterNumber || "").trim();
  const section = String(sectionNumber || "").trim();
  return prefix && chapter && section ? `${prefix}:${chapter}:${section}` : "";
}

async function canonicalSectionIDFor({ codePrefix, chapterNumber, sectionNumber, sectionID, allowLegacySectionID = false }) {
  const map = await canonicalSectionIDs();
  const keyed = map.byCodeChapterSection?.[canonicalSectionKey(codePrefix, chapterNumber, sectionNumber)];
  if (Number.isInteger(keyed)) {
    return keyed;
  }
  const hasSectionNumber = Boolean(String(sectionNumber || "").trim());
  const legacy = map.legacyWebSectionID?.[String(sectionID || "").trim()];
  if (allowLegacySectionID && !hasSectionNumber && Number.isInteger(legacy)) {
    return legacy;
  }
  return null;
}

async function canonicalBlockIDFor(sectionID, blockID) {
  const normalized = normalizedBlockID(blockID);
  if (!normalized) {
    return normalized;
  }
  const legacyMatch = normalized.match(/^\d+-html-(\d+)$/i);
  if (!legacyMatch) {
    return normalized;
  }
  const blockIndex = Number(legacyMatch[1]) - 1;
  if (!Number.isSafeInteger(blockIndex) || blockIndex < 0) {
    return normalized;
  }
  const blockIDs = await canonicalBlockIDsForSectionID(sectionID);
  return blockIDs[blockIndex] || normalized;
}

async function canonicalizeSectionPayload(section, chapterContext) {
  const publishedID = Number(section.id);
  if (Number.isSafeInteger(publishedID) && publishedID > 0) {
    return section;
  }
  const canonicalID = await canonicalSectionIDFor({
    ...chapterContext,
    sectionNumber: section.sectionNumber,
    sectionID: section.id
  });
  if (!canonicalID || canonicalID === section.id) {
    return section;
  }
  return {
    ...section,
    id: canonicalID,
    webSectionID: section.id
  };
}

async function canonicalizeChapterSections(sections, chapterContext) {
  return Promise.all(sections.map((section) => canonicalizeSectionPayload(section, chapterContext)));
}

function codePrefixForChapter(chapter, manifestChapter = null) {
  const manifestPrefix = codeSectionIDPrefixMap.get(Number(manifestChapter?.codeSectionID));
  if (manifestPrefix) {
    return manifestPrefix;
  }

  const headerLine = (chapter.groups || [])
    .map((group) => group.headerLine || "")
    .find((line) => /^SECTION\s+[A-Z]+/i.test(line)) || "";
  if (/^SECTION\s+BC\s+28-/i.test(headerLine)) {
    return "AC";
  }
  const prefix = headerLine.match(/^SECTION\s+([A-Z]+)/i)?.[1]?.toUpperCase();
  if (prefix) {
    return prefix;
  }
  const chapterID = Number.parseInt(chapter.chapterID, 10);
  if (chapterID >= 1 && chapterID <= 35) {
    return "BC";
  }
  if (chapterID >= 36 && chapterID <= 58) {
    return "BC";
  }
  if (chapterID >= 59 && chapterID <= 65) {
    return "FGC";
  }
  return "";
}

function normalizedConstructionHeaderLine(headerLine, codePrefix) {
  const value = String(headerLine || "").trim();
  if (codePrefix === "AC") {
    return value.replace(/^SECTION\s+BC\s+(?=28-)/i, "SECTION ");
  }
  return value;
}

function normalizedConstructionChapterGroups(groups, codePrefix) {
  return (groups || []).map((group) => ({
    ...group,
    headerLine: normalizedConstructionHeaderLine(group.headerLine, codePrefix)
  }));
}

function displayTitleForChapter(chapter) {
  const chapterNumber = String(chapter.chapterNumber || "").trim();
  const isAppendix = chapterNumber && !/^\d+$/.test(chapterNumber);
  return isAppendix ? `Appendix ${chapterNumber}` : `Chapter ${chapterNumber || chapter.chapterID}`;
}

function fullTitleForChapter(chapter, displayTitle, codePrefix = "") {
  const lines = String(chapter.rawDraftText || "").split(/\r?\n/);
  const heading = lines
    .map((line) => line.match(/^#-\s*(.+?)\s*$/)?.[1])
    .find(Boolean);
  if (codePrefix === "AC" && heading) {
    const article = lines
      .map((line) => line.match(/^Article\s+\S+:\s*(.+?)\s*$/i)?.[0])
      .find(Boolean);
    return article ? `${heading} - ${article}` : heading;
  }
  return heading || displayTitle;
}

async function chapterIndex() {
  if (cachedChapterIndex) {
    return cachedChapterIndex;
  }
  const files = await readdir(chapterContentPath);
  const manifest = await chapterManifest();
  const chaptersByKey = new Map();
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const chapter = await readJSONFile(join(chapterContentPath, file));
    const manifestChapter = manifest.get(String(chapter.chapterID));
    const firstGroup = chapter.groups?.[0] || {};
    const codePrefix = codePrefixForChapter(chapter, manifestChapter);
    const chapterNumber = manifestChapter?.chapterNumber || chapter.chapterNumber;
    const displayTitle = displayTitleForChapter({ ...chapter, chapterNumber });
    const chapterSummary = {
      id: chapter.chapterID,
      codePrefix,
      codeSectionID: manifestChapter?.codeSectionID || null,
      chapterNumber,
      displayTitle,
      fullTitle: fullTitleForChapter(chapter, displayTitle, codePrefix),
      title: firstGroup.headingLine || `Chapter ${chapter.chapterNumber}`,
      groupCount: chapter.groups?.length || 0,
      sectionCount: (chapter.groups || []).reduce((count, group) => count + (group.sections?.length || 0), 0),
      manifestSectionCount: manifestChapter?.sectionCount || 0
    };
    const canonicalKey = `${codePrefix}:${normalizeChapterNumber(chapterNumber)}`;
    const existing = chaptersByKey.get(canonicalKey);
    if (
      !existing ||
      (chapterSummary.manifestSectionCount || chapterSummary.sectionCount) >
        (existing.manifestSectionCount || existing.sectionCount)
    ) {
      chaptersByKey.set(canonicalKey, chapterSummary);
    }
  }
  cachedChapterIndex = Array.from(chaptersByKey.values()).sort((left, right) =>
    String(left.codePrefix).localeCompare(String(right.codePrefix)) ||
    compareChapterNumbers(left.chapterNumber, right.chapterNumber) ||
    Number(left.id) - Number(right.id)
  );
  return cachedChapterIndex;
}

function flattenChapterSections(chapter) {
  return (chapter.groups || []).flatMap((group) =>
    (group.sections || []).map((section) => ({
      ...section,
      groupID: group.id,
      headerLine: group.headerLine,
      headingLine: group.headingLine
    }))
  );
}

async function sectionCatalog() {
  if (cachedSectionCatalog) {
    return cachedSectionCatalog;
  }
  if (cachedSectionCatalogPromise) {
    return cachedSectionCatalogPromise;
  }
  cachedSectionCatalogPromise = buildSectionCatalog();
  try {
    cachedSectionCatalog = await cachedSectionCatalogPromise;
    return cachedSectionCatalog;
  } finally {
    cachedSectionCatalogPromise = null;
  }
}

async function buildSectionCatalog() {
  const chapters = await chapterIndex();
  const sectionSummaries = [];
  for (const chapterSummary of chapters) {
    const chapter = await readJSONFile(join(chapterContentPath, `${chapterSummary.id}.json`));
    const groups = normalizedConstructionChapterGroups(chapter.groups, chapterSummary.codePrefix);
    for (const section of flattenChapterSections({ ...chapter, groups })) {
      const canonicalSection = await canonicalizeSectionPayload(section, {
        codePrefix: chapterSummary.codePrefix,
        chapterNumber: chapterSummary.chapterNumber
      });
      sectionSummaries.push({
        id: canonicalSection.id,
        webSectionID: section.id,
        chapterID: chapterSummary.id,
        codePrefix: chapterSummary.codePrefix,
        codeSectionID: chapterSummary.codeSectionID,
        chapterNumber: chapterSummary.chapterNumber,
        sectionNumber: section.sectionNumber,
        title: section.title,
        headerLine: section.headerLine,
        headingLine: section.headingLine
      });
    }
  }
  return sectionSummaries;
}

async function shippedSearchIndex() {
  if (!cachedShippedSearchIndex) {
    const payload = await readJSONFile(shippedSearchIndexPath);
    cachedShippedSearchIndex = new Map(
      Object.entries(payload.tokens || {}).map(([token, sectionIDs]) => [
        token,
        normalizedSortedPostingList(sectionIDs)
      ])
    );
  }
  return cachedShippedSearchIndex;
}

function tokenizeSearchText(text) {
  const tokens = [];
  let current = "";
  const flush = () => {
    if (current.length >= 2) tokens.push(current);
    current = "";
  };
  for (const character of String(text || "").toLowerCase()) {
    if (/\s/u.test(character)) {
      flush();
    } else if (/[\p{L}\p{N}]/u.test(character) || character === "." || character === "-") {
      current += character;
    } else {
      flush();
    }
  }
  flush();
  return tokens;
}

function plainTextFromPreparedHTML(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#176;/gi, "°")
    .replace(/&#215;/gi, "×")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&#8216;|&#8217;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function preparedBodyWithDerivedPlainText(body) {
  return {
    ...body,
    blocks: (body.blocks || []).map((block) => {
      if (String(block.plainText || "").trim() || !block.html) return block;
      const plainText = plainTextFromPreparedHTML(block.html);
      return plainText ? { ...block, plainText } : block;
    })
  };
}

function bodyContainsRichSource(body) {
  return (body?.blocks || []).some((block) =>
    block.kind === "table" ||
    block.kind === "image" ||
    /<(?:scrolltable|table|img)\b/i.test(String(block.html || ""))
  );
}

function bodyReferencesRichSource(body) {
  return (body?.blocks || []).some((block) =>
    /\b(?:Table|Figure)\s+[A-Z]?\d|\bfire\s+district\s+maps?\b/i.test(
      `${block.plainText || ""} ${plainTextFromPreparedHTML(block.html || "")}`
    )
  );
}

async function bodyEnrichedWithOfficialRichSource(body, sectionID) {
  const summary = await sectionSummaryByID(sectionID);
  const htmlBody = await constructionHTMLBodyForSection(summary);
  if (officialBodyHasUnboundImages(body, htmlBody)) {
    return htmlBody;
  }
  if (bodyContainsRichSource(body) || !bodyReferencesRichSource(body)) {
    return body;
  }
  return bodyContainsRichSource(htmlBody) ? htmlBody : body;
}

async function sectionBody(sectionID, options = {}) {
  const canonicalSectionID = String(options.canonicalSectionID || "").trim();
  const legacySectionID = String(sectionID || "").trim();
  const candidates = [];
  if (canonicalSectionID) {
    candidates.push(join(canonicalSectionContentPath, `${canonicalSectionID}.json`));
  }
  if (legacySectionID && legacySectionID !== canonicalSectionID) {
    candidates.push(join(canonicalSectionContentPath, `${legacySectionID}.json`));
  }
  if (legacySectionID && (!canonicalSectionID || legacySectionID !== canonicalSectionID)) {
    candidates.push(join(legacySectionContentPath, `${legacySectionID}.json`));
  }

  for (const candidate of candidates) {
    try {
      const preparedBody = preparedBodyWithDerivedPlainText(await readJSONFile(candidate));
      return await bodyEnrichedWithOfficialRichSource(
        preparedBody,
        canonicalSectionID || legacySectionID
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const summary = await sectionSummaryByID(canonicalSectionID || legacySectionID);
  const htmlBody = await constructionHTMLBodyForSection(summary);
  if (htmlBody) {
    return htmlBody;
  }

  if (options.allowMissing) {
    return { blocks: [], sectionID: Number(canonicalSectionID || legacySectionID) };
  }
  const error = new Error(`Section content is unavailable for ${canonicalSectionID || legacySectionID}.`);
  error.code = "ENOENT";
  throw error;
}

async function sectionSummaryByID(sectionID) {
  const normalizedID = String(sectionID || "").trim();
  return (await sectionCatalog()).find((section) =>
    String(section.id) === normalizedID || String(section.webSectionID || "") === normalizedID
  ) || null;
}

function normalizedResearchText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readableResearchSelectionText(value, maxLength) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength)
    .trimEnd();
}

function comparableResearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    // Prepared plain text can add spaces where an inline element meets its
    // surrounding quotation marks or punctuation even though the reader does
    // not render those spaces (for example: `" <em>Title</em> ,"`).
    .replace(/(^|[\s([{])"\s+/g, '$1"')
    .replace(/\s+([,.;:!?%])/g, "$1")
    .replace(/\s+"(?=$|[\s,.;:!?%)\]}])/g, '"')
    .trim();
}

const maximumResearchSelectionCharacters = 12_000;
const maximumResearchSelectionSetCharacters = 48_000;

function matchingCanonicalResearchSelection(value, canonicalText) {
  const readable = readableResearchSelectionText(value, maximumResearchSelectionCharacters);
  const withoutReaderChrome = readableResearchSelectionText(
    readable.replace(/(?:^|\s)(?:Has note|Bookmarked)(?=\s|$)/gi, " "),
    maximumResearchSelectionCharacters
  );
  const canonicalComparable = comparableResearchText(canonicalText);
  for (const candidate of Array.from(new Set([readable, withoutReaderChrome]))) {
    if (candidate.length >= 2 && canonicalComparable.includes(comparableResearchText(candidate))) {
      return candidate;
    }
  }
  return "";
}

async function researchEvidenceForSectionIDs(sectionIDs, options = {}) {
  const evidence = [];
  const charactersPerSection = Math.min(12_000, Math.floor(60_000 / sectionIDs.length));
  const chapterSummaries = await chapterIndex();
  for (const requestedID of sectionIDs) {
    let summary;
    let canonicalID;
    let body;
    let enactedBodyText;
    let canonicalText;
    let text;
    try {
      summary = await sectionSummaryByID(requestedID);
      if (!summary) {
        const error = new Error(`Unknown code section: ${requestedID}.`);
        error.code = "INVALID_RESEARCH_SECTION";
        throw error;
      }
      canonicalID = String(summary.id || summary.sectionID || requestedID);
      body = await sectionBody(summary.webSectionID || requestedID, {
        allowMissing: false,
        canonicalSectionID: canonicalID
      });
      const rawText = (body.blocks || []).map((block) => block.plainText || "").join("\n\n");
      enactedBodyText = String(rawText || "").replace(/\s+/g, " ").trim();
      canonicalText = [summary.sectionNumber, summary.title, enactedBodyText]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      text = enactedBodyText.slice(0, charactersPerSection);
      if (!enactedBodyText) {
        const error = new Error(`Section ${summary.sectionNumber || canonicalID} has no enacted text available for research.`);
        error.code = "INCOMPLETE_RESEARCH_SECTION";
        throw error;
      }
    } catch (error) {
      const warning = unavailableReportEvidenceWarning(error, {
        requestedID: String(requestedID),
        canonicalID: String(canonicalID || requestedID),
        sectionNumber: String(summary?.sectionNumber || ""),
        title: String(summary?.title || "")
      });
      if (!options.skipUnavailable || !warning) {
        throw error;
      }
      options.onUnavailable?.(warning);
      continue;
    }
    const visualReferences = visualSourceReferences(body);
    const visualSources = (await Promise.all(
      visualReferences.map((reference) =>
        constructionVisualSourceMetadata(reference)
      )
    )).filter(Boolean);
    const chapterSummary = chapterSummaries.find((chapter) =>
      chapter.codePrefix === String(summary.codePrefix || body.codePrefix || "") &&
      String(chapter.chapterNumber) === String(summary.chapterNumber || body.chapterNumber || "")
    );
    evidence.push({
      sectionID: canonicalID,
      sectionNumber: String(summary.sectionNumber || body.sectionNumber || ""),
      title: String(summary.title || body.title || "Section"),
      codePrefix: String(summary.codePrefix || body.codePrefix || ""),
      chapterNumber: String(summary.chapterNumber || body.chapterNumber || ""),
      chapterTitle: String(chapterSummary?.fullTitle || chapterSummary?.displayTitle || ""),
      sectionGroupLabel: String(summary.headerLine || body.headerLine || ""),
      sectionGroupTitle: String(summary.headingLine || body.headingLine || ""),
      text,
      canonicalText,
      sectionTextHash: createHash("sha256").update(canonicalText).digest("hex"),
      richSources: structuredRichSources(body),
      visualSourceReferenceCount: visualReferences.length,
      visualSources
    });
  }
  return evidence;
}

function researchPrompt(question, evidence, options = {}) {
  const sources = evidence.map((section) => {
    const lines = [
      `PASSAGE_ID: ${section.sourceID}`,
      `SECTION_ID: ${section.sectionID}`,
      `CODE: ${section.codePrefix}`,
      `SECTION: ${section.sectionNumber}`,
      `TITLE: ${section.title}`,
      `CODE_EDITION: ${section.codeEdition || defaultResearchCodeEdition}`,
      `CODE_VERSION: ${section.codeVersion || defaultSyncCodeVersion}`,
      `EVIDENCE_ORIGIN: ${section.origin || "user_pinned"}`,
      `EVIDENCE_FUNCTION: ${section.evidencePriority?.primaryFunction || "candidate"}`,
      `EVIDENCE_ROLE: ${section.evidencePriority?.evidenceRole || "supporting"}`,
      `TOPIC_ROUTE_RELATIONSHIP: ${section.evidencePriority?.topicRouteRelationship || "unrestricted"}`,
      `REQUIRED_CLAIM_COVERAGE: ${section.evidencePriority?.claimCoverageRequired === true ? "yes" : "no"}`,
      section.evidencePriority?.claimCoverageReason
        ? `REQUIRED_CLAIM_REASON: ${section.evidencePriority.claimCoverageReason}`
        : "",
      `ENACTED_TEXT: ${section.text}`
    ].filter(Boolean);
    if (section.richSourceID && section.richSourceGrids) {
      lines.push(
        `STRUCTURED_OFFICIAL_SOURCE: ${section.richSourceCanonicalReference || section.richSourceReference || section.richSourceID}`,
        `STRUCTURED_SOURCE_CONTENT_HASH: ${section.richSourceContentHash}`,
        `STRUCTURED_TABLE_GRIDS_JSON: ${JSON.stringify(section.richSourceGrids)}`
      );
    }
    for (const visualSource of section.visualSources || []) {
      lines.push(
        `ATTACHED_OFFICIAL_VISUAL_SOURCE_ID: ${visualSource.id}`,
        `ATTACHED_VISUAL_ASSET: ${visualSource.assetName}`,
        `ATTACHED_VISUAL_MEDIA_TYPE: ${visualSource.mediaType}`,
        `ATTACHED_VISUAL_CONTENT_HASH: ${visualSource.contentHash}`
      );
    }
    return lines.join("\n");
  }).join("\n\n---\n\n");
  const history = (options.messages || []).slice(-8).map((message) => {
    if (message.role === "user") return `USER: ${message.question || ""}`;
    const supportedPoints = (message.answer?.supportedPoints || [])
      .map((point, index) => `${index + 1}. ${point.heading}: ${point.explanation}`)
      .join("\n");
    return [
      `ASSISTANT: ${message.answer?.conclusion || ""}`,
      supportedPoints,
      message.answer?.explanation || ""
    ].filter(Boolean).join("\n");
  }).join("\n\n");
  const projectFacts = (options.projectContextFacts || [])
    .map((fact, index) => `${index + 1}. ${fact}`)
    .join("\n");
  const conversationFacts = options.conversationFactContext || {};
  const establishedConversationFacts = (conversationFacts.established || [])
    .map((fact, index) => `${index + 1}. ${fact}`)
    .join("\n");
  const hypotheticalConversationFacts = (conversationFacts.hypothetical || [])
    .map((fact, index) => `${index + 1}. ${fact}`)
    .join("\n");
  const unknownConversationFacts = (conversationFacts.unknown || [])
    .map((fact, index) => `${index + 1}. ${fact}`)
    .join("\n");
  const supportingWebContext = options.webSupport?.sources?.length
    ? [
        "SUPPORTING WEB CONTEXT — NONCONTROLLING",
        "This material may explain or contextualize the enacted text. It cannot create or override a governing requirement.",
        options.webSupport.summary || "",
        ...options.webSupport.sources.map((source) => [
          `WEB_SOURCE_ID: ${source.id}`,
          `SOURCE_CLASS: ${source.authorityClass}`,
          `TITLE: ${source.title}`,
          `PUBLISHER: ${source.publisher}`,
          `URL: ${source.url}`
        ].join("\n"))
      ].filter(Boolean).join("\n\n")
    : "";
  const revisionFeedback = Array.isArray(options.revisionFeedback) && options.revisionFeedback.length
    ? [
        "VERIFIER FEEDBACK FOR ONE BOUNDED REVISION",
        options.revisionFeedback
          .map((issue, index) => `${index + 1}. ${issue.type}: ${issue.detail}`)
          .join("\n"),
        "REVISION NON-REGRESSION RULES",
        "Resolve all listed feedback together while preserving every supported conclusion and established fact that the feedback does not contradict.",
        "Do not fix one issue by inventing an unsupplied legal requirement, asking the user to reconfirm an established fact, or weakening the strongest conclusion supported by the same evidence.",
        "For a numeric table comparison, retain the direct result under the strictest directly applicable supplied limit before discussing a more generous conditional allowance or a genuinely unresolved measurement or modification issue."
      ].join("\n")
    : "";
  const structuredEvidenceAnalysis = options.structuredEvidenceAnalysis
    ? `STRUCTURED EVIDENCE ANALYSIS — INTERNAL RESEARCH MAP\n${JSON.stringify(options.structuredEvidenceAnalysis)}`
    : "";
  const requiredClaimChecklist = Array.isArray(options.requiredClaims) && options.requiredClaims.length
    ? `DETERMINISTIC REQUIRED CLAIM CHECKLIST\n${JSON.stringify(options.requiredClaims)}`
    : "";
  const codeBasis = options.codeBasis
    ? [
        "RESEARCH CODE BASIS",
        `JURISDICTION: ${options.codeBasis.jurisdiction}`,
        `CODE_EDITION: ${options.codeBasis.codeEdition}`,
        `CODE_VERSION: ${options.codeBasis.codeVersion}`,
        `RETRIEVAL_SCOPE: ${options.codeBasis.retrievalScope}`,
        options.codeBasis.limitation ? `LIMITATION: ${options.codeBasis.limitation}` : "",
        "Treat this as the edition boundary for the answer. Do not imply that another code edition was retrieved."
      ].filter(Boolean).join("\n")
    : "";
  return [
    `QUESTION\n${question}`,
    codeBasis,
    projectFacts
      ? [
          "USER-PROVIDED PROJECT FACTS FOR CONTEXT ONLY — NOT CODE AUTHORITY",
          "A missing fact is unknown, not false, none, or inapplicable. Identify a material missing fact instead of guessing it.",
          projectFacts
        ].join("\n")
      : "",
    establishedConversationFacts
      ? [
          "ESTABLISHED USER FACTS FOR THE ACTIVE CONVERSATION TOPIC — NOT CODE AUTHORITY",
          "Treat these as supplied facts for this discussion. Do not ask the user to reconfirm them merely because they came from an earlier turn. A later correction already supersedes the older value.",
          establishedConversationFacts
        ].join("\n")
      : "",
    hypotheticalConversationFacts
      ? [
          "CURRENT-TURN HYPOTHETICAL FACTS — NOT PERSISTENT PROJECT FACTS OR CODE AUTHORITY",
          "Apply these only to the current hypothetical question. Do not overwrite the established facts.",
          hypotheticalConversationFacts
        ].join("\n")
      : "",
    unknownConversationFacts
      ? [
          "USER-STATED UNKNOWNS FOR THE ACTIVE TOPIC",
          "These items remain unknown; do not convert them into assumptions.",
          unknownConversationFacts
        ].join("\n")
      : "",
    history ? `UNTRUSTED CONVERSATION HISTORY FOR CONTEXT ONLY — NOT AUTHORITY\n${history}` : "",
    `AUTHORIZED ENACTED EVIDENCE\n${sources}`,
    requiredClaimChecklist,
    structuredEvidenceAnalysis,
    supportingWebContext,
    revisionFeedback
  ].filter(Boolean).join("\n\n");
}

const researchEvidenceAnalysisItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    summary: { type: "string" },
    sourceIDs: { type: "array", minItems: 1, items: { type: "string" } }
  },
  required: ["label", "summary", "sourceIDs"]
};

const researchEvidenceAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    controllingProvisions: { type: "array", items: researchEvidenceAnalysisItemSchema },
    generalRules: { type: "array", items: researchEvidenceAnalysisItemSchema },
    exceptions: { type: "array", items: researchEvidenceAnalysisItemSchema },
    conditions: { type: "array", items: researchEvidenceAnalysisItemSchema },
    limitations: { type: "array", items: researchEvidenceAnalysisItemSchema },
    definitions: { type: "array", items: researchEvidenceAnalysisItemSchema },
    crossReferences: { type: "array", items: researchEvidenceAnalysisItemSchema },
    tables: { type: "array", items: researchEvidenceAnalysisItemSchema },
    userPinnedEvidence: { type: "array", items: { type: "string" } },
    permitextDiscoveredEvidence: { type: "array", items: { type: "string" } },
    projectFactsUsed: { type: "array", items: { type: "string" } },
    unresolvedProjectFacts: { type: "array", items: { type: "string" } },
    evidenceLimitations: { type: "array", minItems: 1, items: { type: "string" } },
    highValueFollowUpQuestions: { type: "array", maxItems: 8, items: { type: "string" } }
  },
  required: [
    "controllingProvisions",
    "generalRules",
    "exceptions",
    "conditions",
    "limitations",
    "definitions",
    "crossReferences",
    "tables",
    "userPinnedEvidence",
    "permitextDiscoveredEvidence",
    "projectFactsUsed",
    "unresolvedProjectFacts",
    "evidenceLimitations",
    "highValueFollowUpQuestions"
  ]
};

const researchEvidenceAnalysisCollections = [
  "controllingProvisions",
  "generalRules",
  "exceptions",
  "conditions",
  "limitations",
  "definitions",
  "crossReferences",
  "tables"
];

export function validateResearchEvidenceAnalysis(value, evidence, projectFacts = []) {
  const sourceIDs = new Set(evidence.map((source) => String(source.sourceID || "")).filter(Boolean));
  const factSet = new Set(projectFacts.map((fact) => String(fact).trim()).filter(Boolean));
  if (!value || typeof value !== "object") {
    const error = new Error("The Research evidence analysis was invalid.");
    error.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
    throw error;
  }
  const cleanText = (text, maximum = 1_500) => String(text || "").replace(/\s+/g, " ").trim().slice(0, maximum);
  const result = {};
  for (const collection of researchEvidenceAnalysisCollections) {
    if (!Array.isArray(value[collection])) {
      const error = new Error("The Research evidence analysis omitted a required collection.");
      error.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
      throw error;
    }
    result[collection] = value[collection].slice(0, 20).map((item) => {
      const ids = Array.isArray(item?.sourceIDs)
        ? Array.from(new Set(item.sourceIDs.map((id) => String(id || "").trim()).filter(Boolean)))
        : [];
      const label = cleanText(item?.label, 240);
      const summary = cleanText(item?.summary);
      if (!label || !summary || !ids.length || ids.some((id) => !sourceIDs.has(id))) {
        const error = new Error("The Research evidence analysis referenced evidence outside the assembled package.");
        error.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
        throw error;
      }
      return { label, summary, sourceIDs: ids };
    });
  }
  const normalizedIDs = (items, origin) => {
    if (!Array.isArray(items)) return null;
    const ids = Array.from(new Set(items.map((id) => String(id || "").trim()).filter(Boolean)));
    if (ids.some((id) => !sourceIDs.has(id))) return null;
    return ids.filter((id) => evidence.find((source) => source.sourceID === id)?.origin === origin);
  };
  const userPinnedEvidence = normalizedIDs(value.userPinnedEvidence, "user_pinned");
  const discoveredIDs = Array.isArray(value.permitextDiscoveredEvidence)
    ? Array.from(new Set(value.permitextDiscoveredEvidence.map((id) => String(id || "").trim()).filter(Boolean)))
    : null;
  if (
    !userPinnedEvidence || !discoveredIDs ||
    discoveredIDs.some((id) => !sourceIDs.has(id) || evidence.find((source) => source.sourceID === id)?.origin === "user_pinned") ||
    !Array.isArray(value.projectFactsUsed) || !Array.isArray(value.unresolvedProjectFacts) ||
    !Array.isArray(value.evidenceLimitations) || !value.evidenceLimitations.length ||
    !Array.isArray(value.highValueFollowUpQuestions)
  ) {
    const error = new Error("The Research evidence analysis returned inconsistent evidence or uncertainty fields.");
    error.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
    throw error;
  }
  const projectFactsUsed = value.projectFactsUsed.map((fact) => cleanText(fact)).filter(Boolean);
  if (projectFactsUsed.some((fact) => !factSet.has(fact))) {
    const error = new Error("The Research evidence analysis invented a Project fact.");
    error.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
    throw error;
  }
  return {
    schemaVersion: 1,
    ...result,
    userPinnedEvidence,
    permitextDiscoveredEvidence: discoveredIDs,
    projectFactsUsed,
    unresolvedProjectFacts: value.unresolvedProjectFacts.map((item) => cleanText(item)).filter(Boolean),
    evidenceLimitations: value.evidenceLimitations.map((item) => cleanText(item)).filter(Boolean),
    highValueFollowUpQuestions: value.highValueFollowUpQuestions
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, 8)
  };
}

function mockResearchEvidenceAnalysis(evidence, projectFacts = [], retrievalLimitations = []) {
  const items = evidence.slice(0, 12).map((source) => ({
    label: `${source.codePrefix || "Code"} ${source.sectionNumber || source.sectionID}`.trim(),
    summary: `This enacted provision is part of the bounded evidence package for the question.`,
    sourceIDs: [source.sourceID]
  }));
  return {
    schemaVersion: 1,
    controllingProvisions: items.slice(0, 1),
    generalRules: items.slice(0, 1),
    exceptions: [],
    conditions: items.slice(1),
    limitations: [],
    definitions: [],
    crossReferences: evidence.filter((source) => source.origin === "permitext_cross_reference").map((source) => ({
      label: `${source.codePrefix || "Code"} ${source.sectionNumber || source.sectionID}`.trim(),
      summary: "Direct cross-reference reviewed with the primary evidence.",
      sourceIDs: [source.sourceID]
    })),
    tables: [],
    userPinnedEvidence: evidence.filter((source) => source.origin === "user_pinned").map((source) => source.sourceID),
    permitextDiscoveredEvidence: evidence.filter((source) => source.origin !== "user_pinned").map((source) => source.sourceID),
    projectFactsUsed: [...projectFacts],
    unresolvedProjectFacts: ["Confirm the project facts material to the cited conditions."],
    evidenceLimitations: retrievalLimitations.length
      ? retrievalLimitations.map((item) => item.text || String(item))
      : ["Permitext searched the enacted sources currently available in its authorized library; this is not a universal legal-completeness claim."],
    highValueFollowUpQuestions: ["Which project fact controls whether the cited condition applies?"]
  };
}

async function openAIResearchEvidenceAnalysis(question, evidence, userID, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Research AI is not configured.");
    error.code = "RESEARCH_NOT_CONFIGURED";
    throw error;
  }
  const configuration = researchModelConfiguration();
  const schema = structuredClone(researchEvidenceAnalysisSchema);
  const sourceIDs = evidence.map((source) => source.sourceID);
  for (const collection of researchEvidenceAnalysisCollections) {
    schema.properties[collection].items.properties.sourceIDs.items.enum = sourceIDs;
  }
  schema.properties.userPinnedEvidence.items.enum = sourceIDs;
  schema.properties.permitextDiscoveredEvidence.items.enum = sourceIDs;
  const exactProjectFacts = (options.validUserFacts || options.projectContextFacts || [])
    .map((fact) => String(fact || "").trim())
    .filter(Boolean);
  if (exactProjectFacts.length) {
    schema.properties.projectFactsUsed.items.enum = exactProjectFacts;
  } else {
    schema.properties.projectFactsUsed.maxItems = 0;
  }
  const requestBody = {
    model: configuration.model,
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 6_000,
    safety_identifier: createHash("sha256").update(String(userID)).digest("hex"),
    instructions: [
      "Organize the supplied enacted evidence into a compact internal legal-research map before a separate model writes the user-facing answer.",
      "Retrieval relevance does not establish legal applicability. Identify controlling provisions only when the supplied text supports that role.",
      "Treat evidence labeled contextual only as the subject of a relevance comparison. Do not place it among controlling provisions or general rules, and do not treat evidence labeled irrelevant as answer support.",
      "Treat evidence labeled with a collateral topic route as internally reviewed material matched only by a supplied project fact. Do not classify it as controlling or a general rule for the current question unless the question expressly asks that separate legal topic.",
      "Separate general rules, exceptions, conditions, limitations, definitions, cross-references, tables, known project facts, unresolved project facts, and evidence limitations.",
      "Make the strongest supported distinctions, including contradictions in the user's premise and requirements attributed to the wrong exception.",
      "Use only exact supplied Project facts, established conversation facts, or current-turn hypothetical facts in projectFactsUsed. Do not turn missing facts into assumptions.",
      "A fact explicitly established by the user in the active topic is known for this discussion even when it came from an earlier turn. Do not list it as unresolved or ask the user to reconfirm it merely because it is conversational state.",
      "Current-turn hypothetical facts apply only to the hypothetical being analyzed and do not replace established facts. User-stated unknowns remain unresolved.",
      "Ask only the minimum high-value follow-up questions that could materially change the project conclusion.",
      "Always state the bounded-corpus limitation. Include any retrieval limitations supplied in the request.",
      "Every passage marked REQUIRED_CLAIM_COVERAGE must appear in at least one material evidence-map item. Never say a rule is absent when its required passage supplies that rule."
    ].join(" "),
    input: [
      researchPrompt(question, evidence, {
        messages: options.messages,
        projectContextFacts: options.projectContextFacts,
        conversationFactContext: options.conversationFactContext,
        codeBasis: options.codeBasis,
        requiredClaims: options.requiredClaims
      }),
      options.retrievalLimitations?.length
        ? `DETERMINISTIC RETRIEVAL LIMITATIONS\n${JSON.stringify(options.retrievalLimitations)}`
        : ""
    ].filter(Boolean).join("\n\n"),
    text: {
      format: {
        type: "json_schema",
        name: "permitext_research_evidence_analysis",
        strict: true,
        schema
      }
    }
  };
  let response;
  try {
    reserveResearchEvaluationSpend(requestBody);
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      // Terra can spend more than 35 seconds organizing a dense, multi-branch
      // evidence package even when retrieval itself is compact. Keep this
      // bounded, but allow the structured analysis call to finish.
      signal: researchRequestSignal(options.signal, 60_000)
    });
  } catch (error) {
    const providerError = new Error("The Research evidence-analysis request failed.");
    providerError.code = "RESEARCH_PROVIDER_ERROR";
    providerError.cause = error;
    providerError.providerCause = String(error?.name || error?.code || "network-error").slice(0, 120);
    throw providerError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("The Research evidence-analysis request failed.");
    error.code = "RESEARCH_PROVIDER_ERROR";
    error.status = response.status;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(outputTextFromResponse(payload));
  } catch (error) {
    if (error.code === "RESEARCH_REFUSAL") throw error;
    const invalid = new Error("The Research evidence-analysis model returned invalid structured output.");
    invalid.code = "INVALID_RESEARCH_EVIDENCE_ANALYSIS";
    invalid.providerStatus = payload?.status || null;
    invalid.incompleteReason = payload?.incomplete_details?.reason || null;
    invalid.providerUsage = researchUsageFromProviderPayload(payload);
    throw invalid;
  }
  return {
    analysis: validateResearchEvidenceAnalysis(
      value,
      evidence,
      options.validUserFacts || options.projectContextFacts || []
    ),
    model: payload.model || configuration.model,
    usage: researchUsageFromProviderPayload(payload)
  };
}

export function researchInputForEvidence(question, evidence, options = {}) {
  const textInput = researchPrompt(question, evidence, options);
  const visualSources = evidence.flatMap((section) =>
    (section.visualSources || []).map((visualSource) => ({
      section,
      visualSource
    }))
  );
  if (!visualSources.length) return textInput;
  const totalBytes = visualSources.reduce(
    (sum, item) => sum + Number(item.visualSource.byteLength || 0),
    0
  );
  if (
    visualSources.length > maximumResearchConversationVisualSources ||
    totalBytes > maximumResearchConversationVisualEvidenceBytes
  ) {
    const error = new Error("The selected visual evidence exceeds the Research request limit.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  const content = [{ type: "input_text", text: textInput }];
  for (const { section, visualSource } of visualSources) {
    const mediaType = String(visualSource.mediaType || "").toLowerCase();
    const dataBase64 = String(visualSource.dataBase64 || "");
    if (
      !["image/gif", "image/jpeg", "image/png", "image/webp"].includes(mediaType) ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(dataBase64)
    ) {
      const error = new Error("The selected visual evidence is not a valid supported image.");
      error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
      throw error;
    }
    content.push({
      type: "input_text",
      text: [
        `The next image is immutable official visual evidence attached to PASSAGE_ID ${section.sourceID}.`,
        `VISUAL_SOURCE_ID: ${visualSource.id}`,
        `ASSET: ${visualSource.assetName}`,
        `SHA-256: ${visualSource.contentHash}`
      ].join("\n")
    }, {
      type: "input_image",
      image_url: `data:${mediaType};base64,${dataBase64}`,
      detail: "original"
    });
  }
  return [{ role: "user", content }];
}

function mockResearchInterpretation(question, evidence, options = {}) {
  const materialEvidence = evidence.filter((section) =>
    !["contextual", "irrelevant"].includes(section?.evidencePriority?.evidenceRole) &&
    section?.evidencePriority?.topicRouteRelationship !== "collateral"
  );
  const answerEvidence = materialEvidence.length ? materialEvidence : evidence;
  const subject = answerEvidence.length === 1
    ? `the enacted provision, ${answerEvidence[0].sectionNumber || answerEvidence[0].title}`
    : `the ${answerEvidence.length} enacted provisions Permitext assembled`;
  const conversational = options.responseStyle === "conversational";
  const acceptsConditionalYes = /^(?:can|could|does|is|are|may|must|should|will|would)\b/i
    .test(String(question || "").trim());
  return {
    conclusion: conversational
      ? acceptsConditionalYes
        ? "Potentially, yes—but only if the conditions in the assembled enacted provisions are satisfied by the project."
        : "The assembled enacted provisions provide a conditional answer, but the remaining project facts must be confirmed before relying on it."
      : `A project-specific answer to “${question}” requires reading ${subject} together with the facts of the proposed work.`,
    supportedPoints: answerEvidence.slice(0, maximumResearchSupportedPoints).map((section) => ({
      heading: section.title || section.sectionNumber || "Selected requirement",
      explanation: conversational
        ? `This provision supplies one of the rules that controls the answer to “${question}”.`
        : `The enacted text from ${section.sectionNumber || section.title} is part of the evidence authorized for this Research.`,
      sectionID: section.sectionID,
      sourceIDs: [section.sourceID || `section-${section.sectionID}`]
    })),
    explanation: conversational
      ? `The enacted text gives a governing starting point, but it is not a blanket approval. Read ${subject} together, then confirm the project facts that control the cited conditions before relying on the result.`
      : "The assembled enacted code text provides the governing research starting point, but it does not by itself establish every project fact needed for an official determination.",
    assumptions: ["Only the enacted 2022 New York City Construction Code provisions assembled for this answer were treated as governing authority."],
    missingFacts: ["Confirm the project scope, occupancy, location, existing conditions, and any applicable agency determinations."],
    followUpQuestions: ["What project fact would determine whether the cited conditions apply?"],
    evidenceLimitations: ["Permitext searched the enacted sources currently available in its authorized library; this is not a universal legal-completeness claim."],
    additionalEvidenceNeeded: ["Confirm any referenced standard, agency rule, figure, or other authority outside the current enacted corpus before final reliance."],
    supportingSourceUses: [],
    citations: answerEvidence.slice(0, maximumResearchSupportedPoints).map((section) => ({
      sectionID: section.sectionID,
      sourceIDs: [section.sourceID || `section-${section.sectionID}`],
      relevance: `Enacted evidence from ${section.sectionNumber || section.title}.`
    }))
  };
}

function outputTextFromResponse(response) {
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "refusal") {
        const error = new Error("The model declined this research request.");
        error.code = "RESEARCH_REFUSAL";
        throw error;
      }
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  const error = new Error("The model returned no interpretation.");
  error.code = "INVALID_RESEARCH_RESPONSE";
  throw error;
}

function researchUsageFromProviderPayload(payload) {
  return {
    inputTokens: Number(payload?.usage?.input_tokens || 0),
    cachedInputTokens: Number(payload?.usage?.input_tokens_details?.cached_tokens || 0),
    outputTokens: Number(payload?.usage?.output_tokens || 0),
    totalTokens: Number(payload?.usage?.total_tokens || 0)
  };
}

function combinedResearchUsage(...entries) {
  return entries.filter(Boolean).reduce((total, entry) => ({
    inputTokens: total.inputTokens + Number(entry.inputTokens || 0),
    cachedInputTokens: total.cachedInputTokens + Number(entry.cachedInputTokens || 0),
    outputTokens: total.outputTokens + Number(entry.outputTokens || 0),
    totalTokens: total.totalTokens + Number(entry.totalTokens || 0)
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 });
}

function webSourcesFromProviderPayload(payload) {
  const sources = [];
  for (const item of payload?.output || []) {
    for (const source of item?.action?.sources || []) {
      sources.push({
        url: source?.url,
        title: source?.title,
        publisher: source?.publisher
      });
    }
    for (const content of item?.content || []) {
      for (const annotation of content?.annotations || []) {
        const citation = annotation?.url_citation || annotation;
        if (annotation?.type !== "url_citation" && !annotation?.url_citation) continue;
        sources.push({
          url: citation?.url,
          title: citation?.title
        });
      }
    }
  }
  return sources;
}

async function openAIResearchWebSupport(question, userID, options = {}) {
  const policyConfiguration = researchSourcePolicyConfiguration();
  if (!policyConfiguration.webSupportEnabled) {
    return { summary: "", sources: [], usage: combinedResearchUsage(), searched: false };
  }
  const sanitizedQuery = sanitizeResearchWebQuery(options.retrievalQuery || question);
  if (!sanitizedQuery) {
    return { summary: "", sources: [], usage: combinedResearchUsage(), searched: false };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { summary: "", sources: [], usage: combinedResearchUsage(), searched: false };
  }
  const configuration = researchModelConfiguration();
  const allowedDomains = policyConfiguration.officialDomains;
  const requestBody = {
    model: configuration.model,
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 700,
    safety_identifier: createHash("sha256").update(String(userID)).digest("hex"),
    tools: [{
      type: "web_search",
      filters: { allowed_domains: allowedDomains }
    }],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    instructions: [
      "Find concise supporting information from the allowed official websites for a building-code research answer.",
      "The enacted Permitext corpus remains the primary legal authority.",
      "Do not make a project compliance determination and do not treat guidance as enacted law.",
      "Return only useful explanatory, administrative, effective-date, or technical context with inline web citations.",
      "If no official supporting material is useful, say that briefly."
    ].join(" "),
    input: sanitizedQuery
  };
  let response;
  try {
    reserveResearchEvaluationSpend(requestBody);
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: researchRequestSignal(options.signal, 30_000)
    });
  } catch {
    return {
      summary: "",
      sources: [],
      usage: combinedResearchUsage(),
      searched: true,
      limitation: "Permitext could not reach the approved supporting web sources for this answer."
    };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      summary: "",
      sources: [],
      usage: researchUsageFromProviderPayload(payload),
      searched: true,
      limitation: "Permitext could not retrieve approved supporting web material for this answer."
    };
  }
  let summary = "";
  try {
    summary = outputTextFromResponse(payload);
  } catch {
    summary = "";
  }
  return {
    summary,
    sources: normalizeResearchWebSources(webSourcesFromProviderPayload(payload), {
      officialDomains: allowedDomains
    }).filter((source) => source.sourceClassification === "official_guidance")
      .map((source) => ({
        ...source,
        id: `web-source-${createHash("sha256").update(source.url).digest("hex").slice(0, 24)}`,
        authorityClass: source.sourceClassification,
        role: source.sourceRole,
        retrievedAt: new Date().toISOString()
      })),
    usage: researchUsageFromProviderPayload(payload),
    searched: true,
    sanitizedQuery,
    sourcePolicyVersion: researchSourcePolicyVersion
  };
}

function combinedResearchClaimRevisionIssues(...results) {
  const issues = results.flatMap((result) => researchRequiredClaimRevisionIssues(result));
  const seen = new Set();
  return issues.filter((issue) => {
    const identity = JSON.stringify(issue);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function combinedResearchAnswerRevisionIssues(requiredClaimCoverage, claimMateriality, answerQuality) {
  const issues = [
    ...combinedResearchClaimRevisionIssues(requiredClaimCoverage, claimMateriality),
    ...researchAnswerQualityRevisionIssues(answerQuality)
  ];
  const seen = new Set();
  return issues.filter((issue) => {
    const identity = JSON.stringify(issue);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function accumulatedResearchVerificationIssues(attempts = []) {
  const seen = new Set();
  return attempts.flatMap((attempt) => Array.isArray(attempt?.issues) ? attempt.issues : [])
    .filter((issue) => {
      const identity = `${String(issue?.type || "").trim()}\u0000${String(issue?.detail || "").trim()}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

export function validateResearchInterpretation(value, evidence, supportingSources = []) {
  const allowedSections = new Map();
  const allowedSources = new Map();
  for (const section of evidence) {
    if (!allowedSections.has(section.sectionID)) allowedSections.set(section.sectionID, section);
    allowedSources.set(section.sourceID || `section-${section.sectionID}`, section);
  }
  if (!value || typeof value !== "object" ||
      typeof value.conclusion !== "string" || !value.conclusion.trim() ||
      !Array.isArray(value.supportedPoints) ||
      value.supportedPoints.length === 0 ||
      value.supportedPoints.length > maximumResearchSupportedPoints ||
      typeof value.explanation !== "string" || !value.explanation.trim() ||
      !Array.isArray(value.assumptions) || !value.assumptions.every((item) => typeof item === "string") ||
      !Array.isArray(value.missingFacts) || !value.missingFacts.every((item) => typeof item === "string") ||
      !Array.isArray(value.followUpQuestions) || !value.followUpQuestions.every((item) => typeof item === "string") ||
      !Array.isArray(value.evidenceLimitations) || !value.evidenceLimitations.every((item) => typeof item === "string") ||
      !Array.isArray(value.additionalEvidenceNeeded) || !value.additionalEvidenceNeeded.every((item) => typeof item === "string") ||
      !Array.isArray(value.supportingSourceUses) ||
      !Array.isArray(value.citations) || value.citations.length === 0) {
    const error = new Error("The model returned an invalid interpretation.");
    error.code = "INVALID_RESEARCH_RESPONSE";
    throw error;
  }
  const supportedPoints = value.supportedPoints.map((point, pointIndex) => {
    const heading = String(point?.heading || "").trim();
    const explanation = String(point?.explanation || "").trim();
    const sectionID = String(point?.sectionID || "").trim();
    const sourceIDs = Array.isArray(point?.sourceIDs)
      ? point.sourceIDs.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    if (
      !heading ||
      !explanation ||
      !allowedSections.has(sectionID) ||
      !sourceIDs.length ||
      new Set(sourceIDs).size !== sourceIDs.length ||
      sourceIDs.some((sourceID) => !allowedSources.has(sourceID)) ||
      sourceIDs.some((sourceID) =>
        allowedSources.get(sourceID)?.evidencePriority?.evidenceRole === "irrelevant"
      ) ||
      !sourceIDs.some((sourceID) => allowedSources.get(sourceID)?.sectionID === sectionID)
    ) {
      const error = new Error("The model tied an explanation to evidence outside the selected code sections.");
      error.code = "INVALID_RESEARCH_CITATION";
      error.bindingIssue = {
        collection: "supportedPoints",
        index: pointIndex,
        headingPresent: Boolean(heading),
        explanationPresent: Boolean(explanation),
        declaredSectionID: sectionID || null,
        declaredSectionKnown: allowedSections.has(sectionID),
        sourceIDCount: sourceIDs.length,
        duplicateSourceIDs: new Set(sourceIDs).size !== sourceIDs.length,
        sourceSectionIDs: Array.from(new Set(
          sourceIDs.map((sourceID) => allowedSources.get(sourceID)?.sectionID || "unknown")
        ))
      };
      throw error;
    }
    const evidenceRoles = Array.from(new Set(sourceIDs.map((sourceID) =>
      allowedSources.get(sourceID)?.evidencePriority?.evidenceRole || "supporting"
    )));
    const pointEvidenceRole = evidenceRoles.includes("governing")
      ? "governing"
      : evidenceRoles.includes("contextual")
        ? "contextual"
        : "supporting";
    return {
      heading,
      explanation,
      sectionID,
      sourceIDs,
      evidenceRole: pointEvidenceRole
    };
  });
  if (!value.evidenceLimitations.some((item) => item.trim())) {
    const error = new Error("The model omitted the required evidence limitation.");
    error.code = "INVALID_RESEARCH_RESPONSE";
    throw error;
  }
  const citations = [];
  const seen = new Set();
  for (const citation of value.citations) {
    const sectionID = String(citation?.sectionID || "").trim();
    const sourceIDs = Array.isArray(citation?.sourceIDs)
      ? citation.sourceIDs.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const relevance = String(citation?.relevance || "").trim();
    const evidenceRoles = Array.from(new Set(sourceIDs.map((sourceID) =>
      allowedSources.get(sourceID)?.evidencePriority?.evidenceRole || "supporting"
    )));
    if (!allowedSections.has(sectionID) || !sourceIDs.length ||
        new Set(sourceIDs).size !== sourceIDs.length ||
        sourceIDs.some((sourceID) => allowedSources.get(sourceID)?.sectionID !== sectionID) ||
        evidenceRoles.includes("irrelevant") ||
        !relevance) {
      const error = new Error("The model cited evidence outside the selected code sections.");
      error.code = "INVALID_RESEARCH_CITATION";
      throw error;
    }
    const citationKey = `${sectionID}:${sourceIDs.slice().sort().join(",")}`;
    if (seen.has(citationKey)) {
      const error = new Error("The model returned a duplicate citation.");
      error.code = "INVALID_RESEARCH_CITATION";
      throw error;
    }
    seen.add(citationKey);
    const source = allowedSections.get(sectionID);
    citations.push({
      sectionID: source.sectionID,
      sectionNumber: source.sectionNumber,
      title: source.title,
      codePrefix: source.codePrefix,
      chapterNumber: source.chapterNumber,
      codeVersion: source.codeVersion || defaultSyncCodeVersion,
      codeEdition: source.codeEdition || defaultResearchCodeEdition,
      sourceIDs,
      supportingPassages: sourceIDs.map((sourceID) => ({
        sourceID,
        selectedText: allowedSources.get(sourceID).text,
        visualSources: (allowedSources.get(sourceID).visualSources || []).map((visualSource) => ({
          id: visualSource.id,
          assetName: visualSource.assetName,
          mediaType: visualSource.mediaType,
          contentHash: visualSource.contentHash
        }))
      })),
      evidenceRole: evidenceRoles.includes("governing")
        ? "governing"
        : evidenceRoles.includes("contextual")
          ? "contextual"
          : "supporting",
      relevance
    });
  }
  if (!citations.length) {
    const error = new Error("The model returned no valid citations.");
    error.code = "INVALID_RESEARCH_CITATION";
    throw error;
  }
  for (const point of supportedPoints) {
    const citedSourceIDs = new Set(citations.flatMap((citation) => citation.sourceIDs));
    if (!point.sourceIDs.every((sourceID) => citedSourceIDs.has(sourceID))) {
      const error = new Error("A numbered Research point was not covered by the cited selected evidence.");
      error.code = "INVALID_RESEARCH_CITATION";
      throw error;
    }
  }
  const cleanNarrative = (text) => String(text || "")
    .replace(/\s*[\[(][^)\]]*\b(?:SECTION_ID|PASSAGE_IDS?)\b[^)\]]*[\])]/gi, "")
    .replace(/\s*(?:[;,]\s*)?\b(?:SECTION_ID|PASSAGE_IDS?)\s*:?\s*[A-Za-z0-9._:-]+(?:\s*,\s*[A-Za-z0-9._:-]+)*/gi, "")
    .replace(/[【】：「」『』。“”]+(?=\s*[A-Za-z0-9])/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[;,]\s*$/, "")
    .trim();
  const conclusion = cleanNarrative(value.conclusion);
  const explanation = cleanNarrative(value.explanation);
  const cleanedSupportedPoints = supportedPoints.map((point) => ({
    ...point,
    heading: cleanNarrative(point.heading),
    explanation: cleanNarrative(point.explanation)
  }));
  const cleanList = (items) => items.map(cleanNarrative).filter(Boolean);
  const assumptions = cleanList(value.assumptions);
  const missingFacts = cleanList(value.missingFacts);
  const followUpQuestions = cleanList(value.followUpQuestions).slice(0, 8);
  const evidenceLimitations = cleanList(value.evidenceLimitations);
  const additionalEvidenceNeeded = cleanList(value.additionalEvidenceNeeded);
  const allowedSupportingSources = new Map(
    supportingSources.map((source) => [String(source.id || ""), source]).filter(([id]) => id)
  );
  const supportingSourceUses = value.supportingSourceUses.map((use) => {
    const sourceID = String(use?.sourceID || "").trim();
    const claim = cleanNarrative(use?.claim);
    if (!sourceID || !claim || !allowedSupportingSources.has(sourceID)) {
      const error = new Error("The model cited supporting material outside the retrieved web sources.");
      error.code = "INVALID_RESEARCH_WEB_CITATION";
      throw error;
    }
    return { sourceID, claim };
  });
  const cleanedCitations = citations.map((citation) => ({
    ...citation,
    relevance: cleanNarrative(citation.relevance)
  }));
  if (
    !conclusion ||
    !explanation ||
    !evidenceLimitations.length ||
    cleanedSupportedPoints.some((point) => !point.heading || !point.explanation) ||
    cleanedCitations.some((citation) => !citation.relevance)
  ) {
    const error = new Error("The model returned an empty interpretation after evidence markers were removed.");
    error.code = "INVALID_RESEARCH_RESPONSE";
    throw error;
  }
  if (
    [conclusion, explanation, ...cleanedSupportedPoints.flatMap((point) => [point.heading, point.explanation])]
      .some((text) => /\b(?:SECTION_ID|PASSAGE_IDS?)\b/i.test(text))
  ) {
    const error = new Error("The model exposed an internal evidence identifier in user-facing prose.");
    error.code = "INVALID_RESEARCH_RESPONSE";
    throw error;
  }
  return {
    conclusion,
    supportedPoints: cleanedSupportedPoints,
    explanation,
    assumptions,
    missingFacts,
    followUpQuestions,
    evidenceLimitations,
    additionalEvidenceNeeded,
    supportingSourceUses,
    supportingSources: supportingSourceUses.map((use) => ({
      ...allowedSupportingSources.get(use.sourceID),
      claim: use.claim
    })),
    citations: cleanedCitations
  };
}

async function openAIResearchInterpretation(question, evidence, userID, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Research AI is not configured.");
    error.code = "RESEARCH_NOT_CONFIGURED";
    throw error;
  }
  const baseConfiguration = researchModelConfiguration();
  const conversational = options.responseStyle === "conversational";
  const configuration = conversational
    ? {
        ...baseConfiguration,
        promptVersion: `${baseConfiguration.promptVersion}:conversational-v2`,
        evidenceVersion: `${researchEvidenceAssemblyVersion}:structured-v1`
      }
    : baseConfiguration;
  const model = configuration.model;
  const passageEvidence = evidence.map((section) => ({
    ...section,
    sourceID: section.sourceID || `section-${section.sectionID}`,
    codeVersion: section.codeVersion || defaultSyncCodeVersion
  }));
  const supportingSources = options.webSupport?.sources || [];
  let response;
  try {
    const requestBody = {
      model,
      store: false,
      reasoning: { effort: conversational ? "low" : configuration.reasoningEffort },
      max_output_tokens: conversational ? 3_000 : 1_500,
      safety_identifier: createHash("sha256").update(String(userID)).digest("hex"),
      instructions: [
        "You are a building-code research assistant, not an authority having jurisdiction.",
        "Make governing code conclusions only from the authorized enacted evidence supplied in the request.",
        "Evidence marked user_pinned must be considered, but Permitext-discovered enacted evidence may identify a different controlling provision.",
        "Supporting web context may explain or contextualize an answer but is noncontrolling and must never create or override an enacted requirement.",
        "When a selected source includes attached official visual evidence, examine only the attached images and identify the exact visual source used through its PASSAGE_ID; never infer what an unselected map or image shows.",
        "Treat maps and figures as evidence that can be misread. State any illegible label, uncertain boundary, missing lot location, or other visual ambiguity explicitly instead of guessing.",
        "Do not use pretrained or uncited outside knowledge as legal authority and do not invent requirements.",
        "Treat user-provided Project facts and established active-topic conversation facts as factual context for this discussion, never as code authority or cited evidence.",
        "Do not ask the user to reconfirm an established active-topic fact merely because it was supplied in an earlier turn. Do not list such a fact in missingFacts. If final professional reliance requires independent verification, distinguish that later verification from whether the fact is already established in this conversation.",
        "Preserve the factual content of an established user shorthand such as fully sprinklered. If a code benefit separately depends on compliance with a named installation standard, request records establishing that standard without asking again whether the building is fully sprinklered or the system is installed throughout.",
        "Apply current-turn hypothetical facts only to the current hypothetical. They do not replace established facts. User-stated unknowns remain unknown. Never promote an earlier assistant conclusion into a user-established fact.",
        "Use the supplied structured evidence analysis as an organizational map, but resolve any conflict in favor of the raw enacted evidence.",
        "Evidence labeled governing may establish the answer. Evidence labeled supporting may support only the rule it actually supplies. Evidence labeled contextual may appear in a supportedPoint only to explain its limited, non-governing relationship to the topic; never use it to establish the governing result. Never cite evidence labeled irrelevant.",
        "Evidence labeled with a collateral topic route was retrieved only because a supplied project fact matched another code topic. Review it internally, but do not create a supportedPoint or citation for it unless verifier feedback specifically establishes that the user asked that separate legal topic.",
        "Write the conclusion as a concise professional answer of one to three sentences.",
        conversational
          ? "For this ordinary Research conversation, write conclusion and explanation so they read consecutively as one natural response. Lead with the clearest supported answer, such as Yes, No, or Potentially, then explain why in direct plain language. Avoid report boilerplate, process narration, repeated question text, and phrases such as a project-specific answer requires reading. Keep the tone professional but conversational."
          : "Use the formal governed-analysis tone for conclusion and explanation.",
        "Do not print SECTION_ID or PASSAGE_ID markers in the conclusion, supported-point prose, or practical explanation; those identifiers belong only in the structured mapping fields.",
        "Break the material rules established by the assembled enacted evidence into ordered supportedPoints. Give each point a short plain-language heading, a complete explanation, and the exact supplied sectionID and sourceIDs that support it.",
        "Do not add an example, consequence, code category, or practical requirement unless the assembled evidence or user-provided Project facts establish it. Clearly identify any illustration as hypothetical, and never use a hypothetical to introduce an unsupported legal premise.",
        "Keep the answer within the scope of the current question. Do not introduce or cite a collateral code analysis merely to observe that a supplied fact might matter elsewhere; mention another code topic only when it materially qualifies the requested conclusion or the user asks for it.",
        "Use explanation for the practical application of the supported points to the question and user-provided Project facts. Do not merely repeat the numbered points.",
        "State every material conclusion directly supported by the enacted evidence before discussing unresolved matters.",
        "For a numeric limit or table comparison, compare the stated project value with every directly applicable supplied limit. If the value complies with a stricter baseline limit, state that direct conclusion and do not make it conditional on qualifying for a more generous allowance.",
        "A missing fact belongs in missingFacts or followUpQuestions only when it can change the requested conclusion. A fact that merely confirms an already-supported, more conservative result may be identified as a professional validation item, but it must not weaken or condition that result.",
        "Treat a corpus or evidence limitation as a boundary on what Permitext evaluated, not as proof that another provision imposes a requirement. Do not say an outside or unsupplied provision requires verification or might change the result unless supplied enacted evidence establishes that consequence.",
        "Every passage marked REQUIRED_CLAIM_COVERAGE must be addressed in at least one supportedPoint and cited with that exact PASSAGE_ID. Combine closely related passages in one coherent supportedPoint when needed; do not satisfy this by adding an orphan citation without explaining the rule.",
        "Separate the supported answer, missing project facts, evidence limitations, and additional evidence needed.",
          "Treat occupancy, construction type, location, existing conditions, building height, and occupant load as unknown unless stated in the question or selected evidence.",
          "Facts stated by the user may support the answer. Restate a material fact when it helps explain the result, but do not make the answer conditional merely because that fact came from an earlier user turn.",
          "Do not resolve a missing material fact by listing it as an assumption; put it in missingFacts and make the conclusion conditional.",
          "Use the assembled document structure, including exception headings, when it is supplied. If an exception and its conditions are present, state the conditional result instead of demanding additional text merely to acknowledge that conditional rule.",
          "When a category, table row, shared-facility condition, or calculation input is needed but not established, name that missing item specifically rather than asking only for generic project information.",
          "When assembled evidence supplies a calculation procedure, briefly explain every material step and exception in that procedure even when missing inputs prevent a final numeric result.",
          "Do not merely say that a table or category must be checked. Identify the project-specific use category that must be selected from actual use and explain what the assembled evidence already establishes.",
          "For plumbing-fixture questions, when a final count could depend on facilities serving more than one space, ask whether existing or shared facilities are proposed to serve the space and identify any missing provisions governing that sharing. Do not assume those facilities qualify.",
          "If the question attributes a requirement to an agency, funding program, or other authority not represented in the assembled evidence, explicitly request that authority's applicable design standard, funding or program requirements, or official guidance. Do not substitute additional Building Code text for the missing outside authority.",
          "If the question cannot be answered from the assembled enacted evidence, say so directly.",
        "Generate only the minimum high-value followUpQuestions needed to materially advance the answer; do not ask for facts that cannot change the result.",
        "Every major code conclusion and every supportedPoint must be covered by enacted citations using the supplied SECTION_ID and PASSAGE_ID values.",
        "Return supportingSourceUses only for claims actually supported by a supplied WEB_SOURCE_ID. Keep it empty when no web source materially improves the answer."
      ].join(" "),
      input: researchInputForEvidence(question, passageEvidence, options),
      text: {
        format: {
          type: "json_schema",
          name: "permitext_code_interpretation",
          strict: true,
          schema: researchInterpretationSchemaForEvidence(passageEvidence, supportingSources)
        }
      }
    };
    reserveResearchEvaluationSpend(requestBody);
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: researchRequestSignal(options.signal, 45_000)
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw error;
    const providerError = new Error("The research model request failed.");
    providerError.code = "RESEARCH_PROVIDER_ERROR";
    throw providerError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("The research model request failed.");
    error.code = "RESEARCH_PROVIDER_ERROR";
    error.status = response.status;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(outputTextFromResponse(payload));
  } catch (error) {
    if (error.code === "RESEARCH_REFUSAL") throw error;
    const invalidResponse = new Error("The model returned invalid structured output.");
    invalidResponse.code = "INVALID_RESEARCH_RESPONSE";
    throw invalidResponse;
  }
  return {
    interpretation: validateResearchInterpretation(
      normalizeResearchInterpretationEvidenceBindings(value, passageEvidence),
      passageEvidence,
      supportingSources
    ),
    requestedModel: model,
    model: payload.model || model,
    configuration,
    usage: researchUsageFromProviderPayload(payload)
  };
}

const researchVerificationIssueTypes = new Set([
  "misstated_provision",
  "wrong_attribution",
  "missed_material_conclusion",
  "unsupported_requirement",
  "fact_evidence_confusion",
  "false_evidence_limitation",
  "overstated_compliance",
  "missed_premise_contradiction",
  "incorrect_citation",
  "weakest_supported_conclusion",
  "irrelevant_citation",
  "unnecessary_qualification",
  "repeated_established_fact"
]);
const maximumResearchVerificationAttempts = 3;

const researchVerificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pass: { type: "boolean" },
    issues: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: Array.from(researchVerificationIssueTypes) },
          detail: { type: "string" }
        },
        required: ["type", "detail"]
      }
    }
  },
  required: ["pass", "issues"]
};

function validateResearchVerification(value) {
  if (!value || typeof value !== "object" || typeof value.pass !== "boolean" || !Array.isArray(value.issues)) {
    const error = new Error("The Research verifier returned an invalid result.");
    error.code = "INVALID_RESEARCH_VERIFICATION";
    throw error;
  }
  const issues = value.issues.map((issue) => ({
    type: String(issue?.type || "").trim(),
    detail: String(issue?.detail || "").replace(/\s+/g, " ").trim().slice(0, 1_500)
  }));
  if (
    issues.length > 12 ||
    issues.some((issue) => !researchVerificationIssueTypes.has(issue.type) || !issue.detail) ||
    (value.pass && issues.length) ||
    (!value.pass && !issues.length)
  ) {
    const error = new Error("The Research verifier returned inconsistent issues.");
    error.code = "INVALID_RESEARCH_VERIFICATION";
    throw error;
  }
  return { pass: value.pass, issues };
}

async function openAIResearchVerification(question, evidence, interpretation, userID, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Research AI is not configured.");
    error.code = "RESEARCH_NOT_CONFIGURED";
    throw error;
  }
  const configuration = researchModelConfiguration();
  const evidenceText = evidence.map((source) => [
    `PASSAGE_ID: ${source.sourceID}`,
    `SECTION: ${source.codePrefix} ${source.sectionNumber}`,
    `EVIDENCE_ROLE: ${source.evidencePriority?.evidenceRole || "supporting"}`,
    `TOPIC_ROUTE_RELATIONSHIP: ${source.evidencePriority?.topicRouteRelationship || "unrestricted"}`,
    `TEXT: ${source.text}`
  ].join("\n")).join("\n\n---\n\n");
  const requestBody = {
    model: configuration.model,
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 2_000,
    safety_identifier: createHash("sha256").update(String(userID)).digest("hex"),
    instructions: [
      "Verify a proposed building-code research answer only against the supplied enacted evidence and stated project facts.",
      "Supporting web material may verify only clearly labeled explanatory context; fail any answer that treats it as controlling or lets it override enacted text.",
      "Fail an answer that uses contextual evidence as a governing supported point, or cites irrelevant evidence. Contextual evidence may be cited only to explain its limited relationship to the governing question.",
      "Fail the answer if it misstates a provision, attributes a condition to the wrong exception, omits a material supported conclusion, adds an unsupported requirement, confuses missing facts with missing evidence, falsely says present evidence is missing, overstates compliance, fails to correct a contradicted user premise, attaches a citation to the wrong claim, or withholds the strongest supported conclusion.",
      "Fail an answer that introduces a collateral code example or citation that does not materially qualify the requested conclusion and was not requested by the user.",
      "Fail with irrelevant_citation when the answer cites evidence labeled with a collateral topic route merely because a supplied project fact matched that separate code topic. Such evidence may be reviewed internally without appearing in the answer.",
      "Fail with unnecessary_qualification when the answer leads with Potentially, may, or similar caution even though the enacted evidence and established facts support a direct conclusion and the stated unresolved matters cannot change that conclusion.",
      "Fail with repeated_established_fact when the answer asks the user to establish or reconfirm a fact already supplied for the active topic. Independent professional verification of documents or measurements is different and may still be identified when material.",
      "When the user has established that a building is fully sprinklered, treat installed throughout as established factual context. The answer may request documentation of compliance with a named installation standard when material, but must not return fully sprinklered or installed throughout as a missing fact or follow-up question.",
      "For a numeric limit or table comparison, fail with weakest_supported_conclusion when the stated value satisfies a stricter directly applicable supplied limit but the answer makes compliance conditional on qualifying for a more generous allowance.",
      "Fail with unsupported_requirement when the answer turns an evidence or corpus boundary into an asserted outside legal requirement, or says unsupplied law requires verification or could change the result without enacted support.",
      "Treat every item in the deterministic required-claim checklist as mandatory answer coverage. Fail if its exact passage is absent from a supported point or citation, or if the answer contradicts it.",
      "Treat established active-topic facts as supplied user facts. Fail an answer that calls one of them missing, makes the conclusion conditional solely because it came from an earlier turn, or asks the user to reconfirm it without a contradiction. Do not treat prior assistant conclusions as established facts.",
      "Apply current-turn hypothetical facts only to the current question, and keep user-stated unknowns unresolved.",
      "Do not demand a final yes-or-no result when project facts genuinely remain unresolved.",
      "Return a compact structured result."
    ].join(" "),
    input: [
      `QUESTION\n${question}`,
      options.codeBasis
        ? `RESEARCH CODE BASIS — DO NOT CLAIM ANOTHER EDITION WAS RETRIEVED\n${JSON.stringify(options.codeBasis)}`
        : "",
      options.projectContextFacts?.length
        ? `PROJECT FACTS\n${options.projectContextFacts.join("\n")}`
        : "",
      options.conversationFactContext?.established?.length
        ? `ESTABLISHED USER FACTS FOR ACTIVE TOPIC\n${options.conversationFactContext.established.join("\n")}`
        : "",
      options.conversationFactContext?.hypothetical?.length
        ? `CURRENT-TURN HYPOTHETICAL FACTS\n${options.conversationFactContext.hypothetical.join("\n")}`
        : "",
      options.conversationFactContext?.unknown?.length
        ? `USER-STATED UNKNOWNS\n${options.conversationFactContext.unknown.join("\n")}`
        : "",
      `AUTHORIZED ENACTED EVIDENCE\n${evidenceText}`,
      options.requiredClaims?.length
        ? `DETERMINISTIC REQUIRED CLAIM CHECKLIST\n${JSON.stringify(options.requiredClaims)}`
        : "",
      options.webSupport?.sources?.length
        ? `NONCONTROLLING SUPPORTING WEB MATERIAL\n${JSON.stringify({
            summary: options.webSupport.summary,
            sources: options.webSupport.sources
          })}`
        : "",
      `PROPOSED ANSWER JSON\n${JSON.stringify(interpretation)}`
    ].filter(Boolean).join("\n\n"),
    text: {
      format: {
        type: "json_schema",
        name: "permitext_research_verification",
        strict: true,
        schema: researchVerificationSchema
      }
    }
  };
  let response;
  try {
    reserveResearchEvaluationSpend(requestBody);
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: researchRequestSignal(options.signal, 30_000)
    });
  } catch (error) {
    const providerError = new Error("The Research verifier request failed.");
    providerError.code = "RESEARCH_VERIFIER_ERROR";
    providerError.cause = error;
    throw providerError;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("The Research verifier request failed.");
    error.code = "RESEARCH_VERIFIER_ERROR";
    error.status = response.status;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(outputTextFromResponse(payload));
  } catch (error) {
    if (error.code === "RESEARCH_REFUSAL") throw error;
    const invalid = new Error("The Research verifier returned invalid structured output.");
    invalid.code = "INVALID_RESEARCH_VERIFICATION";
    invalid.providerStatus = payload?.status || null;
    invalid.incompleteReason = payload?.incomplete_details?.reason || null;
    invalid.providerUsage = researchUsageFromProviderPayload(payload);
    throw invalid;
  }
  return {
    result: validateResearchVerification(value),
    model: payload.model || configuration.model,
    usage: researchUsageFromProviderPayload(payload)
  };
}

async function handleResearchInterpretation(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;
  sendJSON(response, 410, {
    error: "This Research entry point has been retired. Select enacted text and use a private Research conversation.",
    code: "RESEARCH_CONVERSATIONS_REQUIRED"
  });
}

function researchCodeDecisionLink(link) {
  const questionID = String(link?.metadata?.codeDecisionID || "").trim();
  if (
    !questionID || link?.deletedAt ||
    link?.targetKind !== "researchConversation" ||
    link?.relationship !== "primary"
  ) return null;
  return {
    questionID,
    linkVersion: Number(link.version || 1),
    linkedAt: link.metadata?.codeDecisionLinkedAt || link.updatedAt || link.createdAt || null,
    linkedByUserID: link.metadata?.codeDecisionLinkedByUserID || null
  };
}

function researchProjectLinkCASMatches(current, expected) {
  if (!expected) return !current;
  return Boolean(
    current &&
    current.id === expected.id &&
    current.projectID === expected.projectID &&
    current.targetKind === expected.targetKind &&
    current.targetID === expected.targetID &&
    current.relationship === expected.relationship &&
    Number(current.version || 0) === Number(expected.version || 0) &&
    (current.deletedAt || null) === (expected.deletedAt || null) &&
    String(current.metadata?.codeDecisionID || "") === String(expected.metadata?.codeDecisionID || "")
  );
}

function researchCodeDecisionLinkConflict() {
  return new CodeQuestionCommandError(
    "Another Research conversation became current for this Code Decision. Refresh before changing the link.",
    { code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT", status: 409 }
  );
}

/**
 * Strip heavy conversation payload fields (messages, visual attachments, full
 * source bodies) so list endpoints never depend on full-body JSON.
 */
export function projectResearchConversationForList(conversation) {
  if (!conversation || typeof conversation !== "object") return null;
  const selectionSources = (Array.isArray(conversation.sources) ? conversation.sources : [])
    .filter((source) => source?.kind === "selection")
    .map((source) => ({
      kind: "selection",
      sectionID: String(source.sectionID || "").trim() || undefined
    }));
  const messageCount = Number.isFinite(Number(conversation.messageCount))
    ? Number(conversation.messageCount)
    : (Array.isArray(conversation.messages) ? conversation.messages.length : 0);
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    historyHiddenAt: conversation.historyHiddenAt || null,
    primaryProjectID: conversation.primaryProjectID || null,
    starterQuestion: originalResearchQuestion(conversation),
    projectContextReviewRequired: Boolean(conversation.projectContextReviewRequired),
    codeBasis: conversation.codeBasis || null,
    sourceStatus: conversation.sourceStatus || "current",
    sources: selectionSources,
    messageCount
  };
}

function originalResearchQuestion(conversation) {
  const storedQuestion = String(conversation?.starterQuestion || "").trim();
  if (storedQuestion) return storedQuestion;
  const firstUserMessage = (Array.isArray(conversation?.messages) ? conversation.messages : [])
    .find((message) => message?.role === "user");
  return String(firstUserMessage?.question || "").trim() || null;
}

function researchConversationSummary(conversation, projectLink = null) {
  const decisionLink = researchCodeDecisionLink(projectLink);
  const selectionSources = (Array.isArray(conversation?.sources) ? conversation.sources : [])
    .filter((source) => source?.kind === "selection");
  const messageCount = Number.isFinite(Number(conversation?.messageCount))
    ? Number(conversation.messageCount)
    : (Array.isArray(conversation?.messages) ? conversation.messages.length : 0);
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    historyHiddenAt: conversation.historyHiddenAt || null,
    sourceCount: selectionSources.length,
    sourceSectionIDs: Array.from(new Set(
      selectionSources
        .map((source) => String(source.sectionID || "").trim())
        .filter(Boolean)
    )),
    messageCount,
    primaryProjectID: conversation.primaryProjectID || null,
    linkedCodeDecisionID: decisionLink?.questionID || null,
    codeDecisionLinkVersion: projectLink ? Number(projectLink.version || 1) : null,
    starterQuestion: originalResearchQuestion(conversation),
    projectContextReviewRequired: Boolean(conversation.projectContextReviewRequired),
    codeBasis: conversation.codeBasis || null,
    sourceStatus: conversation.sourceStatus || "current"
  };
}

function defaultResearchConversationTitle(timestamp) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York"
    })
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.month} ${parts.day}, ${parts.year} · ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function researchSourceFromEvidence(evidence, options = {}) {
  const selectedText = readableResearchSelectionText(
    options.selectedText,
    maximumResearchSelectionCharacters
  );
  const richSource = options.richSource || null;
  const visualSources = (options.visualSources || []).map((visualSource) => ({
    id: visualSource.id,
    kind: visualSource.kind,
    assetName: visualSource.assetName,
    assetURL: visualSource.assetURL,
    mediaType: visualSource.mediaType,
    contentHash: visualSource.contentHash,
    byteLength: visualSource.byteLength,
    displayWidth: visualSource.displayWidth || null,
    displayHeight: visualSource.displayHeight || null,
    dataBase64: visualSource.dataBase64
  }));
  return {
    id: randomUUID(),
    kind: options.kind || "related",
    relationship: options.relationship || "Explicitly referenced by the selected provision",
    sectionID: evidence.sectionID,
    sectionNumber: evidence.sectionNumber,
    title: evidence.title,
    codePrefix: evidence.codePrefix,
    chapterNumber: evidence.chapterNumber,
    chapterTitle: evidence.chapterTitle,
    sectionGroupLabel: evidence.sectionGroupLabel,
    sectionGroupTitle: evidence.sectionGroupTitle,
    selectedText,
    selectedTextHash: selectedText
      ? createHash("sha256").update(selectedText).digest("hex")
      : null,
    richSourceID: richSource?.id || null,
    richSourceKind: richSource?.kind || null,
    richSourceReference: richSource?.reference || null,
    richSourceContentHash: richSource?.contentHash || null,
    richSourceRowCount: richSource?.rowCount || null,
    richSourceGrids: richSource?.grids || null,
    visualSources,
    visualReviewConfirmedAt: visualSources.length
      ? options.visualReviewConfirmedAt || new Date().toISOString()
      : null,
    sectionTextHash: evidence.sectionTextHash,
    codeVersion: defaultSyncCodeVersion,
    codeEdition: defaultResearchCodeEdition,
    addedAt: new Date().toISOString()
  };
}

async function relatedResearchEvidence(primaryEvidence, limit = 3) {
  const phrases = inlineCodeReferencePhrases(primaryEvidence.text);
  if (!phrases.length) return [];
  const catalog = await sectionCatalog();
  const relatedIDs = [];
  for (const phrase of phrases) {
    const codePrefix = phrase.codePrefix || primaryEvidence.codePrefix;
    for (const reference of phrase.references || []) {
      const sectionNumber = String(reference.sectionNumber || "").toUpperCase();
      const summary = catalog.find((item) =>
        String(item.codePrefix || "").toUpperCase() === String(codePrefix || "").toUpperCase() &&
        String(item.sectionNumber || "").replace(/\.$/, "").toUpperCase() === sectionNumber
      );
      const sectionID = String(summary?.id || "");
      if (!sectionID || sectionID === primaryEvidence.sectionID || relatedIDs.includes(sectionID)) continue;
      relatedIDs.push(sectionID);
      if (relatedIDs.length >= limit) break;
    }
    if (relatedIDs.length >= limit) break;
  }
  const related = [];
  for (const sectionID of relatedIDs) {
    try {
      related.push(...await researchEvidenceForSectionIDs([sectionID]));
    } catch (error) {
      if (!["INCOMPLETE_RESEARCH_SECTION", "INVALID_RESEARCH_SECTION", "ENOENT"].includes(error.code)) throw error;
    }
  }
  return related;
}

function requestedRichSourceIDs(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    const error = new Error("Structured evidence source IDs must be an array.");
    error.code = "INVALID_RESEARCH_RICH_SOURCE";
    throw error;
  }
  const ids = Array.from(new Set(
    value.map((item) => String(item || "").trim()).filter(Boolean)
  ));
  if (ids.length > 8 || ids.length !== value.length) {
    const error = new Error("Structured evidence source IDs are invalid.");
    error.code = "INVALID_RESEARCH_RICH_SOURCE";
    throw error;
  }
  return ids;
}

function requestedVisualSourceIDs(value, reviewConfirmed) {
  if (value === undefined || value === null) {
    if (reviewConfirmed === true) {
      const error = new Error("Select at least one official visual source before confirming visual review.");
      error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
      throw error;
    }
    return [];
  }
  if (!Array.isArray(value)) {
    const error = new Error("Visual evidence source IDs must be an array.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  const ids = Array.from(new Set(
    value.map((item) => String(item || "").trim()).filter(Boolean)
  ));
  if (!ids.length && value.length === 0 && reviewConfirmed !== true) return [];
  if (
    !ids.length ||
    ids.length > evidenceDiscoveryMaximumVisualSelections ||
    ids.length !== value.length ||
    reviewConfirmed !== true
  ) {
    const error = new Error(
      `Select and confirm between one and ${evidenceDiscoveryMaximumVisualSelections} official visual sources.`
    );
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  return ids;
}

async function researchSourcesForSelection(sectionID, selectedText, options = {}) {
  const normalizedSelection = readableResearchSelectionText(
    selectedText,
    maximumResearchSelectionCharacters
  );
  if (normalizedSelection.length < 2) {
    const error = new Error("Select enacted code text before starting research.");
    error.code = "INVALID_RESEARCH_SELECTION";
    throw error;
  }
  const [primary] = await researchEvidenceForSectionIDs([sectionID]);
  const canonicalSelection = matchingCanonicalResearchSelection(normalizedSelection, primary.canonicalText);
  if (!canonicalSelection) {
    const error = new Error("The selected passage no longer matches the enacted section text.");
    error.code = "INVALID_RESEARCH_SELECTION";
    throw error;
  }
  const richSourcesByID = new Map(
    (primary.richSources || []).map((source) => [source.id, source])
  );
  const richSourceIDs = requestedRichSourceIDs(options.richSourceIDs);
  const exactRichSource = (primary.richSources || []).find((source) =>
    comparableResearchText(source.text) === comparableResearchText(canonicalSelection)
  );
  const requestedRichSources = richSourceIDs.map((sourceID) => {
    const source = richSourcesByID.get(sourceID);
    if (!source) {
      const error = new Error("The structured evidence source is no longer available in the enacted section.");
      error.code = "INVALID_RESEARCH_RICH_SOURCE";
      throw error;
    }
    return source;
  });
  const visualSourceIDs = requestedVisualSourceIDs(
    options.visualSourceIDs,
    options.visualReviewConfirmed
  );
  if (
    Number(primary.visualSourceReferenceCount || 0) > 0 &&
    primary.visualSources.length !== primary.visualSourceReferenceCount
  ) {
    const error = new Error("The complete official visual-source inventory is not available for review.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  if (primary.visualSources.length && !visualSourceIDs.length) {
    const error = new Error(
      "Permitext detected official visual evidence elsewhere in this enacted section. " +
      "Use Find Relevant Evidence to review and explicitly select any applicable visuals before analysis; " +
      "Permitext will not silently include unselected visual material."
    );
    error.code = "RESEARCH_VISUAL_REVIEW_REQUIRED";
    throw error;
  }
  const visualSourcesByID = new Map(
    primary.visualSources.map((source) => [source.id, source])
  );
  const requestedVisualSources = [];
  for (const sourceID of visualSourceIDs) {
    const source = visualSourcesByID.get(sourceID);
    if (!source) {
      const error = new Error("The visual evidence source is no longer available in the enacted section.");
      error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
      throw error;
    }
    requestedVisualSources.push(await constructionVisualSourceWithContent(source));
  }
  if (
    requestedVisualSources.reduce((total, source) => total + source.byteLength, 0) >
    maximumResearchVisualEvidenceBytes
  ) {
    const error = new Error("The selected visual evidence exceeds the per-passage Research limit.");
    error.code = "INVALID_RESEARCH_VISUAL_SOURCE";
    throw error;
  }
  const related = await relatedResearchEvidence(primary);
  const visualReviewConfirmedAt = requestedVisualSources.length
    ? new Date().toISOString()
    : null;
  const selectionSources = [
    researchSourceFromEvidence(primary, {
      kind: "selection",
      relationship: requestedVisualSources.length
        ? `${requestedVisualSources.length} official visual ${requestedVisualSources.length === 1 ? "source" : "sources"} reviewed and selected by you`
        : exactRichSource
        ? `Structured official ${exactRichSource.reference} selected by you`
        : "Passage selected by you",
      selectedText: canonicalSelection,
      richSource: exactRichSource,
      visualSources: requestedVisualSources,
      visualReviewConfirmedAt
    })
  ];
  for (const richSource of requestedRichSources) {
    if (richSource.id === exactRichSource?.id) continue;
    selectionSources.push(researchSourceFromEvidence(primary, {
      kind: "selection",
      relationship: `Structured official ${richSource.reference} selected by you`,
      selectedText: richSource.text,
      richSource
    }));
  }
  return [
    ...selectionSources,
    ...related.map((evidence) => researchSourceFromEvidence(evidence))
  ];
}

function requestedResearchSelections(body) {
  let selections;
  if (body.selections !== undefined) {
    if (!Array.isArray(body.selections) || body.selections.length < 1 || body.selections.length > 24) {
      const error = new Error("Research selections must contain between 1 and 24 passages.");
      error.code = "INVALID_RESEARCH_SELECTION";
      throw error;
    }
    if (body.selections.some((selection) =>
      !selection || typeof selection !== "object" || Array.isArray(selection)
    )) {
      const error = new Error("Each Research selection must be an object.");
      error.code = "INVALID_RESEARCH_SELECTION";
      throw error;
    }
    selections = body.selections.map((selection) => ({
      sectionID: selection.sectionID,
      selectedText: selection.selectedText,
      richSourceIDs: selection.richSourceIDs ?? (body.selections.length === 1 ? body.richSourceIDs : undefined),
      visualSourceIDs: selection.visualSourceIDs ?? (body.selections.length === 1 ? body.visualSourceIDs : undefined),
      visualReviewConfirmed: selection.visualReviewConfirmed ??
        (body.selections.length === 1 ? body.visualReviewConfirmed : undefined),
      savedItemID: String(
        selection.savedItemID || (body.selections.length === 1 ? body.savedItemID : "") || ""
      ).trim()
    }));
  } else {
    selections = [{
      sectionID: body.sectionID,
      selectedText: body.selectedText,
      richSourceIDs: body.richSourceIDs,
      visualSourceIDs: body.visualSourceIDs,
      visualReviewConfirmed: body.visualReviewConfirmed,
      savedItemID: String(body.savedItemID || "").trim()
    }];
  }
  const selectionLengths = selections.map((selection) =>
    readableResearchSelectionText(
      selection.selectedText,
      maximumResearchSelectionCharacters + 1
    ).length
  );
  if (selectionLengths.some((length) => length > maximumResearchSelectionCharacters)) {
    const error = new Error(
      `Each Research passage may contain no more than ${maximumResearchSelectionCharacters.toLocaleString("en-US")} readable characters.`
    );
    error.code = "INVALID_RESEARCH_SELECTION";
    throw error;
  }
  const aggregateCharacters = selectionLengths.reduce((total, length) => total + length, 0);
  if (aggregateCharacters > maximumResearchSelectionSetCharacters) {
    const error = new Error(
      `Research selections may contain no more than ${maximumResearchSelectionSetCharacters.toLocaleString("en-US")} characters in total.`
    );
    error.code = "INVALID_RESEARCH_SELECTION";
    throw error;
  }
  return selections;
}

async function researchSourcesForSelections(selections, existingSources = []) {
  const resolvedBatches = [];
  for (const selection of selections) {
    resolvedBatches.push(await researchSourcesForSelection(
      selection.sectionID,
      selection.selectedText,
      {
        richSourceIDs: selection.richSourceIDs,
        visualSourceIDs: selection.visualSourceIDs,
        visualReviewConfirmed: selection.visualReviewConfirmed
      }
    ));
  }
  const existingSelections = existingSources.filter((source) => source.kind === "selection");
  const selectionIdentity = (source) => canonicalJSONString({
    sectionID: String(source.sectionID || ""),
    selectedTextHash: String(source.selectedTextHash || ""),
    richSourceID: String(source.richSourceID || ""),
    richSourceContentHash: String(source.richSourceContentHash || ""),
    visualSources: (source.visualSources || [])
      .map((visual) => ({ id: String(visual.id || ""), contentHash: String(visual.contentHash || "") }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    codeVersion: String(source.codeVersion || ""),
    codeEdition: String(source.codeEdition || "")
  });
  const selectionIdentities = new Set(existingSelections.map(selectionIdentity));
  const addedSelections = [];
  for (const source of resolvedBatches.flatMap((sources) =>
    sources.filter((item) => item.kind === "selection")
  )) {
    const identity = selectionIdentity(source);
    if (selectionIdentities.has(identity)) continue;
    selectionIdentities.add(identity);
    addedSelections.push(source);
  }
  const selectedSectionIDs = new Set(
    [...existingSelections, ...addedSelections].map((source) => source.sectionID)
  );
  const relatedSectionIDs = new Set();
  const relatedSources = [];
  for (const source of [
    ...existingSources.filter((item) => item.kind === "related"),
    ...resolvedBatches.flatMap((sources) => sources.filter((item) => item.kind === "related"))
  ]) {
    if (
      selectedSectionIDs.has(source.sectionID) ||
      relatedSectionIDs.has(source.sectionID)
    ) continue;
    relatedSectionIDs.add(source.sectionID);
    relatedSources.push(source);
  }
  return {
    addedSelections,
    sources: [...existingSelections, ...addedSelections, ...relatedSources]
  };
}

function assertResearchConversationVisualLimits(sources) {
  const visualSources = sources.flatMap((source) => source.visualSources || []);
  if (
    visualSources.length > maximumResearchConversationVisualSources ||
    visualSources.reduce((total, source) => total + Number(source.byteLength || 0), 0) >
      maximumResearchConversationVisualEvidenceBytes
  ) {
    const error = new Error("The selected evidence exceeds the Research conversation visual-evidence limit.");
    error.code = "RESEARCH_CONVERSATION_VISUAL_LIMIT";
    throw error;
  }
}

async function validateResearchSavedSelections(userID, selections) {
  const savedSelections = selections.filter((selection) => selection.savedItemID);
  if (!savedSelections.length) return;
  const savedItems = (await userContentMutations(userID))
    .map((mutation) => mutationKindAndRecord(mutation))
    .filter(({ kind, record }) =>
      kind === "savedItem" &&
      !Number.isFinite(Date.parse(record?.deletedAt || ""))
    )
    .map(({ record }) => record);
  for (const selection of savedSelections) {
    const savedItem = savedItems.find((record) =>
      [record?.id, normalizedMutationRecordID({ savedItem: record })]
        .filter(Boolean)
        .includes(selection.savedItemID)
    );
    if (!savedItem) {
      const error = new Error("Saved section not found.");
      error.code = "RESEARCH_SAVED_ITEM_NOT_FOUND";
      throw error;
    }
    if (String(savedItem.sectionID) !== String(selection.sectionID)) {
      const error = new Error("The selected passage does not belong to the saved section.");
      error.code = "RESEARCH_SAVED_ITEM_SECTION_MISMATCH";
      throw error;
    }
  }
}

function researchOriginForSelections(selections, surface = "") {
  const savedItemIDs = selections.map((selection) => selection.savedItemID).filter(Boolean);
  const normalizedSurface = String(surface || "").trim();
  if (selections.length === 1 && savedItemIDs.length === 1) {
    return {
      kind: "savedItem",
      savedItemID: savedItemIDs[0],
      ...(normalizedSurface ? { surface: normalizedSurface } : {})
    };
  }
  if (selections.length === 1) {
    return {
      kind: "selectedPassage",
      ...(normalizedSurface ? { surface: normalizedSurface } : {})
    };
  }
  return {
    kind: "selectedPassages",
    savedItemIDs: Array.from(new Set(savedItemIDs)),
    ...(normalizedSurface ? { surface: normalizedSurface } : {})
  };
}

async function currentResearchEvidence(conversation) {
  const selectedSectionIDs = Array.from(new Set(
    (conversation.sources || [])
      .filter((source) => source.kind === "selection")
      .map((source) => source.sectionID)
      .filter(Boolean)
  ));
  const relatedSectionIDs = Array.from(new Set(
    (conversation.sources || [])
      .filter((source) => source.kind === "related" && !selectedSectionIDs.includes(source.sectionID))
      .map((source) => source.sectionID)
      .filter(Boolean)
  ));
  const evidence = await researchEvidenceForSectionIDs(selectedSectionIDs);
  for (const sectionID of relatedSectionIDs) {
    try {
      evidence.push(...await researchEvidenceForSectionIDs([sectionID]));
    } catch (error) {
      if (!["INCOMPLETE_RESEARCH_SECTION", "INVALID_RESEARCH_SECTION", "ENOENT"].includes(error.code)) throw error;
    }
  }
  const evidenceByID = new Map(evidence.map((item) => [item.sectionID, item]));
  const sourceStatuses = await Promise.all((conversation.sources || []).map(async (source) => {
    const current = evidenceByID.get(source.sectionID);
    const currentRichSource = source.richSourceID
      ? current?.richSources?.find((item) => item.id === source.richSourceID)
      : null;
    const textSelectionPresent = source.richSourceID
      ? Boolean(
          currentRichSource &&
          currentRichSource.contentHash === source.richSourceContentHash &&
          comparableResearchText(currentRichSource.text) === comparableResearchText(source.selectedText)
        )
      : !source.selectedText || Boolean(
          current && matchingCanonicalResearchSelection(source.selectedText, current.canonicalText)
        );
    let visualSelectionPresent = true;
    for (const storedVisualSource of source.visualSources || []) {
      const currentVisualSource = current?.visualSources?.find((item) =>
        item.id === storedVisualSource.id
      );
      if (!currentVisualSource) {
        visualSelectionPresent = false;
        break;
      }
      try {
        const resolved = await constructionVisualSourceWithContent(currentVisualSource);
        if (
          resolved.contentHash !== storedVisualSource.contentHash ||
          resolved.byteLength !== storedVisualSource.byteLength ||
          resolved.mediaType !== storedVisualSource.mediaType ||
          resolved.dataBase64 !== storedVisualSource.dataBase64
        ) {
          visualSelectionPresent = false;
          break;
        }
      } catch (error) {
        if (error.code !== "INVALID_RESEARCH_VISUAL_SOURCE") throw error;
        visualSelectionPresent = false;
        break;
      }
    }
    const selectionPresent = textSelectionPresent && visualSelectionPresent;
    return {
      sourceID: source.id,
      sectionID: source.sectionID,
      kind: source.kind,
      blocking: source.kind === "selection",
      current: Boolean(current && current.sectionTextHash === source.sectionTextHash && selectionPresent),
      selectionPresent,
      visualSelectionPresent
    };
  }));
  return {
    evidence,
    sourceStatuses,
    stale: sourceStatuses.some((status) => status.blocking && !status.current)
  };
}

function selectedResearchEvidence(conversation, currentEvidence) {
  const evidenceByID = new Map(currentEvidence.map((item) => [item.sectionID, item]));
  return (conversation.sources || [])
    .filter((source) => source.kind === "selection" && source.selectedText)
    .map((source) => {
      const evidence = evidenceByID.get(source.sectionID);
      const richSource = source.richSourceID
        ? evidence?.richSources?.find((item) => item.id === source.richSourceID)
        : null;
      return evidence ? {
        ...evidence,
        sourceID: source.id,
        text: source.selectedText,
        codeVersion: source.codeVersion || conversation.codeVersion || defaultSyncCodeVersion,
        codeEdition: source.codeEdition || defaultResearchCodeEdition,
        richSourceID: richSource?.id || null,
        richSourceKind: richSource?.kind || null,
        richSourceReference: richSource?.reference || null,
        richSourceContentHash: richSource?.contentHash || null,
        richSourceRowCount: richSource?.rowCount || null,
        richSourceGrids: richSource?.grids || null,
        visualSources: (source.visualSources || []).map((visualSource) => ({ ...visualSource }))
      } : null;
    })
    .filter(Boolean);
}

function researchAssemblyCrossReferences(evidence, catalog) {
  const references = [];
  for (const phrase of inlineCodeReferencePhrases(evidence.text || evidence.canonicalText || "")) {
    const codePrefix = String(phrase.codePrefix || evidence.codePrefix || "").toUpperCase();
    for (const reference of phrase.references || []) {
      const sectionNumber = String(reference.sectionNumber || "").replace(/\.$/, "").toUpperCase();
      const summary = catalog.find((item) =>
        String(item.codePrefix || "").toUpperCase() === codePrefix &&
        String(item.sectionNumber || "").replace(/\.$/, "").toUpperCase() === sectionNumber
      );
      references.push({
        sectionID: String(summary?.id || ""),
        codePrefix,
        sectionNumber,
        referenceKind: String(reference.kind || phrase.kind || "section")
      });
    }
  }
  return references;
}

async function resolveResearchAssemblySection(request, catalog) {
  const requestedID = String(request?.sectionID || "").trim();
  const requestedPrefix = String(request?.codePrefix || "").trim().toUpperCase();
  const requestedNumber = String(request?.sectionNumber || "").trim().replace(/\.$/, "").toUpperCase();
  const summary = catalog.find((item) => String(item.id) === requestedID || String(item.webSectionID || "") === requestedID) ||
    catalog.find((item) =>
      String(item.codePrefix || "").toUpperCase() === requestedPrefix &&
      String(item.sectionNumber || "").replace(/\.$/, "").toUpperCase() === requestedNumber
    );
  if (!summary) return null;
  const [evidence] = await researchEvidenceForSectionIDs([summary.id], { skipUnavailable: false });
  if (!evidence) return null;
  return {
    ...evidence,
    jurisdiction: "New York City",
    codeEdition: defaultResearchCodeEdition,
    codeVersion: defaultSyncCodeVersion,
    crossReferences: researchAssemblyCrossReferences(evidence, catalog)
  };
}

async function assembledResearchEvidenceForTurn({
  question,
  messages,
  pinnedEvidence,
  originSurface,
  projectFacts,
  topicContext,
  onStage
}) {
  const [catalog, invertedIndex] = await Promise.all([
    sectionCatalog(),
    shippedSearchIndex()
  ]);
  const strategy = researchEvidenceStrategyForTurn({
    question,
    pinnedEvidence,
    originSurface
  });
  return assembleResearchEvidence({
    question,
    previousMessages: messages,
    projectFacts,
    pinnedEvidence,
    strategy,
    topicContext,
    onStage,
    limits: researchEvidenceAssemblyLimits,
    discover: ({ question: retrievalQuestion, limit, retrievalContext }) => discoverRelevantEvidence({
      question: retrievalQuestion,
      retrievalContext,
      catalog,
      invertedIndex,
      readSectionBody: (section) => sectionBody(section.webSectionID || section.id, {
        allowMissing: true,
        canonicalSectionID: section.id
      }),
      limit
    }),
    resolveSection: (request) => resolveResearchAssemblySection(request, catalog)
  });
}

function researchAnswerForClient(answer) {
  if (!answer || typeof answer !== "object") return answer;
  const {
    usage: _usage,
    estimatedCost: _estimatedCost,
    estimatedCostUSD: _estimatedCostUSD,
    pricingVersion: _pricingVersion,
    ...clientAnswer
  } = answer;
  return clientAnswer;
}

export function researchAnswerRecordForClient(answer) {
  if (!answer || typeof answer !== "object") return answer;
  const {
    usage: _usage,
    estimatedCost: _estimatedCost,
    estimatedCostUSD: _estimatedCostUSD,
    pricingVersion: _pricingVersion,
    ...clientRecord
  } = answer;
  return {
    ...clientRecord,
    answer: researchAnswerForClient(answer.answer)
  };
}

async function researchConversationForClient(conversation, options = {}) {
  let clientConversation = {
    ...conversation,
    messages: (conversation.messages || []).map((message) => {
      const { researchRequestID: _researchRequestID, ...clientMessage } = message || {};
      return clientMessage.answer ? {
        ...clientMessage,
        answer: researchAnswerForClient(clientMessage.answer)
      } : clientMessage;
    })
  };
  if (options.checkSources) {
    const current = await currentResearchEvidence(conversation);
    const evidenceBySectionID = new Map(
      current.evidence.map((evidence) => [String(evidence.sectionID), evidence])
    );
    clientConversation = {
      ...clientConversation,
      sourceStatus: current.stale ? "changed" : "current",
      sourceStatuses: current.sourceStatuses,
      sources: (clientConversation.sources || []).map((source) => {
        const evidence = evidenceBySectionID.get(String(source.sectionID));
        return evidence ? {
          ...source,
          chapterTitle: evidence.chapterTitle,
          sectionGroupLabel: evidence.sectionGroupLabel,
          sectionGroupTitle: evidence.sectionGroupTitle
        } : source;
      })
    };
  }
  if (options.userID) {
    clientConversation = {
      ...clientConversation,
      projectInformation: await currentResearchProjectInformation(
        options.userID,
        conversation.primaryProjectID
      )
    };
  }
  const projectLink = options.projectLink || (options.userID
    ? await researchConversationProjectLink(options.userID, conversation)
    : null);
  const decisionLink = researchCodeDecisionLink(projectLink);
  return {
    ...clientConversation,
    linkedCodeDecisionID: decisionLink?.questionID || null,
    codeDecisionLinkVersion: projectLink ? Number(projectLink.version || 1) : null
  };
}

async function authenticatedResearchBody(request, response, options = {}) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return null;
  }
  const authContext = await authenticatedUserContext(request, response, userID);
  if (authContext && options.requireResearch && !hasActiveResearchEntitlement(authContext.entitlement)) {
    sendJSON(response, 402, {
      error: "Research requires an active Pro plan and the Research Add-On.",
      code: "RESEARCH_ADDON_REQUIRED"
    });
    return null;
  }
  return authContext ? { body, userID, authContext } : null;
}

function projectIdentityForRecord(record, userID) {
  return syncProjectIdentity(record?.clientID, userID) ||
    syncProjectIdentity(record?.id, userID) ||
    (record?.localFolderID === null || record?.localFolderID === undefined
      ? null
      : `legacy-project-${record.localFolderID}`);
}

async function userContentMutations(userID) {
  const store = await readStore();
  return store.mutationsByUserID?.[userID] || [];
}

async function ownedProjectRecord(userID, projectID) {
  const normalizedProjectID = String(projectID || "").trim();
  const mutations = await userContentMutations(userID);
  const projectMutation = mutations.find((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (
      kind !== "project" ||
      !record ||
      record.folderType === "reference" ||
      Number.isFinite(Date.parse(record.deletedAt || ""))
    ) return false;
    return [record.id, record.clientID, projectIdentityForRecord(record, userID)]
      .filter(Boolean)
      .some((candidate) => String(candidate) === normalizedProjectID);
  });
  return projectMutation ? mutationKindAndRecord(projectMutation).record : null;
}

const researchProjectFactStatuses = new Set(["stated", "confirmed", "unknown", "rejected"]);
const researchProjectFactAliases = new Map([
  ["stories", ["stories-above-grade", "Stories Above Grade"]],
  ["sprinkler-status", ["sprinkler-protection", "Sprinkler Protection"]],
  ["work-type", ["work-filing-type", "Work / Filing Type"]]
]);
const researchBuildingCodeFactKeys = new Set([
  "occupancy", "construction-type", "stories-above-grade", "levels-below-grade",
  "building-height", "sprinkler-protection", "project-status", "work-filing-type",
  "code-basis", "building-area"
]);
const researchZoningFactKeys = new Set([
  "address", "borough", "block", "tax-lots", "zoning-lot-composition", "zoning-districts",
  "commercial-overlays", "special-purpose-district", "zoning-map", "community-district",
  "zoning-lot-area", "lot-width", "lot-depth", "lot-type", "street-frontages",
  "mih-area-options", "affordable-housing-zoning-status", "transit-zone",
  "limited-height-district", "waterfront-status", "lower-density-growth-management-area"
]);

function researchProjectFactGroup(key) {
  if (researchBuildingCodeFactKeys.has(key)) return "buildingCode";
  if (researchZoningFactKeys.has(key)) return "zoning";
  return "custom";
}

function normalizedResearchProjectStructuredFacts(project) {
  return (Array.isArray(project?.structuredFacts) ? project.structuredFacts : []).flatMap((fact) => {
    if (!fact || typeof fact !== "object") return [];
    const key = normalizedResearchText(fact.key || fact.id || "", 120)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const [canonicalKey, canonicalLabel] = researchProjectFactAliases.get(key) || [key, fact.label];
    const label = normalizedResearchText(canonicalLabel, 160);
    const value = normalizedResearchText(fact.value, 1_000);
    if (!key || !label || !value) return [];
    const status = researchProjectFactStatuses.has(String(fact.status || "").toLowerCase())
      ? String(fact.status).toLowerCase()
      : "stated";
    return [{
      id: normalizedResearchText(fact.id || `project-fact:${canonicalKey}`, 200),
      key: canonicalKey,
      label,
      value,
      group: researchProjectFactGroup(canonicalKey),
      status,
      source: normalizedResearchText(fact.source || "description", 100),
      sourceText: normalizedResearchText(fact.sourceText || "", 500),
      updatedAt: fact.updatedAt || null,
      usedInResearch: status === "stated" || status === "confirmed"
    }];
  });
}

export function researchProjectInformation(projectID, project) {
  if (!projectID || !project) return null;
  const address = String(project.address || "").trim();
  const description = String(project.description || "").trim();
  const codeVersion = String(project.codeVersion || "").trim() || null;
  const structuredFacts = normalizedResearchProjectStructuredFacts(project);
  const usableStructuredFacts = structuredFacts.filter((fact) => fact.usedInResearch && fact.key !== "floor-affected");
  const addressFact = address ? {
    id: "project-address",
    key: "address",
    label: "Address",
    value: normalizedResearchText(address, 1_000),
    group: "zoning",
    status: "stated",
    source: "project-record",
    sourceText: "",
    updatedAt: project.updatedAt || null,
    usedInResearch: true
  } : null;
  const buildingCodeFacts = usableStructuredFacts.filter((fact) => fact.group === "buildingCode");
  const zoningFacts = [
    ...(addressFact ? [addressFact] : []),
    ...usableStructuredFacts.filter((fact) => fact.group === "zoning" && (!addressFact || fact.key !== "address"))
  ];
  const customFacts = usableStructuredFacts.filter((fact) => fact.group === "custom");
  const factLine = (groupLabel, fact) => `${groupLabel} — ${fact.label}: ${fact.value} (user-confirmed; not independently verified)`;
  const facts = [
    ...buildingCodeFacts.map((fact) => factLine("Building / Code Fact", fact)),
    ...zoningFacts.map((fact) => factLine("Zoning Fact", fact)),
    ...customFacts.map((fact) => factLine("Custom Fact", fact))
  ];
  if (description) {
    facts.push(`Additional Project facts: ${normalizedResearchText(description, 4_000)}`);
  }
  return {
    projectID,
    address,
    description,
    structuredFacts,
    buildingCodeFacts,
    zoningFacts,
    customFacts,
    missingFactsAreUnknown: true,
    codeVersion,
    canonicalCodeVersion: codeVersion ? canonicalCodeVersion(codeVersion) : null,
    facts,
    source: "project-record",
    updatedAt: project.updatedAt || null
  };
}

function researchCodeBasis(projectID, projectInformation = null, resolvedAt = new Date().toISOString()) {
  return resolveResearchCodeBasis({
    projectID,
    projectCodeVersion: projectInformation?.codeVersion || projectInformation?.canonicalCodeVersion || null,
    availableCodeVersion: defaultSyncCodeVersion,
    availableCodeEdition: defaultResearchCodeEdition,
    resolvedAt
  });
}

async function currentResearchProjectInformation(userID, projectID) {
  const normalizedProjectID = String(projectID || "").trim();
  if (!normalizedProjectID) return null;
  const access = await projectAccessForUser(userID, normalizedProjectID);
  return access ? researchProjectInformation(access.projectID, access.project) : null;
}

function combinedResearchProjectFacts(projectInformation, manualFacts) {
  return Array.from(new Set([
    ...(projectInformation?.facts || []),
    ...(Array.isArray(manualFacts) ? manualFacts : [])
  ].filter(Boolean)));
}

export function researchFactUsageDisclosure({
  factsUsed = [],
  projectFacts = [],
  conversationFactContext = null
} = {}) {
  const normalized = (values) => Array.from(new Set(
    (Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)
  ));
  const used = normalized(factsUsed);
  const projectSet = new Set(normalized(projectFacts));
  const conversationSet = new Set(normalized([
    ...(conversationFactContext?.established || []),
    ...(conversationFactContext?.hypothetical || [])
  ]));
  const projectContext = used.filter((fact) => projectSet.has(fact));
  const conversation = used.filter((fact) => conversationSet.has(fact) && !projectSet.has(fact));
  const classified = new Set([...projectContext, ...conversation]);
  return {
    schemaVersion: 1,
    projectContext,
    conversation,
    other: used.filter((fact) => !classified.has(fact))
  };
}

function rolePermissions(role) {
  return Object.values(organizationPermissions)
    .filter((permission) => roleAllows(role, permission));
}

async function organizationAccessForUser(userID, organizationID) {
  const organization = await storedOrganization(organizationID);
  const membership = await storedOrganizationMembership(organizationID, userID);
  if (
    !organization ||
    organization.status !== "active" ||
    !membership ||
    membership.status !== "active"
  ) {
    return null;
  }
  return {
    organization,
    membership,
    role: membership.role,
    permissions: rolePermissions(membership.role)
  };
}

async function projectAccessForUser(userID, projectID) {
  const normalizedProjectID = String(projectID || "").trim();
  if (!normalizedProjectID) return null;
  const ownership = await storedProjectOwnership(normalizedProjectID);
  if (!ownership) {
    const project = await ownedProjectRecord(userID, normalizedProjectID);
    return project ? {
      projectID: projectIdentityForRecord(project, userID) || normalizedProjectID,
      project,
      ownership: projectOwnershipRecord({
        projectID: projectIdentityForRecord(project, userID) || normalizedProjectID,
        owner: ownerScope(userID),
        storageOwnerUserID: userID,
        originalOwnerUserID: userID,
        createdAt: project.updatedAt || new Date().toISOString()
      }),
      organization: null,
      membership: null,
      role: "owner",
      permissions: rolePermissions("owner"),
      storageOwnerUserID: userID,
      owner: ownerScope(userID)
    } : null;
  }

  if (ownership.owner?.kind === "user") {
    if (ownership.owner.id !== userID) return null;
    const project = await ownedProjectRecord(ownership.storageOwnerUserID, normalizedProjectID);
    return project ? {
      projectID: normalizedProjectID,
      project,
      ownership,
      organization: null,
      membership: null,
      role: "owner",
      permissions: rolePermissions("owner"),
      storageOwnerUserID: ownership.storageOwnerUserID,
      owner: ownerScope(userID)
    } : null;
  }

  const organizationID = ownership.owner?.organizationID || ownership.owner?.id;
  const organization = await storedOrganization(organizationID);
  if (!organization || organization.status !== "active") return null;
  const [projectMembership, organizationMembership] = await Promise.all([
    storedProjectMembership(normalizedProjectID, userID),
    storedOrganizationMembership(organizationID, userID)
  ]);
  const activeProjectMembership = projectMembership?.status === "active"
    ? projectMembership
    : null;
  const activeOrganizationMembership = organizationMembership?.status === "active"
    ? organizationMembership
    : null;
  const membership = activeOrganizationMembership?.role === "owner"
    ? activeOrganizationMembership
    : activeProjectMembership || activeOrganizationMembership;
  if (!membership) return null;
  const project = await ownedProjectRecord(ownership.storageOwnerUserID, normalizedProjectID);
  if (!project) return null;
  return {
    projectID: normalizedProjectID,
    project,
    ownership,
    organization,
    membership,
    role: membership.role,
    permissions: rolePermissions(membership.role),
    storageOwnerUserID: ownership.storageOwnerUserID,
    owner: organizationOwnerScope(organizationID)
  };
}

async function requireProjectPermission(response, userID, projectID, permission) {
  const access = await projectAccessForUser(userID, projectID);
  if (!access) {
    sendError(response, 404, "Project not found.");
    return null;
  }
  if (!access.permissions.includes(permission)) {
    sendJSON(response, 403, {
      error: "Your Project role does not allow this action.",
      code: "PROJECT_PERMISSION_REQUIRED",
      requiredPermission: permission
    });
    return null;
  }
  return access;
}

async function organizationCapabilityAccess(userID) {
  const [organizationEntries, projectMemberships] = await Promise.all([
    listStoredOrganizationsForUser(userID),
    listStoredProjectMembershipsForUser(userID)
  ]);
  const activeOrganizations = organizationEntries.filter(({ organization, membership }) =>
    organization?.status === "active" && membership?.status === "active"
  );
  const activeProjectMemberships = projectMemberships.filter((membership) =>
    membership.status === "active"
  );
  return {
    collaborationEnabled: activeOrganizations.length > 0 || activeProjectMemberships.length > 0,
    organizationAdministrationEnabled: activeOrganizations.some(({ organization, membership }) =>
      membership.role === "owner" &&
      organization.capabilities?.organizationAdministration !== false
    )
  };
}

async function ownsProjectAssetScope(userID, projectID) {
  if (await ownedProjectRecord(userID, projectID)) return true;
  return (await userContentMutations(userID)).some((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    return kind === "workboard" &&
      !Number.isFinite(Date.parse(record?.deletedAt || "")) &&
      String(syncProjectIdentity(record?.projectID, userID) || record?.projectID || "") === String(projectID);
  });
}

async function workboardEditAccess(response, userID, projectID) {
  const access = await projectAccessForUser(userID, projectID);
  if (access) {
    if (!access.permissions.includes(organizationPermissions.projectEdit)) {
      sendJSON(response, 403, {
        error: "Your Project role does not allow this action.",
        code: "PROJECT_PERMISSION_REQUIRED",
        requiredPermission: organizationPermissions.projectEdit
      });
      return null;
    }
    return access;
  }
  if (await ownsProjectAssetScope(userID, projectID)) {
    return {
      projectID,
      organization: null,
      storageOwnerUserID: userID,
      owner: ownerScope(userID)
    };
  }
  sendError(response, 404, "Project not found.");
  return null;
}

async function ownedProjectTargetExists(userID, targetKind, targetID) {
  const normalizedTargetID = String(targetID || "").trim();
  if (targetKind === "canonicalSection") {
    try {
      return (await researchEvidenceForSectionIDs([normalizedTargetID])).length === 1;
    } catch {
      return false;
    }
  }
  if (targetKind === "selectedPassage") {
    return (await listStoredResearchConversations(userID))
      .some((conversation) => (conversation.sources || []).some((source) => source.id === normalizedTargetID));
  }
  if (targetKind === "researchConversation") {
    return Boolean(await storedResearchConversation(userID, normalizedTargetID));
  }
  if (targetKind === "researchAnswer") {
    return (await listStoredResearchAnswers(userID)).some((answer) => answer.id === normalizedTargetID);
  }
  if (targetKind === "approvedEvidence") {
    return (await listStoredResearchAnswers(userID))
      .some((answer) => (answer.evidence || []).some((snapshot) => snapshot.id === normalizedTargetID));
  }
  const mutations = await userContentMutations(userID);
  if (targetKind === "savedItem") {
    return mutations.some((mutation) => {
      const { kind, record } = mutationKindAndRecord(mutation);
      return kind === "savedItem" &&
        !Number.isFinite(Date.parse(record?.deletedAt || "")) &&
        [record?.id, normalizedMutationRecordID(mutation)].includes(normalizedTargetID);
    });
  }
  if (targetKind === "note") {
    return mutations.some((mutation) => {
      const { kind, record } = mutationKindAndRecord(mutation);
      return kind === "annotation" && record?.tags === undefined &&
        !Number.isFinite(Date.parse(record?.deletedAt || "")) &&
        [record?.id, normalizedMutationRecordID(mutation)].includes(normalizedTargetID);
    });
  }
  if (targetKind === "workboard") {
    return mutations.some((mutation) => {
      const { kind, record } = mutationKindAndRecord(mutation);
      return kind === "workboard" &&
        !Number.isFinite(Date.parse(record?.deletedAt || "")) &&
        [record?.id, normalizedMutationRecordID(mutation)].includes(normalizedTargetID);
    });
  }
  const artifact = (await listStoredFoundationArtifacts(userID))
    .find((item) => item.envelope?.id === normalizedTargetID && !item.envelope?.deletedAt);
  if (!artifact) return false;
  const permittedTypes = {
    notebookCard: ["notebookCard"],
    workboardPreview: ["workboardPreview"],
    attachment: ["attachment"],
    reportDraft: ["reportDraft"],
    reportManifest: ["reportManifest"],
    generatedReport: ["generatedReport"]
  };
  return (permittedTypes[targetKind] || []).includes(artifact.envelope.type);
}

function deterministicFoundationLinkID(userID, projectID, targetKind, targetID) {
  return `project-link-${createHash("sha256")
    .update([userID, projectID, targetKind, targetID].join("\u001f"))
    .digest("hex")
    .slice(0, 32)}`;
}

async function migrateLegacyProjectFoundation(userID) {
  const checkpointName = `project-foundation-v${projectFoundationSchemaVersion}`;
  const existingCheckpoint = await storedMigrationCheckpoint(userID, checkpointName);

  const mutations = await userContentMutations(userID);
  const referenceProjectIDs = new Set(mutations
    .map((mutation) => mutationKindAndRecord(mutation))
    .filter(({ kind, record }) =>
      kind === "project" &&
      record?.folderType === "reference" &&
      !Number.isFinite(Date.parse(record.deletedAt || ""))
    )
    .map(({ record }) => projectIdentityForRecord(record, userID))
    .filter(Boolean));
  const existingLinks = await listStoredProjectLinks(userID);
  const existingAnswers = await listStoredResearchAnswers(userID);
  const answerIDs = new Set(existingAnswers.map((answer) => answer.id));
  const knownKeys = new Set(existingLinks
    .map((link) => [link.projectID, link.targetKind, link.targetID].join("\u001f")));
  let migratedProjectSections = 0;
  let migratedWorkboards = 0;
  let migratedResearchAnswers = 0;
  let unmigratedResearchAnswers = 0;
  for (const mutation of mutations) {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (!record || Number.isFinite(Date.parse(record.deletedAt || ""))) continue;
    if (kind === "projectSection") {
      const projectID = syncProjectIdentity(record.folderClientID, userID) ||
        (record.localFolderID === null || record.localFolderID === undefined
          ? null
          : `legacy-project-${record.localFolderID}`);
      if (!projectID || !record.sectionID || referenceProjectIDs.has(projectID)) continue;
      const targetID = String(record.sectionID);
      const key = [projectID, "canonicalSection", targetID].join("\u001f");
      if (knownKeys.has(key)) continue;
      await saveStoredProjectLink(userID, projectLinkRecord({
        id: deterministicFoundationLinkID(userID, projectID, "canonicalSection", targetID),
        owner: ownerScope(userID),
        projectID,
        targetKind: "canonicalSection",
        targetID,
        relationship: "reference",
        createdAt: record.updatedAt || new Date().toISOString(),
        updatedAt: record.updatedAt || new Date().toISOString(),
        metadata: {
          migratedFrom: "projectSection",
          legacyRecordID: record.id || null,
          scope: record.scope || null,
          blockID: record.blockID || null
        }
      }));
      knownKeys.add(key);
      migratedProjectSections += 1;
    } else if (kind === "workboard" && record.projectID && record.id) {
      const projectID = syncProjectIdentity(record.projectID, userID) || record.projectID;
      const key = [projectID, "workboard", record.id].join("\u001f");
      if (knownKeys.has(key)) continue;
      await saveStoredProjectLink(userID, projectLinkRecord({
        id: deterministicFoundationLinkID(userID, projectID, "workboard", record.id),
        owner: ownerScope(userID),
        projectID,
        targetKind: "workboard",
        targetID: record.id,
        relationship: "owner",
        createdAt: record.updatedAt || new Date().toISOString(),
        updatedAt: record.updatedAt || new Date().toISOString(),
        metadata: { migratedFrom: "workboard" }
      }));
      knownKeys.add(key);
      migratedWorkboards += 1;
    }
  }
  for (const conversation of await listStoredResearchConversations(userID)) {
    const messages = conversation.messages || [];
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (message.role !== "assistant" || !message.answer || answerIDs.has(message.id)) continue;
      const questionMessage = [...messages.slice(0, index)].reverse()
        .find((candidate) => candidate.role === "user");
      const allowedSourceIDs = new Set(message.answer.evidenceSourceIDs || []);
      const sourceRecords = (conversation.sources || []).filter((source) =>
        source.kind === "selection" &&
        source.selectedText &&
        (!allowedSourceIDs.size || allowedSourceIDs.has(source.id))
      );
      try {
        const snapshots = sourceRecords.map((source) => immutableEvidenceSnapshot({
          source: {
            ...source,
            sourceID: source.id,
            text: source.selectedText
          },
          approvedAt: message.createdAt || conversation.updatedAt || conversation.createdAt,
          evidenceSetVersion: Number(conversation.evidenceSetVersion || 1),
          sourceLibraryVersion: source.codeVersion || conversation.codeVersion
        }));
        const answer = {
          ...immutableResearchAnswer({
            id: message.id,
            owner: ownerScope(userID),
            conversationID: conversation.id,
            projectID: conversation.primaryProjectID || null,
            question: questionMessage?.question,
            answer: message.answer,
            evidence: snapshots,
            citations: message.answer.citations || [],
            model: message.answer.model || "legacy-research-system",
            researchSystemVersion: [
              message.answer.promptVersion || "legacy-prompt",
              message.answer.evidenceVersion || "legacy-evidence"
            ].join(":"),
            createdAt: message.createdAt || conversation.updatedAt || conversation.createdAt
          }),
          migratedFromConversation: true
        };
        await saveStoredResearchAnswer(userID, answer);
        answerIDs.add(answer.id);
        migratedResearchAnswers += 1;
      } catch {
        unmigratedResearchAnswers += 1;
      }
    }
  }
  const checkpointCounters = {
    schemaVersion: projectFoundationSchemaVersion,
    migratedProjectSections: Number(existingCheckpoint?.migratedProjectSections || 0) + migratedProjectSections,
    migratedWorkboards: Number(existingCheckpoint?.migratedWorkboards || 0) + migratedWorkboards,
    migratedResearchAnswers: Number(existingCheckpoint?.migratedResearchAnswers || 0) + migratedResearchAnswers,
    unmigratedResearchAnswers
  };
  const checkpointChanged = !existingCheckpoint || Object.entries(checkpointCounters)
    .some(([key, value]) => Number(existingCheckpoint?.[key] || 0) !== value);
  if (!checkpointChanged) return existingCheckpoint;

  const checkpoint = {
    ...checkpointCounters,
    completedAt: new Date().toISOString()
  };
  await saveStoredMigrationCheckpoint(userID, checkpointName, checkpoint);
  return checkpoint;
}

async function projectFoundationStateForStorageOwner(
  storageOwnerUserID,
  projectID = "",
  options = {}
) {
  const checkpoint = await migrateLegacyProjectFoundation(storageOwnerUserID);
  const allProjects = (await userContentMutations(storageOwnerUserID))
    .map((mutation) => mutationKindAndRecord(mutation))
    .filter(({ kind, record }) =>
      kind === "project" &&
      record &&
      record.folderType !== "reference" &&
      !Number.isFinite(Date.parse(record.deletedAt || ""))
    )
    .map(({ record }) => ({
      id: projectIdentityForRecord(record, storageOwnerUserID),
      sourceRecordID: record.id,
      name: record.name || "Untitled Project",
      address: record.address || "",
      description: record.description || "",
      colorHex: record.colorHex || null,
      archivedAt: record.archivedAt || null,
      updatedAt: record.updatedAt
    }));
  const projectIDs = new Set(allProjects.map((project) => project.id));
  if (projectID && !projectIDs.has(projectID)) {
    return null;
  }
  const projects = projectID && options.includeAllProjects === false
    ? allProjects.filter((project) => project.id === projectID)
    : allProjects;
  const scopedProjectID = String(projectID || "").trim();
  const scopeOptions = scopedProjectID ? { projectID: scopedProjectID } : {};
  const links = await listStoredProjectLinks(storageOwnerUserID, scopeOptions);
  const linkedTargetIDs = Array.from(new Set(
    links.filter((link) => !link.deletedAt).map((link) => link.targetID).filter(Boolean)
  ));
  const storedArtifacts = scopedProjectID
    ? (linkedTargetIDs.length === 0
        ? []
        : await listStoredFoundationArtifacts(storageOwnerUserID, { ids: linkedTargetIDs }))
    : await listStoredFoundationArtifacts(storageOwnerUserID);
  const commentsByThreadID = new Map();
  storedArtifacts
    .filter((artifact) => artifact.envelope?.type === "reviewComment")
    .forEach((artifact) => {
      const threadID = artifact.payload?.threadID;
      if (!threadID) return;
      const comments = commentsByThreadID.get(threadID) || [];
      comments.push(artifact.payload);
      commentsByThreadID.set(threadID, comments);
    });
  const artifacts = storedArtifacts.map((artifact) => {
    if (artifact.envelope?.type !== "reviewThread") return artifact;
    const updatedAt = latestReviewThreadUpdatedAt(
      artifact.envelope.updatedAt,
      commentsByThreadID.get(artifact.envelope.id) || []
    );
    return updatedAt === artifact.envelope.updatedAt ? artifact : {
      ...artifact,
      envelope: { ...artifact.envelope, updatedAt }
    };
  });
  const linkedResearchAnswerIDs = new Set(
    links
      .filter((link) => !link.deletedAt && link.targetKind === "researchAnswer")
      .map((link) => String(link.targetID || ""))
      .filter(Boolean)
  );
  const answers = (await listStoredResearchAnswers(storageOwnerUserID))
    .filter((answer) =>
      !scopedProjectID ||
      answer.projectID === scopedProjectID ||
      linkedResearchAnswerIDs.has(String(answer.id))
    )
    .map((answer) => ({
      id: answer.id,
      conversationID: answer.conversationID,
      projectID: answer.projectID || null,
      question: answer.question,
      conclusion: answer.answer?.conclusion || "",
      evidenceCount: answer.evidence?.length || 0,
      sectionIDs: Array.from(new Set(
        (answer.evidence || [])
          .map((evidence) => String(evidence.sectionID || "").trim())
          .filter(Boolean)
      )),
      reviewStatus: answer.reviewStatus,
      createdAt: answer.createdAt
    }));
  const researchConversations = (await listStoredResearchConversations(storageOwnerUserID, {
    ...scopeOptions,
    summaryOnly: true
  }))
    .map(researchConversationSummary);
  const activity = await listStoredActivityEvents(storageOwnerUserID, scopeOptions);
  const workboardPreview = scopedProjectID
    ? workboardPreviewSummary((await projectWorkboardPreviews(storageOwnerUserID, scopedProjectID))[0])
    : null;
  const coordinationAssignees = scopedProjectID
    ? await coordinationAssigneesForProject(storageOwnerUserID, scopedProjectID)
    : [];
  return {
    schemaVersion: projectFoundationSchemaVersion,
    projects,
    links,
    artifacts,
    researchConversations,
    researchAnswers: answers,
    activity,
    coordinationAssignees,
    workboardPreview,
    migrationCheckpoint: checkpoint
  };
}

async function notebookCardSummariesForProject(storageOwnerUserID, projectID) {
  const links = await listStoredProjectLinks(storageOwnerUserID, {
    projectID,
    targetKind: "notebookCard"
  });
  const linkedCardIDs = Array.from(new Set(
    links.filter((link) => !link.deletedAt).map((link) => link.targetID).filter(Boolean)
  ));
  if (linkedCardIDs.length === 0) return [];
  return (await listStoredFoundationArtifacts(storageOwnerUserID, { ids: linkedCardIDs }))
    .filter((artifact) =>
      artifact.envelope?.type === "notebookCard" &&
      !artifact.envelope?.deletedAt
    )
    .map((artifact) => ({
      id: artifact.envelope.id,
      version: artifact.envelope.version,
      cardType: artifact.payload.cardType,
      title: artifact.payload.title,
      plainText: artifact.payload.plainText,
      referenceCount: artifact.payload.references?.length || 0,
      sourceClassification: artifact.payload.sourceClassification,
      createdAt: artifact.envelope.createdAt,
      updatedAt: artifact.envelope.updatedAt,
      archivedAt: artifact.envelope.archivedAt || null
    }))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

async function reportHistorySummariesForProject(storageOwnerUserID, projectID) {
  const manifests = await projectReportManifests(storageOwnerUserID, projectID);
  const files = await reportFilesForProject(storageOwnerUserID, projectID);
  return manifests.map((artifact) => ({
    ...reportManifestSummary(artifact.payload),
    files: files.filter((file) => file.manifestID === artifact.envelope.id)
  }));
}

async function coordinationAssigneesForProject(storageOwnerUserID, projectID) {
  const ownership = await storedProjectOwnership(projectID);
  let candidateUserIDs = [storageOwnerUserID];
  if (ownership?.owner?.kind === "organization") {
    const organizationID = ownership.owner.organizationID || ownership.owner.id;
    const [organizationMemberships, projectMemberships] = await Promise.all([
      listStoredOrganizationMemberships(organizationID),
      listStoredProjectMemberships(projectID)
    ]);
    candidateUserIDs = [...organizationMemberships, ...projectMemberships]
      .filter((membership) => membership?.status === "active")
      .map((membership) => membership.userID);
  }
  const uniqueUserIDs = Array.from(new Set(candidateUserIDs.filter(Boolean)));
  const accessibleUserIDs = [];
  for (const userID of uniqueUserIDs) {
    const access = await projectAccessForUser(userID, projectID);
    if (access?.permissions.includes(organizationPermissions.projectView)) {
      accessibleUserIDs.push(userID);
    }
  }
  const accountStore = (await readStore()).users || {};
  return accessibleUserIDs
    .map((userID) => {
      const account = accountStore[userID] || null;
      return {
        userID,
        displayName: String(
          account?.displayName || account?.publicUsername || "Project member"
        ).trim()
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

async function handleProjectFoundationState(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const state = await projectFoundationStateForStorageOwner(context.userID, projectID);
  if (!state) {
    sendError(response, 404, "Project not found.");
    return;
  }
  sendJSON(response, 200, state);
}

function organizationInvitationForClient(invitation) {
  if (!invitation) return null;
  const { tokenHash: _tokenHash, ...clientInvitation } = invitation;
  return {
    ...clientInvitation,
    state: invitationState(invitation)
  };
}

function normalizedOrganizationFirmControls(organization) {
  return normalizeFirmControls(organization?.firmControls, {
    organizationName: organization?.name || "Firm workspace",
    ownerUserID: organization?.ownerUserID || "unknown-owner",
    createdAt: organization?.createdAt || new Date().toISOString(),
    updatedAt: organization?.firmControls?.updatedAt ||
      organization?.updatedAt ||
      organization?.createdAt ||
      new Date().toISOString(),
    updatedByUserID: organization?.firmControls?.updatedByUserID ||
      organization?.ownerUserID ||
      "unknown-owner",
    version: organization?.firmControls?.version || 1
  });
}

function firmControlsForClient(organization, access = null) {
  const controls = normalizedOrganizationFirmControls(organization);
  const ownerCanManage = access?.permissions?.includes(
    organizationPermissions.organizationManage
  );
  return {
    ...controls,
    reportTemplates: controls.reportTemplates.filter((template) =>
      ownerCanManage || template.status === "active"
    ),
    tags: controls.tags.filter((tag) => ownerCanManage || tag.status === "active"),
    projectTagAssignments: ownerCanManage
      ? controls.projectTagAssignments
      : Object.fromEntries(
          (access?.visibleProjectIDs || [])
            .filter((projectID) => controls.projectTagAssignments[projectID])
            .map((projectID) => [
              projectID,
              controls.projectTagAssignments[projectID]
            ])
        ),
    administrativeHistory: ownerCanManage ? controls.administrativeHistory : [],
    updatedByUserID: ownerCanManage ? controls.updatedByUserID : null
  };
}

function organizationForClient(organization, access = null, seats = null) {
  return {
    id: organization.id,
    schemaVersion: organization.schemaVersion,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    capabilities: organization.capabilities,
    billingIdentity: {
      mode: organization.billingIdentity?.mode || "beta",
      status: organization.billingIdentity?.status || "trial",
      seatLimit: organization.billingIdentity?.seatLimit || 1
    },
    billingOperations: {
      authority: "server-only",
      clientMutable: false,
      status: organization.billingIdentity?.status || "trial"
    },
    firmControls: firmControlsForClient(organization, access),
    role: access?.role || null,
    permissions: access?.permissions || [],
    accessScope: access?.accessScope || "organization",
    seats,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt
  };
}

async function organizationSeatState(organizationID) {
  const [memberships, invitations, ownerships] = await Promise.all([
    listStoredOrganizationMemberships(organizationID),
    listStoredOrganizationInvitations(organizationID),
    listStoredProjectOwnershipsForOrganizations([organizationID])
  ]);
  const projectMemberships = (await Promise.all(
    ownerships.map((ownership) => listStoredProjectMemberships(ownership.projectID))
  )).flat();
  return organizationSeatUsage(
    [...memberships, ...projectMemberships],
    invitations
  );
}

async function organizationMemberForClient(membership, accounts = null) {
  const accountStore = accounts || (await readStore()).users || {};
  const account = accountStore[membership.userID] || null;
  return {
    ...membership,
    account: account ? {
      displayName: account.displayName || null,
      publicUsername: account.publicUsername || null,
      email: accountEmail(account) || null
    } : null
  };
}

async function accessibleOrganizationProjects(userID, organizationID) {
  const ownerships = await listStoredProjectOwnershipsForOrganizations([organizationID]);
  const projects = [];
  for (const ownership of ownerships) {
    const access = await projectAccessForUser(userID, ownership.projectID);
    if (!access || !access.permissions.includes(organizationPermissions.projectView)) continue;
    projects.push({
      id: access.projectID,
      sourceRecordID: access.project.id,
      name: access.project.name || "Untitled Project",
      address: access.project.address || "",
      description: access.project.description || "",
      colorHex: access.project.colorHex || null,
      archivedAt: access.project.archivedAt || null,
      updatedAt: access.project.updatedAt,
      originalOwnerUserID: ownership.originalOwnerUserID,
      role: access.role,
      permissions: access.permissions
    });
  }
  return projects.sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
}

async function availableOrganizationSlug(name) {
  const base = organizationSlug(name);
  if (!await storedOrganizationBySlug(base)) return base;
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${base.slice(0, Math.max(1, 64 - String(suffix).length - 1))}-${suffix}`;
    if (!await storedOrganizationBySlug(candidate)) return candidate;
  }
  return `${base.slice(0, 51)}-${randomUUID().slice(0, 12)}`;
}

async function handleOrganizationList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const [organizationEntries, projectMemberships] = await Promise.all([
    listStoredOrganizationsForUser(context.userID),
    listStoredProjectMembershipsForUser(context.userID)
  ]);
  const accessByOrganizationID = new Map();
  for (const { organization, membership } of organizationEntries) {
    if (organization?.status !== "active" || membership?.status !== "active") continue;
    accessByOrganizationID.set(organization.id, {
      organization,
      role: membership.role,
      permissions: rolePermissions(membership.role),
      accessScope: "organization"
    });
  }
  for (const membership of projectMemberships) {
    if (membership.status !== "active" || accessByOrganizationID.has(membership.organizationID)) continue;
    const organization = await storedOrganization(membership.organizationID);
    if (!organization || organization.status !== "active") continue;
    accessByOrganizationID.set(organization.id, {
      organization,
      role: membership.role,
      permissions: rolePermissions(membership.role),
      accessScope: "project"
    });
  }
  const organizations = [];
  for (const access of accessByOrganizationID.values()) {
    const controls = normalizedOrganizationFirmControls(access.organization);
    const [projects, seats, researchUsage] = await Promise.all([
      accessibleOrganizationProjects(context.userID, access.organization.id),
      access.role === "owner" ? organizationSeatState(access.organization.id) : null,
      access.role === "owner"
        ? organizationResearchAllowanceUsage(access.organization.id, controls)
        : null
    ]);
    organizations.push({
      ...organizationForClient(access.organization, {
        ...access,
        visibleProjectIDs: projects.map((project) => project.id)
      }, seats),
      projects,
      researchUsage
    });
  }
  organizations.sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
  sendJSON(response, 200, { organizations });
}

async function handleOrganizationCreate(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  if (!hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Creating a firm workspace requires Pro.",
      code: "PRO_REQUIRED_ORGANIZATION"
    });
    return;
  }
  try {
    const name = String(context.body.name || "").trim();
    const now = new Date().toISOString();
    const organization = organizationRecord({
      name,
      slug: await availableOrganizationSlug(name),
      ownerUserID: context.userID,
      createdAt: now
    });
    const membership = organizationMembershipRecord({
      organizationID: organization.id,
      userID: context.userID,
      role: "owner",
      createdAt: now
    });
    await saveStoredOrganization(organization);
    await saveStoredOrganizationMembership(membership);
    sendJSON(response, 201, {
      organization: organizationForClient(organization, {
        role: "owner",
        permissions: rolePermissions("owner"),
        accessScope: "organization"
      }, { active: 1, pending: 0, used: 1 })
    });
  } catch (error) {
    if (error?.code === "23505") {
      sendJSON(response, 409, {
        error: "That firm workspace name is already in use.",
        code: "ORGANIZATION_SLUG_CONFLICT"
      });
      return;
    }
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid firm workspace.",
      code: "INVALID_ORGANIZATION"
    });
  }
}

async function handleOrganizationUpdate(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access) {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  if (!access.permissions.includes(organizationPermissions.organizationManage)) {
    sendJSON(response, 403, {
      error: "Only a firm Owner can change workspace settings.",
      code: "ORGANIZATION_OWNER_REQUIRED"
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const organization = organizationRecord({
      ...access.organization,
      name: context.body.name ?? access.organization.name,
      slug: access.organization.slug,
      ownerUserID: access.organization.ownerUserID,
      createdAt: access.organization.createdAt,
      updatedAt: now
    });
    await saveStoredOrganization(organization);
    sendJSON(response, 200, {
      organization: organizationForClient(organization, {
        role: access.role,
        permissions: access.permissions,
        accessScope: "organization"
      }, await organizationSeatState(organizationID))
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid firm workspace update.",
      code: "INVALID_ORGANIZATION"
    });
  }
}

async function handleOrganizationDelete(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  if (String(context.body.confirmation || "").toLowerCase() !== "delete") {
    sendJSON(response, 400, {
      error: "Confirm firm workspace deletion before continuing.",
      code: "ORGANIZATION_DELETE_CONFIRMATION_REQUIRED"
    });
    return;
  }
  const organizationID = String(context.body.organizationID || "").trim();
  const organization = await storedOrganization(organizationID);
  if (!organization || organization.status !== "active") {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  if (organization.ownerUserID !== context.userID) {
    sendJSON(response, 403, {
      error: "Only the firm Owner can delete this workspace.",
      code: "ORGANIZATION_OWNER_REQUIRED"
    });
    return;
  }
  const result = await deleteStoredOrganization(
    organizationID,
    context.userID,
    new Date().toISOString()
  );
  if (result.outcome !== "deleted") {
    sendError(response, result.outcome === "forbidden" ? 403 : 404, result.outcome === "forbidden"
      ? "Only the firm Owner can delete this workspace."
      : "Firm workspace not found.");
    return;
  }
  sendJSON(response, 200, {
    deleted: true,
    organizationID,
    restoredProjectIDs: result.restoredProjectIDs
  });
}

async function organizationResearchAllowanceUsage(organizationID, controls) {
  const [memberships, ownerships] = await Promise.all([
    listStoredOrganizationMemberships(organizationID),
    listStoredProjectOwnershipsForOrganizations([organizationID])
  ]);
  const projectMemberships = (await Promise.all(
    ownerships.map((ownership) => listStoredProjectMemberships(ownership.projectID))
  )).flat();
  const activeUserIDs = Array.from(new Set(
    [...memberships, ...projectMemberships]
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.userID)
  ));
  const usageByUser = await Promise.all(activeUserIDs.map(async (userID) => {
    const entries = await researchUsageSince(userID, currentMonthStart());
    return {
      userID,
      requestsUsed: entries.length,
      totalTokens: entries.reduce((total, entry) => total + Number(entry.totalTokens || 0), 0)
    };
  }));
  const policy = controls.researchAllowance;
  return {
    mode: policy.mode,
    authority: policy.authority,
    requestsUsed: usageByUser.reduce((total, entry) => total + entry.requestsUsed, 0),
    requestLimit: policy.mode === "per-seat"
      ? policy.monthlyUnits * Math.max(1, activeUserIDs.length)
      : policy.monthlyUnits,
    monthlyUnits: policy.monthlyUnits,
    activeSeats: activeUserIDs.length,
    resetDate: nextMonthStart(),
    totalTokens: usageByUser.reduce((total, entry) => total + entry.totalTokens, 0),
    perSeat: policy.mode === "per-seat" ? usageByUser : []
  };
}

function preserveFirmControlCreationMetadata(existing, proposed, updatedAt) {
  const existingTags = new Map((existing.tags || []).map((tag) => [tag.id, tag]));
  const existingTemplates = new Map(
    (existing.reportTemplates || []).map((template) => [template.id, template])
  );
  return {
    ...proposed,
    administrativeHistory: existing.administrativeHistory,
    tags: (Array.isArray(proposed?.tags) ? proposed.tags : []).map((tag) => ({
      ...tag,
      createdAt: existingTags.get(tag?.id)?.createdAt || updatedAt,
      updatedAt
    })),
    reportTemplates: (Array.isArray(proposed?.reportTemplates)
      ? proposed.reportTemplates
      : []).map((template) => ({
      ...template,
      createdAt: existingTemplates.get(template?.id)?.createdAt || updatedAt,
      updatedAt
    }))
  };
}

async function handleOrganizationControlsSave(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access) {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  if (!access.permissions.includes(organizationPermissions.organizationManage)) {
    sendJSON(response, 403, {
      error: "Only a firm Owner can change firm standards.",
      code: "ORGANIZATION_OWNER_REQUIRED"
    });
    return;
  }
  const existingControls = normalizedOrganizationFirmControls(access.organization);
  const expectedVersion = Number(context.body.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existingControls.version) {
    sendJSON(response, 409, {
      error: "These firm standards changed after you opened them. Review the current version before saving.",
      code: "FIRM_CONTROLS_VERSION_CONFLICT",
      controls: firmControlsForClient(access.organization, access)
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const controls = normalizeFirmControls(
      preserveFirmControlCreationMetadata(existingControls, context.body.controls || {}, now),
      {
        organizationName: access.organization.name,
        ownerUserID: access.organization.ownerUserID,
        createdAt: access.organization.createdAt,
        updatedAt: now,
        updatedByUserID: context.userID,
        version: existingControls.version + 1,
        historyEntry: {
          summary: "Updated firm tags, Report standards, and operating policies."
        }
      }
    );
    const ownerships = await listStoredProjectOwnershipsForOrganizations([organizationID]);
    const organizationProjectIDs = new Set(ownerships.map((ownership) => ownership.projectID));
    const invalidProjectID = Object.keys(controls.projectTagAssignments)
      .find((projectID) => !organizationProjectIDs.has(projectID));
    if (invalidProjectID) {
      sendJSON(response, 400, {
        error: "A tag assignment references a Project outside this firm workspace.",
        code: "INVALID_FIRM_PROJECT_ASSIGNMENT"
      });
      return;
    }
    const organization = organizationRecord({
      ...access.organization,
      firmControls: controls,
      createdAt: access.organization.createdAt,
      updatedAt: now
    });
    await saveStoredOrganization(organization);
    sendJSON(response, 200, {
      organization: organizationForClient(organization, {
        role: access.role,
        permissions: access.permissions,
        accessScope: "organization"
      }, await organizationSeatState(organizationID)),
      researchUsage: await organizationResearchAllowanceUsage(organizationID, controls)
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid firm standards.",
      code: "INVALID_FIRM_CONTROLS"
    });
  }
}

async function handleOrganizationMemberList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access) {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  if (!access.permissions.includes(organizationPermissions.memberManage)) {
    sendJSON(response, 403, {
      error: "Only a firm Owner can view the member directory.",
      code: "ORGANIZATION_OWNER_REQUIRED"
    });
    return;
  }
  const [memberships, invitations, ownerships, store] = await Promise.all([
    listStoredOrganizationMemberships(organizationID),
    listStoredOrganizationInvitations(organizationID),
    listStoredProjectOwnershipsForOrganizations([organizationID]),
    readStore()
  ]);
  const projectMemberships = (await Promise.all(
    ownerships.map((ownership) => listStoredProjectMemberships(ownership.projectID))
  )).flat();
  const members = await Promise.all(
    memberships.map((membership) => organizationMemberForClient(membership, store.users || {}))
  );
  const projectMembers = await Promise.all(
    projectMemberships.map((membership) => organizationMemberForClient(membership, store.users || {}))
  );
  sendJSON(response, 200, {
    organization: organizationForClient(access.organization, {
      role: access.role,
      permissions: access.permissions,
      accessScope: "organization"
    }, organizationSeatUsage([...memberships, ...projectMemberships], invitations)),
    members,
    projectMembers,
    invitations: access.permissions.includes(organizationPermissions.memberManage)
      ? invitations.map(organizationInvitationForClient)
      : []
  });
}

async function handleOrganizationMemberInvite(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access) {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  if (!access.permissions.includes(organizationPermissions.memberInvite)) {
    sendJSON(response, 403, {
      error: "Only a firm Owner can invite members.",
      code: "ORGANIZATION_OWNER_REQUIRED"
    });
    return;
  }
  const projectID = String(context.body.projectID || "").trim() || null;
  if (projectID) {
    const ownership = await storedProjectOwnership(projectID);
    if (
      ownership?.owner?.kind !== "organization" ||
      ownership.owner.organizationID !== organizationID
    ) {
      sendError(response, 404, "Organization Project not found.");
      return;
    }
  }
  try {
    const credentials = invitationToken();
    const now = new Date().toISOString();
    const invitation = organizationInvitationRecord({
      organizationID,
      projectID,
      invitedEmail: context.body.email,
      invitedUserID: context.body.userID,
      role: context.body.role || "viewer",
      tokenHash: credentials.tokenHash,
      invitedByUserID: context.userID,
      createdAt: now
    });
    const reservation = await reserveStoredOrganizationInvitation(
      invitation,
      access.organization.billingIdentity.seatLimit
    );
    if (reservation.outcome === "duplicate") {
      sendJSON(response, 409, {
        error: "An active invitation already exists for this person and scope.",
        code: "ORGANIZATION_INVITATION_EXISTS"
      });
      return;
    }
    if (reservation.outcome === "seat_limit") {
      sendJSON(response, 409, {
        error: "This firm workspace has no available seats.",
        code: "ORGANIZATION_SEAT_LIMIT",
        seats: reservation.seats
      });
      return;
    }
    if (reservation.outcome !== "created") {
      sendJSON(response, 409, {
        error: "The firm invitation could not be reserved. Try again.",
        code: "ORGANIZATION_INVITATION_CONFLICT"
      });
      return;
    }
    if (projectID) {
      const ownership = await storedProjectOwnership(projectID);
      await saveStoredActivityEvent(ownership.storageOwnerUserID, activityEvent({
        owner: organizationOwnerScope(organizationID),
        projectID,
        actorUserID: context.userID,
        action: "member.invited",
        objectKind: "organizationInvitation",
        objectID: invitation.id,
        newStatus: "pending",
        createdAt: now,
        metadata: {
          role: invitation.role,
          invitedUserID: invitation.invitedUserID
        }
      }));
    }
    sendJSON(response, 201, {
      invitation: organizationInvitationForClient(invitation),
      invitationToken: credentials.token,
      acceptPath: `/?organizationInvite=${encodeURIComponent(credentials.token)}`
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid firm invitation.",
      code: "INVALID_ORGANIZATION_INVITATION"
    });
  }
}

async function handleOrganizationInvitationAccept(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const token = String(context.body.invitationToken || "").trim();
  if (!token) {
    sendError(response, 400, "Missing invitation token.");
    return;
  }
  const invitation = await storedOrganizationInvitationByToken(token);
  if (!invitation) {
    sendError(response, 404, "Firm invitation not found.");
    return;
  }
  const state = invitationState(invitation);
  if (state !== "pending") {
    sendJSON(response, 409, {
      error: state === "expired"
        ? "This firm invitation has expired."
        : "This firm invitation is no longer available.",
      code: state === "expired"
        ? "ORGANIZATION_INVITATION_EXPIRED"
        : "ORGANIZATION_INVITATION_UNAVAILABLE"
    });
    return;
  }
  if (invitation.invitedUserID && invitation.invitedUserID !== context.userID) {
    sendJSON(response, 403, {
      error: "This invitation belongs to a different Permitext account.",
      code: "ORGANIZATION_INVITATION_ACCOUNT_MISMATCH"
    });
    return;
  }
  const accountEmailValue = accountEmail(context.authContext.account);
  if (
    invitation.invitedEmail &&
    invitation.invitedEmail !== accountEmailValue
  ) {
    sendJSON(response, 403, {
      error: "Sign in with the email address that received this invitation.",
      code: "ORGANIZATION_INVITATION_EMAIL_MISMATCH"
    });
    return;
  }
  const organization = await storedOrganization(invitation.organizationID);
  if (!organization || organization.status !== "active") {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  const [existingOrganizationMembership, existingProjectMembership] = await Promise.all([
    storedOrganizationMembership(invitation.organizationID, context.userID),
    invitation.projectID
      ? storedProjectMembership(invitation.projectID, context.userID)
      : Promise.resolve(null)
  ]);
  const now = new Date().toISOString();
  let membership;
  if (invitation.projectID) {
    const ownership = await storedProjectOwnership(invitation.projectID);
    if (
      ownership?.owner?.kind !== "organization" ||
      ownership.owner.organizationID !== invitation.organizationID
    ) {
      sendError(response, 404, "Organization Project not found.");
      return;
    }
    membership = projectMembershipRecord({
      organizationID: invitation.organizationID,
      projectID: invitation.projectID,
      userID: context.userID,
      role: invitation.role,
      invitedByUserID: invitation.invitedByUserID,
      invitationID: invitation.id,
      createdAt: existingProjectMembership?.createdAt || now,
      updatedAt: now
    });
  } else {
    membership = organizationMembershipRecord({
      organizationID: invitation.organizationID,
      userID: context.userID,
      role: invitation.role,
      invitedByUserID: invitation.invitedByUserID,
      invitationID: invitation.id,
      createdAt: existingOrganizationMembership?.createdAt || now,
      updatedAt: now
    });
  }
  const acceptedInvitation = organizationInvitationRecord({
    ...invitation,
    status: "accepted",
    updatedAt: now,
    acceptedAt: now,
    acceptedByUserID: context.userID
  });
  const acceptance = await acceptStoredOrganizationInvitation(
    acceptedInvitation,
    membership,
    organization.billingIdentity.seatLimit
  );
  if (acceptance.outcome === "seat_limit") {
    sendJSON(response, 409, {
      error: "This firm workspace has no available seats.",
      code: "ORGANIZATION_SEAT_LIMIT",
      seats: await organizationSeatState(invitation.organizationID)
    });
    return;
  }
  if (acceptance.outcome !== "accepted") {
    sendJSON(response, 409, {
      error: "This firm invitation is no longer available.",
      code: "ORGANIZATION_INVITATION_UNAVAILABLE"
    });
    return;
  }
  sendJSON(response, 200, {
    organization: organizationForClient(organization, {
      role: invitation.role,
      permissions: rolePermissions(invitation.role),
      accessScope: invitation.projectID ? "project" : "organization"
    }, await organizationSeatState(invitation.organizationID)),
    invitation: organizationInvitationForClient(acceptance.invitation)
  });
}

async function handleOrganizationInvitationRevoke(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access || !access.permissions.includes(organizationPermissions.memberManage)) {
    sendError(response, access ? 403 : 404, access
      ? "Only a firm Owner can revoke invitations."
      : "Firm workspace not found.");
    return;
  }
  const invitationID = String(context.body.invitationID || "").trim();
  const invitation = (await listStoredOrganizationInvitations(organizationID))
    .find((candidate) => candidate.id === invitationID);
  if (!invitation) {
    sendError(response, 404, "Firm invitation not found.");
    return;
  }
  if (invitationState(invitation) !== "pending") {
    sendJSON(response, 409, {
      error: "This firm invitation is no longer available.",
      code: "ORGANIZATION_INVITATION_UNAVAILABLE"
    });
    return;
  }
  const now = new Date().toISOString();
  const revoked = organizationInvitationRecord({
    ...invitation,
    status: "revoked",
    updatedAt: now
  });
  const savedInvitation = await updateStoredPendingOrganizationInvitation(revoked);
  if (!savedInvitation) {
    sendJSON(response, 409, {
      error: "This firm invitation is no longer available.",
      code: "ORGANIZATION_INVITATION_UNAVAILABLE"
    });
    return;
  }
  sendJSON(response, 200, {
    invitation: organizationInvitationForClient(savedInvitation)
  });
}

async function handleOrganizationMemberUpdate(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access || !access.permissions.includes(organizationPermissions.memberManage)) {
    sendError(response, access ? 403 : 404, access
      ? "Only a firm Owner can manage members."
      : "Firm workspace not found.");
    return;
  }
  const targetUserID = String(context.body.userID || "").trim();
  const projectID = String(context.body.projectID || "").trim() || null;
  if (!targetUserID) {
    sendError(response, 400, "Missing member user ID.");
    return;
  }
  if (targetUserID === access.organization.ownerUserID) {
    sendJSON(response, 409, {
      error: "Transfer firm ownership before changing the Owner account.",
      code: "ORGANIZATION_OWNER_PROTECTED"
    });
    return;
  }
  const current = projectID
    ? await storedProjectMembership(projectID, targetUserID)
    : await storedOrganizationMembership(organizationID, targetUserID);
  if (!current || current.organizationID !== organizationID) {
    sendError(response, 404, "Firm member not found.");
    return;
  }
  const status = String(context.body.status || current.status).trim().toLowerCase();
  const role = String(context.body.role || current.role).trim().toLowerCase();
  if (role === "owner") {
    sendJSON(response, 409, {
      error: "Use a dedicated ownership-transfer workflow to assign a new Owner.",
      code: "ORGANIZATION_OWNER_TRANSFER_REQUIRED"
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const updated = projectID
      ? projectMembershipRecord({
          ...current,
          role,
          status,
          createdAt: current.createdAt,
          updatedAt: now,
          deactivatedAt: status === "deactivated" ? now : null
        })
      : organizationMembershipRecord({
          ...current,
          role,
          status,
          createdAt: current.createdAt,
          updatedAt: now,
          deactivatedAt: status === "deactivated" ? now : null
        });
    if (status === "active" && current.status !== "active") {
      const activation = await saveStoredMembershipWithinSeatLimit(
        updated,
        access.organization.billingIdentity.seatLimit
      );
      if (activation.outcome !== "saved") {
        sendJSON(response, 409, {
          error: "This firm workspace has no available seats.",
          code: "ORGANIZATION_SEAT_LIMIT",
          seats: await organizationSeatState(organizationID)
        });
        return;
      }
    } else if (projectID) {
      await saveStoredProjectMembership(updated);
    } else {
      await saveStoredOrganizationMembership(updated);
    }
    if (projectID) {
      const ownership = await storedProjectOwnership(projectID);
      await saveStoredActivityEvent(ownership.storageOwnerUserID, activityEvent({
        owner: organizationOwnerScope(organizationID),
        projectID,
        actorUserID: context.userID,
        action: "permission.changed",
        objectKind: "projectMembership",
        objectID: updated.id,
        previousStatus: `${current.role}:${current.status}`,
        newStatus: `${updated.role}:${updated.status}`,
        createdAt: now
      }));
    }
    sendJSON(response, 200, {
      membership: await organizationMemberForClient(updated),
      seats: await organizationSeatState(organizationID)
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid member update.",
      code: "INVALID_ORGANIZATION_MEMBERSHIP"
    });
  }
}

async function handleOrganizationProjectTransfer(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  if (!hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Transferring a Project to a firm workspace requires Pro.",
      code: "PRO_REQUIRED_ORGANIZATION"
    });
    return;
  }
  const organizationID = String(context.body.organizationID || "").trim();
  const access = await organizationAccessForUser(context.userID, organizationID);
  if (!access || !access.permissions.includes(organizationPermissions.projectTransfer)) {
    sendError(response, access ? 403 : 404, access
      ? "Only a firm Owner can transfer Projects."
      : "Firm workspace not found.");
    return;
  }
  const requestedProjectID = String(context.body.projectID || "").trim();
  const project = await ownedProjectRecord(context.userID, requestedProjectID);
  if (!project) {
    sendError(response, 404, "Personal Project not found.");
    return;
  }
  const projectID = projectIdentityForRecord(project, context.userID) || requestedProjectID;
  const existingOwnership = await storedProjectOwnership(projectID);
  if (existingOwnership?.owner?.kind === "organization") {
    sendJSON(response, 409, {
      error: "This Project already belongs to a firm workspace.",
      code: "PROJECT_ALREADY_TRANSFERRED"
    });
    return;
  }
  if (
    existingOwnership &&
    (
      existingOwnership.owner?.kind !== "user" ||
      existingOwnership.owner?.id !== context.userID
    )
  ) {
    sendJSON(response, 409, {
      error: "This Project identity already belongs to another account.",
      code: "PROJECT_OWNERSHIP_CONFLICT"
    });
    return;
  }
  const now = new Date().toISOString();
  const ownership = projectOwnershipRecord({
    projectID,
    owner: organizationOwnerScope(organizationID),
    storageOwnerUserID: context.userID,
    originalOwnerUserID: existingOwnership?.originalOwnerUserID || context.userID,
    transferredByUserID: context.userID,
    createdAt: existingOwnership?.createdAt || now,
    updatedAt: now
  });
  const projectMembership = projectMembershipRecord({
    organizationID,
    projectID,
    userID: context.userID,
    role: "owner",
    createdAt: now
  });
  await saveStoredProjectOwnership(ownership);
  await saveStoredProjectMembership(projectMembership);
  await saveStoredActivityEvent(context.userID, activityEvent({
    owner: organizationOwnerScope(organizationID),
    projectID,
    actorUserID: context.userID,
    action: "project.transferred",
    objectKind: "project",
    objectID: project.id,
    previousStatus: "personal",
    newStatus: "organization",
    createdAt: now,
    metadata: {
      organizationID,
      originalOwnerUserID: context.userID
    }
  }));
  sendJSON(response, 200, {
    ownership,
    project: {
      id: projectID,
      sourceRecordID: project.id,
      name: project.name || "Untitled Project",
      address: project.address || "",
      description: project.description || "",
      colorHex: project.colorHex || null,
      archivedAt: project.archivedAt || null,
      updatedAt: project.updatedAt
    }
  });
}

async function handleOrganizationProjectList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const organizationID = String(context.body.organizationID || "").trim();
  const organization = await storedOrganization(organizationID);
  if (!organization || organization.status !== "active") {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  const projects = await accessibleOrganizationProjects(context.userID, organizationID);
  const organizationAccess = await organizationAccessForUser(context.userID, organizationID);
  if (!organizationAccess && !projects.length) {
    sendError(response, 404, "Firm workspace not found.");
    return;
  }
  sendJSON(response, 200, {
    organization: organizationForClient(organization, organizationAccess ? {
      role: organizationAccess.role,
      permissions: organizationAccess.permissions,
      accessScope: "organization",
      visibleProjectIDs: projects.map((project) => project.id)
    } : {
      role: projects[0]?.role || "viewer",
      permissions: projects[0]?.permissions || [],
      accessScope: "project",
      visibleProjectIDs: projects.map((project) => project.id)
    }),
    projects
  });
}

async function handleOrganizationProjectSnapshot(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;
  const state = await projectFoundationStateForStorageOwner(
    access.storageOwnerUserID,
    access.projectID,
    { includeAllProjects: false }
  );
  if (!state) {
    sendError(response, 404, "Project not found.");
    return;
  }
  sendJSON(response, 200, {
    access: {
      role: access.role,
      permissions: access.permissions,
      readOnly: !access.permissions.includes(organizationPermissions.projectEdit),
      organization: access.organization
          ? organizationForClient(access.organization, {
            role: access.role,
            permissions: access.permissions,
            accessScope: access.membership?.projectID ? "project" : "organization",
            visibleProjectIDs: [access.projectID]
          })
        : null
    },
    project: state
  });
}

function evidenceReviewForClient(artifact) {
  return {
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    createdAt: artifact.envelope.createdAt,
    updatedAt: artifact.envelope.updatedAt,
    deletedAt: artifact.envelope.deletedAt,
    ...artifact.payload
  };
}

async function projectEvidenceReviewArtifacts(storageOwnerUserID, projectID) {
  const reviewIDs = new Set(
    (await listStoredProjectLinks(storageOwnerUserID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "evidenceReview"
      )
      .map((link) => link.targetID)
  );
  return (await listStoredFoundationArtifacts(storageOwnerUserID))
    .filter((artifact) =>
      artifact.envelope?.type === "evidenceReview" &&
      !artifact.envelope?.deletedAt &&
      reviewIDs.has(artifact.envelope.id)
    )
    .sort((left, right) =>
      String(right.envelope.updatedAt || "").localeCompare(
        String(left.envelope.updatedAt || "")
      )
    );
}

async function handleOrganizationEvidenceReviewList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;
  const reviews = await projectEvidenceReviewArtifacts(
    access.storageOwnerUserID,
    projectID
  );
  sendJSON(response, 200, {
    projectID,
    access: {
      role: access.role,
      canPropose: access.permissions.includes(organizationPermissions.evidencePropose),
      canReview: access.permissions.includes(organizationPermissions.evidenceReview)
    },
    reviews: reviews.map(evidenceReviewForClient)
  });
}

async function handleOrganizationEvidenceReviewSave(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const status = String(context.body.status || "proposed").trim().toLowerCase();
  const requiredPermission = status === "proposed"
    ? organizationPermissions.evidencePropose
    : organizationPermissions.evidenceReview;
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    requiredPermission
  );
  if (!access) return;
  const answerID = String(context.body.answerID || "").trim();
  const answer = (await listStoredResearchAnswers(access.storageOwnerUserID))
    .find((candidate) =>
      candidate.id === answerID &&
      candidate.projectID === projectID
    );
  if (!answer) {
    sendError(response, 404, "Project Research answer not found.");
    return;
  }
  const existingReviews = await projectEvidenceReviewArtifacts(
    access.storageOwnerUserID,
    projectID
  );
  const requestedReviewID = String(context.body.reviewID || "").trim();
  const existing = requestedReviewID
    ? existingReviews.find((candidate) => candidate.envelope.id === requestedReviewID)
    : existingReviews.find((candidate) => candidate.payload.answerID === answerID);
  if (requestedReviewID && !existing) {
    sendError(response, 404, "Evidence review not found.");
    return;
  }
  if (existing && existing.payload.answerID !== answerID) {
    sendJSON(response, 409, {
      error: "This evidence review belongs to a different Research answer.",
      code: "EVIDENCE_REVIEW_ANSWER_MISMATCH"
    });
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion ?? 0);
  if (
    existing &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existing.envelope.version)
  ) {
    sendJSON(response, 409, {
      error: "This evidence review changed after you opened it. Review the current version before saving.",
      code: "EVIDENCE_REVIEW_VERSION_CONFLICT",
      review: evidenceReviewForClient(existing)
    });
    return;
  }
  const availableEvidenceIDs = new Set(
    (answer.evidence || []).map((snapshot) => snapshot.id)
  );
  const evidenceSnapshotIDs = Array.isArray(context.body.evidenceSnapshotIDs)
    ? context.body.evidenceSnapshotIDs.map((value) => String(value || "").trim())
    : Array.from(availableEvidenceIDs);
  if (evidenceSnapshotIDs.some((snapshotID) => !availableEvidenceIDs.has(snapshotID))) {
    sendJSON(response, 400, {
      error: "The review can only reference immutable evidence stored with this answer.",
      code: "INVALID_EVIDENCE_REVIEW_SNAPSHOT"
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const payload = evidenceReviewPayload({
      projectID,
      answerID,
      evidenceSnapshotIDs,
      status,
      note: context.body.note,
      createdByUserID: existing?.payload.createdByUserID || context.userID,
      updatedByUserID: context.userID,
      reviewedByUserID: status === "proposed"
        ? existing?.payload.reviewedByUserID
        : context.userID,
      reviewedAt: status === "proposed"
        ? existing?.payload.reviewedAt
        : now
    });
    const reviewID = existing?.envelope.id || randomUUID();
    const artifact = {
      envelope: artifactEnvelope({
        id: reviewID,
        type: "evidenceReview",
        owner: access.owner,
        createdAt: existing?.envelope.createdAt || now,
        updatedAt: now,
        archivedAt: existing?.envelope.archivedAt || null,
        version: Number(existing?.envelope.version || 0) + 1
      }),
      payload
    };
    await saveStoredFoundationArtifact(access.storageOwnerUserID, artifact);
    if (!existing) {
      await saveStoredProjectLink(access.storageOwnerUserID, projectLinkRecord({
        id: deterministicFoundationLinkID(
          access.storageOwnerUserID,
          projectID,
          "evidenceReview",
          reviewID
        ),
        owner: access.owner,
        projectID,
        targetKind: "evidenceReview",
        targetID: reviewID,
        relationship: "reference",
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { answerID }
      }));
    }
    const event = activityEvent({
      owner: access.owner,
      projectID,
      actorUserID: context.userID,
      action: "review-status.changed",
      objectKind: "evidenceReview",
      objectID: reviewID,
      previousStatus: existing?.payload.status || null,
      newStatus: payload.status,
      createdAt: now,
      metadata: {
        answerID,
        evidenceSnapshotCount: payload.evidenceSnapshotIDs.length
      }
    });
    await saveStoredActivityEvent(access.storageOwnerUserID, event);
    sendJSON(response, existing ? 200 : 201, {
      review: evidenceReviewForClient(artifact),
      activity: event
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid evidence review.",
      code: "INVALID_EVIDENCE_REVIEW"
    });
  }
}

function collaborationArtifactForClient(artifact) {
  return {
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    createdAt: artifact.envelope.createdAt,
    updatedAt: artifact.envelope.updatedAt,
    deletedAt: artifact.envelope.deletedAt,
    ...artifact.payload
  };
}

function collaborationActorDisplayName(context) {
  return String(
    context.authContext.account?.displayName ||
    context.authContext.account?.publicUsername ||
    "Permitext professional"
  ).trim();
}

async function collaborationProjectAccess(context, response, permission) {
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    permission
  );
  if (!access) return null;
  if (!access.organization && !hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Project collaboration requires Pro.",
      code: "PRO_REQUIRED_COLLABORATION"
    });
    return null;
  }
  return access;
}

function reviewTargetSnapshot({ label, description = "", updatedAt = null }) {
  return {
    label: String(label || "Linked Project item").trim().slice(0, 240),
    description: String(description || "").trim().slice(0, 2_000),
    updatedAt: Number.isFinite(Date.parse(updatedAt || "")) ? updatedAt : null
  };
}

async function reviewTargetInProject(storageOwnerUserID, projectID, targetKind, targetID, questionID = null) {
  const normalizedTargetID = String(targetID || "").trim();
  if (targetKind === "project") {
    if (normalizedTargetID !== projectID) return null;
    const project = await ownedProjectRecord(storageOwnerUserID, projectID);
    return project ? {
      target: project,
      snapshot: reviewTargetSnapshot({
        label: project.name || "Project information",
        description: [project.address, project.description].filter(Boolean).join(" — "),
        updatedAt: project.updatedAt
      })
    } : null;
  }
  if (targetKind === "researchAnswer") {
    const answerLink = (await listStoredProjectLinks(storageOwnerUserID, {
      projectID,
      targetKind: "researchAnswer"
    })).find((link) => !link.deletedAt && link.targetID === normalizedTargetID);
    const answer = (await listStoredResearchAnswers(storageOwnerUserID)).find((candidate) =>
      candidate.id === normalizedTargetID &&
      (candidate.projectID === projectID || Boolean(answerLink))
    );
    return answer ? {
      target: answer,
      snapshot: reviewTargetSnapshot({
        label: answer.question || "Research answer",
        description: answer.answer?.conclusion || "",
        updatedAt: answer.createdAt
      })
    } : null;
  }
  const artifactTypeByTargetKind = {
    evidenceReview: "evidenceReview",
    reportDraft: "reportDraft",
    notebookCard: "notebookCard",
    codeQuestion: "codeQuestion",
    questionInput: "questionInput",
    questionEvidenceSet: "questionEvidenceSet",
    questionAnalysis: "questionAnalysis",
    professionalConclusion: "professionalConclusion"
  };
  const artifactType = artifactTypeByTargetKind[targetKind];
  if (!artifactType) return null;
  const artifact = await linkedProjectArtifact(
    storageOwnerUserID,
    projectID,
    targetKind,
    artifactType,
    normalizedTargetID
  );
  if (!artifact) return null;
  const codeQuestionTarget = [
    "codeQuestion", "questionInput", "questionEvidenceSet", "questionAnalysis", "professionalConclusion"
  ].includes(targetKind);
  if (codeQuestionTarget) {
    const artifactQuestionID = targetKind === "codeQuestion"
      ? artifact.envelope?.id
      : artifact.payload?.questionID;
    if (!questionID || artifactQuestionID !== questionID) return null;
  }
  const fallbackLabelByTargetKind = {
    evidenceReview: "Evidence review",
    reportDraft: "Report",
    notebookCard: "Notebook card",
    codeQuestion: "Code Question",
    questionInput: "Question Input",
    questionEvidenceSet: "Approved Evidence Set",
    questionAnalysis: "Bounded Analysis",
    professionalConclusion: "Professional Conclusion"
  };
  return {
    target: artifact,
    snapshot: reviewTargetSnapshot({
      label: artifact.payload?.title || fallbackLabelByTargetKind[targetKind],
      description: artifact.payload?.note || artifact.payload?.plainText ||
        artifact.payload?.introduction || "",
      updatedAt: artifact.envelope?.updatedAt
    })
  };
}

async function handleProjectCollaborationNoteSave(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await collaborationProjectAccess(
    context,
    response,
    organizationPermissions.projectNoteEdit
  );
  if (!access) return;
  const requestedNoteID = String(context.body.noteID || "").trim();
  const linkedNoteIDs = new Set(
    (await listStoredProjectLinks(access.storageOwnerUserID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "projectNote"
      )
      .map((link) => link.targetID)
  );
  const projectNotes = (await listStoredFoundationArtifacts(access.storageOwnerUserID))
    .filter((artifact) =>
      artifact.envelope?.type === "projectNote" &&
      !artifact.envelope?.deletedAt &&
      linkedNoteIDs.has(artifact.envelope.id)
    )
    .sort((left, right) =>
      String(right.envelope.updatedAt || right.envelope.createdAt || "").localeCompare(
        String(left.envelope.updatedAt || left.envelope.createdAt || "")
      )
    );
  const existing = requestedNoteID
    ? projectNotes.find((artifact) => artifact.envelope.id === requestedNoteID) || null
    : projectNotes[0] || null;
  if (requestedNoteID && !existing) {
    sendError(response, 404, "Project note not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion ?? 0);
  if (
    existing &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existing.envelope.version)
  ) {
    sendJSON(response, 409, {
      error: "This Project note changed after you opened it. Review the current version before saving.",
      code: "PROJECT_NOTE_VERSION_CONFLICT",
      note: collaborationArtifactForClient(existing)
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const noteID = existing?.envelope.id || randomUUID();
    const payload = normalizeProjectNotePayload({
      projectID,
      title: context.body.title || "Project information",
      body: context.body.body,
      document: context.body.document,
      createdByUserID: existing?.payload.createdByUserID || context.userID,
      updatedByUserID: context.userID,
      createdByDisplayName: existing?.payload.createdByDisplayName ||
        collaborationActorDisplayName(context),
      updatedByDisplayName: collaborationActorDisplayName(context)
    });
    await validateNotebookImageAssets(
      access.storageOwnerUserID,
      projectID,
      payload.imageAssets || []
    );
    const artifact = {
      envelope: artifactEnvelope({
        id: noteID,
        type: "projectNote",
        owner: access.owner,
        createdAt: existing?.envelope.createdAt || now,
        updatedAt: now,
        version: Number(existing?.envelope.version || 0) + 1
      }),
      payload
    };
    await saveStoredFoundationArtifact(access.storageOwnerUserID, artifact);
    let link = null;
    if (!existing) {
      link = projectLinkRecord({
        id: deterministicFoundationLinkID(
          access.storageOwnerUserID,
          projectID,
          "projectNote",
          noteID
        ),
        owner: access.owner,
        projectID,
        targetKind: "projectNote",
        targetID: noteID,
        relationship: "owner",
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { createdWith: "permitext-project-studio" }
      });
      await saveStoredProjectLink(access.storageOwnerUserID, link);
    }
    const event = activityEvent({
      owner: access.owner,
      projectID,
      actorUserID: context.userID,
      action: existing ? "project-note.revision.saved" : "project-note.created",
      objectKind: "projectNote",
      objectID: noteID,
      previousStatus: existing ? `version-${existing.envelope.version}` : null,
      newStatus: `version-${artifact.envelope.version}`,
      createdAt: now
    });
    await saveStoredActivityEvent(access.storageOwnerUserID, event);
    const removedImageAssets = (existing?.payload?.imageAssets || [])
      .filter((assetID) => !(payload.imageAssets || []).includes(assetID));
    await deleteOrphanedNotebookImageAssets(
      access.storageOwnerUserID,
      projectID,
      removedImageAssets
    );
    sendJSON(response, existing ? 200 : 201, {
      note: collaborationArtifactForClient(artifact),
      link,
      activity: event
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid Project note.",
      code: "INVALID_PROJECT_NOTE"
    });
  }
}

async function handleProjectCollaborationThreadSave(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const viewAccess = await collaborationProjectAccess(
    context,
    response,
    organizationPermissions.projectView
  );
  if (!viewAccess) return;
  const requestedThreadID = String(context.body.threadID || "").trim();
  const existing = requestedThreadID
    ? await linkedProjectArtifact(
        viewAccess.storageOwnerUserID,
        projectID,
        "reviewThread",
        "reviewThread",
        requestedThreadID
      )
    : null;
  if (requestedThreadID && !existing) {
    sendError(response, 404, "Project review thread not found.");
    return;
  }
  const requestedStatus = String(context.body.status || existing?.payload.status || "open")
    .trim()
    .toLowerCase();
  if (!existing && requestedStatus !== "open") {
    sendJSON(response, 400, {
      error: "New review threads must start open.",
      code: "INVALID_REVIEW_THREAD_STATUS"
    });
    return;
  }
  const statusChanged = Boolean(existing && requestedStatus !== existing.payload.status);
  const requestedAssigneeUserID = context.body.assigneeUserID === undefined
    ? existing?.payload.assigneeUserID || null
    : String(context.body.assigneeUserID || "").trim() || null;
  const assigneeChanged = Boolean(
    existing && requestedAssigneeUserID !== (existing.payload.assigneeUserID || null)
  );
  const requestedRequestType = context.body.requestType || existing?.payload.requestType || null;
  const requestedKind = context.body.kind || existing?.payload.kind ||
    (requestedRequestType ? reviewRequestTypeToKind(requestedRequestType) : "general-review");
  const requestedQuestionID = String(
    context.body.questionID || existing?.payload.questionID || ""
  ).trim() || null;
  const requestedBlocking = context.body.blocking === undefined
    ? existing?.payload.blocking === true
    : context.body.blocking === true;
  const requestedTargetAnchor = context.body.targetAnchor === undefined
    ? existing?.payload.targetAnchor || null
    : context.body.targetAnchor;
  const requestedTitle = context.body.title || existing?.payload.title;
  const requestedBody = context.body.body ?? existing?.payload.body;
  const requestedResolution = requestedStatus === "resolved"
    ? context.body.resolution ?? existing?.payload.resolution
    : null;
  const resolutionChanged = Boolean(
    existing && requestedStatus === "resolved" && existing.payload.status === "resolved" &&
    String(requestedResolution || "").trim() !== String(existing.payload.resolution || "").trim()
  );
  const preserveLegacyResolvedWithoutResolution = Boolean(
    existing &&
    Number(existing.payload.schemaVersion || 1) < collaborationSchemaVersion &&
    existing.payload.status === "resolved" &&
    requestedStatus === "resolved" &&
    !requestedResolution
  );
  const contentChanged = Boolean(existing && (
    String(requestedKind || "").trim() !== String(existing.payload.kind || "").trim() ||
    String(requestedTitle || "").trim() !== String(existing.payload.title || "").trim() ||
    String(requestedBody || "").trim() !== String(existing.payload.body || "").trim()
    || String(requestedRequestType || "") !== String(existing.payload.requestType || "")
    || requestedBlocking !== (existing.payload.blocking === true)
  ));
  const requiredPermission = statusChanged || resolutionChanged
    ? organizationPermissions.projectReviewResolve
    : assigneeChanged && !contentChanged
      ? organizationPermissions.projectReviewComment
      : organizationPermissions.projectReviewRequest;
  if (!viewAccess.permissions.includes(requiredPermission)) {
    sendJSON(response, 403, {
      error: "Your Project role does not allow this action.",
      code: "PROJECT_PERMISSION_REQUIRED",
      requiredPermission
    });
    return;
  }
  if (requestedQuestionID && (
    !codeQuestionEnabledForRequest(request, context.body, context.userID) ||
    !viewAccess.permissions.includes(organizationPermissions.codeQuestionReview)
  )) {
    sendJSON(response, 403, {
      error: "Your Project role does not allow Code Question review.",
      code: "CODE_QUESTION_PERMISSION_DENIED",
      requiredPermission: organizationPermissions.codeQuestionReview
    });
    return;
  }
  if (existing?.payload.questionID && requestedQuestionID !== existing.payload.questionID) {
    sendJSON(response, 409, {
      error: "A Review Request cannot be moved to a different Code Question.",
      code: "REVIEW_QUESTION_IMMUTABLE"
    });
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion ?? 0);
  if (
    existing &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existing.envelope.version)
  ) {
    sendJSON(response, 409, {
      error: "This review thread changed after you opened it. Review the current version before saving.",
      code: "REVIEW_THREAD_VERSION_CONFLICT",
      thread: collaborationArtifactForClient(existing)
    });
    return;
  }
  const targetKind = String(
    context.body.targetKind || existing?.payload.targetKind || "project"
  ).trim();
  const targetID = String(
    context.body.targetID || existing?.payload.targetID || projectID
  ).trim();
  if (
    existing &&
    (targetKind !== existing.payload.targetKind || targetID !== existing.payload.targetID)
  ) {
    sendJSON(response, 409, {
      error: "A review thread cannot be moved to a different Project item.",
      code: "REVIEW_THREAD_TARGET_IMMUTABLE"
    });
    return;
  }
  const creationTarget = existing ? null : await reviewTargetInProject(
    viewAccess.storageOwnerUserID,
    projectID,
    targetKind,
    targetID,
    requestedQuestionID
  );
  if (!existing && !creationTarget) {
    sendError(response, 404, "Review target not found in this Project.");
    return;
  }
  const linkedItemSnapshot = existing?.payload.linkedItemSnapshot ||
    creationTarget?.snapshot || null;
  if (requestedAssigneeUserID && (!existing || assigneeChanged)) {
    const assigneeAccess = await projectAccessForUser(requestedAssigneeUserID, projectID);
    if (!assigneeAccess?.permissions.includes(organizationPermissions.projectView)) {
      sendJSON(response, 400, {
        error: "The coordination assignee must have active access to this Project.",
        code: "INVALID_REVIEW_ASSIGNEE"
      });
      return;
    }
  }
  try {
    const now = new Date().toISOString();
    const threadID = existing?.envelope.id || randomUUID();
    const payload = normalizeReviewThreadPayload({
      projectID,
      kind: requestedKind,
      requestType: requestedRequestType,
      status: requestedStatus,
      targetKind,
      targetID,
      linkedItemSnapshot,
      title: requestedTitle,
      body: requestedBody,
      createdByUserID: existing?.payload.createdByUserID || context.userID,
      updatedByUserID: context.userID,
      createdByDisplayName: existing?.payload.createdByDisplayName ||
        collaborationActorDisplayName(context),
      updatedByDisplayName: collaborationActorDisplayName(context),
      assigneeUserID: requestedAssigneeUserID,
      resolvedByUserID: requestedStatus !== "resolved" && requestedStatus !== "dismissed"
        ? null
        : statusChanged || resolutionChanged
          ? context.userID
          : existing?.payload.resolvedByUserID,
      resolvedByDisplayName: requestedStatus !== "resolved" && requestedStatus !== "dismissed"
        ? ""
        : statusChanged || resolutionChanged
          ? collaborationActorDisplayName(context)
          : existing?.payload.resolvedByDisplayName,
      resolvedAt: requestedStatus !== "resolved" && requestedStatus !== "dismissed"
        ? null
        : statusChanged || resolutionChanged
          ? now
          : existing?.payload.resolvedAt,
      resolution: requestedStatus === "resolved"
        ? requestedResolution
        : null,
      allowLegacyResolvedWithoutResolution: Boolean(
        preserveLegacyResolvedWithoutResolution
      ),
      questionID: requestedQuestionID,
      reviewRound: existing && ["resolved", "dismissed"].includes(existing.payload.status) && requestedStatus === "open"
        ? Number(existing.payload.reviewRound || 1) + 1
        : Number(existing?.payload.reviewRound || 1),
      blocking: requestedBlocking,
      targetAnchor: requestedTargetAnchor
    });
    if (preserveLegacyResolvedWithoutResolution) {
      payload.schemaVersion = Number(existing.payload.schemaVersion || 1);
    }
    const artifact = {
      envelope: artifactEnvelope({
        id: threadID,
        type: "reviewThread",
        owner: viewAccess.owner,
        createdAt: existing?.envelope.createdAt || now,
        updatedAt: now,
        version: Number(existing?.envelope.version || 0) + 1
      }),
      payload
    };
    await saveStoredFoundationArtifact(viewAccess.storageOwnerUserID, artifact);
    let link = null;
    if (!existing) {
      link = projectLinkRecord({
        id: deterministicFoundationLinkID(
          viewAccess.storageOwnerUserID,
          projectID,
          "reviewThread",
          threadID
        ),
        owner: viewAccess.owner,
        projectID,
        targetKind: "reviewThread",
        targetID: threadID,
        relationship: "owner",
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { targetKind, targetID }
      });
      await saveStoredProjectLink(viewAccess.storageOwnerUserID, link);
    }
    const sharedActivity = {
      owner: viewAccess.owner,
      projectID,
      actorUserID: context.userID,
      objectKind: "reviewThread",
      objectID: threadID,
      createdAt: now
    };
    const sharedMetadata = {
      threadID,
      kind: payload.kind,
      requestType: payload.requestType || null,
      questionID: payload.questionID || null,
      reviewRound: payload.reviewRound || 1,
      blocking: payload.blocking === true,
      targetAnchor: payload.targetAnchor || null,
      targetKind,
      targetID,
      assigneeUserID: payload.assigneeUserID,
      resolution: payload.resolution
    };
    const activities = [];
    if (!existing) {
      activities.push(activityEvent({
        ...sharedActivity,
        action: payload.questionID ? "code-question.review.opened" : "review-thread.created",
        previousStatus: null,
        newStatus: payload.status,
        metadata: sharedMetadata
      }));
    } else {
      if (statusChanged || resolutionChanged) {
        activities.push(activityEvent({
          ...sharedActivity,
          action: payload.questionID && ["resolved", "dismissed"].includes(payload.status)
            ? "code-question.review.resolved"
            : payload.questionID && ["resolved", "dismissed"].includes(existing.payload.status) && payload.status === "open"
              ? "code-question.review.reopened"
              : "review-thread.status.changed",
          previousStatus: existing.payload.status,
          newStatus: payload.status,
          metadata: {
            ...sharedMetadata,
            previousResolution: existing.payload.resolution || null
          }
        }));
      }
      if (assigneeChanged) {
        activities.push(activityEvent({
          ...sharedActivity,
          action: payload.questionID ? "code-question.review.assigned" : "review-thread.assignee.changed",
          previousStatus: existing.payload.status,
          newStatus: payload.status,
          metadata: {
            ...sharedMetadata,
            previousAssigneeUserID: existing.payload.assigneeUserID || null,
            newAssigneeUserID: payload.assigneeUserID
          }
        }));
      }
      if (contentChanged || (!statusChanged && !resolutionChanged && !assigneeChanged)) {
        activities.push(activityEvent({
          ...sharedActivity,
          action: "review-thread.revision.saved",
          previousStatus: existing.payload.status,
          newStatus: payload.status,
          metadata: {
            ...sharedMetadata,
            previousVersion: existing.envelope.version,
            newVersion: artifact.envelope.version
          }
        }));
      }
    }
    for (const activity of activities) {
      await saveStoredActivityEvent(viewAccess.storageOwnerUserID, activity);
    }
    sendJSON(response, existing ? 200 : 201, {
      thread: collaborationArtifactForClient(artifact),
      link,
      activity: activities[0],
      activities
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid review thread.",
      code: "INVALID_REVIEW_THREAD"
    });
  }
}

async function handleProjectCollaborationCommentSave(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await collaborationProjectAccess(
    context,
    response,
    organizationPermissions.projectReviewComment
  );
  if (!access) return;
  const threadID = String(context.body.threadID || "").trim();
  const thread = await linkedProjectArtifact(
    access.storageOwnerUserID,
    projectID,
    "reviewThread",
    "reviewThread",
    threadID
  );
  if (!thread) {
    sendError(response, 404, "Project review thread not found.");
    return;
  }
  if (thread.payload.status === "resolved" || thread.payload.status === "dismissed") {
    sendJSON(response, 409, {
      error: "Resolved or dismissed review threads cannot receive new comments.",
      code: "REVIEW_THREAD_CLOSED",
      thread: collaborationArtifactForClient(thread)
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const commentID = randomUUID();
    const artifact = {
      envelope: artifactEnvelope({
        id: commentID,
        type: "reviewComment",
        owner: access.owner,
        createdAt: now,
        updatedAt: now,
        version: 1
      }),
      payload: normalizeReviewCommentPayload({
        projectID,
        threadID,
        body: context.body.body,
        createdByUserID: context.userID,
        createdByDisplayName: collaborationActorDisplayName(context),
        createdAt: now
      })
    };
    await saveStoredFoundationArtifact(access.storageOwnerUserID, artifact);
    const link = projectLinkRecord({
      id: deterministicFoundationLinkID(
        access.storageOwnerUserID,
        projectID,
        "reviewComment",
        commentID
      ),
      owner: access.owner,
      projectID,
      targetKind: "reviewComment",
      targetID: commentID,
      relationship: "reference",
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: { threadID }
    });
    await saveStoredProjectLink(access.storageOwnerUserID, link);
    const event = activityEvent({
      owner: access.owner,
      projectID,
      actorUserID: context.userID,
      action: "review-comment.created",
      objectKind: "reviewComment",
      objectID: commentID,
      previousStatus: null,
      newStatus: "created",
      createdAt: now,
      metadata: { threadID }
    });
    await saveStoredActivityEvent(access.storageOwnerUserID, event);
    sendJSON(response, 201, {
      comment: collaborationArtifactForClient(artifact),
      link,
      activity: event
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid review comment.",
      code: "INVALID_REVIEW_COMMENT"
    });
  }
}

async function handleProjectFoundationLink(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  if (!hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Project organization requires Pro.",
      code: "PRO_REQUIRED_PROJECTS"
    });
    return;
  }
  const projectID = String(context.body.projectID || "").trim();
  const targetKind = String(context.body.targetKind || "").trim();
  const targetID = String(context.body.targetID || "").trim();
  if (targetKind === "researchConversation") {
    sendJSON(response, 409, {
      error: "Use the Research Project-assignment workflow to move or link a Research conversation.",
      code: "RESEARCH_PROJECT_LIFECYCLE_REQUIRED"
    });
    return;
  }
  if (!await ownedProjectRecord(context.userID, projectID)) {
    sendError(response, 404, "Project not found.");
    return;
  }
  if (!await ownedProjectTargetExists(context.userID, targetKind, targetID)) {
    sendError(response, 404, "Project item not found.");
    return;
  }
  const links = await listStoredProjectLinks(context.userID);
  const rule = projectMembershipRules[targetKind];
  if (rule?.maximumProjects === 1 && links.some((link) =>
    !link.deletedAt &&
    link.targetKind === targetKind &&
    link.targetID === targetID &&
    link.projectID !== projectID
  )) {
    sendJSON(response, 409, {
      error: "This item already belongs to another Project. Move it with an explicit unlink and link action.",
      code: "PROJECT_MOVE_REQUIRED"
    });
    return;
  }
  const now = new Date().toISOString();
  const linkID = deterministicFoundationLinkID(context.userID, projectID, targetKind, targetID);
  const existing = links.find((link) => link.id === linkID);
  const metadata = context.body.metadata && typeof context.body.metadata === "object" &&
    !Array.isArray(context.body.metadata)
    ? { ...context.body.metadata }
    : {};
  if (targetKind === "researchConversation") {
    // Research ↔ Code Decision association is server-owned. Generic Project
    // membership must never manufacture or resurrect that governed relation.
    delete metadata.codeDecisionID;
    delete metadata.codeDecisionLinkedAt;
    delete metadata.codeDecisionLinkedByUserID;
    if (!existing?.deletedAt) {
      for (const key of [
        "codeDecisionID",
        "codeDecisionLinkedAt",
        "codeDecisionLinkedByUserID"
      ]) {
        if (existing?.metadata?.[key] != null) metadata[key] = existing.metadata[key];
      }
    }
  }
  const link = projectLinkRecord({
    id: linkID,
    owner: ownerScope(context.userID),
    projectID,
    targetKind,
    targetID,
    relationship: context.body.relationship || rule?.relationship || "reference",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: Number(existing?.version || 0) + 1,
    metadata
  });
  await saveStoredProjectLink(context.userID, link);
  if (targetKind === "researchConversation") {
    const conversation = await storedResearchConversation(context.userID, targetID);
    conversation.primaryProjectID = projectID;
    conversation.updatedAt = now;
    await saveStoredResearchConversation(context.userID, conversation);
  }
  const event = activityEvent({
    owner: ownerScope(context.userID),
    projectID,
    actorUserID: context.userID,
    action: "item.linked",
    objectKind: targetKind,
    objectID: targetID,
    previousStatus: existing?.deletedAt ? "unlinked" : null,
    newStatus: "linked",
    createdAt: now
  });
  await saveStoredActivityEvent(context.userID, event);
  const artifactRevisions = await bumpStoredArtifactRevisions(
    context.userID,
    projectArtifactRevisionChange(projectID, ["foundation", "activity"])
  );
  sendJSON(response, existing ? 200 : 201, { link, activity: event, artifactRevisions });
}

async function handleProjectFoundationUnlink(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const targetKind = String(context.body.targetKind || "").trim();
  const targetID = String(context.body.targetID || "").trim();
  if (targetKind === "researchConversation") {
    sendJSON(response, 409, {
      error: "Use the Research Project-assignment workflow to move or unlink a Research conversation.",
      code: "RESEARCH_PROJECT_LIFECYCLE_REQUIRED"
    });
    return;
  }
  const links = await listStoredProjectLinks(context.userID);
  const existing = links.find((link) =>
    !link.deletedAt &&
    link.projectID === projectID &&
    link.targetKind === targetKind &&
    link.targetID === targetID
  );
  if (!existing) {
    sendError(response, 404, "Active Project link not found.");
    return;
  }
  const now = new Date().toISOString();
  const link = projectLinkRecord({
    ...existing,
    owner: ownerScope(context.userID),
    updatedAt: now,
    deletedAt: now,
    version: Number(existing.version || 1) + 1
  });
  await saveStoredProjectLink(context.userID, link);
  if (targetKind === "researchConversation") {
    const conversation = await storedResearchConversation(context.userID, targetID);
    if (conversation?.primaryProjectID === projectID) {
      conversation.primaryProjectID = null;
      conversation.updatedAt = now;
      await saveStoredResearchConversation(context.userID, conversation);
    }
  }
  const event = activityEvent({
    owner: ownerScope(context.userID),
    projectID,
    actorUserID: context.userID,
    action: "item.unlinked",
    objectKind: targetKind,
    objectID: targetID,
    previousStatus: "linked",
    newStatus: "unlinked",
    createdAt: now
  });
  await saveStoredActivityEvent(context.userID, event);
  const artifactRevisions = await bumpStoredArtifactRevisions(
    context.userID,
    projectArtifactRevisionChange(projectID, ["foundation", "activity"])
  );
  sendJSON(response, 200, { link, activity: event, artifactRevisions });
}

function notebookCardForClient(artifact, projectIDs = []) {
  return {
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    createdAt: artifact.envelope.createdAt,
    updatedAt: artifact.envelope.updatedAt,
    archivedAt: artifact.envelope.archivedAt || null,
    deletedAt: artifact.envelope.deletedAt,
    projectIDs,
    ...artifact.payload
  };
}

async function authenticatedNotebookBody(request, response) {
  const context = await authenticatedResearchBody(request, response);
  return context;
}

async function notebookProjectAccess(context, response, permission) {
  const projectID = String(context.body.projectID || "").trim();
  if (!projectID) {
    sendError(response, 400, "Missing Notebook Project identity.");
    return null;
  }
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    permission
  );
  if (!access) return null;
  if (
    !access.organization &&
    !hasActiveProEntitlement(context.authContext.entitlement)
  ) {
    sendJSON(response, 403, {
      error: "The Project Notebook requires Pro.",
      code: "PRO_REQUIRED_NOTEBOOK"
    });
    return null;
  }
  return access;
}

async function ownedNotebookArtifact(userID, cardID, options = {}) {
  const normalizedCardID = String(cardID || "").trim();
  return (await listStoredFoundationArtifacts(userID, { ids: [normalizedCardID] })).find((artifact) =>
    artifact.envelope?.id === normalizedCardID &&
    artifact.envelope?.type === "notebookCard" &&
    (options.includeDeleted || !artifact.envelope?.deletedAt)
  ) || null;
}

async function ownedNotebookImageAsset(userID, assetID, options = {}) {
  const normalizedAssetID = String(assetID || "").trim();
  return (await listStoredFoundationArtifacts(userID)).find((artifact) =>
    artifact.envelope?.id === normalizedAssetID &&
    artifact.envelope?.type === "notebookImageAsset" &&
    (options.includeDeleted || !artifact.envelope?.deletedAt)
  ) || null;
}

async function notebookArtifactWithIdentity(userID, artifactID) {
  const normalizedID = String(artifactID || "").trim();
  return (await listStoredFoundationArtifacts(userID)).find(
    (artifact) => artifact.envelope?.id === normalizedID
  ) || null;
}

async function notebookImageAccessibleFromProject(userID, projectID, assetID) {
  const asset = await ownedNotebookImageAsset(userID, assetID);
  if (!asset) return false;
  if (asset.payload?.projectID === projectID) return true;
  const artifacts = await listStoredFoundationArtifacts(userID);
  const referencingCardIDs = new Set(artifacts
    .filter((artifact) =>
      artifact.envelope?.type === "notebookCard" &&
      !artifact.envelope?.deletedAt &&
      (artifact.payload?.imageAssets || []).includes(assetID)
    )
    .map((artifact) => artifact.envelope.id));
  if (!referencingCardIDs.size) return false;
  return (await listStoredProjectLinks(userID)).some((link) =>
    !link.deletedAt &&
    link.projectID === projectID &&
    link.targetKind === "notebookCard" &&
    referencingCardIDs.has(link.targetID)
  );
}

async function validateNotebookImageAssets(userID, projectID, imageAssets) {
  for (const encodedIdentity of imageAssets || []) {
    let identity = encodedIdentity;
    try { identity = decodeURIComponent(encodedIdentity); } catch { /* legacy literal */ }
    if (notebookAssetPathBelongsToProject(identity, projectID)) continue;
    const accessible = await notebookImageAccessibleFromProject(userID, projectID, identity);
    if (!accessible) {
      throw new Error("A Notebook image is unavailable or belongs to another Project.");
    }
  }
}

async function deleteOrphanedNotebookImageAssets(userID, projectID, candidateIDs) {
  const candidates = new Set(candidateIDs || []);
  if (!candidates.size) return;
  const artifacts = await listStoredFoundationArtifacts(userID);
  for (const artifact of artifacts) {
    if (!['notebookCard', 'projectNote'].includes(artifact.envelope?.type) || artifact.envelope?.deletedAt) continue;
    for (const identity of artifact.payload?.imageAssets || []) candidates.delete(identity);
  }
  const now = new Date().toISOString();
  for (const assetID of candidates) {
    const asset = await ownedNotebookImageAsset(userID, assetID);
    if (!asset) continue;
    const provider = notebookImageStorage(asset.payload?.storageProvider);
    try {
      if (!provider) throw new Error(`Storage provider ${asset.payload?.storageProvider || "unknown"} is not configured.`);
      await provider.delete(asset.payload.storageKey);
      await saveStoredFoundationArtifact(userID, {
        ...asset,
        envelope: artifactEnvelope({
          ...asset.envelope,
          updatedAt: now,
          deletedAt: now,
          version: asset.envelope.version + 1
        })
      });
    } catch (error) {
      await saveStoredFoundationArtifact(userID, {
        ...asset,
        envelope: artifactEnvelope({
          ...asset.envelope,
          updatedAt: now,
          version: asset.envelope.version + 1
        }),
        payload: {
          ...asset.payload,
          deletionPendingAt: asset.payload?.deletionPendingAt || now,
          deletionError: error instanceof Error ? error.message : "Image deletion failed."
        }
      });
    }
  }
}

async function retryPendingNotebookImageDeletions(userID) {
  const pendingAssetIDs = (await listStoredFoundationArtifacts(userID))
    .filter((artifact) =>
      artifact.envelope?.type === "notebookImageAsset" &&
      !artifact.envelope?.deletedAt &&
      artifact.payload?.deletionPendingAt
    )
    .map((artifact) => artifact.envelope.id);
  if (pendingAssetIDs.length) {
    await deleteOrphanedNotebookImageAssets(userID, "", pendingAssetIDs);
  }
}

async function validateNotebookReferences(userID, references, evidenceLinks = []) {
  if (references.length > 100) {
    throw new Error("Notebook cards are limited to 100 linked references.");
  }
  const embeddedPassageIDs = new Set((evidenceLinks || []).map((link) => link.id));
  for (const reference of references) {
    if (
      reference.referenceKind === "selectedPassage" &&
      embeddedPassageIDs.has(reference.referenceID)
    ) continue;
    if (!await ownedProjectTargetExists(
      userID,
      reference.referenceKind,
      reference.referenceID
    )) {
      throw new Error(`Notebook reference is unavailable: ${reference.label}`);
    }
  }
}

async function handleNotebookCardList(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectView
  );
  if (!access) return;
  const cards = await notebookCardSummariesForProject(access.storageOwnerUserID, projectID);
  sendJSON(response, 200, {
    schemaVersion: 1,
    cardTypes: notebookCardTypes,
    projectID,
    access: {
      role: access.role,
      readOnly: !access.permissions.includes(organizationPermissions.projectEdit)
    },
    cards
  });
}

async function handleNotebookCardGet(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectView
  );
  if (!access) return;
  const artifact = await ownedNotebookArtifact(
    access.storageOwnerUserID,
    context.body.cardID
  );
  if (!artifact) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  const projectIDs = (await listStoredProjectLinks(access.storageOwnerUserID, {
    targetKind: "notebookCard"
  }))
    .filter((link) =>
      !link.deletedAt &&
      link.targetKind === "notebookCard" &&
      link.targetID === artifact.envelope.id
    )
    .map((link) => link.projectID);
  if (!projectIDs.includes(access.projectID)) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  sendJSON(response, 200, { card: notebookCardForClient(artifact, projectIDs) });
}

async function handleNotebookCardSave(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const storageOwnerUserID = access.storageOwnerUserID;

  const requestedCardID = String(context.body.cardID || "").trim();
  const existing = requestedCardID
    ? await ownedNotebookArtifact(storageOwnerUserID, requestedCardID)
    : null;
  if (requestedCardID && !existing) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion ?? 0);
  if (
    existing &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existing.envelope.version)
  ) {
    sendJSON(response, 409, {
      error: "This Notebook card changed after you opened it. Review the current version before saving.",
      code: "NOTEBOOK_VERSION_CONFLICT",
      card: notebookCardForClient(existing)
    });
    return;
  }

  const links = await listStoredProjectLinks(storageOwnerUserID);
  const activeProjectLink = existing
    ? links.find((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "notebookCard" &&
        link.targetID === existing.envelope.id
      )
    : null;
  if (existing && !activeProjectLink) {
    sendJSON(response, 409, {
      error: "Link this Notebook card to the Project before editing it here.",
      code: "NOTEBOOK_PROJECT_LINK_REQUIRED"
    });
    return;
  }

  try {
    const now = new Date().toISOString();
    const cardID = existing?.envelope.id || randomUUID();
    const payload = normalizeNotebookCardPayload({
      cardType: context.body.cardType,
      title: context.body.title,
      document: context.body.document,
      evidenceLinks: context.body.evidenceLinks,
      createdBy: existing?.payload?.createdBy || context.userID,
      updatedBy: context.userID
    });
    await validateNotebookReferences(storageOwnerUserID, payload.references, payload.evidenceLinks);
    await validateNotebookImageAssets(storageOwnerUserID, projectID, payload.imageAssets);
    const artifact = {
      envelope: artifactEnvelope({
        id: cardID,
        type: "notebookCard",
        owner: access.owner,
        createdAt: existing?.envelope.createdAt || now,
        updatedAt: now,
        version: Number(existing?.envelope.version || 0) + 1
      }),
      payload
    };
    await saveStoredFoundationArtifact(storageOwnerUserID, artifact);

    let link = activeProjectLink;
    if (!link) {
      link = projectLinkRecord({
        id: deterministicFoundationLinkID(
          storageOwnerUserID,
          projectID,
          "notebookCard",
          cardID
        ),
        owner: access.owner,
        projectID,
        targetKind: "notebookCard",
        targetID: cardID,
        relationship: "reference",
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { createdWith: "permitext-notebook" }
      });
      await saveStoredProjectLink(storageOwnerUserID, link);
    }
    const event = activityEvent({
      owner: access.owner,
      projectID,
      actorUserID: context.userID,
      action: existing ? "notebook-card.revision.saved" : "notebook-card.created",
      objectKind: "notebookCard",
      objectID: cardID,
      previousStatus: existing ? `version-${existing.envelope.version}` : null,
      newStatus: `version-${artifact.envelope.version}`,
      createdAt: now,
      metadata: {
        cardType: payload.cardType,
        referenceCount: payload.references.length
      }
    });
    await saveStoredActivityEvent(storageOwnerUserID, event);
    const removedImageAssets = (existing?.payload?.imageAssets || [])
      .filter((assetID) => !payload.imageAssets.includes(assetID));
    await deleteOrphanedNotebookImageAssets(storageOwnerUserID, projectID, removedImageAssets);
    const artifactRevisions = await bumpStoredArtifactRevisions(
      storageOwnerUserID,
      projectArtifactRevisionChange(projectID, ["notebook", "foundation", "activity"])
    );
    sendJSON(response, existing ? 200 : 201, {
      card: notebookCardForClient(artifact, [projectID]),
      link,
      activity: event,
      artifactRevisions
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid Notebook card.",
      code: "INVALID_NOTEBOOK_CARD"
    });
  }
}

async function handleNotebookCardDelete(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const artifact = await ownedNotebookArtifact(
    access.storageOwnerUserID,
    context.body.cardID
  );
  if (!artifact) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== artifact.envelope.version) {
    sendJSON(response, 409, {
      error: "This Notebook card changed after you opened it. Review the current version before deleting it.",
      code: "NOTEBOOK_VERSION_CONFLICT",
      card: notebookCardForClient(artifact)
    });
    return;
  }
  const now = new Date().toISOString();
  const deletedArtifact = {
    ...artifact,
    envelope: artifactEnvelope({
      ...artifact.envelope,
      owner: access.owner,
      updatedAt: now,
      deletedAt: now,
      version: artifact.envelope.version + 1
    })
  };
  const activeLinks = (await listStoredProjectLinks(access.storageOwnerUserID))
    .filter((link) =>
      !link.deletedAt &&
      link.targetKind === "notebookCard" &&
      link.targetID === artifact.envelope.id
    );
  if (!activeLinks.some((link) => link.projectID === access.projectID)) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  for (const existingLink of activeLinks) {
    const linkedAccess = await projectAccessForUser(context.userID, existingLink.projectID);
    if (!linkedAccess?.permissions.includes(organizationPermissions.projectEdit)) {
      sendJSON(response, 403, {
        error: "This Notebook card is linked to another Project you cannot edit.",
        code: "NOTEBOOK_LINKED_PROJECT_PERMISSION_REQUIRED"
      });
      return;
    }
  }
  await saveStoredFoundationArtifact(access.storageOwnerUserID, deletedArtifact);
  await deleteOrphanedNotebookImageAssets(
    access.storageOwnerUserID,
    access.projectID,
    artifact.payload?.imageAssets || []
  );
  for (const existingLink of activeLinks) {
    const link = projectLinkRecord({
      ...existingLink,
      owner: access.owner,
      updatedAt: now,
      deletedAt: now,
      version: existingLink.version + 1
    });
    await saveStoredProjectLink(access.storageOwnerUserID, link);
    await saveStoredActivityEvent(access.storageOwnerUserID, activityEvent({
      owner: access.owner,
      projectID: existingLink.projectID,
      actorUserID: context.userID,
      action: "item.unlinked",
      objectKind: "notebookCard",
      objectID: artifact.envelope.id,
      previousStatus: "linked",
      newStatus: "deleted",
      createdAt: now
    }));
  }
  const artifactRevisions = await bumpStoredArtifactRevisions(access.storageOwnerUserID, {
    projects: activeLinks.map((link) => ({
      projectID: link.projectID,
      domains: ["notebook", "foundation", "activity"]
    }))
  });
  sendJSON(response, 200, {
    cardID: artifact.envelope.id,
    deletedAt: now,
    unlinkedProjectCount: activeLinks.length,
    artifactRevisions
  });
}

async function handleNotebookCardArchive(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const artifact = await ownedNotebookArtifact(
    access.storageOwnerUserID,
    context.body.cardID
  );
  if (!artifact) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== artifact.envelope.version) {
    sendJSON(response, 409, {
      error: "This Notebook card changed after you opened it. Review the current version before changing its archive status.",
      code: "NOTEBOOK_VERSION_CONFLICT",
      card: notebookCardForClient(artifact)
    });
    return;
  }
  const links = (await listStoredProjectLinks(access.storageOwnerUserID))
    .filter((link) =>
      !link.deletedAt &&
      link.projectID === access.projectID &&
      link.targetKind === "notebookCard" &&
      link.targetID === artifact.envelope.id
    );
  if (!links.length) {
    sendError(response, 404, "Notebook card not found.");
    return;
  }
  const archived = context.body.archived === true;
  const now = new Date().toISOString();
  const updatedArtifact = {
    ...artifact,
    envelope: artifactEnvelope({
      ...artifact.envelope,
      owner: access.owner,
      updatedAt: now,
      archivedAt: archived ? now : null,
      version: artifact.envelope.version + 1
    })
  };
  await saveStoredFoundationArtifact(access.storageOwnerUserID, updatedArtifact);
  const activity = activityEvent({
    owner: access.owner,
    projectID: access.projectID,
    actorUserID: context.userID,
    action: archived ? "notebook-card.archived" : "notebook-card.restored",
    objectKind: "notebookCard",
    objectID: artifact.envelope.id,
    previousStatus: archived ? "active" : "archived",
    newStatus: archived ? "archived" : "active",
    createdAt: now
  });
  await saveStoredActivityEvent(access.storageOwnerUserID, activity);
  const artifactRevisions = await bumpStoredArtifactRevisions(
    access.storageOwnerUserID,
    projectArtifactRevisionChange(access.projectID, ["notebook", "foundation", "activity"])
  );
  sendJSON(response, 200, {
    card: notebookCardForClient(updatedArtifact, [access.projectID]),
    activity,
    artifactRevisions
  });
}

async function authenticatedReportBody(request, response, options = {}) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return null;
  if (options.requirePro && !hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Professional Project reports require Pro.",
      code: "PRO_REQUIRED_EXPORTS"
    });
    return null;
  }
  return context;
}

async function reportProjectAccess(context, response, permission) {
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    permission
  );
  if (!access) return null;
  if (!access.organization && !hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Professional Project reports require Pro.",
      code: "PRO_REQUIRED_EXPORTS"
    });
    return null;
  }
  return access;
}

async function linkedProjectArtifact(userID, projectID, targetKind, artifactType, artifactID, options = {}) {
  const normalizedArtifactID = String(artifactID || "").trim();
  const linked = (await listStoredProjectLinks(userID)).some((link) =>
    !link.deletedAt &&
    link.projectID === projectID &&
    link.targetKind === targetKind &&
    link.targetID === normalizedArtifactID
  );
  if (!linked) return null;
  return (await listStoredFoundationArtifacts(userID)).find((artifact) =>
    artifact.envelope?.id === normalizedArtifactID &&
    artifact.envelope?.type === artifactType &&
    (options.includeDeleted || !artifact.envelope?.deletedAt)
  ) || null;
}

async function reportDraftArtifact(userID, projectID, draftID, options = {}) {
  return linkedProjectArtifact(
    userID,
    projectID,
    "reportDraft",
    "reportDraft",
    draftID,
    options
  );
}

async function reportManifestArtifact(userID, manifestID) {
  const normalizedManifestID = String(manifestID || "").trim();
  return (await listStoredFoundationArtifacts(userID)).find((artifact) =>
    artifact.envelope?.id === normalizedManifestID &&
    artifact.envelope?.type === "reportManifest" &&
    !artifact.envelope?.deletedAt
  ) || null;
}

function reportSourceClientSummary(source) {
  return {
    id: source.id,
    kind: source.kind,
    codePrefix: source.codePrefix || "",
    sectionNumber: source.sectionNumber || "",
    title: source.title || "",
    label: source.label,
    summary: source.summary || "",
    sourceClassification: source.sourceClassification,
    updatedAt: source.updatedAt || null
  };
}

const reportPreparedChapterIndexCache = new Map();

function codeLibraryReferenceForProjectLink(link) {
  const legacyRecordID = String(link?.metadata?.legacyRecordID || "");
  const match = legacyRecordID.match(
    /(CodeContent\/authored\/new-york-city\/([a-z0-9-]+)\/bundle\.json(?:#\d+)?)/i
  );
  if (!match) {
    return {
      slug: "2022-construction-codes",
      version: defaultSyncCodeVersion
    };
  }
  return {
    slug: match[2].toLowerCase(),
    version: match[1]
  };
}

function preparedSectionText(section) {
  const blockText = (section?.blocks || [])
    .map((block) => block.plainText || plainTextFromPreparedHTML(block.html || ""))
    .filter(Boolean)
    .join("\n\n");
  return String(section?.officialText || blockText || section?.title || "")
    .replace(/\s+/g, " ")
    .trim();
}

function indexPreparedChapterSections(value, chapterNumber, index) {
  if (Array.isArray(value)) {
    value.forEach((item) => indexPreparedChapterSections(item, chapterNumber, index));
    return;
  }
  if (!value || typeof value !== "object") return;
  const sectionID = value.id ?? value.sectionID;
  if (sectionID != null && value.sectionNumber && preparedSectionText(value)) {
    index.set(String(sectionID), { ...value, chapterNumber: value.chapterNumber || chapterNumber });
  }
  Object.values(value).forEach((item) => {
    if (item && typeof item === "object") {
      indexPreparedChapterSections(item, chapterNumber, index);
    }
  });
}

async function preparedChapterSectionIndex(librarySlug) {
  if (!reportPreparedChapterIndexCache.has(librarySlug)) {
    reportPreparedChapterIndexCache.set(librarySlug, (async () => {
      const chapterPath = join(authoredNYCCodeContentPath, librarySlug, "prepared", "chapters");
      const index = new Map();
      const filenames = (await readdir(chapterPath)).filter((name) => name.endsWith(".json"));
      for (const filename of filenames) {
        const chapter = await readJSONFile(join(chapterPath, filename));
        indexPreparedChapterSections(chapter, chapter.chapterNumber || "", index);
      }
      return index;
    })());
  }
  return reportPreparedChapterIndexCache.get(librarySlug);
}

async function preparedReportEvidence(link, charactersPerSection) {
  const requestedID = String(link.targetID || "").trim();
  const library = codeLibraryReferenceForProjectLink(link);
  const preparedPath = join(authoredNYCCodeContentPath, library.slug, "prepared");
  const catalogSummary = library.slug === "2022-construction-codes"
    ? await sectionSummaryByID(requestedID)
    : null;
  let section;
  try {
    section = await readJSONFile(join(preparedPath, "sections", `${requestedID}.json`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    section = (await preparedChapterSectionIndex(library.slug)).get(requestedID) || null;
  }
  if (!section) {
    const error = new Error(`Unknown code section: ${requestedID}.`);
    error.code = "INVALID_RESEARCH_SECTION";
    throw error;
  }
  const enactedText = preparedSectionText(section);
  if (!enactedText) {
    const error = new Error(`Section ${section.sectionNumber || requestedID} has no enacted text available.`);
    error.code = "INCOMPLETE_RESEARCH_SECTION";
    throw error;
  }
  let manifest = {};
  try {
    manifest = await readJSONFile(join(preparedPath, "manifest.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const chapter = (manifest.chapters || []).find((candidate) =>
    String(candidate.chapterID || "") === String(section.chapterID || "") ||
    String(candidate.chapterNumber || "") === String(section.chapterNumber || "")
  );
  const codePrefix = String(section.codePrefix || catalogSummary?.codePrefix || chapter?.codePrefix || "");
  const sectionNumber = String(section.sectionNumber || catalogSummary?.sectionNumber || "");
  const title = String(section.title || catalogSummary?.title || "Section");
  const canonicalText = [sectionNumber, title, enactedText]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    sectionID: String(section.sectionID || section.id || requestedID),
    sectionNumber,
    title,
    codePrefix,
    chapterNumber: String(
      section.chapterNumber || catalogSummary?.chapterNumber || chapter?.chapterNumber || ""
    ),
    text: enactedText.slice(0, charactersPerSection),
    canonicalText,
    sectionTextHash: createHash("sha256").update(canonicalText).digest("hex"),
    sourceLibraryVersion: library.version
  };
}

async function reportEvidenceForProjectLinks(links, options = {}) {
  const evidence = [];
  const charactersPerSection = Math.min(12_000, Math.floor(60_000 / links.length));
  for (const link of links) {
    const library = codeLibraryReferenceForProjectLink(link);
    try {
      if (library.slug === "2022-construction-codes") {
        try {
          const [canonicalEvidence] = await researchEvidenceForSectionIDs([link.targetID]);
          if (canonicalEvidence) {
            evidence.push({ ...canonicalEvidence, sourceLibraryVersion: library.version });
            continue;
          }
        } catch (error) {
          if (!["ENOENT", "INCOMPLETE_RESEARCH_SECTION", "INVALID_RESEARCH_SECTION"].includes(error.code)) {
            throw error;
          }
        }
      }
      evidence.push(await preparedReportEvidence(link, charactersPerSection));
    } catch (error) {
      const warning = unavailableReportEvidenceWarning(error, {
        requestedID: String(link.targetID || ""),
        canonicalID: String(link.targetID || "")
      });
      if (!options.skipUnavailable || !warning) throw error;
      options.onUnavailable?.(warning);
    }
  }
  return evidence;
}

function latestContentMutationsByID(mutations) {
  const latestByID = new Map();
  [...(mutations || [])]
    .sort((left, right) => {
      const leftRecord = mutationKindAndRecord(left).record;
      const rightRecord = mutationKindAndRecord(right).record;
      return Date.parse(rightRecord?.updatedAt || 0) - Date.parse(leftRecord?.updatedAt || 0);
    })
    .forEach((mutation) => {
      const recordID = normalizedMutationRecordID(mutation);
      if (recordID && !latestByID.has(recordID)) latestByID.set(recordID, mutation);
    });
  return Array.from(latestByID.values());
}

async function currentProjectSectionRecords(userID, projectID) {
  const mutations = latestContentMutationsByID(await userContentMutations(userID));
  const clearRecords = mutations
    .map((mutation) => mutationKindAndRecord(mutation))
    .filter(({ kind, record }) => kind === "codeVersionClear" && record)
    .map(({ record }) => record);
  return mutations
    .map((mutation) => mutationKindAndRecord(mutation))
    .filter(({ kind, record }) => {
      if (kind !== "projectSection" || !record || record.deletedAt) return false;
      const assignedProjectID = syncProjectIdentity(record.folderClientID, userID) ||
        (record.localFolderID == null ? "" : `legacy-project-${record.localFolderID}`);
      return assignedProjectID === projectID &&
        recordSurvivesBulkClear(record, clearRecords, ["bookmarks", "folders"]);
    })
    .map(({ record }) => record);
}

async function reportSourcesForProject(userID, projectID) {
  const links = (await listStoredProjectLinks(userID))
    .filter((link) => !link.deletedAt && link.projectID === projectID);
  const artifacts = await listStoredFoundationArtifacts(userID);
  const sources = [];
  const warnings = [];

  const project = (await projectAccessForUser(userID, projectID))?.project || null;
  if (project?.description) {
    const facts = String(project.description).trim();
    sources.push({
      id: projectID,
      kind: "projectFacts",
      label: "Project Facts",
      summary: [project.address, facts].filter(Boolean).join(" · ").slice(0, 500),
      sourceClassification: "project-material",
      updatedAt: project.updatedAt || null,
      manifestItem: {
        kind: "projectFacts",
        sourceID: projectID,
        title: project.name || project.title || "Project facts",
        address: project.address || "",
        facts
      }
    });
  }

  const currentProjectSections = await currentProjectSectionRecords(userID, projectID);
  const currentSectionIDs = new Set(currentProjectSections.map((record) => String(record.sectionID || "")));
  const sectionLinks = Array.from(new Map(
    links
      .filter((link) =>
        link.targetKind === "canonicalSection" &&
        currentSectionIDs.has(String(link.targetID || ""))
      )
      .map((link) => [link.targetID, link])
  ).values());
  if (sectionLinks.length) {
    const evidenceItems = await reportEvidenceForProjectLinks(sectionLinks, {
      skipUnavailable: true,
      onUnavailable(warning) {
        warnings.push(warning);
      }
    });
    evidenceItems.forEach((evidence) => {
      sources.push({
        id: evidence.sectionID,
        kind: "evidence",
        codePrefix: evidence.codePrefix || "BC",
        sectionNumber: evidence.sectionNumber,
        title: evidence.title,
        label: `${evidence.codePrefix || "Code"} ${evidence.sectionNumber}: ${evidence.title}`,
        summary: evidence.text.slice(0, 500),
        sourceClassification: "published-code",
        manifestItem: {
          kind: "evidence",
          sectionID: evidence.sectionID,
          sectionNumber: evidence.sectionNumber,
          codeBook: evidence.codePrefix || "NYC Construction Code",
          chapter: evidence.chapterNumber || "unknown",
          title: evidence.title,
          passageText: evidence.text,
          passageTextHash: createHash("sha256").update(evidence.text).digest("hex"),
          sourceLibraryVersion: evidence.sourceLibraryVersion
        }
      });
    });
  }

  const linkedNotebookIDs = new Set(
    links.filter((link) => link.targetKind === "notebookCard").map((link) => link.targetID)
  );
  artifacts
    .filter((artifact) =>
      artifact.envelope?.type === "notebookCard" &&
      !artifact.envelope?.deletedAt &&
      linkedNotebookIDs.has(artifact.envelope.id)
    )
    .forEach((artifact) => {
      sources.push({
        id: artifact.envelope.id,
        kind: "notebookCard",
        label: artifact.payload.title,
        summary: artifact.payload.plainText?.slice(0, 500) || "",
        sourceClassification: "user-authored",
        updatedAt: artifact.envelope.updatedAt,
        manifestItem: {
          kind: "notebookCard",
          cardID: artifact.envelope.id,
          cardType: artifact.payload.cardType,
          title: artifact.payload.title,
          plainText: artifact.payload.plainText || "",
          references: artifact.payload.references || []
        }
      });
    });

  (await listStoredResearchAnswers(userID))
    .filter((answer) => answer.projectID === projectID)
    .forEach((answer) => {
      sources.push({
        id: answer.id,
        kind: "researchAnswer",
        label: answer.question,
        summary: answer.answer?.conclusion?.slice(0, 500) || "",
        sourceClassification: "ai-assisted",
        updatedAt: answer.createdAt,
        manifestItem: {
          kind: "researchAnswer",
          answerID: answer.id,
          conversationID: answer.conversationID,
          question: answer.question,
          conclusion: answer.answer?.conclusion || "No supported conclusion was recorded.",
          supportedPoints: answer.answer?.supportedPoints || [],
          explanation: answer.answer?.explanation || "",
          assumptions: answer.assumptions || answer.answer?.assumptions || [],
          missingFacts: answer.missingFacts || answer.answer?.missingFacts || [],
          limitations: answer.limitations || answer.answer?.evidenceLimitations || [],
          additionalEvidenceNeeded: answer.additionalEvidenceNeeded ||
            answer.answer?.additionalEvidenceNeeded || [],
          citations: answer.citations || [],
          evidence: answer.evidence || [],
          reviewStatus: answer.reviewStatus || "unreviewed"
        }
      });
    });

  for (const kind of ["workboardPreview", "attachment"]) {
    const linkedIDs = new Set(
      links.filter((link) => link.targetKind === kind).map((link) => link.targetID)
    );
    artifacts
      .filter((artifact) =>
        artifact.envelope?.type === kind &&
        !artifact.envelope?.deletedAt &&
        linkedIDs.has(artifact.envelope.id)
      )
      .forEach((artifact) => {
        const contentHash = String(
          artifact.payload.contentHash ||
          artifact.payload.sha256 ||
          artifact.payload.assetHash ||
          ""
        ).trim();
        if (!contentHash) return;
        sources.push({
          id: artifact.envelope.id,
          kind,
          label: artifact.payload.title || (kind === "workboardPreview" ? "Workboard preview" : "Attachment"),
          summary: artifact.payload.description || "",
          sourceClassification: "project-material",
          updatedAt: artifact.envelope.updatedAt,
          manifestItem: {
            kind,
            sourceID: artifact.envelope.id,
            title: artifact.payload.title || (kind === "workboardPreview" ? "Workboard preview" : "Attachment"),
            contentType: artifact.payload.contentType || "",
            contentHash,
            readPath: artifact.payload.readPath || ""
          }
        });
      });
  }
  return { sources, warnings };
}

async function handleReportSourceList(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.reportDownload
  );
  if (!access) return;
  const { sources, warnings } = await reportSourcesForProject(
    access.storageOwnerUserID,
    access.projectID
  );
  sendJSON(response, 200, {
    schemaVersion: 1,
    projectID: access.projectID,
    sources: sources.map(reportSourceClientSummary),
    warnings
  });
}

async function reportConfigurationForProject(userID, projectID) {
  const access = await projectAccessForUser(userID, projectID);
  if (!access || !access.permissions.includes(organizationPermissions.reportDownload)) {
    return null;
  }
  const controls = access.organization
    ? normalizedOrganizationFirmControls(access.organization)
    : defaultFirmControls({
        organizationName: "Permitext",
        ownerUserID: userID,
        createdAt: access.project?.updatedAt || new Date().toISOString()
      });
  return {
    access,
    controls,
    organization: access.organization,
    templates: controls.reportTemplates.filter((template) => template.status === "active"),
    defaultReportTemplateID: controls.defaultReportTemplateID,
    branding: controls.branding,
    requiredDisclaimers: controls.requiredDisclaimers,
    tags: controls.tags.filter((tag) =>
      tag.status === "active" &&
      (controls.projectTagAssignments[access.projectID] || []).includes(tag.id)
    )
  };
}

async function handleReportOptions(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const configuration = await reportConfigurationForProject(context.userID, projectID);
  if (!configuration) {
    sendError(response, 404, "Project not found.");
    return;
  }
  sendJSON(response, 200, {
    schemaVersion: 1,
    projectID: configuration.access.projectID,
    organization: configuration.organization ? {
      id: configuration.organization.id,
      name: configuration.organization.name
    } : null,
    firmControlsVersion: configuration.controls.version,
    templates: configuration.templates,
    defaultReportTemplateID: configuration.defaultReportTemplateID,
    branding: configuration.branding,
    requiredDisclaimers: configuration.requiredDisclaimers,
    tags: configuration.tags
  });
}

async function projectReportDrafts(userID, projectID, options = {}) {
  const linkedDraftIDs = new Set(
    (await listStoredProjectLinks(userID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "reportDraft"
      )
      .map((link) => link.targetID)
  );
  return (await listStoredFoundationArtifacts(userID))
    .filter((artifact) =>
      artifact.envelope?.type === "reportDraft" &&
      (options.includeDeleted || !artifact.envelope?.deletedAt) &&
      linkedDraftIDs.has(artifact.envelope.id)
    )
    .sort((left, right) => String(right.envelope.updatedAt).localeCompare(String(left.envelope.updatedAt)));
}

async function handleReportDraftList(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.reportDownload
  );
  if (!access) return;
  const drafts = await projectReportDrafts(access.storageOwnerUserID, access.projectID);
  sendJSON(response, 200, {
    schemaVersion: 1,
    projectID: access.projectID,
    drafts: drafts.map((artifact) => reportDraftForClient(artifact, [access.projectID]))
  });
}

async function handleReportDraftGet(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.reportDownload
  );
  if (!access) return;
  const artifact = await reportDraftArtifact(
    access.storageOwnerUserID,
    access.projectID,
    context.body.draftID
  );
  if (!artifact) {
    sendError(response, 404, "Report not found.");
    return;
  }
  sendJSON(response, 200, { draft: reportDraftForClient(artifact, [access.projectID]) });
}

async function validateReportDraftSources(userID, projectID, draft) {
  const { sources } = await reportSourcesForProject(userID, projectID);
  const sourceKeys = new Set(sources.map((source) => `${source.kind}:${source.id}`));
  for (const block of draft.blocks) {
    if (["heading", "paragraph", "list"].includes(block.kind)) continue;
    if (!sourceKeys.has(`${block.kind}:${block.sourceID}`)) {
      throw new Error(`Report source is unavailable: ${block.label}`);
    }
  }
}

async function handleReportDraftSave(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await reportProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const storageOwnerUserID = access.storageOwnerUserID;
  const requestedDraftID = String(context.body.draftID || "").trim();
  const existing = requestedDraftID
    ? await reportDraftArtifact(storageOwnerUserID, access.projectID, requestedDraftID)
    : null;
  if (requestedDraftID && !existing) {
    sendError(response, 404, "Report not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion ?? 0);
  if (
    existing &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion !== existing.envelope.version)
  ) {
    sendJSON(response, 409, {
      error: "This Report changed after you opened it. Review the current version before saving.",
      code: "REPORT_DRAFT_VERSION_CONFLICT",
      draft: reportDraftForClient(existing, [access.projectID])
    });
    return;
  }
  try {
    const now = new Date().toISOString();
    const draftID = existing?.envelope.id || randomUUID();
    const payload = normalizeReportDraftPayload({
      title: context.body.title,
      reportDate: context.body.reportDate,
      introduction: context.body.introduction,
      blocks: context.body.blocks,
      createdBy: existing?.payload?.createdBy || context.userID,
      updatedBy: context.userID
    });
    await validateReportDraftSources(storageOwnerUserID, access.projectID, payload);
    const artifact = {
      envelope: artifactEnvelope({
        id: draftID,
        type: "reportDraft",
        owner: access.owner,
        createdAt: existing?.envelope.createdAt || now,
        updatedAt: now,
        version: Number(existing?.envelope.version || 0) + 1
      }),
      payload
    };
    await saveStoredFoundationArtifact(storageOwnerUserID, artifact);
    if (!existing) {
      await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
        id: deterministicFoundationLinkID(
          storageOwnerUserID,
          access.projectID,
          "reportDraft",
          draftID
        ),
        owner: access.owner,
        projectID: access.projectID,
        targetKind: "reportDraft",
        targetID: draftID,
        relationship: "owner",
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { createdWith: "permitext-report-draft" }
      }));
    }
    const artifactRevisions = await bumpStoredArtifactRevisions(
      storageOwnerUserID,
      projectArtifactRevisionChange(access.projectID, ["report", "foundation"])
    );
    sendJSON(response, existing ? 200 : 201, {
      draft: reportDraftForClient(artifact, [access.projectID]),
      artifactRevisions
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid Report.",
      code: "INVALID_REPORT_DRAFT"
    });
  }
}

async function handleReportDraftDelete(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await reportProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const storageOwnerUserID = access.storageOwnerUserID;
  const artifact = await reportDraftArtifact(
    storageOwnerUserID,
    access.projectID,
    context.body.draftID
  );
  if (!artifact) {
    sendError(response, 404, "Report not found.");
    return;
  }
  const expectedVersion = Number(context.body.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== artifact.envelope.version) {
    sendJSON(response, 409, {
      error: "This Report changed after you opened it. Review the current version before deleting it.",
      code: "REPORT_DRAFT_VERSION_CONFLICT",
      draft: reportDraftForClient(artifact, [access.projectID])
    });
    return;
  }
  const now = new Date().toISOString();
  await saveStoredFoundationArtifact(storageOwnerUserID, {
    ...artifact,
    envelope: artifactEnvelope({
      ...artifact.envelope,
      owner: access.owner,
      updatedAt: now,
      deletedAt: now,
      version: artifact.envelope.version + 1
    })
  });
  const activeLink = (await listStoredProjectLinks(storageOwnerUserID)).find((link) =>
    !link.deletedAt &&
    link.projectID === access.projectID &&
    link.targetKind === "reportDraft" &&
    link.targetID === artifact.envelope.id
  );
  if (activeLink) {
    await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
      ...activeLink,
      owner: access.owner,
      updatedAt: now,
      deletedAt: now,
      version: activeLink.version + 1
    }));
  }
  const artifactRevisions = await bumpStoredArtifactRevisions(
    storageOwnerUserID,
    projectArtifactRevisionChange(access.projectID, ["report", "foundation"])
  );
  sendJSON(response, 200, { draftID: artifact.envelope.id, deletedAt: now, artifactRevisions });
}

function reportManifestItemForDraftBlock(block, sourcesByKey) {
  if (["heading", "paragraph", "list"].includes(block.kind)) return block;
  const source = sourcesByKey.get(`${block.kind}:${block.sourceID}`);
  if (!source) throw new Error(`Report source is unavailable: ${block.label}`);
  return { ...source.manifestItem, id: block.id };
}

async function projectReportManifests(userID, projectID) {
  const linkedManifestIDs = new Set(
    (await listStoredProjectLinks(userID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "reportManifest"
      )
      .map((link) => link.targetID)
  );
  return (await listStoredFoundationArtifacts(userID))
    .filter((artifact) =>
      artifact.envelope?.type === "reportManifest" &&
      !artifact.envelope?.deletedAt &&
      linkedManifestIDs.has(artifact.envelope.id)
    )
    .sort((left, right) =>
      Number(right.payload?.reportVersion || 0) - Number(left.payload?.reportVersion || 0)
    );
}

async function projectGeneratedReports(userID, projectID) {
  const linkedReportIDs = new Set(
    (await listStoredProjectLinks(userID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "generatedReport"
      )
      .map((link) => link.targetID)
  );
  return (await listStoredFoundationArtifacts(userID))
    .filter((artifact) =>
      artifact.envelope?.type === "generatedReport" &&
      !artifact.envelope?.deletedAt &&
      linkedReportIDs.has(artifact.envelope.id)
    );
}

function generatedReportFileDescriptor(artifact) {
  const file = artifact?.payload?.file;
  if (!file?.pathname) return null;
  return {
    generatedReportID: artifact.envelope.id,
    manifestID: artifact.payload.manifestID,
    reportVersion: artifact.payload.reportVersion,
    format: file.format,
    contentType: file.contentType,
    size: file.size,
    contentHash: file.contentHash,
    createdAt: artifact.payload.createdAt
  };
}

async function reportFilesForProject(userID, projectID) {
  return (await projectGeneratedReports(userID, projectID))
    .map(generatedReportFileDescriptor)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

async function reportProjectMaterialBySourceID(userID, projectID, manifest) {
  const requestedIDs = new Set(
    (manifest.items || [])
      .filter((item) => item.kind === "workboardPreview")
      .map((item) => item.sourceID)
  );
  if (!requestedIDs.size) return new Map();
  const artifacts = await listStoredFoundationArtifacts(userID);
  const material = new Map();
  for (const artifact of artifacts) {
    if (
      !requestedIDs.has(artifact.envelope?.id) ||
      artifact.envelope?.type !== "workboardPreview" ||
      artifact.payload?.projectID !== projectID ||
      !workboardPreviewPathBelongsToProject(artifact.payload?.pathname || "", projectID)
    ) {
      continue;
    }
    const body = await readPrivateProjectAsset(artifact.payload.pathname);
    if (!body) continue;
    const contentHash = createHash("sha256").update(body).digest("hex");
    if (contentHash !== artifact.payload.contentHash) {
      throw new Error("The stored Workboard preview no longer matches its immutable content hash.");
    }
    material.set(artifact.envelope.id, {
      body,
      contentType: artifact.payload.contentType,
      contentHash
    });
  }
  return material;
}

async function handleReportGenerate(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await reportProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const storageOwnerUserID = access.storageOwnerUserID;
  const project = access.project;
  const draft = await reportDraftArtifact(
    storageOwnerUserID,
    access.projectID,
    context.body.draftID
  );
  if (!draft) {
    sendError(response, 404, "Report not found.");
    return;
  }
  if (!privateProjectAssetStorageConfigured()) {
    sendError(response, 503, "Private Report PDF storage is not configured.");
    return;
  }
  try {
    const reportConfiguration = await reportConfigurationForProject(context.userID, projectID);
    if (!reportConfiguration) throw new Error("Report configuration is unavailable.");
    const reportTemplate = activeReportTemplate(
      reportConfiguration.controls,
      context.body.reportTemplateID
    );
    const { sources } = await reportSourcesForProject(storageOwnerUserID, access.projectID);
    const sourcesByKey = new Map(sources.map((source) => [`${source.kind}:${source.id}`, source]));
    const priorManifests = await projectReportManifests(storageOwnerUserID, access.projectID);
    const reportVersion = Math.max(
      0,
      ...priorManifests.map((artifact) => Number(artifact.payload?.reportVersion || 0))
    ) + 1;
    const now = new Date().toISOString();
    const manifestID = randomUUID();
    const manifest = immutableReportManifest({
      id: manifestID,
      project: {
        id: access.projectID,
        name: project.name || "Untitled Project",
        address: project.address || "",
        description: project.description || ""
      },
      draftID: draft.envelope.id,
      title: draft.payload.title,
      reportDate: now,
      author: {
        userID: context.userID,
        displayName: context.authContext.account?.displayName ||
          context.authContext.account?.publicUsername ||
          "Permitext user"
      },
      codeEdition: defaultResearchCodeEdition,
      items: [
        ...(draft.payload.introduction
          ? [{ id: `${draft.envelope.id}-introduction`, kind: "paragraph", text: draft.payload.introduction }]
          : []),
        ...draft.payload.blocks.map((block) => reportManifestItemForDraftBlock(block, sourcesByKey))
      ],
      disclaimers: reportConfiguration.organization
        ? reportDisclaimersForFirm({
            controls: reportConfiguration.controls,
            template: reportTemplate
          })
        : [...permitextRequiredReportDisclaimers],
      presentation: reportPresentationSnapshot({
        organization: reportConfiguration.organization,
        controls: reportConfiguration.controls,
        template: reportTemplate
      }),
      reportVersion,
      sourceVersions: {
        codeEdition: defaultResearchCodeEdition,
        codeContent: defaultSyncCodeVersion,
        draftVersion: draft.envelope.version,
        firmControlsVersion: reportConfiguration.controls.version
      },
      createdAt: now
    });
    const generatedReportID = randomUUID();
    const projectMaterialBySourceID = await reportProjectMaterialBySourceID(
      storageOwnerUserID,
      access.projectID,
      manifest
    );
    const pdfBody = await renderReportPDFOnDemand(manifest, { projectMaterialBySourceID });
    if (!pdfBody.length || pdfBody.length > maxReportFileBytes) {
      throw new Error("The generated Report PDF exceeds the supported file size.");
    }
    const requestedPathname = reportFilePathname(
      access.projectID,
      manifestID,
      generatedReportID,
      "web-pdf"
    );
    const pathname = await storePrivateReportFile(requestedPathname, pdfBody);
    const file = {
      format: "web-pdf",
      pathname,
      contentType: "application/pdf",
      size: pdfBody.length,
      contentHash: createHash("sha256").update(pdfBody).digest("hex"),
      createdAt: now
    };
    const manifestArtifact = {
      envelope: artifactEnvelope({
        id: manifestID,
        type: "reportManifest",
        owner: access.owner,
        createdAt: now,
        updatedAt: now,
        version: 1
      }),
      payload: manifest
    };
    await saveStoredFoundationArtifact(storageOwnerUserID, manifestArtifact);
    await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
      id: deterministicFoundationLinkID(
        storageOwnerUserID,
        access.projectID,
        "reportManifest",
        manifestID
      ),
      owner: access.owner,
      projectID: access.projectID,
      targetKind: "reportManifest",
      targetID: manifestID,
      relationship: "owner",
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: { reportVersion, draftID: draft.envelope.id }
    }));

    const generatedReport = {
      manifestID,
      reportVersion,
      title: manifest.title,
      outputFormats: ["web-pdf"],
      contentHash: manifest.contentHash,
      generatorVersion: manifest.generatorVersion,
      file,
      createdBy: context.userID,
      createdAt: now
    };
    await saveStoredFoundationArtifact(storageOwnerUserID, {
      envelope: artifactEnvelope({
        id: generatedReportID,
        type: "generatedReport",
        owner: access.owner,
        createdAt: now,
        updatedAt: now,
        version: 1
      }),
      payload: generatedReport
    });
    await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
      id: deterministicFoundationLinkID(
        storageOwnerUserID,
        access.projectID,
        "generatedReport",
        generatedReportID
      ),
      owner: access.owner,
      projectID: access.projectID,
      targetKind: "generatedReport",
      targetID: generatedReportID,
      relationship: "owner",
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: { manifestID, reportVersion }
    }));
    const event = activityEvent({
      owner: access.owner,
      projectID: access.projectID,
      actorUserID: context.userID,
      action: "report.generated",
      objectKind: "reportManifest",
      objectID: manifestID,
      previousStatus: null,
      newStatus: `version-${reportVersion}`,
      createdAt: now,
      metadata: {
        draftID: draft.envelope.id,
        generatedReportID,
        contentHash: manifest.contentHash
      }
    });
    await saveStoredActivityEvent(storageOwnerUserID, event);
    const artifactRevisions = await bumpStoredArtifactRevisions(
      storageOwnerUserID,
      projectArtifactRevisionChange(access.projectID, ["report", "foundation", "activity"])
    );
    sendJSON(response, 201, {
      manifest,
      generatedReport: {
        id: generatedReportID,
        ...generatedReport,
        file: generatedReportFileDescriptor({
          envelope: { id: generatedReportID },
          payload: generatedReport
        })
      },
      activity: event,
      artifactRevisions
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "The Report could not be generated.",
      code: "INVALID_REPORT_MANIFEST"
    });
  }
}

async function handleReportHistoryList(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.reportDownload
  );
  if (!access) return;
  sendJSON(response, 200, {
    schemaVersion: 1,
    projectID: access.projectID,
    reports: await reportHistorySummariesForProject(access.storageOwnerUserID, access.projectID)
  });
}

async function handleProjectHubBootstrap(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  if (!projectID) {
    sendError(response, 400, "Missing project ID.");
    return;
  }
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;

  const canReadNotebook = Boolean(access.organization) ||
    hasActiveProEntitlement(context.authContext.entitlement);
  const canDownloadReports = access.permissions.includes(organizationPermissions.reportDownload);

  const [foundation, cards, reports, artifactRevisions] = await Promise.all([
    projectFoundationStateForStorageOwner(
      access.storageOwnerUserID,
      access.projectID,
      { includeAllProjects: false }
    ),
    canReadNotebook
      ? notebookCardSummariesForProject(access.storageOwnerUserID, access.projectID)
      : Promise.resolve([]),
    canDownloadReports
      ? reportHistorySummariesForProject(access.storageOwnerUserID, access.projectID)
      : Promise.resolve([]),
    storedArtifactRevisionState(access.storageOwnerUserID, { projectIDs: [access.projectID] })
  ]);
  if (!foundation) {
    sendError(response, 404, "Project not found.");
    return;
  }

  sendJSON(response, 200, {
    schemaVersion: 1,
    projectID: access.projectID,
    access: {
      role: access.role,
      permissions: access.permissions,
      readOnly: !access.permissions.includes(organizationPermissions.projectEdit),
      canReadNotebook,
      canDownloadReports,
      organization: access.organization
        ? organizationForClient(access.organization, {
          role: access.role,
          permissions: access.permissions,
          accessScope: access.membership?.projectID ? "project" : "organization",
          visibleProjectIDs: [access.projectID]
        })
        : null
    },
    foundation,
    artifactRevisions,
    notebook: {
      schemaVersion: 1,
      cardTypes: notebookCardTypes,
      projectID: access.projectID,
      cards
    },
    reports: {
      schemaVersion: 1,
      projectID: access.projectID,
      reports
    }
  });
}

async function handleProjectArtifactCheckpoint(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const includeAccountResearch = context.body.includeAccountResearch === true;
  const projectIDs = Array.from(new Set((Array.isArray(context.body.projectIDs)
    ? context.body.projectIDs
    : [context.body.projectID])
    .map((value) => String(value || "").trim())
    .filter(Boolean)));
  if ((!projectIDs.length && !includeAccountResearch) || projectIDs.length > 50) {
    sendError(response, 400, "Provide between 1 and 50 Project IDs, or request the account Research revision.");
    return;
  }
  const accesses = [];
  for (const projectID of projectIDs) {
    const access = await projectAccessForUser(context.userID, projectID);
    if (!access?.permissions.includes(organizationPermissions.projectView)) {
      sendError(response, 404, "Project not found.");
      return;
    }
    accesses.push(access);
  }
  const projectIDsByStorageOwner = new Map();
  for (const access of accesses) {
    projectIDsByStorageOwner.set(access.storageOwnerUserID, [
      ...(projectIDsByStorageOwner.get(access.storageOwnerUserID) || []),
      access.projectID
    ]);
  }
  const [states, accountState] = await Promise.all([
    Promise.all(Array.from(projectIDsByStorageOwner, ([storageOwnerUserID, ids]) =>
      storedArtifactRevisionState(storageOwnerUserID, { projectIDs: ids })
    )),
    includeAccountResearch
      ? storedArtifactRevisionState(context.userID, { account: true })
      : Promise.resolve(null)
  ]);
  const revisionsByProjectID = new Map(states.flatMap((state) =>
    state.projects.map((project) => [project.projectID, {
      ...project,
      storageOwnerUserID: state.storageOwnerUserID
    }])
  ));
  sendJSON(response, 200, {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    ...(includeAccountResearch ? {
      account: accountState?.account
        ? { ...accountState.account, storageOwnerUserID: context.userID }
        : { revision: 0, domains: [], updatedAt: null, storageOwnerUserID: context.userID }
    } : {}),
    projects: projectIDs.map((projectID) => revisionsByProjectID.get(projectID))
  });
}

async function accessibleReportManifest(userID, manifestID) {
  const normalizedManifestID = String(manifestID || "").trim();
  if (!normalizedManifestID) return null;
  const [organizationEntries, projectMemberships] = await Promise.all([
    listStoredOrganizationsForUser(userID),
    listStoredProjectMembershipsForUser(userID)
  ]);
  const organizationIDs = organizationEntries
    .filter(({ organization, membership }) =>
      organization?.status === "active" && membership?.status === "active"
    )
    .map(({ organization }) => organization.id);
  const organizationOwnerships = await listStoredProjectOwnershipsForOrganizations(organizationIDs);
  const projectIDs = new Set([
    ...projectMemberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.projectID),
    ...organizationOwnerships.map((ownership) => ownership.projectID)
  ]);
  const personalArtifact = await reportManifestArtifact(userID, normalizedManifestID);
  if (personalArtifact?.payload?.project?.id) {
    projectIDs.add(personalArtifact.payload.project.id);
  }
  for (const projectID of projectIDs) {
    const access = await projectAccessForUser(userID, projectID);
    if (!access?.permissions.includes(organizationPermissions.reportDownload)) continue;
    const artifact = await reportManifestArtifact(access.storageOwnerUserID, normalizedManifestID);
    if (!artifact || artifact.payload.project?.id !== access.projectID) continue;
    const linked = (await listStoredProjectLinks(access.storageOwnerUserID)).some((link) =>
      !link.deletedAt &&
      link.projectID === access.projectID &&
      link.targetKind === "reportManifest" &&
      link.targetID === artifact.envelope.id
    );
    if (linked) return { access, artifact };
  }
  return null;
}

async function handleReportManifestGet(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const result = await accessibleReportManifest(context.userID, context.body.manifestID);
  if (!result) {
    sendError(response, 404, "Report Manifest not found.");
    return;
  }
  const { access, artifact } = result;
  const files = (await reportFilesForProject(access.storageOwnerUserID, access.projectID))
    .filter((file) => file.manifestID === artifact.envelope.id);
  sendJSON(response, 200, { manifest: artifact.payload, files });
}

async function handleReportFileUpload(request, response) {
  const userID = String(request.headers["x-permitext-user-id"] || "").trim();
  const url = requestURL(request);
  const projectID = String(url.searchParams.get("projectID") || "").trim();
  const manifestID = String(url.searchParams.get("manifestID") || "").trim();
  const format = String(url.searchParams.get("format") || "").trim();
  if (!userID || !projectID || !manifestID || format !== "ios-pdf") {
    sendError(response, 400, "Missing or invalid Report PDF identity.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;
  const access = await requireProjectPermission(
    response,
    userID,
    projectID,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  if (!access.organization && !hasActiveProEntitlement(context.entitlement)) {
    sendJSON(response, 403, {
      error: "Professional Report files require Pro.",
      code: "PRO_REQUIRED_EXPORTS"
    });
    return;
  }
  const storageOwnerUserID = access.storageOwnerUserID;
  const manifestArtifact = await reportManifestArtifact(storageOwnerUserID, manifestID);
  if (!manifestArtifact || manifestArtifact.payload.project?.id !== projectID) {
    sendError(response, 404, "Report Manifest not found.");
    return;
  }
  if (!privateProjectAssetStorageConfigured()) {
    sendError(response, 503, "Private Report PDF storage is not configured.");
    return;
  }
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/pdf") {
    sendError(response, 415, "Report files must be PDF documents.");
    return;
  }
  const body = await readBody(request, maxReportFileBytes);
  const pdfTail = body.subarray(Math.max(0, body.length - 1_024)).toString("ascii");
  if (
    body.length < 100 ||
    body.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    !pdfTail.includes("%%EOF")
  ) {
    sendError(response, 400, "The uploaded Report file is not a valid PDF document.");
    return;
  }

  const now = new Date().toISOString();
  const generatedReportID = randomUUID();
  const requestedPathname = reportFilePathname(
    projectID,
    manifestID,
    generatedReportID,
    format
  );
  const pathname = await storePrivateReportFile(requestedPathname, body);
  const file = {
    format,
    pathname,
    contentType,
    size: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
    createdAt: now
  };
  const generatedReport = {
    manifestID,
    reportVersion: manifestArtifact.payload.reportVersion,
    title: manifestArtifact.payload.title,
    outputFormats: [format],
    contentHash: manifestArtifact.payload.contentHash,
    generatorVersion: "permitext-ios-report-v1",
    file,
    createdBy: userID,
    createdAt: now
  };
  const artifact = {
    envelope: artifactEnvelope({
      id: generatedReportID,
      type: "generatedReport",
      owner: access.owner,
      createdAt: now,
      updatedAt: now,
      version: 1
    }),
    payload: generatedReport
  };
  await saveStoredFoundationArtifact(storageOwnerUserID, artifact);
  await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
    id: deterministicFoundationLinkID(
      storageOwnerUserID,
      access.projectID,
      "generatedReport",
      generatedReportID
    ),
    owner: access.owner,
    projectID: access.projectID,
    targetKind: "generatedReport",
    targetID: generatedReportID,
    relationship: "owner",
    createdAt: now,
    updatedAt: now,
    version: 1,
    metadata: {
      manifestID,
      reportVersion: manifestArtifact.payload.reportVersion,
      format
    }
  }));
  const event = activityEvent({
    owner: access.owner,
    projectID: access.projectID,
    actorUserID: userID,
    action: "report.export.saved",
    objectKind: "generatedReport",
    objectID: generatedReportID,
    previousStatus: null,
    newStatus: format,
    createdAt: now,
    metadata: {
      manifestID,
      reportVersion: manifestArtifact.payload.reportVersion,
      contentHash: file.contentHash
    }
  });
  await saveStoredActivityEvent(storageOwnerUserID, event);
  const artifactRevisions = await bumpStoredArtifactRevisions(
    storageOwnerUserID,
    projectArtifactRevisionChange(access.projectID, ["report", "foundation", "activity"])
  );
  sendJSON(response, 201, {
    file: generatedReportFileDescriptor(artifact),
    activity: event,
    artifactRevisions
  });
}

async function handleReportFileRead(request, response) {
  const context = await authenticatedReportBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const generatedReportID = String(context.body.generatedReportID || "").trim();
  if (!projectID || !generatedReportID) {
    sendError(response, 400, "Missing Report file identity.");
    return;
  }
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.reportDownload
  );
  if (!access) return;
  const artifact = (await projectGeneratedReports(access.storageOwnerUserID, projectID))
    .find((candidate) => candidate.envelope.id === generatedReportID);
  const file = artifact?.payload?.file;
  if (
    !artifact ||
    !file?.pathname ||
    file.contentType !== "application/pdf" ||
    !reportFilePathBelongsToProject(file.pathname, projectID)
  ) {
    sendError(response, 404, "Report PDF not found.");
    return;
  }
  if (!privateProjectAssetStorageConfigured()) {
    sendError(response, 503, "Private Report PDF storage is not configured.");
    return;
  }
  const body = await readPrivateReportFile(file.pathname);
  if (!body) {
    sendError(response, 404, "Report PDF not found.");
    return;
  }
  if (createHash("sha256").update(body).digest("hex") !== file.contentHash) {
    sendError(response, 409, "The stored Report PDF no longer matches its immutable content hash.");
    return;
  }
  const safeTitle = String(artifact.payload.title || "Permitext Project Report")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "Permitext-Project-Report";
  const filename = `${safeTitle}-v${artifact.payload.reportVersion}-${file.format}.pdf`;
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "private, no-store",
    "content-type": "application/pdf",
    "content-length": String(body.length),
    "content-disposition": `attachment; filename="${filename}"`
  });
  response.end(body);
}

async function requiredResearchConversation(response, userID, conversationID) {
  const conversation = await storedResearchConversation(userID, String(conversationID || "").trim());
  if (!conversation) sendError(response, 404, "Research conversation not found.");
  return conversation;
}

async function handleResearchConversationList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const [conversations, links] = await Promise.all([
    listStoredResearchConversations(context.userID, { summaryOnly: true }),
    listStoredProjectLinks(context.userID, { targetKind: "researchConversation" })
  ]);
  const linkByConversationID = new Map(links
    .filter((link) => !link.deletedAt && link.targetKind === "researchConversation")
    .map((link) => [link.targetID, link]));
  sendJSON(response, 200, {
    conversations: conversations
      .filter((conversation) => !conversation.historyHiddenAt)
      .sort((left, right) =>
        String(right.createdAt).localeCompare(String(left.createdAt)) ||
        String(left.id).localeCompare(String(right.id))
      )
      .map((conversation) => researchConversationSummary(
        conversation,
        linkByConversationID.get(conversation.id)
      ))
  });
}

async function handleResearchConversationGet(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const projectLink = await researchConversationProjectLink(context.userID, conversation);
  const feedbackByAnswerID = new Map(
    (await listStoredResearchFeedback(context.userID)).map((feedback) => [feedback.answerID, feedback])
  );
  const clientConversation = await researchConversationForClient(conversation, {
    checkSources: true,
    userID: context.userID,
    projectLink
  });
  sendJSON(response, 200, {
    conversation: {
      ...clientConversation,
      messages: (clientConversation.messages || []).map((message) => {
        const feedback = feedbackByAnswerID.get(message.id);
        return !feedback ? message : {
          ...message,
          feedback: {
            id: feedback.id,
            status: "candidate",
            category: feedback.category,
            userComment: feedback.userComment,
            professionalRole: feedback.professionalRole || "",
            supportingReference: feedback.supportingReference || "",
            updatedAt: feedback.userUpdatedAt || feedback.updatedAt
          }
        };
      })
    }
  });
}

async function handleResearchConversationRename(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(
    response,
    context.userID,
    context.body.conversationID
  );
  if (!conversation) return;
  if (typeof context.body.title !== "string") {
    sendError(response, 400, "Research title must be text.");
    return;
  }
  const title = context.body.title.replace(/\s+/g, " ").trim();
  if (!title) {
    sendError(response, 400, "Enter a Research title.");
    return;
  }
  if (title.length > 120) {
    sendError(response, 400, "Research title must contain no more than 120 characters.");
    return;
  }
  conversation.title = title;
  const updatedAt = new Date().toISOString();
  conversation.updatedAt = updatedAt > String(conversation.updatedAt || "")
    ? updatedAt
    : new Date(Date.parse(conversation.updatedAt) + 1).toISOString();
  await saveStoredResearchConversation(context.userID, conversation);
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
    conversation.primaryProjectID
      ? [{ projectID: conversation.primaryProjectID, domains: ["research"] }]
      : []
  );
  sendJSON(response, 200, {
    conversation: await researchConversationForClient(conversation, {
      checkSources: true,
      userID: context.userID
    }),
    artifactRevisions
  });
}

async function handleResearchAnswerList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  await migrateLegacyProjectFoundation(context.userID);
  const conversationID = String(context.body.conversationID || "").trim();
  const projectID = String(context.body.projectID || "").trim();
  const answers = (await listStoredResearchAnswers(context.userID))
    .filter((answer) => !conversationID || answer.conversationID === conversationID)
    .filter((answer) => !projectID || answer.projectID === projectID)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((answer) => ({
      id: answer.id,
      conversationID: answer.conversationID,
      projectID: answer.projectID || null,
      question: answer.question,
      conclusion: answer.answer?.conclusion || "",
      evidenceCount: answer.evidence?.length || 0,
      sectionIDs: Array.from(new Set(
        (answer.evidence || [])
          .map((evidence) => String(evidence.sectionID || "").trim())
          .filter(Boolean)
      )),
      reviewStatus: answer.reviewStatus,
      createdAt: answer.createdAt
    }));
  sendJSON(response, 200, { answers });
}

async function handleResearchAnswerGet(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  await migrateLegacyProjectFoundation(context.userID);
  const answerID = String(context.body.answerID || "").trim();
  const answer = (await listStoredResearchAnswers(context.userID))
    .find((item) => item.id === answerID);
  if (!answer) {
    sendError(response, 404, "Historical Research answer not found.");
    return;
  }
  const feedback = (await listStoredResearchFeedback(context.userID))
    .find((item) => item.answerID === answerID);
  sendJSON(response, 200, {
    answer: {
      ...researchAnswerRecordForClient(answer),
      userFeedback: feedback ? {
        id: feedback.id,
        category: feedback.category,
        userComment: feedback.userComment,
        professionalRole: feedback.professionalRole || "",
        supportingReference: feedback.supportingReference || "",
        updatedAt: feedback.userUpdatedAt || feedback.updatedAt
      } : answer.userFeedback
    }
  });
}

async function requireResearchProject(context, response, projectID) {
  if (!hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Project-linked Research requires Pro.",
      code: "PRO_REQUIRED_PROJECTS"
    });
    return null;
  }
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) {
    return null;
  }
  return access.project;
}

function researchConversationProjectLinkRecord(userID, conversationID, projectID, now, existing, options = {}) {
  const metadata = options.replaceMetadata === true || existing?.deletedAt
    ? { ...(options.metadata || {}) }
    : { ...(existing?.metadata || {}), ...(options.metadata || {}) };
  if (metadata.codeDecisionID) {
    delete metadata.codeDecisionLastID;
    delete metadata.codeDecisionUnlinkedAt;
    delete metadata.codeDecisionUnlinkedByUserID;
  }
  return projectLinkRecord({
    id: deterministicFoundationLinkID(userID, projectID, "researchConversation", conversationID),
    owner: ownerScope(userID),
    projectID,
    targetKind: "researchConversation",
    targetID: conversationID,
    relationship: "primary",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: Number(existing?.version || 0) + 1,
    metadata
  });
}

async function setResearchConversationProjectLink(userID, conversationID, projectID, now, options = {}) {
  const links = await listStoredProjectLinks(userID);
  const existing = links.find((link) =>
    link.projectID === projectID &&
    link.targetKind === "researchConversation" &&
    link.targetID === conversationID
  );
  const link = researchConversationProjectLinkRecord(
    userID,
    conversationID,
    projectID,
    now,
    existing,
    options
  );
  await saveStoredProjectLink(userID, link);
  return link;
}

async function researchConversationProjectLink(userID, conversation) {
  if (!conversation?.id || !conversation.primaryProjectID) return null;
  return (await listStoredProjectLinks(userID)).find((link) =>
    !link.deletedAt &&
    link.projectID === conversation.primaryProjectID &&
    link.targetKind === "researchConversation" &&
    link.targetID === conversation.id
  ) || null;
}

async function researchConversationLinksForCodeDecisions(userID, projectID) {
  const [conversations, links] = await Promise.all([
    listStoredResearchConversations(userID),
    listStoredProjectLinks(userID)
  ]);
  const conversationsByID = new Map(conversations
    .filter((conversation) => conversation.primaryProjectID === projectID)
    .map((conversation) => [conversation.id, conversation]));
  const byQuestionID = new Map();
  for (const link of links) {
    if (link.deletedAt || link.projectID !== projectID || !conversationsByID.has(link.targetID)) continue;
    const decisionLink = researchCodeDecisionLink(link);
    if (!decisionLink) continue;
    const current = byQuestionID.get(decisionLink.questionID);
    if (!current || Number(link.version || 0) > Number(current.link.version || 0)) {
      byQuestionID.set(decisionLink.questionID, {
        conversation: conversationsByID.get(link.targetID),
        link
      });
    }
  }
  return byQuestionID;
}

function clearedResearchCodeDecisionLinkRecord(existing, now, actorUserID = "") {
  const decisionLink = researchCodeDecisionLink(existing);
  const metadata = { ...(existing.metadata || {}) };
  delete metadata.codeDecisionID;
  delete metadata.codeDecisionLinkedAt;
  delete metadata.codeDecisionLinkedByUserID;
  delete metadata.codeDecisionPreviousQuestionID;
  delete metadata.codeDecisionReplacedConversationID;
  if (decisionLink?.questionID) {
    metadata.codeDecisionLastID = decisionLink.questionID;
    metadata.codeDecisionUnlinkedAt = now;
    metadata.codeDecisionUnlinkedByUserID = actorUserID || decisionLink.linkedByUserID || null;
  }
  return projectLinkRecord({
    ...existing,
    updatedAt: now,
    version: Number(existing.version || 1) + 1,
    metadata
  });
}

async function clearResearchCodeDecisionLink(userID, existing, now) {
  if (!researchCodeDecisionLink(existing)) return existing;
  const link = clearedResearchCodeDecisionLinkRecord(existing, now, userID);
  await replaceStoredResearchCodeDecisionLinks(userID, {
    link,
    expectedLink: existing
  });
  return link;
}

async function removeResearchConversationProjectLink(userID, conversationID, projectID, now) {
  const matchingLinks = (await listStoredProjectLinks(userID)).filter((link) =>
    link.projectID === projectID &&
    link.targetKind === "researchConversation" &&
    link.targetID === conversationID
  ).sort((left, right) => Number(right.version || 0) - Number(left.version || 0));
  const existing = matchingLinks.find((link) => !link.deletedAt);
  if (!existing) {
    return matchingLinks.find((link) =>
      link.deletedAt && String(link.metadata?.codeDecisionLastID || "").trim()
    ) || null;
  }
  const cleared = clearedResearchCodeDecisionLinkRecord(existing, now, userID);
  const link = projectLinkRecord({
    ...cleared,
    owner: ownerScope(userID),
    deletedAt: now
  });
  await replaceStoredResearchCodeDecisionLinks(userID, {
    link,
    expectedLink: existing
  });
  return link;
}

async function recordResearchProjectLinkActivity(userID, projectID, conversationID, action, now) {
  const access = await projectAccessForUser(userID, projectID);
  const storageOwnerUserID = access?.storageOwnerUserID || userID;
  return saveStoredActivityEvent(storageOwnerUserID, activityEvent({
    owner: access?.owner || ownerScope(userID),
    projectID,
    actorUserID: userID,
    action,
    objectKind: "researchConversation",
    objectID: conversationID,
    previousStatus: action === "item.unlinked" ? "linked" : null,
    newStatus: action === "item.unlinked" ? "unlinked" : "linked",
    createdAt: now
  }));
}

async function recordResearchConversationRemovalActivity(userID, projectID, removedLink, now) {
  const questionID = String(removedLink?.metadata?.codeDecisionLastID || "").trim();
  if (!questionID) {
    return recordResearchProjectLinkActivity(
      userID,
      projectID,
      removedLink.targetID,
      "item.unlinked",
      now
    );
  }
  const access = await projectAccessForUser(userID, projectID);
  return saveResearchCodeDecisionUnlinkActivity({
    actorUserID: userID,
    projectID,
    storageOwnerUserID: access?.storageOwnerUserID || userID,
    owner: access?.owner || ownerScope(userID)
  }, removedLink, questionID);
}

async function handleResearchConversationAssignProject(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const conversation = await requiredResearchConversation(
    response,
    context.userID,
    context.body.conversationID
  );
  if (!conversation) return;
  const targetProjectID = String(context.body.projectID || "").trim() || null;
  const currentProjectID = conversation.primaryProjectID || null;
  const requiresContextReview = Boolean(currentProjectID);
  if (targetProjectID === currentProjectID) {
    sendJSON(response, 200, {
      conversation: await researchConversationForClient(conversation, { userID: context.userID }),
      moved: false
    });
    return;
  }
  if (requiresContextReview && context.body.confirmMove !== true) {
    sendJSON(response, 409, {
      error: currentProjectID
        ? "Moving this conversation requires an explicit Project-context review."
        : "Assigning existing Research requires an explicit Project-context review.",
      code: "RESEARCH_PROJECT_REVIEW_REQUIRED",
      currentProjectID,
      targetProjectID
    });
    return;
  }
  const targetProject = targetProjectID
    ? await requireResearchProject(context, response, targetProjectID)
    : null;
  if (targetProjectID && !targetProject) return;
  const now = new Date().toISOString();
  if (currentProjectID) {
    let removedLink;
    try {
      removedLink = await removeResearchConversationProjectLink(
        context.userID,
        conversation.id,
        currentProjectID,
        now
      );
    } catch (error) {
      if (sendCodeQuestionError(response, error)) return;
      throw error;
    }
    if (removedLink) {
      await recordResearchConversationRemovalActivity(
        context.userID,
        currentProjectID,
        removedLink,
        now
      );
    }
  }
  if (targetProjectID) {
    await setResearchConversationProjectLink(
      context.userID,
      conversation.id,
      targetProjectID,
      now
    );
    await recordResearchProjectLinkActivity(
      context.userID,
      targetProjectID,
      conversation.id,
      "item.linked",
      now
    );
  }
  conversation.primaryProjectID = targetProjectID;
  conversation.codeVersion = defaultSyncCodeVersion;
  conversation.codeBasis = researchCodeBasis(
    targetProjectID,
    targetProjectID ? researchProjectInformation(targetProjectID, targetProject) : null,
    now
  );
  conversation.projectContext = targetProjectID ? {
    projectID: targetProjectID,
    facts: [],
    source: "user-provided",
    updatedAt: now
  } : null;
  conversation.projectContextReviewRequired = false;
  conversation.movedFromProjectID = currentProjectID;
  conversation.movedAt = now;
  conversation.updatedAt = now;
  await saveStoredResearchConversation(context.userID, conversation);
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID, [
    ...(currentProjectID ? [{
      projectID: currentProjectID,
      domains: ["activity", "foundation", "research"]
    }] : []),
    ...(targetProjectID ? [{
      projectID: targetProjectID,
      domains: ["activity", "foundation", "research"]
    }] : [])
  ]);
  sendJSON(response, 200, {
    conversation: await researchConversationForClient(conversation, { userID: context.userID }),
    moved: true,
    contextReviewRequired: conversation.projectContextReviewRequired,
    artifactRevisions
  });
}

async function handleResearchConversationProjectContext(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const conversation = await requiredResearchConversation(
    response,
    context.userID,
    context.body.conversationID
  );
  if (!conversation) return;
  const projectID = String(context.body.projectID || "").trim();
  if (!projectID || conversation.primaryProjectID !== projectID) {
    sendError(response, 409, "Review the context for the conversation's current Project.");
    return;
  }
  if (!await requireResearchProject(context, response, projectID)) return;
  if (!Array.isArray(context.body.facts) || context.body.facts.length > 20) {
    sendError(response, 400, "Project context must be an array of no more than 20 facts.");
    return;
  }
  if (context.body.facts.some((value) =>
    typeof value !== "string" || value.trim().length > 500
  )) {
    sendError(response, 400, "Each Project fact must be text with no more than 500 characters.");
    return;
  }
  const facts = context.body.facts
    .map((value) => normalizedResearchText(value, 500))
    .filter(Boolean);
  if (new Set(facts).size !== facts.length) {
    sendError(response, 400, "Project context contains duplicate facts.");
    return;
  }
  const now = new Date().toISOString();
  conversation.projectContext = {
    projectID,
    facts,
    source: "user-provided",
    updatedAt: now
  };
  conversation.projectContextReviewRequired = false;
  conversation.updatedAt = now;
  await saveStoredResearchConversation(context.userID, conversation);
  const event = activityEvent({
    owner: ownerScope(context.userID),
    projectID,
    actorUserID: context.userID,
    action: "research.project-context.reviewed",
    objectKind: "researchConversation",
    objectID: conversation.id,
    previousStatus: "review-required",
    newStatus: "reviewed",
    createdAt: now,
    metadata: { factCount: facts.length }
  });
  await saveStoredActivityEvent(context.userID, event);
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID, [{
    projectID,
    domains: ["activity", "foundation", "research"]
  }]);
  sendJSON(response, 200, {
    conversation: await researchConversationForClient(conversation, { userID: context.userID }),
    activity: event,
    artifactRevisions
  });
}

async function handleResearchConversationReuseEvidence(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const project = await requireResearchProject(context, response, projectID);
  if (!project) return;
  const answerID = String(context.body.answerID || "").trim();
  const answer = (await listStoredResearchAnswers(context.userID))
    .find((item) => item.id === answerID);
  if (!answer) {
    sendError(response, 404, "Historical Research answer not found.");
    return;
  }
  if ((await listStoredResearchConversations(context.userID)).length >= 200) {
    sendError(response, 409, "Delete an older research conversation before starting another.");
    return;
  }
  const sources = [];
  const relatedSectionIDs = new Set();
  const answerEvidence = Array.isArray(answer.evidence) ? answer.evidence : [];
  const pinnedEvidence = answerEvidence.filter((snapshot) =>
    snapshot?.provenance?.origin === "user_pinned"
  );
  const reusableEvidence = pinnedEvidence.length ? pinnedEvidence : answerEvidence;
  let unavailableAutomaticEvidenceCount = 0;
  try {
    for (const snapshot of reusableEvidence) {
      const visualSourceIDs = (snapshot.visualSources || []).map((source) => source.id);
      let resolved;
      try {
        resolved = await researchSourcesForSelection(
          snapshot.sectionID,
          snapshot.provenance?.userSelectedText || snapshot.passageText,
          {
            richSourceIDs: snapshot.structuredSource?.id
              ? [snapshot.structuredSource.id]
              : [],
            visualSourceIDs,
            visualReviewConfirmed: visualSourceIDs.length > 0
          }
        );
      } catch (error) {
        if (
          !pinnedEvidence.length &&
          [
            "INVALID_RESEARCH_SELECTION",
            "INVALID_RESEARCH_SECTION",
            "INVALID_RESEARCH_RICH_SOURCE",
            "INVALID_RESEARCH_VISUAL_SOURCE",
            "RESEARCH_VISUAL_REVIEW_REQUIRED"
          ].includes(error.code)
        ) {
          unavailableAutomaticEvidenceCount += 1;
          continue;
        }
        throw error;
      }
      resolved.forEach((source) => {
        if (source.kind === "selection") {
          sources.push({
            ...source,
            relationship: "Reused cited Research evidence from a historical answer",
            reusedFromAnswerID: answer.id,
            reusedFromEvidenceSnapshotID: snapshot.id
          });
        } else if (!relatedSectionIDs.has(source.sectionID)) {
          relatedSectionIDs.add(source.sectionID);
          sources.push(source);
        }
      });
    }
  } catch (error) {
    if ([
      "INVALID_RESEARCH_SELECTION",
      "INVALID_RESEARCH_SECTION",
      "INVALID_RESEARCH_RICH_SOURCE",
      "INVALID_RESEARCH_VISUAL_SOURCE",
      "RESEARCH_VISUAL_REVIEW_REQUIRED"
    ].includes(error.code)) {
      sendJSON(response, 409, {
        error: "The historical passage is no longer present in the current enacted-text library. Reopen the historical answer instead of generating new analysis from changed evidence.",
        code: "REUSED_EVIDENCE_NOT_CURRENT"
      });
      return;
    }
    throw error;
  }
  if (!sources.some((source) => source.kind === "selection")) {
    sendError(response, 422, "The historical answer has no reusable selected Research evidence.");
    return;
  }
  const now = new Date().toISOString();
  const projectInformation = researchProjectInformation(projectID, project);
  const conversation = {
    id: randomUUID(),
    title: defaultResearchConversationTitle(now),
    createdAt: now,
    updatedAt: now,
    codeVersion: defaultSyncCodeVersion,
    codeBasis: researchCodeBasis(projectID, projectInformation, now),
    evidenceSetVersion: 1,
    primaryProjectID: projectID,
    projectContext: {
      projectID,
      facts: [],
      source: "user-provided",
      updatedAt: now
    },
    projectContextReviewRequired: false,
    sourceStatus: "current",
    origin: {
      kind: "reusedEvidence",
      answerID: answer.id,
      sourceConversationID: answer.conversationID,
      reusedEvidenceCount: reusableEvidence.length - unavailableAutomaticEvidenceCount,
      unavailableAutomaticEvidenceCount
    },
    sources,
    messages: []
  };
  await saveStoredResearchConversation(context.userID, conversation);
  await setResearchConversationProjectLink(context.userID, conversation.id, projectID, now);
  await recordResearchProjectLinkActivity(
    context.userID,
    projectID,
    conversation.id,
    "item.linked",
    now
  );
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID, [{
    projectID,
    domains: ["activity", "foundation", "research"]
  }]);
  sendJSON(response, 201, {
    conversation: await researchConversationForClient(conversation, { userID: context.userID }),
    artifactRevisions
  });
}

async function handleResearchConversationCreate(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  try {
    if ((await listStoredResearchConversations(context.userID)).length >= 200) {
      sendError(response, 409, "Delete an older research conversation before starting another.");
      return;
    }
    const projectID = String(context.body.projectID || "").trim() || null;
    const project = projectID ? await requireResearchProject(context, response, projectID) : null;
    if (projectID && !project) return;
    const hasSelectionPayload = context.body.selections !== undefined ||
      String(context.body.sectionID || "").trim() ||
      String(context.body.selectedText || "").trim();
    const selections = hasSelectionPayload ? requestedResearchSelections(context.body) : [];
    await validateResearchSavedSelections(context.userID, selections);
    const resolved = selections.length
      ? await researchSourcesForSelections(selections)
      : { sources: [], addedSelections: [] };
    if (resolved.addedSelections.length > 24) {
      sendError(response, 409, "This conversation would exceed the maximum of 24 selected passages.");
      return;
    }
    assertResearchConversationVisualLimits(resolved.sources);
    const sources = resolved.sources;
    const now = new Date().toISOString();
    const projectInformation = projectID ? researchProjectInformation(projectID, project) : null;
    const conversation = {
      id: randomUUID(),
      title: defaultResearchConversationTitle(now),
      createdAt: now,
      updatedAt: now,
      codeVersion: defaultSyncCodeVersion,
      codeBasis: researchCodeBasis(projectID, projectInformation, now),
      evidenceSetVersion: 1,
      primaryProjectID: projectID,
      projectContext: projectID ? {
        projectID,
        facts: [],
        source: "user-provided",
        updatedAt: now
      } : null,
      projectContextReviewRequired: false,
      origin: selections.length
        ? researchOriginForSelections(selections, context.body.originSurface)
        : { kind: "chat" },
      sourceStatus: "current",
      sources,
      messages: []
    };
    await saveStoredResearchConversation(context.userID, conversation);
    if (projectID) {
      await setResearchConversationProjectLink(
        context.userID,
        conversation.id,
        projectID,
        now
      );
      await recordResearchProjectLinkActivity(
        context.userID,
        projectID,
        conversation.id,
        "item.linked",
        now
      );
    }
    const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
      projectID
        ? [{ projectID, domains: ["activity", "foundation", "research"] }]
        : []
    );
    sendJSON(response, 201, {
      conversation: await researchConversationForClient(conversation, { userID: context.userID }),
      artifactRevisions
    });
  } catch (error) {
    if ([
      "INVALID_RESEARCH_SELECTION",
      "INVALID_RESEARCH_SECTION",
      "INVALID_RESEARCH_RICH_SOURCE",
      "INVALID_RESEARCH_VISUAL_SOURCE",
      "RESEARCH_VISUAL_REVIEW_REQUIRED"
    ].includes(error.code)) {
      sendError(response, 400, error.message);
      return;
    }
    if (error.code === "RESEARCH_CONVERSATION_VISUAL_LIMIT") {
      sendError(response, 409, error.message);
      return;
    }
    if (error.code === "RESEARCH_SAVED_ITEM_NOT_FOUND") {
      sendError(response, 404, error.message);
      return;
    }
    if (error.code === "RESEARCH_SAVED_ITEM_SECTION_MISMATCH") {
      sendError(response, 400, error.message);
      return;
    }
    if (["INCOMPLETE_RESEARCH_SECTION", "ENOENT"].includes(error.code)) {
      sendError(response, 422, "This code section is incomplete and cannot be analyzed yet.");
      return;
    }
    throw error;
  }
}

async function handleResearchConversationEvidence(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  try {
    const selections = requestedResearchSelections(context.body);
    await validateResearchSavedSelections(context.userID, selections);
    const resolved = await researchSourcesForSelections(
      selections,
      conversation.sources || []
    );
    const existingSelectionCount = (conversation.sources || [])
      .filter((source) => source.kind === "selection").length;
    const addedSelectionCount = resolved.addedSelections.length;
    if (existingSelectionCount + addedSelectionCount > 24) {
      sendError(response, 409, "Adding this evidence would exceed the maximum of 24 selected passages.");
      return;
    }
    if (addedSelectionCount === 0) {
      sendJSON(response, 200, {
        conversation: await researchConversationForClient(conversation, { userID: context.userID }),
        replayed: true,
        addedSelectionCount: 0
      });
      return;
    }
    assertResearchConversationVisualLimits(resolved.sources);
    conversation.sources = resolved.sources;
    conversation.evidenceSetVersion = Number(conversation.evidenceSetVersion || 1) + 1;
    conversation.updatedAt = new Date().toISOString();
    conversation.sourceStatus = "current";
    await saveStoredResearchConversation(context.userID, conversation);
    const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
      conversation.primaryProjectID
        ? [{ projectID: conversation.primaryProjectID, domains: ["foundation", "research"] }]
        : []
    );
    sendJSON(response, 200, {
      conversation: await researchConversationForClient(conversation, { userID: context.userID }),
      replayed: false,
      addedSelectionCount,
      artifactRevisions
    });
  } catch (error) {
    if ([
      "INVALID_RESEARCH_SELECTION",
      "INVALID_RESEARCH_SECTION",
      "INVALID_RESEARCH_RICH_SOURCE",
      "INVALID_RESEARCH_VISUAL_SOURCE",
      "RESEARCH_VISUAL_REVIEW_REQUIRED"
    ].includes(error.code)) {
      sendError(response, 400, error.message);
      return;
    }
    if (error.code === "RESEARCH_CONVERSATION_VISUAL_LIMIT") {
      sendError(response, 409, error.message);
      return;
    }
    if (error.code === "RESEARCH_SAVED_ITEM_NOT_FOUND") {
      sendError(response, 404, error.message);
      return;
    }
    if (error.code === "RESEARCH_SAVED_ITEM_SECTION_MISMATCH") {
      sendError(response, 400, error.message);
      return;
    }
    if (["INCOMPLETE_RESEARCH_SECTION", "ENOENT"].includes(error.code)) {
      sendError(response, 422, "This code section is incomplete and cannot be analyzed yet.");
      return;
    }
    throw error;
  }
}

async function handleResearchConversationRefresh(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const current = await currentResearchEvidence(conversation);
  const evidenceByID = new Map(current.evidence.map((item) => [item.sectionID, item]));
  if (current.sourceStatuses.some((status) => status.blocking && !status.selectionPresent)) {
    sendJSON(response, 409, {
      error: "A selected passage, structured source, or visual attachment no longer matches the enacted library. Start a new research selection from the current code.",
      code: "RESEARCH_SELECTION_CHANGED",
      conversation: await researchConversationForClient(conversation, {
        checkSources: true,
        userID: context.userID
      })
    });
    return;
  }
  conversation.sources = conversation.sources.map((source) => {
    const evidence = evidenceByID.get(source.sectionID);
    return evidence ? {
      ...source,
      sectionNumber: evidence.sectionNumber,
      title: evidence.title,
      codePrefix: evidence.codePrefix,
      chapterNumber: evidence.chapterNumber,
      chapterTitle: evidence.chapterTitle,
      sectionGroupLabel: evidence.sectionGroupLabel,
      sectionGroupTitle: evidence.sectionGroupTitle,
      sectionTextHash: evidence.sectionTextHash,
      codeVersion: defaultSyncCodeVersion
    } : source;
  });
  conversation.sourceStatus = "current";
  conversation.evidenceSetVersion = Number(conversation.evidenceSetVersion || 1) + 1;
  conversation.updatedAt = new Date().toISOString();
  await saveStoredResearchConversation(context.userID, conversation);
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
    conversation.primaryProjectID
      ? [{ projectID: conversation.primaryProjectID, domains: ["foundation", "research"] }]
      : []
  );
  sendJSON(response, 200, {
    conversation: await researchConversationForClient(conversation, { userID: context.userID }),
    artifactRevisions
  });
}

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function monthlyResearchRequestLimit() {
  const configured = Number(process.env.PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 100_000 ? configured : 100;
}

function researchMockMode() {
  return process.env.NODE_ENV === "test" &&
    process.env.PERMITEXT_TEST_RESEARCH_MOCK === "1";
}

function nextMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function researchUsageSummary(_entries, options = {}) {
  const unlimited = hasActiveProEntitlement(options.entitlement);
  return {
    unlimited,
    mockMode: Boolean(options.mockMode),
    evidenceDiscoveryEnabled: Boolean(options.evidenceDiscoveryEnabled)
  };
}

async function internalResearchSpendReport() {
  const periodStart = currentMonthStart();
  const users = await researchSpendSince(periodStart);
  return {
    periodStart,
    generatedAt: new Date().toISOString(),
    internalMonthlyRequestGuardrail: monthlyResearchRequestLimit(),
    totals: {
      users: users.length,
      requests: users.reduce((total, item) => total + item.requests, 0),
      inputTokens: users.reduce((total, item) => total + item.inputTokens, 0),
      outputTokens: users.reduce((total, item) => total + item.outputTokens, 0),
      totalTokens: users.reduce((total, item) => total + item.totalTokens, 0),
      estimatedCostUSD: Number(users.reduce(
        (total, item) => total + item.estimatedCostUSD,
        0
      ).toFixed(6))
    },
    users
  };
}

async function handleResearchUsage(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const mockMode = researchMockMode();
  const entries = mockMode ? [] : await researchUsageSince(context.userID, currentMonthStart());
  sendJSON(response, 200, {
    usage: researchUsageSummary(entries, {
      mockMode,
      entitlement: context.authContext.entitlement,
      evidenceDiscoveryEnabled: evidenceDiscoveryFeatureEnabled() &&
        hasActiveResearchEntitlement(context.authContext.entitlement)
    })
  });
}

const researchFeedbackCategories = new Set([
  "helpful",
  "incorrect_misleading",
  "missing_information",
  "citation_problem",
  "other"
]);

const researchFeedbackProfessionalRoles = new Set([
  "",
  "architect_designer",
  "engineer",
  "code_zoning_consultant",
  "expeditor_filing_representative",
  "contractor",
  "owner_operator",
  "student",
  "other"
]);

async function handleResearchFeedback(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const answerID = String(context.body.answerID || "").trim();
  const category = String(context.body.category || "").trim();
  const comment = normalizedResearchText(context.body.comment, 2_000);
  const professionalRole = String(context.body.professionalRole || "").trim();
  const supportingReference = normalizedResearchText(context.body.supportingReference, 500);
  if (!researchFeedbackCategories.has(category)) {
    sendError(response, 400, "Choose a valid feedback category.");
    return;
  }
  if (!researchFeedbackProfessionalRoles.has(professionalRole)) {
    sendError(response, 400, "Choose a valid optional professional role.");
    return;
  }
  const answerIndex = (conversation.messages || []).findIndex((message) => message.id === answerID && message.role === "assistant");
  const answerMessage = conversation.messages?.[answerIndex];
  const questionMessage = [...(conversation.messages || []).slice(0, answerIndex)].reverse().find((message) => message.role === "user");
  if (!answerMessage || !questionMessage) {
    sendError(response, 404, "Research answer not found.");
    return;
  }
  const immutableAnswerRecord = (await listStoredResearchAnswers(context.userID))
    .find((item) => item.id === answerID);
  const existing = (await listStoredResearchFeedback(context.userID)).find((item) => item.answerID === answerID);
  const now = new Date().toISOString();
  const feedback = {
    id: existing?.id || randomUUID(),
    status: "candidate",
    conversationID: conversation.id,
    answerID,
    selectedEvidence: immutableAnswerRecord
      ? immutableAnswerRecord.evidence.map((snapshot) => ({
          sourceID: snapshot.sourceID,
          sectionID: snapshot.sectionID,
          sectionNumber: snapshot.sectionNumber,
          codePrefix: snapshot.codeBook,
          codeVersion: snapshot.sourceLibraryVersion,
          codeEdition: snapshot.codeEdition,
          selectedTextHash: snapshot.passageTextHash,
          evidenceSnapshotID: snapshot.id
        }))
      : (conversation.sources || []).filter((source) => source.kind === "selection").map((source) => ({
          sourceID: source.id,
          sectionID: source.sectionID,
          sectionNumber: source.sectionNumber,
          codePrefix: source.codePrefix,
          codeVersion: source.codeVersion,
          codeEdition: source.codeEdition || defaultResearchCodeEdition,
          selectedTextHash: source.selectedTextHash
        })),
    question: immutableAnswerRecord?.question || questionMessage.question,
    answer: immutableAnswerRecord?.answer || answerMessage.answer,
    citations: immutableAnswerRecord?.citations || answerMessage.answer?.citations || [],
    model: immutableAnswerRecord?.model || answerMessage.answer?.model || null,
    promptVersion: answerMessage.answer?.promptVersion || null,
    evidenceVersion: answerMessage.answer?.evidenceVersion || null,
    category,
    userComment: comment,
    professionalRole,
    supportingReference,
    triageStatus: "new",
    triageHistory: existing?.triageHistory || [],
    createdAt: existing?.createdAt || now,
    userUpdatedAt: now,
    updatedAt: now
  };
  await saveStoredResearchFeedback(context.userID, feedback);
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
    conversation.primaryProjectID
      ? [{ projectID: conversation.primaryProjectID, domains: ["research"] }]
      : []
  );
  sendJSON(response, existing ? 200 : 201, {
    feedback: {
      id: feedback.id,
      status: feedback.status,
      category: feedback.category,
      userComment: feedback.userComment,
      professionalRole: feedback.professionalRole,
      supportingReference: feedback.supportingReference,
      updatedAt: feedback.userUpdatedAt
    },
    artifactRevisions
  });
}

function internalConsoleIsLocal(request) {
  const address = String(request.socket?.remoteAddress || "");
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}

function internalConsoleEnabled(request) {
  return process.env.PERMITEXT_INTERNAL_CONSOLE === "1" ||
    Boolean(String(process.env.PERMITEXT_INTERNAL_OWNER_USER_IDS || "").trim()) ||
    (!process.env.VERCEL && internalConsoleIsLocal(request));
}

function internalConsoleHasLocalDevelopmentAccess(request) {
  return !process.env.VERCEL && internalConsoleIsLocal(request);
}

async function authenticatedInternalBody(request, response) {
  if (!internalConsoleEnabled(request)) {
    sendError(response, 404, "Not found.");
    return null;
  }
  const context = await authenticatedResearchBody(request, response);
  if (!context) return null;
  const ownerIDs = new Set(
    String(process.env.PERMITEXT_INTERNAL_OWNER_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (!internalConsoleHasLocalDevelopmentAccess(request) && !ownerIDs.has(context.userID)) {
    sendError(response, 403, "Owner access required.");
    return null;
  }
  return context;
}

async function readEvaluationReviews() {
  try {
    const reviews = JSON.parse(await readFile(evaluationReviewsPath, "utf8"));
    return reviews?.schemaVersion === 1 && Array.isArray(reviews.reviews)
      ? reviews
      : { schemaVersion: 1, reviews: [] };
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, reviews: [] };
    throw error;
  }
}

async function readEvaluationRuns() {
  try {
    const files = (await readdir(evaluationResultsPath))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 50);
    const runs = [];
    for (const file of files) {
      try {
        const run = JSON.parse(await readFile(join(evaluationResultsPath, file), "utf8"));
        if (run?.configuration && Array.isArray(run.results)) runs.push(run);
      } catch (error) {
        console.warn(`Skipped invalid evaluation result ${file}: ${error.message}`);
      }
    }
    return runs;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const reviewableCaseStatuses = new Set(["draft", "reviewed", "approved", "rejected"]);

function validateSupplementalEvaluationDataset(dataset, label) {
  if (dataset?.schemaVersion !== 1 || !Array.isArray(dataset.cases) || !dataset.cases.length) {
    throw new Error(`${label} evaluation dataset is invalid.`);
  }
  const ids = new Set();
  for (const testCase of dataset.cases) {
    const id = String(testCase?.id || "").trim();
    if (!id || ids.has(id) || !reviewableCaseStatuses.has(testCase.status)) {
      throw new Error(`${label} evaluation case ${id || "without an ID"} is invalid.`);
    }
    ids.add(id);
    const hasReviewer = Boolean(String(testCase.reviewer || "").trim());
    const hasReviewDate = Number.isFinite(Date.parse(testCase.reviewedAt || ""));
    if (hasReviewer !== hasReviewDate) {
      throw new Error(`${label} evaluation case ${id} has incomplete reviewer metadata.`);
    }
    if (["reviewed", "approved", "rejected"].includes(testCase.status) && !hasReviewer) {
      throw new Error(`${label} evaluation case ${id} needs reviewer metadata for status ${testCase.status}.`);
    }
  }
  return dataset;
}

async function readSupplementalEvaluationDataset(path, label) {
  return validateSupplementalEvaluationDataset(
    JSON.parse(await readFile(path, "utf8")),
    label
  );
}

async function zoningReviewEvidence(testCase) {
  return Promise.all((testCase.selectedEvidenceSectionIDs || []).map(async (sectionID) => {
    const [summary, section] = await Promise.all([
      zoningSectionSummary(sectionID),
      zoningSection(sectionID)
    ]);
    if (!summary || !section?.blocks?.length) {
      throw new Error(`Zoning review case ${testCase.id} references unavailable section ${sectionID}.`);
    }
    return {
      sectionID: String(sectionID),
      reference: `ZR ${summary.sectionNumber}`,
      title: summary.title,
      sourceURL: section.zoning?.sourceURL || "",
      version: section.zoning?.version || "",
      lastAmended: section.zoning?.lastAmended || null,
      previewText: section.previewText || section.blocks.map((block) => block.plainText || "").join(" ")
    };
  }));
}

async function handleInternalEvaluationData(request, response) {
  const context = await authenticatedInternalBody(request, response);
  if (!context) return;
  const dataset = JSON.parse(await readFile(evaluationCasesPath, "utf8"));
  validateEvaluationDataset(dataset);
  const [retrievalDataset, zoningDataset, runs, reviewStore, storedFeedback, researchSpend] = await Promise.all([
    readSupplementalEvaluationDataset(evidenceRetrievalCasesPath, "Evidence retrieval"),
    readSupplementalEvaluationDataset(zoningEvaluationCasesPath, "Zoning"),
    readEvaluationRuns(),
    readEvaluationReviews(),
    listAllStoredResearchFeedback(),
    internalResearchSpendReport()
  ]);
  const reviews = reviewStore.reviews;
  const feedbackRecords = storedFeedback.filter((item) => item.status === "candidate");
  const zoningReviewCases = await Promise.all(zoningDataset.cases.map(async (testCase) => ({
    ...testCase,
    selectedEvidence: await zoningReviewEvidence(testCase)
  })));
  sendJSON(response, 200, {
    dataset,
    retrievalDataset,
    zoningDataset,
    zoningReviewCases,
    runs,
    reviews,
    runReviewStatuses: Object.fromEntries(runs.map((run) => [
      run.configuration.runID,
      evaluationRunReviewStatus(run, reviews)
    ])),
    feedbackCandidates: feedbackRecords,
    feedbackRecords,
    researchSpend
  });
}

const researchFeedbackTriageStatuses = new Set([
  "new",
  "reviewing",
  "evaluation_candidate",
  "resolved",
  "dismissed"
]);

async function handleInternalFeedbackTriage(request, response) {
  const context = await authenticatedInternalBody(request, response);
  if (!context) return;
  if (!internalConsoleHasLocalDevelopmentAccess(request)) {
    sendError(response, 405, "Feedback triage can currently be changed only from the local owner console.");
    return;
  }
  const feedbackID = String(context.body.feedbackID || "").trim();
  const triageStatus = String(context.body.triageStatus || "").trim();
  const notes = normalizedResearchText(context.body.notes, 4_000);
  const reviewer = normalizedResearchText(context.body.reviewer, 120) || "Permitext owner";
  if (!feedbackID || !researchFeedbackTriageStatuses.has(triageStatus)) {
    sendError(response, 400, "Provide a feedback record and valid triage status.");
    return;
  }
  const existing = (await listAllStoredResearchFeedback()).find((item) => item.id === feedbackID);
  if (!existing || existing.status !== "candidate") {
    sendError(response, 404, "Feedback candidate not found.");
    return;
  }
  const now = new Date().toISOString();
  const triageEntry = {
    triageStatus,
    notes,
    reviewer,
    reviewedAt: now
  };
  const feedback = {
    ...existing,
    status: "candidate",
    triageStatus,
    triageNotes: notes,
    triagedBy: reviewer,
    triagedAt: now,
    triageHistory: [...(existing.triageHistory || []), triageEntry],
    updatedAt: now
  };
  const saved = await updateStoredResearchFeedback(feedbackID, feedback);
  if (!saved) {
    sendError(response, 404, "Feedback candidate not found.");
    return;
  }
  sendJSON(response, 200, { feedback });
}

async function handleInternalEvaluationReview(request, response) {
  const context = await authenticatedInternalBody(request, response);
  if (!context) return;
  if (!internalConsoleHasLocalDevelopmentAccess(request)) {
    sendError(response, 405, "Evaluation reviews can currently be changed only from the local owner console.");
    return;
  }
  const kind = String(context.body.kind || "");
  const caseID = String(context.body.caseID || "").trim();
  const runID = String(context.body.runID || "").trim();
  const decision = String(context.body.decision || "").trim();
  const notes = normalizedResearchText(context.body.notes, 4_000);
  const reviewer = normalizedResearchText(context.body.reviewer, 120) || "Permitext owner";
  const caseKinds = new Set(["case", "retrieval-case", "zoning-case"]);
  const allowedDecisions = kind === "run"
    ? new Set(["approved", "rejected"])
    : new Set(["approved", "revise", "rejected"]);
  if ((!caseKinds.has(kind) && kind !== "run") || !caseID || !allowedDecisions.has(decision)) {
    sendError(response, 400, "Provide a supported review with an approve, revise, or reject decision.");
    return;
  }
  let dataset = null;
  let datasetPath = null;
  if (kind === "case" || kind === "run") {
    dataset = JSON.parse(await readFile(evaluationCasesPath, "utf8"));
    validateEvaluationDataset(dataset);
    datasetPath = evaluationCasesPath;
  } else if (kind === "retrieval-case") {
    dataset = await readSupplementalEvaluationDataset(
      evidenceRetrievalCasesPath,
      "Evidence retrieval"
    );
    datasetPath = evidenceRetrievalCasesPath;
  } else {
    dataset = await readSupplementalEvaluationDataset(
      zoningEvaluationCasesPath,
      "Zoning"
    );
    datasetPath = zoningEvaluationCasesPath;
  }
  let reviewedRun = null;
  let reviewedResult = null;
  if (caseKinds.has(kind)) {
    if (!dataset.cases.some((item) => item.id === caseID)) {
      sendError(response, 404, "Evaluation case not found.");
      return;
    }
    if (kind === "retrieval-case" && decision === "approved") {
      const researchDataset = JSON.parse(await readFile(evaluationCasesPath, "utf8"));
      validateEvaluationDataset(researchDataset);
      const retrievalCase = dataset.cases.find((item) => item.id === caseID);
      const sourceResearchCase = researchDataset.cases.find(
        (item) => item.id === retrievalCase.sourceResearchCaseID
      );
      if (sourceResearchCase?.status !== "approved") {
        sendError(
          response,
          409,
          "Approve the linked Research evidence case before approving this retrieval scenario."
        );
        return;
      }
    }
  } else {
    if (!runID) {
      sendError(response, 400, "Run reviews require a run ID.");
      return;
    }
    reviewedRun = (await readEvaluationRuns()).find(
      (run) => String(run.configuration?.runID || "") === runID
    );
    if (!reviewedRun) {
      sendError(response, 404, "Evaluation run not found.");
      return;
    }
    reviewedResult = reviewedRun.results.find((result) => result.testCase?.id === caseID);
    if (!reviewedResult) {
      sendError(response, 404, "This evaluation case is not part of the selected run.");
      return;
    }
    if (reviewedResult.error || !reviewedResult.answer || !reviewedResult.scoring?.metrics) {
      sendError(response, 409, "Only a completed answer with scoring can receive a run review.");
      return;
    }
  }
  const scoreOverrides = {};
  const allowedOverrideDimensions = new Set(Object.keys(reviewedResult?.scoring?.metrics || {}));
  for (const [dimension, rawScore] of Object.entries(context.body.scoreOverrides || {})) {
    const score = Number(rawScore);
    if (
      kind !== "run" ||
      !allowedOverrideDimensions.has(dimension) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 4
    ) {
      sendError(response, 400, "Score overrides must use valid dimensions and values from 0 through 4.");
      return;
    }
    scoreOverrides[dimension] = Math.round(score * 100) / 100;
  }
  const now = new Date().toISOString();
  if (caseKinds.has(kind)) {
    const testCase = dataset.cases.find((item) => item.id === caseID);
    testCase.status = decision === "approved"
      ? "approved"
      : decision === "rejected" ? "rejected" : "draft";
    testCase.reviewer = reviewer;
    testCase.reviewedAt = now;
    if (kind === "case") {
      validateEvaluationDataset(dataset);
    } else {
      validateSupplementalEvaluationDataset(
        dataset,
        kind === "retrieval-case" ? "Evidence retrieval" : "Zoning"
      );
    }
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);
  }
  const reviewStore = await readEvaluationReviews();
  const review = {
    id: randomUUID(),
    kind,
    caseID,
    runID: kind === "run" ? runID : null,
    decision,
    scoreOverrides,
    notes,
    reviewer,
    reviewedAt: now
  };
  reviewStore.reviews.push(review);
  await writeFile(evaluationReviewsPath, `${JSON.stringify(reviewStore, null, 2)}\n`);
  sendJSON(response, 200, {
    review,
    runReviewStatus: reviewedRun
      ? evaluationRunReviewStatus(reviewedRun, reviewStore.reviews)
      : null
  });
}

async function handleResearchConversationMessage(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const question = normalizedResearchText(context.body.question, 2_000);
  if (question.length < 3) {
    sendError(response, 400, "Enter a research question.");
    return;
  }
  if ((conversation.messages || []).length >= 200) {
    sendError(response, 409, "This conversation reached 100 exchanges. Start a new research conversation to continue.");
    return;
  }
  if (conversation.projectContextReviewRequired) {
    sendJSON(response, 409, {
      error: "Review the user-provided Project context before generating another answer.",
      code: "RESEARCH_PROJECT_REVIEW_REQUIRED",
      conversation
    });
    return;
  }
  const progressResponse = researchProgressResponder(
    request,
    response,
    context.body.progressStream === "ndjson"
  );
  const researchRequestID = normalizedResearchText(context.body.requestID, 100);
  const replayedAnswer = researchRequestID
    ? (conversation.messages || []).find((message) =>
        message.role === "assistant" && message.researchRequestID === researchRequestID
      )
    : null;
  if (replayedAnswer) {
    for (const stage of replayedAnswer.researchProgress?.stages || []) {
      if (stage.state === "completed") progressResponse.progress(stage.id, "completed");
    }
    const mockMode = researchMockMode();
    const usageEntries = mockMode ? [] : await researchUsageSince(context.userID, currentMonthStart());
    progressResponse.json(200, {
      conversation: await researchConversationForClient(conversation, { userID: context.userID }),
      usage: researchUsageSummary(usageEntries, {
        mockMode,
        entitlement: context.authContext.entitlement
      }),
      replayed: true
    });
    return;
  }
  let researchReservationID = null;
  let researchReservationCreatedAt = null;
  let researchReservationCompleted = false;
  try {
    progressResponse.progress("preparing_question", "active");
    const current = await currentResearchEvidence(conversation);
    if (current.stale) {
      conversation.sourceStatus = "changed";
      await saveStoredResearchConversation(context.userID, conversation);
      progressResponse.json(409, {
        error: "The enacted passage, structured source, or visual attachment changed after it was added. Refresh the sources before asking another question.",
        code: "RESEARCH_SOURCE_CHANGED",
        conversation: { ...conversation, sourceStatuses: current.sourceStatuses }
      });
      return;
    }
    const selections = (conversation.sources || []).filter((source) => source.kind === "selection");
    const projectLink = await researchConversationProjectLink(context.userID, conversation);
    const decisionLink = researchCodeDecisionLink(projectLink);
    if (decisionLink && selections.length === 0) {
      progressResponse.json(422, {
        error: "Add approved enacted evidence before using Research from a Code Decision.",
        code: "RESEARCH_EVIDENCE_REQUIRED"
      });
      return;
    }
    const pinnedEvidence = selectedResearchEvidence(conversation, current.evidence);
    const projectInformation = await currentResearchProjectInformation(
      context.userID,
      conversation.primaryProjectID
    );
    const answerCodeBasis = researchCodeBasis(
      conversation.primaryProjectID,
      projectInformation,
      new Date().toISOString()
    );
    const manualProjectFacts = conversation.projectContext?.facts || [];
    const combinedProjectFacts = combinedResearchProjectFacts(
      projectInformation,
      manualProjectFacts
    );
    progressResponse.progress("preparing_question", "completed");
    const evidencePackage = await assembledResearchEvidenceForTurn({
      question,
      messages: conversation.messages || [],
      pinnedEvidence,
      originSurface: conversation.origin?.surface || "",
      projectFacts: combinedProjectFacts,
      topicContext: conversation.topicContext || null,
      onStage: progressResponse.progress
    });
    const conversationFactState = resolveResearchConversationFacts({
      question,
      topicDecision: evidencePackage.topicDecision,
      topicContext: conversation.topicContext || null
    });
    const conversationFactContext = researchConversationFactPromptContext(conversationFactState);
    const validUserFacts = Array.from(new Set([
      ...combinedProjectFacts,
      ...conversationFactContext.established,
      ...conversationFactContext.hypothetical
    ].filter(Boolean)));
    const turnRetrievalLimitations = [
      ...(evidencePackage.limitations || []),
      ...(answerCodeBasis.limitation ? [{ code: "RESEARCH_CODE_VERSION_FALLBACK", text: answerCodeBasis.limitation }] : [])
    ];
    const assembledEvidence = evidencePackage.sources || [];
    if (!assembledEvidence.length) {
      progressResponse.progress("checking_citation_support", "active");
      progressResponse.json(422, {
        error: "Permitext could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation.",
        code: "RESEARCH_EVIDENCE_NOT_FOUND",
        retrieval: {
          assemblyVersion: evidencePackage.assemblyVersion,
          limitations: evidencePackage.limitations,
          discovery: evidencePackage.discovery
        }
      });
      return;
    }
    progressResponse.progress("checking_citation_support", "active");
    const requiredClaims = requiredResearchClaimsFromEvidence(assembledEvidence);
    const materialityClaims = requiredClaims.map((claim) => ({
      ...claim,
      claimRole: "governing"
    }));
    const mockMode = researchMockMode();
    const usageEntries = mockMode ? [] : await researchUsageSince(context.userID, currentMonthStart());
    const requestLimit = monthlyResearchRequestLimit();
    if (!mockMode) {
      researchReservationID = randomUUID();
      researchReservationCreatedAt = new Date().toISOString();
      const reserved = await reserveResearchUsage(context.userID, {
        id: researchReservationID,
        since: currentMonthStart(),
        limit: requestLimit,
        createdAt: researchReservationCreatedAt
      });
      if (!reserved) {
        researchReservationID = null;
        progressResponse.json(429, {
          error: "Research is temporarily unavailable while account capacity is reviewed.",
          code: "RESEARCH_CAPACITY_REVIEW"
        });
        return;
      }
    }
    const projectContextCapturedAt = new Date().toISOString();
    let decisionContextSnapshot = null;
    if (decisionLink && conversation.primaryProjectID) {
      const projectAccess = await projectAccessForUser(context.userID, conversation.primaryProjectID);
      const linkedQuestion = projectAccess
        ? await codeQuestionForProject(
            projectAccess.storageOwnerUserID,
            conversation.primaryProjectID,
            decisionLink.questionID
          )
        : null;
      if (linkedQuestion) {
        decisionContextSnapshot = {
          projectID: conversation.primaryProjectID,
          questionID: linkedQuestion.envelope.id,
          definitionRevision: linkedQuestion.payload.definitionRevision,
          definitionHash: codeQuestionContentHash({
            questionText: linkedQuestion.payload.questionText,
            scope: linkedQuestion.payload.scope || "",
            jurisdiction: linkedQuestion.payload.jurisdiction || "",
            asOfDate: linkedQuestion.payload.asOfDate || null,
            definitionRevision: linkedQuestion.payload.definitionRevision
          }),
          capturedAt: projectContextCapturedAt
        };
      }
    }
    const webSupportRequested = shouldUseResearchWebSupport({
      question,
      outsideLibraryRequired: Boolean(evidencePackage.discovery?.outsideCurrentLibrary?.length)
    });
    const webSupport = !mockMode && webSupportRequested
      ? await openAIResearchWebSupport(question, context.userID, {
          retrievalQuery: question,
          signal: progressResponse.signal
        })
      : {
          summary: "",
          sources: [],
          usage: combinedResearchUsage(),
          searched: false,
          sourcePolicyVersion: researchSourcePolicyVersion
        };
    const evidenceAnalysisResult = mockMode
      ? {
          analysis: mockResearchEvidenceAnalysis(
            assembledEvidence,
            validUserFacts,
            turnRetrievalLimitations
          ),
          model: "permitext-mock",
          usage: combinedResearchUsage()
        }
      : await openAIResearchEvidenceAnalysis(question, assembledEvidence, context.userID, {
          messages: conversation.messages,
          projectContextFacts: combinedProjectFacts,
          conversationFactContext,
          validUserFacts,
          retrievalLimitations: turnRetrievalLimitations,
          codeBasis: answerCodeBasis,
          requiredClaims,
          signal: progressResponse.signal
        });
    progressResponse.progress("checking_citation_support", "completed");
    progressResponse.progress("preparing_conclusion", "active");
    let result = mockMode
      ? {
          interpretation: validateResearchInterpretation(mockResearchInterpretation(question, assembledEvidence, {
            responseStyle: "conversational"
          }), assembledEvidence, webSupport.sources),
          model: "permitext-mock",
          configuration: {
            ...researchModelConfiguration(),
            promptVersion: `${researchModelConfiguration().promptVersion}:conversational-v2`,
            evidenceVersion: `${researchEvidenceAssemblyVersion}:structured-v1`
          },
          usage: combinedResearchUsage()
        }
      : await openAIResearchInterpretation(question, assembledEvidence, context.userID, {
          selections,
          messages: conversation.messages,
          projectContextFacts: combinedProjectFacts,
          conversationFactContext,
          responseStyle: "conversational",
          structuredEvidenceAnalysis: evidenceAnalysisResult.analysis,
          webSupport,
          codeBasis: answerCodeBasis,
          requiredClaims,
          signal: progressResponse.signal
        });
    let verificationAttempts = [];
    let verifierUsage = combinedResearchUsage();
    let answerGenerationUsage = result.usage;
    let requiredClaimCoverage = evaluateResearchRequiredClaimCoverage({
      requiredClaims,
      evidence: assembledEvidence,
      answer: result.interpretation
    });
    let claimMateriality = evaluateResearchClaimMateriality({
      claims: materialityClaims,
      evidence: assembledEvidence,
      answer: result.interpretation
    });
    let answerQuality = evaluateResearchAnswerQuality({
      evidence: assembledEvidence,
      answer: result.interpretation
    });
    if (mockMode) {
      verificationAttempts = [{
        pass: requiredClaimCoverage.pass && claimMateriality.pass && answerQuality.pass,
        issues: requiredClaimCoverage.pass && claimMateriality.pass && answerQuality.pass
          ? []
          : combinedResearchAnswerRevisionIssues(requiredClaimCoverage, claimMateriality, answerQuality),
        model: requiredClaimCoverage.pass && claimMateriality.pass && answerQuality.pass
          ? "permitext-mock"
          : "permitext-deterministic-answer-quality-gate"
      }];
      if (!requiredClaimCoverage.pass || !claimMateriality.pass || !answerQuality.pass) {
        const error = new Error("The mock Research answer failed deterministic materiality or evidence-economy checks.");
        error.code = "RESEARCH_VERIFICATION_FAILED";
        error.verificationAttempts = verificationAttempts;
        throw error;
      }
    } else {
      for (let attempt = 0; attempt < maximumResearchVerificationAttempts; attempt += 1) {
        if (attempt > 0) {
          const revised = await openAIResearchInterpretation(question, assembledEvidence, context.userID, {
            selections,
            messages: conversation.messages,
            projectContextFacts: combinedProjectFacts,
            conversationFactContext,
            responseStyle: "conversational",
            structuredEvidenceAnalysis: evidenceAnalysisResult.analysis,
            webSupport,
            codeBasis: answerCodeBasis,
            requiredClaims,
            revisionFeedback: accumulatedResearchVerificationIssues(verificationAttempts),
            signal: progressResponse.signal
          });
          answerGenerationUsage = combinedResearchUsage(answerGenerationUsage, revised.usage);
          result = revised;
        }
        requiredClaimCoverage = evaluateResearchRequiredClaimCoverage({
          requiredClaims,
          evidence: assembledEvidence,
          answer: result.interpretation
        });
        claimMateriality = evaluateResearchClaimMateriality({
          claims: materialityClaims,
          evidence: assembledEvidence,
          answer: result.interpretation
        });
        answerQuality = evaluateResearchAnswerQuality({
          evidence: assembledEvidence,
          answer: result.interpretation
        });
        if (!requiredClaimCoverage.pass || !claimMateriality.pass || !answerQuality.pass) {
          verificationAttempts.push({
            pass: false,
            issues: combinedResearchAnswerRevisionIssues(requiredClaimCoverage, claimMateriality, answerQuality),
            model: "permitext-deterministic-answer-quality-gate"
          });
          if (attempt === maximumResearchVerificationAttempts - 1) {
            const error = new Error("The answer failed deterministic materiality or evidence-economy checks after two bounded revisions.");
            error.code = "RESEARCH_VERIFICATION_FAILED";
            error.verificationAttempts = verificationAttempts;
            throw error;
          }
          continue;
        }
        const verification = await openAIResearchVerification(
          question,
          assembledEvidence,
          result.interpretation,
          context.userID,
          {
            projectContextFacts: combinedProjectFacts,
            conversationFactContext,
            webSupport,
            codeBasis: answerCodeBasis,
            requiredClaims,
            signal: progressResponse.signal
          }
        );
        verifierUsage = combinedResearchUsage(verifierUsage, verification.usage);
        verificationAttempts.push({
          ...verification.result,
          model: verification.model
        });
        if (verification.result.pass) break;
        if (attempt === maximumResearchVerificationAttempts - 1) {
          const error = new Error("The answer did not pass verification after two bounded revisions.");
          error.code = "RESEARCH_VERIFICATION_FAILED";
          error.verificationAttempts = verificationAttempts;
          throw error;
        }
      }
    }
    result.usage = combinedResearchUsage(
      webSupport.usage,
      evidenceAnalysisResult.usage,
      answerGenerationUsage,
      verifierUsage
    );
    const estimatedCost = estimatedResearchCost(result.usage);
    const now = new Date().toISOString();
    progressResponse.progress("preparing_conclusion", "completed");
    const disclaimer = "AI-generated research assistance, not an official code determination.";
    const materialAssembledEvidence = assembledEvidence.filter((section) =>
      !["contextual", "irrelevant"].includes(section?.evidencePriority?.evidenceRole)
    );
    const contextualAssembledEvidence = assembledEvidence.filter((section) =>
      section?.evidencePriority?.evidenceRole === "contextual"
    );
    const userMessage = {
      id: randomUUID(),
      role: "user",
      question,
      createdAt: now,
      ...(researchRequestID ? { researchRequestID } : {})
    };
    const assistantMessage = {
      id: randomUUID(),
      role: "assistant",
      createdAt: now,
      ...(researchRequestID ? { researchRequestID } : {}),
      researchProgress: progressResponse.summary(now),
      answer: {
        mode: mockMode ? "mock" : "openai",
        model: result.model,
        requestedModel: result.requestedModel || result.model,
        promptVersion: result.configuration.promptVersion,
        evidenceVersion: result.configuration.evidenceVersion,
        codeEdition: answerCodeBasis.codeEdition,
        codeVersion: answerCodeBasis.codeVersion,
        codeBasis: answerCodeBasis,
        ...result.interpretation,
        followUpQuestions: result.interpretation.followUpQuestions?.length
          ? result.interpretation.followUpQuestions
          : evidenceAnalysisResult.analysis.highValueFollowUpQuestions,
        evidenceSectionIDs: Array.from(new Set(assembledEvidence.map((section) => section.sectionID))),
        evidenceSourceIDs: assembledEvidence.map((section) => section.sourceID),
        sourceSummary: {
          enactedProvisionCount: new Set(materialAssembledEvidence.map((section) => section.sectionID)).size,
          contextualProvisionCount: new Set(contextualAssembledEvidence.map((section) => section.sectionID)).size,
          citedProvisionCount: answerQuality.evidenceEconomy.citedProvisionCount,
          governingCitationCount: answerQuality.evidenceEconomy.governingCitationCount,
          supportingCitationCount: answerQuality.evidenceEconomy.supportingCitationCount,
          contextualCitationCount: answerQuality.evidenceEconomy.contextualCitationCount,
          reviewedOnlyProvisionCount: answerQuality.evidenceEconomy.reviewedOnlyProvisionCount,
          userPinnedCount: materialAssembledEvidence.filter((section) => section.origin === "user_pinned").length,
          permitextDiscoveredCount: materialAssembledEvidence.filter((section) => section.origin === "permitext_discovered").length,
          crossReferenceCount: materialAssembledEvidence.filter((section) => section.origin === "permitext_cross_reference").length,
          supportingWebSourceCount: result.interpretation.supportingSources?.length || 0,
          unresolvedProjectFactCount: result.interpretation.missingFacts?.length || 0,
          requiredClaimCount: requiredClaimCoverage.requiredClaimCount
        },
        structuredEvidenceAnalysis: evidenceAnalysisResult.analysis,
        factUsage: researchFactUsageDisclosure({
          factsUsed: evidenceAnalysisResult.analysis.projectFactsUsed,
          projectFacts: combinedProjectFacts,
          conversationFactContext
        }),
        conversationFacts: conversationFactState,
        requiredClaimCoverage,
        claimMateriality,
        answerQuality,
        retrieval: {
          schemaVersion: evidencePackage.schemaVersion,
          assemblyVersion: evidencePackage.assemblyVersion,
          retrievalQuery: evidencePackage.retrievalQuery,
          previousTopicApplied: evidencePackage.previousTopicApplied,
          projectFactsApplied: evidencePackage.projectFactsApplied,
          topicDecision: evidencePackage.topicDecision,
          conversationFactsVersion: researchConversationFactsVersion,
          sourceMode: evidencePackage.sourceMode,
          sourceScope: evidencePackage.sourceScope,
          strategy: evidencePackage.strategy,
          limits: evidencePackage.limits,
          usage: evidencePackage.usage,
          limitations: turnRetrievalLimitations,
          discovery: evidencePackage.discovery,
          sourcePolicyVersion: researchSourcePolicyVersion,
          codeBasis: answerCodeBasis,
          webSupportRequested,
          webSupportSearched: Boolean(webSupport.searched),
          webQuery: webSupport.sanitizedQuery || null,
          webLimitation: webSupport.limitation || null
        },
        verification: {
          status: "passed",
          pass: true,
          attempts: verificationAttempts.length,
          regenerated: verificationAttempts.length > 1,
          history: verificationAttempts
        },
        disclaimer
      }
    };
    const evidenceSnapshots = assembledEvidence.map((source) => immutableEvidenceSnapshot({
      source,
      approvedAt: now,
      evidenceSetVersion: Number(conversation.evidenceSetVersion || 1),
      sourceLibraryVersion: source.codeVersion || conversation.codeVersion
    }));
    const answerRecord = {
      ...immutableResearchAnswer({
        id: assistantMessage.id,
        owner: ownerScope(context.userID),
        conversationID: conversation.id,
        projectID: conversation.primaryProjectID || null,
        question,
        answer: assistantMessage.answer,
        evidence: evidenceSnapshots,
        citations: assistantMessage.answer.citations || [],
        model: assistantMessage.answer.model,
        researchSystemVersion: [
          assistantMessage.answer.promptVersion,
          assistantMessage.answer.evidenceVersion,
          researchSourcePolicyVersion,
          researchRequiredClaimCoverageVersion,
          researchClaimMaterialityVersion,
          researchConversationFactsVersion
        ].filter(Boolean).join(":"),
        createdAt: now
      }),
      projectContextSnapshot: {
        projectID: conversation.primaryProjectID || null,
        projectInformation,
        manualFacts: [...manualProjectFacts],
        combinedFacts: combinedProjectFacts,
        capturedAt: projectContextCapturedAt
      },
      conversationFactSnapshot: conversationFactState,
      ...(decisionContextSnapshot ? { decisionContextSnapshot } : {})
    };
    conversation.codeVersion = answerCodeBasis.codeVersion;
    conversation.codeBasis = answerCodeBasis;
    conversation.topicContext = {
      version: evidencePackage.topicDecision?.version || null,
      originalTopic: normalizedResearchText(
        conversation.topicContext?.originalTopic ||
        evidencePackage.topicDecision?.rootTopic?.text ||
        question,
        2_000
      ),
      rootTopic: normalizedResearchText(
        evidencePackage.topicDecision?.nextRootTopic?.text || question,
        2_000
      ),
      currentTopic: normalizedResearchText(
        evidencePackage.topicDecision?.nextCurrentTopic?.text || question,
        2_000
      ),
      lastDecision: evidencePackage.topicDecision?.decision || null,
      factTopics: conversationFactState.nextFactTopics,
      updatedAt: now
    };
    conversation.starterQuestion ||= question;
    conversation.messages.push(userMessage, assistantMessage);
    conversation.updatedAt = now;
    delete conversation.historyHiddenAt;
    conversation.sourceStatus = "current";
    const activityEvents = conversation.primaryProjectID
      ? [
          activityEvent({
            owner: ownerScope(context.userID),
            projectID: conversation.primaryProjectID,
            actorUserID: context.userID,
            action: "research.question.submitted",
            objectKind: "researchConversation",
            objectID: conversation.id,
            newStatus: "submitted",
            createdAt: now,
            metadata: { answerID: assistantMessage.id }
          }),
          activityEvent({
            owner: ownerScope(context.userID),
            projectID: conversation.primaryProjectID,
            actorUserID: context.userID,
            action: "research.answer.generated",
            objectKind: "researchAnswer",
            objectID: assistantMessage.id,
            newStatus: "generated",
            createdAt: now,
            metadata: { conversationID: conversation.id }
          })
        ]
      : [];
    // Usage completion is part of the same durable commit as answer + conversation (+ events).
    progressResponse.assertActive();
    await commitResearchConversationMessage(context.userID, {
      reservationID: mockMode ? null : researchReservationID,
      usageEntry: mockMode ? null : {
        model: result.model,
        requestedModel: result.requestedModel || result.model,
        mode: "openai",
        ...result.usage,
        promptVersion: result.configuration.promptVersion,
        evidenceVersion: result.configuration.evidenceVersion,
        estimatedCostUSD: estimatedCost.estimatedUSD,
        pricingVersion: estimatedCost.pricingVersion,
        createdAt: researchReservationCreatedAt
      },
      answer: answerRecord,
      conversation,
      events: activityEvents
    });
    researchReservationCompleted = !mockMode && Boolean(researchReservationID);
    const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
      conversation.primaryProjectID
        ? [{
            projectID: conversation.primaryProjectID,
            domains: ["activity", "foundation", "research"]
          }]
        : []
    );
    console.info(JSON.stringify({
      event: "research_conversation_message",
      user: createHash("sha256").update(context.userID).digest("hex").slice(0, 16),
      mode: mockMode ? "mock" : "openai",
      model: result.model,
      conversation: createHash("sha256").update(conversation.id).digest("hex").slice(0, 16),
      evidenceSections: new Set(assembledEvidence.map((section) => section.sectionID)).size,
      evidencePassages: assembledEvidence.length,
      totalTokens: result.usage.totalTokens
    }));
    progressResponse.json(200, {
      conversation: await researchConversationForClient(conversation, { userID: context.userID }),
      usage: researchUsageSummary(mockMode ? [] : [
        ...usageEntries,
        {
          ...result.usage,
          estimatedCostUSD: estimatedCost.estimatedUSD,
          pricingVersion: estimatedCost.pricingVersion
        }
      ], { mockMode, entitlement: context.authContext.entitlement }),
      artifactRevisions
    });
  } catch (error) {
    if (researchReservationID && !researchReservationCompleted) {
      try {
        await releaseResearchUsageReservation(context.userID, researchReservationID);
      } catch (releaseError) {
        console.error("Failed to release Research usage reservation.", releaseError);
      }
    }
    if (["INCOMPLETE_RESEARCH_SECTION", "ENOENT"].includes(error.code)) {
      progressResponse.failActive("failed");
      progressResponse.error(422, "A cited code section is incomplete and cannot be analyzed yet.");
      return;
    }
    if (error.code === "RESEARCH_NOT_CONFIGURED") {
      progressResponse.failActive("failed");
      progressResponse.error(503, error.message);
      return;
    }
    if (error.code === "RESEARCH_EVAL_SPEND_CAP") {
      progressResponse.failActive("failed");
      progressResponse.error(503, error.message);
      return;
    }
    if (error.code === "RESEARCH_REFUSAL") {
      progressResponse.failActive("failed");
      progressResponse.error(422, error.message);
      return;
    }
    if (["RESEARCH_CANCELLED", "AbortError"].includes(error.code || error.name)) {
      progressResponse.failActive("cancelled");
      progressResponse.error(499, "Research was cancelled.", { code: "RESEARCH_CANCELLED" });
      return;
    }
    if ([
      "INVALID_RESEARCH_RESPONSE",
      "INVALID_RESEARCH_CITATION",
      "INVALID_RESEARCH_WEB_CITATION",
      "INVALID_RESEARCH_EVIDENCE_ANALYSIS",
      "INVALID_RESEARCH_VERIFICATION",
      "RESEARCH_VERIFIER_ERROR",
      "RESEARCH_VERIFICATION_FAILED",
      "RESEARCH_PROVIDER_ERROR",
      "TimeoutError"
    ].includes(error.code || error.name)) {
      console.warn(JSON.stringify({
        event: "research_conversation_failure",
        user: createHash("sha256").update(context.userID).digest("hex").slice(0, 16),
        conversation: createHash("sha256").update(conversation.id).digest("hex").slice(0, 16),
        code: error.code || error.name,
        message: String(error.message || "").slice(0, 500),
        verificationAttempts: Array.isArray(error.verificationAttempts)
          ? error.verificationAttempts.map((attempt) => ({ pass: attempt.pass, issues: attempt.issues }))
          : [],
        providerStatus: error.providerStatus || null,
        incompleteReason: error.incompleteReason || null,
        providerUsage: error.providerUsage || null,
        bindingIssue: error.bindingIssue || null,
        providerCause: error.providerCause || null
      }));
      progressResponse.failActive("failed");
      progressResponse.error(502, "The research model could not return a verified, cited answer.");
      return;
    }
    throw error;
  }
}

async function handleResearchConversationDelete(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversationID = String(context.body.conversationID || "").trim();
  const conversation = await storedResearchConversation(context.userID, conversationID);
  if (!conversation) {
    sendError(response, 404, "Research conversation not found.");
    return;
  }
  if (conversation?.primaryProjectID) {
    const now = new Date().toISOString();
    let removedLink;
    try {
      removedLink = await removeResearchConversationProjectLink(
        context.userID,
        conversation.id,
        conversation.primaryProjectID,
        now
      );
    } catch (error) {
      if (sendCodeQuestionError(response, error)) return;
      throw error;
    }
    if (removedLink) {
      await recordResearchConversationRemovalActivity(
        context.userID,
        conversation.primaryProjectID,
        removedLink,
        now
      );
    }
  }
  const deleted = await deleteStoredResearchConversation(context.userID, conversationID);
  if (!deleted) {
    sendError(response, 409, "Research conversation changed before it could be deleted. Refresh and try again.");
    return;
  }
  const artifactRevisions = await bumpResearchArtifactRevisions(context.userID,
    conversation.primaryProjectID
      ? [{
          projectID: conversation.primaryProjectID,
          domains: ["activity", "foundation", "research"]
        }]
      : []
  );
  sendJSON(response, 200, { deleted: true, artifactRevisions });
}

async function handleResearchConversationClearHistory(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const requestedConversationIDs = Array.isArray(context.body.conversationIDs)
    ? new Set(context.body.conversationIDs.map((value) => String(value || "").trim()).filter(Boolean))
    : null;
  if (requestedConversationIDs && requestedConversationIDs.size > 500) {
    sendError(response, 400, "Select no more than 500 Research conversations at once.");
    return;
  }
  const allConversations = await listStoredResearchConversations(context.userID);
  const conversations = requestedConversationIDs
    ? allConversations.filter((conversation) => requestedConversationIDs.has(conversation.id))
    : allConversations;
  const now = new Date().toISOString();
  let hiddenProjectConversationCount = 0;
  let deletedConversationCount = 0;
  for (const conversation of conversations) {
    if (conversation?.primaryProjectID) {
      await saveStoredResearchConversation(context.userID, { ...conversation, historyHiddenAt: now });
      hiddenProjectConversationCount += 1;
    } else if (await deleteStoredResearchConversation(context.userID, conversation.id)) {
      deletedConversationCount += 1;
    }
  }
  const artifactRevisions = conversations.length
    ? await bumpResearchArtifactRevisions(context.userID)
    : null;
  sendJSON(response, 200, {
    cleared: true,
    hiddenProjectConversationCount,
    deletedConversationCount,
    totalCount: conversations.length,
    ...(artifactRevisions ? { artifactRevisions } : {})
  });
}

async function handleResearchEvidenceDiscover(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  if (!evidenceDiscoveryFeatureEnabled()) {
    sendJSON(response, 403, {
      error: "Find Relevant Evidence is not enabled for this private beta.",
      code: "EVIDENCE_DISCOVERY_NOT_ENABLED"
    });
    return;
  }
  const projectID = String(context.body.projectID || "").trim();
  if (projectID) {
    const access = await requireProjectPermission(
      response,
      context.userID,
      projectID,
      organizationPermissions.projectView
    );
    if (!access) return;
  }
  try {
    const discovery = await discoverRelevantEvidence({
      question: context.body.question,
      catalog: await sectionCatalog(),
      invertedIndex: await shippedSearchIndex(),
      readSectionBody: (section) => sectionBody(section.webSectionID || section.id, {
        allowMissing: true,
        canonicalSectionID: section.id
      }),
      resolveVisualSource: constructionVisualSourceMetadata,
      limit: context.body.limit
    });
    sendJSON(response, 200, {
      ...discovery,
      projectID: projectID || null,
      generatedAnswer: false,
      paidModelCall: false
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid evidence discovery request.",
      code: "INVALID_EVIDENCE_DISCOVERY"
    });
  }
}

async function handleResearchCandidateDisposition(request, response) {
  const context = await authenticatedResearchBody(request, response, { requireResearch: true });
  if (!context) return;
  if (!evidenceDiscoveryFeatureEnabled()) {
    sendJSON(response, 403, {
      error: "Candidate evidence discovery is not enabled for this account.",
      code: "EVIDENCE_DISCOVERY_NOT_ENABLED"
    });
    return;
  }
  const conversation = await requiredResearchConversation(
    response,
    context.userID,
    context.body.conversationID
  );
  if (!conversation) return;
  const projectID = String(context.body.projectID || "").trim();
  const questionID = String(context.body.questionID || "").trim();
  const question = String(context.body.question || "").replace(/\s+/g, " ").trim();
  const candidateID = String(context.body.candidateID || "").trim();
  const disposition = String(context.body.disposition || "").trim();
  if (!projectID || !questionID || question.length < 3 || !candidateID || !["rejected", "restored"].includes(disposition)) {
    sendError(response, 400, "A linked Code Decision, candidate, question, and valid disposition are required.");
    return;
  }
  const projectLink = await researchConversationProjectLink(context.userID, conversation);
  const decisionLink = researchCodeDecisionLink(projectLink);
  if (
    conversation.primaryProjectID !== projectID ||
    decisionLink?.questionID !== questionID
  ) {
    sendJSON(response, 409, {
      error: "This candidate no longer belongs to the active Code Decision Research conversation.",
      code: "RESEARCH_CANDIDATE_CONTEXT_CHANGED"
    });
    return;
  }
  try {
    const discovery = await discoverRelevantEvidence({
      question,
      catalog: await sectionCatalog(),
      invertedIndex: await shippedSearchIndex(),
      readSectionBody: (section) => sectionBody(section.webSectionID || section.id, {
        allowMissing: true,
        canonicalSectionID: section.id
      }),
      resolveVisualSource: constructionVisualSourceMetadata,
      limit: 12
    });
    const candidate = discovery.candidates.find((item) => item.id === candidateID);
    if (!candidate) {
      sendJSON(response, 409, {
        error: "This candidate is no longer part of the current ranked results. Search again before changing it.",
        code: "RESEARCH_CANDIDATE_CHANGED"
      });
      return;
    }
    const now = new Date().toISOString();
    const currentProjectLink = await researchConversationProjectLink(context.userID, conversation);
    const currentDecisionLink = researchCodeDecisionLink(currentProjectLink);
    if (currentDecisionLink?.questionID !== questionID || currentProjectLink?.projectID !== projectID) {
      sendJSON(response, 409, {
        error: "This candidate no longer belongs to the active Code Decision Research conversation.",
        code: "RESEARCH_CANDIDATE_CONTEXT_CHANGED"
      });
      return;
    }
    const record = {
      candidateID,
      disposition: "rejected",
      discoveryVersion: evidenceDiscoveryVersion,
      questionHash: createHash("sha256").update(question).digest("hex"),
      sectionID: candidate.sectionID,
      selectedTextHash: createHash("sha256").update(candidate.selectedText).digest("hex"),
      updatedAt: now
    };
    const updatedConversation = await updateStoredResearchCandidateDisposition(
      context.userID,
      conversation.id,
      { candidateID, disposition, record, updatedAt: now }
    );
    if (!updatedConversation) {
      sendJSON(response, 409, {
        error: "This Research conversation changed before the candidate review was saved.",
        code: "RESEARCH_CANDIDATE_CONTEXT_CHANGED"
      });
      return;
    }
    const artifactRevisions = await bumpResearchArtifactRevisions(context.userID, [{
      projectID,
      domains: ["research"]
    }]);
    sendJSON(response, 200, {
      conversation: await researchConversationForClient(updatedConversation, {
        userID: context.userID,
        projectLink: currentProjectLink
      }),
      candidateID,
      disposition,
      artifactRevisions
    });
  } catch (error) {
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "The candidate disposition could not be saved.",
      code: "INVALID_RESEARCH_CANDIDATE_DISPOSITION"
    });
  }
}

function searchSnippet(text, query) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return normalized.slice(0, 220);
  }
  const start = Math.max(0, index - 80);
  const end = Math.min(normalized.length, index + query.length + 150);
  return `${start > 0 ? "..." : ""}${normalized.slice(start, end)}${end < normalized.length ? "..." : ""}`;
}

async function handleWebIndex(_request, response) {
  sendHTML(response, await readFile(join(webPublicPath, "index.html"), "utf8"));
}

async function handlePrivacyPolicy(_request, response) {
  sendHTML(response, await readFile(join(webPublicPath, "privacy.html"), "utf8"));
}

async function handleServiceWorker(response) {
  const filePath = join(webPublicPath, "service-worker.js");
  sendStatic(
    response,
    contentTypeForPath(filePath),
    await readFile(filePath),
    "no-cache",
    { "service-worker-allowed": "/" }
  );
}

async function handleWebStatic(path, response) {
  const fileName = decodeURIComponent(path.replace(/^web\//, ""));
  const segments = fileName.split("/");
  if (
    !segments.length ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))
  ) {
    sendNotFound(response);
    return;
  }
  try {
    const filePath = join(webPublicPath, ...segments);
    sendStatic(response, contentTypeForPath(filePath), await readFile(filePath), immutableStaticCacheControl);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendNotFound(response);
      return;
    }
    throw error;
  }
}

async function handleInternalStatic(request, path, response) {
  if (!internalConsoleEnabled(request)) {
    sendNotFound(response);
    return;
  }
  const fileName = path === "internal" || path === "internal/"
    ? "index.html"
    : decodeURIComponent(path.replace(/^internal\//, ""));
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    sendNotFound(response);
    return;
  }
  try {
    const filePath = join(internalPublicPath, fileName);
    if (fileName === "index.html") {
      sendHTML(response, await readFile(filePath, "utf8"));
      return;
    }
    sendStatic(response, contentTypeForPath(filePath), await readFile(filePath), "no-store");
  } catch (error) {
    if (error.code === "ENOENT") {
      sendNotFound(response);
      return;
    }
    throw error;
  }
}

async function handleCodeAsset(path, response) {
  const fileName = decodeURIComponent(path.replace(/^code\/assets\//, ""));
  const resolved = await resolveCodeAsset(fileName);
  if (!resolved.path) {
    sendNotFound(response);
    return;
  }
  try {
    sendStatic(
      response,
      codeAssetContentType(fileName) || contentTypeForPath(resolved.path),
      await readFile(resolved.path),
      codeAssetCacheControl
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      sendNotFound(response);
      return;
    }
    throw error;
  }
}

async function handleCodeLibraries(_request, response) {
  const libraries = [
    {
      id: "nyc-2022-construction-codes",
      codeVersion: defaultResearchCodeEdition,
      syncCodeVersion: defaultSyncCodeVersion,
      displayName: "2022 Construction Codes",
      codePrefixes: [...codeSectionIDPrefixMap.values()],
      sourceAuthority: "New York City Department of Buildings",
      sourceURL: "https://www.nyc.gov/site/buildings/codes/2022-construction-codes.page",
      effectiveDate: "2022-11-07",
      researchEligibility: true
    },
    await zoningContentMetadata(),
    await existingBuildingContentMetadata(),
    ...await enactedContentMetadata()
  ];
  sendJSON(response, 200, {
    libraries,
    codeTrustProfiles: codeTrustProfilesForLibraries(libraries)
  });
}

function withNavigationHierarchy(chapter) {
  return {
    ...chapter,
    sourceChapterID: chapter.sourceChapterID || chapter.id,
    sourceChapterNumber: chapter.sourceChapterNumber || chapter.chapterNumber,
    hierarchyKind: chapter.hierarchyKind || "source-chapter",
    navigationChapterID: chapter.navigationChapterID || chapter.id,
    groupID: chapter.groupID || null
  };
}

export function startupChapterSummary(chapter) {
  return {
    id: chapter.id,
    codePrefix: chapter.codePrefix,
    codeSectionID: chapter.codeSectionID,
    chapterNumber: chapter.chapterNumber,
    displayTitle: chapter.displayTitle,
    fullTitle: chapter.fullTitle,
    title: chapter.title
  };
}

async function handleCodeChapters(request, response) {
  const url = requestURL(request);
  const codePrefix = url.searchParams.get("code")?.trim().toUpperCase();
  const startupView = url.searchParams.get("view") === "startup";
  const chapters = [
    ...([zoningCodePrefix, existingBuildingCodePrefix].includes(codePrefix) ||
      enactedCodePrefixes.has(codePrefix) ? [] : await chapterIndex()),
    ...(codePrefix && codePrefix !== zoningCodePrefix ? [] : await zoningChapterIndex()),
    ...(codePrefix && codePrefix !== existingBuildingCodePrefix ? [] : await existingBuildingChapterIndex()),
    ...(codePrefix && !enactedCodePrefixes.has(codePrefix) ? [] : await enactedNavigationChapterIndex())
  ].map(withNavigationHierarchy);
  const selectedChapters = codePrefix
    ? chapters.filter((chapter) => chapter.codePrefix === codePrefix)
    : chapters;
  sendJSON(response, 200, {
    chapters: startupView ? selectedChapters.map(startupChapterSummary) : selectedChapters
  });
}

function requestedChapterBodyRange(request, sectionCount) {
  const includeBody = requestURL(request).searchParams.get("include") === "body";
  if (!includeBody) {
    return { includeBody: false, start: 0, end: 0, complete: false };
  }
  const rawStart = Number.parseInt(requestURL(request).searchParams.get("bodyStart") || "", 10);
  const rawLimit = Number.parseInt(requestURL(request).searchParams.get("bodyLimit") || "", 10);
  const windowed = Number.isFinite(rawLimit) && rawLimit > 0;
  const start = windowed && Number.isFinite(rawStart)
    ? Math.min(Math.max(0, rawStart), sectionCount)
    : 0;
  const end = windowed
    ? Math.min(sectionCount, start + Math.min(rawLimit, 50))
    : sectionCount;
  return {
    includeBody: true,
    start,
    end,
    complete: start === 0 && end === sectionCount
  };
}

async function chapterSectionsWithRequestedBodies(request, sections, readBody) {
  const range = requestedChapterBodyRange(request, sections.length);
  if (!range.includeBody) {
    return { sections, bodyRange: null };
  }
  const bodies = await Promise.all(
    sections.slice(range.start, range.end).map((section) => readBody(section))
  );
  return {
    sections: sections.map((section, index) =>
      index >= range.start && index < range.end
        ? { ...section, blocks: bodies[index - range.start]?.blocks || [] }
        : section
    ),
    bodyRange: {
      start: range.start,
      end: range.end,
      total: sections.length,
      complete: range.complete
    }
  };
}

async function handleCodeChapter(request, path, response) {
  const chapterID = path.split("/").at(-1);
  if (!/^[a-zA-Z0-9_-]+$/.test(chapterID || "")) {
    sendError(response, 400, "Invalid chapter ID.");
    return;
  }
  if (isEnactedCodeChapterID(chapterID) || isEnactedNavigationChapterID(chapterID)) {
    const resolved = await enactedChapterByAnyID(chapterID);
    if (!resolved?.chapter || !resolved.summary) {
      sendNotFound(response);
      return;
    }
    const { chapter, summary, sourceSummary } = resolved;
    const sections = flattenChapterSections(chapter).map((section) => ({
      ...applyVisibleSectionNumber(section),
      chapterID: sourceSummary?.id || summary.sourceChapterID || chapter.chapterID,
      sourceChapterID: sourceSummary?.id || summary.sourceChapterID || chapter.chapterID,
      sourceChapterNumber: sourceSummary?.chapterNumber || summary.sourceChapterNumber || chapter.chapterNumber,
      navigationChapterID: summary.id,
      navigationChapterNumber: summary.chapterNumber
    }));
    const hydrated = await chapterSectionsWithRequestedBodies(
      request,
      sections,
      (section) => enactedSection(section.id)
    );
    sendJSON(response, 200, {
      chapter: {
        id: summary.id,
        sourceChapterID: summary.sourceChapterID || chapter.chapterID,
        sourceChapterNumber: summary.sourceChapterNumber || chapter.chapterNumber,
        hierarchyKind: summary.hierarchyKind || "source-chapter",
        navigationChapterID: summary.id,
        groupID: summary.groupID || null,
        codePrefix: summary.codePrefix,
        codeSectionID: summary.codeSectionID,
        codeVersion: summary.codeVersion,
        chapterNumber: summary.chapterNumber,
        displayTitle: summary.displayTitle,
        fullTitle: summary.fullTitle,
        groups: chapter.groups || [],
        sections: hydrated.sections,
        ...(hydrated.bodyRange ? { bodyRange: hydrated.bodyRange } : {})
      }
    });
    return;
  }
  if (isExistingBuildingChapterID(chapterID)) {
    const [chapter, chapterSummary] = await Promise.all([
      existingBuildingChapter(chapterID),
      existingBuildingChapterIndex().then((entries) =>
        entries.find((entry) => String(entry.id) === chapterID)
      )
    ]);
    if (!chapter || !chapterSummary) {
      sendNotFound(response);
      return;
    }
    const sections = flattenChapterSections(chapter);
    const hydrated = await chapterSectionsWithRequestedBodies(
      request,
      sections,
      (section) => existingBuildingSection(section.id)
    );
    sendJSON(response, 200, {
      chapter: {
        id: chapter.chapterID,
        codePrefix: existingBuildingCodePrefix,
        codeSectionID: 1,
        codeVersion: existingBuildingSyncCodeVersion,
        chapterNumber: chapter.chapterNumber,
        displayTitle: chapterSummary.displayTitle,
        fullTitle: chapterSummary.fullTitle,
        groups: chapter.groups || [],
        sections: hydrated.sections,
        ...(hydrated.bodyRange ? { bodyRange: hydrated.bodyRange } : {})
      }
    });
    return;
  }
  if (isZoningChapterID(chapterID)) {
    const [chapter, chapterSummary] = await Promise.all([
      zoningChapter(chapterID),
      zoningChapterIndex().then((entries) => entries.find((entry) => String(entry.id) === chapterID))
    ]);
    if (!chapter || !chapterSummary) {
      sendNotFound(response);
      return;
    }
    const sections = flattenChapterSections(chapter);
    const hydrated = await chapterSectionsWithRequestedBodies(
      request,
      sections,
      (section) => zoningSection(section.id)
    );
    sendJSON(response, 200, {
      chapter: {
        id: chapter.chapterID,
        codePrefix: zoningCodePrefix,
        codeSectionID: 1,
        codeVersion: zoningSyncCodeVersion,
        chapterNumber: chapter.chapterNumber,
        displayTitle: chapterSummary.displayTitle,
        fullTitle: chapterSummary.fullTitle,
        groups: chapter.groups || [],
        sections: hydrated.sections,
        ...(hydrated.bodyRange ? { bodyRange: hydrated.bodyRange } : {})
      }
    });
    return;
  }
  const chapter = await readJSONFile(join(chapterContentPath, `${chapterID}.json`));
  const manifest = await chapterManifest();
  const manifestChapter = manifest.get(String(chapter.chapterID));
  const codePrefix = codePrefixForChapter(chapter, manifestChapter);
  const chapterNumber = manifestChapter?.chapterNumber || chapter.chapterNumber;
  const groups = normalizedConstructionChapterGroups(chapter.groups, codePrefix);
  const sections = flattenChapterSections({ ...chapter, groups });
  const canonicalSections = await canonicalizeChapterSections(sections, {
    codePrefix,
    chapterNumber
  });
  const hydrated = await chapterSectionsWithRequestedBodies(
    request,
    canonicalSections,
    (section) => sectionBody(section.webSectionID || section.id, {
          allowMissing: true,
          canonicalSectionID: section.id
        })
  );

  sendJSON(response, 200, {
    chapter: {
      id: chapter.chapterID,
      codePrefix,
      codeSectionID: manifestChapter?.codeSectionID || null,
      chapterNumber,
      displayTitle: displayTitleForChapter({
        ...chapter,
        chapterNumber
      }),
      groups,
      sections: hydrated.sections,
      ...(hydrated.bodyRange ? { bodyRange: hydrated.bodyRange } : {})
    }
  });
}

async function handleCodeSection(path, response) {
  const sectionID = path.split("/").at(-1);
  if (!/^\d+$/.test(sectionID || "")) {
    sendError(response, 400, "Invalid section ID.");
    return;
  }
  if (isEnactedCodeSectionID(sectionID)) {
    const [summary, body] = await Promise.all([
      enactedSectionSummary(sectionID),
      enactedSection(sectionID)
    ]);
    if (!summary || !body) {
      sendNotFound(response);
      return;
    }
    sendJSON(response, 200, {
      section: {
        ...body,
        ...applyVisibleSectionNumber({
          ...summary,
          sectionNumber: summary.sectionNumber || body.sectionNumber
        }),
        chapterID: summary.chapterID,
        chapterNumber: summary.chapterNumber,
        sourceChapterID: summary.sourceChapterID || summary.chapterID,
        sourceChapterNumber: summary.sourceChapterNumber || summary.chapterNumber,
        navigationChapterID: summary.navigationChapterID || summary.chapterID,
        navigationChapterNumber: summary.navigationChapterNumber || summary.chapterNumber,
        codePrefix: summary.codePrefix,
        codeVersion: summary.codeVersion,
        sectionID: Number(summary.id),
        sectionNumber: applyVisibleSectionNumber({
          ...summary,
          sectionNumber: summary.sectionNumber || body.sectionNumber
        }).sectionNumber,
        title: summary.title,
        webSectionID: null
      }
    });
    return;
  }
  if (isZoningSectionID(sectionID)) {
    const [summary, body] = await Promise.all([
      zoningSectionSummary(sectionID),
      zoningSection(sectionID)
    ]);
    if (!summary || !body) {
      sendNotFound(response);
      return;
    }
    sendJSON(response, 200, {
      section: {
        ...body,
        chapterID: summary.chapterID,
        chapterNumber: summary.chapterNumber,
        codePrefix: zoningCodePrefix,
        codeVersion: zoningSyncCodeVersion,
        sectionID: Number(summary.id),
        sectionNumber: summary.sectionNumber,
        title: summary.title,
        webSectionID: null
      }
    });
    return;
  }
  if (isExistingBuildingSectionID(sectionID)) {
    const [summary, body] = await Promise.all([
      existingBuildingSectionSummary(sectionID),
      existingBuildingSection(sectionID)
    ]);
    if (!summary || !body) {
      sendNotFound(response);
      return;
    }
    sendJSON(response, 200, {
      section: {
        ...body,
        chapterID: summary.chapterID,
        chapterNumber: summary.chapterNumber,
        codePrefix: existingBuildingCodePrefix,
        codeVersion: existingBuildingSyncCodeVersion,
        sectionID: Number(summary.id),
        sectionNumber: summary.sectionNumber,
        title: summary.title,
        webSectionID: null
      }
    });
    return;
  }
  const summary = await sectionSummaryByID(sectionID);
  const body = await sectionBody(summary?.webSectionID || sectionID, {
    allowMissing: true,
    canonicalSectionID: summary?.id || sectionID
  });
  if (!body.blocks?.length) {
    if (!summary) {
      sendNotFound(response);
      return;
    }
    sendJSON(response, 200, {
      section: {
        blocks: [],
        chapterNumber: summary.chapterNumber,
        chapterID: summary.chapterID,
        codePrefix: summary.codePrefix,
        schemaVersion: 1,
        sectionID: Number(summary.id || sectionID),
        sectionNumber: summary.sectionNumber,
        title: summary.title,
        webSectionID: summary.webSectionID || null
      }
    });
    return;
  }
  sendJSON(response, 200, {
    section: {
      ...body,
      chapterID: summary?.chapterID || body.chapterID || null,
      chapterNumber: summary?.chapterNumber || body.chapterNumber || "",
      codePrefix: summary?.codePrefix || body.codePrefix || "",
      sectionID: Number(summary?.id || body.sectionID || sectionID),
      sectionNumber: summary?.sectionNumber || body.sectionNumber || "",
      title: summary?.title || body.title || "",
      webSectionID: summary?.webSectionID || body.webSectionID || null
    }
  });
}

async function handleCodeSections(request, response) {
  const rawIDs = requestURL(request).searchParams.get("ids") || "";
  const ids = rawIDs.split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length || ids.length > 100 || ids.some((id) => !/^\d+$/.test(id))) {
    sendError(response, 400, "Provide between 1 and 100 numeric section IDs.");
    return;
  }
  const uniqueIDs = Array.from(new Set(ids));
  const byID = await allSectionCatalogByID();
  sendJSON(response, 200, {
    sections: uniqueIDs
      .map((id) => {
        const section = byID.get(id);
        return section ? { ...section, requestedID: id } : null;
      })
      .filter(Boolean)
  });
}

export async function allSectionCatalogByID() {
  if (cachedAllSectionCatalogByID) {
    return cachedAllSectionCatalogByID;
  }
  if (cachedAllSectionCatalogByIDPromise) {
    return cachedAllSectionCatalogByIDPromise;
  }
  cachedAllSectionCatalogByIDPromise = Promise.all([
    sectionCatalog(),
    zoningSectionCatalog(),
    existingBuildingSectionCatalog(),
    enactedSectionCatalog()
  ]).then((catalogs) => {
    const byID = new Map();
    for (const section of catalogs.flat()) {
      byID.set(String(section.id), section);
      if (section.webSectionID) byID.set(String(section.webSectionID), section);
    }
    cachedAllSectionCatalogByID = byID;
    return byID;
  });
  try {
    return await cachedAllSectionCatalogByIDPromise;
  } finally {
    cachedAllSectionCatalogByIDPromise = null;
  }
}

export function candidateSectionIDs(index, queryTokens, normalizedQuery, query) {
  const postings = queryTokens
    .map((token) => index.get(token) || [])
    .sort((left, right) => postingListSize(left) - postingListSize(right));
  let candidateIDs = new Set(postings[0] || []);
  for (const posting of postings.slice(1)) {
    if (!candidateIDs.size) break;
    candidateIDs = intersectCandidateIDsWithPosting(candidateIDs, posting);
  }
  if (/^[A-Za-z]?\d/.test(query)) {
    for (const [token, sectionIDs] of index) {
      if (!token.startsWith(normalizedQuery)) continue;
      for (const sectionID of sectionIDs) candidateIDs.add(sectionID);
    }
  }
  return candidateIDs;
}

async function searchableSectionBody(section) {
  if (
    enactedCodePrefixes.has(section.codePrefix) ||
    isEnactedCodeSectionID(section.id)
  ) {
    return await enactedSection(section.id) || { blocks: [] };
  }
  if (
    section.codePrefix === existingBuildingCodePrefix ||
    isExistingBuildingSectionID(section.id)
  ) {
    return await existingBuildingSection(section.id) || { blocks: [] };
  }
  if (section.codePrefix === zoningCodePrefix || isZoningSectionID(section.id)) {
    return await zoningSection(section.id) || { blocks: [] };
  }
  return sectionBody(section.webSectionID || section.id, {
    allowMissing: true,
    canonicalSectionID: section.id
  });
}

export function setBoundedLRUCacheValue(cache, key, value, maximumEntries) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maximumEntries) {
    cache.delete(cache.keys().next().value);
  }
  return value;
}

function searchableSectionPlainText(section) {
  const cacheKey = [
    section.codeVersion || "",
    section.codePrefix || "",
    section.webSectionID || section.id
  ].join(":");
  if (searchableSectionPlainTextCache.has(cacheKey)) {
    return setBoundedLRUCacheValue(
      searchableSectionPlainTextCache,
      cacheKey,
      searchableSectionPlainTextCache.get(cacheKey),
      maxSearchableSectionPlainTextCacheEntries
    );
  }
  const pending = searchableSectionBody(section)
    .then((body) => body.blocks?.map((block) => block.plainText || "").join("\n\n") || "")
    .catch((error) => {
      searchableSectionPlainTextCache.delete(cacheKey);
      throw error;
    });
  return setBoundedLRUCacheValue(
    searchableSectionPlainTextCache,
    cacheKey,
    pending,
    maxSearchableSectionPlainTextCacheEntries
  );
}

async function handleCodeSearch(request, response) {
  const url = requestURL(request);
  const query = url.searchParams.get("q")?.trim() || "";
  if (query.length > 200) {
    sendError(response, 400, "Search queries are limited to 200 characters.");
    return;
  }
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const resultLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 250)
    : 25;
  const requestedOffset = Number.parseInt(url.searchParams.get("offset") || "", 10);
  const resultOffset = Number.isFinite(requestedOffset) && requestedOffset > 0
    ? requestedOffset
    : 0;
  const codeFilter = new Set(
    (url.searchParams.get("code") || url.searchParams.get("codes") || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  );
  if (query.length < 2) {
    sendJSON(response, 200, {
      query,
      results: [],
      totalResults: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      limited: false
    });
    return;
  }
  const normalizedQuery = query.toLowerCase();
  const queryTokens = tokenizeSearchText(query);
  if (!queryTokens.length) {
    sendJSON(response, 200, {
      query,
      results: [],
      totalResults: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      limited: false
    });
    return;
  }

  const includeConstruction = codeFilter.size === 0 || [...codeFilter].some((prefix) =>
    ![zoningCodePrefix, existingBuildingCodePrefix].includes(prefix) &&
    !enactedCodePrefixes.has(prefix)
  );
  const includeZoning = codeFilter.size === 0 || codeFilter.has(zoningCodePrefix);
  const includeExistingBuilding =
    codeFilter.size === 0 || codeFilter.has(existingBuildingCodePrefix);
  const includeEnacted = codeFilter.size === 0 ||
    [...codeFilter].some((prefix) => enactedCodePrefixes.has(prefix));
  const candidates = [];
  if (includeConstruction) {
    const index = await shippedSearchIndex();
    const candidateIDs = candidateSectionIDs(index, queryTokens, normalizedQuery, query);
    candidates.push(...(await sectionCatalog()).filter((section) =>
      candidateIDs.has(section.id) &&
      (codeFilter.size === 0 || codeFilter.has(section.codePrefix))
    ));
  }
  if (includeZoning) {
    const index = await zoningSearchIndex();
    const candidateIDs = candidateSectionIDs(index, queryTokens, normalizedQuery, query);
    candidates.push(...(await zoningSectionCatalog()).filter((section) => candidateIDs.has(section.id)));
  }
  if (includeExistingBuilding) {
    const index = await existingBuildingSearchIndex();
    const candidateIDs = candidateSectionIDs(index, queryTokens, normalizedQuery, query);
    candidates.push(
      ...(await existingBuildingSectionCatalog()).filter((section) =>
        candidateIDs.has(section.id)
      )
    );
  }
  if (includeEnacted) {
    const index = await enactedSearchIndex();
    const candidateIDs = candidateSectionIDs(index, queryTokens, normalizedQuery, query);
    candidates.push(
      ...(await enactedSectionCatalog()).filter((section) =>
        candidateIDs.has(section.id) &&
        (codeFilter.size === 0 || codeFilter.has(section.codePrefix))
      )
    );
  }
  const hits = candidates.map((section) => {
    const sectionNumber = String(section.sectionNumber || "").toLowerCase();
    const title = String(section.title || "").toLowerCase();
    const rank = sectionNumber === normalizedQuery
      ? 0
      : sectionNumber.startsWith(normalizedQuery)
        ? 1
        : title.includes(normalizedQuery)
          ? 2
          : 3;
    return { section, rank };
  });
  hits.sort((left, right) =>
    left.rank - right.rank ||
    compareChapterNumbers(left.section.chapterNumber, right.section.chapterNumber) ||
    String(left.section.sectionNumber).localeCompare(String(right.section.sectionNumber), undefined, {
      numeric: true,
      sensitivity: "base"
    }) ||
    Number(left.section.codeSectionID || 0) - Number(right.section.codeSectionID || 0) ||
    Number(left.section.id) - Number(right.section.id)
  );

  const totalResults = hits.length;
  const selectedHits = hits.slice(resultOffset, resultOffset + resultLimit);
  const results = await Promise.all(selectedHits.map(async ({ section }) => {
    const plainText = await searchableSectionPlainText(section);
    return {
      id: section.id,
      chapterID: section.chapterID,
      sourceChapterID: section.sourceChapterID || section.chapterID,
      navigationChapterID: section.navigationChapterID || section.chapterID,
      codePrefix: section.codePrefix,
      codeVersion: section.codeVersion ||
        (section.codePrefix === zoningCodePrefix
          ? zoningSyncCodeVersion
          : section.codePrefix === existingBuildingCodePrefix
            ? existingBuildingSyncCodeVersion
            : enactedCodePrefixes.has(section.codePrefix)
              ? enactedSyncCodeVersionForPrefix(section.codePrefix)
            : defaultSyncCodeVersion),
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      headerLine: section.headerLine,
      headingLine: section.headingLine,
      snippet: searchSnippet(plainText || section.title || "", query)
    };
  }));
  const nextOffset = resultOffset + results.length;
  const hasMore = nextOffset < totalResults;
  sendJSON(response, 200, {
    query,
    results,
    totalResults,
    offset: resultOffset,
    nextOffset,
    hasMore,
    limited: hasMore
  });
}

class ClientAuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function decodeBase64URL(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function parseJWTPart(value) {
  try {
    return JSON.parse(decodeBase64URL(value).toString("utf8"));
  } catch {
    throw new ClientAuthError(401, "Invalid Apple identity token.");
  }
}

function appleAllowedClientIDs() {
  return [
    process.env.APPLE_BUNDLE_ID,
    process.env.APPLE_SERVICE_ID,
    ...(process.env.APPLE_ALLOWED_CLIENT_IDS || "").split(",")
  ]
    .map((value) => value?.trim())
    .filter(Boolean);
}

export function appleIdentityTokenRequired(environment = process.env) {
  const hostedDeployment = environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
  return hostedDeployment || environment.PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN === "1";
}

export function compatibilityAccountMergeAllowed(adapter) {
  return adapter?.kind !== "postgres" || typeof adapter.mergeUserAccounts === "function";
}

function appleWebSignInConfigured() {
  if (!process.env.APPLE_SERVICE_ID?.trim()) return false;
  try {
    appleWebOAuthStateSecret();
    return true;
  } catch {
    return false;
  }
}

function browserFallbackSignInAllowed(request) {
  if (process.env.PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN === "1") {
    return true;
  }
  const host = request.headers.host || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function appleWebOAuthStateSecret(environment = process.env) {
  const dedicatedSecret = String(environment.APPLE_WEB_OAUTH_STATE_SECRET || "").trim();
  if (dedicatedSecret) return dedicatedSecret;
  const adminSecret = String(environment.PERMITEXT_SYNC_ADMIN_TOKEN || "").trim();
  if (adminSecret) {
    return createHmac("sha256", adminSecret)
      .update("permitext-apple-web-oauth-state")
      .digest("hex");
  }
  const hostedDeployment = environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
  if (hostedDeployment) {
    throw new ClientAuthError(500, "Apple web OAuth state secret is not configured.");
  }
  return environment.STRIPE_WEBHOOK_SECRET ||
    "permitext-local-apple-web-oauth-state";
}

function signOAuthStatePayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", appleWebOAuthStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyOAuthStateCookie(value) {
  const [encoded, signature] = String(value || "").split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", appleWebOAuthStateSecret()).update(encoded).digest("base64url");
  const supplied = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const createdAt = Date.parse(payload.createdAt || 0);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.cookie || "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function appleOAuthCookie(request, value = "", maxAge = 600) {
  const host = request.headers["x-forwarded-host"] || request.headers.host || "";
  const secure = !String(host).startsWith("localhost") && !String(host).startsWith("127.0.0.1");
  return [
    `permitext_apple_oauth=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    "Path=/account/apple",
    "HttpOnly",
    secure ? "SameSite=None" : "SameSite=Lax",
    secure ? "Secure" : null
  ].filter(Boolean).join("; ");
}

async function appleJWKS() {
  const now = Date.now();
  if (cachedAppleJWKS && cachedAppleJWKSExpiresAt > now) {
    return cachedAppleJWKS;
  }
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new ClientAuthError(503, "Apple identity verification is temporarily unavailable.");
  }
  cachedAppleJWKS = await response.json();
  cachedAppleJWKSExpiresAt = now + 60 * 60 * 1000;
  return cachedAppleJWKS;
}

async function verifyAppleIdentityToken(identityToken, options = {}) {
  const parts = String(identityToken || "").split(".");
  if (parts.length !== 3) {
    throw new ClientAuthError(401, "Invalid Apple identity token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJWTPart(encodedHeader);
  const payload = parseJWTPart(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) {
    throw new ClientAuthError(401, "Unsupported Apple identity token.");
  }

  const jwks = await appleJWKS();
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    throw new ClientAuthError(401, "Unknown Apple identity token key.");
  }

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signatureOK = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    decodeBase64URL(encodedSignature)
  );
  if (!signatureOK) {
    throw new ClientAuthError(401, "Apple identity token signature is invalid.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.iss !== "https://appleid.apple.com") {
    throw new ClientAuthError(401, "Apple identity token issuer is invalid.");
  }
  if (!payload.sub) {
    throw new ClientAuthError(401, "Apple identity token is missing a subject.");
  }
  if (Number(payload.exp || 0) <= nowSeconds) {
    throw new ClientAuthError(401, "Apple identity token has expired.");
  }

  const allowedClientIDs = appleAllowedClientIDs();
  if (appleIdentityTokenRequired() && allowedClientIDs.length === 0) {
    throw new ClientAuthError(500, "Apple client IDs are not configured.");
  }
  if (allowedClientIDs.length > 0) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.some((audience) => allowedClientIDs.includes(audience))) {
      throw new ClientAuthError(401, "Apple identity token audience is invalid.");
    }
  }
  if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new ClientAuthError(401, "Apple identity token nonce is invalid.");
  }

  return payload;
}

function normalizedAccountEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

async function verifiedCredentialIdentity(credential, options = {}) {
  const provider = credential?.provider || "guest";
  if (provider !== "apple") {
    return { providerUserID: credential?.providerUserID || "local-guest", email: "" };
  }

  const identityToken = typeof credential?.identityToken === "string" ? credential.identityToken.trim() : "";
  if (!identityToken) {
    if (appleIdentityTokenRequired()) {
      throw new ClientAuthError(401, "Missing Apple identity token.");
    }
    return {
      providerUserID: credential?.providerUserID || "local-guest",
      email: normalizedAccountEmail(credential?.email)
    };
  }

  const payload = await verifyAppleIdentityToken(identityToken, options);
  if (credential.providerUserID && credential.providerUserID !== payload.sub) {
    throw new ClientAuthError(401, "Apple identity token subject does not match the credential.");
  }
  return {
    providerUserID: payload.sub,
    email: normalizedAccountEmail(payload.email || credential?.email)
  };
}

async function accountFromCredential(credential, options = {}) {
  const provider = credential?.provider || "guest";
  const identity = await verifiedCredentialIdentity(credential, options);
  const providerUserID = identity.providerUserID;
  return {
    appUserID: `${provider}:${providerUserID}`,
    authProvider: provider,
    authProviderUserID: providerUserID,
    appleUserID: provider === "apple" ? providerUserID : "",
    email: provider === "apple" ? identity.email : "",
    publicUsername: null,
    displayName: credential?.displayName ?? null,
    signedInAt: credential?.signedInAt || new Date().toISOString(),
    migrationState: "notStarted"
  };
}

function accountEmail(account) {
  return normalizedAccountEmail(account?.email || account?.emailAddress || account?.privateRelayEmail);
}

function appleSubjectIDs(account) {
  return new Set([
    account?.authProviderUserID,
    account?.appleUserID,
    ...(Array.isArray(account?.linkedAppleUserIDs) ? account.linkedAppleUserIDs : [])
  ].map((value) => String(value || "").trim()).filter(Boolean));
}

function appleAccountMergeCandidates(store, account) {
  if (account?.authProvider !== "apple") return [];
  const email = accountEmail(account);
  const subjectIDs = appleSubjectIDs(account);
  return Object.values(store.users || {})
    .filter((candidate) => candidate?.authProvider === "apple")
    .filter((candidate) => {
      if (candidate.appUserID === account.appUserID) return false;
      if (email && accountEmail(candidate) === email) return true;
      const candidateSubjects = appleSubjectIDs(candidate);
      return Array.from(subjectIDs).some((subjectID) => candidateSubjects.has(subjectID));
    });
}

function userMutationCount(store, userID) {
  return (store.mutationsByUserID?.[userID] || []).length;
}

function preferredAppleAccountTarget(store, account) {
  const candidates = appleAccountMergeCandidates(store, account);
  if (!candidates.length) return null;
  return candidates.sort((left, right) => {
    const mutationDelta = userMutationCount(store, right.appUserID) - userMutationCount(store, left.appUserID);
    if (mutationDelta !== 0) return mutationDelta;
    const rightEntitled = store.entitlements?.[right.appUserID] ? 1 : 0;
    const leftEntitled = store.entitlements?.[left.appUserID] ? 1 : 0;
    if (rightEntitled !== leftEntitled) return rightEntitled - leftEntitled;
    return String(left.signedInAt || "").localeCompare(String(right.signedInAt || ""));
  })[0];
}

async function canonicalizeAppleAccountForSignIn(store, account) {
  if (account?.authProvider !== "apple") return account;
  const target = preferredAppleAccountTarget(store, account);
  if (!target?.appUserID) return account;
  const email = accountEmail(account) || accountEmail(target);
  const linkedAppleUserIDs = Array.from(new Set([
    ...Array.from(appleSubjectIDs(target)),
    ...Array.from(appleSubjectIDs(account))
  ]));
  store.users[target.appUserID] = {
    ...account,
    ...target,
    appUserID: target.appUserID,
    authProvider: "apple",
    authProviderUserID: target.authProviderUserID || target.appleUserID || account.authProviderUserID,
    appleUserID: target.appleUserID || account.appleUserID,
    email,
    linkedAppleUserIDs,
    signedInAt: account.signedInAt || new Date().toISOString(),
    migrationState: "localDataAttached"
  };
  if (store.users[account.appUserID]) {
    await mergeAccountInto(store, account.appUserID, target.appUserID);
  }
  return store.users[target.appUserID];
}

function entitlementForSource(userID, source, details = {}, existingEntitlement = null) {
  return entitlementWithPackage(existingEntitlement, {
    userID,
    packageID: details.packageID || entitlementPackageIDs.pro,
    source,
    expiresAt: details.expiresAt || null,
    provider: details.provider || {},
    explicitPackage: details.explicitPackage !== false
  });
}

function grantServerEntitlement(store, userID, source, details = {}) {
  const entitlement = entitlementForSource(userID, source, details, store.entitlements[userID] || null);
  store.entitlements[userID] = entitlement;
  return entitlement;
}

function revokeServerEntitlement(store, userID, predicate = () => true) {
  const entitlement = store.entitlements[userID];
  if (!entitlement || !predicate(entitlement)) {
    return false;
  }
  delete store.entitlements[userID];
  return true;
}

function entitlementMatchesExpected(entitlement, expected = {}) {
  if (expected.source && entitlement?.source !== expected.source) return false;
  if (expected.providerKey && entitlement?.provider?.[expected.providerKey] !== expected.providerValue) return false;
  return true;
}

async function persistServerEntitlement(userID, source, details = {}) {
  const currentStore = await readStore();
  const entitlement = entitlementForSource(
    userID,
    source,
    details,
    currentStore.entitlements[userID] || null
  );
  const adapter = await storeAdapter();
  if (typeof adapter.saveEntitlement === "function") {
    return adapter.saveEntitlement(userID, entitlement);
  }
  currentStore.entitlements[userID] = entitlement;
  await writeStore(currentStore);
  return currentStore.entitlements[userID];
}

export function claimAppleTransactionOwner(store, originalTransactionID, userID) {
  const normalizedTransactionID = String(originalTransactionID || "").trim();
  const normalizedUserID = String(userID || "").trim();
  if (!normalizedTransactionID || !normalizedUserID) {
    return false;
  }
  store.appleTransactionOwners ||= {};
  const existingOwner = store.appleTransactionOwners[normalizedTransactionID];
  if (existingOwner && existingOwner !== normalizedUserID) {
    return false;
  }
  store.appleTransactionOwners[normalizedTransactionID] = normalizedUserID;
  return true;
}

async function persistAppleServerEntitlement(userID, originalTransactionID, details = {}) {
  const currentStore = await readStore();
  const entitlement = entitlementForSource(
    userID,
    "appleSubscription",
    details,
    currentStore.entitlements[userID] || null
  );
  const adapter = await storeAdapter();
  if (typeof adapter.claimAppleEntitlement === "function") {
    return adapter.claimAppleEntitlement(userID, originalTransactionID, entitlement);
  }

  if (!claimAppleTransactionOwner(currentStore, originalTransactionID, userID)) {
    return null;
  }
  currentStore.entitlements[userID] = entitlement;
  await writeStore(currentStore);
  return currentStore.entitlements[userID];
}

async function deletePersistedEntitlement(userID, expected = {}) {
  if (expected.packageID === entitlementPackageIDs.research) {
    const currentStore = await readStore();
    const decision = entitlementWithoutPackage(
      currentStore.entitlements[userID] || null,
      entitlementPackageIDs.research,
      expected
    );
    if (!decision.changed) return false;
    const adapter = await storeAdapter();
    if (typeof adapter.saveEntitlement === "function") {
      await adapter.saveEntitlement(userID, decision.entitlement);
      return true;
    }
    currentStore.entitlements[userID] = decision.entitlement;
    await writeStore(currentStore);
    return true;
  }
  const adapter = await storeAdapter();
  if (typeof adapter.deleteEntitlement === "function") {
    return adapter.deleteEntitlement(userID, expected);
  }
  const store = await readStore();
  const changed = revokeServerEntitlement(store, userID, (entitlement) =>
    entitlementMatchesExpected(entitlement, expected)
  );
  if (changed) await writeStore(store);
  return changed;
}

export function entitlementAfterPackageRemoval(entitlement, packageID, expected, changed) {
  if (!changed) return entitlement || null;
  if (packageID === entitlementPackageIDs.research) {
    return entitlementWithoutPackage(entitlement, packageID, expected).entitlement;
  }
  return null;
}

async function persistedStripeEntitlementOwner(subscriptionID) {
  const adapter = await storeAdapter();
  if (typeof adapter.stripeEntitlementOwner === "function") {
    return adapter.stripeEntitlementOwner(subscriptionID);
  }
  const store = await readStore();
  const userID = findUserIDForStripeSubscription(store, subscriptionID);
  return userID ? { userID, entitlement: store.entitlements[userID] } : null;
}

async function persistedAccountExists(userID) {
  if (!userID) return false;
  const adapter = await storeAdapter();
  if (typeof adapter.accountExists === "function") {
    return adapter.accountExists(userID);
  }
  const store = await readStore();
  return Boolean(store.users?.[userID]);
}

export function stripeSecretKeyMode(secretKey = process.env.STRIPE_SECRET_KEY) {
  const normalized = String(secretKey || "").trim();
  if (/^(sk|rk)_live_/.test(normalized)) return "live";
  if (/^(sk|rk)_test_/.test(normalized)) return "test";
  return normalized ? "unknown" : "missing";
}

function liveStripeRequired() {
  return process.env.PERMITEXT_REQUIRE_LIVE_STRIPE === "1" ||
    process.env.VERCEL_ENV === "production";
}

function normalizedCommercialPackageID(value, fallback = entitlementPackageIDs.pro) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return Object.values(entitlementPackageIDs).includes(normalized) ? normalized : null;
}

function stripePriceEnvironmentKey(packageID) {
  return packageID === entitlementPackageIDs.research
    ? "STRIPE_RESEARCH_PRICE_ID"
    : "STRIPE_PRO_PRICE_ID";
}

function stripePriceID(packageID) {
  return process.env[stripePriceEnvironmentKey(packageID)];
}

export function stripeConfigurationStatus(options = {}) {
  const packageID = normalizedCommercialPackageID(options.packageID);
  const secretKey = options.secretKey ?? process.env.STRIPE_SECRET_KEY;
  const priceID = options.priceID ?? stripePriceID(packageID);
  const requireLive = options.requireLive ?? liveStripeRequired();
  const mode = stripeSecretKeyMode(secretKey);
  const missing = [];
  if (!String(secretKey || "").trim()) missing.push("STRIPE_SECRET_KEY");
  if (!packageID) {
    return {
      ready: false,
      mode,
      message: "Stripe checkout requested an unsupported Permitext package."
    };
  }
  if (!String(priceID || "").trim()) missing.push(stripePriceEnvironmentKey(packageID));
  if (missing.length) {
    return {
      ready: false,
      mode,
      message: `Stripe checkout is not configured. Missing ${missing.join(" and ")}.`
    };
  }
  if (mode === "unknown") {
    return {
      ready: false,
      mode,
      message: "Stripe checkout uses an unrecognized secret-key format."
    };
  }
  if (requireLive && mode !== "live") {
    return {
      ready: false,
      mode,
      message: "Stripe checkout is still in test mode. Configure live Stripe credentials before accepting purchases."
    };
  }
  return { ready: true, mode, message: null };
}

function stripeConfigured(packageID = entitlementPackageIDs.pro) {
  return stripeConfigurationStatus({ packageID }).ready;
}

function configuredPublicBaseURL(request) {
  const explicitURL =
    process.env.PERMITEXT_PUBLIC_BASE_URL ||
    process.env.PERMITEXT_SYNC_PUBLIC_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
  if (explicitURL) {
    return explicitURL.replace(/\/+$/, "");
  }
  const host = request.headers.host || "localhost:8787";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

function formURLEncode(value, prefix = null, pairs = []) {
  if (value === null || value === undefined) {
    return pairs;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => formURLEncode(item, `${prefix}[${index}]`, pairs));
    return pairs;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      formURLEncode(child, prefix ? `${prefix}[${key}]` : key, pairs);
    }
    return pairs;
  }
  pairs.push([prefix, String(value)]);
  return pairs;
}

function encodedFormBody(value) {
  return formURLEncode(value)
    .map(([key, child]) => `${encodeURIComponent(key)}=${encodeURIComponent(child)}`)
    .join("&");
}

function stripeSignatureTimestamp(header) {
  const timestampPart = String(header || "").split(",").find((part) => part.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  const timestamp = stripeSignatureTimestamp(signatureHeader);
  if (!timestamp) {
    return false;
  }
  const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || 300);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return String(signatureHeader || "")
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .some((part) => {
      const supplied = Buffer.from(part.slice(3), "hex");
      return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
    });
}

function stripeSubscriptionID(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.id || null;
}

function entitlementBillingPackages(entitlement) {
  return [
    {
      packageID: entitlementPackageIDs.pro,
      source: entitlement?.source || null,
      provider: entitlement?.provider || {}
    },
    ...Object.entries(entitlement?.addOns || {}).map(([packageID, addOn]) => ({
      packageID,
      source: addOn?.source || null,
      provider: addOn?.provider || {}
    }))
  ];
}

export function accountDeletionBillingPlan(entitlement) {
  const packages = entitlementBillingPackages(entitlement);
  const stripeSubscriptions = packages
    .filter((entry) => entry.source === "webSubscription")
    .map((entry) => ({
      packageID: entry.packageID,
      subscriptionID: stripeSubscriptionID(entry.provider?.stripeSubscriptionID)
    }))
    .filter((entry) => entry.subscriptionID);
  const deduplicatedStripeSubscriptions = Array.from(
    new Map(stripeSubscriptions.map((entry) => [entry.subscriptionID, entry])).values()
  );
  return {
    stripeSubscriptions: deduplicatedStripeSubscriptions,
    appleSubscriptionPresent: packages.some((entry) =>
      ["appleSubscription", "subscription"].includes(entry.source)
    ),
    lifetimeGrantPresent: packages.some((entry) => entry.source === "lifetimeGrant")
  };
}

function stripeSubscriptionIDFromObject(object) {
  return stripeSubscriptionID(object?.subscription) ||
    stripeSubscriptionID(object?.parent?.subscription_details?.subscription) ||
    stripeSubscriptionID(object?.lines?.data?.[0]?.subscription);
}

function stripeUserIDFromObject(object) {
  return object?.metadata?.accountUserID ||
    object?.subscription_details?.metadata?.accountUserID ||
    object?.parent?.subscription_details?.metadata?.accountUserID ||
    object?.client_reference_id ||
    null;
}

export function stripePackageIDFromObject(object) {
  const explicit = object?.metadata?.permitextPackage ||
    object?.subscription_details?.metadata?.permitextPackage ||
    object?.parent?.subscription_details?.metadata?.permitextPackage ||
    null;
  return explicit
    ? normalizedCommercialPackageID(explicit, null)
    : entitlementPackageIDs.pro;
}

function stripePackageIsExplicit(object) {
  return Boolean(
    object?.metadata?.permitextPackage ||
    object?.subscription_details?.metadata?.permitextPackage ||
    object?.parent?.subscription_details?.metadata?.permitextPackage
  );
}

function normalizedStripeAccountUserID(value) {
  const userID = String(value || "").trim();
  return userID || null;
}

export function validateStripeRestoreOwnership({
  subscription,
  checkoutSession = null,
  persistedOwnerUserID = null,
  requestedUserID
} = {}) {
  const requestedOwner = normalizedStripeAccountUserID(requestedUserID);
  if (!requestedOwner) {
    throw new ClientAuthError(400, "Missing user ID.");
  }

  const ownershipClaims = [
    subscription?.metadata?.accountUserID,
    checkoutSession?.metadata?.accountUserID,
    checkoutSession?.subscription_details?.metadata?.accountUserID,
    checkoutSession?.client_reference_id,
    persistedOwnerUserID
  ].map(normalizedStripeAccountUserID).filter(Boolean);
  const distinctOwners = Array.from(new Set(ownershipClaims));

  if (distinctOwners.length > 1) {
    throw new ClientAuthError(
      409,
      "Stripe subscription ownership records conflict. Contact Permitext support."
    );
  }
  if (!distinctOwners.length) {
    throw new ClientAuthError(
      409,
      "This Stripe subscription is not linked to a Permitext account. Contact Permitext support."
    );
  }
  if (distinctOwners[0] !== requestedOwner) {
    throw new ClientAuthError(403, "This Stripe subscription belongs to a different Permitext account.");
  }

  return requestedOwner;
}

function entitlementPackageForStripeSubscription(entitlement, subscriptionID) {
  if (
    entitlement?.source === "webSubscription" &&
    entitlement?.provider?.stripeSubscriptionID === subscriptionID
  ) {
    return entitlementPackageIDs.pro;
  }
  if (
    entitlement?.addOns?.research?.source === "webSubscription" &&
    entitlement?.addOns?.research?.provider?.stripeSubscriptionID === subscriptionID
  ) {
    return entitlementPackageIDs.research;
  }
  return null;
}

function entitlementMatchesStripeSubscription(subscriptionID) {
  return (entitlement) => Boolean(
    entitlementPackageForStripeSubscription(entitlement, subscriptionID)
  );
}

function findUserIDForStripeSubscription(store, subscriptionID) {
  if (!subscriptionID) {
    return null;
  }
  return Object.entries(store.entitlements || {}).find(([, entitlement]) =>
    entitlementMatchesStripeSubscription(subscriptionID)(entitlement)
  )?.[0] || null;
}

export function stripeSubscriptionExpiresAt(object) {
  const timestamp = [
    object?.current_period_end,
    object?.items?.data?.[0]?.current_period_end,
    object?.lines?.data?.[0]?.period?.end,
    object?.period_end
  ]
    .map(Number)
    .find((candidate) => Number.isFinite(candidate) && candidate > 0);
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function stripeCheckoutProvisionalExpiresAt(event) {
  const eventCreatedAt = Number(event?.created) * 1000;
  const baseTime = Number.isFinite(eventCreatedAt) && eventCreatedAt > 0
    ? eventCreatedAt
    : Date.now();
  return new Date(baseTime + (15 * 60 * 1000)).toISOString();
}

function stripeEventCreatedAt(event) {
  const timestamp = Number(event?.created);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000).toISOString()
    : null;
}

function stripeSearchValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function stripeAPI(path, { method = "GET", body = null } = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${process.env.STRIPE_SECRET_KEY}:`).toString("base64")}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(json.error?.message || "Stripe API request failed.");
  }
  return json;
}

export async function cancelStripeSubscriptionsForAccount({
  userID,
  entitlement,
  requestStripe = stripeAPI
} = {}) {
  const plan = accountDeletionBillingPlan(entitlement);
  const canceledSubscriptions = [];
  for (const entry of plan.stripeSubscriptions) {
    const subscription = await requestStripe(
      `/v1/subscriptions/${encodeURIComponent(entry.subscriptionID)}`
    );
    validateStripeRestoreOwnership({
      subscription,
      persistedOwnerUserID: userID,
      requestedUserID: userID
    });
    if (["canceled", "incomplete_expired"].includes(subscription.status)) {
      canceledSubscriptions.push({
        ...entry,
        status: subscription.status,
        alreadyInactive: true
      });
      continue;
    }
    const canceled = await requestStripe(
      `/v1/subscriptions/${encodeURIComponent(entry.subscriptionID)}`,
      {
        method: "DELETE",
        body: encodedFormBody({
          cancellation_details: {
            comment: "Permitext account deleted by customer"
          }
        })
      }
    );
    if (canceled.status !== "canceled") {
      throw new Error("Stripe did not confirm subscription cancellation.");
    }
    canceledSubscriptions.push({
      ...entry,
      status: canceled.status,
      alreadyInactive: false
    });
  }
  return {
    canceledSubscriptions,
    appleSubscriptionPresent: plan.appleSubscriptionPresent,
    lifetimeGrantPresent: plan.lifetimeGrantPresent
  };
}

async function activeStripeSubscriptionForUserID(userID, packageID = entitlementPackageIDs.pro) {
  if (!stripeConfigured(packageID) || !userID) {
    return null;
  }
  const query = `metadata['accountUserID']:'${stripeSearchValue(userID)}'`;
  const searchParams = new URLSearchParams({ query, limit: "10" });
  const payload = await stripeAPI(`/v1/subscriptions/search?${searchParams.toString()}`);
  return (payload.data || []).find((subscription) =>
    ["active", "trialing"].includes(subscription.status) &&
    stripePackageIDFromObject(subscription) === packageID
  ) || null;
}

async function transferStripeSubscriptionMetadata(
  subscriptionID,
  targetUserID,
  packageID = entitlementPackageIDs.pro
) {
  if (!stripeConfigured(packageID) || !subscriptionID || !targetUserID) {
    return;
  }
  await stripeAPI(`/v1/subscriptions/${encodeURIComponent(subscriptionID)}`, {
    method: "POST",
    body: encodedFormBody({
      metadata: {
        accountUserID: targetUserID,
        permitextPackage: packageID
      }
    })
  });
}

function appleStoreKitProductID(packageID = entitlementPackageIDs.pro) {
  return packageID === entitlementPackageIDs.research
    ? process.env.STOREKIT_RESEARCH_PRODUCT_ID || "com.randycodex.permitext.research.monthly"
    : process.env.STOREKIT_PRO_PRODUCT_ID || "com.randycodex.permitext.pro.monthly";
}

export function applePackageIDForProductID(productID) {
  return Object.values(entitlementPackageIDs).find(
    (packageID) => appleStoreKitProductID(packageID) === productID
  ) || null;
}

function productionAppleTransactionsRequired() {
  return process.env.PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS === "1" ||
    process.env.VERCEL_ENV === "production";
}

export function validateAppleTransactionEnvironment(
  payload,
  { requireProduction = productionAppleTransactionsRequired() } = {}
) {
  const environment = String(payload?.environment || "").trim().toLowerCase();
  if (environment === "xcode") {
    throw new ClientAuthError(
      409,
      "Xcode StoreKit transactions are device-only and cannot create a web entitlement."
    );
  }
  if (!["production", "sandbox"].includes(environment)) {
    throw new ClientAuthError(422, "Apple transaction environment is invalid.");
  }
  if (requireProduction && environment !== "production") {
    throw new ClientAuthError(
      422,
      "Apple Sandbox and TestFlight transactions cannot grant production Pro."
    );
  }
  return environment;
}

function x509CertificateFromX5C(certificate) {
  return new X509Certificate(Buffer.from(certificate, "base64"));
}

function configuredAppleRootFingerprints() {
  return (process.env.APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.replace(/[^a-fA-F0-9]/g, "").toUpperCase())
    .filter(Boolean);
}

function certificateFingerprint(certificate) {
  return createHash("sha256").update(certificate.raw).digest("hex").toUpperCase();
}

function verifyAppleTransactionCertificateChain(x5c) {
  if (!Array.isArray(x5c) || x5c.length < 2) {
    throw new ClientAuthError(422, "Apple transaction certificate chain is missing.");
  }

  const certificates = x5c.map(x509CertificateFromX5C);
  const now = Date.now();
  for (const certificate of certificates) {
    if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) < now) {
      throw new ClientAuthError(422, "Apple transaction certificate is not currently valid.");
    }
  }

  for (let index = 0; index < certificates.length - 1; index += 1) {
    const certificate = certificates[index];
    const issuer = certificates[index + 1];
    if (!certificate.checkIssued(issuer) || !certificate.verify(issuer.publicKey)) {
      throw new ClientAuthError(422, "Apple transaction certificate chain is invalid.");
    }
  }

  const root = certificates[certificates.length - 1];
  const allowedFingerprints = configuredAppleRootFingerprints();
  if (
    (process.env.PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN === "1" ||
      productionAppleTransactionsRequired()) &&
    allowedFingerprints.length === 0
  ) {
    throw new ClientAuthError(500, "Apple transaction root fingerprints are not configured.");
  }
  if (allowedFingerprints.length > 0 && !allowedFingerprints.includes(certificateFingerprint(root))) {
    throw new ClientAuthError(422, "Apple transaction root certificate is not trusted.");
  }
  if (allowedFingerprints.length === 0 && !/Apple/.test(root.subject)) {
    throw new ClientAuthError(422, "Apple transaction root certificate is not recognized.");
  }

  return certificates[0].publicKey;
}

function ecdsaJoseToDER(signature) {
  if (signature.length % 2 !== 0) {
    throw new ClientAuthError(422, "Invalid Apple transaction signature.");
  }
  const half = signature.length / 2;
  const encodeInteger = (value) => {
    let bytes = Buffer.from(value);
    while (bytes.length > 1 && bytes[0] === 0) {
      bytes = bytes.subarray(1);
    }
    if (bytes[0] & 0x80) {
      bytes = Buffer.concat([Buffer.from([0]), bytes]);
    }
    return Buffer.concat([Buffer.from([0x02, bytes.length]), bytes]);
  };
  const r = encodeInteger(signature.subarray(0, half));
  const s = encodeInteger(signature.subarray(half));
  const body = Buffer.concat([r, s]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

export function verifyAppleTransactionJWS(signedTransactionInfo) {
  const parts = String(signedTransactionInfo || "").split(".");
  if (parts.length !== 3) {
    throw new ClientAuthError(422, "Invalid Apple transaction.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  try {
    header = parseJWTPart(encodedHeader);
    payload = parseJWTPart(encodedPayload);
  } catch {
    throw new ClientAuthError(422, "Invalid Apple transaction.");
  }
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || !header.x5c[0]) {
    throw new ClientAuthError(422, "Unsupported Apple transaction.");
  }

  const publicKey = verifyAppleTransactionCertificateChain(header.x5c);
  const signatureOK = verifySignature(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    ecdsaJoseToDER(decodeBase64URL(encodedSignature))
  );
  if (!signatureOK) {
    throw new ClientAuthError(422, "Apple transaction signature is invalid.");
  }

  const bundleID = process.env.APPLE_BUNDLE_ID;
  if (productionAppleTransactionsRequired() && !bundleID) {
    throw new ClientAuthError(500, "APPLE_BUNDLE_ID is not configured.");
  }
  if (bundleID && payload.bundleId !== bundleID) {
    throw new ClientAuthError(422, "Apple transaction bundle is invalid.");
  }
  if (!applePackageIDForProductID(payload.productId)) {
    throw new ClientAuthError(422, "Apple transaction product is invalid.");
  }
  validateAppleTransactionEnvironment(payload);

  return payload;
}

function appleTransactionExpiration(payload) {
  const expiresDate = Number(payload?.expiresDate || 0);
  return Number.isFinite(expiresDate) && expiresDate > 0 ? new Date(expiresDate).toISOString() : null;
}

function appleTransactionActive(payload) {
  if (payload?.revocationDate) {
    return false;
  }
  const expiresDate = Number(payload?.expiresDate || 0);
  return !Number.isFinite(expiresDate) || expiresDate === 0 || expiresDate > Date.now();
}

function mutationRecordID(mutation) {
  const [kind, record] = Object.entries(mutation)[0] || [];
  if (!kind || !record) {
    return null;
  }
  if (kind === "continuity") {
    return [record.userID, "continuity", record.codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    return [record.userID, "code-version-clear", record.codeVersion, record.values?.scope]
      .filter(Boolean)
      .join(":");
  }
  return record.id || null;
}

function canonicalMutationRecordID(kind, record) {
  const userID = record.userID;
  const codeVersion = canonicalCodeVersion(record.codeVersion);
  const sectionID = record.sectionID;
  if (kind === "savedItem") {
    return [
      userID,
      "saved",
      codeVersion,
      sectionID,
      normalizedBlockID(record.blockID) || null
    ].filter(Boolean).join(":");
  }
  if (kind === "annotation") {
    return [
      userID,
      record.tags !== undefined ? "tags" : "note",
      codeVersion,
      sectionID,
      String(record.blockID || "").trim() || null
    ].filter(Boolean).join(":");
  }
  if (kind === "project") {
    return [
      userID,
      "project",
      codeVersion,
      syncProjectIdentity(record.clientID, userID) ||
        syncProjectIdentity(record.id, userID) ||
        record.localFolderID ||
        null
    ].filter(Boolean).join(":");
  }
  if (kind === "projectSection") {
    return [
      userID,
      "project-section",
      codeVersion,
      syncProjectIdentity(record.folderClientID, userID) || record.localFolderID || null,
      sectionID,
      normalizedBlockID(record.blockID) || null,
      record.scope || null
    ].filter(Boolean).join(":");
  }
  if (kind === "workboard") {
    return [userID, "workboard", record.projectID || null].filter(Boolean).join(":");
  }
  return record.id || null;
}

async function canonicalizeSectionRecord(kind, record) {
  if (kind === "continuity" || kind === "codeVersionClear") {
    return {
      ...record,
      codeVersion: canonicalCodeVersion(record.codeVersion)
    };
  }
  if (kind === "workboard") {
    const normalized = {
      ...record,
      codeVersion: canonicalCodeVersion(record.codeVersion),
      projectID: String(record.projectID || "").trim()
    };
    const nextID = canonicalMutationRecordID(kind, normalized);
    return nextID ? { ...normalized, id: nextID } : normalized;
  }
  if (!["savedItem", "annotation", "project", "projectSection"].includes(kind)) {
    return record;
  }
  const codeVersion = canonicalCodeVersion(record.codeVersion);
  if (kind === "project") {
    // iOS persists `colorHex`, while early web records also carried `color`
    // and `tintColor`. Keep every alias aligned at the sync boundary so a
    // stale legacy field cannot override the latest cross-device color.
    const canonicalColor = record.colorHex || record.color || record.tintColor || null;
    const clientID = syncProjectIdentity(record.clientID, record.userID) ||
      syncProjectIdentity(record.id, record.userID) ||
      String(record.localFolderID || "").trim() ||
      null;
    const normalized = {
      ...record,
      codeVersion,
      clientID,
      ...(canonicalColor ? {
        color: canonicalColor,
        colorHex: canonicalColor,
        tintColor: canonicalColor
      } : {})
    };
    const nextID = canonicalMutationRecordID(kind, normalized);
    return nextID ? { ...normalized, id: nextID } : normalized;
  }
  if (kind === "projectSection") {
    record = {
      ...record,
      folderClientID: syncProjectIdentity(record.folderClientID, record.userID) || null
    };
  }
  const canonicalID = await canonicalSectionIDFor({
    codePrefix: record.codePrefix || "BC",
    chapterNumber: record.chapterNumber,
    sectionNumber: record.sectionNumber,
    sectionID: record.sectionID,
    allowLegacySectionID: kind === "annotation" &&
      !record.webSectionID &&
      /^\d+-html-\d+$/i.test(normalizedBlockID(record.blockID) || "")
  });
  const normalized = {
    ...record,
    codeVersion,
    sectionID: canonicalID || record.sectionID,
    webSectionID: canonicalID && canonicalID !== record.sectionID
      ? record.webSectionID || record.sectionID
      : record.webSectionID
  };
  if (kind === "savedItem" || kind === "annotation" || kind === "projectSection") {
    normalized.blockID = await canonicalBlockIDFor(normalized.sectionID, normalized.blockID);
  }
  const nextID = canonicalMutationRecordID(kind, normalized);
  return nextID ? { ...normalized, id: nextID } : normalized;
}

async function canonicalizeMutation(mutation) {
  const { kind, record } = mutationKindAndRecord(mutation);
  if (!kind || !record) {
    return mutation;
  }
  return {
    [kind]: await canonicalizeSectionRecord(kind, record)
  };
}

async function canonicalizeMutationBatch(mutations) {
  const source = mutations || [];
  const canonicalized = await Promise.all(source.map(canonicalizeMutation));
  const mutationsByID = new Map();
  const aliasesByCanonicalID = new Map();
  canonicalized.forEach((mutation, index) => {
    const recordID = mutationRecordID(mutation);
    if (!recordID) return;
    const sourceRecordID = mutationRecordID(source[index]);
    if (typeof sourceRecordID === "string" && sourceRecordID !== recordID) {
      const aliases = aliasesByCanonicalID.get(recordID) || new Set();
      aliases.add(sourceRecordID);
      aliasesByCanonicalID.set(recordID, aliases);
    }
    const existing = mutationsByID.get(recordID);
    if (!existing || mutationUpdatedAt(mutation) >= mutationUpdatedAt(existing)) {
      mutationsByID.set(recordID, mutation);
    }
  });
  return {
    aliasesByCanonicalID,
    mutations: Array.from(mutationsByID.values()).sort((left, right) =>
      String(mutationRecordID(left) || "").localeCompare(String(mutationRecordID(right) || ""))
    )
  };
}

async function canonicalizeMutations(mutations) {
  return (await canonicalizeMutationBatch(mutations)).mutations;
}

function includeSubmittedMutationIDAliases(recordIDs, aliasesByCanonicalID) {
  return Array.from(new Set((recordIDs || []).flatMap((recordID) => [
    recordID,
    ...Array.from(aliasesByCanonicalID.get(recordID) || [])
  ])));
}

function includeSubmittedMutationReasonAliases(reasons, aliasesByCanonicalID) {
  const expanded = {};
  for (const [recordID, reason] of Object.entries(reasons || {})) {
    expanded[recordID] = reason;
    for (const alias of aliasesByCanonicalID.get(recordID) || []) {
      expanded[alias] = reason;
    }
  }
  return expanded;
}

function canonicalCodeVersion(value) {
  const candidate = String(value || "").trim();
  const normalized = candidate.toLocaleLowerCase("en-US");
  if (
    !candidate ||
    normalized === "nyc-2022" ||
    normalized === "2022 construction codes" ||
    normalized === defaultSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return defaultSyncCodeVersion;
  if (
    normalized === "nyc-zoning-resolution" ||
    normalized === "nyc zoning resolution" ||
    normalized === "nyc zoning resolution — text through 2026-07-16" ||
    normalized === zoningSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return zoningSyncCodeVersion;
  if (
    normalized === "nyc-existing-building-code" ||
    normalized === "nyc existing building code" ||
    normalized ===
      "nyc existing building code - enacted 2026-01-17; effective 2027-07-17" ||
    normalized === existingBuildingSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return existingBuildingSyncCodeVersion;
  return candidate;
}

function mutationUpdatedAt(mutation) {
  const record = Object.values(mutation)[0] || {};
  return Date.parse(record.updatedAt || 0);
}

function validationError(message) {
  return { ok: false, message };
}

function normalizePublicUsername(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const withoutAtPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const normalized = withoutAtPrefix.toLowerCase();
  return normalized.length ? normalized : null;
}

function validatePublicUsername(value) {
  if (!value) {
    return null;
  }
  if (value.length < 3) {
    return "Use at least 3 characters.";
  }
  if (value.length > 30) {
    return "Use 30 characters or fewer.";
  }
  if (!/^[a-z0-9_-]+$/.test(value)) {
    return "Use letters, numbers, hyphens, or underscores.";
  }
  return null;
}

function validateWorkboardRecord(record) {
  const projectID = String(record.projectID || "").trim();
  if (!projectID || projectID.length > 200) {
    return validationError("Workboard projectID must contain 1 through 200 characters.");
  }
  if (record.deletedAt) return { ok: true };
  if (!Array.isArray(record.elements) || record.elements.length > maxWorkboardElements) {
    return validationError(`Workboards are limited to ${maxWorkboardElements} drawing elements.`);
  }
  if (!record.appState || typeof record.appState !== "object" || Array.isArray(record.appState)) {
    return validationError("Workboard appState must be an object.");
  }
  if (!record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
    return validationError("Workboard files must be an object.");
  }
  if (!record.assets || typeof record.assets !== "object" || Array.isArray(record.assets)) {
    return validationError("Workboard assets must be an object.");
  }
  if (Object.keys(record.assets).length > maxWorkboardAssets) {
    return validationError(`Workboards are limited to ${maxWorkboardAssets} uploaded assets.`);
  }
  const hasInlineFile = Object.values(record.files).some((file) =>
    typeof file?.dataURL === "string" && file.dataURL.startsWith("data:")
  );
  if (hasInlineFile) {
    return validationError("Workboard image data must be stored as private assets, not inline JSON.");
  }
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > maxWorkboardRecordBytes) {
    return validationError("Workboard drawing data is too large to synchronize.");
  }
  return { ok: true };
}

function validateMutation(mutation, userID) {
  if (!mutation || typeof mutation !== "object" || Array.isArray(mutation)) {
    return validationError("Mutation must be an object.");
  }

  const entries = Object.entries(mutation);
  if (entries.length !== 1) {
    return validationError("Mutation must contain exactly one kind.");
  }

  const [kind, record] = entries[0];
  if (!allowedMutationKinds.has(kind)) {
    return validationError(`Unsupported mutation kind: ${kind}.`);
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return validationError("Mutation record must be an object.");
  }
  if (record.userID !== userID) {
    return validationError("Mutation userID must match the authenticated user.");
  }
  const computedRecordID = mutationRecordID(mutation);
  if (!computedRecordID) {
    return validationError("Mutation record is missing a stable ID.");
  }
  if (
    kind !== "continuity" &&
    kind !== "codeVersionClear" &&
    (
      typeof record.id !== "string" ||
      !record.id.trim() ||
      record.id.length > maxSyncRecordIDCharacters
    )
  ) {
    return validationError(
      `Mutation record IDs must be non-empty strings up to ${maxSyncRecordIDCharacters} characters.`
    );
  }
  if (typeof computedRecordID !== "string" || computedRecordID.length > maxSyncRecordIDCharacters) {
    return validationError(
      `Mutation record IDs must be non-empty strings up to ${maxSyncRecordIDCharacters} characters.`
    );
  }
  if (kind === "codeVersionClear" && !allowedCodeVersionClearScopes.has(String(record.values?.scope || ""))) {
    return validationError("Code-version clear mutations require a supported scope.");
  }
  const updatedAt = mutationUpdatedAt(mutation);
  if (!Number.isFinite(updatedAt)) {
    return validationError("Mutation record is missing a valid updatedAt timestamp.");
  }
  if (updatedAt > Date.now() + maxSyncFutureClockSkewMilliseconds) {
    return validationError("Mutation updatedAt is too far in the future.");
  }
  if (
    (kind === "project" || kind === "projectSection") &&
    record.folderType !== undefined &&
    !["project", "reference"].includes(record.folderType)
  ) {
    return validationError("Folder type must be project or reference.");
  }
  if (kind === "project" && record.structuredFacts !== undefined) {
    if (!Array.isArray(record.structuredFacts) || record.structuredFacts.length > 50) {
      return validationError("Project structured facts must be an array of no more than 50 records.");
    }
    const invalidStructuredFact = record.structuredFacts.some((fact) =>
      !fact ||
      typeof fact !== "object" ||
      typeof fact.key !== "string" || fact.key.length > 120 ||
      typeof fact.label !== "string" || fact.label.length > 160 ||
      typeof fact.value !== "string" || fact.value.length > 1_000 ||
      !researchProjectFactStatuses.has(String(fact.status || "stated").toLowerCase())
    );
    if (invalidStructuredFact) {
      return validationError("Project structured facts contain an invalid record.");
    }
  }
  if (kind === "workboard") {
    return validateWorkboardRecord(record);
  }

  return { ok: true };
}

function validateMutations(mutations, userID) {
  for (const mutation of mutations) {
    const result = validateMutation(mutation, userID);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

function mergeMutations(existing, incoming) {
  const byID = new Map();
  for (const mutation of existing) {
    const id = mutationRecordID(mutation);
    if (id) {
      byID.set(id, mutation);
    }
  }

  const acceptedMutationIDs = [];
  const rejectedMutationIDs = [];
  for (const mutation of incoming) {
    const id = mutationRecordID(mutation);
    if (!id) {
      continue;
    }

    const existingMutation = byID.get(id);
    const { kind } = mutationKindAndRecord(mutation);
    if (
      kind !== "continuity" &&
      existingMutation &&
      mutationUpdatedAt(mutation) < mutationUpdatedAt(existingMutation)
    ) {
      rejectedMutationIDs.push(id);
      continue;
    }

    let acceptedMutation = mutation;
    if (kind === "project" && existingMutation) {
      const existingProject = mutationKindAndRecord(existingMutation).record;
      const incomingProject = mutationKindAndRecord(mutation).record;
      let mergedIncomingProject = incomingProject;
      if (existingProject?.folderType === "reference" && incomingProject?.folderType === undefined) {
        mergedIncomingProject = { ...mergedIncomingProject, folderType: "reference" };
      }
      if (existingProject?.structuredFacts?.length && incomingProject?.structuredFacts === undefined) {
        mergedIncomingProject = { ...mergedIncomingProject, structuredFacts: existingProject.structuredFacts };
      }
      acceptedMutation = { project: mergedIncomingProject };
    }
    byID.set(
      id,
      kind === "continuity" && existingMutation
        ? mergeContinuityMutations(existingMutation, mutation, { mergedAt: new Date().toISOString() })
        : acceptedMutation
    );
    acceptedMutationIDs.push(id);
  }

  return {
    mutations: Array.from(byID.values()).sort((left, right) => {
      const leftID = mutationRecordID(left) || "";
      const rightID = mutationRecordID(right) || "";
      return leftID.localeCompare(rightID);
    }),
    acceptedMutationIDs,
    rejectedMutationIDs
  };
}

function retargetRecordID(recordID, sourceUserID, targetUserID) {
  const prefix = `${sourceUserID}:`;
  return typeof recordID === "string" && recordID.startsWith(prefix)
    ? `${targetUserID}:${recordID.slice(prefix.length)}`
    : recordID;
}

function retargetMutationUser(mutation, sourceUserID, targetUserID) {
  const { kind, record } = mutationKindAndRecord(mutation);
  if (!kind || !record) {
    return mutation;
  }
  const nextRecord = {
    ...record,
    userID: targetUserID
  };
  if (typeof nextRecord.id === "string") {
    nextRecord.id = retargetRecordID(nextRecord.id, sourceUserID, targetUserID);
  }
  return { [kind]: nextRecord };
}

async function mergeAccountInto(store, sourceUserID, targetUserID) {
  if (!sourceUserID || !targetUserID || sourceUserID === targetUserID) {
    return null;
  }
  const sourceAccount = store.users[sourceUserID];
  const targetAccount = store.users[targetUserID];
  if (!sourceAccount || !targetAccount) {
    return null;
  }

  const sourceMutations = await canonicalizeMutations(
    (store.mutationsByUserID[sourceUserID] || [])
      .map((mutation) => retargetMutationUser(mutation, sourceUserID, targetUserID))
  );
  const targetMutations = await canonicalizeMutations(store.mutationsByUserID[targetUserID] || []);
  const mergedMutations = mergeMutations(targetMutations, sourceMutations);
  store.mutationsByUserID[targetUserID] = mergedMutations.mutations;
  delete store.mutationsByUserID[sourceUserID];

  const moveUserEntries = (field, transform = (item) => item) => {
    store[field] ||= {};
    const sourceEntries = store[field][sourceUserID] || [];
    const targetEntries = store[field][targetUserID] || [];
    const byID = new Map(targetEntries.map((item) => [item.id || item.envelope?.id, item]));
    for (const sourceEntry of sourceEntries) {
      const entry = transform(sourceEntry);
      byID.set(entry.id || entry.envelope?.id, entry);
    }
    if (byID.size) store[field][targetUserID] = Array.from(byID.values());
    delete store[field][sourceUserID];
  };
  moveUserEntries("foundationArtifactsByUserID", (artifact) => ({
    ...artifact,
    envelope: {
      ...artifact.envelope,
      owner: artifact.envelope?.owner?.kind === "organization"
        ? artifact.envelope.owner
        : ownerScope(targetUserID)
    }
  }));
  moveUserEntries("projectLinksByUserID", (link) => ({
    ...link,
    owner: link.owner?.kind === "organization" ? link.owner : ownerScope(targetUserID)
  }));
  moveUserEntries("researchAnswersByUserID", (answer) => ({
    ...answer,
    owner: answer.owner?.kind === "organization" ? answer.owner : ownerScope(targetUserID)
  }));
  moveUserEntries("activityEventsByUserID", (event) => ({
    ...event,
    owner: event.owner?.kind === "organization" ? event.owner : ownerScope(targetUserID),
    actorUserID: event.actorUserID === sourceUserID ? targetUserID : event.actorUserID
  }));
  moveUserEntries("researchConversationsByUserID");
  moveUserEntries("researchUsageByUserID");
  moveUserEntries("researchFeedbackByUserID");
  store.migrationCheckpointsByUserID ||= {};
  store.migrationCheckpointsByUserID[targetUserID] = {
    ...(store.migrationCheckpointsByUserID[sourceUserID] || {}),
    ...(store.migrationCheckpointsByUserID[targetUserID] || {})
  };
  delete store.migrationCheckpointsByUserID[sourceUserID];

  if (!store.entitlements[targetUserID] && store.entitlements[sourceUserID]) {
    store.entitlements[targetUserID] = {
      ...store.entitlements[sourceUserID],
      grantedUserID: targetUserID,
      transferredFromUserID: sourceUserID,
      updatedAt: new Date().toISOString()
    };
  }
  delete store.entitlements[sourceUserID];

  const appleTransactionOwners = store.appleTransactionOwners || {};
  for (const [originalTransactionID, ownerUserID] of Object.entries(appleTransactionOwners)) {
    if (ownerUserID === sourceUserID) {
      appleTransactionOwners[originalTransactionID] = targetUserID;
    }
  }
  store.appleTransactionOwners = appleTransactionOwners;

  for (const [organizationID, organization] of Object.entries(store.organizations || {})) {
    if (organization.ownerUserID === sourceUserID) {
      store.organizations[organizationID] = {
        ...organization,
        ownerUserID: targetUserID,
        updatedAt: new Date().toISOString()
      };
    }
  }
  const membershipRoleRank = { owner: 4, editor: 3, reviewer: 2, viewer: 1 };
  const mergeMembershipEntries = (entries) => {
    const byUserID = new Map();
    for (const original of entries || []) {
      const membership = original.userID === sourceUserID
        ? { ...original, userID: targetUserID, updatedAt: new Date().toISOString() }
        : original;
      const existing = byUserID.get(membership.userID);
      if (!existing) {
        byUserID.set(membership.userID, membership);
        continue;
      }
      const preferred = (membershipRoleRank[membership.role] || 0) >
        (membershipRoleRank[existing.role] || 0)
        ? membership
        : existing;
      byUserID.set(membership.userID, {
        ...preferred,
        id: existing.id,
        status: existing.status === "active" || membership.status === "active"
          ? "active"
          : "deactivated",
        deactivatedAt: existing.status === "active" || membership.status === "active"
          ? null
          : preferred.deactivatedAt,
        updatedAt: [existing.updatedAt, membership.updatedAt].filter(Boolean).sort().at(-1)
      });
    }
    return Array.from(byUserID.values());
  };
  for (const [organizationID, memberships] of Object.entries(
    store.organizationMembershipsByOrganizationID || {}
  )) {
    store.organizationMembershipsByOrganizationID[organizationID] =
      mergeMembershipEntries(memberships);
  }
  for (const [projectID, memberships] of Object.entries(
    store.projectMembershipsByProjectID || {}
  )) {
    store.projectMembershipsByProjectID[projectID] = mergeMembershipEntries(memberships);
  }
  for (const [invitationID, invitation] of Object.entries(
    store.organizationInvitationsByID || {}
  )) {
    store.organizationInvitationsByID[invitationID] = {
      ...invitation,
      invitedUserID: invitation.invitedUserID === sourceUserID
        ? targetUserID
        : invitation.invitedUserID,
      invitedByUserID: invitation.invitedByUserID === sourceUserID
        ? targetUserID
        : invitation.invitedByUserID,
      acceptedByUserID: invitation.acceptedByUserID === sourceUserID
        ? targetUserID
        : invitation.acceptedByUserID
    };
  }
  for (const [projectID, ownership] of Object.entries(store.projectOwnerships || {})) {
    store.projectOwnerships[projectID] = {
      ...ownership,
      owner: ownership.owner?.kind === "user" && ownership.owner.id === sourceUserID
        ? ownerScope(targetUserID)
        : ownership.owner,
      storageOwnerUserID: ownership.storageOwnerUserID === sourceUserID
        ? targetUserID
        : ownership.storageOwnerUserID,
      originalOwnerUserID: ownership.originalOwnerUserID === sourceUserID
        ? targetUserID
        : ownership.originalOwnerUserID,
      transferredByUserID: ownership.transferredByUserID === sourceUserID
        ? targetUserID
        : ownership.transferredByUserID
    };
  }

  if (!targetAccount.publicUsername && sourceAccount.publicUsername) {
    targetAccount.publicUsername = sourceAccount.publicUsername;
  }
  if (!targetAccount.displayName && sourceAccount.displayName) {
    targetAccount.displayName = sourceAccount.displayName;
  }
  targetAccount.migrationState = "localDataAttached";
  targetAccount.mergedAccountIDs = Array.from(new Set([
    ...(Array.isArray(targetAccount.mergedAccountIDs) ? targetAccount.mergedAccountIDs : []),
    sourceUserID
  ]));
  store.users[targetUserID] = targetAccount;

  const passkeyCredentials = store.passkeyCredentials || {};
  for (const [credentialID, userID] of Object.entries(passkeyCredentials)) {
    if (userID === sourceUserID) {
      passkeyCredentials[credentialID] = targetUserID;
    }
  }
  store.passkeyCredentials = passkeyCredentials;

  delete store.sessions[sourceUserID];
  delete store.users[sourceUserID];

  return {
    sourceUserID,
    targetUserID,
    movedMutationCount: sourceMutations.length,
    acceptedMutationIDs: mergedMutations.acceptedMutationIDs,
    rejectedMutationIDs: mergedMutations.rejectedMutationIDs,
    transferredEntitlement: Boolean(store.entitlements[targetUserID]?.transferredFromUserID === sourceUserID)
  };
}

function mutationKindAndRecord(mutation) {
  const [kind, record] = Object.entries(mutation)[0] || [];
  return { kind, record };
}

const knownSyncMutationKinds = new Set([
  "savedItem",
  "annotation",
  "project",
  "projectSection",
  "workboard",
  "continuity",
  "codeVersionClear"
]);

function normalizedExcludedMutationKinds(body) {
  const raw = Array.isArray(body?.excludedMutationKinds) ? body.excludedMutationKinds : [];
  return new Set(
    raw
      .map((value) => String(value || "").trim())
      .filter((value) => knownSyncMutationKinds.has(value))
  );
}

function filterMutationsByExcludedKinds(mutations, excludedKinds) {
  if (!(excludedKinds instanceof Set) || excludedKinds.size === 0) {
    return mutations;
  }
  return (mutations || []).filter((mutation) => {
    const { kind } = mutationKindAndRecord(mutation);
    return !excludedKinds.has(kind);
  });
}

function projectRecordMatchesSection(projectRecord, sectionRecord) {
  if (!projectRecord || !sectionRecord) {
    return false;
  }
  if (projectRecord.userID !== sectionRecord.userID || projectRecord.codeVersion !== sectionRecord.codeVersion) {
    return false;
  }
  const sectionFolderClientID = sectionRecord.folderClientID || null;
  if (sectionFolderClientID && (projectRecord.clientID === sectionFolderClientID || projectRecord.id === sectionFolderClientID)) {
    return true;
  }
  return sectionRecord.localFolderID !== undefined &&
    sectionRecord.localFolderID !== null &&
    projectRecord.localFolderID === sectionRecord.localFolderID;
}

function expandPullMutationsWithDependencies(filteredMutations, allMutations) {
  const expandedByID = new Map();
  for (const mutation of filteredMutations) {
    const id = mutationRecordID(mutation);
    if (id) {
      expandedByID.set(id, mutation);
    }
  }

  for (const mutation of filteredMutations) {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (kind !== "projectSection" || !record) {
      continue;
    }
    const parentProject = allMutations.find((candidate) => {
      const { kind: candidateKind, record: candidateRecord } = mutationKindAndRecord(candidate);
      return candidateKind === "project" && projectRecordMatchesSection(candidateRecord, record);
    });
    const parentID = parentProject ? mutationRecordID(parentProject) : null;
    if (parentProject && parentID && !expandedByID.has(parentID)) {
      expandedByID.set(parentID, parentProject);
    }
  }

  return Array.from(expandedByID.values()).sort((left, right) => {
    const leftID = mutationRecordID(left) || "";
    const rightID = mutationRecordID(right) || "";
    return leftID.localeCompare(rightID);
  });
}

function normalizedSinceEventID(body) {
  const rawValue = body.sinceEventID ?? body.sinceRevision ?? body.afterEventID;
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }
  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function handleSignIn(request, response) {
  const body = await readJSON(request);
  const credential = body.credential || {};
  if (credential.provider === "passkey") {
    sendError(response, 410, "Passkey sign-in is unavailable. Use Sign in with Apple.");
    return;
  }
  if (credential.provider === "web" && !browserFallbackSignInAllowed(request)) {
    sendError(response, 403, "Browser fallback sign-in is unavailable on this deployment.");
    return;
  }
  if (credential.provider !== "apple" && credential.provider !== "web") {
    sendError(response, 400, "Unsupported account provider.");
    return;
  }
  let account;
  try {
    account = await accountFromCredential(credential);
  } catch (error) {
    if (error instanceof ClientAuthError) {
      sendError(response, error.statusCode, error.message);
      return;
    }
    throw error;
  }
  if (!account?.appUserID) {
    sendError(response, 400, "Missing account.");
    return;
  }
  const linkFrom = body.linkFrom || {};
  const sourceUserID = linkFrom.accountUserID || linkFrom.userID;
  const adapter = await storeAdapter();
  if (sourceUserID && !compatibilityAccountMergeAllowed(adapter)) {
    sendError(response, 503, "Account linking is temporarily unavailable while transactional repair is completed.");
    return;
  }
  if (
    sourceUserID &&
    typeof adapter.signInAccount === "function" &&
    typeof adapter.mergeUserAccounts === "function"
  ) {
    const sourceSessionToken = linkFrom.sessionToken || linkFrom.backendSessionToken;
    if (!await authenticatedUserContext(request, response, sourceUserID, {
      backendSessionToken: sourceSessionToken
    })) {
      return;
    }
    const directResult = await adapter.signInAccount(account);
    if (directResult.requiresLegacyMerge) {
      sendError(response, 409, "This account requires identity repair before linking can continue.");
      return;
    }
    const targetUserID = directResult.account.appUserID;
    const mergedAccount = sourceUserID === targetUserID
      ? null
      : await adapter.mergeUserAccounts(sourceUserID, targetUserID);
    if (sourceUserID !== targetUserID && !mergedAccount) {
      sendError(response, 404, "The source account could not be linked.");
      return;
    }
    const finalContext = await adapter.authenticateUserSession(
      targetUserID,
      directResult.account.backendSessionToken
    );
    sendJSON(response, 200, {
      account: {
        ...(finalContext?.account || directResult.account),
        backendSessionToken: directResult.account.backendSessionToken
      },
      entitlement: finalContext?.entitlement || directResult.entitlement || null,
      mergedAccount
    });
    return;
  }
  if (!sourceUserID && typeof adapter.signInAccount === "function") {
    const directResult = await adapter.signInAccount(account);
    if (!directResult.requiresLegacyMerge) {
      sendJSON(response, 200, directResult);
      return;
    }
    if (!compatibilityAccountMergeAllowed(adapter)) {
      sendError(response, 409, "This account requires a transactional identity repair before sign-in can continue.");
      return;
    }
  }

  const store = await readStore();
  account = await canonicalizeAppleAccountForSignIn(store, account);
  const sessionToken = randomUUID();
  store.sessions[account.appUserID] = sessionToken;
  const existing = store.users[account.appUserID];
  const storedAccount = existing
    ? { ...account, ...existing, signedInAt: account.signedInAt, backendSessionToken: sessionToken }
    : { ...account, backendSessionToken: sessionToken };
  store.users[account.appUserID] = storedAccount;
  let mergedAccount = null;
  if (sourceUserID && sourceUserID !== account.appUserID) {
    const sourceSessionToken = linkFrom.sessionToken || linkFrom.backendSessionToken;
    if (!await authenticatedUserContext(
      request,
      response,
      sourceUserID,
      { backendSessionToken: sourceSessionToken },
      store
    )) {
      return;
    }
    mergedAccount = await mergeAccountInto(store, sourceUserID, account.appUserID);
  }
  await writeStore(store);
  sendJSON(response, 200, {
    account: store.users[account.appUserID] || storedAccount,
    entitlement: store.entitlements[account.appUserID] ?? null,
    mergedAccount
  });
}

async function handlePasskeyLink(request, response) {
  sendError(response, 410, "Passkey registration is unavailable. Use Sign in with Apple.");
}

async function handleBrowserAccountLink(request, response) {
  const body = await readJSON(request);
  const targetUserID = body.auth?.accountUserID;
  const browserCredentialID = typeof body.browserCredentialID === "string" ? body.browserCredentialID.trim() : "";
  if (!targetUserID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  if (!browserCredentialID) {
    sendError(response, 400, "Missing browser credential ID.");
    return;
  }

  const adapter = await storeAdapter();
  if (!compatibilityAccountMergeAllowed(adapter)) {
    sendError(response, 503, "Browser account repair is temporarily unavailable while transactional repair is completed.");
    return;
  }

  if (typeof adapter.mergeUserAccounts === "function") {
    const context = await authenticatedUserContext(request, response, targetUserID);
    if (!context) return;
    if (context.account?.authProvider !== "apple") {
      sendError(response, 400, "Browser account repair requires an Apple account.");
      return;
    }
    const sourceUserID = `web:${browserCredentialID}`;
    const mergedAccount = await adapter.mergeUserAccounts(sourceUserID, targetUserID);
    let finalContext = await adapter.authenticateUserSession(targetUserID, context.sessionToken);
    if (!finalContext?.entitlement) {
      const subscription = await activeStripeSubscriptionForUserID(sourceUserID);
      if (subscription) {
        const packageID = stripePackageIDFromObject(subscription);
        const entitlement = await persistServerEntitlement(targetUserID, "webSubscription", {
          packageID,
          explicitPackage: stripePackageIsExplicit(subscription),
          expiresAt: stripeSubscriptionExpiresAt(subscription),
          provider: {
            stripeCustomerID: stripeSubscriptionID(subscription.customer),
            stripeSubscriptionID: stripeSubscriptionID(subscription.id),
            restoredFromUserID: sourceUserID
          }
        });
        await transferStripeSubscriptionMetadata(subscription.id, targetUserID, packageID);
        finalContext = { ...finalContext, entitlement };
      }
    }
    sendJSON(response, 200, {
      account: finalContext?.account || context.account,
      entitlement: finalContext?.entitlement || null,
      mergedAccount
    });
    return;
  }

  const store = await readStore();
  if (!await authenticatedUserContext(request, response, targetUserID, undefined, store)) {
    return;
  }
  const targetAccount = store.users[targetUserID];
  if (!targetAccount) {
    sendError(response, 404, "Target account was not found.");
    return;
  }
  if (targetAccount.authProvider !== "apple") {
    sendError(response, 400, "Browser account repair requires an Apple account.");
    return;
  }

  const sourceUserID = `web:${browserCredentialID}`;
  const mergedAccount = await mergeAccountInto(store, sourceUserID, targetUserID);
  if (!store.entitlements[targetUserID]) {
    const subscription = await activeStripeSubscriptionForUserID(sourceUserID);
    if (subscription) {
      const packageID = stripePackageIDFromObject(subscription);
      grantServerEntitlement(store, targetUserID, "webSubscription", {
        packageID,
        explicitPackage: stripePackageIsExplicit(subscription),
        expiresAt: stripeSubscriptionExpiresAt(subscription),
        provider: {
          stripeCustomerID: stripeSubscriptionID(subscription.customer),
          stripeSubscriptionID: stripeSubscriptionID(subscription.id),
          restoredFromUserID: sourceUserID
        }
      });
      await transferStripeSubscriptionMetadata(subscription.id, targetUserID, packageID);
    }
  }
  if (!mergedAccount) {
    await writeStore(store);
    sendJSON(response, 200, {
      account: store.users[targetUserID],
      entitlement: store.entitlements[targetUserID] || null,
      mergedAccount: null
    });
    return;
  }

  await writeStore(store);
  sendJSON(response, 200, {
    account: store.users[targetUserID],
    entitlement: store.entitlements[targetUserID] || null,
    mergedAccount
  });
}

async function handleAttachLocalData(request, response) {
  const body = await readJSON(request);
  const account = body.account;
  if (!account?.appUserID) {
    sendError(response, 400, "Missing account.");
    return;
  }

  const context = await authenticatedUserContext(request, response, account.appUserID, account);
  if (!context) {
    return;
  }
  const adapter = await storeAdapter();
  if (typeof adapter.updateAccount === "function") {
    const migratedAccount = {
      ...account,
      ...(context.account || {}),
      migrationState: "localDataAttached"
    };
    const updatedAccount = await adapter.updateAccount(account.appUserID, migratedAccount);
    if (!updatedAccount) {
      sendError(response, 404, "User not found.");
      return;
    }
    sendJSON(response, 200, "localDataAttached");
    return;
  }

  const store = await readStore();
  const existingAccount = store.users[account.appUserID] || {};
  const migratedAccount = {
    ...account,
    ...existingAccount,
    migrationState: "localDataAttached"
  };
  store.users[account.appUserID] = migratedAccount;
  await writeStore(store);
  sendJSON(response, 200, "localDataAttached");
}

async function handleProfileUpdate(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID || body.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const context = await authenticatedUserContext(request, response, userID);
  if (!context) {
    return;
  }

  const publicUsername = normalizePublicUsername(body.publicUsername);
  const displayName = typeof body.displayName === "string" && body.displayName.trim().length
    ? body.displayName.trim()
    : null;
  const usernameValidationMessage = validatePublicUsername(publicUsername);
  if (usernameValidationMessage) {
    sendError(response, 400, usernameValidationMessage);
    return;
  }

  const adapter = await storeAdapter();
  if (typeof adapter.updateAccount === "function") {
    const existingAccount = context.account;
    if (!existingAccount) {
      sendError(response, 404, "User not found.");
      return;
    }
    const updatedAccount = {
      ...existingAccount,
      publicUsername,
      displayName: displayName ?? existingAccount.displayName ?? null
    };
    try {
      const savedAccount = await adapter.updateAccount(userID, updatedAccount);
      sendJSON(response, 200, { account: { ...savedAccount, backendSessionToken: context.sessionToken } });
    } catch (error) {
      if (error?.code === "23505") {
        sendError(response, 409, "Public username is already taken.");
        return;
      }
      throw error;
    }
    return;
  }

  const store = await readStore();
  if (publicUsername) {
    const usernameOwner = Object.values(store.users).find((user) =>
      user.publicUsername === publicUsername && user.appUserID !== userID
    );
    if (usernameOwner) {
      sendError(response, 409, "Public username is already taken.");
      return;
    }
  }

  const existingAccount = store.users[userID];
  if (!existingAccount) {
    sendError(response, 404, "User not found.");
    return;
  }

  const updatedAccount = {
    ...existingAccount,
    publicUsername,
    displayName: displayName ?? existingAccount.displayName ?? null
  };
  store.users[userID] = updatedAccount;
  await writeStore(store);
  sendJSON(response, 200, { account: updatedAccount });
}

async function handleSignOut(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID || body.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID, body.auth);
  if (!context) return;

  const adapter = await storeAdapter();
  if (typeof adapter.revokeUserSession === "function") {
    await adapter.revokeUserSession(userID, context.sessionToken);
    sendJSON(response, 200, { signedOut: true });
    return;
  }

  const store = await readStore();
  delete store.sessions[userID];
  await writeStore(store);
  sendJSON(response, 200, { signedOut: true });
}

function privateProjectAssetPathname(value) {
  const pathname = String(value || "").trim();
  const segments = pathname.split("/");
  if (
    segments.some((segment) =>
      !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment)
    )
  ) {
    return false;
  }
  return /^project-assets\/[a-f0-9]{32}\//.test(pathname) ||
    /^workboards\/[a-f0-9]{32}\/[a-f0-9]{32}\//.test(pathname);
}

function collectPrivateProjectAssetPathnames(value, pathnames = new Set()) {
  if (typeof value === "string") {
    if (privateProjectAssetPathname(value)) pathnames.add(value);
    return pathnames;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPrivateProjectAssetPathnames(item, pathnames));
    return pathnames;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectPrivateProjectAssetPathnames(item, pathnames));
  }
  return pathnames;
}

async function privateProjectAssetPathnamesForAccount(userID) {
  const adapter = await storeAdapter();
  const values = [await listStoredFoundationArtifacts(userID)];
  if (typeof adapter.pullUserContent === "function") {
    const pull = await adapter.pullUserContent(userID, { since: null, sinceEventID: null });
    values.push(pull.allMutations || pull.mutations || []);
  } else {
    const store = await readStore();
    values.push(store.mutationsByUserID?.[userID] || []);
  }
  return Array.from(collectPrivateProjectAssetPathnames(values));
}

async function deletePrivateProjectAssetPathnames(pathnames) {
  if (!pathnames.length) return;
  if (blobStorageConfigured()) {
    const { del } = await vercelBlob();
    for (let index = 0; index < pathnames.length; index += 100) {
      await del(pathnames.slice(index, index + 100));
    }
    return;
  }
  const root = localPrivateAssetRoot() || notebookLocalAssetRoot();
  if (!root) {
    throw new Error("Private project storage is unavailable for account deletion.");
  }
  for (const pathname of pathnames) {
    try {
      await unlink(resolveContainedPrivatePath(root, pathname));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

async function handleAccountDelete(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  if (body.confirmation !== "DELETE") {
    sendError(response, 400, "Account deletion requires explicit confirmation.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID, body.auth);
  if (!context) return;

  let billingCancellation;
  try {
    billingCancellation = await cancelStripeSubscriptionsForAccount({
      userID,
      entitlement: context.entitlement
    });
  } catch (error) {
    console.error("Account deletion stopped because Stripe cancellation failed.", error);
    sendJSON(response, 502, {
      error: "Permitext could not confirm that Stripe billing was canceled. Your account and data were not deleted. Try again or manage the subscription from Settings.",
      code: "STRIPE_CANCELLATION_FAILED"
    });
    return;
  }

  const pathnames = await privateProjectAssetPathnamesForAccount(userID);
  await deletePrivateProjectAssetPathnames(pathnames);
  const adapter = await storeAdapter();
  if (typeof adapter.deleteAccount !== "function" || !await adapter.deleteAccount(userID)) {
    sendError(response, 404, "Account not found.");
    return;
  }
  sendJSON(response, 200, {
    deleted: true,
    deletedPrivateAssetCount: pathnames.length,
    billingCancellation: {
      stripe: billingCancellation.canceledSubscriptions.length
        ? {
            status: "canceled",
            subscriptionCount: billingCancellation.canceledSubscriptions.length
          }
        : { status: "notApplicable", subscriptionCount: 0 },
      apple: billingCancellation.appleSubscriptionPresent
        ? {
            status: "userManaged",
            managementURL: "https://apps.apple.com/account/subscriptions"
          }
        : { status: "notApplicable" },
      lifetimeGrantRemoved: billingCancellation.lifetimeGrantPresent
    }
  });
}

function workboardPreviewSummary(artifact) {
  if (!artifact) return null;
  return {
    id: artifact.envelope.id,
    projectID: artifact.payload.projectID,
    title: artifact.payload.title,
    contentType: artifact.payload.contentType,
    contentHash: artifact.payload.contentHash,
    size: artifact.payload.size,
    elementCount: artifact.payload.elementCount,
    workboardUpdatedAt: artifact.payload.workboardUpdatedAt,
    createdAt: artifact.envelope.createdAt
  };
}

async function projectWorkboardPreviews(userID, projectID) {
  const linkedPreviewIDs = new Set(
    (await listStoredProjectLinks(userID))
      .filter((link) =>
        !link.deletedAt &&
        link.projectID === projectID &&
        link.targetKind === "workboardPreview"
      )
      .map((link) => link.targetID)
  );
  return (await listStoredFoundationArtifacts(userID))
    .filter((artifact) =>
      artifact.envelope?.type === "workboardPreview" &&
      !artifact.envelope?.deletedAt &&
      linkedPreviewIDs.has(artifact.envelope.id)
    )
    .sort((left, right) =>
      String(right.envelope.createdAt).localeCompare(String(left.envelope.createdAt))
    );
}

async function clearActiveWorkboardPreviewLinks(
  storageOwnerUserID,
  owner,
  projectID,
  now = new Date().toISOString()
) {
  const links = (await listStoredProjectLinks(storageOwnerUserID))
    .filter((link) =>
      !link.deletedAt &&
      link.projectID === projectID &&
      link.targetKind === "workboardPreview"
    );
  for (const link of links) {
    await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
      ...link,
      owner,
      updatedAt: now,
      deletedAt: now,
      version: link.version + 1
    }));
  }
  return links.length;
}

async function handleWorkboardPreviewUpload(request, response) {
  const userID = String(request.headers["x-permitext-user-id"] || "").trim();
  const url = requestURL(request);
  const projectID = String(url.searchParams.get("projectID") || "").trim();
  const workboardUpdatedAt = String(url.searchParams.get("workboardUpdatedAt") || "").trim();
  const elementCount = Number(url.searchParams.get("elementCount") || 0);
  if (
    !userID ||
    !projectID ||
    !Number.isSafeInteger(elementCount) ||
    elementCount < 1 ||
    !Number.isFinite(Date.parse(workboardUpdatedAt))
  ) {
    sendError(response, 400, "Missing or invalid Workboard preview identity.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;
  const access = await workboardEditAccess(response, userID, projectID);
  if (!access) return;
  if (!access.organization && !hasActiveProEntitlement(context.entitlement)) {
    sendJSON(response, 403, {
      error: "Workboard previews require Pro.",
      code: "PRO_REQUIRED_WORKBOARDS"
    });
    return;
  }
  const storageOwnerUserID = access.storageOwnerUserID;
  if (!privateProjectAssetStorageConfigured()) {
    sendError(response, 503, "Private Workboard preview storage is not configured.");
    return;
  }
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "image/png") {
    sendError(response, 415, "Workboard previews must be PNG images.");
    return;
  }
  const body = await readBody(request, maxWorkboardPreviewBytes);
  if (
    body.length < 64 ||
    body.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  ) {
    sendError(response, 400, "The Workboard preview is not a valid PNG image.");
    return;
  }
  const now = new Date().toISOString();
  const previewID = randomUUID();
  const requestedPathname = workboardPreviewPathname(projectID, previewID);
  const pathname = await storePrivateProjectAsset(requestedPathname, body, contentType);
  const artifact = {
    envelope: artifactEnvelope({
      id: previewID,
      type: "workboardPreview",
      owner: access.owner,
      createdAt: now,
      updatedAt: now,
      version: 1
    }),
    payload: {
      projectID,
      title: "Workboard preview",
      description: `${elementCount} Workboard ${elementCount === 1 ? "element" : "elements"}`,
      contentType,
      contentHash: createHash("sha256").update(body).digest("hex"),
      pathname,
      size: body.length,
      elementCount,
      workboardUpdatedAt: new Date(workboardUpdatedAt).toISOString(),
      readPath: "/workboards/previews/read",
      createdAt: now
    }
  };
  await saveStoredFoundationArtifact(storageOwnerUserID, artifact);
  await clearActiveWorkboardPreviewLinks(
    storageOwnerUserID,
    access.owner,
    access.projectID,
    now
  );
  await saveStoredProjectLink(storageOwnerUserID, projectLinkRecord({
    id: deterministicFoundationLinkID(
      storageOwnerUserID,
      access.projectID,
      "workboardPreview",
      previewID
    ),
    owner: access.owner,
    projectID: access.projectID,
    targetKind: "workboardPreview",
    targetID: previewID,
    relationship: "owner",
    createdAt: now,
    updatedAt: now,
    version: 1,
    metadata: {
      source: "web-workboard",
      workboardUpdatedAt: artifact.payload.workboardUpdatedAt
    }
  }));
  sendJSON(response, 201, { preview: workboardPreviewSummary(artifact) });
}

async function handleWorkboardPreviewRead(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  const projectID = String(body.projectID || "").trim();
  const previewID = String(body.previewID || "").trim();
  if (!userID || !projectID || !previewID) {
    sendError(response, 400, "Missing Workboard preview identity.");
    return;
  }
  if (!await authenticatedUserContext(request, response, userID, body.auth)) return;
  const access = await requireProjectPermission(
    response,
    userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;
  const artifact = (await listStoredFoundationArtifacts(access.storageOwnerUserID)).find((candidate) =>
    candidate.envelope?.id === previewID &&
    candidate.envelope?.type === "workboardPreview" &&
    !candidate.envelope?.deletedAt &&
    candidate.payload?.projectID === projectID
  );
  const pathname = artifact?.payload?.pathname;
  if (!pathname || !workboardPreviewPathBelongsToProject(pathname, projectID)) {
    sendError(response, 404, "Workboard preview not found.");
    return;
  }
  if (!privateProjectAssetStorageConfigured()) {
    sendError(response, 503, "Private Workboard preview storage is not configured.");
    return;
  }
  const image = await readPrivateProjectAsset(pathname);
  if (!image) {
    sendError(response, 404, "Workboard preview not found.");
    return;
  }
  if (createHash("sha256").update(image).digest("hex") !== artifact.payload.contentHash) {
    sendError(
      response,
      409,
      "The stored Workboard preview no longer matches its immutable content hash."
    );
    return;
  }
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "private, no-store",
    "content-type": "image/png",
    "content-length": String(image.length)
  });
  response.end(image);
}

async function handleWorkboardPreviewClear(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  const projectID = String(body.projectID || "").trim();
  if (!userID || !projectID) {
    sendError(response, 400, "Missing Workboard preview identity.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID, body.auth);
  if (!context) return;
  const access = await workboardEditAccess(response, userID, projectID);
  if (!access) return;
  if (!access.organization && !hasActiveProEntitlement(context.entitlement)) {
    sendJSON(response, 403, {
      error: "Workboard previews require Pro.",
      code: "PRO_REQUIRED_WORKBOARDS"
    });
    return;
  }
  const clearedCount = await clearActiveWorkboardPreviewLinks(
    access.storageOwnerUserID,
    access.owner,
    access.projectID
  );
  sendJSON(response, 200, { projectID: access.projectID, clearedCount });
}

async function handleNotebookAssetUpload(request, response) {
  const userID = String(request.headers["x-permitext-user-id"] || "").trim();
  const url = requestURL(request);
  const projectID = String(url.searchParams.get("projectID") || "").trim();
  const assetID = String(url.searchParams.get("assetID") || "").trim();
  if (
    !userID ||
    !projectID ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetID) ||
    projectID.length > 200
  ) {
    sendError(response, 400, "Missing or invalid Notebook image identity.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;
  const access = await requireProjectPermission(
    response,
    userID,
    projectID,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  if (!access.organization && !hasActiveProEntitlement(context.entitlement)) {
    sendJSON(response, 403, {
      error: "Notebook image uploads require Pro.",
      code: "PRO_REQUIRED_NOTEBOOK"
    });
    return;
  }
  const imageStorage = notebookImageStorage();
  if (!imageStorage) {
    sendError(response, 503, "Private Notebook image storage is not configured.");
    return;
  }
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!notebookAssetExtension(contentType)) {
    sendError(response, 415, "Notebook images must be PNG, JPEG, WebP, or GIF files.");
    return;
  }
  const body = await readBody(request, maxNotebookAssetBytes);
  if (!body.length) {
    sendError(response, 400, "Notebook image is empty.");
    return;
  }
  const detectedContentType = notebookImageContentType(body);
  if (!detectedContentType || detectedContentType !== contentType) {
    sendError(response, 415, "The Notebook image contents do not match its PNG, JPEG, WebP, or GIF type.");
    return;
  }
  const contentHash = createHash("sha256").update(body).digest("hex");
  const existingArtifact = await notebookArtifactWithIdentity(access.storageOwnerUserID, assetID);
  if (existingArtifact) {
    const idempotent =
      existingArtifact.envelope?.type === "notebookImageAsset" &&
      !existingArtifact.envelope?.deletedAt &&
      existingArtifact.payload?.projectID === access.projectID &&
      existingArtifact.payload?.uploadedBy === userID &&
      existingArtifact.payload?.contentHash === contentHash &&
      existingArtifact.payload?.contentType === contentType &&
      existingArtifact.payload?.size === body.length;
    if (!idempotent) {
      sendJSON(response, 409, {
        error: "This Notebook image identity is already in use.",
        code: "NOTEBOOK_IMAGE_ID_CONFLICT"
      });
      return;
    }
    await retryPendingNotebookImageDeletions(access.storageOwnerUserID);
    sendJSON(response, 200, {
      asset: {
        projectID: access.projectID,
        assetID,
        url: `permitext-notebook-asset:${assetID}`,
        storageProvider: existingArtifact.payload.storageProvider,
        contentType,
        size: body.length,
        width: existingArtifact.payload.width,
        height: existingArtifact.payload.height,
        uploadedAt: existingArtifact.payload.uploadedAt
      }
    });
    return;
  }
  const pathname = notebookAssetPathname(access.projectID, assetID, contentType);
  let storedPathname = "";
  try {
    const existingBody = await imageStorage.get(pathname);
    if (existingBody) {
      if (!existingBody.equals(body)) {
        sendJSON(response, 409, {
          error: "This Notebook image storage key is already in use.",
          code: "NOTEBOOK_IMAGE_ID_CONFLICT"
        });
        return;
      }
      storedPathname = pathname;
    } else {
      try {
        storedPathname = await imageStorage.put(pathname, body, contentType);
      } catch (writeError) {
        const racedBody = await imageStorage.get(pathname);
        if (!racedBody?.equals(body)) throw writeError;
        storedPathname = pathname;
      }
    }
  } catch (error) {
    sendJSON(response, 503, {
      error: error instanceof Error ? error.message : "Notebook image storage is unavailable.",
      code: "NOTEBOOK_IMAGE_STORAGE_FAILED"
    });
    return;
  }
  const width = Number(request.headers["x-permitext-image-width"] || 0);
  const height = Number(request.headers["x-permitext-image-height"] || 0);
  const now = new Date().toISOString();
  const asset = {
    envelope: artifactEnvelope({
      id: assetID,
      type: "notebookImageAsset",
      owner: access.owner,
      createdAt: now,
      updatedAt: now,
      version: 1
    }),
    payload: {
      projectID: access.projectID,
      storageProvider: imageStorage.name,
      storageKey: storedPathname,
      contentHash,
      contentType,
      size: body.length,
      width: Number.isSafeInteger(width) && width > 0 ? width : null,
      height: Number.isSafeInteger(height) && height > 0 ? height : null,
      uploadedAt: now,
      uploadedBy: userID
    }
  };
  try {
    await saveStoredFoundationArtifact(access.storageOwnerUserID, asset);
  } catch (error) {
    await imageStorage.delete(storedPathname).catch(() => {});
    throw error;
  }
  await retryPendingNotebookImageDeletions(access.storageOwnerUserID);
  sendJSON(response, 200, {
    asset: {
      projectID: access.projectID,
      assetID,
      url: `permitext-notebook-asset:${assetID}`,
      storageProvider: imageStorage.name,
      contentType,
      size: body.length,
      width: asset.payload.width,
      height: asset.payload.height,
      uploadedAt: now
    }
  });
}

async function handleNotebookAssetRead(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  const projectID = String(body.projectID || "").trim();
  const assetID = String(body.assetID || "").trim();
  const legacyPathname = String(body.pathname || "").trim();
  if (!userID || !projectID || (!assetID && !legacyPathname)) {
    sendError(response, 400, "Missing Notebook image identity.");
    return;
  }
  if (!await authenticatedUserContext(request, response, userID, body.auth)) return;
  const access = await requireProjectPermission(
    response,
    userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;
  const asset = assetID
    ? await ownedNotebookImageAsset(access.storageOwnerUserID, assetID)
    : null;
  if (assetID && !asset) {
    sendError(response, 404, "Notebook image was not found.");
    return;
  }
  const pathname = asset?.payload?.storageKey || legacyPathname;
  if (
    (asset && !await notebookImageAccessibleFromProject(
      access.storageOwnerUserID,
      access.projectID,
      assetID
    )) ||
    (!asset && !notebookAssetPathBelongsToProject(pathname, access.projectID))
  ) {
    sendError(response, 403, "This Notebook image does not belong to the authenticated Project.");
    return;
  }
  const imageStorage = notebookImageStorage(asset?.payload?.storageProvider || "");
  if (!imageStorage) {
    sendError(response, 503, "Private Notebook image storage is not configured.");
    return;
  }
  const image = await imageStorage.get(pathname);
  if (!image) {
    sendError(response, 404, "Notebook image was not found.");
    return;
  }
  if (
    asset?.payload?.contentHash &&
    createHash("sha256").update(image).digest("hex") !== asset.payload.contentHash
  ) {
    sendError(response, 409, "The stored Notebook image no longer matches its synchronized metadata.");
    return;
  }
  const extension = pathname.split(".").pop();
  const contentType = asset?.payload?.contentType || {
    gif: "image/gif",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  }[extension] || "application/octet-stream";
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "private, no-store",
    "content-type": contentType,
    "content-length": String(image.length)
  });
  response.end(image);
}

async function handleNotebookAssetDelete(request, response) {
  const context = await authenticatedNotebookBody(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  const assetID = String(context.body.assetID || "").trim();
  const access = await notebookProjectAccess(
    context,
    response,
    organizationPermissions.projectEdit
  );
  if (!access) return;
  const asset = await ownedNotebookImageAsset(access.storageOwnerUserID, assetID);
  if (!asset || asset.payload?.projectID !== projectID) {
    sendError(response, 404, "Notebook image was not found.");
    return;
  }
  const artifacts = await listStoredFoundationArtifacts(access.storageOwnerUserID);
  const referenced = artifacts.some((artifact) =>
    ["notebookCard", "projectNote"].includes(artifact.envelope?.type) &&
    !artifact.envelope?.deletedAt &&
    (artifact.payload?.imageAssets || []).includes(assetID)
  );
  if (referenced) {
    sendJSON(response, 409, {
      error: "This Notebook image is still referenced by synchronized content.",
      code: "NOTEBOOK_IMAGE_IN_USE"
    });
    return;
  }
  await deleteOrphanedNotebookImageAssets(
    access.storageOwnerUserID,
    projectID,
    [assetID]
  );
  sendJSON(response, 200, { assetID, deletionQueued: true });
}

async function handleWorkboardAssetUpload(request, response) {
  const userID = String(request.headers["x-permitext-user-id"] || "").trim();
  const url = requestURL(request);
  const projectID = String(url.searchParams.get("projectID") || "").trim();
  const fileID = String(url.searchParams.get("fileID") || "").trim();
  if (!userID || !projectID || !fileID || projectID.length > 200 || fileID.length > 200) {
    sendError(response, 400, "Missing or invalid Workboard asset identity.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;
  const access = await workboardEditAccess(response, userID, projectID);
  if (!access) return;
  if (!access.organization && !hasActiveProEntitlement(context.entitlement)) {
    sendJSON(response, 403, {
      error: "Workboard image uploads require Pro.",
      code: "PRO_REQUIRED_WORKBOARDS"
    });
    return;
  }
  if (!blobStorageConfigured()) {
    sendError(response, 503, "Private Workboard image storage is not configured.");
    return;
  }
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!workboardAssetExtension(contentType)) {
    sendError(response, 415, "Workboard images must be PNG, JPEG, WebP, or GIF files.");
    return;
  }
  const body = await readBody(request, maxWorkboardAssetBytes);
  if (!body.length) {
    sendError(response, 400, "Workboard image is empty.");
    return;
  }
  const pathname = workboardAssetPathname(
    access.storageOwnerUserID,
    access.projectID,
    fileID,
    contentType
  );
  const { put } = await vercelBlob();
  const blob = await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });
  sendJSON(response, 200, {
    asset: {
      projectID,
      fileID,
      pathname: blob.pathname || pathname,
      contentType,
      size: body.length,
      uploadedAt: new Date().toISOString()
    }
  });
}

async function handleWorkboardAssetRead(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  const projectID = String(body.projectID || "").trim();
  const pathname = String(body.pathname || "").trim();
  if (!userID || !projectID || !pathname) {
    sendError(response, 400, "Missing Workboard asset identity.");
    return;
  }
  if (!await authenticatedUserContext(request, response, userID, body.auth)) return;
  const access = await requireProjectPermission(
    response,
    userID,
    projectID,
    organizationPermissions.projectView
  );
  if (!access) return;
  if (!workboardAssetPathBelongsToProject(pathname, access.storageOwnerUserID, projectID)) {
    sendError(response, 403, "This Workboard image does not belong to the authenticated project.");
    return;
  }
  if (!blobStorageConfigured()) {
    sendError(response, 503, "Private Workboard image storage is not configured.");
    return;
  }
  const { get } = await vercelBlob();
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) {
    sendError(response, 404, "Workboard image was not found.");
    return;
  }
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "private, no-store",
    "content-type": result.blob.contentType || "application/octet-stream",
    ...(Number.isFinite(result.blob.size) ? { "content-length": String(result.blob.size) } : {})
  });
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    response.write(Buffer.from(value));
  }
  response.end();
}

async function handleWorkboardAssetDelete(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  const projectID = String(body.projectID || "").trim();
  const pathnames = Array.isArray(body.pathnames) ? body.pathnames.map((value) => String(value || "").trim()) : [];
  if (!userID || !projectID || !pathnames.length || pathnames.length > maxWorkboardAssets) {
    sendError(response, 400, "Missing or invalid Workboard asset deletion request.");
    return;
  }
  if (!await authenticatedUserContext(request, response, userID, body.auth)) return;
  const access = await workboardEditAccess(response, userID, projectID);
  if (!access) return;
  if (pathnames.some((pathname) =>
    !workboardAssetPathBelongsToProject(
      pathname,
      access.storageOwnerUserID,
      access.projectID
    )
  )) {
    sendError(response, 403, "One or more Workboard images do not belong to the authenticated project.");
    return;
  }
  if (!blobStorageConfigured()) {
    sendError(response, 503, "Private Workboard image storage is not configured.");
    return;
  }
  const { del } = await vercelBlob();
  await del(pathnames);
  sendJSON(response, 200, { deletedCount: pathnames.length });
}

async function syncResponseContract(userID, entitlement, body, contentMapVersion) {
  const organizationCapabilities = await organizationCapabilityAccess(userID);
  const codeQuestionAccess = codeQuestionRolloutAccess({ userID });
  return syncContract({
    entitlement,
    clientSchemaVersion: body.syncSchemaVersion ?? body.batch?.syncSchemaVersion,
    clientCapabilities: body.clientCapabilities ?? body.batch?.clientCapabilities,
    contentMapVersion,
    researchMonthlyLimit: monthlyResearchRequestLimit(),
    evidenceDiscoveryEnabled: evidenceDiscoveryFeatureEnabled(),
    codeQuestionWorkspaceEnabled: codeQuestionAccess.enabled,
    ...organizationCapabilities,
    migrationCheckpoint: await storedMigrationCheckpoint(
      userID,
      `project-foundation-v${projectFoundationSchemaVersion}`
    )
  });
}

async function recordMeaningfulSyncActivity(userID, previousMutations, incomingMutations, acceptedMutationIDs) {
  const acceptedIDs = new Set(acceptedMutationIDs || []);
  const previousByID = new Map((previousMutations || []).map((mutation) => [
    normalizedMutationRecordID(mutation),
    mutation
  ]));
  for (const mutation of incomingMutations || []) {
    const recordID = normalizedMutationRecordID(mutation);
    if (!recordID || !acceptedIDs.has(recordID)) continue;
    const { kind, record } = mutationKindAndRecord(mutation);
    if (kind !== "project" || !record) continue;
    const previous = mutationKindAndRecord(previousByID.get(recordID) || {}).record;
    const wasArchived = Number.isFinite(Date.parse(previous?.archivedAt || ""));
    const isArchived = Number.isFinite(Date.parse(record.archivedAt || ""));
    if (wasArchived === isArchived) continue;
    const projectID = projectIdentityForRecord(record, userID);
    if (!projectID) continue;
    await saveStoredActivityEvent(userID, activityEvent({
      owner: ownerScope(userID),
      projectID,
      actorUserID: userID,
      action: isArchived ? "project.archived" : "project.restored",
      objectKind: "project",
      objectID: recordID,
      previousStatus: wasArchived ? "archived" : "active",
      newStatus: isArchived ? "archived" : "active",
      createdAt: record.updatedAt || new Date().toISOString()
    }));
  }
}

export function syncBatchIncludesProjectMutation(mutations) {
  return (mutations || []).some((mutation) => mutationKindAndRecord(mutation).kind === "project");
}

async function handlePush(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID || body.batch?.user?.id;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  if (body.auth?.accountUserID && body.batch?.user?.id && body.auth.accountUserID !== body.batch.user.id) {
    sendError(response, 400, "Authenticated user must match the sync batch user.");
    return;
  }

  if (body.batch?.mutations !== undefined && !Array.isArray(body.batch.mutations)) {
    sendError(response, 400, "Mutations must be an array.");
    return;
  }
  if ((body.batch?.mutations?.length || 0) > maxSyncMutationsPerBatch) {
    sendError(response, 413, `Sync batches are limited to ${maxSyncMutationsPerBatch} mutations.`);
    return;
  }

  const submittedMutations = body.batch?.mutations || [];
  const submittedValidation = validateMutations(submittedMutations, userID);
  if (!submittedValidation.ok) {
    sendError(response, 400, submittedValidation.message);
    return;
  }

  const canonicalizedBatch = await canonicalizeMutationBatch(submittedMutations);
  const incoming = canonicalizedBatch.mutations;
  const validation = validateMutations(incoming, userID);
  if (!validation.ok) {
    sendError(response, 400, validation.message);
    return;
  }

  const adapter = await storeAdapter();
  if (typeof adapter.pushUserContent === "function") {
    const context = await authenticatedUserContext(request, response, userID);
    if (!context) {
      return;
    }
    const includesProjectMutation = syncBatchIncludesProjectMutation(incoming);
    const previousMutations = includesProjectMutation
      ? (await readStore()).mutationsByUserID?.[userID] || []
      : [];
    const result = await adapter.pushUserContent(userID, incoming);
    if (includesProjectMutation) {
      await recordMeaningfulSyncActivity(
        userID,
        previousMutations,
        incoming,
        result.acceptedMutationIDs
      );
    }
    const contentMapVersion = Number((await canonicalSectionIDs()).schemaVersion || 0);
    sendJSON(response, 200, {
      acceptedMutationIDs: includeSubmittedMutationIDAliases(
        result.acceptedMutationIDs,
        canonicalizedBatch.aliasesByCanonicalID
      ),
      rejectedMutationIDs: includeSubmittedMutationIDAliases(
        result.rejectedMutationIDs,
        canonicalizedBatch.aliasesByCanonicalID
      ),
      rejectionReasons: includeSubmittedMutationReasonAliases(
        result.rejectionReasons,
        canonicalizedBatch.aliasesByCanonicalID
      ),
      latestEventID: result.latestEventID,
      syncRevision: result.latestEventID,
      entitlement: result.entitlement,
      serverTime: new Date().toISOString(),
      ...await syncResponseContract(userID, result.entitlement, body, contentMapVersion)
    });
    return;
  }

  const store = await readStore();
  if (!await authenticatedUserContext(request, response, userID, undefined, store)) {
    return;
  }
  store.users[userID] = body.batch?.user ? { ...(store.users[userID] || {}), ...body.batch.user } : store.users[userID];

  const existing = await canonicalizeMutations(store.mutationsByUserID[userID] || []);
  const planEnforcement = enforceFreePlanMutationBatch(
    existing,
    incoming,
    store.entitlements[userID] || null
  );
  const merge = mergeMutations(existing, planEnforcement.acceptedMutations);
  store.mutationsByUserID[userID] = merge.mutations;
  if (merge.acceptedMutationIDs.length > 0) {
    store.syncRevisionsByUserID[userID] = Number(store.syncRevisionsByUserID[userID] || 0) + 1;
  }
  await writeStore(store);
  await recordMeaningfulSyncActivity(
    userID,
    existing,
    planEnforcement.acceptedMutations,
    merge.acceptedMutationIDs
  );
  const latestEventID = await latestSyncEventID(userID);
  const contentMapVersion = Number((await canonicalSectionIDs()).schemaVersion || 0);
  sendJSON(response, 200, {
    acceptedMutationIDs: includeSubmittedMutationIDAliases(
      merge.acceptedMutationIDs,
      canonicalizedBatch.aliasesByCanonicalID
    ),
    rejectedMutationIDs: includeSubmittedMutationIDAliases(
      [...merge.rejectedMutationIDs, ...planEnforcement.rejectedMutationIDs],
      canonicalizedBatch.aliasesByCanonicalID
    ),
    rejectionReasons: includeSubmittedMutationReasonAliases(
      planEnforcement.rejectionReasons,
      canonicalizedBatch.aliasesByCanonicalID
    ),
    latestEventID,
    syncRevision: latestEventID,
    entitlement: store.entitlements[userID] || null,
    serverTime: new Date().toISOString(),
    ...await syncResponseContract(
      userID,
      store.entitlements[userID] || null,
      body,
      contentMapVersion
    )
  });
}

async function handlePull(request, response) {
  const telemetryStartedAt = performance.now();
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const since = body.since ? Date.parse(body.since) : null;
  const contentMapVersion = Number((await canonicalSectionIDs()).schemaVersion || 0);
  const sinceEventID = Number(body.contentMapVersion) === contentMapVersion
    ? normalizedSinceEventID(body)
    : null;
  const excludedMutationKinds = normalizedExcludedMutationKinds(body);
  const adapter = await storeAdapter();
  if (typeof adapter.pullUserContent === "function") {
    const context = await authenticatedUserContext(request, response, userID);
    if (!context) {
      return;
    }
    const result = await adapter.pullUserContent(userID, { since, sinceEventID });
    const expanded = expandPullMutationsWithDependencies(result.mutations, result.allMutations);
    const mutations = filterMutationsByExcludedKinds(
      await canonicalizeMutations(expanded),
      excludedMutationKinds
    );
    const responseContract = await syncResponseContract(userID, result.entitlement, body, contentMapVersion);
    logSyncTelemetry({
      mode: "full-pull",
      userID,
      changed: mutations.length > 0,
      mutationCount: mutations.length,
      excludedMutationKinds: Array.from(excludedMutationKinds),
      durationMs: performance.now() - telemetryStartedAt
    });
    sendJSON(response, 200, {
      userID,
      pulledAt: new Date().toISOString(),
      latestEventID: result.latestEventID,
      syncRevision: result.latestEventID,
      contentMapVersion,
      entitlement: result.entitlement,
      entitlementFingerprint: syncEntitlementFingerprint(result.entitlement),
      mutations,
      ...responseContract
    });
    return;
  }

  const store = await readStore();
  if (!await authenticatedUserContext(request, response, userID, undefined, store)) {
    return;
  }
  const allMutations = store.mutationsByUserID[userID] || [];
  // Return the current canonical state until clients send a content-map version.
  // Otherwise old event checkpoints can hide server-side section ID repairs.
  const filteredMutations = Number.isFinite(since) ? allMutations.filter((mutation) => mutationUpdatedAt(mutation) > since) : allMutations;
  const mutations = filterMutationsByExcludedKinds(
    await canonicalizeMutations(expandPullMutationsWithDependencies(filteredMutations, allMutations)),
    excludedMutationKinds
  );
  const latestEventID = await latestSyncEventID(userID);
  const entitlement = store.entitlements[userID] || null;
  const responseContract = await syncResponseContract(userID, entitlement, body, contentMapVersion);
  logSyncTelemetry({
    mode: "full-pull",
    userID,
    changed: mutations.length > 0,
    mutationCount: mutations.length,
    excludedMutationKinds: Array.from(excludedMutationKinds),
    durationMs: performance.now() - telemetryStartedAt
  });
  sendJSON(response, 200, {
    userID,
    pulledAt: new Date().toISOString(),
    latestEventID,
    syncRevision: latestEventID,
    contentMapVersion,
    entitlement,
    entitlementFingerprint: syncEntitlementFingerprint(entitlement),
    mutations,
    ...responseContract
  });
}

function syncEntitlementFingerprint(entitlement) {
  return createHash("sha256")
    .update(JSON.stringify(entitlement || null))
    .digest("hex")
    .slice(0, 24);
}

function logSyncTelemetry({ mode, userID, changed, mutationCount = 0, excludedMutationKinds = [], durationMs }) {
  console.info(JSON.stringify({
    event: "permitext.sync",
    mode,
    principal: createHash("sha256").update(String(userID || "")).digest("hex").slice(0, 12),
    changed: Boolean(changed),
    mutationCount: Number(mutationCount || 0),
    excludedMutationKinds: Array.isArray(excludedMutationKinds) ? excludedMutationKinds : [],
    durationMs: Math.round(Number(durationMs || 0)),
    observedAt: new Date().toISOString()
  }));
}

async function handleSyncCheckpoint(request, response) {
  const telemetryStartedAt = performance.now();
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;

  const latestEventID = await latestSyncEventID(userID);
  const contentMapVersion = Number((await canonicalSectionIDs()).schemaVersion || 0);
  const entitlementFingerprint = syncEntitlementFingerprint(context.entitlement);
  const changed =
    Number(body.sinceEventID || 0) !== latestEventID ||
    Number(body.contentMapVersion || 0) !== contentMapVersion ||
    String(body.entitlementFingerprint || "") !== entitlementFingerprint;
  logSyncTelemetry({
    mode: "checkpoint",
    userID,
    changed,
    durationMs: performance.now() - telemetryStartedAt
  });
  sendJSON(response, 200, {
    userID,
    checkedAt: new Date().toISOString(),
    changed,
    latestEventID,
    syncRevision: latestEventID,
    contentMapVersion,
    entitlementFingerprint
  });
}

async function handleWebCheckout(request, response) {
  const body = await readJSON(request);
  const packageID = normalizedCommercialPackageID(body.packageID);
  if (!packageID) {
    sendError(response, 400, "Choose a supported Permitext package.");
    return;
  }
  const stripeStatus = stripeConfigurationStatus({ packageID });
  if (!stripeStatus.ready) {
    sendError(response, 503, stripeStatus.message);
    return;
  }

  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const accountContext = await authenticatedUserContext(request, response, userID);
  if (!accountContext) return;
  if (
    packageID === entitlementPackageIDs.research &&
    !hasActiveProEntitlement(accountContext.entitlement)
  ) {
    sendJSON(response, 409, {
      error: "Subscribe to Pro before adding Research.",
      code: "PRO_REQUIRED_FOR_RESEARCH"
    });
    return;
  }

  const baseURL = configuredPublicBaseURL(request);
  const successURL = sameOriginAbsoluteURL(
    baseURL,
    body.successURL,
    `/?checkout=success&package=${packageID}&session_id={CHECKOUT_SESSION_ID}`
  );
  const cancelURL = sameOriginAbsoluteURL(baseURL, body.cancelURL, "/?checkout=cancel");
  if (!successURL || !cancelURL) {
    sendError(response, 400, "Checkout return URLs must use the Permitext origin.");
    return;
  }
  const formBody = encodedFormBody({
    mode: "subscription",
    client_reference_id: userID,
    success_url: successURL,
    cancel_url: cancelURL,
    allow_promotion_codes: true,
    line_items: [{ price: stripePriceID(packageID), quantity: 1 }],
    metadata: { accountUserID: userID, permitextPackage: packageID },
    subscription_data: {
      metadata: { accountUserID: userID, permitextPackage: packageID }
    }
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${process.env.STRIPE_SECRET_KEY}:`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formBody
  });
  const text = await stripeResponse.text();
  const json = text ? JSON.parse(text) : {};
  if (!stripeResponse.ok) {
    sendError(response, stripeResponse.status, json.error?.message || "Stripe checkout failed.");
    return;
  }
  if (liveStripeRequired() && json.livemode !== true) {
    console.error("Stripe returned a test-mode Checkout Session in production.");
    sendError(response, 502, "Stripe returned a test-mode checkout. No purchase was started.");
    return;
  }

  sendJSON(response, 200, {
    checkoutSessionID: json.id,
    packageID,
    url: json.url
  });
}

async function handleWebPortal(request, response) {
  const stripeStatus = stripeConfigurationStatus();
  if (!stripeStatus.ready) {
    sendError(response, 503, stripeStatus.message);
    return;
  }

  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const context = await authenticatedUserContext(request, response, userID);
  if (!context) return;

  let customerID = stripeSubscriptionID(
    context.entitlement?.provider?.stripeCustomerID ||
    context.entitlement?.addOns?.research?.provider?.stripeCustomerID
  );
  if (!customerID) {
    const subscription = await activeStripeSubscriptionForUserID(userID);
    customerID = stripeSubscriptionID(subscription?.customer);
  }
  if (!customerID) {
    sendError(response, 404, "No Stripe subscription was found for this account.");
    return;
  }

  const portal = await stripeAPI("/v1/billing_portal/sessions", {
    method: "POST",
    body: encodedFormBody({
      customer: customerID,
      return_url: `${configuredPublicBaseURL(request)}/`
    })
  });
  sendJSON(response, 200, { url: portal.url });
}

async function stripeSubscriptionFromRestoreID(restoreID) {
  const trimmed = String(restoreID || "").trim();
  if (!trimmed) {
    throw new ClientAuthError(400, "Missing Stripe restore ID.");
  }
  if (trimmed.startsWith("sub_")) {
    return {
      checkoutSession: null,
      subscription: await stripeAPI(`/v1/subscriptions/${encodeURIComponent(trimmed)}`)
    };
  }
  if (trimmed.startsWith("cs_")) {
    const session = await stripeAPI(`/v1/checkout/sessions/${encodeURIComponent(trimmed)}`);
    const subscriptionID = stripeSubscriptionID(session.subscription);
    if (!subscriptionID) {
      throw new ClientAuthError(404, "Checkout session has no subscription.");
    }
    return {
      checkoutSession: session,
      subscription: await stripeAPI(`/v1/subscriptions/${encodeURIComponent(subscriptionID)}`)
    };
  }
  throw new ClientAuthError(400, "Use a Stripe subscription ID or checkout session ID.");
}

async function handleStripeRestore(request, response) {
  const stripeStatus = stripeConfigurationStatus();
  if (!stripeStatus.ready) {
    sendError(response, 503, stripeStatus.message);
    return;
  }

  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const accountContext = await authenticatedUserContext(request, response, userID);
  if (!accountContext) return;

  let checkoutSession;
  let subscription;
  try {
    ({ checkoutSession, subscription } = await stripeSubscriptionFromRestoreID(
      body.restoreID || body.subscriptionID || body.checkoutSessionID
    ));
  } catch (error) {
    if (error instanceof ClientAuthError) {
      sendError(response, error.statusCode, error.message);
      return;
    }
    throw error;
  }
  if (!["active", "trialing"].includes(subscription.status)) {
    sendError(response, 402, "Stripe subscription is not active.");
    return;
  }

  const packageID = stripePackageIDFromObject(subscription);
  if (!packageID) {
    sendError(response, 422, "Stripe subscription has unsupported Permitext package metadata.");
    return;
  }
  if (
    packageID === entitlementPackageIDs.research &&
    !hasActiveProEntitlement(accountContext.entitlement)
  ) {
    sendJSON(response, 409, {
      error: "Restore an active Pro plan before restoring Research.",
      code: "PRO_REQUIRED_FOR_RESEARCH"
    });
    return;
  }
  const subscriptionID = stripeSubscriptionID(subscription.id);
  const persistedOwner = await persistedStripeEntitlementOwner(subscriptionID);
  try {
    validateStripeRestoreOwnership({
      subscription,
      checkoutSession,
      persistedOwnerUserID: persistedOwner?.userID,
      requestedUserID: userID
    });
  } catch (error) {
    if (error instanceof ClientAuthError) {
      sendError(response, error.statusCode, error.message);
      return;
    }
    throw error;
  }

  if (!normalizedStripeAccountUserID(subscription.metadata?.accountUserID)) {
    await transferStripeSubscriptionMetadata(subscriptionID, userID, packageID);
  }
  const entitlement = await persistServerEntitlement(userID, "webSubscription", {
    packageID,
    explicitPackage: stripePackageIsExplicit(subscription),
    expiresAt: stripeSubscriptionExpiresAt(subscription),
    provider: {
      stripeCustomerID: stripeSubscriptionID(subscription.customer),
      stripeSubscriptionID: subscriptionID,
      restoredManually: true
    }
  });
  sendJSON(response, 200, {
    entitlement,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      packageID
    }
  });
}

async function handleStripeWebhook(request, response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    sendError(response, 503, "Stripe webhook is not configured.");
    return;
  }

  const rawBody = await readRawBody(request);
  const signatureHeader = request.headers["stripe-signature"];
  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    sendError(response, 400, "Invalid Stripe signature.");
    return;
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  if (liveStripeRequired() && event.livemode !== true) {
    sendError(response, 400, "Stripe test-mode webhook events are not accepted in production.");
    return;
  }
  const object = event?.data?.object || {};
  let changed = false;

  switch (event.type) {
  case "checkout.session.completed": {
    const userID = stripeUserIDFromObject(object);
    const completedSubscriptionCheckout =
      object.mode === "subscription" &&
      ["paid", "no_payment_required"].includes(object.payment_status);
    if (userID && completedSubscriptionCheckout && await persistedAccountExists(userID)) {
      const packageID = stripePackageIDFromObject(object);
      await persistServerEntitlement(userID, "webSubscription", {
        packageID,
        explicitPackage: stripePackageIsExplicit(object),
        expiresAt: stripeCheckoutProvisionalExpiresAt(event),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: stripeSubscriptionID(object.subscription),
          stripeCheckoutSessionID: object.id,
          stripeEventCreatedAt: stripeEventCreatedAt(event)
        }
      });
      changed = true;
    }
    break;
  }
  case "customer.subscription.created":
  case "customer.subscription.updated": {
    const userID = stripeUserIDFromObject(object);
    const subscriptionID = stripeSubscriptionID(object);
    if (
      userID &&
      ["active", "trialing"].includes(object.status) &&
      await persistedAccountExists(userID)
    ) {
      const packageID = stripePackageIDFromObject(object);
      await persistServerEntitlement(userID, "webSubscription", {
        packageID,
        explicitPackage: stripePackageIsExplicit(object),
        expiresAt: stripeSubscriptionExpiresAt(object),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: subscriptionID,
          stripeEventCreatedAt: stripeEventCreatedAt(event)
        }
      });
      changed = true;
    } else if (subscriptionID && ["canceled", "incomplete_expired", "unpaid", "paused"].includes(object.status)) {
      const owner = await persistedStripeEntitlementOwner(subscriptionID);
      const packageID = owner
        ? entitlementPackageForStripeSubscription(owner.entitlement, subscriptionID)
        : stripePackageIDFromObject(object);
      changed = owner ? await deletePersistedEntitlement(owner.userID, {
        packageID,
        source: "webSubscription",
        providerKey: "stripeSubscriptionID",
        providerValue: subscriptionID
      }) : false;
    }
    break;
  }
  case "customer.subscription.deleted": {
    const subscriptionID = stripeSubscriptionID(object);
    const owner = await persistedStripeEntitlementOwner(subscriptionID);
    const packageID = owner
      ? entitlementPackageForStripeSubscription(owner.entitlement, subscriptionID)
      : stripePackageIDFromObject(object);
    changed = owner ? await deletePersistedEntitlement(owner.userID, {
      packageID,
      source: "webSubscription",
      providerKey: "stripeSubscriptionID",
      providerValue: subscriptionID
    }) : false;
    break;
  }
  case "invoice.payment_succeeded": {
    const subscriptionID = stripeSubscriptionIDFromObject(object);
    const owner = subscriptionID ? await persistedStripeEntitlementOwner(subscriptionID) : null;
    const userID = stripeUserIDFromObject(object) || owner?.userID;
    if (userID && subscriptionID && await persistedAccountExists(userID)) {
      const packageID = owner
        ? entitlementPackageForStripeSubscription(owner.entitlement, subscriptionID)
        : stripePackageIDFromObject(object);
      await persistServerEntitlement(userID, "webSubscription", {
        packageID,
        explicitPackage: stripePackageIsExplicit(object) ||
          Boolean(owner?.entitlement?.provider?.permitextPackage) ||
          Boolean(owner?.entitlement?.addOns?.research?.provider?.permitextPackage),
        expiresAt: stripeSubscriptionExpiresAt(object),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: subscriptionID,
          stripeEventCreatedAt: stripeEventCreatedAt(event)
        }
      });
      changed = true;
    }
    break;
  }
  default:
    break;
  }
  sendJSON(response, 200, { received: true, changed });
}

async function handleAppleTransactionVerify(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  if (!body.signedTransactionInfo) {
    sendError(response, 400, "Missing signed transaction.");
    return;
  }

  const accountContext = await authenticatedUserContext(request, response, userID);
  if (!accountContext) {
    return;
  }

  let payload;
  try {
    payload = verifyAppleTransactionJWS(body.signedTransactionInfo);
  } catch (error) {
    if (error instanceof ClientAuthError) {
      console.warn("Apple transaction verification failed.", {
        statusCode: error.statusCode,
        reason: error.message
      });
      sendError(response, error.statusCode, error.message);
      return;
    }
    throw error;
  }

  const transactionID = String(payload.transactionId || "");
  const originalTransactionID = String(payload.originalTransactionId || transactionID);
  const packageID = applePackageIDForProductID(payload.productId);
  if (!transactionID || !originalTransactionID) {
    sendError(response, 422, "Apple transaction identifier is missing.");
    return;
  }
  const provider = {
    appleTransactionID: transactionID,
    appleOriginalTransactionID: originalTransactionID,
    appleWebOrderLineItemID: payload.webOrderLineItemId || null,
    appleEnvironment: payload.environment || null
  };

  if (!appleTransactionActive(payload)) {
    const removalExpectation = {
      packageID,
      source: "appleSubscription",
      providerKey: "appleOriginalTransactionID",
      providerValue: originalTransactionID
    };
    const removed = await deletePersistedEntitlement(userID, removalExpectation);
    sendJSON(response, 200, {
      entitlement: entitlementAfterPackageRemoval(
        accountContext.entitlement,
        packageID,
        removalExpectation,
        removed
      ),
      transaction: { active: false }
    });
    return;
  }

  if (
    packageID === entitlementPackageIDs.research &&
    !hasActiveProEntitlement(accountContext.entitlement)
  ) {
    sendJSON(response, 409, {
      error: "Restore or subscribe to Pro before activating Research.",
      code: "PRO_REQUIRED_FOR_RESEARCH"
    });
    return;
  }
  const entitlement = await persistAppleServerEntitlement(userID, originalTransactionID, {
    packageID,
    expiresAt: appleTransactionExpiration(payload),
    provider
  });
  if (!entitlement) {
    sendError(response, 409, "This Apple purchase is already linked to another Permitext account.");
    return;
  }
  sendJSON(response, 200, {
    entitlement,
    transaction: { active: true, productID: payload.productId, packageID }
  });
}

async function handleLifetimeGrant(request, response) {
  if (!requireGrantAdmin(request, response)) {
    return;
  }

  const body = await readJSON(request);
  const userID = body.userID || body.appUserID;
  if (!userID) {
    sendError(response, 400, "Missing userID.");
    return;
  }

  const entitlement = await persistServerEntitlement(userID, "lifetimeGrant");
  sendJSON(response, 200, { userID, entitlement });
}

async function handleLifetimeGrantDelete(request, response) {
  if (!requireGrantAdmin(request, response)) {
    return;
  }

  const body = await readJSON(request);
  const userID = body.userID || body.appUserID;
  if (!userID) {
    sendError(response, 400, "Missing userID.");
    return;
  }

  await deletePersistedEntitlement(userID);
  sendJSON(response, 200, { userID, entitlement: null });
}

function maskedAccountEmail(value) {
  const email = String(value || "").trim();
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return null;
  return `${email.slice(0, Math.min(2, atIndex))}***${email.slice(atIndex)}`;
}

async function handleGrantAccountSummaries(request, response) {
  if (!requireGrantAdmin(request, response)) {
    return;
  }

  const store = await readStore();
  const accounts = await Promise.all(
    Object.entries(store.users || {}).map(async ([userID, account]) => ({
      userID,
      authProvider: account.authProvider || null,
      publicUsername: account.publicUsername || null,
      displayName: account.displayName || null,
      email: maskedAccountEmail(account.email),
      signedInAt: account.signedInAt || null,
      hasActiveSession: await userHasActiveSession(userID, store),
      entitlement: store.entitlements[userID] || null
    }))
  );
  accounts.sort((left, right) => {
    if (left.hasActiveSession !== right.hasActiveSession) {
      return left.hasActiveSession ? -1 : 1;
    }
    return String(right.signedInAt || "").localeCompare(String(left.signedInAt || ""));
  });
  sendJSON(response, 200, { accounts: accounts.slice(0, 100) });
}

async function handleLegacyPasskeyAccountDelete(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }

  const adapter = await storeAdapter();
  if (typeof adapter.deleteLegacyPasskeyAccounts === "function") {
    const deletedUserIDs = await adapter.deleteLegacyPasskeyAccounts();
    sendJSON(response, 200, {
      deletedCount: deletedUserIDs.length,
      deletedUserIDs
    });
    return;
  }

  const store = await readStore();
  const deletedUserIDs = Object.keys(store.users || {}).filter((userID) => userID.startsWith("passkey:"));
  for (const userID of deletedUserIDs) {
    delete store.users[userID];
    delete store.sessions[userID];
    delete store.entitlements[userID];
    delete store.mutationsByUserID[userID];
  }

  const passkeyCredentials = store.passkeyCredentials || {};
  for (const [credentialID, userID] of Object.entries(passkeyCredentials)) {
    if (deletedUserIDs.includes(userID) || userID?.startsWith("passkey:")) {
      delete passkeyCredentials[credentialID];
    }
  }
  store.passkeyCredentials = passkeyCredentials;

  await writeStore(store);
  sendJSON(response, 200, {
    deletedCount: deletedUserIDs.length,
    deletedUserIDs
  });
}

function mutationCounts(mutations) {
  return mutations.reduce((counts, mutation) => {
    const kind = Object.keys(mutation)[0];
    if (kind) {
      counts[kind] = (counts[kind] || 0) + 1;
    }
    return counts;
  }, {});
}

async function handleRestoreChecklist(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }

  const body = await readJSON(request);
  const userID = body.userID || body.appUserID;
  if (!userID) {
    sendError(response, 400, "Missing userID.");
    return;
  }

  const store = await readStore();
  const account = store.users[userID] || null;
  const mutations = store.mutationsByUserID[userID] || [];
  const counts = mutationCounts(mutations);
  const passkeyCredentialIDs = Object.entries(store.passkeyCredentials || {})
    .filter(([, ownerUserID]) => ownerUserID === userID)
    .map(([credentialID]) => credentialID);
  const continuityMutations = mutations.filter((mutation) => Object.keys(mutation)[0] === "continuity");

  sendJSON(response, 200, {
    userID,
    hasAccount: Boolean(account),
    authProvider: account?.authProvider || null,
    publicUsername: account?.publicUsername || null,
    displayName: account?.displayName || null,
    entitlement: store.entitlements[userID] || null,
    hasSession: await userHasActiveSession(userID, store),
    passkeyCredentialCount: passkeyCredentialIDs.length,
    passkeyCredentialIDs,
    mutationCounts: {
      savedItem: counts.savedItem || 0,
      annotation: counts.annotation || 0,
      project: counts.project || 0,
      projectSection: counts.projectSection || 0,
      workboard: counts.workboard || 0,
      continuity: counts.continuity || 0,
      codeVersionClear: counts.codeVersionClear || 0
    },
    latestContinuity: continuityMutations.at(-1) || null
  });
}

async function handleAccountExport(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }

  const body = await readJSON(request);
  const userID = body.userID || body.appUserID;
  if (!userID) {
    sendError(response, 400, "Missing userID.");
    return;
  }

  const store = await readStore();
  const account = store.users[userID] || null;
  const passkeyCredentialIDs = Object.entries(store.passkeyCredentials || {})
    .filter(([, ownerUserID]) => ownerUserID === userID)
    .map(([credentialID]) => credentialID);

  sendJSON(response, 200, {
    userID,
    account,
    entitlement: store.entitlements[userID] || null,
    hasSession: await userHasActiveSession(userID, store),
    passkeyCredentialIDs,
    mutations: store.mutationsByUserID[userID] || []
  });
}

async function handleStorageSummary(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }
  sendJSON(response, 200, await storageSummary());
}

function handleAppleAppSiteAssociation(_request, response) {
  const teamID = process.env.APPLE_TEAM_ID || "TEAMID";
  const bundleID = process.env.APPLE_BUNDLE_ID || "com.randycodex.permitext";
  const appID = `${teamID}.${bundleID}`;
  sendRawJSON(response, 200, {
    webcredentials: {
      apps: [appID]
    },
    applinks: {
      apps: [],
      details: [
        { appID, paths: ["/open/section/*"] },
        {
          appID,
          components: [{
            "/": "/",
            "?": { organizationInvite: "*" },
            comment: "Firm and Project invitation links"
          }]
        }
      ]
    }
  });
}

function appleWebRedirectURI(request) {
  return `${configuredPublicBaseURL(request)}/account/apple/callback`;
}

function handleAppleWebConfig(request, response) {
  const serviceID = process.env.APPLE_SERVICE_ID?.trim() || "";
  sendJSON(response, 200, {
    available: appleWebSignInConfigured(),
    clientID: serviceID || null,
    redirectURI: serviceID ? appleWebRedirectURI(request) : null,
    scope: "name email",
    identityTokenRequired: appleIdentityTokenRequired(),
    browserFallbackAllowed: browserFallbackSignInAllowed(request)
  });
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scriptJSON(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function sameOriginPath(request, value) {
  try {
    const baseURL = configuredPublicBaseURL(request);
    const url = new URL(value || "/", baseURL);
    if (url.origin !== new URL(baseURL).origin) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function sameOriginAbsoluteURL(baseURL, value, fallbackPath = "/") {
  try {
    const normalizedBaseURL = new URL(baseURL);
    const candidate = new URL(value || fallbackPath, normalizedBaseURL);
    return candidate.origin === normalizedBaseURL.origin ? candidate.toString() : null;
  } catch {
    return null;
  }
}

async function handleAppleWebStart(request, response) {
  if (!appleWebSignInConfigured()) {
    sendError(response, 503, "Apple web sign-in is not configured.");
    return;
  }

  const body = await readJSON(request);
  const store = await readStore();
  const linkFromUserID = body.linkFrom?.accountUserID || body.linkFrom?.userID || null;
  if (linkFromUserID) {
    if (!await authenticatedUserContext(request, response, linkFromUserID, {
      backendSessionToken: body.linkFrom?.sessionToken || body.linkFrom?.backendSessionToken
    }, store)) {
      return;
    }
  }

  const state = randomUUID();
  const nonce = randomUUID();
  const oauthState = signOAuthStatePayload({
    state,
    nonce,
    createdAt: new Date().toISOString(),
    successPath: sameOriginPath(request, body.successURL || "/"),
    linkFrom: linkFromUserID ? { accountUserID: linkFromUserID } : null
  });
  const authorizeURL = new URL("https://appleid.apple.com/auth/authorize");
  authorizeURL.searchParams.set("client_id", process.env.APPLE_SERVICE_ID.trim());
  authorizeURL.searchParams.set("redirect_uri", appleWebRedirectURI(request));
  authorizeURL.searchParams.set("response_type", "code id_token");
  authorizeURL.searchParams.set("response_mode", "form_post");
  authorizeURL.searchParams.set("scope", "name email");
  authorizeURL.searchParams.set("state", state);
  authorizeURL.searchParams.set("nonce", nonce);

  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "set-cookie": appleOAuthCookie(request, oauthState)
  });
  response.end(JSON.stringify({ authorizationURL: authorizeURL.toString() }));
}

function appleCallbackHTML({ title, message, accountState = null, successPath = "/", scriptNonce }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>permitext sign in</title>
  </head>
  <body>
    <p>${htmlEscape(message)}</p>
    <script nonce="${htmlEscape(scriptNonce)}">
      const accountState = ${scriptJSON(accountState)};
      if (accountState) {
        const accountSessionKey = "permitext:webAccount:v1";
        localStorage.setItem(accountSessionKey, JSON.stringify(accountState));
        const workspaceKey = "permitext:webWorkspace:v1";
        const saved = JSON.parse(localStorage.getItem(workspaceKey) || "{}");
        delete saved.account;
        localStorage.setItem(workspaceKey, JSON.stringify(saved));
      }
      window.location.replace(${scriptJSON(successPath)});
    </script>
  </body>
</html>`;
}

async function handleAppleWebCallback(request, response) {
  const scriptNonce = randomUUID();
  if (request.method !== "POST") {
    sendHTML(response, appleCallbackHTML({
      title: "permitext sign in",
      message: "Return to permitext and use Link Apple from Settings.",
      successPath: "/",
      scriptNonce
    }), { scriptNonce });
    return;
  }

  const form = new URLSearchParams((await readRawBody(request)).toString("utf8"));
  const oauthState = verifyOAuthStateCookie(decodeURIComponent(cookieValue(request, "permitext_apple_oauth") || ""));
  const clearCookie = appleOAuthCookie(request, "", 0);
  const sendCallbackHTML = (html) => sendHTML(response, html, {
    scriptNonce,
    extraHeaders: { "set-cookie": clearCookie }
  });

  if (!oauthState || form.get("state") !== oauthState.state) {
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple sign-in could not be verified. Return to permitext and try again.",
      successPath: "/?appleSignIn=failed",
      scriptNonce
    }));
    return;
  }

  const identityToken = form.get("id_token");
  if (!identityToken) {
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple did not return an identity token. Return to permitext and try again.",
      successPath: oauthState.successPath || "/",
      scriptNonce
    }));
    return;
  }

  try {
    const user = JSON.parse(form.get("user") || "{}");
    const displayName = [user.name?.firstName, user.name?.lastName]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
    let account = await accountFromCredential(
      {
        provider: "apple",
        displayName: displayName || null,
        signedInAt: new Date().toISOString(),
        identityToken,
        authorizationCode: form.get("code") || undefined
      },
      { expectedNonce: oauthState.nonce }
    );
    const adapter = await storeAdapter();
    if (oauthState.linkFrom?.accountUserID && !compatibilityAccountMergeAllowed(adapter)) {
      sendCallbackHTML(appleCallbackHTML({
        title: "permitext sign in",
        message: "Account linking is temporarily unavailable. Your existing account data was not changed.",
        successPath: "/?appleSignIn=repairUnavailable",
        scriptNonce
      }));
      return;
    }
    if (
      oauthState.linkFrom?.accountUserID &&
      typeof adapter.signInAccount === "function" &&
      typeof adapter.mergeUserAccounts === "function"
    ) {
      const directResult = await adapter.signInAccount(account);
      if (directResult.requiresLegacyMerge) {
        sendCallbackHTML(appleCallbackHTML({
          title: "permitext sign in",
          message: "This account needs identity repair before sign-in can continue. Your existing account data was not changed.",
          successPath: "/?appleSignIn=repairRequired",
          scriptNonce
        }));
        return;
      }
      const targetUserID = directResult.account.appUserID;
      const mergedAccount = oauthState.linkFrom.accountUserID === targetUserID
        ? null
        : await adapter.mergeUserAccounts(oauthState.linkFrom.accountUserID, targetUserID);
      if (oauthState.linkFrom.accountUserID !== targetUserID && !mergedAccount) {
        throw new Error("The source account could not be linked.");
      }
      const finalContext = await adapter.authenticateUserSession(
        targetUserID,
        directResult.account.backendSessionToken
      );
      const finalAccount = finalContext?.account || directResult.account;
      sendCallbackHTML(appleCallbackHTML({
        title: "permitext sign in",
        message: "Apple sign-in completed. Returning to permitext...",
        accountState: {
          userID: targetUserID,
          sessionToken: directResult.account.backendSessionToken,
          authProvider: finalAccount.authProvider || "apple",
          displayName: finalAccount.displayName || displayName || "Apple account",
          publicUsername: finalAccount.publicUsername || null,
          entitlement: finalContext?.entitlement || directResult.entitlement || null
        },
        successPath: oauthState.successPath || "/",
        scriptNonce
      }));
      return;
    }
    if (!oauthState.linkFrom?.accountUserID && typeof adapter.signInAccount === "function") {
      const directResult = await adapter.signInAccount(account);
      if (!directResult.requiresLegacyMerge) {
        const finalAccount = directResult.account;
        sendCallbackHTML(appleCallbackHTML({
          title: "permitext sign in",
          message: "Apple sign-in completed. Returning to permitext...",
          accountState: {
            userID: finalAccount.appUserID,
            sessionToken: finalAccount.backendSessionToken,
            authProvider: finalAccount.authProvider || "apple",
            displayName: finalAccount.displayName || displayName || "Apple account",
            publicUsername: finalAccount.publicUsername || null,
            entitlement: directResult.entitlement || null
          },
          successPath: oauthState.successPath || "/",
          scriptNonce
        }));
        return;
      }
      if (!compatibilityAccountMergeAllowed(adapter)) {
        sendCallbackHTML(appleCallbackHTML({
          title: "permitext sign in",
          message: "This account needs identity repair before sign-in can continue. Your existing account data was not changed.",
          successPath: "/?appleSignIn=repairRequired",
          scriptNonce
        }));
        return;
      }
    }

    const store = await readStore();
    account = await canonicalizeAppleAccountForSignIn(store, account);
    const sessionToken = randomUUID();
    store.sessions[account.appUserID] = sessionToken;
    const existing = store.users[account.appUserID];
    const storedAccount = existing
      ? { ...account, ...existing, signedInAt: account.signedInAt, backendSessionToken: sessionToken }
      : { ...account, backendSessionToken: sessionToken };
    store.users[account.appUserID] = storedAccount;
    if (oauthState.linkFrom?.accountUserID) {
      await mergeAccountInto(store, oauthState.linkFrom.accountUserID, account.appUserID);
    }
    await writeStore(store);
    const finalAccount = store.users[account.appUserID] || storedAccount;
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple sign-in completed. Returning to permitext...",
      accountState: {
        userID: finalAccount.appUserID,
        sessionToken,
        authProvider: finalAccount.authProvider || "apple",
        displayName: finalAccount.displayName || displayName || "Apple account",
        publicUsername: finalAccount.publicUsername || null,
        entitlement: store.entitlements[account.appUserID] || null
      },
      successPath: oauthState.successPath || "/",
      scriptNonce
    }));
  } catch (error) {
    console.error(error);
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple sign-in failed. Return to permitext and try again.",
      successPath: oauthState.successPath || "/",
      scriptNonce
    }));
  }
}

function sendCodeQuestionError(response, error) {
  if (error instanceof CodeQuestionCommandError) {
    sendJSON(response, error.status || 400, {
      error: error.message,
      code: error.code,
      details: error.details || null
    });
    return true;
  }
  return false;
}

function isLoopbackCodeQuestionRequest(request) {
  const remoteAddress = String(request?.socket?.remoteAddress || "").trim().toLowerCase();
  const hostHeader = String(request?.headers?.host || "").trim().toLowerCase();
  const hostname = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : hostHeader.split(":")[0];
  const loopbackAddress = remoteAddress === "::1" || remoteAddress === "127.0.0.1" ||
    remoteAddress === "::ffff:127.0.0.1";
  return loopbackAddress && ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

function codeQuestionEnabledForRequest(request, body = {}, userID = "") {
  const access = codeQuestionRolloutAccess({
    userID,
    requestOverride: body.codeQuestionWorkspaceEnabled === true,
    isLoopback: isLoopbackCodeQuestionRequest(request)
  });
  return isCodeQuestionWorkspaceEnabled({ codeQuestionWorkspaceEnabled: access.enabled });
}

async function requireCodeQuestionContext(request, response, {
  permission = null,
  projectRequired = true
} = {}) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return null;
  try {
    assertCodeQuestionWorkspaceEnabled({
      codeQuestionWorkspaceEnabled: codeQuestionEnabledForRequest(request, context.body, context.userID)
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return null;
    throw error;
  }
  if (!hasActiveProEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 403, {
      error: "Code Questions require Pro.",
      code: "PRO_REQUIRED_PROJECTS"
    });
    return null;
  }
  const projectID = String(
    context.body.projectID || context.body.payload?.projectID || ""
  ).trim();
  if (!projectID) {
    if (!projectRequired) return context;
    sendJSON(response, 400, {
      error: "Code Question requests require a Project ID.",
      code: "CODE_QUESTION_PROJECT_REQUIRED"
    });
    return null;
  }
  const access = await requireProjectPermission(
    response,
    context.userID,
    projectID,
    permission || organizationPermissions.projectView
  );
  if (!access) return null;
  return {
    ...context,
    actorUserID: context.userID,
    projectID: access.projectID,
    projectAccess: access,
    storageOwnerUserID: access.storageOwnerUserID,
    owner: access.owner
  };
}

function codeQuestionArtifactForAccess(context, artifact) {
  return {
    ...artifact,
    envelope: {
      ...artifact.envelope,
      owner: context.owner
    }
  };
}

function codeQuestionIdempotencyConflict(message, details = null) {
  throw new CodeQuestionCommandError(message, {
    code: "CODE_QUESTION_IDEMPOTENCY_CONFLICT",
    status: 409,
    details
  });
}

function codeQuestionIntentMatches(actual, requested, keys) {
  return codeQuestionContentHash(Object.fromEntries(keys.map((key) => [key, actual?.[key] ?? null]))) ===
    codeQuestionContentHash(Object.fromEntries(keys.map((key) => [key, requested?.[key] ?? null])));
}

function normalizedEvidenceEntryIntent(entry = {}) {
  return {
    snapshotID: String(entry.snapshotID || "").trim(),
    role: String(entry.role || "supporting").trim(),
    analysisEligible: entry.analysisEligible === true,
    qualification: String(entry.qualification || "").trim(),
    professionalNote: String(entry.professionalNote || "").trim(),
    sourceVerificationState: String(entry.sourceVerificationState || "verified").trim(),
    projectApplicabilityNote: String(entry.projectApplicabilityNote || "").trim()
  };
}

function codeQuestionEvidenceSetIntentMatches(existing, questionID, entries) {
  return existing?.envelope?.type === "questionEvidenceSet" &&
    existing.payload?.questionID === questionID &&
    codeQuestionContentHash((existing.payload?.entries || []).map(normalizedEvidenceEntryIntent)) ===
      codeQuestionContentHash((Array.isArray(entries) ? entries : []).map(normalizedEvidenceEntryIntent));
}

function codeQuestionDefinitionIntentMatches(payload, body) {
  const textKeys = ["title", "questionText", "scope", "desiredOutput", "jurisdiction"];
  if (!textKeys.every((key) => body[key] === undefined ||
    String(body[key] || "").trim() === String(payload?.[key] || "").trim())) return false;
  if (body.asOfDate === undefined) return true;
  if (body.asOfDate === null || body.asOfDate === "") return payload?.asOfDate == null;
  const parsed = Date.parse(body.asOfDate);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === payload?.asOfDate;
}

function codeQuestionCreateIntentMatches(payload, body) {
  const requested = {
    title: String(body.title || "").trim(),
    questionText: String(body.questionText || "").trim(),
    scope: String(body.scope || "").trim(),
    desiredOutput: String(body.desiredOutput || "").trim(),
    jurisdiction: String(body.jurisdiction || "").trim(),
    asOfDate: body.asOfDate === null || body.asOfDate === undefined || body.asOfDate === ""
      ? null
      : Number.isFinite(Date.parse(body.asOfDate))
        ? new Date(Date.parse(body.asOfDate)).toISOString()
        : "invalid"
  };
  return codeQuestionIntentMatches(payload, requested, Object.keys(requested));
}

function questionInputIntentMatches(payload, body, { creating = false } = {}) {
  if (creating) {
    return codeQuestionIntentMatches(payload, {
      inputKind: String(body.kind || body.inputKind || "").trim(),
      statement: String(body.statement || "").trim(),
      state: String(body.state || "proposed").trim(),
      basis: String(body.basis || "").trim(),
      responsibleUserID: null
    }, ["inputKind", "statement", "state", "basis", "responsibleUserID"]);
  }
  const supplied = [
    ["statement", body.statement, (value) => String(value || "").trim()],
    ["state", body.state, (value) => String(value || "proposed").trim()],
    ["basis", body.basis, (value) => String(value || "").trim()],
    ["responsibleUserID", body.responsibleUserID, (value) => String(value || "").trim() || null]
  ];
  return supplied.every(([key, value, normalize]) =>
    value === undefined || normalize(value) === (payload?.[key] ?? null)
  );
}

function codeQuestionLinkForAccess(context, values) {
  return {
    ...linkForArtifact({
      ...values,
      userID: context.storageOwnerUserID
    }),
    owner: context.owner
  };
}

function codeQuestionActivityForAccess(context, values) {
  return {
    ...activityFor({
      ...values,
      userID: context.actorUserID
    }),
    owner: context.owner
  };
}

const codeQuestionLegacySourceLabels = Object.freeze({
  notebookCard: "Working Notes",
  savedItem: "Saved passage",
  researchAnswer: "Research answer",
  reportDraft: "Report",
  reviewThread: "Coordination thread",
  workboard: "Workboard"
});

function codeQuestionPromotionForClient(artifact) {
  if (!artifact || artifact.envelope?.type !== "codeQuestionPromotion") return null;
  return {
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    ...artifact.payload
  };
}

function legacySourceProjectIDs(activeLinks, sourceKind, sourceID, aliases = []) {
  const targetIDs = new Set([sourceID, ...aliases].filter(Boolean).map(String));
  return new Set(activeLinks
    .filter((link) => {
      if (!targetIDs.has(String(link.targetID || ""))) return false;
      if (sourceKind === "savedItem") {
        return link.targetKind === "savedItem" || link.targetKind === "canonicalSection";
      }
      return link.targetKind === sourceKind;
    })
    .map((link) => String(link.projectID || ""))
    .filter(Boolean));
}

function legacyInventoryItem({
  projectID,
  sourceKind,
  sourceID,
  sourceVersion = null,
  title,
  summary = "",
  updatedAt = null,
  assignedProjectIDs = new Set(),
  promotions = []
}) {
  const assignments = new Set(Array.from(assignedProjectIDs || []).map(String).filter(Boolean));
  const assignedHere = assignments.has(projectID);
  if (!assignedHere && assignments.size) return null;
  const sourcePromotions = promotions.filter((promotion) =>
    promotion.sourceKind === sourceKind && String(promotion.sourceID) === String(sourceID)
  );
  const linked = sourcePromotions.filter((promotion) => promotion.status === "linked");
  const recoverable = !linked.length && sourcePromotions.some((promotion) => promotion.status === "unlinked");
  return {
    id: `${sourceKind}:${sourceID}`,
    sourceKind,
    sourceID: String(sourceID),
    sourceVersion: sourceVersion == null ? null : Number(sourceVersion),
    typeLabel: codeQuestionLegacySourceLabels[sourceKind] || sourceKind,
    title: String(title || codeQuestionLegacySourceLabels[sourceKind] || "Legacy item").trim(),
    summary: String(summary || "").trim().slice(0, 1_000),
    updatedAt,
    assignment: assignedHere ? "project" : "unassigned",
    promotionState: linked.length ? "linked" : recoverable ? "recovery" : "unassigned",
    questionIDs: linked.map((promotion) => promotion.questionID),
    promotions: sourcePromotions
  };
}

async function codeQuestionLegacyInventory(userID, projectID, { includeAccountUnassigned = false } = {}) {
  const [artifacts, links, answers, mutations, bootstrap] = await Promise.all([
    listStoredFoundationArtifacts(userID),
    listStoredProjectLinks(userID),
    listStoredResearchAnswers(userID),
    userContentMutations(userID),
    storedMigrationCheckpoint(userID, `${codeQuestionMigrationCheckpointName}:${projectID}`)
  ]);
  const activeLinks = links.filter((link) => !link.deletedAt);
  const promotions = artifacts
    .filter((artifact) => artifact.envelope?.type === "codeQuestionPromotion" &&
      artifact.payload?.projectID === projectID)
    .map(codeQuestionPromotionForClient)
    .filter(Boolean);
  const questions = artifacts
    .filter((artifact) => artifact.envelope?.type === "codeQuestion" &&
      artifact.payload?.projectID === projectID && !artifact.envelope?.deletedAt)
    .map((artifact) => ({ id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }));
  const items = [];
  const pushItem = (item) => { if (item) items.push(item); };

  artifacts.filter((artifact) => !artifact.envelope?.deletedAt).forEach((artifact) => {
    const type = artifact.envelope?.type;
    if (!["notebookCard", "reportDraft", "reviewThread"].includes(type)) return;
    const payload = artifact.payload || {};
    const assignedProjectIDs = legacySourceProjectIDs(activeLinks, type, artifact.envelope.id);
    pushItem(legacyInventoryItem({
      projectID,
      sourceKind: type,
      sourceID: artifact.envelope.id,
      sourceVersion: artifact.envelope.version,
      title: payload.title || (type === "reviewThread" ? payload.subject : "") || codeQuestionLegacySourceLabels[type],
      summary: payload.plainText || payload.introduction || payload.description || payload.body || "",
      updatedAt: artifact.envelope.updatedAt,
      assignedProjectIDs,
      promotions
    }));
  });

  answers.forEach((answer) => {
    const assignedProjectIDs = legacySourceProjectIDs(activeLinks, "researchAnswer", answer.id);
    if (answer.projectID) assignedProjectIDs.add(String(answer.projectID));
    pushItem(legacyInventoryItem({
      projectID,
      sourceKind: "researchAnswer",
      sourceID: answer.id,
      title: answer.question || "Historical Research answer",
      summary: answer.answer?.conclusion || "",
      updatedAt: answer.createdAt,
      assignedProjectIDs,
      promotions
    }));
  });

  const projectSectionAssignments = new Map();
  mutations.forEach((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (kind !== "projectSection" || !record || Number.isFinite(Date.parse(record.deletedAt || ""))) return;
    const sectionID = String(record.sectionID || "").trim();
    const assignedProjectID = syncProjectIdentity(record.folderClientID, userID) ||
      (record.localFolderID == null ? "" : `legacy-project-${record.localFolderID}`);
    if (!sectionID || !assignedProjectID) return;
    const assignments = projectSectionAssignments.get(sectionID) || new Set();
    assignments.add(assignedProjectID);
    projectSectionAssignments.set(sectionID, assignments);
  });
  mutations.forEach((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (!record || Number.isFinite(Date.parse(record.deletedAt || ""))) return;
    if (kind === "savedItem") {
      const sourceID = String(record.id || normalizedMutationRecordID(mutation) || "").trim();
      if (!sourceID) return;
      const sectionID = String(record.sectionID || "").trim();
      const assignedProjectIDs = legacySourceProjectIDs(activeLinks, "savedItem", sourceID, [sectionID]);
      for (const assigned of projectSectionAssignments.get(sectionID) || []) assignedProjectIDs.add(assigned);
      pushItem(legacyInventoryItem({
        projectID,
        sourceKind: "savedItem",
        sourceID,
        title: [record.codePrefix, record.sectionNumber, record.title].filter(Boolean).join(" ") || "Saved passage",
        summary: record.noteBody || "Saved legal source. It is not approved question evidence until explicitly reviewed.",
        updatedAt: record.updatedAt,
        assignedProjectIDs,
        promotions
      }));
    }
    if (kind === "workboard") {
      const sourceID = String(record.id || normalizedMutationRecordID(mutation) || "").trim();
      if (!sourceID) return;
      const assignedProjectID = String(syncProjectIdentity(record.projectID, userID) || record.projectID || "").trim();
      pushItem(legacyInventoryItem({
        projectID,
        sourceKind: "workboard",
        sourceID,
        title: "Project Workboard",
        summary: "Project-owned diagram. Linking does not change its Project ownership or drawing data.",
        updatedAt: record.updatedAt,
        assignedProjectIDs: new Set(assignedProjectID ? [assignedProjectID] : []),
        promotions
      }));
    }
  });

  const visibleItems = includeAccountUnassigned
    ? items
    : items.filter((item) => item.assignment === "project");
  visibleItems.sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")) ||
    left.title.localeCompare(right.title));
  const counts = {
    total: visibleItems.length,
    unassigned: visibleItems.filter((item) => item.promotionState === "unassigned").length,
    linked: visibleItems.filter((item) => item.promotionState === "linked").length,
    recovery: visibleItems.filter((item) => item.promotionState === "recovery").length,
    projectOwned: visibleItems.filter((item) => item.assignment === "project").length,
    accountUnassigned: visibleItems.filter((item) => item.assignment === "unassigned").length
  };
  return {
    schemaVersion: 1,
    projectID,
    items: visibleItems,
    questions,
    promotions,
    counts,
    migration: {
      migrationVersion: bootstrap?.migrationVersion || codeQuestionMigrationVersion,
      status: bootstrap?.status || "not-run",
      migratedCount: counts.linked,
      alreadyCurrentCount: promotions.filter((item) => item.status === "linked").length,
      skippedCount: counts.unassigned,
      ambiguousCount: counts.accountUnassigned,
      failedCount: 0,
      recoverableCount: counts.recovery,
      lastSuccessfulCheckpoint: bootstrap?.lastSuccessfulCheckpoint || bootstrap?.completedAt || null,
      note: "Unassigned material requires an explicit professional choice; no source was silently converted."
    }
  };
}

async function codeQuestionForProject(userID, projectID, questionID) {
  const artifacts = await listStoredFoundationArtifacts(userID);
  return artifacts.find((artifact) => artifact.envelope?.type === "codeQuestion" &&
    artifact.envelope.id === questionID && artifact.payload?.projectID === projectID &&
    !artifact.envelope?.deletedAt) || null;
}

function researchConversationIDForCodeDecision(actorUserID, projectID, questionID) {
  return `code-decision-research-${createHash("sha256")
    .update(`${actorUserID}:${projectID}:${questionID}`)
    .digest("hex")}`;
}

function researchCodeDecisionActivityID(action, actorUserID, projectID, questionID, conversationID, linkVersion) {
  return `research-code-decision-${createHash("sha256")
    .update([action, actorUserID, projectID, questionID, conversationID, linkVersion].join(":"))
    .digest("hex")}`;
}

async function saveResearchCodeDecisionLinkActivity(context, link) {
  const decisionLink = researchCodeDecisionLink(link);
  if (!decisionLink) return null;
  const previousQuestionID = String(link.metadata?.codeDecisionPreviousQuestionID || "").trim() || null;
  const replacedConversationID = String(link.metadata?.codeDecisionReplacedConversationID || "").trim() || null;
  const event = activityEvent({
    id: researchCodeDecisionActivityID(
      "item.linked",
      context.actorUserID,
      context.projectID,
      decisionLink.questionID,
      link.targetID,
      link.version
    ),
    owner: context.owner,
    actorUserID: context.actorUserID,
    projectID: context.projectID,
    action: "item.linked",
    objectKind: "researchConversation",
    objectID: link.targetID,
    previousStatus: previousQuestionID ? "linked-to-other-decision" : "project-linked",
    newStatus: "linked-to-code-decision",
    createdAt: decisionLink.linkedAt,
    metadata: {
      questionID: decisionLink.questionID,
      relationship: "code-decision",
      previousQuestionID,
      replacedConversationID
    }
  });
  await saveStoredActivityEvent(context.storageOwnerUserID, event);
  return event;
}

async function saveResearchCodeDecisionUnlinkActivity(context, link, questionID) {
  const unlinkedAt = link?.metadata?.codeDecisionUnlinkedAt || link?.updatedAt;
  if (!link || !questionID || !unlinkedAt) return null;
  const event = activityEvent({
    id: researchCodeDecisionActivityID(
      "item.unlinked",
      context.actorUserID,
      context.projectID,
      questionID,
      link.targetID,
      link.version
    ),
    owner: context.owner,
    actorUserID: context.actorUserID,
    projectID: context.projectID,
    action: "item.unlinked",
    objectKind: "researchConversation",
    objectID: link.targetID,
    previousStatus: "linked-to-code-decision",
    newStatus: link.deletedAt ? "unlinked" : "project-linked",
    createdAt: unlinkedAt,
    metadata: { questionID, relationship: "code-decision" }
  });
  await saveStoredActivityEvent(context.storageOwnerUserID, event);
  return event;
}

async function linkResearchConversationToCodeDecision(context, conversation, question, options = {}) {
  const questionID = question.envelope.id;
  const now = options.now || new Date().toISOString();
  if (conversation.primaryProjectID !== context.projectID) {
    throw new CodeQuestionCommandError(
      "Assign this Research conversation to the Code Decision's Project before linking it.",
      { code: "CODE_QUESTION_RESEARCH_PROJECT_MISMATCH", status: 409 }
    );
  }
  const actorLinks = await listStoredProjectLinks(context.actorUserID);
  const storedConversationLink = actorLinks.find((link) =>
    link.projectID === context.projectID &&
    link.targetKind === "researchConversation" &&
    link.targetID === conversation.id
  ) || null;
  let conversationLink = actorLinks.find((link) =>
    !link.deletedAt &&
    link.projectID === context.projectID &&
    link.targetKind === "researchConversation" &&
    link.targetID === conversation.id
  ) || null;
  const currentDecisionLink = researchCodeDecisionLink(conversationLink);
  const suppliedLinkVersion = options.expectedLinkVersion == null || options.expectedLinkVersion === ""
    ? null
    : Number(options.expectedLinkVersion);
  if (suppliedLinkVersion != null && (!Number.isSafeInteger(suppliedLinkVersion) || suppliedLinkVersion < 0)) {
    throw new CodeQuestionCommandError("Research link version must be a non-negative whole number.", {
      code: "CODE_QUESTION_RESEARCH_LINK_VERSION_INVALID",
      status: 400
    });
  }
  if (currentDecisionLink?.questionID === questionID) {
    await saveResearchCodeDecisionLinkActivity(context, conversationLink);
    return { link: conversationLink, replayed: true, replacedConversationID: null };
  }
  if (options.requireExpectedLinkVersion === true && conversationLink && suppliedLinkVersion == null) {
    throw new CodeQuestionCommandError("Refresh this Research conversation before changing its Code Decision link.", {
      code: "CODE_QUESTION_RESEARCH_LINK_VERSION_REQUIRED",
      status: 400
    });
  }
  if (
    suppliedLinkVersion != null &&
    suppliedLinkVersion !== Number(conversationLink?.version || 0)
  ) {
    throw new CodeQuestionCommandError("This Research link changed after you opened it.", {
      code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT",
      status: 409,
      details: {
        expectedLinkVersion: suppliedLinkVersion,
        currentLinkVersion: Number(conversationLink?.version || 0)
      }
    });
  }
  const displacedLinks = actorLinks.filter((priorLink) =>
    !priorLink.deletedAt &&
    priorLink.projectID === context.projectID &&
    priorLink.targetKind === "researchConversation" &&
    priorLink.targetID !== conversation.id &&
    researchCodeDecisionLink(priorLink)?.questionID === questionID
  );
  if (currentDecisionLink && options.confirmRelink !== true) {
    throw new CodeQuestionCommandError(
      "Linking this Research conversation to a different Code Decision requires confirmation.",
      {
        code: "CODE_QUESTION_RESEARCH_RELINK_CONFIRMATION_REQUIRED",
        status: 409,
        details: {
          currentQuestionID: currentDecisionLink?.questionID || questionID,
          nextQuestionID: questionID,
          currentConversationID: displacedLinks[0]?.targetID || conversation.id,
          nextConversationID: conversation.id
        }
      }
    );
  }
  if (displacedLinks.length > 1) {
    throw new CodeQuestionCommandError(
      "Multiple current Research conversations were found for this Code Decision. Refresh before repairing the link.",
      {
        code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT",
        status: 409,
        details: { currentConversationIDs: displacedLinks.map((link) => link.targetID) }
      }
    );
  }
  if (displacedLinks.length === 1) {
    const expectedTargetConversationID = String(options.expectedTargetConversationID || "").trim();
    if (options.confirmReplaceDecisionConversation !== true) {
      throw new CodeQuestionCommandError(
        "Replacing the current Research conversation for this Code Decision requires confirmation.",
        {
          code: "CODE_QUESTION_RESEARCH_REPLACE_CONFIRMATION_REQUIRED",
          status: 409,
          details: {
            currentConversationID: displacedLinks[0].targetID,
            nextConversationID: conversation.id
          }
        }
      );
    }
    if (!expectedTargetConversationID || expectedTargetConversationID !== displacedLinks[0].targetID) {
      throw new CodeQuestionCommandError(
        "The current Research conversation for this Code Decision changed after you opened it.",
        {
          code: "CODE_QUESTION_RESEARCH_TARGET_CONFLICT",
          status: 409,
          details: {
            expectedTargetConversationID: expectedTargetConversationID || null,
            currentConversationID: displacedLinks[0].targetID,
            nextConversationID: conversation.id
          }
        }
      );
    }
  }

  const replacedConversationID = displacedLinks[0]?.targetID || null;
  const clearedLinks = displacedLinks.map((priorLink) =>
    clearedResearchCodeDecisionLinkRecord(priorLink, now, context.actorUserID)
  );
  conversationLink = researchConversationProjectLinkRecord(
    context.actorUserID,
    conversation.id,
    context.projectID,
    now,
    storedConversationLink,
    {
      metadata: {
        codeDecisionID: questionID,
        codeDecisionLinkedAt: now,
        codeDecisionLinkedByUserID: context.actorUserID,
        codeDecisionPreviousQuestionID: currentDecisionLink?.questionID || null,
        codeDecisionReplacedConversationID: replacedConversationID
      }
    }
  );
  await replaceStoredResearchCodeDecisionLinks(context.actorUserID, {
    link: conversationLink,
    clearedLinks,
    expectedLink: storedConversationLink,
    expectedClearedLinks: displacedLinks
  });
  await saveResearchCodeDecisionLinkActivity(context, conversationLink);
  return { link: conversationLink, replayed: false, replacedConversationID };
}

async function handleCodeQuestionResearchStart(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.update")
  });
  if (!context) return;
  if (!hasActiveResearchEntitlement(context.authContext.entitlement)) {
    sendJSON(response, 402, {
      error: "Research requires an active Pro plan and the Research Add-On.",
      code: "RESEARCH_ADDON_REQUIRED"
    });
    return;
  }
  try {
    const questionID = String(context.body.questionID || "").trim();
    const question = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    if (!question) {
      sendError(response, 404, "Code Decision not found for this Project.");
      return;
    }
    if (question.payload.recordState !== "active") {
      sendJSON(response, 409, {
        error: "Restore this Code Decision before starting new Research.",
        code: "CODE_QUESTION_ARCHIVED"
      });
      return;
    }
    const [conversations, links] = await Promise.all([
      listStoredResearchConversations(context.actorUserID),
      listStoredProjectLinks(context.actorUserID)
    ]);
    const existingLink = links.find((link) =>
      !link.deletedAt &&
      link.projectID === context.projectID &&
      link.targetKind === "researchConversation" &&
      researchCodeDecisionLink(link)?.questionID === questionID &&
      conversations.some((conversation) => conversation.id === link.targetID)
    );
    if (existingLink) {
      const conversation = conversations.find((item) => item.id === existingLink.targetID);
      await saveResearchCodeDecisionLinkActivity(context, existingLink);
      sendJSON(response, 200, {
        conversation: await researchConversationForClient(conversation, {
          userID: context.actorUserID,
          projectLink: existingLink
        }),
        questionID,
        replayed: true
      });
      return;
    }
    const requestedConversationID = String(context.body.conversationID || "").trim() ||
      researchConversationIDForCodeDecision(context.actorUserID, context.projectID, questionID);
    const existingConversation = conversations.find((item) => item.id === requestedConversationID) || null;
    if (existingConversation) {
      const sameIntent = existingConversation.primaryProjectID === context.projectID &&
        existingConversation.origin?.kind === "codeDecision" &&
        existingConversation.origin?.questionID === questionID;
      if (!sameIntent) {
        throw new CodeQuestionCommandError(
          "This Research conversation ID was already used for different content.",
          { code: "CODE_QUESTION_IDEMPOTENCY_CONFLICT", status: 409 }
        );
      }
      const linked = await linkResearchConversationToCodeDecision(
        context,
        existingConversation,
        question
      );
      const artifactRevisions = linked.replayed
        ? null
        : await bumpResearchArtifactRevisions(context.actorUserID, [{
            projectID: context.projectID,
            domains: ["activity", "foundation", "research"]
          }]);
      sendJSON(response, 200, {
        conversation: await researchConversationForClient(existingConversation, {
          userID: context.actorUserID,
          projectLink: linked.link
        }),
        questionID,
        replayed: linked.replayed,
        ...(artifactRevisions ? { artifactRevisions } : {})
      });
      return;
    }
    if (conversations.length >= 200) {
      sendError(response, 409, "Delete an older research conversation before starting another.");
      return;
    }
    const now = new Date().toISOString();
    const conversation = {
      id: requestedConversationID,
      title: question.payload.title,
      starterQuestion: question.payload.questionText,
      createdAt: now,
      updatedAt: now,
      codeVersion: defaultSyncCodeVersion,
      evidenceSetVersion: 1,
      primaryProjectID: context.projectID,
      projectContext: {
        projectID: context.projectID,
        facts: [],
        source: "code-decision",
        updatedAt: now
      },
      projectContextReviewRequired: false,
      origin: { kind: "codeDecision", questionID },
      sourceStatus: "current",
      sources: [],
      messages: []
    };
    await saveStoredResearchConversation(context.actorUserID, conversation);
    const linked = await linkResearchConversationToCodeDecision(
      context,
      conversation,
      question,
      { now }
    );
    const artifactRevisions = await bumpResearchArtifactRevisions(context.actorUserID, [{
      projectID: context.projectID,
      domains: ["activity", "foundation", "research"]
    }]);
    sendJSON(response, 201, {
      conversation: await researchConversationForClient(conversation, {
        userID: context.actorUserID,
        projectLink: linked.link
      }),
      questionID,
      replayed: false,
      artifactRevisions
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionResearchLink(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.update")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const conversation = await storedResearchConversation(
      context.actorUserID,
      String(context.body.conversationID || "").trim()
    );
    if (!conversation) {
      sendError(response, 404, "Research conversation not found.");
      return;
    }
    if (conversation.primaryProjectID !== context.projectID) {
      throw new CodeQuestionCommandError(
        "Assign this Research conversation to the Code Decision's Project before changing its link.",
        { code: "CODE_QUESTION_RESEARCH_PROJECT_MISMATCH", status: 409 }
      );
    }
    if (context.body.unlink === true) {
      const existing = await researchConversationProjectLink(context.actorUserID, conversation);
      const current = researchCodeDecisionLink(existing);
      const lastQuestionID = String(existing?.metadata?.codeDecisionLastID || "").trim() || null;
      if (current?.questionID && current.questionID !== questionID) {
        throw new CodeQuestionCommandError("This Research conversation is linked to a different Code Decision.", {
          code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT",
          status: 409
        });
      }
      if (!current && lastQuestionID && lastQuestionID !== questionID) {
        throw new CodeQuestionCommandError("This Research conversation was unlinked from a different Code Decision.", {
          code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT",
          status: 409
        });
      }
      const suppliedLinkVersion = context.body.expectedLinkVersion == null ||
        context.body.expectedLinkVersion === ""
        ? null
        : Number(context.body.expectedLinkVersion);
      if (suppliedLinkVersion != null && (!Number.isSafeInteger(suppliedLinkVersion) || suppliedLinkVersion < 0)) {
        throw new CodeQuestionCommandError("Research link version must be a non-negative whole number.", {
          code: "CODE_QUESTION_RESEARCH_LINK_VERSION_INVALID",
          status: 400
        });
      }
      if (current && suppliedLinkVersion == null) {
        throw new CodeQuestionCommandError("Refresh this Research conversation before unlinking it.", {
          code: "CODE_QUESTION_RESEARCH_LINK_VERSION_REQUIRED",
          status: 400
        });
      }
      if (current && suppliedLinkVersion !== Number(existing?.version || 0)) {
        throw new CodeQuestionCommandError("This Research link changed after you opened it.", {
          code: "CODE_QUESTION_RESEARCH_LINK_CONFLICT",
          status: 409,
          details: {
            expectedLinkVersion: suppliedLinkVersion,
            currentLinkVersion: Number(existing?.version || 0)
          }
        });
      }
      const now = new Date().toISOString();
      const link = current
        ? await clearResearchCodeDecisionLink(context.actorUserID, existing, now)
        : existing;
      if (current || lastQuestionID === questionID) {
        await saveResearchCodeDecisionUnlinkActivity(context, link, questionID);
      }
      const artifactRevisions = current
        ? await bumpResearchArtifactRevisions(context.actorUserID, [{
            projectID: context.projectID,
            domains: ["activity", "foundation", "research"]
          }])
        : null;
      sendJSON(response, 200, {
        conversation: await researchConversationForClient(conversation, {
          userID: context.actorUserID,
          projectLink: link
        }),
        unlinked: Boolean(current),
        replayed: !current && lastQuestionID === questionID,
        questionID,
        ...(artifactRevisions ? { artifactRevisions } : {})
      });
      return;
    }
    const question = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    if (!question) {
      sendError(response, 404, "Code Decision not found for this Project.");
      return;
    }
    if (question.payload.recordState !== "active") {
      throw new CodeQuestionCommandError("Restore this Code Decision before linking new Research.", {
        code: "CODE_QUESTION_ARCHIVED",
        status: 409
      });
    }
    const linked = await linkResearchConversationToCodeDecision(context, conversation, question, {
      expectedLinkVersion: context.body.expectedLinkVersion,
      requireExpectedLinkVersion: true,
      confirmRelink: context.body.confirmRelink === true,
      confirmReplaceDecisionConversation: context.body.confirmReplaceDecisionConversation === true,
      expectedTargetConversationID: context.body.expectedTargetConversationID
    });
    const artifactRevisions = linked.replayed
      ? null
      : await bumpResearchArtifactRevisions(context.actorUserID, [{
          projectID: context.projectID,
          domains: ["activity", "foundation", "research"]
        }]);
    sendJSON(response, linked.replayed ? 200 : 201, {
      conversation: await researchConversationForClient(conversation, {
        userID: context.actorUserID,
        projectLink: linked.link
      }),
      questionID,
      replayed: linked.replayed,
      replacedConversationID: linked.replacedConversationID,
      ...(artifactRevisions ? { artifactRevisions } : {})
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionLegacyList(request, response) {
  const context = await requireCodeQuestionContext(request, response);
  if (!context) return;
  const projectID = String(context.body.projectID || "").trim();
  if (!projectID || !await ownedProjectRecord(context.storageOwnerUserID, projectID)) {
    sendError(response, 404, "Project not found.");
    return;
  }
  sendJSON(response, 200, await codeQuestionLegacyInventory(context.storageOwnerUserID, projectID, {
    includeAccountUnassigned: context.actorUserID === context.storageOwnerUserID
  }));
}

async function handleCodeQuestionLegacyPromote(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.legacy.promote")
  });
  if (!context) return;
  try {
    const projectID = String(context.body.projectID || "").trim();
    const sourceKind = String(context.body.sourceKind || "").trim();
    const sourceID = String(context.body.sourceID || "").trim();
    if (!projectID || !await ownedProjectRecord(context.storageOwnerUserID, projectID)) {
      sendError(response, 404, "Project not found.");
      return;
    }
    if (!codeQuestionPromotionSourceKinds.includes(sourceKind) || !sourceID) {
      sendError(response, 400, "Select a supported legacy source.");
      return;
    }
    const inventory = await codeQuestionLegacyInventory(context.storageOwnerUserID, projectID, {
      includeAccountUnassigned: context.actorUserID === context.storageOwnerUserID
    });
    const source = inventory.items.find((item) => item.sourceKind === sourceKind && item.sourceID === sourceID);
    if (!source) {
      sendError(response, 404, "Legacy source is unavailable for this Project.");
      return;
    }
    const idempotencyKey = String(context.body.idempotencyKey ||
      `link:${projectID}:${sourceKind}:${sourceID}:${context.body.questionID || "new"}`).trim();
    let question = null;
    let questionCreated = false;
    let action = "link-existing";
    const requestedQuestionID = String(context.body.questionID || "").trim();
    if (requestedQuestionID) {
      question = await codeQuestionForProject(context.storageOwnerUserID, projectID, requestedQuestionID);
      if (!question) {
        sendError(response, 404, "Code Question not found for this Project.");
        return;
      }
    } else {
      action = "create-question";
      const createQuestion = context.body.createQuestion && typeof context.body.createQuestion === "object"
        ? context.body.createQuestion
        : {};
      if (!String(createQuestion.questionText || "").trim()) {
        sendJSON(response, 400, {
          error: "Creating a Code Question from legacy work requires an explicit question statement.",
          code: "CODE_QUESTION_PROMOTION_CONFIRMATION_REQUIRED"
        });
        return;
      }
      const deterministicQuestionID = deterministicPromotedQuestionID({
        userID: context.storageOwnerUserID,
        projectID,
        sourceKind,
        sourceID,
        idempotencyKey
      });
      question = await codeQuestionForProject(context.storageOwnerUserID, projectID, deterministicQuestionID);
      if (!question) {
        const allocated = await allocateStoredCodeQuestionCounter(context.storageOwnerUserID, "questionNumber", projectID);
        const now = new Date().toISOString();
        question = codeQuestionArtifactForAccess(context, createCodeQuestionArtifact({
          userID: context.actorUserID,
          projectID,
          title: createQuestion.title || source.title,
          questionText: createQuestion.questionText,
          scope: createQuestion.scope,
          desiredOutput: createQuestion.desiredOutput,
          jurisdiction: createQuestion.jurisdiction,
          asOfDate: createQuestion.asOfDate,
          questionNumber: allocated.value,
          createdAt: now,
          id: deterministicQuestionID
        }));
        await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, question, 0);
        await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
          projectID,
          targetKind: "codeQuestion",
          targetID: question.envelope.id,
          createdAt: now
        }));
        await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
          projectID,
          action: "code-question.created",
          objectKind: "codeQuestion",
          objectID: question.envelope.id,
          newStatus: "active",
          createdAt: now,
          metadata: { promotedFrom: { sourceKind, sourceID } }
        }));
        questionCreated = true;
      }
    }
    const questionID = question.envelope?.id || question.id;
    const artifacts = await listStoredFoundationArtifacts(context.storageOwnerUserID);
    const promotionID = deterministicCodeQuestionPromotionID({
      ownerID: context.storageOwnerUserID,
      projectID,
      questionID,
      sourceKind,
      sourceID
    });
    const existing = artifacts.find((artifact) => artifact.envelope?.id === promotionID) || null;
    const now = new Date().toISOString();
    const result = upsertCodeQuestionPromotionArtifact(existing, {
      userID: context.actorUserID,
      projectID,
      questionID,
      sourceKind,
      sourceID,
      sourceVersion: source.sourceVersion,
      sourceLabel: source.title,
      sourceProjectID: source.assignment === "project" ? projectID : null,
      action,
      status: "linked",
      idempotencyKey,
      now
    });
    if (!result.replayed) {
      await saveStoredFoundationArtifactCompareAndSwap(
        context.storageOwnerUserID,
        codeQuestionArtifactForAccess(context, result.artifact),
        Number(existing?.envelope?.version || 0)
      );
      await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
        projectID,
        targetKind: "codeQuestionPromotion",
        targetID: result.artifact.envelope.id,
        createdAt: existing?.envelope?.createdAt || now,
        metadata: { questionID, sourceKind, sourceID }
      }));
      await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
        projectID,
        action: result.recovered ? "code-question.migration.recovered" : "code-question.migration.promoted",
        objectKind: "codeQuestionPromotion",
        objectID: result.artifact.envelope.id,
        previousStatus: existing?.payload?.status || null,
        newStatus: "linked",
        createdAt: now,
        metadata: { questionID, sourceKind, sourceID, sourcePreserved: true, questionCreated }
      }));
    }
    const clientQuestion = question.envelope
      ? { id: question.envelope.id, version: question.envelope.version, ...question.payload }
      : question;
    sendJSON(response, result.replayed ? 200 : 201, {
      question: clientQuestion,
      questionCreated,
      promotion: codeQuestionPromotionForClient(result.artifact),
      replayed: result.replayed,
      recovered: result.recovered,
      sourcePreserved: true
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 400, {
      error: error?.message || "Legacy promotion failed.",
      code: "CODE_QUESTION_PROMOTION_FAILED"
    });
  }
}

async function handleCodeQuestionLegacyUnlink(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.legacy.unlink")
  });
  if (!context) return;
  try {
    const projectID = String(context.body.projectID || "").trim();
    const promotionID = String(context.body.promotionID || "").trim();
    const existing = (await listStoredFoundationArtifacts(context.storageOwnerUserID)).find((artifact) =>
      artifact.envelope?.type === "codeQuestionPromotion" &&
      artifact.envelope.id === promotionID && artifact.payload?.projectID === projectID
    );
    if (!existing) {
      sendError(response, 404, "Active promotion relationship not found.");
      return;
    }
    const result = upsertCodeQuestionPromotionArtifact(existing, {
      userID: context.actorUserID,
      projectID,
      questionID: existing.payload.questionID,
      sourceKind: existing.payload.sourceKind,
      sourceID: existing.payload.sourceID,
      sourceVersion: existing.payload.sourceVersion,
      sourceLabel: existing.payload.sourceLabel,
      sourceProjectID: existing.payload.sourceProjectID,
      action: existing.payload.action,
      status: "unlinked",
      idempotencyKey: existing.payload.idempotencyKey
    });
    if (!result.replayed) {
      await saveStoredFoundationArtifactCompareAndSwap(
        context.storageOwnerUserID,
        codeQuestionArtifactForAccess(context, result.artifact),
        existing.envelope.version
      );
      await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
        projectID,
        action: "code-question.migration.unlinked",
        objectKind: "codeQuestionPromotion",
        objectID: result.artifact.envelope.id,
        previousStatus: "linked",
        newStatus: "unlinked",
        metadata: {
          questionID: existing.payload.questionID,
          sourceKind: existing.payload.sourceKind,
          sourceID: existing.payload.sourceID,
          sourcePreserved: true,
          questionPreserved: true
        }
      }));
    }
    sendJSON(response, 200, {
      promotion: codeQuestionPromotionForClient(result.artifact),
      replayed: result.replayed,
      sourcePreserved: true,
      questionPreserved: true
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 400, {
      error: error?.message || "Promotion relationship could not be unlinked.",
      code: "CODE_QUESTION_PROMOTION_UNLINK_FAILED"
    });
  }
}

function codeQuestionListSummary(questionArtifact, artifacts = []) {
  const questionID = String(questionArtifact?.envelope?.id || "").trim();
  const question = questionArtifact?.payload || {};
  const related = artifacts.filter((artifact) => artifact?.payload?.questionID === questionID);
  const inputs = related.filter((artifact) =>
    artifact.envelope?.type === "questionInput" && artifact.payload?.state !== "retired"
  ).sort((left, right) => String(left.envelope?.id || "").localeCompare(String(right.envelope?.id || "")));
  const missingInformationCount = inputs.filter((artifact) => {
    const input = artifact.payload || {};
    return !["resolved", "retired"].includes(input.state) && (
      input.inputKind === "unknown" ||
      (input.inputKind === "confirmedFact" && input.state !== "confirmed")
    );
  }).length;
  const blockingReviewCount = related.filter((artifact) =>
    artifact.envelope?.type === "reviewThread" &&
    artifact.payload?.blocking !== false &&
    ["open", "waiting"].includes(artifact.payload?.status)
  ).length;
  const conclusions = related
    .filter((artifact) => artifact.envelope?.type === "professionalConclusion")
    .sort((left, right) => Number(left.payload?.revision || 0) - Number(right.payload?.revision || 0));
  const issuedRecords = related.filter((artifact) => artifact.envelope?.type === "issuedDecisionRecord");
  const latestIssuedVersion = issuedRecords.reduce(
    (latest, artifact) => Math.max(latest, Number(artifact.payload?.issueVersion || 0)),
    0
  ) || null;
  const evidenceSet = related
    .filter((artifact) => artifact.envelope?.type === "questionEvidenceSet")
    .sort((left, right) => Number(right.payload?.version || 0) - Number(left.payload?.version || 0))[0] || null;
  const definitionHash = codeQuestionContentHash({
    questionText: question.questionText,
    scope: question.scope || "",
    jurisdiction: question.jurisdiction || "",
    asOfDate: question.asOfDate || null,
    definitionRevision: question.definitionRevision
  });
  const inputSetHash = codeQuestionContentHash(inputs.map((artifact) => ({
    id: artifact.payload.id,
    inputKind: artifact.payload.inputKind,
    state: artifact.payload.state,
    statement: artifact.payload.statement,
    revision: artifact.payload.revision
  })));
  const dependencyHash = evidenceSet ? computeDependencyHash({
    questionText: question.questionText,
    scope: question.scope || "",
    jurisdiction: question.jurisdiction || "",
    asOfDate: question.asOfDate || null,
    inputs: inputs.map((artifact) => artifact.payload),
    evidenceSet: evidenceSet.payload
  }) : null;
  const latestAnalysis = related
    .filter((artifact) => artifact.envelope?.type === "questionAnalysis")
    .sort((left, right) => String(left.envelope?.createdAt || "").localeCompare(String(right.envelope?.createdAt || "")))
    .at(-1) || null;
  const latestConclusion = conclusions.at(-1) || null;
  const analysisChanged = Boolean(latestAnalysis && latestAnalysis.payload?.dependencyHash !== dependencyHash);
  const conclusionChanged = Boolean(latestConclusion && (
    Number(latestConclusion.payload?.definitionRevision) !== Number(question.definitionRevision) ||
    latestConclusion.payload?.definitionHash !== definitionHash ||
    latestConclusion.payload?.inputSetHash !== inputSetHash ||
    latestConclusion.payload?.evidenceSetID !== evidenceSet?.envelope?.id ||
    Number(latestConclusion.payload?.evidenceSetVersion) !== Number(evidenceSet?.payload?.version || 0) ||
    latestConclusion.payload?.evidenceSetHash !== evidenceSet?.payload?.contentHash
  ));
  return {
    missingInformationCount,
    blockingReviewCount,
    conclusionCount: conclusions.length,
    latestIssuedVersion,
    revisionInProgress: analysisChanged || conclusionChanged
  };
}

async function handleCodeQuestionList(request, response) {
  const context = await requireCodeQuestionContext(request, response);
  if (!context) return;
  const projectID = context.projectID;
  const [links, artifacts, researchLinksByQuestionID] = await Promise.all([
    listStoredProjectLinks(context.storageOwnerUserID),
    listStoredFoundationArtifacts(context.storageOwnerUserID),
    researchConversationLinksForCodeDecisions(context.actorUserID, projectID)
  ]);
  const questionLinks = links
    .filter((link) => !link.deletedAt && link.projectID === projectID && link.targetKind === "codeQuestion");
  const questions = questionLinks.map((link) => {
    const artifact = artifacts.find((item) => item.envelope?.id === link.targetID);
    const research = researchLinksByQuestionID.get(artifact?.envelope?.id);
    return artifact
      ? {
          id: artifact.envelope.id,
          version: artifact.envelope.version,
          ...artifact.payload,
          researchConversationID: research?.conversation?.id || null,
          researchConversationUpdatedAt: research?.conversation?.updatedAt || null,
          summary: codeQuestionListSummary(artifact, artifacts)
        }
      : null;
  }).filter(Boolean);
  sendJSON(response, 200, {
    projectID,
    access: { role: context.projectAccess.role, permissions: context.projectAccess.permissions },
    questions
  });
}

async function handleCodeQuestionState(request, response) {
  const context = await requireCodeQuestionContext(request, response);
  if (!context) return;
  const questionID = String(context.body.questionID || "").trim();
  const question = await codeQuestionForProject(context.storageOwnerUserID, context.projectID, questionID);
  if (!question) {
    sendError(response, 404, "Code Question not found for this Project.");
    return;
  }
  const [allArtifacts, links, activities, pendingIssuance, researchAnswers, researchLinksByQuestionID] = await Promise.all([
    listStoredFoundationArtifacts(context.storageOwnerUserID),
    listStoredProjectLinks(context.storageOwnerUserID),
    listStoredActivityEvents(context.storageOwnerUserID),
    listStoredCodeQuestionPendingIssuance(context.storageOwnerUserID),
    listStoredResearchAnswers(context.storageOwnerUserID),
    researchConversationLinksForCodeDecisions(context.actorUserID, context.projectID)
  ]);
  const linkedResearch = researchLinksByQuestionID.get(questionID) || null;
  const projectLinks = links.filter((link) => !link.deletedAt && link.projectID === context.projectID);
  const linksByTargetID = new Map(projectLinks.map((link) => [link.targetID, link]));
  const directArtifacts = allArtifacts.filter((artifact) => {
    if (artifact.envelope?.id === questionID) return true;
    const link = linksByTargetID.get(artifact.envelope?.id);
    if (!link) return false;
    return artifact.payload?.questionID === questionID ||
      artifact.payload?.codeMemo?.questionID === questionID ||
      artifact.payload?.metadata?.questionID === questionID ||
      link.metadata?.questionID === questionID;
  });
  const reviewThreadIDs = new Set(directArtifacts
    .filter((artifact) => artifact.envelope?.type === "reviewThread")
    .map((artifact) => artifact.envelope.id));
  const reviewComments = allArtifacts.filter((artifact) =>
    artifact.envelope?.type === "reviewComment" &&
    reviewThreadIDs.has(artifact.payload?.threadID) &&
    linksByTargetID.has(artifact.envelope.id)
  );
  const artifacts = [...directArtifacts, ...reviewComments];
  const artifactIDs = new Set(artifacts.map((artifact) => artifact.envelope.id));
  const answerIDs = new Set(artifacts
    .filter((artifact) => artifact.envelope?.type === "questionAnalysis")
    .map((artifact) => artifact.payload?.researchAnswerID)
    .filter(Boolean));
  const activeInputs = allArtifacts
    .filter((artifact) => artifact.envelope?.type === "questionInput" &&
      artifact.payload?.questionID === questionID && artifact.payload?.state !== "retired")
    .sort((left, right) => String(left.envelope.id).localeCompare(String(right.envelope.id)));
  const evidenceSet = allArtifacts
    .filter((artifact) => artifact.envelope?.type === "questionEvidenceSet" &&
      artifact.payload?.questionID === questionID)
    .sort((left, right) => Number(right.payload?.version || 0) - Number(left.payload?.version || 0))[0] || null;
  const definitionHash = codeQuestionContentHash({
    questionText: question.payload.questionText,
    scope: question.payload.scope || "",
    jurisdiction: question.payload.jurisdiction || "",
    asOfDate: question.payload.asOfDate || null,
    definitionRevision: question.payload.definitionRevision
  });
  const inputSetHash = codeQuestionContentHash(activeInputs.map((artifact) => ({
    id: artifact.payload.id,
    inputKind: artifact.payload.inputKind,
    state: artifact.payload.state,
    statement: artifact.payload.statement,
    revision: artifact.payload.revision
  })));
  const analysisBinding = evidenceSet ? {
    questionID,
    definitionRevision: question.payload.definitionRevision,
    definitionHash,
    inputSnapshotIDs: activeInputs.map((artifact) => artifact.payload.id),
    inputSetHash,
    evidenceSetID: evidenceSet.envelope.id,
    evidenceSetVersion: evidenceSet.payload.version,
    evidenceSetHash: evidenceSet.payload.contentHash,
    dependencyHash: computeDependencyHash({
      questionText: question.payload.questionText,
      scope: question.payload.scope || "",
      jurisdiction: question.payload.jurisdiction || "",
      asOfDate: question.payload.asOfDate || null,
      inputs: activeInputs.map((artifact) => artifact.payload),
      evidenceSet: evidenceSet.payload
    })
  } : null;
  sendJSON(response, 200, {
    projectID: context.projectID,
    questionID,
    access: {
      role: context.projectAccess.role,
      permissions: context.projectAccess.permissions
    },
    question: { envelope: question.envelope, payload: question.payload },
    researchConversationID: linkedResearch?.conversation?.id || null,
    artifacts: artifacts.map((artifact) => ({ envelope: artifact.envelope, payload: artifact.payload })),
    links: projectLinks.filter((link) => artifactIDs.has(link.targetID)),
    activity: activities.filter((event) => event.projectID === context.projectID && (
      event.objectID === questionID || event.metadata?.questionID === questionID
    )),
    pendingIssuance: pendingIssuance.filter((item) => item.questionID === questionID),
    researchAnswers: researchAnswers
      .filter((answer) => answerIDs.has(answer.id))
      .map(researchAnswerRecordForClient),
    analysisBinding
  });
}

async function handleCodeQuestionDefinitionSave(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.update")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const existing = await codeQuestionForProject(context.storageOwnerUserID, context.projectID, questionID);
    if (!existing) {
      sendError(response, 404, "Code Question not found for this Project.");
      return;
    }
    const expectedVersion = Number(context.body.expectedVersion);
    if (expectedVersion !== Number(existing.envelope.version)) {
      if (Number.isSafeInteger(expectedVersion) &&
        Number(existing.envelope.version) === expectedVersion + 1 &&
        codeQuestionDefinitionIntentMatches(existing.payload, context.body)) {
        sendJSON(response, 200, {
          question: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          replayed: true
        });
        return;
      }
      throw new CodeQuestionCommandError("This Code Question record changed after you opened it.", {
        code: "CODE_QUESTION_VERSION_CONFLICT",
        status: 409,
        details: { expectedVersion, currentVersion: existing.envelope.version }
      });
    }
    const artifact = codeQuestionArtifactForAccess(context, updateCodeQuestionDefinitionArtifact(existing, {
      userID: context.actorUserID,
      expectedVersion,
      title: context.body.title,
      questionText: context.body.questionText,
      scope: context.body.scope,
      desiredOutput: context.body.desiredOutput,
      jurisdiction: context.body.jurisdiction,
      asOfDate: context.body.asOfDate
    }));
    await saveStoredFoundationArtifactCompareAndSwap(
      context.storageOwnerUserID,
      artifact,
      expectedVersion
    );
    await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
      projectID: context.projectID,
      action: "code-question.definition.revised",
      objectKind: "codeQuestion",
      objectID: questionID,
      previousStatus: `version-${existing.envelope.version}`,
      newStatus: `version-${artifact.envelope.version}`,
      metadata: { questionID, definitionRevision: artifact.payload.definitionRevision }
    }));
    sendJSON(response, 200, {
      question: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionCreate(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.create")
  });
  if (!context) return;
  try {
    const projectID = context.projectID;
    const requestedID = String(context.body.id || "").trim();
    if (requestedID) {
      const existing = (await listStoredFoundationArtifacts(context.storageOwnerUserID))
        .find((item) => item.envelope?.id === requestedID) || null;
      if (existing) {
        const sameIntent = existing.envelope?.type === "codeQuestion" &&
          existing.payload?.projectID === projectID &&
          codeQuestionCreateIntentMatches(existing.payload, context.body);
        if (!sameIntent) {
          codeQuestionIdempotencyConflict("This Code Question ID was already used for different content.", {
            id: requestedID
          });
        }
        const link = codeQuestionLinkForAccess(context, {
          projectID,
          targetKind: "codeQuestion",
          targetID: existing.envelope.id,
          createdAt: existing.envelope.createdAt
        });
        await saveStoredProjectLink(context.storageOwnerUserID, link);
        sendJSON(response, 200, {
          question: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          link,
          displayID: existing.payload.displayID,
          replayed: true
        });
        return;
      }
    }
    const allocated = await allocateStoredCodeQuestionCounter(
      context.storageOwnerUserID,
      "questionNumber",
      projectID
    );
    const now = new Date().toISOString();
    const artifact = codeQuestionArtifactForAccess(context, createCodeQuestionArtifact({
      userID: context.actorUserID,
      projectID,
      title: context.body.title,
      questionText: context.body.questionText,
      scope: context.body.scope,
      desiredOutput: context.body.desiredOutput,
      jurisdiction: context.body.jurisdiction,
      asOfDate: context.body.asOfDate,
      questionNumber: allocated.value,
      createdAt: now,
      id: requestedID || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, artifact, 0);
    const link = codeQuestionLinkForAccess(context, {
      projectID,
      targetKind: "codeQuestion",
      targetID: artifact.envelope.id,
      createdAt: now
    });
    await saveStoredProjectLink(context.storageOwnerUserID, link);
    const event = codeQuestionActivityForAccess(context, {
      projectID,
      action: "code-question.created",
      objectKind: "codeQuestion",
      objectID: artifact.envelope.id,
      newStatus: "active",
      createdAt: now
    });
    await saveStoredActivityEvent(context.storageOwnerUserID, event);
    sendJSON(response, 201, {
      question: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload },
      link,
      activity: event,
      displayID: formatQuestionDisplayID(allocated.value)
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionArchive(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.archive")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const existing = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    if (!existing) {
      sendError(response, 404, "Code Question not found.");
      return;
    }
    const artifact = codeQuestionArtifactForAccess(context, archiveCodeQuestionArtifact(existing, {
      userID: context.actorUserID,
      expectedVersion: Number(context.body.expectedVersion)
    }));
    await saveStoredFoundationArtifactCompareAndSwap(
      context.storageOwnerUserID,
      artifact,
      Number(context.body.expectedVersion)
    );
    const event = codeQuestionActivityForAccess(context, {
      projectID: artifact.payload.projectID,
      action: "code-question.archived",
      objectKind: "codeQuestion",
      objectID: artifact.envelope.id,
      previousStatus: "active",
      newStatus: "archived"
    });
    await saveStoredActivityEvent(context.storageOwnerUserID, event);
    sendJSON(response, 200, {
      question: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload },
      activity: event
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionRestore(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.restore")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const existing = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    if (!existing) {
      sendError(response, 404, "Code Question not found.");
      return;
    }
    const artifact = codeQuestionArtifactForAccess(context, restoreCodeQuestionArtifact(existing, {
      userID: context.actorUserID,
      expectedVersion: Number(context.body.expectedVersion)
    }));
    await saveStoredFoundationArtifactCompareAndSwap(
      context.storageOwnerUserID,
      artifact,
      Number(context.body.expectedVersion)
    );
    const event = codeQuestionActivityForAccess(context, {
      projectID: artifact.payload.projectID,
      action: "code-question.restored",
      objectKind: "codeQuestion",
      objectID: artifact.envelope.id,
      previousStatus: "archived",
      newStatus: "active"
    });
    await saveStoredActivityEvent(context.storageOwnerUserID, event);
    sendJSON(response, 200, {
      question: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload },
      activity: event
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function validatedResearchInputCapture(context, questionID, body) {
  const source = body.researchSource;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const conversationID = String(source.conversationID || "").trim();
  const messageID = String(source.messageID || "").trim();
  if (!conversationID || !messageID) {
    throw new CodeQuestionCommandError("Choose a linked Research message to capture.", {
      code: "CODE_QUESTION_RESEARCH_SOURCE_INVALID",
      status: 400
    });
  }
  const conversation = await storedResearchConversation(context.actorUserID, conversationID);
  if (!conversation || conversation.primaryProjectID !== context.projectID) {
    throw new CodeQuestionCommandError("The linked Research message is unavailable for this Project.", {
      code: "CODE_QUESTION_RESEARCH_SOURCE_NOT_FOUND",
      status: 404
    });
  }
  const link = await researchConversationProjectLink(context.actorUserID, conversation);
  if (researchCodeDecisionLink(link)?.questionID !== questionID) {
    throw new CodeQuestionCommandError("Link this Research conversation to the Code Decision before capturing it.", {
      code: "CODE_QUESTION_RESEARCH_LINK_REQUIRED",
      status: 409
    });
  }
  const message = (conversation.messages || []).find((item) =>
    item.id === messageID && item.role === "user"
  );
  if (!message || normalizedResearchText(message.question, 2_000) !== normalizedResearchText(body.statement, 2_000)) {
    throw new CodeQuestionCommandError("The captured statement must match its Research message.", {
      code: "CODE_QUESTION_RESEARCH_SOURCE_CHANGED",
      status: 409
    });
  }
  const inputKind = String(body.kind || body.inputKind || "").trim();
  const inputState = String(body.state || "").trim();
  const dispositionByKindAndState = new Map([
    ["confirmedFact:confirmed", "project-fact"],
    ["assumption:proposed", "assumption"],
    ["unknown:proposed", "missing-information"]
  ]);
  const disposition = dispositionByKindAndState.get(`${inputKind}:${inputState}`);
  if (!disposition) {
    throw new CodeQuestionCommandError(
      "Research capture must use the canonical fact, assumption, or missing-information state.",
      { code: "CODE_QUESTION_RESEARCH_SOURCE_DISPOSITION_INVALID", status: 400 }
    );
  }
  const suppliedDisposition = String(source.disposition || "").trim();
  if (suppliedDisposition && suppliedDisposition !== disposition) {
    throw new CodeQuestionCommandError("Research capture disposition does not match the governed input kind.", {
      code: "CODE_QUESTION_RESEARCH_SOURCE_DISPOSITION_MISMATCH",
      status: 409
    });
  }
  const basis = `Captured from Research ${conversationID} message ${messageID}`;
  const suppliedBasis = normalizedResearchText(body.basis, 500);
  if (suppliedBasis && suppliedBasis !== basis) {
    throw new CodeQuestionCommandError("Research capture basis does not match its immutable message provenance.", {
      code: "CODE_QUESTION_RESEARCH_SOURCE_BASIS_MISMATCH",
      status: 409
    });
  }
  return {
    researchSource: { conversationID, messageID, disposition },
    basis
  };
}

async function handleCodeQuestionInputSave(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.input.save")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const question = await codeQuestionForProject(context.storageOwnerUserID, context.projectID, questionID);
    if (!question) {
      sendError(response, 404, "Code Question not found for this Project.");
      return;
    }
    const researchCapture = await validatedResearchInputCapture(context, questionID, context.body);
    const commandBody = researchCapture
      ? {
          ...context.body,
          basis: researchCapture.basis,
          researchSource: researchCapture.researchSource
        }
      : context.body;
    const researchSource = researchCapture?.researchSource || null;
    const requestedID = String(commandBody.id || "").trim();
    const artifactWithRequestedID = requestedID
      ? (await listStoredFoundationArtifacts(context.storageOwnerUserID))
          .find((item) => item.envelope?.id === requestedID) || null
      : null;
    if (artifactWithRequestedID && (artifactWithRequestedID.envelope?.type !== "questionInput" ||
      artifactWithRequestedID.payload?.questionID !== questionID)) {
      codeQuestionIdempotencyConflict("This Question Input ID was already used for a different artifact.", {
        id: requestedID
      });
    }
    const existing = artifactWithRequestedID;
    const suppliedExpectedVersion = Number(context.body.expectedVersion);
    if (existing && !Number.isSafeInteger(suppliedExpectedVersion)) {
      if (Number(existing.envelope.version) === 1 &&
        questionInputIntentMatches(existing.payload, commandBody, { creating: true })) {
        await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
          projectID: context.projectID,
          targetKind: "questionInput",
          targetID: existing.envelope.id,
          createdAt: existing.envelope.createdAt
        }));
        sendJSON(response, 200, {
          input: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          replayed: true
        });
        return;
      }
      codeQuestionIdempotencyConflict("This Question Input ID was already used for different content.", {
        id: requestedID
      });
    }
    if (existing && suppliedExpectedVersion !== Number(existing.envelope.version)) {
      if (Number(existing.envelope.version) === suppliedExpectedVersion + 1 &&
        questionInputIntentMatches(existing.payload, commandBody)) {
        sendJSON(response, 200, {
          input: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          replayed: true
        });
        return;
      }
      throw new CodeQuestionCommandError("This Code Question record changed after you opened it.", {
        code: "CODE_QUESTION_VERSION_CONFLICT",
        status: 409,
        details: { expectedVersion: suppliedExpectedVersion, currentVersion: existing.envelope.version }
      });
    }
    const artifact = codeQuestionArtifactForAccess(context, existing
      ? reviseQuestionInputArtifact(existing, {
          userID: context.actorUserID,
          expectedVersion: suppliedExpectedVersion,
          statement: commandBody.statement,
          state: commandBody.state,
          basis: commandBody.basis,
          responsibleUserID: commandBody.responsibleUserID
        })
      : createQuestionInputArtifact({
          userID: context.actorUserID,
          questionID,
          kind: commandBody.kind || commandBody.inputKind,
          statement: commandBody.statement,
          state: commandBody.state,
          basis: commandBody.basis,
          id: requestedID || randomUUID()
        }));
    const expectedVersion = existing ? suppliedExpectedVersion : 0;
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, artifact, expectedVersion);
    if (!existing) {
      await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
        projectID: context.projectID,
        targetKind: "questionInput",
        targetID: artifact.envelope.id
      }));
    }
    await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
      projectID: context.projectID,
      action: existing ? "code-question.input.revised" :
        artifact.payload.inputKind === "confirmedFact"
          ? "code-question.input.confirmed"
          : "code-question.input.created",
      objectKind: "questionInput",
      objectID: artifact.envelope.id,
      previousStatus: existing?.payload?.state || null,
      newStatus: artifact.payload.state,
      metadata: {
        questionID,
        inputRevision: artifact.payload.revision,
        ...(researchSource ? { researchSource } : {})
      }
    }));
    sendJSON(response, existing ? 200 : 201, {
      input: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionEvidenceSnapshot(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.evidence.propose")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const question = await codeQuestionForProject(context.storageOwnerUserID, context.projectID, questionID);
    if (!question) {
      sendError(response, 404, "Code Question not found for this Project.");
      return;
    }
    const requestedID = String(context.body.id || "").trim();
    if (requestedID) {
      const [existing, links] = await Promise.all([
        listStoredFoundationArtifacts(context.storageOwnerUserID).then((items) =>
          items.find((item) => item.envelope?.id === requestedID) || null
        ),
        listStoredProjectLinks(context.storageOwnerUserID)
      ]);
      if (existing) {
        const requested = createEvidenceSnapshotArtifact({
          userID: context.actorUserID,
          sourceIdentity: context.body.sourceIdentity,
          passageLocator: context.body.passageLocator,
          quotedText: context.body.quotedText,
          sourceVersion: context.body.sourceVersion,
          structuredMaterial: context.body.structuredMaterial,
          id: requestedID,
          createdAt: existing.envelope.createdAt
        });
        const keys = [
          "id", "sourceIdentity", "passageLocator", "quotedText", "textHash",
          "structuredMaterial", "sourceVersion"
        ];
        const existingQuestionLinks = links.filter((link) => !link.deletedAt &&
          link.targetKind === "evidenceSnapshotV2" && link.targetID === requestedID);
        const sameQuestion = !existingQuestionLinks.length || existingQuestionLinks.some((link) =>
          link.projectID === context.projectID && link.metadata?.questionID === questionID
        );
        if (existing.envelope?.type !== "evidenceSnapshotV2" ||
          !codeQuestionIntentMatches(existing.payload, requested.payload, keys) || !sameQuestion) {
          codeQuestionIdempotencyConflict("This evidence snapshot ID was already used for different content.", {
            id: requestedID
          });
        }
        await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
          projectID: context.projectID,
          targetKind: "evidenceSnapshotV2",
          targetID: existing.envelope.id,
          createdAt: existing.envelope.createdAt,
          metadata: { questionID }
        }));
        sendJSON(response, 200, {
          snapshot: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          replayed: true
        });
        return;
      }
    }
    const artifact = codeQuestionArtifactForAccess(context, createEvidenceSnapshotArtifact({
      userID: context.actorUserID,
      sourceIdentity: context.body.sourceIdentity,
      passageLocator: context.body.passageLocator,
      quotedText: context.body.quotedText,
      sourceVersion: context.body.sourceVersion,
      structuredMaterial: context.body.structuredMaterial,
      id: requestedID || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, artifact, 0);
    await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
      projectID: context.projectID,
      targetKind: "evidenceSnapshotV2",
      targetID: artifact.envelope.id,
      metadata: { questionID }
    }));
    sendJSON(response, 201, {
      snapshot: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionEvidenceSetCreate(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.evidence.approve")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const question = await codeQuestionForProject(context.storageOwnerUserID, context.projectID, questionID);
    if (!question) {
      sendError(response, 404, "Code Question not found for this Project.");
      return;
    }
    const requestedID = String(context.body.id || "").trim();
    const requestedEntries = Array.isArray(context.body.entries) ? context.body.entries : [];
    if (requestedID) {
      const existing = (await listStoredFoundationArtifacts(context.storageOwnerUserID))
        .find((item) => item.envelope?.id === requestedID) || null;
      if (existing) {
        if (!codeQuestionEvidenceSetIntentMatches(existing, questionID, requestedEntries)) {
          codeQuestionIdempotencyConflict("This Evidence Set ID was already used for different content.", {
            id: requestedID
          });
        }
        await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
          projectID: context.projectID,
          targetKind: "questionEvidenceSet",
          targetID: existing.envelope.id,
          createdAt: existing.envelope.createdAt
        }));
        sendJSON(response, 200, {
          evidenceSet: { id: existing.envelope.id, version: existing.envelope.version, ...existing.payload },
          replayed: true
        });
        return;
      }
    }
    const artifacts = await listStoredFoundationArtifacts(context.storageOwnerUserID);
    const links = await listStoredProjectLinks(context.storageOwnerUserID);
    const projectSnapshotIDs = new Set(links
      .filter((link) => !link.deletedAt && link.projectID === context.projectID &&
        link.targetKind === "evidenceSnapshotV2")
      .map((link) => link.targetID));
    const entryIDs = requestedEntries
      .map((entry) => String(entry?.snapshotID || "").trim())
      .filter(Boolean);
    const invalidSnapshotID = entryIDs.find((snapshotID) =>
      !projectSnapshotIDs.has(snapshotID) || !artifacts.some((artifact) =>
        artifact.envelope?.id === snapshotID && artifact.envelope?.type === "evidenceSnapshotV2"
      )
    );
    if (invalidSnapshotID) {
      sendJSON(response, 409, {
        error: "Every approved evidence entry must resolve to a snapshot in this Project.",
        code: "CODE_QUESTION_EVIDENCE_SNAPSHOT_INVALID",
        snapshotID: invalidSnapshotID
      });
      return;
    }
    const allocated = await allocateStoredCodeQuestionCounter(
      context.storageOwnerUserID,
      "evidenceSetVersion",
      questionID
    );
    const approvedAt = new Date().toISOString();
    const serverApprovedEntries = requestedEntries.map((entry) => ({
      ...entry,
      approvalActor: context.actorUserID,
      approvalAt: approvedAt
    }));
    const artifact = codeQuestionArtifactForAccess(context, createEvidenceSetArtifact({
      userID: context.actorUserID,
      questionID,
      version: allocated.value,
      entries: serverApprovedEntries,
      id: requestedID || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, artifact, 0);
    {
      await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
        projectID: context.projectID,
        targetKind: "questionEvidenceSet",
        targetID: artifact.envelope.id
      }));
      await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
        projectID: context.projectID,
        action: "code-question.evidence.approved",
        objectKind: "questionEvidenceSet",
        objectID: artifact.envelope.id,
        newStatus: `v${allocated.value}`
      }));
    }
    sendJSON(response, 201, {
      evidenceSet: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

const codeQuestionAnalysisInFlight = new Map();

const codeQuestionAnalysisBindingKeys = Object.freeze([
  "definitionRevision", "definitionHash", "inputSnapshotIDs", "inputSetHash",
  "evidenceSetID", "evidenceSetVersion", "evidenceSetHash", "dependencyHash"
]);

function codeQuestionAnalysisBindingIntent(binding) {
  return {
    definitionRevision: binding.question.payload.definitionRevision,
    definitionHash: binding.definitionHash,
    inputSnapshotIDs: binding.inputs.map((input) => input.id),
    inputSetHash: binding.inputSetHash,
    evidenceSetID: binding.evidenceSet.envelope.id,
    evidenceSetVersion: binding.evidenceSet.payload.version,
    evidenceSetHash: binding.evidenceSetHash,
    dependencyHash: binding.dependencyHash
  };
}

function codeQuestionAnalysisBindingHash(binding) {
  return codeQuestionContentHash(codeQuestionAnalysisBindingIntent(binding));
}

function codeQuestionResearchEvidence(snapshotArtifact, entry) {
  const snapshot = snapshotArtifact.payload;
  const sectionID = String(snapshot.sourceIdentity || snapshot.passageLocator || snapshot.id);
  const sourceID = String(snapshot.id || snapshotArtifact.envelope.id);
  const sourceVersion = String(snapshot.sourceVersion || snapshot.textHash || "bound-snapshot-v2");
  return {
    sectionID,
    sourceID,
    passageID: sourceID,
    sectionNumber: String(snapshot.passageLocator || sectionID),
    title: String(snapshot.passageLocator || "Approved Code Question evidence"),
    text: snapshot.quotedText,
    selectedText: snapshot.quotedText,
    jurisdiction: "New York City",
    codeEdition: sourceVersion,
    codeVersion: sourceVersion,
    codeBook: String(snapshot.sourceIdentity || "Approved evidence snapshot"),
    codePrefix: "CQ",
    chapterNumber: "bound",
    evidenceRole: entry.role,
    qualification: entry.qualification || "",
    structuredSource: snapshot.structuredMaterial || null
  };
}

function assertCodeQuestionBindingField(actual, supplied, label) {
  if (String(actual) !== String(supplied)) {
    throw new CodeQuestionCommandError(`${label} changed before analysis began.`, {
      code: "CODE_QUESTION_VERSION_CONFLICT",
      status: 409,
      details: { label, supplied, current: actual }
    });
  }
}

async function resolveCodeQuestionAnalysisBinding(userID, body) {
  const artifacts = await listStoredFoundationArtifacts(userID);
  const questionID = String(body.questionID || "").trim();
  const question = artifacts.find((item) =>
    item.envelope?.id === questionID && item.envelope?.type === "codeQuestion"
  );
  if (!question || question.payload?.projectID !== String(body.projectID || "").trim()) {
    throw new CodeQuestionCommandError("Code Question not found for this Project.", { status: 404 });
  }
  const evidenceSetID = String(body.evidenceSetID || "").trim();
  const evidenceSet = artifacts.find((item) =>
    item.envelope?.id === evidenceSetID && item.envelope?.type === "questionEvidenceSet"
  );
  if (!evidenceSet || evidenceSet.payload.questionID !== questionID) {
    throw new CodeQuestionCommandError("Approved Evidence Set not found for this question.", { status: 404 });
  }
  const requestedInputIDs = (Array.isArray(body.inputSnapshotIDs) ? body.inputSnapshotIDs : [])
    .map(String).filter(Boolean);
  const inputs = requestedInputIDs.map((id) => artifacts.find((item) =>
    item.envelope?.id === id &&
    item.envelope?.type === "questionInput" &&
    item.payload?.questionID === questionID
  ));
  if (inputs.some((item) => !item)) {
    throw new CodeQuestionCommandError("A selected Question Input could not be resolved.", {
      code: "CODE_QUESTION_VERSION_CONFLICT",
      status: 409
    });
  }
  const entries = (evidenceSet.payload.entries || []).filter((entry) => entry.analysisEligible === true);
  if (!entries.length) {
    throw new CodeQuestionCommandError("The approved Evidence Set has no analysis-eligible passages.");
  }
  const approvedEvidence = entries.map((entry) => {
    const snapshot = artifacts.find((item) =>
      item.envelope?.id === entry.snapshotID && item.envelope?.type === "evidenceSnapshotV2"
    );
    if (!snapshot) {
      throw new CodeQuestionCommandError("An approved evidence snapshot could not be resolved.", {
        code: "CODE_QUESTION_VERSION_CONFLICT",
        status: 409
      });
    }
    return { entry, snapshot };
  });
  const definitionHash = codeQuestionContentHash({
    questionText: question.payload.questionText,
    scope: question.payload.scope || "",
    jurisdiction: question.payload.jurisdiction || "",
    asOfDate: question.payload.asOfDate || null,
    definitionRevision: question.payload.definitionRevision
  });
  const normalizedInputs = inputs.map((item) => item.payload);
  const inputSetHash = codeQuestionContentHash(normalizedInputs.map((input) => ({
    id: input.id,
    inputKind: input.inputKind,
    state: input.state,
    statement: input.statement,
    revision: input.revision
  })));
  const evidenceSetHash = evidenceSet.payload.contentHash;
  const dependencyHash = computeDependencyHash({
    questionText: question.payload.questionText,
    scope: question.payload.scope || "",
    jurisdiction: question.payload.jurisdiction || "",
    asOfDate: question.payload.asOfDate || null,
    inputs: normalizedInputs,
    evidenceSet: evidenceSet.payload
  });
  assertCodeQuestionBindingField(question.payload.definitionRevision, body.definitionRevision, "Definition revision");
  assertCodeQuestionBindingField(definitionHash, body.definitionHash, "Definition hash");
  assertCodeQuestionBindingField(inputSetHash, body.inputSetHash, "Question Input hash");
  assertCodeQuestionBindingField(evidenceSet.payload.version, body.evidenceSetVersion, "Evidence Set version");
  assertCodeQuestionBindingField(evidenceSetHash, body.evidenceSetHash, "Evidence Set hash");
  assertCodeQuestionBindingField(dependencyHash, body.dependencyHash, "Dependency hash");
  return {
    question,
    inputs: normalizedInputs,
    evidenceSet,
    approvedEvidence,
    definitionHash,
    inputSetHash,
    evidenceSetHash,
    dependencyHash
  };
}

async function generateCodeQuestionAnalysis(context, binding, requestID) {
  const { question, evidenceSet, approvedEvidence } = binding;
  const questionID = question.envelope.id;
  const storageUserID = context.storageOwnerUserID;
  const actorUserID = context.actorUserID;
  const existingArtifacts = await listStoredFoundationArtifacts(storageUserID);
  const replay = existingArtifacts.find((item) =>
    item.envelope?.type === "questionAnalysis" &&
    item.payload?.questionID === questionID &&
    item.payload?.requestID === requestID
  );
  if (replay) {
    const requestedBinding = codeQuestionAnalysisBindingIntent(binding);
    if (!codeQuestionIntentMatches(replay.payload, requestedBinding, codeQuestionAnalysisBindingKeys)) {
      codeQuestionIdempotencyConflict(
        "This analysis request ID was already used with a different dependency binding.",
        { requestID, analysisID: replay.envelope.id }
      );
    }
    const answer = (await listStoredResearchAnswers(storageUserID))
      .find((item) => item.id === replay.payload.researchAnswerID) || null;
    return { analysis: { id: replay.envelope.id, ...replay.payload }, answer, replayed: true };
  }
  const mockMode = researchMockMode();
  const mockDelayMilliseconds = Math.min(1_000, Math.max(
    0,
    Number(process.env.PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS || 0) || 0
  ));
  if (mockMode && mockDelayMilliseconds) {
    await new Promise((resolve) => setTimeout(resolve, mockDelayMilliseconds));
  }
  const usageEntries = mockMode ? [] : await researchUsageSince(actorUserID, currentMonthStart());
  const requestLimit = monthlyResearchRequestLimit();
  if (!mockMode && usageEntries.length >= requestLimit) {
    throw new CodeQuestionCommandError("Research is temporarily unavailable while account capacity is reviewed.", {
      code: "RESEARCH_CAPACITY_REVIEW",
      status: 429
    });
  }
  const reservationID = `cq-analysis-${createHash("sha256")
    .update(`${actorUserID}:${questionID}:${requestID}`)
    .digest("hex")}`;
  let reserved = false;
  let completedReservation = false;
  try {
    if (!mockMode) {
      reserved = await reserveResearchUsage(actorUserID, {
        id: reservationID,
        since: currentMonthStart(),
        limit: requestLimit,
        createdAt: new Date().toISOString()
      });
      if (!reserved) {
        throw new CodeQuestionCommandError("This analysis request is already running or completed.", {
          code: "CODE_QUESTION_ANALYSIS_IN_PROGRESS",
          status: 409
        });
      }
    }
    const evidence = approvedEvidence.map(({ snapshot, entry }) =>
      codeQuestionResearchEvidence(snapshot, entry)
    );
    const projectFacts = binding.inputs.map((input) =>
      `${input.inputKind}: ${input.statement} [${input.state}]`
    );
    const result = mockMode
      ? {
          interpretation: validateResearchInterpretation(mockResearchInterpretation(question.payload.questionText, evidence), evidence),
          model: "permitext-mock",
          configuration: researchModelConfiguration(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        }
      : await openAIResearchInterpretation(question.payload.questionText, evidence, actorUserID, {
          projectContextFacts: projectFacts,
          messages: []
        });
    const estimatedCost = estimatedResearchCost(result.usage);
    const createdAt = new Date().toISOString();
    const answerID = `cq-answer-${createHash("sha256").update(`${questionID}:${requestID}`).digest("hex")}`;
    const answerPayload = {
      mode: mockMode ? "mock" : "openai",
      model: result.model,
      requestedModel: result.requestedModel || result.model,
      promptVersion: result.configuration.promptVersion,
      evidenceVersion: result.configuration.evidenceVersion,
      ...result.interpretation,
      evidenceSectionIDs: evidence.map((item) => item.sectionID),
      evidenceSourceIDs: evidence.map((item) => item.sourceID),
      disclaimer: "AI-generated research assistance, not an official code determination."
    };
    const immutableEvidence = evidence.map((source) => immutableEvidenceSnapshot({
      id: source.sourceID,
      source,
      approvedAt: createdAt,
      evidenceSetVersion: evidenceSet.payload.version,
      sourceLibraryVersion: source.codeVersion
    }));
    const answer = immutableResearchAnswer({
      id: answerID,
      owner: context.owner,
      conversationID: `code-question:${questionID}`,
      projectID: question.payload.projectID,
      question: question.payload.questionText,
      answer: answerPayload,
      evidence: immutableEvidence,
      citations: answerPayload.citations,
      model: result.model,
      researchSystemVersion: [answerPayload.promptVersion, answerPayload.evidenceVersion].filter(Boolean).join(":"),
      createdAt
    });
    await saveStoredResearchAnswer(storageUserID, answer);
    const analysisID = `qa-${createHash("sha256").update(`${questionID}:${requestID}`).digest("hex")}`;
    const artifact = codeQuestionArtifactForAccess(context, createAnalysisArtifact({
      userID: actorUserID,
      questionID,
      definitionRevision: question.payload.definitionRevision,
      definitionHash: binding.definitionHash,
      inputSnapshotIDs: binding.inputs.map((input) => input.id),
      inputSetHash: binding.inputSetHash,
      evidenceSetID: evidenceSet.envelope.id,
      evidenceSetVersion: evidenceSet.payload.version,
      evidenceSetHash: binding.evidenceSetHash,
      dependencyHash: binding.dependencyHash,
      researchAnswerID: answer.id,
      requestID,
      id: analysisID,
      createdAt,
      modelID: result.model,
      analysisPolicyID: "selected-evidence-only-v1",
      promptTemplateVersion: result.configuration.promptVersion,
      citationValidation: "approved-evidence-only"
    }));
    await saveStoredFoundationArtifactCompareAndSwap(storageUserID, artifact, 0);
    if (!mockMode) {
      await completeResearchUsageReservation(actorUserID, reservationID, {
        model: result.model,
        requestedModel: result.requestedModel || result.model,
        mode: "openai-code-question",
        ...result.usage,
        promptVersion: result.configuration.promptVersion,
        evidenceVersion: result.configuration.evidenceVersion,
        estimatedCostUSD: estimatedCost.estimatedUSD,
        pricingVersion: estimatedCost.pricingVersion,
        createdAt
      });
      completedReservation = true;
    }
    await saveStoredProjectLink(storageUserID, codeQuestionLinkForAccess(context, {
      projectID: question.payload.projectID,
      targetKind: "questionAnalysis",
      targetID: artifact.envelope.id
    }));
    await saveStoredActivityEvent(storageUserID, codeQuestionActivityForAccess(context, {
      projectID: question.payload.projectID,
      action: "code-question.analysis.generated",
      objectKind: "questionAnalysis",
      objectID: artifact.envelope.id,
      newStatus: "generated",
      metadata: { researchAnswerID: answer.id, dependencyHash: binding.dependencyHash }
    }));
    return { analysis: { id: artifact.envelope.id, ...artifact.payload }, answer, replayed: false };
  } catch (error) {
    if (reserved && !completedReservation) await releaseResearchUsageReservation(actorUserID, reservationID);
    throw error;
  }
}

async function handleCodeQuestionAnalysisCreate(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.analysis.create")
  });
  if (!context) return;
  if (!hasActiveResearchEntitlement(context.authContext.entitlement) && !researchMockMode()) {
    sendJSON(response, 403, { error: "Research Add-On required for bounded analysis.", code: "RESEARCH_REQUIRED" });
    return;
  }
  try {
    const requestID = String(context.body.requestID || context.body.idempotencyKey || "").trim();
    if (!requestID) throw new CodeQuestionCommandError("Analysis requires an idempotent request ID.");
    const binding = await resolveCodeQuestionAnalysisBinding(context.storageOwnerUserID, context.body);
    const key = `${context.storageOwnerUserID}:${binding.question.envelope.id}:${requestID}`;
    const bindingHash = codeQuestionAnalysisBindingHash(binding);
    let inFlight = codeQuestionAnalysisInFlight.get(key);
    if (inFlight && inFlight.bindingHash !== bindingHash) {
      codeQuestionIdempotencyConflict(
        "This analysis request ID is already running with a different dependency binding.",
        { requestID }
      );
    }
    if (!inFlight) {
      const task = generateCodeQuestionAnalysis(context, binding, requestID)
        .finally(() => codeQuestionAnalysisInFlight.delete(key));
      inFlight = { bindingHash, task };
      codeQuestionAnalysisInFlight.set(key, inFlight);
    }
    const result = await inFlight.task;
    sendJSON(response, result.replayed ? 200 : 201, {
      ...result,
      answer: researchAnswerRecordForClient(result.answer)
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    if (["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_CITATION"].includes(error.code)) {
      sendError(response, 502, "The research model could not return a verified, approved-evidence-only answer.");
      return;
    }
    if (error.code === "RESEARCH_NOT_CONFIGURED") {
      sendError(response, 503, error.message);
      return;
    }
    throw error;
  }
}

async function handleCodeQuestionConclusionPublish(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.conclusion.publish")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const artifacts = await listStoredFoundationArtifacts(context.storageOwnerUserID);
    const question = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    const evidenceSet = artifacts.find((item) =>
      item.envelope?.id === String(context.body.evidenceSetID || "") &&
      item.envelope?.type === "questionEvidenceSet" &&
      item.payload?.questionID === questionID
    );
    if (!question || !evidenceSet) {
      throw new CodeQuestionCommandError("The bound Code Question or Evidence Set was not found.", {
        code: "CODE_QUESTION_VERSION_CONFLICT",
        status: 409
      });
    }
    const activeInputs = artifacts
      .filter((item) => item.envelope?.type === "questionInput" &&
        item.payload?.questionID === questionID && item.payload?.state !== "retired")
      .sort((left, right) => String(left.envelope.id).localeCompare(String(right.envelope.id)));
    const definitionHash = codeQuestionContentHash({
      questionText: question.payload.questionText,
      scope: question.payload.scope || "",
      jurisdiction: question.payload.jurisdiction || "",
      asOfDate: question.payload.asOfDate || null,
      definitionRevision: question.payload.definitionRevision
    });
    const inputSetHash = codeQuestionContentHash(activeInputs.map((item) => ({
      id: item.payload.id,
      inputKind: item.payload.inputKind,
      state: item.payload.state,
      statement: item.payload.statement,
      revision: item.payload.revision
    })));
    const dependencyHash = computeDependencyHash({
      questionText: question.payload.questionText,
      scope: question.payload.scope || "",
      jurisdiction: question.payload.jurisdiction || "",
      asOfDate: question.payload.asOfDate || null,
      inputs: activeInputs.map((item) => item.payload),
      evidenceSet: evidenceSet.payload
    });
    assertCodeQuestionBindingField(question.payload.definitionRevision, context.body.definitionRevision, "Definition revision");
    assertCodeQuestionBindingField(definitionHash, context.body.definitionHash, "Definition hash");
    assertCodeQuestionBindingField(inputSetHash, context.body.inputSetHash, "Question Input hash");
    assertCodeQuestionBindingField(evidenceSet.payload.version, context.body.evidenceSetVersion, "Evidence Set version");
    assertCodeQuestionBindingField(evidenceSet.payload.contentHash, context.body.evidenceSetHash, "Evidence Set hash");
    const approvedSnapshotIDs = new Set((evidenceSet.payload.entries || []).map((entry) => entry.snapshotID));
    const citations = (Array.isArray(context.body.citations) ? context.body.citations : []).map(String);
    if (citations.some((id) => !approvedSnapshotIDs.has(id))) {
      throw new CodeQuestionCommandError("Professional conclusion cites evidence outside the approved Evidence Set.", {
        code: "INVALID_RESEARCH_CITATION",
        status: 409
      });
    }
    if (context.body.analysisRunID) {
      const analysis = artifacts.find((item) =>
        item.envelope?.id === String(context.body.analysisRunID) &&
        item.envelope?.type === "questionAnalysis" &&
        item.payload?.questionID === questionID
      );
      if (!analysis || analysis.payload.dependencyHash !== dependencyHash ||
        analysis.payload.dependencyHash !== context.body.analysisDependencyHash) {
        throw new CodeQuestionCommandError("The selected analysis is stale or could not be resolved.", {
          code: "CODE_QUESTION_VERSION_CONFLICT",
          status: 409
        });
      }
    }
    const allocated = await allocateStoredCodeQuestionCounter(
      context.storageOwnerUserID,
      "conclusionRevision",
      questionID
    );
    const artifact = codeQuestionArtifactForAccess(context, createConclusionArtifact({
      userID: context.actorUserID,
      questionID,
      revision: allocated.value,
      definitionRevision: context.body.definitionRevision,
      definitionHash: context.body.definitionHash,
      inputSetHash: context.body.inputSetHash,
      evidenceSetID: context.body.evidenceSetID,
      evidenceSetVersion: context.body.evidenceSetVersion,
      evidenceSetHash: context.body.evidenceSetHash,
      conclusionText: context.body.conclusionText,
      reasoning: context.body.reasoning,
      citations: context.body.citations,
      assumptions: context.body.assumptions,
      unknowns: context.body.unknowns,
      analysisRunID: context.body.analysisRunID,
      analysisDependencyHash: context.body.analysisDependencyHash,
      aiAssistanceDisclosure: context.body.aiAssistanceDisclosure,
      predecessorRevisionID: context.body.predecessorRevisionID,
      id: context.body.id || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, artifact, 0);
    await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
      projectID: question.payload.projectID,
      targetKind: "professionalConclusion",
      targetID: artifact.envelope.id
    }));
    await saveStoredActivityEvent(context.storageOwnerUserID, codeQuestionActivityForAccess(context, {
      projectID: question.payload.projectID,
      action: "code-question.conclusion.revised",
      objectKind: "professionalConclusion",
      objectID: artifact.envelope.id,
      newStatus: `r${allocated.value}`
    }));
    sendJSON(response, 201, {
      conclusion: { id: artifact.envelope.id, version: artifact.envelope.version, ...artifact.payload }
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionConclusionApprove(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.conclusion.approve")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const conclusionID = String(context.body.conclusionID || "").trim();
    const artifacts = await listStoredFoundationArtifacts(context.storageOwnerUserID);
    const question = await codeQuestionForProject(
      context.storageOwnerUserID,
      context.projectID,
      questionID
    );
    const conclusion = artifacts.find((item) =>
      item.envelope?.type === "professionalConclusion" &&
      item.envelope.id === conclusionID &&
      item.payload?.questionID === questionID
    );
    if (!question || !conclusion) {
      sendError(response, 404, "Code Question or professional conclusion not found.");
      return;
    }
    const currentEvidenceSet = artifacts
      .filter((item) => item.envelope?.type === "questionEvidenceSet" &&
        item.payload?.questionID === questionID)
      .sort((left, right) => Number(right.payload?.version || 0) - Number(left.payload?.version || 0))[0] || null;
    const currentInputs = artifacts
      .filter((item) => item.envelope?.type === "questionInput" &&
        item.payload?.questionID === questionID && item.payload?.state !== "retired")
      .sort((left, right) => String(left.envelope.id).localeCompare(String(right.envelope.id)));
    const currentDefinitionHash = codeQuestionContentHash({
      questionText: question.payload.questionText,
      scope: question.payload.scope || "",
      jurisdiction: question.payload.jurisdiction || "",
      asOfDate: question.payload.asOfDate || null,
      definitionRevision: question.payload.definitionRevision
    });
    const currentInputSetHash = codeQuestionContentHash(currentInputs.map((item) => ({
      id: item.payload.id,
      inputKind: item.payload.inputKind,
      state: item.payload.state,
      statement: item.payload.statement,
      revision: item.payload.revision
    })));
    if (!currentEvidenceSet ||
      Number(conclusion.payload.definitionRevision) !== Number(question.payload.definitionRevision) ||
      conclusion.payload.definitionHash !== currentDefinitionHash ||
      conclusion.payload.inputSetHash !== currentInputSetHash ||
      conclusion.payload.evidenceSetID !== currentEvidenceSet.envelope.id ||
      Number(conclusion.payload.evidenceSetVersion) !== Number(currentEvidenceSet.payload.version) ||
      conclusion.payload.evidenceSetHash !== currentEvidenceSet.payload.contentHash) {
      sendJSON(response, 409, {
        error: "The professional conclusion is stale because its Definition, inputs, or Evidence Set changed.",
        code: "CODE_QUESTION_VERSION_CONFLICT"
      });
      return;
    }
    const openBlockingIDs = blockingReviewRequestIDs(artifacts, questionID);
    if (openBlockingIDs.length) {
      sendJSON(response, 409, {
        error: "Resolve all blocking Review Requests before approval.",
        code: "BLOCKING_REVIEW_REQUESTS_OPEN",
        requestIDs: openBlockingIDs
      });
      return;
    }
    const allocated = await allocateStoredCodeQuestionCounter(
      context.storageOwnerUserID,
      "conclusionApprovalRound",
      questionID
    );
    const dependencyHash = conclusion.payload.analysisDependencyHash || codeQuestionContentHash({
      definitionRevision: conclusion.payload.definitionRevision,
      definitionHash: conclusion.payload.definitionHash,
      inputSetHash: conclusion.payload.inputSetHash,
      evidenceSetID: conclusion.payload.evidenceSetID,
      evidenceSetVersion: conclusion.payload.evidenceSetVersion,
      evidenceSetHash: conclusion.payload.evidenceSetHash
    });
    const approval = codeQuestionArtifactForAccess(context, createConclusionApprovalArtifact({
      userID: context.actorUserID,
      questionID,
      conclusionID,
      conclusionRevision: conclusion.payload.revision,
      dependencyHash,
      reviewRound: allocated.value,
      approvalBasis: context.body.approvalBasis,
      id: context.body.id || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(context.storageOwnerUserID, approval, 0);
    await saveStoredProjectLink(context.storageOwnerUserID, codeQuestionLinkForAccess(context, {
      projectID: question.payload.projectID,
      targetKind: "conclusionApproval",
      targetID: approval.envelope.id,
      metadata: { questionID, conclusionID }
    }));
    const activity = codeQuestionActivityForAccess(context, {
      projectID: question.payload.projectID,
      action: "code-question.conclusion.approved",
      objectKind: "conclusionApproval",
      objectID: approval.envelope.id,
      newStatus: "approved",
      metadata: { questionID, conclusionID, reviewRound: allocated.value }
    });
    await saveStoredActivityEvent(context.storageOwnerUserID, activity);
    sendJSON(response, 201, {
      approval: { id: approval.envelope.id, version: approval.envelope.version, ...approval.payload },
      activity
    });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 400, {
      error: error instanceof Error ? error.message : "Invalid conclusion approval.",
      code: "INVALID_CONCLUSION_APPROVAL"
    });
  }
}

function latestCodeQuestionArtifact(artifacts, type, questionID, field = "revision") {
  return artifacts
    .filter((item) => item.envelope?.type === type && item.payload?.questionID === questionID)
    .sort((left, right) => Number(right.payload?.[field] || 0) - Number(left.payload?.[field] || 0))[0] || null;
}

async function resolveServerCodeMemoContext(userID, questionID, draftID = null, projectID = null) {
  const artifacts = await listStoredFoundationArtifacts(userID);
  const question = artifacts.find((item) =>
    item.envelope?.type === "codeQuestion" && item.envelope.id === questionID
  ) || null;
  if (!question) throw new CodeQuestionCommandError("Code Question not found.", { status: 404 });
  if (projectID && question.payload?.projectID !== projectID) {
    throw new CodeQuestionCommandError("Code Question not found in this Project.", { status: 404 });
  }
  const inputs = artifacts
    .filter((item) => item.envelope?.type === "questionInput" && item.payload?.questionID === questionID)
    .map((item) => item.payload)
    .filter((item) => item.state !== "retired")
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const evidenceSet = latestCodeQuestionArtifact(artifacts, "questionEvidenceSet", questionID, "version");
  const snapshots = new Map(artifacts
    .filter((item) => item.envelope?.type === "evidenceSnapshotV2")
    .map((item) => [item.envelope.id, item]));
  const draftCandidates = artifacts
    .filter((item) =>
      item.envelope?.type === "reportDraft" &&
      item.payload?.recordType === "codeDecisionMemo" &&
      item.payload?.questionID === questionID
    )
    .sort((left, right) => Number(right.payload?.draftRevision || 0) - Number(left.payload?.draftRevision || 0));
  const draft = draftID
    ? draftCandidates.find((item) => item.envelope.id === draftID) || null
    : draftCandidates[0] || null;
  const analysisID = draft?.payload?.codeMemo?.analysisRunID || question.payload.currentAnalysisID || null;
  const analysis = analysisID
    ? artifacts.find((item) => item.envelope?.type === "questionAnalysis" && item.envelope.id === analysisID) || null
    : null;
  const conclusion = latestCodeQuestionArtifact(artifacts, "professionalConclusion", questionID, "revision");
  const conclusionHash = conclusion ? codeQuestionContentHash(conclusion.payload) : null;
  const conclusionApproval = artifacts
    .filter((item) =>
      item.envelope?.type === "conclusionApproval" &&
      item.payload?.questionID === questionID &&
      item.payload?.conclusionID === conclusion?.envelope.id &&
      Number(item.payload?.conclusionRevision) === Number(conclusion?.payload?.revision)
    )
    .sort((left, right) => String(right.payload?.approvedAt).localeCompare(String(left.payload?.approvedAt)))[0] || null;
  const readiness = artifacts
    .filter((item) => item.envelope?.type === "codeMemoReadiness" && item.payload?.draftID === draft?.envelope.id)
    .sort((left, right) => String(right.payload?.markedAt).localeCompare(String(left.payload?.markedAt)))[0] || null;
  const memoApproval = artifacts
    .filter((item) => item.envelope?.type === "codeMemoApproval" && item.payload?.draftID === draft?.envelope.id)
    .sort((left, right) => String(right.payload?.approvedAt).localeCompare(String(left.payload?.approvedAt)))[0] || null;
  const definitionHash = codeQuestionContentHash({
    questionText: question.payload.questionText,
    scope: question.payload.scope || "",
    jurisdiction: question.payload.jurisdiction || "",
    asOfDate: question.payload.asOfDate || null,
    definitionRevision: question.payload.definitionRevision
  });
  const inputSetHash = codeQuestionContentHash(inputs.map((input) => ({
    id: input.id,
    inputKind: input.inputKind,
    state: input.state,
    statement: input.statement,
    revision: input.revision
  })));
  const dependencyHash = evidenceSet ? computeDependencyHash({
    questionText: question.payload.questionText,
    scope: question.payload.scope || "",
    jurisdiction: question.payload.jurisdiction || "",
    asOfDate: question.payload.asOfDate || null,
    inputs,
    evidenceSet: evidenceSet.payload
  }) : null;
  return {
    artifacts, question, inputs, evidenceSet, snapshots, analysis, conclusion,
    conclusionHash, conclusionApproval, draft, readiness, memoApproval,
    definitionHash, inputSetHash, dependencyHash
  };
}

function serverCodeMemoReadiness(context) {
  const checks = [];
  const add = (id, label, ready, message) => checks.push({ id, label, ready: ready === true, message });
  const entries = context.evidenceSet?.payload?.entries || [];
  add("evidence", "Approved evidence", entries.length > 0,
    entries.length ? `Evidence Set v${context.evidenceSet.payload.version} selected.` : "Approve an Evidence Set.");
  const unresolved = context.inputs.filter((item) => item.inputKind === "unknown" && !["resolved", "retired"].includes(item.state));
  add("inputs", "Resolved required inputs", unresolved.length === 0,
    unresolved.length ? `${unresolved.length} unresolved unknown input(s).` : "No unresolved required unknowns.");
  const includeAnalysis = context.draft?.payload?.codeMemo?.includeAnalysis !== false;
  const analysisCurrent = !includeAnalysis || (
    context.analysis && context.analysis.payload.dependencyHash === context.dependencyHash
  );
  add("analysis", "Current selected analysis", analysisCurrent,
    !includeAnalysis ? "The memo does not rely on AI analysis." : analysisCurrent ? "Selected analysis is current." : "Selected analysis is missing or stale.");
  const conclusionBoundToCurrentInputs = Boolean(context.conclusion && context.evidenceSet &&
    Number(context.conclusion.payload.definitionRevision) === Number(context.question.payload.definitionRevision) &&
    context.conclusion.payload.definitionHash === context.definitionHash &&
    context.conclusion.payload.inputSetHash === context.inputSetHash &&
    context.conclusion.payload.evidenceSetID === context.evidenceSet.envelope.id &&
    Number(context.conclusion.payload.evidenceSetVersion) === Number(context.evidenceSet.payload.version) &&
    context.conclusion.payload.evidenceSetHash === context.evidenceSet.payload.contentHash
  );
  const conclusionCurrent = Boolean(conclusionBoundToCurrentInputs && context.draft &&
    context.draft.payload.codeMemo?.conclusionID === context.conclusion.envelope.id &&
    Number(context.draft.payload.codeMemo?.conclusionRevision) === Number(context.conclusion.payload.revision) &&
    context.draft.payload.codeMemo?.conclusionHash === context.conclusionHash
  );
  add("conclusion", "Current professional conclusion", conclusionCurrent,
    conclusionCurrent ? `Professional Conclusion r${context.conclusion.payload.revision}.` : "Prepare a draft from the current conclusion revision.");
  const allowedSnapshots = new Set(entries.map((entry) => entry.snapshotID));
  const citations = context.conclusion?.payload?.citations || [];
  const citationsValid = citations.length > 0 && citations.every((id) => allowedSnapshots.has(id));
  add("citations", "Approved-evidence citations", citationsValid,
    citationsValid ? `${citations.length} citation(s) resolved.` : "Every conclusion citation must resolve to approved evidence.");
  const blockerIDs = blockingReviewRequestIDs(context.artifacts, context.question.envelope.id);
  add("review", "Blocking Review Requests", blockerIDs.length === 0,
    blockerIDs.length ? `${blockerIDs.length} blocking Review Request(s) remain.` : "No blocking Review Requests remain.");
  const approvalCurrent = Boolean(context.conclusionApproval &&
    context.conclusionApproval.payload.dependencyHash === (
      context.conclusion?.payload?.analysisDependencyHash || context.conclusion?.payload?.evidenceSetHash
    ));
  add("conclusion-approval", "Conclusion approval", approvalCurrent,
    approvalCurrent ? "The current conclusion approval resolves." : "Approve the current conclusion revision.");
  const missingSnapshots = entries.filter((entry) => !context.snapshots.has(entry.snapshotID));
  const sourceBlocked = entries.filter((entry) =>
    ["verification-blocked", "verification-required", "unavailable"].includes(entry.sourceVerificationState)
  );
  add("source-status", "Source status", entries.length > 0 && !missingSnapshots.length && !sourceBlocked.length,
    missingSnapshots.length ? "An immutable evidence snapshot is unavailable." : sourceBlocked.length ? "An approved source requires verification resolution." : "Approved source snapshots are available and qualified.");
  const draftBound = Boolean(context.draft &&
    Number(context.draft.payload.codeMemo?.definitionRevision) === Number(context.question.payload.definitionRevision) &&
    context.draft.payload.codeMemo?.definitionHash === context.definitionHash &&
    context.draft.payload.codeMemo?.inputSetHash === context.inputSetHash &&
    context.draft.payload.codeMemo?.evidenceSetID === context.evidenceSet?.envelope.id &&
    Number(context.draft.payload.codeMemo?.evidenceSetVersion) === Number(context.evidenceSet?.payload?.version) &&
    context.draft.payload.codeMemo?.evidenceSetHash === context.evidenceSet?.payload?.contentHash
  );
  add("draft-binding", "Exact selected versions", draftBound,
    draftBound ? "Draft hashes match current selected inputs and evidence." : "Prepare a new draft from the current selected versions.");
  return { ready: checks.every((check) => check.ready), checks, blockers: checks.filter((check) => !check.ready) };
}

function codeMemoDraftBlocks(context, narrative, includeAnalysis, researchAnswer) {
  const blocks = [
    { id: `${context.question.envelope.id}:question-heading`, kind: "heading", text: "Question presented" },
    { id: `${context.question.envelope.id}:question`, kind: "paragraph", text: context.question.payload.questionText },
    { id: `${context.question.envelope.id}:inputs-heading`, kind: "heading", text: "Project inputs" }
  ];
  if (context.inputs.length) {
    blocks.push({
      id: `${context.question.envelope.id}:inputs`, kind: "list",
      items: context.inputs.map((input) => `${input.inputKind} [${input.state}]: ${input.statement}`)
    });
  } else {
    blocks.push({ id: `${context.question.envelope.id}:inputs-empty`, kind: "paragraph", text: "No selected Project inputs." });
  }
  blocks.push({ id: `${context.question.envelope.id}:evidence-heading`, kind: "heading", text: "Approved evidence" });
  for (const entry of context.evidenceSet?.payload?.entries || []) {
    const snapshot = context.snapshots.get(entry.snapshotID);
    blocks.push({
      id: `${context.question.envelope.id}:evidence:${entry.snapshotID}`,
      kind: "evidence",
      sourceID: entry.snapshotID,
      label: `${snapshot?.payload?.passageLocator || entry.snapshotID} · ${entry.role}`
    });
  }
  if (includeAnalysis && researchAnswer) {
    blocks.push(
      { id: `${context.question.envelope.id}:analysis-heading`, kind: "heading", text: "Bounded analysis summary" },
      { id: `${context.question.envelope.id}:analysis`, kind: "paragraph", text: researchAnswer.answer?.conclusion || "No supported analysis conclusion was recorded." }
    );
  }
  blocks.push(
    { id: `${context.question.envelope.id}:conclusion-heading`, kind: "heading", text: "Professional conclusion" },
    { id: `${context.question.envelope.id}:conclusion`, kind: "paragraph", text: context.conclusion.payload.conclusionText }
  );
  if (context.conclusion.payload.reasoning) {
    blocks.push({ id: `${context.question.envelope.id}:reasoning`, kind: "paragraph", text: context.conclusion.payload.reasoning });
  }
  if (String(narrative || "").trim()) {
    blocks.push(
      { id: `${context.question.envelope.id}:narrative-heading`, kind: "heading", text: "Authored narrative" },
      { id: `${context.question.envelope.id}:narrative`, kind: "paragraph", text: String(narrative).trim() }
    );
  }
  return blocks;
}

async function handleCodeQuestionMemoPrepare(request, response) {
  const requestContext = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.memo.prepare")
  });
  if (!requestContext) return;
  try {
    const questionID = String(requestContext.body.questionID || "").trim();
    const context = await resolveServerCodeMemoContext(
      requestContext.storageOwnerUserID,
      questionID,
      null,
      requestContext.projectID
    );
    if (!context.evidenceSet || !context.conclusion) {
      throw new CodeQuestionCommandError("Prepare approved evidence and a professional conclusion before the Code Memo.", { status: 409 });
    }
    if (Number(context.conclusion.payload.definitionRevision) !== Number(context.question.payload.definitionRevision) ||
      context.conclusion.payload.definitionHash !== context.definitionHash ||
      context.conclusion.payload.inputSetHash !== context.inputSetHash ||
      context.conclusion.payload.evidenceSetID !== context.evidenceSet.envelope.id ||
      Number(context.conclusion.payload.evidenceSetVersion) !== Number(context.evidenceSet.payload.version) ||
      context.conclusion.payload.evidenceSetHash !== context.evidenceSet.payload.contentHash) {
      throw new CodeQuestionCommandError(
        "Publish a new professional conclusion for the current Definition, inputs, and Evidence Set.",
        { code: "CODE_QUESTION_VERSION_CONFLICT", status: 409 }
      );
    }
    const includeAnalysis = requestContext.body.includeAnalysis !== false;
    const researchAnswer = includeAnalysis && context.analysis
      ? (await listStoredResearchAnswers(requestContext.storageOwnerUserID)).find((item) => item.id === context.analysis.payload.researchAnswerID) || null
      : null;
    if (includeAnalysis && context.analysis && !researchAnswer) {
      throw new CodeQuestionCommandError("The selected immutable Research answer is unavailable.", { status: 409 });
    }
    const allocated = await allocateStoredCodeQuestionCounter(requestContext.storageOwnerUserID, "codeMemoDraftRevision", questionID);
    const now = new Date().toISOString();
    const draftID = String(requestContext.body.draftID || randomUUID());
    const payload = normalizeReportDraftPayloadV2({
      title: requestContext.body.title || `${context.question.payload.displayID} · ${context.question.payload.title}`,
      reportDate: now,
      introduction: String(requestContext.body.narrative || "").trim(),
      blocks: codeMemoDraftBlocks(context, requestContext.body.narrative, includeAnalysis, researchAnswer),
      createdBy: requestContext.actorUserID,
      updatedBy: requestContext.actorUserID,
      questionID,
      projectID: context.question.payload.projectID,
      draftRevision: allocated.value,
      codeMemo: {
        conclusionRevision: context.conclusion.payload.revision,
        evidenceSetVersion: context.evidenceSet.payload.version,
        definitionRevision: context.question.payload.definitionRevision,
        analysisRunID: includeAnalysis ? context.analysis?.envelope.id || null : null,
        readinessState: "draft",
        includeAnalysis,
        definitionHash: context.definitionHash,
        inputSetHash: context.inputSetHash,
        evidenceSetID: context.evidenceSet.envelope.id,
        evidenceSetHash: context.evidenceSet.payload.contentHash,
        conclusionID: context.conclusion.envelope.id,
        conclusionHash: context.conclusionHash,
        conclusionApprovalID: context.conclusionApproval?.envelope.id || null,
        correctionOfIssuedRecordID: requestContext.body.correctionOfIssuedRecordID || null
      }
    });
    const artifact = {
      envelope: artifactEnvelope({
        id: draftID, type: "reportDraft", owner: requestContext.owner,
        createdAt: now, updatedAt: now, version: 1
      }),
      payload
    };
    await saveStoredFoundationArtifactCompareAndSwap(requestContext.storageOwnerUserID, artifact, 0);
    await saveStoredProjectLink(requestContext.storageOwnerUserID, codeQuestionLinkForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      targetKind: "reportDraft",
      targetID: draftID,
      metadata: { questionID, recordType: "codeDecisionMemo", draftRevision: allocated.value }
    }));
    const activity = codeQuestionActivityForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      action: "code-question.memo.prepared",
      objectKind: "reportDraft",
      objectID: draftID,
      newStatus: "draft",
      metadata: { questionID, draftRevision: allocated.value, draftHash: payload.contentHash }
    });
    await saveStoredActivityEvent(requestContext.storageOwnerUserID, activity);
    sendJSON(response, 201, { draft: reportDraftForClient(artifact, [context.question.payload.projectID]), activity });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 400, { error: error.message || "Invalid Code Memo Draft.", code: "INVALID_CODE_MEMO_DRAFT" });
  }
}

async function handleCodeQuestionMemoReady(request, response) {
  const requestContext = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.memo.ready")
  });
  if (!requestContext) return;
  try {
    const questionID = String(requestContext.body.questionID || "").trim();
    const draftID = String(requestContext.body.draftID || "").trim();
    const context = await resolveServerCodeMemoContext(
      requestContext.storageOwnerUserID,
      questionID,
      draftID,
      requestContext.projectID
    );
    if (!context.draft) throw new CodeQuestionCommandError("Code Memo Draft not found.", { status: 404 });
    const readiness = serverCodeMemoReadiness(context);
    if (!readiness.ready) {
      sendJSON(response, 409, { error: "Code Memo readiness has blockers.", code: "CODE_MEMO_NOT_READY", readiness });
      return;
    }
    const artifact = codeQuestionArtifactForAccess(requestContext, createCodeMemoReadinessArtifact({
      userID: requestContext.actorUserID,
      questionID,
      draftID,
      draftRevision: context.draft.payload.draftRevision,
      draftHash: context.draft.payload.contentHash,
      checks: readiness.checks,
      id: requestContext.body.id || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(requestContext.storageOwnerUserID, artifact, 0);
    await saveStoredProjectLink(requestContext.storageOwnerUserID, codeQuestionLinkForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      targetKind: "codeMemoReadiness",
      targetID: artifact.envelope.id,
      metadata: { questionID, draftID }
    }));
    await saveStoredActivityEvent(requestContext.storageOwnerUserID, codeQuestionActivityForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      action: "code-question.memo.ready",
      objectKind: "codeMemoReadiness",
      objectID: artifact.envelope.id,
      newStatus: "ready-for-approval",
      metadata: { questionID, draftID, draftHash: context.draft.payload.contentHash }
    }));
    sendJSON(response, 201, { readiness: { id: artifact.envelope.id, ...artifact.payload } });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionMemoApprove(request, response) {
  const requestContext = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.memo.approve")
  });
  if (!requestContext) return;
  try {
    const questionID = String(requestContext.body.questionID || "").trim();
    const draftID = String(requestContext.body.draftID || "").trim();
    const context = await resolveServerCodeMemoContext(
      requestContext.storageOwnerUserID,
      questionID,
      draftID,
      requestContext.projectID
    );
    const readiness = serverCodeMemoReadiness(context);
    if (!context.draft || !context.readiness ||
      context.readiness.payload.draftHash !== context.draft.payload.contentHash || !readiness.ready) {
      sendJSON(response, 409, { error: "Mark the current Code Memo Draft ready before approval.", code: "CODE_MEMO_NOT_READY", readiness });
      return;
    }
    const artifact = codeQuestionArtifactForAccess(requestContext, createCodeMemoApprovalArtifact({
      userID: requestContext.actorUserID,
      questionID,
      draftID,
      draftRevision: context.draft.payload.draftRevision,
      draftHash: context.draft.payload.contentHash,
      conclusionID: context.conclusion.envelope.id,
      conclusionRevision: context.conclusion.payload.revision,
      conclusionHash: context.conclusionHash,
      approvalBasis: requestContext.body.approvalBasis,
      id: requestContext.body.id || randomUUID()
    }));
    await saveStoredFoundationArtifactCompareAndSwap(requestContext.storageOwnerUserID, artifact, 0);
    await saveStoredProjectLink(requestContext.storageOwnerUserID, codeQuestionLinkForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      targetKind: "codeMemoApproval",
      targetID: artifact.envelope.id,
      metadata: { questionID, draftID }
    }));
    await saveStoredActivityEvent(requestContext.storageOwnerUserID, codeQuestionActivityForAccess(requestContext, {
      projectID: context.question.payload.projectID,
      action: "code-question.memo.approved",
      objectKind: "codeMemoApproval",
      objectID: artifact.envelope.id,
      newStatus: "approved",
      metadata: { questionID, draftID, draftHash: context.draft.payload.contentHash }
    }));
    sendJSON(response, 201, { approval: { id: artifact.envelope.id, ...artifact.payload } });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 400, { error: error.message || "Invalid Code Memo approval.", code: "INVALID_CODE_MEMO_APPROVAL" });
  }
}

async function handleCodeQuestionIssueStart(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.issue.start")
  });
  if (!context) return;
  try {
    const questionID = String(context.body.questionID || "").trim();
    const draftID = String(context.body.draftID || "").trim();
    const idempotencyKey = String(context.body.idempotencyKey || "").trim();
    if (!draftID || !idempotencyKey) {
      sendError(response, 400, "Issuance requires a Code Memo Draft and idempotency key.");
      return;
    }
    const memoContext = await resolveServerCodeMemoContext(
      context.storageOwnerUserID,
      questionID,
      draftID,
      context.projectID
    );
    const readiness = serverCodeMemoReadiness(memoContext);
    if (!readiness.ready) {
      sendJSON(response, 409, {
        error: "Code Memo readiness changed before issuance.",
        code: "CODE_MEMO_NOT_READY",
        readiness
      });
      return;
    }
    if (!memoContext.memoApproval ||
      memoContext.memoApproval.payload.draftHash !== memoContext.draft.payload.contentHash ||
      memoContext.memoApproval.payload.conclusionHash !== memoContext.conclusionHash) {
      sendJSON(response, 409, {
        error: "Approve the current Code Memo Draft before issuance.",
        code: "CODE_MEMO_APPROVAL_REQUIRED"
      });
      return;
    }
    const pendingList = await listStoredCodeQuestionPendingIssuance(context.storageOwnerUserID);
    const existing = pendingList.find((item) =>
      item.idempotencyKey === idempotencyKey && item.questionID === questionID
    );
    if (existing) {
      const issuanceIntent = {
        questionID,
        draftID,
        draftHash: memoContext.draft.payload.contentHash,
        memoApprovalID: memoContext.memoApproval.envelope.id,
        predecessorID: memoContext.draft.payload.codeMemo?.correctionOfIssuedRecordID || null
      };
      const issuanceIntentKeys = [
        "questionID", "draftID", "draftHash", "memoApprovalID", "predecessorID"
      ];
      if (!codeQuestionIntentMatches(existing, issuanceIntent, issuanceIntentKeys)) {
        codeQuestionIdempotencyConflict(
          "This issuance idempotency key was already used for a different approved draft.",
          { idempotencyKey, pendingID: existing.id }
        );
      }
      const recovered = existing.status === "failed"
        ? advanceIssuanceSaga(existing, "reserved", { error: null })
        : existing;
      if (recovered !== existing) await saveStoredCodeQuestionPendingIssuance(context.storageOwnerUserID, recovered);
      sendJSON(response, 200, { pending: recovered, replayed: true, recovered: recovered !== existing });
      return;
    }
    const deterministicHash = createHash("sha256")
      .update(`${context.storageOwnerUserID}:${questionID}:${idempotencyKey}`)
      .digest("hex");
    const reservation = await reserveStoredCodeQuestionIssuance(context.storageOwnerUserID, {
      id: `cq-pending-${deterministicHash}`,
      questionID,
      idempotencyKey,
      actorUserID: context.actorUserID,
      stagedPrefix: `staged/code-question/${safeWorkboardPathHash(questionID)}/`,
      deterministicHash,
      draftID,
      draftHash: memoContext.draft.payload.contentHash,
      memoApprovalID: memoContext.memoApproval.envelope.id,
      predecessorID: memoContext.draft.payload.codeMemo?.correctionOfIssuedRecordID || null,
      manifestID: `cq-manifest-${deterministicHash}`,
      issuedRecordID: `cq-issued-${deterministicHash}`,
      status: "reserved"
    });
    sendJSON(response, reservation.replayed ? 200 : 201, reservation);
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

function codeMemoManifestItems(memoContext) {
  return (memoContext.draft.payload.blocks || []).map((block) => {
    if (["heading", "paragraph", "list"].includes(block.kind)) return block;
    if (block.kind !== "evidence") {
      throw new CodeQuestionCommandError("Code Memo Draft contains an unsupported source block.", { status: 409 });
    }
    const snapshot = memoContext.snapshots.get(block.sourceID)?.payload;
    if (!snapshot) {
      throw new CodeQuestionCommandError("An approved evidence snapshot is unavailable.", { status: 409 });
    }
    return {
      id: block.id,
      kind: "evidence",
      sectionID: snapshot.id,
      sectionNumber: snapshot.passageLocator,
      codeBook: snapshot.sourceIdentity || "Approved source",
      chapter: "Code Question evidence",
      title: snapshot.passageLocator,
      passageText: snapshot.quotedText,
      passageTextHash: snapshot.textHash,
      sourceLibraryVersion: snapshot.sourceVersion || "evidence-snapshot-v2"
    };
  });
}

async function handleCodeQuestionIssueComplete(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.issue.complete")
  });
  if (!context) return;
  let pendingForFailure = null;
  try {
    const pendingID = String(context.body.pendingID || "").trim();
    const pendingList = await listStoredCodeQuestionPendingIssuance(context.storageOwnerUserID);
    const pending = pendingList.find((item) => item.id === pendingID);
    if (!pending) {
      sendError(response, 404, "Pending issuance not found.");
      return;
    }
    pendingForFailure = pending;
    if (pending.status === "issued") {
      const replay = (await listStoredFoundationArtifacts(context.storageOwnerUserID)).find((item) =>
        item.envelope?.type === "issuedDecisionRecord" && item.envelope.id === pending.issuedRecordID
      );
      sendJSON(response, 200, {
        pending,
        issuedRecord: replay ? { id: replay.envelope.id, version: replay.envelope.version, ...replay.payload } : null,
        replayed: true
      });
      return;
    }
    if (pending.status !== "reserved") {
      sendJSON(response, 409, {
        error: "Issuance is not in a recoverable reserved state.",
        code: "ISSUANCE_SAGA_INVALID_TRANSITION",
        pending
      });
      return;
    }
    const memoContext = await resolveServerCodeMemoContext(
      context.storageOwnerUserID,
      pending.questionID,
      pending.draftID,
      context.projectID
    );
    const readiness = serverCodeMemoReadiness(memoContext);
    if (!readiness.ready ||
      !memoContext.memoApproval ||
      memoContext.memoApproval.envelope.id !== pending.memoApprovalID ||
      memoContext.memoApproval.payload.draftHash !== pending.draftHash) {
      sendJSON(response, 409, {
        error: "Issuance dependencies or approval changed before commit.",
        code: "CODE_MEMO_NOT_READY",
        readiness
      });
      return;
    }
    const predecessor = pending.predecessorID
      ? memoContext.artifacts.find((item) =>
          item.envelope?.type === "issuedDecisionRecord" &&
          item.envelope.id === pending.predecessorID &&
          item.payload?.questionID === pending.questionID
        ) || null
      : null;
    if (pending.predecessorID && !predecessor) {
      throw new CodeQuestionCommandError("The correction predecessor could not be resolved.", { status: 409 });
    }
    if (!privateProjectAssetStorageConfigured()) {
      sendError(response, 503, "Private Code Memo output storage is not configured.");
      return;
    }
    let advanced = advanceIssuanceSaga(pending, "staged", {
      stagedObjectKey: pending.stagedObjectKey
    });
    await saveStoredCodeQuestionPendingIssuance(context.storageOwnerUserID, advanced);
    const project = await ownedProjectRecord(context.storageOwnerUserID, memoContext.question.payload.projectID);
    if (!project) throw new CodeQuestionCommandError("Project not found.", { status: 404 });
    const now = pending.createdAt;
    const manifestID = pending.manifestID;
    const manifest = immutableReportManifestV3({
      id: manifestID,
      project: {
        id: memoContext.question.payload.projectID,
        name: project.name || "Untitled Project",
        address: project.address || "",
        description: project.description || ""
      },
      draftID: memoContext.draft.envelope.id,
      title: memoContext.draft.payload.title,
      reportDate: now,
      author: {
        userID: context.actorUserID,
        displayName: context.authContext.account?.displayName ||
          context.authContext.account?.publicUsername || "Permitext professional"
      },
      codeEdition: defaultResearchCodeEdition,
      items: codeMemoManifestItems(memoContext),
      disclaimers: [
        ...permitextRequiredReportDisclaimers,
        "Permitext Issued Record — professional work product; not agency approval or a compliance certificate."
      ],
      reportVersion: pending.issueVersion,
      sourceVersions: {
        codeEdition: defaultResearchCodeEdition,
        codeContent: defaultSyncCodeVersion,
        draftVersion: memoContext.draft.envelope.version,
        draftRevision: memoContext.draft.payload.draftRevision
      },
      createdAt: now,
      questionSnapshot: {
        questionID: memoContext.question.envelope.id,
        displayID: memoContext.question.payload.displayID,
        title: memoContext.question.payload.title,
        questionText: memoContext.question.payload.questionText,
        definitionRevision: memoContext.question.payload.definitionRevision,
        definitionHash: memoContext.definitionHash
      },
      evidenceSetIdentity: {
        evidenceSetID: memoContext.evidenceSet.envelope.id,
        version: memoContext.evidenceSet.payload.version,
        contentHash: memoContext.evidenceSet.payload.contentHash
      },
      conclusionRevision: memoContext.conclusion.payload.revision,
      approval: {
        actorUserID: memoContext.conclusionApproval.payload.approvedByUserID,
        approvedAt: memoContext.conclusionApproval.payload.approvedAt,
        basis: memoContext.conclusionApproval.payload.approvalBasis
      },
      issueLineage: {
        issueVersion: pending.issueVersion,
        predecessorID: pending.predecessorID || null,
        successorID: null
      },
      evidenceRoles: memoContext.evidenceSet.payload.entries.map((entry) => ({
        snapshotID: entry.snapshotID,
        role: entry.role,
        analysisEligible: entry.analysisEligible,
        qualification: entry.qualification,
        projectApplicabilityNote: entry.projectApplicabilityNote
      })),
      inputSnapshots: memoContext.inputs.map((input) => ({
        id: input.id,
        inputKind: input.inputKind,
        state: input.state,
        statement: input.statement,
        revision: input.revision
      })),
      analysisIdentity: memoContext.analysis ? {
        analysisRunID: memoContext.analysis.envelope.id,
        dependencyHash: memoContext.analysis.payload.dependencyHash,
        researchAnswerID: memoContext.analysis.payload.researchAnswerID
      } : null,
      conclusionIdentity: {
        conclusionID: memoContext.conclusion.envelope.id,
        revision: memoContext.conclusion.payload.revision,
        contentHash: memoContext.conclusionHash
      },
      memoApproval: {
        approvalID: memoContext.memoApproval.envelope.id,
        actorUserID: memoContext.memoApproval.payload.approvedByUserID,
        approvedAt: memoContext.memoApproval.payload.approvedAt,
        basis: memoContext.memoApproval.payload.approvalBasis,
        draftHash: memoContext.memoApproval.payload.draftHash
      }
    });
    const pdfBody = await renderReportPDFOnDemand(manifest);
    const htmlBody = Buffer.from(codeMemoHTML(manifest), "utf8");
    const structuredBody = Buffer.from(codeMemoStructuredJSON(manifest), "utf8");
    if (!pdfBody.length || pdfBody.length > maxReportFileBytes) {
      throw new Error("The generated Code Memo PDF exceeds the supported file size.");
    }
    const outputBodies = [
      { format: "pdf", contentType: "application/pdf", body: pdfBody },
      { format: "html", contentType: "text/html; charset=utf-8", body: htmlBody },
      { format: "structured", contentType: "application/json; charset=utf-8", body: structuredBody }
    ];
    const outputs = [];
    for (const output of outputBodies) {
      const pathname = codeMemoFilePathname(
        memoContext.question.payload.projectID,
        manifestID,
        output.format
      );
      await storeOrVerifyPrivateProjectAsset(pathname, output.body, output.contentType);
      outputs.push({
        format: output.format,
        pathname,
        contentType: output.contentType,
        size: output.body.length,
        contentHash: createHash("sha256").update(output.body).digest("hex")
      });
    }
    advanced = advanceIssuanceSaga(advanced, "committing");
    await saveStoredCodeQuestionPendingIssuance(context.storageOwnerUserID, advanced);
    const issued = codeQuestionArtifactForAccess(context, createIssuedRecordArtifact({
      userID: context.actorUserID,
      questionID: pending.questionID,
      issueVersion: pending.issueVersion,
      reportManifestID: manifestID,
      componentVersions: {
        definitionRevision: memoContext.question.payload.definitionRevision,
        inputRevisions: Object.fromEntries(memoContext.inputs.map((input) => [input.id, input.revision])),
        evidenceSetVersion: memoContext.evidenceSet.payload.version,
        conclusionRevision: memoContext.conclusion.payload.revision,
        draftRevision: memoContext.draft.payload.draftRevision
      },
      componentHashes: {
        definition: memoContext.definitionHash,
        inputs: memoContext.inputSetHash,
        evidenceSet: memoContext.evidenceSet.payload.contentHash,
        analysis: memoContext.analysis?.payload?.dependencyHash || null,
        conclusion: memoContext.conclusionHash,
        draft: memoContext.draft.payload.contentHash,
        manifest: manifest.contentHash,
        outputs: Object.fromEntries(outputs.map((output) => [output.format, output.contentHash]))
      },
      approvalBasis: memoContext.memoApproval.payload.approvalBasis,
      predecessorID: pending.predecessorID || null,
      id: pending.issuedRecordID,
      issuedAt: now
    }));
    const manifestArtifact = {
      envelope: artifactEnvelope({
        id: manifestID,
        type: "reportManifest",
        owner: context.owner,
        createdAt: now,
        updatedAt: now,
        version: 1
      }),
      payload: manifest
    };
    const generatedReportID = `cq-output-${createHash("sha256").update(manifestID).digest("hex")}`;
    const generatedReportArtifact = {
      envelope: artifactEnvelope({
        id: generatedReportID,
        type: "generatedReport",
        owner: context.owner,
        createdAt: now,
        updatedAt: now,
        version: 1
      }),
      payload: {
        manifestID,
        reportVersion: pending.issueVersion,
        title: manifest.title,
        outputFormats: outputs.map((output) => output.format),
        contentHash: manifest.contentHash,
        generatorVersion: manifest.generatorVersion,
        files: outputs,
        createdBy: context.actorUserID,
        createdAt: now
      }
    };
    const links = [
      ["reportManifest", manifestID, { questionID: pending.questionID, issueVersion: pending.issueVersion }],
      ["generatedReport", generatedReportID, { questionID: pending.questionID, manifestID }],
      ["issuedDecisionRecord", issued.envelope.id, { questionID: pending.questionID, manifestID }]
    ].map(([targetKind, targetID, metadata]) => codeQuestionLinkForAccess(context, {
        projectID: memoContext.question.payload.projectID,
        targetKind,
        targetID,
        metadata
      }));
    const events = [codeQuestionActivityForAccess(context, {
      projectID: memoContext.question.payload.projectID,
      action: "code-question.record.issued",
      objectKind: "issuedDecisionRecord",
      objectID: issued.envelope.id,
      newStatus: "issued",
      metadata: { manifestID, issueVersion: pending.issueVersion, outputHashes: issued.payload.componentHashes.outputs }
    })];
    if (pending.predecessorID) {
      events.push(codeQuestionActivityForAccess(context, {
        projectID: memoContext.question.payload.projectID,
        action: "code-question.record.superseded",
        objectKind: "issuedDecisionRecord",
        objectID: predecessor.envelope.id,
        previousStatus: "issued",
        newStatus: "superseded",
        metadata: {
          successorID: issued.envelope.id,
          reason: String(context.body.supersessionReason || "Corrected by a later issued version.")
        }
      }));
    }
    advanced = advanceIssuanceSaga(advanced, "issued");
    await commitStoredCodeQuestionIssuance(context.storageOwnerUserID, {
      artifacts: [manifestArtifact, generatedReportArtifact, issued],
      links,
      events,
      pending: advanced
    });
    sendJSON(response, 201, {
      pending: advanced,
      manifest,
      outputs: outputs.map(({ pathname: _pathname, ...output }) => output),
      issuedRecord: { id: issued.envelope.id, version: issued.envelope.version, ...issued.payload }
    });
  } catch (error) {
    if (pendingForFailure && ["reserved", "staged", "committing"].includes(pendingForFailure.status)) {
      try {
        const currentPending = (await listStoredCodeQuestionPendingIssuance(context.storageOwnerUserID))
          .find((item) => item.id === pendingForFailure.id) || pendingForFailure;
        if (["reserved", "staged", "committing"].includes(currentPending.status)) {
          await saveStoredCodeQuestionPendingIssuance(context.storageOwnerUserID, advanceIssuanceSaga(currentPending, "failed", {
            error: String(error?.message || "Issuance failed.")
          }));
        }
      } catch (recoveryError) {
        console.error("Code Question issuance recovery could not persist failure state.", recoveryError);
      }
    }
    if (sendCodeQuestionError(response, error)) return;
    sendJSON(response, 500, {
      error: "Code Memo issuance failed. The approved draft remains unissued and can be retried.",
      code: "CODE_MEMO_ISSUANCE_FAILED"
    });
  }
}

async function handleCodeQuestionIssuedFileRead(request, response) {
  const context = await requireCodeQuestionContext(request, response);
  if (!context) return;
  const issuedRecordID = String(context.body.issuedRecordID || "").trim();
  const format = String(context.body.format || "pdf").trim();
  if (!issuedRecordID || !["pdf", "html", "structured"].includes(format)) {
    sendError(response, 400, "Missing or invalid Issued Record output identity.");
    return;
  }
  const artifacts = await listStoredFoundationArtifacts(context.storageOwnerUserID);
  const issued = artifacts.find((item) =>
    item.envelope?.type === "issuedDecisionRecord" && item.envelope.id === issuedRecordID
  );
  const question = artifacts.find((item) =>
    item.envelope?.type === "codeQuestion" && item.envelope.id === issued?.payload?.questionID
  );
  const generated = artifacts.find((item) =>
    item.envelope?.type === "generatedReport" &&
    item.payload?.manifestID === issued?.payload?.reportManifestID
  );
  const file = generated?.payload?.files?.find((item) => item.format === format);
  if (!issued || !question || question.payload?.projectID !== context.projectID || !file?.pathname ||
    !file.pathname.startsWith(reportFilePrefix(question.payload.projectID))) {
    sendError(response, 404, "Issued Record output not found.");
    return;
  }
  const body = await readPrivateProjectAsset(file.pathname);
  if (!body) {
    sendError(response, 404, "Issued Record output not found.");
    return;
  }
  if (createHash("sha256").update(body).digest("hex") !== file.contentHash) {
    sendError(response, 409, "The stored Issued Record output no longer matches its immutable hash.");
    return;
  }
  const extension = format === "structured" ? "json" : format;
  const safeTitle = String(generated.payload.title || "Permitext Code Memo")
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "Permitext-Code-Memo";
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "private, no-store",
    "content-type": file.contentType,
    "content-length": String(body.length),
    "content-disposition": `attachment; filename="${safeTitle}-v${issued.payload.issueVersion}.${extension}"`
  });
  response.end(body);
}

async function handleCodeQuestionIssueFail(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.issue.fail")
  });
  if (!context) return;
  try {
    const pendingID = String(context.body.pendingID || "").trim();
    const pendingList = await listStoredCodeQuestionPendingIssuance(context.storageOwnerUserID);
    const pending = pendingList.find((item) => item.id === pendingID);
    if (!pending) {
      sendError(response, 404, "Pending issuance not found.");
      return;
    }
    const failed = advanceIssuanceSaga(pending, "failed", {
      error: String(context.body.error || "Issuance failed.")
    });
    await saveStoredCodeQuestionPendingIssuance(context.storageOwnerUserID, failed);
    sendJSON(response, 200, { pending: failed });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionOutboxEnqueue(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.create")
  });
  if (!context) return;
  try {
    const entry = createQuestionOutboxEntry({
      commandKind: context.body.commandKind,
      payload: context.body.payload,
      idempotencyKey: context.body.idempotencyKey
    });
    await saveStoredCodeQuestionOutboxEntry(context.storageOwnerUserID, entry);
    sendJSON(response, 201, { entry });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

async function handleCodeQuestionMigrationRun(request, response) {
  const context = await requireCodeQuestionContext(request, response, {
    permission: permissionForCommand("codeQuestion.migration.run")
  });
  if (!context) return;
  try {
    const checkpointName = `${codeQuestionMigrationCheckpointName}:${context.projectID}`;
    const previous = await storedMigrationCheckpoint(
      context.storageOwnerUserID,
      checkpointName
    );
    const result = runCodeQuestionBootstrapMigration({ previousCheckpoint: previous });
    await saveStoredMigrationCheckpoint(context.storageOwnerUserID, checkpointName, result);
    sendJSON(response, 200, { migration: result });
  } catch (error) {
    if (sendCodeQuestionError(response, error)) return;
    throw error;
  }
}

const handlers = {
  "account/sign-in": handleSignIn,
  "account/sign-out": handleSignOut,
  "account/delete": handleAccountDelete,
  "account/apple/start": handleAppleWebStart,
  "account/attach-local-data": handleAttachLocalData,
  "account/link-browser": handleBrowserAccountLink,
  "account/profile": handleProfileUpdate,
  "account/passkeys/link": handlePasskeyLink,
  "billing/web/checkout": handleWebCheckout,
  "billing/web/portal": handleWebPortal,
  "billing/stripe/restore": handleStripeRestore,
  "billing/stripe/webhook": handleStripeWebhook,
  "billing/apple/transactions/verify": handleAppleTransactionVerify,
  "research/interpret": handleResearchInterpretation,
  "research/conversations/list": handleResearchConversationList,
  "research/conversations/get": handleResearchConversationGet,
  "research/conversations/rename": handleResearchConversationRename,
  "research/conversations/create": handleResearchConversationCreate,
  "research/conversations/evidence": handleResearchConversationEvidence,
  "research/conversations/refresh": handleResearchConversationRefresh,
  "research/conversations/message": handleResearchConversationMessage,
  "research/conversations/assign-project": handleResearchConversationAssignProject,
  "research/conversations/project-context": handleResearchConversationProjectContext,
  "research/conversations/reuse-evidence": handleResearchConversationReuseEvidence,
  "research/conversations/delete": handleResearchConversationDelete,
  "research/conversations/clear-history": handleResearchConversationClearHistory,
  "research/answers/list": handleResearchAnswerList,
  "research/answers/get": handleResearchAnswerGet,
  "research/usage": handleResearchUsage,
  "research/feedback": handleResearchFeedback,
  "research/evidence/discover": handleResearchEvidenceDiscover,
  "research/conversations/candidate-disposition": handleResearchCandidateDisposition,
  "projects/foundation/state": handleProjectFoundationState,
  "projects/hub/bootstrap": handleProjectHubBootstrap,
  "projects/artifacts/checkpoint": handleProjectArtifactCheckpoint,
  "projects/foundation/link": handleProjectFoundationLink,
  "projects/foundation/unlink": handleProjectFoundationUnlink,
  // Code Question routes (Phase 1): gated by permitext:codeQuestionWorkspace (default off).
  "projects/code-questions/state": handleCodeQuestionState,
  "projects/code-questions/list": handleCodeQuestionList,
  "projects/code-questions/legacy/list": handleCodeQuestionLegacyList,
  "projects/code-questions/legacy/promote": handleCodeQuestionLegacyPromote,
  "projects/code-questions/legacy/unlink": handleCodeQuestionLegacyUnlink,
  "projects/code-questions/create": handleCodeQuestionCreate,
  "projects/code-questions/research/start": handleCodeQuestionResearchStart,
  "projects/code-questions/research/link": handleCodeQuestionResearchLink,
  "projects/code-questions/definition/save": handleCodeQuestionDefinitionSave,
  "projects/code-questions/archive": handleCodeQuestionArchive,
  "projects/code-questions/restore": handleCodeQuestionRestore,
  "projects/code-questions/inputs/save": handleCodeQuestionInputSave,
  "projects/code-questions/evidence/snapshot": handleCodeQuestionEvidenceSnapshot,
  "projects/code-questions/evidence/approve-set": handleCodeQuestionEvidenceSetCreate,
  "projects/code-questions/analysis/create": handleCodeQuestionAnalysisCreate,
  "projects/code-questions/conclusions/publish": handleCodeQuestionConclusionPublish,
  "projects/code-questions/conclusions/approve": handleCodeQuestionConclusionApprove,
  "projects/code-questions/memos/prepare": handleCodeQuestionMemoPrepare,
  "projects/code-questions/memos/ready": handleCodeQuestionMemoReady,
  "projects/code-questions/memos/approve": handleCodeQuestionMemoApprove,
  "projects/code-questions/issue/start": handleCodeQuestionIssueStart,
  "projects/code-questions/issue/complete": handleCodeQuestionIssueComplete,
  "projects/code-questions/issue/fail": handleCodeQuestionIssueFail,
  "projects/code-questions/records/file": handleCodeQuestionIssuedFileRead,
  "projects/code-questions/outbox/enqueue": handleCodeQuestionOutboxEnqueue,
  "projects/code-questions/migration/run": handleCodeQuestionMigrationRun,
  "projects/collaboration/notes/save": handleProjectCollaborationNoteSave,
  "projects/collaboration/threads/save": handleProjectCollaborationThreadSave,
  "projects/collaboration/comments/save": handleProjectCollaborationCommentSave,
  "organizations/list": handleOrganizationList,
  "organizations/create": handleOrganizationCreate,
  "organizations/update": handleOrganizationUpdate,
  "organizations/delete": handleOrganizationDelete,
  "organizations/controls/save": handleOrganizationControlsSave,
  "organizations/members/list": handleOrganizationMemberList,
  "organizations/members/invite": handleOrganizationMemberInvite,
  "organizations/members/update": handleOrganizationMemberUpdate,
  "organizations/invitations/accept": handleOrganizationInvitationAccept,
  "organizations/invitations/revoke": handleOrganizationInvitationRevoke,
  "organizations/projects/transfer": handleOrganizationProjectTransfer,
  "organizations/projects/list": handleOrganizationProjectList,
  "organizations/projects/snapshot": handleOrganizationProjectSnapshot,
  "organizations/evidence/reviews/list": handleOrganizationEvidenceReviewList,
  "organizations/evidence/reviews/save": handleOrganizationEvidenceReviewSave,
  "notebook/cards/list": handleNotebookCardList,
  "notebook/cards/get": handleNotebookCardGet,
  "notebook/cards/save": handleNotebookCardSave,
  "notebook/cards/archive": handleNotebookCardArchive,
  "notebook/cards/delete": handleNotebookCardDelete,
  "notebook/assets/upload": handleNotebookAssetUpload,
  "notebook/assets/read": handleNotebookAssetRead,
  "notebook/assets/delete": handleNotebookAssetDelete,
  "reports/sources/list": handleReportSourceList,
  "reports/options": handleReportOptions,
  "reports/drafts/list": handleReportDraftList,
  "reports/drafts/get": handleReportDraftGet,
  "reports/drafts/save": handleReportDraftSave,
  "reports/drafts/delete": handleReportDraftDelete,
  "reports/generate": handleReportGenerate,
  "reports/history/list": handleReportHistoryList,
  "reports/manifests/get": handleReportManifestGet,
  "reports/files/upload": handleReportFileUpload,
  "reports/files/read": handleReportFileRead,
  "internal/evaluations/data": handleInternalEvaluationData,
  "internal/evaluations/review": handleInternalEvaluationReview,
  "internal/evaluations/feedback/triage": handleInternalFeedbackTriage,
  // Legacy authenticated compatibility only. No current client exposes these writers.
  "workboards/assets/upload": handleWorkboardAssetUpload,
  "workboards/assets/read": handleWorkboardAssetRead,
  "workboards/assets/delete": handleWorkboardAssetDelete,
  "workboards/previews/upload": handleWorkboardPreviewUpload,
  "workboards/previews/read": handleWorkboardPreviewRead,
  "workboards/previews/clear": handleWorkboardPreviewClear,
  "sync/push": handlePush,
  "sync/checkpoint": handleSyncCheckpoint,
  "sync/pull": handlePull,
  "admin/lifetime-grants/grant": handleLifetimeGrant,
  "admin/lifetime-grants/revoke": handleLifetimeGrantDelete,
  "admin/accounts/delete-legacy-passkey-users": handleLegacyPasskeyAccountDelete,
  "admin/accounts/restore-checklist": handleRestoreChecklist,
  "admin/accounts/export": handleAccountExport,
  "admin/storage/summary": handleStorageSummary
};

async function handleRequestUnlocked(request, response) {
  try {
    const path = normalizePath(request.url);
    if (!await enforceRateLimit(request, response, path)) {
      return;
    }

    if (
      request.method === "GET" &&
      (
        path === "" ||
        path === "web" ||
        path === "web/" ||
        path.startsWith("open/section/")
      )
    ) {
      await handleWebIndex(request, response);
      return;
    }
    if (request.method === "GET" && (path === "privacy" || path === "privacy/")) {
      await handlePrivacyPolicy(request, response);
      return;
    }
    if (request.method === "GET" && (path === "internal" || path === "internal/" || path.startsWith("internal/"))) {
      await handleInternalStatic(request, path, response);
      return;
    }
    if (request.method === "GET" && (path === "admin" || path === "admin/")) {
      await handleInternalStatic(request, "internal", response);
      return;
    }
    if (request.method === "GET" && path === "service-worker.js") {
      await handleServiceWorker(response);
      return;
    }
    if (request.method === "GET" && path.startsWith("web/")) {
      await handleWebStatic(path, response);
      return;
    }
    if (request.method === "GET" && path.startsWith("code/assets/")) {
      await handleCodeAsset(path, response);
      return;
    }
    if (request.method === "GET" && path === "code/libraries") {
      await handleCodeLibraries(request, response);
      return;
    }
    if (request.method === "GET" && path === "code/chapters") {
      await handleCodeChapters(request, response);
      return;
    }
    if (request.method === "GET" && path.startsWith("code/chapters/")) {
      await handleCodeChapter(request, path, response);
      return;
    }
    if (request.method === "GET" && path === "code/sections") {
      await handleCodeSections(request, response);
      return;
    }
    if (request.method === "GET" && path.startsWith("code/sections/")) {
      await handleCodeSection(path, response);
      return;
    }
    if (request.method === "GET" && path === "code/search") {
      await handleCodeSearch(request, response);
      return;
    }
    if (request.method === "GET" && path === "health") {
      const adapter = await storeAdapter();
      if (typeof adapter.initialize === "function") {
        await adapter.initialize();
      }
      sendJSON(response, 200, {
        ok: true,
        storage: await storageKind(),
        schema: await storageSchema(),
        rateLimit: adapter.rateLimitMode
      });
      return;
    }
    if (request.method === "GET" && path === "admin/storage/summary") {
      await handleStorageSummary(request, response);
      return;
    }
    if (request.method === "GET" && path === "admin/accounts/grant-summaries") {
      await handleGrantAccountSummaries(request, response);
      return;
    }
    if (request.method === "GET" && path === "account/apple-web-config") {
      handleAppleWebConfig(request, response);
      return;
    }
    if ((request.method === "GET" || request.method === "POST") && path === "account/apple/callback") {
      await handleAppleWebCallback(request, response);
      return;
    }
    if (request.method === "GET" && path === ".well-known/apple-app-site-association") {
      handleAppleAppSiteAssociation(request, response);
      return;
    }
    const isAccountDelete = request.method === "DELETE" && path === "account/delete";
    if (request.method !== "POST" && !isAccountDelete) {
      sendError(response, 405, "Method not allowed.");
      return;
    }

    const handler = handlers[path];
    if (!handler) {
      sendError(response, 404, "Not found.");
      return;
    }
    await handler(request, response);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      sendError(response, 413, "Request body is too large.");
      return;
    }
    if (error instanceof SyntaxError) {
      sendError(response, 400, "Invalid JSON.");
      return;
    }
    console.error(error);
    sendError(response, 500, "Internal server error.");
  }
}

function requestMutatesFileStore(request) {
  if (databaseURL) return false;
  const path = normalizePath(request.url);
  if (process.env.PERMITEXT_TEST_CONCURRENT_CODE_QUESTION_ANALYSIS === "1" &&
    request.method === "POST" &&
    path === "projects/code-questions/analysis/create") {
    return false;
  }
  // Long-running external I/O must not hold the process-wide store lock for the whole
  // handler. Adapter-level withMutation() still serializes short JSON RMW sections.
  if (
    path === "projects/artifacts/checkpoint" ||
    path === "research/interpret" ||
    path === "research/conversations/message" ||
    path === "research/conversations/refresh" ||
    path === "research/conversations/evidence" ||
    path === "research/evidence/discover" ||
    path === "billing/stripe/webhook" ||
    path === "billing/web/checkout" ||
    path === "billing/web/portal" ||
    path === "billing/apple/transactions/verify"
  ) {
    return false;
  }
  if (request.method === "POST" || request.method === "DELETE") return true;
  return request.method === "GET" && path === "account/apple/callback";
}

function requestTelemetryRoute(path) {
  if (!path) return "root";
  if (path === ".well-known/apple-app-site-association") return "apple-app-site-association";
  if (path === "health") return "health";
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "code" && segments[1]) return `code/${segments[1]}`;
  if (segments[0] === "research" && segments[1]) return `research/${segments[1]}`;
  if (segments[0] === "sync" && segments[1]) return `sync/${segments[1]}`;
  return segments[0] || "unknown";
}

function observeVercelRequest(request, response) {
  if (!process.env.VERCEL || typeof response?.once !== "function") return;
  const startedAt = performance.now();
  const route = requestTelemetryRoute(normalizePath(request.url));
  response.once("finish", () => {
    const durationMilliseconds = Math.round(performance.now() - startedAt);
    const statusCode = Number(response.statusCode || 0);
    if (durationMilliseconds < 250 && statusCode < 500) return;
    console.info(JSON.stringify({
      event: "dynamic_route_timing",
      route,
      method: String(request.method || "GET").toUpperCase(),
      statusCode,
      durationMilliseconds
    }));
  });
}

export async function handleRequest(request, response) {
  observeVercelRequest(request, response);
  if (!requestMutatesFileStore(request)) {
    await handleRequestUnlocked(request, response);
    return;
  }
  try {
    await withFileStoreLock(dataPath, () => handleRequestUnlocked(request, response));
  } catch (error) {
    if (error?.code === "FILE_STORE_LOCK_TIMEOUT") {
      sendError(response, 503, "Local data storage is busy. Please retry.");
      return;
    }
    console.error(error);
    if (!response.headersSent) {
      sendError(response, 500, "Internal server error.");
    }
  }
}
