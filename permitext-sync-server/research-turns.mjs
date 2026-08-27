const defaultIncludedTurnLimit = 100;

export const researchCreditPackIDs = Object.freeze({
  turns25: "research-turns-25",
  turns100: "research-turns-100"
});

const packDefinitions = Object.freeze([
  Object.freeze({
    id: researchCreditPackIDs.turns25,
    turns: 25,
    stripePriceEnvironmentKey: "STRIPE_RESEARCH_TURNS_25_PRICE_ID",
    appleProductEnvironmentKey: "STOREKIT_RESEARCH_TURNS_25_PRODUCT_ID",
    defaultAppleProductID: "com.randycodex.permitext.research.turns.25"
  }),
  Object.freeze({
    id: researchCreditPackIDs.turns100,
    turns: 100,
    stripePriceEnvironmentKey: "STRIPE_RESEARCH_TURNS_100_PRICE_ID",
    appleProductEnvironmentKey: "STOREKIT_RESEARCH_TURNS_100_PRODUCT_ID",
    defaultAppleProductID: "com.randycodex.permitext.research.turns.100"
  })
]);

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonnegativeSafeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function includedResearchTurnLimit(environment = process.env) {
  return Math.min(
    positiveInteger(environment.PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT, defaultIncludedTurnLimit),
    100_000
  );
}

export function paidResearchTurnsEnabled(environment = process.env) {
  return environment.PERMITEXT_RESEARCH_PAID_TURNS_ENABLED === "1";
}

export function researchCreditPacks(environment = process.env) {
  return packDefinitions.map((pack) => ({
    id: pack.id,
    turns: pack.turns,
    stripePriceID: String(environment[pack.stripePriceEnvironmentKey] || "").trim() || null,
    stripePriceEnvironmentKey: pack.stripePriceEnvironmentKey,
    appleProductID: String(
      environment[pack.appleProductEnvironmentKey] || pack.defaultAppleProductID
    ).trim(),
    appleProductEnvironmentKey: pack.appleProductEnvironmentKey
  }));
}

export function researchCreditPackByID(packID, environment = process.env) {
  const normalized = String(packID || "").trim();
  return researchCreditPacks(environment).find((pack) => pack.id === normalized) || null;
}

export function researchCreditPackForStripeObject(object, environment = process.env) {
  const metadataPack = researchCreditPackByID(
    object?.metadata?.researchCreditPackID,
    environment
  );
  if (!metadataPack) return null;
  const metadataTurns = Number(object?.metadata?.researchCredits);
  if (!Number.isSafeInteger(metadataTurns) || metadataTurns !== metadataPack.turns) return null;
  return metadataPack;
}

export function researchCreditPackForAppleProductID(productID, environment = process.env) {
  const normalized = String(productID || "").trim();
  return researchCreditPacks(environment).find(
    (pack) => pack.appleProductID === normalized
  ) || null;
}

export function researchCreditRefundTarget({
  units,
  amountTotal,
  amountRefunded
} = {}) {
  const normalizedUnits = positiveInteger(units, 0);
  const normalizedTotal = Number(amountTotal);
  const normalizedRefunded = Number(amountRefunded);
  if (
    normalizedUnits <= 0 ||
    !Number.isSafeInteger(normalizedTotal) ||
    normalizedTotal <= 0 ||
    !Number.isSafeInteger(normalizedRefunded) ||
    normalizedRefunded < 0 ||
    normalizedRefunded > normalizedTotal
  ) return null;
  if (normalizedRefunded === 0) return 0;
  if (normalizedRefunded === normalizedTotal) return normalizedUnits;
  return Math.min(
    normalizedUnits,
    Math.max(1, Math.ceil((normalizedRefunded / normalizedTotal) * normalizedUnits))
  );
}

export function researchCreditClaimReconciliation({
  claim,
  targetRevokedUnits,
  eventID,
  signedDate = null,
  refundedAmount = null,
  fullRevocationStatus = "refunded",
  reason = null
} = {}) {
  const units = positiveInteger(claim?.units, 0);
  const target = Number(targetRevokedUnits);
  const normalizedEventID = String(eventID || "").trim();
  if (!units || !Number.isSafeInteger(target) || target < 0 || target > units || !normalizedEventID) {
    throw new TypeError("Research credit reconciliation is missing valid purchase state.");
  }

  const previousRevokedUnits = Math.min(
    units,
    nonnegativeSafeInteger(claim?.revokedUnits, 0)
  );
  const previousSignedDate = nonnegativeSafeInteger(claim?.lastReversalSignedDate, 0);
  const normalizedSignedDate = signedDate === null || signedDate === undefined
    ? 0
    : nonnegativeSafeInteger(signedDate, -1);
  if (normalizedSignedDate < 0) {
    throw new TypeError("Research credit reconciliation signed date is invalid.");
  }
  if (claim?.lastReversalEventID === normalizedEventID) {
    return {
      applied: false,
      reason: "duplicate",
      creditUnits: 0,
      previousRevokedUnits,
      targetRevokedUnits: previousRevokedUnits,
      nextClaim: claim
    };
  }
  if (normalizedSignedDate > 0 && previousSignedDate > normalizedSignedDate) {
    return {
      applied: false,
      reason: "stale",
      creditUnits: 0,
      previousRevokedUnits,
      targetRevokedUnits: previousRevokedUnits,
      nextClaim: claim
    };
  }

  const normalizedRefundedAmount = refundedAmount === null || refundedAmount === undefined
    ? nonnegativeSafeInteger(claim?.refundedAmount, 0)
    : nonnegativeSafeInteger(refundedAmount, -1);
  if (normalizedRefundedAmount < 0) {
    throw new TypeError("Research credit reconciliation refund amount is invalid.");
  }
  const normalizedFullStatus = fullRevocationStatus === "revoked" ? "revoked" : "refunded";
  const status = target === 0
    ? "credited"
    : target === units
      ? normalizedFullStatus
      : "partially_refunded";
  const creditUnits = previousRevokedUnits - target;
  const stateChanged =
    creditUnits !== 0 ||
    claim?.status !== status ||
    claim?.lastReversalEventID !== normalizedEventID ||
    (normalizedSignedDate > 0 && previousSignedDate !== normalizedSignedDate) ||
    nonnegativeSafeInteger(claim?.refundedAmount, 0) !== normalizedRefundedAmount;

  return {
    applied: stateChanged,
    reason: stateChanged ? "reconciled" : "duplicate",
    creditUnits,
    previousRevokedUnits,
    targetRevokedUnits: target,
    nextClaim: {
      ...claim,
      status,
      revokedUnits: target,
      refundedAmount: normalizedRefundedAmount,
      lastReversalEventID: normalizedEventID,
      lastReversalSignedDate: normalizedSignedDate || previousSignedDate,
      metadata: {
        ...(claim?.metadata || {}),
        lastReversalReason: reason || null
      }
    }
  };
}

