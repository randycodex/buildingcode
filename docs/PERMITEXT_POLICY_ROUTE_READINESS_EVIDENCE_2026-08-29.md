# Permitext approved-policy route readiness — August 29, 2026

## Outcome

The exact owner-approved customer documents are ready to publish at Permitext's existing canonical routes without another content edit:

| Document | Approved version | Canonical route | SHA-256 result |
| --- | --- | --- | --- |
| Terms | `terms-2026-08-28` | `https://permitext.com/terms` | Exact approved hash match |
| Privacy Policy | `privacy-2026-08-28` | `https://permitext.com/privacy` | Exact approved hash match |
| Subscription and Refund Policy | `subscriptions-2026-08-28` | `https://permitext.com/refunds` | Exact approved hash match |

The checked-in Vercel routing contract maps both slash variants of each public route to the corresponding static HTML file. The policy-acceptance contract constructs the same three canonical URLs from `PERMITEXT_PUBLIC_BASE_URL`, and the local end-to-end lifecycle verifies `GET /policies/current`, version-matched acceptance, stale-version rejection, authentication, persistence, and Checkout gating.

## Permanent integrity guard

`permitext-sync-server/approved-policy-artifacts.mjs` now retains the owner-approved version, source path, public path, and SHA-256 digest for each artifact. `tests/approved-policy-artifacts-contract.mjs` reads the actual bytes and fails if any approved HTML file changes without a new approved version/hash. It also proves that the dormant approved configuration resolves to the three canonical `https://permitext.com` routes.

This guard does not configure environment values or activate acceptance. It prevents a later deployment from silently labeling edited content with the August 28 approval identifiers.

## Verification

From `permitext-sync-server`:

```sh
npm run test:auth
npm run test:routing
npm run test:public-surface
npm run test:beta1-readiness
```

The policy artifact integrity contract, route contract, local acceptance lifecycle, public purchase-ordering contract, and Beta readiness contract pass without a network call, provider charge, or Production write.

## Remaining Production gate

Stable local routes and exact artifact integrity are complete. The public URLs are not claimed live for these new versions until the intended commit is separately deployed and each URL is fetched from Production. Only after that independent verification may the three approved version variables be configured and the already-wired purchase-consent flow be activated. No deployment or Production environment change occurred in this task.
