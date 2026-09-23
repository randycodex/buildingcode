# PERF-05 — Lazy native search results

Status: implementation and targeted phone-free validation complete; physical acceptance remains open. No physical device or simulator used. No installed-build or measured scrolling-speed claim.

## Problem

The outer Search LazyVStack contained an ordinary VStack per family. Expanding an edition therefore built all result rows in that family and could start all their preview tasks. The result count can be much larger than the visible screen.

## Implementation

- Put family headings, edition headings, result rows and family footers directly in the lazy stack. Keep family cards visually continuous using matching background pieces and rounded top/bottom corners.
- Preserve complete result arrays, counts, ordering, edition-aware search identities, accessibility labels, and explicit family/result scroll targets. Laziness changes presentation work, not search coverage.
- Limit preview extraction to two active workers. A cancelled consumer retains its permit until the underlying extraction actually finishes, preventing cancellation from accidentally exceeding the limit.
- Cancel queued preview requests and discard outdated output after query, scope, expansion, tab or detail-destination changes. Existing snippets skip preview extraction.

## Validation

Passed `native-search-preview-concurrency-contract.py`, compiling the production limiter with deterministic queued and in-flight cancellation, 100 contenders, 100 cancellation/permit-transfer races and capacity reuse. Existing search-reader reuse, completed-search-cache, search-progress-label and Saved-deferral/session-transition checks pass. Generic unsigned iOS Release build passed (`/tmp/permitext-perf05-build.log`, `BUILD SUCCEEDED`). Generic compilation does not execute an app, simulator or device.

## Physical acceptance still required

1. Expand the large concrete result group; verify first-screen content and counts, and confirm offscreen rows do not all start preview work.
2. Scroll quickly through the full group; verify every result remains reachable and previews match the correct edition/query.
3. Collapse, switch editions and change query while previews are queued; confirm no old previews appear and visible work resumes.
4. Open a result and return; verify return position and expanded edition are preserved.
5. Verify continuous card edges, Dynamic Type and VoiceOver focus across headings/results.
6. Record expansion and scrolling measurements before claiming a device speedup.

PERF-06 detail timing remains separately pending because the recovered build 41.9 recording contained no detail-opening events. This task does not close that acceptance gap.

## September 23 physical spot check — development 41.10

Signed local Release build 41.10 installed over 41.9 (not TestFlight). Mirroring verified concrete search, expansion of the 450-result 2022 Building Code group, later rows/previews appearing during scrolling, opening BC403.2.3.3 and BC721.1.3, and return to the same scrolled position. Family card appearance was consistent in inspected views. This is a spot check, not proof all 450 rows were traversed, VoiceOver acceptance or measured frame/latency performance. Instruments lists the phone offline; timing remains pending.
