# Definition decoration work — September 28

## Evidence and scope

In the confirmed41.30 chapter capture,599 main-thread samples contain `ReaderDefinitionMatcher.decorating`;544 also contain Foundation regular-expression matching. These inclusive samples identify remaining work after chapter metadata preparation; they are not exact operation durations.

This bounded change compiles the two fixed suppression patterns once, prefilters immutable occurrence-rule dictionaries, avoids scanning every definition to find applicable occurrence rules on each block, and creates mutable attributed output only when adding an eligible definition link. The main term-matching expression and alternative order are unchanged. Existing links, italics, UTF16 ranges, occurrence exclusions and duplicate-ID first-rule behavior are preserved. No output cache or source/theme/typography changes were introduced.

## Validation and limits

The host contract compiles the actual production matcher and a checked-in copy of its pre-change implementation (`ac78d8287`). Foundation attributed strings are real; UIKit font/color names are mapped to AppKit equivalents. It checks exact attributed-output equality, not merely text or match counts. Synthetic cases cover partial/existing links, absent/mixed/italic fonts, Unicode and case folding, boundaries, definition suppression, aliases, duplicate IDs and occurrence rules. Every bundled registry entry and alias is exercised.

Real Building2022 Chapter16/33 HTML is split at block boundaries:2,520 and3,834 text blocks. Both implementations receive the same homogeneous italic font and chapter-level selection. These are host text-block fixtures, not actual native attributed layout, per-section routing, visible frames or phone timing. One warmup and five alternating baseline/candidate passes limit simple order bias; they do not establish release percentiles.

A separate contiguous-prefix factoring prototype preserved whole-chapter match ranges but enlarged the pattern and improved host regex time only about2–3%. It was not adopted. The dominant term search remains; do not call this a complete fix for chapter hitches.

Repeatable command: `npm run test:native-reader-definition-decoration` from `permitext-sync-server`. Final build/timing details are recorded below. Build41.30 remains the installed and physically verified version until a separate installation check.

## Final host result

12,453 exact attributed-output comparisons pass. Final five-pass host medians: Chapter16 baseline434.198ms versus candidate408.959ms; Chapter33 baseline1352.753ms versus1284.967ms. An earlier pass yielded only about2% improvement for Chapter33, so treat the benefit as modest and variable. Raw samples and methodology: `PERF_18_DEFINITION_DECORATION_HOST_2026-09-28.json`. Existing13 identity, exact-scope and occurrence contracts also pass. No physical speedup claim.

Generic iOS Release41.32 compilation and strict signature verification pass. Source and executable hashes: `PERF_18_RELEASE_41_32_BUILD.json`. Shared build-output path now contains41.32;41.31 provenance is historical.41.32 is not installed.
