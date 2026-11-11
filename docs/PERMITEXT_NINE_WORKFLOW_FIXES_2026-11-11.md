# Nine workflow fixes

This change addresses the nine findings from the production audit of release `1c67c4c56`. Verification below uses the local application and real authenticated API routes with isolated synthetic accounts. It does not claim a production deployment or production acceptance.

| Finding | Result | Verification |
|---|---|---|
| 1. Workspace creation from Report | The creation sheet mounts inside the active Report instead of its inert underlying columns. | Created a workspace from Report in the browser; actual creation-host regression and Project workspace contracts. |
| 2. Stale Notebook index | Calculation, passage and Assistant saves publish their Notes immediately. Entering Notebook refreshes its catalog without replacing open editors. | Saved a calculation after opening Notebook, returned without reload, and found the new Note; catalog and navigation tests. |
| 3. Figures lost in passage-to-Note transfer | Source conversion retains image blocks, text, captions and table structure. Canonical code URLs display through the current app origin. | Three source figures rendered in a saved R102.1 Note; actual source conversion tested. |
| 4. Group edit ignored | Reconciliation preserves explicit membership instead of adding linked movement companions again. | Removed Evidence detail, saved, reopened Edit group, and verified it remained unchecked; group and move contracts. |
| 5. Illustrated evidence unavailable to Reports | Source extraction, manifest validation, Report previews and PDF layout preserve verified code figures in source order. | All five audited provisions available through Report Sources; 63 source figures exported through authenticated API routes. |
| 6. Overlapping Report additions | Source handoffs queue behind saves and each other, retaining their selected destination and source data. | Three rapid browser additions saved successfully; delayed-save and workspace-change regression tests. |
| 7. HTTPS embed export | Export resolves public HTTPS image material. Code assets verify manifest hashes; other URLs use bounded, address-pinned HTTPS reads. The existing authenticated image reader provides previews without relaxing the browser image policy. | Five HTTPS Note images included in the issued PDF; public PNG download checked; private addresses, changed hashes and cross-Project access rejected. |
| 8. Empty Calculator question | The handoff recognizes both the current V2 composer and the legacy composer. | Browser displayed the complete reviewed calculation question without sending it; both composer variants and unsent-draft preservation tested. |
| 9. Notice-only last page | The professional-use notice is placed on the cover. | PDF text and rendered pages verify the notice on the cover and no separate notice-only ending. |

Findings 3, 5 and 7 are related image paths and share verified image material handling. Source figures and remote embeds remain distinct from private uploaded assets. Issued PDF files remain immutable; newly generated manifests record image hashes.

## Checks

- `npm run test:nine-workflow-fixes`: all nine regressions plus five illustrated source/API workflows.
- `npm run test:production-workflow-fixes`: prior eleven fixes, rich Notes, tables, links, five uploaded images and immutable PDF checks.
- `npm run test:calculation-evidence` and `npm run test:workflow-views`.
- Existing Report evidence HTTP, pane grouping, continuous Notebook editor, offline shell and cache contracts.
- `npm run build:production` and `git diff --check`.

The image API test issues a 64-page PDF containing 68 image placements: 63 figures from R102.1, R103.3, M103.1, S101.1 and D106.1, plus five HTTPS Note images. All pages were rendered and reviewed. A separate browser-issued PDF verified the copied illustrated Note through the UI.

Some existing VM test fixtures needed their dependencies updated to match current application functions and the current text-style menu. No editor behavior was changed for those fixture updates.

Client and offline-shell revision: `20261111-nine-workflow-fixes-v1663`.
