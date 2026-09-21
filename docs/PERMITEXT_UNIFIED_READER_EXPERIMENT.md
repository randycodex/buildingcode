# Single Reader tab experiment — September 21, 2026

## Baseline and scope

The owner authorized pushing the current state, creating a branch, and testing the previously discussed single-Reader idea. Main was pushed at `01bb25378` before implementation. Work is isolated on `codex/unified-reader-experiment`.

This first experiment combines the two existing independent readings under one native Reader tab. A source-labelled switcher above the reading changes the active context; both NavigationStacks stay mounted after their first use. Saved and Research remain native destinations, and the existing global Search presentation remains separate.

This is a bounded interaction prototype: it does not yet add an arbitrary number of readings, close/reorder controls, or promote temporary Search/Saved previews with Pin/Keep open. Those are subsequent design decisions after trying the combined destination. Web columns are unchanged.

## Preservation and rollback

Primary and secondary context identifiers, corpus models, chapter positions, and preference keys remain unchanged. The second model remains lazy. The workspace cache gains an optional last-active-reader field; old cache records still decode, including a previously selected secondary Reader. Switching away to Saved or Research preserves that last-active reading. Account scopes remain separate.

The branch can be abandoned and the baseline rebuilt without converting or deleting reading data. No database, account, saved-content, or production-web migration is involved. The owner's `DO NOT DELETE.png` and `.typesafe-local` files are not part of the commits.

## Verification

Passed on the paired iPhone 17 Pro:

- Device Debug build: `/tmp/permitext-unified-reader-build.log`.
- Two persistence tests: legacy workspace decoding, last-active-reader restoration, and account isolation. `/tmp/permitext-unified-reader-tests.log`; result `Test-permitext-2026.09.21_13-02-06--0400.xcresult` in the shared DerivedData test logs.
- Physical UI test `testUnifiedReaderSwitchingSearchReturnAndRelaunch` passed in 93.814 seconds. It verifies one Reader destination, a scrolled primary passage retained within five points after switching, Search close returning to the second reading, Saved/Research round trips, and last-selected-reading restoration after process relaunch. `/tmp/permitext-unified-reader-ui-fixed.log`; result `Test-permitextPhysicalStress-2026.09.21_13-09-33--0400.xcresult`. Three captures exported to `/tmp/permitext-unified-reader-passed`.
- Mirroring inspection confirmed the corrected switcher and accessible code-picker row. Manually changed only the second reading to 2014 Building Code, opened Chapter 1 in both 2014 and 2022, and switched between them. Each retained its edition; the 2014 scrolled viewport remained unchanged on return. Left both chapters open on the physical phone for owner review.

The first UI run failed because the parent switcher accessibility identifier propagated over its child identifiers. Inspection also found the outer safe-area inset covered the pinned code picker. Removed that container identifier and used a separate VStack layout row; the subsequent physical test passed. Both failures are retained in `/tmp/permitext-unified-reader-ui.log` and its result bundle.

The last active reading survives relaunch, but chapter navigation retains the pre-existing behavior: the chapter grid can reopen, with stored chapter positions available when entering a chapter again. Automatic reopening of every previously open chapter is not implemented by this prototype.

No TestFlight upload, production deployment of the experiment, or merge of the experiment to main. Shared DerivedData reused; no simulator/runtime was created. Source tests and this bounded physical pass do not constitute all-edition or all-accessibility-size acceptance.

## Bottom-control revision

The owner subsequently requested 52-point glass reading pills above the native tab bar, a circular glass code menu on the chapter grid, and no full-width background behind the bottom controls. The switcher now overlays the reading surface instead of reserving a separate row. Selected pills use fill and accessibility selection state without a checkmark. Native and HTML content receive bottom scrolling clearance. The tab-bar background is hidden.

The preceding header experiment moves section jump into the chapter title and bookmark into the toolbar. The owner chose a separate unfilled chapter/section control beneath the code title; bookmark redesign remains undecided.

The expanded physical test passed its pill-height, jump, passage-position and edition-switch steps, but failed after relaunch because both code pickers were exposed to accessibility and the first match was the inactive 2022 picker. The selected secondary still showed 2014. The inactive grid menu is now explicitly accessibility-hidden, but this fix and the floating revision still require a fresh physical pass. Mirroring reported the phone in use during this revision; do not treat the earlier physical pass as acceptance of this layout.

The updated development app was subsequently installed and inspected through iPhone Mirroring: chapter cards visibly continue behind both bottom controls, the menu has its glass circle, and the selected reading checkmark is gone. A further five-point horizontal inset aligns the reading row with the native bottom menu on the paired phone. The expanded accessibility/relaunch test has not yet been rerun.

Header hierarchy was simplified at the owner's request: the grid says Chapters with the code/version menu at right; chapter headers show the chapter title and unfilled section picker. The bottom reading pills retain source, edition and location.

Final hierarchy build passed (`/tmp/permitext-reader-hierarchy.log`) and was installed as an Xcode development build on the paired phone. Mirroring confirmed Chapters/grid menu, aligned bottom pill edges, content behind both control rows, chapter-only heading and functioning unfilled jump control. Long chapter titles remain truncated in the narrow toolbar, particularly with the development diagnostic control visible. The jump sheet was closed and the chapter left open for review.
