# Permitext Neon/Blob recovery drill evidence — August 28, 2026

## Result

The owner authorized an isolated, no-paid-add-on provider recovery exercise while retaining the standing prohibitions on merge, push, Production deployment, pricing changes, paid model calls, real billing actions, and Production application-data writes.

The provider recovery work passed:

- Neon forked a child branch from the `main` branch's retained history in 0.39 seconds;
- source and restored schemas matched across all 38 `permitext_*` tables;
- exact content digests matched across 3,611 rows before application access;
- entitlement aggregates and an entitled representative account matched;
- the exact serving Production commit successfully opened the restored database through an isolated local server; and
- the permanent fail-closed restore verifier passed with zero mismatches across 27 durable summary families, release identity, sync cursor, representative-account state, and the supplied 124-object private-asset inventory.

The initial August 28 exercise left deployment-level behavior and a separate provider Blob namespace open. The owner subsequently authorized that isolated no-cost follow-up. On August 29, the exact serving Production commit ran successfully as an SSO-protected Vercel Preview against a new time-limited Neon recovery branch, and all 124 private source objects were restored into a separate private Blob store with byte-for-byte equality. The full public-Beta restore gate therefore passes without a Production deployment, Production-data write, real charge, or provider-plan upgrade.

## Initial exercise authorization and isolation

- Operator: Codex-assisted Permitext owner session
- Approver: Permitext owner
- Exercise start: `2026-08-28T15:52:03.312Z`
- Verification pass recorded by: `2026-08-28T16:10:28Z`
- Cleanup completed: `2026-08-28T16:13:55Z`
- Production application-data writes: **None**
- Production Neon connection use: direct `SELECT` queries only
- Billing, email, Apple notification, Stripe webhook, Research generation, and Blob writes in the local target: **Disabled or unconfigured**
- Vercel deployment: **None created**
- Paid add-on or plan change: **None**

Connection strings and temporary administrator credentials were held only in a mode-`0600` temporary directory. They were not printed into evidence, added to the repository, or placed in a deployment environment.

### Follow-up acceptance authorization and isolation

- Follow-up recovery point: `2026-08-29T22:49:29.409-04:00`
- Verification completed by: `2026-08-30T03:08:48Z`
- Production application-data writes: **None**
- Isolated Vercel project: `permitext-restore-acceptance` (`prj_PdvOBsTg3D9LH7TqZuldBj2CpG3O`)
- Ready target: SSO-protected Preview deployment `dpl_D8NYCyGxfLVjVpBDi666HZ79udXg`
- Provider-write configuration: only the isolated recovered Neon connection and the isolated private Blob credential were present
- Billing, email, Apple, Stripe, OpenAI, and paid Research configuration: **Absent or explicitly disabled**
- Paid add-on or provider-plan change: **None**

The first isolated-project deploy command selected Vercel's Production target by default. Permitext's production-readiness guard rejected that build because commercial billing configuration was intentionally absent, so it never became a ready deployment. The same committed bundle was then deployed explicitly as Preview and passed. Neither attempt changed Permitext Production or any production alias.

## Neon recovery point

- Neon project: `permitext-sync-db` (`ancient-sunset-27268627`)
- Source branch: `main` (`br-fancy-grass-aq73byy8`)
- History retention confirmed in the live Neon console: **6 hours**
- State before the drill: 1 of 10 included branches, approximately 55.09 MB of 0.5 GB storage, Free plan
- Recovery point selected in `America/New_York`: `2026-08-28T12:01:31.301-04:00`
- Isolated branch: `permitext-restore-drill-20260828` (`br-cool-dawn-aq1esvjo`)
- Parent: `main`
- Fork time reported by Neon: **0.39 seconds**
- Automatic expiry set by Neon: August 29, 2026 at approximately 12:01 PM EDT
- Serving Production release: `dbbb6ab40d40`
- Serving Production Git commit: `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3`

