# Recoverable saved-content deletion

Implemented in the web workspace, native iOS Settings, and shared sync backend.

## Behavior

- History clearing stays separate from the collapsed **Delete saved content…** section.
- Projects/collections, saved passages and Project memberships, and notes have server-owned recovery copies retained for 30 days after accepted deletion.
- Settings bulk deletion first finishes queued sync and verifies the recovery endpoint. Unavailable recovery or unresolved sync conflicts stop removal.
- **All Saved Passages** and **All Notes** cover all supported code editions. Removing notes preserves tags and bookmarks; removing Projects preserves bookmarks and notes.
- Trash is account-scoped and accessible from both clients. Restore/Undo writes new sync mutations, preserves newer live work, retains collection type, and restores notes without replacing newer tags.
- Permanent removal of a recovery copy, or emptying Trash, requires exact `DELETE` in both clients and at the server endpoint.
- Account linking retargets recovery ownership; account deletion removes recovery copies; operator account export includes recovery records.
- Settings opens Trash after an acknowledged bulk deletion. Older clients' accepted sync tombstones and clear markers also create recovery copies when a previous synced value exists.

## Boundaries

- This is recovery of sync-backed saved records, not a backup system for arbitrary files, Research conversations, or retired Workboards.
- Unsynced edits must reach the server before Settings deletion. Content never synced by an older client has no server recovery copy.
- Restore availability expires at 30 days. Expired recovery rows are physically cleaned on subsequent Trash/deletion activity; this is not a scheduled database purge or an erasure promise for operational backups/sync journals.
- Permanent removal deletes the recovery copy, not active content that was separately recreated.
- New clients stop bulk deletion if connected to an older backend without `/content/trash`. Release the backend/schema before the clients.

## Verification

- `npm run test:trash`: pure recovery policy, isolated authenticated HTTP lifecycle, and web preflight/all-edition cleanup.
- Actual PostgreSQL repository SQL exercised against a disposable PGlite database: delete/restore, typed table updates, recovery-write failure rollback, rejected mutation exclusion, ownership isolation, Free account restoration, note bulk clears, reference collection type, permanent purge, and account-link retargeting.
- PostgreSQL fixture command: `PERMITEXT_TEST_PGLITE_PATH=/tmp/permitext-trash-pg-check/node_modules/@electric-sql/pglite/dist/index.js npm run test:trash:postgres`. PGlite was installed only in that temporary directory, not added to application runtime dependencies.
- Related backend performance, sync conflict/state, account export, schema readiness, legacy Project deletion, Settings wording, and offline shell contracts checked.
- Development iPhone: four targeted XCTest cases passed for authenticated Trash requests, unavailable-backend deletion prevention, all-code bookmark clearing, and all-code note clearing preserving bookmarks/tags. No production user records were deleted in testing.
- Native source-layout assertions require the host source tree and explicitly skip when it is unavailable on a physical device; web parity checks inspect that source on the host.
- Web Data & Storage layout, collapsed deletion controls, and empty Trash were rendered on localhost. Native Data & Storage, expanded deletion controls, and the Trash sheet were inspected on the physical development iPhone. Its Production backend returned 404 for the unreleased endpoint; unavailable recovery was displayed and no deletion was attempted.

## Release state

Local implementation and development build only. No Production deployment, TestFlight upload, or App Store release performed. Live cross-device recovery is not claimed before backend rollout and client release verification.
