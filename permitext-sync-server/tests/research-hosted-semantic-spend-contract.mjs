import assert from "node:assert/strict";
import {
  beginResearchSpendReservation, prepareResearchSpendReservation, endResearchSpendReservation,
  researchEmbeddingUsage, reserveResearchEmbeddingSpend, settleResearchEmbeddingSpend,
  reserveResearchProviderSpend, settleResearchProviderSpend,
  estimatedResearchCost, estimatedResearchCostWithProviderAllowance
} from "../research-config.mjs";
import {
  createResearchSemanticSearch, requestResearchEmbeddings, loadResearchSemanticVectors,
  researchPassageEmbeddingText, researchSemanticInputHash, researchSemanticEmbeddingModel,
  researchSemanticEmbeddingDimensions, researchSemanticEmbeddingTextVersion,
  researchSemanticEmbeddingPricingVersion
} from "../research-semantic-passages.mjs";

const environment = {
  VERCEL_ENV: "production", PERMITEXT_RESEARCH_MAX_REQUEST_USD: ".001",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "7",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "synthetic-writer-rates"
};
const body = { model: researchSemanticEmbeddingModel, dimensions: researchSemanticEmbeddingDimensions,
  input: ["ordinary project question"], encoding_format: "float" };
const basis = Array.from({ length: 256 }, (_, index) => index === 0 ? 1 : 0);
const passage = { id: "synthetic-current", sectionID: "synthetic-current", codePrefix: "BC",
  corpusID: "synthetic-current-corpus", codeVersion: "synthetic-current-edition",
  sectionNumber: "990.1", title: "General safety", text: "990.1 General safety. Keep the access passage clear.",
  contextTexts: [], scopeComplete: true };
const index = { passages: [passage] };
const vectors = await loadResearchSemanticVectors({ schemaVersion: 1, model: researchSemanticEmbeddingModel,
  dimensions: 256, embeddingTextVersion: researchSemanticEmbeddingTextVersion,
  entries: [{ inputHash: researchSemanticInputHash(researchPassageEmbeddingText(passage)), embedding: basis }] });
let calls = 0;
const provider = async (url, request) => {
  calls += 1;
  assert.equal(url, "https://api.openai.com/v1/embeddings");
  assert(researchEmbeddingUsage()?.providerRequestCount > 0, "Dispatch must occur only after request-bound spend was reserved.");
  const sent = JSON.parse(request.body);
  return Response.json({ model: sent.model, usage: { prompt_tokens: 1000, total_tokens: 1000 },
    data: [{ index: 0, embedding: basis }] });
};
const hooks = {
  beforeRequest: ({ body: input }) => reserveResearchEmbeddingSpend(input, environment),
  afterRequest: value => settleResearchEmbeddingSpend(value.reservation, value)
};
const search = createResearchSemanticSearch({ vectors, enabled: true, apiKey: "synthetic-key", fetchImpl: provider, ...hooks });

prepareResearchSpendReservation();
await assert.rejects(requestResearchEmbeddings(["No durable turn"], {
  enabled: true, apiKey: "synthetic-key", fetchImpl: provider, ...hooks
}), { code: "RESEARCH_SPEND_CAP" });
assert.equal(calls, 0, "Preparing an inactive scope must not authorize spending.");
assert.equal(endResearchSpendReservation(), null);

// Activation in a lazy async provider hook must remain visible to the parent
// HTTP turn after await; it must not replace a nested AsyncLocalStorage scope.
prepareResearchSpendReservation();
let durable = false;
const first = await search.search(index, "How is this passage kept safe?", {
  beforeRequest: async ({ body: input }) => {
    await Promise.resolve();
    durable = true;
    beginResearchSpendReservation({ id: "durable-turn-a" }, environment);
    return reserveResearchEmbeddingSpend(input, environment);
  }
});
assert(durable);
assert.equal(first.metadata.fallbackReason, null);
assert.equal(calls, 1);
assert.equal(researchEmbeddingUsage().inputTokens, 1000);
assert.equal(researchEmbeddingUsage().providerRequestCount, 1);
const writer = reserveResearchProviderSpend({ model: "gpt-6-luna", input: "bounded writer", max_output_tokens: 100 }, environment);
settleResearchProviderSpend(writer, { usage: { input_tokens: 100, output_tokens: 10 } }, environment);
const finalA = endResearchSpendReservation();
assert.equal(finalA.id, "durable-turn-a");
assert.equal(finalA.providerRequestCount, 2);
assert.equal(finalA.pendingProviderReservationCount, 0);
assert.equal(finalA.embeddingUsage.modelUsage[0].pricingVersion, researchSemanticEmbeddingPricingVersion);
assert.equal(estimatedResearchCost(finalA.embeddingUsage, environment).estimatedUSD, .00002);
assert.equal(finalA.actualUSD, .000035, "Embedding and generation actual costs must share one cumulative ledger.");

prepareResearchSpendReservation();
let missHookCalls = 0;
const cached = await search.search(index, "How is this passage kept safe?", {
  beforeRequest: () => { missHookCalls += 1; throw new Error("A cache hit must not reserve another turn."); }
});
assert(cached.metadata.queryCached);
assert.equal(cached.metadata.costUSD, 0);
assert.equal(missHookCalls, 0);
assert.equal(calls, 1);
assert.equal(endResearchSpendReservation(), null);

