// Sequential evaluation policy. Reserve the entire next turn from the settled
// conservative ledger before allowing its first provider request.
export function ownerResearchNextTurnBudget({
  previousConservativeUSD,
  operations = [],
  authorizationUSD,
  maximumBatchUSD,
  maximumTurnUSD
}) {
  const valid = (number) => typeof number === "number" && Number.isFinite(number) && number >= 0;
  if (![previousConservativeUSD, authorizationUSD, maximumBatchUSD, maximumTurnUSD].every(valid) ||
      !authorizationUSD || !maximumBatchUSD || !maximumTurnUSD || !Array.isArray(operations)) {
    throw new Error("Invalid owner evaluation budget.");
  }
  if (previousConservativeUSD + maximumBatchUSD > authorizationUSD + 1e-9) {
    throw new Error("The batch exceeds the owner's cumulative authorization.");
  }
  const ids = new Set();
  let spent = 0;
  for (const operation of operations) {
    if (!operation?.id || ids.has(operation.id) || operation.pendingProviderRequestCount !== 0 ||
        !["completed", "failed"].includes(operation.status) || !valid(operation.conservativeProviderCostUSD)) {
      throw new Error("Owner evaluation requires unique, terminal, settled operation costs.");
    }
    ids.add(operation.id);
    spent += operation.conservativeProviderCostUSD;
  }
  const settledBatchUSD = Number(spent.toFixed(6));
  const remainingBatchUSD = Number((maximumBatchUSD - settledBatchUSD).toFixed(6));
  if (remainingBatchUSD < 0) throw new Error("The settled batch already exceeds its cap.");
  return Object.freeze({
    settledBatchUSD,
    remainingBatchUSD,
    maximumNextTurnUSD: Number(Math.min(maximumTurnUSD, remainingBatchUSD).toFixed(6)),
    cumulativeConservativeUSD: Number((previousConservativeUSD + settledBatchUSD).toFixed(6))
  });
}
