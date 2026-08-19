# Native Reader Phase 5 Table Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 5 adds deterministic table capability classification, strict runtime validation, the retained simple SwiftUI table path, and bounded isolated-HTML table rendering inside the native Reader. The authored HTML remains authoritative. HTML remains the default presentation, the Native/HTML selector remains Debug-only, and Release builds do not route chapters into the native pilot.

No table or enacted text was manually recreated in Swift. The device-only APP-D launch harness used for visual review was removed before commit; the committed implementation contains no chapter-specific test route.

## Corpus accounting and capability boundary

The regenerated corpus contains:

- 463 authored chapters.
- 1,677 tables across 151 chapters.
- 885 image records across 78 chapters.
- 239 native chapters, 208 full-HTML fallback chapters, 13 invalid-content chapters, and three chapters eligible for native text with isolated table fallback.
- Zero current corpus tables classified as `nativeSimple`. Every authored table carries at least one capability that has not been proven equivalent in the simple SwiftUI renderer, so none is promoted merely to increase native coverage.

The table classifier records row, logical-column, cell, header, rowspan, colspan, caption, footnote, border, formatting, link, and embedded-content structure. A table is isolated when it uses merged cells, multiple header rows, more than six columns, custom borders, cell formatting, links, or embedded content. Unknown markup contained wholly inside an isolated table is scoped to that table; the same unknown markup elsewhere still forces whole-chapter HTML fallback.

Only isolated tables no larger than 250 rows or 2,500 cells may enter the bounded table fallback. Larger tables keep the entire chapter on HTML. For example, APP-C-21242 contains a 6,840-row, 23,093-cell table and remains `fullHTMLFallback` with the explicit reason `oversizedIsolatedHTMLTableCount: 1`.

The three newly eligible chapters are:

| Chapter | Table dimensions | Classification reasons | Route |
| --- | --- | --- | --- |
| APP-B-21239 | 92 x 6 and 23 x 6 | borders, formatting, links | Native text plus two isolated HTML tables |
| APP-D-21241 | 139 x 5 | merged cells, borders, formatting | Native text plus one isolated HTML table |
| APP-F-21424 | 120 x 4 | borders, formatting, embedded content | Native text plus one isolated HTML table |

The authoritative corpus SHA-256 remains `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`; source HTML did not change. The 463 generated native documents compress to 32,665,906 bytes.

## Reader implementation

- The existing simple SwiftUI grid is retained behind a strict native-simple contract: rectangular cells only, no spans, classes, inline style, borders, links, or styled runs, with at most six columns. Exact parser fixtures cover this path even though the current corpus qualifies no real table for it.
- Supported complex tables retain their recovered source `<table>` fragment and render in the existing bounded `TableWebView`; captions, header cells, merged cells, inline formatting, borders, links, and footers therefore remain source-derived.
- Runtime loading rejects duplicate table IDs, invalid dimensions, out-of-range or overlapping cells, unsupported native-simple metadata, missing isolated source HTML, and isolated tables above the row/cell cap.
- The isolated web document is measured to its full vertical height. Its SwiftUI container receives the chapter viewport width, while a table-only horizontal `ScrollView` receives a deterministic width derived from the classified column count. The outer chapter remains vertically scrollable and cannot be dragged horizontally by the table.
- APP-D-21241 is the eighth Debug pilot route. APP-B and APP-F are structurally eligible but are not added to the small interactive pilot set in this phase.

## Verification

Completed on one iPhone 17 Pro simulator running iOS 26.5:

- Native inventory/parser package: 8 tests passed.
- Deterministic full-corpus regeneration and `--check`: passed for all 463 authored chapters.
- Native Reader contracts: 11 passed, including exact APP-D eligibility, one isolated 139 x 5 table, and rejection of the oversized APP-C table.
- Complete iOS test target: 78 passed with no failures or skips.
- Debug simulator build: passed.
- Release simulator build: passed; binary inspection confirms the Debug-only `Native (Comparison)` selector is absent.
- APP-D-21241 was compared in authoritative HTML and Native modes. The isolated table preserves its header and row grid. Its accessibility group exposes table-confined `Scroll Right` and `Scroll Left` actions; scrolling reveals the Zoning Map, Block, and Lot columns without moving the chapter horizontally.

Completed on a physical iPhone 17 Pro running iOS 27.0:

- A separately identified Debug app (`com.randycodex.permitext.phase5`) installed without replacing the normal Permitext app or its data.
- Native Reader contracts: 11 passed with parallel testing disabled, completing in 0.717 seconds.
- APP-D-21241 rendered first in authoritative HTML and then in Native mode. The native text, table header, leading columns, row grid, and vertical chapter scrolling were reviewed on the device.
- The Phase 3, Phase 4, and Phase 5 test apps were removed after testing. Device inventory then showed only the normal `com.randycodex.permitext` app.

Visual baselines:

- [APP-D-21241 - HTML](phase-5/screenshots/html-app-d.png)
- [APP-D-21241 - native](phase-5/screenshots/native-app-d.png)
- [APP-D-21241 - native, later columns](phase-5/screenshots/native-app-d-horizontal.png)

## Exit-gate status

The Phase 5 gate passes. Every current table is classified. No real corpus table is promoted to native SwiftUI without exact capability evidence. Three bounded chapters can combine native text with source-derived isolated tables; oversized and otherwise unsupported cases keep whole-chapter HTML fallback. The representative APP-D table is structurally validated, visually compared, exercised horizontally inside its table viewport on the simulator, and rendered on physical hardware.

## Phase boundary

Phase 6 has not started. Current-section tracking, jump within chapter, in-chapter search, native cross-reference navigation, selection actions, bookmarking, and scroll restoration remain Phase 6 work. HTML remains the release/default Reader.
