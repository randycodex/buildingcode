# PERF-16 — Populated workspace acceptance

Status: fixtures running and initial rendered checks underway; broad acceptance remains incomplete.

## Boundaries

Use loopback-only temporary accounts and storage through real application HTTP routes. Never seed the owner account or production. The owner has taken the phone; physical iOS coverage remains pending until tomorrow. No simulator. Continue one performance task at a time.

## Fixture targets (must verify persisted counts)

| Profile | Saved rows | Projects | Notebook cards | Long-note paragraphs | Report blocks | Images |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small | 12 | 2 | 4 | ordinary short notes | 8 in target Report | pending |
| Large | 1,000 | 12 | 60 | 100 in target note | 100 in target Report | pending |

Saved records must use actual section identities from both 2022 and 2014 catalogs. Record project-assigned and unassigned counts separately. Notebook images need real local upload/reference records; do not count placeholders as image coverage. The targets above are fixture design, not verified counts.

## Acceptance matrix

1. **Fixture integrity:** receipt and persisted reads prove exact row/project/card/image/block counts, editions and associations.
2. **Initial load:** trace small and large account startup, visible Saved, Project, Notebook and Report readiness. Record request counts/bytes and renderer tasks; distinguish pane usability from first paint.
3. **Return:** switch away and back; no repeated full-account work merely to show one pane/item. Restore selected note, search state and scroll where expected.
4. **Editing/autosave:** edit a long note and Report; verify persisted content after reload. Report's explicit-save behavior must not be misrepresented as autosave.
5. **Layout continuity:** resize/reorder or open another pane during pending edits. Check draft text and expected focus/selection preservation.
6. **Recovery:** one bounded slow request and one failed read; unaffected panes remain usable, retry succeeds, drafts survive. Also verify installed/offline recovery without claiming unsynced edits reached the server.
7. **Scale comparison:** compare the same visible target with small vs large unrelated account content; any detected bottleneck gets a bounded cause/measurement/acceptance item.
8. **Evidence limits:** desktop/file-store timings are not production database/CDN or native iPhone measurements. Explicitly retain untested device/release/large-image scenarios.

## Current evidence

PERF-11/PERF-15 already verified a small synthetic six-pane workspace and retained Notebook text. That is useful regression context but does not satisfy the large-account scenarios above. New fixture implementation is being prepared in `permitext-sync-server/tests/populated-workspace-performance-fixture.mjs`.

## Running fixtures and initial verified checks

- Small loopback8802, process session39296; large8803, session78737. Both are temporary, expire after one hour, and seed through real application routes. Logs `/tmp/permitext-perf16-small.log` and `/tmp/permitext-perf16-large.log` contain bootstrap capabilities; do not publish account/browser-state tokens.
- Receipts in `PERF_16_FIXTURE_RECEIPTS.json`: persisted sync pull proves small12saves/2Projects/6assigned/6unassigned and large1000saves/12Projects/500assigned/500unassigned. Notebook list proves4/60cards; upload responses prove1/6images; Report save responses retain8/100blocks. First long-note paragraph/image counts still need readback.
- Browser `perf16-small`: selected Synthetic Project1, Saved+Notebook open, Synthetic Note1 selected. One uploaded image decodes at1×1pixels. All six unassigned2014rows rendered before selecting theProject; Project1 shows its three assigned2022saves.
- Browser `perf16-large`: global Saved open;48initial sectionbuttons plus Show more. This is existing batched rendering, not proof of missing saves. All500unassignedrows still need pagination coverage. Initial opening trace `/tmp/permitext-perf16-large-saved-trace.json` has two renderer tasks above50ms, maximum57.156ms; attribution review pending.
- Source fixture now permits `/reports/drafts/list` failure injection; the already-running small process predates that addition. Use notebook read controls there or restart it before testing Report read failure.
- Acceptance still open: matching-layout small/large timing, complete pagination and representative section openings, long-note/report edits/reload, image read on large, layout continuity, slow/failing request and offline recovery. No account-size speedup claimed.

## First measured remediation: Saved annotation resolution

CPU samples identify repeated full-account summary rebuilding inside each visible Saved row. The production render now captures annotations, local IDs and clear records once per synchronous invocation. No global cache was introduced; a later render sees new edits, account state and clears. The production-function test proves48summaryreads become1 for48rows, with exact note/tag/edition/block/local-precedence/tombstone/clear parity and fresh next-account state.

`PERF_16_SAVED_RENDER_EVIDENCE.json` separates instrumented CPU attribution from unprofiled task latency. Sampled rendering falls688.13→22.10ms, but the maximum unprofiled startup task does not improve; other account-loading work remains. Do not describe the sampled reduction as a user-visible startup speedup.

Browser onv570 renders48rows,96afterfirstShowmore, and all500unassignedrows after exhausting pagination; Showmore disappears. Small note1's actual uploaded1pixelimage decoded successfully. Offline contracts pass. Initial smoke source-string gate was updated for the optional snapshot fallback; behavior is covered by the new executable test. Full smoke rerun passed (session38061 exit0), log `/tmp/permitext-perf16-saved-smoke.log`. New source has not been installed oniPhone or deployed.

