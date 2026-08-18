# Native iOS Reader Phase 0–1 Baseline

Date: 2026-08-18

Branch: `codex/native-ios-reader-migration`

Migration base: `aabdcbc6a` (`Add native iOS reader migration plan`)

## Scope and release safety

This evidence covers only Phase 0 and Phase 1 of `NATIVE_IOS_READER_MIGRATION_PLAN.md`.

- Authored chapters still use the existing full HTML reader by default.
- The Native/HTML selector is compiled only under `#if DEBUG` and starts on `HTML (Default)` for every reader presentation.
- The generated eligibility manifest is not connected to app routing in this phase.
- No native chapter cutover, renderer expansion, bookmark redesign, push, deployment, or TestFlight action is included.

## Corpus baseline

The reproducible inventory generated from `permitext/Resources/CodeContent/authored/new-york-city` found:

| Metric | Result |
| --- | ---: |
| Authored, non-prepared chapter HTML files | 463 |
| Code packages | 5 |
| Code-family paths | 10 |
| Chapters containing tables | 151 |
| Tables | 1,677 |
| Chapters containing images or SVG | 78 |
| Images and SVG | 885 |
| Stable anchors | 94,611 |
| DOM parser failures | 0 |

The chapter, table-chapter, and image-chapter counts reproduce the planning baseline. The detailed source hashes, anchors, headings, blocks, lists, tables, media, links, vocabularies, CSS properties, and fallback reasons are in `corpus-inventory.json`. The compact chapter routing result is in `eligibility-manifest.json`.

Initial conservative classifications:

| Eligibility | Chapters | Meaning in Phase 1 |
| --- | ---: | --- |
| `native` | 233 | Inventory found no unreviewed construct, but the chapter is not routed natively yet. |
| `nativeWithTableFallback` | 0 | Every table-bearing candidate also has a stricter reason to remain on full HTML in this first classifier. |
| `fullHTMLFallback` | 217 | Unreviewed elements, classes, or inline CSS require the authoritative HTML reader. |
| `invalidContent` | 13 | Five chapters contain duplicate anchors and eight contain unresolved or empty media references. |

All 1,677 inventoried tables are initially classified for isolated HTML rendering because each contains at least one fidelity-sensitive feature such as merged cells, multi-row headers, width, or custom borders. This is intentionally conservative; later phases may promote proven table variants without changing the authoritative source.

## Golden chapter set

The inventory generates the golden set deterministically. It covers all ten code-family paths plus the largest chapter, longest text-only chapter, deepest list structure, complex tables, image-heavy content, and appendix naming. The exact files and selection reasons are stored in `corpus-inventory.json` under `goldenChapterSet`.

## Simulator baseline

Environment:

- iPhone 17 Pro simulator
- iOS 26.5
- Existing Debug app artifact built 2026-08-17 at 22:46:40 EDT
- App bundle version 1.0 (8)
- Xcode 26.6 / iOS Simulator SDK 26.5
- Dark appearance

The existing artifact is the pre-migration HTML baseline. The new selector was not present in that artifact; it was used to record the unchanged default reader while the current Xcode GUI process was unresponsive to new command-line builds.

### Measured timings

Instrumentation came from the existing `permitext diagnostics: chapterReader` events printed by `ChapterHTMLWebView`.

| Flow | Prepared HTML | First text | Finished |
| --- | ---: | ---: | ---: |
| Chapter 16 cold reader load | 159 ms | 920 ms | 1,206 ms |
| Chapter 16 warm reader load | 0 ms | 681 ms | 926 ms |
| Chapter 1 warm reader load | 13 ms | 689 ms | 727 ms |

The simulator process-launch handoff reported 0.49 seconds. This is not treated as app-ready time.

### Memory observation

Host-observed simulator process RSS after loading and scrolling Chapter 16 was 760,928 KB. Five seconds after leaving the chapter it was 760,832 KB. This is a Debug-simulator observation, not a physical-device memory measurement, but it establishes a regression baseline and shows that memory did not return near its prior level within that short interval.

### Interaction observations

- Vertical scrolling reached Chapter 16 figures and their adjacent table without visible chapter-wide horizontal displacement.
- Chapter search for `occupancy` produced results; selecting `102.6 Existing structures.` returned to the reader and updated the current-section bar.
- Reader 1 and Reader 2 retained independent navigation state: Reader 2 showed its separate chapter browser, and returning to Reader 1 restored Chapter 1 at section 102.6.
- The Reader-to-Projects transition completed without a visible hang in this short run.
- Mouse double-click automation did not produce reliable iOS selection handles. Native selection/menu behavior remains a required manual and physical-device baseline check.
- Mouse drag automation cannot prove the existing touch-only paragraph bookmark gesture. The recorded attempt did not produce a saved item, so bookmark latency/state is not claimed as verified.

### Captured artifacts

Screenshots:

- `baseline/screenshots/html-building-code-chapter-1.png`
- `baseline/screenshots/html-building-code-chapter-search.png`
- `baseline/screenshots/html-building-code-chapter-16-figure-table.png`

Interaction recordings:

- `baseline/recordings/html-reader-scroll-search.mov`
- `baseline/recordings/html-reader-selection-bookmark.mov`

The second recording intentionally preserves the inconclusive mouse-based selection/bookmark attempt; it is evidence of the test boundary, not a passing result.

## Reproduction and regression gates

From the repository root:

```sh
swift test --package-path 'NYC CC APP/Tools/native-reader-inventory'
swift run --package-path 'NYC CC APP/Tools/native-reader-inventory' native-reader-inventory --check
```

The `--check` command regenerates both committed JSON artifacts and fails if any chapter source, DOM inventory, vocabulary, structural feature, asset resolution, eligibility state, or parser rule changes.

## Remaining Phase 0 device evidence

Before controlled rollout, repeat the golden-set comparison on the oldest supported physical iPhone and through TestFlight. Capture native iOS text selection/Research, the current touch bookmark gesture, cold and warm chapter loads, memory recovery, VoiceOver, Dynamic Type, Reduce Motion, light appearance, dark appearance, background/foreground transitions, and at least 100 rapid bookmark/Reader/Projects cycles. Those are later acceptance gates and are not represented as complete by this simulator baseline.
