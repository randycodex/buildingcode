import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8799;
const baseURL = `http://127.0.0.1:${port}`;
const grantAdminToken = "foundation-migration-grant-token";
const userID = "apple:foundation-migration-user";
const projectID = "foundation-migration-project";
const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  return {
    response,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await request("/health");
      if (result.response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Foundation migration test server did not start.");
}

function projectSectionMutation(sectionID, suffix, updatedAt) {
  return {
    projectSection: {
      id: `foundation-project-section-${suffix}`,
      userID,
      codeVersion: "nyc-2022",
      folderClientID: projectID,
      localFolderID: 41,
      sectionID,
      blockID: `foundation-paragraph-${suffix}`,
      scope: "manual",
      updatedAt
    }
  };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-foundation-migration-"));
  const dataPath = join(tempDir, "sync-store.json");
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(tempDir, "private-assets"),
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: grantAdminToken
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverErrors = "";
  server.stderr.on("data", (chunk) => {
    serverErrors += chunk.toString();
  });

  try {
    await waitForServer();
    const grant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: grantAdminToken,
      body: { userID }
    });
    assert(grant.response.ok, "Foundation migration test entitlement grant failed.");

    const signIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "foundation-migration-user",
          displayName: "Foundation Migration User"
        }
      }
    });
    assert(signIn.response.ok, "Foundation migration test sign-in failed.");
    const token = signIn.json.account.backendSessionToken;

    const projectMutation = {
      project: {
        id: "foundation-migration-project-record",
        userID,
        codeVersion: "nyc-2022",
        clientID: projectID,
        localFolderID: 41,
        name: "Foundation Migration Project",
        description: "",
        colorHex: "#FF6B35",
        sortOrder: 0,
        updatedAt: "2026-08-16T00:00:00Z"
      }
    };
    const initialPush = await request("/sync/push", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [
            projectMutation,
            projectSectionMutation(900001, "initial", "2026-08-16T00:01:00Z")
          ]
        }
      }
    });
    assert(initialPush.response.ok, "Initial legacy Project records were not accepted.");

    const initialFoundation = await request("/projects/foundation/state", {
      method: "POST",
      token,
      body: { auth: { accountUserID: userID }, projectID }
    });
    assert(
      initialFoundation.response.ok &&
        initialFoundation.json.links.some((link) => link.targetID === "900001"),
      "Initial legacy Project section was not migrated."
    );
    const initialCheckpoint = initialFoundation.json.migrationCheckpoint;
    const stableMtime = (await stat(dataPath)).mtimeMs;

    await sleep(25);
    const steadyStateBootstrap = await request("/projects/hub/bootstrap", {
      method: "POST",
      token,
      body: { auth: { accountUserID: userID }, projectID }
    });
    assert(steadyStateBootstrap.response.ok, "Steady-state Project Hub bootstrap failed.");
    assert(
      steadyStateBootstrap.json.foundation.migrationCheckpoint.completedAt === initialCheckpoint.completedAt,
      "Steady-state Project Hub bootstrap changed migration completedAt."
    );
    assert(
      (await stat(dataPath)).mtimeMs === stableMtime,
      "Steady-state Project Hub bootstrap rewrote the file store."
    );

    const deltaPush = await request("/sync/push", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [projectSectionMutation(900002, "delta", "2026-08-16T00:02:00Z")]
        }
      }
    });
    assert(deltaPush.response.ok, "Legacy Project section delta was not accepted.");

    const foundationAfterDelta = await request("/projects/foundation/state", {
      method: "POST",
      token,
      body: { auth: { accountUserID: userID }, projectID }
    });
    assert(
      foundationAfterDelta.response.ok &&
        foundationAfterDelta.json.links.some((link) =>
          link.targetID === "900002" && link.metadata?.migratedFrom === "projectSection"
        ),
      "A legacy Project section added after checkpoint completion was not migrated."
    );
    assert(
      foundationAfterDelta.json.migrationCheckpoint.migratedProjectSections ===
        initialCheckpoint.migratedProjectSections + 1,
      "The migration checkpoint did not count the newly migrated legacy delta."
    );
    assert(
      foundationAfterDelta.json.migrationCheckpoint.completedAt !== initialCheckpoint.completedAt,
      "A semantic migration delta did not advance completedAt."
    );
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }

  if (serverErrors) process.stderr.write(serverErrors);
}

main().then(
  () => console.log("project foundation migration steady-state tests passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