Authenticated HTTP readback of the large first Note and Report confirms100paragraphs,6imageblocks and100Reportblocks. These are persisted structures; large-image rendering/editing and reload remain pending.

## Phone-free editing/recovery checkpoint

- Large Note1 rendered all six uploaded images (each decoded at1×1); persisted body has100paragraphs and6imageblocks. These test image identity/rendering, not large-image memory or decoding.
- Small Note1: inserted a body marker through the rendered contenteditable editor, opened Report, edited its first heading and explicitly selected Save draft. Authenticated readback retained the note marker/image and all8Reportblocks. Full browser reload rendered both edits.
- One-shot503 failures on notebook/cards/get and notebook/cards/list were observed by fixture metrics. Cached note content and the saved Report stayed visible after reload; subsequent reads returned200. This establishes this cached recovery path, not first-ever/offline editing acceptance.
- A3000ms notebook/cards/list delay was injected. The cached note marker and edited Report heading were already visible while the read was outstanding. Sanitized evidence: `PERF_16_EDIT_RECOVERY_EVIDENCE.json`.

### Excluded large editing run

After an automated Control+Home/body insertion/Report activation sequence, the browser consumed high CPU. A6.89second trace contained375keydown,375keypress and375click events, with alternating Report open/close. This is an input-contaminated run, not evidence of an autonomous app render loop. Its repeated reads exhausted the synthetic account's hourly Report limits; a fresh browser displayed the actual429 error. No rate limit was bypassed or production behavior changed.

The renamed long-note title persisted, but the intended body marker did not. Do not count that run as successful long-note autosave. Only its synthetic browser was terminated after capture; the owner's browser and phone were untouched. Raw diagnostic artifacts remain in `/tmp/perf16-hang.cpuprofile` and `/tmp/perf16-hang-sample.txt`; do not commit raw browser metadata.

### Resume order

1. Start a new isolated large fixture/account (the old temporary fixture expires automatically). Repeat long-note body editing with DOM selection plus editor insertion; avoid the previous keyboard chord until the repeated-input cause is understood. Verify100paragraphs,6images and body marker after reload.
2. Open/edit/save/reload the100blockReport; use bounded read attempts and inspect displayed errors immediately.
3. Finish representative first/middle/last Saved section opens, comparable small/large pane timing, unsaved-draft layout continuity and offline recovery.
4. With the phone available, perform remaining physical-device timing/rendered acceptance. No simulator.

PERF-16 remains open. Completed changes are local performance-branch commits, not deployed or installed on the phone.

## Clean large-account follow-up

Fresh temporary fixture on8804 avoids the prior account's exhausted request budget. It contains1000Savedrecords,12Projects and60notes. Body insertion through the rendered editor succeeds without the earlier keyboard chord. Authenticated readback proves the marker,100paragraphs,6images and100Reportblocks with the edited heading; full reload renders both edits and all six images decode.

With an unsaved Report heading edit, opening Search preserves the exact Notebook editor DOM node and Report pane DOM node, the unsaved heading and the note marker. The Report was then explicitly saved. This closes the long-note/Report editing and pane-open draft-continuity checks, but does not prove resize/reorder focus/selection preservation or offline editing.

Next: comparable small/large readiness timings, representative Saved section openings, resize/reorder continuity, offline recovery and physical-device acceptance. Clean browser session `perf16-clean`, server session85387; temporary fixture expires automatically. No real account or phone touched.

### Pointer resize acceptance

In the clean large workspace, edited a Report heading without saving, selected the first six characters (`PERF16`) in the long Notebook editor, then dragged the Notebook/Report divider fromx730 tox800 using pointer down/move/up. Its final position confirms a70pixelresize. The exact Notebook editor DOM node, editor focus, selected text and unsaved Report heading all survived. Explicitly saved the Report afterward. This closes pointer-resize continuity for this desktop configuration; reorder and offline scenarios remain open.

### Offline observation requiring follow-up

Network emulation disabled only for the synthetic browser: a fresh fetch failed while the already-rendered note and Report remained visible. The browser initially had zero service-worker registrations, so its first offline reload failed at the browser network layer.

Invoked the production `prepareOfflineShell()` function in that synthetic browser (shell only; no code-edition download), verified an active controlling service worker, and repeated offline reload. The app shell loads, but Saved/Notebook/Report show `Private workspace content is unavailable. Check your account or connection.` Restoring networking and reloading restores both persisted edits. No offline edits were attempted and none are claimed synced.

This is a reproducible private-content offline acceptance gap in this fixture configuration. Next inspect the workspace access gate's offline eligibility and retained account snapshot conditions; distinguish deliberately required code downloads or verified account state from a regression. Do not bypass access isolation to make the test pass.

### Offline prerequisite clarification

