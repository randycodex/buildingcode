# Permitext Apple Sandbox and TestFlight Readiness Evidence — August 28, 2026

## Scope and boundary

This record captures a read-only inspection of the owner's authenticated App Store Connect account plus no-cost verification of Apple's published root certificates. The inspection did not save App Store Connect changes, create or clear a Sandbox purchase, upload a build, submit anything for review, deploy a backend, alter pricing, or make a paid call.

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
| Server notifications | Both Production Server URL and Sandbox Server URL show `Set Up URL`; neither is configured |
| TestFlight | Builds 31–41 are present. Build 41 completed processing, is `Ready to Submit`, expires in 89 days, and is associated with the Internal Testers group. No installs, sessions, crashes, or feedback are recorded for build 41. |
| Sandbox accounts | Two United States test accounts exist. `permitext+storekit1@gmail.com` records a last purchase on August 23, 2026; the second account records no last purchase. No purchase history was cleared. |

The latest uploaded build is 41, while the checked-in iOS project also currently uses build number 41. Build 41 predates the build-time staging-backend override and therefore retains the Production backend. Permitext Production intentionally rejects Sandbox transactions, so the existing build cannot close the Apple Sandbox lifecycle gate.

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

1. Separately authorize an isolated non-Production database, private Blob store, and staging deployment. The existing Preview environment is ineligible because it shares Production storage.
2. Run `npm run verify:apple-sandbox-readiness` against that deployment and require every check to pass.
3. Increment the iOS build number and separately authorize a TestFlight archive whose `PERMITEXT_BACKEND_API_BASE_URL` points only to the isolated staging host.
4. Separately authorize setting App Store Connect's Sandbox Server URL to the staging `/billing/apple/notifications` endpoint. Leave the Production URL unchanged until the Production release is ready.
5. Use an existing Sandbox account to exercise purchase, ownership, renewal, cancellation, billing failure/recovery, refund, duplicate delivery, delayed delivery, and restore. Capture Apple-created transaction and notification identifiers.

Steps 1, 3, 4, and 5 are not authorized by this evidence record. A controlled Production purchase remains separately approval-gated.
