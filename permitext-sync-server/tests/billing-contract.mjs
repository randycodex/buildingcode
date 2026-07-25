import {
  applePackageIDForProductID,
  claimAppleTransactionOwner,
  sameOriginAbsoluteURL,
  stripeConfigurationStatus,
  stripePackageIDFromObject,
  stripeSecretKeyMode,
  validateAppleTransactionEnvironment,
  validateStripeRestoreOwnership,
  verifyAppleTransactionJWS
} from "../app.mjs";

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
  applePackageIDForProductID("com.randycodex.permitext.pro.monthly") === "pro",
  "The Pro StoreKit product did not map to Pro."
);
assert(
  applePackageIDForProductID("com.randycodex.permitext.research.monthly") === "research",
  "The Research StoreKit product did not map to the Research Add-On."
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
