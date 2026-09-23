# PERF-08 — Database-bound native sync checkpoints

## Change

Native sync checkpoints now live in `sync_checkpoints` inside the same SQLite database as the records they describe, keyed by account, backend and checkpoint compatibility version 1. Ordinary reopening reuses the checkpoint. A new, replaced, legacy, incompatible or corrupt database checkpoint starts with a full pull. Restoring a database snapshot restores its corresponding checkpoint; preferences cannot contribute a newer cursor from another snapshot. Existing installations deliberately perform one full reconciliation when adopting this storage.

The initializer and account-scope activation no longer discard valid checkpoints. Explicit canonical-content reconciliation remains. Deleting local user data also deletes its checkpoints in the same transaction. A failed reset does not mark reconciliation complete. Production engines without a repository cannot read or write shared-preferences checkpoints; explicit test injection remains supported.

Two cursor safeguards accompany this change: upload acknowledgement never advances the download cursor, and accepting one server conflict does not mark an entire server snapshot consumed. Only a successfully applied full merge with no unresolved decisions establishes pull progress. Failed checkpoint writes retain the preceding cursor, allowing safe replay.

## Verification

Initial physical iPhone Debug 41.12 run passed six tests, including SQLite reopen, new/replaced store, account/backend scope, unchanged server probe, changed pull, content-map propagation and upload cursor preservation. Result: `/tmp/permitext-perf08-checkpoint-tests.xcresult`.

Final eight-test run passed all eight tests with zero failures on the physical iPhone, adding snapshot restoration, incompatible/corrupt payload, failed read-only reset and missing repository checks. Result: `/tmp/permitext-perf08-final-tests.xcresult`; sanitized summary: `PERF_08_PHYSICAL_TESTS_2026-09-23.json`. Tests use temporary databases and synthetic accounts, not the owner's saved work. Test durations are not app launch or search latency measurements.

## Recovery follow-up

A server restored to an older event sequence can return an empty incremental response with a lower cursor. Native sync now discards that response and retries once with both timestamp and event cursor cleared. It applies and checkpoints the recovered snapshot only through the normal merge path; a failed retry retains the old cursor. Pending local mutations remain subject to the existing conflict/merge rules.

Additional physical tests exercise a SQLite trigger that interrupts the second mutation after the first is applied, close/reopen and replay from the old cursor, accepting one rejected conflict before pulling another remote record, failed initial authentication followed by an actual queued upload, regressed server cursors, failed recovery, and a populated 500-save relaunch. See the follow-up test evidence below.

Server review found no event-retention floor or expired-cursor response contract. No automatic event pruning exists in the inspected sync implementation; future pruning must introduce explicit recovery semantics. The server already drops the event cursor when the content map differs, and native event-based pulls supply no timestamp. Legacy timestamp-only clients retain a separate server compatibility risk because the server does not clear their timestamp on map mismatch. No server behavior was changed here.

## Remaining acceptance

The synthetic populated fixture quantifies avoided payload/application work, not production-network latency, RSS, or contention while actively using Reader/Search. Production-account contention and final Release timing remain open. No TestFlight or production deployment is part of this change.

## Installed development build

Signed Release 1.0 (41.12) built successfully, installed, launched, and verified through `devicectl device info apps` on September 23. Build log `/tmp/permitext-perf08-release-build.log`; installation log `/tmp/permitext-perf08-release-install.log`. Source commit `6cc39b17a` remains on the local performance branch, not main/remote/TestFlight.

## Recovery verification results

All 12 targeted physical iPhone tests passed on development Debug 41.13, with zero failures. `/tmp/permitext-perf08-recovery-final-tests.xcresult` contains the final run. The 500-save synthetic payload encodes to 140,785 bytes of mutation JSON. The first pull applied 500 records; reopening performed one lightweight checkpoint probe, zero full-pull calls, and zero record applications while retaining all 500 saves. This excludes HTTP envelope/compression and does not measure production latency or concurrent Reader/Search contention.

Local `sync-state`, `auth-policy`, `auth-session-hotpath-contract`, `sync-conflict-resolution-contract`, and full `smoke.mjs` tests passed. The smoke suite ran localhost with temporary storage and mocked Research. No production database or paid Research was used. Sanitized evidence: `PERF_08_RECOVERY_TESTS_2026-09-23.json`.
