# PERF-10 — Lightweight web Reader search

## Implementation

Search in Reader uses `GET /code/chapters/:id?bodyContract=2&readerSearch=...`. It returns chapter/edition/corpus identity, total and all matching section records with headings, bounded-context snippets, highlight text and paragraph IDs. It does not hydrate or transmit rich bodies, including if a caller also passes `include=body`. Opening a result uses the existing PERF-09 small body-window path.

Build-time projections cover all 578 navigation chapters and 32,551 ordered sections in the current and 2014 catalogs, spanning six source editions. The generator reads validated windows of at most 50 bodies, projects the actual legacy browser search inputs, and writes atomic compressed chapter files. Projection functions are extracted from production source and exercised through a fail-closed parse5 DOM adapter. HTML formatting, nested-list/table concatenation, authored plain text and paragraph-ID rules are preserved. The source/metadata revision and hash of projection helpers, structured-link code, adapter and generator input mapping guard freshness.

The matcher is shared with the browser offline fallback. Existing behavior is **exact-first with typo-tolerant fallback**, not exact-only: typo thresholds, definition ranking, headings and snippets remain unchanged. The old block-ranking implementation is frozen only in a test fixture, not shipped as dead application code.

Runtime indexes use an 8-entry / 16 MiB estimated parsed-data LRU with shared concurrent loads and failed-load eviction. Compressed artifacts add approximately 10 MB to server packaging instead of 43.5 MB of raw JSON; they are decompressed asynchronously only when needed. Deployment verification requires the exact chapter set, current corpus/projection revisions and ordered section IDs. File tracing includes all 578 gzip indexes.

Each new query aborts the previous fetch immediately. Closing Find, navigation and account-runtime clearing also cancel pending work and debounce timers. Closing or clearing Find restores the captured Reader anchor after its body window mounts. Search result revisions are carried into opening: mismatched cached chapters are evicted/refetched, and a still-different revision refuses to display incompatible text.

Offline fallback searches only the atomically installed **complete** chapter of the requested edition. It checks complete range/count and every body array; it never substitutes visible Reader rows or partial window caches. Offline fallback retains the old browser matching path and is not claimed as newly optimized.

## Evidence

Chapter 33 has 1,029 sections. Searching `concrete` retains 54 results:

| Payload | Before | After |
|---|---:|---:|
| Decoded response | 2,212,129 bytes | 24,984 bytes |
| Estimated gzip | 246,046 bytes | 5,458 bytes |

Decoded response reduction: 98.87%. Gzip values are computed estimates, not CDN measurements. HTTP timings in the evidence file are single sequential localhost samples with different cache states; they are not a defensible production speedup ratio.

One local Chrome sample inserted all 54 results 230.9 ms after input, including debounce; the indexed request took 41.7 ms. Result opening fetched a compact five-body window, followed by ordinary nearby progressive hydration. Closing Find restored the same block within 0.375 px. No-results, network failure and retry were exercised in the rendered guest workspace; screenshots were inspected and no browser errors reported.

Chrome DOM projection parity also passed for 23 representative chapters / 3,092 sections, including all 1,029 Chapter 33 sections and all six source families.

Sanitized evidence: `PERF_10_CHAPTER_SEARCH_EVIDENCE_2026-09-23.json`.

## Reproduction and validation

From `permitext-sync-server`:

1. `npm run generate:reader-search` regenerates all compressed indexes. Use `-- --chapter 33 --output /tmp/reader-index-check` for an isolated subset.
2. `npm run verify:deploy-content` includes catalog/corpus/projection freshness verification. It starts an isolated temporary server with database connection variables removed and never uses the developer sync database.
3. `npm run test:reader-search-index` checks projection, generator failure cases, runtime cache/loading, matching parity, complete offline fallback, cancellation, retry and position restoration.
4. `npm run test:reader-search-http` exercises all 22 prefix/edition combinations, all six source families, and complete Chapter 33 across exact/phrase/typo/title/no-result/empty queries. Set `PERMITEXT_READER_SEARCH_HTTP_EVIDENCE` to write its sanitized evidence JSON.
5. Reader navigation/scroll continuity, offline contracts and the full server smoke suite are additional integration checks.

## Limits and follow-up

This is local source, local HTTP and isolated rendered-browser evidence. No main merge, push, production deployment, TestFlight/App Store release or new phone build is included. Phone remains the previously installed signed development Release 41.13. Real production/CDN/constrained-network timing and a signed-in installed-offline browser acceptance run remain open.

Preserved pre-existing specialty-code behavior: legacy Find receives section metadata without an inherited chapter prefix, while rich Reader display enriches that prefix and can split ECC/EC provisions. Changing that during indexing loses cross-provision phrase matches, so this task deliberately retains legacy Find boundaries and IDs. A precise-target enhancement for those synthetic specialty paragraphs needs a separate mapping contract and rendered acceptance; this change does not claim to fix it.
