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
import { createPostgresSyncRepository } from "./postgres-sync-repository.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.PERMITEXT_SYNC_DATA_PATH || join(__dirname, "data", "sync-store.json");
const canonicalSectionIDsPath = join(__dirname, "config", "canonical-section-ids.json");
const webPublicPath = join(__dirname, "public");
const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const maxSyncMutationsPerBatch = 100;
const chapterContentPath = join(
  __dirname,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "chapters"
);
const chapterManifestPath = join(
  __dirname,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "manifest.json"
);
const sectionContentPath = join(
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
const assetContentPath = join(
  __dirname,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "assets"
);
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
let cachedSearchIndex = null;
let cachedSearchIndexPromise = null;
let cachedAppleJWKS = null;
let cachedAppleJWKSExpiresAt = 0;

const emptyStore = () => ({
  users: {},
  entitlements: {},
  sessions: {},
  passkeyCredentials: {},
  mutationsByUserID: {}
});

const allowedMutationKinds = new Set([
  "savedItem",
  "annotation",
  "project",
  "projectSection",
  "continuity",
  "codeVersionClear"
]);

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
          )
        },
        mutationCounts: mutationCountsByKind
      };
    }
  };
}

function storeHasData(store) {
  return Object.values({
    users: store.users,
    entitlements: store.entitlements,
    sessions: store.sessions,
    passkeyCredentials: store.passkeyCredentials,
    mutationsByUserID: store.mutationsByUserID
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
    return [record.userID, "code-version-clear", record.codeVersion].join(":");
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
      CREATE TABLE IF NOT EXISTS permitext_sessions (
        user_id TEXT PRIMARY KEY,
        session_token TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
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
        (SELECT count(*) FROM permitext_passkey_credentials)::int AS passkey_credentials,
        (SELECT count(*) FROM permitext_saved_items)::int AS saved_items,
        (SELECT count(*) FROM permitext_annotations)::int AS annotations,
        (SELECT count(*) FROM permitext_projects)::int AS projects,
        (SELECT count(*) FROM permitext_project_items)::int AS project_items,
        (SELECT count(*) FROM permitext_comments)::int AS comments,
        (SELECT count(*) FROM permitext_user_content_records)::int AS user_content_records,
        (SELECT count(*) FROM permitext_sync_events)::int AS sync_events,
        COALESCE((SELECT max(event_id) FROM permitext_sync_events), 0)::bigint AS latest_event_id
    `;
    const row = rows[0] || {};
    return {
      storage: "postgres",
      schema: "normalized-v2",
      latestEventID: Number(row.latest_event_id || 0),
      tables: {
        users: Number(row.users || 0),
        entitlements: Number(row.entitlements || 0),
        sessions: Number(row.sessions || 0),
        passkeyCredentials: Number(row.passkey_credentials || 0),
        savedItems: Number(row.saved_items || 0),
        annotations: Number(row.annotations || 0),
        projects: Number(row.projects || 0),
        projectItems: Number(row.project_items || 0),
        comments: Number(row.comments || 0),
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
    const [users, entitlements, sessions, passkeyCredentials, mutations] = await Promise.all([
      sql`SELECT id, account FROM permitext_users ORDER BY id`,
      sql`SELECT user_id, entitlement FROM permitext_entitlements ORDER BY user_id`,
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
    schema: "normalized-v2",
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
    async userContext(userID) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return syncRepository.userContext(userID);
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

async function readJSON(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length ? JSON.parse(raw) : {};
}

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJSON(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function sendRawJSON(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendError(response, status, message) {
  sendJSON(response, status, { error: message });
}

function sendHTML(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function sendStatic(response, contentType, body) {
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-store"
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

function requireUserSession(request, response, store, userID, requestAccount) {
  return requireSessionToken(request, response, store.sessions[userID], requestAccount);
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

function normalizePath(url) {
  return new URL(url, "http://localhost").pathname.replace(/^\/+/, "");
}

function requestURL(request) {
  return new URL(request.url, "http://localhost");
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
  try {
    const payload = await readJSONFile(join(sectionContentPath, `${key}.json`));
    blockIDs = (payload.blocks || []).flatMap(htmlParagraphBlockIDs);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
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

async function searchIndex() {
  if (cachedSearchIndex) {
    return cachedSearchIndex;
  }
  if (cachedSearchIndexPromise) {
    return cachedSearchIndexPromise;
  }
  cachedSearchIndexPromise = buildSearchIndex();
  try {
    cachedSearchIndex = await cachedSearchIndexPromise;
    return cachedSearchIndex;
  } finally {
    cachedSearchIndexPromise = null;
  }
}

async function buildSearchIndex() {
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
        chapterNumber: chapterSummary.chapterNumber,
        sectionNumber: section.sectionNumber,
        title: section.title,
        headerLine: section.headerLine,
        headingLine: section.headingLine
      });
    }
  }

  const index = [];
  for (let start = 0; start < sectionSummaries.length; start += 150) {
    const batch = sectionSummaries.slice(start, start + 150);
    const entries = await Promise.all(
      batch.map(async (section) => {
        const body = await sectionBody(section.webSectionID || section.id, { allowMissing: true });
        const plainText = body.blocks?.map((block) => block.plainText || "").join("\n\n") || "";
        return { ...section, plainText };
      })
    );
    index.push(...entries);
  }
  return index;
}

async function sectionBody(sectionID, options = {}) {
  try {
    return await readJSONFile(join(sectionContentPath, `${sectionID}.json`));
  } catch (error) {
    if (options.allowMissing && error.code === "ENOENT") {
      return { blocks: [], sectionID };
    }
    throw error;
  }
}

async function sectionSummaryByID(sectionID) {
  const chapters = await chapterIndex();
  for (const chapterSummary of chapters) {
    const chapter = await readJSONFile(join(chapterContentPath, `${chapterSummary.id}.json`));
    const sections = await canonicalizeChapterSections(flattenChapterSections(chapter), {
      codePrefix: chapterSummary.codePrefix,
      chapterNumber: chapterSummary.chapterNumber
    });
    const section = sections.find((item) =>
      String(item.id) === String(sectionID) ||
      String(item.webSectionID || "") === String(sectionID)
    );
    if (section) {
      return {
        ...section,
        chapterID: chapterSummary.id,
        chapterNumber: chapterSummary.chapterNumber
      };
    }
  }
  return null;
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

async function handleWebStatic(path, response) {
  const fileName = path.replace(/^web\//, "");
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    sendNotFound(response);
    return;
  }
  try {
    const filePath = join(webPublicPath, fileName);
    sendStatic(response, contentTypeForPath(filePath), await readFile(filePath));
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
    sendStatic(response, contentTypeForPath(filePath), await readFile(filePath));
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
  const sectionPayload = includeBody
    ? await Promise.all(sections.map(async (section) => ({
        ...section,
        blocks: (await sectionBody(section.id, { allowMissing: true })).blocks || []
      })))
    : sections;
  const canonicalSections = await canonicalizeChapterSections(sectionPayload, {
    codePrefix,
    chapterNumber
  });

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
      sections: canonicalSections
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
  const body = await sectionBody(summary?.webSectionID || sectionID, { allowMissing: true });
  if (!body.blocks?.length) {
    if (summary) {
      sendJSON(response, 200, {
        section: {
          blocks: [{ id: `${sectionID}-title`, kind: "title", plainText: summary.title || "" }],
          chapterNumber: summary.chapterNumber,
          schemaVersion: 1,
          sectionID: Number(summary.id || sectionID),
          webSectionID: summary.webSectionID || null
        }
      });
      return;
    }
  }
  sendJSON(response, 200, {
    section: {
      ...body,
      sectionID: Number(summary?.id || body.sectionID || sectionID),
      webSectionID: summary?.webSectionID || body.webSectionID || null
    }
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
  const results = [];
  let totalResults = 0;
  for (const section of await searchIndex()) {
    const matchesCode = codeFilter.size === 0 || codeFilter.has(section.codePrefix);
    const sectionText = section.plainText || "";
    const matchesQuery =
      section.title?.toLowerCase().includes(normalizedQuery) ||
      section.sectionNumber?.toLowerCase().includes(normalizedQuery) ||
      sectionText.toLowerCase().includes(normalizedQuery);
    if (!matchesCode || !matchesQuery) continue;

    totalResults += 1;
    if (resultLimit && results.length >= resultLimit) continue;
    results.push({
      id: section.id,
      chapterID: section.chapterID,
      codePrefix: section.codePrefix,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      headerLine: section.headerLine,
      headingLine: section.headingLine,
      snippet: searchSnippet(sectionText || section.title || "", query)
    });
  }
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

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID);
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
    throw new ClientAuthError(401, "Apple transaction certificate chain is missing.");
  }

  const certificates = x5c.map(x509CertificateFromX5C);
  const now = Date.now();
  for (const certificate of certificates) {
    if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) < now) {
      throw new ClientAuthError(401, "Apple transaction certificate is not currently valid.");
    }
  }

  for (let index = 0; index < certificates.length - 1; index += 1) {
    const certificate = certificates[index];
    const issuer = certificates[index + 1];
    if (!certificate.checkIssued(issuer) || !certificate.verify(issuer.publicKey)) {
      throw new ClientAuthError(401, "Apple transaction certificate chain is invalid.");
    }
  }

  const root = certificates[certificates.length - 1];
  const allowedFingerprints = configuredAppleRootFingerprints();
  if (process.env.PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN === "1" && allowedFingerprints.length === 0) {
    throw new ClientAuthError(500, "Apple transaction root fingerprints are not configured.");
  }
  if (allowedFingerprints.length > 0 && !allowedFingerprints.includes(certificateFingerprint(root))) {
    throw new ClientAuthError(401, "Apple transaction root certificate is not trusted.");
  }
  if (allowedFingerprints.length === 0 && !/Apple/.test(root.subject)) {
    throw new ClientAuthError(401, "Apple transaction root certificate is not recognized.");
  }

  return certificates[0].publicKey;
}

function ecdsaJoseToDER(signature) {
  if (signature.length % 2 !== 0) {
    throw new ClientAuthError(401, "Invalid Apple transaction signature.");
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

function verifyAppleTransactionJWS(signedTransactionInfo) {
  const parts = String(signedTransactionInfo || "").split(".");
  if (parts.length !== 3) {
    throw new ClientAuthError(401, "Invalid Apple transaction.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJWTPart(encodedHeader);
  const payload = parseJWTPart(encodedPayload);
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || !header.x5c[0]) {
    throw new ClientAuthError(401, "Unsupported Apple transaction.");
  }

  const publicKey = verifyAppleTransactionCertificateChain(header.x5c);
  const signatureOK = verifySignature(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    ecdsaJoseToDER(decodeBase64URL(encodedSignature))
  );
  if (!signatureOK) {
    throw new ClientAuthError(401, "Apple transaction signature is invalid.");
  }

  const bundleID = process.env.APPLE_BUNDLE_ID;
  if (bundleID && payload.bundleId !== bundleID) {
    throw new ClientAuthError(401, "Apple transaction bundle is invalid.");
  }
  if (payload.productId !== appleStoreKitProductID()) {
    throw new ClientAuthError(401, "Apple transaction product is invalid.");
  }

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
    return [record.userID, "code-version-clear", record.codeVersion].join(":");
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
      record.clientID || record.id || record.localFolderID || null
    ].filter(Boolean).join(":");
  }
  if (kind === "projectSection") {
    return [
      userID,
      "project-section",
      codeVersion,
      record.folderClientID || record.localFolderID || null,
      sectionID,
      record.scope || null
    ].filter(Boolean).join(":");
  }
  return record.id || null;
}

async function canonicalizeSectionRecord(kind, record) {
  if (!["savedItem", "annotation", "project", "projectSection"].includes(kind)) {
    return record;
  }
  const codeVersion = canonicalCodeVersion(record.codeVersion);
  if (kind === "project") {
    const normalized = { ...record, codeVersion };
    const nextID = canonicalMutationRecordID(kind, normalized);
    return nextID ? { ...normalized, id: nextID } : normalized;
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

async function canonicalizeMutations(mutations) {
  return Promise.all((mutations || []).map(canonicalizeMutation));
}

function canonicalCodeVersion(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate === "nyc-2022") return defaultSyncCodeVersion;
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
  if (!Number.isFinite(mutationUpdatedAt(mutation))) {
    return validationError("Mutation record is missing a valid updatedAt timestamp.");
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
  const store = await readStore();
  let account;
  try {
    account = await accountFromCredential(credential);
    account = await canonicalizeAppleAccountForSignIn(store, account);
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
  const sessionToken = store.sessions[account.appUserID] || randomUUID();
  store.sessions[account.appUserID] = sessionToken;
  const existing = store.users[account.appUserID];
  const storedAccount = existing
    ? { ...account, ...existing, signedInAt: account.signedInAt, backendSessionToken: sessionToken }
    : { ...account, backendSessionToken: sessionToken };
  store.users[account.appUserID] = storedAccount;
  let mergedAccount = null;
  const linkFrom = body.linkFrom || {};
  const sourceUserID = linkFrom.accountUserID || linkFrom.userID;
  if (sourceUserID && sourceUserID !== account.appUserID) {
    const sourceSessionToken = linkFrom.sessionToken || linkFrom.backendSessionToken;
    if (!requireUserSession(request, response, store, sourceUserID, { backendSessionToken: sourceSessionToken })) {
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, targetUserID)) {
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, account.appUserID, account)) {
    return;
  }
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
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

  const incoming = await canonicalizeMutations(body.batch?.mutations || []);
  const validation = validateMutations(incoming, userID);
  if (!validation.ok) {
    sendError(response, 400, validation.message);
    return;
  }

  const adapter = await storeAdapter();
  if (typeof adapter.pushUserContent === "function" && typeof adapter.userContext === "function") {
    const context = await adapter.userContext(userID);
    if (!requireSessionToken(request, response, context?.sessionToken)) {
      return;
    }
    const result = await adapter.pushUserContent(userID, incoming);
    sendJSON(response, 200, {
      acceptedMutationIDs: result.acceptedMutationIDs,
      rejectedMutationIDs: result.rejectedMutationIDs,
      latestEventID: result.latestEventID,
      syncRevision: result.latestEventID,
      entitlement: result.entitlement,
      serverTime: new Date().toISOString()
    });
    return;
  }

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
    return;
  }
  store.users[userID] = body.batch?.user ? { ...(store.users[userID] || {}), ...body.batch.user } : store.users[userID];

  const existing = await canonicalizeMutations(store.mutationsByUserID[userID] || []);
  const merge = mergeMutations(existing, incoming);
  store.mutationsByUserID[userID] = merge.mutations;
  await writeStore(store);
  const latestEventID = await latestSyncEventID(userID);
  sendJSON(response, 200, {
    acceptedMutationIDs: merge.acceptedMutationIDs,
    rejectedMutationIDs: merge.rejectedMutationIDs,
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
  if (typeof adapter.pullUserContent === "function" && typeof adapter.userContext === "function") {
    const context = await adapter.userContext(userID);
    if (!requireSessionToken(request, response, context?.sessionToken)) {
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
  if (!requireUserSession(request, response, store, userID)) {
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
  if (!stripeConfigured()) {
    sendError(response, 503, "Stripe checkout is not configured.");
    return;
  }

  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
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

  sendJSON(response, 200, {
    checkoutSessionID: json.id,
    url: json.url
  });
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
  if (!stripeConfigured()) {
    sendError(response, 503, "Stripe restore is not configured.");
    return;
  }

  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
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

  grantServerEntitlement(store, userID, "webSubscription", {
    expiresAt: stripeSubscriptionExpiresAt(subscription),
    provider: {
      stripeCustomerID: stripeSubscriptionID(subscription.customer),
      stripeSubscriptionID: stripeSubscriptionID(subscription.id),
      restoredManually: true
    }
  });
  await transferStripeSubscriptionMetadata(subscription.id, userID);
  await writeStore(store);
  sendJSON(response, 200, {
    entitlement: store.entitlements[userID],
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
  const object = event?.data?.object || {};
  const store = await readStore();
  let changed = false;

  switch (event.type) {
  case "checkout.session.completed": {
    const userID = stripeUserIDFromObject(object);
    if (userID && (object.mode === "subscription" || object.payment_status === "paid")) {
      grantServerEntitlement(store, userID, "webSubscription", {
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
      grantServerEntitlement(store, userID, "webSubscription", {
        expiresAt: stripeSubscriptionExpiresAt(object),
        provider: {
          stripeCustomerID: stripeSubscriptionID(object.customer),
          stripeSubscriptionID: subscriptionID
        }
      });
      changed = true;
    } else if (subscriptionID && ["canceled", "incomplete_expired", "unpaid", "paused"].includes(object.status)) {
      const ownerUserID = findUserIDForStripeSubscription(store, subscriptionID);
      changed = ownerUserID ? revokeServerEntitlement(store, ownerUserID, entitlementMatchesStripeSubscription(subscriptionID)) : false;
    }
    break;
  }
  case "customer.subscription.deleted": {
    const subscriptionID = stripeSubscriptionID(object);
    const ownerUserID = findUserIDForStripeSubscription(store, subscriptionID);
    changed = ownerUserID ? revokeServerEntitlement(store, ownerUserID, entitlementMatchesStripeSubscription(subscriptionID)) : false;
    break;
  }
  case "invoice.payment_succeeded": {
    const userID = stripeUserIDFromObject(object);
    const subscriptionID = stripeSubscriptionIDFromObject(object);
    if (userID && subscriptionID) {
      grantServerEntitlement(store, userID, "webSubscription", {
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

  if (changed) {
    await writeStore(store);
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
    return;
  }

  let payload;
  try {
    payload = verifyAppleTransactionJWS(body.signedTransactionInfo);
  } catch (error) {
    if (error instanceof ClientAuthError) {
      sendError(response, error.statusCode, error.message);
      return;
    }
    throw error;
  }

  const transactionID = String(payload.transactionId || "");
  const originalTransactionID = String(payload.originalTransactionId || transactionID);
  const provider = {
    appleTransactionID: transactionID,
    appleOriginalTransactionID: originalTransactionID,
    appleWebOrderLineItemID: payload.webOrderLineItemId || null,
    appleEnvironment: payload.environment || null
  };

  if (!appleTransactionActive(payload)) {
    revokeServerEntitlement(store, userID, (entitlement) =>
      entitlement?.source === "appleSubscription" &&
      entitlement?.provider?.appleOriginalTransactionID === originalTransactionID
    );
    await writeStore(store);
    sendJSON(response, 200, { entitlement: store.entitlements[userID] || null, transaction: { active: false } });
    return;
  }

  const entitlement = grantServerEntitlement(store, userID, "appleSubscription", {
    expiresAt: appleTransactionExpiration(payload),
    provider
  });
  await writeStore(store);
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

  const store = await readStore();
  const entitlement = grantServerEntitlement(store, userID, "lifetimeGrant");
  await writeStore(store);
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

  const store = await readStore();
  delete store.entitlements[userID];
  await writeStore(store);
  sendJSON(response, 200, { userID, entitlement: null });
}

async function handleLegacyPasskeyAccountDelete(request, response) {
  if (!requireAdmin(request, response)) {
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
    hasSession: Boolean(store.sessions[userID]),
    passkeyCredentialCount: passkeyCredentialIDs.length,
    passkeyCredentialIDs,
    mutationCounts: {
      savedItem: counts.savedItem || 0,
      annotation: counts.annotation || 0,
      project: counts.project || 0,
      projectSection: counts.projectSection || 0,
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
    hasSession: Boolean(store.sessions[userID]),
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
  sendRawJSON(response, 200, {
    webcredentials: {
      apps: [`${teamID}.${bundleID}`]
    },
    applinks: {
      apps: [],
      details: []
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
    if (!requireUserSession(request, response, store, linkFromUserID, {
      backendSessionToken: body.linkFrom?.sessionToken || body.linkFrom?.backendSessionToken
    })) {
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

function appleCallbackHTML({ title, message, accountState = null, successPath = "/" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>permitext sign in</title>
  </head>
  <body>
    <p>${htmlEscape(message)}</p>
    <script>
      const accountState = ${scriptJSON(accountState)};
      if (accountState) {
        const workspaceKey = "permitext:webWorkspace:v1";
        const saved = JSON.parse(localStorage.getItem(workspaceKey) || "{}");
        saved.account = accountState;
        localStorage.setItem(workspaceKey, JSON.stringify(saved));
      }
      window.location.replace(${scriptJSON(successPath)});
    </script>
  </body>
</html>`;
}

async function handleAppleWebCallback(request, response) {
  if (request.method !== "POST") {
    sendHTML(response, appleCallbackHTML({
      title: "permitext sign in",
      message: "Return to permitext and use Link Apple from Settings.",
      successPath: "/"
    }));
    return;
  }

  const form = new URLSearchParams((await readRawBody(request)).toString("utf8"));
  const oauthState = verifyOAuthStateCookie(decodeURIComponent(cookieValue(request, "permitext_apple_oauth") || ""));
  const clearCookie = appleOAuthCookie(request, "", 0);
  const sendCallbackHTML = (html) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": clearCookie
    });
    response.end(html);
  };

  if (!oauthState || form.get("state") !== oauthState.state) {
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple sign-in could not be verified. Return to permitext and try again.",
      successPath: "/?appleSignIn=failed"
    }));
    return;
  }

  const identityToken = form.get("id_token");
  if (!identityToken) {
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple did not return an identity token. Return to permitext and try again.",
      successPath: oauthState.successPath || "/"
    }));
    return;
  }

  try {
    const user = JSON.parse(form.get("user") || "{}");
    const displayName = [user.name?.firstName, user.name?.lastName]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
    const store = await readStore();
    let account = await accountFromCredential({
      provider: "apple",
      displayName: displayName || null,
      signedInAt: new Date().toISOString(),
      identityToken,
      authorizationCode: form.get("code") || undefined
    });
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
        entitlement: store.entitlements[account.appUserID] || null
      },
      successPath: oauthState.successPath || "/"
    }));
  } catch (error) {
    console.error(error);
    sendCallbackHTML(appleCallbackHTML({
      title: "permitext sign in",
      message: "Apple sign-in failed. Return to permitext and try again.",
      successPath: oauthState.successPath || "/"
    }));
  }
}

const handlers = {
  "account/sign-in": handleSignIn,
  "account/apple/start": handleAppleWebStart,
  "account/attach-local-data": handleAttachLocalData,
  "account/link-browser": handleBrowserAccountLink,
  "account/profile": handleProfileUpdate,
  "account/passkeys/link": handlePasskeyLink,
  "billing/web/checkout": handleWebCheckout,
  "billing/stripe/restore": handleStripeRestore,
  "billing/stripe/webhook": handleStripeWebhook,
  "billing/apple/transactions/verify": handleAppleTransactionVerify,
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

    if (request.method === "GET" && (path === "" || path === "web" || path === "web/")) {
      await handleWebIndex(request, response);
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
    if (request.method === "GET" && path.startsWith("code/sections/")) {
      await handleCodeSection(path, response);
      return;
    }
    if (request.method === "GET" && path === "code/search") {
      await handleCodeSearch(request, response);
      return;
    }
    if (request.method === "GET" && path === "health") {
      await readStore();
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
    console.error(error);
    if (error instanceof SyntaxError) {
      sendError(response, 400, "Invalid JSON.");
      return;
    }
    sendError(response, 500, "Internal server error.");
  }
}
