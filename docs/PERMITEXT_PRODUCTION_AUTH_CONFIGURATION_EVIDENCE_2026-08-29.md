# Permitext Production authentication configuration evidence — August 29, 2026

## Result

The read-only Production authentication configuration audit passes at the Clerk provider and checked-in server-contract layers. This is configuration evidence, not proof that every fresh and existing account can complete every provider flow after the final deployment.

The permanent audit reports:

```text
configurationReady: true
manualAcceptanceComplete: false
releaseReady: false
```

The release boundary is intentional. Existing sessions, source contracts, and a configured provider do not replace fresh manual sign-in or destructive account-lifecycle acceptance.

## Live read-only evidence

No Clerk setting, DNS record, Vercel variable, user, session, subscription, deployment, or application file was changed during these checks.

| Surface | Observed Production state |
| --- | --- |
| Clerk instance | `Permitext`, `production`, organization plan `Hobby` |
| Email | Email sign-up and sign-in enabled; verification code enabled and required at sign-up |
| Social providers | Apple, Google, and Microsoft are each listed as `Used for sign-in` |
| Social-connection capacity | `3 out of 3` free connections are used. Permitext requires exactly these three, so no Clerk upgrade is required for Beta 1. Adding a fourth social/custom connection would require a plan review. |
| Primary domain | `permitext.com` verified |
| Clerk application DNS | `clerk` and `accounts` CNAME records both verified |
| Clerk email DNS | All three email records verified; SSL certificates issued for the Frontend API and Account Portal |
| Account Portal | Sign-in `https://accounts.permitext.com/sign-in`; sign-up `https://accounts.permitext.com/sign-up`; profile `https://accounts.permitext.com/user` |
| Component paths | Sign-in, sign-up, sign-out, and OAuth consent use the Clerk Account Portal |
| Native API | Enabled |
| iOS registration | App ID prefix `57BY95X97H`; bundle `com.randycodex.permitext` |
| Native redirect allowlist | `com.randycodex.permitext://callback` |
| Public Frontend API | `/v1/environment` returned HTTP 200 and reported Production, test mode off, email code, Apple, Google, Microsoft, native configuration, single-session mode, and the exact Permitext portal/home URLs |
| Associated domains | `/.well-known/apple-app-site-association` returned HTTP 200 `application/json` and authorized `57BY95X97H.com.randycodex.permitext` for web credentials |
| Vercel variable inventory | All six required Clerk variable names are present in Production: publishable key, secret key, JWT key, authorized parties, Frontend API URL, and Account Portal URL |
| Serving release at inspection | `/health` and `/release` reported commit `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3`, PostgreSQL `normalized-v4`, and commercial configuration present |

Vercel marks the Production Clerk values encrypted or sensitive. The CLI safely confirmed names and targets but did not reveal those values. The local environment used for the new audit contains live-format Clerk configuration and exactly `https://permitext.com` plus `https://www.permitext.com` as authorized browser origins. The serving release predates the new public aggregate authentication-health fields, so those exact server-side facts must be reconfirmed from `/health` after the later authorized deployment.

## Permanent guard added

`production-auth-audit.mjs` now combines:

- fail-closed server configuration checks;
- public Clerk Production environment checks;
- required email, Apple, Google, and Microsoft factors;
- exact Account Portal and home URLs;
- native API presence; and
- the exact public Apple web-credentials association.

The audit never emits secret values or customer identifiers. It keeps configuration readiness separate from release readiness and cannot mark release ready until explicit evidence covers:

1. fresh-account sign-in through email, Apple, Google, and Microsoft;
2. existing-account sign-in through the same four providers; and
3. one dedicated Production-configured account export/deletion lifecycle.

The Clerk server verifier is also stricter: Production now rejects missing or additional browser origins instead of merely requiring a non-empty list. The future deployed `/health` response will expose aggregate-only authentication booleans, key mode, verification mode, and authorized-party count without exposing values.

## Verification

The following passed without a deployment or paid provider call:

```text
npm run test:auth
npm run test:beta1-readiness
npm run test:public-surface
npm run test:routing
node tests/smoke.mjs
node --check app.mjs
node --check tests/production-health.mjs
npx --yes vercel@latest env run -e production -- npm run audit:production-auth -- --require-configuration
```

The live audit returned all ten configuration checks ready and all three manual acceptance checks open.

## Remaining release evidence

- Re-run the audit from the final deployed environment and confirm the new aggregate authentication fields on `/health`.
- Manually exercise fresh and existing email, Apple, Google, and Microsoft sign-in after that deployment.
- Use a dedicated disposable Permitext account for the export/deletion lifecycle, confirm the exact target immediately before deletion, and preserve redacted before/after evidence.
- Do not infer fresh OAuth success from an already-authenticated Clerk session.

No merge, push, Production deployment, provider-plan change, price change, paid model call, real charge, account deletion, or user-data inspection occurred.
