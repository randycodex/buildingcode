# Downloaded-library comparison — October 23, 2026

The desktop prototype improves new reader opening and uncached searches. It adds a small resident memory cost and about 269 MB of disk storage. Repeated searches already served by the app's memory cache show little additional benefit.

## Matched UI measurements

| Action | Online, no library | Downloaded library | Samples per mode |
|---|---:|---:|---:|
| First use of a query, median | 618 ms | 469 ms | 15 |
| Initial reader opening, median | 923 ms | 437 ms | 4 matched pairs |
| Repeated cached search, median | 385 ms | 375 ms | 15 |
| Reader reopened after cycling chapters, median | 700 ms | 685 ms | 5 |
| Final page memory including worker | 42.4 MB | 50.6 MB | 5 readers retained |
| Browser disk usage estimate | 0.008 MB | 268.7 MB | Separate origins |

The initial-reader comparison is about 53% faster in this small sample. The uncached-query median is about 24% faster. The roughly 10–15 ms differences for warm searches and reopened readers are too small to establish a meaningful benefit in this experiment.

The first uncached `water supply` search took 2,017 ms online and 273 ms locally. That example illustrates avoiding a network spike; it is not the typical speedup or a guaranteed ceiling.

## Method

- Existing app source: production baseline `2e7c6354760f4e476f7e2901d85d36ec56df8b86`, asset `20261023-column-search-v1290`. All implementation changes are isolated under `experiments/local-library/`.
- Chrome desktop, the same reader/Search UI, synthetic accounts and projects, no production private data. Both sides use the same synthetic fixture backend and identical opened source targets. Separate origins prevent the baseline from possessing the downloaded library.
- Online public requests pass through the loopback proxy to `https://permitext.com`. The local mode uses a dedicated worker, IndexedDB and cached revisioned figures. Production and local corpus/asset revisions were checked equal before installation and again by HTTP validation.
- The proxy and its response cache policy are part of the test setup. This is a desktop prototype comparison, not a direct production field benchmark or a mobile performance guarantee.
- Five readers retained on each side. Thirty-five UI searches and ten reader opens per side; five temporary additional readers were closed per side. The query cohort includes five initial queries, ten additional new queries, fifteen repetitions, and five searches used during reader reopening.
- Search timing is input event to completed result DOM plus two animation frames, including the existing debounce. Reader timing is click to a hydrated requested target plus two frames. Hardware presentation is not measured. CUA orchestration time is recorded separately and excluded from the reported renderer timing.
- One initial local source-open attempt did not complete during startup and was retried. Its successful timing and the corresponding online first reader were excluded from the four paired initial-reader statistic. This remains a prototype startup limitation to investigate before rollout.
- Memory uses Chrome `performance.measureUserAgentSpecificMemory()`, including the document, iframe and worker. It excludes some native renderer/graphics/browser allocations and is not comparable to the earlier Chrome Task Manager tab footprint. The older `performance.memory` values are retained only as diagnostic data because they can include other same-site documents.
- Disk uses `navigator.storage.estimate()`, not filesystem allocation or network transfer size. Decimal MB are used throughout.

## Memory and storage

With five readers open, the sequence of complete page-memory samples was:

| Stage | Online | Downloaded |
|---|---:|---:|
| Initial five readers | 42.9 MB | 54.9 MB |
| After fifteen repeated searches | 41.6 MB | 50.3 MB |
| After ten more new queries | 42.1 MB | 51.2 MB |
| After additional reader opens/closes | 44.7 MB | 52.9 MB |
| Final settled sample | 42.4 MB | 50.6 MB |

This bounded run did not show persistent growth across repeated use. The final added memory was about 8.2 MB; downloading did not reduce memory usage. Installation/index-build peak process memory was not captured, so this is not a peak-memory acceptance claim.

The installed library has 578 chapters, 32,552 catalog sections, 893 referenced figures, and 87,948 indexed terms. Figures account for about 169.5 MB of browser cache accounting; IndexedDB about 99.2 MB. The posting arrays contain 9.2 MB of logical binary data, with about 50.1 MB of serialized canonical search documents before storage compression.

The initial body/figure download phase took 18.8 seconds from localhost. Rebuilding the exact production index took 7.9 seconds. These are separate local preparation measurements, not a measured internet install time or a single fresh-install benchmark of the final implementation.

The earlier 1 GB installed / 2–3 GB update allowance was conservative. The measured current Chrome footprint is much lower. A release should still check available space, account for an old and replacement library coexisting, and measure update and browser overhead before promising a maximum. Do not treat 269 MB as a portable worst-case bound.

## Correctness and checks

The complete paginated result IDs and order matched production for all six comparison queries:

| Query | Results in each mode |
|---|---:|
| dead end corridor | 43 |
| water supply | 642 |
| occupant load | 415 |
| fire resistance | 1,183 |
| egress | 1,049 |
| 101.4.3 | 3 |

That is 3,335 compared result positions, with no missing/extra IDs or ordering differences. All five opened reader section IDs and highlighted text targets matched as well. This does not establish correctness for every possible query.

Passed prototype core tests for word/phrase matching, identifiers, source/edition filters, empty/malformed scope, grouping and posting intersections. Reader-protocol tests cover current/default/historical chapter isolation, corpus mismatch, and refusal of an incomplete index. A final live 2014 Plumbing Code reader opened section 41006620 in chapter 40000062; every nonempty chapter option belonged to the historical range. That extra validation reader was closed, retaining the original five comparison readers.

Passed live HTTP checks for matching corpus/assets, public-GET-only boundaries, isolated fixture controls, iframe entry, separate baseline origin, and preservation of the normal 8788 response/security behavior. Both final tabs reported no console errors.

No push or deployment was performed. Local 8788 stayed running. The optional prototype is available at `http://127.0.0.1:8793/prototype` while its experiment server runs; the clean online baseline is on port 8795.

## Recommendation

The result supports an optional download for predictable new passage/search access and offline reading. It does not support presenting the feature as a memory reduction or a major improvement for already cached actions. Before production integration, resolve the startup cancellation, package and verify the shared index, add atomic update/quota/recovery behavior, and validate installation peaks and Safari/phone behavior.
