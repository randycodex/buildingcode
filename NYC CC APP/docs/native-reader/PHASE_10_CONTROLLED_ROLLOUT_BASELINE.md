# Native Reader Phase 10 Controlled Rollout Checkpoint

Date: 2026-08-19

## Status

The local rollout implementation, deterministic corpus gates, simulator suite, Release build, and focused physical-device tests pass after crash, text-presentation, and scroll-restoration remediations. Build 18 was installed on the physical phone and the user accepted it for publication of this checkpoint. Restoring a saved chapter position now keeps the Reader preparation state visible until the saved block is ready, avoiding the visible top-of-chapter flash; a completely direct first frame with no intermediate preparation state is intentionally deferred for follow-up. The formal Phase 10 exit gate calls for TestFlight evidence. On 2026-08-19, the user explicitly chose to defer TestFlight and proceed with the local Phase 11 cutover; no TestFlight/App Store action was performed.

## Feature-flag design

Native routing remains behind `PermitextNativeReaderRolloutStage`. The flag is embedded in the built app Info.plist from the `NATIVE_READER_ROLLOUT_STAGE` build setting and accepts these cumulative values:

1. `off`
2. `text-only`
3. `media`
4. `native-tables`
5. `isolated-table-fallback`

An invalid or missing explicit flag value fails closed to `off`. A launch argument named `--native-reader-rollout-stage` can override the bundled value for internal staged testing.

Build defaults are intentionally different:

- Debug: `isolated-table-fallback`, so every validated native tier opens natively by default for internal testing.
- Release: `off`, so the ordinary Release build continues to use the authoritative HTML reader and does not expose the rollout diagnostic control.

The Release-capable routing code remains compiled behind the runtime flag. At this Phase 10 checkpoint the normal Release default stayed off; the separately documented Phase 11 cutover later enabled the validated tier in Release. A future authorized internal TestFlight archive can still override the build setting without changing routing code.

## Deterministic rollout tiers

Native index schema 2 adds a required `rolloutTier` for each generated document. The tier is derived from the generated block model rather than chapter-specific Swift code:

- `textOnly`: no table or media blocks.
- `media`: media blocks and no tables.
- `nativeTable`: at least one native-grid table and no isolated table.
- `isolatedTableFallback`: at least one bounded isolated-HTML table.

For the current validated corpus:

- 233 text-only chapters.
- 6 media chapters.
- 0 native-grid table chapters.
- 3 isolated-table-fallback chapters.
- 242 total native-eligible chapters.

The native-table rollout stage is implemented and covered by package fixtures, but it currently enables no additional corpus chapters. This is expected and is recorded explicitly rather than treating isolated tables as native-grid tables.

All 208 `fullHTMLFallback` and 13 `invalidContent` chapters remain outside every native rollout stage.

## Internal reader behavior

For a validated chapter in an enabled internal build:

- The view waits for the deterministic route decision before activating a reader.
- Native becomes the default presentation.
- The internal menu identifies `Native (Rollout Default)` and retains `HTML (Diagnostic)` for the same chapter.
- A native integrity, table, or media failure immediately switches the chapter to authoritative HTML and reports the fallback.

For a chapter outside the enabled stage or outside validated native eligibility:

- No native route is returned.
- The authoritative HTML reader opens normally.

## Verification evidence

Completed on one retained iPhone 17 Pro simulator running iOS 26.5:

- Inventory package: 10 passed, zero failures.
- Deterministic 463-chapter corpus/index check: passed.
- Complete iOS unit/contract target after the build-12 scroll-restoration remediation: 99 passed, zero failures, zero skips at that checkpoint; the final build-18 rerun is recorded below.
- Live validated Chapter 1 opened in the native Reader by default.
- The same Chapter 1 switched to `HTML (Diagnostic)` and back to native without losing its remembered section.
- Rapid native scrolling advanced Chapter 1 from section 101 to section 106 without terminating the app, followed by a successful transition into native Chapter 2.
- The internal menu displayed the active `isolated-table-fallback` stage.
- Parallel simulator workers were disabled; no clone remained after testing.
- Final simulator inventory contained exactly one user app: `com.randycodex.permitext`.

### Physical-device incident and invalidated evidence

Before ordinary physical-device use, four focused tests passed on the connected iPhone 17 Pro running iOS 27.0:

- All-document index-tier parity: passed.
- Feature-flag parsing and fail-closed behavior: passed.
- Monotonic staged coverage and current tier counts: passed.
- Representative staged routing and invalid-content HTML fallback: passed.

That evidence is no longer sufficient. Subsequent native scrolling and Reader-to-Reader navigation in build 8 produced three device crash reports:

