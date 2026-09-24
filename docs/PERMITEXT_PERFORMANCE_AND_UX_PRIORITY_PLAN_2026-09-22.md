# Permitext performance and UX/UI priority plan

Date: 2026-09-22

Status: Active implementation plan. Original audit findings below retain their original evidence limits; subsequent implementation and measurements are tracked in the update below.

Basis: Source inspection, production web inspection, physical-iPhone walkthrough, public API samples, and an isolated reproduction of the Saved annotation defect.

## Implementation direction update — current and recent chapters first

1. **Keep startup readiness-driven (PERF-02).** The owner permits a few seconds of useful preparation, but there is no required five-second delay. Show usable content as soon as it is ready; do not wait for the entire corpus.
2. **Chapter implementation completed; broader acceptance remains open: PERF-03 plus the minimum warmup coordination from PERF-07.** Return validated native chapters immediately, without waiting for unused HTML, anchors, or section details. Prioritize the last-opened chapter, then recent chapters from the selected edition. Resolve history through catalog identities rather than decoding rich passages.
3. **Bound background preparation.** Use the existing four-document / 48 MiB cache limits, with current/recent candidates occupying the shortlist before default chapters. Visible cards must not launch an unrestricted sweep. Preparation runs after content is usable; explicit chapter opening and search cancel speculative consumers. Preserve shared-load cancellation semantics and corpus validation. Four candidates are a count ceiling, not a guarantee they all fit the byte budget.
4. **Do not promise every chapter is instantly readable.** Uncached chapters still require preparation. Current measurements also include about 1.5 seconds of viewport restoration; preserve accurate passage positioning while investigating that delay separately. Do not remove settling checks merely to expose an earlier frame.
5. **PERF-04 remains the next task, not folded into this change.** A development Release build 41.3 trace measured `concrete` all-edition search at 29,314.3 ms, with 28,495.3 ms in the first edition search interval. This establishes a serious delay, but does not isolate decoding versus matching CPU cost. Preserve complete all-edition results and exact matching when fixing it.
6. **Acceptance and provenance.** PERF-01 and PERF-02 still have the coverage gaps recorded in their measurement documents. The redundant iOS Search chips were removed separately in `a937e0ef2`. Changes on the performance branch are not evidence of a production or TestFlight release. Finish device validation and record remaining gaps before marking PERF-03 complete.
7. **Sequence remains one task at a time.** Finish chapter preparation and bounded warming, then rich-text-independent search (PERF-04), then the remaining PERF-05/06/07 work in the original delivery sequence. Broader cache eviction, memory-pressure, and scheduling work in PERF-07 remains open.

## 1. Objective and scope

Make Permitext launch, open chapters, search, open results, and restore a working workspace as quickly as practical while preserving complete and trustworthy behavior.

The two implementation lists are separate:

1. **Performance:** reduce actual waiting, unnecessary preparation, main-thread work, repeated transport, and memory pressure.
2. **UX/UI:** repair inconsistent outcomes and improve clarity, navigation, feedback, accessibility, and discoverability.

The Saved discrepancy belongs at the top of UX/UI because it is a correctness and trust problem, even though its repair involves data-handling code. It must not be treated as cosmetic polish.

### 1.1 Priority definitions

| Priority | Meaning | Scheduling rule |
| --- | --- | --- |
| P0 | Correctness issue or prerequisite for trustworthy verification | Address first; do not claim completion while it remains open. |
| P1 | Primary reading/search/workspace experience | Implement in the first optimization batches, using the dependencies below. |
| P2 | Secondary friction or an optimization whose value requires additional profiling | Implement after the primary paths, or sooner if new measurements demonstrate greater impact. |

Numbers indicate the recommended order within each list. Dependencies and the combined delivery sequence in section 4 determine how the lists fit together. A P2 task should not displace an unfinished P1 task without new evidence.

### 1.2 Evidence labels

1. **Observed:** reproduced on the rendered app or measured through a request.
2. **Source-confirmed:** the work or behavior exists in the audited source; its user-visible cost may still need measurement.
3. **Proposal:** a recommended design or implementation direction that needs validation.
4. **Coverage gap:** an area that was not fully exercised and must not be represented as verified.

### 1.3 Audited baseline and limits

1. Local main and the production revision checked during the audit were `4da2e1fa1`.
2. Native observations came from the installed iPhone app, version `1.0 (41)`, a development build. This does not establish the exact source revision of that binary or Release/TestFlight/App Store performance.
3. iOS launch, chapter, and search paths were inspected, but no Release-build Instruments baseline was captured. No percentage improvement or native millisecond saving is established yet.
4. The signed-in account exposed Reader, Search, Saved, and Research history. No active or archived Projects were available for a populated Project/Notebook/Report walkthrough.
5. Public API timings below are individual samples, not p50/p95 measurements, screen-render times, or proven infrastructure cold/warm timings.
6. The broad audit was read-only. This document authorizes no deployment, account-content migration, paid Research evaluation, or release submission by itself.

| Public request | First sample | Repeat sample | Interpretation |
| --- | ---: | ---: | --- |
| Search `egress` | 2.01 s | 65 ms | Significant variability; trace matching, initialization, and transport before assigning a cause. |
| Search `1005.3.1` | 1.41 s | 215 ms | Direct-reference search also needs first-use investigation. |
| Chapter 33 summary | 571 ms | 115 ms | Summary response was approximately 355 KB decoded. |
| Chapter 33, five-body window | 613 ms | 1.01 s | Response was approximately 360 KB decoded despite including only five section bodies. |
| Full Chapter 33 body | Exceeded a 20 s client timeout once | Not repeated | Reliability/performance signal requiring reproduction, not a demonstrated universal failure. |

### 1.4 Non-negotiable preservation requirements

1. Preserve all installed/searchable editions and complete matching results. Faster first results must not silently become fewer results.
2. Preserve exact official text, tables, figures, source identity, edition identity, and applicable source-validation checks.
3. Preserve offline reading and search where currently supported; distinguish an unavailable corpus from a genuine zero-result search.
4. Preserve text selection, annotations, citations, links, chapter continuity, and remembered reading position.
5. Preserve account isolation, pending mutations, local drafts, deletion records, conflict recovery, and historical-edition identity.
6. Preserve the two permanent native Reader destinations and the independent-column desktop workspace.
7. Preserve floating native bottom controls and transparent surrounding space. Do not introduce an opaque full-width bottom strip as part of optimization.
8. Preserve current entitlement rules. Performance work must not change pricing, allowances, or access boundaries.
9. Preserve Research evidence and authority boundaries. This plan does not change its reasoning model, retrieval scope, paid-call policy, or generated-answer behavior.
10. Preserve existing useful optimizations: web search pagination, progressive chapter bodies, native prepared-document validation, and reusable workspace panes.

## 2. Performance — numbered implementation priorities

### 1. PERF-01 — Establish trustworthy measurements and repair the startup test gate

**Priority:** P0 prerequisite.

**Surfaces:** iOS, web, and relevant backend requests.

**Evidence:** Source-confirmed instrumentation gap and observed test-harness failure.

**Problem:** Native `firstUsableContent` ends when data becomes ready, before accounting for the launch splash and actual usable presentation. Existing native preparation timings do not measure the whole tap-to-readable interaction. The web startup contract failed with `ReferenceError: setupAccountProfile is not defined` in its test context; this was not an observed production crash.

**Work to do:**

1. Repair the startup test fixture so it includes the current startup dependencies and actually exercises the intended path. Do not remove the assertion or stub away the behavior being tested merely to make it pass.
2. Record separate native milestones for process launch, initial data ready, first usable presentation, chapter tap, selected passage visible, search input, first results, complete results, and result tap-to-readable.
3. Preserve preparation-level signposts for diagnosis, but stop labeling preparation completion as user-visible completion.
4. Capture a Release/Profile baseline on the available physical phone. Record device, OS, binary version, build configuration, corpus revision, account fixture size, network conditions, and thermal state.
5. Capture web browser traces for startup, restored workspace, typing, result opening, reader scrolling, and pane operations. Record long tasks, request waterfalls, transferred/decoded bytes, DOM growth, and interaction delays.
6. Separate first-use, repeat-use, process-relaunch, offline, and cache-purged scenarios. Force-quitting an app does not prove the OS file cache is cold.
7. Use repeatable runs for p50 and p95. A practical starting protocol is at least 30 samples for key short interactions, with outliers retained and explained; use a documented smaller count for expensive manual scenarios and do not call it a robust percentile baseline.
8. Define numerical budgets from that baseline and the supported-device target before accepting optimizations. Publish the budgets and sample counts rather than inventing a speed claim from one good run.

