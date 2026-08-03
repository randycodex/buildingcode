# ADR 008 — URL and pane identity

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

Preserve the existing multi-column workspace engine. Question-scoped panes use **stable identities that include both Project ID and Code Question ID**.

### Pane keys

- Format (logical): `cq:{projectID}:{questionID}:{paneRole}` (see `questionPaneKey` in `code-question-contract.mjs`).
- Roles include definition, candidates, reader, evidence-tray, approved-evidence, analysis, conclusion, review-requests, history, memo-draft, readiness, versions, etc.
- Workspace-state normalization **closes or rebinds** panes that no longer belong to the active Project/question.
- Old saved layouts continue to **normalize safely**.

### URL / history

- Stable deep links encode Project and Code Question (and optional stage focus) without duplicating full pane width/order state in the URL.
- Browser history restoration must not create a second copy of pane state; layout remains in workspace-state storage.
- Changing stage control updates recommended open/focused panes and **must not** mutate facts or advance shared review/approval/issue state.

### Responsive behavior (contract)

| Width | Model |
| --- | --- |
| ≥1440px | Up to three primary panes + collapsible context |
| 1180–1439px | Two primary panes; overflow-x auto for the rest |
| 768–1179px | One focused pane + named switcher/drawer; panes not closed |
| &lt;768px | One focused web pane or adapted native Project Hub |

### Switch guarantees

- Project switch replaces all Project-owned context without full-workspace empty flash.
- Question switch replaces all question-owned context without leaking prior question content.
- One visible Workboard per selected Project.

## Consequences

- Phase 2 implements pane registry entries and normalization; Phase 0 only defines the identity contract and tests for pure key helpers.
- No resurrection of obsolete pane IDs or removed Project-detail render paths.
