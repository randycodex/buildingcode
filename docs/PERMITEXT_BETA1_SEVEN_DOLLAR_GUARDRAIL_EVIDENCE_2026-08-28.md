# Permitext Beta 1 — $7 Per-User Monthly Research Guardrail Evidence

Date: August 28, 2026

## Outcome

The no-cost local gate passes with `PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD=7` and now fails for any different value. This converts the commercial plan's $7 amount from a minimum into the exact Beta 1 per-user monthly Research-cost ceiling.

The verification did not call a model provider, create a charge, alter Vercel environment variables, or deploy an application.

## Why $7

- The immutable V6 subscriber model projects $6.06 p90 model cost for a fully used 100-turn month.
- A $7 ceiling leaves $0.94 of headroom above that p90 projection.
- The ceiling limits the model-cost exposure of one fully active subscriber while retaining the owner-approved 100-turn allowance.
- This is an internal operating guardrail, not a customer price or a promise that every user may always incur $7 of model spend.

## Contract verified

`beta1ConfigurationReadiness()` now requires the per-user monthly amount to equal exactly `$7.00`:

- `$7.00`: accepted;
- `$6.99`: rejected because it cannot support the retained planning allowance; and
- `$7.01`: rejected because it exceeds the approved Beta ceiling.

The existing runtime guardrail test also passes with the $7 monthly value and confirms that incomplete or internally inconsistent spend configuration fails closed.

## Commands and results

From `permitext-sync-server`:

```text
npm run test:beta1-readiness
permitext Beta 1 readiness contract passed

npm run test:cost-guardrails
permitext Research cost guardrail contract passed
permitext Research economics contract passed
permitext Research V6 subscriber economics contract passed
permitext Research economics persistence contract passed
Permitext frozen hybrid Research benchmark profile contract passed; paid model calls: no.
Permitext frozen commercialization benchmark profile contract passed; paid model calls: no.
```

## Remaining Production gate

The local Vercel environment snapshot masks sensitive variable values, so this work does not claim that the live Production variable already equals $7. Before a future authorized deployment:

1. set `PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD=7` in the Production environment;
2. keep the system monthly ceiling at or below the owner-approved $100 maximum;
3. keep Research disabled until the release lifecycle gates permit it;
4. rerun the Production readiness verifier; and
5. verify the deployed release reports commercial readiness without exposing the private dollar limits to customers.