**Dependencies:** None. Can proceed alongside UX-01.

**Done when:** Measurements describe what the user actually waits for; the startup test runs meaningfully; baseline results and remaining device gaps are recorded. The absence of an oldest-supported-device run remains explicit until performed.

**Source pointers:** `CodeLibraryViewModel.swift` — `isInitialContentLoaded` / `firstUsableContent`; `permitext-sync-server/tests/startup-critical-path-contract.mjs`; `EntitlementAndSyncContractTests.swift` — `testEveryBundledChapterPreparesDisplayContentFromColdCache`.

### 2. PERF-02 — Remove the fixed iOS launch hold

**Priority:** P1.

**Surface:** iOS launch.

**Evidence:** Source-confirmed one-second sleep followed by a 0.35-second splash transition.

**Work to do:**

1. Replace the timer prerequisite with actual readiness of the first useful screen.
2. Allow essential library preparation to continue as required; preserve honest loading and error states when preparation is incomplete.
3. Ensure branding transitions do not delay touch interaction after the screen is ready.
4. Check first installation, ordinary signed-in launch, signed-out launch, offline launch, background return, and interrupted initialization.
5. Compare launch-to-usable, immediate chapter opening, and immediate search against PERF-01. Removing the splash must not merely reveal an unresponsive screen or shift the same wait into the first tap.

**Dependencies:** PERF-01 measurement milestones.

**Done when:** No fixed timer prevents use of an already-ready screen; first-frame presentation is clean; immediate Reader and Search actions remain responsive and correct.

**Source pointer:** `NYC CC APP/permitext/PermitextApp.swift` — launch root gating and `.task` around lines 331–360 in the audited revision.

### 3. PERF-03 — Shorten native chapter tap-to-readable work

**Priority:** P1.

**Surface:** iOS Reader chapter navigation.

**Evidence:** Source-confirmed extra work awaited after native preparation succeeds.

**Implementation update:** Native fast return, bounded current/recent warming, requested-category selection, shared-load handoff, warmup resumption and explicit chapter-top restoration are implemented. Development Release **41.6** is installed. Two Chapter 10 card openings prepared in **7.704/12.437 ms** and emitted content appearance at **198.771/166.026 ms**; a separate Search-return check preserved the scrolled viewport. One startup sample reached first usable content in **2,126.653 ms** from model initialization, not OS launch. The targeted correction is validated; broader cold/warm percentile and long-content/table/figure acceptance remains open, so PERF-03 is not marked fully accepted. See `docs/performance/PERF_03_CURRENT_RECENT_CHAPTERS.md`. Persistent search caching remains PERF-04 and is not implemented here. Optional edition downloads are a separate PERF-17 proposal.

**Work to do:**

1. Trace the successful-native, unavailable-native, validation-failure, and cancellation routes separately.
2. When a validated native opening is ready, return it without awaiting unrelated HTML fallback preparation, anchor extraction, and ten section-detail loads.
3. Keep fallback available when actually required. Do not remove validation or suppress a native preparation error by displaying mismatched content.
4. Narrow attributed-text preparation before first display to the selected passage and genuinely necessary visible content. The current nearby range can include many blocks and nested list items.
5. After first useful presentation, prepare the current/recent chapter shortlist within the existing four-document / 48 MiB budget. Fill unused slots with likely chapters; do not sweep every chapter or eagerly prepare unused HTML fallback. Explicit navigation/search supersedes speculative work. This pulls only the necessary priority coordination from PERF-07 forward.
6. Preserve the selected anchor and remembered viewport so a faster first paint does not produce a later jump.
7. Test large chapters, deep links into the middle, tables, figures, long lists, rapid chapter switching, and cancellation during preparation.

**Dependencies:** PERF-01; coordinate with PERF-07.

**Done when:** Native chapter opening no longer awaits unused fallback preparation; tap-to-readable improves beyond normal measurement noise; initial scroll and subsequent fast scrolling do not regress.

**Source pointers:** `CodeLibraryViewModel.swift` — `prepareChapterForOpening`, `warmChapterReaderEntry`; `NativeChapterTextReaderView.swift` — `loadDocument` and attributed-text prewarming.

### 4. PERF-04 — Make native search matching independent of rich passage loading

**Current task (owner authorized):** Implement exact generated search text and persistent completed-result caching. Chapter changes are committed through `c177c8062`; their remaining broad release matrix is still recorded under PERF-03. Search changes are implemented and installed as development Release 41.7; host parity and targeted device rendering pass. Persisted concrete results and actual cache-hit events are verified on the installed phone. Two warm full-query operations took 68.017/67.568 ms; final-input-to-results-ready took 320.349/316.303 ms including debounce. A warmed-corpus uncached uppercase query took 147.277 ms; a post-restart persistent hit took 41.942 ms (prefix queries warmed stores). Broad cold-process/offline/resource acceptance remains open. Targeted implementation work is complete; following the owner’s detail-card emphasis, PERF-06 is the next bounded task before PERF-05. See `docs/performance/PERF_04_SEARCH_TEXT_AND_RESULT_CACHE.md`.

**Priority:** P1.

**Surface:** iOS all-edition and scoped search.

**Evidence:** Source-confirmed candidate verification through `officialText`, which can load and decode rich section files.

**Work to do:**

1. Measure candidate lookup, per-section reads/decodes, exact-match verification, ranking, snippet work, and per-edition publication separately.
2. Build or extend a compact searchable-text representation keyed by corpus revision, edition, section, and canonical target identity.
3. Preserve phrase, punctuation, normalization, section-number, and ranking semantics. Use positional postings or lightweight text verification where necessary; do not approximate exact matches to gain speed.
4. Keep rich tables, figures, and display blocks out of match verification. Load them when opening content; derive visible snippets from the lightweight text representation where possible.
5. Add a direct-reference path for section-number queries if profiling demonstrates that general text matching is doing unnecessary work for them.
6. Preserve progressive publication across editions, complete coverage, stable final ordering, and cancellation. Do not make a narrower default scope the performance fix.
7. Version the generated index with the corpus and provide a safe compatibility/fallback route for stale or missing indexes.
8. Compare old/new results across broad words, exact phrases, direct section numbers, punctuation, historical editions, no-match queries, and offline operation.

9. Add a bounded, persistent cache of completed public-text search results. Key entries by query normalized using the actual engine semantics, scope and installed edition set, corpus revisions, and search-engine/index schema version. Persist canonical result identities and ranking; avoid storing rich passage bodies. Keep account-specific saves/annotations out of this cache and recompute them for the active account.
10. Reuse a valid complete entry immediately on repeat searches, including after relaunch. Never persist a cancelled, partial, or failed all-edition run as a complete result set. Apply count and byte limits with least-recently-used eviction; retain a safe normal-search fallback for corruption or missing targets.
11. Invalidate on corpus or engine changes, not merely elapsed time or any app update. Ship a corpus revision/manifest with text updates, including updates delivered outside the App Store. An unrelated binary update can retain compatible entries. Do not show old-corpus results as current enacted text while rebuilding.
12. Optionally refresh the most-used invalidated queries after current reading/search work is idle, within PERF-07's work budget. Test repeat queries, relaunch/offline reuse, edition changes, changed text, changed ranking, interrupted writes, cancellation, corruption, and eviction. Measure first-time and cached latency separately; caching must not conceal a slow first search.

**Dependencies:** PERF-01. UX-03 should accurately describe incremental results during implementation.

