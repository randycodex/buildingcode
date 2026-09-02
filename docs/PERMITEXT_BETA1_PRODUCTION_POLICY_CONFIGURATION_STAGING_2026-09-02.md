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
- the two Stripe-tax activation keys remain intentionally unset until the approved Product classification and New York registration are submitted and verified; and
- `PERMITEXT_MONITORING_PROVIDER` remains intentionally unset because anomaly-specific delivery or an explicit documented operating acceptance is still open.

This record proves only that the three exact policy-version identifiers are staged in the Production environment. It does not prove that the approved policy bytes are live or that the consent flow is active.
