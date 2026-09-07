# Reader scroll continuity repair

Original audit batch B3, principally P2-4. Status: **local repair and actual
browser acceptance passed; publication pending**. This does not change the
public Beta gate, installed build 62 or the remaining assistive-technology scope.

## Reproduced Production failure

On Production `aed30262742d1888f94555997c4140cbdcaa7b71`, Chrome had two Readers
open on 2022 Building Code chapters 10 and 1. Ordinary independent scrolling,
opening Search and changing the Saved Project preserved the locations. Reopening
the currently selected Project through its same-document link rebuilt both
Reader panes and lost their positions:

- Chapter 10 moved from scrollTop 529 to 0. Its displayed-content key still
  identified chapter 1 after the earlier in-place chapter change.
- Chapter 1 moved from scrollTop 1356 to 321.5, clamped into its short initial
  progressive body window.

This used the existing Free/Synced test session. No access grant, new Research,
purchase, authored Project content or phone input was needed. Normal Reader
navigation can update reading-continuity history.

## Repair

Each Reader captures its visible section, optional text block and viewport
offset. A workspace rebuild loads the small initial body window around that
passage and restores it after pane layout. The key includes code edition and is
updated by in-place navigation; loading and internal-search content cannot
become a recovery anchor. Restoration does not change the requested citation.

The full-browser test also exposed Chrome's off-screen intrinsic-height
placeholders. Restoration now measures the actual text in its small loaded
window. Prepended batches are measured before scroll-height compensation.
Other progressively appended content retains its existing rendering policy.
If the initial window cannot accommodate the offset, nearby hydration retries
the anchor. User input, another navigation/render or a detached pane takes
precedence over deferred restoration.

The shell assets advance together to
`20260906-reader-scroll-continuity-v54` / `permitext-pro-shell-v793`.
Temporary diagnostics are removed.

## Verification

The new actual-function regression
[`reader-scroll-continuity-contract.mjs`](../permitext-sync-server/tests/reader-scroll-continuity-contract.mjs)
is in `test:readiness-recovery`. Its synthetic geometry includes 600px intrinsic
placeholders changing to 200px rendered sections. It verifies independent
progressive windows/offsets, short-window recovery, unchanged citations,
edition/missing-anchor/loading guards, user interruption before a frame and
during hydration, render invalidation and disconnected panes. It also checks
the real workspace-to-Reader rendering path. The original implementation failed
the independent-window case. Existing Reader navigation, search recovery and
keyboard menu regressions passed during development.

At `2026-09-07T03:48:19.889Z`, Chrome 152 ran the **actual complete local app**
using its isolated browser fallback account and temporary file store. The
loopback-only workspace debug flag allowed the real Project hash handler to
rebuild both Readers without creating a Project or calling a provider. This
was not a synthetic replacement for the Reader renderer.

| Reader | Captured passage | Offset before | Offset after nearby loading | Difference |
| --- | --- | ---: | ---: | ---: |
| BC 2022, chapter 10 | 1001.4, block `rid-0-0-0-172822` | -151.390625 px | -151.4453125 px | -0.0546875 px |
| BC 2022, chapter 1 | 102.4, block `rid-0-0-0-164273` | -107.4375 px | -106.8984375 px | +0.5390625 px |

Both section/block identities remained unchanged. New heading element IDs
confirmed actual pane reconstruction. The second Reader loaded 28 nearby
sections; a later settled check retained both offsets. The clean v54 script URL
was inspected, the rendered result was reviewed, and no v54 app log entries
were reported by the browser. Unrelated extension warnings were excluded.

Production keyboard checks also confirmed chapter-tree Enter/ArrowDown/Escape,
focus return, visible focus outline and hidden native-select exclusion. These
are keyboard/accessibility-tree observations, **not VoiceOver acceptance**.

Private evidence lives under `/private/tmp/permitext-b1-live-20260906/`:
`b3-reader-scroll-production.json`/`.png`,
`b3-reader-scroll-local-final.json`/`.png`, and the final check/smoke logs.
The local app server and its exact synthetic file store were removed. The
dedicated-origin cleanup page confirmed removal of local test databases,
caches and sessions; its tab and cleanup server then closed. The Production
test session remains signed in and Free.

Final `npm run check` (including its readiness-recovery precheck and UX/security
postcheck), `npm run smoke` and `git diff --check` passed. No source changes
followed the final v54 browser run; subsequent edits only recorded evidence.

## Remaining boundary

The repaired behavior still needs approved publication and a hosted check.
Focused VoiceOver, remaining supported-layout scope, B4 performance/eviction
evidence and B5 release decisions remain open. Passed offline citations and
physical table panning do not need repeating. No machine gate is changed.
