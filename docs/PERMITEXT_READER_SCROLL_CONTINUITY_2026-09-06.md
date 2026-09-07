# Reader scroll continuity repair

Original audit batch B3, principally P2-4. Status: **published through PR #62;
local and hosted browser acceptance passed**. This does not change the
public Beta gate, installed build 62 or the remaining assistive-technology scope.

## Reproduced Production failure

While Production health reported `aed30262742d1888f94555997c4140cbdcaa7b71`, Chrome had two Readers
open on 2022 Building Code chapters 10 and 1. Ordinary independent scrolling,
opening Search and changing the Saved Project preserved the locations. Reopening
the currently selected Project through its same-document link rebuilt both
Reader panes and lost their positions:

The later [HTML cache diagnostic](./PERMITEXT_WEB_SHELL_CACHE_REPAIR_2026-09-07.md)
proved the retained browser could still execute v50 after an ordinary reload.
The scroll reproduction is a hosted-client observation, not proof that this
browser executed the v52 script associated with that health commit.

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

The subsequent HTML cache repair advances the combined PR #62 candidate to
`20260907-shell-revalidation-v55` / `permitext-pro-shell-v794`; the Reader
implementation is unchanged from the v54 full-app browser result below.

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

## Hosted acceptance, September 7

After explicit owner approval, PR #62 merged as
`5f1afb414fdd51e74c59a28c7e279d3ef10b74d9`. Vercel Production deployment
`dpl_CJenPVvz6HfNHV5N7RkNkVq9gU15` reached READY; `/health` reports that exact
commit. Published app, stylesheet and worker bytes match the approved source.

The retained Chrome test session initially still referenced v50. Navigating to
the same `/web` path with `?release=5f1afb414fdd` loaded v55 without clearing site
data or signing out; an ordinary reload retained v55 and the existing workspace.
In the 2294 × 1267 viewport, the two existing BC 2022 Readers were independently
scrolled. Removing the URL fragment left both panes and offsets untouched;
restoring the same Project fragment invoked the actual full workspace renderer.

| Reader | Section / block retained | Offset before | Settled offset after rebuild | Difference |
| --- | --- | ---: | ---: | ---: |
| Chapter 10, 1001.4 | `2122` / `rid-0-0-0-172822` | -71.109375 px | -71.5625 px | -0.453125 px |
| Chapter 1, 101.4.6 | `10` / `rid-0-0-0-164266` | -18.203125 px | -18.09375 px | +0.109375 px |

Both heading element IDs changed, confirming real pane reconstruction. The
initial restored windows held 5 and 17 sections; the later settled check retained
the same blocks and offsets. A full rendered screenshot was reviewed. The
session finished **Synced** on v55; no Pro grant, authored content change, paid
Research or phone was used. The existing legacy-workspace notice remained;
its quarantined data was not modified.

Private evidence is in
`/private/tmp/permitext-startup-b4-20260907/pr62-reader-production.json`, alongside
the publication/header receipts. Initial deployment-scoped log queries since
`2026-09-07T14:18:02Z` returned no 5xx or error/fatal rows; this is a short initial
scan, not ongoing monitoring. GitHub also showed the existing Apple `Default`
CI workflow pending automatically after the main-branch merge. No manual iOS
upload or App Store submission was performed, and no newly installed phone
build is claimed.

## Remaining audit boundary

Focused VoiceOver, remaining supported-layout scope, B4 performance/eviction
evidence and B5 release decisions remain open. Passed offline citations and
physical table panning do not need repeating. No machine gate is changed.
