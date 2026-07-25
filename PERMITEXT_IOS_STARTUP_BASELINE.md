# Permitext iOS Startup Baseline

**Recorded:** July 25, 2026

**Runtime:** iOS 26.5 Simulator

**Build:** Debug, generic iOS Simulator destination

**Measurement:** `CodeLibraryViewModel` initialization to the first
`isInitialContentLoaded = true` transition, emitted as the
`firstUsableContent` startup signpost.

## Results

| Simulator | Cold process launch | Immediate relaunch |
| --- | ---: | ---: |
| iPhone 17 Pro | 1,446 ms | 1,218 ms |
| iPhone 17 | 1,291 ms | 1,146 ms |

Both devices used the same freshly built application binary. A cold process
launch means Permitext was terminated before launch; it does not mean the whole
simulator or its persistent app data was erased. The relaunch measurement was
taken immediately after terminating the first run.

## Regression contract

- The chapter grid becomes usable after the selected content snapshot loads.
- Search-index, multi-chapter, section-detail, and authored-content prewarming
  continue in a cancellable background task.
- `firstUsableContent` must be recorded before `backgroundWarmup` completes.
- A startup result at or above 5,000 ms on comparable simulator hardware should
  be investigated before release.
- A reported delay near 30 seconds is not reproduced by these two simulator
  runs. A physical-device trace should capture the same signpost before
  attributing such a delay to content loading, account synchronization, or
  installation.

## Instrumentation

The `Startup` signpost category records:

- `firstUsableContent`: time from view-model startup to usable code content.
- `backgroundWarmup`: the later authored-content or SQLite prewarm duration.

This separates user-visible startup from simulator boot, application
installation, operating-system launch overhead, and background preparation.

## Verification limitation

A temporary clean iPad simulator was also attempted. Its first application
launch blocked in simulator infrastructure before the Permitext process
started, so no iPad number was recorded or represented as an application
measurement. The temporary simulator was removed. Physical iPhone and iPad
baselines remain a release-candidate verification item; they do not require an
Apple account unless account-specific startup behavior is being measured.
