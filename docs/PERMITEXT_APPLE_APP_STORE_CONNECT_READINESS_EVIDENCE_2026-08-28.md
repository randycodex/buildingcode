# Permitext Apple Sandbox and TestFlight Readiness Evidence — August 28, 2026

## Scope and boundary

This record began with a read-only inspection of the owner's authenticated App Store Connect account and no-cost verification of Apple's published root certificates. With the owner's later approval, it now also records an isolated Apple Sandbox staging deployment, the dedicated Sandbox notification URL, and a staging-targeted TestFlight build upload. No Sandbox purchase has been created or cleared, nothing was submitted for App Review, the Production notification URL and Production deployment were not changed, pricing was not changed, and no paid provider call was made.

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
| TestFlight | Build 42 was uploaded on August 28, 2026 at 6:37 PM from a verified archive targeting only the isolated staging backend. Apple completed processing; build 42 is `Ready to Submit`, expires in 90 days, and is associated with the Internal Testers group. Builds 31–41 remain present. |
| Sandbox accounts | Two United States test accounts exist. `permitext+storekit1@gmail.com` records a last purchase on August 23, 2026; the second account records no last purchase. No purchase history was cleared. |

Build 41 predates the build-time staging-backend override and retains the Production backend. Build 42 is the first uploaded build archived with `PERMITEXT_BACKEND_API_BASE_URL=https://permitext-apple-sandbox.vercel.app`; it is intentionally a Sandbox-evidence build, not the final Production release build. The Apple-created lifecycle gate remains open until the owner completes the physical-iPhone Sandbox exercise.

## Isolated Apple Sandbox staging evidence

The owner authorized creation of an isolated no-cost staging environment. The resulting provider state is separate from Permitext Production:

| Item | Verified state |
| --- | --- |
| Vercel project | `permitext-apple-sandbox`, project ID `prj_81ZgJez2jeN9un5yZVJMQhJ3GvJj` |
| Vercel environment | `apple-sandbox`, environment ID `env_lWJa0VVvILVEuNxUMU6ayrg6OUpy`, type Preview |
| Deployment | `dpl_CnVCdQFCi4FdNQCRUsGJbGT3Yqrb`, release commit `50a7b6bfa900a2909401786f5704951a11bcdac5` |
| Public staging host | `https://permitext-apple-sandbox.vercel.app` |
| Database | Dedicated Neon resource `permitext-apple-sandbox-db`, Vercel resource ID `store_AMMH148rniT3zAjY`, Neon project `proud-mountain-82366605`, free plan, `iad1` |
| Blob | Dedicated private store `permitext-apple-sandbox-blob`, store ID `store_Ek7ns0ZW3BJZn2i3`, `iad1` |
| Guardrails | All 17 staging-readiness checks pass; paid Research turns are zero, the Research kill switch is on, root-pin enforcement is on, storage-isolation flags are on, and no Stripe secret or OpenAI key is present |
| Health | Public `/health` returned HTTP 200 with PostgreSQL storage, normalized-v4 schema, PostgreSQL rate limiting, Preview environment, and the exact release commit above |

The Blob credential differs from Production, and the isolated Neon and Blob resources are connected only to the dedicated staging project. The successful deployment verified the complete construction, zoning, enacted-code, and specialty-code content required by the application. Vercel authentication protection was disabled only for this separate staging project so the physical iPhone can reach it; Production protection and the Production deployment were not changed.

## Build 42 archive and upload evidence

The archive completed with Xcode 27.0 (`27A5252f`) and was uploaded successfully through App Store Connect export. Before upload, the archived application was inspected and confirmed as version `1.0`, build `42`, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. The upload reported `Uploading permitext.ipa is complete`, `Uploaded package is processing`, `Upload succeeded`, and `** EXPORT SUCCEEDED **`.

This proves archive configuration and upload acceptance only. It is not Apple-created purchase evidence, physical-device acceptance, Production release evidence, or App Review submission.

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
3. [x] Archive and upload build 42 with `PERMITEXT_BACKEND_API_BASE_URL` pointing only to the isolated staging host.
4. [x] Set only App Store Connect's Sandbox Server URL to the staging `/billing/apple/notifications` endpoint and leave the Production URL unchanged.
5. [x] Confirm build 42 completed processing, is `Ready to Submit`, and is associated with Internal Testers.
6. [ ] On the owner's physical iPhone, use an existing Sandbox account to exercise purchase, ownership, renewal, cancellation, billing failure/recovery, refund, duplicate delivery, delayed delivery, and restore. Capture Apple-created transaction and notification identifiers.

The remaining exercise uses Apple's Sandbox and must create no real charge. A controlled Production purchase remains a separate approval gate.
