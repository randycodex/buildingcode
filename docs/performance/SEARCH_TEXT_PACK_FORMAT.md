# Bundled search text packs

Each authored edition's `prepared` directory contains three generated files:

- `searchTextManifest.json`: schema version, SHA-256 source revision, SHA-256 digests of the other two files, canonical section count and UTF-8 byte count.
- `searchTextIndex.json`: schema version and a `sections` dictionary mapping canonical decimal section IDs to `[byteOffset, byteLength]`.
- `searchText.utf8`: exact resolved official text concatenated in numeric section-ID order. Offsets and lengths are bytes, not Unicode character counts. An empty resolved string has a valid zero-length entry.

The existing Xcode `CodeContent` folder resource includes these files automatically. They contain public authored code text, not account history, saves, annotations or user projects. Runtime search can map the blob and decode individual matching sections without parsing rich section blocks or chapter HTML. Reader rendering keeps the original rich sources.

## Updating content

From the repository root on macOS with Xcode selected:

```sh
python3 Tools/permitext_search_text_pack.py
python3 Tools/permitext_search_text_pack.py --check
python3 permitext-sync-server/tests/search-text-pack-contract.py
```

Generation compiles a small Swift host helper from the production text-resolution methods and block models. It intentionally follows the existing precedence: prepared plain text, embedded plain text, prepared blocks, embedded blocks, synthesized chapter HTML, then the existing title fallback. The actual compact chapter catalog is expanded where supported; editions with the older object-shaped catalog use per-chapter files, matching the app. Flat section-catalog recovery preserves the app's synthesis eligibility rules.

Generation can take several minutes because it performs the expensive HTML work once during content preparation. It does not run on the user's phone.

`--check` only reads and hashes files. It does not compile Swift or write files. Use it as the build gate. `--verify` additionally resolves the entire corpus again and compares all three generated files byte for byte. `--edition NAME` restricts any mode to a named edition for investigation; shipping checks should cover all six editions.

## Revision and integrity

The source revision includes the generator algorithm, extracted Swift text and title helpers and block models, edition bundle metadata, prepared JSON sources (including chapter/section catalogs and the search index), and chapter/code-section HTML. Generated outputs and native Reader render packs are excluded to avoid recursive hashes and unrelated render-only invalidation.

Changing a search-relevant source, adding or removing a source file, changing resolution helpers, or corrupting either generated payload causes the check to fail. Generation is independent of absolute checkout path, local timestamps and account state. Complete canonical section coverage, contiguous valid UTF-8 ranges, payload lengths and digests are validated.

Missing, unsupported or corrupt runtime packs must leave the existing authoritative source-resolution fallback available. The completed-search cache should use only a validated pack revision and its own search-engine/cache schema version; app version alone is not a content revision.
