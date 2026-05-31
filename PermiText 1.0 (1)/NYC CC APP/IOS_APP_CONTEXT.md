# NYC CC APP iPhone App Context

Use this file as the handoff note for any new thread focused on the iPhone app at:

- `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP`

## Project purpose

`NYC CC APP` is an iPhone SwiftUI app for browsing the NYC Building Code from a bundled SQLite database. The source of truth is SQLite, not PDFs. The importer converts PDFs into SQLite, and the app reads the bundled database plus bundled figure images.

The core rule is still:

- `sections.official_text` is the immutable extracted official text
- display styling is applied at render time
- manual presentation fixes are stored separately as metadata or rich-text overrides

## Current data setup

The app currently bundles both:

- `/Users/randy/Documents/X_CODING/Building Code/NYCCode/NYCCode/Resources/nyc_code_2022.sqlite`
- `/Users/randy/Documents/X_CODING/Building Code/NYCCode/NYCCode/Resources/nyc_code_sample.sqlite`

Bundled figures are under:

- `/Users/randy/Documents/X_CODING/Building Code/NYCCode/NYCCode/Resources/Figures`

The app auto-discovers bundled `nyc_code_<version>.sqlite` files and exposes them in Settings.

## Important current behavior

- The reader prefers `section_rich_text_overrides.rtf_data` when present.
- If no rich-text override exists, the reader falls back to rule-based styling from `official_text` plus `text_spans`.
- The macOS editor currently writes directly into the app-bundled `nyc_code_2022.sqlite`.
- After editor changes, the iPhone app needs to be rebuilt/run again so the updated SQLite file is bundled into the app product.

## Main features already implemented

- Browse by chapter and section
- Reader view
- Full-text search via SQLite FTS5
- Bookmarks
- Notes
- Code version selector
- Settings with disclaimer and reader theme controls
- Official figures
- Separate `Practice Diagrams` section for `custom_diagrams`
- Cross-reference resolution for chapter / section / appendix references
- Support for rich-text section overrides created by the macOS editor

## Key app files

- App entry: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/NYCCCApp.swift`
- Database layer: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Data/CodeDatabase.swift`
- Bundled DB discovery: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Data/BundleDatabaseLocator.swift`
- View model: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/ViewModels/CodeLibraryViewModel.swift`
- Formatting engine: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Formatting/FormattingEngine.swift`
- Reader UI: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Views/ReaderView.swift`
- Browse UI: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Views/BrowseView.swift`
- Search UI: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Views/SearchView.swift`
- Bookmarks UI: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Views/BookmarksView.swift`
- Settings UI: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Views/SettingsView.swift`
- Reference resolver: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Data/CodeReferenceResolver.swift`
- User data store for bookmarks/notes: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Data/UserDataStore.swift`
- App plist: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYCCCApp/Info.plist`
- Xcode project: `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP/NYC CC APP.xcodeproj`

## Database contract the app relies on

Core tables used by the app:

- `code_versions`
- `chapters`
- `sections`
- `paragraphs`
- `figures`
- `section_figures`
- `fts_paragraphs`
- `text_spans`
- `custom_diagrams`
- `section_rich_text_overrides`

The app currently expects the `section_rich_text_overrides` table to exist and uses it if present.

## Reader rendering behavior

Formatting priority is:

1. Rich-text override from `section_rich_text_overrides`
2. Otherwise rule-based `FormattingEngine.render(officialText:spans:theme:)`

Reader view currently shows:

- section header
- formatted text
- resolved references
- official figures
- practice diagrams
- notes editor

## Cross-reference behavior

Cross-reference resolution is implemented and is driven from the section’s official text.

Current destinations supported:

- section links
- chapter links
- appendix links

The references appear as a separate `References` panel in the reader, not yet as inline tappable links inside the text body.

## Theme and presentation behavior

Theme controls are stored via `ReaderThemeStore`.

Current adjustable presentation settings:

- font choice
- font size
- line spacing
- accent palette

These affect rule-based rendering. Rich-text overrides may visually diverge from theme-driven formatting because they come from saved RTF.

## Known workflow notes

- If formatting looks wrong in the reader, first check whether that section has a rich-text override from the editor.
- If the editor updates the database but the iPhone app does not reflect it, rerun the iPhone app so the updated SQLite is copied into the built app.
- The app bundles figures as individual resources, not as a folder reference blob.
- The app uses a real `Info.plist` because generated plist/bundle-id behavior caused earlier simulator install issues.

## Known current gaps / likely next tasks

- Inline tappable references inside the body text are not implemented yet.
- Backlinks such as `Referenced by` are not implemented.
- Reader polish may still be needed for typography and spacing when a section does not have a manual rich-text override.
- Chapter titles may still need cleanup for nicer display labels in some cases.
- Figure caption matching/import quality can still be improved from the importer side.

## Build/run reminder

Open:

- `/Users/randy/Documents/X_CODING/Building Code/NYCCode/NYCCode.xcodeproj`

Then run the `NYCCode` scheme in Xcode.

If a fresh thread is working on the app, reference this file first:

- `/Users/randy/Documents/X_CODING/Building Code/NYCCode/IOS_APP_CONTEXT.md`