**Done when:** Matching avoids rich-content decoding for ordinary candidates; result identities and intended ranking agree with the reference behavior; first-result and completion time improve without increasing memory beyond the agreed budget.

**Source pointers:** `AuthoredCodeStore.swift` — `search`, `officialText`, `preparedSectionData`; `CodeLibraryViewModel.swift` — `searchAllEditions`.

### 5. PERF-05 — Make expanded native search groups lazy at the result level

**September 23 implementation:** Individual headers/results now sit directly in the lazy stack; preview extraction is capped at two workers with queued cancellation and stale-response guards. Counts, complete arrays and edition-aware identities remain unchanged. Production limiter host stress tests and generic unsigned iOS Release compilation pass without a phone or simulator. Focused physical UI acceptance passed for2022/2014 concrete passage text/references, repeated opening and return position; inspected card rendering passes. Full traversal, accessibility variants and measured scrolling performance remain open. See `docs/performance/PERF_05_LAZY_SEARCH_RESULTS.md`.

**Priority:** P1.

**Surface:** iOS Search results and previews.

**Evidence:** Source-confirmed ordinary result stacks inside lazy outer grouping; 322 results were observed in one expanded edition group.

**Work to do:**

1. Refactor the grouped presentation so individual result rows are lazily materialized; preserve family and edition headings.
2. Start preview work for visible or near-visible rows only, with bounded concurrency.
3. Cancel or disregard obsolete preview tasks when the query, scope, edition expansion, or destination changes.
4. Key row and preview identity by edition plus canonical result identity, not section number alone.
5. Keep result counts and the complete result collection independent of which rows have been rendered.
6. Verify that expanding a large group, scrolling quickly, collapsing it, and returning from Reader preserve stable positions and accessible focus.

**Dependencies:** PERF-01. Can improve rendering before PERF-04 is complete; integrate afterward.

**Done when:** Expanding a large group does not instantiate or hydrate every result; first-screen rows appear promptly; all results remain reachable; scrolling and preview cancellation stay correct.

**Source pointer:** `NYC CC APP/permitext/Views/SearchView.swift` — grouped `LazyVStack` / `ForEach(group.results)` and row preview tasks.

### 6. PERF-06 — Remove unrelated Saved rebuilding from search-result opening

**Current task:** Lightweight Saved controls with guarded complete-evidence export and unused fallback-formatting removal are implemented. Build 41.8 still showed a 3,452.736 ms detail opening dominated by passage data. Targeted rich extraction now avoids sibling parsing and repeated heading-prefix scans; 40 content-parity cases pass, and host extraction for the tested passage fell from 4,118.149 to 9.863 ms. Development Release 41.9 is installed; 2022 detail text/references render correctly. Actual device timing and broader acceptance remain open. Signed development Release41.11 is now installed; six physical unit tests and focused2022/2014 Search UI acceptance pass, and owner verified horizontal table access. The saved USB recording exported on September 23 but contains no detail-opening events, so it supplies no device latency evidence. Owner authorized proceeding with PERF-05 without phone/simulator while keeping PERF-06 physical acceptance open. Production session-transition host checks pass for account switch, sign-out and same-account rollover. See `docs/performance/PERF_06_SEARCH_DETAIL_OPENING.md`.

**Priority:** P1.

**Surface:** iOS Search → Reader.

**Owner emphasis (September 22 evening):** Fast search alone is insufficient: the selected detail card must show its actual information promptly. Treat tap → content visible as a separate acceptance measure, with cold and repeated opens, rich tables/references, correct edition, and preserved Search return state. The current single observed sample is 771.893 ms to content appearance (188.262 ms to destination preparation); this is a baseline to improve, not a completed fast-opening claim.

**Evidence:** Source-confirmed creation of an independent library model followed by `refreshBookmarks`. The current result route already reuses loaded corpus stores and passes `prepareChapter: false`; retain those improvements.

**Work to do:**

1. Profile model creation, account-service setup, Saved hydration, selected-section resolution, and presentation separately.
2. Use a lightweight independent reader session that shares read-only corpus and account services while retaining its own navigation and viewport state.
3. Obtain save/note state needed for the selected result without rebuilding the entire Saved evidence collection on every open.
4. Ensure the secondary reader cannot start duplicate account sync or overwrite the main Reader's selection and continuity.
5. Preserve edition-specific annotations, shared save updates, sign-out behavior, and account-switch invalidation.
6. Compare small-account and large-account fixtures so a constant-looking cost on the current account does not hide scaling problems.

**Dependencies:** PERF-01; UX-01 establishes the correct evidence identity rules.

**Done when:** Opening a result performs only necessary reader work; Saved size does not introduce proportional unrelated work; result edition and independent reading context remain correct.

**Source pointers:** `CodeLibraryViewModel.swift` — `makeSearchReaderLibrary`, `refreshBookmarks`; `SearchView.swift` — `PreparedSearchReaderDestination.prepare`.

### 7. PERF-07 — Coordinate warmups and bound recreatable caches

**September 23 implementation:** Authored rich caches now have per-section LRU/count/cost limits and generation-safe memory purge across current/all-edition stores. Native speculative warmups cannot evict existing documents; foreground requests promote shared work and evict speculative entries before demand LRU entries. Host parity, cache/cancellation/pressure contracts and generic unsigned iOS Release build pass without phone/simulator. Aggregate memory/latency measurements, physical pressure/reopen acceptance remain open. Identical synthesized-HTML requests now also share in-flight work; full-chapter consumers receive their own passages independently of cache admission. Prepared-section/block concurrent decodes now share in-flight results with deterministic purge/failure/oversize tests passing. See `docs/performance/PERF_07_CACHE_AND_WARMUP_BUDGETS.md`.

**Priority:** P1.

**Surface:** iOS memory, background preparation, and repeat-use speed.

**Evidence:** Startup can prioritize five chapter documents while the native cache has a four-document limit. Search stores retain parsed-section dictionaries outside the existing memory-warning purge. Actual memory-pressure impact needs profiling.

**Work to do:**

1. Inventory cache ownership, keys, count/cost limits, in-flight work, and references keeping entries alive.
2. Establish a single priority policy: active user request first, visible/selected content next, likely adjacent content afterward, speculative fallback work last.
3. Coalesce duplicate chapter/index/preview requests. Cancelling one consumer must not invalidate another active consumer's required work.
4. Make startup warmup selection fit the effective cache budget. Avoid warming a likely-return chapter only to evict it with lower-priority chapters.
5. Bound parsed-section and preview caches by estimated cost or an evidence-based limit; retain lightweight index metadata separately where useful.
6. Purge recreatable search-store caches on memory pressure and cancel obsolete background tasks. Preserve durable saved work, pending sync, current content needed for interaction, and reading position.
7. Key caches by edition and corpus revision, with theme/type-size identity where rendering depends on them.
8. Profile repeated broad searches, many chapter visits, background/foreground cycles, memory warnings, and post-purge reopening.

**Dependencies:** PERF-01; coordinate with PERF-03, PERF-04, and PERF-05.

**Done when:** Memory stabilizes during repeated use; cache work respects user priority; purging recovers safely; neither launch nor the next chapter/search becomes slower because warming was indiscriminately removed.

**Source pointers:** `CodeLibraryViewModel.swift` — startup warmups, `allEditionSearchStores`, `handleMemoryWarning`; `AuthoredCodeStore.swift` — prepared-section dictionaries; `NativeReaderDocumentStore.swift` — cache limits.

### 8. PERF-08 — Preserve valid sync checkpoints across ordinary native launches

**Implementation update (September 23):** SQLite-local checkpoints now bind progress to the actual account database and backup snapshot; ordinary launch/account activation resets removed. New/legacy/replaced stores still pull fully. Upload and individual conflict acknowledgements cannot advance the pull cursor. Eight initial and 12 follow-up physical tests passed, covering partial replay, conflict resolution, pending uploads and server rollback recovery. A 500-save fixture avoided 140,785 bytes of mutation JSON and all 500 record applications on unchanged reopen. Production contention and Release timing remain open. See [PERF-08 evidence](performance/PERF_08_DATABASE_CHECKPOINTS.md).

