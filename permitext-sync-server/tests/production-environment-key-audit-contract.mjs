import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditProductionEnvironmentKeyPresence } from "../production-environment-key-audit.mjs";

const requiredKeys = [
  "DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "PERMITEXT_STRIPE_TAX_MODE",
  "PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR",
  "PERMITEXT_PUBLIC_BASE_URL",
  "PERMITEXT_TERMS_VERSION",
  "PERMITEXT_PRIVACY_VERSION",
  "PERMITEXT_SUBSCRIPTION_POLICY_VERSION",
  "APPLE_BUNDLE_ID",
  "STOREKIT_PRO_PRODUCT_ID",
  "APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_AUTHORIZED_PARTIES",
  "CLERK_FRONTEND_API_URL",
  "CLERK_ACCOUNT_PORTAL_URL",
  "PERMITEXT_RESEARCH_MAX_REQUEST_USD",
  "PERMITEXT_RESEARCH_USER_DAILY_CAP_USD",
  "PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD",
  "PERMITEXT_RESEARCH_DAILY_CAP_USD",
  "PERMITEXT_RESEARCH_MONTHLY_CAP_USD",
  "PERMITEXT_RESEARCH_PRICING_VERSION",
  "PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS",
  "PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS",
  "PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS"
];

const complete = auditProductionEnvironmentKeyPresence({
  envs: requiredKeys.map((key) => ({ key, target: ["production"] }))
});
assert.equal(complete.metadataReady, true);
assert.equal(complete.requiredGroupCount, 28);
assert.equal(complete.presentRequiredGroupCount, 28);
assert.equal(complete.valueVerificationRequired.length, 7);

const actualShapeMissingActivationKeys = auditProductionEnvironmentKeyPresence({
  envs: requiredKeys
    .filter((key) => ![
      "PERMITEXT_STRIPE_TAX_MODE",
      "PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR",
      "PERMITEXT_TERMS_VERSION",
      "PERMITEXT_PRIVACY_VERSION",
      "PERMITEXT_SUBSCRIPTION_POLICY_VERSION"
    ].includes(key))
    .map((key) => ({ key, target: ["production"] }))
});
assert.equal(actualShapeMissingActivationKeys.metadataReady, false);
assert.deepEqual(
  actualShapeMissingActivationKeys.missing.map((item) => item.id),
  [
    "stripe-tax-mode",
    "stripe-price-tax-behavior",
    "terms-version",
    "privacy-version",
    "subscription-policy-version"
  ]
);

const previewOnlyDoesNotCount = auditProductionEnvironmentKeyPresence({
  envs: requiredKeys.map((key) => ({ key, target: key === "DATABASE_URL" ? ["preview"] : ["production"] }))
});
assert.equal(previewOnlyDoesNotCount.metadataReady, false);
assert.equal(previewOnlyDoesNotCount.missing[0].id, "durable-postgres");

const missingOidcStoreID = auditProductionEnvironmentKeyPresence({
  envs: requiredKeys
    .filter((key) => key !== "BLOB_READ_WRITE_TOKEN")
    .map((key) => ({ key, target: ["production"] }))
    .concat({ key: "VERCEL_OIDC_TOKEN", target: ["production"] })
});
assert.equal(missingOidcStoreID.metadataReady, false);
assert.equal(missingOidcStoreID.missing[0].id, "private-blob-storage");

const [evidence, master, currentPlan, operations, readme] = await Promise.all([
  readFile(new URL("../../docs/PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_OPERATIONS_RUNBOOK.md", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8")
]);
assert.match(evidence, /23 present/);
assert.match(evidence, /5 missing/);
assert.match(evidence, /55 Secret values cannot be pulled/);
assert.match(evidence, /53 Production Secret values cannot be pulled/);
assert.match(evidence, /is not a substitute for server-side or provider-console verification/);
assert.match(evidence, /Key presence can be checked without secrets\. It cannot prove value correctness/);
assert.match(evidence, /dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3/);
assert.match(master, /PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30\.md/);
assert.match(currentPlan, /PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30\.md/);
assert.match(operations, /audit:production-env-keys/);
assert.match(readme, /audit:production-env-keys/);
assert.match(readme, /cannot prove that a hidden value is correct/);

console.log("Permitext Production environment key-presence audit contract passed.");
