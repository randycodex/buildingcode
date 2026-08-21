# Native Reader Migration Completion Audit

> Current coverage note (2026-08-21): the historical Phase 11 counts below have been superseded by the universal native-corpus checkpoint. All 463 indexed chapters now open through the native Reader, with complex tables isolated inside native chapters rather than forcing whole-chapter HTML fallback. See `UNIVERSAL_NATIVE_READER_COVERAGE.md` for current counts, safeguards, and verification boundaries. The physical-device and TestFlight acceptance gaps recorded here remain open.

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

Published Phase 11 head reviewed: `42a882e37`

## Verdict

The local implementation exists through the Phase 11 native-default cutover, but the migration is not fully complete under the original plan's strict acceptance definition. Code and generated-content coverage are substantially complete; several physical-device, performance, accessibility, and release-evidence gates remain partial, deferred, or missing.

This audit separates five evidence layers that must not be treated as interchangeable:

1. Local source, generated-artifact, and automated-test evidence.
2. Simulator interaction and visual evidence.
3. Physical-device interaction and performance evidence.
4. TestFlight evidence.
5. Merge, production, and App Store state.

No TestFlight upload, App Store Connect change, App Store submission, production deployment, or merge to `main` is claimed.

## Build 24 checkpoint — 2026-08-20

Build 24 improves native Reader link interaction and authored-link parsing, but it is not a complete link-navigation sign-off. The shared text tap conflict was removed, JSX-style authored links are normalized with fail-closed structural validation, and Title 28 article references resolve to their first provision when no article-level section exists. Simulator interaction opened the actual Article 103 and Article 105 links to `28-103.1` and `28-105.1`; the user subsequently reported that other links still do not open on the physical phone. That unresolved physical-device result remains an open migration defect and this checkpoint must not be described as universal link support.

Checkpoint verification includes 104 passing iOS unit/contract tests, 14 passing native-inventory package tests, a deterministic check of all 463 generated documents, and a clean signed Release 1.0 build 24 installed on the physical iPhone. Any later web Production deployment from this branch is a separate server/web baseline and does not validate or ship the native iOS migration.

## Phase reconciliation

| Phase | Status | Reconciled result |
|---|---|---|
| 0 | Implemented | Baselines, screenshots, measurements, fallback safety, and a Debug-only comparison control were created. The Release diagnostic leak introduced at the later cutover was corrected in the build 20 follow-up. |
| 1 | Implemented | Reproducible inventory and deterministic checks account for all 463 authored chapters, 1,677 tables, and 885 media records. |
| 2 | Implemented with an architectural equivalence note | Versioned compressed native documents and strict structural validation exist for all 463 chapters. The plan described code/chapter metadata on every block; the implementation keeps block/section/source identity on each block and normalized code/chapter metadata on the enclosing document. The required information is preserved without duplicating it per block. |
| 3 | Implementation complete; acceptance partial | Native text rendering, stable identities, selection foundations, restoration, and independent Reader state exist. Smoothness on the oldest supported physical iPhone is untested, and typography/spacing parity is deferred. |
| 4 | Implemented for the current corpus | Media validation, off-main decoding, lazy rendering, captions, accessibility text, retry, and full-screen viewing exist. The current corpus contains no authored SVG case; SVG remains an explicit future fallback boundary. |
| 5 | Structurally implemented; visual evidence limited | Every table is classified. Three chapters use bounded source-derived isolated HTML tables and unsupported cases use whole-chapter HTML fallback. APP-D was reviewed on simulator and physical hardware; APP-B and APP-F use the same path but lack direct interactive review. |
| 6 | Implemented; manual evidence partial | Search, jump, references, restoration, selection-menu wiring, Research routing, Dynamic Type, themes, and Reduce Motion behavior exist. Hands-on VoiceOver, physical native selection-to-Research, and physical cross-code navigation are not fully documented. |
| 7 | Implemented; final stress evidence open | One optimistic contextual bookmark control and nonblocking Project updates exist. Build 20 adds the plan-required short `Saved` / `Removed` confirmation. Only 10 simulator and 10 physical cycles were recorded; the 100-cycle physical criterion remains open. |
| 8 | Implementation complete; strict performance gate partial | Prebuilt loading, cancellation, bounded caches, signposts, lifecycle recovery, and memory-warning handling exist. No oldest-device head-to-head Instruments run, comparable end-to-end native-versus-HTML cold/warm measurement, or media-heavy post-exit memory-return evidence exists. |
| 9 | Implemented and locally verified | Exhaustive semantic/asset fidelity checks cover every eligible generated document, and the committed visual matrix represents every code collection across the required traits. |
| 10 | Local rollout implemented; formal gate deferred | Feature-flag tiers, simulator tests, physical-device checks, crash remediation, and Release builds were completed. The plan's required TestFlight evidence was explicitly deferred by the user. |
| 11 | Local routing implemented | Native is the local Debug and Release default for 242 validated chapters; 221 chapters and any runtime validation failure route automatically to authoritative HTML. This cutover occurred with unresolved acceptance criteria and therefore is not evidence that the full plan definition is complete. |

