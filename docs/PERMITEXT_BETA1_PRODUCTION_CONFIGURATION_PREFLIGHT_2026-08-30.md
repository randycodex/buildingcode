# Permitext Beta 1 Production configuration preflight — August 30, 2026

Status: **Not ready; five required activation keys are absent and secret values still require in-runtime verification**

## Scope and safety boundary

This was a read-only inventory of the existing `permitext-sync` Vercel Production environment and public Production health endpoints. It did not read or expose secret values, add or change an environment variable, create a deployment, change pricing, call a paid model, create a charge, or alter customer data.

The audit deliberately separates two questions:

1. **Key presence:** does Production metadata contain the environment-variable names required by the current Beta 1 source?
2. **Value correctness:** do the hidden values satisfy the exact live-key, URL, policy-version, tax, Apple, Clerk, and Research-budget contracts?

Key presence can be checked without secrets. It cannot prove value correctness.

## Live read-only result

Vercel CLI 59.10.0 returned metadata for **63** Production environment variables. The new fail-closed audit evaluated **28** required configuration groups:

- **23 present**;
- **5 missing**;
- overall metadata readiness: **false**.

The missing activation keys are:

- `PERMITEXT_STRIPE_TAX_MODE`;
- `PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR`;
- `PERMITEXT_TERMS_VERSION`;
- `PERMITEXT_PRIVACY_VERSION`;
- `PERMITEXT_SUBSCRIPTION_POLICY_VERSION`.

The missing Stripe tax keys are expected to remain absent until the owner confirms the prepared automatic/exclusive decision, the New York Certificate and provider registration facts are available, and activation is separately authorized. The three policy-version keys must remain absent until Production serves the exact approved document bytes and the strict publication audit passes.

Production metadata does contain the required groups for durable PostgreSQL, private Blob storage, Stripe secret/Price/webhook identifiers, canonical public URL, Apple bundle/Pro/root-pin configuration, Clerk Production configuration, and the Research cap and price inputs. Presence does **not** prove any hidden value is correct.

## Why the ordinary local verifier cannot prove the hidden values

`vercel env pull` reported that 55 Secret values cannot be pulled from Production and wrote `[SENSITIVE]` placeholders. Running the value-level readiness verifier against those placeholders correctly returned not ready, but those placeholder failures must not be misrepresented as evidence that the corresponding live Production values are invalid.

The exact value-level gate still requires one of these evidence paths immediately before deployment:

- execute the verifier in a protected environment containing the real approved values without printing them; or
- compare each hidden value through the provider's protected configuration workflow, then retain only pass/fail and non-secret fingerprints.

The value-level gate must confirm at least:

- live/restricted Stripe credentials, the intended $20 monthly Price, webhook endpoint, automatic tax, and approved exclusive/inclusive behavior;
- canonical HTTPS base URL and exact approved policy identifiers after publication passes;
- approved Apple identifiers and current root pins;
- Production Clerk keys and domains;
- positive Research caps, an exact $7 per-user monthly cap, a system monthly cap no higher than $100, and current provider pricing inputs.

## Current serving Production evidence

Read-only requests to `https://permitext.com/health` and `/release` returned HTTP 200. They reported PostgreSQL storage, normalized-v4 schema, and serving commit `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3`. The health response still reports `externalAlertsConfigured: false`. This is current serving evidence only; it is not evidence that the newer branch or activation configuration is deployed.

## Retained audit

The reusable audit accepts Vercel's JSON metadata and never reads variable values:

```sh
vercel env ls production --json | npm run --silent audit:production-env-keys
```

It exits nonzero while any required key group is absent. Its contract also proves that Preview-only variables do not satisfy a Production requirement and that the alternative private-Blob OIDC path requires both its token and store identifier.

## Next authorized sequence

1. Publish and verify the exact approved policy files before adding their three version identifiers.
2. Receive and verify the New York Certificate and provider registration facts.
3. Confirm the prepared Stripe automatic/exclusive decision and Product tax classification.
4. Add the five activation keys only with explicit authorization; do not deploy merely because names are present.
5. Run the value-level readiness verifier with real protected values and retain aggregate evidence.
6. Continue to the separately approved deployment and controlled Production billing gates.
