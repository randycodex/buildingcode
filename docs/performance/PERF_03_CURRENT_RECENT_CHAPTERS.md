# PERF-03 — Native opening and bounded current/recent warming

Date: 2026-09-22

## Implementation

1. A validated native opening returns directly to navigation. It no longer waits for HTML fallback preparation, anchor extraction, or ten section-detail loads.
2. Successful native background preparation likewise stops before unused fallback work. Missing or invalid native documents retain the existing fallback path; validation and viewport restoration are unchanged.
3. The warmup shortlist is capped at the document store's existing four-document limit: last-opened chapter, recent passages resolved to chapters in the selected edition, then default chapters. Unknown-edition recent entries are excluded. Lookup uses catalog summaries, not rich passage decoding.
4. Visible cards warm only shortlist members. Explicit chapter opening and search cancel speculative consumers; the document store's shared-load ownership is unchanged. Cancellation does not guarantee instantaneous termination of already-running synchronous work.
5. No fixed startup delay, cache expansion, full-corpus sweep, or search matching change. The existing 48 MiB cache limit can retain fewer than four large chapters. Recent prioritization currently applies to authored catalogs; SQLite retains the bounded last/default strategy.

## Validation

- Host Swift harness executes the actual priority-selection method with current/recent ordering, edition isolation, duplicates, missing identities, empty input, and capacity cases.
- Host Swift harness executes the actual opening method with mocked document preparation: validated native avoids fallback; unavailable and invalid native retain fallback; cancellation prevents opening.
- Existing web Reader navigation, scroll continuity, search reuse, and search recovery contracts pass. These do not substitute for native device validation.
- Physical-device Release build and measurement results are recorded below when available.

## Remaining acceptance

- PERF-03 is not complete merely because preparation is shorter. Earlier build 41.2 measured approximately 79 ms preparation but 1,515 ms to restored content; viewport settling is a separate substantial cost.
- Verify repeated chapter taps, remembered viewport, deep links, long tables/lists, rapid switches and cancellation on the device. No guarantee of instantaneous uncached navigation is established.
- Broader eviction protection, serial scheduling, byte-budget selection, and memory-pressure profiling remain PERF-07 work. This change restricts the candidate set; it does not implement a new universal scheduler.

## Search evidence retained for the next task

`PERF_04_CONCRETE_BASELINE_2026-09-22.json` contains sanitized signpost events from a 90-second physical-device Release 41.3 capture. All-edition `concrete` search took 29,314.3 ms; its first edition interval took 28,495.3 ms. The trace identifies the slow interval, not a proven individual CPU bottleneck. PERF-04 remains next, separately scoped to matching without rich passage loading.

## Device validation — development Release 1.0 (41.4)

- Signed Release build passed, installed in place on the connected iPhone 17 Pro. No TestFlight upload, production deployment, or main-branch merge is implied.
- Observed Chapter 10 opening, scrolling, return to cards, repeat opening, Chapter 3 opening, and an in-chapter jump to Section BC 303. The selected section remained visible after dismissing the picker.
- Exact query `1005.3.1` completed with three results in edition cards, without the removed top filter row.
- The 120-second os_signpost trace finished and exported successfully. It captured two complete warm chapter openings, in observed order:

| Interaction | Tap to prepared | Tap to content appearance |
| --- | ---: | ---: |
| Repeated Chapter 10 | 3.994 ms | 159.400 ms |
| Chapter 3 | 4.687 ms | 110.725 ms |

- Sanitized evidence: `PERF_03_DEVICE_INTERACTION_2026-09-22.json`.
- Startup and the first Chapter 10 opening were not fully captured; the initial restoration-completed event has no corresponding opening event. Do not derive cold-start or first-opening latency from this trace. Content appearance is not proof that every navigation animation has finished.
- Earlier measurements included restoration-completed timing, so these warm content-appearance samples are not an equivalent before/after benchmark. They support the fast prepared path, not an app-wide speedup percentage.
- The recorder ended the app at its configured time limit; it was relaunched normally afterward. Return-from-Search viewport restoration was interrupted by that stop and remains unverified, as do the broader acceptance cases above.

