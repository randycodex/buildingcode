# Native Reader Corpus Inventory and Document Generator

This build-time tool parses every authored, non-prepared chapter with macOS's libxml2 HTML recovery parser, normalizes that recovered tree to XML, and inspects it as a Foundation DOM. This preserves the corpus's custom legal-markup elements while avoiding regex as the content parser. Each chapter runs in an isolated worker process so malformed or unusually large source cannot grow the coordinator's memory across the corpus.

The tool emits:

- A deterministic corpus inventory and eligibility manifest.
- A versioned native chapter document for every authored chapter.
- A bundled index that maps authoritative source paths and hashes to generated documents.

Each native document preserves deterministic block and anchor IDs, normalized enacted text, rich-text runs, nested lists, link targets, rowspan-aware table matrices, captions, footnotes, media metadata, source hashes, and source references. Unsupported blocks retain their recovered source fragment and remain explicitly classified for full HTML fallback. The authored HTML and bundled assets remain authoritative.

From the repository root:

```sh
swift run --package-path 'NYC CC APP/Tools/native-reader-inventory' native-reader-inventory
```

Verify that the committed artifacts still match the corpus and parser rules:

```sh
swift run --package-path 'NYC CC APP/Tools/native-reader-inventory' native-reader-inventory --check
```

Run the parser's structural tests:

```sh
swift test --package-path 'NYC CC APP/Tools/native-reader-inventory'
```

Outputs:

- `NYC CC APP/docs/native-reader/corpus-inventory.json`
- `NYC CC APP/docs/native-reader/eligibility-manifest.json`
- `NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/native-reader-index.json`
- Per-chapter LZFSE documents below each content package's `prepared/native-reader-v1/chapters/` directory.

`--check` reparses the full corpus, decompresses every committed native document, and exits unsuccessfully when any report, index, document, or expected document path differs. A chapter with invalid anchors or missing media is classified as `invalidContent`; unreviewed elements, classes, or inline CSS are classified as `fullHTMLFallback`; supported complex tables are classified as `nativeWithTableFallback`.

The generated documents are bundled offline evidence for Phase 2. Reader routing remains unchanged; the app does not cut over chapters until later migration phases add and validate the native reader path.
