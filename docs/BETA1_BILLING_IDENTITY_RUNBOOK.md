# Permitext Beta 1 billing and identity runbook

This runbook is an evidence checklist. Passing unit tests does not authorize public billing; the provider-created records and production entitlement changes below must also be captured.

## Release architecture

- Permitext Web sells Pro through Stripe Checkout and manages it through Stripe Billing Portal.
- Permitext iOS sells Pro through StoreKit. It does not present a Stripe purchase path for digital access.
- Both providers update the same Permitext entitlement record.
- Beta 1 Pro is $20 per month, has no trial or annual plan, and includes 100 Research turns per UTC calendar month.
- Optional Research turn packs are one-time, non-expiring consumables. They are shared through the Permitext account and are used only after the included monthly turns.
- Code reading and code search remain available without a Pro subscription.
- Clerk is the canonical sign-in provider for Apple, Google, and Microsoft identities.
- Web Checkout, web restore, iOS StoreKit purchase, and iOS StoreKit restore all require an authenticated Permitext account before provider billing begins. On iOS, the purchase or restore action starts the production Clerk sign-in flow first when needed.
- An existing Permitext Apple account must be authenticated before it is linked into a Clerk identity. Never merge accounts from an email match alone.
- If both source and target accounts already have different Pro ownership records, stop the merge without modifying either account. Support must resolve the duplicate purchase while preserving any lifetime grant. Only equivalent lifetime grants or duplicate records for the same provider subscription may merge automatically.

## Required production configuration

Public production must use durable PostgreSQL storage and private Vercel Blob storage. The readiness check rejects the local JSON store and a deployment without private asset storage.

Run the non-mutating configuration check:

```bash
cd permitext-sync-server
node --env-file=.env.production.local scripts/verify-beta1-readiness.mjs
```

After the configuration check passes, the live Stripe inspection is also read-only:

```bash
node --env-file=.env.production.local scripts/verify-beta1-readiness.mjs --live-stripe
```

The live check confirms that the Pro Price is active, live, and recurring; that the exact production webhook URL is enabled; and that it receives every event the entitlement lifecycle requires.

Vercel variables marked Sensitive are intentionally unavailable to local environment pulls. The Production build therefore runs `scripts/verify-production-deploy.mjs` with the deployed environment: it blocks publication unless the complete configuration check and the read-only live Stripe inspection both pass. Preview builds skip this Production-only gate.

Configure App Store Server Notifications V2 in App Store Connect with:

```text
https://<production-domain>/billing/apple/notifications
```

Production also requires `APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS` with the current Apple PKI App Store trust roots. The variable was added to Vercel Production only on 2026-08-21. Reconfirm the roots against Apple's certificate-authority page during credential rotation; a deployment is required before a changed value reaches the serving app.

Configure Stripe with:

```text
https://<production-domain>/billing/stripe/webhook
```

Configure Clerk with live keys, `CLERK_AUTHORIZED_PARTIES`, and these hosted web-flow values:

```text
CLERK_FRONTEND_API_URL=https://clerk.permitext.com
CLERK_ACCOUNT_PORTAL_URL=https://accounts.permitext.com/sign-in
```

The corresponding Clerk DNS records, Account Portal redirects, and Apple, Google, and Microsoft social connections must be active in the Clerk production instance. Permitext loads ClerkJS directly from the configured Frontend API, redirects to the hosted Account Portal, verifies the returned Clerk session token on the backend, and only then creates or links the Permitext account.

For iOS, set the target build setting `CLERK_PUBLISHABLE_KEY` to the production publishable key, enable Clerk Native API, register `com.randycodex.permitext` as the Native Application, and confirm `webcredentials:clerk.permitext.com` resolves through the signed associated-domain configuration. Until that build setting exists, iOS deliberately retains the current native Sign in with Apple fallback instead of showing a nonfunctional multi-provider button.

## United States release boundary

