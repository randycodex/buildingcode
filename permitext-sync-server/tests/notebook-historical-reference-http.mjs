import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-notebook-historical-http-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-cas-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, base, "This synthetic HTTP contract forbids external/provider calls.");
  return originalFetch(input, options);
};
const userID = "apple:synthetic-cas-owner";
let token;
async function request(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  const text = await response.text();
  const json = response.headers.get("content-type")?.includes("ndjson")
    ? text.trim().split("\n").map(JSON.parse)
    : JSON.parse(text);
  return { status: response.status, json };
}
try {
  assert.equal((await request("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const signedIn = await request("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-cas-owner", email: "cas@example.test", displayName: "Synthetic test" } });
  assert.equal(signedIn.status, 200);
  token = signedIn.json.account.backendSessionToken;
  const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  for (const [index, projectID] of ["project-a", "project-b"].entries()) {
    const pushed = await request("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: {
      id: `${projectID}-record`, userID, codeVersion, clientID: projectID, name: projectID,
      address: index ? "200 New Project Street" : "100 Prior Project Street", colorHex: "#334455", sortOrder: index,
      updatedAt: "2026-09-04T12:00:00.000Z"
    } }] } });
    assert.equal(pushed.status, 200);
  }
  const sectionIDs = ["31001371", "31001382"];
  const document = {
    schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json",
    document: [{ id: "historical-block", type: "paragraph", props: {}, children: [],
      content: sectionIDs.map((referenceID) => ({ type: "permitextReference",
        props: { referenceKind: "canonicalSection", referenceID, label: `1968 Building Code ${referenceID}` }
      })) }]
  };
  const saved = await request("/notebook/cards/save", {
    projectID: "project-a", expectedVersion: 0, cardType: "finding", title: "Historical references", document
  });
  assert.equal(saved.status, 201, JSON.stringify(saved));
  assert.deepEqual(saved.json.card.references.map((reference) => reference.referenceID), sectionIDs);
  const read = await request("/notebook/cards/get", { projectID: "project-a", cardID: saved.json.card.id });
  assert.deepEqual(read.json.card.document, saved.json.card.document);
  const invalid = structuredClone(document);
  invalid.document[0].content[0].props.referenceID = "31999999";
  const rejected = await request("/notebook/cards/save", {
    projectID: "project-a", expectedVersion: 0, cardType: "finding", title: "Unavailable", document: invalid
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.json.error, /Notebook reference is unavailable/);
  const historicalVersion = "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1";
  const pushed = await request("/sync/push", { batch: { user: { id: userID }, mutations: sectionIDs.map((sectionID) => ({
    projectSection: { id: `historical-${sectionID}`, userID, codeVersion: historicalVersion,
      folderClientID: "project-a", localFolderID: 41, sectionID: Number(sectionID),
      scope: "manual", updatedAt: "2026-09-12T12:00:00.000Z" }
  })) } });
  assert.equal(pushed.status, 200, JSON.stringify(pushed));
  assert.equal((await request("/projects/foundation/state", { projectID: "project-a" })).status, 200);
  const sources = await request("/reports/sources/list", { projectID: "project-a" });
  assert.equal(sources.status, 200, JSON.stringify(sources));
  const evidence = sources.json.sources.filter((source) => source.kind === "evidence");
  assert.equal(evidence.length, 2, JSON.stringify(sources));
  assert.ok(evidence.every((source) => source.codePrefix === "BC68"), JSON.stringify(evidence));
  assert.deepEqual(evidence.map((source) => source.sectionNumber).sort(), ["27-598", "27-609"]);
  console.log("Historical Notebook save/read, invalid reference rejection, and Report source identity passed.");
} finally {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
