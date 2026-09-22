# PERF-01 — measurement and startup test gate

Date: 2026-09-22

Status: In progress. No PERF-02 or later optimization is included.

## Isolation and provenance

- Worktree: `codex/permitext-performance`, based on `02e05367acf8310f8be2fdaf848e1e545f9f8574`.
- The other agent owns UX/UI work on main. This branch does not change visual design, product wording, layout policy, search semantics, splash duration, cache policy, or synchronization behavior.
- Native measurement hooks touch shared view files. Integrate by reviewing individual hunks after the UX changes, not by replacing whole files.
- Production API health during sampling reported commit `4da2e1fa1d4774c8afe95b205e23acbfa1f3aeb9`.
- Local native profiling build is explicitly numbered **1.0 (41.1)**. This is not TestFlight 92 and is not a release submission.

## Implemented measurement changes

1. Repair the startup contract fixture for current post-render profile and pending-intent hooks. Verify both call order and recovery when profile setup fails.
2. Separate `initialDataReady` from `firstUsableContent`. The latter now waits for initial data, root navigation appearance, and completion of splash removal. Preserve the existing one-second hold and 0.35-second transition for the baseline.
3. Report startup presentation once even when lifecycle signals repeat or arrive in a different order. Independent reader models do not emit primary-app startup intervals.
4. Add non-content signposts for chapter opening, search input scheduling, all-edition search, first available results, result destination preparation, passage readiness/appearance, and native chapter restoration.
5. Add a trace-export summarizer that resolves Instruments XML references, pairs intervals by process/category/name/ID, and excludes message payloads from its output. Verify process-isolated pairing and a real exported capture.
6. Add a repeatable read-only public-API sampler. Its default local server uses a temporary isolated sync-store path and makes no account, sync, or Research requests.

## Meaning of native signals

| Signal | Boundary | What it does not prove |
| --- | --- | --- |
| `initialDataReady` | Library model initialization through initial data readiness | Visible or interactive screen; process launch time |
| `rootNavigationAppeared` | SwiftUI root appearance callback | GPU presentation or completion of every child view |
| `launchSplashDismissed` | Splash removal animation completion | Network/account background work has finished |
| `firstUsableContent` | All three application readiness signals received | OS first frame; compare with Instruments App Launch |
| `chapterOpenRequested` / `chapterDestinationPrepared` | Tap handler and prepared navigation state | Selected content has actually appeared |
| `nativeChapterReady` | Native document/display blocks prepared | Restored viewport visible |
| `nativeChapterContentAppeared` / `nativeChapterRestorationCompleted` | Visible-content lifecycle or removal of restoration gate | GPU/frame pacing; use the trace and rendered verification |
| `searchInputScheduled` | Query entered the debounce path | Search execution has begun; session restore can also schedule |
| `allEditionSearch` | Full edition-search operation; cancellation is labeled | Search rows have been drawn; failed editions need separate correctness checks |
| `firstSearchResultsReady` | First nonempty results published to the model | First row is visible |
| `searchResultOpenRequested` / `searchResultDestinationPrepared` | Opening request and prepared result destination | Passage rendering has completed |
| `passageDataReady` / `passageContentAppeared` | Loaded passage model and SwiftUI appearance | All asynchronous media/reference work has finished |

No query strings, private notes, account identifiers, or passage bodies are included in the new signpost payloads. Lifecycle events are diagnostic boundaries, not substitutes for an OS/browser rendering trace.

## Native startup pilot (one valid sample)

A lightweight `Blank` + `os_signpost` launch trace exported successfully. It records the installed Release build, not TestFlight. From the model initialization signposts, initial data readiness took **2007.895 ms** and all application presentation milestones took **2049.401 ms**. Background warmup lasted about **4888 ms** after it began. These boundaries are not process-launch-to-first-frame latency. This is one pilot sample, captured while the host was processing the full launch trace and near the wireless-to-USB transition; do not derive percentiles, budgets, or improvement claims from it.

Sanitized application event timestamps: [PERF_01_NATIVE_PILOT_2026-09-22.json](PERF_01_NATIVE_PILOT_2026-09-22.json). The raw trace remains local at `/tmp/permitext-perf01-signposts-launch.trace`; raw traces may include unrelated system metadata and are not committed.

The heavyweight App Launch recorder remained in filesystem modeling/system-symbol processing for over 13 minutes. It was terminated after a graceful stop request failed to finish; its unfinished artifact is not accepted measurement evidence. A new wired lightweight launch waited before recording began and was stopped pending a device unlock. This is a tooling blocker, not a measured app delay.

## Wired native startup baseline (five relaunches)

