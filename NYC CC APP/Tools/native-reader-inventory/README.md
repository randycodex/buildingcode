# Native Reader Corpus Inventory

This build-time tool parses every authored, non-prepared chapter with macOS's libxml2 HTML recovery parser, normalizes that recovered tree to XML, and inspects it as a Foundation DOM. This preserves the corpus's custom legal-markup elements while avoiding regex as the content parser. Each chapter runs in an isolated worker process so malformed or unusually large source cannot grow the coordinator's memory across the corpus. The tool emits a deterministic inventory and a smaller routing manifest for the native iOS Reader migration. The authored HTML and bundled assets remain authoritative.

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

`--check` exits unsuccessfully when either artifact differs, so new or changed content structures cannot pass unnoticed. A chapter with invalid anchors or missing media is classified as `invalidContent`; unreviewed elements, classes, or inline CSS are classified as `fullHTMLFallback`; supported complex tables are classified as `nativeWithTableFallback`. This manifest is inventory evidence only in Phase 1—the app does not use it to cut over chapters yet.
