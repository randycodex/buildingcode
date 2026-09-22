# PERF-02 — readiness-driven iOS launch

Date: 2026-09-22
Base: merged UX and performance commit `107d09529`.
Scope: PERF-02 only. No chapter preparation, search, sync, cache, or background warmup optimization.

## Change

The root navigation now depends only on `library.isInitialContentLoaded`. Remove the separate splash state, one-second sleep, opaque branding overlay, and 0.35-second dismissal animation. While content is preparing, display the existing branded `AppLaunchLoadingView` with progress and the library status message. This preserves the loading presentation already used by the app; no new screen is introduced.

The existing PERF-01 `launchSplashDismissed` diagnostic name remains for comparison. It now means the loading cover is released by readiness, with no separate splash present. `firstUsableContent` still requires data readiness, root appearance, and that cover-release signal; it is not OS first-frame timing.

Readiness continues to come from the existing content loader. Successful loads publish the usable snapshot before setting readiness. Initial load failures and missing bundled content retain their existing terminal status and ready/error handling. A canceled load does not become ready merely because a timer elapsed. Foreground/background handling, account restoration, onboarding, and background warmup are unchanged.

## Validation

- Swift milestone harness: all six signal orders, repeated callbacks, and one-shot reporting pass.
- Startup critical-path, Search Reader reuse, Reader scroll continuity, Reader recovery, and Search progress contracts pass.
- Native signed Release build 1.0 (41.2): passed with coverage disabled. Installed in place on the wired iPhone 17 Pro, preserving the existing signed-in account and data.
- First-install, signed-out, offline, background return, and interrupted-initialization device matrix: not yet fully exercised. Source-path review is not physical-device acceptance. Preserve the owner's installed data and signed-in session during verification.

## Comparison rules

Use the same coverage-disabled Release configuration, device, and lifecycle event boundaries as PERF-01. Build 41.2 also includes UX commit `891759c5e`, unlike the original installed baseline 41.1; search-label comparisons therefore are not a strictly single-change experiment. The original five-run launch baseline had a 2055.16 ms median application-presentation interval and 2009.58 ms median data-ready interval. Those data-ready times already exceeded the nominal splash delay, so removing the timer does not justify claiming a one-second improvement on this device.

A success claim requires inspecting the installed app, then checking Reader and Search behavior. Do not equate compilation, installation, or a data-ready callback with rendered acceptance. Broader PERF-01 browser and device-measurement gaps remain separately tracked.

## Physical-device verification so far

The installed 41.2 app launched, navigation responded, and Building Code 2022 Chapter 10 rendered correctly. One wired signpost capture measured 78.64 ms from chapter tap to prepared destination and 1514.75 ms to restored-content lifecycle completion. PERF-01's single corresponding sample was 75.75 ms / 1623.74 ms. This is not a statistically established improvement or a comprehensive no-regression result.

The recording began after a device-discovery interruption and contains no complete startup milestone interval. Do not use its trace origin or background warmup time as launch latency. A valid repeated launch comparison is still required.

Search input did not accept Mirroring input attempts in this pass, including after a normal relaunch outside Instruments. Similar Mirroring trouble occurred before this change. It is not yet classified as an app regression or a Mirroring issue. The owner was asked to try the exact query directly on the phone; acceptance remains pending that result and a rendered result-opening check.

[Sanitized device interaction capture](PERF_02_DEVICE_INTERACTION_2026-09-22.json). No OS settings, account sign-out, data clearing, deployment, or TestFlight upload was performed. The first-install / signed-out / offline / background-return / interrupted-initialization physical-device matrix remains open.

Status: implementation and Release compilation complete; full device acceptance and launch-performance comparison pending. Do not mark PERF-02 fully accepted or begin PERF-03 on the strength of this record.
