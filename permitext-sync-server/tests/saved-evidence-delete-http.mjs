import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "permitext-trash-test-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-free-access-admin" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID", "STRIPE_SECRET_KEY"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, "This test must never contact an external service.");
  return originalFetch(url, options);
};
async function post(path, body, token) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
try {
  const signin = await post("/account/sign-in", { credential: { provider: "web", providerUserID: "batch-delete-test" } });
  assert.equal(signin.status, 200);
  const account = signin.body.account, userID = account.appUserID, token = account.backendSessionToken;
  await post("/admin/lifetime-grants/grant", {userID}, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const codeVersion = "nyc-2022", auth = {accountUserID:userID};
  const old = new Date(Date.now()-10000).toISOString();
  const wrap = (kind,record) => ({[kind]: {...record,userID,codeVersion,updatedAt:old}});
  const items = Array.from({length:101},(_,i)=>({sectionID:11790+i,codeVersion}));
  const mutations = [wrap("project",{id:"batch-p",clientID:"batch-p",name:"Temporary"}),
    wrap("project",{id:"other-p",clientID:"other-p",name:"Other"}),
    ...items.flatMap(item=>[wrap("savedItem",{id:`save-${item.sectionID}`,sectionID:item.sectionID}),
      wrap("projectSection",{id:`link-${item.sectionID}`,sectionID:item.sectionID,folderClientID:"batch-p"})]),
    wrap("projectSection",{id:"shared-link",sectionID:11790,folderClientID:"other-p"}),
    wrap("annotation",{id:"keep-note",sectionID:11790,noteBody:"Keep note",tags:["keep"]})];
  for(let offset=0;offset<mutations.length;offset+=100) {
    const pushed=await post("/sync/push",{auth,batch:{user:{id:userID},mutations:mutations.slice(offset,offset+100)}},token);
    assert.equal(pushed.status,200,JSON.stringify(pushed.body));assert.deepEqual(pushed.body.rejectedMutationIDs,[]);
  }
  const request={auth,projectID:"batch-p",items};
  assert.equal((await post("/saved/evidence/delete-batch",request,"wrong")).status,401);
  assert.notEqual((await post("/saved/evidence/delete-batch",{...request,auth:{accountUserID:"other"}},token)).status,200);
  assert.equal((await post("/saved/evidence/delete-batch",{...request,items:[]},token)).status,400);
  assert.equal((await post("/saved/evidence/delete-batch",{...request,items:Array(201).fill(items[0])},token)).status,400);
  assert.equal((await post("/saved/evidence/delete-batch",{...request,projectID:"foreign-project"},token)).status,409);
  assert.equal((await post("/saved/evidence/delete-batch",{...request,projectID:null},token)).status,409);
  const results=await Promise.all([post("/saved/evidence/delete-batch",request,token),post("/saved/evidence/delete-batch",request,token)]);
  results.forEach(result=>assert.equal(result.status,200,JSON.stringify(result.body)));
  assert.deepEqual(results.map(r=>r.body.deletedCount).sort((a,b)=>a-b),[0,101]);
  const removed=results.find(r=>r.body.deletedCount===101).body;
  assert.equal(removed.mutations.filter(m=>m.projectSection).length,101);
  assert.equal(removed.mutations.filter(m=>m.savedItem).length,100,"Shared saved record remains");
  assert(!removed.mutations.some(m=>m.annotation||m.project));
  const pull=await post("/sync/pull",{auth},token);
  assert(pull.body.mutations.some(m=>m.annotation?.noteBody==="Keep note"));
  assert(pull.body.mutations.some(m=>m.savedItem?.sectionID===11790&&!m.savedItem.deletedAt));
  assert(pull.body.mutations.some(m=>m.projectSection?.folderClientID==="other-p"&&!m.projectSection.deletedAt));
  const trash=await post("/content/trash",{auth,action:"list"},token);
  assert.equal(trash.body.entries.length,1);assert.equal(trash.body.entries[0].count,201);
  const restored=await post("/content/trash",{auth,action:"restore",id:trash.body.entries[0].id},token);
  assert.equal(restored.status,200);assert.equal(restored.body.restoredCount,201);
  console.log("Batch delete HTTP passed: 101 items, authenticated isolation, bounds, shared destination, notes, concurrent retries and Trash restore.");
} finally { await new Promise(resolve=>server.close(resolve)); await rm(directory,{recursive:true,force:true}); }
