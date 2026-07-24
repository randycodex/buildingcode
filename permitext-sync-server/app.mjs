import {
  X509Certificate,
  createHash,
  createHmac,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature
} from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPostgresAccountRepository } from "./postgres-account-repository.mjs";
import { createPostgresSyncRepository } from "./postgres-sync-repository.mjs";
import { inlineCodeReferencePhrases } from "./public/code-references.js";
import { syncProjectIdentity } from "./public/sync-identity.js";
import {
  estimatedResearchCost,
  reserveResearchEvaluationSpend,
  researchModelConfiguration
} from "./research-config.mjs";
import { validateEvaluationDataset } from "./evals/evaluation-schema.mjs";
import { evaluationRunReviewStatus } from "./evals/evaluation-governance.mjs";

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
const evaluationResultsPath = join(evaluationRootPath, "results");
const evaluationReviewsPath = join(evaluationRootPath, "reviews.json");
const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const defaultResearchCodeEdition = "2022 New York City Construction Codes";
const maxSyncMutationsPerBatch = 100;
const maxWorkboardElements = 5_000;
const maxWorkboardAssets = 250;
const maxWorkboardRecordBytes = 768 * 1024;
const maxWorkboardAssetBytes = 8 * 1024 * 1024;
const defaultRequestBodyLimit = 1024 * 1024;
const immutableStaticCacheControl = "public, max-age=31536000, s-maxage=31536000, immutable";
const codeAssetCacheControl = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
const rateLimitBuckets = new Map();
const rateLimitPolicies = new Map([
  ["account/sign-in", { limit: 30, windowMs: 5 * 60 * 1000 }],
  ["account/apple/start", { limit: 30, windowMs: 5 * 60 * 1000 }],
  ["account/apple/callback", { limit: 60, windowMs: 5 * 60 * 1000 }],
  ["account/profile", { limit: 60, windowMs: 60 * 1000 }],
  ["billing/web/checkout", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["billing/web/portal", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["research/interpret", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/get", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/create", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/evidence", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/refresh", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/message", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/delete", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/usage", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/feedback", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["internal/evaluations/data", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["internal/evaluations/review", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["sync/push", { limit: 240, windowMs: 60 * 1000 }],
  ["workboards/assets/upload", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["workboards/assets/read", { limit: 600, windowMs: 60 * 1000 }],
  ["workboards/assets/delete", { limit: 60, windowMs: 60 * 60 * 1000 }]
]);
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
let cachedChapterIndex = null;
let cachedChapterManifest = null;
let cachedCanonicalSectionIDs = null;
const cachedCanonicalBlockIDsBySectionID = new Map();
let cachedSectionCatalog = null;
let cachedSectionCatalogPromise = null;
let cachedShippedSearchIndex = null;
let cachedAppleJWKS = null;
let cachedAppleJWKSExpiresAt = 0;
let blobModulePromise = null;

const emptyStore = () => ({
  users: {},
  entitlements: {},
  appleTransactionOwners: {},
  sessions: {},
  passkeyCredentials: {},
  mutationsByUserID: {},
  researchConversationsByUserID: {},
  researchUsageByUserID: {},
  researchFeedbackByUserID: {}
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

const researchInterpretationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conclusion: { type: "string" },
    explanation: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    missingFacts: { type: "array", items: { type: "string" } },
    evidenceLimitations: { type: "array", items: { type: "string" } },
    additionalEvidenceNeeded: { type: "array", items: { type: "string" } },
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
  required: ["conclusion", "explanation", "assumptions", "missingFacts", "evidenceLimitations", "additionalEvidenceNeeded", "citations"]
};

function researchInterpretationSchemaForEvidence(evidence) {
  const schema = structuredClone(researchInterpretationSchema);
  schema.properties.citations.items.properties.sectionID.enum =
    Array.from(new Set(evidence.map((item) => String(item.sectionID))));
  schema.properties.citations.items.properties.sourceIDs.items.enum =
    Array.from(new Set(evidence.map((item) => String(item.sourceID || `section-${item.sectionID}`))));
  return schema;
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

function createFileStoreAdapter() {
  return {
    kind: "file",
    schema: "json-file",
    async read() {
      try {
        const raw = await readFile(dataPath, "utf8");
        return { ...emptyStore(), ...JSON.parse(raw) };
      } catch (error) {
        if (error.code === "ENOENT") {
          return emptyStore();
        }
        throw error;
      }
    },
    async write(store) {
      await mkdir(dirname(dataPath), { recursive: true });
      await writeFile(dataPath, JSON.stringify(store, null, 2) + "\n");
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
          )
        },
        mutationCounts: mutationCountsByKind
      };
    },
    async listResearchConversations(userID) {
      const store = await this.read();
      return (store.researchConversationsByUserID?.[userID] || []).slice();
    },
    async saveResearchConversation(userID, conversation) {
      const store = await this.read();
      store.researchConversationsByUserID ||= {};
      const conversations = store.researchConversationsByUserID[userID] || [];
      const index = conversations.findIndex((item) => item.id === conversation.id);
      if (index === -1) conversations.push(conversation);
      else conversations[index] = conversation;
      store.researchConversationsByUserID[userID] = conversations;
      await this.write(store);
      return conversation;
    },
    async deleteResearchConversation(userID, conversationID) {
      const store = await this.read();
      const conversations = store.researchConversationsByUserID?.[userID] || [];
      const remaining = conversations.filter((item) => item.id !== conversationID);
      if (remaining.length === conversations.length) return false;
      store.researchConversationsByUserID[userID] = remaining;
      await this.write(store);
      return true;
    },
    async researchUsageSince(userID, since) {
      const store = await this.read();
      return (store.researchUsageByUserID?.[userID] || []).filter((entry) => entry.createdAt >= since);
    },
    async recordResearchUsage(userID, entry) {
      const store = await this.read();
      store.researchUsageByUserID ||= {};
      const cutoff = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
      store.researchUsageByUserID[userID] = [
        ...(store.researchUsageByUserID[userID] || []).filter((item) => item.createdAt >= cutoff),
        entry
      ];
      await this.write(store);
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
    researchConversationsByUserID: store.researchConversationsByUserID,
    researchUsageByUserID: store.researchUsageByUserID,
    researchFeedbackByUserID: store.researchFeedbackByUserID
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
  const accountRepository = createPostgresAccountRepository(sql);
  const syncRepository = createPostgresSyncRepository(sql);
  let initialized = false;
  let migrated = false;

  async function ensureSchema() {
    if (initialized) {
      return;
    }
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
        color_hex TEXT,
        sort_order INTEGER,
        mutation JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        server_version BIGINT NOT NULL DEFAULT 1
      )
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
    initialized = true;
  }

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
        (SELECT count(*) FROM permitext_research_usage)::int AS research_usage,
        (SELECT count(*) FROM permitext_research_feedback)::int AS research_feedback,
        (SELECT count(*) FROM permitext_user_content_records)::int AS user_content_records,
        (SELECT count(*) FROM permitext_sync_events)::int AS sync_events,
        COALESCE((SELECT max(event_id) FROM permitext_sync_events), 0)::bigint AS latest_event_id
    `;
    const row = rows[0] || {};
    return {
      storage: "postgres",
      schema: "normalized-v3",
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
        researchUsage: Number(row.research_usage || 0),
        researchFeedback: Number(row.research_feedback || 0),
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
          WHERE entity_kind IN ('continuity', 'codeVersionClear')
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

  async function migrateLegacyStateIfNeeded() {
    if (migrated) {
      return;
    }
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
    migrated = true;
  }

  return {
    kind: "postgres",
    schema: "normalized-v3",
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
    async updateAccount(userID, account) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return accountRepository.updateAccount(userID, account);
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
    async listResearchConversations(userID) {
      await ensureSchema();
      const rows = await sql`
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
    async deleteResearchConversation(userID, conversationID) {
      await ensureSchema();
      const rows = await sql`
        DELETE FROM permitext_research_conversations
        WHERE id = ${conversationID} AND user_id = ${userID}
        RETURNING id
      `;
      return rows.length > 0;
    },
    async researchUsageSince(userID, since) {
      await ensureSchema();
      const rows = await sql`
        SELECT id, model, mode, input_tokens, cached_input_tokens, output_tokens, total_tokens,
               prompt_version, evidence_version, estimated_cost_usd, pricing_version, created_at
        FROM permitext_research_usage
        WHERE user_id = ${userID} AND created_at >= ${since}::timestamptz
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
    async recordResearchUsage(userID, entry) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_research_usage (
          id, user_id, model, mode, input_tokens, cached_input_tokens, output_tokens, total_tokens,
          prompt_version, evidence_version, estimated_cost_usd, pricing_version, created_at
        )
        VALUES (
          ${entry.id}, ${userID}, ${entry.model}, ${entry.mode},
          ${entry.inputTokens}, ${entry.cachedInputTokens || 0}, ${entry.outputTokens}, ${entry.totalTokens},
          ${entry.promptVersion || null}, ${entry.evidenceVersion || null},
          ${entry.estimatedCostUSD ?? null}, ${entry.pricingVersion || null},
          ${entry.createdAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `;
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
  if (!cachedStoreAdapter) {
    cachedStoreAdapter = databaseURL
      ? await createPostgresStoreAdapter()
      : createFileStoreAdapter();
  }
  return cachedStoreAdapter;
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

async function listStoredResearchConversations(userID) {
  const adapter = await storeAdapter();
  return typeof adapter.listResearchConversations === "function"
    ? adapter.listResearchConversations(userID)
    : [];
}

async function storedResearchConversation(userID, conversationID) {
  return (await listStoredResearchConversations(userID)).find((item) => item.id === conversationID) || null;
}

async function saveStoredResearchConversation(userID, conversation) {
  const adapter = await storeAdapter();
  return adapter.saveResearchConversation(userID, conversation);
}

async function deleteStoredResearchConversation(userID, conversationID) {
  const adapter = await storeAdapter();
  return adapter.deleteResearchConversation(userID, conversationID);
}

async function researchUsageSince(userID, since) {
  const adapter = await storeAdapter();
  return typeof adapter.researchUsageSince === "function"
    ? adapter.researchUsageSince(userID, since)
    : [];
}

async function recordResearchUsage(userID, entry) {
  const adapter = await storeAdapter();
  if (typeof adapter.recordResearchUsage === "function") {
    await adapter.recordResearchUsage(userID, entry);
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
  if (bearerToken(request) !== adminToken) {
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
    return { ...context, sessionToken: suppliedToken };
  }

  const localStore = store || await readStore();
  if (!requireSessionToken(request, response, localStore.sessions[userID], requestAccount)) {
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
  return `workboards/${safeWorkboardPathHash(userID)}/${safeWorkboardPathHash(projectID)}/`;
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

async function vercelBlob() {
  blobModulePromise ||= import("@vercel/blob");
  return blobModulePromise;
}

function requestClientAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(request.headers["x-real-ip"] || request.socket?.remoteAddress || "unknown");
}

function enforceRateLimit(request, response, path, now = Date.now()) {
  const policy = rateLimitPolicies.get(path);
  if (!policy || request.method !== "POST") return true;
  const key = `${path}:${requestClientAddress(request)}`;
  const current = rateLimitBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : current;
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (rateLimitBuckets.size > 2_000) {
    for (const [candidateKey, candidate] of rateLimitBuckets) {
      if (candidate.resetAt <= now) rateLimitBuckets.delete(candidateKey);
    }
    while (rateLimitBuckets.size > 2_000) {
      rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
    }
  }
  if (bucket.count <= policy.limit) return true;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  sendError(response, 429, "Too many requests. Try again later.", {
    "retry-after": String(retryAfter)
  });
  return false;
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
    for (const section of flattenChapterSections(chapter)) {
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
      Object.entries(payload.tokens || {}).map(([token, sectionIDs]) => [token, new Set(sectionIDs)])
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

function intersectSets(left, right) {
  const intersection = new Set();
  for (const value of left) {
    if (right.has(value)) intersection.add(value);
  }
  return intersection;
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
  if (legacySectionID) {
    candidates.push(join(legacySectionContentPath, `${legacySectionID}.json`));
  }

  for (const candidate of candidates) {
    try {
      return preparedBodyWithDerivedPlainText(await readJSONFile(candidate));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
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

function matchingCanonicalResearchSelection(value, canonicalText) {
  const normalized = normalizedResearchText(value, 4_000);
  const withoutReaderChrome = normalized
    .replace(/(?:^|\s)(?:Has note|Bookmarked)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const canonicalComparable = comparableResearchText(canonicalText);
  for (const candidate of Array.from(new Set([normalized, withoutReaderChrome]))) {
    if (candidate.length >= 2 && canonicalComparable.includes(comparableResearchText(candidate))) {
      return candidate;
    }
  }
  return "";
}

async function researchEvidenceForSectionIDs(sectionIDs) {
  const evidence = [];
  const charactersPerSection = Math.min(12_000, Math.floor(60_000 / sectionIDs.length));
  for (const requestedID of sectionIDs) {
    const summary = await sectionSummaryByID(requestedID);
    if (!summary) {
      const error = new Error(`Unknown code section: ${requestedID}.`);
      error.code = "INVALID_RESEARCH_SECTION";
      throw error;
    }
    const canonicalID = String(summary.id || summary.sectionID || requestedID);
    const body = await sectionBody(summary.webSectionID || requestedID, {
      allowMissing: false,
      canonicalSectionID: canonicalID
    });
    const rawText = (body.blocks || []).map((block) => block.plainText || "").join("\n\n");
    const enactedBodyText = String(rawText || "").replace(/\s+/g, " ").trim();
    const canonicalText = [summary.sectionNumber, summary.title, enactedBodyText]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const text = enactedBodyText.slice(0, charactersPerSection);
    if (!enactedBodyText) {
      const error = new Error(`Section ${summary.sectionNumber || canonicalID} has no enacted text available for research.`);
      error.code = "INCOMPLETE_RESEARCH_SECTION";
      throw error;
    }
    evidence.push({
      sectionID: canonicalID,
      sectionNumber: String(summary.sectionNumber || body.sectionNumber || ""),
      title: String(summary.title || body.title || "Section"),
      codePrefix: String(summary.codePrefix || body.codePrefix || ""),
      chapterNumber: String(summary.chapterNumber || body.chapterNumber || ""),
      text,
      canonicalText,
      sectionTextHash: createHash("sha256").update(canonicalText).digest("hex")
    });
  }
  return evidence;
}

function researchPrompt(question, evidence, options = {}) {
  const sources = evidence.map((section) => [
    `PASSAGE_ID: ${section.sourceID}`,
    `SECTION_ID: ${section.sectionID}`,
    `CODE: ${section.codePrefix}`,
    `SECTION: ${section.sectionNumber}`,
    `TITLE: ${section.title}`,
    `CODE_EDITION: ${section.codeEdition || defaultResearchCodeEdition}`,
    `CODE_VERSION: ${section.codeVersion || defaultSyncCodeVersion}`,
    `EXACT SELECTED PASSAGE: ${section.text}`
  ].join("\n")).join("\n\n---\n\n");
  const history = (options.messages || []).slice(-8).map((message) => {
    if (message.role === "user") return `USER: ${message.question || ""}`;
    return `ASSISTANT: ${message.answer?.conclusion || ""}\n${message.answer?.explanation || ""}`;
  }).join("\n\n");
  return [
    `QUESTION\n${question}`,
    history ? `UNTRUSTED CONVERSATION HISTORY FOR CONTEXT ONLY — NOT AUTHORITY\n${history}` : "",
    `AUTHORITATIVE USER-SELECTED EVIDENCE\n${sources}`
  ].filter(Boolean).join("\n\n");
}

function mockResearchInterpretation(question, evidence) {
  const subject = evidence.length === 1
    ? `the selected provision, ${evidence[0].sectionNumber || evidence[0].title}`
    : `the ${evidence.length} selected provisions`;
  return {
    conclusion: `A project-specific answer to “${question}” requires reading ${subject} together with the facts of the proposed work.`,
    explanation: "The selected code text provides the governing research starting point, but it does not by itself establish every project fact needed for an official determination.",
    assumptions: ["Only the selected 2022 New York City Construction Code provisions were considered."],
    missingFacts: ["Confirm the project scope, occupancy, location, existing conditions, and any applicable agency determinations."],
    evidenceLimitations: ["No code sections or agency documents beyond the passages selected by the user were treated as authority."],
    additionalEvidenceNeeded: ["Attach any other applicable code section or agency document before relying on requirements not stated in the selected passages."],
    citations: evidence.map((section) => ({
      sectionID: section.sectionID,
      sourceIDs: [section.sourceID || `section-${section.sectionID}`],
      relevance: `Selected evidence from ${section.sectionNumber || section.title}.`
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

export function validateResearchInterpretation(value, evidence) {
  const allowedSections = new Map();
  const allowedSources = new Map();
  for (const section of evidence) {
    if (!allowedSections.has(section.sectionID)) allowedSections.set(section.sectionID, section);
    allowedSources.set(section.sourceID || `section-${section.sectionID}`, section);
  }
  if (!value || typeof value !== "object" ||
      typeof value.conclusion !== "string" || !value.conclusion.trim() ||
      typeof value.explanation !== "string" || !value.explanation.trim() ||
      !Array.isArray(value.assumptions) || !value.assumptions.every((item) => typeof item === "string") ||
      !Array.isArray(value.missingFacts) || !value.missingFacts.every((item) => typeof item === "string") ||
      !Array.isArray(value.evidenceLimitations) || !value.evidenceLimitations.every((item) => typeof item === "string") ||
      !Array.isArray(value.additionalEvidenceNeeded) || !value.additionalEvidenceNeeded.every((item) => typeof item === "string") ||
      !Array.isArray(value.citations) || value.citations.length === 0) {
    const error = new Error("The model returned an invalid interpretation.");
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
    if (!allowedSections.has(sectionID) || !sourceIDs.length ||
        new Set(sourceIDs).size !== sourceIDs.length ||
        sourceIDs.some((sourceID) => allowedSources.get(sourceID)?.sectionID !== sectionID) || !relevance) {
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
        selectedText: allowedSources.get(sourceID).text
      })),
      relevance
    });
  }
  if (!citations.length) {
    const error = new Error("The model returned no valid citations.");
    error.code = "INVALID_RESEARCH_CITATION";
    throw error;
  }
  return {
    conclusion: value.conclusion.trim(),
    explanation: value.explanation.trim(),
    assumptions: value.assumptions.map((item) => item.trim()).filter(Boolean),
    missingFacts: value.missingFacts.map((item) => item.trim()).filter(Boolean),
    evidenceLimitations: value.evidenceLimitations.map((item) => item.trim()).filter(Boolean),
    additionalEvidenceNeeded: value.additionalEvidenceNeeded.map((item) => item.trim()).filter(Boolean),
    citations
  };
}

async function openAIResearchInterpretation(question, evidence, userID, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Research AI is not configured.");
    error.code = "RESEARCH_NOT_CONFIGURED";
    throw error;
  }
  const configuration = researchModelConfiguration();
  const model = configuration.model;
  const passageEvidence = evidence.map((section) => ({
    ...section,
    sourceID: section.sourceID || `section-${section.sectionID}`,
    codeVersion: section.codeVersion || defaultSyncCodeVersion
  }));
  let response;
  try {
    const requestBody = {
      model,
      store: false,
      reasoning: { effort: configuration.reasoningEffort },
      max_output_tokens: 1_500,
      safety_identifier: createHash("sha256").update(String(userID)).digest("hex"),
      instructions: [
        "You are a building-code research assistant, not an authority having jurisdiction.",
        "Interpret only the selected official code evidence supplied in the request.",
        "Do not use outside knowledge as legal authority and do not invent requirements.",
        "Separate the supported conclusion, missing project facts, limitations of the selected evidence, and additional evidence needed.",
          "Treat occupancy, construction type, location, existing conditions, building height, and occupant load as unknown unless stated in the question or selected evidence.",
          "Facts stated by the user may support a conditional answer, but restate any fact material to an exception or numerical threshold as a project fact to verify before final reliance.",
          "Do not resolve a missing material fact by listing it as an assumption; put it in missingFacts and make the conclusion conditional.",
          "Use selected document structure such as exception headings when it is supplied. If an exception and its conditions are selected, state the conditional result instead of demanding unselected text merely to acknowledge that conditional rule.",
          "When a category, table row, shared-facility condition, or calculation input is needed but not established, name that missing item specifically rather than asking only for generic project information.",
          "When selected evidence supplies a calculation procedure, briefly explain every material step and exception in that procedure even when missing inputs prevent a final numeric result.",
          "Do not merely say that a table or category must be checked. Identify the project-specific use category that must be selected from actual use and explain what the selected evidence already establishes.",
          "For plumbing-fixture questions, when a final count could depend on facilities serving more than one space, ask whether existing or shared facilities are proposed to serve the space and request selected provisions governing that sharing. Do not assume those facilities qualify.",
          "If the question attributes a requirement to an agency, funding program, or other authority not represented in the selected evidence, explicitly request that authority's applicable design standard, funding or program requirements, or official guidance. Do not substitute additional Building Code text for the missing outside authority.",
          "If the question cannot be answered from the selected evidence, say so directly.",
        "Every major conclusion must cite supplied SECTION_ID and PASSAGE_ID values."
      ].join(" "),
      input: researchPrompt(question, passageEvidence, options),
      text: {
        format: {
          type: "json_schema",
          name: "permitext_code_interpretation",
          strict: true,
          schema: researchInterpretationSchemaForEvidence(passageEvidence)
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
      signal: AbortSignal.timeout(45_000)
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
    interpretation: validateResearchInterpretation(value, passageEvidence),
    requestedModel: model,
    model: payload.model || model,
    configuration,
    usage: {
      inputTokens: payload.usage?.input_tokens || 0,
      cachedInputTokens: payload.usage?.input_tokens_details?.cached_tokens || 0,
      outputTokens: payload.usage?.output_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0
    }
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

  const question = normalizedResearchText(body.question, 2_000);
  if (question.length < 3) {
    sendError(response, 400, "Enter a research question.");
    return;
  }
  const requestedIDs = Array.isArray(body.sectionIDs)
    ? Array.from(new Set(body.sectionIDs.map((value) => String(value).trim()).filter(Boolean)))
    : [];
  if (!requestedIDs.length || requestedIDs.length > 12 || requestedIDs.some((id) => !/^\d+$/.test(id))) {
    sendError(response, 400, "Provide between 1 and 12 numeric section IDs.");
    return;
  }

  try {
    const evidence = await researchEvidenceForSectionIDs(requestedIDs);
    const mockMode = process.env.PERMITEXT_RESEARCH_MOCK === "1";
    const result = mockMode
      ? {
          interpretation: validateResearchInterpretation(mockResearchInterpretation(question, evidence), evidence),
          model: "permitext-mock",
          configuration: researchModelConfiguration(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        }
      : await openAIResearchInterpretation(question, evidence, userID);
    const usage = result.usage;
    console.info(JSON.stringify({
      event: "research_interpretation",
      user: createHash("sha256").update(userID).digest("hex").slice(0, 16),
      mode: mockMode ? "mock" : "openai",
      model: result.model,
      promptVersion: result.configuration.promptVersion,
      evidenceVersion: result.configuration.evidenceVersion,
      codeEdition: defaultResearchCodeEdition,
      codeVersion: defaultSyncCodeVersion,
      evidenceSections: evidence.length,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens
    }));
    sendJSON(response, 200, {
      mode: mockMode ? "mock" : "openai",
      model: result.model,
      promptVersion: result.configuration.promptVersion,
      evidenceVersion: result.configuration.evidenceVersion,
      codeEdition: defaultResearchCodeEdition,
      codeVersion: defaultSyncCodeVersion,
      ...result.interpretation,
      evidenceSectionIDs: evidence.map((section) => section.sectionID),
      usage,
      disclaimer: "AI-generated research assistance, not an official code determination."
    });
  } catch (error) {
    if (error.code === "INVALID_RESEARCH_SECTION") {
      sendError(response, 400, error.message);
      return;
    }
    if (["INCOMPLETE_RESEARCH_SECTION", "ENOENT"].includes(error.code)) {
      sendError(response, 422, "This code section is incomplete and cannot be analyzed yet.");
      return;
    }
    if (error.code === "RESEARCH_NOT_CONFIGURED") {
      sendError(response, 503, error.message);
      return;
    }
    if (error.code === "RESEARCH_EVAL_SPEND_CAP") {
      sendError(response, 503, error.message);
      return;
    }
    if (error.code === "RESEARCH_REFUSAL") {
      sendError(response, 422, error.message);
      return;
    }
    if (["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_CITATION", "RESEARCH_PROVIDER_ERROR", "TimeoutError"].includes(error.code || error.name)) {
      sendError(response, 502, "The research model could not return a verified, cited answer.");
      return;
    }
    throw error;
  }
}

function researchConversationSummary(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    sourceCount: conversation.sources?.filter((source) => source.kind === "selection").length || 0,
    messageCount: conversation.messages?.length || 0,
    sourceStatus: conversation.sourceStatus || "current"
  };
}

function researchSourceFromEvidence(evidence, options = {}) {
  const selectedText = normalizedResearchText(options.selectedText, 4_000);
  return {
    id: randomUUID(),
    kind: options.kind || "related",
    relationship: options.relationship || "Explicitly referenced by the selected provision",
    sectionID: evidence.sectionID,
    sectionNumber: evidence.sectionNumber,
    title: evidence.title,
    codePrefix: evidence.codePrefix,
    chapterNumber: evidence.chapterNumber,
    selectedText,
    selectedTextHash: selectedText
      ? createHash("sha256").update(selectedText).digest("hex")
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

async function researchSourcesForSelection(sectionID, selectedText) {
  const normalizedSelection = normalizedResearchText(selectedText, 4_000);
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
  const related = await relatedResearchEvidence(primary);
  return [
    researchSourceFromEvidence(primary, {
      kind: "selection",
      relationship: "Passage selected by you",
      selectedText: canonicalSelection
    }),
    ...related.map((evidence) => researchSourceFromEvidence(evidence))
  ];
}

async function currentResearchEvidence(conversation) {
  const sectionIDs = Array.from(new Set((conversation.sources || []).map((source) => source.sectionID).filter(Boolean)));
  const evidence = await researchEvidenceForSectionIDs(sectionIDs);
  const evidenceByID = new Map(evidence.map((item) => [item.sectionID, item]));
  const sourceStatuses = (conversation.sources || []).map((source) => {
    const current = evidenceByID.get(source.sectionID);
    const selectionPresent = !source.selectedText || Boolean(
      current && matchingCanonicalResearchSelection(source.selectedText, current.canonicalText)
    );
    return {
      sourceID: source.id,
      sectionID: source.sectionID,
      current: Boolean(current && current.sectionTextHash === source.sectionTextHash && selectionPresent),
      selectionPresent
    };
  });
  return {
    evidence,
    sourceStatuses,
    stale: sourceStatuses.some((status) => !status.current)
  };
}

function selectedResearchEvidence(conversation, currentEvidence) {
  const evidenceByID = new Map(currentEvidence.map((item) => [item.sectionID, item]));
  return (conversation.sources || [])
    .filter((source) => source.kind === "selection" && source.selectedText)
    .map((source) => {
      const evidence = evidenceByID.get(source.sectionID);
      return evidence ? {
        ...evidence,
        sourceID: source.id,
        text: source.selectedText,
        codeVersion: source.codeVersion || conversation.codeVersion || defaultSyncCodeVersion,
        codeEdition: source.codeEdition || defaultResearchCodeEdition
      } : null;
    })
    .filter(Boolean);
}

async function researchConversationForClient(conversation, options = {}) {
  if (!options.checkSources) return conversation;
  const current = await currentResearchEvidence(conversation);
  return {
    ...conversation,
    sourceStatus: current.stale ? "changed" : "current",
    sourceStatuses: current.sourceStatuses
  };
}

async function authenticatedResearchBody(request, response) {
  const body = await readJSON(request);
  const userID = String(body.auth?.accountUserID || "").trim();
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return null;
  }
  const context = await authenticatedUserContext(request, response, userID);
  return context ? { body, userID } : null;
}

async function requiredResearchConversation(response, userID, conversationID) {
  const conversation = await storedResearchConversation(userID, String(conversationID || "").trim());
  if (!conversation) sendError(response, 404, "Research conversation not found.");
  return conversation;
}

async function handleResearchConversationList(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversations = await listStoredResearchConversations(context.userID);
  sendJSON(response, 200, {
    conversations: conversations
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(researchConversationSummary)
  });
}

async function handleResearchConversationGet(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const feedbackByAnswerID = new Map(
    (await listStoredResearchFeedback(context.userID)).map((feedback) => [feedback.answerID, feedback])
  );
  const clientConversation = await researchConversationForClient(conversation, { checkSources: true });
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

async function handleResearchConversationCreate(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  try {
    if ((await listStoredResearchConversations(context.userID)).length >= 200) {
      sendError(response, 409, "Delete an older research conversation before starting another.");
      return;
    }
    const sources = await researchSourcesForSelection(context.body.sectionID, context.body.selectedText);
    const primary = sources[0];
    const now = new Date().toISOString();
    const conversation = {
      id: randomUUID(),
      title: `${primary.codePrefix || "Code"} ${primary.sectionNumber || primary.sectionID} — ${primary.title}`.slice(0, 140),
      createdAt: now,
      updatedAt: now,
      codeVersion: defaultSyncCodeVersion,
      sourceStatus: "current",
      sources,
      messages: []
    };
    await saveStoredResearchConversation(context.userID, conversation);
    sendJSON(response, 201, { conversation });
  } catch (error) {
    if (["INVALID_RESEARCH_SELECTION", "INVALID_RESEARCH_SECTION"].includes(error.code)) {
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
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  try {
    if ((conversation.sources || []).filter((source) => source.kind === "selection").length >= 24) {
      sendError(response, 409, "This conversation already has the maximum of 24 selected passages.");
      return;
    }
    const addedSources = await researchSourcesForSelection(context.body.sectionID, context.body.selectedText);
    const existingRelatedIDs = new Set((conversation.sources || []).filter((source) => source.kind === "related").map((source) => source.sectionID));
    conversation.sources.push(...addedSources.filter((source) => source.kind === "selection" || !existingRelatedIDs.has(source.sectionID)));
    conversation.updatedAt = new Date().toISOString();
    conversation.sourceStatus = "current";
    await saveStoredResearchConversation(context.userID, conversation);
    sendJSON(response, 200, { conversation });
  } catch (error) {
    if (["INVALID_RESEARCH_SELECTION", "INVALID_RESEARCH_SECTION"].includes(error.code)) {
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
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const conversation = await requiredResearchConversation(response, context.userID, context.body.conversationID);
  if (!conversation) return;
  const current = await currentResearchEvidence(conversation);
  const evidenceByID = new Map(current.evidence.map((item) => [item.sectionID, item]));
  if (current.sourceStatuses.some((status) => !status.selectionPresent)) {
    sendJSON(response, 409, {
      error: "A selected passage is no longer present in the enacted text. Start a new research selection from the current code.",
      code: "RESEARCH_SELECTION_CHANGED",
      conversation: await researchConversationForClient(conversation, { checkSources: true })
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
      sectionTextHash: evidence.sectionTextHash,
      codeVersion: defaultSyncCodeVersion
    } : source;
  });
  conversation.sourceStatus = "current";
  conversation.updatedAt = new Date().toISOString();
  await saveStoredResearchConversation(context.userID, conversation);
  sendJSON(response, 200, { conversation });
}

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function monthlyResearchRequestLimit() {
  const configured = Number(process.env.PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 100_000 ? configured : 100;
}

function nextMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function researchUsageSummary(entries, options = {}) {
  const requestLimit = monthlyResearchRequestLimit();
  const inputTokens = entries.reduce((total, entry) => total + Number(entry.inputTokens || 0), 0);
  const cachedInputTokens = entries.reduce((total, entry) => total + Number(entry.cachedInputTokens || 0), 0);
  const outputTokens = entries.reduce((total, entry) => total + Number(entry.outputTokens || 0), 0);
  const totalTokens = entries.reduce((total, entry) => total + Number(entry.totalTokens || 0), 0);
  const costsAreReliable = entries.length > 0 && entries.every((entry) => Number.isFinite(entry.estimatedCostUSD));
  const pricingVersions = Array.from(new Set(entries.map((entry) => entry.pricingVersion).filter(Boolean)));
  return {
    requestsUsed: entries.length,
    requestLimit,
    resetDate: nextMonthStart(),
    tokens: { inputTokens, cachedInputTokens, outputTokens, totalTokens },
    estimatedCostUSD: costsAreReliable
      ? Number(entries.reduce((total, entry) => total + entry.estimatedCostUSD, 0).toFixed(6))
      : null,
    pricingVersion: costsAreReliable && pricingVersions.length === 1 ? pricingVersions[0] : null,
    mockMode: Boolean(options.mockMode)
  };
}

async function handleResearchUsage(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const mockMode = process.env.PERMITEXT_RESEARCH_MOCK === "1";
  const entries = mockMode ? [] : await researchUsageSince(context.userID, currentMonthStart());
  sendJSON(response, 200, { usage: researchUsageSummary(entries, { mockMode }) });
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
  const existing = (await listStoredResearchFeedback(context.userID)).find((item) => item.answerID === answerID);
  const now = new Date().toISOString();
  const feedback = {
    id: existing?.id || randomUUID(),
    status: "candidate",
    conversationID: conversation.id,
    answerID,
    selectedEvidence: (conversation.sources || []).filter((source) => source.kind === "selection").map((source) => ({
      sourceID: source.id,
      sectionID: source.sectionID,
      sectionNumber: source.sectionNumber,
      codePrefix: source.codePrefix,
      codeVersion: source.codeVersion,
      codeEdition: source.codeEdition || defaultResearchCodeEdition,
      selectedTextHash: source.selectedTextHash
    })),
    question: questionMessage.question,
    answer: answerMessage.answer,
    citations: answerMessage.answer?.citations || [],
    model: answerMessage.answer?.model || null,
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
  sendJSON(response, existing ? 200 : 201, {
    feedback: {
      id: feedback.id,
      status: feedback.status,
      category: feedback.category,
      userComment: feedback.userComment,
      professionalRole: feedback.professionalRole,
      supportingReference: feedback.supportingReference,
      updatedAt: feedback.userUpdatedAt
    }
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

async function handleInternalEvaluationData(request, response) {
  const context = await authenticatedInternalBody(request, response);
  if (!context) return;
  const dataset = JSON.parse(await readFile(evaluationCasesPath, "utf8"));
  validateEvaluationDataset(dataset);
  const runs = await readEvaluationRuns();
  const reviews = (await readEvaluationReviews()).reviews;
  const feedbackRecords = (await listAllStoredResearchFeedback()).filter((item) => item.status === "candidate");
  sendJSON(response, 200, {
    dataset,
    runs,
    reviews,
    runReviewStatuses: Object.fromEntries(runs.map((run) => [
      run.configuration.runID,
      evaluationRunReviewStatus(run, reviews)
    ])),
    feedbackCandidates: feedbackRecords,
    feedbackRecords
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
  if (!["case", "run"].includes(kind) || !caseID || !["approved", "rejected"].includes(decision)) {
    sendError(response, 400, "Provide a case or run review with an approve or reject decision.");
    return;
  }
  const dataset = JSON.parse(await readFile(evaluationCasesPath, "utf8"));
  validateEvaluationDataset(dataset);
  let reviewedRun = null;
  let reviewedResult = null;
  if (kind === "case") {
    if (!dataset.cases.some((item) => item.id === caseID)) {
      sendError(response, 404, "Evaluation case not found.");
      return;
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
  if (kind === "case") {
    const testCase = dataset.cases.find((item) => item.id === caseID);
    testCase.status = decision === "approved" ? "approved" : "draft";
    testCase.reviewer = reviewer;
    testCase.reviewedAt = now;
    validateEvaluationDataset(dataset);
    await writeFile(evaluationCasesPath, `${JSON.stringify(dataset, null, 2)}\n`);
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
  const context = await authenticatedResearchBody(request, response);
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
  try {
    const current = await currentResearchEvidence(conversation);
    if (current.stale) {
      conversation.sourceStatus = "changed";
      await saveStoredResearchConversation(context.userID, conversation);
      sendJSON(response, 409, {
        error: "The enacted source text changed after it was added. Refresh the sources before asking another question.",
        code: "RESEARCH_SOURCE_CHANGED",
        conversation: { ...conversation, sourceStatuses: current.sourceStatuses }
      });
      return;
    }
    const mockMode = process.env.PERMITEXT_RESEARCH_MOCK === "1";
    const usageEntries = mockMode ? [] : await researchUsageSince(context.userID, currentMonthStart());
    const requestLimit = monthlyResearchRequestLimit();
    if (!mockMode && usageEntries.length >= requestLimit) {
      sendJSON(response, 429, {
        error: "This account reached its monthly AI research limit.",
        code: "RESEARCH_MONTHLY_LIMIT",
        usage: researchUsageSummary(usageEntries)
      });
      return;
    }
    const selections = conversation.sources.filter((source) => source.kind === "selection");
    const selectedEvidence = selectedResearchEvidence(conversation, current.evidence);
    const result = mockMode
      ? {
          interpretation: validateResearchInterpretation(mockResearchInterpretation(question, selectedEvidence), selectedEvidence),
          model: "permitext-mock",
          configuration: researchModelConfiguration(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        }
      : await openAIResearchInterpretation(question, selectedEvidence, context.userID, {
          selections,
          messages: conversation.messages
        });
    const estimatedCost = estimatedResearchCost(result.usage);
    const now = new Date().toISOString();
    const disclaimer = "AI-generated research assistance, not an official code determination.";
    const userMessage = { id: randomUUID(), role: "user", question, createdAt: now };
    const assistantMessage = {
      id: randomUUID(),
      role: "assistant",
      createdAt: now,
      answer: {
        mode: mockMode ? "mock" : "openai",
        model: result.model,
        requestedModel: result.requestedModel || result.model,
        promptVersion: result.configuration.promptVersion,
        evidenceVersion: result.configuration.evidenceVersion,
        codeEdition: defaultResearchCodeEdition,
        codeVersion: conversation.codeVersion,
        ...result.interpretation,
        evidenceSectionIDs: Array.from(new Set(selectedEvidence.map((section) => section.sectionID))),
        evidenceSourceIDs: selectedEvidence.map((section) => section.sourceID),
        usage: result.usage,
        estimatedCostUSD: estimatedCost.estimatedUSD,
        pricingVersion: estimatedCost.pricingVersion,
        disclaimer
      }
    };
    conversation.messages.push(userMessage, assistantMessage);
    conversation.updatedAt = now;
    conversation.sourceStatus = "current";
    await saveStoredResearchConversation(context.userID, conversation);
    if (!mockMode) {
      await recordResearchUsage(context.userID, {
        id: randomUUID(),
        model: result.model,
        requestedModel: result.requestedModel || result.model,
        mode: "openai",
        ...result.usage,
        promptVersion: result.configuration.promptVersion,
        evidenceVersion: result.configuration.evidenceVersion,
        estimatedCostUSD: estimatedCost.estimatedUSD,
        pricingVersion: estimatedCost.pricingVersion,
        createdAt: now
      });
    }
    console.info(JSON.stringify({
      event: "research_conversation_message",
      user: createHash("sha256").update(context.userID).digest("hex").slice(0, 16),
      mode: mockMode ? "mock" : "openai",
      model: result.model,
      conversation: createHash("sha256").update(conversation.id).digest("hex").slice(0, 16),
      evidenceSections: new Set(selectedEvidence.map((section) => section.sectionID)).size,
      evidencePassages: selectedEvidence.length,
      totalTokens: result.usage.totalTokens
    }));
    sendJSON(response, 200, {
      conversation,
      usage: researchUsageSummary(mockMode ? [] : [
        ...usageEntries,
        {
          ...result.usage,
          estimatedCostUSD: estimatedCost.estimatedUSD,
          pricingVersion: estimatedCost.pricingVersion
        }
      ], { mockMode })
    });
  } catch (error) {
    if (["INCOMPLETE_RESEARCH_SECTION", "ENOENT"].includes(error.code)) {
      sendError(response, 422, "A cited code section is incomplete and cannot be analyzed yet.");
      return;
    }
    if (error.code === "RESEARCH_NOT_CONFIGURED") {
      sendError(response, 503, error.message);
      return;
    }
    if (error.code === "RESEARCH_EVAL_SPEND_CAP") {
      sendError(response, 503, error.message);
      return;
    }
    if (error.code === "RESEARCH_REFUSAL") {
      sendError(response, 422, error.message);
      return;
    }
    if (["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_CITATION", "RESEARCH_PROVIDER_ERROR", "TimeoutError"].includes(error.code || error.name)) {
      sendError(response, 502, "The research model could not return a verified, cited answer.");
      return;
    }
    throw error;
  }
}

async function handleResearchConversationDelete(request, response) {
  const context = await authenticatedResearchBody(request, response);
  if (!context) return;
  const deleted = await deleteStoredResearchConversation(context.userID, String(context.body.conversationID || "").trim());
  if (!deleted) {
    sendError(response, 404, "Research conversation not found.");
    return;
  }
  sendJSON(response, 200, { deleted: true });
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
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    sendNotFound(response);
    return;
  }
  try {
    const filePath = join(assetContentPath, fileName);
    sendStatic(response, contentTypeForPath(filePath), await readFile(filePath), codeAssetCacheControl);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendNotFound(response);
      return;
    }
    throw error;
  }
}

async function handleCodeChapters(request, response) {
  const codePrefix = requestURL(request).searchParams.get("code")?.trim().toUpperCase();
  const chapters = await chapterIndex();
  sendJSON(response, 200, {
    chapters: codePrefix ? chapters.filter((chapter) => chapter.codePrefix === codePrefix) : chapters
  });
}

async function handleCodeChapter(request, path, response) {
  const chapterID = path.split("/").at(-1);
  if (!/^[a-zA-Z0-9_-]+$/.test(chapterID || "")) {
    sendError(response, 400, "Invalid chapter ID.");
    return;
  }
  const chapter = await readJSONFile(join(chapterContentPath, `${chapterID}.json`));
  const manifest = await chapterManifest();
  const manifestChapter = manifest.get(String(chapter.chapterID));
  const includeBody = requestURL(request).searchParams.get("include") === "body";
  const codePrefix = codePrefixForChapter(chapter, manifestChapter);
  const chapterNumber = manifestChapter?.chapterNumber || chapter.chapterNumber;
  const sections = flattenChapterSections(chapter);
  const canonicalSections = await canonicalizeChapterSections(sections, {
    codePrefix,
    chapterNumber
  });
  const sectionPayload = includeBody
    ? await Promise.all(canonicalSections.map(async (section) => ({
        ...section,
        blocks: (await sectionBody(section.webSectionID || section.id, {
          allowMissing: true,
          canonicalSectionID: section.id
        })).blocks || []
      })))
    : canonicalSections;

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
      groups: chapter.groups || [],
      sections: sectionPayload
    }
  });
}

async function handleCodeSection(path, response) {
  const sectionID = path.split("/").at(-1);
  if (!/^\d+$/.test(sectionID || "")) {
    sendError(response, 400, "Invalid section ID.");
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
        blocks: [{ id: `${sectionID}-title`, kind: "title", plainText: summary.title || "" }],
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
  const catalog = await sectionCatalog();
  const byID = new Map();
  catalog.forEach((section) => {
    byID.set(String(section.id), section);
    if (section.webSectionID) byID.set(String(section.webSectionID), section);
  });
  sendJSON(response, 200, {
    sections: uniqueIDs
      .map((id) => {
        const section = byID.get(id);
        return section ? { ...section, requestedID: id } : null;
      })
      .filter(Boolean)
  });
}

async function handleCodeSearch(request, response) {
  const url = requestURL(request);
  const query = url.searchParams.get("q")?.trim() || "";
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const resultLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 500)
    : 0;
  const codeFilter = new Set(
    (url.searchParams.get("code") || url.searchParams.get("codes") || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  );
  if (query.length < 2) {
    sendJSON(response, 200, { query, results: [] });
    return;
  }
  const normalizedQuery = query.toLowerCase();
  const queryTokens = tokenizeSearchText(query);
  if (!queryTokens.length) {
    sendJSON(response, 200, { query, results: [] });
    return;
  }

  const index = await shippedSearchIndex();
  let candidateIDs = new Set(index.get(queryTokens[0]) || []);
  for (const token of queryTokens.slice(1)) {
    candidateIDs = intersectSets(candidateIDs, index.get(token) || new Set());
    if (!candidateIDs.size) break;
  }
  if (/^[A-Za-z]?\d/.test(query)) {
    for (const [token, sectionIDs] of index) {
      if (!token.startsWith(normalizedQuery)) continue;
      for (const sectionID of sectionIDs) candidateIDs.add(sectionID);
    }
  }

  const candidates = (await sectionCatalog()).filter((section) =>
    candidateIDs.has(section.id) &&
    (codeFilter.size === 0 || codeFilter.has(section.codePrefix))
  );
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
  const selectedHits = resultLimit ? hits.slice(0, resultLimit) : hits;
  const results = await Promise.all(selectedHits.map(async ({ section }) => {
    const body = await sectionBody(section.webSectionID || section.id, {
      allowMissing: true,
      canonicalSectionID: section.id
    });
    const plainText = body.blocks?.map((block) => block.plainText || "").join("\n\n") || "";
    return {
      id: section.id,
      chapterID: section.chapterID,
      codePrefix: section.codePrefix,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      headerLine: section.headerLine,
      headingLine: section.headingLine,
      snippet: searchSnippet(plainText || section.title || "", query)
    };
  }));
  sendJSON(response, 200, {
    query,
    results,
    totalResults,
    limited: Boolean(resultLimit && totalResults > results.length)
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
  return adapter?.kind !== "postgres";
}

function appleWebSignInConfigured() {
  return Boolean(process.env.APPLE_SERVICE_ID?.trim());
}

function browserFallbackSignInAllowed(request) {
  if (process.env.PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN === "1") {
    return true;
  }
  const host = request.headers.host || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function appleWebOAuthStateSecret() {
  return process.env.APPLE_WEB_OAUTH_STATE_SECRET ||
    process.env.PERMITEXT_SYNC_ADMIN_TOKEN ||
    process.env.STRIPE_WEBHOOK_SECRET ||
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

async function verifyAppleIdentityToken(identityToken) {
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

  return payload;
}

function normalizedAccountEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

async function verifiedCredentialIdentity(credential) {
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

  const payload = await verifyAppleIdentityToken(identityToken);
  if (credential.providerUserID && credential.providerUserID !== payload.sub) {
    throw new ClientAuthError(401, "Apple identity token subject does not match the credential.");
  }
  return {
    providerUserID: payload.sub,
    email: normalizedAccountEmail(payload.email || credential?.email)
  };
}

async function accountFromCredential(credential) {
  const provider = credential?.provider || "guest";
  const identity = await verifiedCredentialIdentity(credential);
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

function entitlementForSource(userID, source, details = {}) {
  const entitlement = {
    plan: "pro",
    source,
    grantedUserID: userID,
    updatedAt: new Date().toISOString()
  };
  if (details.expiresAt) {
    entitlement.expiresAt = details.expiresAt;
  }
  if (details.provider) {
    entitlement.provider = details.provider;
  }
  return entitlement;
}

function grantServerEntitlement(store, userID, source, details = {}) {
  const entitlement = entitlementForSource(userID, source, details);
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
  const entitlement = entitlementForSource(userID, source, details);
  const adapter = await storeAdapter();
  if (typeof adapter.saveEntitlement === "function") {
    return adapter.saveEntitlement(userID, entitlement);
  }
  const store = await readStore();
  grantServerEntitlement(store, userID, source, details);
  await writeStore(store);
  return store.entitlements[userID];
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
  const entitlement = entitlementForSource(userID, "appleSubscription", details);
  const adapter = await storeAdapter();
  if (typeof adapter.claimAppleEntitlement === "function") {
    return adapter.claimAppleEntitlement(userID, originalTransactionID, entitlement);
  }

  const store = await readStore();
  if (!claimAppleTransactionOwner(store, originalTransactionID, userID)) {
    return null;
  }
  grantServerEntitlement(store, userID, "appleSubscription", details);
  await writeStore(store);
  return store.entitlements[userID];
}

async function deletePersistedEntitlement(userID, expected = {}) {
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

async function persistedStripeEntitlementOwner(subscriptionID) {
  const adapter = await storeAdapter();
  if (typeof adapter.stripeEntitlementOwner === "function") {
    return adapter.stripeEntitlementOwner(subscriptionID);
  }
  const store = await readStore();
  const userID = findUserIDForStripeSubscription(store, subscriptionID);
  return userID ? { userID, entitlement: store.entitlements[userID] } : null;
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

export function stripeConfigurationStatus({
  secretKey = process.env.STRIPE_SECRET_KEY,
  priceID = process.env.STRIPE_PRO_PRICE_ID,
  requireLive = liveStripeRequired()
} = {}) {
  const mode = stripeSecretKeyMode(secretKey);
  const missing = [];
  if (!String(secretKey || "").trim()) missing.push("STRIPE_SECRET_KEY");
  if (!String(priceID || "").trim()) missing.push("STRIPE_PRO_PRICE_ID");
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

function stripeConfigured() {
  return stripeConfigurationStatus().ready;
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

function entitlementMatchesStripeSubscription(subscriptionID) {
  return (entitlement) => entitlement?.source === "webSubscription" &&
    entitlement?.provider?.stripeSubscriptionID === subscriptionID;
}

function findUserIDForStripeSubscription(store, subscriptionID) {
  if (!subscriptionID) {
    return null;
  }
  return Object.entries(store.entitlements || {}).find(([, entitlement]) =>
    entitlementMatchesStripeSubscription(subscriptionID)(entitlement)
  )?.[0] || null;
}

function stripeSubscriptionExpiresAt(object) {
  const timestamp =
    object?.current_period_end ||
    object?.lines?.data?.[0]?.period?.end ||
    object?.period_end ||
    null;
  return Number.isFinite(Number(timestamp)) ? new Date(Number(timestamp) * 1000).toISOString() : null;
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

async function activeStripeSubscriptionForUserID(userID) {
  if (!stripeConfigured() || !userID) {
    return null;
  }
  const query = `metadata['accountUserID']:'${stripeSearchValue(userID)}'`;
  const searchParams = new URLSearchParams({ query, limit: "10" });
  const payload = await stripeAPI(`/v1/subscriptions/search?${searchParams.toString()}`);
  return (payload.data || []).find((subscription) => ["active", "trialing"].includes(subscription.status)) || null;
}

async function transferStripeSubscriptionMetadata(subscriptionID, targetUserID) {
  if (!stripeConfigured() || !subscriptionID || !targetUserID) {
    return;
  }
  await stripeAPI(`/v1/subscriptions/${encodeURIComponent(subscriptionID)}`, {
    method: "POST",
    body: encodedFormBody({ metadata: { accountUserID: targetUserID } })
  });
}

function appleStoreKitProductID() {
  return process.env.STOREKIT_PRO_PRODUCT_ID || "com.randycodex.permitext.pro.monthly";
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
  if (payload.productId !== appleStoreKitProductID()) {
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
    return [userID, "saved", codeVersion, sectionID].join(":");
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
  if (kind === "annotation") {
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
    if (sourceRecordID && sourceRecordID !== recordID) {
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

function canonicalCodeVersion(value) {
  const candidate = String(value || "").trim();
  const normalized = candidate.toLocaleLowerCase("en-US");
  if (
    !candidate ||
    normalized === "nyc-2022" ||
    normalized === "2022 construction codes" ||
    normalized === defaultSyncCodeVersion.toLocaleLowerCase("en-US")
  ) return defaultSyncCodeVersion;
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
  if (!mutationRecordID(mutation)) {
    return validationError("Mutation record is missing a stable ID.");
  }
  if (kind === "codeVersionClear" && !allowedCodeVersionClearScopes.has(String(record.values?.scope || ""))) {
    return validationError("Code-version clear mutations require a supported scope.");
  }
  if (!Number.isFinite(mutationUpdatedAt(mutation))) {
    return validationError("Mutation record is missing a valid updatedAt timestamp.");
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
    if (existingMutation && mutationUpdatedAt(mutation) < mutationUpdatedAt(existingMutation)) {
      rejectedMutationIDs.push(id);
      continue;
    }

    byID.set(id, mutation);
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
  const sessionToken = store.sessions[account.appUserID] || randomUUID();
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
      grantServerEntitlement(store, targetUserID, "webSubscription", {
        expiresAt: stripeSubscriptionExpiresAt(subscription),
        provider: {
          stripeCustomerID: stripeSubscriptionID(subscription.customer),
          stripeSubscriptionID: stripeSubscriptionID(subscription.id),
          restoredFromUserID: sourceUserID
        }
      });
      await transferStripeSubscriptionMetadata(subscription.id, targetUserID);
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

async function handleWorkboardAssetUpload(request, response) {
  const userID = String(request.headers["x-permitext-user-id"] || "").trim();
  const url = requestURL(request);
  const projectID = String(url.searchParams.get("projectID") || "").trim();
  const fileID = String(url.searchParams.get("fileID") || "").trim();
  if (!userID || !projectID || !fileID || projectID.length > 200 || fileID.length > 200) {
    sendError(response, 400, "Missing or invalid Workboard asset identity.");
    return;
  }
  if (!await authenticatedUserContext(request, response, userID)) return;
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
  const pathname = workboardAssetPathname(userID, projectID, fileID, contentType);
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
  if (!pathname.startsWith(workboardAssetPrefix(userID, projectID))) {
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
    "cache-control": "private, max-age=3600",
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
  const prefix = workboardAssetPrefix(userID, projectID);
  if (pathnames.some((pathname) => !pathname.startsWith(prefix))) {
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

  const canonicalizedBatch = await canonicalizeMutationBatch(body.batch?.mutations || []);
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
    const result = await adapter.pushUserContent(userID, incoming);
    sendJSON(response, 200, {
      acceptedMutationIDs: includeSubmittedMutationIDAliases(
        result.acceptedMutationIDs,
        canonicalizedBatch.aliasesByCanonicalID
      ),
      rejectedMutationIDs: includeSubmittedMutationIDAliases(
        result.rejectedMutationIDs,
        canonicalizedBatch.aliasesByCanonicalID
      ),
      latestEventID: result.latestEventID,
      syncRevision: result.latestEventID,
      entitlement: result.entitlement,
      serverTime: new Date().toISOString()
    });
    return;
  }

  const store = await readStore();
  if (!await authenticatedUserContext(request, response, userID, undefined, store)) {
    return;
  }
  store.users[userID] = body.batch?.user ? { ...(store.users[userID] || {}), ...body.batch.user } : store.users[userID];

  const existing = await canonicalizeMutations(store.mutationsByUserID[userID] || []);
  const merge = mergeMutations(existing, incoming);
  store.mutationsByUserID[userID] = merge.mutations;
  await writeStore(store);
  const latestEventID = await latestSyncEventID(userID);
  sendJSON(response, 200, {
    acceptedMutationIDs: includeSubmittedMutationIDAliases(
      merge.acceptedMutationIDs,
      canonicalizedBatch.aliasesByCanonicalID
    ),
    rejectedMutationIDs: includeSubmittedMutationIDAliases(
      merge.rejectedMutationIDs,
      canonicalizedBatch.aliasesByCanonicalID
    ),
    latestEventID,
    syncRevision: latestEventID,
    entitlement: store.entitlements[userID] || null,
    serverTime: new Date().toISOString()
  });
}

async function handlePull(request, response) {
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
  const adapter = await storeAdapter();
  if (typeof adapter.pullUserContent === "function") {
    const context = await authenticatedUserContext(request, response, userID);
    if (!context) {
      return;
    }
    const result = await adapter.pullUserContent(userID, { since, sinceEventID });
    const expanded = expandPullMutationsWithDependencies(result.mutations, result.allMutations);
    const mutations = await canonicalizeMutations(expanded);
    sendJSON(response, 200, {
      userID,
      pulledAt: new Date().toISOString(),
      latestEventID: result.latestEventID,
      syncRevision: result.latestEventID,
      contentMapVersion,
      entitlement: result.entitlement,
      mutations
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
  const mutations = await canonicalizeMutations(expandPullMutationsWithDependencies(filteredMutations, allMutations));
  const latestEventID = await latestSyncEventID(userID);
  sendJSON(response, 200, {
    userID,
    pulledAt: new Date().toISOString(),
    latestEventID,
    syncRevision: latestEventID,
    contentMapVersion,
    entitlement: store.entitlements[userID] || null,
    mutations
  });
}

async function handleWebCheckout(request, response) {
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

  if (!await authenticatedUserContext(request, response, userID)) {
    return;
  }

  const baseURL = configuredPublicBaseURL(request);
  const successURL = body.successURL || `${baseURL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelURL = body.cancelURL || `${baseURL}/?checkout=cancel`;
  const formBody = encodedFormBody({
    mode: "subscription",
    client_reference_id: userID,
    success_url: successURL,
    cancel_url: cancelURL,
    allow_promotion_codes: true,
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    metadata: { accountUserID: userID },
    subscription_data: {
      metadata: { accountUserID: userID }
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

  let customerID = stripeSubscriptionID(context.entitlement?.provider?.stripeCustomerID);
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
    return stripeAPI(`/v1/subscriptions/${encodeURIComponent(trimmed)}`);
  }
  if (trimmed.startsWith("cs_")) {
    const session = await stripeAPI(`/v1/checkout/sessions/${encodeURIComponent(trimmed)}`);
    const subscriptionID = stripeSubscriptionID(session.subscription);
    if (!subscriptionID) {
      throw new ClientAuthError(404, "Checkout session has no subscription.");
    }
    return stripeAPI(`/v1/subscriptions/${encodeURIComponent(subscriptionID)}`);
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

  if (!await authenticatedUserContext(request, response, userID)) {
    return;
  }

  let subscription;
  try {
    subscription = await stripeSubscriptionFromRestoreID(body.restoreID || body.subscriptionID || body.checkoutSessionID);
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

  const entitlement = await persistServerEntitlement(userID, "webSubscription", {
    expiresAt: stripeSubscriptionExpiresAt(subscription),
    provider: {
      stripeCustomerID: stripeSubscriptionID(subscription.customer),
      stripeSubscriptionID: stripeSubscriptionID(subscription.id),
      restoredManually: true
    }
  });
  await transferStripeSubscriptionMetadata(subscription.id, userID);
  sendJSON(response, 200, {
    entitlement,
    subscription: {
      id: subscription.id,
      status: subscription.status
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
    if (userID && (object.mode === "subscription" || object.payment_status === "paid")) {
      await persistServerEntitlement(userID, "webSubscription", {
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: stripeSubscriptionID(object.subscription),
          stripeCheckoutSessionID: object.id
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
    if (userID && ["active", "trialing"].includes(object.status)) {
      await persistServerEntitlement(userID, "webSubscription", {
        expiresAt: stripeSubscriptionExpiresAt(object),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: subscriptionID
        }
      });
      changed = true;
    } else if (subscriptionID && ["canceled", "incomplete_expired", "unpaid", "paused"].includes(object.status)) {
      const owner = await persistedStripeEntitlementOwner(subscriptionID);
      changed = owner ? await deletePersistedEntitlement(owner.userID, {
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
    changed = owner ? await deletePersistedEntitlement(owner.userID, {
      source: "webSubscription",
      providerKey: "stripeSubscriptionID",
      providerValue: subscriptionID
    }) : false;
    break;
  }
  case "invoice.payment_succeeded": {
    const userID = stripeUserIDFromObject(object);
    const subscriptionID = stripeSubscriptionIDFromObject(object);
    if (userID && subscriptionID) {
      await persistServerEntitlement(userID, "webSubscription", {
        expiresAt: stripeSubscriptionExpiresAt(object),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: subscriptionID
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
    const removed = await deletePersistedEntitlement(userID, {
      source: "appleSubscription",
      providerKey: "appleOriginalTransactionID",
      providerValue: originalTransactionID
    });
    sendJSON(response, 200, {
      entitlement: removed ? null : accountContext.entitlement || null,
      transaction: { active: false }
    });
    return;
  }

  const entitlement = await persistAppleServerEntitlement(userID, originalTransactionID, {
    expiresAt: appleTransactionExpiration(payload),
    provider
  });
  if (!entitlement) {
    sendError(response, 409, "This Apple purchase is already linked to another Permitext account.");
    return;
  }
  sendJSON(response, 200, { entitlement, transaction: { active: true, productID: payload.productId } });
}

async function handleLifetimeGrant(request, response) {
  if (!requireAdmin(request, response)) {
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
  if (!requireAdmin(request, response)) {
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
      details: [{ appID, paths: ["/open/section/*"] }]
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
    let account = await accountFromCredential({
      provider: "apple",
      displayName: displayName || null,
      signedInAt: new Date().toISOString(),
      identityToken,
      authorizationCode: form.get("code") || undefined
    });
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
    const sessionToken = store.sessions[account.appUserID] || randomUUID();
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

const handlers = {
  "account/sign-in": handleSignIn,
  "account/sign-out": handleSignOut,
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
  "research/conversations/create": handleResearchConversationCreate,
  "research/conversations/evidence": handleResearchConversationEvidence,
  "research/conversations/refresh": handleResearchConversationRefresh,
  "research/conversations/message": handleResearchConversationMessage,
  "research/conversations/delete": handleResearchConversationDelete,
  "research/usage": handleResearchUsage,
  "research/feedback": handleResearchFeedback,
  "internal/evaluations/data": handleInternalEvaluationData,
  "internal/evaluations/review": handleInternalEvaluationReview,
  "internal/evaluations/feedback/triage": handleInternalFeedbackTriage,
  "workboards/assets/upload": handleWorkboardAssetUpload,
  "workboards/assets/read": handleWorkboardAssetRead,
  "workboards/assets/delete": handleWorkboardAssetDelete,
  "sync/push": handlePush,
  "sync/pull": handlePull,
  "admin/lifetime-grants/grant": handleLifetimeGrant,
  "admin/lifetime-grants/revoke": handleLifetimeGrantDelete,
  "admin/accounts/delete-legacy-passkey-users": handleLegacyPasskeyAccountDelete,
  "admin/accounts/restore-checklist": handleRestoreChecklist,
  "admin/accounts/export": handleAccountExport,
  "admin/storage/summary": handleStorageSummary
};

export async function handleRequest(request, response) {
  try {
    const path = normalizePath(request.url);
    if (!enforceRateLimit(request, response, path)) {
      return;
    }

    if (
      request.method === "GET" &&
      (
        path === "" ||
        path === "web" ||
        path === "web/" ||
        path === "detached-workboard" ||
        path.startsWith("open/section/")
      )
    ) {
      await handleWebIndex(request, response);
      return;
    }
    if (request.method === "GET" && (path === "internal" || path === "internal/" || path.startsWith("internal/"))) {
      await handleInternalStatic(request, path, response);
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
      sendJSON(response, 200, { ok: true, storage: await storageKind(), schema: await storageSchema() });
      return;
    }
    if (request.method === "GET" && path === "admin/storage/summary") {
      await handleStorageSummary(request, response);
      return;
    }
    if (request.method === "GET" && path === "account/apple-web-config") {
      handleAppleWebConfig(request, response);
      return;
    }
    if ((request.method === "GET" || request.method === "POST") && path === "account/apple/callback") {
      handleAppleWebCallback(request, response);
      return;
    }
    if (request.method === "GET" && path === ".well-known/apple-app-site-association") {
      handleAppleAppSiteAssociation(request, response);
      return;
    }
    if (request.method !== "POST") {
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
