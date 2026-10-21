import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultSyncCodeVersion } from "../public/sync-identity.js";

const directory = await mkdtemp(join(tmpdir(), "permitext-project-questions-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-questions-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const originalFetch = globalThis.fetch;
let base;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, "Project question tests must not call external services.");
  return originalFetch(input, options);
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const userID = "apple:synthetic-project-questions", projectID = "synthetic-questions-project";
  let token;
  async function post(path, body, expected = 200, bearer = token, accountUserID = userID) {
    const response = await fetch(`${base}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify({ auth: { accountUserID }, ...body }) });
    const json = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }
  await post("/admin/lifetime-grants/grant", { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-project-questions", email: "questions@example.test", displayName: "Synthetic project editor" } })).account.backendSessionToken;
  const updatedAt = "2026-10-10T15:00:00.000Z";
  async function push(mutations) {
    await post("/sync/push", { batch: { user: { id: userID }, mutations } });
  }
  const openQuestions = [{id:"q1",question:"Which records?",answer:"Approved plans."}];
  const recordsChecklist = [{id:"plans",label:"Approved plans",status:"requested",note:"Request pending"}];
  await push([{ project: { recordsChecklist, openQuestions, id: "synthetic-project-record", userID, clientID: projectID, name: "Questions Project",
    codeVersion: defaultSyncCodeVersion, colorHex: "#334455", sortOrder: 0, updatedAt } }]);
  let syncedProject = (await post("/sync/pull", {})).mutations.find(mutation=>mutation.project?.clientID === projectID).project;
  assert.deepEqual(syncedProject.recordsChecklist,recordsChecklist);
  assert.deepEqual(syncedProject.openQuestions,openQuestions);
  // Older clients do not send this new field: unrelated edits must retain it.
  const {recordsChecklist: omittedChecklist,openQuestions: omittedQuestions,...olderProject} = syncedProject;
  await push([{project:{...olderProject,updatedAt:"2026-10-10T15:01:00.000Z"}}]);
  syncedProject = (await post("/sync/pull", {})).mutations.find(mutation=>mutation.project?.clientID === projectID).project;
  assert.deepEqual(syncedProject.recordsChecklist,recordsChecklist);
  assert.deepEqual(syncedProject.openQuestions,openQuestions);
  await post("/sync/push", {batch:{user:{id:userID},mutations:[{project:{...syncedProject,updatedAt:"2026-10-10T15:02:00.000Z",recordsChecklist:[{...recordsChecklist[0],status:"verified-fact"}]}}]}},400);
  await post("/sync/push", {batch:{user:{id:userID},mutations:[{project:{...syncedProject,updatedAt:"2026-10-10T15:03:00.000Z",openQuestions:[{id:"q",question:42,answer:"invalid"}]}}]}},400);
  await push([{project:{...syncedProject, updatedAt:"2026-10-10T15:04:00.000Z",openQuestions:[]}}]);
  assert.deepEqual((await post("/sync/pull",{})).mutations.find(m=>m.project?.clientID===projectID).project.openQuestions,[]);
  console.log("Project questions sync: round trip, old-client preservation, invalid input rejection and explicit clearing passed.");
} finally {
  globalThis.fetch = originalFetch;
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(directory,{recursive:true,force:true});
}
