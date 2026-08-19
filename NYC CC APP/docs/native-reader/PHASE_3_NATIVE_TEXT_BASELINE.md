# Native Reader Phase 3 Text Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 3 adds a native text-reader pilot for two structurally validated, text-only chapters:

- `2022-construction-codes/code-sections/building-code/chapters/1.html`
- `2026-existing-building-code/chapters/1.html`

The route and HTML/native comparison selector are compiled only in Debug builds. HTML remains the default in Debug, all other chapters remain on HTML, and Release builds do not expose or select the native pilot.

The authored HTML and bundled assets remain authoritative. A native document is opened only after its index entry, eligibility, structural validation, compressed and uncompressed byte counts and hashes, document identity, source hash, and text-only block set have all been validated at runtime. Any failure returns the user to the HTML reader with an explicit debug alert.

## Reader implementation

- Native blocks render through `LazyVStack` rather than constructing the complete chapter view hierarchy eagerly.
- Paragraphs, headings, captions, footnotes, notes, and list items use the existing TextKit-backed `AttributedTextView`, preserving text selection and standard edit-menu behavior.
- Inline bold, italic, underline, strikethrough, superscript, subscript, code, small-text, and link metadata are converted to attributed text.
- Internal links resolve through stable native anchor-to-block mappings; external links retain their URL actions.
- Heading presentation recovers chapter, section, provision, and nested-subsection hierarchy from the generated document. Provision indentation propagates to the content that follows it.
- The Reader theme now obtains SF Pro through `UIFont.systemFont`, avoiding the unsupported `.SFUIText-Regular` name that resolved to Times New Roman on the current simulator runtime.
- The visible native block and nearest stable anchor are persisted per chapter and per browser context. Reader 1 and Reader 2 therefore restore independently.
- Authored paragraphs that contain multiple line-break-delimited numbered provisions are divided into cached display blocks with deterministic derived IDs. This preserves the source document while allowing restoration to the exact visible Existing Building Code provision.
- Initial restoration waits for the lazy native stack to complete physical-device layout before issuing two bounded scroll requests; normal scrolling does not rebuild the display-block list.
- Existing HTML section and scroll restoration remain unchanged.

## Pilot documents

| Chapter | Native blocks | Content class | Result |
| --- | ---: | --- | --- |
| 2022 Building Code, Chapter 1 | 306 | Text only | Runtime validation and native render pass |
| 2026 Existing Building Code, Chapter 1 | 42 | Text only | Runtime validation and native render pass |

## Verification

Completed on an iPhone 17 Pro simulator running iOS 26.5:

- Phase 3 contract tests: 7 passed after the physical-device fixes.
- Complete iOS test target: passed.
- Debug simulator build: passed.
- Release simulator build: passed; Debug-only route is absent.
- Native inventory/parser tests: 6 passed.
- Deterministic full-corpus check: passed for all 463 authored chapters with corpus SHA-256 `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`.
- Both pilot chapters were opened in HTML and native modes and reviewed at runtime for hierarchy, indentation, type, inline emphasis, links, scrolling, and stable-position restoration.

Completed on a physical iPhone 17 Pro running iOS 27.0:

- A separately identified Debug app (`com.randycodex.permitext.phase3`) built, installed, and launched without replacing the existing Permitext app or its data.
- Phase 3 contract tests: 7 passed on device with parallel testing disabled, completing in 0.111 seconds in the final run.
- The device run exposed a test-only portability issue: the pilot tests located corpus resources through the Mac source path. They now resolve the host app's bundled resources, and the corrected suite passes on both simulator and physical hardware.
- Hands-on scrolling and leave/reopen restoration pass for both pilot chapters. The 2022 Building Code restored to `101.4.3 Mechanical`; the 2026 Existing Building Code persisted a derived subsection block and restored to `101.4 Applicability` instead of the start of its large authored paragraph.
- Final Debug and Release simulator builds pass. The Native/HTML comparison route remains absent from Release.

Visual baselines:

- [2022 Building Code Chapter 1 — HTML](phase-3/screenshots/html-building-code-chapter-1.png)
- [2022 Building Code Chapter 1 — native](phase-3/screenshots/native-building-code-chapter-1.png)
- [2026 Existing Building Code Chapter 1 — HTML](phase-3/screenshots/html-existing-building-code-chapter-1.png)
- [2026 Existing Building Code Chapter 1 — native](phase-3/screenshots/native-existing-building-code-chapter-1.png)

## Exit-gate status

The structural and simulator visual portions of the Phase 3 exit gate pass for both pilot chapters. The native reader remains responsive while loading, restoring, and scrolling the 306-block Building Code pilot; its validated document load completed in 0.054 seconds during the final full-suite run.

Physical build, installation, launch, contract validation, smooth scrolling, and stable restoration pass on the connected iPhone 17 Pro. The oldest-supported-physical-iPhone portion of the exit gate remains pending because this device is a current iPhone 17 Pro rather than the oldest supported model. Phase 3 should not be considered fully device-signed-off until both pilot chapters receive the same smoothness and restoration check on that older hardware.

## Phase boundary

Phase 4 has not started. Images, figures, tables, and any chapter outside the two exact Debug pilot routes continue to use the authoritative HTML reader and its existing asset/fallback paths.
