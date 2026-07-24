import { readFile } from "node:fs/promises";
import {
  stripeConfigurationStatus,
  stripeSecretKeyMode,
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
  409,
  "valid only on this device"
);
expectClientError(
  () => verifyAppleTransactionJWS("not-a-transaction"),
  422,
  "Invalid Apple transaction"
);

const iosViewModelSource = await readFile(
  new URL("../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", import.meta.url),
  "utf8"
);
const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const webSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

assert(
  serverSource.includes('persistServerEntitlement(userID, "appleSubscription"') &&
    serverSource.includes('persistServerEntitlement(userID, "webSubscription"'),
  "Apple and Stripe do not converge on the shared backend entitlement store."
);
assert(
  webSource.includes("state.account?.entitlement || syncedContent?.entitlement || null"),
  "Web Pro access does not consume the shared synced entitlement."
);
assert(
  iosViewModelSource.includes("applyBackendEntitlementIfPresent(report.entitlement)"),
  "iOS Pro access does not consume Stripe or Apple entitlement returned by backend sync."
);
assert(
  iosViewModelSource.includes('statusMessage = "Pro is active on this device. Sign in with Apple to use Pro on the web."'),
  "iOS does not explain that a signed-in account is required for web entitlement."
);
assert(
  iosViewModelSource.includes("if handleBackendSessionFailureIfNeeded(error)"),
  "Apple billing sync does not recover from an expired backend session."
);

console.log("Billing entitlement contract passed.");