## Plan refinement from repeat-search proposal

PERF-04 now explicitly includes a persistent, bounded result cache keyed by query semantics, scope/editions, corpus revisions and engine version. Only completed successful result sets qualify; corpus changes invalidate entries independently of app releases. This is planned search work, not implemented by PERF-03.

## Follow-up verification and review — build 41.4

- After a fresh process launch, Chapter 7 opened and its text scrolled correctly. This is a rendered check only: the 180-second capture completed, but exported just one application interval (`projectHydration`) and no chapter/startup milestones. No cold-opening latency is claimed from it.
- Switching from a scrolled Chapter 7 to Search and back preserved the visible 701.1/701.2/702.1 content and viewport position.
- Tapping Chapter 7 and immediately switching to Search settled in Search; returning to Reader showed Chapter 7 normally.
- A cold-launched external link to `/open/section/1012` opened 2022 BC 705.8 and rendered Table 705.8. This verifies the shared-section detail route, not native chapter table interaction. Horizontal table navigation was not established through Mirroring.
- Independent review found three introduced warmup issues before acceptance: category shortlist derived from the wrong Reader, selected in-flight work cancelled before joining, and no bounded warmup resume after navigation. These must be corrected and rechecked before PERF-03 acceptance.

## Review corrections

1. Resolve the warmup shortlist from the category actually selected by that Reader, including the secondary Reader. Retire old work for an empty requested category.
2. Keep existing speculative consumers until explicit native preparation acquires the selected document, then retire speculation before navigation. This avoids cancelling the last shared consumer and decoding the selected document twice. Bounded unrelated warmups may still run until acquisition; a global priority scheduler remains PERF-07.
3. Resume bounded warming with a cancellable 200 ms task only while ready chapter cards are active, no chapter navigation is pending, and Search is not running. Category, edition, account, tab and navigation changes invalidate the task.
4. Preserve an identical nonempty shortlist during startup-to-Reader handoff instead of cancelling and restarting its consumers. This is a best-effort warmup marker, not a cache residency guarantee. Explicit navigation continues to check the document store.
5. Extended host tests cover acquisition-before-cancellation, requested-category selection, empty-category cancellation, Search suppression, return-to-Reader eligibility, repeated resume calls and equivalent startup handoff.

## Profiling limitations in this follow-up

- Independent inspection of raw XML confirmed that missing chapter events in the 180-second capture are absent from the recording, not lost by the summary parser.
- The Mac subsequently reported a local-network connection. An explicit-subsystem/all-process retry initially disconnected. A second retry began but failed to finalize promptly after its time limit; graceful interruption also failed to complete, so its local recorder process was terminated. Neither retry supplies accepted timing evidence.
- Do not infer cold-start improvements from successful build/install, a completed trace container without required milestones, or Mirroring tool-call duration.

## Final correction build — development Release 1.0 (41.5)

- Final signed Release build passed after all review corrections, including identical-shortlist preservation. Build log: `/tmp/permitext-perf03-415-final-build.log`.
- Installed in place successfully; the owner's data/account were retained. This remains a local development distribution, not TestFlight.
- All three chapter host harnesses passed on final source; whitespace checks passed.
- Mirroring reported “iPhone in Use” immediately before final rendered category/return-to-cards checks. Those checks remain pending until the phone is available. Do not substitute the earlier 41.4 UI observations for acceptance of the 41.5 lifecycle corrections.

## Final-build rendered follow-up

After the owner locked the phone, Mirroring reconnected and build 41.5 was exercised:

- Building Code Chapter 10 opened with the expected Means of Egress content; returning to chapter cards worked.
- Switching to the independent Plumbing Reader showed its blue Plumbing chapter catalog.
- Plumbing Chapter 1 opened with Section PC 101 and the expected Plumbing Code text; returning to its chapter cards worked.
- Mirroring reported the phone in use again during the attempted switch back to Building Code. That last return was not verified. No UI interaction continued after the interruption.
- These observations complement the host eligibility/category/shared-load tests; they do not prove cache hits or a cold-latency improvement. Broader full chapter acceptance remains open as stated above.