**Priority:** P1.

**Surface:** iOS signed-in startup and synchronization.

**Evidence:** Initialization resets the checkpoint whenever a resolved profile and signed-in account exist. The accompanying rationale concerns a new/migrated profile, but the condition is broader.

**Work to do:**

1. Track whether the isolated profile is newly created, migrated, restored, or already valid.
2. Force a full pull only when profile/checkpoint provenance requires it, or the server explicitly requests recovery.
3. Preserve validated checkpoints on ordinary relaunches and use incremental sync.
4. Keep checkpoints bound to the correct account, local store identity, and compatible sync schema.
5. Test new installation, legacy migration, ordinary relaunch, account switching, revoked sessions, interrupted pulls, expired cursors, pending writes, and server-requested full recovery.
6. Measure payload size, database work, and contention with Reader/Search, rather than treating all background activity as a launch blocker.

**Dependencies:** PERF-01; regression coverage must protect UX-01's Saved parity.

**Done when:** Ordinary launches reuse valid checkpoints; new/migrated profiles still receive complete data; no missing records, resurrected deletions, or account leakage occurs.

**Source pointer:** `CodeLibraryViewModel.swift` — initializer checkpoint reset around lines 514–520 in the audited revision.

### 9. PERF-09 — Stop repeating entire chapter metadata in body-window responses

**Implementation update (September 23):** Opt-in compact windows implemented with edition/revision/range validation, legacy compatibility and cached-full-body reuse. Chapter 33 first-five-body JSON fell from 359,819 to 4,696 bytes; all 1,029 section bodies retain exact parity. Local rendered opening/jump/append/prepend checks passed. Production/CDN and signed-in acceptance remain open. See [PERF-09 evidence](performance/PERF_09_COMPACT_CHAPTER_WINDOWS.md).

**Priority:** P1.

**Surface:** Web Reader and chapter API.

**Evidence:** Observed approximately 355 KB decoded summary plus 360 KB decoded five-body response for Chapter 33. Source shows metadata for all sections returned with each window.

**Work to do:**

1. Define a chapter manifest containing the required navigation/group metadata once.
2. Define body-window responses containing requested section bodies and the minimal identity/range metadata needed to merge them safely.
3. Include corpus revision and edition identity so the client cannot combine windows from different revisions.
4. Consider a selected-section opening response that provides its body and necessary context in one request, if it removes the initial sequential summary/window waterfall without duplicating large metadata.
5. Preserve canonical/alias target resolution, group headings, before/after loading, selection, annotations, and remembered scroll position.
6. Handle rapid chapter changes and partial network failures without appending stale windows into a newer chapter.
7. Maintain compatibility with older clients through an explicit response contract or versioned route; do not silently break existing consumers.
8. Measure compressed transfer, decoded bytes, parse time, request count, first-readable time, and scroll-triggered hydration on large chapters.

**Dependencies:** PERF-01; coordinate the identity contract with PERF-13.

**Done when:** Subsequent windows do not repeat the full manifest; initial passage loading is measurably lighter; all sections remain continuously reachable with stable position and correct content.

**Source pointers:** `permitext-sync-server/app.mjs` — `chapterSectionsWithRequestedBodies`; `public/app.js` — `renderSectionContent`, `fetchChapterBodyWindow`, progressive hydration.

### 10. PERF-10 — Replace full-chapter downloads for web in-reader search

**Priority:** P1.

**Surface:** Web Search in reader.

**Evidence:** Source-confirmed `fetchChapter(..., { includeBody: true })` before matching. One full Chapter 33 request exceeded a 20-second client timeout during the audit.

**Local implementation:** Indexed chapter search, complete offline fallback, abort-on-supersession, revision-bound result opening and Find position restoration are implemented on the performance branch. Chapter 33 `concrete` retains all 54 results while reducing the decoded search response from 2,212,129 to 24,984 bytes (98.87%). Generated coverage: 578 chapters / 32,551 sections. Local contract/HTTP/browser evidence and remaining production/offline acceptance are detailed in [PERF-10 record](performance/PERF_10_LIGHTWEIGHT_CHAPTER_SEARCH.md).

**Implementation checklist:**

1. Add or reuse chapter-scoped lightweight search with the current exact-first and typo-tolerant matching contract.
2. Return result identities, headings, counts/progress, and bounded snippets without fetching all rich bodies.
3. Open a match through the selected-section/window path from PERF-09.
4. Cancel superseded searches; preserve the Reader's original location for closing search or recovering from failure.
5. Preserve supported offline chapter-search behavior using local indexed text or an explicit available-content strategy. Do not silently search only currently rendered sections.
6. Test phrases spanning formatting boundaries, tables, nested lists, section headings, no results, network failure, and a large chapter.

**Dependencies:** PERF-01; PERF-09 for efficient opening. Coordinate with PERF-12 cancellation.

**Done when:** Searching a chapter does not require downloading all rich chapter bodies; complete intended coverage and existing matching behavior are retained; closing search restores Reader context.

**Source pointer:** `permitext-sync-server/public/app.js` — `renderReaderInternalSearchResults`.

### 11. PERF-11 — Mount and hydrate workspace panes independently

**Priority:** P1.

**Surface:** Web initial/restored workspace, Saved, Reader, Project Notebook, and Report.

**Evidence:** Source-confirmed full-render path awaiting synchronization and several pane preparations before appending the pane sequence. Existing utility rendering already reuses panes and should remain the foundation.

**Status:** Complete locally for released web surfaces. Public Reader/Search mount before sync; private panes verify access and hydrate independently. Browser evidence covers delayed/denied sync, Report Retry, installed-snapshot recovery, account/session changes, Notebook state, resizing and drag order. Initial Project reads are shared and Reader normalization no longer restarts loads. Source/regression/offline/smoke checks pass. This is not a deployment or production/device latency claim. See the [final acceptance record](performance/PERF_11_ACCEPTANCE_REMAINING.md).

**Work to do:**

1. Identify initial load, account restore, continuity updates, and pane operations that still enter the full-render path.
2. Mount stable pane shells in the correct order and dimensions promptly, then hydrate independent content without repeatedly reconstructing unaffected panes.
3. Use account-verified cached snapshots for immediate continuity when appropriate, with explicit pending/offline state and correct reconciliation.
4. Preserve access checks for shared/private Project content. Do not expose a cached pane while its account identity or authorization is uncertain.
5. Isolate loading and retry states per pane so one slow Notebook or sync request does not block an otherwise usable Reader.
6. Protect unsaved editors, selection, focus, scroll positions, resize geometry, and drag order during hydration and refresh.
7. Coalesce duplicated Project/Saved requests and reuse already-loaded transition payloads where valid.
8. Verify a fixture workspace containing multiple Readers, Search, Saved, Notebook, and Report, including one deliberately slow or failed pane.

**Dependencies:** PERF-01; UX-03 loading-state semantics; PERF-16 supplies populated fixtures.

**Done when:** Usable panes appear independently; existing panes do not blink or lose state; slow/private panes remain recoverable without exposing stale account data.

**Source pointers:** `public/app.js` — `renderWorkspace`, `renderUtilityWorkspace`, `ensureSyncedContentForRender`, `loadSyncedContent`, Notebook snapshot loading.

### 12. PERF-12 — Reduce synchronous work while typing and cancel obsolete requests

**Priority:** P2, elevated if traces show typing stalls.

**Surface:** Web Search and rapid navigation.

**Status:** Locally complete for web. Query persistence coalesces, final query flushes across lifecycle boundaries, obsolete Search/Reader requests cancel with shared-consumer protection, and generation/account guards remain. Native keyboard entry saved the populated workspace once instead of per key; browser reload, delayed cancellation, composition-event and delete/retype checks pass. Focused regression suites and all smoke components pass (segmented run). See `performance/PERF_12_SEARCH_TYPING_AND_CANCELLATION.md` and its browser evidence. Not merged, pushed or deployed; no physical iOS timing claim.

