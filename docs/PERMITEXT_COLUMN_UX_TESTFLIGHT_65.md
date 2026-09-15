# Column UX TestFlight build 65

September 15, 2026. The owner authorized uploading the merged native changes for physical iPhone verification. This is a TestFlight upload, not an App Store release.

- Source: main commit `1482576338c049b80b276e7936f67c6d9e3fc984`.
- Version: 1.0 (65), bundle `com.randycodex.permitext`.
- Archive: `/tmp/permitext-column-ux-1.0-65.xcarchive`.
- Toolchain: Xcode 27.0, build 27A5252f.
- Release archive succeeded; deep strict code-sign verification passed.
- Archive backend: `https://permitext-sync.vercel.app`; non-exempt encryption declaration false.
- Build number supplied through xcodebuild override; project build settings unchanged.
- Upload log: `/tmp/permitext-column-ux-65-upload.log`.
- Apple upload succeeded at 07:29:13 EDT; export succeeded.
- App Store Connect visibly lists 1.0 (65) as Processing.
- Owner confirmed build 65 installed and open; subsequent checks used the physical phone through iPhone Mirroring. Full physical acceptance remains incomplete.
- No external beta review or public App Store submission was made.

Production web independently returned this same source SHA from `/release` during this verification. Web deployment does not establish native installation or acceptance.

## Physical phone verification after installation

- Authenticated project loaded the web-created test notes and saved report.
- Account retained Lifetime Pro, signed-in Synced state, and 98 included turns.
- Unsent Research draft survived tab navigation and app background/return; nothing submitted.
- Correctly entered `concrete` query returned results; opening EBC 902 reached the matching Reader section and returning preserved the query. Previews reload and shift list position; exact scroll continuity is not passed.
- Sample report Export & Save iOS PDF produced a 29 KB PDF share sheet and a one-page print preview. Project then showed Web PDF and iOS PDF stored. No printing or third-party sharing performed. Full PDF text/version comparison remains pending.
- Confirmed defect: a Notebook paragraph containing text before a reference renders as plain text on iPhone. Source renderer only recognized a reference in first position. Local fix and mixed-content fixture are under verification; build 65 does not contain that fix.
- Owner is checking real touch keyboard and horizontal table gestures directly; Mirroring cannot substitute for those touch checks.

## Follow-up owner review and local fixes

Owner confirmed keyboard editing works in the sample note; table gesture check was also reported working. Owner additionally reported intermittent jumps from Saved, Notebook, and Research to Reader 1. Direct Mirroring attempts kept Research selected and returned Done to Notebook; intermittent jump remains unresolved and is not marked fixed.

Local changes after build 65:
- Mixed text/reference paragraphs render their reference controls and preserve surrounding text independently; updated isolated fixture includes text before and after the reference. Simulator opened the linked note read-only successfully.
- Project-card initial note route now waits for Notebook access loading instead of presenting with default read-only access.
- Removed redundant Save toolbar action; autosave and dismissal saving remain.
- Replaced verbose project loading sentence with accessible spinner and suppressed empty Notebook message during loading.
- Simulator-target build passed after all changes (`/tmp/permitext-note-flow-build.log`). New changes are not in TestFlight 65; physical acceptance of them is pending.
