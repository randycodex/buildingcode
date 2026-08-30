export const stripeAutomaticTaxMode = "automatic";
export const supportedStripePriceTaxBehaviors = Object.freeze([
  "exclusive",
  "inclusive"
]);

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function stripeTaxConfiguration(environment = process.env) {
  const configuredMode = normalized(environment.PERMITEXT_STRIPE_TAX_MODE);
  const configuredTaxBehavior = normalized(
    environment.PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR
  );
  const mode = configuredMode === stripeAutomaticTaxMode
    ? configuredMode
    : configuredMode
      ? "unsupported"
      : "unconfigured";
  const taxBehavior = supportedStripePriceTaxBehaviors.includes(configuredTaxBehavior)
    ? configuredTaxBehavior
    : configuredTaxBehavior
      ? "unsupported"
      : "unconfigured";
  const problems = [];

  if (mode !== stripeAutomaticTaxMode) {
    problems.push(
      mode === "unconfigured"
        ? "Set PERMITEXT_STRIPE_TAX_MODE=automatic before enabling Production Checkout."
        : "PERMITEXT_STRIPE_TAX_MODE must be automatic."
    );
  }
  if (!supportedStripePriceTaxBehaviors.includes(taxBehavior)) {
    problems.push(
      taxBehavior === "unconfigured"
        ? "Choose PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=inclusive or exclusive and match the live Stripe Price."
        : "PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR must be inclusive or exclusive."
    );
  }

  return {
    ready: problems.length === 0,
    mode,
    taxBehavior,
    problems
  };
}

export function stripeCheckoutTaxParameters(environment = process.env) {
  const configuration = stripeTaxConfiguration(environment);
  if (!configuration.ready) return null;
  return {
    automatic_tax: { enabled: true },
    billing_address_collection: "required"
  };
}
