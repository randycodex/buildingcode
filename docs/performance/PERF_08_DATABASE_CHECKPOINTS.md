# PERF-08 — Database-bound native sync checkpoints

## Change

Native sync checkpoints now live in `sync_checkpoints` inside the same SQLite database as the records they describe, keyed by account, backend and checkpoint compatibility version 1. Ordinary reopening reuses the checkpoint. A new, replaced, legacy, incompatible or corrupt database checkpoint starts with a full pull. Restoring a database snapshot restores its corresponding checkpoint; preferences cannot contribute a newer cursor from another snapshot. Existing installations deliberately perform one full reconciliation when adopting this storage.

The initializer and account-scope activation no longer discard valid checkpoints. Explicit canonical-content reconciliation remains. Deleting local user data also deletes its checkpoints in the same transaction. A failed reset does not mark reconciliation complete. Production engines without a repository cannot read or write shared-preferences checkpoints; explicit test injection remains supported.

Two cursor safeguards accompany this change: upload acknowledgement never advances the download cursor, and accepting one server conflict does not mark an entire server snapshot consumed. Only a successfully applied full merge with no unresolved decisions establishes pull progress. Failed checkpoint writes retain the preceding cursor, allowing safe replay.

## Verification

Initial physical iPhone Debug 41.12 run passed six tests, including SQLite reopen, new/replaced store, account/backend scope, unchanged server probe, changed pull, content-map propagation and upload cursor preservation. Result: `/tmp/permitext-perf08-checkpoint-tests.xcresult`.

Final eight-test run passed all eight tests with zero failures on the physical iPhone, adding snapshot restoration, incompatible/corrupt payload, failed read-only reset and missing repository checks. Result: `/tmp/permitext-perf08-final-tests.xcresult`; sanitized summary: `PERF_08_PHYSICAL_TESTS_2026-09-23.json`. Tests use temporary databases and synthetic accounts, not the owner's saved work. Test durations are not app launch or search latency measurements.

## Remaining acceptance

The code and bounded functional tests do not establish payload/RSS/contention improvements on a populated production account. Interrupted/partial mutation application, conflict-resolution replay, revoked-session and server cursor-recovery scenarios still need the broader sync acceptance matrix. Existing server content-map mismatch handling remains unchanged. No TestFlight or production deployment is part of this change.

## Installed development build

Signed Release 1.0 (41.12) built successfully, installed, launched, and verified through `devicectl device info apps` on September 23. Build log `/tmp/permitext-perf08-release-build.log`; installation log `/tmp/permitext-perf08-release-install.log`. Source commit `6cc39b17a` remains on the local performance branch, not main/remote/TestFlight.
