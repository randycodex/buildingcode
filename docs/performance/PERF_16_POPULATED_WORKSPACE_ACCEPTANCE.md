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
