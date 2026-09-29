# PERF-16 — matched visible workload comparison

## Why this remains necessary

PERF-16 acceptance item 7 requires the same visible target with small versus large unrelated account content. Earlier four-pane medians (157.6 ms small, 635.5 ms large) also varied visible Saved rows, Note length/images and Report length. They describe those workloads, but cannot isolate account-size cost.

## Fixture and measurement protocol

Use `tests/populated-workspace-performance-fixture.mjs --visible-workload matched` with `--profile small` and `--profile large` on separate loopback ports. Default stress profiles stay unchanged.

Both Project 1 workspaces must have identical canonical three Saved passages, four Notes, a one-paragraph first Note with one identical tiny image, and the same eight Report blocks. Large account extras belong to other projects. Verify authenticated persisted reads and matching stable content hashes before browser timing. Keep asset revision, viewport, visible pane order, selected Note, library install state and warmup policy identical.

Open Search, Project Saved, Note 1 and Report using the real UI. Measure readiness of all expected contents separately from the two-animation-frame callback floor. Record five warm reloads per profile, request counts and long tasks. Report median/range only; five runs do not support a robust p95. If an account-size cost appears, attribute it before changing production code.

## Status

Matched fixture implementation and cross-profile integrity verification pass. Run `npm run test:matched-workload` in `permitext-sync-server`; parent rerun passed. Persisted visible-content SHA-256 is `7fb43eeba391d33af0cda680cb2d26e04b9d1e1949f6595dc6e8d31741ebe669` for both. Canonical visible section IDs are 8779, 8780 and 8781 in the 2022 construction edition. Account totals remain 12/2/4 versus 1000/12/60 Saved/Projects/Notes. Browser measurements below establish a local account-scale cost; attribution/remediation remain open. This is not a speedup or native/production acceptance.

## September 28 browser result

Actual web v602; IAB1280×720, browser-reported visible. Both fresh origins had no offline library installation; one excluded instrumented warmup each, then five alternating warm reloads. Same pane order (Saved, Notebook, Report, Search), Project1 and Note1; all samples prove3Saved/4Notes/1paragraph/1decodedimage/8Reportheadings. Fixture-only same-origin observer retains normal CSP and does not change app state. Tests cover HTML/header equality, capability/schema bounds and actual observer behavior.

| Local metric | Small account | Large account |
| --- | ---: | ---: |
| All-ready + two rAF median | 259.8ms | 883.4ms |
| Range | 246.8–391.2ms | 567.7–1175.5ms |
| Search ready median | 68.2ms | 56.1ms |
| Saved ready median | 120.0ms | 708.6ms |
| Notebook ready median | 245.7ms | 866.1ms |
| Report ready median | 169.3ms | 567.9ms |
| Long tasks per run | 0,0,0,0,0 | 2,1,2,1,1 |
| Sync pulls per run | 1,1,1,2,1 | 1,1,1,1,1 |

[Raw samples](PERF_16_MATCHED_WORKLOAD_SAMPLES_2026-09-28.json). [Rendered workspace](PERF_16_MATCHED_LARGE_2026-09-28.png).

The large account is materially slower with matching visible content. Search readiness stays independent while private panes take longer. These observations narrow the next investigation to account synchronization/hydration and private-pane work; they do not identify a CPU root cause. One small run made two sync pulls; retain that anomaly rather than claiming exactly one everywhere. Next: attribute the private-work cost, then implement a bounded remedy and repeat this same comparison. Five samples support median/range only. Two-rAF completion is a callback proxy, not displayed-frame evidence; local file-store results do not establish production database/CDN or iPhone behavior.

## Attribution — September 28

Sequential HTTP requests remove concurrent browser work from the measurement. One excluded warmup then five alternating calls per route/account produced these local medians:

| Route | Small | Large | Response bytes small/large |
| --- | ---: | ---: | ---: |
| sync/pull | 7.45ms | 57.88ms | 13,624 / 800,875 |
| notebook/cards/list | 6.23ms | 26.63ms | 1,715 / 1,715 |
| reports/drafts/list | 7.32ms | 27.14ms | 1,511 / 1,511 |
| reports/history/list | 7.17ms | 36.34ms | 68 / 68 |

[Raw HTTP attribution](PERF_16_MATCHED_HTTP_ATTRIBUTION_2026-09-28.json).

Source confirms the temporary file adapter rereads and parses the whole JSON store for each adapter read (`createFileStoreAdapter.readUnlocked`). These POST reads serialize through the file-store request lock. Notebook/Report draft routes perform several such reads; Report history separately resolves manifests and generated files even when empty. Lifecycle registration is already skipped for locked file requests; there is no evidence of two extra full-store lifecycle writes. Production Postgres does not use whole-file parsing, so these costs must not be extrapolated to it.

A separate query-shape issue affects both adapters: `projectReportDrafts`, `projectReportManifests` and `projectGeneratedReports` request account-wide links and artifact payloads, then filter to one Project. Existing adapters support project/target-kind and artifact-ID selectors, as already used by Notebook. A bounded candidate will use those selectors, skip artifact loading for an empty ID set, and retain permission/deletion/type/order checks. Acceptance requires focused parity tests and candidate measurements; no improvement is claimed yet.

Browser summary rebuilding remains a plausible additional cost, not a measured root cause. `currentContentSummary` repeats account-wide filtering/maps, but the per-project menu loop may not execute in this selected-Project scenario. Do not add a persistent summary cache without invocation/time evidence and correct invalidation. Offline snapshot copying is absent here because neither origin has an installed offline library.

## Scoped Report candidate

Implemented project/target-kind link filters and linked-ID artifact reads in the three Report helpers, including empty-set early returns. Existing permission entry points and output/deletion/order filters remain unchanged. Actual adapter-method parity/scoped-SQL tests, expanded real local HTTP Project isolation and401/404 checks, backend-performance contract, Report contract and syntax pass. Live Postgres is untested.

[Candidate direct HTTP samples](PERF_16_SCOPED_REPORT_HTTP_2026-09-28.json): large Report-history median24.68ms versus prior36.34ms; draft-list25.23ms versus27.14ms. These are directional local observations, not a clean paired production speedup: new equivalent seed has no prior browser continuity mutations (~841fewer sync bytes), and runs are sequential in time. The structurally proven improvement is bounded artifact selection and two avoided whole-file artifact reads for empty history. Larger file-store parse/locking and full-sync costs remain. Full matched browser candidate comparison is next; the883ms account-scale issue is not declared resolved.
