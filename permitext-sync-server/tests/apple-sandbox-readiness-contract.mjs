import assert from "node:assert/strict";
import {
  appleSandboxConfigurationReadiness,
  expectedAppleSandboxBundleID,
  expectedAppleSandboxProProductID,
  expectedAppleRootFingerprints
} from "../apple-sandbox-readiness.mjs";

const completeEnvironment = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  NODE_ENV: "test",
  PERMITEXT_APPLE_SANDBOX_EXERCISE: "1",
  PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS: "0",
  PERMITEXT_PUBLIC_BASE_URL: "https://permitext-apple-sandbox.example.test",
  PERMITEXT_SYNC_DATABASE_URL: "postgresql://contract.invalid/permitext_apple_sandbox",
  PERMITEXT_APPLE_SANDBOX_ISOLATED_DATABASE: "1",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_contract",
  PERMITEXT_APPLE_SANDBOX_ISOLATED_BLOB: "1",
  APPLE_BUNDLE_ID: expectedAppleSandboxBundleID,
  STOREKIT_PRO_PRODUCT_ID: expectedAppleSandboxProProductID,
  PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN: "1",
  APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: expectedAppleRootFingerprints.join(","),
  CLERK_PUBLISHABLE_KEY: "pk_test_contract",
  CLERK_SECRET_KEY: "sk_test_contract",
  CLERK_AUTHORIZED_PARTIES: "https://permitext-apple-sandbox.example.test",
  PERMITEXT_TERMS_VERSION: "terms-2026-08-28",
  PERMITEXT_PRIVACY_VERSION: "privacy-2026-08-28",
  PERMITEXT_SUBSCRIPTION_POLICY_VERSION: "subscriptions-2026-08-28",
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0",
  PERMITEXT_RESEARCH_KILL_SWITCH: "1",
  STRIPE_SECRET_KEY: "sk_test_contract"
};

const complete = appleSandboxConfigurationReadiness(completeEnvironment);
assert.equal(complete.ready, true);
assert.equal(
  complete.endpoints.appleNotifications,
  "https://permitext-apple-sandbox.example.test/billing/apple/notifications"
);

for (const [name, environment] of [
  ["Production runtime", { ...completeEnvironment, VERCEL_ENV: "production" }],
  ["Production Apple enforcement", { ...completeEnvironment, PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS: "1" }],
  ["Production hostname", { ...completeEnvironment, PERMITEXT_PUBLIC_BASE_URL: "https://permitext.com" }],
  ["Shared database", { ...completeEnvironment, PERMITEXT_APPLE_SANDBOX_ISOLATED_DATABASE: "0" }],
  ["Shared Blob", { ...completeEnvironment, PERMITEXT_APPLE_SANDBOX_ISOLATED_BLOB: "0" }],
  ["Missing root pin enforcement", { ...completeEnvironment, PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN: "0" }],
  ["Malformed root pin", { ...completeEnvironment, APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: "AABBCC" }],
  ["Incomplete Apple root set", { ...completeEnvironment, APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: expectedAppleRootFingerprints[2] }],
  ["Unknown root pin", { ...completeEnvironment, APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: [...expectedAppleRootFingerprints.slice(0, 2), "AA".repeat(32)].join(",") }],
  ["Missing policy versions", { ...completeEnvironment, PERMITEXT_TERMS_VERSION: "" }],
  ["Paid Research enabled", { ...completeEnvironment, PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "1" }],
  ["Research provider enabled", { ...completeEnvironment, PERMITEXT_RESEARCH_KILL_SWITCH: "0" }],
  ["Live Stripe secret", { ...completeEnvironment, STRIPE_SECRET_KEY: "sk_live_contract" }]
]) {
  assert.equal(appleSandboxConfigurationReadiness(environment).ready, false, `${name} was accepted.`);
}

console.log("Permitext Apple Sandbox staging-readiness contract passed; provider calls: none.");
