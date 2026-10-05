import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluationBudget } from "./research-evaluation-budget.mjs";
import { validationPricing, validationReservation, validationCost } from "./research-validation-pricing-20261005.mjs";
import { researchProviderReadiness } from "./research-provider-readiness-20261005.mjs";

async function readinessWith(responseStatus) {
  const dispatched = [];
  const readiness = await researchProviderReadiness({ apiKey: "test-only-secret", fetchImpl: async (url, options) => {
    dispatched.push({ url, method: options.method, body: options.body });
    assert.equal(options.headers.authorization, "Bearer test-only-secret");
    const models = url.endsWith("/models");
    const rejected = url.endsWith("/responses") && responseStatus === 401;
    return new Response(JSON.stringify(models
      ? { data: ["gpt-6-luna", "text-embedding-3-small"].map(id => ({ id })) }
      : { error: rejected ? { code: "invalid_api_key", type: "invalid_request_error", message: "Key test-only-secret rejected" }
        : { type: "invalid_request_error", message: "Missing required parameter: 'model'." } }),
      { status: models ? 200 : rejected ? 401 : 400 });
  } });
  assert(dispatched.filter(call => call.method === "POST").every(call => call.body === "{}"));
  assert(!JSON.stringify(readiness).includes("test-only-secret"));
  return readiness;
}
assert.equal((await readinessWith(401)).ready, false, "Model-list access must not mask Responses auth failure");
assert.equal((await readinessWith(400)).ready, true);
assert.equal((await researchProviderReadiness({ apiKey: null, fetchImpl: () => assert.fail("No key must make no request") })).ready, false);

const directory = await mkdtemp(join(tmpdir(), "permitext-validation-controls-"));
try {
  const path = join(directory, "ledger.json"), budget = evaluationBudget(path, 10.99, validationPricing);
  const body = { model: "gpt-6.1-sol", service_tier: "default", input: "source text", max_output_tokens: 5000 };
  const reservation = validationReservation(body);
  const cost = validationCost({ model: "gpt-6.1-sol", service_tier: "priority", usage: {
    input_tokens: 12, input_tokens_details: { cached_tokens: 2 }, output_tokens: 5000 } });
  assert(cost <= reservation);
  budget.reserve({ id: "one", reservedUSD: reservation });
  assert.throws(() => budget.reserve({ id: "two", reservedUSD: .1 }), /Reconcile/);
  budget.settle("one", { status: "rejected", costUSD: 0 });
  assert.equal(budget.snapshot().calls[0].costUSD, 0);
  assert.throws(() => evaluationBudget(path, 11, validationPricing).snapshot(), /reset or expand/);
  assert.throws(() => evaluationBudget(path, 10.99, { changed: true }).snapshot(), /change campaign pricing/);
  budget.reserve({ id: "unknown", reservedUSD: .1 });
  budget.settle("unknown", { status: "unknown" });
  assert.throws(() => budget.reserve({ id: "three", reservedUSD: .1 }), /Reconcile/);
  assert.throws(() => validationReservation({ ...body, tools: [{ type: "web_search" }] }));
  assert.throws(() => validationCost({ model: "unexpected", usage: { input_tokens: 1, output_tokens: 1 } }));
} finally { await rm(directory, { recursive: true, force: true }); }
console.log("Readiness, credential redaction, reservations and durable spending controls passed (zero provider calls).");
