# Privacy declaration corrections — September 3, 2026

Status: local, nonvisual preparation; not a published App Store declaration, deployed change, new TestFlight binary, or complete third-party privacy audit.

Reviewed source base: `15717c78afe55bd0c4af84074d220e5c284d3b85`. The owner owns all UI/UX and screenshots. No screens, screenshot assets, collection behavior, approved public policy bytes, provider settings, or Apple fields are changed by this correction.

## Confirmed omissions

Apple defines collection to include information sent off device and retained beyond servicing a request. Its Search History category expressly includes searches inside an app, and account-linked records do not become anonymous merely by omitting prose. Definitions checked against [Apple's App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) and [collected-data manifest identifiers](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype). The classifications below are the implementation-based application of those definitions.

| Category | Actual collection path | Correct local declaration |
| --- | --- | --- |
| Search History | `CodeLibraryViewModel.swift`, `queueContinuityContextForSync` / `continuitySyncValues`, encodes `recentSearches` into `recentSearchesJSON`. `postgres-sync-repository.mjs` merges account continuity through `mergeContinuityMutations`; `continuity-merge.mjs` retains query strings/history. `Diagnostics/Signposts.swift`, `applyServerContinuity`, restores received queries. | Collected; linked; App Functionality; not tracking |
| Performance Data | `app.mjs` measures `durationMilliseconds` and calls `saveResearchOperationMetricBestEffort(context.userID, ...)`. `research-economics.mjs`, `createResearchOperationMetric`, preserves the duration. `saveResearchOperationMetric` persists it in `permitext_research_operations` beside `user_id`. | Collected; linked; App Functionality; not tracking |
| Other Diagnostic Data | The same account-linked operation record retains failure codes, verification diagnostics and request/retry counts for troubleshooting. The private report can retrieve `user_id` with the metric. This is not merely an ephemeral local log. | Collected; linked; App Functionality; not tracking |

The existing public policy already describes synced searches and security/operational metadata. The local submission checklist incorrectly placed searches only under Product Interaction, listed Search History among uncollected categories with an outside-app qualifier, omitted Performance Data, and left Other Diagnostic Data unresolved. The app-owned privacy manifest omitted all three categories. Both local artifacts are corrected; the already approved public policy is preserved byte-for-byte.

App Functionality here covers continuity, reliable operation, troubleshooting, and performance/cost controls. This is not evidence for adding advertising/tracking purposes. Future behavioral analytics or changed third-party use must trigger a separate reassessment.

## Verification

- `tests/ios-privacy-manifest-contract.mjs` verifies the three unique manifest entries, their linked/not-tracking/functionality flags, and matching local checklist answers.
- Negative controls remove each category and flip linkage/tracking flags; those mutations must fail.
- Synthetic runtime checks exercise the actual continuity merger and Research metric normalizer, including retained query/duration/failure fields and exclusion of question, answer and email fields from the metric object.
- Source wiring checks bind those contracts to the native sync payload, account-linked PostgreSQL metric persistence, terminal-operation recording and account-deletion query. These are bounded regression checks, not live database or physical-device acceptance.
- Validate the XML separately with `plutil -lint`; the Node test intentionally is not a general-purpose plist parser.
- `npm run test:privacy` is part of the normal `npm run check` sequence.

Execution results: `npm run test:privacy`, `plutil -lint`, continuity-merge, Research economics/persistence, approved-policy-artifact integrity, and the full `npm run check` all passed. The full check completed with exit 0; log: `/private/tmp/permitext-privacy-check-20260903.log`. The PostgreSQL rate-limit integration was skipped without a database URL, so no live database acceptance is claimed. No paid provider call, UI edit, build upload, merge, push, deployment or Apple mutation occurred. `git diff --check` passed and the approved public policy bytes are unchanged.

## Pinned SDK and historical archive checks

The local Clerk source checkout was verified at the exact lockfile revision `3b6b16f7947c29261a5dcfbe475fe3a6ab9ea358` (1.4.1), not a newer SDK checkout.

- `Sources/ClerkKit/Utils/DeviceHelper.swift` obtains `UIDevice.current.identifierForVendor`; `Networking/Middleware/ClerkHeaderRequestMiddleware.swift` sends it as `x-native-device-id`, with device/model/OS/app-version metadata. This proves transmission, not the service's precise retention schedule. The draft's old absence claim for Device ID is replaced by an explicit unresolved provider declaration.
- `Domains/Auth/Session/Session.swift`, `SessionActivity`, models an activity ID, IP address, and IP-derived city/country. [Clerk's current SessionActivity documentation](https://clerk.com/docs/reference/backend/types/backend-session-activity) independently describes that information. This makes a blanket no-Location answer unsafe; final Coarse Location classification and purposes need provider confirmation. No real user's session/IP/location was fetched.
- Clerk's `Telemetry/TelemetryCollector.swift`, `shouldRecord`, rejects development-telemetry events for production instances. That gate does not suppress the separate authentication request headers or provider session records, and is not evidence of zero provider collection.
- The retained signed build-52 application contains its app-owned manifest and `PhoneNumberKit_PhoneNumberKit.bundle/PrivacyInfo.xcprivacy`. The latter declares no collected types, accessed API categories, or tracking. No separate Clerk/Nuke manifest was found in that archived app. Absence of a manifest is not proof of no collection. The archive is unchanged and still predates the three local corrections.
- [Clerk's current analytics documentation](https://clerk.com/docs/guides/dashboard/analytics) describes production sign-up, sign-in, active-use and retention reports. Their actual use and the corresponding Analytics purposes need reconciliation; the SDK's development-only telemetry gate does not answer that question.
- Nuke's local checkout matches pinned revision `30f7a7e72e0607d304fbf69c799474bd5fb6d1ce` (13.2.0). Its reviewed `Loading/DataLoader.swift` path uses URLSession and an on-device URLCache for requested images. A scoped source scan found no telemetry/advertising-identifier integration, and its package declares no external dependencies. This is a bounded loader/dependency review, not proof about image hosts' IP logs or every caller-supplied request.

## Still open before owner-approved publication

1. Finish reconciling third-party collection/retention and purposes, including Clerk session/device/IP processing, production analytics and infrastructure/image-host logs. The pinned-source and archived-manifest checks above narrow this work but do not complete it. A dependency name alone does not prove a data category is collected or absent.
2. Review final archived-candidate privacy aggregation. The existing build 52 predates this local manifest correction; no archive/upload is performed here.
3. Verify the remaining account export/deletion lifecycle on an explicitly authorized disposable identity. Source deletion of operation telemetry is not proof of live provider log/backup erasure.
4. Have the owner confirm the final App Store questionnaire and authorize entry/publication. Apple configuration, submission and release remain untouched.

No claim that all privacy categories are now complete is made by this targeted correction. In particular, existing draft answers about device IDs, location, crash data, or support data remain subject to the SDK/provider review above.
