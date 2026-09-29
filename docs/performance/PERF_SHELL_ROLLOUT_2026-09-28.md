# Browser shell update reliability — September 28

## Finding and correction

The real v602→v604 local browser reproduction exposed a broken-update path: after the newer app file returned503, the old v1245 worker had already replaced its cached workspace HTML with v604 HTML. Its referenced app.js was absent, and the workspace rendered only an inert shell. Restoring the file and updating recovered the selected note and report. Owner accounts were never used.

The candidate v605/shell1248 now checks the workspace HTML entrypoint against its manifest. A still-active older worker serves its coherent cached page while a different release is not yet installed. Installation and manual preparation fetch/validate the whole manifest, complete asset writes, then publish workspace HTML last. Failures preserve the previous page. Both manifests now match exactly, including definition assets and the current public revision module. Retry awaits a worker update check before declaring readiness.

The first candidate exposed browser backpressure: retaining unread large response bodies before the all-request barrier stalled installation. The corrected implementation drains each response clone as it arrives, preserving original response metadata and making only one fetch per URL. A streaming-response regression reproduces the stall if that line is removed. This failed intermediate attempt is not counted as acceptance.

## Browser acceptance

1. Installed the final candidate in a fresh local origin, with55 manifest entries and all direct workspace references present.
2. Opened Synthetic Project1 with three saves, four notes, selected Note1 plus image, and eight Report headings.
3. Served a fixture future generation with its app.js returning503. Reload kept the working workspace and exact selection. Explicit preparation rejected the incomplete update; v1248 retained v605 HTML/assets and v1249 remained empty.
4. Simulated GET transport loss and reloaded. The coherent app shell and offline status rendered. Private panes were access-gated; this is not acceptance of offline Report, full offline account behavior or a downloaded code library.
5. Restored transport/files and retried. The future worker activated, v1249 contained all55 manifest entries/direct references, and v1248 was removed. Reload restored Note1, its paragraph/image and all eight Report headings; three saves/four notes remained.

Future v606 is only a fixture: candidate files with version identifiers changed to exercise the next-generation transition. Legacy deployed workers cannot be protected retroactively by this source change. Protection applies once the corrected worker is installed. The guard establishes entrypoint/manifest coherence, not content hashes for every unversioned module or all multi-tab lazy-import scenarios.

## Verification and artifacts

`npm run test:shell-rollout`, `node tests/offline-contract.mjs`, `node tests/web-shell-cache-contract.mjs`, and full `npm run smoke` pass. Actual-function tests cover mismatched HTML, failed downloads, cache-write failure, streamed bodies, retry discovery, navigation aliases and marketing separation. Fixture HTTP tests cover opt-in capabilities, immutable old entrypoints, failure and recovery; the existing matched seed self-test passes.

- Numeric/visible diagnostic evidence and candidate SHA256s: `PERF_SHELL_ROLLOUT_2026-09-28.json`.
- Recovered workspace screenshot: `PERF_SHELL_ROLLOUT_RECOVERY_2026-09-28.png`.
- Host logs: `/tmp/permitext-shell-rollout-smoke.log`, `/tmp/permitext-offline-coherence-final.log`.
- Repeatable fixture: `tests/populated-workspace-performance-fixture.mjs --rollout-baseline-dir <exported-assets> --rollout-current-dir <exported-assets>`; each directory supplies index.html,app.js,offline-storage.js,service-worker.js. UI provides failure/update controls and visible cache diagnostics.

This closes the bounded local interrupted-shell-update/recovery scenario. Hosted deployment, Safari/iOS browser behavior, full private/offline coverage, multi-tab lazy assets and distribution remain separate gates. Native installed41.30 and local41.32 are unchanged.
