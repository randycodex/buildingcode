import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { notebookDraftSaveTitle } from "../public/offline-storage.js";

const temporary = await mkdtemp(join(tmpdir(), "permitext-pending-note-http-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-note-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, base, "This synthetic HTTP test forbids external/provider calls.");
  return originalFetch(input, options);
};
const userID = "apple:synthetic-note-owner";
let token;
async function request(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  return { status: response.status, json: await response.json() };
}
try {
  assert.equal((await request("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const signedIn = await request("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-note-owner", email: "note@example.test", displayName: "Synthetic test" } });
  assert.equal(signedIn.status, 200);
  token = signedIn.json.account.backendSessionToken;
  const projectID = "synthetic-note-project";
  assert.equal((await request("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: {
    id: "synthetic-project-record", userID, clientID: projectID, name: "Synthetic Note Project",
    codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
    colorHex: "#334455", sortOrder: 0, updatedAt: "2026-10-14T12:00:00Z"
  } }] } })).status, 200);
  const question = "q".repeat(2_000);
  const answer = { id: "synthetic-saved-answer", projectID, question,
    answer: { answerText: "Synthetic fixture only." }, createdAt: "2026-10-14T12:00:00Z" };
  const adapter = createFileStoreAdapter();
  await adapter.saveResearchAnswer(userID, answer);
  await adapter.saveResearchAnswer("apple:other-owner", { ...answer, id: "foreign-answer" });
  const document = { schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json",
    document: [{ type: "paragraph", content: [{ type: "permitextReference", props: {
      referenceKind: "researchAnswer", referenceID: answer.id, label: `Research: ${question}`
    } }] }] };
  const draft = { projectID, expectedVersion: 0, clientMutationID: "original-create-receipt", cardType: "finding",
    title: notebookDraftSaveTitle({ title: "", document }), document, evidenceLinks: [] };
  const saved = await request("/notebook/cards/save", draft);
  assert.equal(saved.status, 201, JSON.stringify(saved));
  assert.equal(saved.json.card.title, "Untitled Note");
  assert.deepEqual(saved.json.card.references, [{ referenceKind: "researchAnswer", referenceID: answer.id, label: `Research: ${question}` }]);
  const replay = await request("/notebook/cards/save", draft);
  assert.equal(replay.json.replayed, true);
  assert.equal(replay.json.card.id, saved.json.card.id, "Retry creates no duplicate Note.");
  const read = await request("/notebook/cards/get", { projectID, cardID: saved.json.card.id });
  assert.equal(read.status, 200);
  assert.deepEqual(read.json.card.document, saved.json.card.document);
  assert.equal((await request("/notebook/cards/save", { ...draft, title: "Changed receipt" })).status, 409);
  const foreign = structuredClone(document);
  foreign.document[0].content[0].props.referenceID = "foreign-answer";
  const rejected = await request("/notebook/cards/save", { ...draft, clientMutationID: "foreign-reference", document: foreign });
  assert.equal(rejected.status, 400);
  assert.match(rejected.json.error, /reference is unavailable/);
  console.log("Pending Note HTTP passed: full Research question, default title, save/read round-trip, immutable retry identity and owner isolation; no provider calls.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
