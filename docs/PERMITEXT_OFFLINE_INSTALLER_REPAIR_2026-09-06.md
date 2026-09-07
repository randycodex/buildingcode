# Browser offline installer repair

September 6, 2026 (New York). Continuation of B3 in the
[original production audit closeout](./PERMITEXT_ORIGINAL_AUDIT_CLOSEOUT_2026-09-06.md).
Base commit: `4f4e874fe`. The repair was approved and published through PR #59
as Production commit `6ccc2d4a8cc2d605b13ee6d46dbd4e1a0070883a`. The local
verification below retains its original scope; publication and hosted evidence
are recorded separately below. No new TestFlight build was created.

## Reproduced cause

- The old installer requested every chapter's complete body in one response.
  A read-only public API probe found a server 500 for Building Code Chapter 33
  (ID 33), plus 30-second timeouts for Administrative chapters 1 and 3 (IDs 74
  and 76). These are fresh request observations; the exact request from the
  earlier browser stall was not captured.
- The actual old concurrency helper reproduced the displayed symptom with 467
  controlled tasks: after one failed, surviving workers emitted **436 more
  progress callbacks**, ending at **466/467**. They could also write new rows
  after failed-install cleanup. The apparent endless download could therefore
  be a completed failure whose error had been overwritten.
- The server already supports body windows. The repaired downloader completed
  the three affected chapters using that existing API: 1,029, 476 and 317
  sections respectively. The public probe also downloaded all 111 separately
  indexed historical chapters. Its 533 paged requests completed successfully;
  the largest decoded page in that probe was 507,953 bytes. This does not
  identify the internal Vercel exception behind the original 500.
- The default 467-chapter index omitted the 2014 catalog even though the
  libraries endpoint advertised it. That would leave historical citations
  unavailable offline after an otherwise successful web installation.

## Repair

- Download chapter bodies in windows of 25 sections. Validate the returned
  range, body presence, stable section ordering and edition before storing the
  complete chapter. Mixed or incomplete pages fail without activating them.
- Bound each fetch and response-body read to 30 seconds. A worker failure aborts
  its peers, stops new requests and waits for in-flight workers before cleanup
  or error display. Late writes and progress cannot continue after failure.
- Include the separately addressed 2014 Construction index. Schema 3 causes
  older packages to offer an update while preserving their existing read path.
- Show section progress within large chapters. Replace the outdated 70 MB
  estimate with “several hundred MB”: captured JSON was about 139 MB, and the
  893 referenced figures totaled about 169 MB before browser-storage overhead.
- Update the shell/cache references together (`v50`, shell `v789`). No private
  draft cleanup or account lifecycle behavior was changed.

## Verification

The focused offline, installer-recovery, Notebook durability, source-edition,
build-output and workspace-restoration contracts passed. Syntax and diff checks
passed. The new recovery regression is included in `npm run test:offline`.
It covers stopped peers, draining an existing write before cleanup, no late
progress, retention of the previous install, retry, missing/mixed pages,
historical/grouped chapters and a timeout after response headers.

Real Chrome 152 storage was exercised through a dedicated loopback origin using
the actual installer module, service worker, IndexedDB and Cache Storage:

1. A synthetic current/historical library installed with every body page.
2. A controlled replacement failure retained the previous installed library,
   an unsent synthetic Note and image. Its error remained visible and no
   abandoned-install chapter rows remained.
3. Retry succeeded and retained the exact historical edition.
4. The captured public corpus installed completely: **578 chapters, 32,551
   sections and 893 figures**. The 9.442-second loopback sample is not an
   internet-download, device-startup or p50/p90 measurement.
5. After page reload, all counts persisted, a cached figure decoded, and the
   offline API returned **2014 Slope** and **2022 Gates** with matching edition
   and stored body text. This exercises the browser storage/API path; it is
   not a fresh hosted Account/Reader interaction or a physical radio-off test.

The initial complete-corpus fixture run returned 404 because its test router
only accepted numeric IDs; supporting grouped chapter IDs fixed the fixture.
The subsequent complete run passed. No product endpoint was changed for that
fixture correction.

The fixture can be run with `node tests/offline-browser-install.mjs` from
`permitext-sync-server`. Its default mode uses synthetic data only and makes no
external calls. `--corpus /path/to/captured-public-files` enables the complete
corpus check. Use its cleanup button when finished; it only operates on that
dedicated loopback origin.

