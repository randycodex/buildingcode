import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { internalReviewArchivePolicy, internalReviewView } from "../internal-review-archive.mjs";
import policy from "../config/internal-review-reset.json" with { type: "json" };

const scratch = await mkdtemp(join(tmpdir(), "permitext-internal-reset-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key)) delete process.env[key];
const evaluationRoot = join(scratch, "evals"); await mkdir(join(evaluationRoot, "results"), { recursive: true });
for (const name of ["research-cases.json", "evidence-retrieval-cases.json", "zoning-cases.json", "reviews.json", "case-history.json"])
  await copyFile(new URL(`../evals/${name}`, import.meta.url), join(evaluationRoot, name));
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_EVALUATION_ROOT: evaluationRoot });
const before = new Date(Date.parse(policy.resetAt) - 1000).toISOString(), after = new Date(Date.parse(policy.resetAt) + 1000).toISOString();
const run = (runID, timestamp) => ({ schemaVersion: 3, status: "completed", completedAt: timestamp,
  configuration: { runID, createdAt: timestamp, caseIDs: [], suiteScope: "full", repeat: 1 }, results: [] });
await writeFile(join(evaluationRoot, "results", "old.json"), JSON.stringify(run("old-synthetic-run", before)));
await writeFile(join(evaluationRoot, "results", "old-no-date.json"), JSON.stringify(run(policy.runIDs[0], undefined)));
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
let previewAccount;
const nativeFetch = globalThis.fetch;
const server = createServer((request, response) => {
  if (process.argv.includes("--serve") && request.url === "/fixture/sign-in") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<script>localStorage.setItem("permitext:webAccount:v1", ${JSON.stringify(JSON.stringify(previewAccount))});location.replace("/internal");</script>`); return;
  }
  handleRequest(request, response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
globalThis.fetch = (url, options) => { assert.equal(new URL(url).origin, base, "Reset verification must never call an external service."); return nativeFetch(url, options); };
const post = (path, values = {}, account) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json",
  ...(account ? { authorization: `Bearer ${account.backendSessionToken}` } : {}) },
  body: JSON.stringify({ ...values, ...(account ? { auth: { accountUserID: account.appUserID } } : {}) }) });
try {
  const signIn = async id => (await (await post("/account/sign-in", { credential: { provider: "web", providerUserID: id, displayName: "Synthetic reset tester" } })).json()).account;
  const owner = await signIn("internal-reset-owner"), other = await signIn("internal-reset-other");
  assert(owner?.backendSessionToken && other?.backendSessionToken);
  previewAccount = { userID: owner.appUserID, sessionToken: owner.backendSessionToken };
  const adapter = createFileStoreAdapter();
  await adapter.withMutation(store => {
    store.users[owner.appUserID].email = "owner@example.test";
    store.users[owner.appUserID].productEmailPreference = { subscribed: true, updatedAt: before };
    store.researchUsageByUserID[owner.appUserID] = [{ id: "old-usage", mode: "openai", model: "synthetic", inputTokens: 1000,
      outputTokens: 100, totalTokens: 1100, estimatedCostUSD: .03, createdAt: before }];
    store.researchOperationsByUserID[owner.appUserID] = [{ id: "old-operation", mode: "openai", status: "completed", charged: true,
      estimatedCostUSD: .03, createdAt: before }];
    store.researchCreditsByUserID[owner.appUserID] = [{ id: "retained-credit", units: 25, createdAt: before }];
    store.entitlements[owner.appUserID] = { tier: "pro", source: "lifetimeGrant", grantedAt: before };
    store.researchFeedbackByUserID[owner.appUserID] = [1, 2, 3].map(id => ({ id: `old-feedback-${id}`, status: "candidate",
      triageStatus: "new", createdAt: before, updatedAt: after, userUpdatedAt: before, answerCreatedAt: before,
      question: "ARCHIVED PRIVATE REPORT", answer: { answerText: "Synthetic archived answer." }, citations: [], selectedEvidence: [] }));
  });
  const protectedState = store => JSON.stringify({ users: store.users, entitlements: store.entitlements,
    usage: store.researchUsageByUserID, operations: store.researchOperationsByUserID, credits: store.researchCreditsByUserID,
    feedback: store.researchFeedbackByUserID, grants: store.lifetimeGrantInvitationsByEmailHash });
  const initial = protectedState(await adapter.read());
  const endpoint = "/internal/evaluations/data", exportEndpoint = "/internal/evaluations/archive/export";
  const unreset = await (await post(endpoint, {}, owner)).json();
  assert.equal(unreset.dataset.cases.length, 21, "Local development keeps its golden evaluation fixtures.");
  assert.equal(internalReviewArchivePolicy({ VERCEL_ENV: "preview" }), null);
  process.env.VERCEL = "1"; process.env.VERCEL_ENV = "production";
  process.env.PERMITEXT_INTERNAL_OWNER_USER_IDS = owner.appUserID;
  for (const path of [endpoint, exportEndpoint]) {
    assert.equal((await post(path, { auth: { accountUserID: owner.appUserID } })).status, 401);
    assert.equal((await post(path, {}, other)).status, 403);
  }
  const response = await post(endpoint, {}, owner); assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const active = await response.json();
  for (const key of ["dataset", "retrievalDataset", "zoningDataset"]) assert.equal(active[key].cases.length, 0);
  for (const key of ["feedbackRecords", "feedbackCandidates", "reviews", "runs", "zoningReviewCases"]) assert.equal(active[key].length, 0);
  assert.equal(active.feedbackQuality.completedTurns, 0);
  assert.equal(active.researchSpend.totals.estimatedCostUSD, .03);
  assert.equal(active.researchSpend.totals.requests, 1);
  assert.equal(active.reviewArchive.archivedCounts.feedback, 3);
  assert.equal(active.reviewArchive.archivedCounts.runs, 2);
  const archived = await (await post(endpoint, { reviewView: "archive" }, owner)).json();
  assert.equal(archived.dataset.cases.length, 21); assert.equal(archived.retrievalDataset.cases.length, 20); assert.equal(archived.zoningDataset.cases.length, 21);
  assert.equal(archived.feedbackRecords.length, 3); assert.equal(archived.runs.length, 2);
  assert.equal(archived.feedbackQuality.completedTurns, 1);
  const withoutTimestamps = value => JSON.parse(JSON.stringify(value, (key, entry) => key === "generatedAt" ? undefined : entry));
  assert.deepEqual(withoutTimestamps(active.researchSpend), withoutTimestamps(archived.researchSpend), "Review filtering cannot reset historical spending.");
  const exported = await post(exportEndpoint, {}, owner);
  assert.match(exported.headers.get("content-disposition"), /attachment/);
  const backup = await exported.json();
  assert.equal(backup.feedbackRecords.length, 3); assert.equal(backup.dataset.cases.length, 21);
  assert(!("researchSpend" in backup), "The review backup must not include unrelated financial records.");
  assert.equal(protectedState(await adapter.read()), initial, "Resetting the console is read-only for customer data, grants, subscribers, feedback originals, and spending.");
  assert.equal((await post(endpoint, { reviewView: "invalid" }, owner)).status, 400);
  await adapter.withMutation(store => { store.researchFeedbackByUserID[owner.appUserID][0].userUpdatedAt = after; });
  await writeFile(join(evaluationRoot, "results", "fresh.json"), JSON.stringify(run("fresh-synthetic-run", after)));
  const dataset = JSON.parse(await readFile(join(evaluationRoot, "research-cases.json"), "utf8"));
  dataset.cases.push({ ...dataset.cases[0], id: "fresh-synthetic-case" });
  await writeFile(join(evaluationRoot, "research-cases.json"), JSON.stringify(dataset));
  const fresh = await (await post(endpoint, {}, owner)).json();
  assert.deepEqual(fresh.dataset.cases.map(row => row.id), ["fresh-synthetic-case"]);
  assert.deepEqual(fresh.runs.map(row => row.configuration.runID), ["fresh-synthetic-run"]);
  assert.deepEqual(fresh.feedbackRecords.map(row => row.id), ["old-feedback-1"], "A later user resubmission belongs in the fresh workspace.");
  assert.equal(fresh.researchSpend.totals.estimatedCostUSD, .03);
  assert.throws(() => internalReviewView({}, policy, "invalid"), TypeError);
  console.log("Internal reset passed: real HTTP, empty current views, complete owner-only archive/export, fresh feedback/cases/runs, production-only scope, and byte-identical protected customer/spend/grant/subscriber data.");
  if (process.argv.includes("--serve")) {
    // Leave the preview in its initial empty state after verifying fresh data.
    await adapter.withMutation(store => { store.researchFeedbackByUserID[owner.appUserID][0].userUpdatedAt = before; });
    dataset.cases.pop(); await writeFile(join(evaluationRoot, "research-cases.json"), JSON.stringify(dataset));
    await rm(join(evaluationRoot, "results", "fresh.json"));
    console.log(`Synthetic reset preview: ${base}/fixture/sign-in`);
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} finally {
  globalThis.fetch = nativeFetch;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