- `permitext-2026-08-19-194324.ips`: foreground `0x8BADF00D` process-exit watchdog while the main thread finalized SQLite work reached from `NativeChapterTextReaderView.persistLocation` -> `noteSectionOpened` -> continuity sync queueing.
- `permitext-2026-08-19-194342.ips`: `EXC_BAD_ACCESS` / `SIGSEGV` in `SQLiteConnection.prepare` while automatic user-content sync resolved local merge candidates.
- `permitext-2026-08-19-194525.ips`: `EXC_BAD_ACCESS` / `SIGSEGV` in `sqlite3_step` while UI continuity queueing overlapped user-content sync.

The reports establish two coupled problems: the native scroll-position binding caused per-block parent mutations and persistence work, and the same SQLite connection was used across UI and cooperative-executor sync paths without an explicit serialized statement lifecycle.

The local remediation now:

- Debounces scroll-location persistence and nearby-media prefetch until the visible block is settled for 250 milliseconds.
- Keeps the current-section presentation responsive without writing the remembered block/anchor for every scrolling frame.
- Makes unchanged native text blocks equatable and gives attributed-text rows deterministic integer identity instead of new UUID identity during parent updates.
- Opens SQLite with `SQLITE_OPEN_FULLMUTEX` and holds a recursive connection lock for every prepared-statement lifecycle and multi-statement transaction.
- Adds a regression test that completes 320 writes from eight concurrent tasks through the shared connection.

The crash reports came from build 8. To make the repaired binary unambiguous, the project build number was incremented to 9. The signed remediated Debug build 9 was installed in place at 20:09:54 with the same `com.randycodex.permitext` bundle ID. Device inventory after installation contained exactly one Permitext app, reporting version 1.0 build 9.

After the phone became available, the build-9 physical rerun completed:

- Shared SQLite concurrency stress, all-document parity, flag behavior, monotonic rollout coverage, and representative routing: 5 passed, zero failures, zero skips.
- The normal build-9 app launched under a live console.
- Real native Reader 1 scrolling advanced and persisted through section 106.7.2 while the app process remained alive.
- The device crash-log inventory remained at the same three build-8 reports, with no report newer than 19:45:25.
- The user then reported that ordinary native scrolling still blinked. Headings sometimes appeared at a smaller fallback size before adapting to their final size; the effect became less frequent but recurred after approximately one minute.

Build 9 therefore failed the visual acceptance gate even though it did not produce a new crash report. Source inspection identified the remaining deterministic cause: each lazy row first rendered a simplified SwiftUI `Text`, then asynchronously replaced it with the fully attributed selectable text. The shared cache was capped at 256 entries, so a long chapter could evict rows and repeat that visible replacement later.

The first build-10 text remediation removed the visible row swap by preparing and retaining every attributed string for the active chapter before exposing the Reader. A corpus scalability check rejected that design before acceptance: the largest currently native-eligible chapter contains 50,625 blocks and 31,035,823 uncompressed bytes. Holding formatted text for an entire chapter could make that chapter slow to open or memory-heavy even though it removed blinking in smaller chapters.

Build 11 replaces whole-chapter preparation with a bounded final-presentation path:

- Each visible lazy row synchronously obtains its final selectable attributed representation before it is rendered; normal rows never appear first as a simplified SwiftUI `Text`.
- The same bounded shared cache remains capped at 256 entries and 24 MB. Evicted rows may be recomputed when revisited, but they are recomputed directly into the same final attributed presentation rather than changing view type or font size on screen.
- Cache identity includes the block/list content, typography role, theme signature, accent, and row identity so theme or content changes cannot reuse stale formatting.
- The asynchronous formatting path remains only for intentional search highlighting.
- A regression test verifies immediate final heading typography and bounded-cache reuse before row appearance, while the source contract rejects a `Text(fallbackText)` normal-row path.

Build-11 verification completed before installation:

- Focused simulator final-presentation and stable-row tests: 2 passed, zero failures.
- Complete iOS simulator target: 98 passed, zero failures, zero skips.
- Fresh unsigned Release device build: passed; built Info.plist contained build 11 and `PermitextNativeReaderRolloutStage = off`.
- Focused physical-device final-presentation, stable-row, and SQLite concurrency tests: 3 passed, zero failures, zero skips.
- A fresh signed Debug artifact contained build 11, rollout stage `isolated-table-fallback`, and no XCTest bundle.
- Build 11 was installed in place and launched; device inventory contained exactly one Permitext app, version 1.0 build 11.

Physical testing of build 11 confirmed that ordinary scrolling no longer blinked or resized headings. It also identified two remaining failures:

