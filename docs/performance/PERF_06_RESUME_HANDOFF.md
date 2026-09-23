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
