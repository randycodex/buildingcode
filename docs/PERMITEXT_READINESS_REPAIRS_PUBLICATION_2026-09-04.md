# Production-readiness repairs publication — September 4, 2026

The owner explicitly authorized publishing the repairs to Production and internal
TestFlight. This record distinguishes publication from the wider acceptance
requirements in the [repair backlog](./PERMITEXT_PRODUCTION_READINESS_BACKLOG_2026-09-04.md).
It does not authorize public App Store submission or close those requirements.

## Source and Production

- PR [#38](https://github.com/randycodex/buildingcode/pull/38) merged by a fast-forward
  of `main` at `2026-09-05T00:19:47Z`.
- Local `main`, `origin/main`, and GitHub `main` matched
  `553e82e074eb3751edf72be8c7579990f91e3bd3`.
- Production deployment `dpl_H6LwjBEGcx5jby2KwdQPW7xw1phc` is READY with
  `permitext.com` and `permitext-sync.vercel.app` assigned.
- Both canonical `/release` endpoints returned that exact application SHA at
  `2026-09-05T00:23:17Z`.
- The served `app.js`, `offline-storage.js`, and `service-worker.js` bytes equal
  the source files. The browser loaded client `20260904-readiness-recovery-v37`;
  the shell version is `permitext-pro-shell-v776`.
- Production health passed with PostgreSQL `normalized-v4`; configured Clerk
  authentication and Apple universal links passed. The AASA app ID is
  `57BY95X97H.com.randycodex.permitext`.
- The strict live policy audit returned `publicationReady: true`: canonical
  Terms, Privacy, and Subscription/Refund bytes match their approved artifacts.
- Deployment-scoped error/fatal log counts returned no matching entries in the
  bounded post-deployment observation. This is not long-term reliability evidence.

## Rendered web observation

The existing signed-in browser showed Pro and Synced. Opening a Reader loaded
Building Code (2022), Chapter 1, and the prior bookmarked-section indicator.
Reloading retained the Reader and Synced state. No paid Research request or
customer-record mutation was performed.

The expected legacy recovery notice was visible: older browser workspace bytes
whose account ownership cannot be verified remain retained separately. This is
not proof of recovery or deletion of those bytes. The known ownership-review
boundary remains open. One browser console error came from an installed wallet
extension; no Permitext-origin error was observed in the captured console sample.

## Native archive and upload

- Version `1.0 (56)`, bundle `com.randycodex.permitext`, team `57BY95X97H`.
- Archive `/private/tmp/permitext-1.0-56-dd131a5cf.xcarchive`, built from clean
  detached source `dd131a5cf1da8ef2967f635103247cd437f20250`.
- Native input tree `7e708a59410b072f408a737c2edec431f9df6981` is identical to
  the published repair revision. The full repository SHAs differ because the
  later change affects web/server recovery authorization and its regressions.
  This record does not claim full repository SHA or binary equality.
- The archive executable SHA-256 was rechecked before upload:
  `b44ba3d3a1ff33a85ad803034f72ea7456fa5d0b759c387e319af64a302b937f`.
- Strict signing, pinned package checkouts, Production backend/live Clerk
  configuration, and privacy aggregation passed during archive verification.
  Privacy includes 13 categories, three required-reason API groups, and no tracking.
- Xcode reported `Upload succeeded` at `2026-09-05T00:23:59Z`, then
  `EXPORT SUCCEEDED` and exit 0. The verified archive was reused without rebuilding.
- App Store Connect upload status is Complete. Build record
  `dcfd05d2-034a-41a4-abf6-3d3ed906dbbb` is Ready to Submit and assigned to
  Internal Testers with one invitation through the existing automatic distribution.
  This is internal TestFlight availability, not public App Store approval.
- Physical installation passed through TestFlight on the iPhone 17 Pro. TestFlight
  showed `1.0 (56)` and Open; the installed app's Account footer independently
  showed `Permitext 1.0 (Build 56)` at approximately `2026-09-05T00:39Z`.
- The update retained the existing signed-in account, Lifetime Pro, 98 remaining
  included Research turns, Synced status, existing Project containers, a saved
  Building Code section, and the Fuel Gas Code (2022) library selection. No
  sign-out, deletion, customer-content edit, purchase, or Research turn was used.

The earlier build-54 physical table/VoiceOver observations remain bounded evidence
for identical native source. The new build-56 check establishes installation,
launch and the stated continuity observations. It does not establish all
accessibility behavior or the full release acceptance matrix.

## Retained local evidence

- `/private/tmp/permitext-repair-publication-553e82e07.json`
- `/private/tmp/permitext-build56-production-source.json`
- `/private/tmp/permitext-build56-policy-publication.json.log`
- `/private/tmp/permitext-build56-final-evidence.json`
- `/private/tmp/permitext-build56-privacy-aggregate.json`
- `/private/tmp/permitext-build56-archive.log`
- `/private/tmp/permitext-build56-upload.log`

Archives and unredacted local logs are not source-control artifacts. Broader
authentication/deletion, device recovery, professional handoff, operating
acceptance, and final owner go/no-go requirements remain open. No new paid cohort,
price/allowance change, customer deletion, or public App Store submission occurred.
