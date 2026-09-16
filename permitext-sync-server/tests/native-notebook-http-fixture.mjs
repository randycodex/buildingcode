// Isolated native UI fixture. Start before the one Simulator test; never uses
// production storage, credentials, provider calls, or the owner's app account.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-native-notebook-http-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-native-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "CLERK_SECRET_KEY", "CLERK_JWT_KEY"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const userID = "apple:synthetic-native-notebook";
const projectID = "native-notebook-fixture";
const attempts = [];
const revocationMode = process.argv.includes("--revocation");
const deniedRequests = [];
let revoked = false;
let droppedResponses = 0;
let token;
let ready = false;
const respond = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};
async function verifyRevocation() {
  const state = await createFileStoreAdapter().read();
  const artifacts = state.foundationArtifactsByUserID[userID] ?? [];
  assert.equal(artifacts.length, 1, "Revoked writes must not add or replace notes.");
  const recovered = await post("/notebook/cards/get", { projectID, cardID: artifacts[0].envelope.id });
  assert.equal(recovered.card.title, attempts[0].title);
  assert.equal(recovered.card.version, 1);
  assert.ok(deniedRequests.some(item => item.path === "/notebook/cards/save" && item.status === 401));
  assert.ok(deniedRequests.some(item => item.path === "/notebook/cards/list" && item.status === 401));
  assert.equal((state.activityEventsByUserID[userID] ?? []).filter(item => item.objectID === artifacts[0].envelope.id).length, 1);
  return { passed: true, notes: 1, activities: 1, deniedRequests, originalTitle: attempts[0].title };
}
async function verify() {
  assert.equal(droppedResponses, 1, "Exactly one committed response must be lost.");
  assert.equal(attempts.length, 2, "The failed save and explicit retry must be the only save attempts.");
  assert.deepEqual(attempts[1], attempts[0], "Retry must preserve the original mutation ID and complete request.");
  assert.ok(attempts[0].clientMutationID);
  assert.equal(attempts[0].expectedVersion, 0);
  assert.ok(!attempts[0].cardID, "Exercise uncertain creation, where duplication is possible.");
  const state = await createFileStoreAdapter().read();
  const artifacts = state.foundationArtifactsByUserID[userID] ?? [];
  assert.equal(artifacts.length, 1);
  const id = artifacts[0].envelope.id;
  assert.equal((state.activityEventsByUserID[userID] ?? []).filter(item => item.objectID === id).length, 1);
  assert.equal((state.projectLinksByUserID[userID] ?? []).filter(item => item.targetID === id).length, 1);
  return { passed: true, saveAttempts: attempts.length, droppedResponses, notes: 1, activities: 1, title: attempts[0].title };
}
const server = createServer(async (request, response) => {
  try {
    if (request.url === "/fixture/bootstrap") {
      return respond(response, ready ? 200 : 503, ready ? { token, mode: revocationMode ? "revocation" : "response-loss" } : { error: "Fixture not ready" });
    }
    if (revocationMode && request.url === "/fixture/revoke") {
      assert.equal(request.method, "POST");
      await post("/account/sign-out", {});
      revoked = true;
      return respond(response, 200, { revoked: true });
    }
    if (revocationMode && request.url === "/fixture/reauthenticate") {
      assert.equal(request.method, "POST");
      token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-native-notebook", email: "native@example.test", displayName: "Synthetic native verification" } })).account.backendSessionToken;
      return respond(response, 200, { token });
    }
    if (revocationMode && request.url === "/fixture/verify-revocation") {
      const result = await verifyRevocation();
      console.log("NATIVE_REVOCATION_VERIFIED", JSON.stringify(result));
      return respond(response, 200, result);
    }
    if (request.url === "/fixture/verify") {
      const result = await verify();
      console.log("NATIVE_NOTEBOOK_HTTP_VERIFIED", JSON.stringify(result));
      return respond(response, 200, result);
    }
    if (ready && request.method !== "GET" && ![
      "/notebook/cards/list", "/notebook/cards/get", "/notebook/cards/save",
      "/research/usage", "/organizations/list", "/projects/hub/bootstrap", "/projects/foundation/state",
      "/policies/acceptance", ...(revocationMode ? ["/account/sign-out", "/account/sign-in"] : [])
    ].includes(request.url)) {
      return respond(response, 403, { error: "Mutation not allowed by isolated native fixture" });
    }
    if (revocationMode && revoked && request.url.startsWith("/notebook/")) {
      response.once("finish", () => {
        if (response.statusCode === 401) deniedRequests.push({ path: request.url, status: response.statusCode });
      });
    }
    if (ready && request.url === "/notebook/cards/save") {
      const chunks = [];
      // Observe bytes without putting the IncomingMessage into flowing mode
      // before the real handler installs its body reader.
      const emit = request.emit;
      request.emit = function (event, ...arguments_) {
        if (event === "data") chunks.push(arguments_[0]);
        if (event === "end") attempts.push(JSON.parse(Buffer.concat(chunks).toString()));
        return emit.call(this, event, ...arguments_);
      };
      if (!revocationMode && droppedResponses === 0) {
        // Production handler persists normally; discard only its acknowledgement.
        response.end = () => { droppedResponses += 1; response.destroy(); return response; };
      }
    }
    return await handleRequest(request, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) respond(response, 500, { error: error.message });
    else response.destroy();
  }
});
const selfCheck = process.argv.includes("--self-check");
await new Promise(resolve => server.listen(selfCheck ? 0 : 18879, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, "Native fixture forbids all external/provider calls.");
  return originalFetch(input, options);
};
async function post(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  const result = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
async function close() {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
try {
  await post("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-native-notebook", email: "native@example.test", displayName: "Synthetic native verification" } })).account.backendSessionToken;
  await post("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: {
    id: "synthetic-native-project-record", userID, codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
    clientID: projectID, name: "Isolated native HTTP verification", address: "", colorHex: "#334455", sortOrder: 0,
    updatedAt: "2026-09-16T12:00:00.000Z"
  } }] } });
  ready = true;
  if (selfCheck) {
    const body = { projectID, expectedVersion: 0, clientMutationID: "synthetic-self-check", cardType: "finding", title: "Isolated HTTP draft",
      document: { schema: "permitext-notebook-card", schemaVersion: 1, format: "tiptap-json", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Preserved draft." }] }] } } };
    if (revocationMode) {
      await post("/notebook/cards/save", body);
      await post("/fixture/revoke", {});
      for (const path of ["/notebook/cards/save", "/notebook/cards/list"]) {
        const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ auth: { accountUserID: userID }, ...body }) });
        assert.equal(response.status, 401);
        await response.text();
      }
      await post("/fixture/reauthenticate", {});
      await post("/notebook/cards/list", { projectID });
      console.log("REVOCATION_SELF_CHECK_PASS", JSON.stringify(await verifyRevocation()));
      await close();
    } else {
    await assert.rejects(post("/notebook/cards/save", body));
    assert.equal((await post("/notebook/cards/save", body)).replayed, true);
    console.log("SELF_CHECK_PASS", JSON.stringify(await verify()));
    await close();
    }
  } else {
    console.log(`NATIVE_NOTEBOOK_HTTP_READY ${base} mode=${revocationMode ? "revocation" : "response-loss"}`);
    let closing = false;
    const stop = async () => { if (closing) return; closing = true; await close(); process.exit(0); };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    setTimeout(stop, 20 * 60 * 1000).unref();
  }
} catch (error) {
  await close();
  throw error;
}