**Evidence:** Search input invokes broad workspace persistence on each keystroke before its debounce; stale results are ignored without necessarily aborting their network work.

**Work to do:**

1. Separate transient query/filter state from durable notes, drafts, saves, and pending sync mutations.
2. Debounce or coalesce transient query persistence so each keystroke does not serialize and write the complete workspace state.
3. Preserve the expected final query across blur, navigation, and reload using an explicit flush policy.
4. Add request cancellation for superseded search and chapter requests where supported.
5. Retain generation/identity checks even after adding cancellation; cancellation alone does not guarantee stale responses cannot arrive.
6. Bound shared-request cancellation so a request still required by another pane remains usable.
7. Verify fast typing, delete/retype, IME composition, pasted queries, rapid scope changes, network latency, and immediate navigation away.

**Dependencies:** PERF-01; coordinate with PERF-10 and PERF-11.

**Done when:** Typing does not trigger broad synchronous persistence per key; obsolete work is reduced; the final query persists correctly; durable editing guarantees remain intact.

**Source pointers:** `public/app.js` — search input handler, `saveWorkspaceState`, shared `api` request helper and search generation handling.

### 13. PERF-13 — Cache public code content safely by revision

**Status:** Locally complete for web. Bounded public response caching/ETags, revision-pinned text and figures, background browser invalidation, bounded Reader recovery and legacy offline compatibility are implemented. HTTP, browser recovery/figure decoding, revision/rollback/privacy contracts, full smoke and deployment-content verification pass; all 578 regenerated Reader indexes retain identical search content. See `performance/PERF_13_REVISION_SAFE_PUBLIC_CACHE.md`. No deployment/CDN or physical-iPhone timing acceptance claimed.

**Priority:** P2.

**Surface:** Web public code APIs, browser cache, CDN, and offline storage.

**Evidence:** Tested code endpoints returned `no-store` without ETags. This observation does not establish that static shell assets lack CDN caching.

**Work to do:**

1. Classify endpoints into immutable public corpus content, mutable public manifests/search, and private/account responses.
2. Include corpus revision/hash in immutable content identities and use appropriate cache headers there.
3. Use validators and revalidation for mutable manifests or unversioned routes; do not label changing enacted-code URLs permanently immutable.
4. Key search caching by all behavior-affecting inputs, including corpus revision, query, edition/scope, pagination, and search mode.
5. Keep private Saved, Project, Notebook, and account data outside public shared caching.
6. Align browser, service-worker, in-memory, and CDN cache invalidation. Preserve offline access to a coherent revision instead of mixing cached old metadata with new bodies.
7. Test content revision changes, stale responses, cache misses, offline launch, and rollback compatibility.

**Dependencies:** PERF-09 response/identity contract; PERF-01 measurements.

**Done when:** Repeat public reads benefit measurably from caching; revision changes appear correctly; no private data is publicly cached; offline tests pass.

**Source pointers:** `app.mjs` — public code handlers and JSON response headers; `public/app.js` — chapter/search caches; offline contracts and service-worker shell generation.

### 14. PERF-14 — Investigate slow first-use search and chapter request tails

**Priority:** P2 investigation; promote demonstrated server bottlenecks to P1.

**Surface:** Public search and chapter backend.

**Evidence:** Large differences between first/repeat request samples and one full-chapter timeout. The audit did not establish a specific infrastructure cause.

**Work to do:**

1. Record bounded server timing for initialization, index loading, candidate matching, snippet generation, content reads, serialization, and total response time.
2. Correlate client request IDs with server traces without logging private account content or full sensitive queries unnecessarily.
3. Repeat representative queries across controlled sessions and distinguish cold process initialization from content cache misses and network variation.
4. Reproduce the Chapter 33 timeout under an explicit test budget and inspect the slow phase before changing limits or retries.
5. Optimize only the demonstrated cause: reusable index initialization, coalesced reads, lightweight snippets, compact serialization, or another measured issue.
6. Preserve pagination, cancellation behavior, complete matching semantics, and recoverable errors.

**Dependencies:** PERF-01. Use results from PERF-09 and PERF-13 to avoid optimizing obsolete payload paths.

**Done when:** Slow requests have an evidenced cause and a repeatable improvement; request distributions improve without hiding failures through longer timeouts or unbounded retries.

**Source pointers:** `app.mjs` — code search and chapter handlers; `permitext-sync-server/tests/backend-performance-contract.mjs`.

### 15. PERF-15 — Reduce eager web script/style work where traces justify it

**Priority:** P2, profiling-dependent.

**Surface:** Web shell startup and optional tools.

**Evidence:** Main script measured approximately 1.77 MB raw / 365 KB gzip. File size alone does not establish a startup bottleneck.

**Work to do:**

1. Measure actual parse/evaluation, style recalculation, and imported-module cost during first usable workspace presentation.
2. Identify optional feature code on that path; avoid splitting small code solely to reduce file size.
3. Load substantial optional modules on intent, with a bounded prefetch policy for likely next actions.
4. Preserve existing lazy module handling and prevent duplicate downloads or initialization after splitting.
5. Verify module failures and offline loading with clear retry behavior.
6. Compare launch improvement against first-open latency for the affected tool; do not merely move all waiting from startup to the first click.

**Dependencies:** PERF-01 and PERF-11. Schedule after larger data-path issues unless traces show otherwise.

**Done when:** Measured startup work decreases, optional-tool first use remains within budget, and cache/offline behavior is verified.

**Source pointers:** `public/app.js` — static imports and optional-module loaders; `public/styles.css`; shell/offline contracts.

### 16. PERF-16 — Close populated-workspace and large-account coverage gaps

**Priority:** P1 verification requirement, performed across the implementation batches.

**Surfaces:** Saved, Projects, Notebook, Reports, sync, and workspace restoration.

**Evidence:** Coverage gap; the audited account had no populated Projects for an end-to-end walkthrough.

**Work to do:**

1. Prepare isolated non-production fixtures for a small account, a large multi-edition Saved collection, multiple Projects, long Notebooks, and populated Reports.
2. Record fixture sizes explicitly: evidence rows, notes, Projects, notebook cards, images, and report content.
3. Test initial loading, tab/pane return, edits, autosave, restore after relaunch, offline recovery, and one slow/failed request.
4. Exercise multi-column layout operations while editors have unsaved changes; preserve every draft and focus/selection where expected.
5. Compare the cost of one visible item/pane with total account size to identify unnecessary whole-account work.
6. Convert any newly observed bottleneck into a bounded task with source evidence, a measurement, and an acceptance criterion; do not label untested areas as passing.

**Dependencies:** PERF-01. Supplies acceptance coverage for PERF-06, PERF-08, and PERF-11.

**Done when:** Populated workflows have rendered and measured evidence. Any unavailable device, account scenario, or release environment is explicitly recorded as remaining coverage.

### 17. PERF-17 — Evaluate downloadable editions with 2022/2014 bundled by default

**Priority:** P2 proposal raised by the owner; evaluate after PERF-04. This is not authorization to remove currently bundled content or narrow existing users' search silently.

**Surface:** iOS distribution, edition availability, Search, Reader and saved references.

**Evidence:** The owner identifies 2022 and 2014 as the editions most used at present. Downloading other editions on demand could reduce distribution/storage costs and the scope of local all-edition searches. However, the `concrete` baseline spent 28.5 of 29.3 seconds in the first edition; reducing edition count alone does not address that dominant search cost. Startup benefit remains to be measured.

**Work to do:**

