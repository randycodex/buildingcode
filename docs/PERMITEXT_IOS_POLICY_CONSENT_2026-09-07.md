# Permitext iOS policy consent — September 7, 2026

Status: **PARTIAL — physical consent control passed; expired Sandbox transactions block continuation**

## Scope

The designated account was independently matched by account-ID SHA-256
`d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`.
The physical Account sheet showed that identity, Free, Billing: None and Synced.
An independent `devicectl` app inventory freshly confirmed installed version
1.0 (63); this check did not install a newer build. Current web/backend Production
is `4048aa28e65b67ff8eecd9dc95ab76f861f7d680`.

## Observed result

- Upgrade opened the native Pro sheet with $20.00/month, no trial, renewal and
  cancellation information, and Terms, Privacy and Subscription/Refund links.
- Subscribe was disabled until the current-policy agreement switch was enabled.
- Continuing briefly displayed the Apple preparation state, then reported an
  expired subscription still being cleared and explicitly said no charge was made.
- Two bounded attempts before the Sandbox reset and the `18:16Z` reset retry
  produced that same blocker. An `18:19Z` retry was later found to precede
  completion of Sandbox sign-in and is not a refreshed-account result.
- After the owner completed sign-in, the exact Sandbox email was visually
  verified in Settings at `18:22Z`. A fresh policy-sheet attempt at `18:23Z`
  visibly entered Contacting Apple / Preparing the App Store purchase, then
  returned the expired-queue error.
- `devicectl` successfully terminated and relaunched the existing app. Free,
  Billing: None, the designated identity and Synced were verified afterward.
  The final bounded retry at `18:25Z` again entered preparation and returned
  the same error. Apple's confirmation sheet never appeared; no purchase was
  confirmed. The upgrade sheet was closed and further retries stopped.

Source inspection explains the boundary: `purchasePro` calls
`prepareForPurchase` before recording policy acceptance. The unfinished-transaction
drain retries finishing provably inactive transactions and requires an empty
inactive queue before continuing. Its finish barrier coalesces concurrent work;
it does not permanently suppress later attempts. No ownership or purchase guard
was weakened to obtain a pass.

The exact Production deployment's policy-acceptance log queries returned no
records for the initial attempt (`18:04:20Z`–`18:05:40Z`) and reset retry
(`18:14:00Z`–`18:16:30Z`), and verified-sign-in/clean-relaunch attempts
(`18:22:00Z`–`18:26:00Z`). This is consistent with the observed preflight failure;
the prior web acceptance does not prove an iOS request succeeded.

## Sandbox cleanup and remaining step

The owner identified the phone's Sandbox tester. Its email SHA-256 is
`9348e33f5f2f3e99eb0e232d2af189be36dd181333a6446db491c062058c55db`.
App Store Connect showed three testers and an August 30 last purchase for the
exact target. Only that row was selected, with Selected (1) displayed. The
Clear Purchase History confirmation explicitly applied to the selected Sandbox
test purchases and excluded real App Store customer purchases. The authorized
reset was confirmed and the UI returned to the tester list.

The list did not independently confirm backend cleanup completion. The owner
then signed out and back into that same account under Settings → Developer →
Sandbox Apple Account; the completed identity was visually verified. Normal
Apple Account and Media & Purchases settings were left alone. The error persisted
after both the verified sign-in and a clean app restart, so neither step is
claimed as a repair.

This follows Apple's [Sandbox account settings](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/)
and [Sandbox testing guidance](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).
Next isolate the old tester's transaction queue with a fresh Sandbox tester or
device-level StoreKit diagnostics before changing purchase logic. Repeating the
same reset/sign-in/Subscribe sequence without new evidence is not useful.
When continuation succeeds, cancel Apple's purchase sheet, verify the actual
iOS policy request and independently export the account.
Same-policy deduplication may correctly retain the original web acceptance;
it must not be relabeled as a new iOS record.

## Independent account integrity

Before export: `2026-09-07T18:04:25.285Z`.
After reset/retry export: `2026-09-07T18:16:31.834Z`.
Final after sign-in and clean restart: `2026-09-07T18:26:49.721Z`.

The exact account and its account fields were deeply unchanged. Entitlement
remained absent. All 24 content/usage record groups were deeply unchanged; the
separate session-metadata group differed only in `last_seen_at`. No Research
usage or purchase entitlement was added.

Private exports, the comparison receipt and bounded provider-log results are
retained outside the repository in the existing September 6 live-test folder.
The iOS consent gate and final shared-release binding remain open.
