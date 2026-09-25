# Local development timing fallback

Instruments repeatedly failed to attach to the physical phone, even when CoreDevice showed a wired, booted device. Mirroring functional checks remained usable. This fallback records the existing application milestones locally; it does not replace CPU, memory, main-thread-stall, or display-server measurement.

## Build and storage boundary

Only builds explicitly compiled with `SWIFT_ACTIVE_COMPILATION_CONDITIONS=PERMITEXT_LOCAL_PERFORMANCE` enable recording. Normal builds contain no recorder storage/writer. The profiling configuration remains Release with coverage disabled. Build 41.17 compiled with this flag, passed strict signature verification, was installed in place and successfully produced an extracted physical-device record.

The recorder accepts a finite milestone enum. Each event has a sequence, monotonic uptime and milestone; the snapshot adds schema, random run UUID, bounded app-build string, capacity and dropped-event count. There are no queries, passage IDs/text, source selections, account identifiers or network transport.

The first 2,048 events are retained; subsequent events increment a dropped count. A single utility queue coalesces atomic writes to `Library/Caches/PermitextPerformance/current.json` approximately one second after activity. A single replaced file bounds storage across launches. Per-event work includes a lock, clock and bounded append; overhead is nonzero and has not been measured on-device. Suspension/termination may lose the last second, and a write failure can leave an old file. Run UUID, build and dropped count must be checked before analysis.

## Physical procedure

1. Install the verified development profiling artifact in place. Do not uninstall or clear owner data.
2. Launch Permitext and use Mirroring for one sequential scenario at a time. Note visible source scope and result count separately; the recorder intentionally omits them.
3. Run Search to completion, then open and close one exact result repeatedly. Avoid overlapping requests. Inspect complete body, references and edition identity independently of timing.
4. Allow the asynchronous snapshot write to finish while the app remains foreground. Copy only the timing file:

   ```sh
   xcrun devicectl device copy from --device 00008150-001535280CC0401C \
     --domain-type appDataContainer --domain-identifier com.randycodex.permitext \
     --source Library/Caches/PermitextPerformance/current.json \
     --destination /tmp/permitext-local-timing.json --timeout 20
   ```

5. Confirm expected build and a fresh run UUID, then summarize:

   ```sh
   python3 Tools/permitext_local_timing_summary.py /tmp/permitext-local-timing.json --expected-build 41.17
   ```

6. Keep raw sequential samples. Do not report percentiles from a few interactions. Retest with the same configuration for comparisons. A completed local capture does not close missing account, cold-launch, offline or resource gates.

## What the report means

- Search work ends only after current-generation complete publication; cancellation, partial outcomes, failures and overlapping requests are excluded. This interval excludes input debounce.
- Result opening is measured separately to body `onAppear` and reference-data readiness.
- Native chapter opening uses destination preparation and native content `onAppear` or the separate restoration-completed callback; the report identifies which endpoint occurred.
- SwiftUI `onAppear` is an application callback, not proof of the exact displayed frame. Combine it with rendered correctness observations; retain that limitation.
- The analyzer rejects wrong-build, truncated, unordered and invalid snapshots. Overlapping requests invalidate that interval family because no per-request identifier is collected.

Host validation: enabled/disabled actual Swift recorder contracts pass concurrency, cap, sequence/clock order, delayed flush, fixed schema and run replacement. Five analyzer tests cover successful complete Search, partial exclusion, separate body/reference intervals, overlapping requests, missing endings and invalid snapshots. Existing active-source aggregate passes with instrumentation disabled. Physical extraction succeeded on build 41.17; see the evidence below.

## First physical capture — September 24, build 41.17

The in-place development build preserved Search history and all-installed-source scope. Mirroring opened 2022 Building Chapter 4 at its correct heading and enacted text. Search input initially did not focus through mirrored taps; a subsequent lower-field tap and typing succeeded. This was not measured as query latency and its cause is not established.

The completed `concrete` query visibly included 2022 Building 450, 2014 Building 456 and 1968 Building 69. The recorder explicitly reported a completed-search cache hit: this is a cached query, not a cold uncached benchmark. Section 403.2.3.3 showed the correct 2022 identity, complete enacted sentence and both references on two sequential openings. Closing retained the query and expanded results.