- In App Store Connect, make Beta 1 available only in the United States territory.
- State the United States-only service boundary in the customer-facing Terms and purchase copy.
- Review Stripe tax, business-address, and customer-location settings for US sales before enabling the live Price.
- Confirm marketing and support do not invite customers in other countries during Beta 1. If the public web app must technically block non-US access rather than state a commercial restriction, add and test a separate geolocation enforcement layer before launch.

## Identity migration evidence

For an existing Apple account with saved work and Pro access:

1. Record the Permitext user ID, entitlement source, and representative saved Project IDs before migration.
2. Authenticate the existing Permitext session.
3. Sign in to Clerk with Apple and submit the Clerk session token using the authenticated linking path.
4. Confirm one resulting Permitext account, the same Projects and saved records, and the same entitlement.
5. Sign out and sign in through Google, then Microsoft, after linking those verified identities in Clerk.
6. Confirm every provider returns the same Clerk user and Permitext account.
7. Attempt an unverified or mismatched link and confirm that Permitext rejects it without changing either account.
8. Attempt to link two test accounts with distinct Pro ownership records and confirm a 409/support-resolution result while both accounts, purchases, and entitlements remain unchanged.

## Stripe lifecycle evidence

The August 28, 2026 local provider-simulated test-mode exercise covers authenticated Checkout creation, signed-event-only fulfillment, duplicate delivery, renewal, scheduled cancellation, failed invoices, partial and full refunds, provider cancellation, and delayed webhook delivery with zero paid provider calls. It found and fixed a defect where deletion of a fully refunded entitlement also deleted the only stale-event timestamp, allowing an older active event to restore Pro. Permitext now retains a durable per-subscription lifecycle cursor separately from the entitlement; terminal events win same-second ties, older and duplicate events are ignored, and cursor ownership cannot move between accounts. `npm run test:billing` retains the regression.

The provider-backed Stripe sandbox exercise on August 28, 2026 then covered a real sandbox Checkout, signed fulfillment, duplicate delivery, owner/mismatched-owner restore, scheduled and terminal cancellation, clock-driven renewal, failed invoice, partial and full refund behavior, and delayed-event recovery. It moved no real money and used only Stripe synthetic test data. The current Stripe `2026-06-24.dahlia` refund event omitted the older `charge.invoice` field; the first full-refund delivery therefore preserved Pro incorrectly. Permitext now resolves the invoice through the charge PaymentIntent and Stripe Invoice Payments API when the direct field is absent. Replaying the same signed provider event removed Pro and canceled the subscription. The contract suite retains that current event shape.

Detailed provider IDs, before/after states, cleanup, and credential boundaries are retained in [PERMITEXT_STRIPE_PROVIDER_SANDBOX_EVIDENCE_2026-08-28.md](./PERMITEXT_STRIPE_PROVIDER_SANDBOX_EVIDENCE_2026-08-28.md). The four exercise customers and test clock were deleted, all created subscriptions ended canceled or incomplete-expired, and the temporary CLI session was revoked. This is provider-created sandbox evidence, not production evidence.

For final provider evidence, use a dedicated production test account and a low-priced live test product approved for this exercise. Real charges and refunds require explicit approval immediately before execution.

Capture the Stripe event ID, Permitext user ID, subscription ID, entitlement before/after, and timestamp for:

1. New Checkout purchase grants Pro only after a signed provider event.
2. A duplicate Checkout or subscription event is idempotent.
3. Renewal extends the entitlement expiration.
4. Cancellation preserves access through the paid period.
5. `unpaid`, `canceled`, `paused`, or terminal expiration removes access.
6. A failed invoice does not invent a paid renewal and produces an operational warning.
7. A full refund removes the affected package; a partial refund does not automatically revoke it.
8. A delayed event older than the stored provider event does not overwrite newer entitlement state.
9. Restore succeeds only for the Permitext account that owns the Stripe subscription.

## Apple lifecycle evidence

Perform Sandbox and TestFlight exercises first, then one controlled production purchase only after approval. Capture the Apple notification UUID, original transaction ID, product ID, environment, signed date, Permitext user ID, and entitlement before/after.

