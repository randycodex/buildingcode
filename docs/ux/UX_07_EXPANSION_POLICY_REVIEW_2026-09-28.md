# UX-07 expansion policy review — September 28, 2026

Status: web implementation and bounded local rendered acceptance complete. Native implementation/device acceptance and hosted rollout remain open.

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

## Implemented web behavior and rendered acceptance

The fallback source lives in `defaultExpandedResultSource`, separate from explicit `expandedResultSources`, so automatic defaults do not accumulate as user preferences. `searchExpansionDecisionKey` persists the query, filters, edition and durable active-source request suffix. Transient context tokens do not reset choices on reload. Initial pages and subsequent pages both defer an untouched decision until matches exist.

Local synthetic signed-in workspace at port8805, asset `20260928-search-expansion-v600`, shell1243:

- Broad `egress`: 25 loaded matches, 2022 Building automatically open; 2014 Building, Existing Building and Fire remain available as collapsed cards.
- Explicitly collapsed 2022, then loaded more: 50 matches represented (28/19/1/2), all result groups remain collapsed. Reload restored those counts and collapsed choices.
- Exact `3301.9.1.4`: 3 matches; 2022 Building open with the exact section visible, 2014 Building and current consolidated Administrative Title28 available.
- Explicitly opened 2014, then changed to `egress`: 2014 stays expanded, 2022 stays collapsed. Automatic defaults did not become sticky preferences.
- Existing occupied Reader and unsent Research draft remained present. No owner data or paid Research action was used.

Screenshot: [exact query](UX_07_EXACT_EXPANSION_2026-09-28.png).

Validation: search-interaction-performance suite (including expansion and persistence), active-source UI contract, UX alignment suite, offline contracts and JavaScript syntax pass. No latency/FPS improvement is claimed; this removes an initial expansion tap. Native41.30 is unchanged and still awaits its physical chapter test.

## Separately observed follow-up

The existing Recently Viewed tile for the synthetic historical `28-101.3.1` showed a 2022 Administrative label after navigating the 2014 source. Its label uses a prefix-only fallback at `renderSearchHistory` (`entry.codeSectionName || codeDisplayLabel(entry.codePrefix || "BC")`). This needs a bounded source-identity review under UX04/10; no fix or destination claim is included in this expansion change.

The separately observed history defect is corrected and locally verified in [UX04/10 history edition follow-up](UX_04_10_RECENT_HISTORY_EDITION_2026-09-28.md).
