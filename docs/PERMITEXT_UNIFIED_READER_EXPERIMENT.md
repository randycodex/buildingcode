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
