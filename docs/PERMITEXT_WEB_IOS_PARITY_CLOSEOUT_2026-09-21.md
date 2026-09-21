# Web and iOS review closeout — September 21, 2026

Implementation: `de7e44802`. Follow-up: repaired outdated verification harnesses and recorded this checklist.

The findings below are addressed in local source. Rendered checks used the localhost web workspace and the physical iPhone development build, not Production, TestFlight, or the App Store. This is a bounded review closeout, not a claim that every product flow is defect-free.

## Findings

1. **Saved source headings and grouping — fixed.** Native grouping and filters use code version plus stored source identity, avoiding collisions between numeric IDs from different libraries. Physical iPhone inspection confirmed historical Building Code and Energy Code saves under their own headings. Identity regression test passes.
2. **Web search missing 2014 coverage — fixed.** Global web search requests all editions; explicit 2014 scope remains available. Both rendered apps returned 17 results for `101.1`; web historical-only scope returned four. HTTP tests cover scope, identity, and pagination.
3. **Different global phrase matching — aligned.** Authored native global search now uses exact phrase matching and word boundaries, matching web global search. Native corpus tests and web exact-match tests pass. Reader-local typo-tolerant Find remains a separate behavior and its regression test passes.
4. **Misleading Clear Recent Searches scope — corrected.** Both confirmations explain account-wide synced clearing of recent searches and Recently Viewed, while pinned searches remain. Wording and continuity checks pass. Real account history was not destructively cleared to test the copy.
5. **One native library failure discarding all search results — fixed.** The search loop isolates library failures, retains successful results, and displays unavailable-edition warnings with retry. Source review verifies this path; no physical library-corruption fault was introduced.
6. **Different retained history limits — aligned.** Native searches, Recently Viewed, and incoming search-history decoding now retain 50 entries, matching web. Edition-preserving history persistence and continuity merge checks pass.
7. **Native search filters and result summary missing — fixed.** Controls now render and selected filters actually narrow results. On-device verification narrowed `101.1` from 17 results to one Building Code 2022 result.
8. **Saved root / Unassigned saves — corrected to the owner's intent.** The empty Projects area remains empty when there are no Projects. The bottom entry, count, collection contents, and collection export scope refer to saves outside Projects. On-device verification showed `Unassigned saves · 4`.
9. **Recently Viewed duplicate title previews — fixed.** Native history suppresses stored previews that merely repeat the heading. Existing source-based preview hydration remains in place. Rendered history confirmed the duplicate text is suppressed.
10. **Research history timestamp titles / empty drafts — clarified.** Automatic timestamp titles prefer the starter question; empty conversations show `Empty draft` or `Draft with selected evidence`. User-authored titles remain intact. Research summary and client-context recovery checks pass.
11. **Purchase consent visible despite hidden state — fixed.** The web consent container now honors `[hidden]` despite competing layout CSS. Source-level fix; no purchase was initiated.
12. **Unclear Reader typography scope — clarified.** Web labels specify `this reader`; native settings specify all iPhone readers. Platform-specific ranges remain intentional. Settings checks pass.
13. **Eager native snippet preparation — optimized with measurement.** Global results defer snippet generation to visible expanded rows. A physical-device warm-query measurement for 500 matches was approximately 109 ms eager versus 53 ms deferred; this is one preparation-step measurement, not an overall app-speed claim. Historical preview and navigation tests pass, and expanded native results displayed their previews.
14. **Owner-requested web cards and grouping — implemented.** Web uses code-family cards with expandable edition rows, counts, newest-first editions, and one expanded edition at a time. Browser checks verified accordion behavior, source opening, and restored expansion state.
15. **Additional reload defect found during verification — fixed.** Consuming a section route now restores `/workspace` rather than `/`. Browser verification confirmed repeated reloads retain the workspace and historical Reader. A regression test covers the route.

## Previously failing checks

1. `reader-search-recovery-contract.mjs`: loaded the current production search helpers into its harness and observed the current detail-pane reveal rather than the retired linked-reader callback. Preserved assertions for failed-fetch recovery, exact edition identity, retry, closed panes, and stale-account suppression.
2. `research-list-summary-contract.mjs`: updated stale expectations for disclosure placement, current disclosure and Report labels, full-width grid layout, and theme-aware primary text. Added executable disclosure checks proving that Project facts, conversation assumptions, and unresolved facts remain distinct, including missing-facts-only and empty cases. Product UI was not changed in this follow-up.

## Verification

All eight related web checks pass:

1. Reader search recovery.
2. Reader typo-tolerant search.
3. Search position, edition/accordion restoration, pagination retry, and workspace route.
4. Cross-platform HTTP search scope, exact phrase, and pagination.
5. Research list summary, context recovery, and disclosure rendering.
6. Settings wording parity.
7. Continuity merge.
8. Offline cache contract.

The previous physical iPhone runs passed all selected tests: saved evidence identity, exact phrase/snippet preparation, unrestricted authored matching before filters, history edition persistence, and historical all-edition search/navigation. The final run on the implemented native source passed all three selected cases. No additional native source changes were made during this follow-up.

Remaining release work: push/deploy the web changes and distribute an iOS release when requested. These actions are separate from completion of the local findings list.
