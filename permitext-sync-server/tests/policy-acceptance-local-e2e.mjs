import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const adminToken = "policy-acceptance-local-admin";
const versions = {
  terms: "terms-contract-v1",
  privacy: "privacy-contract-v1",
  subscriptionsAndRefunds: "subscriptions-contract-v1"
};

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  assert(Number.isSafeInteger(port) && port > 0);
  return port;
}

async function request(baseURL, path, { method = "GET", body, token } = {}) {
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
    text,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null
  };
}

async function waitForServer(child, baseURL, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(output.join(""));
    try {
      const response = await fetch(`${baseURL}/health`);
      if (response.ok) return;
    } catch {
      // Starting.
    }
    await sleep(50);
  }
  throw new Error(`Permitext policy acceptance server did not start.\n${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

async function main() {
  const tempDirectory = await mkdtemp(join(tmpdir(), "permitext-policy-acceptance-"));
  const dataPath = join(tempDirectory, "sync-store.json");
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      PERMITEXT_SYNC_DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_TERMS_VERSION: versions.terms,
      PERMITEXT_PRIVACY_VERSION: versions.privacy,
      PERMITEXT_SUBSCRIPTION_POLICY_VERSION: versions.subscriptionsAndRefunds
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => output.push(String(chunk)));
  }

  try {
    await waitForServer(child, baseURL, output);

    const current = await request(baseURL, "/policies/current");
    assert.equal(current.response.status, 200, current.text);
    assert.equal(current.json.configured, true);
    assert.deepEqual(current.json.versions, versions);
    assert.equal(current.json.documents.terms.url, `${baseURL}/terms`);

    const signIn = await request(baseURL, "/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "policy-acceptance-user",
          email: "policy-acceptance@example.com"
        }
      }
    });
    assert.equal(signIn.response.status, 200, signIn.text);
    const accountUserID = signIn.json.account.appUserID;
    const sessionToken = signIn.json.account.backendSessionToken;

    const unauthenticated = await request(baseURL, "/account/policy-acceptance", {
      method: "POST",
      body: { accountUserID, platform: "web", versions }
    });
    assert.equal(unauthenticated.response.status, 401, unauthenticated.text);

    const stale = await request(baseURL, "/account/policy-acceptance", {
      method: "POST",
      token: sessionToken,
      body: {
        accountUserID,
        platform: "web",
        versions: { ...versions, privacy: "stale-policy" }
      }
    });
    assert.equal(stale.response.status, 409, stale.text);
    assert.equal(stale.json.code, "POLICY_VERSION_MISMATCH");

    const accepted = await request(baseURL, "/account/policy-acceptance", {
      method: "POST",
      token: sessionToken,
      body: {
        accountUserID,
        platform: "web",
        versions,
        clientRelease: "policy-acceptance-local-e2e"
      }
    });
    assert.equal(accepted.response.status, 200, accepted.text);
    assert.equal(accepted.json.recorded, true);
    assert.equal(accepted.json.acceptance.platform, "web");
    assert.deepEqual(accepted.json.acceptance.versions, versions);
    assert(Number.isFinite(Date.parse(accepted.json.acceptance.acceptedAt)));

    const duplicate = await request(baseURL, "/account/policy-acceptance", {
      method: "POST",
      token: sessionToken,
      body: { accountUserID, platform: "ios", versions }
    });
    assert.equal(duplicate.response.status, 200, duplicate.text);
    assert.equal(duplicate.json.recorded, false);
    assert.equal(duplicate.json.acceptance.id, accepted.json.acceptance.id);

    const stored = JSON.parse(await readFile(dataPath, "utf8"));
    assert.equal(stored.users[accountUserID].policyAcceptances.length, 1);
    assert.equal(
      stored.users[accountUserID].policyAcceptances[0].id,
      accepted.json.acceptance.id
    );

    const exported = await request(baseURL, "/admin/accounts/export", {
      method: "POST",
      token: adminToken,
      body: { userID: accountUserID }
    });
    assert.equal(exported.response.status, 200, exported.text);
    assert.equal(exported.json.account.policyAcceptances[0].id, accepted.json.acceptance.id);

    console.log("permitext local policy acceptance lifecycle passed");
  } finally {
    await stopServer(child);
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

await main();
