import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluationBudget, evaluationCost, evaluationReservation } from "../scripts/research-evaluation-budget.mjs";
const directory = mkdtempSync(join(tmpdir(), "research-budget-test-"));
try {
  const path = join(directory, "ledger.json");
  const a = evaluationBudget(path, .20), b = evaluationBudget(path, .20);
  a.reserve({ id: "first", reservedUSD: .15 });
  assert.throws(() => b.reserve({ id: "second", reservedUSD: .01 }), /unsettled/);
  a.settle("first", { status: "settled", costUSD: .08 });
  assert.throws(() => b.reserve({ id: "second", reservedUSD: .13 }), /cap/);
  b.reserve({ id: "second", reservedUSD: .12 });
  b.settle("second", { status: "unknown" });
  assert.equal(a.snapshot().calls.length, 2);
  assert.throws(() => a.reserve({ id: "third", reservedUSD: .01 }), /unsettled/);
  assert.throws(() => evaluationBudget(path, 1).snapshot(), /reset/);
  const body = { model: "gpt-6-luna", input: "test", max_output_tokens: 1000 };
  assert(evaluationReservation(body) > evaluationCost({ usage: { input_tokens: 1000, output_tokens: 1000 } }));
  const cost = evaluationCost({ usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 100, cache_write_tokens: 200 } } });
  assert.equal(cost, (700*.1 + 100*.01 + 200*.125 + 100*.5)/1e6);
  assert.throws(() => evaluationReservation({ ...body, model: "other" }));
  assert.throws(() => evaluationReservation({ ...body, service_tier: "fast" }));
  assert.equal(evaluationCost({}), null);
  console.log("Shared budget contracts passed: cumulative cap, cache writes, unknown outcome, restart and model isolation.");
} finally { rmSync(directory, { recursive: true, force: true }); }
