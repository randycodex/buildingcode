import { clerkConfigurationStatus } from "./clerk-auth.mjs";
import { policyVersionConfiguration } from "./policy-acceptance.mjs";
import { paidResearchTurnsEnabled } from "./research-turns.mjs";

export const expectedAppleSandboxBundleID = "com.randycodex.permitext";
export const expectedAppleSandboxProProductID = "com.randycodex.permitext.pro.monthly";
export const expectedAppleRootFingerprints = Object.freeze([
  "B0B1730ECBC7FF4505142C49F1295E6EDA6BCAED7E2C68C5BE91B5A11001F024",
  "C2B9B042DD57830E7D117DAC55AC8AE19407D38E41D88F3215BC3A890444A050",
  "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179"
]);

const productionHosts = new Set([
  "permitext.com",
  "www.permitext.com",
  "permitext-sync.vercel.app"
]);

function check(id, ready, detail) {
  return { id, ready: Boolean(ready), detail };
}

function durableDatabaseConfigured(environment) {
  return Boolean(
    environment.PERMITEXT_SYNC_DATABASE_URL ||
    environment.DATABASE_URL ||
    environment.STORAGE_URL ||
    environment.POSTGRES_URL ||
    environment.NEON_DATABASE_URL
  );
}

function privateBlobStorageConfigured(environment) {
  return Boolean(
    environment.BLOB_READ_WRITE_TOKEN ||
    (environment.VERCEL_OIDC_TOKEN && environment.BLOB_STORE_ID)
  );
}

function isLiveStripeKey(value) {
  return /^(?:sk|rk)_live_/.test(String(value || "").trim());
}

function configuredAppleRootFingerprints(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.replace(/[^a-fA-F0-9]/g, "").toUpperCase())
    .filter(Boolean);
}

function expectedAppleRootsConfigured(value) {
  const configured = new Set(configuredAppleRootFingerprints(value));
  return configured.size === expectedAppleRootFingerprints.length &&
    expectedAppleRootFingerprints.every((fingerprint) => configured.has(fingerprint));
}

function parsedPublicURL(environment) {
  try {
    return new URL(String(environment.PERMITEXT_PUBLIC_BASE_URL || "").trim());
  } catch {
    return null;
  }
}

function nonProductionRuntime(environment) {
  if (String(environment.VERCEL || "").trim() || String(environment.VERCEL_ENV || "").trim()) {
    return environment.VERCEL_ENV !== "production";
  }
  return environment.NODE_ENV !== "production";
}

export function appleSandboxConfigurationReadiness(environment = process.env) {
  const publicURL = parsedPublicURL(environment);
  const clerk = clerkConfigurationStatus(environment);
  const policies = policyVersionConfiguration(environment);
  const paidTurnsEnabled = paidResearchTurnsEnabled(environment);
  const checks = [
    check(
      "explicit-sandbox-exercise",
      environment.PERMITEXT_APPLE_SANDBOX_EXERCISE === "1",
      "Set PERMITEXT_APPLE_SANDBOX_EXERCISE=1 only on the dedicated Apple billing-test deployment."
    ),
    check(
      "non-production-environment",
      nonProductionRuntime(environment),
      "Apple Sandbox transactions must never target a Production runtime."
    ),
    check(
      "sandbox-transactions-allowed",
      environment.PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS !== "1",
      "The dedicated staging backend must accept App Store Sandbox transactions."
    ),
    check(
      "staging-public-url",
      publicURL?.protocol === "https:" && !productionHosts.has(publicURL.hostname.toLowerCase()),
      "Use a dedicated HTTPS staging hostname that is not a Permitext Production hostname."
    ),
    check(
      "durable-database",
      durableDatabaseConfigured(environment),
      "Configure durable PostgreSQL storage for the Sandbox exercise."
    ),
    check(
      "isolated-database-acknowledgment",
      environment.PERMITEXT_APPLE_SANDBOX_ISOLATED_DATABASE === "1",
      "Confirm that the staging database is separate from Production."
    ),
    check(
      "private-blob-storage",
      privateBlobStorageConfigured(environment),
      "Configure a private Blob store for the Sandbox exercise."
    ),
    check(
      "isolated-blob-acknowledgment",
      environment.PERMITEXT_APPLE_SANDBOX_ISOLATED_BLOB === "1",
      "Confirm that the staging Blob store is separate from Production."
    ),
    check(
      "apple-bundle",
      String(environment.APPLE_BUNDLE_ID || "").trim() === expectedAppleSandboxBundleID,
      `APPLE_BUNDLE_ID must equal ${expectedAppleSandboxBundleID}.`
    ),
    check(
      "apple-pro-product",
      String(environment.STOREKIT_PRO_PRODUCT_ID || "").trim() === expectedAppleSandboxProProductID,
      `STOREKIT_PRO_PRODUCT_ID must equal ${expectedAppleSandboxProProductID}.`
    ),
    check(
      "apple-root-pin-enforcement",
      environment.PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN === "1",
      "Require Apple App Store transaction root pinning on staging."
    ),
    check(
      "apple-root-pins",
      expectedAppleRootsConfigured(environment.APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS),
      "Configure the complete verified Apple PKI root-certificate SHA-256 fingerprint set on staging."
    ),
    check(
      "clerk",
      clerk.ready,
      clerk.ready ? "A Clerk identity configuration is available for the test account." : clerk.message
    ),
    check(
      "approved-policy-versions",
      policies.ready,
      policies.ready ? "Approved policy versions are configured for test acceptance." : policies.problems.join(" ")
    ),
    check(
      "paid-research-disabled",
      !paidTurnsEnabled,
      "Keep Research turn-pack sales disabled during the Apple subscription exercise."
    ),
    check(
      "research-kill-switch",
      environment.PERMITEXT_RESEARCH_KILL_SWITCH === "1",
      "Keep paid Research provider calls disabled during the Apple subscription exercise."
    ),
    check(
      "no-live-stripe-secret",
      !isLiveStripeKey(environment.STRIPE_SECRET_KEY),
      "Do not expose a live Stripe secret to the Apple Sandbox staging deployment."
    )
  ];

  return {
    ready: checks.every((item) => item.ready),
    checks,
    endpoints: publicURL ? {
      app: publicURL.origin,
      appleNotifications: `${publicURL.origin}/billing/apple/notifications`
    } : null
  };
}
