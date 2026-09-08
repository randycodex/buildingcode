// Retained campaign only: no app, HTTP handler, credential or provider dispatch.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { researchProviderCostEntry } from "../research-cost-usage.mjs";
import { estimatedResearchCost } from "../research-config.mjs";

assert(!process.argv.includes("--run-live"));
globalThis.fetch = async () => { throw new Error("Network forbidden in retained campaign accounting."); };
const root = new URL("../", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (file) => readFile(new URL(file, root));
const round = (value, places = 8) => Number(value.toFixed(places));
const sum = (values) => round(values.reduce((sum, value) => sum + value, 0));
const percentile = (values, q) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * q) - 1] ?? null;
const terminalFile = "evals/results/research-owner-live-zoning-expansion-2026-09-08.json";
const terminalBytes = await read(terminalFile);
const terminal = JSON.parse(terminalBytes);
const ledgers = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(ledgers.length, 22);
const prices = {
  "gpt-5.6-terra": { input: 2, cacheRead: .2, cacheWrite: 2.5, output: 12 },
  "gpt-5.6-luna": { input: .2, cacheRead: .02, cacheWrite: .25, output: 1.2 }
};
const environment = {
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "standard-20260908",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02", PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "standard-luna-20260908"
};
const calls = [], attempts = [];
for (const ledger of ledgers) {
  const bytes = await read(ledger.file);
  assert.equal(hash(bytes), ledger.sha256);
  const run = JSON.parse(bytes);
  assert(["completed", "stopped"].includes(run.status));
  assert.equal(run.spend.pendingRequestCount, 0);
  assert.equal(new Set(run.results.map((item) => item.id)).size, run.results.length);
  const currentCalls = run.providerCalls.map((call, index) => {
    const rate = prices[call.model], usage = call.usage;
    assert(rate && usage && ["default", "standard"].includes(call.serviceTier));
    const entry = researchProviderCostEntry({ model: call.model, usage, output: call.output });
    assert(entry.costUsageValid && entry.pricingContext === "short", "This dated price reconstruction expects recorded short-context calls.");
    const components = {
      uncachedInputUSD: (entry.inputTokens - entry.cachedInputTokens - entry.cacheWriteInputTokens) * rate.input / 1e6,
      cacheReadUSD: entry.cachedInputTokens * rate.cacheRead / 1e6,
      cacheWriteUSD: entry.cacheWriteInputTokens * rate.cacheWrite / 1e6,
      outputUSD: entry.outputTokens * rate.output / 1e6,
      webSearchUSD: entry.webSearchCalls * .01
    };
    const usageEstimateUSD = sum(Object.values(components));
    const runtimeEstimate = estimatedResearchCost({ modelUsage: [entry] }, environment);
    assert(Math.abs(runtimeEstimate.estimatedUSD - usageEstimateUSD) <= .000001,
      "Runtime estimate must match all recorded billing components within its one-microdollar precision.");
    return { file: ledger.file, index, caseID: call.caseID, phase: call.phase, model: call.model,
      inputTokens: entry.inputTokens, cacheWriteInputTokens: entry.cacheWriteInputTokens,
      outputTokens: entry.outputTokens, webSearchCalls: entry.webSearchCalls,
      usageEstimateUSD, components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])),
      previouslyOmittedCacheWritePremiumUSD: round(entry.cacheWriteInputTokens * (rate.cacheWrite - rate.input) / 1e6) };
  });
  calls.push(...currentCalls);
  const matched = new Set();
  for (const result of run.results) {
    const related = currentCalls.filter((call) => call.caseID === result.id);
    related.forEach((call) => matched.add(call.index));
    const operations = result.operations || [];
    assert(operations.every((operation) => operation.pendingProviderRequestCount === 0));
    const answeringCalls = related.filter((call) => ["permitext_code_interpretation", "permitext_official_guidance_summary"].includes(call.phase));
    attempts.push({ file: ledger.file, sourceCommit: run.sourceCommit || null, id: result.id,
      scope: result.scope === "verifier-only" ? "verifier-only" : "research-http",
      delivered: !!result.answer, charged: operations.some((operation) => operation.charged),
      providerCalls: related.length, answeringCalls: answeringCalls.length,
      additionalAnsweringCallsUSD: sum(answeringCalls.slice(1).map((call) => call.usageEstimateUSD)),
      usageEstimateUSD: sum(related.map((call) => call.usageEstimateUSD)),
      conservativeUSD: sum(operations.map((operation) => operation.conservativeProviderCostUSD || 0)),
      historicalFailureCodes: operations.map((operation) => operation.failureCode).filter(Boolean),
      durationMilliseconds: result.durationMilliseconds ?? null });
  }
  assert.equal(matched.size, currentCalls.length, "Every provider call must belong to a retained case attempt.");
}
const full = attempts.filter((item) => item.scope === "research-http");
const delivered = full.filter((item) => item.delivered);
const failed = full.filter((item) => !item.delivered);
const verifierOnly = attempts.filter((item) => item.scope === "verifier-only");
const group = (key) => [...new Set(calls.map((call) => call[key]))].map((value) => {
  const items = calls.filter((call) => call[key] === value);
  return { [key]: value, calls: items.length, usageEstimateUSD: sum(items.map((call) => call.usageEstimateUSD)),
    inputTokens: sum(items.map((call) => call.inputTokens)), outputTokens: sum(items.map((call) => call.outputTokens)) };
}).sort((a, b) => b.usageEstimateUSD - a.usageEstimateUSD);
const summary = {
  packages: ledgers.length, recordedProviderCalls: calls.length, newProviderCalls: 0, networkCalls: 0,
  usageEstimateUSD: sum(calls.map((call) => call.usageEstimateUSD)),
  conservativeUSD: sum(attempts.map((item) => item.conservativeUSD)),
  previouslyOmittedCacheWritePremiumUSD: sum(calls.map((call) => call.previouslyOmittedCacheWritePremiumUSD)),
  webSearchCalls: sum(calls.map((call) => call.webSearchCalls)),
  components: Object.fromEntries(Object.keys(calls[0].components).map((key) => [key, sum(calls.map((call) => call.components[key]))])),
  fullHTTPAttempts: full.length, deliveredAttempts: delivered.length, undeliveredAttempts: failed.length,
  verifierOnlyChecks: verifierOnly.length, verifierOnlyCostUSD: sum(verifierOnly.map((item) => item.usageEstimateUSD)),
  fullHTTPCostUSD: sum(full.map((item) => item.usageEstimateUSD)),
  failedAttemptCostUSD: sum(failed.map((item) => item.usageEstimateUSD)),
  additionalAnsweringCallsUSD: sum(full.map((item) => item.additionalAnsweringCallsUSD)),
  deliveredAttemptCostP50USD: percentile(delivered.map((item) => item.usageEstimateUSD), .5),
  deliveredAttemptCostP90USD: percentile(delivered.map((item) => item.usageEstimateUSD), .9),
  failureAmortizedCostPerDeliveredUSD: sum(full.map((item) => item.usageEstimateUSD)) / delivered.length,
  strictQualityAcceptedCostPerAnswerUSD: null
};
assert.equal(summary.recordedProviderCalls, 162); assert.equal(summary.fullHTTPAttempts, 72);
assert.equal(summary.deliveredAttempts, 61); assert.equal(summary.verifierOnlyChecks, 17);
assert.equal(summary.conservativeUSD, 7.887898);
assert.equal(summary.usageEstimateUSD, 3.88947242);
const sourceHashes = Object.fromEntries(await Promise.all([
  "research-cost-usage.mjs", "research-config.mjs", "research-provider-client.mjs",
  "research-economics.mjs", "app.mjs", "scripts/report-research-owner-costs-20260908.mjs"
].map(async (file) => [file, hash(await read(file))])));
const report = {
  schema: "permitext-owner-retained-cost-audit-v1", checkedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  pricing: { checkedOn: "2026-09-08", source: "https://developers.openai.com/api/docs/pricing", tier: "standard short context",
    perMillionUSD: prices, webSearchCallUSD: .01, providerInvoiceVerified: false },
  sourceHashes, ledgers, summary, byPhase: group("phase"), byModel: group("model"),
  highestCostAttempts: full.slice().sort((a, b) => b.usageEstimateUSD - a.usageEstimateUSD).slice(0, 10), attempts,
  limitations: ["Mixed development versions, repeated cases and synthetic evaluation accounts; not a representative customer-month forecast.",
    "Delivered answers include known quality defects. A consistent strict review of all answers is absent, so no cost per quality-accepted answer is claimed.",
    "Additional answering requests and failed-attempt costs overlap; do not add them as independent savings.",
    "Web tool fees and cache writes are included. Hosting, payment fees, support and refunds are outside these provider-only figures.",
    "Runtime verification and repairs remain part of Research cost. The 17 separate verifier-only checks are evaluation overhead.",
    "The authorization ledger is preserved; this recalculation does not authorize paid runs or change the remaining cap."]
};
const output = process.argv.indexOf("--output");
if (output !== -1) {
  assert(process.argv[output + 1]);
  await writeFile(process.argv[output + 1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ summary, byPhase: report.byPhase, byModel: report.byModel }, null, 2));
