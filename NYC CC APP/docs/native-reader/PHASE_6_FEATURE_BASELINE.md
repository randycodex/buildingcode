# Native Reader Phase 6 Feature Baseline

Date: 2026-08-19

Branch: `codex/native-ios-reader-migration`

## Scope

Phase 6 adds the interaction layer required for a usable native chapter Reader: current-section tracking, jump navigation, chapter search and match navigation, native link routing, scroll restoration, and the native selection menu. It also verifies the existing native content presentation under accessibility text sizes, light and dark appearance, and Reduce Motion-aware navigation.

The authored HTML remains authoritative. HTML remains the release/default Reader, the Native/HTML comparison selector remains Debug-only, and this phase does not change reader eligibility or promote additional chapters. The temporary APP-D device pilot used for visual review was removed before the final builds and is not present in committed source.

## Reader features

- The Reader derives the current section from the nearest preceding published heading as the visible native block changes. Section numbers are recovered from headings, including code-prefixed forms such as `SECTION BC 101` and `EBC 101`, with authored anchors retained as the fallback.
- A bottom current-section bar opens a native jump sheet. The sheet preserves heading order and hierarchy, marks the current heading, and scrolls directly to the selected block.
- Chapter search indexes heading, paragraph, list, table-cell, and media metadata text without changing the source document. Matching is case- and diacritic-insensitive.
- Search results preserve document order. Selecting a result scrolls to the source block, highlights the exact attributed-text ranges or isolated-table DOM matches, and exposes previous, next, clear, and `n of n` controls.
- Internal authored fragments resolve to their stable native block. Cross-code section, chapter, appendix, and Zoning fragments resolve through the loaded code library and open the existing section destination rather than a parallel navigation model.
- The primary and secondary Reader contexts pass their existing remembered native block and anchor bindings into the native Reader. A restored block is applied only after the lazy native layout exists and is repeated once for slower physical-device layout.
- The UIKit text selection menu preserves the system-provided Copy and Share actions and appends Research. Research uses the singular SF Symbol `sparkle` and submits the trimmed selection against the nearest canonical section, with the existing Reader section as a fallback.
- Search and jump scrolling uses an immediate path when Reduce Motion is enabled and a short native animation otherwise.
- Native typography continues to use scaled system fonts, semantic colors, and the existing Reader theme. The enacted-content heading hierarchy and source-derived table presentation are unchanged.

## Automated verification

Completed on one iPhone 17 Pro simulator running iOS 26.5:

- Focused native Reader contracts: 16 passed. Phase 6 coverage includes ordered case-insensitive search, exact active-match styling without text loss, selection-menu action preservation and singular `sparkle`, authored-template and cross-code link decoding, prefixed section-number recovery, and current-section derivation from published heading order.
- Complete iOS test target: 83 passed with no failures or skips.
- Debug simulator build: passed as part of the complete test target after the temporary pilot was removed.
- Fresh Release simulator build: passed.
- Release binary inspection confirms `Native (Comparison)`, `PhaseSixFeaturePilot`, and `DebugPhaseSixFeaturePilot` are absent.

Completed on a physical iPhone 17 Pro running iOS 27.0:

- A separately identified Debug app (`com.randycodex.permitext.phase6`) installed without replacing the normal Permitext app or its data.
- Focused native Reader contracts: 16 passed with parallel testing disabled; zero failures and zero skips.
- APP-D-21241 native search returned three ordered `Zoning Map` matches. Selecting the table result highlighted the exact cell, and previous/next navigation changed the active result and counter.
- The native jump sheet listed the three source headings, marked the current heading, navigated to another heading, and updated the bottom current-section value.
- Relaunch preserved the selected current-section value through the existing Reader-context storage.
- The Phase 6 test app was removed after testing. Device inventory then showed only the normal `com.randycodex.permitext` app.

## Accessibility and appearance review

- Simulator accessibility inspection exposed descriptive labels for Search, Jump within chapter, current-section state, previous/next search results, the match counter, clear search, and table-confined horizontal scrolling.
- The jump sheet retained readable hierarchy and current-state indication.
- The native Reader was reviewed in light appearance and dark appearance at the largest accessibility text size. Headings, table content, search, and the bottom jump control remained operable using semantic colors and scaled typography.
- Search and jump animation code explicitly honors Reduce Motion. Selection-menu composition is covered by an isolated UIKit contract because the Simulator accessibility tree cannot invoke a native text-selection long press reliably.

Visual baselines:

- [Active table search match](phase-6/screenshots/native-search-table.png)
- [Dark appearance at the largest accessibility text size](phase-6/screenshots/native-dark-axxxl.png)

## Exit-gate status

The Phase 6 gate passes for the currently eligible native chapters. Native chapters now provide current-section tracking, chapter jump, search with exact highlighting and match navigation, internal and cross-code reference routing, restoration, and Copy/Share/Research selection behavior. Automated contracts pass on the simulator and physical phone, the complete app suite passes, and the representative native chapter was exercised under accessibility and appearance variants.

## Phase boundary

Phase 7 has not started. Bookmark mutation and Projects reliability remain on the existing path: paragraph swipe deletion, a single bookmark toggle in the current-section bar, optimistic save/remove state, small immediate database mutation, asynchronous Project presentation rebuild, refresh coalescing, and Reader-to-Projects transition hardening are the next scope. HTML remains the release/default Reader.
