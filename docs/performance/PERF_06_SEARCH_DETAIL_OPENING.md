# PERF-06 — Search result detail opening

Status: source changes and targeted host checks complete; signed development Release 41.9 built and installed, targeted physical-device rendering verified. Physical-device 41.9 timing extraction and broader acceptance remain open. The host extraction benchmark is not a device latency claim.

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

Passed: `node permitext-sync-server/tests/search-reader-saved-deferral-contract.mjs`. It compiles and executes extracted production Swift methods with deterministic fixtures covering immediate bookmark controls, complete historical bookmark/note/tag/annotation export, five read failures and retry, missing corpus/repository, cross-account rejection, and default full refresh. The harness also executes production session synchronization for account A → B, sign-out, and same-account session replacement, covering cancellation, repository rebinding, refreshed controls, stale-export rejection and complete first-mutation export. Cancellation and folder dependencies are deterministic fixtures; this does not replace physical lifecycle acceptance.

Added XCTest `testSearchReaderDefersSavedRowsButPreservesControlsAndEvidenceOnExport` for real repository notes, folders and mutation reconciliation. Not yet run; no available Simulator device was listed on this host. Existing `testSearchCardCommentsShareRepositoryAndNotifySyncOwner` remains relevant.

Build/install passed (`/tmp/permitext-perf06-418-build.log`, `/tmp/permitext-perf06-418-install.log`). Mirroring verified 1,286 concrete results, first/repeated 2022 BC 403.2.3.3 detail with text and references, closing back to the same expanded Search, and 2014 BC 403.2.3.3 with its edition/text/references. No account data was modified during these checks. The 40-second `/tmp/permitext-418-detail.trace` saved and was exported; its measured bottleneck is recorded below.

Pending: timing extraction, rich table/figure cases, physical-device existing Saved/folder controls and broad cold/repeat/large-account acceptance. Record tap → destination prepared → passage data ready → content appeared separately. Do not infer all of the old 188 ms preparation cost came from Saved hydration.

## Build 41.8 measurement and next correction

The trace saved and exported. One complete 2022 concrete detail interval measured **224.280 ms** to destination prepared, **3,434.849 ms** to passage data ready, and **3,452.736 ms** to content appearance. The trace did not capture a second complete interval. This is not a controlled comparison to the older different-result 771.893 ms sample, but it clearly fails the fast-detail goal. See `PERF_06_BUILD_418_DETAIL_TIMING_2026-09-22.json`.

Source inspection found that `contentBlocksEnrichedWithPublishedRichSources` always requests chapter-wide synthesized blocks, even for a single selected passage. The correction below extracts only the selected section on detail loads, retaining full heading boundaries and rich-source reconciliation. Full-chapter search fallback remains unchanged; exact block parity and cache behavior were checked before installation.

## Selected-passage extraction correction (installed development build 41.9)

Detail loading and rich-source enrichment now use a targeted extractor, preserving the first matching normalized heading and the next valid heading boundary. The original wrapper-boundary and rich-block parsers are reused. Only the necessary terminating wrapper is scanned; sibling rich blocks and per-heading chapter-prefix scans are avoided. The full-chapter search fallback is unchanged. Empty selected results are cached without marking sibling passages as loaded. Added `sectionDetailLoad` and `publishedBlockExtraction` signposts.

`python3 permitext-sync-server/tests/native-detail-synthesis-contract.py` passed **40** representative actual/synthetic rich-block parity cases: six editions, 2014/2022 Building chapter 4, tables/images, enrichment, duplicate/invalid headings, Unicode, missing HTML, empty caching and later full fallback. All six search packs still pass `--check` without regeneration. Optimized host harness measured 2022 BC 403.2.3.3 **4,118.149 ms full chapter versus 9.863 ms targeted extraction**. This is host extraction only, not tap-to-visible device latency. Signed Release 41.9 build/install passed (`/tmp/permitext-perf06-419-final-build.log`, `/tmp/permitext-perf06-419-install.log`). Search renders 1,286 concrete results. After intermittent profiling connection failures, Instruments started a 180-second recording with the phone kept unlocked and connected over USB. The owner confirmed manually opening, closing and reopening the requested result. `/tmp/permitext-419-detail-unlocked.trace` is finalizing; event coverage and final 41.9 detail timing remain unverified until export.

Rendered 41.9 check: 2022 BC 403.2.3.3 contains its expected complete text, edition label and both references. This establishes rendered correctness for that passage, not measured latency.

## September 23 trace recovery

The saved 41.9 trace exported successfully. It contains only four application `projectHydration` events (two complete intervals), with no Search result opening, passage load, or content appearance events. The owner-reported two openings therefore have no timing evidence in this recording. See `PERF_06_BUILD_419_TRACE_COVERAGE_2026-09-23.json`. Physical timing and broader device acceptance remain pending. The owner authorized continuing phone-free, simulator-free work on PERF-05 while away; this does not close PERF-06 acceptance.

## September 23 physical spot check — development 41.10

Installed 41.10 includes PERF-05/07 changes. Mirroring verified BC403.2.3.3 complete passage, 2022 label and both references, plus BC721.1.3 and preserved scrolled Search return. BC722.2.4 displays its table and footnotes, but rightmost table columns are clipped; horizontal scrolling/tapping through Mirroring did not reveal them. Rich-table acceptance is therefore unresolved, not passing. Source investigation is pending; no attribution to the extraction change is established. Instruments continues to list the device offline; precise detail timing is pending.

Table follow-up source review: BC722.2.4 contains a 700px-wide table. ContentBlockView intentionally supports horizontal scrolling through native horizontal ScrollViews or HTML overflow containers; tapping is not an expand action. ContentBlockView is unchanged from main checkpoint `55302eded`, and the ReaderView change only skips unused fallback text formatting. The observed clipping may involve HTML overflow or Mirroring gesture delivery; no regression or missing source columns is proven. Direct touch verification remains needed.

Owner direct-touch verification: on build41.10, swiping left across Table722.2.4 reveals the right-hand columns. Horizontal access therefore passes for this representative table; the failed Mirroring gesture is not an app-defect finding. This does not establish all-table/figure, VoiceOver or timing acceptance.

The new41.10 USB trace saved/exported successfully but contains three search-input events and no completed detail-opening sequence. The recorder had been stopped after the initial Done response, before the subsequent clarification/confirmed opening. See `PERF_06_BUILD_4110_TRACE_COVERAGE_2026-09-23.json`; no timing claim.

Physical XCTest follow-through passed on the connected iPhone using Debug41.11 and isolated temporary repositories: `testSearchReaderDefersSavedRowsButPreservesControlsAndEvidenceOnExport` and `testSearchCardCommentsShareRepositoryAndNotifySyncOwner`. This closes the previously unrun real-repository unit-test gap; it does not establish Release latency or full-account UI acceptance.

Automated physical UI test also passed for2022/2014 BC403.2.3.3 actual text, both reference controls, repeated opening and return position using isolated Debug41.11. Exported screenshots visually confirm passage content and edition. This is functional acceptance, not Release timing. The2014 screenshot also shows repetitive chapter headings and a401.1 ancestor label above403.2.3.3; source hierarchy/UX triage remains separate from this performance change.
