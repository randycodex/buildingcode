import {
  activeCommercialPackage,
  accountDeletionBillingPlan,
  applyAppleNotificationToStore,
  applyStripeSubscriptionEventToStore,
  appleNotificationLifecycleAction,
  appleNotificationSupersedesTransactionVerification,
  applePackageIDForProductID,
  cancelStripeSubscriptionAfterFullRefund,
  cancelStripeSubscriptionsForAccount,
  claimAppleTransactionOwner,
  entitlementAfterPackageRemoval,
  sameOriginAbsoluteURL,
  stripeConfigurationStatus,
  stripeEventIsCurrent,
  stripePackageIDFromObject,
  stripeSecretKeyMode,
  stripeSubscriptionExpiresAt,
  validateAppleTransactionEnvironment,
  validateStripeRestoreOwnership,
  verifyAppleTransactionJWS
} from "../app.mjs";
import {
  appleBillingAccountTokens,
  mergedAppleBillingAccountTokens
} from "../postgres-account-repository.mjs";
import {
  stripeCheckoutTaxParameters,
  stripeTaxConfiguration
} from "../stripe-tax.mjs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function encodedJWTPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function expectClientError(callback, statusCode, messageFragment) {
  try {
    callback();
  } catch (error) {
    assert(error.statusCode === statusCode, `Expected status ${statusCode}, received ${error.statusCode}.`);
    assert(
      String(error.message || "").includes(messageFragment),
      `Expected error message to include "${messageFragment}", received "${error.message}".`
    );
    return;
  }
  throw new Error(`Expected status ${statusCode}, but validation succeeded.`);
}