Neon `main` was never restored, reset, renamed, disconnected, or pointed at the child branch.

### Follow-up Neon recovery branch

- Recovery point selected in `America/New_York`: `2026-08-29T22:49:29.409-04:00`
- Isolated branch: `permitext-restore-acceptance-20260829` (`br-spring-dawn-aqpcccb1`)
- Parent: `main` (`br-fancy-grass-aq73byy8`)
- Fork time reported by Neon: **2.23 seconds**
- Automatic expiry: **one day after creation**
- Plan and capacity result: the branch remained within the existing Neon Free allowance; no upgrade was requested

The follow-up branch is a separate point-in-time child. Production `main` remained the serving branch and was not modified.

## Database verification

Initial direct provider comparison completed at `2026-08-28T16:05:20.902Z`:

- source and target hosts were different;
- database and role were `neondb` and `neondb_owner` on each host;
- 38 Permitext tables existed on each side;
- source and target each contained 3,611 rows; and
- every table count matched.

The stronger content-digest comparison completed at `2026-08-28T16:06:12.825Z` with zero mismatches across all 38 tables and all 3,611 rows. Aggregate entitlement parity was:

- four `pro` lifetime-grant entitlements; and
- one `pro` web-subscription entitlement.

The Apple transaction-ownership table also matched exactly and contained one record. There was no active Apple-sourced entitlement to exercise as an entitlement read.

The representative entitled account was recorded only as fingerprint `3a86204924af8d9d`; no account identifier, name, email, provider transaction identifier, or customer content is retained here. Its source and restored account/entitlement digests and the following counts matched:

- 5 Projects;
- 34 Research conversations and 27 Research answers;
- 3 foundation artifacts;
- 6 Project links; and
- 24 activity events.

Aggregate restored artifact parity included:

- 19 Notebook cards and 2 Notebook image records;
- 2 Report drafts, 2 Report manifests, and 2 generated Reports;
- 120 Workboard previews;
- 4 Project notes, 2 review threads, and 1 code question.

## Exact-application compatibility and permanent verifier

A detached temporary worktree at the exact Production commit ran locally against only the isolated Neon child branch. It reported:

- `/health`: HTTP 200 with `postgres` storage;
- `/release`: HTTP 200, environment `preview`, and the exact Production commit;
- `/admin/storage/summary`: HTTP 200 with `normalized-v4`; and
- `/admin/accounts/restore-checklist`: HTTP 200 for the representative entitled account.

The local administrative reads incremented only the isolated `permitext_rate_limit_buckets` operational counter. No durable customer record changed. A post-read digest comparison identified that one expected ephemeral mismatch and no durable-data mismatch.

The checked-in command `npm run verify:restore-drill` then passed through a local read-only source proxy and the exact-commit isolated target:

```text
pass: true
mismatches: []
comparedDurableTableCount: 27
source/target storage: postgres
source/target schema: normalized-v4
source/target latestEventID: 10543
source/target Git commit: dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3
source/target privateAssetCount: 124
```

The proxy queried Production Neon only with `SELECT` statements. The target used loopback HTTP and the isolated provider branch, not a Vercel deployment.

### Protected deployment acceptance

The follow-up deployed a committed-only archive of exact serving Production commit `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3` to the isolated `permitext-restore-acceptance` project. The successful target is Preview deployment `dpl_D8NYCyGxfLVjVpBDi666HZ79udXg` at `permitext-restore-acceptance-ij6no9i7x.vercel.app`. Vercel SSO protection applies to all non-custom-domain deployments for this project, and authenticated CLI access generated a temporary bypass without making the host public.

Fresh application checks returned:

