# Native Reader Phase 2 Parser Baseline

Date: 2026-08-18

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 2 adds a build-time DOM parser and versioned native chapter document model. It does not route any chapter into the native reader, change the HTML default, or remove an existing fallback.

The authored HTML and bundled assets remain authoritative. Generated documents are deterministic derivatives stored beside the existing prepared content and included through the existing `CodeContent` folder resource.

## Generated document contract

Parser schema: `native-reader-document-v1`

Document schema: `1`

Compression: LZFSE

Each document includes:

- Content package, code-family, code-section, and chapter metadata when the authored bundle exposes it.
- Authoritative relative source path and SHA-256.
- Deterministic document, block, list-item, table, media, and anchor mappings.
- Headings, paragraphs, ordered and unordered lists, rich-text runs, links, tables, images/figures, captions, notes, dividers, and explicit unsupported HTML blocks.
- Rowspan-aware and colspan-aware table cell coordinates, header flags, formatting metadata, captions, footnotes, and a structural hash.
- Resolved media paths, dimensions, accessibility text, and asset hashes.
- Recovered source fragments for unsupported HTML, inline SVG, figures, and isolated-HTML tables.
- Per-chapter structural-validation results and explicit routing eligibility.

## Corpus result

- Authored chapters: 463
- Native documents: 463
- Structurally validated documents: 463
- Structural validation failures: 0
- Tables compared: 1,677
- Images/SVG records compared: 885
- Native eligible: 233
- Full HTML fallback: 217
- Invalid content: 13
- Native with isolated-table fallback: 0
- Corpus SHA-256: `0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88`
- Uncompressed generated JSON: 242,782,736 bytes
- LZFSE-compressed generated documents: 31,924,682 bytes

Validation success does not override eligibility. Chapters with unreviewed markup/CSS remain `fullHTMLFallback`, and chapters with duplicate anchors or unresolved media remain `invalidContent` even when the parser can account for their structure.

## Structural validation

Every generated document is checked against the authoritative DOM and Phase 1 inventory for:

- Normalized enacted-character order.
- Stable anchor sequence and block mapping.
- Link targets and occurrence counts.
- Table count, row/column matrix, spans, captions, and footnotes.
- Image/figure count, source, resolved asset, caption, and accessibility metadata.
- Explicit unsupported-block preservation.

The bundled index records the source hash, generated document path, uncompressed and compressed hashes, byte counts, block count, eligibility, and validation result for every chapter.

## Commands

Generate all reports and native documents:

```sh
swift run --package-path 'NYC CC APP/Tools/native-reader-inventory' native-reader-inventory
```

Verify exact regeneration, compressed document contents, and expected document set:

```sh
swift run --package-path 'NYC CC APP/Tools/native-reader-inventory' native-reader-inventory --check
```

Run focused parser and model tests:

```sh
swift test --package-path 'NYC CC APP/Tools/native-reader-inventory'
```

Build the unchanged iOS release path:

```sh
xcodebuild -project 'NYC CC APP/NYC CC APP.xcodeproj' \
  -scheme permitext \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

## Phase boundary

Phase 3 has not started. HTML remains the default reader, and the debug-only comparison selector from Phase 0 remains the only way to view the existing native comparison reader.