const sourceAppleBillingToken = "11111111-1111-4111-8111-111111111111";
const targetAppleBillingToken = "22222222-2222-4222-8222-222222222222";
const sourceOnlyBillingMerge = mergedAppleBillingAccountTokens(
  { appleBillingAccountToken: sourceAppleBillingToken },
  {}
);
assert(
  sourceOnlyBillingMerge.appleBillingAccountToken === sourceAppleBillingToken,
  "Account merge dropped the source Apple billing token when the target had no token."
);
const distinctBillingMerge = mergedAppleBillingAccountTokens(
  {
    appleBillingAccountToken: sourceAppleBillingToken,
    appleBillingAccountTokenAliases: ["33333333-3333-4333-8333-333333333333"]
  },
  { appleBillingAccountToken: targetAppleBillingToken }
);
assert(
  distinctBillingMerge.appleBillingAccountToken === targetAppleBillingToken,
  "Account merge did not preserve the target Apple billing token as primary."
);
const acceptedMergedBillingTokens = appleBillingAccountTokens(distinctBillingMerge);
assert(
  acceptedMergedBillingTokens.has(sourceAppleBillingToken) &&
    acceptedMergedBillingTokens.has(targetAppleBillingToken) &&
    acceptedMergedBillingTokens.has("33333333-3333-4333-8333-333333333333"),
  "Account merge did not preserve historical Apple billing tokens as accepted aliases."
);
const [billingAppSource, postgresAccountSource] = await Promise.all([
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../postgres-account-repository.mjs", import.meta.url), "utf8")
]);
const postgresAppleNotificationSource = postgresAccountSource.match(
  /async function applyAppleNotification\([\s\S]*?async function applyStripeSubscriptionEvent\(/
)?.[0] || "";
assert(
  /acceptedAccountTokens = appleBillingAccountTokens\(accountContext\.account\)/.test(billingAppSource) &&
    /acceptedAccountTokens\.has\(transactionAccountToken\)/.test(billingAppSource),
  "Apple consumable verification does not accept merged billing-token aliases."
);
assert(
  /const mergedAppleBillingTokens = mergedAppleBillingAccountTokens\([\s\S]*sourceContext\.account,[\s\S]*targetContext\.account/.test(postgresAccountSource) &&
    /'appleBillingAccountTokenAliases'/.test(postgresAccountSource),
  "PostgreSQL account merge does not persist Apple billing-token aliases."
);
assert(
  /\$\{transactionSignedDate\}::bigint <= 0[\s\S]*signed_date >= \$\{transactionSignedDate\}::bigint/.test(postgresAccountSource),
  "Apple transaction verification does not explicitly bind millisecond signed dates as BIGINT."
);
assert(
  /WITH applied AS \([\s\S]*INSERT INTO permitext_apple_notification_states[\s\S]*INSERT INTO permitext_entitlements[\s\S]*FROM applied[\s\S]*EXISTS \(SELECT 1 FROM applied\)/.test(postgresAppleNotificationSource),
  "PostgreSQL Apple notification side effects are not gated by the newly applied ordering cursor."
);

const appleSubscriptionTransaction = {
  productId: "com.randycodex.permitext.pro.monthly",
  expiresDate: Date.now() + 60_000
};
assert(
  appleNotificationLifecycleAction({
    notificationType: "DID_RENEW",
    transaction: appleSubscriptionTransaction
  }).action === "grant",
  "An Apple renewal did not extend the Permitext entitlement."
);
const notificationStore = {
  entitlements: { "clerk:user_contract": { plan: "pro", marker: "current" } },
  appleNotificationStates: {}
};
assert(
  appleNotificationSupersedesTransactionVerification(
    { signedDate: 200, notificationType: "REFUND" },
    100
  ),
  "A newer Apple refund snapshot did not supersede a stale transaction verification."
);
assert(
  !appleNotificationSupersedesTransactionVerification(
    { signedDate: 100, notificationType: "REFUND" },
    200
  ),
  "An older Apple notification superseded a newer transaction verification."
);
assert(
  applyAppleNotificationToStore(notificationStore, {
    userID: "clerk:user_contract",
    originalTransactionID: "original-contract",
    signedDate: 200,
    notificationUUID: "newer",
    notificationType: "DID_RENEW",
    nextEntitlement: { plan: "pro", marker: "newer" }
  }).applied,
  "The first Apple lifecycle notification was not applied."
);
assert(
  !applyAppleNotificationToStore(notificationStore, {
    userID: "clerk:user_contract",
    originalTransactionID: "original-contract",
    signedDate: 100,
    notificationUUID: "older",
    notificationType: "EXPIRED",
    nextEntitlement: null
  }).applied && notificationStore.entitlements["clerk:user_contract"].marker === "newer",
  "A delayed older Apple notification corrupted the current entitlement."
);
const stripeLifecycleStore = {
  entitlements: {},
  stripeSubscriptionEventStates: {}
};
const stripeLifecycleInput = {
  userID: "apple:stripe-contract-owner",
  subscriptionID: "sub_stripe_contract",
  packageID: "pro",
  eventCreatedAt: "2026-08-28T12:00:00.000Z"
};
assert(
  applyStripeSubscriptionEventToStore(stripeLifecycleStore, {
    ...stripeLifecycleInput,
    eventID: "evt_active",
    eventType: "customer.subscription.updated",
    nextEntitlement: {
      plan: "pro",
      source: "webSubscription",
      provider: { stripeSubscriptionID: "sub_stripe_contract" }
    }
  }).applied,
  "The first Stripe lifecycle event was not applied."
);
assert(
  applyStripeSubscriptionEventToStore(stripeLifecycleStore, {
    ...stripeLifecycleInput,
    eventID: "evt_terminal",
    eventType: "charge.refunded",
    terminal: true,
    nextEntitlement: null
  }).applied && !stripeLifecycleStore.entitlements[stripeLifecycleInput.userID],
  "A terminal Stripe event did not win a same-second event tie."
);
assert(
  !applyStripeSubscriptionEventToStore(stripeLifecycleStore, {
    ...stripeLifecycleInput,
    eventID: "evt_delayed_active",
    eventType: "customer.subscription.updated",
    nextEntitlement: { plan: "pro" }
  }).applied && !stripeLifecycleStore.entitlements[stripeLifecycleInput.userID],
  "A same-second Stripe event restored access after a terminal event."
);
assert(
  !applyStripeSubscriptionEventToStore(stripeLifecycleStore, {
    ...stripeLifecycleInput,
    userID: "apple:different-owner",
    eventCreatedAt: "2026-08-28T12:01:00.000Z",
    eventID: "evt_different_owner",
    eventType: "customer.subscription.updated",
    nextEntitlement: { plan: "pro" }
  }).applied,
  "A Stripe subscription lifecycle cursor transferred to a different account."
);
assert(
  appleNotificationLifecycleAction({
    notificationType: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
    transaction: { ...appleSubscriptionTransaction, expiresDate: Date.now() - 60_000 },
    renewalInfo: { gracePeriodExpiresDate: Date.now() + 120_000 }
  }).reason === "billing-grace-period",
  "Apple billing grace did not preserve access through the grace-period expiration."
);
assert(
  appleNotificationLifecycleAction({
    notificationType: "DID_FAIL_TO_RENEW",
    transaction: appleSubscriptionTransaction
  }).action === "revoke",
  "Apple billing retry without grace preserved access from a stale future expiration."
);
assert(
  appleNotificationLifecycleAction({
    notificationType: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
    transaction: appleSubscriptionTransaction,
    renewalInfo: { gracePeriodExpiresDate: Date.now() - 120_000 }
  }).reason === "billing-grace-period-ended",
  "Apple billing retry preserved access after the grace period ended."
);
for (const notificationType of ["REFUND", "REVOKE", "EXPIRED", "GRACE_PERIOD_EXPIRED"]) {
  assert(
    appleNotificationLifecycleAction({
      notificationType,
      transaction: appleSubscriptionTransaction
    }).action === "revoke",
    `Apple ${notificationType} did not revoke the affected entitlement.`
  );
}
assert(
  appleNotificationLifecycleAction({
    notificationType: "DID_CHANGE_RENEWAL_STATUS",
    transaction: appleSubscriptionTransaction
  }).action === "ignore",
  "Turning off Apple auto-renew incorrectly removed prepaid access."
);

assert(
  sameOriginAbsoluteURL(
    "https://permitext.example",
    "/?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  ) === "https://permitext.example/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
  "Checkout did not accept a same-origin return path."
);
assert(
  sameOriginAbsoluteURL("https://permitext.example", "https://evil.example/steal") === null,
  "Checkout accepted a cross-origin return URL."
);
assert(
  sameOriginAbsoluteURL("https://permitext.example", undefined, "/?checkout=cancel") ===
    "https://permitext.example/?checkout=cancel",
  "Checkout did not construct its safe default return URL."
);

const stripeSubscription = {
  id: "sub_owned",
  status: "active",
  metadata: { accountUserID: "apple:owner" }
};
assert(
  validateStripeRestoreOwnership({
    subscription: stripeSubscription,
    requestedUserID: "apple:owner"
  }) === "apple:owner",
  "The Stripe subscription owner could not restore their purchase."
);
assert(
  validateStripeRestoreOwnership({
    subscription: { id: "sub_checkout_owned", status: "active", metadata: {} },
    checkoutSession: {
      id: "cs_checkout_owned",
      client_reference_id: "apple:owner",
      metadata: { accountUserID: "apple:owner" }
    },
    requestedUserID: "apple:owner"
  }) === "apple:owner",
  "Matching Checkout ownership could not restore a subscription with missing subscription metadata."
);
assert(
  validateStripeRestoreOwnership({
    subscription: { id: "sub_persisted_owner", status: "active", metadata: {} },
    persistedOwnerUserID: "apple:owner",
    requestedUserID: "apple:owner"
  }) === "apple:owner",
  "A persisted Permitext entitlement could not prove legacy Stripe ownership."
);
expectClientError(
  () => validateStripeRestoreOwnership({
    subscription: stripeSubscription,
    requestedUserID: "apple:different-user"
  }),
  403,
  "different Permitext account"
);
expectClientError(
  () => validateStripeRestoreOwnership({
    subscription: {
      id: "sub_billing_email_only",
      status: "active",
      metadata: {},
      customer_details: { email: "owner@example.com" }
    },
    requestedUserID: "apple:owner"
  }),
  409,
  "not linked to a Permitext account"
);
expectClientError(
  () => validateStripeRestoreOwnership({
    subscription: stripeSubscription,
    persistedOwnerUserID: "apple:different-user",
    requestedUserID: "apple:owner"
  }),
  409,
  "ownership records conflict"
);

assert(stripeSecretKeyMode("") === "missing", "Empty Stripe keys were not classified as missing.");
assert(stripeSecretKeyMode("sk_test_contract") === "test", "Stripe test key was not detected.");
assert(stripeSecretKeyMode("sk_live_contract") === "live", "Stripe live key was not detected.");
assert(stripeSecretKeyMode("rk_live_contract") === "live", "Stripe restricted live key was not detected.");
assert(stripeSecretKeyMode("unexpected_contract") === "unknown", "Unexpected Stripe key format was accepted.");
const automaticTaxEnvironment = {
  PERMITEXT_STRIPE_TAX_MODE: "automatic",
  PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR: "exclusive"
};
assert(
  stripeTaxConfiguration(automaticTaxEnvironment).ready,
  "An explicit automatic Stripe Tax configuration was rejected."
);
assert(
  !stripeTaxConfiguration({}).ready,
  "Missing Stripe Tax decisions were treated as configured."
);
assert(
  !stripeTaxConfiguration({
    ...automaticTaxEnvironment,
    PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR: "unspecified"
  }).ready,
  "An unspecified Stripe Price tax behavior was accepted."
);
assert(
  stripeCheckoutTaxParameters(automaticTaxEnvironment)?.automatic_tax?.enabled === true &&
    stripeCheckoutTaxParameters(automaticTaxEnvironment)?.billing_address_collection === "required",
  "Automatic tax did not require Stripe Checkout tax calculation and a billing address."
);
assert(
  stripeCheckoutTaxParameters({}) === null,
  "Unconfigured Stripe Tax produced Checkout parameters."
);
assert(
  stripeEventIsCurrent(
    { stripeEventCreatedAt: "2026-08-21T12:00:00.000Z" },
    { created: Date.parse("2026-08-21T12:01:00.000Z") / 1000 }
  ),
  "A newer Stripe lifecycle event was rejected."
);
assert(
  !stripeEventIsCurrent(
    { stripeEventCreatedAt: "2026-08-21T12:01:00.000Z" },
    { created: Date.parse("2026-08-21T12:00:00.000Z") / 1000 }
  ),
  "A delayed older Stripe event was allowed to overwrite newer entitlement state."
);

assert(
  stripeConfigurationStatus({
    secretKey: "sk_test_contract",
    priceID: "price_contract",
    requireLive: false
  }).ready,
  "Local/test checkout did not accept an explicit Stripe test configuration."
);

const productionTestStripe = stripeConfigurationStatus({
  secretKey: "sk_test_contract",
  priceID: "price_contract",
  requireLive: true
});
assert(!productionTestStripe.ready, "Production checkout accepted Stripe test credentials.");
assert(
  productionTestStripe.message.includes("still in test mode"),
  "Production test-mode failure did not explain how to correct the configuration."
);

assert(
  stripeConfigurationStatus({
    secretKey: "sk_live_contract",
    priceID: "price_contract",
    requireLive: true
  }).ready,
  "Production checkout rejected a live Stripe configuration."
);
assert(
  stripeConfigurationStatus({
    packageID: "research",
    secretKey: "sk_test_contract",
    priceID: "price_research_contract",
    requireLive: false
  }).ready,
  "Research checkout did not accept its independently configured Stripe price."
);
assert(
  !stripeConfigurationStatus({
    packageID: "research",
    secretKey: "sk_test_contract",
    priceID: "",
    requireLive: false
  }).ready,
  "Research checkout was enabled without a Research price."
);
assert(
  stripePackageIDFromObject({ metadata: { permitextPackage: "research" } }) === "research",
  "Stripe Research metadata did not select the Research package."
);
assert(
  stripePackageIDFromObject({ metadata: {} }) === "pro",
  "Legacy Stripe subscriptions must remain Pro."
);
assert(
  stripePackageIDFromObject({ metadata: { permitextPackage: "unknown" } }) === null,
  "Unknown Stripe package metadata was accepted."
);
assert(
  stripeSubscriptionExpiresAt({
    items: { data: [{ current_period_end: 1_787_768_214 }] }
  }) === "2026-08-26T18:16:54.000Z",
  "Stripe's item-level subscription period did not produce the entitlement expiration."
);
assert(
  stripeSubscriptionExpiresAt({}) === null,
  "A missing Stripe subscription period incorrectly produced an epoch expiration."
);

const lifetimeDeletionPlan = accountDeletionBillingPlan({
  plan: "pro",
  source: "lifetimeGrant",
  provider: {}
});
assert(
  lifetimeDeletionPlan.lifetimeGrantPresent &&
    lifetimeDeletionPlan.stripeSubscriptions.length === 0 &&
    !lifetimeDeletionPlan.appleSubscriptionPresent,
  "Lifetime account deletion incorrectly scheduled external billing cancellation."
);

const mixedDeletionPlan = accountDeletionBillingPlan({
  plan: "pro",
  source: "webSubscription",
  provider: { stripeSubscriptionID: "sub_delete_pro" },
  addOns: {
    research: {
      source: "appleSubscription",
      provider: { appleOriginalTransactionID: "apple-delete-research" }
    }
  }
});
assert(
  mixedDeletionPlan.stripeSubscriptions.length === 1 &&
    mixedDeletionPlan.stripeSubscriptions[0].subscriptionID === "sub_delete_pro" &&
    mixedDeletionPlan.appleSubscriptionPresent,
  "Mixed Stripe and Apple billing was not detected for account deletion."
);
assert(
  activeCommercialPackage({ plan: "pro", source: "webSubscription", provider: {} }, "pro")?.source === "webSubscription",
  "An active Stripe Pro package was not detected before a duplicate purchase."
);
assert(
  activeCommercialPackage({
    plan: "pro",
    source: "appleSubscription",
    provider: {},
    addOns: { research: { source: "appleSubscription", provider: {} } }
  }, "research")?.source === "appleSubscription",
  "An active Apple Research package was not detected before a duplicate purchase."
);
assert(
  activeCommercialPackage({ plan: "free" }, "pro") === null,
  "A free account was incorrectly treated as already subscribed."
);

const stripeDeletionRequests = [];
const stripeDeletionResult = await cancelStripeSubscriptionsForAccount({
  userID: "apple:delete-owner",
  entitlement: {
    plan: "pro",
    source: "webSubscription",
    provider: { stripeSubscriptionID: "sub_delete_owned" }
  },
  requestStripe: async (path, options = {}) => {
    stripeDeletionRequests.push({ path, method: options.method || "GET", body: options.body || null });
    if (options.method === "DELETE") {
      return { id: "sub_delete_owned", status: "canceled" };
    }
    return {
      id: "sub_delete_owned",
      status: "active",
      metadata: { accountUserID: "apple:delete-owner" }
    };
  }
});
assert(
  stripeDeletionResult.canceledSubscriptions.length === 1 &&
    stripeDeletionRequests.length === 2 &&
    stripeDeletionRequests[0].method === "GET" &&
    stripeDeletionRequests[1].method === "DELETE",
  "Account deletion did not verify and immediately cancel its Stripe subscription."
);

const conflictingStripeDeletionRequests = [];
try {
  await cancelStripeSubscriptionsForAccount({
    userID: "apple:delete-owner",
    entitlement: {
      plan: "pro",
      source: "webSubscription",
      provider: { stripeSubscriptionID: "sub_delete_conflict" }
    },
    requestStripe: async (path, options = {}) => {
      conflictingStripeDeletionRequests.push({ path, method: options.method || "GET" });
      return {
        id: "sub_delete_conflict",
        status: "active",
        metadata: { accountUserID: "apple:different-owner" }
      };
    }
  });
  throw new Error("Conflicting Stripe ownership was accepted during account deletion.");
} catch (error) {
  assert(
    String(error.message || "").includes("ownership records conflict") &&
      conflictingStripeDeletionRequests.length === 1,
    "Stripe ownership conflict did not stop account deletion before cancellation."
  );
}

const refundCancellationRequests = [];
const refundCancellation = await cancelStripeSubscriptionAfterFullRefund({
  subscriptionID: "sub_refunded_owned",
  ownerUserID: "apple:refund-owner",
  requestStripe: async (path, options = {}) => {
    refundCancellationRequests.push({ path, method: options.method || "GET", body: options.body || null });
    if (options.method === "DELETE") {
      return { id: "sub_refunded_owned", status: "canceled" };
    }
    return {
      id: "sub_refunded_owned",
      status: "active",
      metadata: { accountUserID: "apple:refund-owner" }
    };
  }
});
assert(
  refundCancellation.status === "canceled" &&
    refundCancellationRequests.length === 2 &&
    refundCancellationRequests[0].method === "GET" &&
    refundCancellationRequests[1].method === "DELETE" &&
    String(refundCancellationRequests[1].body || "").includes(encodeURIComponent("fully refunded")),
  "A verified full Stripe refund did not cancel the owned subscription."
);

assert(
  applePackageIDForProductID("com.randycodex.permitext.pro.monthly") === "pro",
  "The Pro StoreKit product did not map to Pro."
);
assert(
  applePackageIDForProductID("com.randycodex.permitext.research.monthly") === "research",
  "The Research StoreKit product did not map to the Research Add-On."
);

const packagedAppleEntitlement = {
  userID: "apple:billing-owner",
  plan: "pro",
  source: "appleSubscription",
  provider: { appleOriginalTransactionID: "pro-original" },
  addOns: {
    research: {
      source: "appleSubscription",
      provider: { appleOriginalTransactionID: "research-original" }
    }
  }
};
const remainingApplePro = entitlementAfterPackageRemoval(
  packagedAppleEntitlement,
  "research",
  {
    source: "appleSubscription",
    providerKey: "appleOriginalTransactionID",
    providerValue: "research-original"
  },
  true
);
assert(
  remainingApplePro?.plan === "pro" && !remainingApplePro.addOns?.research,
  "Expiring the Apple Research add-on incorrectly reports that Pro was removed."
);

const xcodeTransaction = [
  encodedJWTPart({ alg: "ES256", x5c: ["local-test-certificate"] }),
  encodedJWTPart({
    environment: "Xcode",
    bundleId: "com.randycodex.permitext",
    productId: "com.randycodex.permitext.pro.monthly"
  }),
  "AA"
].join(".");

expectClientError(
  () => verifyAppleTransactionJWS(xcodeTransaction),
  422,
  "certificate chain is missing"
);
expectClientError(
  () => verifyAppleTransactionJWS("not-a-transaction"),
  422,
  "Invalid Apple transaction"
);

assert(
  validateAppleTransactionEnvironment({ environment: "Production" }, { requireProduction: true }) === "production",
  "Production Apple transactions were rejected by production policy."
);
assert(
  validateAppleTransactionEnvironment({ environment: "Sandbox" }, { requireProduction: false }) === "sandbox",
  "Apple Sandbox transactions were rejected by non-production policy."
);
expectClientError(
  () => validateAppleTransactionEnvironment({ environment: "Sandbox" }, { requireProduction: true }),
  422,
  "cannot grant production Pro"
);
expectClientError(
  () => validateAppleTransactionEnvironment({ environment: "Xcode" }, { requireProduction: false }),
  409,
  "device-only"
);

const ownershipStore = {};
assert(
  claimAppleTransactionOwner(ownershipStore, "original-transaction-1", "user-a"),
  "The first Apple transaction owner could not claim the purchase."
);
assert(
  claimAppleTransactionOwner(ownershipStore, "original-transaction-1", "user-a"),
  "The original owner could not restore the Apple purchase."
);
assert(
  !claimAppleTransactionOwner(ownershipStore, "original-transaction-1", "user-b"),
  "A second account replayed an Apple purchase that already has an owner."
);
assert(
  ownershipStore.appleTransactionOwners["original-transaction-1"] === "user-a",
  "A failed Apple transaction replay changed the purchase owner."
);

console.log("Billing entitlement contract passed.");
