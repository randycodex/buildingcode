# PERF-04 current handoff — 2026-09-22 evening

## Scope and branch

The owner resumed work and authorized the earlier implementation push to main. Main/origin main contain implementation `55302eded`; the performance branch also contains `8abd9b9d7` (persistence and partial-trace evidence). Continue one performance task at a time; PERF-05 has not started. No TestFlight or App Store publication is authorized. Installed build is local development Release 1.0 (41.7).

Worktree: `/Users/randy/.codex/worktrees/permitext-performance/Building Code`, branch `codex/permitext-performance`. Preserve unrelated main untracked files `DO NOT DELETE.png` and `permitext-sync-server/.typesafe-local/`.

## Completed

Exact mapped UTF-8 search packs cover six editions and 32,551 sections. Matching and previews avoid runtime rich-content reconstruction. Persistent complete-result cache is bounded to 32 entries / 12 MiB, validates canonical metadata, versions query/scope/corpus/engine, and excludes cancelled or incomplete searches. All editions remain bundled.

Host validation passed: full-corpus text equality; 684 ordered search/metadata/snippet cases; six cancellation cases; 17 malformed pack/fallback cases; persistent cache/LRU/corruption/relaunch; actual coordinator restoration/failure/cancellation/revision checks. Signed build and in-place install passed. No rebuild needed unless code changes.

Rendered device checks passed for 1,286 concrete results, 2022/2014 groups and their 403.2.3.3 destinations. Read-only physical cache inspection verified concrete/Concrete records, each 1,286 results, 22 filters and 372,632 bytes. Raw cache remains local; only aggregate evidence is checked in.

## Accepted search timing

`/tmp/permitext-417-cache-allprocess.trace` completed normally. Two warm concrete cache hits took 68.017 / 67.568 ms in the all-edition operation. Final-input-to-results-ready took 320.349 / 316.303 ms including debounce. Each emitted cache-hit count 1,286 and noncancelled completion. Prefixes excluded. This is not a percentile, screen-frame latency, or uncached speedup claim.

Evidence: `PERF_04_BUILD_417_SEARCH_TIMINGS_2026-09-22.json` and `PERF_04_SEARCH_TEXT_AND_RESULT_CACHE.md`.

## Current extraction

`/tmp/permitext-417-search-recovered.trace`, recorder session 57774, captured uppercase `CONCRETE` (new exact key), followed by a process restart through `devicectl --terminate-existing`, then lowercase `concrete`. Both visibly completed with 1,286 results. Recorder was stopped and is saving; wait for successful finalization before export. Typing generates intermediate prefix searches, which can warm stores before the full query; do not label the full-query interval a cold-process-to-result measurement.

Export:

```sh
xcrun xctrace export --input /tmp/permitext-417-search-recovered.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="os-signpost"]' --output /tmp/permitext-417-search-recovered.xml
python3 Tools/permitext_signpost_summary.py /tmp/permitext-417-search-recovered.xml
```

Local helper `/tmp/permitext_extract_search_samples.py` pairs events by process and signpost ID and includes final-input scheduling. Confirm complete-query identities from interaction order, counts and cache-hit/edition events; save only sanitized metrics. Earlier 180-second trace omitted search events; its single result opening was 188.262 ms to prepared / 771.893 ms to content appeared. Do not use mistyped `cocreten` runs as concrete benchmarks.

## Phone control

Device `00008150-001535280CC0401C`; bundle `com.randycodex.permitext`. Phone locked, USB connected. Mirroring works. Direct Instruments attach could not locate the app; `--all-processes` with `/tmp/permitext-signpost-single-options.json` captured signposts successfully. If recorder says waiting for boot, read `devicectl device info details` to refresh connection.

CUA session was reset to recover `noWindowsAvailable`; current variable `phone` binds `com.apple.ScreenContinuity`. Current window 544×1194: Search input approximately (183,1032), clear (482,1032), Search tab (438,1118). Inspect fresh screenshots before actions. Call rewriteDocumentation after compaction. Type one key at a time with an intervening getAXState; bulk unobserved keys reorder. Clipboard paste previously timed out.

## Remaining acceptance

Finish uncached/restart trace extraction; document limitations; commit evidence. Broader repeated cold-process samples, memory-pressure/resource-budget and airplane-mode checks remain open. Do not mark all PERF-04 release acceptance complete solely from warm samples. No need to rerun already-passing host tests for documentation-only updates.
