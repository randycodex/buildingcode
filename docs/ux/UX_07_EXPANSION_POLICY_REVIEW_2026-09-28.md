# UX-07 expansion policy review — September 28, 2026

Status: source review complete; implementation and rendered acceptance remain open.

## Confirmed behavior

Web Search preserves `expandedResultSources` across query edits and reload. New groups start collapsed unless their source key is remembered. Pagination reuses groups and preserves explicit collapse. Removing the last expanded source leaves an empty array indistinguishable from a user who has never chosen a group. All loaded result rows are constructed even when collapsed; opening a group is a visibility change, not a search-scope optimization.

Native Search clears `expandedSearchGroups` on every query edit, supports one expanded group, and does not save expansion in `SearchSessionSnapshot`. Build 41.30 remains unchanged for its pending chapter check.

## Chosen implementation direction

1. Preserve remembered expanded sources when any are represented in the first nonempty result page.
2. Otherwise open one represented group: the source of the first exact section-number match, or the first ranked result when no exact section-number match exists. Do not hardcode an edition or imply the newest edition is legally applicable.
3. Consume this initial decision once per query and active-source scope. Persist the decision so explicit all-collapsed state survives reload. Never reconsider it during pagination or retries.
4. Defer the decision if a page is empty but more candidates remain. Explicit user interaction consumes the decision immediately.
5. Preserve every result, edition card, count, and pagination action. Do not change query ranking or source availability.
6. Adapt the policy to native one-group behavior after the prepared device candidate is verified; do not silently impose web multi-group behavior on iOS.

## Required verification before completion

Exercise actual normalization and policy functions for exact and broad queries, represented and absent remembered sources, explicit all-collapsed reload, empty initial page, retries, scope changes, and later pages containing a newer or better-ranked group. Render exact and broad searches, collapse the initial group, paginate and reload, and verify choices and full coverage remain intact. Native acceptance remains separate.

## Regression prerequisite repaired

The existing `search-position-state.mjs` fixture omitted the current pagination request context and failed before its retry assertions. It now supplies the validity callback, source scope, edition and abort signal. Additional cases prove obsolete requests do not reach the network and a response invalidated while awaiting data does not advance pagination. The test is included in `test:search-interaction-performance`. This is test maintenance, not an application performance improvement.
