# Native Reader Phase 9 Fidelity and Regression Baseline

Date: 2026-08-19

## Outcome

Phase 9 passes its automated fidelity and visual-review exit gate. The generated native documents now prove normalized enacted-text, anchor, link, table-matrix/span, caption, footnote, and media parity against the authoritative authored HTML. The full iOS regression suite passes, and a five-collection visual matrix has been reviewed across light/dark appearance, four effective widths, portrait/landscape, and standard/accessibility text sizes.

This phase does not change the production reader default. The Native/HTML comparison route and the snapshot harness remain Debug-only. Authoritative HTML remains the default and fallback until the controlled rollout in Phase 10 and the later default-cutover decision in Phase 11.

## Deterministic fidelity gates

- Corpus inventory schema is version 3.
- Native parser schema is `native-reader-document-v2`.
- Every table inventory records a deterministic SHA-256 digest of its exact cell coordinates, row/column spans, header state, normalized cell text, anchor IDs, link targets, caption, and footnotes.
- Generated native documents must reproduce the authoritative table digest before they can be marked validated.
- Both DOM-recovery paths feed `xmllint` an explicit UTF-8 byte-order marker on standard input. This fixes legacy-encoding interpretation for HTML fragments without a charset declaration.
- Automated full-corpus coverage rejects common UTF-8 corruption markers and verifies that every referenced image can be decoded by `UIImage`.
- No chapter containing an unsupported block can silently enter the native route.
- Invalid and unsupported content continues to route to the authoritative HTML reader.

The deterministic corpus check passed with:

- 463 authored chapters.
- 1,677 tables in 151 chapters.
- 885 images/SVG assets in 78 chapters.
- Eligibility: 208 `fullHTMLFallback`, 13 `invalidContent`, 239 `native`, and 3 `nativeWithTableFallback`.
- Corpus SHA-256: `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`.
- 463 compressed native documents totaling 32,662,558 bytes.

## Regression coverage

The iOS contract suite covers:

- Normalized enacted-text, anchors, links, table structures, media inventory, and unsupported-block parity for every native-eligible chapter.
- Representative validated chapters from all five top-level code collections plus an unsupported Zoning chapter that must fall back.
- Search matching and active highlighting.
- Stable block, anchor, section, and remembered-location resolution.
- Reader 1 and Reader 2 independent native locations.
- Immediate bookmark save/remove presentation and Project evidence reconstruction from immutable state.
- Bounded complex-table fallback and whole-chapter fallback after native integrity or media failure.
- Bounded prepared-document caches and memory-warning purging.
- A hash-locked visual manifest that requires the complete Phase 9 trait and collection matrix.

## Visual review matrix

The committed reference images and SHA-256 digests are recorded in `phase-9/visual-snapshot-manifest.json`.

| Collection | Appearance | Effective width | Orientation | Content size | Reviewed behavior |
| --- | --- | ---: | --- | --- | --- |
| 2022 Construction Codes | Light | 320 | Portrait | Large | Narrow wrapping, hierarchy, indentation, and emphasis remain readable without clipping. |
| 2025 Specialty Codes | Dark | 375 | Portrait | Large | Dark contrast is clear and authored curly quotes render without mojibake. |
| 2026 Enacted Administrative Code | Light | 402 | Portrait | Accessibility XXXL | Large text preserves section hierarchy, annotations, and wrapping. |
| 2026 Existing Building Code | Dark | 720 | Landscape | Large | Wide layout preserves hierarchy, enacted-status callout, and readable line lengths. |
| 2026 Zoning Resolution | Light | 402 | Portrait | Large | The isolated table preserves borders, exact cell text, links, and horizontal overflow. |

The first automated capture of two light-mode views landed on an empty launch frame. Manual review rejected those files, they were recaptured after explicit harness readiness, and the final non-empty files are the ones locked by the manifest test.

Visual review also exposed legacy-encoding mojibake in the first 2025 Specialty snapshot. The parser was corrected, the complete corpus was regenerated, the parser schema was advanced, the full parity gate was rerun, and the corrected screenshot was reviewed before acceptance.

## Verification evidence

Completed locally on one retained iPhone 17 Pro simulator running iOS 26.5:

- Native inventory package: 10 tests passed.
- Deterministic full-corpus regeneration check: passed.
- Phase 9 visual-manifest contract: passed.
- Complete iOS unit/contract target: 91 passed, zero failures, zero skips.
- Fresh unsigned Release device build: passed.
- App inventory after testing: exactly one user app, `com.randycodex.permitext`.

Completed on the connected physical iPhone 17 Pro running iOS 27.0:

- Exhaustive eligible-document semantic and asset parity: passed.
- Five-collection representative native routing plus invalid-content fallback: passed.
- Stable section navigation: passed.
- Prepared-document cache count and memory bounds: passed.
- Focused physical-device result: 4 passed, zero failures, zero skips.
- App inventory after testing: exactly one `com.randycodex.permitext` installation.

Tests were run with parallel simulator workers disabled. No second permanent simulator was created; any Xcode test-runner clone is temporary and is removed by Xcode after the run.

## Phase 9 exit gate

The entire automated suite passes and all committed visual differences have been reviewed. Phase 9 is ready to commit and publish on the migration branch. Phase 10 is the next implementation phase; it is a controlled feature-flag rollout and includes TestFlight evidence, which requires separate user authorization before any TestFlight/App Store action.