[Raw bounded events](PERF_18_RELEASE_41_17_LOCAL_TIMING_EVENTS.json) and [validated summary](PERF_18_RELEASE_41_17_LOCAL_TIMING_SUMMARY.json) contain 37 events, a new run UUID and zero dropped events. A second sequential query was added before installing the next build.

- Chapter request to native content callback: 200.753 ms (one sample).
- Cached Search work to complete callback: 556.072 ms on first use after launch, then 300.410 ms on a warm repeat. First-use last input scheduling to completion including debounce: 811.093 ms. Both queries hit the saved cache; neither is an uncached Search sample.
- Detail request to body onAppear: 485.448 ms, then 431.062 ms.
- Detail request to references ready: 577.736 ms, then 523.282 ms.

These are application callback samples, not exact displayed-frame latency or percentiles. The Search cache hit occurred about 406 ms after search work began; detail destination preparation consumed about 221/186 ms before body preparation. These boundaries identify follow-up investigation areas, not proven CPU bottlenecks. Cold uncached Search, repeated distribution, offline behavior, account transitions and CPU/memory gates remain open.

## Follow-up from the first capture

The cached Search path published identical results/filters/stores once inside the detached task and again in the outer completion. It now publishes once through the existing cancellation/generation-checked completion, retaining the first-results milestone there. Edition and category-name validation maps are constructed once rather than linearly searched for each cached result; all identity, source scope, result metadata and corpus-integrity checks remain.

The actual coordinator regression now asserts exactly one nonempty publication for a cache hit and identical results/filters. All 11 native active-source/cache suites pass. These changes compiled in build 41.18, passed strict signature verification and were installed in place; initial physical comparison follows. The remaining detail-opening latency is still under investigation.

## Build 41.18 cached Search comparison

The same physical phone, all-installed-source scope and `concrete` query were used after in-place installation. First-use cached Search work completed in 273.686 ms; a clear/retype warm repeat completed in 47.385 ms. Both emitted cache-hit events and complete-publication milestones. Visible Building counts remained 2022:450, 2014:456, 1968:69; the other visible edition groups also retained their counts. The new run UUID and zero dropped events distinguish this capture from 41.17.

Compared with 41.17 pilot samples (556.072/300.410 ms), these two samples are encouraging but do not establish a distribution or isolate thermal/OS-cache differences. Timing excludes input debounce and measures application completion, not the displayed frame. No first-uncached-query speed claim is made. See [raw events](PERF_18_RELEASE_41_18_LOCAL_TIMING_EVENTS.json), [summary](PERF_18_RELEASE_41_18_LOCAL_TIMING_SUMMARY.json) and [build provenance](PERF_18_RELEASE_41_18_BUILD.json).

## Independent result Reader setup follow-up

Source review found every independent Reader initialization ran owner-only checkpoint migration and pending/conflict repository queries on the main actor, despite `ownsAccountSync:false`. Initialization now gates those two calls on ownership. Existing exact-source preflight, independent navigation, account identity, saved controls and main-owner sync remain in place. The existing checkpoint read is unchanged.

An executable probe of the production initialization branch verifies the owner still invokes both calls while an independent Reader invokes neither. The saved-control contract passes immediate/deferred controls, failure/retry, account changes, source-settings delegation and mutation/export handling. All 11 active-source/cache suites pass. Build 41.19 passed compilation and strict signature verification, was installed in place and version-verified; its device timing is pending. The 41.17 destination-to-data interval includes sheet presentation/task scheduling, so no claim is made that these queries explain the full interval.

### Detail baseline captured before installing 41.19

On installed 41.18, two sequential openings of 2022 Building 403.2.3.3 produced body onAppear intervals of 176.880/139.117 ms and reference-ready intervals of 215.763/156.841 ms. Exact edition, full enacted sentence and both references were visibly correct; dismissing retained the query and expanded group. The same-run capture now contains 35 events with zero drops.

These samples precede the owner-sync initialization change and therefore cannot be credited to it. They are substantially lower than 41.17 detail samples, reinforcing the need for matched comparisons and more repetitions before assigning a stable causal improvement. 41.19 comparison remains pending.

