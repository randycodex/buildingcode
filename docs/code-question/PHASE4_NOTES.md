# Phase 4 notes — Evidence

## Delivered

- Pure module: `public/code-question-evidence.js`
  - Candidates (search/bookmark-like) never enter analysis
  - Editor proposals vs Reviewer/Owner approval
  - Immutable evidence snapshots (text hash)
  - Versioned Evidence Sets (add/remove → vN+1)
  - Source verification labels separate from Project applicability notes
  - Reconstructable set content hashes
  - Unassigned Saved preserved outside tray
- UI panes: Candidates, Evidence Reader, Evidence Tray (flag-gated)
- Tests: `tests/code-question-evidence-contract.mjs`

## Roles

- Editor/Owner: propose
- Reviewer/Owner: approve, reject, remove
- Viewer: read-only

## Not in Phase 4

- Live corpus Search integration into Candidates (seeded/scoped candidates for shell)
- Full Reader code-library binding
- Analyze pipeline binding (Phase 5)
