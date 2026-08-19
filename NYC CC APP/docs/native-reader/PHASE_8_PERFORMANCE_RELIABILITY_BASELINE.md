# Native Reader Phase 8 Performance and Reliability Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 8 hardens the Debug-only native Reader pilot without changing the authoritative source or the release path. Authored HTML and bundled assets remain authoritative, HTML remains the release/default Reader, and native routing still fails closed to whole-chapter HTML fallback.

## Load and cache architecture

- Native documents continue to be produced offline by `native-reader-inventory`; opening a native pilot chapter never parses the authored HTML into a document model.
- The native index now loads on a detached utility task rather than during first main-actor access.
- Compressed document reads, LZFSE decompression, SHA-256 validation, JSON decoding, display-block derivation, and section-target derivation run away from the main actor.
- Prepared documents use a locked least-recently-used cache bounded to four documents and 48 MB estimated cost. Memory warnings clear it immediately.
- Native chapter content remains a `LazyVStack`. Large attributed strings are prepared by cancellable detached tasks only for lazy-created text rows and stored in a 256-entry, 24 MB cache.
- Native isolated-table HTML is prepared by cancellable detached tasks and stored in the existing 96-entry, 16 MB cache.
- Image decode work is cancellable. Nearby media prefetch is limited to the focused source block plus two blocks on either side; changing the visible block cancels the obsolete prefetch.
- Changing chapter or leaving a Reader tab cancels native document and media preparation. Backgrounding the app cancels Reader warmups.

## Main-actor and lifecycle hardening

- The Reader no longer performs index or native-document file reads on the main actor.
- Project evidence snapshot SQLite reads now use a dedicated read-only `UserDataStore` connection owned by `ProjectPresentationSnapshotBuilder`. The immutable snapshot and final Project-row reconstruction both run away from the main actor.
- App memory-warning handling clears prepared HTML, chapter-search, native document, attributed-text, image, URL-resolution, table-document, table-height, formatted-text, chapter-body, and section-detail caches. Bookmark, folder, Project, and continuity data are not cleared.
- Background and inactive transitions stop automatic sync and cancel Reader warmups. Foreground sync and the visible Reader resume normally.

## Instrumentation

Signposts now cover:

- `nativeDocumentPrepare` and `nativeChapterReady`
- `imageDecode`
- `tableHTMLPrepare` and `tableLoad`
- `textSelection` and `researchSelection`
- `bookmarkMutation`
- `projectHydration`
- `readerCachesPurged` and `memoryWarningHandled`

The memory-warning path also emits an informational `Memory` log so the actual Simulator event can be verified outside Instruments.

## Automated verification

Completed on one retained iPhone 17 Pro simulator running iOS 26.5:

- Native inventory package: 8 tests passed.
- Deterministic corpus check passed for 463 chapters, 1,677 tables, and 885 images/SVG assets.
- Corpus SHA-256 remained `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`.
- Complete iOS unit/contract target: 88 passed, zero failures, zero skips.
- Phase 8 prepared-document cold/warm/purge contract: passed in 0.218 seconds in the complete simulator run.
- Phase 8 all-pilot cache-bound contract: passed in 3.560 seconds in the complete simulator run.
- Fresh Debug compilation passed without Swift warnings.
- Fresh unsigned Release device build passed.

Completed on the connected physical iPhone 17 Pro running iOS 27.0:

- Prepared-document cold/warm/purge contract passed in 0.635 seconds.
- All-pilot count/cost-bound contract passed in 3.154 seconds.
- Immutable Project-presentation contract passed in 0.020 seconds.
- The app launched after the test run.
- Device inventory showed only `com.randycodex.permitext`; no test-runner or alternate Permitext app remained installed.

## Live simulator verification

- Native Chapter 1 scrolled normally and retained its nearest section location.
- Leaving for Search and returning restored the native chapter without a crash or stale HTML/native switch.
- Sending the app Home and reopening it restored the Reader location.
- Simulator `Command-Shift-M` delivered a real memory warning while native Chapter 1 was visible. Unified logging recorded `memoryWarningHandled`, and the Reader remained rendered and scrollable.
- The simulator application registry and Home Screen both contained one Permitext app.

Visual evidence:

- [Native Reader after memory warning](phase-8/screenshots/native-reader-after-memory-warning.png)
- [Single Permitext simulator install](phase-8/screenshots/single-permitext-install.png)

## Exit-gate status

The implementation and stability portion of Phase 8 passes on the available simulator and physical iPhone 17 Pro. Native work is prebuilt or moved off the main actor, lazy work is cancellable, caches have explicit bounds, lifecycle and memory-warning behavior is verified, and the Release build passes.

The migration plan's strict performance exit gate remains partially open: the available physical phone is not the oldest supported iPhone, and this phase did not produce an Instruments head-to-head trace on that oldest device. Therefore this document does not claim that native mode is measurably smoother on the oldest supported hardware. That comparison must be recorded before release-mode cutover.

## Phase boundary

Phase 9 has not started. Automated screenshot/fidelity coverage, semantic parity across a broader chapter matrix, and regression thresholds remain the next scope. HTML remains the release/default Reader.
