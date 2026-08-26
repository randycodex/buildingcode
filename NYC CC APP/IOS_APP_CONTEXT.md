# Permitext iPhone app context

Use this as the current handoff for iOS work in:

- `/Users/randy/Documents/X_CODING/Building Code/NYC CC APP`

## Product boundary

Permitext is a local-first NYC code-research workspace. The iPhone app reads
bundled Construction Code and Zoning Resolution content, stores personal work
locally, and synchronizes supported records through the Permitext backend after
sign-in.

Search discovers candidate provisions. Research is a separate, selected-evidence
workflow: it may use only the enacted passages the user selected and must expose
citations, uncertainty, missing facts, and limitations.

Free includes reading, search, recent history, bounded saved sections and notes,
continuity, and cross-device sync. Pro adds unlimited saved work, Projects,
Notebook, Report Draft, professional exports, tags, and offline access. Research
is a separate add-on that requires Pro.

## Project and build

- Xcode project: `NYC CC APP/NYC CC APP.xcodeproj`
- Scheme: `permitext`
- App source: `NYC CC APP/permitext`
- App entry: `NYC CC APP/permitext/PermitextApp.swift`
- Contract tests: `NYC CC APP/permitextTests/EntitlementAndSyncContractTests.swift`

Representative simulator command:

```sh
./Tools/permitext_xcode.sh test-simulator
```

The wrapper uses one shared DerivedData location outside the iCloud-synced
checkout and forces a single nonparallel test worker. Do not create
project-local `.DerivedData-*` folders. If a direct `xcodebuild test` command is
unavoidable, include both `-parallel-testing-enabled NO` and
`-maximum-parallel-testing-workers 1`.

For a physical-device test, use:

```sh
./Tools/permitext_xcode.sh test-physical <device-identifier>
```

For read-only storage inspection or guarded cleanup, use:

```sh
./Tools/permitext_storage_guard.sh --audit
./Tools/permitext_storage_guard.sh --clean
```

A successful build is not visual or runtime proof. Use the simulator or a
physical device for reader layout, navigation, StoreKit, offline, and
phone-to-web verification.

## Content

Bundled authored content lives under:

- `permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes`
- `permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution`

Construction content includes chapter HTML, prepared section bodies, a prepared
search index, figures, and a structural/title-only classification catalog. The
legacy SQLite code database remains a compatibility source and must treat search
input as literal user text rather than executable FTS syntax.

Do not describe every catalog entry as having a standalone prepared body.
Chapter HTML provides broader rendered coverage, while explicitly classified
structural/title-only entries may not have an independent body.

## Important source files

- Database and legacy search: `permitext/Data/CodeDatabase.swift`
- SQLite connection policy: `permitext/Data/SQLiteSupport.swift`
- Local user data: `permitext/Data/UserDataStore.swift`
- Shared models and merge decisions: `permitext/Models/CodeModels.swift`
- Main application state: `permitext/ViewModels/CodeLibraryViewModel.swift`
- Sync diagnostics and transport: `permitext/Diagnostics/Signposts.swift`
- Reader views: `permitext/Views/ReaderView.swift`,
  `permitext/Views/ChapterReaderView.swift`, and
  `permitext/Views/ChapterHTMLReaderView.swift`
- Saved work: `permitext/Views/BookmarksView.swift`
- Settings and entitlement presentation: `permitext/Views/SettingsView.swift`

## Data and sync rules

- Account identity is the Permitext/Apple account identity, not a Stripe billing
  email.
- Preserve pending local deletes until they upload or become an explicit
  conflict; a pull must not silently consume them.
- Free saved-section and note limits are account-wide across code versions.
- StoreKit verification and backend entitlement/package metadata are separate
  sources; StoreKit refresh must not erase backend package or add-on fields.
- Continuity histories merge per entry on the server. Pending iOS continuity
  activity must upload so recent views and searches from multiple devices can
  converge.
- Production phone-to-web proof uses `https://permitext-sync.vercel.app` with
  PostgreSQL. The local JSON adapter is development storage, not production sync
  proof.

## Reader and navigation rules

- Resolve a deep-linked section through bundled content metadata; do not infer
  Construction versus Zoning from numeric ID ranges.
- Keep top-level HTML-reader navigation inside bundled local content, with
  explicit handling for supported in-app code references.
- On teardown, cancel pending loads, stop the web view, clear delegates, and
  remove installed message handlers and user scripts.
- Validate rendered behavior for tables, figures, typography, links, and
  cross-code navigation. Source inspection alone is insufficient.

## Offline verification

Offline access is Pro-only. Testing edits while an already-open tab or view loses
network connectivity is not a complete offline test. Verify:

- cached application shell;
- offline reload/relaunch;
- persistent code content;
- figure and media recovery;
- reconnect and outbox synchronization.

## Current release handoffs

- Cross-platform bug and hardening status:
  `../PERMITEXT_BUG_AUDIT.md`
- Manual release workflow:
  `../PERMITEXT_RELEASE_WALKTHROUGH.md`
- Server/web implementation and commands:
  `../permitext-sync-server/README.md`

Treat those files, the current source, tests, GitHub state, production
deployment, and App Store configuration as separate forms of evidence.