- `/health`: HTTP 200, `postgres`, `normalized-v4`, environment `preview`, release `restore-dbbb6ab40d40`, and the exact Production commit;
- `/release`: HTTP 200 with the same Preview environment and exact Production commit;
- `/admin/storage/summary`: HTTP 200 with 30 application summary families, 3,622 rows, and latest event ID 10,546; and
- `/admin/accounts/restore-checklist`: HTTP 200 for representative account fingerprint `b3145748fa9d75d5`, with the account, public profile, active session, two passkey credentials, 47 saved items, 26 annotations, 23 Projects, 47 Project memberships, two Workboards, four continuity records, and 11 code-version-clear records present.

The representative account identifier, public username, credential identifiers, and customer content are not retained. Vercel reported zero runtime error logs and zero 5xx requests for the successful deployment during acceptance. The team usage report continued to round billed cost to `$0.00`; no upgrade, add-on, or on-demand spend was required.

## Private Blob evidence

The private `permitext-workboards` Blob store (`store_b7Lpyr2Ub2GDcHEb`) was inventoried from `2026-08-28T15:52:03.312Z` through `2026-08-28T15:52:03.760Z`:

- access: private;
- region: `iad1`;
- namespace prefix: `project-assets`;
- objects: **124**;
- bytes: **5,248,939**;
- asset classes: 120 PNG, 2 JPG, and 2 PDF.

One private object from each class was authenticated, downloaded to memory, and checked against its provider metadata size:

- JPG: 66,368 bytes, SHA-256 prefix `c4f9453d36cf`;
- PDF: 6,912 bytes, SHA-256 prefix `42230a83556f`;
- PNG: 3,745 bytes, SHA-256 prefix `a6b904b1af7b`.

All three size checks passed. No path, user identifier, asset contents, or signed URL is retained. No Blob was uploaded, copied, overwritten, or deleted.

### Separate private Blob restore

The follow-up created private store `permitext-restore-acceptance` (`store_JqmlrUeYX0abaH3m`) in `iad1` and connected it only to the isolated recovery project. The source `permitext-workboards` store remained private and unchanged.

- source objects: **124**;
- restored objects: **124**;
- source bytes: **5,248,939**;
- restored bytes: **5,248,939**;
- exact content matches: **124**;
- mismatches: **0**; and
- restored namespace access: **private**.

Objects were read and written in memory through the provider SDK; no customer path, user identifier, object body, or signed URL was printed or retained. The separate namespace proves actual restore, not only source inventory and representative retrieval.

## Acceptance boundary

The provider recovery evidence now passes the full runbook gate:

1. real Neon point-in-time recovery and durable-content parity passed;
2. the exact Production commit served the recovered state from an isolated protected Preview;
3. a representative restored account and its durable working data were readable through the application contract;
4. every private source object was restored into a separate private Blob namespace and matched byte-for-byte; and
5. Production hosting, the Production Neon branch, the source Blob store, billing providers, pricing, and paid Research remained unchanged.

The public Beta restore gate is **Pass**. This does not authorize Production deployment and does not replace the separately open Production authentication, billing, monitoring, tax, and release checks.

## Cleanup

- The local target and read-only source-proxy servers were stopped before provider cleanup.
- Neon explicitly confirmed the destructive target as `permitext-restore-drill-20260828`; only branch `br-cool-dawn-aq1esvjo` was deleted.
- The live branch list returned to 1 of 10, displayed `main`, and no longer contained the temporary branch name.
- The detached exact-commit worktree was removed from Git's worktree registry.
- The exact mode-`0600` connection, administrator-token, and representative-account temporary files were deleted, and their temporary directory was removed.
- Production branch or Blob deletion: **not authorized and not performed**

The follow-up Neon branch is configured to expire automatically after one day. The isolated Vercel project, successful protected Preview, and private restored Blob store are retained temporarily as provider-verifiable evidence; they are not connected to Permitext Production. The owner-only temporary directory containing the exact-commit bundle and mode-`0600` credentials was moved from `/tmp` to Trash after verification and is recoverable until Trash is emptied. Production branch or Blob deletion remains unauthorized and was not performed.
