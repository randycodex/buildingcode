# Preserved branch integration — October 12, 2026

This integration reconciles the three previously unmerged branches with main at `0457828b6b4cba534ce5d5c80ae50c4e9e42c519`. It also includes the local centered-content change `0dc0156fdc4a4ca07fd596e604fffa7fb8416fbb`: workspace content stays centered and no wider than 800px while the outer columns remain resizable.

## Branches integrated

| Branch | Reviewed tip | Resolution |
| --- | --- | --- |
| `codex/reader-opening-performance` | `448351450b8823af0e403b8bcb11200b2174b777` | Integrated opening, rendering-batch, search-session, and source-target fixes; retained main's bookmark snapshot and current Report preview. |
| `codex/speed-ux-review` | `dcc63139bd9a8a2b20b38e754d385aafec70bc07` | 59 of 61 changed files already matched delivered work. Preserved their current successors and integrated the remaining native detail-loading cancellation, deduplication, and stale-result safeguards. |
| `codex/minimal-workflow-plan` | `887c94fb277b1630384d2fde724a3e31e2f43e4e` | Integrated missing native behavior, marketing refinements, and planning/experiment material; reconciled older prototypes with current navigation and save policies. |

## Missing behavior retained from the older workflow branch

- Reader passage swipes: a short swipe reveals actions; a deliberate long swipe saves to the current Project destination. Existing links, highlighting, attributed text, and failed-save/remove handling remain intact.
- Reader-to-Research handoff forwards through the account owner and reuses an open conversation without taking the user out of Reader.
- Search opening uses an explicit prepared destination, defers presentation until history dismisses, rejects stale preparation, and preserves the current Reader handoff and restoration behavior.
- Recently opened ordering supports recent, date, and code preferences, including edition-safe groups.
- Research keeps the current paginated, account-scoped history while adding serial selected-conversation deletion, partial-failure reporting, a compact composer, and primary-answer copying.
- Project context supports tap-to-caret editing with the current guarded update transaction. Project Facts retain grouped source notes, dates, and their fact associations.
- Reader's pinned heading follows Chapters/Appendix viewport boundaries. Current Project navigation and full-width Project sections are retained.
- Dedicated Sources/Account presentation and the dark marketing home refinements are retained.

Current Project-required saving supersedes the old unassigned-save prototype. Current evidence, applicability, repair, private-cache, account, and subscription guards are retained. The minimal-workflow plan is preserved as a proposal; merging the document does not implement its proposed workflow replacement.

The real-case comparison preflight, historical results, scripts, and deterministic budget/dataset checks are preserved. No paid model calls or new evaluations were run for this integration.

## Validation

- Web client builds and workspace-entry bundling passed.
- Focused Reader opening/rendering/search/navigation/bookmark/width/offline checks passed.
- Native host-executed checks passed for passage actions, Research routing, detail ownership, attributed-text reuse, definitions, bookmark destinations, Project save policy, reopening, recently opened ordering, Search presentation, bulk deletion, and answer copying.
- Marketing, real-case budget/dataset, Research summary/handoff/in-place switching, Notebook collapse, and workflow navigation checks passed.
- The full iOS app compiled for both simulator architectures using a temporary validation project with the existing PNG icon assets. The normal release project remains unchanged. Its build is blocked on this host because Xcode cannot locate `icontool` for the Icon Studio asset.
- No available iPhone simulator runtime/device was installed, so simulator interaction and physical-device acceptance were not performed.

## Preserved working files and delivery boundary

The original `codex/minimal-workflow-plan` checkout's four modified files and 98 untracked files were left intact, including its local evaluation records and source-discovery bundle. The `codex/speed-ux-review` checkout's 22 modified files were left intact. Other active worktrees were preserved.

The three reviewed tips are integrated into local main. This work has not been pushed or deployed. Historical experiment results and build evidence do not establish hosted or device acceptance.
