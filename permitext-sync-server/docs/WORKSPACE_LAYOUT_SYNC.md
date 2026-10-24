# Web workspace layout sync

Each signed-in account shares its open columns, ordering and preferred widths per Project through the existing continuity record (`workspaceLayoutsJSON`). Layout records use the stable Project workspace ID. A newer record replaces the presentation for that Project; equal timestamps have a deterministic tie break. Project record IDs and client IDs remain distinct and are both recognized when restoring Notes and Code Question columns.

The active Project and workflow view remain local. Reader locations seed newly opened columns, while existing Readers keep their own reading position. Navigating or scrolling within an existing Reader does not create a layout update. Documents, cached section bodies, search text, local Research drafts and Code Question domain records are excluded from the layout projection. Existing content access checks still apply when a column mounts.

## Request and storage behavior

- Layout edits update the existing local snapshot immediately. A separate account-scoped metadata catalog survives offline use and reloads.
- A 1.5-second debounce queues changed Project layouts into the existing durable sync outbox. Visibility loss/page hide queues the final pending metadata without waiting for the debounce.
- Unchanged layouts and already acknowledged versions are not uploaded again. A metadata-only push skips the usual follow-up pull and broadcasts a lightweight signal to other local tabs.
- Other devices receive layouts on the existing foreground checkpoint/incremental sync schedule. There is no new polling loop, Realtime subscription, bucket, schema migration, or model call.
- Incremental PostgreSQL pulls read parent Projects only for changed projectSection records that need them. Layout-only deltas return no Project dependency rows. Initial sync still downloads the normal initial account state, and opening a newly restored content column can load that column's content.
- The server keeps the existing continuity row/event mechanism. Stored event volume still grows with accepted changes, and the merged continuity payload grows with the number of Project layouts; this is small metadata, not a claim of zero Supabase usage.

Incoming layouts defer while a text editor is focused, a column is being dragged/resized, or a Note/Report has unsaved work. Deferred layouts can apply on a later existing sync checkpoint. New local presentation edits take precedence over an unapplied remote record. Account identity/generation checks fence delayed work. Existing native clients preserve the metadata through server merging; native layout application is outside this web change.

## Local validation

Run:

```sh
npm run test:workspace-layout-sync
npm run test:workspace-layout-sync:postgres
npm run test:workspace-layout-sync:browser
```

The PostgreSQL test requires PGlite (`PERMITEXT_TEST_PGLITE_PATH` can specify its module entry). The browser test requires Playwright (`PLAYWRIGHT_MODULE_PATH`) and Chrome (`CHROMIUM_PATH`); it starts an isolated synthetic fixture and two independent browser profiles. It never accesses an owner account or cloud database.

Measured with local synthetic data:

- Eight keyboard resize operations plus reordering produced one approximately 2.4 KB layout push, zero follow-up `/sync/pull` requests, and zero Project/document requests.
- A fresh independent browser restored open columns, order and rendered width. Tests also cover remote closing, local drafts, narrow-screen preference retention, unchanged-save suppression and offline retry.
- Actual repository SQL in embedded PostgreSQL, with 40 Projects: a layout delta was 1,432 bytes with zero Project dependency rows. Unchanged deltas were empty; changed projectSection records retained their actual parent, and full initial pulls retained all Projects.
- Account isolation, continuity merging, startup restoration, workspace state, pane orchestration, Reader continuity, Research column sizing and offline shell/cache checks passed locally.

The broader `evidence-folders-contract.mjs` currently fails its bookmark assertion against `renderReaderChapterSection`, whose implementation delegates to `buildReaderChapterSection`. The same assertion fails against the unchanged baseline app source; it is unrelated to this change. No production billing or hosted deployment was measured.