The permanent local signed-payload exercise and its strict evidence boundary are recorded in [PERMITEXT_APPLE_LOCAL_LIFECYCLE_EVIDENCE_2026-08-28.md](./PERMITEXT_APPLE_LOCAL_LIFECYCLE_EVIDENCE_2026-08-28.md). It covers the same server routes with an ephemeral local trust chain and zero provider calls, but does not replace Apple-created Sandbox or TestFlight evidence.

### Prepared Sandbox/TestFlight staging guard

Apple documents that development-signed and TestFlight apps use the Sandbox environment, where test purchases do not charge real money. App Store Connect supports separate Production and Sandbox App Store Server Notification URLs. If the Sandbox URL is omitted, Apple sends Sandbox notifications to the Production URL; Permitext must not use that fallback because the Production server intentionally rejects Sandbox transactions.

The iOS backend URL now comes from the `PERMITEXT_BACKEND_API_BASE_URL` build setting. Release builds continue to default to `https://permitext-sync.vercel.app`, while an explicitly authorized TestFlight archive can override the setting with a dedicated staging URL.

Before any staging deployment or App Store Connect change, run:

```sh
cd permitext-sync-server
npm run verify:apple-sandbox-readiness
```

The verifier fails closed unless the environment is non-Production, Sandbox transactions are allowed, the HTTPS host is dedicated and non-Production, PostgreSQL and private Blob storage are explicitly isolated from Production, the Apple bundle and product identifiers match, Apple root-certificate pinning is enforced and configured, Clerk and approved policy versions are configured, paid Research turns remain disabled, the Research kill switch remains on, and no live Stripe secret is present.

The existing Vercel Preview environment is not eligible because it shares the Production database. Preparing this guard did not deploy staging, change App Store Connect, upload a build, create a transaction, deliver a notification, or write to a provider.

1. Purchase and restore bind the original transaction ID to exactly one Permitext account.
2. `DID_RENEW` extends access.
3. Turning off auto-renew does not remove prepaid access.
4. `DID_FAIL_TO_RENEW` without `GRACE_PERIOD` removes access; with `GRACE_PERIOD`, it keeps access only through `gracePeriodExpiresDate`.
5. An expired or missing grace-period deadline, `GRACE_PERIOD_EXPIRED`, `EXPIRED`, `REFUND`, and `REVOKE` remove the affected package.
6. `REFUND_REVERSED` restores an active transaction.
7. Duplicate notifications are idempotent and older delayed notifications cannot overwrite newer state.
8. Sandbox and Xcode transactions cannot grant production Pro.
9. An unowned notification receives a retryable error until the signed client transaction establishes ownership.
10. An account with active Stripe Pro cannot start a second Apple Pro purchase, and an account with active Apple Pro cannot start Stripe Checkout.

## Research turn-pack lifecycle evidence

Keep `PERMITEXT_RESEARCH_PAID_TURNS_ENABLED` disabled until every configured Stripe Price and App Store consumable has passed the applicable checks below. Pack sizes come from Permitext's server catalog; clients never submit an arbitrary credit quantity.

1. A successful Stripe payment-mode Checkout or verified Apple consumable transaction credits the authenticated Permitext account exactly once.
2. The Apple transaction's signed `appAccountToken` matches the stable token issued for that Permitext account.
3. Duplicate Stripe events, Apple transaction uploads, notification retries, and client recovery after a lost response do not grant duplicate turns.
4. Included turns are reserved first; purchased turns are reserved only after the monthly included allowance is exhausted.
5. A failed or canceled Research request releases its reservation. A completed answer debits a purchased turn exactly once in the same durable commit as the saved answer.
6. Full refunds and Apple `REFUND` or `REVOKE` add an idempotent reversal. Stripe partial refunds reconcile only the newly refunded fraction. Already-spent refunded credits create internal debt without removing the new month's included turns.
7. Account merge combines balances without duplicating provider purchases. Account deletion forfeits spendable turns while retaining a minimal purchase tombstone that prevents replay after recreation.
8. iOS finishes a consumable transaction only after the backend acknowledges the credit, and reprocesses unfinished transactions after relaunch or temporary network failure.
9. Sandbox and TestFlight exercises use a staging backend configured to accept Sandbox transactions; Production continues to reject Sandbox transactions.

