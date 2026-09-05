# Permitext production-readiness repair backlog — September 4, 2026

The owner authorized publishing the existing baseline, aligning web and iOS to
that source revision, and starting repairs on a new branch. This document tracks
the audit findings; it does not approve public release or claim that all findings
are repaired. No paid Research evaluation is authorized by this work.

## Baseline and branch

- Baseline `main` and `origin/main`: `176cca6f2e2d01db6495f29192f805ef7daddfbe`.
- Production deployment: `dpl_DRsWbchJ384r1q7WeTWLJkLZotjh`, READY.
- Both `https://permitext.com/release` and
  `https://permitext-sync.vercel.app/release` returned that exact baseline SHA.
- Native candidate: version 1.0, build 53, built from a separate detached checkout
  at the same baseline. Upload and internal availability succeeded; build 53 was
  installed and launched on the iPhone 17 Pro through TestFlight/Mirroring. See
  `PERMITEXT_SYNCHRONIZED_BASELINE_2026-09-04.md` for the separate evidence layers.
- Repair branch: `codex/production-readiness-fixes`, created from that baseline.
- Branch repairs are not part of the baseline deployment or native candidate.

The baseline commit preserves semantically unchanged Xcode project/plist ordering
and the shared Xcode Cloud manifest. It does not contain new audit repairs.
Build 52 was inspected during the original audit. This publication then installed
build 53 from the shared baseline; it is not a build of this repair branch.

## Publication of the repairs

After explicit owner approval, PR #38 was merged at the exact repair SHA
`553e82e074eb3751edf72be8c7579990f91e3bd3`. Production deployment
`dpl_H6LwjBEGcx5jby2KwdQPW7xw1phc` is READY; both canonical release endpoints
and the served client files match that source. Production health, universal
links, approved policy bytes, and the bounded rendered web check passed.

iOS build 56 uploaded successfully from the verified archive. Its native input
tree is identical to the published branch; its full repository source revision
is earlier because the last follow-up only changed web/server recovery. Apple
processing completed and Internal Testers assignment is verified. TestFlight
installation, launch, the app's build-56 footer, and existing account/plan/sync,
Project-container and saved-section continuity passed on the iPhone 17 Pro.
See the [publication record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md).
This supersedes the unpublished status in the historical ledgers below; it does
not close the remaining acceptance items or authorize public App Store submission.

## Post-publication authentication acceptance

