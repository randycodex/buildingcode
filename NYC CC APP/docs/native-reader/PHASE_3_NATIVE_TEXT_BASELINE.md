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
- Existing HTML section and scroll restoration remain unchanged.

## Pilot documents

| Chapter | Native blocks | Content class | Result |
| --- | ---: | --- | --- |
| 2022 Building Code, Chapter 1 | 306 | Text only | Runtime validation and native render pass |
| 2026 Existing Building Code, Chapter 1 | 42 | Text only | Runtime validation and native render pass |

## Verification

Completed on an iPhone 17 Pro simulator running iOS 26.5:

- Phase 3 contract tests: 6 passed.
- Complete iOS test target: passed.
- Debug simulator build: passed.
- Release simulator build: passed; Debug-only route is absent.
- Native inventory/parser tests: 6 passed.
- Deterministic full-corpus check: passed for all 463 authored chapters with corpus SHA-256 `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`.
- Both pilot chapters were opened in HTML and native modes and reviewed at runtime for hierarchy, indentation, type, inline emphasis, links, scrolling, and stable-position restoration.

Visual baselines:

- [2022 Building Code Chapter 1 — HTML](phase-3/screenshots/html-building-code-chapter-1.png)
- [2022 Building Code Chapter 1 — native](phase-3/screenshots/native-building-code-chapter-1.png)
- [2026 Existing Building Code Chapter 1 — HTML](phase-3/screenshots/html-existing-building-code-chapter-1.png)
- [2026 Existing Building Code Chapter 1 — native](phase-3/screenshots/native-existing-building-code-chapter-1.png)

## Exit-gate status

The structural and simulator visual portions of the Phase 3 exit gate pass for both pilot chapters. The native reader remains responsive while loading, restoring, and scrolling the 306-block Building Code pilot; its validated document load completed in 0.054 seconds during the final full-suite run.

The oldest-supported-physical-iPhone portion of the exit gate remains pending. A connected iPhone was passcode protected during verification, so it was not installed to or modified. Phase 3 should not be considered fully device-signed-off until both pilot chapters receive a smoothness and restoration check on an unlocked oldest-supported iPhone.

## Phase boundary

Phase 4 has not started. Images, figures, tables, and any chapter outside the two exact Debug pilot routes continue to use the authoritative HTML reader and its existing asset/fallback paths.
