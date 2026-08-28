# Permitext Stripe Provider-Backed Sandbox Evidence — August 28, 2026

## Scope and boundary

This is Stripe-created sandbox evidence against a local Permitext server. It used Stripe's synthetic test payment data and moved no real money. It did not use live-mode credentials, change a production Price, deploy, merge, enable Research turn packs, or authorize public billing. Production purchase/refund evidence remains open and requires immediate owner approval before any real charge.

The exercise used the existing sandbox Prices only:

- `price_1Tn5WmEp1wz0lmSdpRo0IDDz`: recurring $0 monthly Price for Checkout, cancellation, and clock-driven renewal evidence;
- `price_1TxWYUEp1wz0lmSdpAqWEpM0`: recurring $15 sandbox Price for synthetic partial/full refund and failed-invoice evidence.

## Results

### Checkout, entitlement, cancellation, duplicate, and delayed delivery

- Permitext user: `apple:stripe-provider-backed-20260828050144`
- Checkout Session: `cs_test_b1mSpjaCF0HgTEcxRNUDrFfnz5G8Fc4RgMPuJg6XslGGWEPj4ux7zJj525`
- Customer: `cus_V9b9bwkHHDWZNK`
- Subscription: `sub_1U9Hx2Ep1wz0lmSdglHxldvl`
- Subscription-created event: `evt_1U9Hx3Ep1wz0lmSdFgwAxYFn`
- Checkout-completed event: `evt_1U9Hx3Ep1wz0lmSdRJQD0xZt`
- Initial invoice-paid event: `evt_1U9Hx3Ep1wz0lmSdFTAFNDWq`
- Signed Stripe delivery granted Pro through `2026-09-28T05:03:39.000Z`; Checkout creation alone did not grant it.
- Replaying the same Checkout event returned `changed: false`.
- Scheduled cancellation event `evt_1U9HzKEp1wz0lmSdyjMtS2wp` preserved Pro through the paid period.
- Terminal cancellation event `evt_1U9HzLEp1wz0lmSdCuEFC5JB` removed Pro.
- Replaying the older subscription-created event after cancellation returned `changed: false` and did not restore Pro.

### Ownership and refunds

- Permitext user: `apple:stripe-provider-refund-1787893644982`
- Customer: `cus_V9bDCWxupUNYjX`
- Subscription: `sub_1U9I0gEp1wz0lmSdoSWW20PI`
- Charge: `ch_3U9I0gEp1wz0lmSd0d45I1sD`
- Subscription-created event: `evt_1U9I0jEp1wz0lmSdjgNUl8Fw`
- Restore by the owning account returned HTTP 200; restore by another Permitext account returned HTTP 403.
- Partial refund `re_3U9I0gEp1wz0lmSd0B5ZyUV6`, event `evt_3U9I0gEp1wz0lmSd0fwMmAGo`, preserved Pro.
- Final cumulative refund `re_3U9I0gEp1wz0lmSd0kPZbOkf`, event `evt_3U9I0gEp1wz0lmSd0f7yACUJ`, initially exposed a current-Stripe compatibility defect: API version `2026-06-24.dahlia` omitted the former `charge.invoice` field, so Permitext could not find the subscription invoice and did not remove Pro.
- Permitext now falls back from `charge.payment_intent` to Stripe's Invoice Payments API and requires one unambiguous invoice match. The permanent lifecycle contract uses this current event shape.
- Replaying the same real full-refund event after the repair returned HTTP 200 with `changed: true`, removed Pro, and left the provider subscription `canceled`.

### Renewal and invoice failure

- Test clock: `clock_1U9I5mEp1wz0lmSdTGMHGIBf`
- Renewal subscription: `sub_1U9I5nEp1wz0lmSdGKxcw9fu`
- Renewal event: `evt_1U9I5yEp1wz0lmSdx5QJ9Ok7`
- Advancing the Stripe test clock moved the entitlement expiration from `2026-09-28T05:12:41.000Z` to `2026-10-28T05:12:41.000Z`.
- Failed-invoice subscription: `sub_1U9I64Ep1wz0lmSdJ7910Mch`
- Failed-invoice event: `evt_1U9I66Ep1wz0lmSdM7LVAC3A`
- Stripe left that subscription `incomplete`; Permitext granted no entitlement and logged the event-specific operational warning.

## Cleanup and credential handling

- All four subscriptions created by this exercise ended `canceled` or `incomplete_expired`.
- Customers `cus_V9b9bwkHHDWZNK`, `cus_V9bDCWxupUNYjX`, `cus_V9bILuMNynHt0N`, and `cus_V9bIOXwgXs7h5P` were deleted.
- Test clock `clock_1U9I5mEp1wz0lmSdTGMHGIBf` was deleted.
- Existing sandbox subscriptions were not modified.
- The temporary Stripe CLI session reported that it logged out of all contexts and revoked the session. The pre-existing local Stripe CLI configuration file was restored byte-for-byte.
- A sandbox secret and restricted key that had been unintentionally exposed while inspecting the Dashboard were rotated/expired before the exercise. No exposed key was used.

## Verification boundary

This closes the provider-backed Stripe sandbox lifecycle item. It does not close the controlled live purchase/refund item, Stripe Tax configuration, production deployment, production webhook verification, Apple Sandbox/TestFlight billing, or public paid-release approval.