Source review: both `saveOfflineSyncSnapshot` and `loadOfflineSyncSnapshot` return early without library metadata `installID`. `prepareOfflineShell` does not create that metadata; only a completed code-library installation does. Browser readback confirms no sync snapshot existed for the fixture account. Therefore the shell-only failure above is a missing test prerequisite, not a demonstrated access-gate defect. Started the real `downloadOfflineLibrary` operation in the synthetic browser; inspect `window.perf16OfflineInstall` before proceeding. Do not seed metadata or bypass account verification to force acceptance.

### Full-library offline result

The real download completed:578chapters and32551sections. An online reload saved the fixture account's1513mutation snapshot. After disabling networking and reloading, the long Notebook marker renders successfully. Report instead displays `Report unavailable: Failed to fetch`. Thus the workspace access gate and Notebook offline restoration pass with their actual prerequisite; Report's data path remains unavailable offline. Restore networking before continuing other checks. Assess Report's intended offline contract before proposing caching; do not imply offline Report changes have synced.

### Report contract and reorder follow-up

The current Report initializer requires server draft/source/history/options reads and has no offline snapshot fallback. Plan invariant3 preserves offline reading/search where currently supported; it does not authorize claiming existing offline Report support. Retain Report offline availability as a documented limitation/future feature, not a performance regression fix or reason to weaken access rules.

Native browser drag-and-drop moved Search fromlast tofirst: Saved/Notebook/Report/Search → Search/Saved/Notebook/Report. An unsaved Report heading remained and the identical Notebook editor DOM node survived. Explicit Save draft followed. Initial raw pointer attempts did not change order and are not counted. Reorder focus/selection was not measured; pointer-resize focus/selection passed separately.

### Representative assigned Saved openings

Project1 contains42assignedrows in the1000saveaccount. Opened indices0,21,41 separately, closing each detail before the next:3.12 Furnishings types and materials;28-105.12 Conditions of permit;9.2.1 Such violation was the first… . Each detail's heading matches its selected row and displays General Administrative Code (2022 edition). The middle item renders its actual introductory sentence. This verifies representative identity/navigation, not timing or exhaustive content; unassigned2014openings remain pending.

### Unassigned historical Saved openings

A separate clean browser for the same synthetic account opened global Saved. Pagination reached all500unassigned2014rows. Opened indices0,250,499:28-101.1 Title;28-117.3 Duration of certificate;28-305.4.5 Fees. All three detail cards match their selected section/title, display General Administrative Provisions (2014), and render actual body text (including the full certificate paragraph). This closes representative assigned/unassigned edition-identity opening coverage. It is not a latency benchmark or exhaustive corpus-content comparison.

### Same-detail small/large comparison

Fresh browser sessions for existing warm test servers opened global Saved and measured the same2014section28-101.1 six times each. Timer spans DOMclick → detailtextarea readiness → two animation frames, with identity/edition/body assertions. Small account12saves/6visible: first55.7ms, repeatmedian49.9ms. Large1000saves/48visible: first71.1ms, repeatmedian66.6ms, one133.3msrepeatoutlier. Section requests take1.2–2.9ms and report300transferbytes.

These are warm/local/list-prefetched results, not cold startup or iPhone latency. Six samples and different visible rowcounts do not isolate account-size causality. The extra renderer work warrants CPU attribution before another patch. Raw bounded samples are in `PERF_16_DETAIL_SCALE_TIMINGS.json`; measurement script is `/tmp/perf16-measure-detail.js`. Next profile large detail opening and distinguish whole-account summaries from visible-list rendering and scheduling.

### Empty-clear fast path

CPU attribution across six open/close cycles samples257.52ms in currentContentSummary, including182.69ms in recordSurvivesBulkClear (inclusive overlapping totals). The helper now returns immediately for nullish/emptyArray/emptyMap clearcollections, avoiding per-record timestamp parsing and edition normalization when no deletion marker exists. Nonempty deletion semantics remain unchanged.

New executable coverage proves empty collections never read record fields; existing server-order, edit-order, undated-record and scope cases pass. Saved parity, offline contracts and all smoke components pass. The final smoke initially failed only its old sync-state asset URL expectation; updating that version assertion and rerunning smoke passed. Browser confirmedv571. The same six-sample large-account run gives repeatmedian50.1ms versus66.6msbefore; first53.2ms versus71.1ms. This is a small warm/local sample including two animation-frame waits, not a production/iPhone or robust-percentile claim.

### Thirty-sample post-fix repeat check

Executed30sequentialwarmopen/close cycles per account, smallthenlarge, onv571. Every sample asserts2014section28-101.1 identity and body. Small:median50.0ms,p95nearest-rank51.5ms,range46.4–52.0ms. Large:median50.0ms,p9551.1ms,range46.3–51.2ms. Thus the earlier account-size difference is not present in this bounded post-fix path. This timing includes two animationframes and has an approximately50msmeasurementfloor; it does not imply50msofCPUwork.

Fullsamples: `PERF_16_DETAIL_REPEAT_30.json`. Reproducible browser-evaluation script: `PERF_16_DETAIL_BROWSER_MEASUREMENT.js`. No concurrent heavytests/benchmarks ran. A single warm desktop run per account does not replace restored-workspace startup, cross-device, coldnetwork, memory or physical-iPhone acceptance. Those remain open.
