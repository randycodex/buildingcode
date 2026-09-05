# Permitext Production authentication configuration evidence — August 29, 2026

## Result

**September 5 repair supersedes the email-registration blocker below.**
The owner approved requiring an email address after reviewing Apple relay and
phone-only Apple-account effects. The setting was saved in Clerk Production;
the public configuration passed all 10 provider checks at
`2026-09-05T18:41:06Z`. The actual hosted sign-up page displayed the email field,
and owner-provided email verification created a fresh, empty, Synced Free
Permitext account on release `0a50c8a751ba`. Clerk independently confirmed its
new creation timestamp, verified primary email and absence of social accounts.
No purchase or policy checkbox was submitted. See the
[audit execution record](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md).

The returning-account check found a separate sign-out defect after browser
reload: lazy Clerk initialization allowed the Permitext session to end while
the provider session remained active. The captured-session repair and its
publication/verification state are tracked in that execution record. Provider
configuration, fresh email registration, existing-email verification, social
sign-in and final release acceptance remain separate evidence.

### Historical September 4 blocker

The September 4 final-Production refresh superseded the August configuration-ready result below.
On release `553e82e074eb3751edf72be8c7579990f91e3bd3`, a fresh, owner-designated
disposable email was rejected by the hosted sign-in page as an unknown account.
The linked sign-up page displayed Apple, Google, and Microsoft but no email field.
The Production Clerk dashboard and public environment agree: email sign-up and
code verification are enabled, but `Require email address` is off
(`user_settings.attributes.email_address.required: false`).

The permanent audit now checks public hosted email sign-up separately from
existing-account email sign-in. It fails closed unless email is enabled, required,
verified at sign-up by code, and public sign-up is enabled. Live provider evidence
fails that new check. The earlier ten passing checks did not test this setting;
they must not be cited as proof that fresh email registration works.

No live Clerk setting was changed. Before enabling the required-email setting,
review its effect on existing and fresh Apple/Google/Microsoft identities,
including Apple's private relay and the previously accepted iOS flow that avoids
asking users to re-enter their email. Clerk's
[email-code configuration instructions](https://clerk.com/docs/guides/development/custom-flows/authentication/email-sms-otp)
require an email address and verification at sign-up for this flow. Final rendered
registration and provider regression checks remain required after a configuration
repair. A custom email flow would need its own product/security review and is not
assumed as an alternative that already works.

The test address and account exports are not recorded here. An initial automatic
Google return reused the existing owner identity and was excluded from fresh
test-account acceptance. After the owner completed Google verification, the
operator explicitly selected the disposable identity in Google's chooser. Clerk
recorded its creation on September 4; Permitext returned an empty Free account
with Synced status and no owner records. The operator added one BC 2022 section
101.1 saved passage, one synthetic note, and one synthetic saved collection.
Policy links and the unchecked, enabled consent control rendered on the final
Free-account page; the upgrade button remained disabled. No policy agreement,
purchase, paid Research, or deletion was submitted. Independent-client sync,
complete export and deletion acceptance remain open.

The local operator credential was rejected with HTTP 401 by the read-only
restore-checklist endpoint. No raw export was obtained and no privileged write was
attempted. The representative Project/private-image/Research-history portion also
requires a separately reviewed preparation route: the Free UI permits saved
collections but disables Projects. Do not grant Pro or make a purchase merely to
fill that gap without an approved test scope.

Verification: the updated `npm run test:auth` suite and the real-entry-point
`web-account-mutation-isolation-contract.mjs` passed. The auth run first exposed an
obsolete Workboard-deletion source assertion; it now checks the repaired captured
owner cleanup and preserves unowned legacy Workboard bytes. The live public audit
at `2026-09-05T00:56:28Z` passed the nine other public checks and failed
`email-sign-up`; that request did not inspect hidden server environment values.

### Historical August 29 result

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

A September 2 read-only refresh returned the same result: all ten configuration checks passed for the public Production Clerk environment, email/Apple/Google/Microsoft providers, email verification, Native API, exact Account Portal paths, and Apple web credentials. The audit continued to report `manualAcceptanceComplete: false` because the final-release fresh/existing provider sign-ins and disposable-account export/deletion lifecycle have not occurred. Vercel again reported that Production Secret values cannot be pulled and loaded only the pre-existing ignored local environment, so this refresh does not claim direct verification of hidden Production values.

## Remaining release evidence

- Re-run the audit from the final deployed environment and confirm the new aggregate authentication fields on `/health`.
- Manually exercise fresh and existing email, Apple, Google, and Microsoft sign-in after that deployment.
- Use a dedicated disposable Permitext account for the export/deletion lifecycle, confirm the exact target immediately before deletion, and preserve redacted before/after evidence.
- Do not infer fresh OAuth success from an already-authenticated Clerk session.

No merge, push, Production deployment, provider-plan change, price change, paid model call, real charge, account deletion, or user-data inspection occurred.
