import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");

assert.match(
  appSource,
  /provider_payment_id TEXT[\s\S]*revoked_units INTEGER NOT NULL DEFAULT 0[\s\S]*last_reversal_event_id TEXT/,
  "The durable Research purchase claim does not retain payment and reversal state."
);
assert.match(
  appSource,
  /async reconcileResearchCreditPurchase\(claimID, reconciliation\)/,
  "Research purchase reconciliation is missing from a storage adapter."
);
assert.match(
  appSource,
  /case "charge\.refunded": \{\s*changed = await reconcileStripeResearchCreditRefund\(object, event\);/,
  "Stripe charge refunds do not reconcile purchased Research credits."
);
assert.match(
  appSource,
  /researchCreditPackForAppleProductID\(transaction\.productId, process\.env\)[\s\S]*REFUND_REVERSED[\s\S]*reconcileResearchCreditPurchase\(claim\.id/,
  "Apple consumable refunds and refund reversals do not reconcile Research credits."
);
assert.match(
  appSource,
  /!applePackageIDForProductID\(payload\.productId\)[\s\S]*!researchCreditPackForAppleProductID\(payload\.productId, process\.env\)/,
  "Apple signed-transaction verification still rejects configured Research consumables."
);
assert.match(
  appSource,
  /!result\.created && result\.ownerUserID !== userID\) \{\s*sendJSON\(response, 409, \{[\s\S]*code: "RESEARCH_PURCHASE_ALREADY_LINKED"/,
  "Apple consumable cross-account conflicts do not expose the safe terminal error code."
);

console.log("research-credit-ledger contract passed");
