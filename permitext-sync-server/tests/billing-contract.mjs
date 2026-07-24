import {
  claimAppleTransactionOwner,
  stripeConfigurationStatus,
  stripeSecretKeyMode,
  validateAppleTransactionEnvironment,
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
