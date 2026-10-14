import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeResearchMessages, activeResearchTopicContext } from "../research-context-state.mjs";

const temporary = await mkdtemp(join(tmpdir(), "permitext-research-notebook-http-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-cas-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
let dropResponsePath = null;
let droppedResponses = 0;
const server = createServer((request, response) => {
  if (request.url === dropResponsePath) {
    dropResponsePath = null;
    // Execute the real handler and persist its result, then sever the socket
    // before its final response reaches the client.
    response.end = () => { droppedResponses += 1; response.destroy(); return response; };
  }
  return handleRequest(request, response);
});
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
  const document = {schema:"permitext-notebook-card", schemaVersion:1, format:"tiptap-json", document:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Check the supporting evidence."}]}]}};
  const questions = [{id:"sprinkler",text:"Confirm sprinkler protection",why:"The selected provision depends on this condition.",status:"open",resolution:""}];
  const draft = {projectID:"project-a",expectedVersion:0,clientMutationID:"question-create",cardType:"finding",title:"Question test",document,openQuestions:questions};
  const created = await request("/notebook/cards/save",draft);
  assert.equal(created.status,201,JSON.stringify(created));
  assert.deepEqual(created.json.card.openQuestions,questions);
  const id=created.json.card.id;
  const replay = await request("/notebook/cards/save",draft);
  assert.equal(replay.json.replayed,true);
  assert.equal((await request("/notebook/cards/save",{...draft,openQuestions:[]})).status,409,"Receipt identity covers questions");
  const oldClient = await request("/notebook/cards/save",{projectID:"project-a",cardID:id,expectedVersion:1,cardType:"finding",title:"Legacy edit",document});
  assert.equal(oldClient.status,200);
  assert.deepEqual(oldClient.json.card.openQuestions,questions,"Older clients must preserve questions they do not send");
  const invalid = await request("/notebook/cards/save",{...draft,cardID:id,expectedVersion:2,clientMutationID:"invalid-resolution",openQuestions:[{...questions[0],status:"resolved"}]});
  assert.equal(invalid.status,400,"Resolution requires supporting explanation");
  const summary=await request("/reports/sources/list",{projectID:"project-a"});
  assert.deepEqual(summary.json.sources.find(item=>item.id===id).openQuestions,questions);
  const preview=await request("/reports/sources/preview",{projectID:"project-a",kind:"notebookCard",sourceID:id});
  assert.equal(preview.status,200,JSON.stringify(preview));
  const frozenPreview=JSON.stringify(preview.json);
  assert.doesNotMatch(frozenPreview,/Confirm sprinkler protection/, "Retired question metadata is not appended to Report output");
  const resolved=[{...questions[0],status:"resolved",resolution:"Reviewed the approved sprinkler drawings."}];
  const saved=await request("/notebook/cards/save",{...draft,cardID:id,expectedVersion:2,clientMutationID:"resolved",openQuestions:resolved});
  assert.equal(saved.status,200,JSON.stringify(saved));
  assert.deepEqual(saved.json.card.openQuestions,resolved);
  assert.equal((await request("/notebook/cards/save",{...draft,cardID:id,expectedVersion:2,clientMutationID:"stale-open"})).status,409);
  assert.equal(JSON.stringify(preview.json),frozenPreview,"Previously captured report source remains unchanged");
  assert.equal((await request("/notebook/cards/list",{projectID:"project-a"})).json.cards.find(item=>item.id===id).openQuestions[0].status,"resolved");
  console.log("Questions HTTP passed: durable create/replay, legacy preservation, resolution validation, conflict, Notebook metadata compatibility and question-free Report output.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
