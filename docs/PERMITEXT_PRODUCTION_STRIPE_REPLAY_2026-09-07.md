# Production Stripe replay and customer cleanup — September 7, 2026

The original completed live Checkout event was resent after its subscription
had been fully refunded/canceled and its Permitext account deleted.
Production received the request with HTTP 200. Independent before/after
account exports confirm that it did not recreate the account, entitlement or
content. This completes the previously unperformed live delayed/duplicate
delivery check within the original disposable-account lifecycle.

The remaining disposable Stripe customer was then deleted, with Stripe's
HTTP 200 deletion log, deletion event and exact-URL reload confirming completion.
Both previously open non-charge billing checks are complete for this lifecycle.
Final shared-release binding remains open. No new purchase, subscription,
refund, Research turn or account recreation was initiated.

## Exact target and serving source

- Serving commit verified through canonical `/health`:
  `5f1afb414fdd51e74c59a28c7e279d3ef10b74d9`.
- Production deployment: `dpl_CJenPVvz6HfNHV5N7RkNkVq9gU15`.
- Storage reported by health: PostgreSQL.
- Historical Permitext account SHA-256:
  `40d69e0c70327dd27e27eb71d2089a380c56be725d6648160a7732a9c13249e0`.
- Event type: `checkout.session.completed`.
- Event identifier SHA-256:
  `3324895e2937a92ef490fee25ad63ab8d77d99d8de701d51105f3969d4b8be47`.
- Original event/delivery shown by Stripe: `2026-09-02T23:36:52Z`.

Stripe's live dashboard showed the one original $21.78 test payment fully
refunded and its subscription canceled/ended at September 2, 7:44 PM EDT.
Subscription metadata matched the exact historical account hash recorded in
the [September 2 deletion record](./PERMITEXT_BETA1_PRODUCTION_ACCOUNT_DELETION_2026-09-02.md).
The event showed live mode, subscription mode, paid payment status and that
same account reference. No raw account, customer, subscription, event, payment
or billing-address identifiers are retained in this repository record.

## Observed replay and independent result

1. At `2026-09-07T17:21:32.599Z`, the Production operator export returned
   HTTP 200 for the exact historical target. Account and entitlement were
   absent; all 25 exported record groups were empty.
2. Stripe Workbench's **Resend** control was used once for the original
   Checkout event and its existing `https://permitext.com/billing/stripe/webhook`
   destination. This is provider redelivery of the historical event, not an
   unsigned fabricated payload or a new Checkout.
3. The independent Vercel request log records one matching Production
   `POST /billing/stripe/webhook` at `2026-09-07T17:22:13.478Z`, HTTP 200,
   on the exact deployment above.
4. At `2026-09-07T17:25:02.563Z`, another operator export returned HTTP 200.
   Account and entitlement remained absent. All 25 record groups were empty
   and deeply equal to the before snapshot.
5. After refreshing Stripe Workbench, the same event showed **Delivered**,
   **Retried manually**, at `2026-09-07T17:22:15Z`. Opening that delivery
   showed HTTP 200 and response body `{"received":true,"changed":false}`.
   This independently confirms the provider identity and inert result in
   addition to the Vercel log and backend export.

The event was already delivered successfully on September 2 and was replayed
roughly five days later, after the terminal lifecycle. Stripe documents
[manual event redelivery from Workbench](https://docs.stripe.com/webhooks#manual-retries).
The application's webhook handler verifies Stripe signatures and live mode
before handling this event type; its current account-existence guard prevents
an old subscription event from recreating a deleted account.

Private receipts under `/private/tmp/permitext-stripe-replay-20260907/`:
`before-private.json`, `after-first-replay-private.json`,
`runtime-delivery-private.jsonl`, and `first-replay-receipt-private.json`.
The later `verified-replay-receipt-private.json` and
`completed-billing-closeout-private.json` add the independently inspected
provider delivery response and customer cleanup. The runtime log file SHA-256 is
`864ded503f0d2543573ff10fbd2c232359d7723ccf2fc69485a230554cf90711`.
The private receipt binds the raw event identifier to the public hash and
records the independent comparisons.

## Customer cleanup

The exact Stripe customer was reached through the original payment and
subscription. Its pre-deletion page showed one canceled subscription, no
future invoices, the original fully refunded payment/invoice, no active
entitlements, no pending invoice items and no invoice balance. The owner's
standing instruction to perform the recommended remaining cleanup covered
this disposable account; the exact target and consequences were reviewed
before the final deletion control was used.

Stripe's dialog disclosed permanent removal of the customer's billing
information and retention of historical payments/invoices. No current
subscription needed cancellation. The deletion completed with an HTTP 200
`DELETE /v1/customers/…` log at `2026-09-07T17:31:14Z`; Stripe recorded the
customer-deleted event at `2026-09-07T17:31:13Z`. Reloading the original
customer URL showed **This customer account has been permanently deleted.**

A final Production account export at `2026-09-07T17:32:25.912Z` again
confirmed absent account/entitlement and the same 25 empty record groups.
Receipt: `after-customer-deletion-private.json`, alongside the completed
billing closeout receipt. This is Stripe customer-profile cleanup, not a
claim that Stripe erased its retained historical financial records.

## Remaining limits

This single live replay covers a deleted account after the original refund.
It does not add new active-account monetary lifecycle evidence, every event
ordering permutation, or final web/TestFlight candidate acceptance. Retain
the existing provider-backed sandbox and billing contracts for their broader
ordering/concurrency coverage. No repeat real charge is required by this result.
