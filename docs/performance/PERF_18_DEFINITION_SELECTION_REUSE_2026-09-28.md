# Native chapter definition selection reuse — September 28

## Why this change

The owner-confirmed build41.30 Chapter16/33 capture sampled `ReaderDefinitionRegistry.entries`319 times on main, including28 samples overlapping animation hitches. `readerBlocks` calls `hasSectionScopes` during view construction; that previously reselected and deduplicated the chapter registry every time. See `PERF_18_RELEASE_41_30_CHAPTER_FRAMES.json`. Inclusive samples are diagnostic evidence, not exact operation durations.

## Implementation and invariants

`ReaderDefinitionStore` now retains up to12 least-recently-used chapter selections and their section-scope flag. The exact bundle, codeSectionID, chapterNumber and optional chapterID form the key. Section number is deliberately absent only for this existing `includeSectionScoped: true` selection, which ignores section applicability. The immutable bundled registry lives for the store lifetime. Evicted selections are recomputed through the unchanged registry function.

Actual per-section matcher selection remains unchanged: section filtering still happens before deduplication, preserving order, exclusion rules and alternative meanings. No attributed-text decoration, definition URL, visible content, source choice or navigation behavior changes. Cache entries retain arrays of immutable registry values; entry count is bounded, but physical memory behavior is not measured here.

## Validation

- Host Swift contract compiles actual production context/models/store, substitutes only registry loading and the UIKit-dependent matcher, and compares4,060 real-registry contexts with direct registry selection. All books, chapter IDs, printed chapter variants and section variants preserve exact entries/order and scope flags.
- Instrumented host registry calls prove repeated section variants share the chapter selection without another registry scan. LRU promotion/eviction and a1,000-chapter journey retain the12-entry bound; nil registry stays empty. Matcher selection parity remains covered independently of this cache.
- Existing13 chapter identity, exact applicability and occurrence-exclusion tests pass. Existing native section metadata host parity passes440 fixtures.
- Two host runs of2,000 alternating Chapter16/33 scope reads measured uncached4,809.15/3,579.08ms and cached8.67/4.29ms including two misses. The stable assertion is exactly two registry selections; these varying host numbers are not a phone speedup. Validation log: `/tmp/permitext-definition-selection-validation.log`.
- `npm run test:native-reader-definition-selection` is the repeatable host command from `permitext-sync-server`. Host timing is an isolated scope-lookup microbenchmark, not phone scrolling performance.

## Acceptance boundary

Generic iOS Release41.31 compilation and strict signature verification pass. Exact provenance is in `PERF_18_RELEASE_41_31_BUILD.json`. This candidate is not installed. Build41.30 remains the last physically verified build. No claim of eliminated scrolling hitches, overall FPS or a controlled speedup. Remaining `ReaderDefinitionMatcher.decorating` and attributed-text/font work is unchanged and remains a possible next source-review target.
