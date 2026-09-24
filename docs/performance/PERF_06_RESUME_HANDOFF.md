> Current checkpoint: PERF-11 public-first startup integration is locally implemented on codex/permitext-performance. Held-sync and denied-sync/Retry browser checks retain public panes; Search focus and selection survive sync release. Expanded access, lifecycle, pane hydration, Notebook/Report, offline and final smoke tests pass. Asset generation public-startup-v561 / shell1204. Remaining: final requirement audit and rendered account transitions before PERF-11 completion. Owner preview8796 is untouched; synthetic backend8797 and proxies8798/8799 remain active. No phone, simulator, merge, push or deployment used.

> Latest source checkpoint: scoped Reader/Search private-presentation gates and explicit sync verification/fallback provenance implemented and tested. Orchestrators still do not supply the gate; public-before-sync remains pending. Run npm run test:workspace-access. Asset560/shell1203; full smoke/offline/index checks pass. Isolated browser perf11-mixed/server8797 session30015 remain available; owner8796 unchanged. See PERF_11_INDEPENDENT_PANE_LOADING.md for integration requirements and unrelated Research/iOS assertion failure.

> Browser acceptance update: fresh session perf11-mixed on isolated server8797 (session30015) verified real mixed workspace: four held Report requests did not block two Readers, concrete Search results, Saved or Notebook. Releasing Report preserved exact Notebook editor/pane nodes, text, focus and selection. See PERF_11_MIXED_BROWSER_EVIDENCE_2026-09-23.json. Old perf11-verify was closed because it cached an intermediate module. Owner8796 remains untouched. Next: public-before-sync scoped permission gate, failed-request/account/access browser acceptance, and target-pane completion.

> Latest checkpoint: PERF-11 independent pane publication after sync is implemented locally. Coordinator/orchestration, Report failure, sync-conflict and rename regression tests pass; full smoke and offline checks pass. Guest browser confirms Reader/Search DOM retention when adding Search. Public-first sync separation, real mixed signed-in/editor/browser timing, and target-pane completion remain open; see PERF_11_INDEPENDENT_PANE_LOADING.md. Owner preview localhost8796 remains running (session59781); separate verification server8797 session28690 and browser perf11-verify are active. No phone needed; no merge/push/deployment.

> Latest checkpoint: PERF-10 lightweight web Reader search is locally implemented and verified on the performance branch. Complete compressed indexes cover 578 chapters / 32,551 sections. Chapter 33 concrete retains 54 results with 2,212,129→24,984 decoded bytes. Cancellation, complete offline fallback, revision-bound opening, and close-Find anchor restoration are implemented. See `PERF_10_LIGHTWEIGHT_CHAPTER_SEARCH.md` and its evidence JSON for tests and limits. Production/constrained-network and signed-in installed-offline acceptance remain open; no main merge/push/deployment. Phone remains development Release 41.13 and is not required for this web work. Next bounded implementation: PERF-11 independent workspace pane mounting/hydration. Preserve the documented pre-existing specialty Find/display paragraph segmentation mismatch.

> Latest checkpoint: PERF-09 compact web Reader windows committed locally as `06f3438ab`. All 1,029 Chapter 33 section bodies retain parity; first-five-body response 359,819→4,696 bytes. Chapter/edition/revision/range validation, legacy/full-body compatibility and complete-cache reuse implemented. Local rendered Reader opening/jump/append/prepend, contract/offline/deploy-content tests and full smoke passed. See `PERF_09_COMPACT_CHAPTER_WINDOWS.md` for evidence/limits. Named browser sessions closed and isolated localhost8796 server stopped. Phone remains development Release41.13. Next bounded implementation: PERF-10 lightweight web in-reader search.

> Latest checkpoint: PERF-08 recovery follow-up committed `6c43d0db4`; 12 physical tests plus five local server checks passed. Synthetic 500-save reopen avoided 140,785 bytes of mutation JSON and 500 record applications. Signed development Release 1.0 (41.13) installed, launched and version verified. No active build/test/trace remains. Production contention/timing remains open. Next bounded implementation: PERF-09 web chapter-window payload contract; worktree clean after evidence commit.

> Latest checkpoint: PERF-08 database-bound sync checkpoints committed locally as `6cc39b17a`. Eight targeted physical tests passed; signed development Release 1.0 (41.12) built, installed, launched and installed version verified. No active build/test/trace remains. See `PERF_08_DATABASE_CHECKPOINTS.md` for implementation and remaining sync/performance acceptance. Phone remained connected/unlocked throughout; no owner interaction required. Broader earlier Release timing/memory matrices remain open. Continue one task at a time.

> Latest checkpoint: all six physical unit tests and the focused concrete Search UI test passed. Signed development Release41.11 restored/installed/launched and version verified; no active trace/build/test remains. Source through0f4813c78 includes bounded caches and all prepared/synthesized decode coalescing. UI test result `/tmp/permitext-perf05-physical-ui.xcresult`. Table722.2.4 horizontal access passed by owner direct touch. Release detail timings remain open because both recovered manual traces lacked opening sequences. Continue plan one task at a time; next bounded implementation is PERF-08 checkpoint provenance. Broad PERF-01/03/04/05/06/07 release matrices remain explicitly open.

