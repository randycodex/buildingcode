import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildResearchSpendReport, researchSpendRange, researchSpendCSV, researchSpendRequest } from "../research-spend-report.mjs";
import { seedResearchSpend, spendFixtureMonth } from "./research-spend-fixture.mjs";
import { beginResearchSpendReservation, endResearchSpendReservation, reserveResearchProviderSpend,
  settleResearchProviderSpend, reserveResearchEmbeddingSpend, settleResearchEmbeddingSpend } from "../research-config.mjs";
import { createResearchOperationMetric } from "../research-economics.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-spend-report-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1" });
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const nativeFetch = globalThis.fetch;
let previewAccount;
const server = createServer((request, response) => {
  if (process.argv.includes("--serve") && request.url === "/fixture/sign-in") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<script>localStorage.setItem("permitext:webAccount:v1", ${JSON.stringify(JSON.stringify(previewAccount))}); location.replace("/internal");</script>`);
    return;
  }
  handleRequest(request, response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
globalThis.fetch = (url, options) => { assert.equal(new URL(url).origin, base, "No external calls allowed."); return nativeFetch(url, options); };
const post = (path, values = {}, account) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json",
  ...(account ? { authorization: `Bearer ${account.backendSessionToken}` } : {}) },
  body: JSON.stringify({ ...values, ...(account ? { auth: { accountUserID: account.appUserID } } : {}) }) });
try {
  const signIn = async id => (await (await post("/account/sign-in", { credential: { provider: "web", providerUserID: id, displayName: "Synthetic spend tester" } })).json()).account;
  const owner = await signIn("spend-report-owner"), other = await signIn("spend-report-other");
  assert(owner?.backendSessionToken && other?.backendSessionToken);
  previewAccount = { userID: owner.appUserID, sessionToken: owner.backendSessionToken };
  const adapter = createFileStoreAdapter();
  await adapter.withMutation(store => seedResearchSpend(store, owner.appUserID, other.appUserID));
  const range = researchSpendRange(spendFixtureMonth);
  const report = buildResearchSpendReport(await adapter.researchSpendRecords(range), range);
  assert.equal(report.totals.requests, 10, "Successful ledgers and operations must not be counted twice; failed/replayed attempts remain separate.");
  assert.equal(report.totals.estimatedCostUSD, .092, "Use reported provider cost, not the conservative ceiling, and include failures.");
  assert.equal(report.totals.unknownCostRequests, 2);
  assert.equal(report.totals.partialCostRequests, 1);
  assert.equal(report.totals.unknownTokenRequests, 2, "Historical failed attempts with default zeros are unknown, not free.");
  assert.equal(report.totals.partialTokenRequests, 1);
  assert.equal(report.totals.unreconciledCostUpperBoundUSD, 1.08);
  assert.equal(report.legacyUnlinkedOperations, 1);
  assert.equal(report.requests.find(row => row.id === "op-historical").totalTokens, 1100);
  assert.equal(report.requests.find(row => row.id === "op-failed").totalTokens, 1350);
  assert.equal(report.requests.find(row => row.id === "missing-price").estimatedCostUSD, null);
  assert(!JSON.stringify(report).includes("PRIVATE"));
  const legacy = researchSpendRequest({ userID: "legacy", usage: { id: "legacy", inputTokens: 10, outputTokens: 5, totalTokens: 0, estimatedCostUSD: "" } });
  assert.equal(legacy.totalTokens, 15, "Total tokens reconcile to the recorded input and output counters.");
  assert.equal(legacy.costStatus, "unknown", "An empty price is not a free request.");
  assert.equal(researchSpendRange({ period: "last-month" }, new Date("2027-01-15")).periodStart, "2026-12-01T00:00:00.000Z");
  assert.equal(researchSpendRange({ period: "custom", startDate: "2024-02-29", endDate: "2024-02-29" }).periodEnd, "2024-03-01T00:00:00.000Z");
  for (const filters of [{ period: "custom", startDate: "2026-02-30", endDate: "2026-03-01" },
    { ...spendFixtureMonth, endDate: "2026-10-31" }, { period: "invalid" }, { status: "invalid" }, []]) assert.throws(() => researchSpendRange(filters), TypeError);
  const all = buildResearchSpendReport(await adapter.researchSpendRecords(researchSpendRange({ period: "all" })), researchSpendRange({ period: "all" }));
  assert.equal(all.totals.requests, 12, "Lifetime includes the adjacent-month records, including unfinished reservations.");
  const csv = researchSpendCSV(report);
  assert(csv.includes("'=HYPERLINK") && csv.includes("HYPERLINK"), "Formula-like account text is escaped in CSV.");
  assert(csv.includes('"unknown"') && !csv.includes("PRIVATE"));
  assert.throws(() => researchSpendCSV(report, "invalid"));

  // Exercise the real production budget accumulator with several paid stages,
  // a query embedding, and a dispatched call whose usage never came back.
  const env = { PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5", PERMITEXT_RESEARCH_PRICING_VERSION: "test",
    PERMITEXT_RESEARCH_MAX_REQUEST_USD: "10", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "100",
    PERMITEXT_RESEARCH_DAILY_CAP_USD: "100", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "1000" };
  beginResearchSpendReservation({ id: "failed-accounting" }, env);
  for (let i = 0; i < 2; i++) {
    const held = reserveResearchProviderSpend({ model: "gpt-6-luna", input: "synthetic", max_output_tokens: 100 }, env);
    settleResearchProviderSpend(held, { model: "gpt-6-luna", usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200, cache_write_tokens: 300 }, output_tokens: 100 } }, env);
  }
  const { researchSemanticEmbeddingModel, researchSemanticEmbeddingDimensions } = await import("../research-semantic-passages.mjs");
  const embedding = reserveResearchEmbeddingSpend({ model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions, input: ["synthetic"], encoding_format: "float" }, env);
  settleResearchEmbeddingSpend(embedding, { usage: { total_tokens: 3, prompt_tokens: 3 } });
  reserveResearchProviderSpend({ model: "gpt-6-luna", input: "uncertain call", max_output_tokens: 100 }, env);
  const spent = endResearchSpendReservation();
  assert.equal(spent.accounting.inputTokens, 2003);
  assert.equal(spent.accounting.outputTokens, 200);
  assert.equal(spent.accounting.cachedInputTokens, 400);
  assert.equal(spent.accounting.cacheWriteInputTokens, 600);
  assert.equal(spent.accounting.totalTokens, 2203);
  assert.equal(spent.accounting.embeddingInputTokens, 3);
  assert.equal(spent.accounting.providerRequestCount, 4);
  assert.equal(spent.accounting.pendingProviderRequestCount, 1);
  assert(spent.accounting.unreconciledCostUpperBoundUSD > 0);
  const saved = createResearchOperationMetric({ id: "failed", createdAt: "2026-11-05T00:00:00Z", status: "failed", providerAccounting: { ...spent.accounting, prompt: "PRIVATE" } });
  assert.equal(saved.providerAccounting.totalTokens, 2203);
  assert(!JSON.stringify(saved).includes("PRIVATE"));

  // Simulate hosted owner access after local fixture sign-in. No real account,
  // database, provider key, or production service participates in this check.
  process.env.VERCEL = "1";
  process.env.PERMITEXT_INTERNAL_OWNER_USER_IDS = owner.appUserID;
  for (const path of ["/internal/research-spend/data", "/internal/research-spend/export"]) {
    assert.equal((await post(path, { auth: { accountUserID: owner.appUserID } })).status, 401);
    assert.equal((await post(path, { filters: spendFixtureMonth }, other)).status, 403);
  }
  const response = await post("/internal/research-spend/data", { filters: spendFixtureMonth }, owner);
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("cache-control"), /no-store/);
  const actual = (await response.json()).report;
  assert.equal(actual.totals.estimatedCostUSD, .092);
  assert.equal(actual.totals.requests, 10);
  const filtered = await (await post("/internal/research-spend/data", { filters: { ...spendFixtureMonth, userID: other.appUserID, status: "failed" } }, owner)).json();
  assert.equal(filtered.report.totals.requests, 1);
  assert.equal(filtered.report.totals.estimatedCostUSD, .02);
  assert.equal(filtered.report.accounts.length, 2);
  const exported = await post("/internal/research-spend/export", { filters: { ...spendFixtureMonth, userID: other.appUserID }, view: "requests" }, owner);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-type"), /text\/csv/);
  const exportedText = await exported.text();
  assert(exportedText.includes("other-failure") && !exportedText.includes("op-success"));
  const accountsCSV = await (await post("/internal/research-spend/export", { filters: spendFixtureMonth, view: "accounts" }, owner)).text();
  assert(accountsCSV.includes('"unknownCostRequests"') && !accountsCSV.includes('"op-success"'));
  assert.equal((await post("/internal/research-spend/data", { filters: { period: "custom", startDate: "bad", endDate: "bad" } }, owner)).status, 400);
  assert.equal((await post("/internal/research-spend/export", { view: "invalid" }, owner)).status, 400);
  console.log("Research spend: real file persistence and HTTP passed; failures, historical deduplication, UTC ranges, account/outcome filters, cost/token gaps, embeddings, CSV escaping, and owner-only access.");
  if (process.argv.includes("--serve")) {
    delete process.env.VERCEL;
    await adapter.withMutation(store => { store.users[other.appUserID].email = "tester@example.test"; });
    console.log(`Synthetic preview: ${base}/fixture/sign-in`);
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} finally {
  globalThis.fetch = nativeFetch;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
