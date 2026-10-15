# Performance and reliability audit — October 15, 2026

The audit branch is `codex/performance-audit-20261015`, based on verified, pushed `main` / `origin/main` commit `c4d7639f92de37f2850c1d0e1af68154f808572d`. Earlier source reconciliation and private preservation are documented in [Local work reconciliation](LOCAL_WORK_RECONCILIATION_2026-10-15.md). Private captures, environment files and historical experimental work remain in the local archive; they are not published by this audit.

This report distinguishes local measurements, executable contracts, builds and manual acceptance. No production database or paid model calls were used. Local fixtures use disposable stores; their timing does not establish production, browser-rendering or physical-device performance.

## Implemented changes

| Area | Change | Evidence |
| --- | --- | --- |
| Server chapter metadata | Reuse compact section projections from the first chapter pass; publish only after successful loading and release the intermediate projection after catalog construction. Full chapter bodies are not retained for this optimization. | Chapter JSON reads fall from 236 to 118; all 12,891 catalog records match the baseline. |
| Server HTML parsing | Index wrapper offsets once per immutable chapter source, then binary-search the preceding wrapper. This removes repeated copying/lowercasing of the whole HTML prefix for every heading. | All 19,856 heading boundaries across 159 authored HTML files match the previous algorithm; local cold-request median improves as measured below. |
| Web access notifications | Share one fresh saved-evidence summary during a synchronous notification dispatch. Clear it immediately afterward; asynchronous callbacks and later notifications must recompute. | Deterministic Reader fixture: 501 summary traversals to 1; Search: 85 to 1; pending-row scenario: 80 to 1. These are operation counts, not browser latency measurements. |
| Native Project cache | Move cache file work into an actor off the main thread. Preserve ordering and ensure an already-authorized purge still completes if its caller is canceled. | Executable Swift cache/ordering/cancellation contracts pass. |
| Native Coordination visibility | Repair the release gate that allowed hidden legacy cards to appear. Preserve stored content and drafts. | Native visibility and navigation contracts pass. |
| Dependency security | Apply three targeted dependency updates and strengthen the shipped Notebook dependency verifier. Rebuild web and embedded native Notebook assets. | Fresh npm audit reports zero vulnerabilities; client builds, security verifier, routing matrix and native bridge contracts pass. |

The web summary is scoped to one synchronous dispatch, not a persistent snapshot. It remains subject to the current account/workspace/access checks. Native cache changes preserve account ownership and authorized cleanup semantics.

Before the native cache change, an 8.07 MB Project snapshot took host median times of 55.51 ms to write and 18.48 ms to read across five runs. That serialization and disk work now executes off the UI thread. This removes the main-thread workload; it does not establish faster disk access or a measured device frame-rate improvement. Executable tests additionally cover account isolation, draft retention, deletion tombstones, and identity/cancellation checks after asynchronous boundaries.

## Server measurements and content parity

`permitext-sync-server/scripts/benchmark-public-content-cold.mjs` starts a fresh Node process with an ephemeral localhost server/store and blocks outbound fetches. Each default run sends eight concurrent requests: four startup chapter selectors and four exact Building Code searches. Disk/OS caches were not reset.

| Measurement | Baseline | Candidate |
| --- | --- | --- |
| Three process-cold totals, ms | 822.3, 719.5, 641.9 | 226.5, 185.1, 183.4 |
| Median total, ms | 719.5 | 185.1 |
| Bundled file reads | 282 | 164 |
| Chapter JSON reads | 236 | 118 |
| Unique bundled files | 164 | 164 |

The combined changes reduce this local median by **74.3%**. Metadata reuse alone reduced reads without a stable timing improvement. Profiling then identified repeated heading-prefix scans as the dominant cost: approximately 389 ms in `parsedHeading` during a roughly 740 ms process. The indexed lookup produced the measured timing improvement.

All eight default response SHA256 hashes match before and after. The historical-edition control remains similar: 206.6 ms before and 210.0 ms after, with 180 reads and all eight response hashes unchanged. The complete 12,891-record construction catalog deep-equals the pushed baseline; its serialized SHA256 is `47e718290e029e45d0d789cccc33641b7499f789782ffb2438a3567fb5705850`.

Validation also retains the frozen Chapter 33 heading/body-selection hashes, exact-search ranking and pagination, retry after transient failures, shared concurrent loads, edition boundaries and canonical-body revision guards. The public-cache HTTP contract exercised 87 requests and 16 representations, including conditional 304 responses, immutable-revision conflicts, query isolation and private `no-store`. Reader search passed rich-body projection parity across 22 prefix/edition combinations and six source families.