### Historical edition acceptance extension

Two later openings in the same 41.18 run targeted 2014 Building 403.2.3.3 (event sequences 36–40 and 41–45). Body callbacks were 146.480/138.318 ms; references were ready at 182.565/155.730 ms. The 2014 edition label, enacted sentence and both reference rows appeared correctly on both openings. Dismissal retained the query and expanded 2014 group.

**Open context-label defect:** above 403.2.3.3, the 2014 detail displays `401.1 Detailed use and occupancy requirements.` and repeats the chapter heading. The unrelated context line was visible on both openings. This is a presentation/metadata issue requiring source tracing; its cause and whether it predates this work are not established. Do not mark full historical-detail correctness as passed. No text or UI fix was bundled into the running 41.19 performance build. Latest raw capture has 45 events and zero drops; earlier 2022 measurements retain their original sequence identities.

The historical-label diagnosis reproduced the exact incorrect `401.1` parent by executing the production resolver against prepared 2014 chapter40000009. Its chapter-wide group spans multiple section roots, but the resolver assumes the first root applies to the whole group. A future correction must use direct numbered ancestry for whole-chapter groups while preserving restarted-list handling for section-scoped groups; raw kind is insufficient because historical `section` values decode as titles. Required fixtures include 2014 403.2.3.3 and402.1, appendixG, 2022 restarted items and Existing Building chapter groups. No correction is included in41.19.

## Build 41.19 Reader setup comparison

After launch, cached `concrete` completed in 277.659 ms with expected visible edition counts. Two sequential 2022 Building403.2.3.3 openings produced body onAppear intervals173.950/140.983 ms and reference-ready intervals211.301/154.889 ms. Full enacted text, exact edition and both references appeared correctly; dismissal retained the query and expanded group. [Raw events](PERF_18_RELEASE_41_19_LOCAL_TIMING_EVENTS.json) and [summary](PERF_18_RELEASE_41_19_LOCAL_TIMING_SUMMARY.json) contain23events with a new runUUID and zero drops.

Compared with41.18's176.880/139.117 ms body intervals, these pilot samples show **no measurable opening-speed benefit** from skipping owner sync initialization on this account. The change removes unnecessary repository work and preserves owner behavior, but must not be described as a proven latency improvement. Larger-account scaling is unverified. All application-callback and small-sample limitations still apply; historical context-label correction, broader timing scenarios and functional acceptance remain open.

## Historical context correction awaiting device verification

The resolver now recognizes whole CHAPTER/APPENDIX groups and derives parents from the selected complete section number, preserving the existing restarted-list behavior in section-scoped groups. Seven real-corpus fixtures pass, and all40 adjacent targeted/full rich-block parity and cache cases pass. Build41.20 is being prepared for physical verification. Fixtures cover2014 403.2.3.3,402.1,appendixG;2022 restarted1.1/1.2;Existing Building803/D503. No enacted content was edited. The wrong401.1 label remains open until the corrected build is visually verified.

Additional41.19 functional check:2022 722.2.4 rendered its exact edition, enacted text, table, unit conversion and both footnotes. Mirroring drag and horizontal scroll did not reveal the rightmost columns. This remains unverified on this build rather than a confirmed table defect; an earlier direct-phone check succeeded.

## Exact-link startup check on41.19

The installed corpus identifies section261 as2022 Building403.2.3.3. A devicectl `--terminate-existing --payload-url https://permitext.com/open/section/261` launch succeeded and Mirroring showed that exact edition/passage, complete body and both references without further navigation. This verifies application payload routing after process termination; it does not validate Safari universal-link association. An earlier payload launch against the already-running app left the old722.2.4 sheet unchanged and closing it returned to Search; whether the URL was delivered is unproven, so warm-delivery acceptance remains open. No source preferences or account data were changed.

Warm payload follow-up: after explicitly dismissing the detail and verifying the Search/history screen, the same `devicectl --payload-url` command without process termination opened2022 403.2.3.3 with its body/references. Normal warm application routing therefore passes. The earlier no-navigation observation is limited to delivery while a different detail sheet was already presented; retain that narrower unresolved case. Browser universal-link handoff and disabled-source behavior still need their own checks.

