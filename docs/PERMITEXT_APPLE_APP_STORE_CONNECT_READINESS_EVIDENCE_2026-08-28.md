# Permitext Apple Sandbox and TestFlight Readiness Evidence — August 28, 2026

## Scope and boundary

This record began with a read-only inspection of the owner's authenticated App Store Connect account and no-cost verification of Apple's published root certificates. With the owner's later approval, it now also records an isolated Apple Sandbox staging deployment, the dedicated Sandbox notification URL, staging-targeted TestFlight builds, and the first physical-iPhone Apple-created purchase and restore evidence. The TestFlight purchase was explicitly labeled for testing and created no real charge. Nothing was submitted for App Review, the Production notification URL and Production deployment were not changed, pricing was not changed, and no paid provider call was made.

## App Store Connect findings

| Item | Observed state |
| --- | --- |
| App | `permitext`, Apple ID `6774385434`, bundle ID `com.randycodex.permitext` |
| App version | iOS `1.0`, `Prepare for Submission`; no build is attached to the App Store submission |
| Subscription group | `permitext pro`, group ID `22140923`, one subscription |
| Subscription | `Permitext Pro Monthly`, Apple ID `6777744460`, product ID `com.randycodex.permitext.pro.monthly`, one-month duration, `Prepare for Submission` |
| Subscription availability | One of 175 countries or regions selected. This inspection did not open or change the selection, so the selected territory still needs explicit verification against the retained United States-only Beta scope. |
| Subscription options | Billing Grace Period is not configured; Streamlined Purchasing is on; Family Sharing is off |
| Subscription metadata | English display name exists. The description and review notes still describe the earlier save/export/sync feature set and do not state the approved 100-Research-turn allowance. A review screenshot is not present. These are submission-readiness issues, not prerequisites for an isolated Sandbox transaction exercise. |
| Server notifications | Production Server URL remains unset. Sandbox Server URL is `https://permitext-apple-sandbox.vercel.app/billing/apple/notifications`. |
| TestFlight | Staging-targeted builds 42–48 were uploaded from verified archives. Build 45 is `Complete`, `Ready to Submit`, and associated with Internal Testers, but its refund button did not present Apple's sheet on the physical iPhone. Build 46 contains the direct-StoreKit replacement and completed the Apple refund form and submission. Build 47 became available to the owner, was installed, and displayed Free for the already-refunded subscription. Build 48 contains the transient-verification identity-continuity repair, completed processing, was assigned to Internal Testers, and was installed by the owner. |
| Sandbox accounts | Dedicated United States test accounts exist. The original lifecycle tester completed the no-charge physical-iPhone purchase, restore, cancellation, expiration, and refund exercise. A five-minute renewal tester completed renewal and billing-failure/recovery exercises. After its accelerated subscription expired, a fresh tester configured for `Monthly renewal every hour` completed the build 48 purchase and identity-label acceptance described below. |

Build 41 predates the build-time staging-backend override and retains the Production backend. Builds 42–48 were archived with `PERMITEXT_BACKEND_API_BASE_URL=https://permitext-apple-sandbox.vercel.app`; they are intentionally Sandbox-evidence builds, not final Production release builds. The Apple-created lifecycle gate remains open for duplicate-delivery and delayed-delivery evidence.

## Isolated Apple Sandbox staging evidence

The owner authorized creation of an isolated no-cost staging environment. The resulting provider state is separate from Permitext Production:

| Item | Verified state |
| --- | --- |
| Vercel project | `permitext-apple-sandbox`, project ID `prj_81ZgJez2jeN9un5yZVJMQhJ3GvJj` |
| Vercel environment | `apple-sandbox`, environment ID `env_lWJa0VVvILVEuNxUMU6ayrg6OUpy`, type Preview |
| Deployment | `dpl_H87B75LADqeSc93AP9N3WksY9gjq`, repair commit `658c1264d6bcb57440e590d0bbf91b274e3b765d` |
| Public staging host | `https://permitext-apple-sandbox.vercel.app` |
| Database | Dedicated Neon resource `permitext-apple-sandbox-db`, Vercel resource ID `store_AMMH148rniT3zAjY`, Neon project `proud-mountain-82366605`, free plan, `iad1` |
| Blob | Dedicated private store `permitext-apple-sandbox-blob`, store ID `store_Ek7ns0ZW3BJZn2i3`, `iad1` |
| Guardrails | All 17 staging-readiness checks pass; paid Research turns are zero, the Research kill switch is on, root-pin enforcement is on, storage-isolation flags are on, and no Stripe secret or OpenAI key is present |
| Health | Public `/health` returned HTTP 200 with PostgreSQL storage, normalized-v4 schema, PostgreSQL rate limiting, Preview environment, and the exact release commit above |