1. Inventory compressed install/download size and expanded storage by edition, including duplicated HTML, native documents, media, prepared sections and indexes. Measure actual startup loading; distinguish bundled-but-unopened bytes from work on the launch path.
2. Prototype 2022/2014 as bundled defaults and other editions as optional coherent code packs. Define which code families are included in each default edition; do not infer that every 2022/2014 family can be removed independently without product review.
3. Define a revisioned pack manifest with canonical identities, integrity validation and compatible text/index/media versions. Install atomically, support interrupted-download retry, and retain the prior usable revision until replacement validation succeeds.
4. Search downloaded editions with clear scope and a discoverable route to other available editions. Do not label partial installed coverage as a search of the full available corpus. Invalidate PERF-04 result caches when installed scope or corpus revisions change.
5. Existing saved passages, notes and shared links must resolve to their edition and offer an appropriate download when required; retain user content. Explain offline unavailability and provide storage/download management with explicit removal controls.
6. Migrate existing installations deliberately: do not silently delete downloaded or previously available content, break offline workflows, or replace historic sources with current editions. Review cross-platform expectations before rollout.
7. Validate interrupted downloads, insufficient storage, corrupt packs, updates/rollback, offline reopening, deep links and saved historical references. Compare first search, repeat search, installation size and startup independently.

**Dependencies:** PERF-04 versioned search/index/result-cache contracts; PERF-07 memory/storage budgets; separate UX review of edition/download status.

**Done when:** A measured prototype and migration proposal establish the benefit and preserved coverage. Obtain the owner's decision on default content and rollout before removing bundled editions. This proposal does not displace the current chapter task or first-search repair.

### 18. PERF-18 — Let users choose active code editions without uninstalling them

**Priority:** P2 proposal raised by the owner on September 22 evening. Record the direction; do not silently change existing scope or displace the current detail-loading correction.

**Surface:** iOS edition settings, Browse, Search, background warming, saved references; evaluate web parity separately.

**Purpose:** An owner can keep 2022/2014 active and turn off unused sources such as 1968. Disabled content may remain installed for fast reactivation, while ordinary search/browsing and speculative loading exclude it. This can reduce work and resident memory; it does not fix slow extraction inside an active chapter or reduce bundled download size.

**Work to do:**

1. Map user-facing code family + edition identities to actual corpus bundles/categories. A displayed edition is not necessarily one resource bundle; disabling 1968 Building Code must not disable unrelated sources sharing a pack.
2. Persist a versioned active-source selection. Keep installed, active and downloadable states distinct. Preserve existing installations' current active scope during migration unless the user deliberately changes it.
3. Apply the active-source set consistently to Browse, all-edition search, preview tasks, startup readiness work and speculative warming. Cancel pending work for newly disabled sources and evict recreatable content when safe; never remove user data.
4. Include the ordered active-source set in completed-search cache keys. Changing scope must never reuse a complete result set from a different scope. Label results as active/enabled editions rather than all installed editions when these differ.
5. Keep existing saves, notes, annotations and shared links visible with their original edition identity. A disabled-source opening should offer to enable that source, preserving the user's explicit off setting until chosen. Never substitute an active edition's text. Define behavior when disabling the currently open source and when no source remains active.
6. Reactivate installed sources without a download; unavailable packs follow PERF-17 download/integrity/offline handling. Account switching and updates must preserve or migrate selection deliberately.
7. Measure startup, first/repeat search, memory and activation time with all sources enabled versus 2022/2014 only. Verify re-enable, cache invalidation, interrupted in-flight searches, saved references, offline use and cross-device expectations.

**Dependencies:** PERF-04 scope-aware result caching, PERF-07 work scheduling/cache budgets, PERF-17 installed/downloadable pack model, separate settings UX review.

**Done when:** Explicit active-source controls consistently bound ordinary loading and search, reactivation works, preserved historical work stays accessible, and measured benefits are documented. Do not call it a fix for the current detail-card extraction delay.

## 3. UX/UI — numbered implementation priorities

### 1. UX-01 — Repair missing historical notes and unify Saved evidence identity

**Priority:** P0 correctness.

**Surfaces:** Web Saved, native Saved parity, and shared evidence semantics.

**Evidence:** Observed four entries on iPhone versus two on web; isolated reproduction of historical annotations being dropped by the web consolidation function.

**Work to do:**

1. Preserve the real records while diagnosing. Compare canonical identities and record types, not only visible counts; distinguish a bookmark, section note, passage note, and project-only link.
2. Pass the actual annotation target, including edition, into `annotationForTarget` from `consolidatedSavedAnnotations`.
3. Replace section-only merge/suppression keys in `mergeSavedColumnItems` with the appropriate edition-aware section or passage identity. Do not collapse notes from different editions because their IDs look alike.
4. Make unassigned classification include note-only evidence according to the same product policy as iOS; currently the web's unassigned key set is derived from saved-item records.
5. Preserve note merging, deleted records, bulk-clear semantics, project membership, record timestamps, and pending local changes.
6. Check historical metadata hydration and opening so a row can neither display nor navigate into the default edition accidentally.
7. Add focused regression cases for a 1968 note, a 2014 note, a current-edition bookmark, a passage note, overlapping section IDs across editions, and deleted/cleared annotations.
8. Verify the same account on iPhone and web after refresh and relaunch. Investigate any remaining mismatch as identity/sync evidence, not just a count difference.

**Dependencies:** None. Coordinate with PERF-06 and PERF-08.

**Done when:** Every supported saved/note-only item appears under the same inclusion rules on both platforms, opens the correct edition and passage, and survives refresh/relaunch. No deletion or destructive migration is required to make the list look consistent.

**Source pointers:** `public/app.js` — `annotationRecordsForTarget`, `consolidatedSavedAnnotations`, `mergeSavedColumnItems`, `unassignedSavedEvidenceKeys`; `BookmarksView.swift` — `unassignedBookmarks`; `AuthoredCodeStore.swift` — `savedSections`.

### 2. UX-02 — Make Unassigned saves equally discoverable on web and iPhone

**Priority:** P1.

**Surfaces:** Saved entry, group labels, filters, and counts.

**Evidence:** Observed web items labeled individually as Unassigned, while iPhone exposes a separate Unassigned saves destination. The user could not readily tell whether web had the equivalent.

**Work to do:**

1. Define one user-facing term, preferably **Unassigned saves**, for the equivalent collection.
2. Give the web collection a clear entry or heading in the existing Saved structure, including the no-Project case.
3. Keep platform-appropriate layouts; consistent meaning does not require copying the phone layout into desktop columns.
4. Define whether a displayed count represents evidence rows or unique sections and apply that rule consistently, including passage notes.
5. Ensure active filters, empty results, and project assignment cannot make an item disappear without an understandable state change.
6. Explain organization briefly where useful: these items are saved but not assigned to a Project. Keep organization optional.

**Dependencies:** UX-01 must establish correct contents first.

**Done when:** A user can locate the same unassigned collection immediately on both platforms; labels, counts, and filters agree with the documented inclusion rule.

### 3. UX-03 — Make search counts, progress, and empty states truthful

**Priority:** P1.

**Surfaces:** Web Search and iOS Search.

**Evidence:** Web displayed “25 Matches” while more matches remained; iOS displayed zero results while searching was still in progress.

**Work to do:**

1. Model searching, partial results, completed results, cancelled queries, and failures distinctly.
2. On web, distinguish loaded count from known total. Use wording such as “25 loaded · more available” when the total is unknown.
3. Apply the same distinction to edition/group counts. Do not present the loaded subset as a complete edition total.
4. On iOS, show “Searching…” before results and “N found · searching more editions” while work continues, or equivalent concise wording.
5. Reserve a definitive no-results state for a completed search over the requested available scope.
6. Keep partial results usable after a recoverable failure and identify incomplete coverage where appropriate.
7. Announce meaningful search-state changes accessibly without flooding VoiceOver or screen-reader output on every incremental update.

**Dependencies:** Coordinate with PERF-04, PERF-05, PERF-10, and PERF-12.

**Done when:** Every displayed count and empty message accurately describes loaded data and completion state; pagination and incremental search never imply false completeness.

**Source pointers:** `public/app.js` — `updateSearchDock` and pagination callers; `SearchView.swift` — `resultCountLabel`.

### 4. UX-04 — Make result and saved-passage titles recognizable

**Priority:** P1.

**Surfaces:** Search rows, Saved rows, and selected-result headers.

**Evidence:** Observed numeric-only nested titles such as “2.1” and repeated paragraph text; native result 107.5 omitted its descriptive title in the opened sheet.

**Work to do:**

