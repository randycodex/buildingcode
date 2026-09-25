# PERF-15 — Web startup investigation

Status: desktop investigation complete; no application refactor justified by these traces. Lower-powered browser and physical-device performance remain unverified.

Source: performance branch after `1a8963ba1`. Isolated Chromium sessions `perf15-startup` and `perf15-cold-reader` on localhost8797. Static shell served from the current worktree; the existing backend process predates PERF-14, so these are frontend traces, not a remeasurement of its new server changes. Owner localhost8796 and browser tabs untouched. No phone/simulator used.

## Initial observations

- Signed-out cold welcome first-contentful paint 80 ms; another fresh session 72 ms. These are welcome-screen paints, not Reader-ready times.
- Main app 1,818,792 bytes; stylesheet 411,532 bytes. The local server transferred uncompressed bodies; this does not establish production compression or CDN behavior.
- First Reader open fetched the 3,934,988-byte definition registry in 45.4 ms locally. It is already fetched after Reader rendering; its size alone does not justify delaying useful definitions.
- Module evaluation approximately 18–20 ms in the observed cold sessions. First-open Reader's longest renderer task was 24.948 ms. Initial traces do not show a major script/style bottleneck on this Mac.
- `PERF_15_INITIAL_BROWSER_TRACES.json` records per-scenario renderer measurements. Category durations overlap; never sum them as exclusive wall time. Raw Chrome traces remain in `/tmp` because they include substantial browser metadata.

## Remaining work

1. Measure a populated restored workspace and optional Notebook/Report first use, separating first paint from usable panes.
2. Inspect actual long-task attribution before splitting modules. Main app size alone is insufficient evidence.
3. If a substantial optional task is demonstrated, optimize it and verify first-use, error/retry and installed-offline behavior. If no material bottleneck is found in representative scenarios, document that outcome without speculative refactoring.
4. Close only after representative coverage and verification; native device acceptance remains separate.

## Populated-workspace extension

The existing isolated synthetic six-pane workspace restored Saved, Notebook, Report, Reader, Search and Reader. The Notebook title and body survived; no browser page errors were reported. A warm reload's maximum renderer task was 20.989 ms; two fresh-browser restores were 43.723 and 45.595 ms. No captured renderer task exceeded 50 ms. The source Notebook bundle loads on demand; cold evaluation was 28.51 ms in the first cold trace.

The largest first-cold layout (42.05 ms) occurred inside Search's scroll-restoration callback (`results.scrollTop = restoreScrollTop`). That duration overlaps its 43.72 ms parent task. Source review of the restoration lifecycle is pending; moving layout to a different frame alone would not establish less total work. These desktop traces do not justify a broad module split.

The synthetic browser-state file remains in `/tmp/permitext-perf15-synthetic-state.json` solely for repeatable profiling; it must not be committed. Browser sessions `perf15-populated-cold` and `perf15-populated-cold2` are isolated copies; the original `perf11-mixed` fixture remains available. Phone is unavailable until tomorrow; no phone work is attempted.

## Decision

Keep current module loading. Source review confirmed zero-scroll restoration is redundant only on a fresh scroller; reused panes need that zero reset after query/scope changes. A general guard would regress navigation, and a fresh-element flag would only move this observed layout to another flush unless comparison proves less work. With no measured long task or optional-module bottleneck in these scenarios, no speculative change was made.

PERF-15 is recorded as a measured no-change decision for desktop, not as a claimed startup speedup. PERF-16 next expands account sizes and editor workflows; reopen this item if those traces or later physical-device testing demonstrate a script/style bottleneck.
