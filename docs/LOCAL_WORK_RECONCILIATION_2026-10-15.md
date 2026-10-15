# Local work reconciliation — October 15, 2026

The Settings changes are complete on `main` through `50f1ccd762fb5181e0116c063f1bb14ec92f33b0`. Fetching origin found main 55 commits ahead and none behind. Both old local branches and every recorded detached worktree HEAD are already ancestors of main.

## Work retained in main

- The September 30 TestFlight authorization and processing checkpoint is retained as dated history, not current release acceptance.
- The retrieval evaluation ledger now includes 63 previously uncommitted calls. Its original 1,835 entries, pricing, and spending cap are unchanged. No evaluation was run and no budget was renewed during reconciliation.

## Work preserved separately

The private local archive is `~/Documents/Permitext Archives/2026-10-15-main-reconciliation/`. It contains a hash-verified copy of 1,714 working/private files (295,348,796 bytes), binary working-tree patches, Git/worktree/ref inventories, and Git bundles. The archive directory is owner-only. Rebuildable node_modules and Finder metadata were excluded; the original checkout remains intact because local processes and another checkout use it.

- All three historical stashes remain intact and have explicit `refs/archive/2026-10-15/` preservation refs. They include the official-PDF experiment, historical corpus/native authoring, and HTML/Excel pipeline. These are not assumed equivalent to current production source.
- Source-discovery checkpoint `f3c3d7a3392b764cfe4ea947994b1969d7a55ce7` contains the four bundled commits and three later improvements. Its evaluation recommended keeping it off production after an unsuccessful final acceptance case. It remains preserved rather than activated by this cleanup.
- Session-specific model-comparison scripts, their evaluator patch, historical evidence, and private captures remain together. The runner can recreate a historical allowance if its ledger is absent, so these scripts are not published as safe current tooling.
- The historical validation-v11 acceptance-field edit is preserved without promoting an unverified old production claim.
- Private data, environment files, paid-run locks, Xcode user metadata, and `DO NOT DELETE.png` are preserved locally and are not staged for publication.
- Nine open dependency-update branches contain distinct updates. They are not merged feature leftovers and are retained for dependency review.

## Validation and next audit

The web/backend smoke suite passes at the completed Settings revision. The default smoke additionally fails a native Project Hub source assertion that still expects the old Notebook/inline Research History layout; current native navigation and UI tests use pushed Context/Facts/Notes/Evidence/Reports screens and a project-filtered Research tab. Reconcile that assertion against current behavior during the performance audit, retaining its data, transport, export, and no-Workboard checks.

This is local source/recovery evidence. It is not physical-device, TestFlight, or hosted-production acceptance. Remote SHA equality will be checked after pushing main; performance changes will be made on a new branch.
