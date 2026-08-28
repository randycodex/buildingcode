import { clerkConfigurationStatus } from "./clerk-auth.mjs";
import { policyVersionConfiguration } from "./policy-acceptance.mjs";
import { paidResearchTurnsEnabled } from "./research-turns.mjs";

export const expectedAppleSandboxBundleID = "com.randycodex.permitext";
export const expectedAppleSandboxProProductID = "com.randycodex.permitext.pro.monthly";

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

function validAppleRootFingerprints(value) {
  const fingerprints = String(value || "")
    .split(",")
    .map((item) => item.replace(/[^a-fA-F0-9]/g, ""))
    .filter(Boolean);
  return fingerprints.length > 0 && fingerprints.every((item) => /^[a-fA-F0-9]{64}$/.test(item));
}

function parsedPublicURL(environment) {
  try {
    return new URL(String(environment.PERMITEXT_PUBLIC_BASE_URL || "").trim());
  } catch {
    return null;
  }
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
      environment.VERCEL_ENV !== "production" && environment.NODE_ENV !== "production",
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
      validAppleRootFingerprints(environment.APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS),
      "Configure one or more verified 64-hex SHA-256 Apple App Store root certificate fingerprints on staging."
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
