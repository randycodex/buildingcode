// Manual real-browser acceptance. Run this file, then use the printed loopback
// URL. The proxy cuts real sockets; application upload/save handlers and browser
// storage are unchanged. All identities, grants and files are isolated fixtures.
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-transfer-browser-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets") });
for (const key of Object.keys(process.env)) {
  if (/^(CLERK_|APPLE_|OPENAI_|STRIPE_|BLOB_|VERCEL_OIDC_TOKEN)/.test(key) ||
      ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"].includes(key)) delete process.env[key];
}
process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN = "synthetic-transfer-only";
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const adapter = createFileStoreAdapter();
const transfers = [];
let mode = "cut-body", setup, cutObservedBody;
const backend = createServer(async (request, response) => {
  let receipt;
  if (request.url.startsWith("/notebook/assets/upload?")) {
    receipt = { mode, receivedBytes: 0, declaredBytes: Number(request.headers["content-length"]), complete: false, aborted: false };
    transfers.push(receipt);
    request.on("data", chunk => {
      receipt.receivedBytes += chunk.length;
      if (receipt.mode === "cut-body") cutObservedBody?.();
    });
    // Observe only bytes consumed by the application's body reader, after auth.
    request.pause();
    request.on("aborted", () => { receipt.aborted = true; });
  }
  try { await handleRequest(request, response); }
  finally { if (receipt) { receipt.complete = request.complete; receipt.handlerFinished = true; receipt.status = response.statusCode; } }
});
await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve));
const backendOrigin = `http://127.0.0.1:${backend.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === "string" ? input : input.url).origin, backendOrigin, "External calls forbidden");
  return originalFetch(input, options);
};
async function post(path, body, token) {
  const response = await fetch(backendOrigin + path, { method: "POST", headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.ok(response.ok, JSON.stringify({ path, status: response.status, error: payload.error }));
  return payload;
}
async function prepare() {
  if (setup) return setup;
  const account = (await post("/account/sign-in", { credential: { provider: "web", providerUserID: "synthetic-transfer-" + randomUUID() } })).account;
  await post("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const projectID = randomUUID();
  await post("/sync/push", { auth: { accountUserID: account.appUserID }, batch: {
    user: { id: account.appUserID }, mutations: [{ project: { id: `${account.appUserID}:project:${projectID}`,
      clientID: projectID, userID: account.appUserID, name: "Synthetic transfer Project",
      codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1", updatedAt: new Date().toISOString() } }]
  } }, account.backendSessionToken);
  setup = { account: { userID: account.appUserID, sessionToken: account.backendSessionToken }, projectID };
  return setup;
}
async function summary() {
  const state = await adapter.read();
  const artifacts = state.foundationArtifactsByUserID[setup?.account.userID] || [];
  const images = artifacts.filter(item => item.envelope.type === "notebookImageAsset");
  const cards = artifacts.filter(item => item.envelope.type === "notebookCard");
  const image = images[0];
  let file = null;
  if (image) {
    const body = await readFile(join(temporary, "assets", image.payload.storageKey));
    file = { size: body.length, sha256: createHash("sha256").update(body).digest("hex"), uploadedAt: image.payload.uploadedAt,
      filesInDirectory: (await readdir(join(temporary, "assets", image.payload.storageKey, ".."))).length };
  }
  return { transfers, images: images.length, cards: cards.length, file };
}
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const names = ["notebookImageDimensions", "uploadPendingNotebookImage", "notebookDocumentAssetURLs",
  "replaceNotebookDocumentAssetURL", "reconcileNotebookDocumentAssets", "synchronizeNotebookDraft"];
const handlers = names.map(name => {
  const match = new RegExp("^(?:async )?function " + name + "\\(", "m").exec(source);
  assert.ok(match, name);
  const next = /\n(?:async )?function [\w$]+\(/.exec(source.slice(match.index + match[0].length));
  assert.ok(next, name + " boundary");
  return source.slice(match.index, match.index + match[0].length + next.index);
}).join("\n");
const routes = new Map([
  ["/", new URL("./fixtures/notebook-transfer.html", import.meta.url)],
  ...["offline-storage", "sync-identity"].map(name => [`/${name}.js`, new URL(`../public/${name}.js`, import.meta.url)])
]);
function json(response, body) { response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body)); }
const frontend = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  try {
    if (request.method === "POST" && path === "/fixture/setup") return json(response, await prepare());
    if (request.method === "GET" && path === "/fixture/state") return json(response, await summary());
    if (request.method === "POST" && path === "/fixture/lost-reply") { mode = "lose-reply"; return json(response, { mode }); }
    if (request.method === "POST" && path === "/fixture/retry") { mode = "pass"; return json(response, { mode }); }
    if (request.method === "POST" && ["/notebook/assets/upload", "/notebook/cards/save", "/notebook/assets/read"].includes(path)) {
      const upload = path === "/notebook/assets/upload";
      const upstream = httpRequest(backendOrigin + request.url, { method: "POST", headers: { ...request.headers, host: new URL(backendOrigin).host } }, incoming => {
        if (upload && mode === "lose-reply") {
          incoming.resume();
          incoming.on("end", () => { transfers.at(-1).replyDiscarded = true; response.destroy(); });
        } else { response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response); }
      });
      upstream.on("error", () => response.destroy());
      if (upload && mode === "cut-body") {
        let sent = false;
        cutObservedBody = () => {
          cutObservedBody = null;
          setImmediate(() => { upstream.destroy(); response.destroy(); request.destroy(); });
        };
        request.on("data", chunk => { if (!sent) { sent = true; upstream.write(chunk.subarray(0, 32)); } });
        // Deliberately never finish the declared 68-byte body.
      } else request.pipe(upstream);
      return;
    }
    const file = routes.get(path);
    if (request.method !== "GET" || (!file && path !== "/runner.js")) return response.writeHead(404).end();
    const body = file ? await readFile(file) : handlers + "\n" + await readFile(new URL("./fixtures/notebook-transfer.js", import.meta.url));
    response.writeHead(200, { "content-type": path === "/" ? "text/html" : "text/javascript", "cache-control": "no-store",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'" }).end(body);
  } catch (error) { console.error(error.message); response.writeHead(500).end("Fixture failed"); }
});
await new Promise(resolve => frontend.listen(0, "127.0.0.1", resolve));
console.log(`Notebook interrupted-transfer fixture: http://127.0.0.1:${frontend.address().port}/`);
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  for (const server of [frontend, backend]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
  console.log("Synthetic transfer servers and private storage removed.");
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