All five serial captures ended normally at the time limit and exported application signposts. Existing caches and the signed-in account were retained; this is a process-relaunch scenario, not first install or an OS-cold baseline. No phone interactions occurred during sampling. Thermal state and full account fixture size were not measured.

| Boundary | n | Median | Nearest-rank p95 | Range |
| --- | ---: | ---: | ---: | ---: |
| Model initialization → initial data ready | 5 | 2009.58 ms | 2026.33 ms | 1991.87–2026.33 ms |
| Model initialization → application presentation milestones | 5 | 2055.16 ms | 2066.69 ms | 2025.67–2066.69 ms |
| Background warmup interval | 5 | 4765.64 ms | 4808.80 ms | 4662.88–4808.80 ms |

With five samples, nearest-rank p95 equals the maximum and is not a robust tail estimate. The smaller protocol was used after repeated device-connection failures and substantial recorder processing overhead; retain this as an initial comparison set, then expand to 30 controlled runs before enforcing percentile budgets. No numerical responsiveness target is approved from this limited set alone.

[Sanitized timestamps and intervals for all five runs](PERF_01_NATIVE_WIRED_BASELINE_2026-09-22.json). Apple first-frame events were present in the exports, but their matching start boundary was not captured by the app-only signpost recording; do not subtract trace start and call that process launch time.

## Wired native interaction capture (one sample per journey)

The 120-second app-attached signpost trace completed normally. Mirroring confirmed the rendered Chapter 10 content, exact query `1005.3.1`, three results, and the opened matching passage.

| Journey boundary | Duration |
| --- | ---: |
| Chapter 10 tap → destination prepared | 75.75 ms |
| Chapter 10 tap → restored-content lifecycle event | 1623.74 ms |
| Last scheduled query input → first nonempty results published | 2406.30 ms |
| Last scheduled query input → complete all-edition search | 3106.32 ms |
| Result tap → destination prepared | 103.26 ms |
| Result tap → passage content appearance callback | 268.43 ms |

These are single-sample application boundaries, not robust percentiles or GPU presentation times. They show why preparation timings cannot substitute for tap-to-content measurements. The trace contains **80 `projectHydration` begin events after passage appearance** through the end of the capture (about 13.4 seconds). This is a concrete lead for PERF-06 / related synchronization investigation, not proof of the root cause or authorization to fix it inside PERF-01. A second opening happened after recording ended and is excluded.

[Sanitized interaction events and calculations](PERF_01_NATIVE_INTERACTIONS_2026-09-22.json). Raw trace: `/tmp/permitext-perf01-wired-interactions.trace`.

## Public API baseline

Sampler run: 2026-09-22 14:28 UTC, Node v24.18.0 on macOS, production HTTPS, sequential requests. Each endpoint has one first-observed request plus 30 repeat samples. No failed requests in this run. Native compilation was running on the host, so these samples are an initial network/API reference rather than a controlled client-CPU benchmark.

| Endpoint scenario | First observed | Repeat p50 | Repeat p95 | First decoded bytes |
| --- | ---: | ---: | ---: | ---: |
| Broad search (`egress`, limit 25) | 4493.76 ms | 78.35 ms | 162.13 ms | 13,846 |
| Section search (`1005.3.1`, limit 25) | 312.84 ms | 42.64 ms | 60.58 ms | 1,826 |
| Chapter 33 manifest | 54.35 ms | 48.18 ms | 60.17 ms | 355,425 |
| Chapter 33 five-body window | 545.16 ms | 49.70 ms | 235.12 ms | 359,819 |

Raw public samples: [PERF_01_PUBLIC_API_BASELINE_2026-09-22.jsonl](PERF_01_PUBLIC_API_BASELINE_2026-09-22.jsonl).

These are response-completion timings, not browser first paint or user interaction timings. First observed is not proven process-cold or OS-cache-cold. Percentiles use nearest rank over successful repeats; failures must always be reported alongside percentiles. A one-sample local run validated the harness and is not a percentile baseline. The original sampler did not inspect the nested chapter `bodyRange` field; its null value in that raw record does not mean the endpoint lacked a body range.

## Checks completed

