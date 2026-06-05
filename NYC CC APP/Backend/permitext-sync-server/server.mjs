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

function sendError(response, status, message) {
  sendJSON(response, status, { error: message });
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

  const incoming = Array.isArray(body.batch?.mutations) ? body.batch.mutations : [];
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

const handlers = {
  "account/sign-in": handleSignIn,
  "account/attach-local-data": handleAttachLocalData,
  "sync/push": handlePush,
  "sync/pull": handlePull
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && normalizePath(request.url) === "health") {
      sendJSON(response, 200, { ok: true });
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
    sendError(response, 500, "Internal server error.");
  }
});

server.listen(port, () => {
  console.log(`Permitext sync server listening on http://localhost:${port}`);
  console.log(`Data file: ${dataPath}`);
});
