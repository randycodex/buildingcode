import {
  beta1ConfigurationReadiness,
  requiredStripeWebhookEvents,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const completeEnvironment = {
  VERCEL_ENV: "production",
  DATABASE_URL: "postgres://contract",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_contract",
  PERMITEXT_PUBLIC_BASE_URL: "https://permitext.com",
  STRIPE_SECRET_KEY: "sk_live_contract",
  STRIPE_PRO_PRICE_ID: "price_contract",
  STRIPE_WEBHOOK_SECRET: "whsec_contract",
  APPLE_BUNDLE_ID: "com.randycodex.permitext",
  STOREKIT_PRO_PRODUCT_ID: "com.randycodex.permitext.pro.monthly",
  APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: "AABBCC",
  CLERK_PUBLISHABLE_KEY: "pk_live_contract",
  CLERK_SECRET_KEY: "sk_live_contract",
  CLERK_AUTHORIZED_PARTIES: "https://permitext.com",
  CLERK_FRONTEND_API_URL: "https://clerk.permitext.com",
  CLERK_ACCOUNT_PORTAL_URL: "https://accounts.permitext.com/sign-in",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.50",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "20",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "25",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "250",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.1",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "contract-v1"
};
assert(beta1ConfigurationReadiness(completeEnvironment).ready, "Complete Beta 1 configuration was rejected.");
assert(
  !beta1ConfigurationReadiness({ ...completeEnvironment, CLERK_SECRET_KEY: "" }).ready,
  "Beta 1 readiness accepted missing Clerk verification."
);
assert(
  !beta1ConfigurationReadiness({ ...completeEnvironment, DATABASE_URL: "" }).ready,
  "Beta 1 readiness accepted ephemeral JSON storage for public production."
);
assert(
  !beta1ConfigurationReadiness({ ...completeEnvironment, BLOB_READ_WRITE_TOKEN: "" }).ready,
  "Beta 1 readiness accepted missing private asset storage."
);

const liveStripe = await verifyLiveStripeReadiness(completeEnvironment, {
  fetchImplementation: async (url) => {
    if (url.includes("/v1/prices/")) {
      return new Response(JSON.stringify({
        id: "price_contract",
        livemode: true,
        active: true,
        type: "recurring",
        recurring: { interval: "month" }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: [{
        url: "https://permitext.com/billing/stripe/webhook",
        status: "enabled",
        enabled_events: [...requiredStripeWebhookEvents]
      }]
    }), { status: 200 });
  }
});
assert(liveStripe.ready, "Valid live Stripe price and webhook configuration was rejected.");

const vercelConfiguration = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8")
);
assert(
  vercelConfiguration.buildCommand?.includes("scripts/verify-production-deploy.mjs"),
  "Vercel Production can deploy without the commercial configuration and live Stripe gate."
);
const deployGate = await readFile(
  new URL("../scripts/verify-production-deploy.mjs", import.meta.url),
  "utf8"
);
assert(
  deployGate.includes('process.env.VERCEL_ENV !== "production"') &&
    deployGate.includes("beta1ConfigurationReadiness()") &&
    deployGate.includes("verifyLiveStripeReadiness()"),
  "The Production deploy gate no longer verifies configuration and live Stripe state."
);

console.log("permitext Beta 1 readiness contract passed");
