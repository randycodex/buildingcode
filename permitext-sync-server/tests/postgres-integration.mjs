import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const databaseURL =
  process.env.PERMITEXT_SYNC_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.STORAGE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

if (!databaseURL) {
  console.log("permitext postgres integration skipped: no database URL configured");
  process.exit(0);
}

const { neon } = await import("@neondatabase/serverless");

const port = Number(process.env.PERMITEXT_POSTGRES_TEST_PORT || 8796);
const baseURL = `http://127.0.0.1:${port}`;
const adminToken = "postgres-integration-admin-token";
const runID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const providerUserID = `postgres-integration-${runID}`;
const userID = `apple:${providerUserID}`;
const codeVersion = "nyc-2022";
const sql = neon(databaseURL);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const { response, json } = await request("/health");
      if (response.ok && json?.storage === "postgres") {
        return json;
      }
    } catch {
      await sleep(150);
    }
  }
  throw new Error("Postgres-backed server did not become ready.");
}

async function cleanupUser() {
  await sql`DELETE FROM permitext_sync_events WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_saved_items WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_annotations WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_projects WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_project_items WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_comments WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_user_content_records WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_passkey_credentials WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_sessions WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_entitlements WHERE user_id = ${userID}`;
  await sql`DELETE FROM permitext_users WHERE id = ${userID}`;
}

async function countRows(tableName) {
  let rows;
  if (tableName === "permitext_users") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_users WHERE id = ${userID}`;
  } else if (tableName === "permitext_saved_items") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_saved_items WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_annotations") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_annotations WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_projects") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_projects WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_project_items") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_project_items WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_user_content_records") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_user_content_records WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_sync_events") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_sync_events WHERE user_id = ${userID}`;
  } else {
    throw new Error(`Unsupported count table: ${tableName}`);
  }
  return Number(rows[0]?.count || 0);
}

