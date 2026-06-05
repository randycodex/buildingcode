import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8794;
const baseURL = `http://127.0.0.1:${port}`;
const adminToken = "smoke-admin-token";
const userID = "apple:smoke-user";

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
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { response } = await request("/health");
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Server did not become ready.");
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-sync-smoke-"));
  const dataPath = join(tempDir, "sync-store.json");
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      APPLE_TEAM_ID: "ABCDE12345",
      APPLE_BUNDLE_ID: "com.randycodex.permitext"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();

    const aasa = await request("/.well-known/apple-app-site-association");
    assert(aasa.response.ok, "AASA endpoint failed.");
    assert(
      aasa.json.webcredentials.apps.includes("ABCDE12345.com.randycodex.permitext"),
      "AASA payload did not include the configured app identifier."
    );

    const unauthorizedGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedGrant.response.status === 401, "Admin route allowed an unauthenticated grant.");

    const grant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(grant.response.ok, "Lifetime grant failed.");
    assert(grant.json.entitlement.source === "lifetimeGrant", "Lifetime grant source was not persisted.");

    const signIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User"
        }
      }
    });
    assert(signIn.response.ok, "Sign-in failed.");
    assert(signIn.json.account.appUserID === userID, "Sign-in returned the wrong user ID.");
    assert(signIn.json.entitlement?.source === "lifetimeGrant", "Sign-in did not return the granted entitlement.");

    const attach = await request("/account/attach-local-data", {
      method: "POST",
      body: { account: signIn.json.account }
    });
    assert(attach.response.ok, "Attach local data failed.");
    assert(attach.json === "localDataAttached", "Attach local data returned the wrong state.");

    const malformedPush = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{ unknown: { id: "bad", userID, updatedAt: "2026-06-04T00:00:00Z" } }]
        }
      }
    });
    assert(malformedPush.response.status === 400, "Push accepted an unsupported mutation kind.");

    const mutation = {
      savedItem: {
        id: "saved-smoke",
        userID,
        codeVersion: "nyc-2022",
        sectionID: "BC 101.1",
        createdAt: "2026-06-04T00:00:00Z",
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const push = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [mutation]
        }
      }
    });
    assert(push.response.ok, "Sync push failed.");
    assert(push.json.acceptedMutationIDs.includes("saved-smoke"), "Push did not accept the saved item mutation.");

    const pull = await request("/sync/pull", {
      method: "POST",
      body: { auth: { accountUserID: userID } }
    });
    assert(pull.response.ok, "Sync pull failed.");
    assert(pull.json.mutations.length === 1, "Pull did not return the pushed mutation.");

    const revoke = await request("/admin/lifetime-grants/revoke", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(revoke.response.ok, "Lifetime revoke failed.");
    assert(revoke.json.entitlement === null, "Lifetime revoke did not clear the entitlement.");
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().then(
  () => {
    console.log("permitext-sync smoke passed");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
