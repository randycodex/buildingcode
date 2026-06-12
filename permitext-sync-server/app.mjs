import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.PERMITEXT_SYNC_DATA_PATH || join(__dirname, "data", "sync-store.json");
const webPublicPath = join(__dirname, "public");
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
let cachedSearchIndex = null;

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

async function createPostgresStoreAdapter() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(databaseURL);
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
    const existingMutations = await sql`SELECT record_id FROM permitext_user_content_records`;
    for (const row of existingMutations) {
      if (!desiredMutationIDs.has(row.record_id)) {
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
      sql`SELECT user_id, mutation FROM permitext_user_content_records ORDER BY user_id, record_id`
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
        (SELECT count(*) FROM permitext_user_content_records)
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
    schema: "normalized-v1",
    async read() {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      return readNormalizedStore();
    },
    async write(store) {
      await ensureSchema();
      await migrateLegacyStateIfNeeded();
      await writeNormalizedStore(store);
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

async function readJSON(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length ? JSON.parse(raw) : {};
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
  const sessionToken = store.sessions[userID];
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
  const chapters = await chapterIndex();
  const sectionSummaries = [];
  for (const chapterSummary of chapters) {
    const chapter = await readJSONFile(join(chapterContentPath, `${chapterSummary.id}.json`));
    for (const section of flattenChapterSections(chapter)) {
      sectionSummaries.push({
        id: section.id,
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
        const body = await sectionBody(section.id, { allowMissing: true });
        const plainText = body.blocks?.map((block) => block.plainText || "").join("\n\n") || "";
        return { ...section, plainText };
      })
    );
    index.push(...entries);
  }
  cachedSearchIndex = index;
  return cachedSearchIndex;
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
    const section = flattenChapterSections(chapter).find((item) => String(item.id) === String(sectionID));
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
  const sections = flattenChapterSections(chapter);
  const sectionPayload = includeBody
    ? await Promise.all(sections.map(async (section) => ({
        ...section,
        blocks: (await sectionBody(section.id, { allowMissing: true })).blocks || []
      })))
    : sections;

  sendJSON(response, 200, {
    chapter: {
      id: chapter.chapterID,
      codePrefix: codePrefixForChapter(chapter, manifestChapter),
      codeSectionID: manifestChapter?.codeSectionID || null,
      chapterNumber: manifestChapter?.chapterNumber || chapter.chapterNumber,
      displayTitle: displayTitleForChapter({
        ...chapter,
        chapterNumber: manifestChapter?.chapterNumber || chapter.chapterNumber
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
  const body = await sectionBody(sectionID, { allowMissing: true });
  if (!body.blocks?.length) {
    const summary = await sectionSummaryByID(sectionID);
    if (summary) {
      sendJSON(response, 200, {
        section: {
          blocks: [{ id: `${sectionID}-title`, kind: "title", plainText: summary.title || "" }],
          chapterNumber: summary.chapterNumber,
          schemaVersion: 1,
          sectionID: Number(sectionID)
        }
      });
      return;
    }
  }
  sendJSON(response, 200, { section: body });
}

async function handleCodeSearch(request, response) {
  const url = requestURL(request);
  const query = url.searchParams.get("q")?.trim() || "";
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
  const results = (await searchIndex())
    .filter((section) => {
      const matchesCode = codeFilter.size === 0 || codeFilter.has(section.codePrefix);
      const matchesQuery =
        section.title?.toLowerCase().includes(normalizedQuery) ||
        section.sectionNumber?.toLowerCase().includes(normalizedQuery) ||
        section.plainText.toLowerCase().includes(normalizedQuery);
      return matchesCode && matchesQuery;
    })
    .map((section) => ({
      id: section.id,
      chapterID: section.chapterID,
      codePrefix: section.codePrefix,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      headerLine: section.headerLine,
      headingLine: section.headingLine,
      snippet: searchSnippet(section.plainText || section.title || "", query)
    }));
  sendJSON(response, 200, { query, results });
}

function accountFromCredential(credential) {
  const provider = credential?.provider || "guest";
  const providerUserID = credential?.providerUserID || "local-guest";
  return {
    appUserID: `${provider}:${providerUserID}`,
    authProvider: provider,
    authProviderUserID: providerUserID,
    appleUserID: provider === "apple" ? providerUserID : "",
    publicUsername: null,
    displayName: credential?.displayName ?? null,
    signedInAt: credential?.signedInAt || new Date().toISOString(),
    migrationState: "notStarted"
  };
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

async function handleSignIn(request, response) {
  const body = await readJSON(request);
  const store = await readStore();
  const credential = body.credential || {};
  const passkeyUserID = credential.provider === "passkey"
    ? store.passkeyCredentials?.[credential.providerUserID]
    : null;
  if (credential.provider === "passkey" && !passkeyUserID) {
    sendError(response, 404, "Passkey is not linked to an account yet.");
    return;
  }
  if (credential.provider === "passkey" && !store.users[passkeyUserID]) {
    sendError(response, 404, "Linked passkey account was not found.");
    return;
  }
  const account = passkeyUserID
    ? { ...store.users[passkeyUserID], signedInAt: credential.signedInAt || new Date().toISOString() }
    : accountFromCredential(credential);
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
  await writeStore(store);
  sendJSON(response, 200, {
    account: storedAccount,
    entitlement: store.entitlements[account.appUserID] ?? null
  });
}

async function handlePasskeyLink(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID;
  const credentialID = body.credentialID;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }
  if (!credentialID) {
    sendError(response, 400, "Missing passkey credential ID.");
    return;
  }

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID, body.auth)) {
    return;
  }
  const existingAccount = store.users[userID] || body.account;
  if (!existingAccount) {
    sendError(response, 404, "User not found.");
    return;
  }
  store.users[userID] = existingAccount;
  store.passkeyCredentials = {
    ...(store.passkeyCredentials || {}),
    [credentialID]: userID
  };
  await writeStore(store);
  sendJSON(response, 200, { account: existingAccount });
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
    return;
  }
  store.users[userID] = body.batch?.user ? { ...(store.users[userID] || {}), ...body.batch.user } : store.users[userID];
  if (body.batch?.entitlement) {
    store.entitlements[userID] = body.batch.entitlement;
  }

  if (body.batch?.mutations !== undefined && !Array.isArray(body.batch.mutations)) {
    sendError(response, 400, "Mutations must be an array.");
    return;
  }

  const incoming = body.batch?.mutations || [];
  const validation = validateMutations(incoming, userID);
  if (!validation.ok) {
    sendError(response, 400, validation.message);
    return;
  }

  const existing = store.mutationsByUserID[userID] || [];
  const merge = mergeMutations(existing, incoming);
  store.mutationsByUserID[userID] = merge.mutations;
  await writeStore(store);
  sendJSON(response, 200, {
    acceptedMutationIDs: merge.acceptedMutationIDs,
    rejectedMutationIDs: merge.rejectedMutationIDs,
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

  const store = await readStore();
  if (!requireUserSession(request, response, store, userID)) {
    return;
  }
  const since = body.since ? Date.parse(body.since) : null;
  const allMutations = store.mutationsByUserID[userID] || [];
  const filteredMutations = Number.isFinite(since)
    ? allMutations.filter((mutation) => mutationUpdatedAt(mutation) > since)
    : allMutations;
  const mutations = expandPullMutationsWithDependencies(filteredMutations, allMutations);
  sendJSON(response, 200, {
    userID,
    pulledAt: new Date().toISOString(),
    mutations
  });
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
  const entitlement = {
    plan: "pro",
    source: "lifetimeGrant",
    grantedUserID: userID
  };
  store.entitlements[userID] = entitlement;
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

const handlers = {
  "account/sign-in": handleSignIn,
  "account/attach-local-data": handleAttachLocalData,
  "account/profile": handleProfileUpdate,
  "account/passkeys/link": handlePasskeyLink,
  "sync/push": handlePush,
  "sync/pull": handlePull,
  "admin/lifetime-grants/grant": handleLifetimeGrant,
  "admin/lifetime-grants/revoke": handleLifetimeGrantDelete,
  "admin/accounts/delete-legacy-passkey-users": handleLegacyPasskeyAccountDelete,
  "admin/accounts/restore-checklist": handleRestoreChecklist,
  "admin/accounts/export": handleAccountExport
};

export async function handleRequest(request, response) {
  try {
    const path = normalizePath(request.url);

    if (request.method === "GET" && (path === "" || path === "web")) {
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