function activeUsageEntry(entry, now = Date.now()) {
  if (entry?.mode !== "reservation") return true;
  const createdAt = Date.parse(entry.createdAt || "");
  return Number.isFinite(createdAt) && createdAt > now - (15 * 60 * 1000);
}

function completedOrActiveUsage(entries, now = Date.now()) {
  return (entries || []).filter((entry) => activeUsageEntry(entry, now));
}

export function researchCreditBalance(creditEntries) {
  return Math.max(0, (creditEntries || []).reduce((total, entry) => {
    const units = Number(entry?.units);
    return total + (Number.isSafeInteger(units) ? units : 0);
  }, 0));
}

function researchCreditsGranted(creditEntries) {
  return (creditEntries || []).reduce((total, entry) => {
    const units = Number(entry?.units);
    return total + (Number.isSafeInteger(units) && units > 0 ? units : 0);
  }, 0);
}

function researchCreditsSpent(creditEntries) {
  return (creditEntries || []).reduce((total, entry) => {
    const units = Number(entry?.units);
    return total + (Number.isSafeInteger(units) && units < 0 ? Math.abs(units) : 0);
  }, 0);
}

export function researchTurnState({
  usageEntries = [],
  creditEntries = [],
  periodStart,
  periodEnd,
  includedLimit = defaultIncludedTurnLimit,
  paidContinuationEnabled = false,
  now = Date.now()
} = {}) {
  const normalizedPeriodStart = String(periodStart || "");
  const activeEntries = completedOrActiveUsage(usageEntries, now);
  const includedEntries = activeEntries.filter((entry) =>
    entry.fundingSource !== "purchased" &&
    entry.fundingSource !== "unmetered" &&
    (!normalizedPeriodStart || String(entry.createdAt || "") >= normalizedPeriodStart)
  );
  const purchasedReservations = activeEntries.filter((entry) =>
    entry.fundingSource === "purchased" && entry.mode === "reservation"
  );
  const includedTurnsUsed = Math.min(includedEntries.length, includedLimit);
  const includedTurnsRemaining = Math.max(0, includedLimit - includedTurnsUsed);
  const purchasedTurnsGranted = researchCreditsGranted(creditEntries);
  const purchasedTurnsUsed = researchCreditsSpent(creditEntries);
  const purchasedTurnsRemaining = Math.max(
    0,
    researchCreditBalance(creditEntries) - purchasedReservations.length
  );
  const meteredTurnsRemaining = includedTurnsRemaining + purchasedTurnsRemaining;

  return {
    includedTurnsUsed,
    includedTurnLimit: includedLimit,
    includedTurnsRemaining,
    purchasedTurnsGranted,
    purchasedTurnsUsed,
    purchasedTurnsRemaining,
    turnsRemaining: paidContinuationEnabled ? meteredTurnsRemaining : null,
    canResearch: !paidContinuationEnabled || meteredTurnsRemaining > 0,
    purchaseRequired: paidContinuationEnabled && meteredTurnsRemaining === 0,
    paidContinuationEnabled: Boolean(paidContinuationEnabled),
    resetDate: periodEnd || null
  };
}

export function researchTurnFundingDecision(options = {}) {
  const state = researchTurnState(options);
  if (state.includedTurnsRemaining > 0) {
    return { allowed: true, fundingSource: "included", state };
  }
  if (state.purchasedTurnsRemaining > 0) {
    return { allowed: true, fundingSource: "purchased", state };
  }
  if (!state.paidContinuationEnabled) {
    return { allowed: true, fundingSource: "unmetered", state };
  }
  return { allowed: false, fundingSource: null, state };
}

export function publicResearchTurnPacks(environment = process.env) {
  if (!paidResearchTurnsEnabled(environment)) return [];
  return researchCreditPacks(environment).map((pack) => ({
    id: pack.id,
    turns: pack.turns,
    webAvailable: Boolean(pack.stripePriceID),
    appleProductID: pack.appleProductID
  }));
}
