import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.PERMITEXT_SYNC_DATA_PATH || join(__dirname, "data", "sync-store.json");
const databaseURL =
  process.env.PERMITEXT_SYNC_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.STORAGE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

let cachedStoreAdapter = null;

const emptyStore = () => ({
  users: {},
  entitlements: {},
  sessions: {},
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

async function createPostgresStoreAdapter() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(databaseURL);
  let initialized = false;

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
        mutations_by_user_id JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      INSERT INTO permitext_sync_state (id)
      VALUES ('default')
      ON CONFLICT (id) DO NOTHING
    `;
    initialized = true;
  }

  return {
    kind: "postgres",
    async read() {
      await ensureSchema();
      const rows = await sql`
        SELECT users, entitlements, sessions, mutations_by_user_id
        FROM permitext_sync_state
        WHERE id = 'default'
        LIMIT 1
      `;
      const row = rows[0] || {};
      return {
        users: safeJSON(row.users, {}),
        entitlements: safeJSON(row.entitlements, {}),
        sessions: safeJSON(row.sessions, {}),
        mutationsByUserID: safeJSON(row.mutations_by_user_id, {})
      };
    },
    async write(store) {
      await ensureSchema();
      await sql`
        INSERT INTO permitext_sync_state (
          id,
          users,
          entitlements,
          sessions,
          mutations_by_user_id,
          updated_at
        )
        VALUES (
          'default',
          ${JSON.stringify(store.users || {})}::jsonb,
          ${JSON.stringify(store.entitlements || {})}::jsonb,
          ${JSON.stringify(store.sessions || {})}::jsonb,
          ${JSON.stringify(store.mutationsByUserID || {})}::jsonb,
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          users = EXCLUDED.users,
          entitlements = EXCLUDED.entitlements,
          sessions = EXCLUDED.sessions,
          mutations_by_user_id = EXCLUDED.mutations_by_user_id,
          updated_at = EXCLUDED.updated_at
      `;
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
  if (!sessionToken) {
    return true;
  }

  const suppliedToken = bearerToken(request) || requestAccount?.backendSessionToken;
  if (suppliedToken !== sessionToken) {
    sendError(response, 401, "Unauthorized.");
    return false;
  }
  return true;
}

function normalizePath(url) {
  return new URL(url, "http://localhost").pathname.replace(/^\/+/, "");
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

async function handleSignIn(request, response) {
  const body = await readJSON(request);
  const account = accountFromCredential(body.credential);
  const store = await readStore();
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
  const migratedAccount = { ...account, migrationState: "localDataAttached" };
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
  const mutations = Number.isFinite(since)
    ? allMutations.filter((mutation) => mutationUpdatedAt(mutation) > since)
    : allMutations;
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
  "sync/push": handlePush,
  "sync/pull": handlePull,
  "admin/lifetime-grants/grant": handleLifetimeGrant,
  "admin/lifetime-grants/revoke": handleLifetimeGrantDelete
};

export async function handleRequest(request, response) {
  try {
    const path = normalizePath(request.url);

    if (request.method === "GET" && path === "health") {
      await readStore();
      sendJSON(response, 200, { ok: true, storage: await storageKind() });
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
