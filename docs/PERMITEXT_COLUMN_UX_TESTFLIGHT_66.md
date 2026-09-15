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
- Owner confirmed build 66 running on the physical iPhone. The targeted checks below were observed; broader lifecycle acceptance remains open.

## Release archive and upload

- Resumed after the owner pause. The old temporary files had been cleared, and the source corpus was available locally again.
- Built directly from the repository, source `df294d785826f3678c7b5e9e619f09b94f3b4ed2`, using Xcode 27.0 release build 27A266a. No temporary corpus workaround used in this archive.
- Release archive succeeded: `/tmp/permitext-column-ux-1.0-66.xcarchive`.
- Deep strict code-sign verification passed. Bundle `com.randycodex.permitext`, version 1.0 (66), non-exempt encryption declaration false.
- Archive log: `/tmp/permitext-column-ux-66-archive.log`.
- TestFlight upload succeeded September 15, 2026 at 11:07:54 EDT. Xcode confirmed the uploaded package is processing and EXPORT SUCCEEDED. Log: `/tmp/permitext-column-ux-66-upload.log`.
- Chrome App Store Connect session expired; owner asked to sign in for post-upload status verification.
- No public App Store submission. Build 66 was subsequently installed and opened by the owner.

## Physical build 66 checkpoint

- Saved → Search → Research → Saved stayed on the selected tab in the observed signed-in journey. This short check does not establish that the intermittent jump is eliminated under all conditions.
- The project opened without the former verbose sync-loading sentence in the observed snapshot; cold-load timing was not measured.
- A project note opened an editable editor with Done and no redundant Save. Done returned to the Notebook list, not Reader, in the observed attempt. The owner identified that extra list as redundant; direct return to the project is a follow-up on the current branch.
- A mixed-text reference note retained its text and link. Opening the linked note showed read-only content; Done returned to the original note with its content intact.
- The owner previously confirmed real touch keyboard and horizontal table scrolling on build 65. Those are owner-reported touch checks, not a new build-66 stress test.
- No claim of a new-text save/sync round trip on physical build 66, long-running interruption stress, or acceptance of the newer uninstalled branch changes.