> Latest: trace32550 completed and exported, no detail-opening samples; six physical XCTests succeeded (session77608 ended). Installed test host is Debug41.11, requiring signed Release restoration after UI tests. See coverage JSON and PERF-07 doc. Automated focused UI test being added by perf05_physical_ui_contract.

> Current validation: synthesized coalescing committed `dbc6b3fb7`, generic Release build passed. Targeted physical XCTest run started, session77608, log `/tmp/permitext-perf07-physical-tests.log`, result `/tmp/permitext-perf07-physical-tests.xcresult`. Debug test-host version override41.11 may replace41.10 during run; restore a signed Release build afterward and verify installation provenance. Selected six tests cover Search Saved controls/export/comments, bounded native cache purge, shared chapter loads, cancellation and retry. No Simulator. Current trace session32550/PID27477 is still saving; sample shows symbol signature encoding, not a device wait.

> Owner clarified workflow preference: continue independently when they are away. Mirroring remains allowed when available; keep useful source/tests/profiling work moving instead of repeatedly requiring lock/unlock cycles. Physical unlock, USB connection and unsupported gestures may still require owner input. Current app PID was82893 when queried September23; requery before attaching.

> September 23 evening: 41.10 signed development Release installed from 695b4a32b; rendered spot checks committed in dff204624. New trace `/tmp/permitext-4110-detail-usb.trace` recorder session32550/PID27477 is finalizing after SIGINT. Recording did start with phone USB-connected/unlocked. Owner first replied Done, then clarified the result was not open yet, then confirmed opening403.2.3.3. Therefore coverage of that opening and any repeat is uncertain until export; do not claim a latency. Poll this exact live session/PID before exporting or starting another trace.

> Superseded September 23: the recording exported successfully but contains no detail-opening events. See PERF_06_BUILD_419_TRACE_COVERAGE_2026-09-23.json. No recorder remains active. Owner authorized proceeding to PERF-05 without phone or simulator; PERF-06 device acceptance remains open.

# PERF-06 resume checkpoint — September 22, 2026

## Scope and state

Continue one performance task at a time. Current task is Search result detail opening (PERF-06), before PERF-05. Do not treat host extraction time as tap-to-visible latency. PERF-18 active editions remains a proposal, not implemented.

Worktree: `/Users/randy/.codex/worktrees/permitext-performance/Building Code`, branch `codex/permitext-performance`.

- Main last verified at `55302eded`; subsequent performance commits have not been merged/pushed to main.
- `d5551c8ff`: deferred Saved presentation with complete-evidence export guard, and unused fallback-formatting removal.
- `4b0962d36`: targeted rich-passage extraction, preserving original parser boundaries and block enrichment.
- `539a5712a`: executable account-transition checks; refreshed evidence docs.
- Installed build: **1.0 (41.9), signed local development Release**, not TestFlight.

## Evidence

- 40 targeted/full rich-block parity cases passed.
- Optimized host extraction for 2022 BC403.2.3.3: 4,118.149 ms full chapter vs 9.863 ms targeted. This is not device UI latency.
- All six generated search packs remain valid.
- Deferred Saved host checks pass, including actual production session synchronization for account switch, sign-out and same-account session replacement. Repository/cancellation/folder dependencies are fixtures.
- Physical 41.9 renders 1,286 concrete results and the correct 2022 BC403.2.3.3 text, edition and references.
- Build 41.8 had one complete 3,452.736 ms tap-to-content interval, dominated by passage loading. See its timing JSON.

## Pending recording

`/tmp/permitext-419-detail-unlocked.trace` captured with phone unlocked over USB, all processes, Blank + os_signpost, 180-second limit. Recorder reported start and reached its time limit without a reported connection failure. Owner confirmed manually searching concrete and opening/closing/reopening 2022 BC403.2.3.3. Coverage remains unverified until export; actions may not both fall within the window.

At checkpoint, recorder session **85687**, PID **80089**, reported `Recording completed. Saving output file...` and is still saving. An export attempted before this message failed with `Document Missing Template Error`; retry only after saving completes. Poll the same session or inspect PID before deciding it stopped. A sample showed active Instruments symbolication work. Do not kill or restart merely because finalization is slow.

After successful save:

```sh
xcrun xctrace export --input /tmp/permitext-419-detail-unlocked.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="os-signpost"]' --output /tmp/permitext-419-detail-unlocked.xml
python3 Tools/permitext_signpost_summary.py /tmp/permitext-419-detail-unlocked.xml
python3 /tmp/permitext_extract_detail_samples.py /tmp/permitext-419-detail-unlocked.xml
```

Inspect complete request → destination prepared → passage data ready → content appeared events, plus sectionDetailLoad/publishedBlockExtraction intervals. Check process, chronology, dropped-event warnings and actual sample coverage. Store sanitized timing JSON in docs/performance, leave raw trace/XML in /tmp. Update PERF_06_SEARCH_DETAIL_OPENING.md and the priority plan, then commit.

## Remaining acceptance

Physical 41.9 timing; rich table/figure cases; existing Saved/folder controls; broader cold/repeat/large-account matrix. Added XCTest is not run because no available Simulator was listed. Do not call PERF-06 fully accepted based only on the single rendered passage and host tests.

Phone last requested state: unlocked and connected by USB during save. User indicated about ten minutes remained before needing to pause; no new performance task should start in that window.

User explicitly requested pausing at this checkpoint. Leave the existing recorder to finish naturally; no replacement recording was started.
