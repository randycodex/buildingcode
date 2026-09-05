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