Public response caching remains bounded to 32 MiB, 256 entries and 2 MiB per entry; the search-text LRU remains bounded to 2,000 entries. Scoped sync/Research read contracts pass. These checks do not measure live PostgreSQL query plans, contention or hosted latency.

## Dependency fixes and generated assets

The initial audit reported four high-severity entries representing three underlying advisories; `@vercel/routing-utils` was a propagated entry. Only these three resolved packages changed, preserving the direct dependency families:

| Package | Update | Exposure and advisory |
| --- | --- | --- |
| `prosemirror-view` | 1.42.2 → 1.42.3 | Shipped in web/native Notebook. Fixes script execution through attacker-provided pasted HTML. [Upstream advisory](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w). |
| `source-map-js` | 1.2.1 → 1.2.2 | Vite/PostCSS development toolchain; no production request-path import found. Fixes event-loop blocking through malformed indexed source maps. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| `path-to-regexp` | 6.1.0 → 6.3.0 | Scoped override under `@vercel/routing-utils` 6.5.0, used by the routing test toolchain; no production app import found. Fixes route-regex backtracking. [Upstream advisory](https://github.com/advisories/GHSA-9wv6-86v2-598j). |

The shipped verifier checks every locked/installed ProseMirror view copy and the editor consumers' actual resolution. Existing prototype/DOM-attribute regressions remain covered. The version gate is not a claim of browser exploit testing.

Web `notebook.js` and native `native-notebook.js` / `native-notebook.css` were rebuilt together. The native CSS also incorporates previously committed shared Body-menu styling because the old embedded bundle lagged behind its source. Shell/Notebook versions were advanced, and deployment-content/offline-shell validation passed.

## Verification status

- **Passed locally:** full smoke, smooth-performance, access/hydration and backend/content performance contracts; generated deployment-content and offline-shell checks; web/native Notebook builds and bridge/security checks; source syntax and diff checks.
- **Native simulator build:** unsigned arm64 and x86_64 build succeeded **with `AppIcon.icon` excluded**, because this machine lacks the required `icontool`. This is not an unmodified release build, signing, installation or device acceptance.
- **Manual candidate browser acceptance:** passed using a synthetic fixture containing 1,000 saved items, 12 Projects and 60 Notes. In Project 1, verified Search for `corridor` (77 results, five in the 2022 Building Code group), Reader section 407.3 and neighbors, three Evidence entries, the four-Note selector with Note 1 paragraph and decoded one-pixel image, and Report with eight headings and `SAVED` status. No errors were observed; one expected synthetic profile-policy/onboarding warning occurred. Metrics are recorded in `/tmp/permitext-perf-large-candidate-metrics.json`. UI latencies are not comparable because manual waits and build activity differed; no browser speedup is claimed.
- **Historical `test:ux-alignment`:** phase 1's obsolete literal/UI assertions were reconciled with current Search modes, Reader/Report controls and Trash copy; its HTTP contract passes. The column-recovery harness now supplies the current-request guard and verifies that stale success/failure cannot publish account data; it also passes, along with all 12 pending Detail-note recovery cases and grouped Search tests. The umbrella suite is **not green**: it next stops at `tests/ux-ui-accessibility-phase2-contract.mjs:54`, which expects a fixed 68px `.inline-comment` width. The current layout intentionally uses `min-width: 0; width: max-content`. That historical assertion and subsequent phases require separate maintenance; this audit does not change the accepted design to match it.

## Remaining scope and follow-ups

The native Research cache was measured but not changed: a 5,000-row, 2.77 MB fixture had host medians of 31.13 ms for a read and 60.81 ms for read/merge/write. A safe change requires ordered asynchronous mutations that preserve freshness, account transitions and durability; moving individual calls off-thread without that ordering is insufficient.

Production/PostgreSQL profiling, authenticated hosted load, physical iPhone/iPad responsiveness, signing/App Store acceptance and end-to-end release validation remain outside this evidence. Bundle splitting is a candidate for further investigation, not an asserted improvement; measure loading/rendering and dependency boundaries before changing chunks. No remaining observation is presented as a measured production regression.

Raw benchmarks, browser fixture metrics, test/build logs, npm audit reports, the CPU profile and the final Settings screenshot were copied to the owner-only local archive at `/Users/randy/Documents/Permitext Archives/2026-10-15-main-reconciliation/performance-audit/`. Its `evidence-manifest.json` records file sizes and SHA256 hashes. Disposable fixture tabs and servers were closed after verification; the user's retained preview at `http://127.0.0.1:8788/workspace` remains running.
