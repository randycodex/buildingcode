import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
const sourceProviderUserID = `postgres-link-source-${runID}`;
const sourceUserID = `web:${sourceProviderUserID}`;
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
  for (const cleanupUserID of [sourceUserID, userID]) {
    await sql`DELETE FROM permitext_sync_events WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_saved_items WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_annotations WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_projects WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_project_items WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_comments WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_research_feedback WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_research_usage WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_research_conversations WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_user_content_records WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_passkey_credentials WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_account_sessions WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_sessions WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_entitlements WHERE user_id = ${cleanupUserID}`;
    await sql`DELETE FROM permitext_users WHERE id = ${cleanupUserID}`;
  }
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
  } else if (tableName === "permitext_sessions") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_sessions WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_account_sessions") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_account_sessions WHERE user_id = ${userID}`;
  } else if (tableName === "permitext_entitlements") {
    rows = await sql`SELECT count(*)::int AS count FROM permitext_entitlements WHERE user_id = ${userID}`;
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
    PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
    PERMITEXT_SESSION_TTL_SECONDS: "3600"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  const health = await waitForServer();
  assert(health.schema === "normalized-v3", `Expected normalized-v3 schema, received ${health.schema}.`);

  await cleanupUser();

  const unauthorizedSummary = await request("/admin/storage/summary");
  assert(unauthorizedSummary.response.status === 401, "Storage summary allowed an unauthenticated request.");

  const initialSummary = await request("/admin/storage/summary", { token: adminToken });
  assert(initialSummary.response.ok, "Initial storage summary failed.");
  assert(initialSummary.json.storage === "postgres", "Storage summary did not report postgres.");
  assert(initialSummary.json.schema === "normalized-v3", "Storage summary did not report normalized-v3.");
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
  assert(await countRows("permitext_sessions") === 0, "Sign-in stored a plaintext legacy session.");
  assert(await countRows("permitext_account_sessions") === 1, "Sign-in did not store a hashed account session.");

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
  const workboard = {
    workboard: {
      id: `postgres-workboard-${runID}`,
      userID,
      codeVersion,
      projectID: `postgres-project-client-${runID}`,
      projectName: "Postgres Integration Project",
      elements: [{ id: `postgres-rectangle-${runID}`, type: "rectangle" }],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
      assets: {},
      updatedAt: "2026-06-27T00:04:00Z"
    }
  };

  const freeProjectPush = await request("/sync/push", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      batch: { user: { id: userID }, mutations: [project] }
    }
  });
  assert(freeProjectPush.response.ok, "Postgres Free-plan enforcement request failed.");
  assert(
    freeProjectPush.json.rejectedMutationIDs.length === 1,
    "Postgres accepted a new Project without a server-owned Pro entitlement."
  );
  assert(await countRows("permitext_projects") === 0, "Rejected Free Project was written to Postgres.");

  const initialLifetimeGrant = await request("/admin/lifetime-grants/grant", {
    method: "POST",
    token: adminToken,
    body: { userID }
  });
  assert(initialLifetimeGrant.response.ok, "Initial Postgres Pro grant failed.");

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
        mutations: [savedItem, annotation, project, projectSection, workboard]
      }
    }
  });
  assert(push.response.ok, "Sync push failed.");
  assert(push.json.acceptedMutationIDs.length === 5, "Sync push did not accept all mutations.");
  assert(push.json.latestEventID > 0, "Sync push did not return a positive latestEventID.");

  assert(await countRows("permitext_users") === 1, "User row was not written.");
  assert(await countRows("permitext_saved_items") === 1, "Saved item row was not written.");
  assert(await countRows("permitext_annotations") === 1, "Annotation row was not written.");
  assert(await countRows("permitext_projects") === 1, "Project row was not written.");
  assert(await countRows("permitext_project_items") === 1, "Project item row was not written.");
  assert(await countRows("permitext_user_content_records") === 5, "Compatibility mutation rows were not written.");
  assert(await countRows("permitext_sync_events") === 5, "Sync event rows were not written.");

  const fullPull = await request("/sync/pull", {
    method: "POST",
    token,
    body: { auth: { accountUserID: userID }, sinceEventID: 0, contentMapVersion: 2 }
  });
  assert(fullPull.response.ok, "Full event-cursor pull failed.");
  assert(fullPull.json.mutations.length === 5, "Full event-cursor pull did not return all events.");
  assert(
    fullPull.json.mutations.some((mutation) =>
      mutation.workboard?.projectID === `postgres-project-client-${runID}` &&
      mutation.workboard?.elements?.[0]?.id === `postgres-rectangle-${runID}`
    ),
    "Postgres pull did not restore the Workboard."
  );
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

  const savedItemCountBeforeGrant = await countRows("permitext_saved_items");
  const lifetimeGrant = await request("/admin/lifetime-grants/grant", {
    method: "POST",
    token: adminToken,
    body: { userID }
  });
  assert(lifetimeGrant.response.ok, "Direct Postgres lifetime grant failed.");
  assert(lifetimeGrant.json.entitlement?.source === "lifetimeGrant", "Lifetime grant stored the wrong source.");
  assert(await countRows("permitext_entitlements") === 1, "Lifetime grant did not write one entitlement row.");
  assert(
    await countRows("permitext_saved_items") === savedItemCountBeforeGrant,
    "Entitlement update changed unrelated saved content."
  );
  const lifetimeRevoke = await request("/admin/lifetime-grants/revoke", {
    method: "POST",
    token: adminToken,
    body: { userID }
  });
  assert(lifetimeRevoke.response.ok, "Direct Postgres lifetime revoke failed.");
  assert(await countRows("permitext_entitlements") === 0, "Lifetime revoke left an entitlement row.");
  assert(
    await countRows("permitext_saved_items") === savedItemCountBeforeGrant,
    "Entitlement removal changed unrelated saved content."
  );

  const sourceSignIn = await request("/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: sourceProviderUserID,
        displayName: "Postgres Link Source",
        signedInAt: new Date().toISOString()
      }
    }
  });
  assert(sourceSignIn.response.ok, "Source browser account sign-in failed.");
  const sourceToken = sourceSignIn.json.account.backendSessionToken;
  const sourceSavedItem = {
    savedItem: {
      id: `postgres-link-source-saved-${runID}`,
      userID: sourceUserID,
      codeVersion,
      sectionID: 501,
      updatedAt: "2026-06-27T00:08:00Z"
    }
  };
  const sourcePush = await request("/sync/push", {
    method: "POST",
    token: sourceToken,
    body: {
      auth: { accountUserID: sourceUserID },
      batch: { user: { id: sourceUserID }, mutations: [sourceSavedItem] }
    }
  });
  assert(sourcePush.response.ok, "Source browser account mutation push failed.");
  const sourceGrant = await request("/admin/lifetime-grants/grant", {
    method: "POST",
    token: adminToken,
    body: { userID: sourceUserID }
  });
  assert(sourceGrant.response.ok, "Source browser account entitlement grant failed.");

  const linkedSignIn = await request("/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "apple",
        providerUserID,
        displayName: "Postgres Integration Smoke",
        signedInAt: new Date().toISOString()
      },
      linkFrom: {
        accountUserID: sourceUserID,
        sessionToken: sourceToken
      }
    }
  });
  assert(linkedSignIn.response.ok, "Transactional Postgres account linking failed.");
  assert(
    linkedSignIn.json.mergedAccount?.sourceUserID === sourceUserID &&
      linkedSignIn.json.mergedAccount?.targetUserID === userID,
    "Postgres account linking returned the wrong merge summary."
  );
  assert(
    linkedSignIn.json.entitlement?.source === "lifetimeGrant",
    "Postgres account linking did not transfer the source entitlement."
  );
  const linkedToken = linkedSignIn.json.account.backendSessionToken;
  const linkedPull = await request("/sync/pull", {
    method: "POST",
    token: linkedToken,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(linkedPull.response.ok, "Linked Apple account could not pull merged data.");
  assert(
    linkedPull.json.mutations.some((mutation) =>
      mutation.savedItem?.userID === userID && mutation.savedItem?.sectionID === 501
    ),
    "Linked Apple account did not receive the source saved section."
  );
  const removedSourceRows = await sql`
    SELECT
      (SELECT count(*) FROM permitext_users WHERE id = ${sourceUserID})::int AS users,
      (SELECT count(*) FROM permitext_user_content_records WHERE user_id = ${sourceUserID})::int AS records,
      (SELECT count(*) FROM permitext_entitlements WHERE user_id = ${sourceUserID})::int AS entitlements
  `;
  assert(
    Number(removedSourceRows[0]?.users || 0) === 0 &&
      Number(removedSourceRows[0]?.records || 0) === 0 &&
      Number(removedSourceRows[0]?.entitlements || 0) === 0,
    "Postgres account linking left source account rows behind."
  );
  const retiredSourcePull = await request("/sync/pull", {
    method: "POST",
    token: sourceToken,
    body: { auth: { accountUserID: sourceUserID }, contentMapVersion: 2 }
  });
  assert(retiredSourcePull.response.status === 401, "Merged source session remained usable.");
  const linkedEntitlementRevoke = await request("/admin/lifetime-grants/revoke", {
    method: "POST",
    token: adminToken,
    body: { userID }
  });
  assert(linkedEntitlementRevoke.response.ok, "Transferred lifetime grant cleanup failed.");

  const secondSignIn = await request("/account/sign-in", {
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
  assert(secondSignIn.response.ok, "Second device sign-in failed.");
  const secondToken = secondSignIn.json.account.backendSessionToken;
  assert(secondToken && secondToken !== token, "Second device did not receive a distinct session.");
  const firstDevicePull = await request("/sync/pull", {
    method: "POST",
    token,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(firstDevicePull.response.ok, "Second sign-in invalidated the first device session.");

  const signOut = await request("/account/sign-out", {
    method: "POST",
    token: secondToken,
    body: { auth: { accountUserID: userID } }
  });
  assert(signOut.response.ok, "Postgres account sign-out failed.");
  const revokedDevicePull = await request("/sync/pull", {
    method: "POST",
    token: secondToken,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(revokedDevicePull.response.status === 401, "Revoked Postgres session remained usable.");
  const survivingDevicePull = await request("/sync/pull", {
    method: "POST",
    token,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(survivingDevicePull.response.ok, "Signing out one device revoked another device session.");

  const expiringSignIn = await request("/account/sign-in", {
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
  assert(expiringSignIn.response.ok, "Expiring-session sign-in failed.");
  const expiringToken = expiringSignIn.json.account.backendSessionToken;
  const expiringTokenHash = createHash("sha256").update(expiringToken).digest("hex");
  await sql`
    UPDATE permitext_account_sessions
    SET expires_at = now() - interval '1 second'
    WHERE token_hash = ${expiringTokenHash}
  `;
  const expiredSessionPull = await request("/sync/pull", {
    method: "POST",
    token: expiringToken,
    body: { auth: { accountUserID: userID }, contentMapVersion: 2 }
  });
  assert(expiredSessionPull.response.status === 401, "Expired session remained usable.");

  const finalSummary = await request("/admin/storage/summary", { token: adminToken });
  assert(finalSummary.response.ok, "Final storage summary failed.");
  assert(finalSummary.json.tables.savedItems >= 1, "Storage summary did not include saved item count.");
  assert(finalSummary.json.tables.annotations >= 1, "Storage summary did not include annotation count.");
  assert(finalSummary.json.tables.projects >= 1, "Storage summary did not include project count.");
  assert(finalSummary.json.tables.projectItems >= 1, "Storage summary did not include project item count.");
  assert(finalSummary.json.tables.syncEvents >= 4, "Storage summary did not include sync event count.");
  assert(finalSummary.json.tables.accountSessions >= 1, "Storage summary did not include active hashed sessions.");
  assert(finalSummary.json.tables.legacySessions === 0, "Storage summary reported a plaintext legacy session.");
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
