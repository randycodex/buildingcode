import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { seedLegacyWorkboardPreview, seedLegacyWorkboardRecord } from "./legacy-workboard-fixture.mjs";

const tempDir = await mkdtemp(join(tmpdir(), "permitext-workboard-retirement-"));
const dataPath = join(tempDir, "sync-store.json");
const privateAssetPath = join(tempDir, "private-assets");
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const baseURL = `http://127.0.0.1:${port}`;
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/OPENAI|ANTHROPIC|DATABASE|POSTGRES|NEON|BLOB|VERCEL|PERMITEXT|STRIPE|CLERK|STORAGE_URL/.test(key)
));
const grantToken = "retirement-local-grant";
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...environment, PORT: String(port), NODE_ENV: "test",
    PERMITEXT_SYNC_DATA_PATH: dataPath,
    PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: privateAssetPath,
    PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: grantToken
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

async function request(path, { body, token, binary, userID } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: path === "/health" ? "GET" : "POST",
    headers: {
      "content-type": binary ? "image/png" : "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(userID ? { "x-permitext-user-id": userID } : {})
    },
    body: binary || (body ? JSON.stringify(body) : undefined)
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const json = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(bytes.toString()) : null;
  return { response, bytes, json };
}

async function signIn(name, pro = false) {
  const userID = `apple:${name}`;
  if (pro) {
    const grant = await request("/admin/lifetime-grants/grant", { token: grantToken, body: { userID } });
    assert.equal(grant.response.status, 200);
  }
  const result = await request("/account/sign-in", {
    body: { credential: { provider: "apple", providerUserID: name, displayName: name, email: `${name}@example.test` } }
  });
  assert.equal(result.response.status, 200);
  return { userID, token: result.json.account.backendSessionToken };
}

try {
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try { ready = (await request("/health")).response.ok; } catch {}
    if (ready) break;
    await sleep(100);
  }
  assert(ready, `Local test server failed to start: ${output}`);
  const owner = await signIn("retirement-owner", true);
  const other = await signIn("retirement-other");
  const projectID = "legacy-project";
  const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  const updatedAt = "2026-08-01T00:00:00.000Z";
  const auth = { accountUserID: owner.userID };
  const created = await request("/sync/push", {
    token: owner.token,
    body: { auth, batch: { user: { id: owner.userID }, mutations: [{ project: {
      id: "legacy-project-record", userID: owner.userID, clientID: projectID,
      name: "Legacy Project", codeVersion, updatedAt
    } }] } }
  });
  assert.equal(created.response.status, 200);
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+VnweAAAAAElFTkSuQmCC", "base64");
  const preview = await seedLegacyWorkboardPreview({ dataPath, privateAssetPath, userID: owner.userID, projectID, image });
  const legacy = { workboard: {
    id: `${owner.userID}:workboard:${projectID}`, userID: owner.userID, projectID, codeVersion,
    elements: [{ id: "retained-rectangle", type: "rectangle" }], appState: {}, files: {}, assets: {}, updatedAt
  } };
  await seedLegacyWorkboardRecord(dataPath, legacy);
  const storedBefore = JSON.parse(await readFile(dataPath, "utf8"));
  for (const account of [owner, other]) {
    for (const route of ["assets/upload", "previews/upload", "assets/delete", "previews/clear"]) {
      const upload = route.endsWith("upload");
      const input = upload
        ? { userID: account.userID, binary: image }
        : { body: { auth: { accountUserID: account.userID }, projectID, pathnames: ["unused.png"] } };
      const path = `/workboards/${route}?projectID=${projectID}&fileID=unused&elementCount=3&workboardUpdatedAt=${updatedAt}`;
      for (const token of [undefined, "invalid-session"]) {
        const unauthenticated = await request(path, { ...input, token });
        assert.equal(unauthenticated.response.status, 401, route);
      }
      const retired = await request(path, { ...input, token: account.token });
      assert.equal(retired.response.status, 410, route);
      assert.equal(retired.json.code, "WORKBOARD_RETIRED", route);
    }
  }
  const afterWrites = JSON.parse(await readFile(dataPath, "utf8"));
  assert.deepEqual(afterWrites.foundationArtifactsByUserID, storedBefore.foundationArtifactsByUserID);
  assert.deepEqual(afterWrites.projectLinksByUserID, storedBefore.projectLinksByUserID);
  assert.deepEqual(afterWrites.mutationsByUserID, storedBefore.mutationsByUserID);
  assert.deepEqual(await readFile(join(privateAssetPath, preview.pathname)), image);

  const readable = await request("/workboards/previews/read", {
    token: owner.token, body: { auth, projectID, previewID: preview.id }
  });
  assert.equal(readable.response.status, 200);
  assert.equal(readable.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(readable.bytes, image);
  const inaccessible = await request("/workboards/previews/read", {
    token: other.token, body: { auth: { accountUserID: other.userID }, projectID, previewID: preview.id }
  });
  assert([403, 404].includes(inaccessible.response.status));

  const localID = "legacy-client-mutation";
  const mixed = await request("/sync/push", {
    token: owner.token,
    body: { auth, batch: { user: { id: owner.userID }, mutations: [
      { workboard: { ...legacy.workboard, id: localID, elements: [], updatedAt: "2026-08-02T00:00:00.000Z" } },
      { project: { id: "supported-project-record", userID: owner.userID,
        clientID: "supported-project", name: "Supported Project", codeVersion, updatedAt } }
    ] } }
  });
  assert.equal(mixed.response.status, 200);
  assert(mixed.json.acceptedMutationIDs.includes("supported-project-record"));
  for (const id of [localID, legacy.workboard.id]) {
    assert(mixed.json.rejectedMutationIDs.includes(id));
    assert.equal(mixed.json.rejectionReasons[id]?.code, "WORKBOARD_RETIRED");
  }
  const pulled = await request("/sync/pull", { token: owner.token, body: { auth } });
  assert.equal(pulled.response.status, 200);
  assert.deepEqual(pulled.json.mutations.find((item) => item.workboard)?.workboard.elements, legacy.workboard.elements);
  assert(pulled.json.mutations.some((item) => item.project?.clientID === "supported-project"));
  console.log("Workboard retirement HTTP passed: authenticated writes rejected, mixed sync preserved, historical private preview and drawing retained.");
} finally {
  if (server.exitCode === null) {
    const closed = once(server, "exit");
    server.kill("SIGTERM");
    await closed;
  }
  await rm(tempDir, { recursive: true, force: true });
}
