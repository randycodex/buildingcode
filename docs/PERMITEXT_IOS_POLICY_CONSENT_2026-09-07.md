# Permitext iOS policy consent — September 7, 2026

Status: **PARTIAL — StoreKit beta failure identified; 11 expired transactions completed through Apple API; phone recheck pending**

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

## Physical StoreKit diagnosis and scoped cleanup — 20:34Z

After the owner limited work to App Store readiness and necessary web fixes,
the existing physical phone was available through CoreDevice and Mirroring.
The installed app was freshly confirmed as build **63**. Account showed the
designated test identity, Free, Billing: None and Synced. CoreDevice reports
**iOS 27.0, build 24A5408d**, rather than the simulator's iOS version.

One bounded preflight attempt was made with Console recording the physical
device's logs. At `16:34:23`–`16:34:24 -0400`, `storekitd` logged
`FinishTransactionRequest` for **11 exact Permitext TestFlight transaction IDs**,
repeated across the three existing cleanup passes. Both `storekitd` and the
Permitext process reported:

```text
Failed to encode request parameters (Never)
NSCocoaErrorDomain Code=3840
Error finishing transaction: requestEncodeFailed
StoreKitInternalError.requestEncodeFailed
environment: Optional("Testflight"), storefront: Optional("USA")
```

At `16:34:25.366323 -0400` the app logged the expired-subscription preflight
failure. The Apple purchase-confirmation sheet never opened. This identifies
failure inside Apple's transaction-finish request encoding, not a missing
Permitext JSON field or a policy-server rejection. An independently authored
[Apple Developer Forum report](https://developer.apple.com/forums/thread/842035)
describes the same error on iOS 27 beta; its replies are not an Apple-confirmed
fix. No purchase/ownership safeguard or product code was changed.

### Verified exact transaction targets

Apple's authenticated Sandbox Get Transaction Info endpoint returned HTTP 200
for all 11 IDs observed in the phone logs. Before any completion operation:

- Every signed JWS was cryptographically verified through its certificate chain
  to the exact Apple Root CA G3 fetched from [Apple PKI](https://www.apple.com/certificateauthority/).
  Root SHA-256: `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179`.
- Every payload matched the exact observed ID, Permitext bundle, Pro Monthly
  product and **Sandbox** environment. All 11 belong to one original transaction
  history, and all expired between **June 29 and July 9, 2026**.
- No active transaction, real Production purchase, account identity or unrelated
  transaction was included. Raw IDs, payloads and signed receipts remain private.

Apple documents a server-side [Finish Transaction](https://developer.apple.com/documentation/appstoreserverapi/finish-transaction)
operation. Under the owner's existing test-cleanup authorization, immediately
reverified all targets and called that Sandbox endpoint for those 11 transactions
only, between `2026-09-07T20:44:57.834Z` and `20:44:58.705Z`.
**All 11 returned HTTP 200.** No subscription purchase, refund, entitlement
grant, account deletion or normal Apple-account change was requested.

### Paused checkpoint

The owner requested completing the current task and pausing until later.
After the successful API cleanup, a single clean app relaunch was attempted for
the final phone check. CoreDevice rejected launch because the physical device
was **Locked** (`FBSOpenApplicationErrorDomain 7`). Mirroring had paused; its
ordinary Resume action did not establish a usable final checkout observation.
No further phone input or test item was requested.

**The API completion is verified; the phone's refreshed unfinished queue,
purchase-sheet access and native policy request are not yet verified.** On the
owner's next explicit resume, reopen build 63 and perform one no-purchase preflight
check; cancel Apple's confirmation sheet if it appears. Do not repeat the tester
history reset or change purchase logic without new evidence.

The purchase sheet was closed before relaunch was attempted. Console streaming
was stopped, and its temporarily enabled informational-message option was restored.
The test session remains retained. Private evidence is in
`/private/tmp/permitext-storekit-diagnostic-20260907/`: the exact observed targets,
signed API receipts, pinned-root verification summary, `finish-queue-receipt.json`,
and the bounded diagnostic scripts. No bearer token or private key was written.
The independent account exports remain in the existing live-test directory.

The independent before/after-cleanup account comparison at `20:48:56Z` confirms
the same account, unchanged account fields and saved mutations, no entitlement,
zero policy acceptances, and all 24 content/usage groups unchanged. Only session
metadata changed. Receipt: `account-integrity-after-finish.json` in the diagnostic
directory. The historical lost web consent was not fabricated or backfilled.