1. Define a concise display hierarchy: edition/source, parent section where needed, selected subsection or paragraph, and descriptive title.
2. Include parent context when a nested paragraph number cannot uniquely identify the passage to a reader.
3. Avoid repeating the complete same paragraph as both title and preview. Preserve the exact official passage in Reader.
4. Retain descriptive titles when opening a search result, including “107.5 Means of egress plans.”
5. Use canonical metadata rather than guessing parent numbers from a snippet or an ambiguous short title.
6. Check narrow web columns, large Dynamic Type, long titles, historical numbering, tables, and saved block-level passages.

**Dependencies:** UX-01 identity rules; coordinate row construction with PERF-05 and PERF-06.

**Done when:** Users can identify the passage and edition before opening it; headings remain accurate and accessible without modifying enacted text.

### 5. UX-05 — Clarify opening a result and moving into chapter context

**Priority:** P1.

**Surfaces:** Search → Reader and Saved → Reader on both platforms.

**Evidence:** Observed platform-specific destinations and insufficiently explicit native chapter-context navigation; product governance requires preservation of occupied Reader context.

**Work to do:**

1. Document the intended behavior of a normal result tap, Open in reader, New reader, and Open full chapter where those actions exist.
2. Keep the native passage sheet fast while making the route to surrounding chapter content clear.
3. Preserve the selected section/anchor when opening chapter context; avoid sending the user to the chapter top unexpectedly.
4. On web, make destination actions understandable and distinguishable at the normal utility-column width.
5. Preserve the existing Reader unless the user explicitly chooses to reuse/replace that context.
6. Preserve search query, filters, expansion, and scroll position on return.
7. Respect entitlement limits and provide an understandable outcome if another Reader cannot be added.

**Dependencies:** PERF-03, PERF-06, and PERF-09; UX-04 title/context display.

**Done when:** The destination of each action is predictable; the correct passage opens; existing reading and search context survives.

### 6. UX-06 — Restore visible keyboard focus and verify accessible interaction

**Priority:** P1.

**Surface:** Desktop web, with native accessibility verification for changed controls.

**Evidence:** A global `:focus-visible` rule removes outlines and shadows; the focused web control was observed without those indicators. This conflicts with the repository's visible-focus governance.

**Work to do:**

1. Replace the blanket focus suppression with a consistent, visible keyboard treatment using semantic styling tokens.
2. Keep pointer interaction visually quiet where intended without suppressing keyboard location.
3. Review legacy tests that assert outline removal; replace implementation-shape assertions with the intended accessible behavior where appropriate.
4. Exercise toolbar controls, search fields, result rows, disclosures, Reader references, Saved actions, dialogs, and pane operations with keyboard alone.
5. Verify logical focus order, Escape behavior, focus return after dialogs, and focus retention during asynchronous updates.
6. Measure changed text/control contrast in both themes and check accessible names/selected state.
7. Verify changed native controls with VoiceOver, increased Dynamic Type, and the existing 44-point critical-touch-target requirement.

**Dependencies:** None for the focus correction; recheck surfaces changed by later tasks.

**Done when:** Keyboard location is plainly visible throughout supported flows; no focus trap or lost-focus regression remains; changed controls meet the repository's accessibility requirements.

**Source pointers:** `public/styles.css` — blanket `:focus-visible` rule around line 16645; `tests/ux-ui-accessibility-phase2-contract.mjs`; `docs/PERMITEXT_UX_UI_GOVERNANCE.md`.

### 7. UX-07 — Reduce unnecessary search-group expansion steps

**Priority:** P2 design proposal.

**Surfaces:** Search grouping on web and iOS.

**Evidence:** Results were initially hidden behind collapsed edition groups in both inspected interfaces.

**Work to do:**

1. Compare remembering the user's expansion choices with opening the most relevant/currently filtered group for a new query.
2. Make the initial rule deterministic and understandable; do not secretly narrow the search scope.
3. Preserve explicit collapse/expand choices for the active query and prevent incremental result updates from reopening groups the user closed.
4. Keep historical and other-edition matches discoverable, with truthful counts from UX-03.
5. Verify the behavior using a narrow exact query and a broad multi-edition query.

**Dependencies:** PERF-05 so default expansion does not create a rendering penalty; UX-03 and UX-04.

**Done when:** The chosen design reduces steps to a useful match, respects explicit user choices, and does not overwhelm the list or reduce coverage. Record rendered acceptance of the changed default.

### 8. UX-08 — Add restrained guidance to genuinely empty entry screens

**Priority:** P2 design proposal.

**Surfaces:** Empty web workspace and native Saved home.

**Evidence:** Empty/spare screens were observed with limited guidance about the next action.

**Work to do:**

1. Distinguish an intentionally empty workspace from loading, sync failure, no saved content, and a filter with no matches.
2. For a workspace with no panes, consider a compact Reader/Search prompt within the current visual language.
3. For Saved, explain where existing unassigned content lives or how saving a passage populates the collection.
4. Remove guidance when content is present; avoid persistent onboarding panels in an established workspace.
5. Keep the user's current column layout, mobile-web policy, native bottom controls, and Reader destinations.
6. Leave the separately deferred Notebook/Project Hub empty/error redesign out of this task.

**Dependencies:** UX-02 and UX-03 state semantics; PERF-11 mounting behavior.

**Done when:** A truly empty entry screen offers an understandable next action without making loading/failure look empty or changing the established workspace design.

### 9. UX-09 — Prevent empty Research drafts from crowding history

**Priority:** P2 design proposal.

**Surfaces:** Research history on web and iPhone.

**Evidence:** Five Empty draft entries were observed before substantive conversations on both platforms.

**Work to do:**

1. Define a truly empty draft: no authored text, submitted messages, retained source selection, attachment, or recoverable pending request.
2. Choose a reversible presentation rule: reuse one empty draft or omit truly empty entries from the main history until meaningful content exists.
3. Preserve drafts with selected evidence even when no question has been sent.
4. Keep existing records intact during the presentation change; do not bulk-delete historical drafts as an automatic cleanup.
5. Ensure the same definition is used by both platforms and during sync/relaunch recovery.
6. Verify using fixtures and existing history without making paid Research requests.

**Dependencies:** Draft/sync regression coverage; maintain the explicit Research scope boundary in section 1.4.

**Done when:** Empty placeholders no longer crowd meaningful history, and no text, source selection, attachment, or pending request is lost.

**Source pointers:** `ResearchView.swift` — empty-draft summary labeling; `public/app.js` — Research conversation summary/title handling.

### 10. UX-10 — Improve source labels, truncation, and edition applicability cues

**Priority:** P2 targeted visual review.

**Surfaces:** Native Reader controls, search groups, source headers, and narrow web columns.

**Evidence:** Some native chapter labels were truncated; future-effective content appeared alongside other editions. These observations justify review, not an assumed redesign or legal applicability conclusion.

**Work to do:**

1. Ensure the active code, edition, and chapter can be identified even where a compact title is truncated.
2. Preserve the two native Reader destinations; distinguish their current contexts clearly when short labels are similar.
3. Consider a concise Upcoming cue for future-effective editions, alongside the existing effective-date text. Derive this from authoritative metadata and the relevant date, not a hard-coded label.
4. Avoid implying that the app has determined which edition governs a user's Project solely because that edition appears in results.
5. Inspect narrow columns, long historical titles, large Dynamic Type, light/dark themes, and touch targets before choosing revised sizing or labels.
6. Keep enacted text and source details accessible without adding repetitive chrome to every paragraph.

**Dependencies:** UX-04 source/title hierarchy; visual acceptance on actual affected screens.

**Done when:** Context is identifiable and applicability cues are factual; controls remain compact, reachable, and readable without obscuring content.

### 11. UX-11 — Complete a populated-workspace UX and recovery walkthrough

**Priority:** P1 verification requirement, performed alongside the relevant changes.

**Surfaces:** Projects, Notebook, Reports, Saved organization, and workspace recovery.

**Evidence:** Coverage gap in the original account walkthrough.

**Work to do:**

