# PERF-06 — Search result detail opening

Status: source changes and targeted host checks complete; signed development Release 41.8 built and installed, targeted physical-device rendering verified; timing extraction and broader acceptance remain open. No speedup claim yet.

## Problem and scope

The owner explicitly requires the detail card's information to appear quickly after tapping a result. Search completion alone is insufficient. One build 41.7 sample measured 188.262 ms from tap request to destination prepared and 771.893 ms to passage content appearance. This is one application-signpost sample, not a percentile or a frame-presentation measurement.

`makeSearchReaderLibrary` reused the corpus but called `refreshBookmarks`, building Saved previews from bookmarks, notes, tags and annotations, and scheduling Project presentation work before showing the detail. The card needs bookmark controls, folder membership and direct repository access to notes; it does not initially need the complete Saved list.

## Changes

1. Initialize independent Search readers with bookmark IDs, folder metadata and membership. Defer full Saved preview construction and Project hydration.
2. Before exporting an independent reader's Saved rows to the main library, materialize the complete edition. An optimistic one-row mutation must never replace the owner's full historical evidence list.
3. If any evidence-category read fails during deferred materialization, retain the owner's previous rows and still schedule sync for a durable mutation; retry remains possible.
4. Rebind shared reader repository state on account/session change, cancelling old presentation work. Reject cross-account reconciliation.
5. Keep default full Saved refresh behavior for existing callers.
6. Avoid formatting unused fallback text in ReaderView when structured content blocks are present. ContentBlockListView only consumes fallback text for an empty block list; tables, figures and rich blocks retain the existing rendering path.

## Validation

Passed: `node permitext-sync-server/tests/search-reader-saved-deferral-contract.mjs`. It compiles and executes extracted production Swift methods with deterministic fixtures covering immediate bookmark controls, complete historical bookmark/note/tag/annotation export, five read failures and retry, missing corpus/repository, cross-account rejection, and default full refresh.

Added XCTest `testSearchReaderDefersSavedRowsButPreservesControlsAndEvidenceOnExport` for real repository notes, folders and mutation reconciliation. Not yet run; no available Simulator device was listed on this host. Existing `testSearchCardCommentsShareRepositoryAndNotifySyncOwner` remains relevant.

Build/install passed (`/tmp/permitext-perf06-418-build.log`, `/tmp/permitext-perf06-418-install.log`). Mirroring verified 1,286 concrete results, first/repeated 2022 BC 403.2.3.3 detail with text and references, closing back to the same expanded Search, and 2014 BC 403.2.3.3 with its edition/text/references. No account data was modified during these checks. The 40-second `/tmp/permitext-418-detail.trace` (session 89274) is finalizing; do not claim measured improvement until its events are exported.

Pending: timing extraction, rich table/figure cases, physical-device existing Saved/folder controls and broad cold/repeat/large-account acceptance. Record tap → destination prepared → passage data ready → content appeared separately. Do not infer all of the old 188 ms preparation cost came from Saved hydration.
