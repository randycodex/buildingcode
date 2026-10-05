import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nycMappedFactFields } from "../public/nyc-property-facts.js";
const temporary = await mkdtemp(join(tmpdir(), "permitext-nyc-facts-http-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-nyc-facts-grant" });
for (const key of Object.keys(process.env)) {
  if (/^(CLERK_|APPLE_|OPENAI_|STRIPE_|BLOB_|VERCEL_OIDC_TOKEN)/.test(key) ||
      ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"].includes(key)) delete process.env[key];
}
const originalFetch = globalThis.fetch;
let base, token, server;
const userID = "apple:synthetic-nyc-facts-owner";
globalThis.fetch = (input, options) => {
  const url = new URL(input);
  if (url.origin === base) return originalFetch(input, options);
  if (url.hostname === "search-api-production.herokuapp.com") return Promise.resolve({ ok: true, json: async () => [{ bbl: "2028500003", type: "lot" }] });
  assert.equal(url.hostname, "carto.nycplanningdigital.com", "No paid provider requests allowed");
  const sql = url.searchParams.get("q");
  if (sql.startsWith("WITH lot AS")) {
    if (sql.includes("FROM dcp_coastal_zone_boundary layer")) return Promise.resolve({ ok: false });
    const records = sql.includes("FROM dcp_transit_zones layer") ? [{ transtzone: "Outer Transit Zone", covers_lot: true }] : [];
    return Promise.resolve({ ok: true, json: async () => ({ rows: [{ records }] }) });
  }
  return Promise.resolve({ ok: true, json: async () => ({ rows: [{ bbl: "2028500003", address: "1760 JEROME AVENUE", borocode: 2, trnstzone: "Outer Transit Zone" }] }) });
};
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, expected = 200, bearer = token) {
    const response = await fetch(base + path, { method: "POST", headers: {
      "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {})
    }, body: JSON.stringify({ auth: { accountUserID: userID }, ...body }) });
    const payload = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return payload;
  }
  token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-nyc-facts-owner", email: "facts@example.test" } })).account.backendSessionToken;
  await post("/admin/lifetime-grants/grant", { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const { property } = await post("/projects/property/lookup", { address: "1760 Jerome Avenue" });
  assert.equal(property.schemaVersion, 2);
  assert.equal(property.structuredFacts.find(fact => fact.key === "coastal-zone").status, "unknown");
  assert.equal(property.structuredFacts.find(fact => fact.key === "parking-geography").value, "Outer Transit Zone");
  assert.ok(nycMappedFactFields.every(field => property.structuredFacts.some(fact => fact.key === field.key)));
  const extra = Array.from({ length: 55 - property.structuredFacts.length }, (_, index) => ({ key: `manual-${index}`, label: `Manual ${index}`, value: "Synthetic condition", status: "confirmed", source: "user" }));
  const project = { id: "synthetic-nyc-facts-project", clientID: "synthetic-nyc-facts-project", userID,
    name: "Synthetic ZoLa Project", address: property.normalizedAddress, codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
    structuredFacts: [...property.structuredFacts, ...extra], updatedAt: new Date().toISOString() };
  assert.equal(project.structuredFacts.length, 55);
  await post("/sync/push", { batch: { user: { id: userID }, mutations: [{ project }] } });
  const pulled = await post("/sync/pull", {});
  assert.deepEqual(pulled.mutations.find(mutation => mutation.project?.clientID === project.clientID).project.structuredFacts, project.structuredFacts);
  const oversized = { ...project, structuredFacts: Array.from({ length: 101 }, (_, index) => ({ key: `fact-${index}`, label: "Synthetic", value: "Synthetic", status: "stated" })) };
  await post("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: oversized }] } }, 400);
  console.log("ZoLa authenticated lookup, unknown layers, 55-fact sync round trip and capacity guard passed.");
} finally {
  globalThis.fetch = originalFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