1. Use the isolated populated fixtures from PERF-16.
2. Walk through finding a saved passage, assigning it to a Project, opening the correct source, editing a Notebook, and opening the corresponding Report workflow.
3. Verify navigation back to Reader/Search and return to unsaved editing work.
4. Inspect empty, loading, failed, offline, read-only/shared-access, and retry states separately.
5. Test opening, closing, resizing, reordering, and restoring columns while content loads and drafts are pending.
6. Record concrete screen-level friction separately from speculative redesign proposals.
7. Keep deferred product decisions deferred unless the user later explicitly includes them; this task verifies existing behavior and reports findings.

**Dependencies:** PERF-16 fixtures; UX-01 identity; PERF-11 pane behavior.

**Done when:** Current supported populated workflows have rendered evidence, correct source destinations, recoverable failures, and preserved drafts. Newly discovered defects are explicitly added to the backlog with priority and evidence.

## 4. Combined delivery order

1. **Batch 1 — Establish correctness and a credible baseline.** Complete UX-01 and PERF-01. Prepare the isolated fixture data for PERF-16/UX-11. These can progress independently within one implementation effort.
2. **Batch 2 — Improve native opening.** Implement PERF-02 and PERF-03, coordinating the minimum necessary parts of PERF-07. Add UX-04/UX-05 changes only where the affected opening path needs them.
3. **Batch 3 — Improve native search.** Implement PERF-04, PERF-05, and PERF-06, with UX-03. Finish the relevant cache budgeting in PERF-07. Verify first results, all results, result opening, and return navigation as one journey.
4. **Batch 4 — Correct repeat-use and sync costs.** Complete PERF-08 and remaining PERF-07 work. Exercise Saved parity and large-account cases after relaunch, offline recovery, and memory pressure.
5. **Batch 5 — Improve web content delivery.** Implement PERF-09 and PERF-10. Use PERF-14 traces to determine whether server matching/initialization requires additional changes. Coordinate cache identity with PERF-13 before finalizing the endpoint contract.
6. **Batch 6 — Improve workspace restoration and typing.** Implement PERF-11 and PERF-12, using the populated scenarios from PERF-16. Complete UX-02 and UX-06 where they have not already been delivered.
7. **Batch 7 — Apply measured secondary improvements.** Complete justified PERF-13/PERF-14/PERF-15 work and reviewed UX-07 through UX-10 proposals. Avoid introducing unmeasured architectural changes merely to exhaust the list.
8. **Batch 8 — Close cross-platform acceptance.** Finish PERF-16 and UX-11, compare final metrics against the original baseline, and run the integration gates below. Record any unresolved coverage honestly.

A later batch number does not require delaying an isolated correctness or accessibility fix. Keep changes reviewable and traceable to their acceptance criteria; avoid one combined rewrite of startup, Reader, search, sync, and workspace state.

## 5. Verification and release gates

### 5.1 Functional and content gates

1. **Saved parity:** same supported records and editions on iPhone/web, including historical notes and passage-level evidence; correct targets after refresh and relaunch.
2. **Search completeness:** reference queries retain expected result identities, phrase semantics, ranking rules, and all-edition coverage; partial results are labeled honestly.
3. **Reader fidelity:** text, lists, tables, figures, references, source validation, selection, and saved annotations remain correct.
4. **Continuity:** selected result, chapter viewport, search position, independent Reader contexts, and workspace geometry survive the relevant transitions.
5. **Sync safety:** migration, incremental pulls, account switch, expired cursor, pending writes, deletions, and offline recovery remain correct.
6. **Editor safety:** Notebook and other durable drafts survive navigation, pane refresh, failures, and relaunch according to the product's existing contract.

### 5.2 Performance gates

1. Record the same metrics and scenarios before and after each relevant batch.
2. Improve the intended interaction beyond normal test variability; report p50 and p95 with sample count and environment.
3. Do not accept faster launch if immediate chapter opening or immediate search regresses materially.
4. Do not accept faster first results if final completeness, result opening, or scrolling becomes materially worse.
5. Do not accept lower memory if ordinary repeat-use speed or offline readiness becomes materially worse.
6. Verify request count, decoded bytes, and main-thread work alongside elapsed time to explain the improvement.
7. Run physical-device Release/Profile verification; keep development, TestFlight, and App Store observations separate.
8. Keep oldest-supported-device testing open until that hardware or equivalent agreed coverage is actually available.

### 5.3 Existing repository checks to apply when their surfaces change

Run from `permitext-sync-server` unless otherwise stated. These are an implementation checklist, not claims that they passed during plan creation.

```sh
npm run audit:ux-ui
npm run test:ux-alignment
npm run test:offline
node tests/startup-critical-path-contract.mjs
node tests/search-reader-reuse-contract.mjs
node tests/reader-scroll-continuity-contract.mjs
node tests/reader-search-recovery-contract.mjs
node tests/backend-performance-contract.mjs
```

1. Repair the known startup test fixture failure before relying on its result.
2. Select the relevant existing native unit/contract tests, then add focused tests for changed correctness behavior and meaningful performance measurements.
3. Add explicit regression coverage for historical Saved identity, note-only inclusion, checkpoint migration, compact body-window contracts, and search completeness where existing tests do not cover them.
4. Follow [UX/UI governance](PERMITEXT_UX_UI_GOVERNANCE.md) for rendered light/dark verification, keyboard focus, native Dynamic Type, and evidence separation.
5. Run broader server/persistence/cache checks when the changed shared surface requires them. Do not run paid Research evaluations under this plan without a separate authorized scope and budget.
6. Treat screenshots, actual navigation, and device interaction as required evidence for changed visual behavior. Source assertions alone do not establish a successful interface.

### 5.4 Completion record for each task

1. Task ID and exact scope implemented.
2. Before/after behavior and the user-visible benefit.
3. Changed source areas and relevant commit.
4. Automated checks run, results, and meaningful failures still open.
5. Browser/device scenarios exercised, build provenance, and rendered evidence.
6. Performance baseline/comparison with sample sizes, where applicable.
7. Content, sync, offline, accessibility, and continuity checks relevant to the change.
8. Remaining risks or coverage gaps.
9. Deployment/TestFlight/App Store status recorded separately; a local pass or commit does not mean users have the change.

## 6. Source map and planning boundaries

Paths below are repository-relative; line numbers mentioned above refer to the audited revision and will move during implementation.

1. Native launch: `NYC CC APP/permitext/PermitextApp.swift`.
2. Native startup, chapter preparation, search sessions, sync, and memory handling: `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift`.
3. Native corpus search and saved evidence construction: `NYC CC APP/permitext/Data/AuthoredCodeStore.swift`.
4. Native prepared-document cache: `NYC CC APP/permitext/Data/NativeReaderDocumentStore.swift`.
5. Native Reader presentation: `NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift`.
6. Native Search and Saved UI: `NYC CC APP/permitext/Views/SearchView.swift` and `NYC CC APP/permitext/Views/BookmarksView.swift`.
7. Native Research history: `NYC CC APP/permitext/Views/ResearchView.swift`.
8. Native contract coverage: `NYC CC APP/permitextTests/EntitlementAndSyncContractTests.swift`.
9. Web workspace, Saved, Reader, and Search: `permitext-sync-server/public/app.js`.
10. Web presentation: `permitext-sync-server/public/styles.css`.
11. Backend chapter/search response construction: `permitext-sync-server/app.mjs`.
12. Product interaction/accessibility requirements: [Permitext UX/UI Governance](PERMITEXT_UX_UI_GOVERNANCE.md) and [Web UI/UX Rules](../permitext-sync-server/WEB_UI_UX_RULES.md). Where older descriptive rules conflict with newer explicit product decisions, preserve the current approved direction and document the resolution.

This plan prioritizes removal of unnecessary work while preserving the app's capabilities. It does not propose rewriting the app, narrowing search to hide costs, deleting saved content, changing Research economics, restoring retired surfaces, or redesigning the workspace wholesale. Progress is complete only when the relevant behavior and measurements are verified at the claimed delivery layer.
