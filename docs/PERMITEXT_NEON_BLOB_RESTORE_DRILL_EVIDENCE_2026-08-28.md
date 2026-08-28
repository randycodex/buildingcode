# Permitext Neon/Blob recovery drill evidence — August 28, 2026

## Result

The owner authorized an isolated, no-paid-add-on provider recovery exercise while retaining the standing prohibitions on merge, push, deployment, pricing changes, paid model calls, real billing actions, and Production application-data writes.

The provider recovery work passed:

- Neon forked a child branch from the `main` branch's retained history in 0.39 seconds;
- source and restored schemas matched across all 38 `permitext_*` tables;
- exact content digests matched across 3,611 rows before application access;
- entitlement aggregates and an entitled representative account matched;
- the exact serving Production commit successfully opened the restored database through an isolated local server; and
- the permanent fail-closed restore verifier passed with zero mismatches across 27 durable summary families, release identity, sync cursor, representative-account state, and the supplied 124-object private-asset inventory.

This is not marked as the complete public-Beta restore gate. The retained no-deploy constraint prevented an isolated Vercel deployment, and the no-paid/provider-write boundary prevented creation of a duplicate private Blob store. The Neon recovery and real private-asset retrieval are verified; deployment-level behavior and an isolated provider Blob namespace remain open.

## Authorization and isolation

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

## Acceptance boundary

The provider recovery evidence is a pass for Neon point-in-time branching, durable database parity, Production-code compatibility on an isolated local host, and authenticated private-asset inventory/retrieval. It is not the full runbook pass because:

1. no non-production Vercel deployment was created; and
2. no isolated private Blob provider namespace was created or restored.

The public Beta restore gate therefore remains **blocked** until those two acceptance items are completed under separate authorization or the owner explicitly accepts the residual recovery risk.

## Cleanup

- The local target and read-only source-proxy servers were stopped before provider cleanup.
- Neon explicitly confirmed the destructive target as `permitext-restore-drill-20260828`; only branch `br-cool-dawn-aq1esvjo` was deleted.
- The live branch list returned to 1 of 10, displayed `main`, and no longer contained the temporary branch name.
- The detached exact-commit worktree was removed from Git's worktree registry.
- The exact mode-`0600` connection, administrator-token, and representative-account temporary files were deleted, and their temporary directory was removed.
- Production branch or Blob deletion: **not authorized and not performed**
