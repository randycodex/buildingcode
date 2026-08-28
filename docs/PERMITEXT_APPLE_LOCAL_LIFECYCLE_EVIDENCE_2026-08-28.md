# Permitext Apple Local Subscription Lifecycle Evidence — August 28, 2026

## Result

The permanent local Apple subscription lifecycle exercise passes. It uses an ephemeral local ES256 certificate chain and signed App Store Server Notifications V2-shaped payloads against the real Permitext HTTP routes. It contacted no Apple service, created no App Store transaction, and moved no money.

Command:

```sh
cd permitext-sync-server
npm run test:billing
```

The Apple exercise reports:

- signed transaction verification and original-transaction ownership binding;
- renewal expiration extension;
- auto-renew disablement without early loss of prepaid access;
- durable ordering for notifications that do not change entitlement;
- duplicate and delayed-notification idempotency;
- immediate revocation when renewal fails without billing grace;
- billing-recovery restoration;
- grace-period access only through `gracePeriodExpiresDate`;
- revocation after grace expiration;
- refund revocation and active refund-reversal restoration; and
- `paidProviderCalls: 0`.

## Defects found and retained as regressions

1. `DID_FAIL_TO_RENEW` without `GRACE_PERIOD` previously preserved access when the embedded transaction carried a future expiration. Apple says service may stop when this notification has no grace-period subtype. Permitext now revokes the affected package unless an active signed grace-period deadline exists.
2. A known notification with no immediate entitlement change, such as `DID_CHANGE_RENEWAL_STATUS`, previously returned before persisting its `signedDate`. A delayed older terminal notification could then overwrite the newer subscription snapshot. Permitext now records the notification cursor while preserving the current entitlement, so older or duplicate deliveries remain inert.

These rules follow Apple's lifecycle and ordering guidance for [`notificationType`](https://developer.apple.com/documentation/appstoreservernotifications/notificationtype), [`signedDate`](https://developer.apple.com/documentation/appstoreservernotifications/signeddate), and [`notificationUUID`](https://developer.apple.com/documentation/appstoreservernotifications/notificationuuid).

## Evidence boundary

This is local cryptographic and HTTP-route evidence using a test-only trust chain. It verifies Permitext's validation, ownership, lifecycle, and persistence behavior without paid calls. It is not Apple-created Sandbox evidence, TestFlight evidence, production App Store evidence, or authorization to enable public billing.

The remaining Apple provider gate requires an Apple Sandbox/TestFlight account, App Store Connect notification configuration, a compatible staging backend that accepts Sandbox transactions, and capture of the real notification UUIDs and transaction identifiers listed in `BETA1_BILLING_IDENTITY_RUNBOOK.md`. A controlled production purchase remains separately approval-gated.
