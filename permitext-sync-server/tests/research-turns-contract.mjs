import assert from "node:assert/strict";
import {
  includedResearchTurnLimit,
  paidResearchTurnsEnabled,
  publicResearchTurnPacks,
  researchCreditBalance,
  researchCreditClaimReconciliation,
  researchCreditPackForAppleProductID,
  researchCreditPackForStripeObject,
  researchCreditPacks,
  researchCreditRefundTarget,
  researchTurnFundingDecision,
  researchTurnState
} from "../research-turns.mjs";

const environment = {
  PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "100",
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "1",
  STRIPE_RESEARCH_TURNS_25_PRICE_ID: "price_turns_25",
  STOREKIT_RESEARCH_TURNS_100_PRODUCT_ID: "test.permitext.turns.100"
};
const packs = researchCreditPacks(environment);
assert.equal(includedResearchTurnLimit(environment), 100);
assert.equal(paidResearchTurnsEnabled(environment), true);
assert.deepEqual(packs.map((pack) => [pack.id, pack.turns]), [
  ["research-turns-25", 25],
  ["research-turns-100", 100]
]);
assert.equal(publicResearchTurnPacks(environment)[0].webAvailable, true);
assert.equal(publicResearchTurnPacks(environment)[1].webAvailable, false);
assert.equal(
  researchCreditPackForAppleProductID("test.permitext.turns.100", environment)?.turns,
  100
);
assert.equal(
  researchCreditPackForStripeObject({
    metadata: { researchCreditPackID: "research-turns-25", researchCredits: "25" }
  }, environment)?.turns,
  25
);
assert.equal(
  researchCreditPackForStripeObject({
    metadata: { researchCreditPackID: "research-turns-25", researchCredits: "100" }
  }, environment),
  null
);
assert.equal(researchCreditBalance([{ units: 25 }, { units: -5 }, { units: "bad" }]), 20);
assert.equal(researchCreditRefundTarget({
  units: 25,
  amountTotal: 1000,
  amountRefunded: 1
}), 1);
assert.equal(researchCreditRefundTarget({
  units: 25,
  amountTotal: 1000,
  amountRefunded: 500
}), 13);
assert.equal(researchCreditRefundTarget({
  units: 25,
  amountTotal: 1000,
  amountRefunded: 1000
}), 25);
assert.equal(researchCreditRefundTarget({
  units: 25,
  amountTotal: 0,
  amountRefunded: 0
}), null);

const creditedClaim = {
  id: "stripe:cs_contract",
  provider: "stripe",
  units: 25,
  creditedUserID: "user_contract",
  status: "credited",
  revokedUnits: 0,
  refundedAmount: 0,
  lastReversalEventID: null,
  lastReversalSignedDate: 0,
  metadata: { packID: "research-turns-25" }
};
const partialRefund = researchCreditClaimReconciliation({
  claim: creditedClaim,
  targetRevokedUnits: 13,
  eventID: "evt_partial",
  signedDate: 100,
  refundedAmount: 500,
  reason: "stripe_partial_refund"
});
assert.equal(partialRefund.applied, true);
assert.equal(partialRefund.creditUnits, -13);
assert.equal(partialRefund.nextClaim.status, "partially_refunded");
const duplicatePartialRefund = researchCreditClaimReconciliation({
  claim: partialRefund.nextClaim,
  targetRevokedUnits: 13,
  eventID: "evt_partial",
  signedDate: 101,
  refundedAmount: 500,
  reason: "stripe_partial_refund"
});
assert.equal(duplicatePartialRefund.applied, false);
assert.equal(duplicatePartialRefund.reason, "duplicate");
assert.equal(duplicatePartialRefund.creditUnits, 0);
const completedRefund = researchCreditClaimReconciliation({
  claim: partialRefund.nextClaim,
  targetRevokedUnits: 25,
  eventID: "evt_full",
  signedDate: 200,
  refundedAmount: 1000,
  reason: "stripe_full_refund"
});
assert.equal(completedRefund.creditUnits, -12);
assert.equal(completedRefund.nextClaim.status, "refunded");
const staleRefundReversal = researchCreditClaimReconciliation({
  claim: completedRefund.nextClaim,
  targetRevokedUnits: 0,
  eventID: "older-refund-reversed",
  signedDate: 150,
  reason: "apple_refund_reversed"
});
assert.equal(staleRefundReversal.applied, false);
assert.equal(staleRefundReversal.reason, "stale");
const refundReversed = researchCreditClaimReconciliation({
  claim: completedRefund.nextClaim,
  targetRevokedUnits: 0,
  eventID: "refund-reversed",
  signedDate: 300,
  refundedAmount: 0,
  reason: "apple_refund_reversed"
});
assert.equal(refundReversed.creditUnits, 25);
assert.equal(refundReversed.nextClaim.status, "credited");

const periodStart = "2026-08-01T00:00:00.000Z";
const periodEnd = "2026-09-01T00:00:00.000Z";
const includedUsage = Array.from({ length: 100 }, (_, index) => ({
  id: `included-${index}`,
  fundingSource: "included",
  mode: "responses",
  createdAt: "2026-08-10T00:00:00.000Z"
}));
const state = researchTurnState({
  usageEntries: [
    ...includedUsage,
    { id: "purchased-2", fundingSource: "purchased", mode: "reservation", createdAt: new Date().toISOString() }
  ],
  creditEntries: [{ id: "grant", units: 25 }, { id: "debit", units: -1 }],
  periodStart,
  periodEnd,
  includedLimit: 100,
  paidContinuationEnabled: true
});
assert.deepEqual(state, {
  includedTurnsUsed: 100,
  includedTurnLimit: 100,
  includedTurnsRemaining: 0,
  purchasedTurnsGranted: 25,
  purchasedTurnsUsed: 1,
  purchasedTurnsRemaining: 23,
  turnsRemaining: 23,
  canResearch: true,
  purchaseRequired: false,
  paidContinuationEnabled: true,
  resetDate: periodEnd
});
assert.equal(researchTurnFundingDecision({
  usageEntries: includedUsage,
  creditEntries: [{ units: 1 }],
  periodStart,
  periodEnd,
  includedLimit: 100,
  paidContinuationEnabled: true
}).fundingSource, "purchased");
assert.equal(researchTurnFundingDecision({
  usageEntries: includedUsage,
  creditEntries: [],
  periodStart,
  periodEnd,
  includedLimit: 100,
  paidContinuationEnabled: true
}).allowed, false);
assert.equal(researchTurnFundingDecision({
  usageEntries: includedUsage,
  creditEntries: [],
  periodStart,
  periodEnd,
  includedLimit: 100,
  paidContinuationEnabled: false
}).fundingSource, "unmetered");

console.log("research-turns contract passed");