The Blob credential differs from Production, and the isolated Neon and Blob resources are connected only to the dedicated staging project. The successful deployment verified the complete construction, zoning, enacted-code, and specialty-code content required by the application. Vercel authentication protection was disabled only for this separate staging project so the physical iPhone can reach it; Production protection and the Production deployment were not changed.

## Builds 42–48 archive and upload evidence

Build 42 established the isolated archive path. Build 43 repaired a Release-only stale debug-backend override and presented the working App Store subscription sheet. Build 44 added fail-closed Sandbox account linking only when the embedded backend is exactly `https://permitext-apple-sandbox.vercel.app`; Production and lookalike hosts remain ineligible. The complete entitlement/sync contract suite passed 111 tests with zero failures before the build 44 commit `24717d609`.

Build 44 archived successfully with Xcode 27.0 (`27A5252f`). Before upload, the archived application was inspected and confirmed as version `1.0`, build `44`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. The upload reported `Upload succeeded` and `** EXPORT SUCCEEDED **`; App Store Connect subsequently reported `Complete`, `Ready to Submit`, and association with Internal Testers.

Build 45 adds `Request Refund from Apple` only when Permitext has a verified active Apple Pro transaction. The complete entitlement/sync suite passed 112 tests with zero failures. Before upload, the archive was inspected and confirmed as version `1.0`, build `45`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. The upload reported `Upload succeeded` and `** EXPORT SUCCEEDED **`; App Store Connect reports build 45 `Complete`, `Ready to Submit`, and assigned to Internal Testers. On a physical iPhone with an active no-charge Sandbox Pro subscription, however, tapping `Request Refund from Apple` produced neither Apple's sheet nor an in-app message. No refund request was submitted, and build 45 fails physical presentation acceptance.

Build 46 replaces the failed sheet binding with StoreKit's direct `Transaction.beginRefundRequest(for:in:)` presentation against Permitext's foreground-active `UIWindowScene`. It also adds an explicit no-window error and makes the visible capsule the full tap target. The complete entitlement/sync suite passed 112 tests with zero failures in the isolated result bundle `Test-permitext-2026.08.28_22-48-13--0400.xcresult`. Before upload, the clean archive was inspected and confirmed as version `1.0`, build `46`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. The compiled app contains the request label plus submitted and presentation-failure messages. The upload reported `Upload succeeded` and `** EXPORT SUCCEEDED **` at approximately `2026-08-28 11:11:39 PM EDT`; Apple accepted the package, made it available in TestFlight, and the owner installed it.