## Research cost safeguards

Production Research fails closed unless all of these are configured:

- `PERMITEXT_RESEARCH_MAX_REQUEST_USD`
- `PERMITEXT_RESEARCH_USER_DAILY_CAP_USD`
- `PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD`
- `PERMITEXT_RESEARCH_DAILY_CAP_USD`
- `PERMITEXT_RESEARCH_MONTHLY_CAP_USD`
- Versioned input, cached-input, and output token prices

The initial Beta 1 values are:

```text
PERMITEXT_RESEARCH_MAX_REQUEST_USD=0.50
PERMITEXT_RESEARCH_USER_DAILY_CAP_USD=2
PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD=7
PERMITEXT_RESEARCH_DAILY_CAP_USD=10
PERMITEXT_RESEARCH_MONTHLY_CAP_USD=100
PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT=100
```

These are exposure ceilings, not spending targets. The $7 per-user monthly ceiling provides headroom above the $6.06 V6 p90 projection for 100 fully used turns. Review actual provider usage weekly and lower the request limit or disable Research before increasing the $100 system cap.

Beta readiness requires the per-user monthly value to equal exactly `$7.00`; it rejects both a lower value that cannot support the retained allowance and a higher value that exceeds the approved ceiling. See [PERMITEXT_BETA1_SEVEN_DOLLAR_GUARDRAIL_EVIDENCE_2026-08-28.md](./PERMITEXT_BETA1_SEVEN_DOLLAR_GUARDRAIL_EVIDENCE_2026-08-28.md).

The cost safeguards remain operational controls and must not be presented as customer-facing error messages. Before enabling paid continuation, configure:

```text
PERMITEXT_RESEARCH_PAID_TURNS_ENABLED=1
STRIPE_RESEARCH_TURNS_25_PRICE_ID=<live one-time Stripe Price>
STRIPE_RESEARCH_TURNS_100_PRICE_ID=<live one-time Stripe Price>
STOREKIT_RESEARCH_TURNS_25_PRODUCT_ID=<approved consumable product ID>
STOREKIT_RESEARCH_TURNS_100_PRODUCT_ID=<approved consumable product ID>
```

Do not enable the flag if either platform would show a pack that cannot be fulfilled and reconciled by the shared ledger.

`PERMITEXT_RESEARCH_KILL_SWITCH=1` immediately prevents new paid Research requests. Each accepted turn atomically reserves its maximum exposure before a provider call, and every provider request consumes that reservation using its declared output-token ceiling.

## Policy-version acceptance preparation

Production readiness also remains closed until counsel-approved policy versions are assigned stable identifiers:

```text
PERMITEXT_TERMS_VERSION=<approved version>
PERMITEXT_PRIVACY_VERSION=<approved version>
PERMITEXT_SUBSCRIPTION_POLICY_VERSION=<approved version>
```

Do not populate these variables with the current working drafts merely to pass readiness. The authenticated acceptance endpoint rejects stale versions, timestamps acceptance on the server, and preserves the accepted set in the Permitext account export. Final web/iOS consent presentation and activation remain release-stage work after counsel approval.

## Release evidence record

For every exercise, record:

- Release identifier and Git commit
- Deployment URL
- Provider environment and provider event identifiers
- Test Permitext account
- Expected and observed entitlement transition
- Cross-platform verification result
- Database evidence with secrets and personal data redacted
- Operator, timestamp, and rollback or cleanup performed

Public billing remains blocked if any required lifecycle has no production evidence, any configuration check fails, or the account-linking migration loses or duplicates data.
