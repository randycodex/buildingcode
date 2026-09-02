# Permitext Beta 1 Production policy configuration staging — September 2, 2026

Status: **CONFIGURED IN VERCEL; NOT DEPLOYED OR PUBLISHED**

## Scope

The owner authorized the planned policy/configuration step on September 2, 2026. The following exact approved identifiers were written to the `permitext-sync` Vercel Production environment as hidden Secret values:

- `PERMITEXT_TERMS_VERSION=terms-2026-08-28`
- `PERMITEXT_PRIVACY_VERSION=privacy-2026-08-28`
- `PERMITEXT_SUBSCRIPTION_POLICY_VERSION=subscriptions-2026-08-28`

The Vercel CLI reported each value saved for Production, and a separate key-presence listing confirmed all three names. Hidden values were not read back or printed from Vercel.

## Boundary

Environment configuration does not update an existing deployment. No Production deployment, domain promotion, Stripe registration, Product update, charge, or customer-data write occurred in this step.

Immediately afterward:

- `https://permitext.com/release` still reported serving commit `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3` from deployment `permitext-sync-68t0wrazg-randycodexs-projects-b72fc111.vercel.app`;
- the strict policy publication audit still returned `publicationReady: false` because all three live routes served hashes different from the exact approved local artifacts;
- later on September 2, after the approved Product classification and New York registration were submitted and verified, both Stripe-tax activation keys were added to Production without a deployment; see [PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md); and
- later on September 2, after the owner explicitly accepted the documented bounded daily-review monitoring alternative for Beta 1, `PERMITEXT_MONITORING_PROVIDER=vercel-observability-daily-review` was added to Vercel Production as a hidden Secret value; see [Production monitoring audit evidence](./PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md).

This record proves only that the three exact policy-version identifiers were staged in the Production environment at the recorded checkpoint. The later Stripe-tax evidence proves the two additional key insertions and provider activation, and the monitoring evidence records the later owner-accepted operating marker. None of these records proves that the approved policy bytes or newly staged values are live, because no deployment had occurred at those checkpoints.
