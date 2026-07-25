# Permitext Firm Billing Decision Brief

**Decision status:** Recommended implementation contract; pricing and legal/tax
review remain owner decisions.

**Scope:** Centralized billing for Permitext organizations. This brief does not
change the existing individual Pro or Research purchase paths and does not
authorize client-side simulation of payment operations.

## 1. Recommendation

Use **Stripe Billing with Stripe-hosted Checkout, Invoicing, Customer Portal,
and Stripe Tax** for the initial firm product. Permitext remains the merchant of
record. Do not build custom card collection, invoice arithmetic, tax-rate logic,
or a client-owned subscription state machine.

Represent a firm subscription as one Stripe Customer and one organization
subscription with a licensed per-seat quantity. Keep Research as either a
separate organization subscription item or an explicitly included plan
capability; do not infer it from the base seat price.

This is the smallest extension of Permitext's current verified Stripe
subscription and server-entitlement architecture. Stripe supports licensed
per-seat quantities on a single recurring invoice, subscription invoices,
quantity changes with proration previews, and hosted quantity management.

Primary references:

- [Stripe per-seat quantities](https://docs.stripe.com/billing/subscriptions/quantities)
- [Stripe subscription changes and proration previews](https://docs.stripe.com/billing/subscriptions/change)
- [Stripe subscription invoices](https://docs.stripe.com/billing/invoices/subscription)
- [Stripe Customer Portal configuration](https://docs.stripe.com/customer-management/configure-portal)

## 2. Platform boundary

### Web

The organization Owner may:

- Start firm checkout.
- Review the exact plan, billing interval, seat quantity, tax, and total before
  confirming.
- Buy additional seats.
- Schedule a seat reduction.
- Open the Stripe Customer Portal.
- Download invoices and receipts.
- Cancel renewal.

Every mutation originates on the server. The browser may request an operation
and display its result, but it must not directly set billing identity, provider
status, paid-through dates, seat quantity, or capabilities.

### iOS

The iOS app may let members sign in and use a firm subscription previously
purchased by their organization. It must not present a simulated firm checkout
or claim that changing membership changes the provider invoice.

Individual or consumer access remains subject to StoreKit requirements. Apple's
current rules distinguish multiplatform services and enterprise services:
multiplatform features purchased on the web generally must also be available as
in-app purchases, while an app sold directly only to organizations for employees
or students may allow access to previously purchased enterprise service.
Permitext should describe the firm product clearly in App Review notes and
re-review storefront-specific purchase-link rules before every App Store release.

Reference: [Apple App Review Guidelines, section 3.1](https://developer.apple.com/app-store/review/guidelines/).

## 3. Seat contract

Use these terms consistently:

- **Purchased seats:** Stripe licensed quantity; the billing authority.
- **Occupied seats:** Active organization memberships.
- **Reserved seats:** Pending invitations that Permitext counts against the
  purchased quantity.
- **Available seats:** Purchased minus occupied minus reserved.

Membership and billing are intentionally separate:

- Inviting, revoking, deactivating, or removing a member never changes the
  Stripe quantity automatically.
- An invitation is rejected when no purchased seat is available.
- Buying seats is an explicit Owner billing action.
- Reducing purchased seats is rejected while the requested quantity is below
  active plus pending seats.

### Increasing seats

1. The Owner requests a new quantity.
2. The server fetches the current Stripe subscription.
3. The server previews the exact proration and tax.
4. The Owner confirms that preview.
5. The server submits an idempotent pending update that invoices immediately.
6. Permitext increases the organization seat limit only after Stripe confirms
   payment and the canonical subscription quantity.

Do not grant seats merely because the update request was accepted.

### Reducing seats

Default reductions to the next renewal date and do not issue an automatic cash
refund. Keep the currently purchased capacity through the paid-through date.
Allow an immediate reduction only through an owner-support workflow that records
the credit or refund decision.

Stripe documents that changing a subscription quantity can create prorations
and recommends previewing billing impact; pending updates can prevent a change
from taking effect when the new invoice is not paid.

## 4. Tax

Enable Stripe Tax only after Permitext's legal entity address, default product
tax code, price tax behavior, and required registrations are configured.

Checkout and invoices must collect enough customer location data to calculate
tax and support business tax IDs. Permitext must:

- Monitor economic-nexus and other registration thresholds.
- Register before collecting tax in a jurisdiction.
- Store Stripe Customer, Tax ID, Invoice, and registration references, not
  copied card data.
- Reconcile refunds and credit notes in tax reporting.
- Assign filing and remittance to a named owner or filing partner.

Stripe Tax calculates tax only for configured registrations; Permitext remains
responsible for determining where it must register, file, and remit.

Primary references:

- [Stripe Tax](https://docs.stripe.com/tax)
- [Tax registrations](https://docs.stripe.com/tax/registering)
- [Invoice tax calculation](https://docs.stripe.com/invoicing/taxes)
- [Tax filing and remittance](https://docs.stripe.com/tax/filing)

An accountant or tax attorney should approve the initial taxability and
registration matrix before live firm checkout. Stripe configuration is not a
substitute for that decision.

## 5. Subscription state and access

Stripe is the financial authority. Permitext is the product-access authority,
but its entitlement must be derived from a recently verified provider state.

Recommended mapping:

| Stripe state | Permitext firm behavior |
| --- | --- |
| `trialing`, `active` | Full paid capabilities |
| `past_due` | Seven-day grace period; show Owner billing warning |
| `incomplete` | Do not grant new firm capabilities |
| `unpaid`, `paused` | Read-only Project access and exports; disable new paid actions |
| `canceled` before paid-through date | Keep access through the paid-through date |
| `canceled` after paid-through date | Thirty-day read-only/export window; no automatic deletion |

The grace and read-only periods are Permitext product policy, not provider
defaults. They must be displayed in the firm terms and implemented
server-side. Retention remains policy-only until deletion and legal-hold
behavior receives separate review.

Cancellation should default to end-of-period. Stripe supports Customer Portal
cancellation and documents the different consequences of immediate versus
period-end cancellation:
[Stripe subscription cancellation](https://docs.stripe.com/billing/subscriptions/cancel).

## 6. Refunds, credits, and disputes

Initial policy recommendation:

- No automatic prorated cash refund for voluntary seat reductions or
  end-of-period cancellation.
- Duplicate charges and confirmed billing errors receive a full corrective
  refund.
- Other refunds require an explicit owner-support decision and a recorded
  reason.
- A finalized invoice adjustment uses a Stripe credit note; a cash return also
  uses the related refund operation.
- Revoking product access is not itself a refund, and a refund is not itself a
  deletion request.

Before launch, the owner must publish a short customer-facing refund policy and
confirm any mandatory statutory rights for the sales jurisdictions.

## 7. Webhooks and reconciliation

Webhook processing must be:

- Signature verified against the raw request body.
- Idempotent by Stripe Event ID.
- Safe when events are duplicated or delivered out of order.
- Transactional when updating the provider-event record, organization billing
  state, seat limit, and entitlement.
- Able to refetch the current Customer, Subscription, and Invoice before
  applying a consequential state change.
- Reconciled by a scheduled job that compares local active subscriptions with
  Stripe.

Stripe retries live webhook delivery for up to three days and does not guarantee
event order, so Permitext must never depend on one ordered event sequence:
[Stripe webhook delivery behavior](https://docs.stripe.com/webhooks).

## 8. Required audit record

Record an append-only administrative event for:

- Checkout created, completed, expired, or abandoned.
- Subscription created, renewed, changed, scheduled for cancellation, canceled,
  paused, or reactivated.
- Seat increase previewed, confirmed, paid, failed, or reversed.
- Seat reduction scheduled or applied.
- Invoice finalized, paid, failed, voided, or marked uncollectible.
- Credit note, refund, or dispute created or resolved.
- Tax location, exemption, or tax-ID status changed.
- Manual override or support action.

Each event should include:

- Permitext organization and acting user.
- Action and timestamp.
- Previous and new normalized billing state.
- Purchased-seat quantity before and after.
- Stripe Customer, Subscription, Invoice, Event, Credit Note, Refund, or
  Dispute IDs as applicable.
- Idempotency key or webhook Event ID.
- Human reason for a manual action.

Do not store card numbers, bank details, full webhook secrets, or unnecessary
tax documents in the Permitext audit record.

## 9. Launch gates

Firm checkout remains unavailable until all of the following pass:

1. Stripe test-mode checkout, renewal, seat increase, scheduled reduction,
   cancellation, payment failure, recovery, refund, and credit-note tests.
2. Duplicate and out-of-order webhook tests.
3. Exact local-to-Stripe quantity reconciliation.
4. Authorization tests proving only an active organization Owner can change
   billing.
5. Seat-limit tests covering active and pending members.
6. Tax-location, missing-address, tax-ID, and invoice-finalization failure tests.
7. Immutable billing audit-history tests.
8. Production monitoring and an operator runbook for failed invoices and
   webhook delivery.
9. Accountant or tax-attorney approval of the initial registration and
   taxability matrix.
10. App Store review of the final iOS firm-access language and purchase boundary.

## 10. Decisions still required from the owner

Before implementation begins, choose:

- Firm plan price and monthly/annual intervals.
- Minimum purchased seats, if any.
- Whether Research is included, separately priced per seat, or pooled.
- Trial availability and trial length.
- The final seven-day payment grace and thirty-day read-only periods.
- Published refund terms.
- Initial sales jurisdictions.
- Whether invoices may use `send_invoice` terms for approved firms or all first
  cohorts must pay automatically.

Until those choices are made, Permitext should keep its current
server-authoritative billing identity and non-client-mutable operation state,
without exposing firm payment actions.
