import assert from "node:assert/strict";
import { ownerResearchNextTurnBudget } from "../evals/research-owner-batch-budget.mjs";
const input = { previousConservativeUSD: 4.559495, authorizationUSD: 8, maximumBatchUSD: 3.2, maximumTurnUSD: 0.85 };
const op = (id, cost, extra = {}) => ({ id, status: "completed", pendingProviderRequestCount: 0, conservativeProviderCostUSD: cost, ...extra });
assert.equal(ownerResearchNextTurnBudget(input).maximumNextTurnUSD, 0.85);
assert.deepEqual(ownerResearchNextTurnBudget({ ...input, operations: [op("a", 1.2), op("b", 1.8, { status: "failed" })] }), {
  settledBatchUSD: 3, remainingBatchUSD: 0.2, maximumNextTurnUSD: 0.2, cumulativeConservativeUSD: 7.559495
});
assert.equal(ownerResearchNextTurnBudget({ ...input, operations: [op("a", 3.2)] }).maximumNextTurnUSD, 0);
for (const operations of [
  [op("a", 1, { pendingProviderRequestCount: 1 })],
  [op("a", 1, { status: "running" })],
  [op("a", 1), op("a", 1)],
  [op("a", NaN)], [op("a", -1)], [op("a", null)], [op("a", 3.200001)]
]) assert.throws(() => ownerResearchNextTurnBudget({ ...input, operations }));
assert.throws(() => ownerResearchNextTurnBudget({ ...input, maximumBatchUSD: 3.5 }));
console.log("Sequential owner budget contract passed: failed work counts, pending/duplicate/missing costs block, final turn shrinks before dispatch, cumulative authorization preserved.");