- Native scrolling still felt less smooth than the authoritative HTML Reader.
- After scrolling down and tapping the iOS status-bar area, the Reader briefly moved to the top, blinked, and later returned to the block visible before the tap.

The delayed reversal came from the two-way SwiftUI `.scrollPosition` binding. The system scroll view handled the status-bar tap, but the binding could retain the old block identity and later reassert it. The same per-block binding updates also invalidated Reader view state during ordinary scrolling.

Build 12 removes that feedback path and reduces repeated layout work:

- On iOS 18 and later, visible blocks are observed with `onScrollTargetVisibilityChange`; the observed identity is not bound back to the ScrollView.
- The iOS 17 compatibility path derives the top visible block from geometry preferences, also without a two-way scroll-position binding.
- `ScrollViewReader` remains responsible only for explicit initial restoration, link/search navigation, and jump-menu commands.
- The latest visible block is stored without publishing a Reader-wide view update; user location persistence and media prefetch still run only after the 250-millisecond settle period.
- Attributed-text containers skip rebuilding unchanged text for the same width/content-size category, reuse their measured size, and avoid copying strings that contain no attachment.
- A new regression test verifies top-visible fallback resolution, and the source contract rejects reintroduction of the prior two-way binding.

Build-12 verification completed before installation:

- Focused simulator final-presentation, stable-row, and observation-only scroll tests: 3 passed, zero failures.
- Complete iOS simulator target: 99 passed, zero failures, zero skips.
- Fresh unsigned Release device build: passed; built Info.plist contained build 12 and `PermitextNativeReaderRolloutStage = off`.
- Focused physical-device final-presentation, stable-row, observation-only scroll, and SQLite concurrency tests: 4 passed, zero failures, zero skips.
- A fresh signed Debug artifact contained build 12, rollout stage `isolated-table-fallback`, and no XCTest bundle.
- Build 12 was installed in place and launched; device inventory contained exactly one Permitext app, version 1.0 build 12.

The original four-test physical result remains invalidated. Subsequent direct physical testing confirmed that build 12 no longer blinked, that ordinary scrolling was materially smoother, and that status-bar scroll-to-top remained at the top. It also exposed inaccurate saved-block tracking and visible restoration movement when reopening a chapter.

Builds 14 through 18 iterated on those restoration failures without reintroducing the two-way scroll binding:

- An exact-offset experiment was rejected because it allowed horizontal drift and moved content too close to the screen edge.
- Block-only restoration initially recorded a block hidden under the fixed Reader toolbar, causing reopening to land several lines above the user's actual departure point.
- The final tracking path uses row geometry relative to the readable top edge on every supported iOS version, so the persisted block matches the content actually visible below the toolbar.
- During initial restoration, native content and the jump control remain hidden and non-interactive while the off-screen `ScrollViewReader` restoration completes with animation disabled.
- The existing `Preparing native Reader…` state remains visible through that interval, and the restored content is exposed only after it is in position.

Build-18 verification completed before physical installation:

- Focused simulator restoration contracts: 6 passed, zero failures.
- Complete iOS simulator target: 101 passed, zero failures, zero skips.
- Fresh unsigned Release device build: passed; built Info.plist contained version 1.0 build 18 and `PermitextNativeReaderRolloutStage = off`, with no XCTest bundle.
- A fresh signed Debug artifact contained version 1.0 build 18, rollout stage `isolated-table-fallback`, no XCTest bundle, and a valid code signature.
- A 20-frame-per-second simulator recording was inspected frame by frame. The chapter list transitioned to `Preparing native Reader…`, the preparation state remained visible through restoration, and the next content frame was already at saved section 106.3. No chapter-top content frame, blank interval, horizontal drift, or animated restoration appeared.
- Build 18 was installed in place and launched on the connected iPhone 17 Pro running iOS 27.0. Device inventory contained exactly one Permitext app, version 1.0 build 18.
- The user accepted this behavior for completion of the current migration checkpoint and explicitly deferred removal of the intermediate preparation state for later UX work.

Release verification:

- Fresh unsigned Release device build 18 after scroll-restoration remediation: passed.
- Built arm64 app Info.plist was inspected and contained `PermitextNativeReaderRolloutStage = off`.

## Remaining Phase 10 gate

The local, simulator, signed-build, and direct physical-device checkpoint is accepted for branch publication. The plan's formal TestFlight evidence remains deferred rather than satisfied. The user explicitly authorized proceeding without that evidence for now, and the local Phase 11 Release-default cutover is recorded separately. A future TestFlight run still requires separate authorization and must collect evidence for native content, navigation, fallback, bookmarks, and Projects stability.

No TestFlight upload, App Store Connect change, App Store submission, merge, or production release was performed.