const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    VERCEL: "",
    VERCEL_ENV: "",
    PERMITEXT_SYNC_DATABASE_URL: databaseURL,
    DATABASE_URL: "",
    STORAGE_URL: "",
    POSTGRES_URL: "",
    NEON_DATABASE_URL: "",
    PERMITEXT_SYNC_ADMIN_TOKEN: adminToken
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  const health = await waitForServer();
  assert(health.schema === "normalized-v2", `Expected normalized-v2 schema, received ${health.schema}.`);

  await cleanupUser();

  const unauthorizedSummary = await request("/admin/storage/summary");
  assert(unauthorizedSummary.response.status === 401, "Storage summary allowed an unauthenticated request.");

  const initialSummary = await request("/admin/storage/summary", { token: adminToken });
  assert(initialSummary.response.ok, "Initial storage summary failed.");
  assert(initialSummary.json.storage === "postgres", "Storage summary did not report postgres.");
  assert(initialSummary.json.schema === "normalized-v2", "Storage summary did not report normalized-v2.");
  assert(Number.isInteger(initialSummary.json.latestEventID), "Storage summary did not return latestEventID.");

  const signIn = await request("/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "apple",
        providerUserID,
        displayName: "Postgres Integration Smoke",
        signedInAt: new Date().toISOString()
      }
    }
  });
  assert(signIn.response.ok, "Sign-in failed.");
  assert(signIn.json.account.appUserID === userID, "Sign-in returned the wrong user.");
  const token = signIn.json.account.backendSessionToken;
  assert(token, "Sign-in did not return a session token.");

  const savedItem = {
    savedItem: {
      id: `postgres-saved-${runID}`,
      userID,
      codeVersion,
      sectionID: 101,
      updatedAt: "2026-06-27T00:00:00Z"
    }
  };
  const annotation = {
    annotation: {
      id: `postgres-annotation-${runID}`,
      userID,
      codeVersion,
      sectionID: 101,
      blockID: "block-smoke",
      noteBody: "Postgres integration note",
      tags: ["PostgresSmoke"],
      updatedAt: "2026-06-27T00:01:00Z",
      deletedAt: null
    }
  };
  const project = {
    project: {
      id: `postgres-project-${runID}`,
      userID,
      codeVersion,
      clientID: `postgres-project-client-${runID}`,
      localFolderID: 99001,
      name: "Postgres Integration Project",
      address: "Synthetic Address",
      description: "Synthetic project for Postgres integration verification.",
      colorHex: "#6674c8",
      sortOrder: 0,
      updatedAt: "2026-06-27T00:02:00Z"
    }
  };
  const projectSection = {
    projectSection: {
      id: `postgres-project-section-${runID}`,
      userID,
      codeVersion,
      folderClientID: `postgres-project-client-${runID}`,
      localFolderID: 99001,
      sectionID: 101,
      scope: "manual",
      updatedAt: "2026-06-27T00:03:00Z"
    }
  };

  const push = await request("/sync/push", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      batch: {
        user: {
          id: userID,
          authProvider: "apple",
          authProviderUserID: providerUserID,
          displayName: "Postgres Integration Smoke"
        },
        mutations: [savedItem, annotation, project, projectSection]
      }
    }
  });
  assert(push.response.ok, "Sync push failed.");
  assert(push.json.acceptedMutationIDs.length === 4, "Sync push did not accept all mutations.");
  assert(push.json.latestEventID > 0, "Sync push did not return a positive latestEventID.");

  assert(await countRows("permitext_users") === 1, "User row was not written.");
  assert(await countRows("permitext_saved_items") === 1, "Saved item row was not written.");
  assert(await countRows("permitext_annotations") === 1, "Annotation row was not written.");
  assert(await countRows("permitext_projects") === 1, "Project row was not written.");
  assert(await countRows("permitext_project_items") === 1, "Project item row was not written.");
  assert(await countRows("permitext_user_content_records") === 4, "Compatibility mutation rows were not written.");
  assert(await countRows("permitext_sync_events") === 4, "Sync event rows were not written.");

  const fullPull = await request("/sync/pull", {
    method: "POST",
    token,
    body: { auth: { accountUserID: userID }, sinceEventID: 0, contentMapVersion: 2 }
  });
  assert(fullPull.response.ok, "Full event-cursor pull failed.");
  assert(fullPull.json.mutations.length === 4, "Full event-cursor pull did not return all events.");
  assert(fullPull.json.latestEventID === push.json.latestEventID, "Pull latestEventID did not match push latestEventID.");

  const emptyPull = await request("/sync/pull", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      sinceEventID: fullPull.json.latestEventID,
      contentMapVersion: 2
    }
  });
  assert(emptyPull.response.ok, "Empty event-cursor pull failed.");
  assert(emptyPull.json.mutations.length === 0, "Event cursor pull returned already-seen mutations.");

  const concurrentSavedItems = [301, 302].map((sectionID) => ({
    savedItem: {
      id: `postgres-concurrent-${sectionID}-${runID}`,
      userID,
      codeVersion,
      sectionID,
      updatedAt: `2026-06-27T00:0${sectionID - 297}:00Z`
    }
  }));
  const concurrentDistinctPushes = await Promise.all(
    concurrentSavedItems.map((mutation) => request("/sync/push", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [mutation] }
      }
    }))
  );
  assert(
    concurrentDistinctPushes.every(({ response }) => response.ok),
    "Concurrent distinct-record pushes failed."
  );

  const sharedRecordID = `postgres-concurrent-shared-${runID}`;
  const olderSharedMutation = {
    savedItem: {
      id: sharedRecordID,
      userID,
      codeVersion,
      sectionID: 401,
      updatedAt: "2026-06-27T00:06:00Z"
    }
  };
  const newerSharedMutation = {
    savedItem: {
      id: sharedRecordID,
      userID,
      codeVersion,
      sectionID: 402,
      updatedAt: "2026-06-27T00:07:00Z"
    }
  };
  const concurrentSameRecordPushes = await Promise.all(
    [olderSharedMutation, newerSharedMutation].map((mutation) => request("/sync/push", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [mutation] }
      }
    }))
  );
  assert(
    concurrentSameRecordPushes.every(({ response }) => response.ok),
    "Concurrent same-record pushes failed."
  );

  const concurrencyPull = await request("/sync/pull", {
    method: "POST",
    token,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(concurrencyPull.response.ok, "Concurrency verification pull failed.");
  const concurrencySavedItems = concurrencyPull.json.mutations
    .map((mutation) => mutation.savedItem)
    .filter(Boolean);
  assert(
    concurrentSavedItems.every((mutation) =>
      concurrencySavedItems.some((record) => record.id === mutation.savedItem.id)
    ),
    "A concurrent distinct-record push was lost."
  );
  assert(
    concurrencySavedItems.some((record) => record.id === sharedRecordID && record.sectionID === 402),
    "The newest concurrent mutation did not win."
  );

  const finalSummary = await request("/admin/storage/summary", { token: adminToken });
  assert(finalSummary.response.ok, "Final storage summary failed.");
  assert(finalSummary.json.tables.savedItems >= 1, "Storage summary did not include saved item count.");
  assert(finalSummary.json.tables.annotations >= 1, "Storage summary did not include annotation count.");
  assert(finalSummary.json.tables.projects >= 1, "Storage summary did not include project count.");
  assert(finalSummary.json.tables.projectItems >= 1, "Storage summary did not include project item count.");
  assert(finalSummary.json.tables.syncEvents >= 4, "Storage summary did not include sync event count.");
  assert(finalSummary.json.latestEventID >= push.json.latestEventID, "Storage summary latestEventID is stale.");

  console.log("permitext postgres integration passed");
} finally {
  try {
    await cleanupUser();
  } catch (error) {
    console.error("Postgres integration cleanup failed:", error);
  }
  server.kill();
  await sleep(50);
}
