import { clerkConfigurationStatus } from "./clerk-auth.mjs";
import { policyVersionConfiguration } from "./policy-acceptance.mjs";
import { researchSpendGuardrails } from "./research-config.mjs";
import { paidResearchTurnsEnabled } from "./research-turns.mjs";

export const requiredStripeWebhookEvents = Object.freeze([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "charge.refunded"
]);

export const expectedStripeProPrice = Object.freeze({
  currency: "usd",
  interval: "month",
  unitAmount: 2_000
});

export const expectedBeta1UserMonthlyResearchCapUSD = 7;

function check(id, ready, detail) {
  return { id, ready: Boolean(ready), detail };
}

function liveKey(value, prefix) {
  return String(value || "").trim().startsWith(`${prefix}_live_`);
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

export function beta1ConfigurationReadiness(environment = process.env) {
  const publicBaseURL = String(environment.PERMITEXT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  const clerk = clerkConfigurationStatus(environment);
  const policies = policyVersionConfiguration(environment);
  const research = researchSpendGuardrails(environment);
  const paidTurnsEnabled = paidResearchTurnsEnabled(environment);
  const stripeResearchPackPriceIDs = [
    environment.STRIPE_RESEARCH_TURNS_25_PRICE_ID,
    environment.STRIPE_RESEARCH_TURNS_100_PRICE_ID
  ];
  const appleResearchPackProductIDs = [
    environment.STOREKIT_RESEARCH_TURNS_25_PRODUCT_ID,
    environment.STOREKIT_RESEARCH_TURNS_100_PRODUCT_ID
  ];
  const checks = [
    check("durable-postgres", durableDatabaseConfigured(environment), "Configure durable PostgreSQL storage; the local JSON store is not a public-production data store."),
    check("private-blob-storage", privateBlobStorageConfigured(environment), "Configure private Vercel Blob storage for uploaded images and generated files."),
    check("stripe-live-secret", liveKey(environment.STRIPE_SECRET_KEY, "sk") || liveKey(environment.STRIPE_SECRET_KEY, "rk"), "Use a live Stripe secret or restricted key."),
    check("stripe-pro-price", String(environment.STRIPE_PRO_PRICE_ID || "").startsWith("price_"), "Configure the live recurring Pro Price ID."),
    check("stripe-webhook-secret", String(environment.STRIPE_WEBHOOK_SECRET || "").startsWith("whsec_"), "Configure the live endpoint signing secret."),
    check("public-base-url", publicBaseURL.startsWith("https://"), "Set the canonical HTTPS Permitext production URL."),
    check(
      "approved-policy-versions",
      policies.ready,
      policies.ready
        ? "Approved Terms, Privacy, and subscription/refund policy versions are configured for acceptance tracking."
        : policies.problems.join(" ")
    ),
    check("apple-bundle", Boolean(String(environment.APPLE_BUNDLE_ID || "").trim()), "Configure the App Store bundle identifier."),
    check("apple-pro-product", Boolean(String(environment.STOREKIT_PRO_PRODUCT_ID || "").trim()), "Configure the App Store Pro product identifier."),
    check(
      "stripe-research-turn-packs",
      !paidTurnsEnabled || stripeResearchPackPriceIDs.every((value) => String(value || "").startsWith("price_")),
      paidTurnsEnabled
        ? "Configure Stripe Price IDs for both Research turn packs."
        : "Paid Research turns are disabled; Stripe pack prices are not required."
    ),
    check(
      "apple-research-turn-packs",
      !paidTurnsEnabled || appleResearchPackProductIDs.every((value) => Boolean(String(value || "").trim())),
      paidTurnsEnabled
        ? "Configure App Store product identifiers for both Research turn packs."
        : "Paid Research turns are disabled; App Store pack products are not required."
    ),
    check("apple-production-only", environment.PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS === "1" || environment.VERCEL_ENV === "production", "Production must reject Sandbox and Xcode transactions."),
    check("apple-root-pins", Boolean(String(environment.APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS || "").trim()), "Pin the trusted Apple App Store root certificate fingerprints."),
    check("clerk", clerk.webReady, clerk.webReady ? "Clerk production identity and hosted web sign-in are configured." : clerk.webMessage),
    check("research-cost-guardrails", research.ready, research.ready ? "Research per-turn, per-user daily/monthly, and system daily/monthly caps are configured." : research.problems.join(" ")),
    check(
      "research-beta1-user-monthly-budget",
      research.ready && Number(research.userMonthlyCapUSD) === expectedBeta1UserMonthlyResearchCapUSD,
      research.ready && Number(research.userMonthlyCapUSD) === expectedBeta1UserMonthlyResearchCapUSD
        ? `The Research per-user monthly cap is the approved $${expectedBeta1UserMonthlyResearchCapUSD.toFixed(2)} Beta ceiling.`
        : `PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD must equal the approved $${expectedBeta1UserMonthlyResearchCapUSD.toFixed(2)} Beta ceiling.`
    ),
    check(
      "research-beta1-monthly-budget",
      research.ready && Number(research.monthlyCapUSD) <= 100,
      research.ready && Number(research.monthlyCapUSD) <= 100
        ? `The Research system monthly cap is $${Number(research.monthlyCapUSD).toFixed(2)}, within the approved $100 maximum.`
        : "PERMITEXT_RESEARCH_MONTHLY_CAP_USD must not exceed the approved $100 Beta 1 maximum."
    )
  ];
  return {
    ready: checks.every((item) => item.ready),
    checks,
    endpoints: publicBaseURL ? {
      stripeWebhook: `${publicBaseURL}/billing/stripe/webhook`,
      appleNotifications: `${publicBaseURL}/billing/apple/notifications`
    } : null,
    requiredStripeWebhookEvents: [...requiredStripeWebhookEvents]
  };
}

async function stripeRequest(path, secretKey, fetchImplementation) {
  const response = await fetchImplementation(`https://api.stripe.com${path}`, {
    headers: {
      authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe returned ${response.status}.`);
  return payload;
}

export async function verifyLiveStripeReadiness(
  environment = process.env,
  { fetchImplementation = fetch } = {}
) {
  const secretKey = String(environment.STRIPE_SECRET_KEY || "").trim();
  const priceID = String(environment.STRIPE_PRO_PRICE_ID || "").trim();
  const baseURL = String(environment.PERMITEXT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!liveKey(secretKey, "sk") && !liveKey(secretKey, "rk")) {
    throw new Error("Live Stripe verification requires a live secret or restricted key.");
  }
  const [price, endpointList] = await Promise.all([
    stripeRequest(`/v1/prices/${encodeURIComponent(priceID)}`, secretKey, fetchImplementation),
    stripeRequest("/v1/webhook_endpoints?limit=100", secretKey, fetchImplementation)
  ]);
  const expectedURL = `${baseURL}/billing/stripe/webhook`;
  const endpoint = (endpointList.data || []).find((candidate) => candidate.url === expectedURL);
  const enabledEvents = new Set(endpoint?.enabled_events || []);
  const receivesAllEvents = enabledEvents.has("*");
  const missingEvents = receivesAllEvents
    ? []
    : requiredStripeWebhookEvents.filter((event) => !enabledEvents.has(event));
  return {
    ready: Boolean(
      price.livemode === true &&
      price.active === true &&
      price.type === "recurring" &&
      price.currency === expectedStripeProPrice.currency &&
      price.unit_amount === expectedStripeProPrice.unitAmount &&
      price.recurring?.interval === expectedStripeProPrice.interval &&
      endpoint?.status === "enabled" &&
      missingEvents.length === 0
    ),
    price: {
      id: price.id || null,
      live: price.livemode === true,
      active: price.active === true,
      recurring: price.type === "recurring",
      interval: price.recurring?.interval || null,
      currency: price.currency || null,
      unitAmount: Number.isSafeInteger(price.unit_amount) ? price.unit_amount : null
    },
    webhook: {
      configured: Boolean(endpoint),
      enabled: endpoint?.status === "enabled",
      url: expectedURL,
      missingEvents
    }
  };
}