- Startup critical-path contract: pass, including profile-failure recovery and current pending-intent order.
- Actual Swift milestone gate: all six signal orderings, duplicate signals, and one-shot completion pass through a standalone host-compiled harness.
- Matching XCTest added to the native contract suite; test-runner execution is tracked separately from the host harness.
- Search Reader reuse, Reader scroll continuity, and Reader search recovery contracts: pass.
- Release compilation: passed with all three coverage settings disabled; actual compiler invocation contains no Swift coverage generation/mapping flags. Signed development-entitled Release build 1.0 (41.1) installed in place and launched on the physical iPhone 17 Pro (iPhone18,1), iOS 27.0 (24A437), using Xcode 27.0 (27A266a). Installation is not TestFlight or App Store publication.
- Wireless profiling: CoreDevice connected over localNetwork while Instruments initially reported offline. After opening Instruments and refreshing device discovery with the phone unlocked, Instruments listed the phone online. App Launch recording reached its ten-second capture limit; export/analysis remains pending. No USB was used.
- Local public-sampler invocation: all four routes returned successfully.

The startup contract's synthetic before/after comparison demonstrates the already-existing nonblocking catalog design. Fixing the test fixture is not a new application speed improvement.

## Physical-device session observations

- Mirroring verified Reader navigation, rendered Building Code 2022 Chapter 10, exact search `1005.3.1` (three results across installed editions), and the opened 1005.3.1 passage. These are correctness observations, not stopwatch measurements.
- Mirroring bulk text entry reordered characters and paste timed out. Individual key events produced the verified query. Exclude the malformed-query attempt from performance evidence.
- A wireless all-process signpost pilot stopped after 1.341856 seconds with `Device disconnected`; its table of contents listed only the kernel. It is invalid as an app baseline despite the recorder exiting successfully.
- At approximately 10:56 local time the owner connected USB. CoreDevice then reported `Transport Type: wired`, and Instruments listed the phone online. Wired repeat measurements must be distinguished from earlier wireless attempts.
- The initial full App Launch trace incurred prolonged host postprocessing. A sample of the recorder showed filesystem modeling and system-library symbolication. This host processing time is not app launch latency. Do not report the trace as valid until it finalizes and exports successfully.

## Reproduction

From `permitext-sync-server`:

```sh
node tests/startup-critical-path-contract.mjs
node tests/startup-presentation-milestones-contract.mjs
node scripts/profile-public-reading.mjs --samples 30
node scripts/profile-public-reading.mjs --origin https://permitext.com --samples 30
```

For a native signpost capture and sanitized summary:

```sh
xcrun xctrace record --template Blank --instrument os_signpost \
  --device DEVICE_UDID --time-limit 8s --output RUN.trace \
  --launch -- com.randycodex.permitext
xcrun xctrace export --input RUN.trace --toc --output RUN-toc.xml
xcrun xctrace export --input RUN.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="os-signpost"]' \
  --output RUN-events.xml
python3 Tools/permitext_signpost_summary.py RUN-events.xml > RUN-summary.json
```

Confirm the target process and normal capture completion in the table of contents; successful command exit alone does not prove a usable recording. The summarizer is run from the repository root. Keep raw traces local and review diagnostic data before sharing.

The Swift gate harness requires Xcode command-line tools. Public sampling defaults to local execution; choose a remote origin explicitly. Keep raw output and record the deployed revision independently of the local source revision.

For native profiling, use the Release configuration and explicitly disable `ENABLE_CODE_COVERAGE`, `CLANG_COVERAGE_MAPPING`, and `CLANG_ENABLE_CODE_COVERAGE`; setting only the last of these did not remove Swift coverage flags in the installed Xcode environment. Verify the actual compiler invocation and app bundle version before installation. Use Instruments App Launch/Time Profiler with the signed development-entitled Release binary. Preserve account data by installing in place; do not uninstall the owner's app or clear its data to manufacture a cold sample.

## Remaining PERF-01 acceptance

1. Expand the five valid wired relaunch samples to the controlled 30-run protocol; capture OS process-launch/first-frame timing with a profiler configuration that completes reliably. App lifecycle intervals are now exported and recorded, but the full App Launch trace failed to finalize.
2. Device/OS/build, existing signed-in state, and sample counts are recorded. Add controlled account fixture size, precise corpus identity, and thermal observations.
3. Separate first-use/relaunch/repeat behavior; do not call process relaunch an OS cache purge.
4. Expand the single verified chapter/search/result-opening capture with repeat and broad-search samples, GPU/frame pacing, and controlled cache scenarios.
5. Capture browser rendering/interaction traces separately from the public-API sampler. The connected in-app browser exposes DOM/log inspection but no performance-recording capability; its previous workspace tab was no longer available at the end of this session. No browser trace is claimed.
6. Set numerical budgets from controlled measurements for subsequent tasks; do not derive a device responsiveness budget from HTTP timings.
7. Keep oldest-supported-device, offline, first-install, and large-account coverage explicit when unavailable.

PERF-01 must not be reported fully complete while required measurement evidence remains missing. No implementation from a later performance task should be folded into this measurement baseline.