**September 5 update:** the owner-approved required-email change is live.
Fresh email registration completed on Production, and all 10 public provider
configuration checks passed. The final audit execution also confirmed 7/7 browser
storage cases, 4/4 native recovery UI cases, and a qualified Note/Project-facts
Report export and reopen. The further reproduced sign-out defect after reload
is repaired and verified on Production `41ba0314dbfc` (PR #51). The synthetic
Project, Note, image and Report also survived reload before sign-out. See the
[current execution record](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md)
for exact evidence and remaining boundaries.

PR #52 additionally publishes the open-Report snapshot refresh and reviewed-revision
export repair at `ae40953603cf`. Production asset/health checks, the visible update,
and a bounded two-editor stale-save rejection passed. The native Project-facts PDF
repair passed its generated-PDF test and two-page visual inspection. Build 60 is
internally available and physically installed; its actual PDF preserves the
qualified Project facts. Temporary test Pro access is revoked, and the phone's
explicit Notebook permission state and Free plan were verified. Exact evidence
and remaining account acceptance are tracked in the execution record.

The owner subsequently approved the distinct populated disposable account's
deletion. Build 60 completed native reverification/deletion; independent checks
confirm zero account/session/record counts and absence of all five private Blob
files. Clerk's Production Users lookup and signed-out web reload also passed.
Unattributed legacy cache bytes remain explicitly outside this acceptance claim.

The following describes the earlier September 4 blocker. Fresh email registration was blocked in the Production hosted Account
Portal: sign-in accepts an email identifier, but sign-up offers only the three
social providers. The Clerk dashboard and public environment show optional email.
The readiness audit now rejects this configuration instead of accepting email
sign-in factors as sufficient configuration evidence. See the
[current authentication record](./PERMITEXT_PRODUCTION_AUTH_CONFIGURATION_EVIDENCE_2026-08-29.md).
At that earlier checkpoint, the live setting had not been changed. The new audit guard was published in
PR #39 at `4a3c7a740`. Disposable-account setup and its later export/deletion approval remain
separate from the already completed publication.

## Post-publication account export repair

The operator export and restore checklist used the legacy sync snapshot. On
PostgreSQL that snapshot does not load Research, Notebook, Report, and other
foundation records, so the checklist could report false zero counts. Both routes
now read the exact account's normalized records in a repeatable-read, read-only
transaction. The file adapter exposes the same record families. The versioned
export omits authentication secrets and explicitly excludes private file bytes,
other members' content, global operational logs, duplicate sync journals, and
separate provider replay-protection ledgers. Referenced images still need their
own backup and deletion checks.

The new local deletion exercise also found retained Code Question counters,
pending issuance, and outbox records. Both adapters now remove those account
records during deletion; PostgreSQL includes them in its existing transaction
without creating unused feature tables.

Validation on this repair branch:

- `npm run test:auth` passed, including the new file-backed HTTP export/deletion
  test, operator authorization, credential exclusion, isolation, and removal of
  the synthetic private file.
- The opt-in PostgreSQL 18.6 exercise passed against a fresh disposable loopback
  database using the shipped HTTP handlers and Neon query encoder. Every tested
  account-record family exported before deletion and was empty afterward; the
  second account's complete tested inventory was unchanged. An injected final
  delete failure rolled back the preceding deletes, including Code Question
  metadata. The run observed 15 repeatable-read/read-only batches and made zero
  external database or provider requests. The cluster was stopped and removed.

This repair was published in PR #39 at `4a3c7a740`; both canonical Production
release endpoints returned that exact commit. This did not close the acceptance
gate: at that stage the designated Free account had two saved passages, a
synthetic note, and a saved collection; second-client sync, full
Project/Research/private-image coverage, operator export, reviewed deletion,
identity cleanup, and recreation remained open.
The initially available local operator credential returned HTTP 401; no live
export or deletion was performed at that stage. On September 5 the owner replaced
the operator credential and Production was redeployed from `0985728b2`.
The disposable Free account's export and restore checklist then passed, matching
four saves, one synthetic note, an empty saved collection and the visible browser
state. No shared-ownership blocker or entitlement record was present. The owner
subsequently performed deletion; saved checks confirmed backend/browser content
removal but Clerk required fresh verification and retained the sign-in identity.
The same identity then recreated an empty Free account. The [verification
repair](./PERMITEXT_ACCOUNT_DELETION_REVERIFICATION_REPAIR_2026-09-05.md) addresses
the web/native ordering and cleanup retry. Build 59 is internally available and
passed physical update/build-footer/account/plan/sync/Saved/Project-container
continuity plus initial deletion disclosure/cancellation. The exact empty Free
web account has been exported again and its deletion is explicitly approved;
the final loader is verified on Production. Live verification/cancellation,
approved empty-account deletion, independent Clerk-directory absence and
signed-out reload passed. Fresh recreation, native live verification/deletion
and the broader populated-content/second-client matrix remain open.
See the [operator recovery and export evidence](./PERMITEXT_ACCOUNT_ACCEPTANCE_PREPARATION_2026-09-05.md)
and the updated
[account acceptance runbook](./BETA1_BILLING_IDENTITY_RUNBOOK.md#production-account-exportdeletion-acceptance).

## Post-publication private-file ownership repair

**P0 follow-up, reproduced only with synthetic local accounts:** account cleanup
treated path-shaped authored text as permission to delete a private file. The
legacy Notebook read path also trusted a client-supplied Project identifier as
sufficient file ownership. Both could cross the intended account boundary.

The repair enumerates typed, server-stored binary metadata and checks conflicting
ownership before deleting files. New Notebook uploads use account-scoped paths,
while metadata-backed historical images remain readable. A bare Project ID or
authored reference cannot authorize legacy reads or deletion. Historical
Workboards retain account-hash or registered Project ownership requirements;
unknown or conflicting ownership stops cleanup with an actionable error before
private files or the account are removed. Confirmed account-link ancestry is
preserved. Unattributed historical files are not silently claimed deleted.

The same inventory covers generated Report files and deterministic pending Code
Memo outputs. It inventories only the new account-scoped Notebook upload
directories to remove unconfirmed uploads; it does not sweep shared Project
directories. Recorded storage providers are resolved before deletion, Blob
pagination is checked, and Blob deletes retain batching. Conflicting image IDs
now return HTTP 409 instead of claiming that rejected metadata was saved.

Validation:

- `npm run test:auth`, private-file inventory/storage tests, and the broad
  `node tests/smoke.mjs` passed with synthetic data.
- The shipped upload/read/delete HTTP handlers passed against file storage and
  disposable PostgreSQL 18.6. Foreign references and colliding Project IDs did
  not expose or delete the second account's image. Legitimate reads, rejected
  upload cleanup, unconfirmed-upload cleanup, and account deletion passed.
- PostgreSQL conflicting historical ownership stopped before account deletion;
  the existing transaction-rollback checks also passed. The isolated run used
  1,231 local database requests and 24 repeatable-read/read-only batches, with
  zero external database or provider requests. Its cluster was removed.

PR #39 published this repair at `4a3c7a740`; Production health, universal links,
approved policy hashes, and the disposable account's reload continuity passed.
See the [publication record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#account-export-and-private-file-follow-up-publication).
Publication and live acceptance are separate from these local results. No
Production exploit or real-account deletion was attempted. The native runtime
source remains identical to the previously published build-56 inputs; the only
subsequent file under the native project is an acceptance-document update.

## Account deletion and in-flight requests

**P0 follow-up, reproduced with local PostgreSQL only:** a Notebook upload paused
after authentication could resume after account deletion reported success. The
old request returned HTTP 200 and recreated one private image and one orphaned
image record, despite the account being absent.

The repair adds a durable account-operation guard. Authenticated requests register
their work before proceeding, including the storage owner reached through Project
permission checks. Existing-account sign-in uses the same guard. Deletion claims
the same database row before billing or private-file cleanup; it returns HTTP 409
without beginning cleanup when work is active. A successful claim prevents new
guarded requests until deletion finishes or an ordinary failed attempt releases
the claim. Response completion follows guard release, including streamed
responses. The account's final PostgreSQL transaction locks its parent row first,
and the guard table cascades with that account. Guard acquisition rechecks the
session while locking the account row, so a stale request cannot affect a newly
recreated account. The file adapter retains its existing lock for requests it
already serializes and registers other work durably. Stale file snapshots cannot
remove an active guard or resurrect a finished one; an unchanged Project Hub
read remains free of file-store rewrites.

The operator export now includes nonempty `accountLifecycle` records. Guards do
not expire based on time: a crashed process or uncertain release can leave a
durable blocker that requires support investigation. Removing such a blocker
without proof that its writer stopped would recreate this defect.

Local PostgreSQL HTTP validation passed both race orders: an active upload stops
deletion before files change, then finishes normally and is removed by the next
deletion; a deletion paused during its inventory blocks a new upload and existing
account sign-in. The deleted session receives HTTP 401. The second account's image
remains readable. Export, isolation, transaction rollback, and old unfinished-guard
checks also passed, including rejection of an old operation or deletion token
after recreating an empty Free account. The isolated PostgreSQL 18.6 run made
1,431 local database requests with 29 repeatable-read/read-only batches and zero
external database or provider requests. The full `npm run check`, including its
precheck and postcheck suites, passed. The broad smoke test and authentication,
schema, and performance contracts also passed. PR #40 published this follow-up
at `0331bc844`; both canonical Production endpoints and the rendered account
footer returned that commit. Health, universal links, approved policy hashes,
and disposable-account reopening passed. See the publication record.

This is not full deletion acceptance. Production export/deletion, interrupted
operation recovery, shared-organization ownership, independent client/device
cleanup, and identity recreation still require their own evidence.

### Retained shared-Project ownership follow-up

A synthetic file-backed HTTP exercise reproduced a separate legacy-data risk:
one account stored a Project whose ownership record assigned it to an organization
owned by another account. Deleting the storage account returned HTTP 200 and
removed the Project's ownership, the other member's Project access, and its
private file, while the organization and its owner account remained. The test
used a constructed historical snapshot; it does not establish that the current
visible UI can create that ownership arrangement. No Production data was changed.

Firm administration and collaboration are retired, with existing records retained
for compatibility under `PERMITEXT_DEFERRED_FEATURES.md`. Cleanup must respect the
stored ownership boundary and identify shared records for reviewed legacy
recovery or disposal. Restoring firm administration is not part of this repair.
The repair now checks explicit Project and artifact/link ownership before
billing or private-file cleanup. `ACCOUNT_SHARED_DATA_REVIEW_REQUIRED` returns
HTTP 409 with every deletion stage `notStarted`. The operator inventory includes
Project ownership held by an owned organization even when storage belongs to
another account. It uses the PostgreSQL ownership columns over a stale JSON copy
and reports retained organization membership and scoped-record dependencies,
including records whose Project registry or separate organization column is
missing. Shared-data exports no
longer claim that other members' contributions are certainly excluded.

The legacy transfer route also registers the organization owner's operation
guard before changing ownership. File-backed HTTP checks preserved both complete
account inventories and the private file. Actual isolated PostgreSQL 18.6 checks
passed both owners, incomplete registries, stale ownership JSON, and
transfer/deletion exclusion in both orders. The final exercise also removed the
other membership so the retained foreign artifact alone had to stop deletion of
the organization owner. The run made 1,575 local database
requests, including 48 Serializable and 45 repeatable-read/read-only batches,
with zero external database or provider requests. Authentication, broad smoke,
and the full `npm run check` (precheck, main check, and postcheck) passed. PR #41
published this repair at `42483d6d5`. Both canonical Production release endpoints
and the rendered account footer returned that commit. Production health, Apple
universal links, approved policy hashes, and disposable-account reopening passed.
See the publication record for the exact deployment and evidence boundaries.

This closes neither reviewed legacy recovery/disposal nor full account-deletion
acceptance. A safe stop preserves affected data; it does not migrate it or prove
that an account can subsequently be deleted. Those outcomes remain open.

### Account linking and in-flight requests

**P0 follow-up, reproduced with local PostgreSQL only:** an image upload paused
at the storage provider could resume after account linking consumed its source
identity. Both HTTP requests returned 200, and the late upload recreated one
artifact under the absent source account. No Production account was used.

The merge now locks both accounts and their lifecycle records inside its
Serializable transaction. It allows only the current request's own server-created
guards; active work or a deletion claim on either account stops linking with
`ACCOUNT_LINK_OPERATION_IN_PROGRESS`. Lifecycle rows are established before the
transaction snapshot so a writer registering just after that snapshot cannot be
hidden from the guard. A conflicting snapshot rolls the merge back. The file
adapter checks retained guards under its existing mutation lock. Explicit
sign-in linking, browser repair, and automatic Apple-identity merge paths use
the same boundary; client-supplied operation IDs cannot bypass it.

Local PostgreSQL 18.6 validation passed the upload-first race, the merge-first
race, both owners, retained deletion claims, forged exclusions, a deliberately
stale Serializable snapshot, normal retry, retained private-image access, and
automatic Apple-identity repair. The final isolated run made 1,775 local
database requests, including 62 Serializable and 46 repeatable-read/read-only
batches, with zero external database or provider requests. File-backed HTTP
checks passed unchanged blocked inventories for both owners and normal retry.
Authentication, session hot-path, lifecycle, runbook, and broad smoke checks
passed. The full `npm run check`, including precheck, main check, and postcheck,
also passed. PR #42 published the repair at `acafd9642`. Both canonical
Production endpoints and the rendered account footer returned that commit;
health, universal links, approved policy hashes, and account continuity passed.
See the publication record for the deployment and remaining acceptance limits.

Interrupted-operation recovery and the final Production account-link/deletion
acceptance remain open. This guard does not replay unsent work from another
client or migrate quarantined browser data.

## First repair batch

The draft App Review metadata was also corrected after checking the native
StoreKit account-binding policy: Sandbox transactions on a Production-targeted
build authorize local test state, whereas backend Sandbox verification requires
the isolated staging host. The draft no longer claims that the review purchase
automatically activates Production backend Pro. The actual final-candidate
reviewer access route remains an acceptance blocker; no entitlement, live
configuration, App Store metadata, or submission was changed.

Status: implementation and local verification complete in `38ed70d08` and
`cf0cf0be1`, including the offline compatibility follow-up; isolated on the repair
branch. The second batch below addresses the remaining source defects. Local
verification does not close production or release acceptance.

1. **P0-1, canonical citation edition identity.** Resolve citations using canonical
   section identity; verify the expected edition; fail visibly when the exact
   source cannot be established. Refresh metadata from canonical evidence and
   preserve selected text and historical answer snapshots. Include regression
   coverage for the 2014/2022 section-number collision, saved snapshot identity,
   missing/mismatched sources, and source refresh. Synchronize web shell asset
   versions so a future deployment can deliver the corrected client. Preserve
   per-section editions in new offline downloads and recover them from installed
   chapter metadata for older downloads. Offline detail, hydration, search, and
   number-only citation opening enforce the same identity. Missing or conflicting
   metadata fails closed; empty reserved chapters remain supported. This does not
   add historical 2014 downloading to the existing unversioned downloader.
2. **P0-5, retired Workboard mutation paths.** Enforce the existing documented
   retirement at all four asset/preview write routes with authenticated HTTP 410.
   Reject Workboard sync mutations individually while allowing supported records
   in a mixed batch. Preserve historical drawing reads, private previews, Project
   links, and immutable Report sources. Use imported historical test fixtures,
   rather than a production endpoint, to exercise read compatibility.

## Second repair batch: current status

The second batch is implemented on `codex/production-readiness-fixes`. Native
changes are committed as `d13a24c4e`; the web/server/test batch is committed as
`dcc6cb6cb` and pushed. The readiness contracts, client builds,
smoke, main check, and postcheck passed. Precheck passed across its original run
and the resumed tail after obsolete assertions were updated for the repaired
contracts. This is aggregate suite evidence, not a single uninterrupted
`npm run check` invocation. Final candidate and release acceptance remain separate.

## Account-link recovery follow-up

Fresh authenticated sign-in now reconstructs export-only access from the server's
confirmed merge checkpoint, including after a lost merge response. Both storage
adapters preserve source ancestry through A → B → C. Client-supplied credential
metadata cannot create that history. Sync batches and local-data attachment also
cannot overwrite the authenticated account or billing fields. Retained local work is never replayed or
retargeted automatically, and unrelated/current browser accounts confer no access.

The extended real PostgreSQL test also reproduced an existing account-link HTTP
500 (`42P18`, untyped JSON-constructor parameters). Explicit text casts repair the
account and entitlement merge statements. The final local PostgreSQL run passed
946 SQL requests and 39 Serializable batches, including linked Project and Pro
entitlement transfer, old-session rejection, successive links, forged-metadata
rejection, one winner for competing links, and the earlier
Research/Notebook concurrency cases. This does not prove the deployed lifecycle.

The full `npm run check` completed successfully. The subsequent sign-in response
sanitization passed targeted account and authentication regressions. Actual local browser
sign-out/reopen/sign-in after a deliberately withheld link response restored the
source export control; clicking it reported a downloaded recovery file. The
browser fixture had no retained source draft bytes; the actual-function contracts
separately verify exact-owner drafts/images, quota warnings, and no automatic
replay. Web assets are synchronized at `20260904-readiness-recovery-v37` and shell
`permitext-pro-shell-v776`. Native source is unchanged by this follow-up.

## Whole-section saves missing from Unassigned Saved

**Acceptance follow-up, reproduced with the disposable Production account:**
saving Building Code (2022) 1010.2, Gates, directly from Search increased the saved
quota count, but the section was missing from Unassigned Saved. A paragraph save
of Building Code (2014) 1010.2, Slope, remained visible. Reload retained the quota
count and the omission; this was a visibility defect, not a demonstrated deletion.

Canonical saved keys now include a block component. The unassigned filter still
treated a trailing colon as a missing section, excluding valid whole-section
saves whose block component is empty. It now checks the actual section identifier
before constructing the key, then excludes only exact records linked to an active
Project or collection. The existing edition and paragraph boundaries remain.

The new regression failed before the fix: it omitted both valid whole-section
editions and admitted a malformed record with a block but no section. It passes
afterward, including exact-scope assignment and a deleted collection. Evidence,
Saved-summary, and offline contracts pass. The full `npm run check` (including
precheck and postcheck) and broad smoke also passed. The isolated browser's Search save now
appears in Unassigned Saved, survives reload, and reopens Gates in the 2022 Reader;
no browser console error was captured. Local served client bytes match the repair.
Web asset version is `20260905-saved-section-visibility-v38`, shell
`permitext-pro-shell-v777`. PR #43 published the repair at
`1afdafd19ca4947d19e46350748506668c90790c`. Both Production origins returned that
exact revision and matching client bytes. The same disposable account now shows
all four saved entries; Gates reopens in the 2022 Reader and Slope in the 2014
Reader. Health, universal links, approved policy hashes and the bounded browser
console check passed. This follow-up changes no native runtime source. See the
[publication record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#whole-section-saved-visibility-publication).

## Native navigation accessibility follow-up

The Release Simulator capture exposed a P2 navigation-label defect. Its actual
accessibility hierarchy named Saved as `Move` and both Readers by their SF Symbol
identifiers. The destination labels were applied to each tab's content instead
of its tab-item image. Chapter cards also announced `Chapter Chapter 7` because
the display label already included the prefix.

The repair puts each destination label on the tab item and uses the existing
chapter/appendix display label once. The initial Release UI capture failed to
find Saved by its destination name; after repair, all five tab names passed.
The final local build-58 capture also verified the 2022 Building Code chapter
picker, Chapter 7 Reader without its debug control, search results and anonymous
Saved content. The existing Xcode wrapper now provides a serial, Release-only
Simulator capture command; it requires the signed-out UI before collecting the
four named submission captures. Raw failure diagnostics still require restricted
handling and visual review before any sharing.

PR #44 published full source `9a89e54e7b70ccb7567b784443b232df005a10ac` to
Production, and the signed build-58 archive from that source passed verification.
The initial Apple account-access failure was resolved after the owner restored
sign-in. The same archive uploaded successfully at `2026-09-05T12:32:56.741Z`;
build 58 is processed and available to Internal Testers. See the
[publication and retry record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#build-58-upload-after-apple-sign-in-recovery).
Local Release/accessibility-tree checks do not establish physical VoiceOver
acceptance. The owner installed build 58 through TestFlight; the running app's
Account footer independently confirmed the build. Existing account/plan/sync,
Saved/Project containers and the Fuel Gas Code 2022 selection were retained.
The owner confirmed the VoiceOver chapter/navigation spot-check. Saved-source
and Search-result reopening also passed at their exact 2022 provisions. The
broader final-device matrix remains open; these checks do not establish full
accessibility, offline, conflict, deletion or professional-handoff acceptance.
No account deletion, paid Research or public App Store submission was used.
The prior build-33 screenshot package remains historical.

## Critical findings

September 5 follow-up: real browser storage testing found and repaired a stale
tab overwriting another tab's unsent Notebook/Project information text. Both
versions now survive with guarded comparison and recovery exports. See the
[device-draft concurrency repair and verification record](./PERMITEXT_WEB_DRAFT_CONCURRENCY_REPAIR_2026-09-05.md).
This strengthens P0-4/P0-6 coverage without closing their remaining device and
deployed-environment acceptance requirements.

| ID | Finding | Implementation and local evidence | Remaining acceptance |
| --- | --- | --- | --- |
| P0-1 | Historical citations can open a different provision or edition. | First-batch canonical identity and offline compatibility repairs are complete. Citation contracts pass; the browser rendered the distinct 2014 and 2022 same-number provisions with the correct edition. | Verify saved-citation, refresh, offline, and native paths in the final release candidate; no fresh paid Research acceptance is claimed. |
| P0-2 | Research moved between Projects retains prior active facts/history. | Implemented Project/context revision boundaries, fresh active history/facts after move or unassign, and rejection of generation started under the old context. Historical answers remain immutable. Context, concurrent HTTP, and real local PostgreSQL move/completion races pass. | Complete final cross-platform Project → Research → Report acceptance and deployed-environment verification. |
| P0-3 | Account transitions fail to isolate private state and async results. | Implemented owner/session/generation guards, per-account and guest workspace storage, conservative legacy quarantine, native account-scoped state, and guarded mutation/timer/error/finally paths. Deferred actual-function tests include A → B → A, stale 401, SDK callbacks, and captured-owner deletion cleanup. Linking checkpoints local work and fences same-tab editing; confirmed source work has an export-only recovery path. Build 60's approved populated-account deletion passed independent account/file/provider checks and signed-out web reload. | Complete remaining account-switch/link tests and review the explicit legacy recovery limits below. Cross-tab merging is not a transaction and source work is not automatically replayed. |
| P0-4 | Offline cleanup deletes unsynchronized Notebook drafts/images. | Public code cleanup preserves private stores. Draft metadata, immutable pending-save journals, conditional acknowledgement, conflict review, owner deletion tombstones, and exact-owner recovery exports are implemented. Transactional storage tests pass. A synthetic browser 503 → 403 → reopen/export → restored-access flow preserved the Note title and returned to Synced. | Exercise device storage pressure, background termination, image upload/reconnect, and deletion failure recovery on the final native/browser candidates. Retained unattributed legacy bytes are not claimed deleted. |
| P0-5 | Retired Workboard writers do not enforce read-only compatibility. | First-batch authenticated 410 responses and per-record mixed-sync rejection are complete. Historical reads, previews, and immutable Report sources pass imported-fixture HTTP regressions. | Verify final deployment/candidate compatibility; no live PostgreSQL write test or production exploit was performed. |
| P0-6 | Concurrent Notebook/Research writes lose changes despite success. | Implemented atomic expected-version/context checks and exact retry receipts for Notebook, Research completion, and Project information. Newer drafts survive acknowledgement and reopen. File-adapter Research metrics, credit and usage updates now hold the lock across the entire mutation. Real local PostgreSQL acceptance passed 34 Serializable batches, rollback and charge-once replay. | Final cross-device and deployed-environment acceptance remain required. The local PostgreSQL transport does not verify Neon cloud configuration or transport. |

The original audit classified security, lost work, incorrect citation relationships,
and credible cross-project contamination as P0. Isolated reproductions and source
traces establish these repair priorities; they are not reports of observed
production customer incidents.

## High-priority findings

| ID | Finding | Implementation and local evidence | Remaining acceptance |
| --- | --- | --- | --- |
| P1-1 | Fact normalization loses negation, partial scope, and assumptions. | Shared qualification/projection helpers preserve original wording and qualifiers; only unambiguous assertions become established facts. Partial sprinklers, negated status, embedded hypotheticals, legacy inflated facts, and follow-ups pass focused tests. | Review meaning preservation in the final candidate's Project → Research → Report workflow. Extraction tests do not establish generated-answer quality. Retain the accepted Beta evaluation scope below; this finding does not require a new paid cohort. Any selected new provider-backed confirmation needs its own exact scope and authorization. |
| P1-2 | Streaming errors discard recovery information. | JSON/stream responses share a safe error envelope. Web recovery preserves conflict/source/prerequisite details, offers current-state review, and rejects obsolete account responses. Recovery contracts pass. | Verify current-source review and retry with representative final-candidate workflows and provider failures; no new paid run is included. |
| P1-3 | Private cache deletion/revocation lifecycle is incomplete. | Implemented owner-scoped native/web cleanup, persistent deletion tombstones, and authorization/deletion-sensitive cache fallback. Authored device work has a separate recovery route when access is unavailable. Native/web contracts and build-60 populated-account deletion passed; independent checks confirm all five private files absent and no resurrection after web reload. | Complete stale independent-writer tests on actual devices and explicit treatment of unattributed legacy bytes. Native cleanup discloses retaining unknown-owner historical cache files. |
| P1-4 | Final release acceptance remains incomplete for the repaired candidate. | Retain the accepted Research/no-cost economics scope, the owner's six-case Zoning Beta sequencing decision, passed controlled Stripe and Apple Sandbox/TestFlight lifecycles, passed support/restore exercises, and accepted bounded daily monitoring. These are historical evidence with their original limits; source fixes do not establish final candidate acceptance. | Bind the exact candidate to Production and TestFlight, verify supported client/authentication/account-deletion and privacy workflows, reconcile remaining non-charge billing evidence, complete the distinct spend-notification/hard-stop acceptance, and obtain final owner go/no-go. No new paid cohort or automatic repetition of passed payment/monitoring decisions is required. |

## Release acceptance reconciliation

The controlling [Beta 1 acceptance record](./BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md)
and [master plan](./PERMITEXT_BETA1_MASTER_PLAN.md#release-blockers-at-a-glance)
separate accepted historical evidence from final candidate verification. P1-4
does not reopen these decisions:

- **Research and Zoning:** the owner moved the six unresolved Architecture V2.1
  cases into post-launch Beta observation on September 2. Retain the original
  12 passing delivered answers, one delivered qualification failure, five
  uncharged verifier blocks, and 12 prerequisite boundaries without rescoring.
  No additional pre-Beta paid cohort is planned. Exact-candidate citation,
  context, accounting, recovery, limitation disclosure, and physical-client
  acceptance remain open; this is not blanket professional approval of answers.
- **Payments:** retain the passed controlled Production Stripe charge,
  entitlement, cancellation and refund, plus the Apple-created Sandbox/TestFlight
  lifecycle. Recheck changed paths and bind compatibility to the selected release.
  The acceptance record expressly avoids another paid Stripe repetition unless
  billing logic or Production configuration materially changes. Remaining
  non-charge replay/customer-cleanup evidence is separate from a new purchase.
- **Monitoring, support and restore:** retain the owner-accepted Vercel anomaly
  rules plus daily privacy-bounded review, with direct health fallback. Immediate
  delivery for every warning was not required by that accepted Beta alternative.
  Reverify its marker and bounded audit on the selected deployment. The synthetic
  support tabletop and isolated provider restore passed; refresh affected support
  recovery instructions locally without relabeling those exercises incomplete.

The remaining acceptance sequence is:

1. **Bind the candidate and finish technical verification.** Record the common
   full source SHA, Production release/deployment, and final native archive/build.
   Finish database concurrency, archive/privacy aggregation, and supported-device
   checks, including wide tables, VoiceOver, offline/reopen/conflict recovery, exact
   citations and the qualified Project → Research → Note → Report handoff. Earlier
   publication/build evidence does not stand in for this candidate. Existing
   authorization in the active work session continues to govern publication work.
2. **Complete account and client consent evidence.** Exercise fresh/existing
   email, Apple, Google and Microsoft sign-in with the intended identities, then
   the complete export/deletion lifecycle on a dedicated disposable account.
   Provider sign-in may need owner participation; destructive deletion/provider
   cleanup needs an explicitly authorized target and scope. Preserve the actual
   legacy/quarantine and merge-recovery limits. Verify final-client policy consent
   and retainable acknowledgment against the already approved policy bytes.
3. **Finish the narrowly open owner/operations items.** Obtain only nonsensitive
   owner corroboration of the issued certificate's effective date and the filing
   process; do not request or retain a certificate image. The tax configuration,
   certificate possession/display, approved policies, and no-attorney self-review
   decisions are already recorded. Spend Management notification and isolated
   pause/resume evidence remain distinct from accepted daily monitoring: any
   provider pause needs exact authorization, and the owner must disposition the
   automatic-threshold evidence. Do not spend or lower the budget to force it.
4. **Finish the Apple/privacy package, then obtain final go/no-go.** Prepare final
   metadata, reviewer access, content/age/privacy answers, subscription material,
   and the intended Production notification configuration before asking for
   missing owner attestations or provider changes. Preserve approved local
   privacy classifications; new public wording still needs exact owner approval.
   Update the acceptance/machine records only when their evidence is sufficient.
   App Store submission and public release remain the final separately authorized
   actions; no historical cohort or paid-turn authorization permits a new run.

This reconciliation changes no runtime rollout control, machine gate, historical
outcome, price, allowance, or owner decision. The machine record remains open
until the exact candidate and remaining evidence satisfy its requirements.

## Medium-priority findings

| ID | Finding | Implementation and local evidence | Remaining acceptance |
| --- | --- | --- | --- |
| P2-1 | Collapsed Project facts remain focusable/exposed. | Hidden controls are removed from focus/accessibility exposure. Root browser verification covered collapse and accessibility state. | Complete final keyboard and assistive-technology acceptance across supported layouts. |
| P2-2 | Report omits structured Project facts used by Research. | Shared qualified projection feeds Report sources and immutable manifests. PR #52 fixes stale visible Note snapshots and native PDF Project-facts rendering. Production promotion/export, a native two-page PDF regression, and the actual build-60 physical export passed with qualified facts preserved. | The reproduced PDF omission is verified repaired. Remaining full professional Research handoff acceptance stays open. |
| P2-3 | Native Notebook initial-load errors appear empty/read-only. | Loading/error/permission/device-recovery states and retry behavior are implemented and locally tested. Web recovery preserves authored drafts through 503/403 failures. Build 60 displayed explicit Notebook unavailable/requires-Pro after final grant revocation; restored access and image recovery passed earlier in the bounded temporary-grant cycle. | Final-device offline, unsent-draft, and broader restored-access verification remain required. |
| P2-4 | Reader chrome inconsistently identifies edition. | Native/web edition labels and citation identity repairs are implemented; actual browser 2014/2022 rendering was verified. | Confirm visible and accessible labels at arbitrary scroll positions in the final candidate. |
| P2-5 | Tablet toolbars collide and phone-web scope is unclear. | Root checked 320/375/390/430/768/1024/1280/1440 widths with no observed overlap, and 44-pixel tablet targets. Supported mobile scope remains explicit. | These browser checks do not replace physical touch, native wide-table, or VoiceOver acceptance. |
| P2-6 | Exact-match search behavior is insufficiently explained. | Exact-match disclosure and term-search recovery are implemented, tested, and verified in the actual browser. Results retain their source/edition boundary. | Final-candidate search recovery and accessibility acceptance remain open. |
| P2-7 | Startup waits on secondary catalogs and a large central client. | Usable workspace restoration is decoupled from secondary catalogs/trust metadata; authentication precedes private rendering. Controlled request-latency tests improved usable-shell time from about 250 ms to 42 ms. Restore tests cover initialization ordering and malformed snapshots; actual browser reload preserves panes. | This is a controlled timing result, not device paint or p50/p90 performance acceptance. Representative-device measurement and continued large-client performance review remain open. |

## Additional acceptance and polish

- The second-batch reload defect was reproduced as initialization-order and
  workspace-restore failures and repaired without replacing unreadable saved
  layouts. The original audit's unexplained apparent guest transition is not
  proven to have the same cause; retain a final candidate session/reload check.
- Physical wide-table access passed on build 54: the owner swiped through
  2022 Fuel Gas Code Table 504.2(2) to its far-right 12-inch columns. Mirroring's
  horizontal scroll did not move this table and is not a direct-touch result.
- The owner confirmed VoiceOver reads the table's headings and numbers clearly
  and scrolls through it with the three-finger gesture. This is a bounded physical
  traversal result, not full accessibility certification or verification of
  programmatic header associations for every table. Broader keyboard/contrast
  and supported-device coverage remain separate.
- Verify the professional path: Project → Research → exact cited provision →
  qualified notes/Notebook → Report → reopening on iOS.
- Web and native answers now give a concrete next step: open cited provisions,
  verify Project facts and assumptions, and record a human conclusion in a Note
  before adding it to a Report. A generated answer is not a reviewed decision.
- Native empty-history/loading wording and the obsolete sparkle instruction were
  corrected. The focused web Reader now remains fully visible after window resize;
  actual 768/1024-pixel and restored desktop checks verified both pane edges.
  These changes do not close the data, authority, or release gates above.
- The historical Reader find overlap received a bounded repair. Root's v33
  browser check confirmed preserved body/table geometry and the header mask while
  find was open. Final device and assistive-technology checks remain required.

## Known recovery limits

The [account recovery support procedure](./BETA1_OPERATIONS_RUNBOOK.md#account-cleanup-and-linking-recovery)
now covers operation blockers, partial cleanup, shared ownership, restricted
exports and the separate device/provider outcomes. It documents investigation;
it does not claim that interrupted guards or shared-data disposal were exercised
in Production.

- **Unattributed legacy data:** ambiguous legacy workspace/Workboard bytes remain
  retained and unavailable to normal guest/account hydration. No account is
  assigned ownership by guessing. Scoped account deletion removes provably owned
  current data; it does not claim to erase all unattributed legacy bytes.
  An interrupted migration whose destination has subsequently changed preserves
  both versions and quarantines the complete legacy snapshot. Exact-copy retries
  can finish; quota/partial-copy/conflict regressions pass.
- **Confirmed account merges:** the same-tab preflight checkpoints open Notes and
  blocks on draft/image/queue/conflict/local-edit/storage failures or active work.
  A write fence prevents new same-tab edits while connecting accounts. After an
  exact server-confirmed source/destination receipt, source namespaces remain
  intact and the destination can export retained source work for review. Source
  bytes are not automatically retargeted or replayed.
- **Cross-tab arrivals:** another tab can write source work after preflight. A
  later recovery export reads those retained bytes, but this is not atomic
  multi-tab migration or automatic synchronization into the destination.
- **Lost merge receipt:** a subsequent authenticated sign-in reconstructs recovery
  access using server-confirmed ancestry. Recovery requires that fresh response;
  the client does not infer ownership while offline.
- **Successive merges:** A → B → C now preserves both sources in C's server
  checkpoint. Legacy account metadata was client-writable and is not proof of
  ownership. Older merges without a server checkpoint or an existing confirmed
  local receipt still require ownership review; their source bytes remain intact.
- **Recovery-index storage failure:** an in-memory confirmed receipt supports
  immediate export and a visible warning to export before closing the page.
  Durable recovery-index failure is not represented as a successful durable save.

## Development order and preserved strengths

1. Correctness, authorization, identity/context isolation, and durable work.
2. Recovery, qualified Project facts, and the investigation-to-Report handoff.
3. Measured startup/search/Research performance, preserving verification before
   final answer delivery.
4. Accessibility, edition visibility, responsive toolbar, and physical interaction.
5. Wording, loading transitions, and other polish.

Preserve the multi-pane desktop Reader, independent native readers, authoritative
source presentation, canonical source checks, immutable evidence/answer history,
bounded verification/repair, durable request identifiers, and explicit professional
review gates. Do not start a framework or visual-system rewrite to address these
bounded failures.

## Verification ledger: baseline and first batch

- Baseline metadata: project/plist semantic equality confirmed; plist validation
  and privacy contract passed.
- Baseline native tests: 163/163 passed, zero failures, at the pinned baseline SHA.
- Baseline native archive: succeeded, strict deep signature verification passed;
  archived app privacy manifest matches the baseline semantically. Upload
  succeeded on September 4 at 20:50:07 UTC. See the baseline record for Apple state.
- Server precheck and main check suites passed. The initial final `postcheck`
  stopped on stale local Tiptap 3.29.0 versus locked 3.30.4. `npm ci` restored the
  existing lockfile; rerun `npm run postcheck` passed, including Notebook dependency
  security and the UX alignment checks. No dependency version was changed.
- `npm run build:clients` passed with the locked Notebook dependency.
- Citation integrity and Workboard retirement HTTP regressions passed again after
  the final edits; `node tests/smoke.mjs` passed using isolated local data and no
  provider credentials. Historical Report preview/read assertions remain covered.
- Actual local browser: opened 2022 BC 1010.2 Gates from Search and 2014 BC 1010.2
  Slope through the historical Reader; correct labels and enacted passages rendered;
  no browser console errors observed. Saved-citation/source-refresh branches are
  covered by the behavior contracts, not a fresh paid Research UI run.
- Final offline follow-up: expanded citation behavior contract passes for new
  and legacy cached detail/batch/search responses, all supported code families,
  number-only citation resolution, mismatched metadata, and empty/contradictory
  downloads. Offline contract and syntax checks passed. Tests use in-memory
  storage boundaries; no real offline library was replaced or deleted.
- Workboard retirement received an independent read-only implementation/test
  review with no actionable findings. No live PostgreSQL mutation test was run;
  filtering is shared before the two storage adapters.
- Baseline Production health and Apple association checks passed after deployment;
  no error/fatal runtime logs found for this deployment in the checked window.
- No real account deletion, customer-data mutation, paid Research call, App Store
  submission, public release, pricing/allowance change, or rollout-gate activation
  forms part of this batch.

## Verification ledger: second batch

- **Source status:** native commit `d13a24c4e` and web/server commit `dcc6cb6cb`
  are on the repair branch. Local and remote matched the full application SHA
  `dcc6cb6cbe6ea6341ac77771ed96417e368d61fd`. Vercel Preview
  `dpl_4iGxbhHJcYVswGFW3c7EaiFmYmDT` is READY; protected fetches returned SSO
  redirects, so direct Preview endpoint identity is not claimed. Both Production
  release endpoints still returned baseline `176cca6f2e2d01db6495f29192f805ef7daddfbe`.
  The repair candidate has not been published to Production, TestFlight, or the
  App Store.
- **Native:** 176 unit tests and seven UI tests passed. Build 54 was archived
  from a clean detached checkout at `dcc6cb6cb`; strict development signature and
  matching entitlements passed. Aggregate privacy matched source (13 categories,
  three API groups, no tracking). In-place installation and device metadata
  verified version 1.0 (54). Mirroring retained the existing signed-in account,
  Lifetime Pro, Synced, Project containers, saved section and prior code selection.
  The owner confirmed direct finger scrolling reaches the far-right 12-inch
  columns of 2022 Fuel Gas Code Table 504.2(2), a 29-column table. The visible
  Reader header retained Fuel Gas Code · 2022 while scrolling. The owner then
  confirmed clear VoiceOver heading/number reading and scrolling after using the
  standard three-finger gesture. No replacement of enacted table values or new
  gesture implementation was needed.
- **Combined local checks:** `npm run test:readiness-recovery` and
  `npm run build:clients` passed. The readiness script includes qualified facts,
  Project fact projection, account isolation/mutation guards, durable Notebook
  storage, Research context/concurrent HTTP, startup/restore, stream/search/device
  recovery, Project information durability, and file-store concurrency contracts.
- **Broad suite passed across resumed runs:** precheck evidence is retained in
  `/private/tmp/permitext-readiness-full-check-verified-20260904.log` and its
  completed tail in `/private/tmp/permitext-readiness-precheck-tail-20260904.log`.
  `npm run --ignore-scripts check` and `npm run --ignore-scripts postcheck` both
  exited zero; their logs are `/private/tmp/permitext-readiness-main-check-agent-20260904.log`
  and `/private/tmp/permitext-readiness-postcheck-agent-20260904.log`.
  `node tests/smoke.mjs` separately passed; its record is
  `/private/tmp/permitext-readiness-smoke-agent-20260904.log`. Obsolete literal
  expectations were updated to assert the repaired account guards, retained
  recovery namespaces, qualified facts, startup, journal, and mobile behavior.
  Actual deferred account-switch and exact merge-receipt assertions were added.
- **Persistence and billing:** file-adapter overlap tests use disposable synthetic
  stores and deterministic barriers. They preserve unrelated committed answers,
  credit debits, and other accounts' metrics; a negative control reproduces the
  former stale metric snapshot overwrite. Reservation/credit duplicate and stale
  reconciliation behavior remains covered. The isolated Research billing
  lifecycle, turn, credit-ledger, and idempotency checks passed without providers.
- **PostgreSQL:** a disposable local PostgreSQL 18.6 cluster passed 834 actual SQL
  requests, 34 Serializable batches and four simultaneous move/completion races.
  Production HTTP handlers and Neon query encoding were exercised through a
  test-only local transport. Rollback, exact replay and charge-once behavior passed.
  See `PERMITEXT_LOCAL_POSTGRES_READINESS_2026-09-04.md` for provenance, reproduction
  and the remaining Neon cloud/deployment boundary. The temporary cluster and
  runtime were stopped and removed; no Production database or provider was used.
- **Actual browser:** root verified the eight listed widths, tablet targets,
  collapsed facts' accessibility state, exact-search term recovery, historical and
  current edition rendering, qualified Report text in revision 2, v33 Reader
  find/body/header behavior, and v34 focused-pane visibility after resize.
  A synthetic Notebook unavailable/forbidden/reopen
  recovery flow retained authored work for read/export; restoring access loaded
  the preserved title and returned to Synced.
- **Selected-passage browser handoff:** an isolated mock-provider question began
  from BC 107.9.1 with the assigned Project. The completed answer visibly retained
  "Only the cellar is sprinklered" and the unverified upper-floor assumption,
  disclosed that the facts were not independently verified, and offered the next
  human review/Note/Report step. Its supporting citation opened canonical section
  1567, BC 903.1.2 Construction documents, with Building Code (2022) visible.
  This is workflow evidence with a synthetic provider, not professional answer
  quality or paid-generation acceptance.
- **Evaluation gates:** no new professional Research/Zoning cohort or paid model
  run was performed. Retained Zoning V2.1 evidence remains 12 of 30 cases both
  delivering an answer and passing, with 13 delivered, five verifier blocks, and
  12 prerequisite boundaries; this does not clear the public release gate. Current release-shaped
  professional review and full-service cost evidence remain required.
- **Scope:** checks used local synthetic fixtures or the stated read-only/rendered
  inspection. No customer-data cleanup, production exploit, real account deletion,
  payment execution, deployment, release submission, price/allowance change, or
  rollout-gate activation is authorized or claimed by this second-batch ledger.
