# First-release cross-device Saved and Notebook reliability

Status: pending. Owner confirmed a separate test account exists. Awaiting owner readiness and authorization for clearly labeled test records. No test-account credentials or personal identifiers belong in this document.

## Prerequisites

1. Owner signs into the same separate test account on iPhone and web; no agent-driven main-account signout or test seeding.
2. Confirm test-record creation is allowed. Record native build and actual web URL/deployment; production web and performance preview are distinct versions. Last installed native build is41.32; revalidate if it changes.
3. Record initial visible Project/Saved counts and chosen source scope. Use only a unique test prefix, e.g. `Release check Sep28`, and preserve existing records.
4. No Instruments, simulator, speed benchmark, source disabling, paid Research or account deletion is part of this check.

## Bounded sequence and evidence

1. On web, create one clearly labeled test Project. Confirm it appears on iPhone after normal sync; record any manual refresh needed. A matching name alone is not enough when duplicates exist: compare identity through ordinary available UI/authorized readback.
2. Save one actual2022 passage on iPhone without assignment. Confirm the same citation/body appears in web Unassigned. Do not reuse an already saved passage or interpret its preexisting appearance as new-sync proof.
3. Assign that test save to the new Project on web. Confirm iPhone membership and that it is no longer incorrectly shown as Unassigned. Check save count stays one rather than producing a duplicate.
4. Create a test Note in the Project on one device. On the other, verify its title and distinctive body marker, then append a different marker using the supported editor. Verify both markers on the original device after sync. Do not overwrite simultaneous unsaved edits.
5. Relaunch native app and reload web after saves are visibly complete. Confirm Project, membership, citation/edition and Note body remain intact.
6. Verify bounded background/foreground recovery. Connectivity interruption is a subsequent named step only where supported and controllable; do not change host networking or claim an offline pass from an online reload.
7. Record actual result for each step, including platform/version and whether UI/readback agrees. Stop and preserve local drafts if any write fails; do not delete/recreate records to conceal failure.

## Completion and boundaries

Passing establishes the chosen two-way Project/Saved/Note journey on the tested artifacts. It does not prove concurrent conflicting edits, account isolation, large-account scaling, full offline behavior or TestFlight/App Store acceptance. Existing isolated local and PostgreSQL tests supply separate account-isolation evidence; physical account switching needs its own explicit controlled sequence.

Leave created test records in place for owner inspection unless cleanup is authorized through the normal recoverable product flow. Record only a concise sanitized outcome and links to evidence. No current cross-device pass is claimed.

## Preliminary source review

No new defect was demonstrated. Existing native logic preserves the pull cursor after push acknowledgement and leaves an entity unresolved while sibling queue items remain. Web transport checks identity after fetch and JSON parsing, and acknowledgement matches queued entry identity/time to avoid discarding newer edits. Existing native tests cover several persistence/account/conflict cases; their presence is not a claim of current device execution.

The bounded host regression now passes: `npm run test:native-saved-queue-reopen` (macOS/Xcode command-line tools, no simulator). It compiles39 unchanged production UserDataStore methods, production schema/migrations and the full SQLiteConnection. Synthetic fixture: save to Project1, claim upload, move to Project2 and back while that upload is outstanding, acknowledge the old batch, fail the newer batch, close/reopen the actual SQLite database, retry and acknowledge. The newer assignment remains pending until its own final acknowledgement; retry preserves operation order, payload and edit timestamp. Temporary compilation with the unresolved-sibling guard removed fails at the independent pending-state assertion, demonstrating regression sensitivity. Temporary compiler/database artifacts are removed in finally. No production fix was necessary. Log: `/tmp/permitext-saved-queue-host.log`.

This is local queue durability evidence only. Transport failure is represented through the production failed-queue method; no actual network or cross-device delivery is exercised. It does not replace the cross-device rendered sequence above. Owner is arranging Lifetime Pro access for the separate account; no account mutation or entitlement grant has been performed by this task.
