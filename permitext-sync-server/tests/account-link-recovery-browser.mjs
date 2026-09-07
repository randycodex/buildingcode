// Run with node tests/account-link-recovery-browser.mjs and open the printed URL.
// Real local account-link HTTP + real browser storage + extracted application
// recovery handlers. Synthetic identities/file storage only; no provider login.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-link-browser-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets") });
for (const key of Object.keys(process.env)) {
  if (/^(CLERK_|APPLE_|OPENAI_|STRIPE_|BLOB_|VERCEL_OIDC_TOKEN)/.test(key) ||
      ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"].includes(key)) delete process.env[key];
}
const { handleRequest } = await import("../app.mjs");
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const names = ["activeAccount", "captureAccountRequest", "isCurrentAccountRequest", "requireCurrentAccountRequest",
  "storeSignedInAccount", "linkedAccountRecoverySources", "linkedAccountRecoveryBundle", "accountLocalRecoveryBundle",
  "appendLinkedAccountRecoveryControls", "blobDataURL", "downloadCodeMemoBlob"];
const functions = names.map((name) => {
  const match = new RegExp("^(?:async )?function " + name + "\\(", "m").exec(source);
  assert.ok(match, name);
  const next = /\n(?:async )?function [\w$]+\(/.exec(source.slice(match.index + match[0].length));
  assert.ok(next, name + " boundary");
  return source.slice(match.index, match.index + match[0].length + next.index);
}).join("\n");
const routes = new Map([
  ["/", new URL("./fixtures/account-link-recovery.html", import.meta.url)],
  ...["offline-storage", "sync-identity", "private-workspace-state", "code-question-client-state", "code-question-workspace"].map((name) =>
    [`/${name}.js`, new URL(`../public/${name}.js`, import.meta.url)])
]);
const requests = [];
let base;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === "string" ? input : input.url).origin, base, "External requests forbidden");
  return originalFetch(input, options);
};
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if (request.method !== "GET") requests.push({ method: request.method, path });
  if (request.method === "POST" && path === "/account/sign-in") {
    return handleRequest(request, response);
  }
  if (request.method === "GET" && path === "/fixture-requests") {
    return response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(requests));
  }
  const file = routes.get(path);
  if (request.method !== "GET" || (!file && path !== "/runner.js")) return response.writeHead(404).end();
  try {
    const body = file ? await readFile(file) : functions + "\n" + await readFile(new URL("./fixtures/account-link-recovery.js", import.meta.url));
    response.writeHead(200, { "Content-Type": path === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
      "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'" }).end(body);
  } catch (error) { response.writeHead(500).end(error.message); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
base = `http://127.0.0.1:${server.address().port}`;
console.log(`Account link recovery fixture: ${base}/`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
  console.log("Synthetic account-link server and private file storage removed.");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
