# PERF-12 — Search typing and obsolete request cancellation

Status: locally complete for the web scope. Focused contracts, browser checks and all smoke components pass. No phone or simulator required. Not merged, pushed or deployed.

## Confirmed source baseline

The Search input handler updates the in-memory query and immediately calls `saveWorkspaceState()` before its 250ms search debounce. Each call captures Research and column-group state, serializes the complete active workspace, writes the workspace snapshot, updates and persists the registry, serializes global state and updates connection status. These durable operations occur on every input event. The handler has no explicit composition-start/end handling. This establishes avoidable synchronous work; it is not yet a measured typing-latency claim.

## Implementation constraints

1. Coalesce only transient Search query/filter persistence. Notes, drafts, saved work and pending mutations retain their existing durability.
2. Flush the final query on blur, navigation, workspace/account transition and page lifecycle boundaries without writing one account's state into another.
3. Preserve the final query on reload. Avoid triggering searches for intermediate IME compositions; Enter during composition must not record an incomplete recent search.
4. Audit current Search/chapter fetching before adding cancellation. Keep generation/account checks and avoid aborting requests still needed by another pane.
5. Verify paste, delete/retype, composition, immediate navigation, delayed responses and multiple panes. Record actual write counts and browser behavior, not just source assertions.

## Implemented behavior

- Search query changes update memory immediately and coalesce persistence over 325ms. Existing durable saves remain immediate and consume any pending query save. Blur, Enter, hidden visibility, pagehide and account replacement flush the current query; account/workspace identities prevent stale timers writing into a replacement workspace.
- Composition suppresses intermediate Search requests and incomplete Enter history. The final composition event and final input share the normal 250ms request debounce.
- Search owns an AbortController per result generation. Query edits, replacement requests and pane disposal abort obsolete work. Pagination uses the same controller. Query, edition, prefix, account, workspace, connection and generation guards remain in place even when transport ignores cancellation.
- Chapter catalogs, summaries and body windows share an underlying request with independently cancellable consumers. Only the last pending consumer cancels the transport; unsignaled consumers protect a request they still need. Completed cache entries remain reusable and failed/aborted requests cannot evict their replacements.
- Reader navigation and progressive body hydration release obsolete requests. Pending Reader construction follows its pane lifecycle signal.
- Aborted API requests do not report the server offline or start an offline fallback solely because of cancellation.
- Asset generation is `20260923-search-interaction-v565`, shell 1208; the shared reliability module has its own revised cache identity.

## Browser write baseline

In the populated synthetic workspace, real keyboard typing of eight characters (`concrete`) on v564 produced 40 observed Storage.setItem calls and 55,161 characters written during the capture. Account-workspace global state was written eight times and the active workspace snapshot nine times; extra registry/group/leader activity is included, so this is not a pure keystroke-only timing benchmark. The persisted Search query was `concrete`. The instrumentation stored key names and lengths only, and was restored afterward. Compare the same fixture after coalescing; use deterministic handler tests to isolate exact per-input writes.

## Local acceptance evidence

The same populated synthetic workspace on v565 produced four Storage.setItem calls and 6,156 characters for native keyboard entry of `concrete`: one each for global state, active snapshot, registry and active workspace ID. This establishes less synchronous persistence work, not a measured input-latency improvement. Reload restored `concrete` with no loading shells remaining.

A deliberately held `masonry` Search request received an AbortSignal. Replacing it with `concrete` aborted that signal and displayed 25 current results with more available, without an unavailable error. A pasted query followed by immediate reload restored `masonry`, exercising page lifecycle flushing before the idle save. Browser-dispatched composition events generated no intermediate request and one final `concrete` request; these are handler checks, not a real OS input-method test. Rapid delete/retype events generated one final `masonry` request and matching results. Fetch/Storage instrumentation was restored after each capture.

`npm run test:search-interaction-performance` exercises actual persistence, Search/API, chapter helper and shared request code, including stale scope/account/workspace responses, cancelled pagination, replacement eviction, shared ownership and durable saves. Workspace access/hydration, offline, client reliability, startup restore, account isolation, Reader navigation and Reader scroll continuity contracts also pass.

Structured browser results: `PERF_12_BROWSER_EVIDENCE_2026-09-23.json`. Physical iOS behavior is outside this web change; no phone timing or production latency claim is made.

Smoke verification ran the build/presmoke and suite prefix, then the remaining commands after two outdated PERF-11 source-shape assertions were repaired and rerun individually. The assertions now execute independent workspace orchestration, supplemental Research descriptor behavior and invocation-time Reader destination/access behavior. Final `tests/smoke.mjs` passed. Logs: `/tmp/permitext-perf12-smoke.log` (prefix and original assertion failure), `/tmp/permitext-perf12-smoke-remainder.log` (remaining suite). This was segmented verification, not an uninterrupted successful `npm run smoke` invocation.
