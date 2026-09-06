import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Replay the accepted synthetic question and source selection through the real
// HTTP handler/corpus. Model output is mocked; every external fetch is forbidden.
// This reproduces source routing, not the unavailable failed Production draft.
const question = "Using the selected 2014 BC 1010.2 passage, summarize the ramp slope rule and its stated exceptions for this synthetic Project. Keep the Project’s assumptions and partial sprinkler coverage explicit; do not treat them as confirmed applicability or whole-building sprinkler protection. Identify what must be verified before applying the rule.";
const temporary = await mkdtemp(join(tmpdir(), "permitext-selected-passage-"));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-passage-grant"
});
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.origin, base, "External/provider calls are forbidden in this regression.");
  return originalFetch(input, options);
};
const userID = "apple:synthetic-passage-owner";
const projectID = "synthetic-passage-project";
let token;
async function request(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  const json = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(json)}`);
  return json;
}
try {
  await request("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const signedIn = await request("/account/sign-in", { credential: {
    provider: "apple", providerUserID: "synthetic-passage-owner",
    email: "passage@example.test", displayName: "Synthetic passage test"
  } });
  token = signedIn.account.backendSessionToken;
  const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
  const facts = [
    ["sprinkler-protection", "Sprinkler Protection", "Only the cellar is sprinklered; whole-building coverage is not established."],
    ["work-filing-type", "Work / Filing Type", "Upper-floor conversion is an assumption, not confirmed scope."],
    ["code-basis", "Code Basis", "2014 NYC Building Code assumed for this synthetic review; applicability unconfirmed."],
    ["project-status", "Project Status", "Synthetic proposed work; no approval or compliance determination."]
  ];
  const description = "Synthetic acceptance case only. Review a proposed pedestrian ramp under the 2014 NYC Building Code. The ramp is assumed to serve a means of egress; actual applicability is unconfirmed. Only the cellar is sprinklered; whole-building sprinkler coverage is not established. An upper-floor conversion remains an assumption. No approval or compliance conclusion is requested.";
  await request("/sync/push", { batch: { user: { id: userID }, mutations: [{ project: {
    id: "synthetic-passage-record", userID, codeVersion, clientID: projectID,
    name: "Synthetic Research handoff", address: "Synthetic Project A - no real property", description,
    colorHex: "#334455", sortOrder: 0, updatedAt: "2026-09-06T00:00:00.000Z",
    structuredFacts: facts.map(([key, label, value]) => ({
      id: `project-fact:${key}`, key, label, value, source: "user", status: "stated",
      updatedAt: "2026-09-06T00:00:00.000Z", sourceText: ""
    }))
  } }] } });
  const created = await request("/research/conversations/create", {
    projectID, requestID: "synthetic-passage-create", originSurface: "reader",
    sectionID: "41009495",
    selectedText: "Ramps used as part of a means of egress or part of an accessible route shall have a running slope not steeper than one unit vertical in 12 units horizontal (8-percent slope). The slope of other pedestrian ramps shall not be steeper than one unit vertical in eight units horizontal (12.5-percent slope)."
  });
  const conversationID = created.conversation.id;
  assert.equal(created.conversation.messages.length, 0);
  const result = await request("/research/conversations/message", {
    conversationID, question, requestID: "synthetic-passage-answer"
  });
  const answer = result.conversation.messages.at(-1).answer;
  assert.ok(answer, "The mock answer must complete before its source policy is inspected.");
  console.log(JSON.stringify({
    webSupportRequested: answer.retrieval.webSupportRequested,
    webSupportReasons: answer.retrieval.webSupportReasons,
    outsideCurrentLibrary: answer.retrieval.discovery.outsideCurrentLibrary.map((item) => item.sourceName),
    codeVersion: answer.codeVersion
  }));
  assert.equal(answer.retrieval.webSupportRequested, false,
    "Summarizing the selected passage must not become an outside-library lookup.");
  assert.equal(answer.retrieval.webSupportSearched, false);
  assert.deepEqual(answer.retrieval.webSupportReasons, ["selected_evidence_boundary"]);
  assert.match(answer.codeVersion, /2014-construction-codes/);
  assert.ok(answer.citations.some((citation) => String(citation.sectionID) === "41009495"));
  assert.ok(answer.citations.every((citation) => citation.codeVersion.includes("2014-construction-codes")));
  assert.equal(answer.supportingSources.length, 0);
  assert.ok(answer.retrieval.discovery.outsideCurrentLibrary.length > 0,
    "Unavailable outside sources must remain disclosed even when no lookup was requested.");
  const stored = await createFileStoreAdapter().read();
  const conversations = stored.researchConversationsByUserID[userID];
  const persisted = conversations.find((item) => item.id === conversationID);
  assert.equal(persisted.messages.length, 2);
  assert.equal(persisted.messages[0].question, question);
  assert.deepEqual(persisted.messages.at(-1).answer.codeBasis, answer.codeBasis);
  const reopened = await request("/research/conversations/get", { conversationID });
  assert.deepEqual(reopened.conversation.messages.at(-1).answer, answer);
  assert.match(JSON.stringify(answer.factUsage), /Only the cellar is sprinklered/);
  assert.match(JSON.stringify(answer.factUsage), /Upper-floor conversion is an assumption/);
  console.log("Permitext selected-passage HTTP/source-policy regression passed; external/provider calls forbidden.");
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
