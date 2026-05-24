# AGENTS.md

## Project overview

NYC Code (Unofficial) — two native Apple apps for browsing NYC 2022 Construction Codes:

- **NYC CC AUTHOR** (`NYC CC AUTHOR/`): macOS SwiftUI authoring/editor app (SPM, swift-tools-version 6.3)
- **NYC CC APP** (`NYC CC APP/`): iPhone SwiftUI reader app (Xcode project)

Both require macOS + Xcode for full builds. Zero third-party Swift dependencies.

## Cursor Cloud specific instructions

### Platform constraints

This is a native Apple (Swift/SwiftUI) project. On Linux cloud VMs:

- **Cannot build** the iOS app (`NYC CC APP`) or macOS author app (`NYC CC AUTHOR`) — they depend on UIKit, AppKit, and SwiftUI.
- **Can build** the two CLI utility tools under `NYC CC APP/Tools/` (`slim-bundle` and `build-image-manifest`), which only use Foundation.
- **Can run** the Python search regression tests under `NYC CC APP/Tools/search-regression/`.
- **Can query** the bundled SQLite databases with `sqlite3`.

### Swift toolchain

Swift is installed via [swiftly](https://swift.org/install/linux/). The env is sourced from `~/.local/share/swiftly/env.sh` (already in `~/.profile` and `~/.bashrc`). Run `. ~/.local/share/swiftly/env.sh` if `swift` isn't found in a new shell.

### Building CLI tools

```bash
cd "NYC CC APP/Tools/slim-bundle" && swift build
cd "NYC CC APP/Tools/build-image-manifest" && swift build
```

### Running tests

**Search regression (Python, CI guard):**
```bash
cd "NYC CC APP/Tools/search-regression"
python3 search_regression.py \
  "../../NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes" \
  --compare-golden
```

The `--compare-golden` flag is the CI-style check (exit 0 = pass). Running without flags shows linear-vs-shipped comparison; mismatches there are expected and documented in the tool's README.

### Database

The bundled SQLite database is at `NYC CC APP/NYCCCApp/Resources/nyc_code_2022.sqlite` (19 MB, 7346 sections, 55 chapters, FTS5 full-text search enabled). A smaller sample DB (`nyc_code_sample.sqlite`) is also bundled. Use `sqlite3` to inspect or query.

### Authored bundle data

Pre-processed bundle at `NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/`. Contains `bundle.json`, `prepared/` directory with per-section JSON files, and `prepared/searchIndex.json`.

### Workflow conventions

See `WORKFLOW.md` for branching conventions (use `codex/<task-name>` pattern for branches). Keep `main` as the stable branch.
