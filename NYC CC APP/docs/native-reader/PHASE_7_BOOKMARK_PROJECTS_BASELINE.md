# Native Reader Phase 7 Bookmark and Projects Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 7 replaces paragraph-level swipe bookmarking with one contextual bookmark control in the bottom current-section bar. Bookmark and Project presentation state now changes optimistically, while account-wide Project evidence reconstruction runs asynchronously and coalesces repeated requests.

The authored HTML remains authoritative. HTML remains the release/default Reader, the Native/HTML selector remains Debug-only, and this phase does not change native eligibility or promote additional chapters.

## Bookmark interaction

- The legacy native reader, native authored-document reader, and HTML reader all use the same `ReaderCurrentSectionBookmarkButton` in the bottom current-section bar.
- The control exposes `Save current section` / `Remove current section bookmark` labels and `Not saved` / `Saved` accessibility values.
- Bookmark state is published before the repository mutation completes. A failed mutation restores the previous bookmark, folder-membership, Project-row, and Project-count state.
- The old SwiftUI paragraph drag modifier and the HTML reader's touch listeners, JavaScript message action, indicator nodes, and swipe CSS are removed.
- The synchronous repository operation is limited to the bookmark or folder-membership transaction. User-content sync remains scheduled after the local mutation.

## Projects reliability

- Current-version folder metadata and membership reconcile immediately.
- Account-wide evidence inputs are captured as immutable snapshots. An isolated `ProjectPresentationBuilder` actor owns its content-store caches and resolves Project rows away from the main actor.
- Rebuild requests wait for a 140 ms coalescing window. A newer request cancels the prior task, and a generation check prevents an older result from replacing newer state.
- Optimistic saves add the section to affected Project rows immediately. Removes delete the section and membership immediately; the background rebuild then reconciles exact evidence-record counts and cross-version presentation.
- Opening the Projects screen or a Project detail consumes the already-published state. It no longer performs an automatic full Saved-library refresh merely because the destination appeared. Pull-to-refresh remains the explicit reconciliation path.

## Automated verification

Completed on one iPhone 17 Pro simulator running iOS 26.5:

- Phase 7 contracts: 3 passed. Coverage includes optimistic row reduction, note and paragraph-evidence preservation on bookmark removal, background Project presentation from an immutable SQLite snapshot, source-level paragraph-swipe removal, the shared current-section control, and the single explicit Projects refresh path.
- Complete iOS test target: 86 passed with zero failures and zero skips.
- Fresh Debug simulator compilation passed as part of the complete test target.
- Fresh Release simulator build passed.

Completed on a physical iPhone 17 Pro running iOS 27.0:

- A separately identified Debug app (`com.randycodex.permitext.phase7`) installed without replacing the normal Permitext app or its data.
- Phase 7 contracts: 3 passed with parallel testing disabled; zero failures and zero skips.
- The native Chapter 1 Reader displayed one bookmark control in the bottom current-section bar. Tapping it changed the visible state immediately.
- Projects displayed the saved current section immediately after the tab transition.
- Ten repeated Reader-to-Projects cycles completed on the simulator and ten on the physical phone without a crash, hang, or stale saved row.
- The Phase 7 test app was removed after testing. Device inventory then showed only the normal `com.randycodex.permitext` app.

Visual baselines:

- [Simulator Reader saved state](phase-7/screenshots/simulator-reader-saved.png)
- [Simulator immediate Projects state](phase-7/screenshots/simulator-projects-immediate.png)
- [Physical Reader saved state](phase-7/screenshots/physical-reader-saved.png)
- [Physical immediate Projects state](phase-7/screenshots/physical-projects-immediate.png)

## Exit-gate status

The Phase 7 gate passes for the tested native and HTML reader paths. Save/remove state is optimistic, repository mutations no longer wait for account-wide Project evidence reconstruction, repeated rebuild requests coalesce, and normal Reader-to-Projects navigation does not trigger a duplicate Saved-library refresh. Automated tests, the Release build, simulator interaction, and physical-device interaction all pass.

The migration plan's later final-acceptance target of 100 rapid bookmark/Reader/Projects iterations remains intentionally open. This phase used ten stable transitions per device as its bounded implementation gate; the 100-iteration physical stress run belongs to the final hardening and rollout evidence.

## Phase boundary

Phase 8 has not started. Prebuilt native documents, deeper lazy loading, memory and cache policy, load-failure recovery, signpost instrumentation, performance baselines, memory-warning testing, and full stress/crash hardening remain the next scope. HTML remains the release/default Reader.
