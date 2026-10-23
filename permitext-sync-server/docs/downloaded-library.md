# Optional downloaded library

Settings → Library & offline → Offline exposes the optional Pro download.
Downloading enables **Use downloaded library for readers and search**. Turning
that preference off returns online reading/search to the server while retaining
the complete download for offline fallback. Removal affects public library data,
not private Notes, drafts, image queues or account snapshots.

The download includes all 578 navigation chapters (32,552 catalog sections),
referenced figures, the canonical global Search text/postings, and the exact
Reader Find projections. Existing reader windowing and offscreen suspension
continue to apply. There is no limit on the number of open readers.

## Storage and recovery

- A dedicated worker stores rich bodies once, separately from compact chapter
  manifests. Search processes small document batches; completed result metadata
  and snippets have a 3 MiB / four-query budget. The worker terminates after
  30 seconds without requests.
- Complete chapters and verified index parts have durable checkpoints. A pause,
  tab close, network failure or browser restart leaves them available to resume.
  A chapter interrupted before its transaction completes is downloaded again.
- Browser storage is checked before staging a new generation. The UI recommends
  about 400 MB for an installed library and room for a second copy during an
  update. Browser estimates include implementation overhead and can lag deletion.
- Web Locks exclude concurrent installers/removal across tabs. Readers hold a
  shared generation lock; activation waits for their current reads to finish.
- Every chapter window pins both the public and chapter revisions. Every index
  part has a content-addressed name, byte count and SHA-256 digest. Final revision
  and manifest checks happen before one atomic active-pointer transaction.
- Failed updates leave the complete active library available. A changed package
  restarts only its staging generation; it cannot mix old and new source text.
- Retired public generations are collected in small transactions. Figure caches
  retain the current and previous revisions for already-rendered passages.
  Legacy public chapter storage is retired only after successful activation.
- Online requests pinned to a newer server corpus bypass an older download.
  Offline use retains the installed source identities and trust metadata.

The app checks for updates in Settings; users explicitly choose Update library.
An interrupted update presents Resume download. App-shell updates retain the
existing natural service-worker waiting policy so an old tab never acquires a
partial replacement shell.

Requires module workers, IndexedDB, Web Locks, Web Crypto, CacheStorage and gzip
DecompressionStream. Current Chrome and the in-app Chromium browser were checked;
unsupported browsers retain online operation. Safari and physical mobile browser
acceptance have not been performed.

## Build and verification

`build:production` derives content-addressed public packages from the same
prepared catalogs, exact text, postings and Reader indexes used online. Generated
packages are ignored in Git and copied into the normal deployable static output.
The mutable download manifest is excluded from service-worker cache-first rules.

Focused checks:

```sh
npm run test:downloaded-library
npm run test:offline
npm run test:search-interaction-performance
npm run test:search-group-pagination
node tests/public-code-client-invalidation-contract.mjs
node tests/offline-notebook-durability-contract.mjs
node tests/workspace-bundle-contract.mjs
node tests/reader-search-projection-contract.mjs
npm run build:production
```

The real-Chrome synthetic suite covers reload recovery without re-fetching
completed chapters, corrupt index/figure rejection, final deployment drift,
atomic update/resume, bounded retired generations, concurrent tabs, insufficient
storage, edition/scope filtering, independent cached pages, Reader Find,
cancellation, opt-out and private-draft preservation.

The isolated full-corpus browser harness is:

```sh
node tests/downloaded-library-full-corpus.mjs
# Or verify deployed modules and public data:
node tests/downloaded-library-full-corpus.mjs --port 8797 \
  --source https://permitext.com --deployed --output /tmp/permitext-library-production.json
```

It compares all result IDs/order for six queries, five chapters' rich body windows
and Reader Find targets, then performs 25 repeated searches and 25 reader reads.
Memory is page-plus-worker memory where the browser supplies it, with a bounded
measurement timeout; it is not Chrome's native process footprint. Timing is public
transport time, not keyboard-to-render latency. A comparison to localhost does
not measure the production network benefit.