// Distinct queued requests keep their originating owner, while the same-query
// waiter reuses the first owner's vector without acquiring another expense.
const concurrent = await Promise.all(["owner-one", "owner-two", "owner-three"].map(async (id, position) => {
  prepareResearchSpendReservation();
  const hit = await search.search(index, position < 2 ? "Shared new wording?" : "Distinct new wording?", {
    beforeRequest: async ({ body: input }) => {
      await Promise.resolve();
      beginResearchSpendReservation({ id }, environment);
      return reserveResearchEmbeddingSpend(input, environment);
    }
  });
  return { hit, ledger: endResearchSpendReservation() };
}));
assert.equal(concurrent[0].ledger.id, "owner-one");
assert.equal(concurrent[0].ledger.embeddingUsage.providerRequestCount, 1);
assert.equal(concurrent[1].ledger, null);
assert(concurrent[1].hit.metadata.queryCached);
assert.equal(concurrent[2].ledger.id, "owner-three");
assert.equal(concurrent[2].ledger.embeddingUsage.providerRequestCount, 1);
assert.equal(calls, 3);

prepareResearchSpendReservation();
const handled = Object.assign(new Error("Duplicate or credit response already sent"), { code: "RESEARCH_REQUEST_HANDLED" });
await assert.rejects(search.search(index, "Never dispatch this duplicate", { beforeRequest: async () => { throw handled; } }), error => error === handled);
assert.equal(calls, 3);
assert.equal(endResearchSpendReservation(), null);

// The same conservative cap covers an unknown query and a later answer.
beginResearchSpendReservation({ id: "unknown-outcome" }, { ...environment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: ".0003" });
let unknownCalls = 0;
const unknown = createResearchSemanticSearch({ vectors, enabled: true, apiKey: "synthetic-key", ...hooks,
  fetchImpl: async () => { unknownCalls += 1; return Response.json({ model: researchSemanticEmbeddingModel, data: [{ index: 0, embedding: basis }] }); } });
const unknownResult = await unknown.search(index, "Unreported query usage?");
assert.equal(unknownResult.metadata.fallbackReason, "SEMANTIC_RESPONSE_INVALID");
assert.equal(unknown.cacheSize, 0);
assert.equal(researchEmbeddingUsage().pendingProviderRequestCount, 1);
assert(researchEmbeddingUsage().unreconciledProviderCostUSD > 0);
assert.equal(estimatedResearchCostWithProviderAllowance(researchEmbeddingUsage(), environment).estimatedUSD,
  researchEmbeddingUsage().unreconciledProviderCostUSD);
await unknown.search(index, "A retry also has a reservation");
assert.equal(unknownCalls, 1, "A retry must not exceed the cumulative cap after unknown usage.");
assert.throws(() => reserveResearchProviderSpend({ model: "gpt-6-luna", input: "later writer", max_output_tokens: 1000 }, environment), { code: "RESEARCH_SPEND_CAP" });
assert.equal(endResearchSpendReservation().pendingProviderReservationCount, 1);

beginResearchSpendReservation({ id: "timeout-outcome" }, environment);
const timeout = createResearchSemanticSearch({ vectors, enabled: true, apiKey: "synthetic-key", ...hooks, timeoutMS: 3,
  fetchImpl: async (_, request) => new Promise((resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(request.signal.reason));
  }) });
const keepAlive = setTimeout(() => {}, 50);
assert.equal((await timeout.search(index, "Timeout query")).metadata.fallbackReason, "semantic_provider_timeout");
clearTimeout(keepAlive);
assert.equal(endResearchSpendReservation().pendingProviderReservationCount, 1);

beginResearchSpendReservation({ id: "known-rejected" }, environment);
const rejected = createResearchSemanticSearch({ vectors, enabled: true, apiKey: "synthetic-key", ...hooks,
  fetchImpl: async () => Response.json({ error: { message: "synthetic rejection" } }, { status: 400 }) });
assert.equal((await rejected.search(index, "Rejected query")).metadata.fallbackReason, "SEMANTIC_PROVIDER_REJECTED");
const rejectedLedger = endResearchSpendReservation();
assert.equal(rejectedLedger.providerRequestCount, 1);
assert.equal(rejectedLedger.reservedUSD, 0);
assert.equal(rejectedLedger.actualUSD, 0);
assert.equal(rejectedLedger.pendingProviderReservationCount, 0);

// A bad vector is unusable evidence, but known usage was still paid. A second
// error callback cannot undo or duplicate that provider settlement.
beginResearchSpendReservation({ id: "invalid-vector" }, environment);
let settledToken;
const invalid = createResearchSemanticSearch({ vectors, enabled: true, apiKey: "synthetic-key", ...hooks,
  beforeRequest: ({ body: input }) => (settledToken = reserveResearchEmbeddingSpend(input, environment)),
  fetchImpl: async () => Response.json({ model: researchSemanticEmbeddingModel,
    usage: { prompt_tokens: 1000, total_tokens: 1000 }, data: [{ index: 0, embedding: [1, 2] }] }) });
assert.equal((await invalid.search(index, "Invalid vector query")).metadata.fallbackReason, "SEMANTIC_VECTOR_INVALID");
settleResearchEmbeddingSpend(settledToken, { status: "unknown" });
assert.equal(endResearchSpendReservation().actualUSD, .00002);
beginResearchSpendReservation({ id: "different-owner" }, environment);
assert.throws(() => settleResearchEmbeddingSpend(settledToken, { status: "unknown" }), { code: "RESEARCH_SPEND_CAP" });
assert.equal(endResearchSpendReservation().providerRequestCount, 0);

assert.equal(estimatedResearchCost({ modelUsage: [{ ...finalA.embeddingUsage.modelUsage[0], dimensions: 128 }] }, environment).estimatedUSD, null);
assert.equal(estimatedResearchCost({ modelUsage: [{ ...finalA.embeddingUsage.modelUsage[0], pricingVersion: "unreviewed" }] }, environment).estimatedUSD, null);
console.log("Hosted semantic spend contracts passed: lazy durable activation, request ownership, cache hits, cumulative query/writer caps, unknown outcomes, exact usage and no unreserved dispatch.");
