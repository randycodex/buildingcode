# Beta 1 web startup measurement — September 7, 2026

## Result

The original audit P2-7/B4 representative desktop startup measurement is
completed on Production `5f1afb414fdd51e74c59a28c7e279d3ef10b74d9`.
This is a measured baseline, not a phone result or a guarantee for every device.

Five warm and five cold-network-cache reloads were captured with Chrome's own
Performance profiler on a MacBook Air `MacBookAir10,1`, 16 GiB RAM, macOS
26.6.2 (25G83), Chrome 152.0.7977.77. CPU and network throttling were off.
The existing signed-in synthetic workspace retained Saved, Questions, two
Building Code Readers and Search. DevTools was docked on the right. Account,
IndexedDB, localStorage and quarantined legacy workspace data were preserved.

| Condition | n | LCP p50 | LCP p90 | Individual LCP samples (ms) |
| --- | ---: | ---: | ---: | --- |
| Warm network cache | 5 | 2,084 ms | 4,149 ms | 1612, 4149, 3876, 2084, 1663 |
| Network cache disabled | 5 | 1,990 ms | 2,405 ms | 1937, 2068, 1775, 2405, 1990 |

Percentiles use nearest rank; with five samples p90 is the maximum. This small,
single-device sample does not establish that cold loading is generally faster.
LCP is Chrome's reported largest-contentful-paint measurement, not an input
latency measurement or a synonym for all background work being complete.

First-contentful-paint occurred approximately 0.91–1.00 seconds after navigation.
All ten selected filmstrip frames were visually inspected: the Saved Project
rows and both Readers' initial code text are visible at 1.61–4.15 seconds for
warm samples and 1.78–2.40 seconds for cold-cache samples. Those are observed
frame timestamps, with capture precision limits; additional Reader hydration
can continue afterward. The initial toolbar/loader alone is not counted as
the usable workspace.

The optional `/code/chapters?view=startup` and `/code/libraries` responses
finished separately at approximately 1.00–1.78 seconds warm and 1.09–1.47
seconds cold-cache. Their response timing is retained separately from paint.
Existing controlled delayed-catalog tests establish the non-blocking ordering;
these real-network runs do not deliberately delay catalogs.

Warm traces contain 26–27 cached resource responses. Cold traces contain zero
cached and zero service-worker resource responses, confirming that the selected
network-cache setting took effect. Cold here means the network cache is disabled,
not an erased account, empty offline database, rebooted device or first install.
Compiled-module trace evidence identifies the executing v55 application.

## Evidence and cleanup

Private directory: `/private/tmp/permitext-startup-b4-20260907/`.
Ten `v55-warm-*.json.gz` / `v55-cold-*.json.gz` traces, extracted filmstrip frames,
`summarize-v55.py` and `v55-startup-summary.json` retain reproducible measurements.
Resource content and source maps were excluded from exported traces. Raw traces
and account-specific screenshots are not committed.

An initial recording was interrupted by Chrome's automation-debugger attachment
and remained on `about:blank`; it was discarded. The debugger was detached before
the ten valid recordings. The earlier stale-v50 trace remains excluded as well.
Normal caching was restored and the profiler closed afterward. No Research,
grant, account switch or authored-content change was part of measurement.

This closes the named desktop measurement task. B4 storage-pressure/OS eviction
and interrupted-transfer coverage remain separate. The final selected release
must retain this source or assess relevant startup changes before reusing it.
