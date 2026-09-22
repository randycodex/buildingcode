# PERF-04 resume checkpoint — 2026-09-22

Owner explicitly requested a pause to preserve token budget. Do not resume automatically.

## Location and scope

Worktree: `/Users/randy/.codex/worktrees/permitext-performance/Building Code`, branch `codex/permitext-performance`. One performance task at a time. Current task PERF-04; do not start PERF-05. Main/other UX agent is separate; no merge/push/release authorized for this new work. Latest installed app: signed local development Release 1.0 (41.7), not TestFlight.

## Completed

Exact mapped UTF-8 search packs across six editions (32,551 sections), no runtime rich decoding for ordinary candidate matching/snippets; persistent complete-result cache (32 entries/12 MiB, exact query/scope/corpus/engine key, canonical metadata validation, atomic writes, cancellation/failure exclusions). All editions preserved. Pack generation/check: `python3 Tools/permitext_search_text_pack.py` / `--check`; Xcode phase checks staleness with script sandbox retained and recursive input setting enabled.

Host tests passed: full corpus text equality, 684 ordered search/snippet cases, six cancellations, 17 malformed pack/fallback cases, persistent cache/LRU/corruption/relaunch, actual all-edition coordinator failed/partial/cancelled no-write and cold-hit stores/metadata. Frozen original search fixture avoids shallow Git dependency. Final parity log `/tmp/permitext-search-parity-final.log`.

Build `/tmp/permitext-perf04-417-build.log` succeeded; install `/tmp/permitext-perf04-417-install.log` succeeded. Detailed implementation/evidence: `PERF_04_SEARCH_TEXT_AND_RESULT_CACHE.md` in this directory.

## Immediate next step: finish existing trace, not a new build

Recorder session **47666**, path `/tmp/permitext-417-concrete-verified.trace`, single process, explicit subsystem, 180 seconds. It printed `Reached specified time limit, ending recording...` before pause. It may finalize during the pause. Poll session if retained, otherwise inspect process/trace; do not treat an incomplete trace directory as accepted evidence. Recorder normally terminates its launched app at limit; this is not an app crash.

Once saved, run:

```sh
xcrun xctrace export --input /tmp/permitext-417-concrete-verified.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="os-signpost"]' --output /tmp/permitext-417-concrete-verified-events.xml
python3 Tools/permitext_signpost_summary.py /tmp/permitext-417-concrete-verified-events.xml > /tmp/permitext-417-concrete-verified-summary.json
```

Inspect actual events/intervals, not merely export success. All-edition search signpost includes query prefixes produced while typing. Associate full queries by input event times/final-result counts; do not average every prefix as a concrete search. New `completedSearchCacheHit` events identify cache hits. New per-edition stages: `searchCandidateLookup`, `searchMatchVerification`, `searchRanking`, `searchResultMetadata`.

Verified trace interaction order:
1. Fresh app process, empty Search. Type `Concrete` (capital C; distinct cache key not used previously), wait for 1,286 final results.
2. Clear, repeat `Concrete`, 1,286 final results.
3. Clear, type `concrete` lowercase, 1,286 results. This key was completed in the previous app process, so a hit proves persistent reuse across process restart (stores may already be warmed by steps1/2).
4. Expand 2022 Building Code group450. Snippets populate. Open 1.2 detail (a tap landed during row snippet relayout), close. Open403.2.3.3 and verify2022correct text/reference display; close.
5. Collapse2022, expand2014group456, open403.2.3.3 and verify2014text/edition.

Do not claim a cold-to-first-render percentile, memory improvement or airplane-mode verification from these targeted samples. Initial unaccepted trace `/tmp/permitext-417-concrete-first-repeat.trace` exported successfully but had reordered query `cocreten` and prefixes; do not call it a concrete benchmark. First exact lowercaseconcrete was visually verified outside that trace and completed with1,286.

## Mirroring and device

UDID `00008150-001535280CC0401C`; bundle `com.randycodex.permitext`; Xcode27. Mirroring working with phone locked at pause. Use cua APIs; first call after compaction rewriteDocumentation. Existing handle may be `phone`. Window443x976; Search input~160,840; clear390,840; tab355,909. App could be Home after timed recorder stop; normally relaunch with `xcrun devicectl device process launch --device UDID com.randycodex.permitext` after trace fully ends.

Typing several pressKey calls without intermediate state observation REORDERS input; clipboard paste times out. Working pattern: click input, getAXState, then loop letters with `await phone.pressKey(letter); await phone.getAXState({emit:false});`, finally screenshot. UppercaseC uses `shift+c`. This avoids mistyped benchmarks.

## Finish

Save sanitized verified JSON (no raw traces/XML or account data), record exact qualified metrics in PERF04 document and plan, commit evidence. Implementation is already checkpoint-committed with this handoff. No code changes needed unless trace reveals a regression. User has not authorized moving to next task during pause.
