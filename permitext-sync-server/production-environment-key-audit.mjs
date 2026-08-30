const productionKeyGroups = Object.freeze([
  { id: "durable-postgres", alternatives: [["PERMITEXT_SYNC_DATABASE_URL"], ["DATABASE_URL"], ["STORAGE_URL"], ["POSTGRES_URL"], ["NEON_DATABASE_URL"]] },
  { id: "private-blob-storage", alternatives: [["BLOB_READ_WRITE_TOKEN"], ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]] },
  { id: "stripe-live-secret", anyOf: ["STRIPE_SECRET_KEY"] },
  { id: "stripe-pro-price", anyOf: ["STRIPE_PRO_PRICE_ID"] },
  { id: "stripe-webhook-secret", anyOf: ["STRIPE_WEBHOOK_SECRET"] },
  { id: "stripe-tax-mode", anyOf: ["PERMITEXT_STRIPE_TAX_MODE"] },
  { id: "stripe-price-tax-behavior", anyOf: ["PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR"] },
  { id: "public-base-url", anyOf: ["PERMITEXT_PUBLIC_BASE_URL"] },
  { id: "terms-version", anyOf: ["PERMITEXT_TERMS_VERSION"] },
  { id: "privacy-version", anyOf: ["PERMITEXT_PRIVACY_VERSION"] },
  { id: "subscription-policy-version", anyOf: ["PERMITEXT_SUBSCRIPTION_POLICY_VERSION"] },
  { id: "apple-bundle", anyOf: ["APPLE_BUNDLE_ID"] },
  { id: "apple-pro-product", anyOf: ["STOREKIT_PRO_PRODUCT_ID"] },
  { id: "apple-root-pins", anyOf: ["APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS"] },
  { id: "clerk-publishable-key", anyOf: ["CLERK_PUBLISHABLE_KEY"] },
  { id: "clerk-secret-key", anyOf: ["CLERK_SECRET_KEY"] },
  { id: "clerk-authorized-parties", anyOf: ["CLERK_AUTHORIZED_PARTIES"] },
  { id: "clerk-frontend-api", anyOf: ["CLERK_FRONTEND_API_URL"] },
  { id: "clerk-account-portal", anyOf: ["CLERK_ACCOUNT_PORTAL_URL"] },
  { id: "research-max-request", anyOf: ["PERMITEXT_RESEARCH_MAX_REQUEST_USD"] },
  { id: "research-user-daily-cap", anyOf: ["PERMITEXT_RESEARCH_USER_DAILY_CAP_USD"] },
  { id: "research-user-monthly-cap", anyOf: ["PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD"] },
  { id: "research-daily-cap", anyOf: ["PERMITEXT_RESEARCH_DAILY_CAP_USD"] },
  { id: "research-monthly-cap", anyOf: ["PERMITEXT_RESEARCH_MONTHLY_CAP_USD"] },
  { id: "research-pricing-version", anyOf: ["PERMITEXT_RESEARCH_PRICING_VERSION"] },
  { id: "research-input-price", anyOf: ["PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS"] },
  { id: "research-cached-input-price", anyOf: ["PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS"] },
  { id: "research-output-price", anyOf: ["PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS"] }
]);

const valueVerificationRequirements = Object.freeze([
  "Stripe secret is live or appropriately restricted, Price is the intended live $20 monthly Price, and webhook secret matches the live endpoint.",
  "Stripe tax mode is automatic and Price tax behavior is the owner-approved inclusive or exclusive value.",
  "Public base URL is the canonical HTTPS Permitext URL.",
  "Terms, Privacy, and subscription/refund versions equal the exact owner-approved identifiers only after exact policy publication passes.",
  "Apple bundle ID, Pro product ID, and trusted root fingerprints equal the approved Production values.",
  "Clerk keys, authorized parties, frontend API, and account portal are Production values.",
  "Research caps are positive, the per-user monthly cap equals $7, the system monthly cap does not exceed $100, and pricing inputs match the current approved provider prices."
]);

export function productionEnvironmentVariableKeys(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.envs;
  if (!Array.isArray(entries)) throw new TypeError("Expected a Vercel environment-variable list or { envs } payload.");
  return [...new Set(entries
    .filter((entry) => {
      const targets = Array.isArray(entry?.target) ? entry.target : [];
      return targets.length === 0 || targets.map(String).map((value) => value.toLowerCase()).includes("production");
    })
    .map((entry) => String(entry?.key || entry?.name || "").trim())
    .filter(Boolean))]
    .sort();
}

export function auditProductionEnvironmentKeyPresence(payload) {
  const keys = productionEnvironmentVariableKeys(payload);
  const keySet = new Set(keys);
  const checks = productionKeyGroups.map((group) => {
    const alternatives = group.alternatives || group.anyOf.map((key) => [key]);
    const matchedKeys = alternatives.find((alternative) => alternative.every((key) => keySet.has(key))) || null;
    return {
      id: group.id,
      present: Boolean(matchedKeys),
      matchedKeys,
      acceptedAlternatives: alternatives.map((alternative) => [...alternative])
    };
  });
  const missing = checks.filter((check) => !check.present);
  return {
    metadataReady: missing.length === 0,
    variableCount: keys.length,
    requiredGroupCount: checks.length,
    presentRequiredGroupCount: checks.length - missing.length,
    missing: missing.map((check) => ({ id: check.id, acceptedAlternatives: check.acceptedAlternatives })),
    checks,
    valueVerificationRequired: [...valueVerificationRequirements]
  };
}