## Baseline test limitations

On the starting `b32a4ae1a` checkout, broad suites have stale expectations unrelated
to the download implementation. Their affected production functions/styles were
compared against HEAD and remain unchanged:

- `npm run check` precheck: Research progress button CSS expectation.
- The main `check` body: Evidence folder test expects bookmark code in the former
  Reader wrapper, now delegated to `buildReaderChapterSection`.
- `test:public-code-cache`: progressive Reader VM fixture lacks
  `readerPanelIntersectsTrack`.
- `test:web-active-code-sources`: Settings VM fixture lacks `list.before`.
- `notebook-collapse-contract`: its isolated VM lacks the existing imported
  `capturePaneScrollPositions`; the affected collapse function is unchanged.

Focused download/offline/search/durability checks and the production build are
reported separately from those pre-existing broad-suite failures.

## Signed-in production comparison (2026-10-23)

Release `65ce04b2b394` was exercised in the user's Chrome session with the
installed library switched off and on, the same five construction sources, and
two existing Projects retaining six and three Readers. Each mode ran 22 searches,
14 Project switches and three search-result Reader openings. No private content
was edited or removed. Chrome's caches were not cleared and garbage collection
was not forced. This is a small sequential sample, not a controlled cold-network
or long-tail benchmark; browser-control overhead is included in visible-DOM
timings. A failed initial status probe and a focus-through-Search pilot are
excluded from the reported samples.

| Observed median | Online | Downloaded |
| --- | ---: | ---: |
| Search first page visible (22 samples) | 455 ms | 481 ms |
| Selected Reader heading visible (3 samples) | 1,270 ms | 768 ms |
| Project's first Reader restored (14 samples) | 1,126 ms | 1,189 ms |
| Direct existing-column keyboard focus (6 samples) | 62 ms | 35 ms |

Downloaded reading helped the sampled source openings. Warm search and Project
restoration were broadly similar; downloading is not a general UI or RAM fix.
Native Chrome Task Manager Memory Footprint, including grouped Permitext workers,
briefly reached 496 MB online and 571 MB downloaded during rapid switching, then
fell naturally to 237 MB and 265 MB while idle. These are sampled values, not a
continuous peak capture or proof of a long-term leak's absence. Separate
service-worker rows were recorded when Chrome placed them in another process;
shared Browser/GPU processes and unrelated sites are not attributed to Permitext.
The six-Reader Project later settled at 282 MB with 0% CPU and no network traffic.
Three additional previously unused queries were run in reverse mode order after
idle: online took 1,337/818/521 ms and downloaded took 840/545/593 ms. None of the
25 queries per mode reproduced a three-second search spike.

The comparison identified a separate cross-tab invalidation bug: the library
storage listener echoed received signals indefinitely between two tabs and also
invalidated public caches for unrelated private workspace writes. The correction
only handles library preference/invalidation keys (or storage clearing), notifies
the receiving tab without writing back, and has a two-realm queue regression
test that fails on the original implementation. Offline shell/module versions
are advanced together; the installed corpus requires no re-download.

Extended verification of the cross-tab correction exercised two real production
tabs. Preferences propagated both ways and neither tab reported console errors.
The process briefly reached 699 MB and fell naturally to 367 MB after closing the
extra tab. A further unchanged-passage round exposed 3–4.7 second Project
restoration samples. Server sync processing in that interval was mostly
51–145 ms, so it did not establish a multi-second server-processing bottleneck.

A native Chrome Performance trace also showed Notebook editor constructors
running while Research was selected. Notes descriptors now retain their hidden
slots without initially constructing editors or requesting their foundation.
Selecting Notebook starts their normal gated hydration. Already mounted editors
remain retained when hidden, so this change does not discard draft text,
selection, undo history or background saves. The actual mount/publication test
failed before the correction and now covers deferred construction, unused lease
release, first reveal and controller retention across hide/reveal. Account,
workflow navigation and Notebook durability checks are reported separately.