Private receipts under
`/private/tmp/permitext-original-audit-closeout-20260906/` include:

- `offline-worker-failure-before.json`
- `offline-catalog/probe-result.json`, `paged-result.json`, `assets-result.json`
- `offline-installer-browser-results.txt`
- `offline-installer-after-reload.txt` and `.png`
- `offline-installer-cleanup.txt`
- `offline-installer-repair-result.json` (final scope/source checkpoint)

No account, entitlement, provider, paid Research or phone operation occurred in
this batch. The designated test grant remains last-recorded as revoked; no new
grant was needed for isolated public-data verification.
Both isolated browser test origins were cleaned, their tabs closed and the
loopback servers stopped. Captured public inputs and test receipts remain in
the private evidence directory; the user's Production session was untouched.

## Approved publication

The owner approved pushing and deploying the reviewed web candidate. Branch head
`a36f5fe19a85bd22a2f8577821c4342cd7d88686` passed both PR checks and was merged
through [PR #59](https://github.com/randycodex/buildingcode/pull/59) at
`2026-09-07T01:05:59Z` (September 6 in New York). The merge's product trees match
the approved head. The unrelated untracked workspace files were preserved.

Production deployment `dpl_4QmhXSsY7kVtKLEvzGKS83sgSSc7` reached READY at
`2026-09-07T01:08:18.218Z`. Both `https://permitext.com` and
`https://permitext-sync.vercel.app` reported the exact merge SHA, healthy
PostgreSQL/normalized-v4 storage, and six matching source assets per origin.
The Production health contract passed. Existing content, configuration and
Notebook dependency gates ran in the Vercel build without bypasses.

On the hosted Free test session without an installed library, DevTools Offline
and the app's Offline indicator were observed. Opening saved 2014 Slope showed
the new "Saved section unavailable" dialog with connection/download recovery
instructions; the saved item remained. The dialog was visually inspected and
dismissed. The test tab was closed to end its offline simulation, and a fresh
tab returned Synced. The approved temporary Pro grant was reactivated at
`2026-09-07T01:11:39.117Z` for the hosted installation.

Private receipts include `served-offline-production.json`,
`hosted-saved-citation-recovery.txt` and `.png`. The native Account X is now in
the shared source but remains unbuilt for TestFlight; phone build 62 is unchanged.

## Hosted acceptance and cleanup

The live Chrome session completed **Download for Offline Use** with
**578 chapters available offline**. The download began at
`2026-09-07T01:12:02.039Z`; completion was observed by `01:14:03.227Z`.
That is one periodically observed hosted run, not a p50/p90 benchmark. The
installed status survived a page reload.

With DevTools **Offline** selected and the app displaying **Offline**, Saved
reopened **1010.2 Slope** in the **Building Code (2014)** Reader, then
**1010.2 Gates** in the **Building Code (2022)** Reader. Their full target text,
chapter and edition labels were captured in DOM/accessibility evidence. Saved
detail screenshots were visually inspected; they do not separately show both
Reader edition headers. This verifies the hosted browser path with emulated
transport failure, not a new physical radio-off test or a browser-wide
storage-pressure test.

DevTools was restored to **No throttling** and closed. The retained test session
returned **Synced**. Temporary Pro was revoked and independently confirmed
absent at `2026-09-07T01:17:15.716Z`; a fresh client load showed **Free** and the
same test identity. A before/after export comparison confirmed unchanged
foundation artifacts, Research answers, operations and usage. No private cache
was cleared, no new paid Research or purchase occurred, and the test account
remains signed in. The public offline library was retained.

The deployment-specific early 5xx log sample returned no rows. This is a bounded
observation, not sustained monitoring. Additional private receipts:

- `offline-publication-receipt.json`, `hosted-install-timing.json`
- `hosted-offline-installed.txt` and `.png`
- `hosted-offline-2014.txt` and `.png`, `hosted-offline-2022.txt` and `.png`
- `hosted-network-restored.txt`, `hosted-final-cleanup.txt`
- `hosted-retained-comparison.json`

## Remaining original-audit work

The web installer, installed-library citation pair and failure-recovery flow
are passed within the scopes above. Reuse these results and the prior native
passes. Other B1/B2/B3 boundaries and B4/B5 remain as
recorded; this repair does not close VoiceOver, storage pressure, operations or
release approval.
