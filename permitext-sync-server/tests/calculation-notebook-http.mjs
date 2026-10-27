import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-calculation-notebook-http-"));
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
const userID = "apple:synthetic-calculation-owner";
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

const {calculateOccupantLoad, calculationNoteBlocks} = await import("../public/occupant-load-calculation.js");
const {emptyNotebookDocument} = await import("../notebook-contract.mjs");
try {
  assert.equal((await request("/admin/lifetime-grants/grant", {userID}, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status,200);
  const signIn=await request("/account/sign-in", {credential:{provider:"apple",providerUserID:"synthetic-calculation-owner",email:"calculation@example.test",displayName:"Synthetic calculation"}});
  token=signIn.json.account.backendSessionToken;
  const codeVersion="CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  assert.equal((await request("/sync/push",{batch:{user:{id:userID},mutations:[{project:{id:"calc-project",userID,codeVersion,clientID:"calculation-project",name:"Synthetic calculation acceptance",colorHex:"#334455",sortOrder:0,updatedAt:new Date().toISOString()}}]}})).status,200);
  const calculation=calculateOccupantLoad({spaceFunction:"Synthetic test space",area:"1201",factor:"100",areaBasis:"gross",factorBasis:"Synthetic inputs",seating:"without-fixed-seating"});
  const link={id:"calculation-source",label:"BC 2022 § 1004.1.3",relationshipRole:"context",projectID:"calculation-project",source:{codePrefix:"BC",codeVersion,codeEdition:"2022",sourceID:"2152",sectionID:"2152",sectionNumber:"1004.1.3",sectionTitle:"Areas without fixed seating",sourceLibraryVersion:codeVersion},passages:[{exact:"The number of occupants shall be computed at the rate of one occupant per unit of area as prescribed in Table 1004.1.3."}],noteTextVersion:1,createdAt:new Date().toISOString()};
  const document=emptyNotebookDocument();document.document=calculationNoteBlocks(calculation,[link]);
  const saveBody={projectID:"calculation-project",clientMutationID:"calculation-acceptance",expectedVersion:0,cardType:"finding",title:"Synthetic calculation",document,evidenceLinks:[link],openQuestions:[{id:"review",text:"Review cumulative loads and exceptions",status:"open",why:"Single-space calculation",resolution:""}]};
  const saved=await request("/notebook/cards/save",saveBody);assert.equal(saved.status,201,JSON.stringify(saved));
  const replay=await request("/notebook/cards/save",saveBody);assert.equal(replay.status,200);assert.equal(replay.json.card.id,saved.json.card.id);
  const get=await request("/notebook/cards/get",{projectID:"calculation-project",cardID:saved.json.card.id});
  assert.equal(get.status,200);assert.match(get.json.card.plainText,/13 people/);assert.match(get.json.card.plainText,/Needs review/);
  assert.doesNotMatch(get.json.card.plainText,/author confirmed/i);
  assert.equal(get.json.card.evidenceLinks[0].source.codeVersion,codeVersion);assert.equal(get.json.card.openQuestions[0].status,"open");
  assert.equal(get.json.card.sourceClassification,"user-authored");
  assert.equal(get.json.card.evidenceLinks[0].noteTextVersion,1);
  const {restoreNotebookPassageText}=await import('../public/notebook-passage-blocks.js');
  const restored=restoreNotebookPassageText(get.json.card.document,get.json.card.evidenceLinks);
  assert.equal(restored.changed,false,'A reloaded calculator Note retains its compact body.');
  assert.equal(restored.evidenceLinks[0].passages[0].exact,link.passages[0].exact);
  assert.doesNotMatch(get.json.card.plainText,/The number of occupants shall be computed/);
  const customCalculation=calculateOccupantLoad({...calculation.input,factorMode:"custom",factor:"50",tableFactor:"100",tableRowID:"synthetic-row",customReason:"Synthetic design reference CALC-7"});
  const customDocument=emptyNotebookDocument();customDocument.document=calculationNoteBlocks(customCalculation,[link]);
  const customBody={...saveBody,clientMutationID:"custom-calculation-acceptance",title:"Custom factor calculation",document:customDocument};
  const customSaved=await request("/notebook/cards/save",customBody);assert.equal(customSaved.status,201);
  const customReplay=await request("/notebook/cards/save",customBody);assert.equal(customReplay.json.card.id,customSaved.json.card.id);
  const customGet=await request("/notebook/cards/get",{projectID:"calculation-project",cardID:customSaved.json.card.id});
  assert.equal(customGet.status,200);assert.match(customGet.json.card.plainText,/25 people/);
  assert.match(customGet.json.card.plainText,/Custom factor \(user-defined\): 50/);
  assert.match(customGet.json.card.plainText,/BC table factor: 100/);
  assert.match(customGet.json.card.plainText,/Synthetic design reference CALC-7/);
  assert.equal(customGet.json.card.sourceClassification,"user-authored");assert.equal(customGet.json.card.evidenceLinks[0].source.codeVersion,codeVersion);
  assert.equal((await request("/sync/push",{batch:{user:{id:userID},mutations:[{project:{id:"other-project-record",userID,codeVersion,clientID:"other-project",name:"Separate synthetic project",colorHex:"#334455",sortOrder:1,updatedAt:new Date().toISOString()}}]}})).status,200);
  assert.equal((await request("/notebook/cards/get",{projectID:"other-project",cardID:saved.json.card.id})).status,404);
  const sources=await request("/reports/sources/list",{projectID:"calculation-project"});assert.equal(sources.status,200);
  const note=sources.json.sources.find(s=>s.kind==="notebookCard"&&s.id===saved.json.card.id);assert(note,JSON.stringify(sources));
  assert.match(note.plainText || note.text || JSON.stringify(note),/13 people/);
  assert(sources.json.sources.some(s=>s.kind==="notebookCard"&&s.id===customSaved.json.card.id));
  console.log("Calculation → Notebook durable round trip, retry identity, cross-Project denial and Report source availability passed; zero external/provider calls.");
} finally {
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}
