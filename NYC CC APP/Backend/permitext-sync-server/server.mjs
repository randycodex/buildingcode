import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.PERMITEXT_SYNC_DATA_PATH || join(__dirname, "data", "sync-store.json");
const port = Number(process.env.PORT || 8787);

const emptyStore = () => ({
  users: {},
  entitlements: {},
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

async function readStore() {
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

async function writeStore(store) {
  await mkdir(dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(store, null, 2) + "\n");
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

function compactMutations(mutations) {
  const byID = new Map();
  for (const mutation of mutations) {
    const id = mutationRecordID(mutation);
    if (!id) {
      continue;
    }
    const existing = byID.get(id);
    if (!existing || mutationUpdatedAt(mutation) >= mutationUpdatedAt(existing)) {
      byID.set(id, mutation);
    }
  }
  return Array.from(byID.values()).sort((left, right) => {
    const leftID = mutationRecordID(left) || "";
    const rightID = mutationRecordID(right) || "";
    return leftID.localeCompare(rightID);
  });
}

async function handleSignIn(request, response) {
  const body = await readJSON(request);
  const account = accountFromCredential(body.credential);
  const store = await readStore();
  const existing = store.users[account.appUserID];
  const storedAccount = existing ? { ...account, ...existing, signedInAt: account.signedInAt } : account;
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
  const migratedAccount = { ...account, migrationState: "localDataAttached" };
  store.users[account.appUserID] = migratedAccount;
  await writeStore(store);
  sendJSON(response, 200, "localDataAttached");
}

async function handlePush(request, response) {
  const body = await readJSON(request);
  const userID = body.auth?.accountUserID || body.batch?.user?.id;
  if (!userID) {
    sendError(response, 400, "Missing user ID.");
    return;
  }

  const store = await readStore();
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
  store.mutationsByUserID[userID] = compactMutations([...existing, ...incoming]);
  await writeStore(store);
  sendJSON(response, 200, {
    acceptedMutationIDs: incoming.map(mutationRecordID).filter(Boolean),
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
  "sync/push": handlePush,
  "sync/pull": handlePull,
  "admin/lifetime-grants/grant": handleLifetimeGrant,
  "admin/lifetime-grants/revoke": handleLifetimeGrantDelete
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && normalizePath(request.url) === "health") {
      sendJSON(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && normalizePath(request.url) === ".well-known/apple-app-site-association") {
      handleAppleAppSiteAssociation(request, response);
      return;
    }
    if (request.method !== "POST") {
      sendError(response, 405, "Method not allowed.");
      return;
    }

    const handler = handlers[normalizePath(request.url)];
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
});

server.listen(port, () => {
  console.log(`Permitext sync server listening on http://localhost:${port}`);
  console.log(`Data file: ${dataPath}`);
});