Build 48 packages commit `04aec83126fe21ac9086527fb3911acd9f2aad95`, which preserves the explicit Sandbox/TestFlight identity only for a linked, active Apple Sandbox entitlement during a transient backend-verification failure. Ownership conflicts, expired sessions, inactive entitlements, Production transactions, and non-Apple billing remain fail-closed. The complete entitlement/sync suite passed 113 tests with zero failures in `Test-permitext-2026.08.29_14-24-35--0400.xcresult`. Before upload, the clean archive was inspected and confirmed as version `1.0`, build `48`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`; the compiled repair marker was present. Apple accepted upload record `443a851d-5987-456f-b890-ee6eefdeec78` at approximately `2026-08-29 2:34:08 PM EDT`. App Store Connect then reported build 48 `Complete`, `Ready to Submit`, and associated with Internal Testers, and the owner installed it.

These archive observations prove configuration and upload acceptance. The following section separately records the physical-device and Apple-created evidence. Neither is Production release evidence or an App Review submission.

## Physical-iPhone purchase, ownership, and restore evidence

On build 43, the dedicated Sandbox tester opened Apple's TestFlight purchase sheet for `Permitext Pro Monthly` at `$20.00 per month`. The sheet explicitly stated that it was for testing purposes and that confirming would not create a charge. After confirmation, Permitext displayed `Pro (Test)` as active, identified billing as `Apple subscription (Sandbox/TestFlight)`, showed the signed-in Permitext account as synced, and showed all 100 included Research turns available.

Apple delivered a real Sandbox notification to `/billing/apple/notifications` at `2026-08-29T00:14:02.610Z`. Staging returned HTTP 503 because build 43 had authorized the transaction only on-device and had not yet bound the original transaction to the Permitext account. The server failed closed and requested a retry rather than granting an unowned entitlement. This was a material integration defect, not a failed or charged purchase.

Build 44 repaired that gap without expanding Production behavior. After the owner installed build 44 and selected Restore Purchases with the same Sandbox tester, Permitext restored the existing transaction without another purchase. The staging backend received four concurrent `POST /billing/apple/transactions/verify` requests at approximately `2026-08-29T00:38:15Z`; all returned HTTP 200. This is provider-backed evidence that the Apple transaction is now bound to the signed-in Permitext staging account. No real charge, new purchase, Production write, or App Review submission occurred.

Apple retried the original failed notification at approximately `2026-08-29T01:13:31Z`, almost exactly one hour after the HTTP 503, and staging returned HTTP 200. After the owner disabled automatic renewal for the Sandbox subscription, Apple delivered another notification at approximately `2026-08-29T01:15:47Z`; staging also returned HTTP 200. The route log does not expose the signed notification type, so this record does not claim an independently decoded type for the second delivery. The owner then force-closed and reopened build 44; Permitext still displayed `Pro (Test)` as active, confirming cancellation did not revoke access before period end. App Store Connect shows this tester renews monthly subscriptions every hour. Purchase presentation, no-charge confirmation, on-device Pro activation, the 100-turn allowance, authenticated ownership binding, Restore, failed-delivery retry, post-cancellation notification delivery, and cancellation-period access retention passed at this stage. Expiration, renewal, billing-failure/recovery, refund, duplicate-delivery, and delayed-delivery were still open.

At `2026-08-29T02:14:04Z` (`2026-08-28 10:14:04 PM EDT`), Apple delivered another notification to `/billing/apple/notifications` and isolated staging returned HTTP 200. The owner then confirmed on build 44 that Free was the active plan. This passes the canceled-subscription expiration case at both provider-delivery and physical-device layers: Pro access did not survive the paid Sandbox period. At this stage, renewal, billing-failure/recovery, refund, duplicate-delivery, and delayed-delivery were still open; the later build 47 result closes refund revocation.

On build 46, Apple's first refund-sheet load returned `Cannot Connect`. After refreshing the same Sandbox tester under Settings > Developer, the Apple-controlled `Request Refund [TestFlight]` form loaded for `Permitext Pro Monthly`, displayed the no-charge TestFlight purchase and Sandbox account, accepted the selected reason, and displayed `Your request has been submitted`. This passes native refund-form presentation and request submission. Isolated staging returned HTTP 200 for four Apple notification requests at approximately `2026-08-29T03:39:29Z`, `03:41:48Z`, `03:42:41Z`, and `03:42:59Z`; route logs intentionally do not expose signed notification contents, so the exact type of each request is not claimed from logs alone. After a force-close/relaunch, four `/billing/apple/transactions/verify` requests returned HTTP 200 at approximately `03:47:56Z`–`03:47:57Z`, but the iPhone still displayed `Pro (Test)`.

The failed physical revocation exposed two source defects. First, `/billing/apple/transactions/verify` could persist an older active transaction after a newer Apple notification had removed the entitlement. Second, the iOS backend-verification path did not clear its cached Pro entitlement when the server returned no entitlement. The repair compares Apple's signed transaction date with the persisted notification date, makes the newer notification authoritative, prevents the PostgreSQL claim from racing that cursor, and applies a nil backend response before iOS resolves its StoreKit snapshot. `npm run test:billing` retains a purchase → refund → stale relaunch-verification regression, rejects a mismatched-account replay without disclosing entitlement data, and proves that the stale replay remains Free while a genuinely newer repurchase can activate Pro; it made zero paid provider calls. The complete isolated iOS entitlement/sync suite passes 112 tests with zero failures in `Test-permitext-2026.08.29_00-02-13--0400.xcresult`.

Commit `658c1264d6bcb57440e590d0bbf91b274e3b765d` is now deployed only to the isolated `permitext-apple-sandbox` project. The stable Sandbox host returns HTTP 200 with PostgreSQL storage and identifies that exact commit; Production was not deployed or reconfigured. A clean build 47 archive succeeded and was independently verified as version `1.0`, build `47`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. After the owner signed back into Xcode Apple Accounts, the same archive was exported and uploaded without rebuilding. Apple created build-upload record `30c6f0ce-bdc7-4fd3-a324-77e07c82dbf8`, accepted the complete package at approximately `2026-08-29 6:50:28 AM EDT`, reported no upload errors, and moved it to `PROCESSING`; Xcode reported `Upload succeeded`. Build 47 then became available in TestFlight, the owner installed it, avoided a new purchase and Restore, and reported Free on the physical iPhone at approximately `2026-08-29 7:01 AM EDT`. This passes the previously open refund-revocation case: an older active transaction no longer re-grants Pro after Apple's newer refund state, and the iOS cache no longer keeps the old Pro display.

A new dedicated United States Sandbox tester was configured for `Monthly renewal every 5 minutes` and completed a new no-charge build 47 purchase. Apple's confirmation sheet succeeded, but Permitext initially displayed `Apple confirmed the purchase, but Permitext could not link it yet: Internal server error`. Isolated logs recorded HTTP 500 from `/billing/apple/transactions/verify` and a PostgreSQL out-of-range value for Apple's millisecond signed date. Commit `c1858dbe60adf9589a3cc762a2fa4c237ecaee79` explicitly casts both transaction signed-date parameters to `BIGINT` and retains that requirement in `tests/billing-contract.mjs`; `npm run test:billing` passes with zero paid provider calls. The fix was deployed only to isolated staging. After a force-close and relaunch, build 47 displayed `Pro (Test)` and staging returned HTTP 200 for the replayed transaction verifications without another purchase or Restore. Apple delivered a server notification at `2026-08-29 2:00:27 PM EDT` and received HTTP 200. After the five-minute initial period had elapsed, another force-close and relaunch produced additional HTTP 200 verifications and the iPhone still displayed `Pro (Test)`. This passes the no-charge Sandbox renewal case. The exact signed notification type is not claimed from route logs alone.

The same five-minute tester was then used for the billing-failure/recovery case. With `Allow Purchases & Renewals` disabled, the physical iPhone resolved to Free. After the setting was re-enabled, Apple restored an active entitlement and the app recovered Pro access. Build 47 briefly degraded the explicit Sandbox identity to plain `Pro` when a final verification attempt received HTTP 429. That did not revoke access, but it exposed an evidence-label continuity defect. Commit `04aec83126fe21ac9086527fb3911acd9f2aad95` now retains `Pro (Test)` only for a previously linked active Apple Sandbox entitlement across transient verification failures; the 113-test entitlement/sync suite retains the fail-closed boundaries. This completes billing failure/recovery while treating the identity-label defect as a separate repaired acceptance issue.

After Apple's accelerated Sandbox renewal cycle ended, the five-minute tester correctly resolved to Free on build 48. Its expired local StoreKit queue did not immediately permit another purchase; Permitext displayed `The App Store is still clearing an expired subscription. No charge was made.` rather than claiming success. A fresh United States Sandbox tester configured for hourly monthly renewal then completed a no-charge build 48 purchase. Isolated staging returned HTTP 200 for three `/billing/apple/transactions/verify` requests at approximately `2026-08-29 6:14:51 PM EDT`–`6:15:03 PM EDT`, and the owner explicitly confirmed that the physical iPhone displayed `Pro (Test)`. This passes the build 48 identity-continuity acceptance at both the device and transaction-verification layers. The associated `/billing/apple/notifications` delivery at approximately `6:14:49 PM EDT` received HTTP 503, which intentionally requests an Apple retry; until that retry is observed and identified with sufficient evidence, it remains pending delayed-delivery evidence rather than a pass.

## Official Apple environment and notification behavior

Apple documents that development-signed and TestFlight apps use the Sandbox environment and that Sandbox purchases do not charge real money. App Store Connect supports separate Production and Sandbox notification URLs. If the Sandbox URL is omitted, Sandbox notifications fall back to the Production URL. Permitext must configure a dedicated Sandbox URL only after the isolated staging backend exists; it must not route test notifications to Production.

Sources:

- [Testing in-app purchases with Sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox)
- [Enter server URLs for App Store Server Notifications](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications)

## Verified Apple PKI roots

Apple's JWS documentation specifies a three-certificate `x5c` chain ending in an Apple root and directs developers to the Apple PKI page. Apple's maintained server-library documentation recommends loading the root certificates from the Apple PKI root-certificate section. On August 28, 2026, the three official DER certificates were downloaded directly from Apple and independently inspected with OpenSSL.

| Official certificate | SHA-256 fingerprint | Valid through |
| --- | --- | --- |
| [Apple Root CA](https://www.apple.com/appleca/AppleIncRootCertificate.cer) | `B0:B1:73:0E:CB:C7:FF:45:05:14:2C:49:F1:29:5E:6E:DA:6B:CA:ED:7E:2C:68:C5:BE:91:B5:A1:10:01:F0:24` | February 9, 2035 |
| [Apple Root CA - G2](https://www.apple.com/certificateauthority/AppleRootCA-G2.cer) | `C2:B9:B0:42:DD:57:83:0E:7D:11:7D:AC:55:AC:8A:E1:94:07:D3:8E:41:D8:8F:32:15:BC:3A:89:04:44:A0:50` | April 30, 2039 |
| [Apple Root CA - G3](https://www.apple.com/certificateauthority/AppleRootCA-G3.cer) | `63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79` | April 30, 2039 |

The staging-readiness guard now requires this complete normalized fingerprint set rather than accepting an arbitrary SHA-256-shaped value.

Sources:

- [Apple JWS decoded-header certificate-chain requirements](https://developer.apple.com/documentation/appstoreserverapi/jwsdecodedheader)
- [Apple PKI root certificates](https://www.apple.com/certificateauthority/)
- [Apple App Store Server Node.js Library](https://github.com/apple/app-store-server-library-node#obtaining-apple-root-certificates)

## Remaining safe sequence

1. [x] Create an isolated non-Production database, private Blob store, and staging deployment.
2. [x] Run `npm run verify:apple-sandbox-readiness` and require every check to pass.
3. [x] Archive and upload staging-targeted builds through build 48 with `PERMITEXT_BACKEND_API_BASE_URL` pointing only to the isolated staging host.
4. [x] Set only App Store Connect's Sandbox Server URL to the staging `/billing/apple/notifications` endpoint and leave the Production URL unchanged.
5. [x] Confirm build 46 completes processing, is available in TestFlight, and installs on the physical iPhone.
6. [x] Sign into Xcode Apple Accounts and upload the already-verified staging-targeted build 47; Apple accepted the package and began processing it.
7. [x] Confirm build 47 becomes available in TestFlight, install it, do not purchase or Restore, and confirm that the already-submitted Sandbox refund resolves to Free on the physical iPhone. The backend repair is live only on isolated staging.
8. [x] Install build 48 and confirm that a fresh no-charge Sandbox purchase remains explicitly labeled `Pro (Test)` after HTTP 200 backend transaction verification.
9. [ ] Complete the remaining physical-iPhone lifecycle. Purchase, ownership binding, Restore, failed-delivery retry, post-cancellation notification delivery, cancellation-period access retention, canceled-period expiration, refund-form submission, refund revocation, renewal, and billing failure/recovery pass. Duplicate delivery and delayed delivery remain.

The remaining exercise uses Apple's Sandbox and must create no real charge. A controlled Production purchase remains a separate approval gate.
