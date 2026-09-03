# Permitext Beta 1 Production Stripe lifecycle evidence — September 2, 2026

Status: **PASSED FOR THE CURRENT PRODUCTION RELEASE — final-release binding remains open; account deletion was exercised separately with unresolved client/identity findings**

This record captures the owner-authorized controlled Production purchase, cancellation, full refund, webhook, and entitlement exercise. It retains only aggregate amounts, timestamps, release identifiers, and outcomes. It intentionally excludes the test account's name and email, billing address, card data, Stripe customer/payment/subscription/session identifiers, and raw provider payloads.

## Bound release

- Git commit: `cb7918b453988a07d57a7834f5982d523d0e3901`
- Vercel Production deployment: `dpl_2i2iRQjwqkuQaQChbzR5MGh6j8EW`
- Canonical origin: `https://permitext.com`
- Exercise window: `2026-09-02T23:36:49Z` through `2026-09-02T23:44:06Z`
- Account: dedicated authenticated Permitext account that showed Free before Checkout

## Observed lifecycle

1. The owner separately authorized the real controlled charge and later authorized cancellation plus a full refund.
2. Production Checkout displayed Permitext Pro at `$20.00` per month, calculated New York sales tax at `8.875%` (`$1.78`), and charged `$21.78` total.
3. The owner entered payment and billing information privately and personally submitted the purchase. No payment credential or address was read into or retained by this record.
4. Permitext's confirmation and Account surfaces showed Pro active with `100` included Research turns.
5. The Stripe Customer Portal accepted cancellation. Before the refund, the portal represented access as scheduled through the prepaid monthly period.
6. Stripe accepted the owner-authorized full `$21.78` refund as customer-requested.
7. Permitext's full-refund webhook path terminated the Stripe subscription immediately, and Stripe showed the subscription as ended with the refunded invoice.
8. The Permitext account returned to Free after the refund.

## Webhook and runtime evidence

- Three purchase-related `POST /billing/stripe/webhook` requests returned HTTP 200 at `23:36:49Z`–`23:36:50Z`.
- `POST /billing/web/portal` returned HTTP 200 at `23:40:13Z`.
- Four cancellation/refund-related `POST /billing/stripe/webhook` requests returned HTTP 200 at `23:41:47Z`, `23:41:48Z`, `23:44:03Z`, and `23:44:06Z`.
- The inspected Production window contained no runtime error associated with the exercise.
- Stripe's final payment view showed `$21.78 Refunded`; its final subscription view showed `Canceled`, `Ended`, and the refunded `$21.78` invoice.

## Identity boundary

Stripe Link initially offered a previously saved Link payment identity whose email differed from the signed-in Permitext account. The exercise switched to the non-Link payment path. Permitext subscription ownership remained bound to the authenticated opaque Permitext account identifier through Checkout client reference and metadata; billing email was not treated as the entitlement owner. No email address is retained here.

## Acceptance and remaining limits

The controlled real-money path passed for the exact Production release above: taxed Checkout, one intended Pro grant, 100-turn allowance, portal cancellation, full refund, immediate terminal subscription state, Free entitlement restoration, and successful webhook processing. This satisfies the required real taxed-Checkout/refund exercise; another paid Beta 1 charge is not required unless later billing code or Production configuration materially changes.

The public-release gate remains open because it is bound to the eventual final web/backend and TestFlight commit. A deliberate duplicate/delayed live-event replay was not performed, and the Stripe customer was not deleted in this exercise; those behaviors remain covered by the permanent provider-backed sandbox and source contracts. The disposable Permitext account was later deleted and verified independently in `PERMITEXT_BETA1_PRODUCTION_ACCOUNT_DELETION_2026-09-02.md`, but that separate gate remains open because of client Workboard scoping, Clerk identity, representative-data, and operator-export findings. This exercise also does not prove fresh/existing authentication across every supported provider, Research execution, spend-control delivery, final TestFlight processing, physical-iPhone behavior, bank settlement timing for the refund, tax filing, or public-Beta approval.
