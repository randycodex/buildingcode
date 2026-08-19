# Native Reader Phase 4 Media Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 4 adds native image and figure rendering to the validated Debug reader pilot. The authored HTML and bundled assets remain authoritative. HTML remains the default presentation, the Native/HTML selector remains Debug-only, and Release builds do not expose or select the native pilot.

A native chapter is opened only after the generated document, source HTML, and every media record pass runtime validation. A missing, unreadable, hash-mismatched, or undecodable asset causes whole-chapter fallback to the authoritative HTML reader; partial native content is never accepted.

## Parser and corpus accounting

The Phase 2 generator previously inventoried nested `<img>` elements correctly but did not always emit them as renderable native blocks. Phase 4 now inserts any structurally inventoried media that is absent from the block stream at its deterministic source order. Structural validation additionally requires the rendered media sequence to match the source media sequence exactly.

The regenerated corpus contains:

- 463 authored chapters and 885 image records across 78 chapters.
- 885 `<img>` elements: 579 JPG sources, 286 PNG sources, 19 data sources, and one source without an extension.
- No authored SVG element or SVG asset record in the current checked-in corpus. SVG support is therefore not claimed from synthetic evidence; a future SVG source remains ineligible until it is inventoried, resolved, decoded, and reviewed.
- 239 native chapters, 211 full-HTML fallback chapters, and 13 invalid-content chapters.
- Six structurally native media chapters containing 27 image records. One is the package-level duplicate of Building Code Chapter 30; the five routable Debug pilots contain 26 unique rendered image records.
- 39 unresolved asset records across eight duplicate package-level chapters. All eight are classified `invalidContent`, so none can enter the native reader.

The corpus SHA-256 remains `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`; the authoritative HTML did not change.

## Reader implementation

- Runtime media validation resolves paths below the corpus root, verifies uniqueness, asset existence, SHA-256, ImageIO decodability, and positive pixel dimensions before returning a native document.
- Images load lazily when their native block appears. File reads and ImageIO downsampling run in detached utility tasks rather than on the main thread.
- Placeholders preserve the authored aspect ratio. Decode failures expose a visible diagnostic and Retry action; in a native chapter they also request whole-chapter HTML fallback.
- Captions and authored accessibility text flow from the generated media record into the inline image and full-screen viewer.
- Tapping an image opens the existing zoomable full-screen viewer. The full-screen asset is also read and downsampled off the main thread, with a 4,096-pixel bound.
- The existing image cache is reused with display-size buckets rather than introducing a second media cache.

## Debug pilot documents

| Chapter | Media | Coverage | Result |
| --- | ---: | --- | --- |
| 2022 Building Code, Chapter 30 | 1 | Raster symbol and caption | Runtime validation and native render pass |
| 2022 Building Code, Appendix M | 2 | Diagrams | Runtime validation and native render pass |
| 2022 Building Code, Appendix R | 5 | Diagrams | Runtime validation and native render pass |
| 2022 Building Code, Appendix S | 15 | Mixed portrait/landscape figures and captions | Runtime validation and native render pass |
| 2026 Administrative Code, Fire Code Chapter 5 | 3 | PNG figures with authored accessibility text | Runtime validation and native render pass |

The two Phase 3 text-only pilots remain enabled, for seven total Debug pilot routes.

## Verification

Completed on one iPhone 17 Pro simulator running iOS 26.5:

- Native inventory/parser package: 6 tests passed.
- Deterministic full-corpus regeneration check: passed for all 463 authored chapters.
- Phase 3/4 native Reader contracts: 10 passed. These load all seven pilot documents, resolve and decode all 26 routable native image records, verify accessibility text, force a missing-asset whole-chapter fallback, and downsample the corpus's 2.8 MB Zoning map to a 512-pixel bound.
- Complete iOS test target: 77 passed.
- Debug simulator build: passed.
- Release simulator build: passed; binary inspection confirms the Debug-only `Native (Comparison)` route is absent.
- Building Code Chapter 30 was opened through Search, compared in authoritative HTML and native modes, scrolled to Figure 3007.6.5, and opened in the full-screen viewer. The native result preserves the figure's aspect ratio and caption.

Completed on a physical iPhone 17 Pro running iOS 27.0:

- A separately identified Debug app (`com.randycodex.permitext.phase4`) built and installed without replacing the existing Permitext app or its data.
- Phase 3/4 native Reader contracts: 10 passed with parallel testing disabled, completing in 0.830 seconds.
- Building Code Chapter 30 was opened through Search in the isolated app, switched from HTML to native at Section 3007.6.5, and reviewed on the device. The native figure, aspect ratio, caption, scrolling, tap target, and full-screen viewer pass.

Visual baselines:

- [2022 Building Code Chapter 30 - HTML](phase-4/screenshots/html-building-code-chapter-30.png)
- [2022 Building Code Chapter 30 - native](phase-4/screenshots/native-building-code-chapter-30.png)
- [2022 Building Code Chapter 30 - native full screen](phase-4/screenshots/native-building-code-chapter-30-full-screen.png)

## Exit-gate status

The Phase 4 structural gate passes: every current media record is resolved and decodable or its chapter is explicitly prevented from entering the native reader. The simulator and physical-device render, caption, lazy-load, and full-screen checks pass for the representative Chapter 30 figure, and all routable native pilot assets pass on both simulator and physical hardware.

The current corpus contains no SVG media, so there is no source-authored SVG case to approve. SVG remains an explicit future fallback boundary rather than an unsupported format that can silently disappear.

## Phase boundary

Phase 5 has not started. Native documents containing tables remain ineligible for the native route, and table chapters continue to use the authoritative HTML reader. Phase 5 will classify table capability and retain isolated HTML table fallback wherever exact native equivalence has not been proven.