## Build41.20 physical historical-context verification

Development-signed, coverage-disabled41.20 passed build and strict signature checks, installed in place and was version-verified. Launch payload `/open/section/41001008` opened the exact2014 Building403.2.3.3 passage. Mirroring showed the corrected parents403.2 Construction and403.2.3 Structural integrity of exit enclosures and elevator hoistway enclosures. The unrelated401.1 line is absent. The full enacted sentence, correct2014 label and both403.2.3.1/.2 reference rows remain present. This closes the observed wrong-parent defect; duplicate chapter-heading presentation remains a separate UX observation. No new timing comparison is claimed for this link-driven opening.

## Confirmed open-sheet link replacement defect

On41.20 the2014 403.2.3.3 sheet remained visible after a payload link requested2022 section261. The local record proves delivery and preparation: events6–7 are a second open request and prepared destination, without another passage-data/body/reference event. The screenshot still showed2014. This isolates an app presentation defect rather than failed payload delivery; see [raw evidence](PERF_18_RELEASE_41_20_SHEET_REPLACEMENT_EVENTS.json).

The sheet now keys its NavigationStack by the prepared independent library object's identity. A new explicit destination replaces the prior StateObject/loaded passage while preserving normal retained-state behavior for unrelated view updates. Existing section-detail ownership and citation-navigation contracts pass. Build41.21 and physical open-sheet replacement verification are pending; do not mark this defect resolved on device yet.

## Disabled-source link acceptance on41.20

Started with All installed code sources. Disabled only2022 Building, verified its off toggle and the other visible toggles on, then closed management. Payload section261 showed Enable this code source? for2022. Cancel returned to Search/history with enabled-only scope and no new passage. Repeating the same link showed the same prompt, proving cancellation did not enable it. Enable and open restored2022 Building and displayed exact2022 403.2.3.3 with full body and both references. Dismissal showed All installed code sources again. Original scope restored; no account sign-out, Saved deletion or paid Research occurred.

## Build 41.21 open-sheet replacement verified

Installed and version-verified development build 41.21 from e88aae1af. With the 2014 403.2.3.3 sheet open, delivered section 261 without terminating the process; the visible sheet changed to 2022 with correct parent context, full body and both references. Delivered section 41001008 without closing the sheet; it changed back to the correct 2014 passage and parents. This closes the retained-sheet defect. Raw evidence: PERF_18_RELEASE_41_21_SHEET_REPLACEMENT_EVENTS.json, new run UUID 3438C051-3650-4DDA-AB7D-D9A9E70097FF, 15 events, zero drops, all three opens reach body and references callbacks. Analyzer reports no issues. These link-driven callbacks are not a manual-tap benchmark or frame measurement. Browser universal-link association and remaining acceptance gates are still open.

## Build 41.21 scoped persisted-cache check

Three raw records (`PERF_18_RELEASE_41_21_CACHE_01_EVENTS.json` through `03`) validate with zero dropped events and no analyzer issues. All-source concrete first/repeat completed-cache hits measured265.884/44.644 ms. Visible Building counts were2022:450,2014:456,1968:69. After disabling only2022 Building, a restarted process produced narrower concrete cache hits274.788/35.629 ms;2022 Building was absent,2014:456 and1968:69 remained, and Fuel Gas2022:6/2014:5 remained. Another terminated-process restart retained disabled scope; re-entering concrete hit the persisted narrower cache in267.975 ms with the same visible editions. These are callback pilot samples excluding debounce, not percentiles or displayed-frame times.

Mirroring keyboard delivery failed partway through an attempted query (only `concr` arrived); record01's341.263 ms non-hit sample belongs to that incomplete query and must not be reported as concrete timing. Restarting Mirroring recovered typing. Query text was visibly empty after the second app restart despite concrete having completed before termination. Source review confirms SearchView only retains SearchSessionSnapshot in static RunningSearchSessions, unlike the independent persistent CompletedSearchCache. This fails row13's query-restoration requirement; cache reuse itself passes. Recently viewed history remained visible. The full recent-query history acceptance is not inferred from that.

Restored2022 Building through the same management toggle and verified All installed code sources before ending device checks. No account switch or Saved modification.
