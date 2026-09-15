# Column UX TestFlight build 66

September 15, 2026. Follow-up to owner review of build 65.

## Changes

- Preserve SwiftUI tab-navigation ownership. Search retap no longer replaces the tab controller delegate. Addresses a likely cause of intermittent jumps from Saved, Notebook and Research to Reader. Exact physical failure is not yet verified resolved.
- Remove the redundant Note Save action; autosave and dismissal saving remain.
- Opening a project Note waits for loaded access before presenting its editor.
- Replace the verbose project sync-loading sentence with an accessible spinner.
- Render references embedded between text in Notebook paragraphs without flattening the reference or adjacent editable text.

## Source and verification

- Source commit: `df294d785` on main, pushed to origin.
- Focused tab-navigation suite: 2 tests passed, 0 failures.
- Simulator: Reader → Search → Saved → Research → Search stayed selected; repeated Search tap opened the keyboard. Research used signed-out state for this local check.
- Isolated Notebook fixture: edited text before a reference, opened the linked Note read-only, tapped Done, and returned with edited text, reference, and following text intact.
- Build 65 remains the last confirmed installed physical build. All new behavior needs physical verification in build 66.

## Release archive and upload

- Resumed after the owner pause. The old temporary files had been cleared, and the source corpus was available locally again.
- Built directly from the repository, source `df294d785826f3678c7b5e9e619f09b94f3b4ed2`, using Xcode 27.0 release build 27A266a. No temporary corpus workaround used in this archive.
- Release archive succeeded: `/tmp/permitext-column-ux-1.0-66.xcarchive`.
- Deep strict code-sign verification passed. Bundle `com.randycodex.permitext`, version 1.0 (66), non-exempt encryption declaration false.
- Archive log: `/tmp/permitext-column-ux-66-archive.log`.
- TestFlight upload succeeded September 15, 2026 at 11:07:54 EDT. Xcode confirmed the uploaded package is processing and EXPORT SUCCEEDED. Log: `/tmp/permitext-column-ux-66-upload.log`.
- Chrome App Store Connect session expired; owner asked to sign in for post-upload status verification.
- No public App Store submission. Physical build 66 verification remains pending.
