const originalFetch = globalThis.fetch;
const stripeBaseURL = String(process.env.PERMITEXT_TEST_STRIPE_API_BASE_URL || "").replace(/\/+$/, "");

globalThis.fetch = function permitextStripeTestFetch(input, init) {
  const rawURL = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = rawURL ? new URL(rawURL) : null;
  if (stripeBaseURL && url?.origin === "https://api.stripe.com") {
    return originalFetch(`${stripeBaseURL}${url.pathname}${url.search}`, init);
  }
  return originalFetch(input, init);
};