## Acceptance criteria

| # | Status | Evidence boundary and remaining work |
|---|---|---|
| 1 | Partial | Exhaustive normalized text and order parity passes for every native-eligible chapter. The visual matrix is representative, and native typography/spacing parity remains explicitly deferred. |
| 2 | Verified | Eligible media resolve and decode from existing assets; any unresolved or invalid asset prevents native routing. The current corpus has no authored SVG case. |
| 3 | Verified | All tables are classified and validated; exact supported structures render through a bounded source-derived table path, and every other table chapter falls back wholly to HTML. |
| 4 | Verified | Release routing is generated-index driven. No enacted chapter, table, image, or legal text was manually recreated in chapter-specific Swift. |
| 5 | Partial | Search, jump, references, selection, Research wiring, and restoration are implemented and contract-tested. Physical native selection-to-Research and cross-code interaction evidence is incomplete. |
| 6 | Verified | The chapter's outer reader is vertical-only; horizontal scrolling is confined to an isolated table viewport. |
| 7 | Verified | One contextual control toggles optimistically, updates its icon/state immediately, gives haptic feedback, and now shows a short `Saved` / `Removed` confirmation. |
| 8 | Verified | Project presentation updates optimistically before background persistence/reconstruction and no longer blocks ordinary Reader-to-Projects navigation. |
| 9 | Deferred | Ten cycles were recorded on the simulator and ten on the physical phone. The required 100-cycle physical stress run remains open. |
| 10 | Deferred | Available physical testing used an iPhone 17 Pro, not the oldest supported iPhone. |
| 11 | Partial | HTML baselines and native preparation/cache timings exist, but they are not equivalent end-to-end chapter-ready comparisons and no oldest-device head-to-head trace exists. |
| 12 | Missing | No measurement proves process memory returns near baseline after leaving a native media-heavy chapter. Memory-warning/cache-purge checks do not satisfy this criterion. |
| 13 | Verified | Semantic/asset comparison spans all five top-level code collections, with a hash-locked representative visual matrix. |
| 14 | Verified | Invalid, unsupported, unknown, schema-mismatched, or runtime-integrity-failing content routes to authoritative HTML. |
| 15 | Verified locally | Migration history changes only the iOS application and its iOS evidence/tooling. The web source path is unchanged; no production deployment was performed. |

Totals: **9 verified, 3 partial, 2 deferred, and 1 missing**.

## Build 20 audit remediation and verification

The audit follow-up corrected two local implementation defects without changing routing or the authoritative fallback boundary:

- The internal ladybug selector and technical native-fallback alert are now Debug-only. Release continues to route 242 validated chapters natively and switches automatically to authoritative HTML when routing or runtime validation fails.
- The shared bookmark control now provides the plan-required short, one-line `Saved` / `Removed` confirmation in addition to its immediate optimistic state and haptic feedback. It reports only a successful requested transition and anchors inward at accessibility text sizes.

Final local evidence:

- Focused diagnostic/bookmark contracts: 2 passed, zero failures.
- Complete iOS test target: 101 passed, zero failures, zero skips.
- Native inventory package: 10 passed, zero failures.
- Deterministic corpus check: passed for 463 chapters, 1,677 tables, and 885 media records; 242 native routes and 221 HTML fallbacks remain unchanged.
- Clean optimized arm64 simulator Release: passed, version 1.0 build 20, `isolated-table-fallback`, no XCTest bundle.
- Optimized Release binary inspection: no internal-selector or technical-fallback-alert strings were present.
- Live simulator Release: native chapter showed no internal selector; one-line bookmark save/remove feedback rendered and changed state immediately at standard and maximum accessibility text sizes.
- Clean signed arm64 device Release: passed strict deep signature verification, version 1.0 build 20, `isolated-table-fallback`, no XCTest bundle.
- Physical iPhone: build 20 installed in place and launched; device inventory showed exactly one `com.randycodex.permitext` installation.

## Remaining completion work

The strict plan cannot be marked complete until the following are either performed and accepted or explicitly removed from the plan by a separate product decision:

- Run 100 rapid bookmark/Reader/Projects cycles on a physical device.
- Verify scrolling and restoration on the oldest supported iPhone.
- Record comparable end-to-end native and HTML cold/warm chapter-ready measurements.
- Measure memory recovery after leaving a native media-heavy chapter.
- Complete hands-on VoiceOver plus physical selection-to-Research and cross-code navigation checks.
- Complete the deferred native typography/spacing parity pass.
- Review APP-B and APP-F isolated-table chapters directly as supplemental table evidence.
- Run the explicitly deferred TestFlight validation gate when separately authorized.
- Revisit the user-deferred direct first-frame restoration experience without reintroducing a visible jump.

## Accurate completion statement

Use this wording until the remaining gates change:

> Local implementation through the Phase 11 native-default cutover is complete on the migration branch. Original migration acceptance and release validation remain incomplete or explicitly deferred; authoritative HTML fallback remains active.
