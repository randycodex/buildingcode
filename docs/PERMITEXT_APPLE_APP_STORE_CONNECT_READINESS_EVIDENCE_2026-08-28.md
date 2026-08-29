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
| TestFlight | Staging-targeted builds 42–44 were uploaded from verified archives. Apple completed build 44 processing; it is `Ready to Submit`, expires in 90 days, and is associated with Internal Testers. Build 44 contains the isolated account-link repair and expanded subscription-button hit targets. |
| Sandbox accounts | Two United States test accounts exist. The dedicated `permitext+storekit1@gmail.com` tester completed the no-charge physical-iPhone purchase and restore exercise described below. Its App Store Connect subscription renewal rate is `Monthly renewal every hour`. |

Build 41 predates the build-time staging-backend override and retains the Production backend. Builds 42–44 were archived with `PERMITEXT_BACKEND_API_BASE_URL=https://permitext-apple-sandbox.vercel.app`; they are intentionally Sandbox-evidence builds, not final Production release builds. The Apple-created lifecycle gate remains open for notification retry, renewal, cancellation, billing failure/recovery, refund, duplicate-delivery, and delayed-delivery evidence.

## Isolated Apple Sandbox staging evidence

The owner authorized creation of an isolated no-cost staging environment. The resulting provider state is separate from Permitext Production:

| Item | Verified state |
| --- | --- |
| Vercel project | `permitext-apple-sandbox`, project ID `prj_81ZgJez2jeN9un5yZVJMQhJ3GvJj` |
| Vercel environment | `apple-sandbox`, environment ID `env_lWJa0VVvILVEuNxUMU6ayrg6OUpy`, type Preview |
| Deployment | `dpl_AzwQ59A2XRcXe91QDyB2tNnuU1mM`, release commit `1f58764fced918a28f8b3987b27de51e977b7f84` |
| Public staging host | `https://permitext-apple-sandbox.vercel.app` |
| Database | Dedicated Neon resource `permitext-apple-sandbox-db`, Vercel resource ID `store_AMMH148rniT3zAjY`, Neon project `proud-mountain-82366605`, free plan, `iad1` |
| Blob | Dedicated private store `permitext-apple-sandbox-blob`, store ID `store_Ek7ns0ZW3BJZn2i3`, `iad1` |
| Guardrails | All 17 staging-readiness checks pass; paid Research turns are zero, the Research kill switch is on, root-pin enforcement is on, storage-isolation flags are on, and no Stripe secret or OpenAI key is present |
| Health | Public `/health` returned HTTP 200 with PostgreSQL storage, normalized-v4 schema, PostgreSQL rate limiting, Preview environment, and the exact release commit above |

The Blob credential differs from Production, and the isolated Neon and Blob resources are connected only to the dedicated staging project. The successful deployment verified the complete construction, zoning, enacted-code, and specialty-code content required by the application. Vercel authentication protection was disabled only for this separate staging project so the physical iPhone can reach it; Production protection and the Production deployment were not changed.

## Builds 42–44 archive and upload evidence

Build 42 established the isolated archive path. Build 43 repaired a Release-only stale debug-backend override and presented the working App Store subscription sheet. Build 44 added fail-closed Sandbox account linking only when the embedded backend is exactly `https://permitext-apple-sandbox.vercel.app`; Production and lookalike hosts remain ineligible. The complete entitlement/sync contract suite passed 111 tests with zero failures before the build 44 commit `24717d609`.

Build 44 archived successfully with Xcode 27.0 (`27A5252f`). Before upload, the archived application was inspected and confirmed as version `1.0`, build `44`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. The upload reported `Upload succeeded` and `** EXPORT SUCCEEDED **`; App Store Connect subsequently reported `Complete`, `Ready to Submit`, and association with Internal Testers.

These archive observations prove configuration and upload acceptance. The following section separately records the physical-device and Apple-created evidence. Neither is Production release evidence or an App Review submission.

## Physical-iPhone purchase, ownership, and restore evidence

On build 43, the dedicated Sandbox tester opened Apple's TestFlight purchase sheet for `Permitext Pro Monthly` at `$20.00 per month`. The sheet explicitly stated that it was for testing purposes and that confirming would not create a charge. After confirmation, Permitext displayed `Pro (Test)` as active, identified billing as `Apple subscription (Sandbox/TestFlight)`, showed the signed-in Permitext account as synced, and showed all 100 included Research turns available.

Apple delivered a real Sandbox notification to `/billing/apple/notifications` at `2026-08-29T00:14:02.610Z`. Staging returned HTTP 503 because build 43 had authorized the transaction only on-device and had not yet bound the original transaction to the Permitext account. The server failed closed and requested a retry rather than granting an unowned entitlement. This was a material integration defect, not a failed or charged purchase.

Build 44 repaired that gap without expanding Production behavior. After the owner installed build 44 and selected Restore Purchases with the same Sandbox tester, Permitext restored the existing transaction without another purchase. The staging backend received four concurrent `POST /billing/apple/transactions/verify` requests at approximately `2026-08-29T00:38:15Z`; all returned HTTP 200. This is provider-backed evidence that the Apple transaction is now bound to the signed-in Permitext staging account. No real charge, new purchase, Production write, or App Review submission occurred.

Apple retried the original failed notification at approximately `2026-08-29T01:13:31Z`, almost exactly one hour after the HTTP 503, and staging returned HTTP 200. After the owner disabled automatic renewal for the Sandbox subscription, Apple delivered another notification at approximately `2026-08-29T01:15:47Z`; staging also returned HTTP 200. The route log does not expose the signed notification type, so this record does not claim an independently decoded type for the second delivery. The owner then force-closed and reopened build 44; Permitext still displayed `Pro (Test)` as active, confirming cancellation did not revoke access before period end. App Store Connect shows this tester renews monthly subscriptions every hour. Purchase presentation, no-charge confirmation, on-device Pro activation, the 100-turn allowance, authenticated ownership binding, Restore, failed-delivery retry, post-cancellation notification delivery, and cancellation-period access retention now pass. Expiration, plus renewal, billing-failure/recovery, refund, duplicate-delivery, and delayed-delivery cases remain open.

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
3. [x] Archive and upload staging-targeted builds through build 44 with `PERMITEXT_BACKEND_API_BASE_URL` pointing only to the isolated staging host.
4. [x] Set only App Store Connect's Sandbox Server URL to the staging `/billing/apple/notifications` endpoint and leave the Production URL unchanged.
5. [x] Confirm build 44 completed processing, is `Ready to Submit`, and is associated with Internal Testers.
6. [ ] Complete the physical-iPhone lifecycle. Purchase, ownership binding, Restore, failed-delivery retry, post-cancellation notification delivery, and cancellation-period access retention pass. Expiration, renewal, billing failure/recovery, refund, duplicate delivery, and delayed delivery remain.

The remaining exercise uses Apple's Sandbox and must create no real charge. A controlled Production purchase remains a separate approval gate.
