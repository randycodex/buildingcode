# NYC Code (Unofficial)

This workspace contains two projects:

- `NYCCodeImporter`: macOS Swift command line importer that ingests chapter PDFs into SQLite and extracts figures.
- `NYCCode`: iPhone SwiftUI app that reads bundled versioned SQLite databases and renders immutable official text with dynamic formatting.

Use the importer first, then copy the generated `.sqlite` file and `figures/` contents into `NYCCode/NYCCode/Resources/`.

Project handoff notes:

- iPhone app context: `NYCCode/IOS_APP_CONTEXT.md`
