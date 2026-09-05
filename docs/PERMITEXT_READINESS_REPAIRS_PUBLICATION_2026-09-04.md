# Production-readiness repairs publication — September 4, 2026

The owner explicitly authorized publishing the repairs to Production and internal
TestFlight. This record distinguishes publication from the wider acceptance
requirements in the [repair backlog](./PERMITEXT_PRODUCTION_READINESS_BACKLOG_2026-09-04.md).
It does not authorize public App Store submission or close those requirements.

Latest repair checkpoint: PR [#52](https://github.com/randycodex/buildingcode/pull/52)
publishes `ae40953603cf9308a64d6da5657c27cf9175d99b` (client v45). Production
`dpl_8oTbEHtNFGLHTXftsvV7MPvM1zQx` is READY; both origins, six assets each,
and health match. The visible Note-to-Report refresh, exact-revision export and
bounded simultaneous-edit rejection passed. Build 60's native Project-facts PDF
repair passed its generated-PDF test and visual inspection. Its signed archive
uploaded and is available to Internal Testers; physical installation and the
actual qualified-facts PDF export passed. The temporary test grant is revoked,
with the phone's Free plan and explicit Notebook permission state verified in the
[execution record](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md).

The separately approved populated test-account deletion then passed on build 60:
native identity verification, account/device/provider completion, zero remaining
account/session/record counts, all five private Blob files absent, and signed-out
web reload without account resurrection. Historical unknown-owner cache bytes
remain disclosed and are not claimed erased.

Preceding repair checkpoint: PR [#51](https://github.com/randycodex/buildingcode/pull/51)
published the secure sign-out repair at `41ba0314dbfc9de17698b5dca37bbb7d74bd4490`
(client v44). Production `dpl_6EYL8gqmari9dcq9B3NJEnZchiew` is READY; both
canonical origins and six byte-identical assets per origin match. Health and the
actual reload → sign-out → authentication-page regression passed. The approved
required-email configuration and fresh email registration also passed. Current
recovery evidence and temporary disposable-account access are in the
[September 5 execution record](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md).
At that preceding checkpoint, native runtime inputs remained build 59; only four
synthetic UI test launch arguments changed under the native project.

Preceding checkpoint: the [September 5 account-deletion verification repair](./PERMITEXT_ACCOUNT_DELETION_REVERIFICATION_REPAIR_2026-09-05.md)
includes PRs #46–49. The final loader source is
`38ba9536d36ae5099376482dbbe4cf44f0ea5142` (client v43), verified on both
Production origins with six byte-identical assets per origin. Live Clerk
verification, safe cancellation, approved empty-account deletion, independent
Clerk identity-removal evidence and signed-out reload passed. Build 59 is processed and available to Internal
Testers. TestFlight update, launch, the in-app build-59 footer and bounded existing
account/plan/sync/Project-container/Saved continuity passed on the physical phone.
The native deletion disclosure opened and canceled with no deletion submitted.
Earlier publication entries below are retained as history.

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

## Account export and private-file follow-up publication

PR [#39](https://github.com/randycodex/buildingcode/pull/39) merged by fast-forward
at `2026-09-05T01:55:14Z`. Local and remote `main` and the repair branch matched
`4a3c7a740d29ffb46aacb20aa6cf853766d78ec6`. This publishes the normalized account
export repair, the fresh-email registration readiness guard, and private-file
ownership enforcement described in the repair backlog.

- Production deployment `dpl_42LcG9Xp9KBkyoMk9mR8aGYQarZT` is READY. Its host is
  `permitext-sync-e2vl3oirn-randycodexs-projects-b72fc111.vercel.app`.
- Both canonical `/release` endpoints returned the exact `4a3c7a740` commit and
  that deployment host at approximately `2026-09-05T02:01Z`.
- Production PostgreSQL health and Apple universal-link checks passed. The
  strict policy audit returned `publicationReady: true` at
  `2026-09-05T02:01:07Z`, with all three approved policy hashes matching.
- Deployment-scoped error/fatal counts returned no matching entries for the
  bounded `01:57Z`–`02:03Z` observation. This is not a sustained-load result.
- Reloading the designated disposable account retained Synced status, two saved
  Building Code (2022) passages, one synthetic note, and one empty saved
  collection. The Reader restored paragraph 101.2. The legacy workspace recovery
  notice remained visible; its unverified older bytes were not cleared.
- `npm run test:auth`, private-file storage tests, and broad smoke checks passed
  locally. The isolated PostgreSQL 18.6 HTTP exercise made 1,231 local database
  requests, including 24 repeatable-read/read-only batches, and no external
  database or provider requests. Foreign-account image reads/deletes were
  blocked, the legitimate owner's image survived, rejected and unconfirmed
  uploads were cleaned up, and deletion rollback passed.
- The `NYC CC APP/permitext` runtime tree is
  `f9bbba46ca2df24487604cf235fc4ec7acfef2e3` at both `553e82e074` and `4a3c7a740`.
  Build 56 remains the applicable TestFlight runtime. A native documentation
  update means the entire native project directory is not claimed identical.

The live Clerk email-registration setting remains unchanged and fails the new
readiness guard. The locally available operator credential returned HTTP 401
before this publication; a Production account export, approved deletion, identity
cleanup, and recreation have not passed. No Production exploit or account
deletion was performed. The saved-passage column discussion remains a proposal;
this publication contains no layout change.

## In-flight account request follow-up publication

PR [#40](https://github.com/randycodex/buildingcode/pull/40) merged by fast-forward
at `2026-09-05T02:52:00Z`, publishing
`0331bc844e01d3ebc8bff9c4af4eabe7ec7b2009`. Local and remote `main` and the repair
branch matched that commit before this evidence update. The change coordinates
authenticated requests and account deletion with durable operation guards.

- Preview `dpl_HiPrcnWQb2JELnukfutFLitr3qSN` became READY, passed its GitHub
  deployment check, and returned the exact commit from its protected `/release`
  route through the authenticated Vercel CLI.
- Production deployment `dpl_7XtKkzknnWHAAEbpWhc6s58nXJsL` is READY at
  `permitext-sync-lcz82ha2t-randycodexs-projects-b72fc111.vercel.app`. Both canonical
  `/release` endpoints returned that host, Production environment, and the exact
  commit at `2026-09-05T02:55:36Z`.
- Production PostgreSQL health and Apple universal links passed. The strict policy
  publication audit passed at `2026-09-05T02:56:51Z`, with all three approved
  policy hashes matching the served bytes.
- Deployment-scoped error/fatal counts were empty for the bounded
  `02:54Z`–`02:56:51Z` observation. The rendered browser check captured no console
  errors. Neither observation is sustained-load or latency acceptance.
- Reopening the designated disposable account preserved Free plan, Synced
  status, two saved passages, one synthetic note, one empty saved collection,
  and the Building Code (2022) Reader. The account footer displayed
  `Release: 0331bc844e01`. The legacy workspace recovery notice remained visible.
- The complete local `npm run check`, including precheck and postcheck, broad
  smoke, and targeted authentication/schema/performance tests passed. The actual
  isolated PostgreSQL 18.6 tests covered both upload/deletion race orders,
  recreated-session rejection, account isolation, exports, and rollback; all
  1,431 database requests were local, with zero external provider requests.
- The native runtime tree remains `f9bbba46ca2df24487604cf235fc4ec7acfef2e3`,
  identical to build 56's archived source inputs. No new native archive or
  TestFlight build was needed for this server repair.

Production export/deletion, interrupted-guard recovery, legacy shared-Project
ownership, and the remaining final-candidate acceptance gates are still open.
No Production deletion or exploit was performed. The owner-facing reminder to
revisit Project/workspace navigation is separate from this publication.

## Legacy shared-data preservation follow-up publication

PR [#41](https://github.com/randycodex/buildingcode/pull/41) merged by fast-forward
at `2026-09-05T03:22:54Z`, publishing
`42483d6d54d0383334f15baba5d225eb9fe898c3`. Local and remote `main` and the repair
branch matched that commit before this evidence update. Deletion now stops
before billing or file cleanup when retained ownership records or organization
dependencies require shared-data review. Legacy Project transfers also register
the organization owner's operation guard.

- Preview `dpl_9oUkdgiVCEqLHRWBAUPmxwwBAazA` became READY, passed its GitHub
  deployment check, and served the tested commit from its protected `/release`
  route through the authenticated Vercel CLI.
- Production deployment `dpl_BrgsykNHmNv1TqvduN2yFHgoEBwP` is READY at
  `permitext-sync-by2hfkrw2-randycodexs-projects-b72fc111.vercel.app`. At
  `2026-09-05T03:30:29Z`, both canonical `/release` endpoints returned that host,
  Production environment, and the exact commit.
- Production PostgreSQL health and Apple universal links passed. The strict
  live policy audit returned `publicationReady: true` at
  `2026-09-05T03:30:05Z`, with all three approved policy hashes matching the
  served bytes.
- A deployment-scoped error/fatal aggregate scan beginning at `03:25Z` returned
  no entries. The browser captured no console errors during the rendered check.
  These bounded observations do not establish sustained-load or latency acceptance.
- Reloading the designated disposable account preserved its Free plan, Synced
  status, two saved passages, one synthetic note, one empty saved collection,
  and Building Code (2022) Reader. The account footer displayed
  `Release: 42483d6d54d0`. The existing legacy workspace recovery notice remained.
- The complete local `npm run check`, targeted authentication, and broad smoke
  passed. Isolated PostgreSQL 18.6 validation passed both owners, stale ownership
  JSON, missing registry or organization columns, a foreign artifact as the sole
  retained dependency, and transfer/deletion exclusion in both orders. The run
  made 1,575 local database requests, including 48 Serializable and 45
  repeatable-read/read-only batches, with zero external database or provider
  requests. File-backed HTTP checks preserved both full inventories and the
  private file. The disposable PostgreSQL cluster was stopped and removed.
- Native runtime tree `f9bbba46ca2df24487604cf235fc4ec7acfef2e3` still matches
  build 56's archived source inputs. This server repair needed no new native
  archive or TestFlight build.

This is a preservation safeguard, not completed legacy migration or disposal.
Affected accounts remain subject to reviewed recovery before deletion can
continue. Full Production export/deletion acceptance, interrupted-operation
recovery, and the remaining final-candidate gates stay open. No Production
deletion, exploit, entitlement grant, or purchase was performed.

## Account-link operation follow-up publication

PR [#42](https://github.com/randycodex/buildingcode/pull/42) merged by fast-forward
at `2026-09-05T03:52:59Z`, publishing
`acafd9642a07e049c218f9816432341de8aec0cc`. Local and remote `main` and the repair
branch matched before this documentation update. Account linking now rejects
overlapping operations and deletion claims on either account, including a writer
that registers just after the merge's Serializable snapshot begins.

- Preview `dpl_4qgsdFjQBANQro58Pk2NA8TqfJFS` became READY and passed its GitHub
  deployment check. Its protected `/release` returned the exact commit and
  Preview environment through the authenticated Vercel CLI at `03:52:50Z`.
- Production deployment `dpl_oRvJsuvqHUgoTdst4wyyrd6izCVM` is READY at
  `permitext-sync-i0trqqdfl-randycodexs-projects-b72fc111.vercel.app`. Both canonical
  `/release` endpoints returned that host, Production environment, and the exact
  commit at `2026-09-05T03:56:06Z`.
- Production PostgreSQL health and Apple universal links passed. All three
  approved policy hashes matched the live bytes in the strict audit at
  `2026-09-05T03:56:04Z`.
- Deployment-scoped error/fatal aggregate counts were empty for
  `03:55:40Z`–`03:56:42Z`. The browser captured no console errors. This is a
  bounded publication check, not sustained-load or latency acceptance.
- Reloading the designated disposable account preserved Free plan, Synced
  status, two saved passages, one synthetic note, one empty saved collection,
  and the Building Code (2022) Reader. The account footer showed
  `Release: acafd9642a07`; the legacy workspace recovery notice remained.
- Full `npm run check` passed, including precheck, main check, and postcheck.
  Authentication policy, session hot-path, lifecycle, runbook, broad smoke, and
  file-backed HTTP checks passed. Isolated PostgreSQL 18.6 tests covered both
  race orders, both owners, deletion claims, forged exclusions, a stale snapshot,
  retained image access, and automatic Apple-identity repair. The final run made
  1,775 local database requests, including 62 Serializable and 46
  repeatable-read/read-only batches, with zero external database/provider calls.
  The disposable cluster was stopped and removed.
- Native runtime tree `f9bbba46ca2df24487604cf235fc4ec7acfef2e3` remains identical
  to build 56's archived inputs. No replacement native archive was created by
  this local repair workflow. The separate automatic Apple CI check on this
  commit is not evidence of a verified replacement TestFlight installation.

Production export/deletion, interrupted-operation recovery, final provider/client
acceptance, and the owner release gates remain open. No Production account was
linked or deleted during these checks. No paid Research, purchase, entitlement
grant, App Store submission, or navigation redesign was performed.

## Build 57 source-alignment candidate

Apple's automatic Xcode Cloud build 244 for `acafd9642a07e049c218f9816432341de8aec0cc`
completed successfully. Its workflow archived the app but did not publish a new
TestFlight build. A separate local build 57 was prepared and uploaded under the
owner's existing Production/internal-TestFlight publication authorization.

- Clean detached source: `acafd9642a07e049c218f9816432341de8aec0cc`, matching the
  account-link repair running on Production at archive time.
- Version `1.0 (57)`, bundle `com.randycodex.permitext`, team `57BY95X97H`.
- Archive: `/private/tmp/permitext-1.0-57-acafd9642.xcarchive`.
- Native runtime tree: `f9bbba46ca2df24487604cf235fc4ec7acfef2e3`, unchanged from
  build 56. Pinned Clerk, Nuke and PhoneNumberKit checkouts were clean and matched
  their resolved revisions.
- Strict deep signing verification, Production backend/live Clerk configuration,
  signed-entitlement comparison, and provisioning-profile validity passed.
- Archived executable SHA-256:
  `0bd45a45135de6ac61282a17aac64961b4aa70fa830ad954aed3dbf88b0c14ba`.
- The semantic union of archived privacy manifests retains 13 collected-data
  categories, three required-reason API groups and no tracking. This remains
  archive evidence, not an Apple Organizer privacy report or provider attestation.
- Xcode reported `Upload succeeded` at `2026-09-05T04:11:53.220Z`, followed by
  `EXPORT SUCCEEDED` and exit 0. App Store Connect subsequently showed Complete
  and Ready to Submit for build `c4f99fc4-f577-438d-8079-6a153f0b59d3`, assigned
  to Internal Testers with one invitation at approximately `2026-09-05T04:24Z`.
  Physical installation and launch remain unverified; build 56 is the last
  physically verified installation.
- Local verification and upload evidence is retained in
  `/private/tmp/permitext-build57-final-evidence.json`,
  `/private/tmp/permitext-build57-privacy-aggregate.json`,
  `/private/tmp/permitext-build57-archive-xcode.log`, and
  `/private/tmp/permitext-build57-upload.log`.

The subsequent whole-section Saved visibility check identified a web-only repair
on the working branch. Build 57 does not claim full-repository SHA equality with
that later change. Final shared-candidate selection, remaining client/account
acceptance and public release authorization remain open. No phone access or App
Store submission was performed for this upload.

## Whole-section Saved visibility publication

PR [#43](https://github.com/randycodex/buildingcode/pull/43) merged by fast-forward
at `2026-09-05T04:23:37Z`, publishing
`1afdafd19ca4947d19e46350748506668c90790c`. Local and remote `main` and the repair
branch matched before this documentation update.

- Preview `dpl_GnYTpLK6ovgJanJjABZPrUHswbrq` became READY and passed its GitHub
  check. Its protected `/release` returned the exact commit, Preview environment
  and `permitext-sync-gf4avo2vl-randycodexs-projects-b72fc111.vercel.app` host at
  `2026-09-05T04:23:35Z`.
- Production deployment `dpl_8QPPG8v7i62Ey5rXFsdXuUMKP1oQ` became READY at
  `2026-09-05T04:25:51Z`. Both canonical origins returned the exact commit,
  Production environment and
  `permitext-sync-koi5ydfsa-randycodexs-projects-b72fc111.vercel.app` host at
  `2026-09-05T04:26:53Z`.
- Both origins served `app.js`, `offline-storage.js`, `service-worker.js` and
  `styles.css` bytes identical to the tested source. The HTML and actual browser
  loaded client `20260905-saved-section-visibility-v38`; shell is
  `permitext-pro-shell-v777`.
- PostgreSQL `normalized-v4` health, Apple universal links and the strict approved
  policy-byte audit passed. Deployment-scoped error/fatal counts were empty for
  the bounded post-publication observation. This is not long-term reliability
  evidence.
- The same disposable account's Unassigned Saved count changed from three to
  four without recreating the missing save. Both Gates (2022, whole section) and
  Slope (2014, paragraph) were visible after reload and reopened in the correct
  Reader editions. The original two passages, synthetic note and empty saved
  collection remained. The legacy ownership-recovery warning was retained.
  Browser console errors were empty.
- The new regression failed before the repair and passed afterward. Full
  `npm run check`, including precheck/postcheck, broad smoke and the focused
  evidence, Saved-summary and offline contracts passed. No new PostgreSQL
  concurrency exercise was needed for this client-only filter correction.
- GitHub reported the same commit's automatic Apple `permitext | Default` check
  successful by `2026-09-05T04:33Z`, alongside Vercel success. Apple CI job
  `6a8006b3-ffaa-439d-8e97-6805db715f8e` is build-check evidence; it does not
  establish a new TestFlight upload or physical installation.

Local evidence includes `/private/tmp/permitext-unassigned-section-browser-evidence.json`,
`/private/tmp/permitext-unassigned-section-production-release.json`, and the
matching `permitext-unassigned-section-*.log` files. Build 57 is available to
Internal Testers with the unchanged native runtime, but its full source SHA is
the preceding account-link repair. Final shared-candidate selection remains
open. Physical build-57 verification, Production operator export, reviewed
deletion and the remaining owner/provider acceptance steps await their required
access or approval. No phone use, account deletion, paid Research, purchase,
entitlement grant, App Store submission or navigation redesign occurred.

## Native navigation labels and build 58

PR [#44](https://github.com/randycodex/buildingcode/pull/44) merged by fast-forward
at `2026-09-05T05:06:37Z`, retaining exact source
`9a89e54e7b70ccb7567b784443b232df005a10ac`.

- The actual Release Simulator hierarchy exposed Saved as `Move`, both Readers
  by their SF Symbol identifiers, and a chapter card as `Chapter Chapter 7`.
  Destination labels now belong to the tab-item images, and chapter cards use
  their existing chapter/appendix display label once.
- The initial Release UI capture failed on the missing Saved label. The repaired
  capture passed all five tab names, chapter/edition identity, Reader debug-control
  absence, search and Saved navigation. The final run also checked every tab was
  hittable before capture and allowed the keyboard/tab-bar transition to settle.
- Four current `1320 × 2868` PNGs and JPEG copies are retained in the
  [build 58 screenshot candidate](../NYC%20CC%20APP/docs/app-store/screenshots/build58-candidate/provenance.json).
  All four settled PNGs and the Reader JPEG were visually inspected; every JPEG
  passed dimension and no-alpha checks. No application pixels were retouched.
  The capture used the signed-out iPhone 17 Pro Max Simulator on iOS 26.5.
- Preview `dpl_9kp7by7yuqFCTScjR5vrYciMxD5g` passed its build check. The authenticated
  CLI returned exact source `9a89e54e7b70ccb7567b784443b232df005a10ac`, Preview
  environment and `permitext-sync-brx41dmcq-randycodexs-projects-b72fc111.vercel.app`.
  The MCP fetch returned an SSO redirect, which was not counted as release proof.
- Production `dpl_HWoChFH39P9eYKeCE3uNvBJUaDd3` became READY at
  `2026-09-05T05:09:11.176Z`. Both canonical origins returned the exact source,
  Production environment and
  `permitext-sync-8gfq1dak3-randycodexs-projects-b72fc111.vercel.app` at
  `2026-09-05T05:09:38.183Z`. Client bytes remain identical to the verified v38
  Saved repair. Health, universal links and strict approved-policy checks passed;
  the bounded deployment error/fatal aggregate was empty.
- The Production browser displayed release `9a89e54e7b70`, returned to Synced
  after reload, and retained four saves, one synthetic note, Gates/Slope entries,
  the 2014 Reader and the legacy ownership warning. The Account panel was closed
  after verification. No customer cleanup or new paid request was performed.
- GitHub subsequently reported both Vercel and Apple `permitext | Default`
  successful for this commit. Apple CI job
  `c76c4ce2-9d9e-4c43-9b90-f8941b0d4963` is distinct from a TestFlight upload.

Build 58 was archived from that same full source. The retained archive is
`/private/tmp/permitext-1.0-58-9a89e54e7.xcarchive`. Strict deep signing, team and
entitlement comparison, Production backend/live Clerk configuration, clean pinned
dependency checkouts, and semantic privacy aggregation passed. Its native runtime
tree is `52dbb515963108de06568fa85baab5994ea5511f`, matching the captured source;
the signed executable SHA-256 is
`beb83a75f74b80eb96a44d121677a9e18155f050808de658e471672bb25d8316`.
Privacy aggregation remains 13 categories, three required-reason API groups and
no tracking, with the previously stated provider/Organizer evidence limits.

**Initial upload stopped on Apple account access.** Xcode export returned exit 70 with
`Failed to Use Accounts` and required App Store Connect access for team
`57BY95X97H`. The browser independently showed Apple's sign-in form. At that point,
build 58 had not uploaded, build 57 was the latest confirmed internally available
build and build 56 was the last physically verified installation. The subsequent
[same-archive retry](#build-58-upload-after-apple-sign-in-recovery) resolved the
upload blocker. Final shared-client, VoiceOver, account-lifecycle and public release
acceptance remain open.

Retained local evidence: `/private/tmp/permitext-store-capture58-settled.xcresult`,
`/private/tmp/permitext-build58-final-evidence.json`,
`/private/tmp/permitext-build58-privacy-aggregate.json`,
`/private/tmp/permitext-build58-upload.log`, and
`/private/tmp/permitext-native-navigation-production-release.json` with the
matching health, policy, AASA and browser evidence files. No phone use, App Store
screenshot upload, build selection or public submission occurred.

## Build 58 upload after Apple sign-in recovery

On September 5 the owner restored Xcode and App Store Connect sign-in. The
existing build-58 archive was reused without a rebuild or build-number change.
Before retrying, strict deep signature verification and executable SHA-256
comparison passed, and the checkout's native runtime tree still matched the
archived/captured source. The prior account-access failure remains historical
evidence rather than the current upload outcome.

- Xcode reported `Upload succeeded` at `2026-09-05T12:32:56.741Z`, followed by
  `EXPORT SUCCEEDED` and exit 0.
- App Store Connect subsequently displayed version `1.0 (58)` as Complete and
  Ready to Submit, assigned to Internal Testers with one invitation. Build record
  `c2408f97-fe34-4a83-9e3e-07e5ea779197` was recorded at
  `2026-09-05T12:42:57Z`.
- The owner installed the update through TestFlight and opened Permitext on the
  iPhone 17 Pro. Mirroring independently showed `Permitext 1.0 (Build 58)` in the
  Account footer at approximately `2026-09-05T12:45Z`. The existing signed-in
  account, Lifetime Pro, 98 remaining included Research turns, Synced status,
  Project containers and a saved Building Code passage remained present. The
  Reader retained Fuel Gas Code and 2022 Construction Codes. Saved, First reader
  and Account navigation passed.
- The owner reported that VoiceOver reads the chapter card and bottom menu
  buttons, and affirmed the chapter-number clarification. This is a bounded
  user-reported navigation spot-check, not an independent audio recording of
  every exact label or complete accessibility certification. The owner then
  returned the phone with VoiceOver off.
- The saved `101.4.1 Electrical` passage opened through its source link at the
  exact provision in Building Code 2022, Chapter 1. The existing recent
  `concrete` search returned 200 results; selecting `28-406.1` opened General
  Administrative Provisions 2022, Chapter 4 at that exact provision. Native
  Reader headings displayed the code and edition. Fuel Gas Chapter 5 restored
  the prior `504.2` table position; no new horizontal-gesture result is claimed.
- Both canonical Production origins still returned full source
  `9a89e54e7b70ccb7567b784443b232df005a10ac` at `2026-09-05T12:31:34Z`, matching
  the verified archive. This release-identity recheck does not repeat the earlier
  health, policy, browser or sustained-operation tests.
- Retry evidence is retained in
  `/private/tmp/permitext-build58-upload-retry-20260905.log` and
  `/private/tmp/permitext-build58-upload-retry-20260905.json`; the final archive
  evidence records the successful retry and preserves the initial failure.
  Bounded device evidence is retained in
  `/private/tmp/permitext-build58-physical-acceptance-20260905.json` without the
  account email or private Project names.

Public App Store submission, screenshot upload and final release acceptance
remain separate. No account cleanup, purchase or new paid Research request was
performed for this upload.

## Production administrator access restored

On September 5 the owner replaced the unavailable administrator credential.
The existing verified source `0985728b26e5b247d758fce26c4e0739efef986f` was
redeployed as `dpl_6ZEsNtGcM5e5QsUFDXVWDGPFYPB3`. Both canonical origins and
served client bytes matched; health, AASA and strict approved-policy checks
passed. Authenticated operator export and restore-checklist reads then succeeded
for the exact disposable Free account. See the [deployment, export comparison,
and remaining deletion boundary](./PERMITEXT_ACCOUNT_ACCEPTANCE_PREPARATION_2026-09-05.md).
No runtime code, native build, paid entitlement or account data was changed by
this configuration recovery.
